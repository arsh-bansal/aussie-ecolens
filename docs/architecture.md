# Architecture

## High-level

Aussie EcoLens is a multi-cloud serverless platform built on AWS and Azure, following a CQRS (Command Query Responsibility Segregation) pattern.

- **AWS** owns the **write path**: ingestion, ML inference, and the system of record for tag data.
- **Azure** owns the **read path**: a query API serving a replicated read model.

A single identity provider — AWS Cognito — issues JWTs that both clouds verify. There is no second user store.

## Component map

### AWS

| Service | Purpose |
| --- | --- |
| Cognito User Pool | Authentication, JWT issuer, JWKS endpoint |
| Cognito Identity Pool | Maps authenticated users to temporary AWS credentials for direct S3 upload |
| S3 (uploads) | Receives original media via presigned PUT |
| S3 (thumbnails) | Stores generated thumbnails |
| S3 (frames) | Holds extracted video frames during processing |
| S3 (models) | Versioned model registry (`models/megadetector/v1/...`, etc.) |
| Lambda: thumbnail | Image-only. Resizes with OpenCV, uploads thumbnail |
| Lambda: video_splitter | Video-only. Uses ffmpeg to extract 1 fps frames, writes to S3 frames prefix |
| Lambda: tagger (container) | Loads MegaDetector + SpeciesNet on cold start, classifies one image (or one frame) |
| Lambda: aggregator | When all frames of a video are tagged, merges per-frame tags into the video record |
| Lambda: replicator | DynamoDB Streams consumer that writes tag records to Azure Cosmos DB |
| Lambda: notifier | DynamoDB Streams consumer that publishes new-tag events to SNS topics |
| Lambda: api_handlers | REST handlers for delete, manual tag edit, query-by-uploaded-file |
| API Gateway | Public REST endpoints for the API handlers |
| DynamoDB | Single-table design: file metadata, tags, checksums, thumbnail URL |
| SNS | One topic per species; users subscribe by email |

### Azure

| Service | Purpose |
| --- | --- |
| Function App (Python) | The 6 query endpoints |
| Cosmos DB (serverless, SQL API) | Read model; indexed for tag-based lookups |
| Blob Storage | Ephemeral storage for "find by file content" queries |
| Application Insights | Logging + tracing |

## The pipeline

### Image upload

1. Frontend authenticates via Cognito and gets temporary AWS creds (Identity Pool).
2. Frontend computes file SHA-256 client-side and submits a `HEAD` query to check for duplicates against DynamoDB (via API Gateway).
3. If new, frontend PUTs the file to `s3://aussie-ecolens-uploads/<user_sub>/<sha256>.<ext>` using presigned URL.
4. S3 ObjectCreated triggers the Thumbnail Lambda and Tagger Lambda in parallel.
5. Thumbnail Lambda saves the thumbnail and writes its URL to the file's DynamoDB record.
6. Tagger Lambda runs MegaDetector → crops detections → runs SpeciesNet → writes detected species + counts to DynamoDB.
7. DynamoDB Streams → Replicator Lambda writes the same record to Cosmos DB.
8. DynamoDB Streams → Notifier Lambda publishes a message to each species' SNS topic.

### Video upload

1. Same upload flow as image (steps 1–3).
2. S3 ObjectCreated triggers the Video Splitter Lambda.
3. Splitter writes a "job" record to DynamoDB (`video_id`, `expected_frames: N`, `status: processing`).
4. Splitter uses ffmpeg to extract 1 frame per second to `s3://aussie-ecolens-frames/<video_id>/frame_001.jpg` ... `frame_NNN.jpg`.
5. Each frame triggers the Tagger Lambda (same Lambda as images, fan-out parallelism).
6. Each frame's tags are written under `(video_id, frame_id)` in DynamoDB.
7. The Aggregator Lambda is triggered by frame-tag writes via DynamoDB Streams. It increments a counter on the video record. When the counter equals `expected_frames`, it merges per-frame tags into the final video tag set and marks the job complete.
8. Replicator and Notifier Lambdas fire on the final write, same as images.

### Query

The query API is on Azure Functions, JWT-protected. Endpoints:

| Method + Path | Purpose |
| --- | --- |
| POST /search/tags | Find files where tag counts meet thresholds (e.g. `{"koala": 3}`) |
| POST /search/species | Find files containing at least one of the given species |
| POST /search/by-thumbnail | Given a thumbnail URL, return the full-size URL |
| POST /search/by-file | User uploads a file → Function calls back to AWS Tagger Lambda → returns matching files |
| POST /tags/modify | Bulk add/remove tags on a list of file URLs (operation: 0 or 1) |
| POST /files/delete | Bulk delete files from S3 + DynamoDB + Cosmos |

The "by-file" endpoint is the one cross-cloud sync call: Azure stores the upload in Blob, calls the AWS Tagger Lambda over HTTPS (with the user's Cognito JWT for authz), gets back tags, queries Cosmos, deletes the blob.

The mutation endpoints (`/tags/modify`, `/files/delete`) write to AWS first (system of record); replication carries the change to Cosmos.

## Why CQRS across clouds

- **Latency**: query reads hit Cosmos in the same cloud as the API. <10 ms typical.
- **Resilience**: Azure can serve reads even during AWS write-path issues.
- **Cost**: cross-cloud egress only on writes (the smaller volume), not reads.
- **Decoupling**: query schema can evolve independently of the storage table.

## Why containerized tagger

Combined model size is ~470 MB (MegaDetector v5a 280 MB + SpeciesNet 212 MB). Lambda's zip-based deployment caps at 250 MB unzipped. Container Lambda allows up to 10 GB. Container also bundles ffmpeg and OpenCV without layer-management headaches.

## Model versioning

Models live at `s3://aussie-ecolens-models/<model_name>/<version>/<artifact>.pt`. Lambda env vars `MEGADETECTOR_VERSION` and `SPECIESNET_VERSION` pin the active version. To roll out a new model: upload to a new version prefix, update the env var, redeploy (no source changes). On cold start, the Lambda lazy-loads from S3 to `/tmp` and caches in memory across warm invocations.

## Deduplication

Every file's SHA-256 is its primary key in DynamoDB. The frontend computes the hash before upload and submits a `HEAD` query. If the hash already exists, the upload is skipped and the existing file URL is returned to the user. This also makes the entire pipeline idempotent — re-running a tag job on the same content produces the same DynamoDB record.

## Auth flow across clouds

Cognito issues an ID token (JWT, RS256). The token includes `iss`, `aud`, `exp`, `sub`, and email claims.

- **AWS-side**: API Gateway uses a Cognito Authorizer; Lambdas trust the request context.
- **Azure-side**: Each Function fetches Cognito's JWKS (cached), verifies the JWT signature, checks issuer/audience/expiry, and extracts `sub` and `email`.

The same JWT works on both clouds. No second authentication layer.

## Limits and constraints

- AWS Academy: must use `LabRole` everywhere. No custom IAM roles.
- Lambda timeout: 15 min max, but no single Lambda invocation actually does long work — videos are decomposed into per-frame jobs.
- Cosmos serverless RU/s burst limit: not an issue at assignment scale.
- Cognito free tier: 50,000 MAU, more than enough.
