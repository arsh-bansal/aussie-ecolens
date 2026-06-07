# Lambdas (AWS)

All AWS Lambda functions for Aussie EcoLens, Python 3.12.

## Conventions

- Each Lambda lives in its own subfolder with a `src/` package layout (tagger, thumbnail, replicator, notifier) or flat modules (api_handlers).
- Container image: **tagger** only (models + ffmpeg + OpenCV exceed zip limits).
- Zip deployment: thumbnail, replicator, notifier, api_handlers.
- Config via environment variables; see each subfolder's README.
- AWS Academy: use the shared `LabRole` execution role where IAM creation is constrained.

## Deployment

Each Lambda has a SAM template under `infra/aws/<name>/template.yaml`. Deploy per stack — there is no single top-level `infra/aws/template.yaml`.

| Lambda | Deploy from | Notes |
| --- | --- | --- |
| `tagger/` | `infra/aws/tagger/` | `make push` then `sam build && sam deploy` |
| `thumbnail/` | `infra/aws/thumbnail/` | `sam build && sam deploy` |
| `replicator/` | `infra/aws/replicator/` | Needs Cosmos endpoint/key |
| `notifier/` | `infra/aws/notifier/` | Needs SNS topic ARN |
| `api_handlers/` | `lambdas/api_handlers/deploy.sh` | Flask query API + API Gateway |

The **upload presign** Lambda is defined inline in `infra/aws/infrastructure.yaml` (not under `lambdas/`).

## Index

| Folder | Trigger | Purpose |
| --- | --- | --- |
| `tagger/` | EventBridge S3 ObjectCreated | ML pipeline: MegaDetector + SpeciesNet for images; video mode extracts 1 fps frames in-process and aggregates tag counts |
| `tagger/` (query handler) | Sync invoke from query API | Tag-only inference for search-by-file; no DynamoDB write |
| `thumbnail/` | EventBridge S3 ObjectCreated (images) | Resize to deterministic `<sha256>.jpg` in thumbnails bucket |
| `replicator/` | DynamoDB Streams | Upsert/delete records in Azure Cosmos DB |
| `notifier/` | DynamoDB Streams | Publish per-species SNS messages (filter policies route to subscribers) |
| `api_handlers/` | API Gateway HTTP API | Query API: search, modify tags, delete, subscribe, list files, status poll. Reads Cosmos; mutations write DynamoDB |

## Video processing note

Older docs listed separate `video_splitter/` and `aggregator/` Lambdas. The delivered system consolidates video frame extraction and tag aggregation inside `lambdas/tagger/` (`video_handler.py` + `domain/aggregate.py`). There are no `video_splitter/` or `aggregator/` folders.

## Query API note

Despite early planning for an `azure_functions/` Azure Function App, the query REST API is implemented here as **Flask on AWS Lambda**. Azure Cosmos DB is the read database; the compute runs on AWS API Gateway.
