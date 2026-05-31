# Frontend ↔ API mapping

**Owner:** P1 (Adam). **Updated:** 2026-05-31.
**Companion to:** `docs/api.md` (the agreed contract), `docs/auth-contract.md`.

This maps what the Next.js frontend (`frontend/src/lib/api.ts`) actually calls
against (a) the agreed contract in `docs/api.md` and (b) what is **currently
deployed** on AWS. It exists because the frontend follows the contract, but the
deployed AWS write-path Lambda does **not** yet — so the two need reconciling
before the upload flow works end to end.

TL;DR: **Auth is compatible. CORS is fixed in this commit (needs redeploy).
The one real gap is the AWS upload endpoint: deployed `GET /uploads/check`
≠ contract `POST /uploads/presign`.**

## 1. Auth — ✅ compatible, no change needed

The frontend signs in with Cognito SRP (`amazon-cognito-identity-js`), sends the
**ID token** as `Authorization: Bearer <token>` on every call, and only ever
exposes the ID token (never the access token). That is exactly what the API
Gateway JWT authorizer validates (`aud` = app client ID, `token_use` = `id`) and
what `docs/auth-contract.md` mandates for the Azure side. See the auth-compat
table in the team chat / handoff. Nothing to do here.

## 2. CORS — ✅ fixed in this commit, ⚠️ needs redeploy

The deployed API Gateway and S3 buckets only allowed `http://localhost:5173`
(Vite). The Next.js dev server runs on **`http://localhost:3000`**, so every
browser call (and the direct-to-S3 presigned `PUT`) was being CORS-blocked.

`infra/aws/infrastructure.yaml` now takes a `DevOrigin` **CommaDelimitedList**
(default `http://localhost:3000,http://localhost:5173`) applied to the HTTP API
and both the uploads + thumbnails buckets. Redeploy to apply (requires
`aws login` first — session is currently expired):

```bash
aws cloudformation deploy --region ap-southeast-2 \
  --stack-name aussie-ecolens-infra \
  --template-file infra/aws/infrastructure.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    UserPoolId=ap-southeast-2_1XdbAo4mu \
    UserPoolClientId=50d6nn8afslqudlmd37gssnv6n
```

(`DevOrigin` now has a sensible default, so it no longer needs to be passed.
When P4 ships a public URL, append it: `DevOrigin=http://localhost:3000,https://<prod-host>`.)

## 3. Endpoint mapping

Legend: ✅ matches contract & deployed · 🟡 contract-correct but **not deployed** ·
🔴 deployed shape **differs** from contract/frontend · ⬜ other team's slice.

### AWS write path (Adam's slice — API Gateway)

| Frontend call (`api.ts`) | Method + path | In `docs/api.md`? | Deployed today | Status |
|---|---|---|---|---|
| `api.presign()` | `POST /uploads/presign` | ✅ yes | ❌ only `GET /uploads/check` | 🔴 **mismatch — see §4** |
| `api.modifyTags()` | `POST /tags/modify` | ✅ yes | ❌ not implemented | 🟡 to build |
| `api.deleteFiles()` | `POST /files/delete` | ✅ yes | ❌ not implemented | 🟡 to build |
| `api.subscribe()` | `POST /tags/subscribe` | ✅ yes | ❌ not implemented | 🟡 to build |

> Note: Python handlers for delete / tags / files exist on the
> `feat/azure-query-api` branch (`lambdas/api_handlers/`), but they are **not
> wired into this API Gateway**. Reconcile ownership with the team — either wire
> those in here, or implement them alongside `/uploads/presign`.

### Read path + content search (Rachana's slice — Azure)

| Frontend call | Method + path | In `docs/api.md`? | Status |
|---|---|---|---|
| `api.searchByTags()` | `POST /search/tags` | ✅ yes (Azure) | ⬜ Azure |
| `api.searchBySpecies()` | `POST /search/species` | ✅ yes (Azure) | ⬜ Azure |
| `api.searchByThumbnail()` | `POST /search/by-thumbnail` | ✅ yes (Azure) | ⬜ Azure |
| `api.searchByFile()` | `POST /search/by-file` (multipart) | ✅ yes (Azure, multipart) | ⬜ Azure |

The frontend correctly routes `searchByFile` to `NEXT_PUBLIC_AZURE_API_BASE` as
`multipart/form-data`, matching the Azure variant in `docs/api.md`. (The contract
also lists an AWS-internal `/search/by-file` callback taking `image_b64` — that is
Azure→AWS server-to-server, not called by the browser, so no frontend impact.)

## 4. The real gap: `/uploads/check` (deployed) vs `/uploads/presign` (contract)

The frontend's `api.presign()` and the contract both expect a **POST with a JSON
body**; the deployed Lambda is a **GET reading query-string params**, with a
different response shape.

| | Deployed `GET /uploads/check` | Contract/frontend `POST /uploads/presign` |
|---|---|---|
| Method | `GET` | `POST` |
| Auth | JWT (Cognito authorizer) | JWT (same) |
| Input | query: `hash`, `mime`, `size` | JSON body: `sha256`, `filename`, `mime_type`, `size_bytes` |
| New-file resp | `{ already_uploaded:false, presigned_url, key, bucket, expires_in, content_type }` | `{ duplicate:false, upload_url, file_id, expires_in }` |
| Dup resp | `{ already_uploaded:true, existing_url, thumbnail_url }` | `{ duplicate:true, file_id, existing_url, tags }` |

As-is, `api.presign()` hits a route that doesn't exist (404) — and even if routed,
the field names wouldn't line up.

**Recommended fix (preferred): bring the backend up to the contract.** Add a
`POST /uploads/presign` route + adapt the Lambda to read the JSON body and return
`{duplicate, upload_url, file_id, expires_in}`. The contract (`docs/api.md`) is the
agreed source of truth and the frontend already implements it, so changing the
backend keeps both Azure and frontend aligned and avoids touching the contract.

**Alternative (faster, not recommended): change the frontend** to call
`GET /uploads/check` with query params and remap the response. Rejected because it
diverges from the agreed `docs/api.md` and would need to be undone later.

Either way: it is a **decision + small change**, not a blocker for landing the
frontend. Tracking it here so it isn't forgotten.

## 5. Env vars the frontend reads

Set these in `frontend/.env.local` (see `frontend/.env.local.example`):

| Var | Value |
|---|---|
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `ap-southeast-2_1XdbAo4mu` |
| `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` | `50d6nn8afslqudlmd37gssnv6n` |
| `NEXT_PUBLIC_AWS_API_BASE` | `https://1tj4gsxbke.execute-api.ap-southeast-2.amazonaws.com` (no `/prod`) |
| `NEXT_PUBLIC_AZURE_API_BASE` | from Rachana (P3) |

The committed `.env.local.example` previously pointed at `us-east-1` and a `/prod`
stage — both wrong for this deployment (region is `ap-southeast-2`, stage is
`$default` = no path suffix). Fixed in this commit.
