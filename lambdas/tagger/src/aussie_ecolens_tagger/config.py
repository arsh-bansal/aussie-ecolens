"""Typed environment configuration for the Tagger Lambda.

Configuration values are sourced from environment variables (Lambda
config -> CloudFormation/SAM -> AWS Console) and validated at cold
start. Any missing or malformed value raises ConfigurationError before
the handler ever sees an event, so misconfiguration surfaces as a
loud cold-start failure rather than a subtle runtime bug.

Local development reads from .env in the package directory; production
relies on Lambda environment variables. The same TaggerSettings class
serves both, with .env taking effect only if the file exists.

Usage:
    from aussie_ecolens_tagger.config import settings
    bucket = settings.uploads_bucket

settings is a cached module-level instance; do not re-instantiate.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from aussie_ecolens_tagger.exceptions import ConfigurationError


class TaggerSettings(BaseSettings):
    """All environment configuration for the Tagger Lambda.

    Field names map to UPPER_SNAKE environment variables. For example,
    aws_region is sourced from the AWS_REGION env var. The
    SettingsConfigDict below enables case-insensitive matching so both
    AWS_REGION and aws_region work.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # AWS region used for all SDK clients (S3, DynamoDB, SNS).
    # Defaults to ap-southeast-2 (Sydney) per project setup docs.
    aws_region: str = Field(default="ap-southeast-2", description="AWS region for SDK clients")

    # S3 buckets owned by the write path.
    uploads_bucket: str = Field(default="aussie-ecolens-uploads", description="Source media bucket")
    thumbnails_bucket: str = Field(default="aussie-ecolens-thumbnails", description="Thumbnail bucket")
    frames_bucket: str = Field(default="aussie-ecolens-frames", description="Video frames bucket")
    models_bucket: str = Field(default="aussie-ecolens-models", description="Versioned model registry bucket")

    # DynamoDB system-of-record table for file/tag records.
    files_table: str = Field(default="aussie-ecolens-files", description="DynamoDB single-table store")

    # Model file paths. In Lambda these resolve under /tmp after lazy
    # download from S3 on cold start. Locally they resolve under the
    # repo-level models/ directory.
    megadetector_path: Path = Field(
        default=Path("/tmp/models/mdv5a.pt"),
        description="On-disk path to MegaDetector v5a .pt file",
    )
    speciesnet_path: Path = Field(
        default=Path("/tmp/models/model.pt"),
        description="On-disk path to fine-tuned SpeciesNet .pt file",
    )

    # Model versions, used to construct S3 prefix
    # (s3://<models_bucket>/<name>/<version>/...).
    megadetector_version: str = Field(default="v5a", description="MegaDetector model version")
    speciesnet_version: str = Field(default="v1", description="SpeciesNet model version")

    # S3 object keys for the model files inside models_bucket. Kept as
    # explicit, overridable settings (not hardcoded in the handler) so a
    # new model can be deployed by uploading to S3 and updating an env
    # var — no code change or image rebuild required (assignment §4.1).
    megadetector_s3_key: str = Field(
        default="megadetector/v5a/mdv5a.pt",
        description="S3 key of the MegaDetector .pt within models_bucket",
    )
    speciesnet_s3_key: str = Field(
        default="speciesnet/v1/model.pt",
        description="S3 key of the SpeciesNet .pt within models_bucket",
    )

    # When true, download model files from S3 to the local model paths on
    # cold start. True in Lambda (models live in S3); set false locally
    # where models are mounted/present on disk already.
    load_models_from_s3: bool = Field(
        default=False,
        description="Download models from S3 on cold start (Lambda=true, local=false)",
    )

    # Inference thresholds.
    # detection_threshold mirrors LOWER_CONF in the reference config.yaml.
    # species_threshold is our own product-level threshold (only tags
    # above this confidence get persisted).
    detection_threshold: float = Field(
        default=0.4,
        ge=0.0,
        le=1.0,
        description="Min MegaDetector confidence to keep a detection",
    )
    species_threshold: float = Field(
        default=0.4,
        ge=0.0,
        le=1.0,
        description="Min SpeciesNet confidence to persist a tag",
    )
    snip_size: int = Field(
        default=600,
        ge=64,
        le=2048,
        description="Square pixel size for SpeciesNet input crops",
    )

    max_video_frames: int = Field(
        default=30,
        ge=1,
        le=900,
        description=(
            "Max frames (= seconds, at 1 fps) to tag per video. Bounds runtime "
            "within the Lambda timeout; longer videos are truncated."
        ),
    )

    # Operational flags.
    log_level: str = Field(default="INFO", description="Root structlog level")

    # Operational toggle. When True, DynamoDBService logs the would-be
    # PutItem payload but does not call AWS. Used for local dev and for
    # the period before the DynamoDB table is provisioned.
    dry_run: bool = Field(default=False, description="Skip DynamoDB writes")

    @field_validator("log_level")
    @classmethod
    def _validate_log_level(cls, v: str) -> str:
        """Reject obviously bad log levels at startup, not at first log call."""
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {sorted(allowed)}, got {v!r}")
        return upper


@lru_cache(maxsize=1)
def get_settings() -> TaggerSettings:
    """Return the singleton settings instance.

    Cached because pydantic-settings does light I/O (reading .env) and
    we want one validated config object reused across the warm Lambda
    container, not re-parsed on every invocation.

    Raises:
        ConfigurationError: if the environment fails validation.
    """
    try:
        return TaggerSettings()
    except Exception as e:  # noqa: BLE001 -- intentional broad catch to rewrap
        raise ConfigurationError(f"invalid environment configuration: {e}") from e


# Convenience module-level alias. Importing modules can do:
#     from aussie_ecolens_tagger.config import settings
# without calling get_settings() themselves.
settings = get_settings()
