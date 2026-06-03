"""SNS publishing for tag notifications.

Thin wrapper over the boto3 SNS client. The important detail is the
MessageAttribute carrying the species: SNS subscription *filter policies*
match on message attributes, so publishing with {species: "koala"} means
only subscribers whose filter policy includes "koala" receive the message.
That is what implements per-tag filtering (assignment 2.3.3) - the Lambda
publishes every species; SNS decides who hears about which.
"""

from __future__ import annotations

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from aussie_ecolens_notifier.exceptions import PublishError
from aussie_ecolens_notifier.logging import get_logger

log = get_logger(__name__)


class SnsService:
    """Publishes tag notifications to an SNS topic."""

    def __init__(
        self,
        topic_arn: str,
        *,
        region_name: str,
        species_attribute: str = "species",
        dry_run: bool = False,
    ) -> None:
        self._topic_arn = topic_arn
        self._species_attribute = species_attribute
        self._dry_run = dry_run
        # Client is created even in dry-run so construction failures surface
        # the same way; it is simply never called when dry_run is True.
        self._client = boto3.client("sns", region_name=region_name)

    def publish_species(
        self, *, species: str, subject: str, body: str
    ) -> None:
        """Publish one species notification.

        The species is attached as a MessageAttribute so SNS filter
        policies route it; it is also in the body for human readers.

        Raises:
            PublishError: if the SNS publish call fails.
        """
        message_attributes = {
            self._species_attribute: {
                "DataType": "String",
                "StringValue": species,
            }
        }

        if self._dry_run:
            log.info(
                "DRY_RUN sns publish skipped",
                topic_arn=self._topic_arn,
                species=species,
                subject=subject,
            )
            return

        try:
            resp = self._client.publish(
                TopicArn=self._topic_arn,
                Subject=subject[:100],  # SNS subject hard limit is 100 chars
                Message=body,
                MessageAttributes=message_attributes,
            )
        except (ClientError, BotoCoreError) as exc:
            raise PublishError(
                f"SNS publish failed for species {species!r} to "
                f"{self._topic_arn}: {exc}"
            ) from exc

        log.info(
            "sns publish ok",
            species=species,
            message_id=resp.get("MessageId"),
        )
