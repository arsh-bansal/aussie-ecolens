"""
Search endpoints — routes renamed to match frontend api.ts

POST /search/tags     — AND logic with min counts  {"tags": {"Koala": 3}}
POST /search/species  — presence only              {"species": ["Dingo"]}
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import query_user_files

search_bp = Blueprint("search", __name__)


def _format_result(doc: dict) -> dict:
    return {
        "file_id":       doc.get("id"),
        "file_type":     doc.get("file_type"),
        "url":           doc.get("s3_url"),
        "thumbnail_url": doc.get("thumbnail_url"),
        "tags":          doc.get("tags", {}),
    }


@search_bp.route("/search/tags", methods=["POST"])
@require_auth
def search_by_tags():
    body = request.get_json(silent=True) or {}
    tag_filters = body.get("tags", {})
    if not tag_filters:
        return jsonify({"error": "Provide at least one tag in 'tags'"}), 400

    count_filters = {k: v for k, v in tag_filters.items() if v and v > 0}
    presence_only = [k for k, v in tag_filters.items() if not v or v <= 0]

    try:
        docs = query_user_files(
            user_id=request.user_id,
            tag_filters=count_filters if count_filters else None,
            species_presence=presence_only if presence_only else None,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"results": [_format_result(d) for d in docs]}), 200


@search_bp.route("/search/species", methods=["POST"])
@require_auth
def search_by_species():
    body = request.get_json(silent=True) or {}
    species = body.get("species", [])
    if not species:
        return jsonify({"error": "Provide at least one species"}), 400

    try:
        docs = query_user_files(user_id=request.user_id, species_presence=species)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"results": [_format_result(d) for d in docs]}), 200
