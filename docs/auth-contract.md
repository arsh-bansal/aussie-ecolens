# Cross-cloud auth contract

**Owner:** P1 (Adam).
**For:** P3 (Rachana) implementing the Azure Function App side.
**Status:** Live. Tested against deployed Cognito on 2026-05-28.

## TL;DR

Azure verifies the **same** Cognito JWT that AWS issues. No second
identity provider, no token exchange. Azure trusts AWS Cognito because
it verifies the JWT signature against Cognito's public keys (JWKS),
which never need to be shared in secret.

## What the frontend sends

Every Azure Function call from the React app has this header:

```
Authorization: Bearer <Cognito ID token JWT>
```

The token is the `ID token`, **not** the access token. The ID token
carries `email`, `given_name`, and `family_name` claims — useful for
Cosmos lookups without a separate Cognito API call.

## What Azure must check

In this order, fail-closed on any error:

1. **Header present** — return 401 if `Authorization` is missing or
   not `Bearer ...`.
2. **JWT well-formed** — three dot-separated base64url segments. Return
   401 if not.
3. **`kid` (key ID) in header** — pick the matching public key from
   JWKS. Return 401 if no match.
4. **Signature** — RS256 verification against the JWKS key. Return 401
   if invalid.
5. **`iss` (issuer)** — must equal exactly the issuer URL below. Return
   401 if not.
6. **`aud` (audience)** — must equal exactly the App Client ID below.
   Return 401 if not.
7. **`token_use`** — must equal `"id"`. Return 401 if not (rejects
   anyone trying to pass an access token).
8. **`exp` (expiry)** — must be in the future, with a small clock-skew
   tolerance (60 seconds is fine). Return 401 if expired.
9. **`nbf` if present** — must be in the past with the same skew.

If all pass, the Function reads `sub`, `email`, etc. from the claims
and proceeds.

## Concrete values

| Item | Value |
|---|---|
| JWKS URL | `https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_1XdbAo4mu/.well-known/jwks.json` |
| Issuer (`iss` claim) | `https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_1XdbAo4mu` |
| Audience (`aud` claim) | `50d6nn8afslqudlmd37gssnv6n` |
| Token use (`token_use` claim) | `id` |
| Signing algorithm | `RS256` |
| Region | `ap-southeast-2` |

## Implementation notes for the Azure side

- **Cache JWKS for at least 1 hour.** Fetching JWKS on every request
  kills performance and risks rate-limiting from Cognito. Cache in
  memory at function-app cold-start; refresh only if the `kid` from
  the incoming JWT isn't in the cache.
- **Cognito rotates signing keys** occasionally. The JWKS endpoint can
  return up to 2 active keys at once. Always look up by `kid` rather
  than assuming a single key.
- **Don't use `decode` without `verify`.** Some JWT libraries expose a
  `decode_unverified` that returns claims without signature checking.
  Never use it in production — anyone could mint a token. Always
  call the verifying API.
- **Return 401, not 403.** The standard distinction: 401 = "you're not
  authenticated", 403 = "you are, but not allowed to do this". A bad
  token is 401.

## Sample implementation (Python, for Azure Functions)

The library is `PyJWT[crypto]`. Pin to `>=2.8`.

```python
# shared/cognito_auth.py
import os
import time
import logging
from functools import wraps
from typing import Callable
import jwt
from jwt import PyJWKClient
import azure.functions as func

ISSUER = os.environ["COGNITO_ISSUER"]
AUDIENCE = os.environ["COGNITO_AUDIENCE"]
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"

# Cached once per function-app instance; lasts until cold restart.
_jwks_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=3600)


def _unauthorized(reason: str) -> func.HttpResponse:
    logging.info(f"401: {reason}")
    return func.HttpResponse(
        body='{"error":"unauthorized"}',
        status_code=401,
        mimetype="application/json",
    )


def require_cognito(handler: Callable) -> Callable:
    @wraps(handler)
    def wrapper(req: func.HttpRequest) -> func.HttpResponse:
        auth = req.headers.get("authorization") or req.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return _unauthorized("missing bearer")

        token = auth[7:]
        try:
            signing_key = _jwks_client.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=AUDIENCE,
                issuer=ISSUER,
                leeway=60,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        except jwt.ExpiredSignatureError:
            return _unauthorized("expired")
        except jwt.InvalidTokenError as e:
            return _unauthorized(f"invalid: {e}")

        if claims.get("token_use") != "id":
            return _unauthorized("not an id token")

        # Attach claims so the handler can use them
        req.cognito_claims = claims
        return handler(req)

    return wrapper
```

Usage in a Function:

```python
# queries/search_tags/__init__.py
import json
import azure.functions as func
from shared.cognito_auth import require_cognito

@require_cognito
def main(req: func.HttpRequest) -> func.HttpResponse:
    user_sub = req.cognito_claims["sub"]
    body = req.get_json()
    # ... query Cosmos for user_sub's allowed files ...
    return func.HttpResponse(
        body=json.dumps({"sub": user_sub, "results": []}),
        mimetype="application/json",
    )
```

Function App settings (in Bicep or via Azure Portal):

```
COGNITO_ISSUER = https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_1XdbAo4mu
COGNITO_AUDIENCE = 50d6nn8afslqudlmd37gssnv6n
```

## Testing

To grab a real token for testing without going through the UI:

```bash
# After signing up a user via the UI, get an ID token via aws CLI.
# Requires ALLOW_ADMIN_USER_PASSWORD_AUTH enabled on the app client
# (currently disabled — enable temporarily for testing if needed).

aws cognito-idp admin-initiate-auth \
  --user-pool-id ap-southeast-2_1XdbAo4mu \
  --client-id 50d6nn8afslqudlmd37gssnv6n \
  --auth-flow ADMIN_USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=test@example.com,PASSWORD=YourPassword123 \
  --region ap-southeast-2 \
  --query AuthenticationResult.IdToken \
  --output text
```

Then `curl -H "Authorization: Bearer $TOKEN" https://<azure-func-url>/...`.

If the token is good, the function returns 2xx. If bad, 401. If you
get 5xx, the verification code itself is broken — check the function
logs in Application Insights.

## Changes to this contract

If anyone needs the AWS side to issue tokens differently (extra claims,
different audience, etc.), open it as a discussion with P1 — don't
change Azure to compensate. Drift between the two sides will be hard
to debug.

The JWKS URL and issuer string above are derived from the User Pool
ID. Re-deploying the auth stack with the same name produces the same
URL/issuer, so this contract survives stack redeploys.
