"""Unit tests for the tagger pipeline orchestrator.

These tests exercise domain.pipeline.tag_image and its helpers in complete
isolation: fake detector and classifier objects stand in for MegaDetector
and SpeciesNet, so the tests run in milliseconds with no model files, no
torch inference, and no AWS. The point is to lock down the orchestration
logic — aggregation, threshold rejection, per-detection failure isolation,
and the n_detections == n_classified + n_below_threshold invariant —
independently of whether the ML models themselves are correct (that is what
the ground-truth smoke test and local_infer.py cover).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from aussie_ecolens_tagger.domain.pipeline import (
    _classify_each,
    _crop_detection,
    tag_image,
)
from aussie_ecolens_tagger.exceptions import ClassificationError
from aussie_ecolens_tagger.services.megadetector import Detection
from aussie_ecolens_tagger.services.speciesnet import Classification

SNIP_SIZE = 600


# --------------------------------------------------------------------------
# Fakes — minimal stand-ins matching the real service call surface.
# tag_image only calls detector.detect(path) and classifier.classify(crop),
# so the fakes implement exactly those and nothing more.
# --------------------------------------------------------------------------


class FakeDetector:
    """Returns a fixed list of detections, ignoring the image path."""

    def __init__(self, detections: list[Detection]) -> None:
        self._detections = detections
        self.calls: list[Path] = []

    def detect(self, image_path: Path) -> list[Detection]:
        self.calls.append(image_path)
        return self._detections


class FakeClassifier:
    """Returns queued classifications in order; raises if queued exception.

    Each entry is either a Classification (returned) or a
    ClassificationError instance (raised) to simulate a below-threshold
    rejection. Lets a single test script the exact per-detection outcomes.
    """

    def __init__(self, outcomes: list[Classification | ClassificationError]) -> None:
        self._outcomes = list(outcomes)
        self.crops: list[Image.Image] = []

    def classify(self, crop: Image.Image) -> Classification:
        self.crops.append(crop)
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, ClassificationError):
            raise outcome
        return outcome


# --------------------------------------------------------------------------
# Builders for concise test data.
# --------------------------------------------------------------------------


def _det(conf: float = 0.9, bbox=(0.1, 0.1, 0.2, 0.2)) -> Detection:
    return Detection(confidence=conf, bbox=bbox)


def _cls(species: str, conf: float = 0.99) -> Classification:
    return Classification(
        species=species,
        common_name=species.replace("_", " ").title(),
        confidence=conf,
        top_k=(),
    )


def _blank_image(w: int = 1000, h: int = 800) -> Image.Image:
    return Image.new("RGB", (w, h), color=(127, 127, 127))


# --------------------------------------------------------------------------
# tag_image — happy paths
# --------------------------------------------------------------------------


def test_single_detection_single_species():
    detector = FakeDetector([_det()])
    classifier = FakeClassifier([_cls("Casuarius_casuarius")])

    result = tag_image(
        image_path=Path("cassowary.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="cassowary.jpg",
    )

    assert result.tags == {"Casuarius_casuarius": 1}
    assert result.n_detections == 1
    assert result.n_classified == 1
    assert result.n_below_threshold == 0
    assert result.s3_bucket == "local"
    assert result.s3_key == "cassowary.jpg"


def test_multiple_same_species_aggregates_count():
    detector = FakeDetector([_det(), _det(), _det()])
    classifier = FakeClassifier(
        [_cls("Macropus_giganteus"), _cls("Macropus_giganteus"), _cls("Macropus_giganteus")]
    )

    result = tag_image(
        image_path=Path("roos.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="roos.jpg",
    )

    assert result.tags == {"Macropus_giganteus": 3}
    assert result.n_detections == 3
    assert result.n_classified == 3
    assert result.n_below_threshold == 0


def test_multiple_species_counted_separately():
    detector = FakeDetector([_det(), _det(), _det()])
    classifier = FakeClassifier(
        [_cls("Vombatus_ursinus"), _cls("Vombatus_ursinus"), _cls("Gymnorhina_tibicen")]
    )

    result = tag_image(
        image_path=Path("mixed.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="mixed.jpg",
    )

    assert result.tags == {"Vombatus_ursinus": 2, "Gymnorhina_tibicen": 1}
    assert result.n_detections == 3
    assert result.n_classified == 3
    assert result.n_below_threshold == 0


# --------------------------------------------------------------------------
# tag_image — edge cases
# --------------------------------------------------------------------------


def test_no_detections_yields_empty_tags():
    detector = FakeDetector([])
    classifier = FakeClassifier([])

    result = tag_image(
        image_path=Path("empty.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="empty.jpg",
    )

    assert result.tags == {}
    assert result.n_detections == 0
    assert result.n_classified == 0
    assert result.n_below_threshold == 0


def test_below_threshold_detection_excluded_from_tags():
    # Two detections: one classifies fine, one is rejected by the classifier.
    detector = FakeDetector([_det(), _det()])
    classifier = FakeClassifier(
        [_cls("Dromaius_novaehollandiae"), ClassificationError("below threshold")]
    )

    result = tag_image(
        image_path=Path("emu_plus_blur.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="emu_plus_blur.jpg",
    )

    assert result.tags == {"Dromaius_novaehollandiae": 1}
    assert result.n_detections == 2
    assert result.n_classified == 1
    assert result.n_below_threshold == 1


def test_all_detections_rejected_yields_empty_tags():
    detector = FakeDetector([_det(), _det()])
    classifier = FakeClassifier(
        [ClassificationError("low conf"), ClassificationError("low conf")]
    )

    result = tag_image(
        image_path=Path("all_blurry.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="all_blurry.jpg",
    )

    assert result.tags == {}
    assert result.n_detections == 2
    assert result.n_classified == 0
    assert result.n_below_threshold == 2


# --------------------------------------------------------------------------
# Invariant — holds across a range of scenarios.
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "outcomes",
    [
        [_cls("a")],
        [_cls("a"), _cls("b")],
        [_cls("a"), ClassificationError("x")],
        [ClassificationError("x"), ClassificationError("y")],
        [_cls("a"), _cls("a"), ClassificationError("x"), _cls("b")],
    ],
)
def test_count_invariant_always_holds(outcomes):
    detector = FakeDetector([_det() for _ in outcomes])
    classifier = FakeClassifier(list(outcomes))

    result = tag_image(
        image_path=Path("invariant.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="invariant.jpg",
    )

    assert result.n_detections == result.n_classified + result.n_below_threshold


def test_detector_receives_the_image_path():
    detector = FakeDetector([_det()])
    classifier = FakeClassifier([_cls("a")])

    tag_image(
        image_path=Path("path/to/img.jpg"),
        image=_blank_image(),
        detector=detector,
        classifier=classifier,
        snip_size=SNIP_SIZE,
        s3_bucket="local",
        s3_key="img.jpg",
    )

    assert detector.calls == [Path("path/to/img.jpg")]


# --------------------------------------------------------------------------
# _classify_each — failure isolation
# --------------------------------------------------------------------------


def test_classify_each_skips_failures_keeps_rest():
    image = _blank_image()
    detections = [_det(), _det(), _det()]
    classifier = FakeClassifier(
        [_cls("a"), ClassificationError("boom"), _cls("c")]
    )

    out = _classify_each(image, detections, classifier, SNIP_SIZE)

    species = [c.species for c in out]
    assert species == ["a", "c"]
    # classifier was called for all three detections
    assert len(classifier.crops) == 3


# --------------------------------------------------------------------------
# _crop_detection — normalized bbox -> pixel crop, resized to snip_size.
# --------------------------------------------------------------------------


def test_crop_detection_resizes_to_snip_size():
    image = _blank_image(1000, 800)
    det = _det(bbox=(0.25, 0.5, 0.25, 0.25))

    crop = _crop_detection(image, det, SNIP_SIZE)

    assert crop.size == (SNIP_SIZE, SNIP_SIZE)


def test_crop_detection_maps_normalized_bbox_to_pixels():
    # 1000x800 image, bbox top-left (0.1, 0.2), size (0.2, 0.1)
    # => left=100, top=160, right=300, bottom=240 before resize.
    # We can't read the pre-resize box directly, but we can verify the
    # crop is taken from inside the image without error and resized.
    image = _blank_image(1000, 800)
    det = _det(bbox=(0.1, 0.2, 0.2, 0.1))

    crop = _crop_detection(image, det, SNIP_SIZE)

    assert crop.size == (SNIP_SIZE, SNIP_SIZE)
    assert crop.mode == "RGB"