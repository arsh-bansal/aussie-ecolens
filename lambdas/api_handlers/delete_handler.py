"""
POST /files/delete — bulk delete (2.3.2)
Body: {"urls": [...]}
Response: {"deleted": <count>, "failed": [<urls>]}

For each URL: deletes the original object + its thumbnail from S3, then deletes
the DynamoDB record (system of record). The Replicator removes the Cosmos
document via the stream REMOVE event — we never delete from Cosmos directly.

Thumbnail location is taken from the record's own thumbnail_url (so it works
regardless of bucket/key convention). Videos have no thumbnail (thumbnail_url
is null) and are skipped cleanly.
"""

import os
import boto3
from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha_global, delete_file_record_cosmos
from dynamodb_client import delete_file_record      # write (system of record)

delete_bp = Blueprint("delete", __name__)
_s3_client = None


def _get_s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3", region_name=os.environ.get("AWS_REGION", "ap-southeast-2")
        )
    return _s3_client


def _parse_s3_url(s3_url: str):
    if not s3_url.startswith("s3://"):
        return None, None
    try:
        without_scheme = s3_url[5:]
        bucket, key = without_scheme.split("/", 1)
        return bucket, key
    except ValueError:
        return None, None


def _sha_from_key(key: str) -> str | None:
    try:
        filename = key.rsplit("/", 1)[-1]
        return filename.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return None


def _sha_from_presigned(url: str) -> str | None:
    try:
        path = url.split("?")[0].split("://", 1)[-1]
        key = path.split("/", 1)[1]
        return _sha_from_key(key)
    except (IndexError, ValueError):
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

    deleted = []
    failed = []

    for url in urls:
        bucket, key = _parse_s3_url(url)
        if bucket is None:
            # Presigned https URLs — resolve via global Cosmos lookup.
            sha = _sha_from_presigned(url)
            if sha is None:
                failed.append(url)
                continue
            doc = get_file_by_sha_global(sha)
            if doc is None:
                failed.append(url)
                continue
            s3_url = doc.get("s3_url", "")
            bucket, key = _parse_s3_url(s3_url)
            if bucket is None:
                failed.append(url)
                continue
        else:
            sha = _sha_from_key(key)
            if sha is None:
                failed.append(url)
                continue
            doc = get_file_by_sha_global(sha)
            if doc is None:
                failed.append(url)
                continue

        try:

            # 1. Delete the original object (image or video) from S3.
            try:
                _get_s3().delete_object(Bucket=bucket, Key=key)
            except Exception:
                failed.append(url)
                continue

            # 2. Delete the thumbnail (best-effort), derived from the record's
            #    own thumbnail_url. Videos have none -> skipped cleanly.
            tu = doc.get("thumbnail_url")
            if tu and isinstance(tu, str) and tu.startswith("s3://"):
                try:
                    tb, tk = tu[5:].split("/", 1)
                    _get_s3().delete_object(Bucket=tb, Key=tk)
                except Exception:
                    pass  # best-effort

            # 3. Delete the DynamoDB record (system of record). The Replicator
            #    removes the Cosmos document via the stream REMOVE event.
            delete_file_record(sha)
            delete_file_record_cosmos(sha, doc["user_id"])
            deleted.append(url)

        except Exception:
            failed.append(url)

    return jsonify({"deleted": len(deleted), "failed": failed}), 200
    