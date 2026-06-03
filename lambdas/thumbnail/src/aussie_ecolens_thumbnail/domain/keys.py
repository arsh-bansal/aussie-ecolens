"""Deterministic key derivation shared across the upload pipeline.

The thumbnail for an uploaded image is stored at a key derived purely from
the upload's checksum (the ``<sha>`` in the upload key ``<user>/<sha>.<ext>``).
Because the key is deterministic, the tagger can compute an image's
``thumbnail_url`` from the same sha WITHOUT any cross-Lambda coordination or
database write: the thumbnail Lambda just has to create the object at that
key. Both sides import this module so the convention can never drift.
"""

from __future__ import annotations

from pathlib import PurePosixPath

# Image extensions we thumbnail. Videos are handled by the video splitter,
# not here. Kept in sync with the tagger's _IMAGE_EXTS.
IMAGE_EXTS = frozenset(
    {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff"}
)


def parse_upload_key(s3_key: str) -> tuple[str, str, str]:
    """Parse an upload key ``<user>/<sha>.<ext>`` into (user_id, sha, ext).

    Defensive, mirroring the tagger: a key with no directory component yields
    user_id="unknown"; sha is always the filename stem (slash/dot-free); ext is
    lower-cased including the leading dot (or "" if none).
    """
    path = PurePosixPath(s3_key)
    sha = path.stem
    ext = path.suffix.lower()
    parts = s3_key.split("/", 1)
    user_id = parts[0] if len(parts) == 2 and parts[0] else "unknown"
    return user_id, sha, ext


def is_image_key(s3_key: str) -> bool:
    """True if the key's extension is one we generate a thumbnail for."""
    return PurePosixPath(s3_key).suffix.lower() in IMAGE_EXTS


def thumbnail_key(sha: str) -> str:
    """Deterministic thumbnail object key for a given upload checksum.

    Thumbnails are always JPEG (compressed previews), keyed by sha so the URL
    is derivable. e.g. sha "abc123" -> "abc123.jpg".
    """
    return f"{sha}.jpg"


def thumbnail_s3_url(bucket: str, sha: str) -> str:
    """Full s3:// URL of the thumbnail for a given sha."""
    return f"s3://{bucket}/{thumbnail_key(sha)}"
