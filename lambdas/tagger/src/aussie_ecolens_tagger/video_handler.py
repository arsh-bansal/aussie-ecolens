"""S3-triggered Lambda entry point for VIDEO tagging (assignment 2.1.2 / 4.2).

Videos are handled by sampling one frame per second, running each frame
through the same MegaDetector + SpeciesNet pipeline as the image tagger, then
aggregating the per-frame results into a single video record in DynamoDB.

This is a THIRD entry point on the tagger container image (alongside the
image handler and the query handler), reusing the shared cold-start runtime
(models + detector/classifier) and the proven tag_image pipeline - so there
is exactly one ML codebase. Only the orchestration differs: extract frames,
tag each, aggregate, persist one record with file_type=video.

Per the spec: "Video files can be handled by extracting frames as images,
then using the image detection model ... extract 1 image per second (do not
try to extract all frames)."
"""

from __future__ import annotations

import json
import tempfile
import time
import urllib.parse
from pathlib import Path, PurePosixPath
from typing import Any

import structlog

from aussie_ecolens_tagger import _runtime
from aussie_ecolens_tagger.config import settings
from aussie_ecolens_tagger.domain.models import TagResult
from aussie_ecolens_tagger.domain.video_pipeline import store_video_poster, tag_video_path
from aussie_ecolens_tagger.exceptions import TaggerError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.services.dynamodb import DynamoDBService
log = get_logger(__name__)

_s3 = _runtime.s3
_detector = _runtime.detector
_classifier = _runtime.classifier
_db = DynamoDBService(
    table_name=settings.files_table,
    region_name=settings.aws_region,
    dry_run=settings.dry_run,
)

log.info("video handler ready")

QUERY_TEMP_PREFIX = "query-temp/"


def _is_query_temp_key(key: str) -> bool:
    return key.startswith(QUERY_TEMP_PREFIX)


def lambda_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Tag the uploaded video(s) referenced by the event and persist one
    aggregated record per video.

    Accepts the same two event shapes as the image handler (EventBridge
    "Object Created" and the legacy S3 "Records" array) for robustness.
    """
    request_id = getattr(context, "aws_request_id", "local")
    structlog.contextvars.bind_contextvars(request_id=request_id)

    pairs = _extract_bucket_keys(event)
    log.info("invocation start", n_records=len(pairs))

    summaries: list[dict[str, Any]] = []
    for bucket, key in pairs:
        summaries.append(_process_one(bucket, key))

    structlog.contextvars.clear_contextvars()
    return {"statusCode": 200, "body": json.dumps({"records": summaries})}


def _process_one(bucket: str, key: str) -> dict[str, Any]:
    """Download one video, tag it frame-by-frame, aggregate, and persist."""
    structlog.contextvars.bind_contextvars(s3_bucket=bucket, s3_key=key)
    started = time.monotonic()

    if _is_query_temp_key(key):
        log.info("skipping transient query video (search-by-file)")
        return {"s3_key": key, "skipped": "query-temp"}

    try:
        with tempfile.NamedTemporaryFile(
            suffix=Path(key).suffix or ".mp4", delete=True
        ) as tmp:
            local_path = Path(tmp.name)
            _s3.download(bucket, key, local_path)

            sha = PurePosixPath(key).stem
            store_video_poster(
                local_path,
                s3=_s3,
                thumbnails_bucket=settings.thumbnails_bucket,
                sha=sha,
                max_edge=settings.thumbnail_max_edge,
                jpeg_quality=settings.thumbnail_jpeg_quality,
            )

            aggregated, n_frames, truncated = tag_video_path(
                local_path,
                detector=_detector,
                classifier=_classifier,
                snip_size=settings.snip_size,
                max_frames=settings.max_video_frames,
                s3_bucket=bucket,
                s3_key=key,
            )
        elapsed_ms = (time.monotonic() - started) * 1000.0

        # Build a synthetic TagResult so the existing DynamoDB writer produces
        # the same contract record (file_type=video, thumbnail_url=<sha>.jpg).
        # n_detections/classified are
        # summed across frames for observability; tags are the aggregate.
        total = sum(aggregated.values())
        result = TagResult(
            s3_bucket=bucket,
            s3_key=key,
            tags=aggregated,
            n_detections=total,
            n_classified=total,
            n_below_threshold=0,
            elapsed_ms=elapsed_ms,
        )
        _db.put_tag_result(result)

        log.info(
            "video pipeline complete",
            frames=n_frames,
            species=list(aggregated.keys()),
            elapsed_ms=round(elapsed_ms, 1),
        )
        return {
            "s3_key": key,
            "frames": n_frames,
            "truncated": truncated,
            "tags": aggregated,
        }

    except TaggerError as e:
        log.error("video record failed", error_type=type(e).__name__, error=str(e))
        return {"s3_key": key, "error": str(e), "error_type": type(e).__name__}


def _extract_bucket_keys(event: dict[str, Any]) -> list[tuple[str, str]]:
    """Normalize EventBridge or S3-notification events into (bucket, key) pairs.

    Mirrors the image handler's normaliser so the video path is equally robust
    to the trigger mechanism.
    """
    pairs: list[tuple[str, str]] = []

    if "detail" in event and "Records" not in event:
        try:
            detail = event["detail"]
            bucket = detail["bucket"]["name"]
            key = urllib.parse.unquote_plus(detail["object"]["key"])
            pairs.append((bucket, key))
        except (KeyError, TypeError) as e:
            log.error("malformed eventbridge event", error=str(e))
        return pairs

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
    