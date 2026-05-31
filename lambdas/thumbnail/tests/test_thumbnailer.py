"""Tests for thumbnail generation: aspect ratio + compression (rubric 2.1.2)."""

from __future__ import annotations

import io

import pytest
from PIL import Image

from aussie_ecolens_thumbnail.domain.thumbnailer import make_thumbnail
from aussie_ecolens_thumbnail.exceptions import ThumbnailGenerationError


def _png_bytes(w: int, h: int, color=(120, 80, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()


def _dims(jpeg_bytes: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(jpeg_bytes)) as im:
        return im.size  # (w, h)


class TestAspectRatio:
    def test_landscape_scaled_to_max_edge_on_width(self) -> None:
        # 800x400, max_edge 320 -> width 320, height 160 (ratio preserved).
        out = make_thumbnail(_png_bytes(800, 400), max_edge=320, jpeg_quality=80)
        w, h = _dims(out)
        assert w == 320
        assert h == 160  # 400 * (320/800)

    def test_portrait_scaled_to_max_edge_on_height(self) -> None:
        # 400x800, max_edge 320 -> height 320, width 160.
        out = make_thumbnail(_png_bytes(400, 800), max_edge=320, jpeg_quality=80)
        w, h = _dims(out)
        assert h == 320
        assert w == 160

    def test_square(self) -> None:
        out = make_thumbnail(_png_bytes(1000, 1000), max_edge=256, jpeg_quality=80)
        assert _dims(out) == (256, 256)

    def test_aspect_ratio_exactly_preserved(self) -> None:
        out = make_thumbnail(_png_bytes(1920, 1080), max_edge=320, jpeg_quality=80)
        w, h = _dims(out)
        assert abs((w / h) - (1920 / 1080)) < 0.02


class TestNoUpscale:
    def test_small_image_not_upscaled(self) -> None:
        # 100x80 with max_edge 320 -> stays 100x80 (thumbnail never upscales).
        out = make_thumbnail(_png_bytes(100, 80), max_edge=320, jpeg_quality=80)
        assert _dims(out) == (100, 80)


class TestCompression:
    def test_output_is_jpeg(self) -> None:
        out = make_thumbnail(_png_bytes(800, 600), max_edge=320, jpeg_quality=80)
        with Image.open(io.BytesIO(out)) as im:
            assert im.format == "JPEG"

    def test_thumbnail_smaller_than_source(self) -> None:
        src = _png_bytes(1600, 1200)
        out = make_thumbnail(src, max_edge=320, jpeg_quality=80)
        assert len(out) < len(src)

    def test_lower_quality_smaller_file(self) -> None:
        src = _png_bytes(1600, 1200, color=(200, 120, 60))
        hi = make_thumbnail(src, max_edge=320, jpeg_quality=90)
        lo = make_thumbnail(src, max_edge=320, jpeg_quality=40)
        assert len(lo) <= len(hi)


class TestFormats:
    def test_rgba_png_flattened_to_jpeg(self) -> None:
        buf = io.BytesIO()
        Image.new("RGBA", (400, 300), (10, 20, 30, 128)).save(buf, format="PNG")
        out = make_thumbnail(buf.getvalue(), max_edge=200, jpeg_quality=80)
        with Image.open(io.BytesIO(out)) as im:
            assert im.mode == "RGB"
            assert im.format == "JPEG"

    def test_invalid_bytes_raise_typed_error(self) -> None:
        with pytest.raises(ThumbnailGenerationError):
            make_thumbnail(b"not an image", max_edge=320, jpeg_quality=80)
