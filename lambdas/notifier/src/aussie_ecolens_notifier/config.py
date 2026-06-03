"""Configuration for the Notifier Lambda, via pydantic-settings.

Every value is sourced from an environment variable (set by the SAM
template) with a sensible default for local development. Field names map
to UPPER_SNAKE_CASE env vars (case-insensitive); there is no prefix.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class NotifierSettings(BaseSettings):
    """Runtime settings for the Notifier Lambda.

    Attributes:
        aws_region: Region for SDK clients. In Lambda this is read from
            the runtime-provided AWS_REGION (reserved) automatically.
        topic_arn: ARN of the SNS topic to publish tag notifications to.
        species_attribute: MessageAttribute name carrying the species, on
            which SNS subscription filter policies match. Kept configurable
            so the attribute key stays in lockstep with whatever the
            subscribe step uses.
        min_count: Only notify for a species whose count in the file is at
            least this value. Defaults to 1 (any detection notifies).
        log_level: Logging verbosity (DEBUG, INFO, WARNING, ERROR).
        dry_run: If true, log the SNS publish payloads but do not call AWS.
    """

    aws_region: str = Field(default="ap-southeast-2", description="AWS region for SDK clients")
    topic_arn: str = Field(default="", description="SNS topic ARN for tag notifications")
    species_attribute: str = Field(
        default="species",
        description="SNS MessageAttribute name used for filter-policy matching",
    )
    min_count: int = Field(default=1, ge=1, description="Minimum species count to notify on")
    log_level: str = Field(default="INFO", description="Logging level")
    dry_run: bool = Field(default=False, description="Log SNS payloads without publishing")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = NotifierSettings()
