# Aussie EcoLens

Multi-cloud serverless wildlife observation platform built for FIT5225 Assignment 2 (Monash University, S1 2026).

Users upload images and videos. The system automatically detects and classifies Australian wildlife using a two-stage ML pipeline (MegaDetector for animal localisation + a fine-tuned SpeciesNet for species classification), tags each file, and exposes a query API for searching the catalogue.

## Architecture at a glance

CQRS-style split across two clouds:

- **AWS (write side, system of record)** — Cognito for auth, S3 for storage, Lambda for the ML pipeline (containerised tagger), DynamoDB for tag records, SNS for notifications. Region: `ap-southeast-2` (Sydney).
- **Azure (read side, query model)** — Function App serves the query API, Cosmos DB holds a replicated read model, Blob Storage handles ephemeral query uploads. Region: `australiaeast`.

Authentication is unified: AWS Cognito issues JWTs; both clouds verify them against the same JWKS endpoint.

See `docs/architecture.md` for the design narrative and `docs/architecture-diagram.md` for the diagram and the icon checklist for the final-report version.

## Repo layout

```
infra/                  IaC
  aws/                  CloudFormation templates + IAM policies (owned by P1)
docs/                   Architecture, data model, API contract, auth contract, setup, work plan
lambdas/                AWS Lambda source (Python 3.12)
  tagger/               ML pipeline reference (P2 will containerise)
  (more added as P2 / P3 ship their slices)
azure_functions/        Azure Function App source (P3 — to be added)
frontend/               React UI (Vite + TS) — auth UI built; upload/search/tags by P4
models/                 ML model artifacts (gitignored, see models/README.md)
P1-Auth-Requirements.md What P1 (Adam) is doing
AUTH-SETUP.md           How to deploy auth + bring up the dev server
HANDOFF.md              Status + what's left
```

## Quick start

Full walkthrough is in `AUTH-SETUP.md`. The short version:

```bash
# 1. AWS CLI authenticated (any IAM identity with the AussieEcoLensP1Deployer policy attached — see infra/aws/p1-deployer-policy.json)
# 2. Deploy the auth stack
aws cloudformation deploy --region ap-southeast-2 \
  --stack-name aussie-ecolens-auth \
  --template-file infra/aws/cognito.yaml

# 3. Deploy the infra stack with the Cognito IDs from step 2's outputs
aws cloudformation deploy --region ap-southeast-2 \
  --stack-name aussie-ecolens-infra \
  --template-file infra/aws/infrastructure.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    UserPoolId=<from auth stack outputs> \
    UserPoolClientId=<from auth stack outputs>

# 4. Wire the frontend
cd frontend
cp .env.example .env.local
# Edit .env.local with the outputs from both stacks
npm install
npm run dev
# → http://localhost:5173
```

## Team

| Name | Student ID | Role | Slice |
| --- | --- | --- | --- |
| Adam | _TBD_ | P1 — Auth + Infra | Cognito, S3, IAM, API Gateway, /uploads/check Lambda, React auth UI, architecture diagram, team report |
| Arsh | _TBD_ | P2 — ML | Containerised Tagger Lambda (MegaDetector + SpeciesNet), Thumbnail, Video Splitter, Aggregator |
| Rachana | _TBD_ | P3 — DB/API | DynamoDB schema + streams, Cosmos DB on Azure, 6 query endpoints in Azure Functions, JWT verifier, Replicator + Notifier Lambdas |
| Shaurya | _TBD_ | P4 — UI | Upload page, search page, tag editor, delete UI, SNS subscription UI, API client wrappers |

## Status

- ✅ Cognito User Pool + App Client deployed
- ✅ S3 buckets (uploads, thumbnails, models) deployed with encryption, no public access, deny-non-HTTPS bucket policies, CORS
- ✅ API Gateway HTTP API + Cognito JWT authorizer deployed
- ✅ `/uploads/check` Lambda — SHA-256 dedup, MIME + size validation, presigned PUT URL
- ✅ Scoped IAM policy for the deploy identity (`infra/aws/p1-deployer-policy.json`)
- ✅ React auth UI — sign-up, verify, login, sign-out, forgot/reset password, proactive 50-min token refresh
- ✅ Cross-cloud JWT verification contract for P3 to implement (`docs/auth-contract.md`)
- ⏳ DynamoDB table — pending P3
- ⏳ Tagger Lambda (containerised) + Thumbnail + Video Splitter + Aggregator — pending P2
- ⏳ Azure Function App (query API) — pending P3
- ⏳ Upload + search + tag UI — pending P4
- ⏳ SNS notification topics + Notifier Lambda — pending P3 (Notifier) + P4 (UI)

## License

Academic project. Not for redistribution.
