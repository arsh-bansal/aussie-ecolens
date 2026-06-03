"""DynamoDB persistence service for tagged file records.

Wraps the boto3 DynamoDB client behind a class so the pipeline never
imports boto3 directly. Same testability rationale as S3Service:
we can inject a fake DynamoDBService in unit tests without monkey-
patching the module.

Schema (the shared cross-cloud contract - see RACHANA-BRIEF / data model):
    pk            = FILE#<sha>            partition key (sha = upload checksum)
    sk            = METADATA              sort key for the file metadata item
    user_id       = <cognito-sub>         GSI hash; partition key on Cosmos
    checksum      = <sha>
    file_type     = image | video
    s3_url        = s3://<bucket>/<key>
    thumbnail_url = null                  (populated when thumbnails exist)
    tags          = { common_name: count }
    n_detections / n_classified / n_below_threshold
    uploaded_at / updated_at = ISO-8601

The S3 object key encodes identity as ``<cognito_sub>/<sha>.<ext>`` (set by
the upload/dedup step). We parse it here so the record carries the user and
checksum the rest of the system (dedup, the query API, Cosmos partitioning)
relies on. The pk uses the bare sha - no slashes or dots - so it is also a
valid Cosmos document id downstream.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import PurePosixPath
from typing import Any

import boto3

from aussie_ecolens_tagger.config import settings
from aussie_ecolens_tagger.domain.models import TagResult
from aussie_ecolens_tagger.exceptions import PersistenceError
from aussie_ecolens_tagger.logging import get_logger
from aussie_ecolens_tagger.species import common_name

log = get_logger(__name__)

# Image extensions get file_type "image"; everything else (mp4, mov, ...)
# is treated as "video". Kept simple and explicit.
_IMAGE_EXTS = frozenset(
    {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff"}
)


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
        """Merge a TagResult into the file's record via UpdateItem.

        The record (pk=FILE#<sha>, sk=METADATA) is shared: the upload/presign
        step seeds it with upload metadata (user_id, mime_type,
        original_filename, size_bytes, status, ...), and this tagger then adds
        the ML fields. We therefore UPDATE rather than PutItem - a PutItem would
        be a full-record replace and would wipe the seeded metadata.

        Field ownership:
        - Tagger SETs (authoritative): tags, file_type, thumbnail_url,
          n_detections, n_classified, n_below_threshold, updated_at, status.
        - Tagger sets-if-absent: user_id, checksum, s3_url, uploaded_at. If the
          seed exists, its values win; if the tagger fires with no seed (e.g. an
          object that did not go through presign), they are still populated so
          the record is self-consistent.
        - Tagger never touches: mime_type, original_filename, size_bytes (the
          upload side owns these exclusively).

        UpdateItem still emits a DynamoDB Stream record (NewImage), so the
        replicator and notifier continue to fire unchanged. Idempotent: the key
        is FILE#<sha>, so re-tagging refreshes the tagger-owned fields only.

        Args:
            result: TagResult produced by the pipeline.

        Raises:
            PersistenceError: if dry_run is False and the UpdateItem fails.
        """
        update = self._to_update(result)

        if self._dry_run:
            log.info(
                "DRY_RUN dynamodb update_item skipped",
                pk=update["key"]["pk"]["S"],
            )
            return

        try:
            self._client.update_item(
                TableName=self._table_name,
                Key=update["key"],
                UpdateExpression=update["expression"],
                ExpressionAttributeNames=update["names"],
                ExpressionAttributeValues=update["values"],
            )
        except Exception as e:  # noqa: BLE001 -- rewrap as typed error
            raise PersistenceError(
                f"dynamodb update_item failed for {result.s3_key}: {e}"
            ) from e
        log.info(
            "dynamodb update_item complete",
            pk=update["key"]["pk"]["S"],
            tags=list(update["tag_names"]),
        )

    @staticmethod
    def _parse_key(s3_key: str) -> tuple[str, str, str]:
        """Parse an upload key ``<cognito_sub>/<sha>.<ext>`` into parts.

        Returns (user_id, sha, file_type). Defensive: if the key has no
        directory component we fall back to user_id="unknown"; the sha is
        always the filename stem so the pk stays slash/dot free.
        """
        path = PurePosixPath(s3_key)
        sha = path.stem  # filename without extension
        ext = path.suffix.lower()
        # The cognito sub is the first path segment; anything deeper is
        # ignored. "user-1/abc.jpg" -> user_id "user-1"; "abc.jpg" -> unknown.
        parts = s3_key.split("/", 1)
        user_id = parts[0] if len(parts) == 2 and parts[0] else "unknown"
        file_type = "image" if ext in _IMAGE_EXTS else "video"
        return user_id, sha, file_type

    @classmethod
    def _to_update(cls, result: TagResult) -> dict[str, Any]:
        """Build the UpdateItem pieces (key, expression, names, values).

        Uses SET for tagger-owned fields and if_not_exists() for seed-shared
        fields so the upload side's values are preserved when present. Reserved
        words (status, tags) are aliased via ExpressionAttributeNames.
        """
        user_id, sha, file_type = cls._parse_key(result.s3_key)
        now = _iso_utc_now()

        # Latin -> common name, summing if two Latin ids map to one common name.
        common_tags: dict[str, int] = {}
        for latin, count in result.tags.items():
            name = common_name(latin)
            common_tags[name] = common_tags.get(name, 0) + count

        # thumbnail_url: deterministic thumbnail key for images; NULL for videos
        # (videos return the full URL on query, not a thumbnail).
        if file_type == "image":
            thumbnail_av: dict[str, Any] = {
                "S": f"s3://{settings.thumbnails_bucket}/{sha}.jpg"
            }
        else:
            thumbnail_av = {"NULL": True}

        tags_av = {"M": {name: {"N": str(c)} for name, c in common_tags.items()}}

        # SET clauses. #alias for reserved words (status, tags). Tagger-owned
        # fields are assigned directly; seed-shared fields use if_not_exists so
        # the presign seed wins when it is present.
        set_clauses = [
            "#tags = :tags",
            "file_type = :file_type",
            "thumbnail_url = :thumbnail_url",
            "n_detections = :n_detections",
            "n_classified = :n_classified",
            "n_below_threshold = :n_below_threshold",
            "updated_at = :updated_at",
            "#status = :status",
            "user_id = if_not_exists(user_id, :user_id)",
            "checksum = if_not_exists(checksum, :checksum)",
            "s3_url = if_not_exists(s3_url, :s3_url)",
            "uploaded_at = if_not_exists(uploaded_at, :uploaded_at)",
        ]

        names = {"#tags": "tags", "#status": "status"}
        values = {
            ":tags": tags_av,
            ":file_type": {"S": file_type},
            ":thumbnail_url": thumbnail_av,
            ":n_detections": {"N": str(result.n_detections)},
            ":n_classified": {"N": str(result.n_classified)},
            ":n_below_threshold": {"N": str(result.n_below_threshold)},
            ":updated_at": {"S": now},
            ":status": {"S": "tagged"},
            ":user_id": {"S": user_id},
            ":checksum": {"S": sha},
            ":s3_url": {"S": f"s3://{result.s3_bucket}/{result.s3_key}"},
            ":uploaded_at": {"S": now},
        }

        return {
            "key": {"pk": {"S": f"FILE#{sha}"}, "sk": {"S": "METADATA"}},
            "expression": "SET " + ", ".join(set_clauses),
            "names": names,
            "values": values,
            "tag_names": list(common_tags.keys()),
        }


def _iso_utc_now() -> str:
    """Current UTC time as an ISO-8601 string suitable for DynamoDB."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    