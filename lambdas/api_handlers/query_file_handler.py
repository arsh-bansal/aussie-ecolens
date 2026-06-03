"""
POST /search/by-file — renamed from POST /query-file
Images only (video rejected with 415 per Arsh's recommendation).
Response: {"results": [SearchResult], "detected_tags": {...}}
"""

import os
import tempfile
from pathlib import Path

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import query_user_files
from tagging import tag_image_file

query_file_bp = Blueprint("query_file", __name__)

_ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}


def _format_result(doc: dict) -> dict:
    return {
        "file_id":       doc.get("id"),
        "file_type":     doc.get("file_type"),
        "url":           doc.get("s3_url"),
        "thumbnail_url": doc.get("thumbnail_url"),
        "tags":          doc.get("tags", {}),
    }


@query_file_bp.route("/search/by-file", methods=["POST"])
@require_auth
def query_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded (use multipart field 'file')"}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename"}), 400

    ext = Path(uploaded.filename).suffix.lower()

    # Images only — Arsh's query-tagger is image-only
    if ext not in _ALLOWED_IMAGE_EXTS:
        return jsonify({
            "error": "query-by-file supports images only (.jpg, .png, etc). "
                     "Video query-by-file is not supported."
        }), 415

    user_id = request.user_id

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp_path = tmp.name
        uploaded.save(tmp_path)

    try:
        detected_tags = tag_image_file(tmp_path)

        if not detected_tags:
            return jsonify({"results": [], "detected_tags": {}}), 200

        species_list = list(detected_tags.keys())
        docs = query_user_files(user_id=user_id, species_presence=species_list)

        return jsonify({
            "results":       [_format_result(d) for d in docs],
            "detected_tags": detected_tags,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
