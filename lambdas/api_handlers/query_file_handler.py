"""
POST /query-file  — tag an uploaded file and return matching DB records.

Spec (rubric 2.2.3, 8 marks):
  - Accept a file (image or video) in multipart/form-data
  - Run ML tagging on it (MegaDetector + SpeciesNet, same pipeline as Tagger)
  - Query Cosmos for the user's files containing ALL detected species
  - Return matching URLs
  - MUST NOT store the query file permanently

The ML inference is done inline (no Lambda invocation) — we share the
tagging logic with Arsh's pipeline.  For the Lambda deployment version,
replace _tag_uploaded_file() with a call to the shared tagging routine
Arsh exposes (TBD once databases are up).

Request:
  POST /query-file
  Content-Type: multipart/form-data
  file: <binary>

Response:
  {
    "detected_tags": {"koala": 2, "wombat": 1},
    "matches": [
      {"s3_url": "...", "thumbnail_url": "...", "file_type": "image", "tags": {...}},
      ...
    ],
    "match_count": N
  }
"""

import os
import tempfile
from pathlib import Path

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import query_user_files
from tagging import tag_image_file, tag_video_file

query_file_bp = Blueprint("query_file", __name__)

_ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}
_ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".m4v"}


@query_file_bp.route("/query-file", methods=["POST"])
@require_auth
def query_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded (use multipart field 'file')"}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename"}), 400

    ext = Path(uploaded.filename).suffix.lower()
    if ext not in _ALLOWED_IMAGE_EXTS | _ALLOWED_VIDEO_EXTS:
        return jsonify({"error": f"Unsupported file type: {ext}"}), 415

    user_id = request.user_id

    # Write to a temp file — MUST be deleted after processing
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp_path = tmp.name
        uploaded.save(tmp_path)

    try:
        # Run ML tagging
        if ext in _ALLOWED_IMAGE_EXTS:
            detected_tags = tag_image_file(tmp_path)
        else:
            detected_tags = tag_video_file(tmp_path)

        if not detected_tags:
            return jsonify({
                "detected_tags": {},
                "matches": [],
                "match_count": 0,
                "message": "No species detected in the uploaded file",
            }), 200

        # Query Cosmos for user's files containing ALL detected species (AND)
        # Use presence-only (IS_DEFINED) since we're matching by species, not count
        species_list = list(detected_tags.keys())
        docs = query_user_files(user_id=user_id, species_presence=species_list)

        matches = [
            {
                "s3_url":        doc.get("s3_url"),
                "thumbnail_url": doc.get("thumbnail_url"),
                "file_type":     doc.get("file_type"),
                "tags":          doc.get("tags", {}),
            }
            for doc in docs
        ]

        return jsonify({
            "detected_tags": detected_tags,
            "matches":       matches,
            "match_count":   len(matches),
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        # CRITICAL: delete the temp file — spec says must not be permanently stored
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
