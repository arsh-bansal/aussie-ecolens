"""Cosmos DB adapter for ReplicationTarget (the Azure read-side write path).

Implements upsert/delete against an Azure Cosmos DB container using the
azure-cosmos SDK. The document `id` is the file sha (idempotent upserts);
the partition key is the user_id (so the read API's user-scoped queries hit
a single partition).

CONFIG PENDING: the endpoint/key/database/container come from settings and
must be confirmed against the actual Cosmos account once Rachana provisions
it. Until then this adapter is exercised only via integration testing; the
unit tests use the in-memory fake. The code path is complete - only the
connection values are placeholders.

A note on the import: azure-cosmos is imported lazily inside __init__ so
that importing this module (e.g. for type hints, or in an environment
without the SDK) does not hard-fail. The Lambda package will include it.
"""

from __future__ import annotations

from typing import Any

from aussie_ecolens_replicator.domain.changes import Delete, Upsert
from aussie_ecolens_replicator.exceptions import ReplicationError
from aussie_ecolens_replicator.logging import get_logger
from aussie_ecolens_replicator.services.target import ReplicationTarget

log = get_logger(__name__)


class CosmosReplicationTarget(ReplicationTarget):
    """Replicates DynamoDB changes into an Azure Cosmos DB container."""

    def __init__(
        self,
        *,
        endpoint: str,
        key: str,
        database: str,
        container: str,
    ) -> None:
        try:
            # Lazy import: keeps module import cheap and avoids a hard
            # dependency when only the fake target is used (tests).
            from azure.cosmos import CosmosClient
        except ImportError as exc:  # pragma: no cover - env-dependent
            raise ReplicationError(
                "azure-cosmos is not installed; add it to the Lambda package "
                "dependencies before deploying the Cosmos target"
            ) from exc

        self._client = CosmosClient(url=endpoint, credential=key)
        db = self._client.get_database_client(database)
        self._container = db.get_container_client(container)
        log.info(
            "cosmos target ready",
            database=database,
            container=container,
            endpoint=endpoint,
        )

    def upsert(self, op: Upsert) -> None:
        """Create-or-replace the document (idempotent on op.doc_id)."""
        try:
            # azure-cosmos derives the partition key from the document body
            # via the container's partition key path, so the document must
            # carry the partitioning field (user_id) - which it does, since
            # we mirror the whole item. `id` was set to the sha upstream.
            self._container.upsert_item(body=op.document)
        except Exception as exc:  # noqa: BLE001 - normalise SDK errors
            raise ReplicationError(
                f"cosmos upsert failed for id={op.doc_id} "
                f"(pk={op.partition_key}): {exc}"
            ) from exc
        log.info("cosmos upsert ok", doc_id=op.doc_id, partition_key=op.partition_key)

    def delete(self, op: Delete) -> None:
        """Delete the document; treat 'not found' as success (idempotent)."""
        try:
            self._container.delete_item(item=op.doc_id, partition_key=op.partition_key)
        except Exception as exc:  # noqa: BLE001
            if _is_not_found(exc):
                log.info(
                    "cosmos delete no-op (already absent)",
                    doc_id=op.doc_id,
                    partition_key=op.partition_key,
                )
                return
            raise ReplicationError(
                f"cosmos delete failed for id={op.doc_id} "
                f"(pk={op.partition_key}): {exc}"
            ) from exc
        log.info("cosmos delete ok", doc_id=op.doc_id, partition_key=op.partition_key)


def _is_not_found(exc: Any) -> bool:
    """True if a Cosmos SDK exception represents a 404 / missing item.

    Checked structurally (status_code attribute) rather than by importing
    the SDK's exception type, so this module stays import-light.
    """
    return getattr(exc, "status_code", None) == 404
