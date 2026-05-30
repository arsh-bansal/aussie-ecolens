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

    records = event.get("Records", [])
    log.info("invocation start", n_records=len(records))

    summaries: list[dict[str, Any]] = []
    for record in records:
        try:
            bucket, key = _parse_s3_record(record)
        except (KeyError, ValueError) as e:
            log.error("malformed s3 record", error=str(e))
            summaries.append({"error": f"malformed record: {e}"})
            continue

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


def _parse_s3_record(record: dict[str, Any]) -> tuple[str, str]:
    """Extract (bucket, key) from a single S3 event record.

    S3 url-encodes keys with special characters (spaces, plus signs);
    we unquote so downstream code sees the canonical form.
    """
    s3 = record["s3"]
    bucket = s3["bucket"]["name"]
    key = urllib.parse.unquote_plus(s3["object"]["key"])
    return bucket, key
