"""Tests for deterministic key derivation (the tagger<->thumbnail contract)."""

from __future__ import annotations

from aussie_ecolens_thumbnail.domain.keys import (
    is_image_key,
    parse_upload_key,
    thumbnail_key,
    thumbnail_s3_url,
)


class TestParseUploadKey:
    def test_standard_key(self) -> None:
        user_id, sha, ext = parse_upload_key("cognito-sub-1/deadbeef.JPG")
        assert user_id == "cognito-sub-1"
        assert sha == "deadbeef"
        assert ext == ".jpg"

    def test_no_user_prefix(self) -> None:
        user_id, sha, ext = parse_upload_key("loose.png")
        assert user_id == "unknown"
        assert sha == "loose"
        assert ext == ".png"


class TestIsImageKey:
    def test_images_recognized(self) -> None:
        for k in ["u/a.jpg", "u/a.JPEG", "u/a.png", "u/a.webp", "u/a.tiff"]:
            assert is_image_key(k), k

    def test_videos_rejected(self) -> None:
        for k in ["u/a.mp4", "u/a.mov", "u/a.avi", "u/a.mkv"]:
            assert not is_image_key(k), k


class TestThumbnailKey:
    def test_key_is_sha_dot_jpg(self) -> None:
        assert thumbnail_key("abc123") == "abc123.jpg"

    def test_url_format(self) -> None:
        assert thumbnail_s3_url("thumbs-bucket", "abc123") == (
            "s3://thumbs-bucket/abc123.jpg"
        )

    def test_key_has_no_slashes(self) -> None:
        # sha is slash-free by construction; thumbnail key must be too.
        assert "/" not in thumbnail_key("abc123")
