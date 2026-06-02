"""
POST /tags/modify — renamed from POST /tags
Body: {"urls": [...], "tags": [...], "operation": 0|1}
Response: {"updated": <count>, "failed": [<urls>]}
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha, update_file_tags

tags_bp = Blueprint("tags", __name__)


def _sha_from_url(s3_url: str) -> str | None:
    try:
        path     = s3_url.split("://", 1)[-1]
        key      = path.split("/", 1)[1]
        filename = key.rsplit("/", 1)[-1]
        return filename.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return None


@tags_bp.route("/tags/modify", methods=["POST"])
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

    user_id = request.user_id
    updated = []
    failed  = []

    for url in urls:
        sha = _sha_from_url(url)
        if sha is None:
            failed.append(url)
            continue

        try:
            doc = get_file_by_sha(sha, user_id)
            if doc is None:
                failed.append(url)
                continue

            current_tags: dict = dict(doc.get("tags", {}))

            if operation == 1:
                for tag in tags:
                    current_tags[tag] = current_tags.get(tag, 0) + 1
            else:
                for tag in tags:
                    current_tags.pop(tag, None)

            update_file_tags(sha, user_id, current_tags)
            updated.append(url)

        except Exception:
            failed.append(url)

    return jsonify({"updated": len(updated), "failed": failed}), 200
