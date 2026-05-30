"""
GET /search  — find files by tag counts or species presence.

Spec (rubric 2.2.1):
  - JSON body with tag→count (AND logic, min count):
      {"koala": 3, "wombat": 1}  → files with >=3 koalas AND >=1 wombat
  - OR species-only (no count) for presence:
      {"dingo": 0} or {"dingo": null} treated as IS_DEFINED

Response:
  {
    "results": [
      {
        "thumbnail_url": "...",   # for images
        "s3_url": "...",          # full file URL
        "file_type": "image",
        "tags": {"koala": 3, ...}
      },
      ...
    ],
    "count": N
  }
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import query_user_files

search_bp = Blueprint("search", __name__)


@search_bp.route("/search", methods=["GET"])
@require_auth
def search():
    """
    Query string OR JSON body:
      ?tags=koala:3,wombat:1   (query string shorthand)
      body: {"koala": 3, "wombat": 1}

    Count of 0 or null → presence only (IS_DEFINED).
    """
    user_id = request.user_id

    # Accept both JSON body and query-string for flexibility
    if request.is_json:
        raw = request.get_json(silent=True) or {}
    else:
        # Parse ?tags=koala:3,wombat:1
        tags_qs = request.args.get("tags", "")
        raw = {}
        if tags_qs:
            for part in tags_qs.split(","):
                part = part.strip()
                if ":" in part:
                    species, count_str = part.split(":", 1)
                    try:
                        raw[species.strip()] = int(count_str.strip())
                    except ValueError:
                        raw[species.strip()] = 0
                else:
                    raw[part] = 0

    if not raw:
        return jsonify({"error": "Provide at least one tag filter"}), 400

    tag_filters      = {k: v for k, v in raw.items() if v and v > 0}
    species_presence = [k for k, v in raw.items() if not v or v <= 0]

    try:
        docs = query_user_files(
            user_id=user_id,
            tag_filters=tag_filters if tag_filters else None,
            species_presence=species_presence if species_presence else None,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    results = [_format_result(doc) for doc in docs]
    return jsonify({"results": results, "count": len(results)}), 200


def _format_result(doc: dict) -> dict:
    return {
        "sha":           doc.get("id"),
        "s3_url":        doc.get("s3_url"),
        "thumbnail_url": doc.get("thumbnail_url"),
        "file_type":     doc.get("file_type"),
        "tags":          doc.get("tags", {}),
        "uploaded_at":   doc.get("uploaded_at"),
    }
