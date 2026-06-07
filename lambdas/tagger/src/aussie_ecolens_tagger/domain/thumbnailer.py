"""Aspect-ratio-preserving JPEG thumbnails (matches the Thumbnail Lambda)."""

from __future__ import annotations

import io

from PIL import Image


def frame_to_thumbnail_jpeg(
    frame: Image.Image,
    *,
    max_edge: int,
    jpeg_quality: int,
) -> bytes:
    img = frame.copy()
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=jpeg_quality, optimize=True)
    return out.getvalue()
