"""
POST /tags/modify — bulk add/remove tags (2.3.1)
Body: {"urls": [...], "tags": [...], "operation": 0|1}
Response: {"updated": <count>, "failed": [<urls>], "records": [{file_id, tags}]}

CQRS: reads the current tag map from Cosmos (read model), computes the new map,
writes to DynamoDB (system of record), then updates Cosmos immediately so Search
does not wait on the Replicator stream (~1-2s lag).
"""

from flask import Blueprint, request, jsonify
from auth import require_auth
from cosmos_client import get_file_by_sha_global, update_file_tags_cosmos
from dynamodb_client import update_file_tags
from species_catalog import normalize_tag_key

tags_bp = Blueprint("tags", __name__)


def _sha_from_url(url: str) -> str | None:
    """Extract the file checksum from an s3:// URI or presigned https URL."""
    try:
        path = url.split("?")[0].split("://", 1)[-1]
        key = path.split("/", 1)[1]
        filename = key.rsplit("/", 1)[-1]
        return filename.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return None


def _apply_tag_changes(current_tags: dict, tags: list[str], operation: int) -> dict:
    updated = dict(current_tags)
    if operation == 1:
        for tag in tags:
            key = normalize_tag_key(tag)
            if key:
                updated[key] = updated.get(key, 0) + 1
    else:
        for tag in tags:
            key = normalize_tag_key(tag)
            if not key:
                continue
            for existing in list(updated.keys()):
                if normalize_tag_key(existing) == key:
                    updated.pop(existing, None)
    return updated


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

    updated = []
    failed  = []
    records = []

    for url in urls:
        sha = _sha_from_url(url)
        if sha is None:
            failed.append(url)
            continue

        try:
            doc = get_file_by_sha_global(sha)
            if doc is None:
                failed.append(url)
                continue

            new_tags = _apply_tag_changes(dict(doc.get("tags", {})), tags, operation)

            if update_file_tags(sha, new_tags):
                update_file_tags_cosmos(sha, doc["user_id"], new_tags)
                updated.append(url)
                records.append({"file_id": sha, "tags": new_tags})
            else:
                failed.append(url)

        except Exception:
            failed.append(url)

    return jsonify({"updated": len(updated), "failed": failed, "records": records}), 200
