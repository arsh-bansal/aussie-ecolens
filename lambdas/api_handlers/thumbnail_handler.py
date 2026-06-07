"""
POST /search/by-thumbnail — renamed from GET /thumbnail
Body: {"thumbnail_url": "s3://..."}
Response: {"url": "<full-size s3_url>", "file_type": "image" | "video"}
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_thumbnail_url
from s3_presign import presign_s3_uri, canonical_s3_uri

thumbnail_bp = Blueprint("thumbnail", __name__)


@thumbnail_bp.route("/search/by-thumbnail", methods=["POST"])
@require_auth
def get_thumbnail():
    body = request.get_json(silent=True) or {}
    thumbnail_url = body.get("thumbnail_url")

    if not thumbnail_url:
        return jsonify({"error": "Provide 'thumbnail_url' in JSON body"}), 400

    lookup_url = canonical_s3_uri(thumbnail_url) or thumbnail_url.strip()

    try:
        doc = get_file_by_thumbnail_url(lookup_url)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if doc is None:
        return jsonify({"error": "Thumbnail not found"}), 404

    return jsonify({
        "url": presign_s3_uri(doc.get("s3_url")),
        "file_type": doc.get("file_type"),
    }), 200
