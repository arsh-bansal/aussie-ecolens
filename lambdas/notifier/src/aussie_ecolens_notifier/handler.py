"""Notifier Lambda entry point.

Triggered by the DynamoDB stream of the shared files table. For each new
or modified file, publishes one SNS notification per detected species;
SNS subscription filter policies deliver each species only to the users
watching it (assignment 2.3.3).

Partial-batch failures: the function reports per-record failures via the
`batchItemFailures` response so DynamoDB Streams retries only the records
that failed, not the whole batch. This is the production-correct contract
for stream event sources (requires ReportBatchItemFailures on the event
source mapping, which the SAM template sets).
"""

from __future__ import annotations

from typing import Any

from aussie_ecolens_notifier.config import settings
from aussie_ecolens_notifier.domain.stream import (
    format_email,
    intents_from_record,
)
from aussie_ecolens_notifier.exceptions import ConfigurationError
from aussie_ecolens_notifier.logging import configure_logging, get_logger
from aussie_ecolens_notifier.services.sns import SnsService

configure_logging()
log = get_logger(__name__)

log.info(
    "notifier cold start",
    aws_region=settings.aws_region,
    topic_arn=settings.topic_arn or "(unset)",
    species_attribute=settings.species_attribute,
    min_count=settings.min_count,
    dry_run=settings.dry_run,
)

# Fail fast at cold start if misconfigured (unless dry-run, which needs no
# real topic). Better to crash the cold start with a clear message than to
# silently no-op every invocation.
if not settings.topic_arn and not settings.dry_run:
    raise ConfigurationError(
        "TOPIC_ARN is required when DRY_RUN is false; set the SNS topic ARN"
    )

_sns = SnsService(
    topic_arn=settings.topic_arn,
    region_name=settings.aws_region,
    species_attribute=settings.species_attribute,
    dry_run=settings.dry_run,
)


def lambda_handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    """Process a batch of DynamoDB stream records.

    Returns a `batchItemFailures` list naming any records that failed, so
    the event source mapping retries only those. A record that publishes
    all its species successfully is not listed; a record that raises is.

    Args:
        event: DynamoDB Streams event with an event["Records"] list.
        _context: Lambda context (unused).

    Returns:
        {"batchItemFailures": [{"itemIdentifier": <sequenceNumber>}, ...]}.
    """
    records = event.get("Records", [])
    log.info("notifier batch received", record_count=len(records))

    failures: list[dict[str, str]] = []
    published = 0

    for record in records:
        seq = record.get("dynamodb", {}).get("SequenceNumber", "")
        try:
            intents = intents_from_record(record, min_count=settings.min_count)
            for intent in intents:
                subject, body = format_email(intent)
                _sns.publish_species(
                    species=intent.species, subject=subject, body=body
                )
                published += 1
        except Exception as exc:  # noqa: BLE001 - convert to batch failure
            # One bad record must not poison the batch. Log it and mark
            # only this record for retry.
            log.error(
                "notifier record failed",
                sequence_number=seq,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            if seq:
                failures.append({"itemIdentifier": seq})

    log.info(
        "notifier batch complete",
        published=published,
        failed_records=len(failures),
    )
    return {"batchItemFailures": failures}
