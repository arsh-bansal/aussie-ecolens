"""
GET /thumbnail  — find full-size image URL from a thumbnail URL.

Spec (rubric 2.2.2):
  Input:  thumbnail URL (query string or JSON body)
  Output: corresponding s3_url (full-size image)

Note: this is a cross-partition Cosmos query (thumbnail_url is not the
partition key). It's flagged as a rare / effectively-public operation in
the data model — no ownership check required per the spec.

Request:
  GET /thumbnail?url=https://...
  OR body: {"thumbnail_url": "https://..."}

Response:
  {"thumbnail_url": "...", "s3_url": "...", "file_type": "image"}
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_thumbnail_url

thumbnail_bp = Blueprint("thumbnail", __name__)


@thumbnail_bp.route("/thumbnail", methods=["GET"])
@require_auth
def get_thumbnail():
    # Accept thumbnail URL from query string or JSON body
    if request.is_json:
        body          = request.get_json(silent=True) or {}
        thumbnail_url = body.get("thumbnail_url") or body.get("url")
    else:
        thumbnail_url = request.args.get("url") or request.args.get("thumbnail_url")

    if not thumbnail_url:
        return jsonify({"error": "Provide thumbnail_url as ?url= or in JSON body"}), 400

    try:
        doc = get_file_by_thumbnail_url(thumbnail_url)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if doc is None:
        return jsonify({"error": "Thumbnail not found"}), 404

    return jsonify({
        "thumbnail_url": doc.get("thumbnail_url"),
        "s3_url":        doc.get("s3_url"),
        "file_type":     doc.get("file_type"),
        "tags":          doc.get("tags", {}),
    }), 200
