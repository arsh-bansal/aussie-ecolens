"""Handler tests for the Replicator Lambda.

Uses a fake ReplicationTarget (the port makes this trivial) so no Azure is
touched. Verifies upsert/delete dispatch, that unreplicated events are
skipped, and that per-record failures isolate into batchItemFailures.
"""

from __future__ import annotations

import sys

import pytest


@pytest.fixture
def handler_with_fake_target(monkeypatch):
    """Import the handler with _build_target replaced by a fake."""
    upserts: list = []
    deletes: list = []
    fail_on_doc: set[str] = set()

    from aussie_ecolens_replicator.services.target import ReplicationTarget

    class FakeTarget(ReplicationTarget):
        def upsert(self, op) -> None:
            if op.doc_id in fail_on_doc:
                raise RuntimeError(f"simulated upsert failure {op.doc_id}")
            upserts.append(op)

        def delete(self, op) -> None:
            if op.doc_id in fail_on_doc:
                raise RuntimeError(f"simulated delete failure {op.doc_id}")
            deletes.append(op)

    # Reset cached modules so the handler rebuilds with our patched target.
    monkeypatch.setenv("DRY_RUN", "true")  # avoids Cosmos config requirement
    sys.modules.pop("aussie_ecolens_replicator.handler", None)
    sys.modules.pop("aussie_ecolens_replicator.config", None)

    import aussie_ecolens_replicator.handler as handler  # noqa: E402

    # Replace the cold-start-built target with our recording fake.
    monkeypatch.setattr(handler, "_target", FakeTarget())

    yield handler, upserts, deletes, fail_on_doc

    sys.modules.pop("aussie_ecolens_replicator.handler", None)
    sys.modules.pop("aussie_ecolens_replicator.config", None)


def _img(checksum="abc", user_id="user-1"):
    return {
        "pk": {"S": f"FILE#{checksum}"},
        "sk": {"S": "METADATA"},
        "checksum": {"S": checksum},
        "user_id": {"S": user_id},
        "tags": {"M": {"koala": {"N": "1"}}},
    }


def _event(*records):
    return {"Records": list(records)}


def _rec(event_name, *, seq, image_key="NewImage", checksum="abc"):
    return {
        "eventName": event_name,
        "dynamodb": {"SequenceNumber": seq, image_key: _img(checksum=checksum)},
    }


def test_insert_dispatches_upsert(handler_with_fake_target):
    handler, upserts, deletes, _ = handler_with_fake_target
    result = handler.lambda_handler(_event(_rec("INSERT", seq="s1")))
    assert result == {"batchItemFailures": []}
    assert len(upserts) == 1 and not deletes
    assert upserts[0].doc_id == "abc"


def test_remove_dispatches_delete(handler_with_fake_target):
    handler, upserts, deletes, _ = handler_with_fake_target
    rec = _rec("REMOVE", seq="s1", image_key="OldImage")
    result = handler.lambda_handler(_event(rec))
    assert result == {"batchItemFailures": []}
    assert len(deletes) == 1 and not upserts


def test_mixed_batch(handler_with_fake_target):
    handler, upserts, deletes, _ = handler_with_fake_target
    event = _event(
        _rec("INSERT", seq="s1", checksum="a"),
        _rec("MODIFY", seq="s2", checksum="b"),
        _rec("REMOVE", seq="s3", image_key="OldImage", checksum="c"),
    )
    result = handler.lambda_handler(event)
    assert result == {"batchItemFailures": []}
    assert {o.doc_id for o in upserts} == {"a", "b"}
    assert {o.doc_id for o in deletes} == {"c"}


def test_empty_batch(handler_with_fake_target):
    handler, upserts, deletes, _ = handler_with_fake_target
    assert handler.lambda_handler(_event()) == {"batchItemFailures": []}
    assert not upserts and not deletes


def test_partial_failure_isolated(handler_with_fake_target):
    handler, upserts, deletes, fail_on_doc = handler_with_fake_target
    fail_on_doc.add("bad")
    event = _event(
        _rec("INSERT", seq="good-seq", checksum="good"),
        _rec("INSERT", seq="bad-seq", checksum="bad"),
    )
    result = handler.lambda_handler(event)
    assert result == {"batchItemFailures": [{"itemIdentifier": "bad-seq"}]}
    assert [o.doc_id for o in upserts] == ["good"]


def test_unreplicated_event_skipped(handler_with_fake_target):
    handler, upserts, deletes, _ = handler_with_fake_target
    rec = {"eventName": "WEIRD", "dynamodb": {"SequenceNumber": "s1", "NewImage": _img()}}
    result = handler.lambda_handler(_event(rec))
    assert result == {"batchItemFailures": []}
    assert not upserts and not deletes


def test_malformed_record_becomes_failure(handler_with_fake_target):
    handler, upserts, deletes, _ = handler_with_fake_target
    # INSERT with no NewImage -> ChangeParseError -> batch failure
    bad = {"eventName": "INSERT", "dynamodb": {"SequenceNumber": "s1"}}
    result = handler.lambda_handler(_event(bad))
    assert result == {"batchItemFailures": [{"itemIdentifier": "s1"}]}
