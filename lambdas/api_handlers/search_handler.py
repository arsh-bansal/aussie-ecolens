"""
Search endpoints — routes renamed to match frontend api.ts

POST /search/tags     — AND logic with min counts  {"tags": {"Koala": 3}}
POST /search/species  — presence only              {"species": ["Dingo"]}
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import query_files
from species_catalog import expand_species
from s3_presign import presign_s3_uri

search_bp = Blueprint("search", __name__)


def _format_result(doc: dict) -> dict:
    # The DB stores canonical s3:// URIs for the file and its thumbnail. Browsers
    # can't load s3:// and the buckets are private, so we hand back short-lived
    # presigned https URLs instead — the image loads, the bucket stays private.
    return {
        "file_id":       doc.get("id"),
        "file_type":     doc.get("file_type"),
        "url":           presign_s3_uri(doc.get("s3_url")),
        "thumbnail_url": presign_s3_uri(doc.get("thumbnail_url")),
        "tags":          doc.get("tags", {}),
        "uploaded_at":   doc.get("uploaded_at"),
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
        docs = query_files(
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

    # Each term matches by substring: "common" -> any species whose name contains
    # it. A term becomes an OR-group of canonical names; groups are AND'd, so
    # multiple terms still narrow the result. If a term matches no known species,
    # the search returns nothing (rather than ignoring the term).
    groups = [expand_species(term) for term in species]
    if any(not g for g in groups):
        return jsonify({"results": []}), 200

    try:
        docs = query_files(species_any_groups=groups)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"results": [_format_result(d) for d in docs]}), 200
