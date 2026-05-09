# Lambdas (AWS)

All AWS Lambda functions, Python 3.12.

## Conventions

- Each Lambda lives in its own subfolder with `handler.py` (entry point), `requirements.txt`, and (where applicable) `Dockerfile`.
- Shared utilities go in `shared/`. Each Lambda symlinks or copies what it needs at deploy time (see each Lambda's deploy script).
- Logging: use `shared/logger.py` (structured JSON logs to CloudWatch).
- All Lambdas read config from environment variables. See each Lambda's README for the var list.
- Use the `LabRole` execution role (AWS Academy constraint).

## Deployment

The top-level `infra/aws/template.yaml` (SAM) wires every Lambda to its triggers. Most Lambdas deploy as zip; the Tagger deploys as a container image. Run `infra/aws/deploy.sh` from the repo root.

## Index

| Lambda | Trigger | Purpose |
| --- | --- | --- |
| `thumbnail/` | S3 ObjectCreated (images) | Generate thumbnail |
| `video_splitter/` | S3 ObjectCreated (videos) | ffmpeg → 1 fps frames to S3 |
| `tagger/` | S3 ObjectCreated (frames + images) | MegaDetector + SpeciesNet |
| `aggregator/` | DynamoDB Streams | Merge per-frame tags into video record |
| `replicator/` | DynamoDB Streams | Mirror to Cosmos DB |
| `notifier/` | DynamoDB Streams | Publish to per-tag SNS topics |
| `api_handlers/` | API Gateway | REST endpoints (presign, modify-tags, delete, subscribe, by-file) |
