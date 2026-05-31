"""Event-shape normalization for the Thumbnail Lambda.

Identical strategy to the tagger handler: accept both the EventBridge
"Object Created" shape (bucket/key under ``detail``) and the legacy S3
notification shape (a ``Records`` array). The thumbnail Lambda is triggered
by an EventBridge rule filtered to image suffixes, but accepting both shapes
keeps it robust to the trigger mechanism and trivially unit-testable.
"""

from __future__ import annotations

import urllib.parse
from typing import Any

from aussie_ecolens_thumbnail.logging import get_logger

log = get_logger(__name__)


def extract_bucket_keys(event: dict[str, Any]) -> list[tuple[str, str]]:
    """Normalize either supported event shape into (bucket, key) pairs.

    Keys are url-decoded (S3 encodes spaces/plus signs). Malformed entries are
    logged and skipped rather than aborting the whole invocation.
    """
    pairs: list[tuple[str, str]] = []

    # EventBridge shape: a single object-created event with a "detail" object.
    if "detail" in event and "Records" not in event:
        try:
            detail = event["detail"]
            bucket = detail["bucket"]["name"]
            key = urllib.parse.unquote_plus(detail["object"]["key"])
            pairs.append((bucket, key))
        except (KeyError, TypeError) as e:
            log.error("malformed eventbridge event", error=str(e))
        return pairs

    # S3-notification shape: a "Records" array of s3 envelopes.
    for record in event.get("Records", []):
        try:
            s3 = record["s3"]
            bucket = s3["bucket"]["name"]
            key = urllib.parse.unquote_plus(s3["object"]["key"])
            pairs.append((bucket, key))
        except (KeyError, TypeError) as e:
            log.error("malformed s3 record", error=str(e))
            continue

    return pairs
