"""Tests for the query (tag-only) handler.

The handler reuses _runtime's detector/classifier/s3 singletons, which load
real models at import. To test in isolation we patch the service classes
and S3 before importing _runtime, then drive query_handler with fakes.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path

import pytest
from PIL import Image

from aussie_ecolens_tagger.services.megadetector import Detection
from aussie_ecolens_tagger.services.speciesnet import Classification


@pytest.fixture
def query_handler_with_fakes(monkeypatch, tmp_path):
    """Import query_handler with the runtime singletons faked out.

    Yields (module, fake_s3, classify_queue) where classify_queue lets a
    test script the per-detection classification outcomes.
    """
    # One detection per element; classification outcomes are scripted.
    detections = [Detection(confidence=0.9, bbox=(0.1, 0.1, 0.2, 0.2))]
    classify_queue: list = []

    class FakeDetector:
        def detect(self, image_path):
            return list(detections)

    class FakeClassifier:
        def classify(self, crop):
            if classify_queue:
                return classify_queue.pop(0)
            # Default classification when a test does not script one.
            return Classification(
                species="Vombatus_ursinus", common_name="", confidence=0.99, top_k=()
            )

    class FakeS3:
        def __init__(self, *a, **k):
            self.downloads = []

        def download(self, bucket, key, dest):
            self.downloads.append((bucket, key, dest))
            # Write a tiny valid image so decode_image works.
            Image.new("RGB", (64, 64)).save(dest, format="JPEG")
            return dest.stat().st_size

        def decode_image(self, path):
            return Image.open(path).convert("RGB")

    fake_s3 = FakeS3()

    # Patch the service CLASSES at their source modules BEFORE _runtime is
    # imported, so _runtime's module-level construction builds fakes (the
    # real MegaDetectorService would fail - no model file in the sandbox).
    fake_detector = FakeDetector()
    fake_classifier = FakeClassifier()

    class _FakeMD:
        def __init__(self, *a, **k):
            pass

        detect = staticmethod(fake_detector.detect)

    class _FakeSN:
        def __init__(self, *a, **k):
            pass

        classify = staticmethod(fake_classifier.classify)

    class _FakeS3Cls:
        def __new__(cls, *a, **k):
            return fake_s3

    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.megadetector.MegaDetectorService", _FakeMD
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.speciesnet.SpeciesNetService", _FakeSN
    )
    monkeypatch.setattr(
        "aussie_ecolens_tagger.services.s3.S3Service", _FakeS3Cls
    )

    # Fresh import of _runtime (with fakes in place) then query_handler.
    sys.modules.pop("aussie_ecolens_tagger._runtime", None)
    sys.modules.pop("aussie_ecolens_tagger.query_handler", None)
    import aussie_ecolens_tagger.query_handler as qh  # noqa: E402

    # Guarantee the module-level aliases point at the exact fake instances
    # this test inspects (defends against any construction indirection).
    monkeypatch.setattr(qh, "_s3", fake_s3)
    monkeypatch.setattr(qh, "_detector", _FakeMD())
    monkeypatch.setattr(qh, "_classifier", _FakeSN())

    yield qh, fake_s3, classify_queue

    sys.modules.pop("aussie_ecolens_tagger.query_handler", None)
    sys.modules.pop("aussie_ecolens_tagger._runtime", None)


def _png_b64() -> str:
    """A tiny valid PNG as base64 (so decode_image succeeds)."""
    import io

    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 20, 30)).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _cls(latin: str) -> Classification:
    return Classification(species=latin, common_name="", confidence=0.99, top_k=())


# ----------------------------------------------------------------------
# base64 input
# ----------------------------------------------------------------------


def test_base64_input_returns_common_name_tags(query_handler_with_fakes):
    qh, _s3, classify_queue = query_handler_with_fakes
    # Vombatus_ursinus -> common name "wombat" (per species.py mapping).
    classify_queue.append(_cls("Vombatus_ursinus"))

    result = qh.lambda_handler({"image": _png_b64()})

    assert "tags" in result
    # The key must be the common name, not the Latin id.
    assert "Vombatus_ursinus" not in result["tags"]
    assert sum(result["tags"].values()) == 1


def test_invalid_base64_returns_error(query_handler_with_fakes):
    qh, _s3, _ = query_handler_with_fakes
    result = qh.lambda_handler({"image": "!!!not base64!!!"})
    assert "error" in result
    assert result["error_type"] == "QueryInputError"


def test_empty_event_returns_error(query_handler_with_fakes):
    qh, _s3, _ = query_handler_with_fakes
    result = qh.lambda_handler({})
    assert "error" in result
    assert result["error_type"] == "QueryInputError"


# ----------------------------------------------------------------------
# S3 input
# ----------------------------------------------------------------------


def test_s3_input_downloads_and_tags(query_handler_with_fakes):
    qh, fake_s3, classify_queue = query_handler_with_fakes
    classify_queue.append(_cls("Macropus_giganteus"))

    result = qh.lambda_handler({"bucket": "scratch", "key": "tmp/x.jpg"})

    assert "tags" in result
    # downloaded from the given bucket/key
    assert fake_s3.downloads
    assert fake_s3.downloads[0][0] == "scratch"
    assert fake_s3.downloads[0][1] == "tmp/x.jpg"


def test_s3_preferred_when_both_present(query_handler_with_fakes):
    qh, fake_s3, classify_queue = query_handler_with_fakes
    classify_queue.append(_cls("Macropus_giganteus"))

    qh.lambda_handler({"bucket": "scratch", "key": "tmp/x.jpg", "image": _png_b64()})

    # When both are present, the S3 path is taken (no payload-size risk).
    assert fake_s3.downloads
