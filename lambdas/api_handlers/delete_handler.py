"""
DELETE /files  — delete files from S3 and Cosmos DB.

Spec (rubric 2.3.2):
  - Accept a list of URLs (s3_url values)
  - Delete full image + thumbnail from S3 storage
  - Delete the corresponding Cosmos document
  - Only the owning user can delete their files

Request:
  DELETE /files
  {
    "urls": ["s3://aussie-ecolens-uploads-.../sub/sha.jpg", ...]
  }

Response:
  {
    "deleted": ["s3://...", ...],
    "not_found": ["s3://...", ...],
    "errors": []
  }

Environment variables:
    AWS_REGION          – default: ap-southeast-2
    S3_BUCKET_NAME      – the uploads bucket name
"""

import os
import boto3
from pathlib import PurePosixPath

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha, delete_file_record

delete_bp = Blueprint("delete", __name__)

_s3_client = None


def _get_s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
    return _s3_client


def _parse_s3_url(s3_url: str) -> tuple[str, str] | tuple[None, None]:
    """Parse s3://bucket/key into (bucket, key). Returns (None, None) on failure."""
    if not s3_url.startswith("s3://"):
        return None, None
    try:
        without_scheme = s3_url[5:]
        bucket, key    = without_scheme.split("/", 1)
        return bucket, key
    except ValueError:
        return None, None


def _sha_from_key(key: str) -> str | None:
    """Extract sha from S3 key format: {sub}/{sha}.{ext}"""
    try:
        filename = key.rsplit("/", 1)[-1]
        return filename.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return None


def _delete_from_s3(bucket: str, key: str) -> bool:
    """Delete a key from S3. Returns True on success."""
    try:
        _get_s3().delete_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


def _thumbnail_key_from_key(key: str) -> str | None:
    """
    Derive the thumbnail S3 key from the original file key.
    Convention: thumbnails stored at thumbnails/{sub}/{sha}_thumb.jpg
    (adjust to match Adam's thumbnails Lambda output path if different)
    """
    try:
        parts = key.rsplit("/", 1)
        if len(parts) != 2:
            return None
        sub_dir, filename = parts
        stem, _ = filename.rsplit(".", 1)
        return f"thumbnails/{sub_dir}/{stem}_thumb.jpg"
    except ValueError:
        return None


@delete_bp.route("/files", methods=["DELETE"])
@require_auth
def delete_files():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    urls = body.get("urls", [])
    if not urls or not isinstance(urls, list):
        return jsonify({"error": "'urls' must be a non-empty list"}), 400

    user_id   = request.user_id
    deleted   = []
    not_found = []
    errors    = []

    for url in urls:
        bucket, key = _parse_s3_url(url)
        if bucket is None:
            errors.append({"url": url, "error": "Invalid S3 URL format"})
            continue

        sha = _sha_from_key(key)
        if sha is None:
            errors.append({"url": url, "error": "Could not parse SHA from key"})
            continue

        # Ownership check — only delete if this user owns the file
        try:
            doc = get_file_by_sha(sha, user_id)
        except Exception as e:
            errors.append({"url": url, "error": f"DB lookup failed: {e}"})
            continue

        if doc is None:
            not_found.append(url)
            continue

        file_errors = []

        # 1. Delete original file from S3
        if not _delete_from_s3(bucket, key):
            file_errors.append("Failed to delete original from S3")

        # 2. Delete thumbnail from S3 (best-effort — may not exist yet)
        thumb_key = _thumbnail_key_from_key(key)
        if thumb_key:
            _delete_from_s3(bucket, thumb_key)   # ignore failure (may not exist)

        # 3. Delete Cosmos document
        cosmos_deleted = delete_file_record(sha, user_id)
        if not cosmos_deleted:
            file_errors.append("Cosmos document not found (may already be deleted)")

        if file_errors:
            errors.append({"url": url, "errors": file_errors})
        else:
            deleted.append(url)

    return jsonify({
        "deleted":   deleted,
        "not_found": not_found,
        "errors":    errors,
    }), 200
