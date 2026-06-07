# Aussie EcoLens

## Overview

Aussie EcoLens is a multi-cloud serverless wildlife observation platform built for FIT5225 Assignment 2 (Monash University, S1 2026).

Researchers and citizen scientists upload images and videos of Australian fauna. The system automatically detects animals, classifies species using a two-stage ML pipeline (MegaDetector + SpeciesNet), stores tagged metadata, and exposes a REST query API for searching the catalogue. Users can manually edit tags, delete files, and subscribe to email alerts when specific species are detected.

The platform spans **AWS** (write path, ML, system of record) and **Azure** (Cosmos DB read replica, frontend hosting). A single **AWS Cognito** identity issues JWTs verified by both clouds.

## Key Features

- Cognito sign-up, email verification, login, sign-out, and password reset
- Client-side SHA-256 deduplication before upload
- Automatic image thumbnails and video frame extraction (1 fps)
- ML species tagging with English common names
- Six query modes: by tag counts (AND logic), by species, by thumbnail URL, by uploaded query image, list all files, tagging status poll
- Bulk manual tag add/remove and file deletion (S3 + database)
- SNS email notifications filtered by watched species
- Next.js web UI with upload, search, manage, notifications, and dashboard

## Tech Stack

| Layer      | Technologies                                                            |
| ---------- | ----------------------------------------------------------------------- |
| Frontend   | Next.js 15, React 19, TypeScript, Tailwind CSS (static export)          |
| Auth       | AWS Cognito User Pool (SRP via `amazon-cognito-identity-js`)            |
| Write path | AWS S3, Lambda (Python 3.12), DynamoDB, SNS, API Gateway HTTP API       |
| ML         | PyTorch CPU, MegaDetector v5a, fine-tuned SpeciesNet (container Lambda) |
| Read path  | Azure Cosmos DB (serverless SQL API)                                    |
| Query API  | Flask on AWS Lambda (`lambdas/api_handlers/`) reading Cosmos            |
| IaC        | AWS CloudFormation / SAM, Azure Bicep                                   |
| CI/CD      | GitHub Actions → Azure Static Web Apps                                  |
| Regions    | AWS `ap-southeast-2` (Sydney), Azure `australiaeast`                    |

## Architecture Overview

CQRS-style split:

- **AWS (write side)** — Cognito, S3 (uploads, thumbnails, models), containerised Tagger + zip Thumbnail Lambdas, DynamoDB (system of record), Replicator + Notifier stream consumers, two API Gateways (upload presign + query API).
- **Azure (read side)** — Cosmos DB holds a replicated read model fed by the Replicator Lambda. Azure Static Web Apps hosts the production frontend.

Authentication is unified: Cognito issues JWTs; API Gateway and the query API verify them against the same JWKS endpoint. Mutations (tag edit, delete) write to DynamoDB first; the stream replicator updates Cosmos within ~1–2 seconds.

```
Upload flow:
  Browser → presign (API GW) → S3 PUT → Thumbnail + Tagger → DynamoDB
                                              ↓
                                    Stream → Replicator → Cosmos
                                    Stream → Notifier → SNS → email

Query flow:
  Browser → Query API (API GW + Flask Lambda) → Cosmos DB (reads)
  Mutations → Query API → DynamoDB (writes) → stream → Cosmos
```

See `docs/architecture.md` for the full design narrative and `docs/architecture-diagram.md` for the diagram (mermaid draft + official-icon checklist for the team report).

### Why there is no `azure_functions/` folder

Early project planning (`docs/work-breakdown.md`, `docs/auth-contract.md`) assigned the **query API** to an **Azure Function App** under `azure_functions/`. During implementation the team shipped the same REST contract as **Flask on AWS Lambda** in `lambdas/api_handlers/` instead — it reads from Azure Cosmos DB but runs on AWS API Gateway. Azure's role in the delivered system is **Cosmos DB** (read model) and **Static Web Apps** (frontend hosting), not a Function App.

The env var `NEXT_PUBLIC_AZURE_API_BASE` in the frontend is a historical name; it points at the **AWS query API Gateway URL**, not an Azure hostname.

## Setup and Installation

### Prerequisites

- Python 3.12
- Node.js 20+
- Docker Desktop (for Tagger container builds)
- AWS CLI v2 and AWS SAM CLI
- Azure CLI (for Cosmos provisioning and SWA)

Full walkthrough: `docs/setup.md`.

### Local frontend (dev)

```bash
cd frontend
cp .env.local.example .env.local
# Fill Cognito IDs and both API Gateway base URLs (see Configuration)
npm install
npm run dev
# → http://localhost:3000
```

### Deploy AWS stacks (summary)

```bash
# 1. Cognito
aws cloudformation deploy --region ap-southeast-2 \
  --stack-name aussie-ecolens-auth \
  --template-file infra/aws/cognito.yaml

# 2. Core infra (S3, presign Lambda, upload API Gateway)
aws cloudformation deploy --region ap-southeast-2 \
  --stack-name aussie-ecolens-infra \
  --template-file infra/aws/infrastructure.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    UserPoolId=<auth-stack-output> \
    UserPoolClientId=<auth-stack-output>

# 3. Processing Lambdas (deploy each SAM stack)
#    infra/aws/tagger/, infra/aws/thumbnail/, infra/aws/replicator/, infra/aws/notifier/

# 4. Query API
cd lambdas/api_handlers && ./deploy.sh
```

Model artifacts (`mdv5a.pt`, `model.pt`) are gitignored; upload to the S3 models bucket before deploying the Tagger. See `models/README.md`.

## Usage

### Web UI flows

1. **Sign up** → verify email → **log in**
2. **Upload** — select image or video; duplicate files are rejected via checksum
3. Wait for auto-tags (poll via `/files/status/<sha>`)
4. **Search** — species, tag counts (AND), thumbnail URL, or upload a query image
5. **Manage** — list files, bulk edit tags, delete
6. **Notifications** — subscribe to species email alerts

### API contract

REST endpoints are documented in `docs/api.md`. The query API route list lives in `lambdas/api_handlers/app.py`.

## Configuration

### Frontend (`frontend/.env.local`)

| Variable                            | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_AWS_REGION`            | Cognito region (`ap-southeast-2`)               |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID`  | Cognito User Pool ID                            |
| `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` | Cognito app client ID                           |
| `NEXT_PUBLIC_AWS_API_BASE`          | Upload API Gateway URL (`/uploads/presign`)     |
| `NEXT_PUBLIC_AZURE_API_BASE`        | Query API Gateway URL (AWS-hosted Flask Lambda) |

### Query API Lambda env vars

Cosmos endpoint/key, Cognito pool + client IDs, S3 bucket names, query-tagger function name. See `lambdas/api_handlers/README.md`.

## Deployment

| Component                                  | How                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend (production)                      | Push to `main` → GitHub Actions deploys to Azure Static Web Apps (`.github/workflows/azure-static-web-apps.yml`). Manual fallback: `frontend/scripts/deploy-azure.sh` |
| Query API                                  | `cd lambdas/api_handlers && ./deploy.sh`                                                                                                                              |
| Tagger / Thumbnail / Replicator / Notifier | SAM deploy per stack under `infra/aws/`                                                                                                                               |
| CORS for production origin                 | `./scripts/update-frontend-cors.sh <swa-url>` then redeploy infra stack                                                                                               |

Azure SWA setup: `infra/azure/static-web-app/README.md`.

## Repo layout

```
infra/
  aws/                  CloudFormation + SAM (Cognito, S3, Lambdas, API Gateway)
  azure/                Bicep (Cosmos DB) + Static Web Apps docs
docs/                   Architecture, API contract, data model, auth contract, setup
lambdas/
  tagger/               Container Lambda — MegaDetector + SpeciesNet (image, video, query)
  thumbnail/            Image thumbnail generation
  replicator/           DynamoDB stream → Cosmos DB
  notifier/             DynamoDB stream → SNS species alerts
  api_handlers/         Query API (Flask on Lambda) — reads Cosmos, writes DynamoDB
frontend/               Next.js 15 App Router UI (static export)
models/                 ML artifacts (gitignored except labels.txt; see models/README.md)
scripts/                CORS update and utility scripts
.github/workflows/      Azure Static Web Apps CI
```

## Team

| Name    | Student ID | Primary contributions                                                                                                                                                               |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arsh    | 35104201   | ML Tagger (container), Thumbnail, video tagging, Replicator, Notifier, Query API (Flask Lambda), Cosmos integration, Azure SWA deploy, frontend search/upload/dashboard integration |
| Adam    | 34083243   | Cognito + core AWS infra, presign upload API, Next.js migration, auth UI, landing/theme polish, search UX                                                                           |
| Rachana | 35102896   | Initial query API handlers, Cosmos DB provisioning, species search fixes, profile work                                                                                              |
| Shaurya | 33892180   | Early frontend wiring, profile/password UI, dashboard video hero                                                                                                                    |

## Limitations and Assumptions

- AWS Academy `LabRole` constrains IAM; Lambdas use the shared execution role pattern.
- Query API runs on AWS Lambda, not Azure Functions — only the read **data** is on Azure (Cosmos).
- Video processing is consolidated inside the Tagger Lambda (no separate splitter/aggregator Lambdas).
- Search results are eventually consistent after mutations (~1–2 s replication lag).
- ML models are CPU-only PyTorch builds sized for Lambda container limits.
- `docs/setup.md` still references `azure_functions/` deploy steps from the original plan; use `lambdas/api_handlers/deploy.sh` instead.

## Future Improvements

- Export architecture diagram with official AWS + Azure icons for the team report
- User testing guide for submission
- Consolidate outdated docs (`docs/setup.md`, `docs/architecture.md` Azure Functions references)
- Application Insights on Azure for cross-cloud tracing
- Model hot-swap via S3 version paths without Lambda redeploy

## License

Academic project. Not for redistribution.
