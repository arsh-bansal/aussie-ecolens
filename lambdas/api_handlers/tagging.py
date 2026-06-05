"""
tagging.py — ML inference for /search/by-file.

Invokes the query-tagger Lambda (container image, MegaDetector + SpeciesNet).
Images are staged to S3 and passed by {bucket, key} to avoid base64 payload
bloat and the 6 MB synchronous invoke limit.
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

_lambda_client = None
_s3_client = None

TAGGER_LAMBDA_NAME = os.environ.get("TAGGER_LAMBDA_NAME", "")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "")
AWS_REGION = os.environ.get("AWS_REGION_NAME") or os.environ.get("AWS_REGION", "ap-southeast-2")


def _get_lambda_client():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client(
            "lambda",
            region_name=AWS_REGION,
            config=Config(read_timeout=120, connect_timeout=10, retries={"max_attempts": 0}),
        )
    return _lambda_client


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=AWS_REGION)
    return _s3_client


def _invoke_tagger(bucket: str, key: str) -> dict[str, int]:
    if not TAGGER_LAMBDA_NAME:
        raise RuntimeError(
            "TAGGER_LAMBDA_NAME is not set — deploy aussie-ecolens-query-tagger first."
        )

    payload = {"bucket": bucket, "key": key}
    try:
        response = _get_lambda_client().invoke(
            FunctionName=TAGGER_LAMBDA_NAME,
            InvocationType="RequestResponse",
            Payload=json.dumps(payload).encode(),
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"TooManyRequestsException", "ServiceException"}:
            raise RuntimeError(
                "ML tagger is warming up (cold start). Wait 30 seconds and try again."
            ) from exc
        raise RuntimeError(f"Failed to invoke tagger Lambda: {exc}") from exc

    if response.get("FunctionError"):
        detail = response["Payload"].read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Tagger Lambda error: {detail}")

    result = json.loads(response["Payload"].read())
    if "error" in result:
        raise RuntimeError(f"Tagger Lambda error: {result['error']}")
    return result.get("tags", {})


def tag_image_file(image_path: str) -> dict[str, int]:
    """Tag an image file via the query-tagger Lambda (S3-staged invoke)."""
    if not S3_BUCKET_NAME:
        raise RuntimeError("S3_BUCKET_NAME is not set on the query API Lambda.")

    ext = Path(image_path).suffix.lower() or ".jpg"
    key = f"query-temp/{uuid.uuid4().hex}{ext}"

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    s3 = _get_s3_client()
    s3.put_object(Bucket=S3_BUCKET_NAME, Key=key, Body=image_bytes)

    try:
        return _invoke_tagger(S3_BUCKET_NAME, key)
    finally:
        try:
            s3.delete_object(Bucket=S3_BUCKET_NAME, Key=key)
        except ClientError:
            pass
