"""Turn DynamoDB Stream records into cloud-agnostic replication operations.

This module is pure and side-effect free. It does two jobs:

1. Deserialise DynamoDB's typed attribute JSON ({"S": ..}, {"N": ..},
   {"M": ..}, {"L": ..}, {"BOOL": ..}, {"NULL": ..}) into plain Python
   values, so the rest of the system never has to think in DynamoDB shapes.
2. Map each stream record to a ReplicationOp - an Upsert (INSERT/MODIFY)
   or a Delete (REMOVE) - that any ReplicationTarget can apply.

Keeping this pure means the genuinely tricky logic (type coercion, which
event maps to which op, how the Cosmos document id/partition derive from
the item) is unit-tested without Azure or AWS.

DynamoDB stream record shape (relevant parts)::

    {
      "eventName": "INSERT" | "MODIFY" | "REMOVE",
      "dynamodb": {
        "Keys":     {"pk": {"S": "FILE#<sha>"}, "sk": {"S": "METADATA"}},
        "NewImage": { ...full item, typed... },   # INSERT/MODIFY
        "OldImage": { ...full item, typed... }     # MODIFY/REMOVE
      }
    }
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Union

from aussie_ecolens_replicator.exceptions import ChangeParseError


# ---------------------------------------------------------------------------
# DynamoDB typed-value deserialisation
# ---------------------------------------------------------------------------


def deserialize_value(node: dict[str, Any]) -> Any:
    """Convert one DynamoDB AttributeValue into a plain Python value.

    Supports the descriptor types this project uses: S, N, BOOL, NULL, M,
    L, and the SS/NS string/number sets. Numbers become int when integral,
    else float (DynamoDB stores all numbers as strings; we pick the
    natural Python type so the Cosmos document reads cleanly).

    Raises:
        ChangeParseError: the node is not a single-key typed descriptor.
    """
    if not isinstance(node, dict) or len(node) != 1:
        raise ChangeParseError(
            f"expected a single-key DynamoDB attribute, got: {node!r}"
        )
    (kind, value), = node.items()

    if kind == "S":
        return value
    if kind == "BOOL":
        return bool(value)
    if kind == "NULL":
        return None
    if kind == "N":
        return _coerce_number(value)
    if kind == "M":
        return {k: deserialize_value(v) for k, v in value.items()}
    if kind == "L":
        return [deserialize_value(v) for v in value]
    if kind == "SS":
        return list(value)
    if kind == "NS":
        return [_coerce_number(v) for v in value]
    raise ChangeParseError(f"unsupported DynamoDB attribute type: {kind!r}")


def _coerce_number(raw: str) -> Union[int, float]:
    """DynamoDB numbers are strings; return int if integral else float."""
    try:
        dec = Decimal(raw)
    except Exception as exc:  # noqa: BLE001 - normalise to our error type
        raise ChangeParseError(f"invalid DynamoDB number: {raw!r}") from exc
    return int(dec) if dec == dec.to_integral_value() else float(dec)


def deserialize_image(image: dict[str, Any]) -> dict[str, Any]:
    """Deserialise a whole DynamoDB image (item) to a plain dict."""
    return {key: deserialize_value(val) for key, val in image.items()}


# ---------------------------------------------------------------------------
# Replication operations - the cloud-agnostic output of this module
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Upsert:
    """Create-or-replace the document identified by `doc_id`.

    Attributes:
        doc_id: Stable document identity (the file sha) - same dedup key
            as DynamoDB's pk, so re-replication is idempotent.
        partition_key: Value the target partitions on (user_id), so the
            read API's user-scoped queries stay single-partition.
        document: The full deserialised item to store.
    """

    doc_id: str
    partition_key: str
    document: dict[str, Any]


@dataclass(frozen=True)
class Delete:
    """Remove the document identified by `doc_id` from `partition_key`."""

    doc_id: str
    partition_key: str


ReplicationOp = Union[Upsert, Delete]


# ---------------------------------------------------------------------------
# Record -> operation mapping
# ---------------------------------------------------------------------------

_UPSERT_EVENTS = frozenset({"INSERT", "MODIFY"})
_DELETE_EVENTS = frozenset({"REMOVE"})


def _doc_identity(item: dict[str, Any]) -> tuple[str, str]:
    """Derive (doc_id, partition_key) from a deserialised item.

    doc_id: the file sha. Prefer the explicit `checksum` attribute; fall
        back to stripping the `FILE#` prefix off pk so we still work if an
        item predates the checksum field.
    partition_key: `user_id`. Falls back to "unknown" so a malformed item
        still lands somewhere rather than throwing - replication should be
        resilient, the read side can surface oddities.
    """
    checksum = item.get("checksum")
    if isinstance(checksum, str) and checksum:
        doc_id = checksum
    else:
        pk = str(item.get("pk", ""))
        doc_id = pk[len("FILE#"):] if pk.startswith("FILE#") else pk
    if not doc_id:
        raise ChangeParseError("cannot derive document id: no checksum or pk")

    user_id = item.get("user_id")
    partition_key = user_id if isinstance(user_id, str) and user_id else "unknown"
    return doc_id, partition_key


def op_from_record(record: dict[str, Any]) -> ReplicationOp | None:
    """Map one DynamoDB stream record to a ReplicationOp.

    Returns None for event types we do not replicate (defensive - the event
    source should only send table events, but we never assume).

    Raises:
        ChangeParseError: a record of a replicated event type is unparseable.
    """
    event_name = record.get("eventName", "")
    ddb = record.get("dynamodb")
    if not isinstance(ddb, dict):
        raise ChangeParseError("record has no 'dynamodb' section")

    if event_name in _UPSERT_EVENTS:
        new_image = ddb.get("NewImage")
        if not isinstance(new_image, dict):
            raise ChangeParseError(f"{event_name} record has no NewImage")
        item = deserialize_image(new_image)
        doc_id, partition_key = _doc_identity(item)
        # Cosmos uses 'id' as the document identity; set it explicitly so
        # upserts are idempotent on the file sha.
        item["id"] = doc_id
        return Upsert(doc_id=doc_id, partition_key=partition_key, document=item)

    if event_name in _DELETE_EVENTS:
        # On REMOVE, NewImage is absent; identity comes from OldImage (or
        # Keys as a last resort).
        old_image = ddb.get("OldImage")
        if isinstance(old_image, dict):
            item = deserialize_image(old_image)
        else:
            keys = ddb.get("Keys")
            if not isinstance(keys, dict):
                raise ChangeParseError("REMOVE record has neither OldImage nor Keys")
            item = deserialize_image(keys)
        doc_id, partition_key = _doc_identity(item)
        return Delete(doc_id=doc_id, partition_key=partition_key)

    return None
