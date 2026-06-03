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
from pathlib import Path
from typing import Any

import structlog

from aussie_ecolens_tagger import _runtime
from aussie_ecolens_tagger.config import settings
from aussie_ecolens_tagger.domain.aggregate import aggregate_frame_tags
from aussie_ecolens_tagger.domain.models import TagResult
from aussie_ecolens_tagger.domain.pipeline import tag_image
from aussie_ecolens_tagger.exceptions import TaggerError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.services.dynamodb import DynamoDBService
from aussie_ecolens_tagger.services.video import extract_frames_one_per_second

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

    try:
        with tempfile.NamedTemporaryFile(
            suffix=Path(key).suffix or ".mp4", delete=True
        ) as tmp:
            local_path = Path(tmp.name)
            _s3.download(bucket, key, local_path)

            # Tag one frame per second; collect per-frame Latin tag maps.
            # MegaDetector reads the image FROM THE PATH (it ignores any in-
            # memory image), so each frame must be written to a real image file
            # and that path handed to the pipeline - passing the video path
            # would make the detector try to read the .mp4 as an image (zero
            # detections). We write each frame to a temp .jpg in the same dir.
            #
            # A frame cap bounds total runtime: CPU inference is ~15s/frame, and
            # Lambda's hard ceiling is 15 min, so we process at most
            # settings.max_video_frames seconds of video. Longer videos are
            # truncated (documented limitation; the production path fans frames
            # out to parallel workers via Step Functions / Batch).
            frames_dir = local_path.parent
            frame_tag_maps: list[dict[str, int]] = []
            n_frames = 0
            truncated = False
            for second, frame in extract_frames_one_per_second(local_path):
                if n_frames >= settings.max_video_frames:
                    truncated = True
                    log.warning(
                        "video frame cap reached; truncating",
                        cap=settings.max_video_frames,
                    )
                    break
                # Persist the frame as a real JPEG so MegaDetector can read it.
                frame_path = frames_dir / f"frame_{second:05d}.jpg"
                frame.save(frame_path, format="JPEG")
                try:
                    frame_result = tag_image(
                        image_path=frame_path,
                        image=frame,
                        detector=_detector,
                        classifier=_classifier,
                        snip_size=settings.snip_size,
                        s3_bucket=bucket,
                        s3_key=key,
                    )
                    frame_tag_maps.append(frame_result.tags)
                finally:
                    frame_path.unlink(missing_ok=True)
                n_frames += 1

        # Aggregate per-frame tags -> one video-level tag map (max per species).
        aggregated = aggregate_frame_tags(frame_tag_maps)
        elapsed_ms = (time.monotonic() - started) * 1000.0

        # Build a synthetic TagResult so the existing DynamoDB writer produces
        # the same contract record (it sets file_type=video from the key, and
        # leaves thumbnail_url NULL for videos). n_detections/classified are
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
    