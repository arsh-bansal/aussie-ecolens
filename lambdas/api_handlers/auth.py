"""
Cognito JWT validation middleware.

Validates the Bearer token in every request and injects the Cognito `sub`
as `request.user_id` for downstream handlers to use as the Cosmos
partition key.

Environment variables:
    COGNITO_USER_POOL_ID  – e.g. ap-southeast-2_XXXXXXXXX
    COGNITO_CLIENT_ID     – your app client ID
    AWS_REGION            – default: ap-southeast-2

Usage in Flask:
    from auth import require_auth
    @app.route("/search")
    @require_auth
    def search():
        uid = request.user_id  # Cognito sub
        ...
"""

import os
import json
import functools
from urllib.request import urlopen

import jwt                          # PyJWT
from jwt.algorithms import RSAAlgorithm
from flask import request, jsonify

_JWKS_CACHE: dict | None = None


def _get_jwks() -> dict:
    global _JWKS_CACHE
    if _JWKS_CACHE:
        return _JWKS_CACHE

    region  = os.environ.get("AWS_REGION", "ap-southeast-2")
    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    url     = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"

    with urlopen(url) as resp:
        _JWKS_CACHE = json.loads(resp.read())
    return _JWKS_CACHE


def _decode_token(token: str) -> dict:
    """Decode + verify a Cognito JWT. Raises jwt.InvalidTokenError on failure."""
    region    = os.environ.get("AWS_REGION", "ap-southeast-2")
    pool_id   = os.environ["COGNITO_USER_POOL_ID"]
    client_id = os.environ["COGNITO_CLIENT_ID"]

    # Pull the kid from the unverified header to find the right public key
    header   = jwt.get_unverified_header(token)
    jwks     = _get_jwks()
    key_data = next((k for k in jwks["keys"] if k["kid"] == header["kid"]), None)
    if key_data is None:
        raise jwt.InvalidTokenError("Unknown kid")

    public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))
    issuer     = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"

    return jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        audience=client_id,
        issuer=issuer,
    )


def require_auth(f):
    """Decorator: validates JWT, sets request.user_id, or returns 401."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header[len("Bearer "):]
        try:
            claims = _decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": f"Invalid token: {e}"}), 401

        # Inject user_id (Cognito sub) onto request for downstream use
        request.user_id = claims["sub"]
        return f(*args, **kwargs)

    return decorated
