"""Domain models for the Tagger pipeline.

Pure data structures with no behavior. Defined as frozen slotted
dataclasses so instances are immutable, hashable, and memory-efficient.

Kept separate from services and handler so they can be imported anywhere
(unit tests, CLI tools, alternate adapters) without pulling in AWS SDK
or model libraries.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TagResult:
    """Result of tagging one image through the full pipeline.

    Attributes:
        s3_bucket: Source bucket the image was read from. "local" when
            the pipeline was invoked on a filesystem path rather than
            through an S3 event (used for tests and the CLI tool).
        s3_key: Object key inside the bucket, or filename for local input.
        tags: Latin species identifier -> count of confident detections.
            Empty dict if the image had no animals or all detections
            classified below threshold.
        n_detections: Total animal-category detections from MegaDetector.
        n_classified: How many detections were classified above the
            species confidence threshold and contributed to tags.
        n_below_threshold: Detections that were rejected for low
            classification confidence. n_detections == n_classified
            + n_below_threshold always holds.
        elapsed_ms: Total wall-clock pipeline duration in milliseconds.
            Useful for surfacing inference latency in CloudWatch.
    """

    s3_bucket: str
    s3_key: str
    tags: dict[str, int]
    n_detections: int
    n_classified: int
    n_below_threshold: int
    elapsed_ms: float
