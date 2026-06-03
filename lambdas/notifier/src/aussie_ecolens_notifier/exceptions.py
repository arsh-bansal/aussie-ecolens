"""Typed exception hierarchy for the Notifier Lambda.

All package errors derive from NotifierError so the handler can catch
every domain failure with one except clause while still distinguishing
categories via subclasses.

Design rules (same as the tagger):
- Never raise bare Exception/RuntimeError from package code.
- Always raise a NotifierError subclass with a descriptive message.
- Include relevant context (record keys, species, topic) for CloudWatch.
"""

from __future__ import annotations


class NotifierError(Exception):
    """Base class for all Notifier Lambda domain errors."""


class ConfigurationError(NotifierError):
    """Required configuration is missing or malformed.

    Raised at cold start when env vars fail pydantic-settings validation,
    e.g. an empty topic_arn when not in dry-run mode.
    """


class StreamRecordError(NotifierError):
    """A DynamoDB stream record could not be parsed.

    Examples: missing keys, unexpected event shape, tags attribute absent
    or not a map. Raised per-record so the handler can skip a single bad
    record without failing the whole batch.
    """


class PublishError(NotifierError):
    """Publishing a notification to SNS failed.

    Wraps the underlying boto3 ClientError with notifier-level context
    (topic ARN, species) for log correlation.
    """
