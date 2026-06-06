"""
Convert canonical s3:// URIs (as stored by the tagger/thumbnailer) into
short-lived presigned HTTPS GET URLs so a browser can load them directly.

Why: the DB stores s3://bucket/key references (the right canonical form), but a
browser can't fetch s3:// — and the buckets are private (by design, for access
control). Presigning yields a temporary https URL the browser CAN load, while
the bucket stays private. URLs expire after PRESIGN_TTL seconds.
"""

import os
import boto3
from urllib.parse import urlparse

# Sign in the bucket's region (presigned-URL signatures are region-specific).
_REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
_s3 = boto3.client("s3", region_name=_REGION)

# How long a presigned link stays valid (seconds). 1 hour is plenty for viewing.
PRESIGN_TTL = int(os.environ.get("PRESIGN_TTL", "3600"))


def canonical_s3_uri(url: str | None) -> str | None:
    """Normalise s3:// or presigned https S3 URLs to canonical s3://bucket/key.

    Cosmos stores canonical s3:// URIs; users paste presigned https links from
    search results. Used by /search/by-thumbnail before DB lookup.
    """
    if not url:
        return None
    raw = url.strip()
    if raw.startswith("s3://"):
        return raw
    if not raw.startswith(("https://", "http://")):
        return None
    try:
        parsed = urlparse(raw.split("?", 1)[0])
        host = parsed.netloc
        key = parsed.path.lstrip("/")
        if not host or not key:
            return None
        # bucket.s3.ap-southeast-2.amazonaws.com/key
        if ".s3." in host and host.endswith(".amazonaws.com"):
            bucket = host.split(".s3.", 1)[0]
            return f"s3://{bucket}/{key}"
        # s3.ap-southeast-2.amazonaws.com/bucket/key
        if host.startswith("s3.") and ".amazonaws.com" in host:
            parts = key.split("/", 1)
            if len(parts) == 2:
                return f"s3://{parts[0]}/{parts[1]}"
    except Exception:
        return None
    return None


def presign_s3_uri(uri: str | None, expires: int = PRESIGN_TTL) -> str | None:
    """
    s3://bucket/key  ->  https://...?X-Amz-Signature=...  (temporary, signed)

    Returns the input unchanged if it's empty or not an s3:// URI (so already-
    https values or None pass through safely). Never raises on a single bad
    URI — returns the original so one broken record can't fail the whole search.
    """
    if not uri or not uri.startswith("s3://"):
        return uri
    try:
        parsed = urlparse(uri)
        bucket = parsed.netloc
        key = parsed.path.lstrip("/")
        if not bucket or not key:
            return uri
        return _s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires,
        )
    except Exception:
        return uri
