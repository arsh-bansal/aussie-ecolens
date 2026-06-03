"""Tagger pipeline orchestration.

This module wires the detection, classification, cropping, and result
aggregation steps into a single pure function. It is intentionally
AWS-agnostic: every dependency (detector, classifier, S3 service) is
passed in by the caller, never imported at module scope. Tests can
substitute fakes; the handler module wires real services.

The pipeline does not download from S3 or write to DynamoDB itself;
those are the handler's job. This module owns only the in-process
work between "we have a local image file" and "we have a TagResult".
"""

from __future__ import annotations

import time
from collections import Counter
from pathlib import Path

from PIL import Image

from aussie_ecolens_tagger.domain.models import TagResult
from aussie_ecolens_tagger.exceptions import TaggerError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.services.megadetector import (
    Detection,
    MegaDetectorService,
)
from aussie_ecolens_tagger.services.speciesnet import (
    Classification,
    SpeciesNetService,
)

log = get_logger(__name__)


def tag_image(
    image_path: Path,
    image: Image.Image,
    detector: MegaDetectorService,
    classifier: SpeciesNetService,
    snip_size: int,
    *,
    s3_bucket: str,
    s3_key: str,
) -> TagResult:
    """Run the full Tagger pipeline on one already-decoded image.

    Steps:
        1. Detect animals via MegaDetector
        2. For each detection: crop to snip_size, classify via SpeciesNet
        3. Aggregate species -> count
        4. Build and return TagResult

    Detections that classify below the SpeciesNet threshold are counted
    in n_below_threshold but excluded from tags. This is intentional:
    we never want to persist a low-confidence species tag.

    Args:
        image_path: Path to the source image (passed to detector).
        image: PIL RGB image (already decoded; passed to classifier).
        detector: MegaDetectorService for animal localization.
        classifier: SpeciesNetService for species classification.
        snip_size: Square pixel size to crop detections to.
        s3_bucket: Bucket label for the result (passed-through metadata).
        s3_key: Key label for the result (passed-through metadata).

    Returns:
        TagResult with aggregated tags, counts, and timing.

    Raises:
        DetectionError: if MegaDetector fails.
        ClassificationError will be caught internally per detection;
        only catastrophic failures propagate.
    """
    t0 = time.monotonic()
    detections = detector.detect(image_path)

    classifications = _classify_each(image, detections, classifier, snip_size)
    counter: Counter[str] = Counter(c.species for c in classifications)
    n_below = len(detections) - len(classifications)
    elapsed_ms = round((time.monotonic() - t0) * 1000.0, 1)

    result = TagResult(
        s3_bucket=s3_bucket,
        s3_key=s3_key,
        tags=dict(counter),
        n_detections=len(detections),
        n_classified=len(classifications),
        n_below_threshold=n_below,
        elapsed_ms=elapsed_ms,
    )

    log.info(
        "pipeline complete",
        s3_key=s3_key,
        tags=result.tags,
        n_detections=result.n_detections,
        n_classified=result.n_classified,
        n_below_threshold=result.n_below_threshold,
        elapsed_ms=result.elapsed_ms,
    )
    return result


def _classify_each(
    image: Image.Image,
    detections: list[Detection],
    classifier: SpeciesNetService,
    snip_size: int,
) -> list[Classification]:
    """Classify each detection. Low-confidence rejects logged and skipped.

    Returns only classifications above threshold. A detection that the
    classifier rejects (ClassificationError) is logged as a warning;
    the pipeline keeps processing the rest.

    This isolates per-detection failures: one weird crop does not
    abandon an image that has other good detections.
    """
    out: list[Classification] = []
    for det in detections:
        crop = _crop_detection(image, det, snip_size)
        try:
            out.append(classifier.classify(crop))
        except TaggerError as e:
            log.warning(
                "detection rejected by classifier",
                detection_conf=det.confidence,
                error=str(e),
            )
    return out


def _crop_detection(
    image: Image.Image,
    detection: Detection,
    snip_size: int,
) -> Image.Image:
    """Crop one detection and resize to snip_size x snip_size.

    MegaDetector returns normalized (x, y, w, h) in [0, 1]; we convert
    to pixel coordinates using image dimensions, crop, and resize so
    SpeciesNet sees consistent input regardless of source image size.
    """
    w_img, h_img = image.size
    x, y, w, h = detection.bbox
    left = int(x * w_img)
    top = int(y * h_img)
    right = int((x + w) * w_img)
    bottom = int((y + h) * h_img)
    return image.crop((left, top, right, bottom)).resize(
        (snip_size, snip_size), Image.BILINEAR
    )
