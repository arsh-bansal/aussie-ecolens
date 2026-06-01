# Frontend ↔ API mapping

**Owner:** P1 (Adam). **Updated:** 2026-06-01.
**Companion to:** `docs/api.md` (the agreed contract), `docs/auth-contract.md`.

This maps what the Next.js frontend (`frontend/src/lib/api.ts`) actually calls
against (a) the agreed contract in `docs/api.md` and (b) what the infra template
(`infra/aws/infrastructure.yaml`) now implements.

TL;DR: **Auth is compatible. CORS is fixed (needs redeploy). The upload
endpoint now matches the contract — `POST /uploads/presign` is implemented,
including the dedup check and a seed metadata record (see §4). It needs the
DynamoDB table to exist before it can be deployed/tested end to end.**

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
| `api.presign()` | `POST /uploads/presign` | ✅ yes | ✅ implemented (dedup + seed record) | 🟢 **resolved — see §4** |
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

## 4. Upload endpoint — now matches the contract ✅

Previously the Lambda was `GET /uploads/check` (query params, read-only). It is
now `POST /uploads/presign`, reading a JSON body and returning the contract
shape. The route, the Lambda body, and the IAM role were all updated in
`infra/aws/infrastructure.yaml`.

| | Now implemented: `POST /uploads/presign` |
|---|---|
| Method | `POST` (JWT, Cognito authorizer) |
| Input | JSON body: `sha256`, `filename`, `mime_type`, `size_bytes` |
| New-file resp | `{ duplicate:false, upload_url, file_id, expires_in }` |
| Dup resp | `{ duplicate:true, file_id, existing_url, tags }` |
| Errors | `{ "error": { "code", "message" } }` per `docs/api.md` |

This matches `PresignRequest`/`PresignResponse` in `frontend/src/types/index.ts`
exactly, so `api.presign()` works without frontend changes.

### What the Lambda now does (two writes coordinated with P2's tagger)

1. **Dedup check** — `GetItem` on `FILE#<sha256>/METADATA`. If present, returns
   `{duplicate:true, existing_url, tags}` and skips re-upload/re-tag.
2. **Presigned PUT** — issues the 5-min direct-to-S3 URL.
3. **Seed metadata record** — `PutItem` of `FILE#<sha256>/METADATA` with
   `owner_sub`, `mime_type`, `original_filename`, `size_bytes`, `s3_key`,
   `s3_url`, `file_type`, `status: pending`, `uploaded_at`, and the `gsi2`
   owner-index keys. Guarded by `attribute_not_exists(pk)` so it is idempotent
   and **never overwrites** an existing record.

**Coordination with the tagger (P2 / Arsh):** presign seeds the record; the
tagger must use `update_item` (merge) to add only its own fields (`tags`,
`thumbnail_url`, `thumbnail_s3_key`, `file_type`, `status`, `tagged_at`). Because
presign uses condition-guarded `put_item` and the tagger uses `update_item`, the
two writes never clobber each other regardless of ordering. (Confirmed with Arsh
2026-06-01.)

### Why this also fixes dedup

The dedup check reads the same `FILE#<sha>/METADATA` item that the seed-write
creates. Before this change nothing wrote that item, so a second upload of the
same file could never be detected. The seed-write closes that loop.

### Dependency / not-yet-testable

The Lambda is gated on `DDB_TABLE`: with no table set it skips both the dedup
read and the seed write (treats every file as new, writes nothing) and still
returns a working presigned URL. So **dedup + metadata only function once P3's
DynamoDB table exists** and the infra stack is redeployed with
`DynamoTableName=<table>`. Until then this is implemented but unverified
end to end.

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
