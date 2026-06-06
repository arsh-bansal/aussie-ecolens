"""AWS Lambda entry point for the Tagger.

Thin adapter that:
  1. Constructs service singletons at cold start (one cold start cost,
     reused across every warm invocation in the same container).
  2. Parses the S3 ObjectCreated event envelope into (bucket, key) pairs.
  3. For each record: downloads, runs the pipeline, persists, summarizes.
  4. Returns a 200 with a per-record summary.

All actual work lives in domain.pipeline (orchestration) and services
(I/O). This file is intentionally small; if it grows, push more logic
into the domain or services layer instead.
"""

from __future__ import annotations

import json
import tempfile
import urllib.parse
from dataclasses import asdict
from pathlib import Path
from typing import Any

import structlog

from aussie_ecolens_tagger import _runtime
from aussie_ecolens_tagger.config import settings
from aussie_ecolens_tagger.domain.pipeline import tag_image
from aussie_ecolens_tagger.exceptions import TaggerError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.services.dynamodb import DynamoDBService


# -----------------------------------------------------------------------------
# Cold-start singletons. The expensive, shared setup (model download +
# detector/classifier construction) lives in _runtime, imported once per
# container and reused across warm invocations. The DynamoDB service is
# specific to this handler (the query handler does not persist), so it is
# constructed here.
# -----------------------------------------------------------------------------

log = get_logger(__name__)

_s3 = _runtime.s3
_detector = _runtime.detector
_classifier = _runtime.classifier
_db = DynamoDBService(
    table_name=settings.files_table,
    region_name=settings.aws_region,
    dry_run=settings.dry_run,
)

log.info("tagger handler ready", files_table=settings.files_table, dry_run=settings.dry_run)


# Search-by-image stages its transient query photo under this reserved prefix in
# the SHARED uploads bucket (see api_handlers/tagging.py) and deletes it straight
# after tagging. Both upload consumers (this tagger + the thumbnail Lambda) are
# wired to the whole bucket via EventBridge, which cannot express "suffix .jpg
# AND NOT prefix query-temp/" in a single pattern (array members are OR-matched),
# so the prefix must be skipped in code. Without this guard the query image gets
# a FILE#<sha> record whose S3 object is already gone -> NoSuchKey when opened
# from search results, plus a persisted query file (assignment 4.3 forbids that).
QUERY_TEMP_PREFIX = "query-temp/"


def _is_query_temp_key(key: str) -> bool:
    """True for transient search-by-image keys that must never be tagged."""
    return key.startswith(QUERY_TEMP_PREFIX)


# -----------------------------------------------------------------------------
# AWS Lambda entry point
# -----------------------------------------------------------------------------


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process one or more S3 ObjectCreated event records.

    The S3 event envelope can contain multiple records (S3 batches
    notifications). Each record is processed independently; one bad
    record does not poison the rest of the batch.

    Args:
        event: AWS Lambda S3 event payload.
        context: Lambda context object.

    Returns:
        Dict with statusCode 200 and a body summarizing each record.
    """
    request_id = getattr(context, "aws_request_id", "local")
    structlog.contextvars.bind_contextvars(request_id=request_id)

    pairs = _extract_bucket_keys(event)
    log.info("invocation start", n_records=len(pairs))

    summaries: list[dict[str, Any]] = []
    for bucket, key in pairs:
        summary = _process_one(bucket, key)
        summaries.append(summary)

    structlog.contextvars.clear_contextvars()
    return {"statusCode": 200, "body": json.dumps({"records": summaries})}


# -----------------------------------------------------------------------------
# Per-record orchestration
# -----------------------------------------------------------------------------


def _process_one(bucket: str, key: str) -> dict[str, Any]:
    """Download, tag, and persist one S3 object. Returns a summary dict.

    Catches any TaggerError so it surfaces in the returned summary
    rather than poisoning sibling records in the same batch.
    """
    structlog.contextvars.bind_contextvars(s3_bucket=bucket, s3_key=key)

    if _is_query_temp_key(key):
        # Transient search-by-image upload — never download, tag, or persist it.
        log.info("skipping transient query image (search-by-image)")
        return {"s3_key": key, "skipped": "query-temp"}

    try:
        with tempfile.NamedTemporaryFile(
            suffix=Path(key).suffix or ".bin", delete=True
        ) as tmp:
            local_path = Path(tmp.name)
            _s3.download(bucket, key, local_path)
            image = _s3.decode_image(local_path)
            result = tag_image(
                image_path=local_path,
                image=image,
                detector=_detector,
                classifier=_classifier,
                snip_size=settings.snip_size,
                s3_bucket=bucket,
                s3_key=key,
            )
        _db.put_tag_result(result)
        return {"s3_key": key, "result": asdict(result)}

    except TaggerError as e:
        log.error(
            "record failed",
            error_type=type(e).__name__,
            error=str(e),
        )
        return {"s3_key": key, "error": str(e), "error_type": type(e).__name__}


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _extract_bucket_keys(event: dict[str, Any]) -> list[tuple[str, str]]:
    """Normalize either supported event shape into (bucket, key) pairs.

    The tagger can be triggered two ways and must handle both:

    1. EventBridge "Object Created" (the deployed trigger): a single event
       with the bucket/object under ``detail``::

           {"detail-type": "Object Created",
            "detail": {"bucket": {"name": ...}, "object": {"key": ...}}}

    2. Direct S3 notification (legacy / fallback): a ``Records`` array, each
       with an ``s3`` envelope::

           {"Records": [{"s3": {"bucket": {"name": ...},
                                "object": {"key": ...}}}]}

    Keys are url-decoded (S3 encodes spaces/plus signs) so downstream code
    sees the canonical key. Malformed entries are logged and skipped rather
    than aborting the whole invocation.
    """
    pairs: list[tuple[str, str]] = []

    # EventBridge shape: a single object-created event with a "detail" object.
    if "detail" in event and "Records" not in event:
        try:
            detail = event["detail"]
            bucket = detail["bucket"]["name"]
            key = urllib.parse.unquote_plus(detail["object"]["key"])
            pairs.append((bucket, key))
        except (KeyError, TypeError) as e:
            log.error("malformed eventbridge event", error=str(e))
        return pairs

    # S3-notification shape: a "Records" array of s3 envelopes.
    for record in event.get("Records", []):
        try:
            s3 = record["s3"]
            bucket = s3["bucket"]["name"]
            key = urllib.parse.unquote_plus(s3["object"]["key"])
            pairs.append((bucket, key))
        except (KeyError, TypeError) as e:
            log.error("malformed s3 record", error=str(e))
            continue

    return pairs
    