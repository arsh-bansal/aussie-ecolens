"""Typed exception hierarchy for the Thumbnail Lambda.

All package errors derive from ThumbnailError so the handler can catch
every domain failure with one except clause while still distinguishing
categories via subclasses.

Design rules (same as the tagger/notifier):
- Never raise bare Exception/RuntimeError from package code.
- Always raise a ThumbnailError subclass with a descriptive message.
- Include relevant context (bucket, key) for CloudWatch.
"""

from __future__ import annotations


class ThumbnailError(Exception):
    """Base class for all Thumbnail Lambda domain errors."""


class ConfigurationError(ThumbnailError):
    """Required configuration is missing or malformed.

    Raised at cold start when env vars fail validation, e.g. an empty
    thumbnails_bucket when not in dry-run mode.
    """


class EventRecordError(ThumbnailError):
    """An incoming event could not be parsed into (bucket, key).

    Covers both the EventBridge "Object Created" shape and the legacy S3
    notification "Records" shape. Raised per-record so the handler can skip
    one bad record without failing the whole batch.
    """


class ThumbnailGenerationError(ThumbnailError):
    """Generating or storing the thumbnail failed.

    Wraps the underlying error (image decode, resize, or S3 upload) with
    thumbnail-level context (bucket, key) for log correlation.
    """
