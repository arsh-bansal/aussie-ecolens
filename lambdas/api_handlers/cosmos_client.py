"""
Cosmos DB client — thin wrapper around azure-cosmos SDK.

All queries use the /user_id partition key so they stay single-partition
(fast, low RU). The one cross-partition query (find by thumbnail_url) is
explicitly flagged.

Environment variables (set via Lambda env or .env for local dev):
    COSMOS_ENDPOINT    – documentEndpoint from `az cosmosdb show`
    COSMOS_KEY         – primaryMasterKey from `az cosmosdb keys list`
    COSMOS_DATABASE    – default: aussie-ecolens
    COSMOS_CONTAINER   – default: files
"""

import os

from azure.cosmos import CosmosClient, exceptions

from species_catalog import normalize_tag_key

_client: CosmosClient | None = None
_container = None


def _get_container():
    global _client, _container
    if _container is not None:
        return _container

    endpoint = os.environ["COSMOS_ENDPOINT"]
    key = os.environ["COSMOS_KEY"]
    db_name = os.environ.get("COSMOS_DATABASE", "aussie-ecolens")
    ctr_name = os.environ.get("COSMOS_CONTAINER", "files")

    _client = CosmosClient(endpoint, credential=key)
    db = _client.get_database_client(db_name)
    _container = db.get_container_client(ctr_name)
    return _container


def _safe_species(name: str) -> str:
    """Resolve to the canonical tag key, then escape for Cosmos interpolation.

    Stored tag keys are the Tagger's canonical common names (e.g. "Red Fox",
    "Short-beaked Echidna"). User input is case-noisy and may use synonyms, so
    we first resolve it to the exact canonical name via the species catalog;
    unrecognised input is passed through unchanged so the query simply matches
    nothing instead of erroring.

    Cosmos SQL cannot parameterize a property *path* (only values), so the
    species key is interpolated. We escape backslashes and double-quotes so a
    name containing those characters can't break out of the c.tags["..."]
    accessor or alter the query. Counts are always passed as real parameters.
    """
    canonical = normalize_tag_key(name)
    return canonical.replace("\\", "\\\\").replace('"', '\\"')


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------


def get_file_by_sha(sha: str, user_id: str) -> dict | None:
    """Point-read a single document by sha + user_id (cheapest Cosmos read)."""
    ctr = _get_container()
    try:
        return ctr.read_item(item=sha, partition_key=user_id)
    except exceptions.CosmosResourceNotFoundError:
        return None


def get_file_by_sha_global(sha: str) -> dict | None:
    """Cross-partition lookup by document id (shared observatory)."""
    ctr = _get_container()
    query = "SELECT * FROM c WHERE c.id = @sha"
    params = [{"name": "@sha", "value": sha}]
    results = list(
        ctr.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True,
        )
    )
    return results[0] if results else None


def list_all_files() -> list[dict]:
    """Return every file in the observatory (shared global catalogue)."""
    ctr = _get_container()
    return list(
        ctr.query_items(
            query="SELECT * FROM c",
            enable_cross_partition_query=True,
        )
    )


def _append_tag_clauses(
    tag_filters: dict[str, int] | None,
    species_presence: list[str] | None,
    where_clauses: list[str],
    params: list[dict],
) -> None:
    """Append tag/species WHERE clauses (shared by global + per-user queries).

    tag_filters:      {"Koala": 3, "Common Wombat": 1} → AND of c.tags["X"] >= N
    species_presence: ["Dingo"]                         → IS_DEFINED(c.tags["X"])

    Species keys are resolved to canonical names and escaped via _safe_species.
    Counts are bound as real parameters (only the property path is interpolated).
    """
    if tag_filters:
        for i, (species, count) in enumerate(tag_filters.items()):
            param_name = f"@count_{i}"
            where_clauses.append(f'c.tags["{_safe_species(species)}"] >= {param_name}')
            params.append({"name": param_name, "value": count})

    if species_presence:
        for species in species_presence:
            where_clauses.append(f'IS_DEFINED(c.tags["{_safe_species(species)}"])')


def query_files(
    tag_filters: dict[str, int] | None = None,
    species_presence: list[str] | None = None,
) -> list[dict]:
    """Global tag/species search across ALL users' files (shared observatory).

    The platform is a shared library (assignment 4.3): tag/species queries return
    every matching file in the database regardless of uploader, so this is a
    cross-partition query. Data volume is small, so the RU cost is acceptable;
    the tradeoff is documented here rather than assumed. Results satisfy ALL
    conditions (logical AND). Read-only — owner-scoped mutations (delete, tag
    edit) deliberately stay per-user via query_user_files.
    """
    ctr = _get_container()

    params: list[dict] = []
    where_clauses: list[str] = []
    _append_tag_clauses(tag_filters, species_presence, where_clauses, params)

    where = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    query = "SELECT * FROM c" + where
    return list(
        ctr.query_items(
            query=query, parameters=params, enable_cross_partition_query=True
        )
    )


def query_user_files(
    user_id: str,
    tag_filters: dict[str, int] | None = None,
    species_presence: list[str] | None = None,
) -> list[dict]:
    """Single-partition query scoped to one user's files.

    Used by owner-scoped operations (bulk delete / list) where least privilege
    means a user only ever touches their own records. Tag/species *search* uses
    the global query_files instead.
    """
    ctr = _get_container()

    params: list[dict] = [{"name": "@uid", "value": user_id}]
    where_clauses = ["c.user_id = @uid"]
    _append_tag_clauses(tag_filters, species_presence, where_clauses, params)

    query = "SELECT * FROM c WHERE " + " AND ".join(where_clauses)
    return list(ctr.query_items(query=query, parameters=params, partition_key=user_id))


def get_file_by_thumbnail_url(thumbnail_url: str) -> dict | None:
    """
    Find a document by thumbnail_url.
    Cross-partition query (thumbnail_url is not the partition key), but it's a
    rare operation (flagged as such in the data model). Value is parameterized.
    """
    ctr = _get_container()
    query = "SELECT * FROM c WHERE c.thumbnail_url = @thumb"
    params = [{"name": "@thumb", "value": thumbnail_url}]
    results = list(
        ctr.query_items(
            query=query, parameters=params, enable_cross_partition_query=True
        )
    )
    return results[0] if results else None


# ---------------------------------------------------------------------------
# Write helpers (used by bulk-tag and delete — NOT upload, that's Replicator)
# ---------------------------------------------------------------------------


def update_file_tags_cosmos(sha: str, user_id: str, new_tags: dict[str, int]) -> dict | None:
    """Replace the tags map on a Cosmos document (owner partition)."""
    from datetime import datetime, timezone

    ctr = _get_container()
    item = get_file_by_sha(sha, user_id)
    if item is None:
        return None

    item["tags"] = new_tags
    item["updated_at"] = datetime.now(timezone.utc).isoformat()
    return ctr.replace_item(item=sha, body=item)


def delete_file_record_cosmos(sha: str, user_id: str) -> bool:
    """Delete the Cosmos document. Returns True if deleted, False if not found."""
    ctr = _get_container()
    try:
        ctr.delete_item(item=sha, partition_key=user_id)
        return True
    except exceptions.CosmosResourceNotFoundError:
        return False


def list_user_files(user_id: str) -> list[dict]:
    """Return all documents for a user (used by bulk-delete)."""
    return query_user_files(user_id)
