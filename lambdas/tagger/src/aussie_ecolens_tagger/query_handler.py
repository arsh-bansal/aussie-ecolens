"""Synchronous "tag-only" Lambda entry point (find-by-uploaded-file).

Powers the query API's POST /query-file feature (assignment 2.2.3): the
caller hands over an image, this runs the same MegaDetector + SpeciesNet
pipeline as the tagger, and returns just the detected species counts. It
does NOT download from the uploads bucket, write to DynamoDB, or store
anything - the image is transient, used only to compute tags for a search.

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
from aussie_ecolens_tagger.exceptions import TaggerError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.species import common_name

log = get_logger(__name__)

_s3 = _runtime.s3
_detector = _runtime.detector
_classifier = _runtime.classifier

log.info("query handler ready")


class QueryInputError(TaggerError):
    """The query event did not contain a usable image reference."""


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


def _load_image_to_tmp(event: dict[str, Any], tmp_dir: Path) -> Path:
    """Materialise the request image into a temp file, return its path.

    Accepts either an inline base64 image or an S3 {bucket, key} reference.
    Raises QueryInputError if neither is present or the data is unusable.
    """
    # S3 reference - preferred for large images (no payload limit).
    bucket = event.get("bucket")
    key = event.get("key")
    if bucket and key:
        suffix = Path(key).suffix or ".bin"
        dest = tmp_dir / f"query{suffix}"
        _s3.download(bucket, key, dest)
        return dest

    # Inline base64 - convenient for small images.
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
    """Run the tagging pipeline on a transient image and return tag counts.

    Args:
        event: {"image": <base64>} or {"bucket","key"}.
        context: Lambda context (unused beyond request id for logging).

    Returns:
        {"tags": {<common_name>: <count>}} on success, or
        {"error": ..., "error_type": ...} on failure.
    """
    request_id = getattr(context, "aws_request_id", "local")
    structlog.contextvars.bind_contextvars(request_id=request_id)

    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            image_path = _load_image_to_tmp(event, tmp_dir)
            image = _s3.decode_image(image_path)
            result = tag_image(
                image_path=image_path,
                image=image,
                detector=_detector,
                classifier=_classifier,
                snip_size=settings.snip_size,
                # Not persisted; these are placeholders for the shared
                # pipeline signature, never stored anywhere.
                s3_bucket=event.get("bucket", "query"),
                s3_key=event.get("key", "query-file"),
            )
        tags = _to_common_names(result.tags)
        log.info("query tag complete", n_species=len(tags), tags=tags)
        return {"tags": tags}

    except TaggerError as exc:
        log.error("query failed", error=str(exc), error_type=type(exc).__name__)
        return {"error": str(exc), "error_type": type(exc).__name__}
    finally:
        structlog.contextvars.clear_contextvars()
