"""Configuration for the Replicator Lambda, via pydantic-settings.

Cosmos connection details are sourced from environment variables set by the
SAM template (which in turn reads them from a secret / stack parameter).
Field names map to UPPER_SNAKE_CASE env vars; no prefix.

NOTE (pending Rachana / Azure setup): the Cosmos endpoint, key, database
and container names below are placeholders. Confirm them against the actual
Cosmos account once provisioned. The Lambda fails fast at cold start if
they are unset and dry_run is false, so a misconfigured deploy is loud, not
silent.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ReplicatorSettings(BaseSettings):
    """Runtime settings for the Replicator Lambda."""

    aws_region: str = Field(default="ap-southeast-2", description="AWS region for SDK clients")

    # --- Cosmos DB target (Azure read side) ---
    cosmos_endpoint: str = Field(default="", description="Cosmos DB account URI")
    cosmos_key: str = Field(default="", description="Cosmos DB account key (secret)")
    cosmos_database: str = Field(default="aussie-ecolens", description="Cosmos database name")
    cosmos_container: str = Field(default="files", description="Cosmos container name")
    cosmos_partition_key_path: str = Field(
        default="/user_id",
        description="Container partition key path (must match the container's definition)",
    )

    log_level: str = Field(default="INFO", description="Logging level")
    dry_run: bool = Field(
        default=False,
        description="Log replication ops without writing to Cosmos (local/testing)",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = ReplicatorSettings()
