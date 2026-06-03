"""Handler tests for the Notifier Lambda.

Uses a fake SNS service (patched at import) so no AWS is touched. Verifies
the handler publishes per species, isolates per-record failures into the
batchItemFailures response, and respects dry-run.
"""

from __future__ import annotations

import sys

import pytest


@pytest.fixture
def handler_with_fake_sns(monkeypatch):
    """Import the handler with SnsService replaced by a recording fake."""
    published: list[dict] = []
    fail_on_species: set[str] = set()

    class FakeSnsService:
        def __init__(self, *a, **k) -> None:
            self.topic_arn = k.get("topic_arn", "")

        def publish_species(self, *, species, subject, body) -> None:
            if species in fail_on_species:
                raise RuntimeError(f"simulated SNS failure for {species}")
            published.append(
                {"species": species, "subject": subject, "body": body}
            )

    # Env vars must be set BEFORE config/handler import, since settings is a
    # module-level singleton read at import time. Drop cached config + handler
    # so they re-read the environment, but do NOT drop services.sns - we patch
    # SnsService in place there, and popping it would cause a fresh unpatched
    # re-import when the handler imports from it.
    monkeypatch.setenv("TOPIC_ARN", "arn:aws:sns:ap-southeast-2:111:topic")
    monkeypatch.setenv("DRY_RUN", "false")
    sys.modules.pop("aussie_ecolens_notifier.handler", None)
    sys.modules.pop("aussie_ecolens_notifier.config", None)

    # Import the sns module (if not already) and patch the class on it so the
    # handler's `from services.sns import SnsService` binds to the fake.
    import aussie_ecolens_notifier.services.sns as sns_mod  # noqa: E402

    monkeypatch.setattr(sns_mod, "SnsService", FakeSnsService)
    import aussie_ecolens_notifier.handler as handler  # noqa: E402

    yield handler, published, fail_on_species

    sys.modules.pop("aussie_ecolens_notifier.handler", None)
    sys.modules.pop("aussie_ecolens_notifier.config", None)


def _event(*records: dict) -> dict:
    return {"Records": list(records)}


def _record(event_name="INSERT", *, tags, seq="seq-1", pk="FILE#x"):
    return {
        "eventName": event_name,
        "dynamodb": {
            "SequenceNumber": seq,
            "NewImage": {
                "pk": {"S": pk},
                "sk": {"S": "METADATA"},
                "user_id": {"S": "user-1"},
                "s3_url": {"S": "s3://b/x.jpg"},
                "tags": {"M": {sp: {"N": str(c)} for sp, c in tags.items()}},
            },
        },
    }


def test_publishes_one_per_species(handler_with_fake_sns):
    handler, published, _ = handler_with_fake_sns
    event = _event(_record(tags={"koala": 2, "wombat": 1}))

    result = handler.lambda_handler(event)

    assert result == {"batchItemFailures": []}
    assert {p["species"] for p in published} == {"koala", "wombat"}


def test_empty_batch_no_failures(handler_with_fake_sns):
    handler, published, _ = handler_with_fake_sns
    result = handler.lambda_handler(_event())
    assert result == {"batchItemFailures": []}
    assert published == []


def test_record_with_no_tags_is_skipped(handler_with_fake_sns):
    handler, published, _ = handler_with_fake_sns
    rec = {
        "eventName": "INSERT",
        "dynamodb": {
            "SequenceNumber": "s1",
            "NewImage": {
                "pk": {"S": "FILE#y"},
                "sk": {"S": "METADATA"},
            },
        },
    }
    result = handler.lambda_handler(_event(rec))
    assert result == {"batchItemFailures": []}
    assert published == []


def test_partial_failure_reports_only_bad_record(handler_with_fake_sns):
    handler, published, fail_on_species = handler_with_fake_sns
    fail_on_species.add("wombat")

    good = _record(tags={"koala": 1}, seq="good-seq", pk="FILE#good")
    bad = _record(tags={"wombat": 1}, seq="bad-seq", pk="FILE#bad")

    result = handler.lambda_handler(_event(good, bad))

    # Only the failing record is reported for retry.
    assert result == {"batchItemFailures": [{"itemIdentifier": "bad-seq"}]}
    # The good record still published.
    assert [p["species"] for p in published] == ["koala"]


def test_dry_run_publishes_nothing(monkeypatch):
    # Rebuild the handler in dry-run mode; the real SnsService is used but
    # its dry_run branch must skip publishing. Env vars set before import,
    # cached modules dropped so settings re-reads them.
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.delenv("TOPIC_ARN", raising=False)
    for mod in (
        "aussie_ecolens_notifier.handler",
        "aussie_ecolens_notifier.services.sns",
        "aussie_ecolens_notifier.config",
    ):
        sys.modules.pop(mod, None)
    import aussie_ecolens_notifier.handler as handler  # noqa: E402

    event = _event(_record(tags={"koala": 1}))
    result = handler.lambda_handler(event)
    assert result == {"batchItemFailures": []}

    for mod in (
        "aussie_ecolens_notifier.handler",
        "aussie_ecolens_notifier.services.sns",
        "aussie_ecolens_notifier.config",
    ):
        sys.modules.pop(mod, None)
