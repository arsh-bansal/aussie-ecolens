"""
POST /search/by-thumbnail — renamed from GET /thumbnail
Body: {"thumbnail_url": "s3://..."}
Response: {"url": "<full-size s3_url>"}
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_thumbnail_url

thumbnail_bp = Blueprint("thumbnail", __name__)


@thumbnail_bp.route("/search/by-thumbnail", methods=["POST"])
@require_auth
def get_thumbnail():
    body = request.get_json(silent=True) or {}
    thumbnail_url = body.get("thumbnail_url")

    if not thumbnail_url:
        return jsonify({"error": "Provide 'thumbnail_url' in JSON body"}), 400

    try:
        doc = get_file_by_thumbnail_url(thumbnail_url)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if doc is None:
        return jsonify({"error": "Thumbnail not found"}), 404

    return jsonify({"url": doc.get("s3_url")}), 200
