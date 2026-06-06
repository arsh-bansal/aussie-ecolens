"""Tests for the tagger handler's event-shape normalization.

The tagger is triggered via EventBridge ("Object Created", bucket/key under
``detail``) but must also accept the legacy S3-notification shape (a
``Records`` array of ``s3`` envelopes). A live cutover to EventBridge once
produced n_records=0 because the handler only read ``Records`` - these tests
lock both shapes in.

Importing the handler triggers _runtime's model-loading singletons, so we
patch the detector/classifier/S3 classes before import (same approach as
test_query_handler). _extract_bucket_keys itself is pure - no models needed.
"""

from __future__ import annotations

import pytest


@pytest.fixture
def extract(monkeypatch):
    """Import handler._extract_bucket_keys with runtime singletons faked out."""
    from PIL import Image

    class _FakeMD:
        def __init__(self, *a, **k):
            pass

        def detect(self, image_path):
            return []

    class _FakeSN:
        def __init__(self, *a, **k):
            pass

        def classify(self, crop):
            return None

    class _FakeS3:
        def __init__(self, *a, **k):
            pass

        def download(self, bucket, key, dest):
            Image.new("RGB", (8, 8)).save(dest, format="JPEG")
            return 1

        def decode_image(self, path):
            return Image.open(path).convert("RGB")

    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.megadetector.MegaDetectorService", _FakeMD
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.speciesnet.SpeciesNetService", _FakeSN
    )
    monkeypatch.setattr("aussie_ecolens_tagger.services.s3.S3Service", _FakeS3)
    monkeypatch.setenv("LOAD_MODELS_FROM_S3", "false")

    from aussie_ecolens_tagger.handler import _extract_bucket_keys

    return _extract_bucket_keys


class TestEventBridgeShape:
    def test_object_created_detail_parsed(self, extract) -> None:
        event = {
            "detail-type": "Object Created",
            "source": "aws.s3",
            "detail": {
                "bucket": {"name": "uploads-bucket"},
                "object": {"key": "user-1/abc123.JPG"},
            },
        }
        assert extract(event) == [("uploads-bucket", "user-1/abc123.JPG")]

    def test_url_encoded_key_is_decoded(self, extract) -> None:
        event = {
            "detail": {
                "bucket": {"name": "b"},
                "object": {"key": "user-1/my+holiday+pic.JPG"},
            }
        }
        assert extract(event) == [("b", "user-1/my holiday pic.JPG")]

    def test_malformed_detail_skipped_not_raised(self, extract) -> None:
        assert extract({"detail": {"bucket": {}}}) == []


class TestS3NotificationShape:
    def test_records_array_parsed(self, extract) -> None:
        event = {
            "Records": [
                {"s3": {"bucket": {"name": "b1"}, "object": {"key": "u/1.JPG"}}},
                {"s3": {"bucket": {"name": "b2"}, "object": {"key": "u/2.JPG"}}},
            ]
        }
        assert extract(event) == [("b1", "u/1.JPG"), ("b2", "u/2.JPG")]

    def test_malformed_record_skipped_others_kept(self, extract) -> None:
        event = {
            "Records": [
                {"s3": {"bucket": {"name": "b1"}, "object": {"key": "u/ok.JPG"}}},
                {"not_s3": {}},
            ]
        }
        assert extract(event) == [("b1", "u/ok.JPG")]


class TestEdgeCases:
    def test_empty_event_yields_no_pairs(self, extract) -> None:
        assert extract({}) == []

    def test_eventbridge_preferred_when_detail_present(self, extract) -> None:
        event = {
            "detail": {"bucket": {"name": "eb"}, "object": {"key": "u/eb.JPG"}}
        }
        assert extract(event) == [("eb", "u/eb.JPG")]


@pytest.fixture
def handler_mod(monkeypatch):
    """Import the handler MODULE with model-loading singletons faked out, so the
    pure query-temp guard can be exercised without real models, S3, or DynamoDB.
    """
    from PIL import Image

    class _FakeMD:
        def __init__(self, *a, **k):
            pass

        def detect(self, image_path):
            return []

    class _FakeSN:
        def __init__(self, *a, **k):
            pass

        def classify(self, crop):
            return None

    class _FakeS3:
        def __init__(self, *a, **k):
            pass

        def download(self, bucket, key, dest):
            Image.new("RGB", (8, 8)).save(dest, format="JPEG")
            return 1

        def decode_image(self, path):
            return Image.open(path).convert("RGB")

    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.megadetector.MegaDetectorService", _FakeMD
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.speciesnet.SpeciesNetService", _FakeSN
    )
    monkeypatch.setattr("aussie_ecolens_tagger.services.s3.S3Service", _FakeS3)
    monkeypatch.setenv("LOAD_MODELS_FROM_S3", "false")

    import aussie_ecolens_tagger.handler as mod

    return mod


class TestQueryTempGuard:
    """Transient search-by-image uploads (key prefix ``query-temp/``) must be
    skipped by the tagger. The query handler deletes that photo from S3 the
    moment tagging returns, so persisting a FILE#<sha> record for it leaves an
    orphan that 404s (NoSuchKey) when opened from search results — and violates
    assignment 4.3 (query files are not stored).
    """

    def test_predicate_matches_query_temp_prefix(self, handler_mod) -> None:
        assert handler_mod._is_query_temp_key("query-temp/abc123.jpg") is True

    def test_predicate_rejects_normal_upload_key(self, handler_mod) -> None:
        # Real uploads are keyed <cognito-sub>/<sha>.<ext> — never query-temp/.
        assert handler_mod._is_query_temp_key("user-1/abc123.JPG") is False

    def test_process_one_skips_query_temp_without_io(self, handler_mod) -> None:
        # Short-circuits before any S3 download or DynamoDB write.
        out = handler_mod._process_one("uploads", "query-temp/deadbeef.jpg")
        assert out == {"s3_key": "query-temp/deadbeef.jpg", "skipped": "query-temp"}
    