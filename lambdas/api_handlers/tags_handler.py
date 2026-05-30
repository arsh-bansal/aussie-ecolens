"""
POST /tags  — bulk add or remove tags from files.

Spec (rubric 2.3.1):
  JSON body:
  {
    "urls":      ["s3://...", "s3://..."],
    "tags":      ["koala", "wombat"],
    "operation": 1   // 1 = add, 0 = remove
  }

  - operation 1 (add):    increment count for each tag (or set to 1 if absent)
  - operation 0 (remove): delete the tag key; if tag not present, ignore it
  - Only operates on files owned by the authenticated user

Response:
  {
    "updated": ["s3://...", ...],
    "not_found": ["s3://...", ...],
    "errors": []
  }
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha, update_file_tags

tags_bp = Blueprint("tags", __name__)


def _sha_from_url(s3_url: str) -> str | None:
    """Extract the sha256 from an S3 URL like s3://bucket/sub/sha.jpg."""
    # S3 key format: {cognito_sub}/{sha}.{ext}
    try:
        path  = s3_url.split("://", 1)[-1]   # strip s3://
        key   = path.split("/", 1)[1]         # strip bucket name
        # key is now "{sub}/{sha}.{ext}" — sha is the stem of the last segment
        filename = key.rsplit("/", 1)[-1]
        sha = filename.rsplit(".", 1)[0]
        return sha if sha else None
    except (IndexError, ValueError):
        return None


@tags_bp.route("/tags", methods=["POST"])
@require_auth
def bulk_tag():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    urls      = body.get("urls", [])
    tags      = body.get("tags", [])
    operation = body.get("operation")

    if not urls or not isinstance(urls, list):
        return jsonify({"error": "'urls' must be a non-empty list"}), 400
    if not tags or not isinstance(tags, list):
        return jsonify({"error": "'tags' must be a non-empty list"}), 400
    if operation not in (0, 1):
        return jsonify({"error": "'operation' must be 0 (remove) or 1 (add)"}), 400

    user_id   = request.user_id
    updated   = []
    not_found = []
    errors    = []

    for url in urls:
        sha = _sha_from_url(url)
        if sha is None:
            errors.append({"url": url, "error": "Could not parse SHA from URL"})
            continue

        try:
            doc = get_file_by_sha(sha, user_id)
            if doc is None:
                not_found.append(url)
                continue

            current_tags: dict = dict(doc.get("tags", {}))

            if operation == 1:
                # ADD: increment each tag count by 1 (or initialise at 1)
                for tag in tags:
                    current_tags[tag] = current_tags.get(tag, 0) + 1
            else:
                # REMOVE: delete tag if present, ignore if absent (per spec)
                for tag in tags:
                    current_tags.pop(tag, None)

            update_file_tags(sha, user_id, current_tags)
            updated.append(url)

        except Exception as e:
            errors.append({"url": url, "error": str(e)})

    return jsonify({
        "updated":   updated,
        "not_found": not_found,
        "errors":    errors,
    }), 200
