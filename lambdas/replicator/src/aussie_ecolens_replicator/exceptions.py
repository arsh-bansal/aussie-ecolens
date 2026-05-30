"""Typed exception hierarchy for the Replicator Lambda.

All package errors derive from ReplicatorError. Same design rules as the
tagger/notifier: never raise bare Exception; always a descriptive subclass;
include context for CloudWatch correlation.
"""

from __future__ import annotations


class ReplicatorError(Exception):
    """Base class for all Replicator Lambda domain errors."""


class ConfigurationError(ReplicatorError):
    """Required configuration is missing or malformed.

    Raised at cold start when env vars fail validation, e.g. missing Cosmos
    endpoint/key/database/container when not in dry-run mode.
    """


class ChangeParseError(ReplicatorError):
    """A DynamoDB stream record could not be parsed into an operation.

    Examples: unknown attribute type, malformed image, no derivable
    document id. Raised per-record so the handler can isolate one bad
    record as a batch-item failure without dropping the batch.
    """


class ReplicationError(ReplicatorError):
    """Applying an operation to the replication target failed.

    Wraps the underlying target/SDK error (e.g. Cosmos request failure)
    with replicator-level context (doc id, op type) for log correlation.
    """
