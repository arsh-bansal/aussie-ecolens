"""MegaDetector v5a inference service.

Wraps the megadetector library behind a stateful class so the model
is loaded exactly once per Lambda container (cold start cost ~3-5s on
CPU, ~0.5s on MPS during local dev) and reused for all subsequent warm
invocations.

The reference AussieEcoLense batch.py runs detection by calling the
library each time, which reloads the model implicitly. We avoid that
by holding the loaded detector on the instance.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

from megadetector.detection import run_detector_batch

from aussie_ecolens_tagger.exceptions import DetectionError, ModelLoadError
from aussie_ecolens_tagger.logging import get_logger

log = get_logger(__name__)


# MegaDetector v5 category 1 == "animal". 2 == "person", 3 == "vehicle";
# we ignore non-animal categories for species classification.
_ANIMAL_CATEGORY = "1"


@dataclass(frozen=True, slots=True)
class Detection:
    """One animal detection in an image.

    Attributes:
        confidence: MegaDetector confidence in (0, 1].
        bbox: Normalized (x, y, w, h) bounding box in [0, 1].
              x, y is the top-left corner; w, h are width/height.
              Convert to pixels by multiplying by image width/height.
    """

    confidence: float
    bbox: tuple[float, float, float, float]


class MegaDetectorService:
    """Stateful wrapper around MegaDetector v5a inference.

    Loads the .pt detector once on construction; subsequent calls
    to detect() reuse the in-memory model. In Lambda this matches
    the cold-start-once, warm-many-times pattern: construct the
    instance at module load, call detect() per invocation.

    Args:
        model_path: Local filesystem path to mdv5a.pt.
        detection_threshold: Minimum confidence to keep a detection.

    Raises:
        ModelLoadError: if model_path does not exist or the library
                        cannot load the file (corruption, version mismatch).
    """

    def __init__(self, model_path: Path, detection_threshold: float) -> None:
        if not model_path.exists():
            raise ModelLoadError(f"MegaDetector model not found: {model_path}")

        self._model_path = model_path
        self._threshold = detection_threshold
        log.info(
            "megadetector loaded path",
            path=str(model_path),
            threshold=detection_threshold,
        )

    def detect(self, image_path: Path) -> list[Detection]:
        """Run animal detection on a single image.

        Args:
            image_path: Local filesystem path to a decoded image (jpg/png).

        Returns:
            List of Detection objects. Empty list if no animals found.
            Detections below the threshold are filtered out.

        Raises:
            DetectionError: if the underlying library fails or returns
                            an unexpected response shape.
        """
        if not image_path.exists():
            raise DetectionError(f"image not found for detection: {image_path}")

        t0 = time.monotonic()
        try:
            results = run_detector_batch.load_and_run_detector_batch(
                image_file_names=[str(image_path)],
                model_file=str(self._model_path),
                confidence_threshold=self._threshold,
                quiet=True,
            )
        except Exception as e:  # noqa: BLE001 -- intentional rewrap as typed error
            raise DetectionError(f"megadetector failed on {image_path.name}: {e}") from e

        elapsed_ms = (time.monotonic() - t0) * 1000.0

        if not results or "detections" not in results[0]:
            log.warning(
                "megadetector returned no detections key",
                image=image_path.name,
                elapsed_ms=elapsed_ms,
            )
            return []

        raw_detections = results[0]["detections"]
        animals = [
            Detection(
                confidence=float(d["conf"]),
                bbox=tuple(d["bbox"]),  # type: ignore[arg-type]
            )
            for d in raw_detections
            if d.get("category") == _ANIMAL_CATEGORY
        ]

        log.info(
            "megadetector detect complete",
            image=image_path.name,
            n_raw=len(raw_detections),
            n_animals=len(animals),
            elapsed_ms=round(elapsed_ms, 1),
        )
        return animals

    def best_animal(self, detections: list[Detection]) -> Detection | None:
        """Convenience: pick the highest-confidence animal detection.

        Returns None if the list is empty. Useful when an image
        contains exactly one subject (the common case for camera traps
        and user uploads).
        """
        if not detections:
            return None
        return max(detections, key=lambda d: d.confidence)
