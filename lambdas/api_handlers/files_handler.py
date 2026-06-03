"""
POST /files — manual write fallback (not the primary write path).
Primary path: Arsh's Tagger writes to DynamoDB → Replicator → Cosmos.
"""
from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha, _get_container
from azure.cosmos import exceptions
from datetime import datetime, timezone

files_bp = Blueprint("files", __name__)


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
