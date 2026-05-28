"""Unit tests for the cold-start model-download logic.

_ensure_models() is the mechanism that lets a new model be rolled out by
uploading to S3 and pointing an env var at it, with no code change or
image rebuild (assignment §4.1). These tests verify its three branches:
disabled (local dev), already-present (warm container), and download
(cold start with missing files) — without touching real S3.

The handler module constructs ML service singletons at import time, which
pulls in torch/megadetector. To test _ensure_models in isolation we patch
those service classes and the S3 service before importing the handler.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pytest


@pytest.fixture
def handler_with_fakes(monkeypatch, tmp_path):
    """Import the handler with all heavyweight collaborators faked out.

    Yields (handler_module, fake_s3, settings) so a test can drive
    _ensure_models() and inspect what was downloaded.
    """
    # Fake S3 service that records download calls and creates the dest file.
    downloads: list[tuple[str, str, Path]] = []

    class FakeS3Service:
        def __init__(self, region_name: str) -> None:
            self.region_name = region_name

        def download(self, bucket: str, key: str, dest: Path) -> int:
            downloads.append((bucket, key, dest))
            dest.write_bytes(b"fake-model-bytes")
            return dest.stat().st_size

    # Fake ML services so importing the handler doesn't load torch/models.
    class FakeMegaDetectorService:
        def __init__(self, *a, **k) -> None: ...

    class FakeSpeciesNetService:
        def __init__(self, *a, **k) -> None: ...

    class FakeDynamoDBService:
        def __init__(self, *a, **k) -> None: ...

    # Patch the service classes at their import sites in the handler module.
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.s3.S3Service", FakeS3Service
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.megadetector.MegaDetectorService",
        FakeMegaDetectorService,
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.speciesnet.SpeciesNetService",
        FakeSpeciesNetService,
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.dynamodb.DynamoDBService",
        FakeDynamoDBService,
    )

    # Ensure a clean import of the handler each test.
    sys.modules.pop("aussie_ecolens_tagger.handler", None)

    import aussie_ecolens_tagger.handler as handler  # noqa: E402

    yield handler, downloads

    sys.modules.pop("aussie_ecolens_tagger.handler", None)


def test_ensure_models_noop_when_disabled(handler_with_fakes, monkeypatch):
    handler, downloads = handler_with_fakes
    downloads.clear()
    monkeypatch.setattr(handler.settings, "load_models_from_s3", False)

    handler._ensure_models()

    assert downloads == []  # nothing downloaded when disabled


def test_ensure_models_downloads_when_missing(
    handler_with_fakes, monkeypatch, tmp_path
):
    handler, downloads = handler_with_fakes
    downloads.clear()

    md_path = tmp_path / "models" / "mdv5a.pt"
    sn_path = tmp_path / "models" / "model.pt"

    monkeypatch.setattr(handler.settings, "load_models_from_s3", True)
    monkeypatch.setattr(handler.settings, "models_bucket", "test-models")
    monkeypatch.setattr(handler.settings, "megadetector_s3_key", "md/mdv5a.pt")
    monkeypatch.setattr(handler.settings, "speciesnet_s3_key", "sn/model.pt")
    monkeypatch.setattr(handler.settings, "megadetector_path", md_path)
    monkeypatch.setattr(handler.settings, "speciesnet_path", sn_path)

    handler._ensure_models()

    # Both models downloaded, parent dirs created, files exist.
    assert len(downloads) == 2
    assert md_path.exists()
    assert sn_path.exists()
    keys = {key for _, key, _ in downloads}
    assert keys == {"md/mdv5a.pt", "sn/model.pt"}


def test_ensure_models_skips_present_files(
    handler_with_fakes, monkeypatch, tmp_path
):
    handler, downloads = handler_with_fakes
    downloads.clear()

    md_path = tmp_path / "models" / "mdv5a.pt"
    sn_path = tmp_path / "models" / "model.pt"
    # Pre-create the MegaDetector file (simulates warm container reuse).
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_bytes(b"already-here")

    monkeypatch.setattr(handler.settings, "load_models_from_s3", True)
    monkeypatch.setattr(handler.settings, "models_bucket", "test-models")
    monkeypatch.setattr(handler.settings, "megadetector_s3_key", "md/mdv5a.pt")
    monkeypatch.setattr(handler.settings, "speciesnet_s3_key", "sn/model.pt")
    monkeypatch.setattr(handler.settings, "megadetector_path", md_path)
    monkeypatch.setattr(handler.settings, "speciesnet_path", sn_path)

    handler._ensure_models()

    # Only the missing SpeciesNet file is downloaded.
    assert len(downloads) == 1
    assert downloads[0][1] == "sn/model.pt"
    