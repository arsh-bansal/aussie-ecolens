"""S3 adapter for the Thumbnail Lambda.

Wraps the boto3 S3 client behind a class so the domain logic never imports
boto3 directly (same testability rationale as the tagger's S3Service: inject
a fake in unit tests). Two operations: read the uploaded image bytes, and
write the generated thumbnail bytes.
"""

from __future__ import annotations

import boto3

from aussie_ecolens_thumbnail.exceptions import ThumbnailGenerationError
from aussie_ecolens_thumbnail.logging import get_logger

log = get_logger(__name__)


class S3Service:
    """Minimal S3 reader/writer for thumbnail generation.

    Args:
        region_name: AWS region for the S3 client.
    """

    def __init__(self, region_name: str) -> None:
        self._client = boto3.client("s3", region_name=region_name)
        log.info("s3 client initialized", region=region_name)

    def get_bytes(self, bucket: str, key: str) -> bytes:
        """Download an object's raw bytes.

        Raises:
            ThumbnailGenerationError: if the object cannot be fetched.
        """
        try:
            resp = self._client.get_object(Bucket=bucket, Key=key)
            return resp["Body"].read()
        except Exception as e:  # noqa: BLE001 - rewrap as typed error
            raise ThumbnailGenerationError(
                f"failed to read s3://{bucket}/{key}: {e}"
            ) from e

    def put_bytes(
        self, bucket: str, key: str, data: bytes, content_type: str = "image/jpeg"
    ) -> None:
        """Upload bytes to an object key.

        Raises:
            ThumbnailGenerationError: if the upload fails.
        """
        try:
            self._client.put_object(
                Bucket=bucket, Key=key, Body=data, ContentType=content_type
            )
        except Exception as e:  # noqa: BLE001 - rewrap as typed error
            raise ThumbnailGenerationError(
                f"failed to write s3://{bucket}/{key}: {e}"
            ) from e
