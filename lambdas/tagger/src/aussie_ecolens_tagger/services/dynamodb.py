"""DynamoDB persistence service for tagged file records.

Wraps the boto3 DynamoDB client behind a class so the pipeline never
imports boto3 directly. Same testability rationale as S3Service:
we can inject a fake DynamoDBService in unit tests without monkey-
patching the module.

Schema (single-table, per docs/data-model.md):
    pk = FILE#<identifier>        partition key
    sk = METADATA                 sort key for the file metadata item
    plus: s3_bucket, s3_key, tags (map), n_detections, n_classified, tagged_at
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import boto3

from aussie_ecolens_tagger.domain.models import TagResult
from aussie_ecolens_tagger.exceptions import PersistenceError
from aussie_ecolens_tagger.logging import get_logger

log = get_logger(__name__)


class DynamoDBService:
    """DynamoDB writer for tagged file records.

    Args:
        table_name: Name of the single-table store (e.g. aussie-ecolens-files).
        region_name: AWS region where the table lives.
        dry_run: If True, log the PutItem payload but do not call AWS.
            Useful for local development before the table is provisioned,
            and for end-to-end tests that should not pollute real data.
    """

    def __init__(
        self,
        table_name: str,
        region_name: str,
        dry_run: bool = False,
    ) -> None:
        self._table_name = table_name
        self._dry_run = dry_run
        self._client = boto3.client("dynamodb", region_name=region_name)
        log.info(
            "dynamodb client initialized",
            table=table_name,
            region=region_name,
            dry_run=dry_run,
        )

    def put_tag_result(self, result: TagResult) -> None:
        """Persist a TagResult as a single PutItem.

        Idempotent: same (s3_bucket, s3_key) overwrites the previous record
        with refreshed timestamp. S3 may deliver the same event twice; that
        is harmless under this design because the second write produces
        identical content.

        Args:
            result: TagResult produced by the pipeline.

        Raises:
            PersistenceError: if dry_run is False and the underlying
                PutItem call fails for any reason.
        """
        item = self._to_item(result)

        if self._dry_run:
            log.info("DRY_RUN dynamodb put_item skipped", item_keys=list(item.keys()))
            return

        try:
            self._client.put_item(TableName=self._table_name, Item=item)
        except Exception as e:  # noqa: BLE001 -- rewrap as typed error
            raise PersistenceError(
                f"dynamodb put_item failed for {result.s3_key}: {e}"
            ) from e
        log.info(
            "dynamodb put_item complete",
            s3_key=result.s3_key,
            tags=result.tags,
        )

    @staticmethod
    def _to_item(result: TagResult) -> dict[str, dict[str, Any]]:
        """Convert a TagResult to a DynamoDB AttributeValue map.

        Encodes Python types into DynamoDB's typed JSON shape:
            str -> {"S": value}
            int -> {"N": str(value)}    (DynamoDB N is string-encoded)
            dict[str, int] -> {"M": {k: {"N": str(v)}, ...}}
        """
        return {
            "pk": {"S": f"FILE#{result.s3_key}"},
            "sk": {"S": "METADATA"},
            "s3_bucket": {"S": result.s3_bucket},
            "s3_key": {"S": result.s3_key},
            "tags": {
                "M": {sp: {"N": str(count)} for sp, count in result.tags.items()}
            },
            "n_detections": {"N": str(result.n_detections)},
            "n_classified": {"N": str(result.n_classified)},
            "n_below_threshold": {"N": str(result.n_below_threshold)},
            "tagged_at": {"S": _iso_utc_now()},
        }


def _iso_utc_now() -> str:
    """Current UTC time as an ISO-8601 string suitable for DynamoDB."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
