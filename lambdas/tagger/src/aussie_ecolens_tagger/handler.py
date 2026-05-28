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

from aussie_ecolens_tagger.config import settings
from aussie_ecolens_tagger.domain.pipeline import tag_image
from aussie_ecolens_tagger.exceptions import TaggerError
from aussie_ecolens_tagger.logging import configure_logging, get_logger
from aussie_ecolens_tagger.services.dynamodb import DynamoDBService
from aussie_ecolens_tagger.services.megadetector import MegaDetectorService
from aussie_ecolens_tagger.services.s3 import S3Service
from aussie_ecolens_tagger.services.speciesnet import SpeciesNetService


# -----------------------------------------------------------------------------
# Cold-start singletons. Constructed once per Lambda container, reused
# across every warm invocation. Loading the ML models is the single
# largest cold-start cost (~3-5s); doing it module-level absorbs the
# cost into AWS's accounting of cold-start latency only.
# -----------------------------------------------------------------------------

configure_logging()
log = get_logger(__name__)

log.info(
    "tagger cold start",
    aws_region=settings.aws_region,
    files_table=settings.files_table,
    detection_threshold=settings.detection_threshold,
    species_threshold=settings.species_threshold,
    snip_size=settings.snip_size,
    dry_run=settings.dry_run,
    load_models_from_s3=settings.load_models_from_s3,
)

_s3 = S3Service(region_name=settings.aws_region)


def _ensure_models() -> None:
    """Download model files from S3 to their local paths on cold start.

    No-ops when settings.load_models_from_s3 is false (local dev, where
    models are already on disk) or when a file already exists at the
    target path (warm container reuse — /tmp persists across warm
    invocations in the same Lambda execution environment).

    Models are kept in S3 rather than baked into the image so a new model
    can be rolled out by uploading to S3 and updating an env var, with no
    code change or image rebuild (assignment §4.1).
    """
    if not settings.load_models_from_s3:
        return

    wanted = [
        (settings.megadetector_s3_key, settings.megadetector_path),
        (settings.speciesnet_s3_key, settings.speciesnet_path),
    ]
    for s3_key, dest in wanted:
        if dest.exists():
            log.info("model already present, skipping download", path=str(dest))
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        log.info(
            "downloading model from s3",
            bucket=settings.models_bucket,
            key=s3_key,
            dest=str(dest),
        )
        _s3.download(settings.models_bucket, s3_key, dest)


# Download models BEFORE constructing the services that load them.
_ensure_models()

_detector = MegaDetectorService(
    model_path=settings.megadetector_path,
    detection_threshold=settings.detection_threshold,
)
_classifier = SpeciesNetService(
    model_path=settings.speciesnet_path,
    device="cpu",
    confidence_threshold=settings.species_threshold,
)
_db = DynamoDBService(
    table_name=settings.files_table,
    region_name=settings.aws_region,
    dry_run=settings.dry_run,
)


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
    