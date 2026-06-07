# Architecture

## High-level

Aussie EcoLens is a multi-cloud serverless platform built on AWS and Azure, following a CQRS (Command Query Responsibility Segregation) pattern.

- **AWS** owns the **write path**: ingestion, ML inference, and the system of record for tag data.
- **Azure** owns the **read model**: Cosmos DB holds a replicated copy of file/tag records for fast queries.
- **Query API** runs on **AWS** (Flask Lambda + API Gateway) but reads from Azure Cosmos DB.

A single identity provider — AWS Cognito — issues JWTs that every API verifies. There is no second user store.

## Component map

### AWS

| Service | Purpose |
| --- | --- |
| Cognito User Pool | Authentication, JWT issuer, JWKS endpoint |
| S3 (uploads) | Receives original media via presigned PUT |
| S3 (thumbnails) | Stores generated thumbnails (`<sha256>.jpg`) |
| S3 (models) | Versioned model registry (`megadetector/v5a/...`, `speciesnet/v1/...`) |
| Lambda: thumbnail | Image-only. Resizes with OpenCV, uploads deterministic thumbnail key |
| Lambda: tagger (container) | MegaDetector + SpeciesNet for images; video mode extracts 1 fps frames in-process, tags each, aggregates counts |
| Lambda: query-tagger | Sync-invoked tag-only handler for search-by-file (no DB write) |
| Lambda: replicator | DynamoDB Streams consumer that writes tag records to Azure Cosmos DB |
| Lambda: notifier | DynamoDB Streams consumer that publishes new-tag events to SNS |
| Lambda: api_handlers | Flask query API — search, modify, delete, subscribe, list, status |
| Lambda: uploads/presign | Dedup check, metadata seed, presigned PUT URL (infra stack) |
| API Gateway (×2) | Upload API (`/uploads/presign`) and Query API (all search/mutation routes) |
| DynamoDB | Single-table design: file metadata, tags, checksums, thumbnail URL |
| SNS | One topic with per-species filter policies; users subscribe by email |

### Azure

| Service | Purpose |
| --- | --- |
| Cosmos DB (serverless, SQL API) | Read model; indexed for tag-based lookups |
| Static Web Apps | Production frontend hosting (GitHub Actions deploy) |

> **Note:** Early planning placed the query API in an Azure Function App (`azure_functions/`). The delivered system implements the same REST contract in `lambdas/api_handlers/` on AWS Lambda instead. Azure provides the read **database** and frontend **hosting**, not the query compute layer.

## The pipeline

### Image upload

1. Frontend authenticates via Cognito (SRP) and obtains an ID token.
2. Frontend computes file SHA-256 client-side and calls `POST /uploads/presign` with the hash, MIME type, and size.
3. Presign Lambda checks DynamoDB for an existing record with the same checksum (dedup). If duplicate, returns the existing file URL without a new upload.
4. If new, frontend PUTs the file to `s3://…-uploads/<user_sub>/<sha256>.<ext>` using the presigned URL.
5. S3 ObjectCreated (via EventBridge) triggers the Thumbnail Lambda and Tagger Lambda in parallel.
6. Thumbnail Lambda writes `<sha256>.jpg` to the thumbnails bucket (deterministic key; tagger derives the same URL).
7. Tagger Lambda runs MegaDetector → crops detections → SpeciesNet → writes detected species + counts to DynamoDB.
8. DynamoDB Streams → Replicator Lambda writes the same record to Cosmos DB.
9. DynamoDB Streams → Notifier Lambda publishes to SNS with a `species` message attribute per detected tag.

### Video upload

1. Same upload flow as image (steps 1–4).
2. S3 ObjectCreated triggers the Tagger Lambda in **video mode** (`video_handler.py`).
3. Tagger uses ffmpeg to extract 1 frame per second in-process (no separate splitter Lambda).
4. Each frame is classified; species counts are aggregated across frames.
5. One DynamoDB record is written for the video with merged tag counts.
6. Replicator and Notifier fire on that write, same as images.

### Query

The query API is a **Flask app on AWS Lambda** (`lambdas/api_handlers/`), JWT-protected via API Gateway + `@require_auth`. It reads from **Cosmos DB**; mutations write **DynamoDB** first (CQRS-correct), and the replicator updates Cosmos within ~1–2 seconds.

| Method + Path | Purpose |
| --- | --- |
| POST /search/tags | Find files where tag counts meet thresholds (AND logic, e.g. `{"koala": 3}`) |
| POST /search/species | Find files containing given species (presence) |
| POST /search/by-thumbnail | Given a thumbnail URL, return the full-size URL |
| POST /search/by-file | User uploads a query image → staged under `query-temp/` in S3 → sync-invoke query-tagger → search Cosmos → delete temp object |
| POST /tags/modify | Bulk add/remove tags on file URLs (operation: 1=add, 0=remove) |
| POST /files/delete | Bulk delete files from S3 + thumbnails + DynamoDB (+ Cosmos via replication) |
| GET/POST /tags/subscribe | List or create SNS email subscriptions filtered by species |
| GET /files/list | List caller's files (Manage page) |
| GET /files/status/\<sha\> | Poll async tagging status after upload |

The search-by-file flow is the main cross-service call: Query API stages the upload in S3, invokes the **query-tagger** Lambda synchronously, queries Cosmos by returned tags, then deletes the temp S3 key. Tagger and thumbnail Lambdas skip `query-temp/` keys.

## Why CQRS across clouds

- **Latency**: query reads hit Cosmos in Azure; the API Lambda runs close to Cosmos endpoint configuration.
- **Resilience**: read model can be queried independently of write-path processing delays.
- **Assignment requirement**: demonstrates deliberate multi-cloud design (AWS write + Azure data replica).
- **Decoupling**: query schema in Cosmos can evolve independently of the DynamoDB table.

## Why containerized tagger

Combined model size is ~470 MB (MegaDetector v5a ~280 MB + SpeciesNet ~212 MB). Lambda zip deployment caps at 250 MB unzipped. Container Lambda allows up to 10 GB and bundles ffmpeg and OpenCV without layer-management overhead.

## Model versioning

Models live at `s3://…-models/<model_name>/<version>/<artifact>.pt`. Lambda env vars pin the active version. To roll out a new model: upload to a new version prefix, update the env var, redeploy (no source changes). On cold start, the Lambda lazy-loads from S3 to `/tmp` and caches in memory across warm invocations.

## Deduplication

Every file's SHA-256 is its primary key in DynamoDB. The frontend computes the hash before upload and sends it to `/uploads/presign`. If the hash already exists, the upload is skipped and the existing file URL is returned. The pipeline is idempotent — re-processing the same content produces the same DynamoDB record.

## Auth flow

Cognito issues an ID token (JWT, RS256) with `iss`, `aud`, `exp`, `sub`, and email claims.

- **Upload API**: API Gateway Cognito JWT authorizer.
- **Query API**: API Gateway JWT authorizer + Flask middleware (`auth.py`) verifying signature, issuer, audience, and expiry against Cognito JWKS.

The same ID token works on both API Gateways. No second authentication layer.

## Limits and constraints

- AWS Academy: Lambdas use the shared `LabRole` execution role pattern where required.
- Lambda timeout: 15 min max; video work is bounded by in-process frame extraction inside one invocation.
- Cosmos serverless RU/s burst limit: not an issue at assignment scale.
- Cognito free tier: 50,000 MAU, more than enough.
- Eventual consistency: mutations via query API write DynamoDB first; Cosmos reflects changes after stream replication (~1–2 s).
