"""
POST /files — manual write fallback (not the primary write path).
Primary path: Arsh's Tagger writes to DynamoDB → Replicator → Cosmos.
"""
from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha, list_all_files, _get_container
from search_handler import _format_result
from s3_presign import presign_s3_uri
from azure.cosmos import exceptions
from datetime import datetime, timezone

files_bp = Blueprint("files", __name__)


@files_bp.route("/files/list", methods=["GET"])
@require_auth
def list_files():
    """Return every file in the shared observatory (Manage page)."""
    docs = list_all_files()
    return jsonify({"results": [_format_result(d) for d in docs]}), 200


@files_bp.route("/files/status/<sha>", methods=["GET"])
@require_auth
def file_status(sha):
    """Poll the tagging status of an uploaded file (by checksum).

    Tagging is asynchronous (S3 event → Tagger → DynamoDB → Replicator →
    Cosmos), so the upload UI polls this after a successful upload to know when
    detection has finished. Scoped to the caller's own files via the partition
    key. Returns status="pending" (200) until the record exists and is tagged,
    so the client can poll without treating "not ready yet" as an error.
    """
    doc = get_file_by_sha(sha, request.user_id)
    if not doc:
        return jsonify({"status": "pending", "tags": {}}), 200

    return jsonify({
        "status":        doc.get("status", "pending"),
        "file_type":     doc.get("file_type"),
        "tags":          doc.get("tags", {}),
        "url":           presign_s3_uri(doc.get("s3_url")),
        "thumbnail_url": presign_s3_uri(doc.get("thumbnail_url")),
    }), 200


@files_bp.route("/files", methods=["POST"])
@require_auth
def create_file():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    required = ["checksum", "file_type", "s3_url"]
    missing = [f for f in required if not body.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    user_id  = request.user_id
    sha      = body["checksum"]

    existing = get_file_by_sha(sha, user_id)
    if existing:
        return jsonify({"message": "File already exists", "s3_url": existing.get("s3_url")}), 409

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id":            sha,
        "user_id":       user_id,
        "checksum":      sha,
        "file_type":     body["file_type"],
        "s3_url":        body["s3_url"],
        "thumbnail_url": body.get("thumbnail_url"),
        "tags":          body.get("tags", {}),
        "uploaded_at":   now,
        "updated_at":    now,
    }

    try:
        _get_container().create_item(body=doc)
    except exceptions.CosmosResourceExistsError:
        return jsonify({"message": "File already exists", "s3_url": body["s3_url"]}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(doc), 201
