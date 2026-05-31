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
        """Persist a TagResult as a single PutItem in the shared contract shape.

        Idempotent: the pk is FILE#<sha>, so re-tagging the same upload
        overwrites the previous record with refreshed tags/timestamp. S3 may
        deliver the same event twice; that is harmless here.

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
            pk=item["pk"]["S"],
            user_id=item["user_id"]["S"],
            tags=list(item["tags"]["M"].keys()),
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
    def _to_item(cls, result: TagResult) -> dict[str, dict[str, Any]]:
        """Convert a TagResult to the shared-contract DynamoDB item.

        - pk = FILE#<sha> (sha parsed from the S3 key; valid Cosmos id)
        - user_id parsed from the key (Cosmos partition key, GSI hash)
        - tags translated from Latin species ids to common names

        Encodes Python types into DynamoDB's typed JSON shape:
            str -> {"S": value}; int -> {"N": str(value)};
            dict[str,int] -> {"M": {k: {"N": str(v)}}}; null -> {"NULL": True}
        """
        user_id, sha, file_type = cls._parse_key(result.s3_key)
        now = _iso_utc_now()

        # Latin -> common name, summing if two Latin ids map to one common name.
        common_tags: dict[str, int] = {}
        for latin, count in result.tags.items():
            name = common_name(latin)
            common_tags[name] = common_tags.get(name, 0) + count

        # thumbnail_url: for IMAGES, point at the deterministic thumbnail key
        # (s3://<thumbnails_bucket>/<sha>.jpg) that the thumbnail Lambda writes.
        # The path is a pure function of the sha, so we set it here without any
        # coordination with that Lambda (it just has to create the object). For
        # VIDEOS there is no thumbnail (queries return the full video URL), so
        # the field stays NULL.
        if file_type == "image":
            thumbnail_av: dict[str, Any] = {
                "S": f"s3://{settings.thumbnails_bucket}/{sha}.jpg"
            }
        else:
            thumbnail_av = {"NULL": True}

        return {
            "pk": {"S": f"FILE#{sha}"},
            "sk": {"S": "METADATA"},
            "user_id": {"S": user_id},
            "checksum": {"S": sha},
            "file_type": {"S": file_type},
            "s3_url": {"S": f"s3://{result.s3_bucket}/{result.s3_key}"},
            "thumbnail_url": thumbnail_av,
            "tags": {
                "M": {name: {"N": str(c)} for name, c in common_tags.items()}
            },
            "n_detections": {"N": str(result.n_detections)},
            "n_classified": {"N": str(result.n_classified)},
            "n_below_threshold": {"N": str(result.n_below_threshold)},
            "uploaded_at": {"S": now},
            "updated_at": {"S": now},
        }


def _iso_utc_now() -> str:
    """Current UTC time as an ISO-8601 string suitable for DynamoDB."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
