"""
POST /files — called by Arsh's Tagger Lambda after ML tagging.

NOTE: Under the CQRS design, the Tagger writes directly to DynamoDB
and the Replicator mirrors to Cosmos. This endpoint is kept as a
fallback/manual write path but is NOT the primary write path.
"""
from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha, update_file_tags
from azure.cosmos import CosmosClient, exceptions
import os
from datetime import datetime, timezone

files_bp = Blueprint("files", __name__)

def _get_container():
    from cosmos_client import _get_container
    return _get_container()

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

    user_id   = request.user_id
    sha       = body["checksum"]
    file_type = body["file_type"]
    s3_url    = body["s3_url"]
    tags      = body.get("tags", {})
    thumb_url = body.get("thumbnail_url")

    # Dedup check
    existing = get_file_by_sha(sha, user_id)
    if existing:
        return jsonify({
            "message": "File already exists",
            "s3_url": existing.get("s3_url"),
            "thumbnail_url": existing.get("thumbnail_url"),
        }), 409

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id":            sha,
        "user_id":       user_id,
        "checksum":      sha,
        "file_type":     file_type,
        "s3_url":        s3_url,
        "thumbnail_url": thumb_url,
        "tags":          tags,
        "uploaded_at":   now,
        "updated_at":    now,
    }

    try:
        _get_container().create_item(body=doc)
    except exceptions.CosmosResourceExistsError:
        return jsonify({"message": "File already exists", "s3_url": s3_url}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(doc), 201
