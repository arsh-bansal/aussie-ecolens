# Cross-cloud auth contract

**Owner:** P1 (Adam). **Implemented by:** Query API (`lambdas/api_handlers/auth.py`).
**Status:** Live. Tested against deployed Cognito on 2026-05-28.

## TL;DR

Every protected API verifies the **same** Cognito JWT that the frontend
obtains at login. No second identity provider, no token exchange. The
query API (Flask on AWS Lambda) trusts Cognito because it verifies the
JWT signature against Cognito's public JWKS endpoint — keys are public,
never shared as secrets.

Early planning assigned this to an Azure Function App. The delivered
system implements the same contract in `lambdas/api_handlers/` on AWS
Lambda, reading user data from Azure Cosmos DB.

## What the frontend sends

Every authenticated API call from the Next.js app includes:

```
Authorization: Bearer <Cognito ID token JWT>
```

The token is the **ID token**, not the access token. The ID token
carries `email`, `given_name`, and `family_name` claims — useful for
SNS subscription endpoints without a separate Cognito API call.

Implemented in `frontend/src/lib/cognito.ts` and attached by
`frontend/src/lib/api.ts` on every request.

## What the API must check

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
7. **`token_use`** — must equal `"id"` when enforced. Return 401 if an
   access token is passed instead.
8. **`exp` (expiry)** — must be in the future, with a small clock-skew
   tolerance (60 seconds is fine). Return 401 if expired.
9. **`nbf` if present** — must be in the past with the same skew.

If all pass, the handler reads `sub`, `email`, etc. from the claims
and proceeds. The Flask middleware sets `request.user_id` (Cognito
`sub`) and `request.user_email`.

## Two layers of validation (query API)

| Layer | Where | Role |
| --- | --- | --- |
| API Gateway JWT authorizer | `lambdas/api_handlers/template.yaml` | Rejects bad tokens at the edge (`aud`, `iss`, `token_use=id`) |
| Flask `@require_auth` | `lambdas/api_handlers/auth.py` | Full RS256 + JWKS verification; injects `request.user_id` |

The upload API (`/uploads/presign`) uses the same Cognito JWT authorizer
on its separate API Gateway in `infra/aws/infrastructure.yaml`.

## Concrete values

| Item | Value |
| --- | --- |
| JWKS URL | `https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_1XdbAo4mu/.well-known/jwks.json` |
| Issuer (`iss` claim) | `https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_1XdbAo4mu` |
| Audience (`aud` claim) | `50d6nn8afslqudlmd37gssnv6n` |
| Token use (`token_use` claim) | `id` |
| Signing algorithm | `RS256` |
| Region | `ap-southeast-2` |

Environment variables on the query API Lambda:

```
COGNITO_USER_POOL_ID=ap-southeast-2_1XdbAo4mu
COGNITO_CLIENT_ID=50d6nn8afslqudlmd37gssnv6n
AWS_REGION=ap-southeast-2
```

## Implementation notes

- **Cache JWKS for at least 1 hour.** Fetching JWKS on every request
  hurts performance. The live implementation caches in module-level
  `_JWKS_CACHE` in `auth.py` for the Lambda instance lifetime.
- **Cognito rotates signing keys** occasionally. The JWKS endpoint can
  return up to 2 active keys. Always look up by `kid` rather than
  assuming a single key.
- **Don't use `decode` without `verify`.** `jwt.get_unverified_header`
  is only used to read `kid` before verification — never trust claims
  from an unverified decode.
- **Return 401, not 403.** A bad or missing token is 401
  (unauthenticated). Reserve 403 for authenticated users denied a
  specific action.

## Live implementation (Flask query API)

Canonical source: `lambdas/api_handlers/auth.py`.

```python
from auth import require_auth

@search_bp.route("/search/species", methods=["POST"])
@require_auth
def search_species():
    user_id = request.user_id   # Cognito sub — Cosmos partition key
    email   = request.user_email
    ...
```

The decorator:
1. Extracts `Bearer` token from `Authorization`
2. Fetches JWKS (cached) from Cognito
3. Verifies RS256 signature, `iss`, `aud`, `exp`
4. Sets `request.user_id` and `request.user_email`
5. Returns `401` JSON on any failure

Library: `PyJWT` (see `lambdas/api_handlers/requirements.txt`).

## Testing

Grab a real ID token for curl tests:

```bash
aws cognito-idp admin-initiate-auth \
  --user-pool-id ap-southeast-2_1XdbAo4mu \
  --client-id 50d6nn8afslqudlmd37gssnv6n \
  --auth-flow ADMIN_USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=test@example.com,PASSWORD=YourPassword123 \
  --region ap-southeast-2 \
  --query AuthenticationResult.IdToken \
  --output text
```

Requires `ALLOW_ADMIN_USER_PASSWORD_AUTH` on the app client (enable
temporarily for testing if needed).

```bash
TOKEN=<id-token-from-above>
QUERY_API=https://<query-api-id>.execute-api.ap-southeast-2.amazonaws.com

curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dingo": null}' \
  "$QUERY_API/search/species"
```

- Valid token → `200` with results
- Missing/invalid token → `401`
- `5xx` → check CloudWatch logs on the query API Lambda

## Changes to this contract

If anyone needs the AWS side to issue tokens differently (extra claims,
different audience, etc.), discuss with P1 (Cognito owner) — don't
change verification logic on one API only. Drift between upload and
query APIs will be hard to debug.

The JWKS URL and issuer string are derived from the User Pool ID.
Re-deploying the auth stack with the same pool ID produces the same
URL/issuer, so this contract survives stack redeploys.
