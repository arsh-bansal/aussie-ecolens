"""Tests for the video handler's query-temp guard."""

from __future__ import annotations

import pytest


@pytest.fixture
def video_handler_mod(monkeypatch):
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
            self.downloads = []

        def download(self, bucket, key, dest):
            self.downloads.append((bucket, key, dest))
            return 1

    class _FakeDB:
        def put_tag_result(self, result):
            raise AssertionError("must not persist query-temp uploads")

    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.megadetector.MegaDetectorService", _FakeMD
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.speciesnet.SpeciesNetService", _FakeSN
    )
    monkeypatch.setattr("aussie_ecolens_tagger.services.s3.S3Service", _FakeS3)
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.dynamodb.DynamoDBService", _FakeDB
    )
    monkeypatch.setenv("LOAD_MODELS_FROM_S3", "false")

    import aussie_ecolens_tagger.video_handler as mod

    return mod


class TestVideoQueryTempGuard:
    def test_predicate_matches_query_temp_prefix(self, video_handler_mod) -> None:
        assert video_handler_mod._is_query_temp_key("query-temp/abc123.mp4") is True

    def test_process_one_skips_query_temp_without_io(self, video_handler_mod) -> None:
        out = video_handler_mod._process_one("uploads", "query-temp/deadbeef.mp4")
        assert out == {"s3_key": "query-temp/deadbeef.mp4", "skipped": "query-temp"}
