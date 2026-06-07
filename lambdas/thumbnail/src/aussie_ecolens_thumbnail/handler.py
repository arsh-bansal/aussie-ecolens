"""AWS Lambda entry point for the Thumbnail Lambda.

Flow per uploaded object:
  1. Parse the event into (bucket, key) pairs (EventBridge or S3 shape).
  2. Skip non-image keys (videos are the video splitter's job).
  3. Download the image, generate an aspect-ratio-preserving compressed
     thumbnail, and store it at the DETERMINISTIC key <sha>.jpg in the
     thumbnails bucket.

There is deliberately NO DynamoDB write here. The thumbnail's location is a
pure function of the upload's checksum (domain/keys.py), so the tagger derives
the same thumbnail_url for an image without any coordination with this Lambda.
That keeps the two upload consumers fully decoupled (each owns its own S3-side
effect) and removes any write race on the shared file record.
"""

from __future__ import annotations

import json
from typing import Any

import structlog

from aussie_ecolens_thumbnail.config import settings
from aussie_ecolens_thumbnail.domain.events import extract_bucket_keys
from aussie_ecolens_thumbnail.domain.keys import (
    is_image_key,
    parse_upload_key,
    thumbnail_key,
)
from aussie_ecolens_thumbnail.domain.thumbnailer import make_thumbnail
from aussie_ecolens_thumbnail.exceptions import ThumbnailError
from aussie_ecolens_thumbnail.logging import configure_logging, get_logger
from aussie_ecolens_thumbnail.services.s3 import S3Service

configure_logging()
log = get_logger(__name__)

# Reused across warm invocations.
_s3 = S3Service(region_name=settings.aws_region)

# Search-by-image stages its transient query photo under this reserved prefix in
# the SHARED uploads bucket (see api_handlers/tagging.py) and deletes it straight
# after tagging. This Lambda watches the whole bucket via EventBridge, which
# cannot express "suffix .jpg AND NOT prefix query-temp/" in a single pattern, so
# the prefix must be skipped in code. Otherwise the query image would parse as
# user_id="query-temp" and leave an orphan thumbnail object behind (a persisted
# query file — assignment 4.3 forbids that). Mirrors the tagger's guard.
QUERY_TEMP_PREFIX = "query-temp/"


def _is_query_temp_key(key: str) -> bool:
    """True for transient search-by-image keys that must never be thumbnailed."""
    return key.startswith(QUERY_TEMP_PREFIX)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Generate thumbnails for the image(s) referenced by the event.

    Returns a 200 response summarizing each processed key. Per-key failures are
    captured in the summary rather than raised, so one bad object does not fail
    the whole batch.
    """
    request_id = getattr(context, "aws_request_id", "local")
    structlog.contextvars.bind_contextvars(request_id=request_id)

    pairs = extract_bucket_keys(event)
    log.info("invocation start", n_records=len(pairs))

    summaries: list[dict[str, Any]] = []
    for bucket, key in pairs:
        summaries.append(_process_one(bucket, key))

    structlog.contextvars.clear_contextvars()
    return {"statusCode": 200, "body": json.dumps({"records": summaries})}


def _process_one(bucket: str, key: str) -> dict[str, Any]:
    """Thumbnail one uploaded object. Returns a per-object summary dict."""
    structlog.contextvars.bind_contextvars(src_bucket=bucket, src_key=key)

    # Skip transient search-by-image uploads — never thumbnail or persist them.
    if _is_query_temp_key(key):
        log.info("skipping transient query image (search-by-image)")
        return {"key": key, "skipped": "query-temp"}

    # Skip non-images: videos are handled by the video splitter, not here.
    if not is_image_key(key):
        log.info("skipping non-image key")
        return {"key": key, "skipped": "not an image"}

    _user_id, sha, _ext = parse_upload_key(key)
    dest_key = thumbnail_key(sha)

    try:
        image_bytes = _s3.get_bytes(bucket, key)
        thumb = make_thumbnail(
            image_bytes,
            max_edge=settings.max_edge,
            jpeg_quality=settings.jpeg_quality,
        )

        if settings.dry_run:
            log.info(
                "DRY_RUN thumbnail generated, upload skipped",
                dest_key=dest_key,
                bytes=len(thumb),
            )
            return {"key": key, "thumbnail_key": dest_key, "dry_run": True}

        _s3.put_bytes(settings.thumbnails_bucket, dest_key, thumb)
        log.info(
            "thumbnail stored",
            dest_bucket=settings.thumbnails_bucket,
            dest_key=dest_key,
            bytes=len(thumb),
        )
        return {"key": key, "thumbnail_key": dest_key, "bytes": len(thumb)}

    except ThumbnailError as e:
        log.error("thumbnail failed", error_type=type(e).__name__, error=str(e))
        return {"key": key, "error": str(e), "error_type": type(e).__name__}
