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


_client: CosmosClient | None = None
_container = None


def _get_container():
    global _client, _container
    if _container is not None:
        return _container

    endpoint = os.environ["COSMOS_ENDPOINT"]
    key      = os.environ["COSMOS_KEY"]
    db_name  = os.environ.get("COSMOS_DATABASE",  "aussie-ecolens")
    ctr_name = os.environ.get("COSMOS_CONTAINER", "files")

    _client    = CosmosClient(endpoint, credential=key)
    db         = _client.get_database_client(db_name)
    _container = db.get_container_client(ctr_name)
    return _container


def _safe_species(name: str) -> str:
    """Escape a species name for safe interpolation into a Cosmos property path.

    Cosmos SQL cannot parameterize a property *path* (only values), so the
    species key is interpolated. We escape backslashes and double-quotes so a
    name containing those characters can't break out of the c.tags["..."]
    accessor or alter the query. Counts are always passed as real parameters.
    """
    return name.replace("\\", "\\\\").replace('"', '\\"')


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


def query_user_files(
    user_id: str,
    tag_filters: dict[str, int] | None = None,
    species_presence: list[str] | None = None,
) -> list[dict]:
    """
    Query files for a user, optionally filtered by tags.

    tag_filters:      {"koala": 3, "wombat": 1}  → AND of c.tags.X >= N
    species_presence: ["dingo"]                   → IS_DEFINED(c.tags.dingo)

    Both can be combined; results satisfy ALL conditions (logical AND).
    """
    ctr = _get_container()

    params: list[dict] = [{"name": "@uid", "value": user_id}]
    where_clauses = ["c.user_id = @uid"]

    # Count-based filters: c.tags["X"] >= N  (minimum counts, ANDed together)
    if tag_filters:
        for i, (species, count) in enumerate(tag_filters.items()):
            param_name = f"@count_{i}"
            where_clauses.append(
                f'c.tags["{_safe_species(species)}"] >= {param_name}'
            )
            params.append({"name": param_name, "value": count})

    # Presence-only filters (>=1, any count)
    if species_presence:
        for species in species_presence:
            where_clauses.append(
                f'IS_DEFINED(c.tags["{_safe_species(species)}"])'
            )

    query = "SELECT * FROM c WHERE " + " AND ".join(where_clauses)
    return list(ctr.query_items(query=query, parameters=params,
                                partition_key=user_id))


def get_file_by_thumbnail_url(thumbnail_url: str) -> dict | None:
    """
    Find a document by thumbnail_url.
    Cross-partition query (thumbnail_url is not the partition key), but it's a
    rare operation (flagged as such in the data model). Value is parameterized.
    """
    ctr = _get_container()
    query = "SELECT * FROM c WHERE c.thumbnail_url = @thumb"
    params = [{"name": "@thumb", "value": thumbnail_url}]
    results = list(ctr.query_items(query=query, parameters=params,
                                   enable_cross_partition_query=True))
    return results[0] if results else None


# ---------------------------------------------------------------------------
# Write helpers (used by bulk-tag and delete — NOT upload, that's Replicator)
# ---------------------------------------------------------------------------

def update_file_tags(sha: str, user_id: str, new_tags: dict[str, int]) -> dict | None:
    """Replace the tags map on a document and bump updated_at."""
    from datetime import datetime, timezone

    ctr  = _get_container()
    item = get_file_by_sha(sha, user_id)
    if item is None:
        return None

    item["tags"]       = new_tags
    item["updated_at"] = datetime.now(timezone.utc).isoformat()
    return ctr.replace_item(item=sha, body=item)


def delete_file_record(sha: str, user_id: str) -> bool:
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
    