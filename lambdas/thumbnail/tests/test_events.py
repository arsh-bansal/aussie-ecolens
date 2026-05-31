"""Tests for event-shape normalization (EventBridge + S3 notification)."""

from __future__ import annotations

from aussie_ecolens_thumbnail.domain.events import extract_bucket_keys


class TestEventBridge:
    def test_object_created(self) -> None:
        event = {
            "detail-type": "Object Created",
            "detail": {
                "bucket": {"name": "uploads"},
                "object": {"key": "u/abc.jpg"},
            },
        }
        assert extract_bucket_keys(event) == [("uploads", "u/abc.jpg")]

    def test_url_decoded(self) -> None:
        event = {
            "detail": {
                "bucket": {"name": "b"},
                "object": {"key": "u/my+pic.jpg"},
            }
        }
        assert extract_bucket_keys(event) == [("b", "u/my pic.jpg")]

    def test_malformed_skipped(self) -> None:
        assert extract_bucket_keys({"detail": {"bucket": {}}}) == []


class TestS3Notification:
    def test_records(self) -> None:
        event = {
            "Records": [
                {"s3": {"bucket": {"name": "b"}, "object": {"key": "u/1.jpg"}}}
            ]
        }
        assert extract_bucket_keys(event) == [("b", "u/1.jpg")]


class TestEdge:
    def test_empty(self) -> None:
        assert extract_bucket_keys({}) == []
