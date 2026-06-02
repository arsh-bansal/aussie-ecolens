"""
POST /files/delete — renamed from DELETE /files, changed to POST
Body: {"urls": [...]}
Response: {"deleted": <count>, "failed": [<urls>]}
"""

import os
import boto3
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


def _parse_s3_url(s3_url: str):
    if not s3_url.startswith("s3://"):
        return None, None
    try:
        without_scheme = s3_url[5:]
        bucket, key    = without_scheme.split("/", 1)
        return bucket, key
    except ValueError:
        return None, None


def _sha_from_key(key: str) -> str | None:
    try:
        filename = key.rsplit("/", 1)[-1]
        return filename.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return None


def _thumbnail_key_from_key(key: str) -> str | None:
    try:
        parts = key.rsplit("/", 1)
        if len(parts) != 2:
            return None
        sub_dir, filename = parts
        stem, _ = filename.rsplit(".", 1)
        return f"thumbnails/{sub_dir}/{stem}_thumb.jpg"
    except ValueError:
        return None


@delete_bp.route("/files/delete", methods=["POST"])
@require_auth
def delete_files():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    urls = body.get("urls", [])
    if not urls or not isinstance(urls, list):
        return jsonify({"error": "'urls' must be a non-empty list"}), 400

    user_id = request.user_id
    deleted = []
    failed  = []

    for url in urls:
        bucket, key = _parse_s3_url(url)
        if bucket is None:
            failed.append(url)
            continue

        sha = _sha_from_key(key)
        if sha is None:
            failed.append(url)
            continue

        try:
            doc = get_file_by_sha(sha, user_id)
            if doc is None:
                # not found — skip silently per spec
                continue

            # Delete original from S3
            try:
                _get_s3().delete_object(Bucket=bucket, Key=key)
            except Exception:
                failed.append(url)
                continue

            # Delete thumbnail (best-effort)
            thumb_key = _thumbnail_key_from_key(key)
            if thumb_key:
                try:
                    _get_s3().delete_object(Bucket=bucket, Key=thumb_key)
                except Exception:
                    pass

            # Delete Cosmos doc
            delete_file_record(sha, user_id)
            deleted.append(url)

        except Exception:
            failed.append(url)

    return jsonify({"deleted": len(deleted), "failed": failed}), 200
