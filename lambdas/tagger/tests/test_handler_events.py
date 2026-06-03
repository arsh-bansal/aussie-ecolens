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
    