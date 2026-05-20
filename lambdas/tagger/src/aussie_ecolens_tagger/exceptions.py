"""Typed exception hierarchy for the Tagger Lambda pipeline.

All exceptions raised by the tagger package derive from TaggerError,
allowing callers (handler.py, tests) to catch every domain failure with
a single except clause while still distinguishing categories via
isinstance checks or specific subclasses.

Design rules:
- Never raise bare Exception or RuntimeError from package code.
- Always raise a subclass of TaggerError with a descriptive message.
- Include relevant context (file key, species, confidence) in messages
  to aid CloudWatch log debugging.
"""

from __future__ import annotations


class TaggerError(Exception):
    """Base class for all Tagger Lambda domain errors.

    Catch this in the Lambda handler to convert any pipeline failure
    into a structured error response without leaking stack traces.
    """


class ConfigurationError(TaggerError):
    """Required configuration is missing, malformed, or contradictory.

    Raised at startup (cold start) when environment variables fail
    pydantic-settings validation, or when model files referenced by
    config cannot be located on disk.
    """


class ModelLoadError(TaggerError):
    """A model artifact could not be loaded.

    Examples: model file missing on disk, torch.load raises (corrupted
    pickle, version mismatch), or initial inference forward pass fails.
    Indicates the Lambda cannot service any requests until restarted.
    """


class S3DownloadError(TaggerError):
    """Failed to download a source media file from S3.

    Examples: object not found, permission denied, network error,
    object size exceeds Lambda /tmp budget.
    """


class ImageDecodeError(TaggerError):
    """Could not decode the downloaded media as a valid image.

    Distinct from S3DownloadError so the handler can decide whether
    to fail loudly (decode error = bad upload, do not retry) vs retry
    (S3 error = transient, retry with backoff).
    """


class DetectionError(TaggerError):
    """MegaDetector inference failed for a specific image.

    Wraps the underlying yolov5/megadetector exception with our
    pipeline-level message. Includes the image identifier for
    correlation in CloudWatch logs.
    """


class ClassificationError(TaggerError):
    """SpeciesNet inference failed for a cropped detection.

    Distinct from DetectionError so the pipeline can record partial
    results (detection ok, classification failed) for downstream
    debugging instead of dropping the entire image.
    """


class PersistenceError(TaggerError):
    """Writing tagger output to the system of record failed.

    Currently covers DynamoDB PutItem failures. Will also cover
    cross-cloud Cosmos writes if we move to direct write (vs. via
    DynamoDB Streams + Replicator).
    """
