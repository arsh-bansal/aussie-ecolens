# Aussie EcoLens

Multi-cloud serverless wildlife observation platform built for FIT5225 Assignment 2.

Users upload images and videos. The system automatically detects and classifies Australian wildlife using a two-stage ML pipeline (MegaDetector for animal localization + a fine-tuned SpeciesNet for species classification), tags each file, and exposes a query API for searching the catalogue.

## Architecture at a glance

The platform follows a CQRS-style split across two clouds:

- **AWS (write side, system of record)** — Cognito for auth, S3 for storage, Lambda for the ML pipeline (containerized for the tagger), DynamoDB for tag records, SNS for notifications.
- **Azure (read side, query model)** — Azure Functions serve the query API, Cosmos DB holds a replicated read model, Blob Storage handles ephemeral query uploads.

Authentication is unified: AWS Cognito issues JWTs, both clouds verify them.

See `docs/architecture.md` for the full diagram and design rationale.

## Repo layout

```
infra/                   IaC for both clouds
  aws/                   CloudFormation / SAM templates
  azure/                 Bicep / ARM templates
lambdas/                 AWS Lambda source (Python 3.12)
  thumbnail/             Image thumbnail generator
  video_splitter/        Extracts 1 fps frames from videos
  tagger/                ML pipeline (containerized, MD + SpeciesNet)
  aggregator/            Merges per-frame tags for videos
  replicator/            DynamoDB Stream → Cosmos DB
  notifier/              DynamoDB Stream → SNS
  api_handlers/          REST endpoints (delete, manual-tag, etc.)
  shared/                Common utilities (logging, auth, db helpers)
azure_functions/         Azure Functions source (Python 3.12)
  queries/               The 6 query endpoints
  shared/                Cognito JWT verification, Cosmos client
frontend/                React UI (Vite)
scripts/                 One-shot deployment + setup helpers
models/                  ML model artifacts (gitignored, see docs)
tests/                   Unit + integration tests
docs/                    Architecture, runbooks, design notes
```

## Quick start

1. Read `docs/setup.md` end to end before doing anything.
2. Run `scripts/bootstrap.sh` to create local config from templates.
3. Deploy AWS infra: `cd infra/aws && ./deploy.sh`
4. Deploy Azure infra: `cd infra/azure && ./deploy.sh`
5. Build and deploy frontend: `cd frontend && npm install && npm run deploy`

## Team

| Name | Student ID | Role |
| --- | --- | --- |
| TBD | TBD | TBD |

## License

Academic project. Not for redistribution.
