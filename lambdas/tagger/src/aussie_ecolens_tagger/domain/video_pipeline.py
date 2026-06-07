"""Frame-sampled video tagging (1 fps) without persistence."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog

from aussie_ecolens_tagger.domain.aggregate import aggregate_frame_tags
from aussie_ecolens_tagger.domain.pipeline import tag_image
from aussie_ecolens_tagger.domain.thumbnailer import frame_to_thumbnail_jpeg
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.services.video import extract_frames_one_per_second

log = get_logger(__name__)

VIDEO_SUFFIXES = frozenset({".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"})


def is_video_path(path: Path) -> bool:
    return path.suffix.lower() in VIDEO_SUFFIXES


def store_video_poster(
    local_path: Path,
    *,
    s3: Any,
    thumbnails_bucket: str,
    sha: str,
    max_edge: int,
    jpeg_quality: int,
) -> None:
    """Save the first video frame as <sha>.jpg in the thumbnails bucket."""
    for _second, frame in extract_frames_one_per_second(local_path):
        thumb = frame_to_thumbnail_jpeg(
            frame, max_edge=max_edge, jpeg_quality=jpeg_quality
        )
        s3.put_bytes(
            thumbnails_bucket,
            f"{sha}.jpg",
            thumb,
            content_type="image/jpeg",
        )
        log.info("video poster stored", sha=sha, bytes=len(thumb))
        return
    log.warning("video has no decodable frames; poster skipped", path=str(local_path))


def tag_video_path(
    local_path: Path,
    *,
    detector: Any,
    classifier: Any,
    snip_size: int,
    max_frames: int,
    s3_bucket: str,
    s3_key: str,
) -> tuple[dict[str, int], int, bool]:
    """Sample one frame per second, tag each, aggregate (max per species).

    Returns (latin_keyed_tags, n_frames_processed, truncated).
    """
    frames_dir = local_path.parent
    frame_tag_maps: list[dict[str, int]] = []
    n_frames = 0
    truncated = False

    for second, frame in extract_frames_one_per_second(local_path):
        if n_frames >= max_frames:
            truncated = True
            log.warning("video frame cap reached; truncating", cap=max_frames)
            break
        frame_path = frames_dir / f"frame_{second:05d}.jpg"
        frame.save(frame_path, format="JPEG")
        try:
            frame_result = tag_image(
                image_path=frame_path,
                image=frame,
                detector=detector,
                classifier=classifier,
                snip_size=snip_size,
                s3_bucket=s3_bucket,
                s3_key=s3_key,
            )
            frame_tag_maps.append(frame_result.tags)
        finally:
            frame_path.unlink(missing_ok=True)
        n_frames += 1

    aggregated = aggregate_frame_tags(frame_tag_maps)
    return aggregated, n_frames, truncated
