"""S3 download and local image decoding service.

Wraps boto3 S3 client and Pillow image I/O behind a stateful class
that the pipeline calls. Concrete I/O is isolated here so the rest
of the package never imports boto3 directly -- this keeps the pipeline
unit-testable with a fake S3Service injected.

The client is constructed once per Lambda container (cold start);
boto3 client construction does TCP setup + credential resolution
that we do not want to repeat per invocation.
"""

from __future__ import annotations

from pathlib import Path

import boto3
from PIL import Image

from aussie_ecolens_tagger.exceptions import ImageDecodeError, S3DownloadError
from aussie_ecolens_tagger.logging import get_logger

log = get_logger(__name__)


class S3Service:
    """S3 download and image decoding helper.

    Args:
        region_name: AWS region the S3 client should target. Should
            match where the source buckets live.
    """

    def __init__(self, region_name: str) -> None:
        self._client = boto3.client("s3", region_name=region_name)
        self._region = region_name
        log.info("s3 client initialized", region=region_name)

    def download(self, bucket: str, key: str, dest: Path) -> int:
        """Download an S3 object to a local filesystem path.

        Args:
            bucket: S3 bucket name.
            key: Object key inside the bucket.
            dest: Destination path on local disk. Parent directory must exist.

        Returns:
            Size in bytes of the downloaded object.

        Raises:
            S3DownloadError: if boto3 raises (not found, permission, network).
        """
        try:
            self._client.download_file(bucket, key, str(dest))
        except Exception as e:  # noqa: BLE001 -- rewrap as typed error
            raise S3DownloadError(
                f"failed to download s3://{bucket}/{key}: {e}"
            ) from e
        size = dest.stat().st_size
        log.info(
            "s3 download complete",
            bucket=bucket,
            key=key,
            size_bytes=size,
        )
        return size

    @staticmethod
    def decode_image(path: Path) -> Image.Image:
        """Open a local image file as a PIL RGB Image.

        Static because it does not need the boto3 client; grouped here
        so that "everything related to the source media file" lives in
        one module.

        Args:
            path: Local path to a JPEG/PNG/etc. image file.

        Returns:
            PIL Image in RGB mode (3 channels), ready for ML inference.

        Raises:
            ImageDecodeError: if Pillow cannot open or decode the file
                (corrupted upload, wrong mime type, zero bytes).
        """
        try:
            return Image.open(path).convert("RGB")
        except Exception as e:  # noqa: BLE001 -- rewrap as typed error
            raise ImageDecodeError(f"failed to decode {path.name}: {e}") from e
