"""
POST /search/by-file/presign — presigned PUT for query-temp/ (bypasses 6 MB Lambda limit)
POST /search/by-file         — tag staged image + find matches (JSON {key} or legacy multipart)
"""

import os
import tempfile
import uuid
from pathlib import Path

import boto3
from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import query_files
from tagging import (
    cleanup_query_artifacts,
    is_video_key,
    pending_job_exists,
    query_pending_key,
    query_result_key,
    read_query_result,
    start_video_tag_job,
    tag_s3_object,
    tag_image_file,
)
from s3_presign import presign_s3_uri

query_file_bp = Blueprint("query_file", __name__)

_ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}
_ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
_ALLOWED_MEDIA_EXTS = _ALLOWED_IMAGE_EXTS | _ALLOWED_VIDEO_EXTS
_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/bmp": ".bmp",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
}
# API Gateway → Lambda sync payload is 6 MB; direct multipart fails above that.
# Presign lets the browser PUT to S3, then we only pass a short JSON key.
MAX_QUERY_BYTES = 50 * 1024 * 1024
PRESIGN_TTL = 300

_REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
_s3 = boto3.client("s3", region_name=_REGION)
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "")


def _format_result(doc: dict) -> dict:
    return {
        "file_id":       doc.get("id"),
        "file_type":     doc.get("file_type"),
        "url":           presign_s3_uri(doc.get("s3_url")),
        "thumbnail_url": presign_s3_uri(doc.get("thumbnail_url")),
        "tags":          doc.get("tags", {}),
    }


def _search_with_tags(detected_tags: dict) -> tuple:
    if not detected_tags:
        return jsonify({"results": [], "detected_tags": {}}), 200
    species_list = list(detected_tags.keys())
    docs = query_files(species_presence=species_list)
    return jsonify({
        "results":       [_format_result(d) for d in docs],
        "detected_tags": detected_tags,
    }), 200


def _run_video_query_by_key(key: str):
    result_key = query_result_key(key)
    pending_key = query_pending_key(key)

    finished = read_query_result(S3_BUCKET_NAME, result_key)
    if finished is not None:
        cleanup_query_artifacts(S3_BUCKET_NAME, key, result_key, pending_key)
        if finished.get("error"):
            return jsonify({"error": finished["error"]}), 500
        return _search_with_tags(finished.get("tags", {}))

    if pending_job_exists(S3_BUCKET_NAME, pending_key):
        return jsonify({"status": "processing", "key": key}), 202

    try:
        start_video_tag_job(S3_BUCKET_NAME, key)
    except RuntimeError as e:
        msg = str(e)
        if "warming up" in msg.lower() or "cold start" in msg.lower():
            return jsonify({"error": msg}), 503
        return jsonify({"error": msg}), 500

    return jsonify({"status": "processing", "key": key}), 202


def _run_query_by_key(key: str):
    if not key.startswith("query-temp/"):
        return jsonify({"error": "Invalid query key"}), 400
    if not S3_BUCKET_NAME:
        return jsonify({"error": "S3_BUCKET_NAME not configured"}), 500

    if is_video_key(key):
        return _run_video_query_by_key(key)

    try:
        detected_tags = tag_s3_object(S3_BUCKET_NAME, key)
    except RuntimeError as e:
        msg = str(e)
        if "warming up" in msg.lower() or "cold start" in msg.lower():
            return jsonify({"error": msg}), 503
        return jsonify({"error": msg}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return _search_with_tags(detected_tags)


@query_file_bp.route("/search/by-file/presign", methods=["POST"])
@require_auth
def query_file_presign():
    body = request.get_json(silent=True) or {}
    content_type = (body.get("content_type") or "").strip().lower()
    size_bytes = body.get("size_bytes")

    if content_type not in _MIME_TO_EXT:
        return jsonify({
            "error": "Unsupported file type. Use JPEG, PNG, BMP, GIF, WebP, MP4, or MOV."
        }), 400

    if size_bytes is not None:
        try:
            size = int(size_bytes)
        except (TypeError, ValueError):
            return jsonify({"error": "size_bytes must be an integer"}), 400
        if size <= 0:
            return jsonify({"error": "size_bytes must be positive"}), 400
        if size > MAX_QUERY_BYTES:
            return jsonify({
                "error": f"File too large (max {MAX_QUERY_BYTES // (1024 * 1024)} MB)."
            }), 413

    if not S3_BUCKET_NAME:
        return jsonify({"error": "S3_BUCKET_NAME not configured"}), 500

    ext = _MIME_TO_EXT[content_type]
    key = f"query-temp/{uuid.uuid4().hex}{ext}"

    try:
        presigned_url = _s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=PRESIGN_TTL,
        )
    except Exception as e:
        return jsonify({"error": f"Failed to create presigned URL: {e}"}), 500

    return jsonify({
        "presigned_url": presigned_url,
        "key": key,
        "content_type": content_type,
        "expires_in": PRESIGN_TTL,
    }), 200


@query_file_bp.route("/search/by-file", methods=["POST"])
@require_auth
def query_file():
    # Preferred path: client PUTs to S3, then sends the key (tiny JSON body).
    if request.is_json:
        key = (request.get_json(silent=True) or {}).get("key", "")
        if not key:
            return jsonify({"error": "Missing key (upload via /search/by-file/presign first)"}), 400
        return _run_query_by_key(key)

    # Legacy multipart — only works under the ~6 MB Lambda payload limit.
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded (use multipart field 'file')"}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename"}), 400

    ext = Path(uploaded.filename).suffix.lower()
    if ext not in _ALLOWED_MEDIA_EXTS:
        return jsonify({
            "error": "Unsupported file type. Use an image (.jpg, .png, etc.) "
                     "or video (.mp4, .mov, etc.)."
        }), 415

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp_path = tmp.name
        uploaded.save(tmp_path)

    try:
        detected_tags = tag_image_file(tmp_path)
        if not detected_tags:
            return jsonify({"results": [], "detected_tags": {}}), 200

        species_list = list(detected_tags.keys())
        docs = query_files(species_presence=species_list)
        return jsonify({
            "results":       [_format_result(d) for d in docs],
            "detected_tags": detected_tags,
        }), 200

    except RuntimeError as e:
        msg = str(e)
        if "warming up" in msg.lower() or "cold start" in msg.lower():
            return jsonify({"error": msg}), 503
        return jsonify({"error": msg}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
