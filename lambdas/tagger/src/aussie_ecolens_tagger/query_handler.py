"""Synchronous "tag-only" Lambda entry point (find-by-uploaded-file).

Powers the query API's POST /search/by-file feature (assignment 2.2.3): the
caller hands over an image or video, this runs the same MegaDetector + SpeciesNet
pipeline as the tagger, and returns just the detected species counts. It
does NOT write to DynamoDB or store anything — the media is transient, used
only to compute tags for a search.

It reuses the shared cold-start runtime (models + detector/classifier), so
there is exactly one ML codebase; this is simply a second entry point on
the same container image.

Invocation contract (agreed with the query API owner):

  Input - either an inline base64 image (small files) ...
    {"image": "<base64-encoded image bytes>"}
  ... or a reference to an object in S3 (any size, avoids the 6 MB Lambda
  payload limit):
    {"bucket": "<bucket>", "key": "<key>"}

  Output:
    {"tags": {"koala": 2, "wombat": 1}}   # common names -> counts
  or on error:
    {"error": "<message>", "error_type": "<ClassName>"}

Tags are returned as COMMON names (koala), matching what the tagger stores
and what the search endpoints expect - the Latin->common translation
happens here so the query API never sees scientific names.
"""

from __future__ import annotations

import base64
import binascii
import tempfile
from pathlib import Path
from typing import Any

import structlog

from aussie_ecolens_tagger import _runtime
from aussie_ecolens_tagger.config import settings
from aussie_ecolens_tagger.domain.pipeline import tag_image
from aussie_ecolens_tagger.domain.video_pipeline import is_video_path, tag_video_path
from aussie_ecolens_tagger.exceptions import TaggerError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.species import common_name

log = get_logger(__name__)

_s3 = _runtime.s3
_detector = _runtime.detector
_classifier = _runtime.classifier

log.info("query handler ready")


class QueryInputError(TaggerError):
    """The query event did not contain a usable media reference."""


def _to_common_names(tags: dict[str, int]) -> dict[str, int]:
    """Translate Latin-keyed tag counts to common-name keys.

    The pipeline aggregates by the canonical Latin species id; the query
    API contract is common names. If two Latin species mapped to the same
    common name (they do not today) the counts would sum, which is the
    desired behaviour anyway.
    """
    out: dict[str, int] = {}
    for latin, count in tags.items():
        name = common_name(latin)
        out[name] = out.get(name, 0) + count
    return out


def _load_media_to_tmp(event: dict[str, Any], tmp_dir: Path) -> Path:
    """Materialise the request media into a temp file, return its path.

    Accepts either an inline base64 image or an S3 {bucket, key} reference.
    Raises QueryInputError if neither is present or the data is unusable.
    """
    bucket = event.get("bucket")
    key = event.get("key")
    if bucket and key:
        suffix = Path(key).suffix or ".bin"
        dest = tmp_dir / f"query{suffix}"
        _s3.download(bucket, key, dest)
        return dest

    b64 = event.get("image")
    if b64:
        try:
            raw = base64.b64decode(b64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise QueryInputError(f"image is not valid base64: {exc}") from exc
        if not raw:
            raise QueryInputError("decoded image is empty")
        dest = tmp_dir / "query.bin"
        dest.write_bytes(raw)
        return dest

    raise QueryInputError(
        "event must contain either {'image': <base64>} or {'bucket','key'}"
    )


def lambda_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Run the tagging pipeline on transient media and return tag counts.

    Args:
        event: {"image": <base64>} or {"bucket","key"}.
        context: Lambda context (unused beyond request id for logging).

    Returns:
        {"tags": {<common_name>: <count>}} on success, or
        {"error": ..., "error_type": ...} on failure.
    """
    request_id = getattr(context, "aws_request_id", "local")
    structlog.contextvars.bind_contextvars(request_id=request_id)

    result_key = event.get("result_key")
    pending_key = event.get("pending_key")
    source_bucket = event.get("bucket")
    source_key = event.get("key")
    response: dict[str, Any]

    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            media_path = _load_media_to_tmp(event, tmp_dir)
            s3_bucket = source_bucket or "query"
            s3_key = source_key or "query-file"

            if is_video_path(media_path):
                aggregated, n_frames, truncated = tag_video_path(
                    media_path,
                    detector=_detector,
                    classifier=_classifier,
                    snip_size=settings.snip_size,
                    max_frames=settings.query_max_video_frames,
                    s3_bucket=s3_bucket,
                    s3_key=s3_key,
                )
                tags = _to_common_names(aggregated)
                log.info(
                    "query video tag complete",
                    n_frames=n_frames,
                    truncated=truncated,
                    n_species=len(tags),
                    tags=tags,
                )
            else:
                image = _s3.decode_image(media_path)
                result = tag_image(
                    image_path=media_path,
                    image=image,
                    detector=_detector,
                    classifier=_classifier,
                    snip_size=settings.snip_size,
                    s3_bucket=s3_bucket,
                    s3_key=s3_key,
                )
                tags = _to_common_names(result.tags)
                log.info("query tag complete", n_species=len(tags), tags=tags)

        response = {"tags": tags}

    except TaggerError as exc:
        log.error("query failed", error=str(exc), error_type=type(exc).__name__)
        response = {"error": str(exc), "error_type": type(exc).__name__}
    finally:
        if result_key and source_bucket:
            try:
                _s3.put_json(source_bucket, result_key, response)
            except Exception as exc:
                log.error("failed to write async query result", error=str(exc))
            for artifact in (pending_key, source_key):
                if artifact:
                    try:
                        _s3.delete_object(source_bucket, artifact)
                    except Exception as exc:
                        log.error("failed to delete query artifact", key=artifact, error=str(exc))
        structlog.contextvars.clear_contextvars()

    return response
