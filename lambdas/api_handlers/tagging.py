"""
tagging.py — stub for /query-file ML inference.

Per team design: Rachana's query API does NOT load the models directly
(~470MB, 3GB RAM, 30s cold starts). Instead, /query-file invokes Arsh's
tag-only Lambda (sync) with the image bytes and gets back {species: count}.

This module wraps that invocation. Replace TAGGER_LAMBDA_NAME env var
with the deployed Lambda name once Arsh exposes it.

Interface agreed with Arsh:
  Input:  image bytes (or temp file path)
  Output: {"koala": 2, "wombat": 1}  — common names, count map
"""

import os
import json
import base64
import boto3

_lambda_client = None

TAGGER_LAMBDA_NAME = os.environ.get("TAGGER_LAMBDA_NAME", "")


def _get_lambda_client():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client(
            "lambda",
            region_name=os.environ.get("AWS_REGION", "ap-southeast-2")
        )
    return _lambda_client


def _invoke_tagger(image_bytes: bytes) -> dict[str, int]:
    """
    Invoke Arsh's tag-only Lambda with image bytes.
    Returns common-name tag map e.g. {"koala": 2}.
    Raises RuntimeError if TAGGER_LAMBDA_NAME is not set yet.
    """
    if not TAGGER_LAMBDA_NAME:
        raise RuntimeError(
            "TAGGER_LAMBDA_NAME env var not set — "
            "waiting on Arsh to deploy the tag-only Lambda entry point (2.2.3 integration)"
        )

    payload = {"image": base64.b64encode(image_bytes).decode("utf-8")}
    response = _get_lambda_client().invoke(
        FunctionName=TAGGER_LAMBDA_NAME,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode(),
    )
    result = json.loads(response["Payload"].read())
    # Arsh's Lambda returns {"tags": {"koala": 2, ...}} or {"error": "..."}
    if "error" in result:
        raise RuntimeError(f"Tagger Lambda error: {result['error']}")
    return result.get("tags", {})


def tag_image_file(image_path: str) -> dict[str, int]:
    """Tag an image file. Calls Arsh's tag-only Lambda."""
    with open(image_path, "rb") as f:
        return _invoke_tagger(f.read())


def tag_video_file(video_path: str) -> dict[str, int]:
    """
    Tag a video file. Sends to Arsh's Lambda which handles
    frame extraction (1 frame/sec) internally.
    """
    with open(video_path, "rb") as f:
        return _invoke_tagger(f.read())
