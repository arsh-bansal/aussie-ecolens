"""ReplicationTarget - the port that decouples the core from any one cloud.

The handler and domain logic depend only on this abstract interface, never
on Cosmos directly. That keeps the interesting logic testable with a fake
target, and means the concrete destination (Cosmos today, anything later)
can change without touching the orchestration. This is the ports-and-
adapters (hexagonal) pattern: `ReplicationTarget` is the port; `cosmos.py`
and the test fake are adapters.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from aussie_ecolens_replicator.domain.changes import Delete, Upsert


class ReplicationTarget(ABC):
    """A destination that DynamoDB changes are replicated into."""

    @abstractmethod
    def upsert(self, op: Upsert) -> None:
        """Create or replace a document. Must be idempotent on op.doc_id."""

    @abstractmethod
    def delete(self, op: Delete) -> None:
        """Remove a document. Must be a no-op if it does not exist."""

    def apply(self, op: Upsert | Delete) -> None:
        """Dispatch an operation to upsert() or delete().

        A small convenience so the handler does not branch on op type; the
        type system (and this method) keep the two paths exhaustive.
        """
        if isinstance(op, Upsert):
            self.upsert(op)
        elif isinstance(op, Delete):
            self.delete(op)
        else:  # pragma: no cover - guarded by the type union
            raise TypeError(f"unknown replication op: {type(op)!r}")
