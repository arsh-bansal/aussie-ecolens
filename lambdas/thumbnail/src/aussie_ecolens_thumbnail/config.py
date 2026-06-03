"""Configuration for the Thumbnail Lambda, via pydantic-settings.

Every value is sourced from an environment variable (set by the SAM
template) with a sensible default for local development. Field names map
to UPPER_SNAKE_CASE env vars (case-insensitive); there is no prefix.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ThumbnailSettings(BaseSettings):
    """Runtime settings for the Thumbnail Lambda.

    Attributes:
        aws_region: Region for SDK clients. In Lambda this is read from the
            runtime-provided AWS_REGION (reserved) automatically.
        thumbnails_bucket: Bucket where generated thumbnails are stored. The
            key is deterministic (``<sha>.jpg``) so the tagger/query layer can
            derive a thumbnail's URL from the file's checksum without a DB read.
        max_edge: Longest-edge size (px) of the thumbnail. Aspect ratio is
            preserved; the image is scaled so its longest side equals this.
        jpeg_quality: JPEG quality (1-95) for compression. 80 is a good size/
            quality trade-off for previews.
        log_level: Logging verbosity (DEBUG, INFO, WARNING, ERROR).
        dry_run: If true, do the resize but skip the S3 upload (local testing).
    """

    aws_region: str = Field(
        default="ap-southeast-2", description="AWS region for SDK clients"
    )
    thumbnails_bucket: str = Field(
        default="", description="S3 bucket for generated thumbnails"
    )
    max_edge: int = Field(
        default=320, ge=16, le=2048, description="Longest-edge size of the thumbnail (px)"
    )
    jpeg_quality: int = Field(
        default=80, ge=1, le=95, description="JPEG compression quality"
    )
    log_level: str = Field(default="INFO", description="Logging level")
    dry_run: bool = Field(
        default=False, description="Resize but skip the S3 upload"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = ThumbnailSettings()
