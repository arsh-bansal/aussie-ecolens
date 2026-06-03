"""Replicator Lambda entry point.

Triggered by the DynamoDB stream of the shared files table. Each record is
mapped to a replication operation (Upsert for INSERT/MODIFY, Delete for
REMOVE) and applied to the configured ReplicationTarget (Cosmos in
production, a fake in tests).

Partial-batch-failure reporting (ReportBatchItemFailures) means only failed
records are retried, preserving ordering guarantees per shard without
reprocessing the whole batch. Replication ops are idempotent (upsert keyed
on the file sha, delete tolerant of absence), so retries are safe.
"""

from __future__ import annotations

from typing import Any

from aussie_ecolens_replicator.config import settings
from aussie_ecolens_replicator.domain.changes import op_from_record
from aussie_ecolens_replicator.exceptions import ConfigurationError
from aussie_ecolens_replicator.logging import configure_logging, get_logger
from aussie_ecolens_replicator.services.target import ReplicationTarget

configure_logging()
log = get_logger(__name__)

log.info(
    "replicator cold start",
    aws_region=settings.aws_region,
    cosmos_database=settings.cosmos_database,
    cosmos_container=settings.cosmos_container,
    dry_run=settings.dry_run,
)


def _build_target() -> ReplicationTarget:
    """Construct the replication target from settings.

    In dry-run, return a target that only logs (no Azure dependency, safe
    for local/testing). Otherwise build the Cosmos adapter, failing fast if
    its required config is missing.
    """
    if settings.dry_run:
        from aussie_ecolens_replicator.services.target import ReplicationTarget

        class _DryRunTarget(ReplicationTarget):
            def upsert(self, op) -> None:
                log.info("DRY_RUN upsert", doc_id=op.doc_id, partition_key=op.partition_key)

            def delete(self, op) -> None:
                log.info("DRY_RUN delete", doc_id=op.doc_id, partition_key=op.partition_key)

        return _DryRunTarget()

    missing = [
        name
        for name, val in (
            ("COSMOS_ENDPOINT", settings.cosmos_endpoint),
            ("COSMOS_KEY", settings.cosmos_key),
            ("COSMOS_DATABASE", settings.cosmos_database),
            ("COSMOS_CONTAINER", settings.cosmos_container),
        )
        if not val
    ]
    if missing:
        raise ConfigurationError(
            f"Cosmos config missing: {', '.join(missing)} (set them or DRY_RUN=true)"
        )

    from aussie_ecolens_replicator.services.cosmos import CosmosReplicationTarget

    return CosmosReplicationTarget(
        endpoint=settings.cosmos_endpoint,
        key=settings.cosmos_key,
        database=settings.cosmos_database,
        container=settings.cosmos_container,
    )


# Built once per cold start (connection reuse across warm invocations).
_target = _build_target()


def lambda_handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    """Replicate a batch of DynamoDB stream records to the target.

    Returns {"batchItemFailures": [...]} naming records that failed so the
    event source mapping retries only those.
    """
    records = event.get("Records", [])
    log.info("replicator batch received", record_count=len(records))

    failures: list[dict[str, str]] = []
    applied = 0

    for record in records:
        seq = record.get("dynamodb", {}).get("SequenceNumber", "")
        try:
            op = op_from_record(record)
            if op is None:
                continue  # event type we do not replicate
            _target.apply(op)
            applied += 1
        except Exception as exc:  # noqa: BLE001 - convert to batch failure
            log.error(
                "replicator record failed",
                sequence_number=seq,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            if seq:
                failures.append({"itemIdentifier": seq})

    log.info(
        "replicator batch complete",
        applied=applied,
        failed_records=len(failures),
    )
    return {"batchItemFailures": failures}
