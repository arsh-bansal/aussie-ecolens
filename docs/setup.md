# Setup

End-to-end guide for getting Aussie EcoLens running from a clean machine.

See also `README.md` for architecture overview and `infra/azure/static-web-app/README.md` for production frontend deploy.

## Prerequisites

Install on your laptop:

- Python 3.12 (matches Lambda runtime)
- Node.js 20+ (frontend)
- Docker Desktop (Tagger container builds)
- AWS CLI v2 (`aws --version`)
- AWS SAM CLI (`sam --version`)
- Azure CLI (`az --version`) — Cosmos DB + Static Web Apps only

Azure Functions Core Tools are **not** required. The query API runs as Flask on AWS Lambda (`lambdas/api_handlers/`), not an Azure Function App.

## Account setup

### AWS

1. Configure credentials for the deploy identity (AWS Academy `LabRole` or a scoped deployer policy — see `infra/aws/p1-deployer-policy.json`).
2. Default region for this project: **`ap-southeast-2`** (Sydney).

```bash
export AWS_REGION=ap-southeast-2
# Optional: export AWS_PROFILE=ecolens
```

**Academy constraints:**
- Use the pre-existing `LabRole` where IAM role creation is blocked.
- Session credentials expire when the lab ends — re-paste each session.

### Azure for Students

1. Activate at https://azure.microsoft.com/free/students.
2. `az login` → follow the browser flow.
3. `az account set --subscription <subscription_id>`.

Azure is used for **Cosmos DB** (read model) and **Static Web Apps** (frontend hosting).

## Repo setup

```bash
git clone <your_repo_url> aussie-ecolens
cd aussie-ecolens
cp .env.example .env
# Fill in Cognito IDs, Cosmos endpoint/key, and API URLs as stacks are deployed.
```

Frontend local config:

```bash
cd frontend
cp .env.local.example .env.local
# Fill Cognito + both API Gateway base URLs
```

## Deploy AWS infrastructure

Stacks deploy individually (there is no single `infra/aws/deploy.sh`). Order matters for shared resources.

### 1. Cognito

```bash
aws cloudformation deploy --region ap-southeast-2 \
  --stack-name aussie-ecolens-auth \
  --template-file infra/aws/cognito.yaml
```

Record `UserPoolId` and `UserPoolClientId` from stack outputs.

### 2. Core infra (S3, presign Lambda, upload API Gateway)

```bash
aws cloudformation deploy --region ap-southeast-2 \
  --stack-name aussie-ecolens-infra \
  --template-file infra/aws/infrastructure.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    UserPoolId=<from-auth-stack> \
    UserPoolClientId=<from-auth-stack>
```

### 3. ML models on S3

Copy `mdv5a.pt` and `model.pt` into `models/` (from the supplied archive; files are gitignored). Upload manually:

```bash
aws s3 cp models/mdv5a.pt s3://<models-bucket>/megadetector/v5a/mdv5a.pt
aws s3 cp models/model.pt   s3://<models-bucket>/speciesnet/v1/model.pt
```

See `models/README.md` for paths and versioning.

### 4. Processing Lambdas (SAM)

Deploy each stack from its template under `infra/aws/`:

| Stack | Template | Creates |
| --- | --- | --- |
| Tagger | `infra/aws/tagger/template.yaml` | Container tagger + query-tagger, EventBridge rule |
| Thumbnail | `infra/aws/thumbnail/template.yaml` | Image thumbnail Lambda |
| Replicator | `infra/aws/replicator/template.yaml` | DDB stream → Cosmos |
| Notifier | `infra/aws/notifier/template.yaml` | DDB stream → SNS |

Tagger build and push (from `lambdas/tagger/`):

```bash
make ecr-login    # set AWS_ACCOUNT_ID and ECR_REPO first
make push
sam build && sam deploy --guided   # from infra/aws/tagger/
```

See `infra/aws/tagger/README.md` for full steps.

### 5. Query API

Requires Cosmos credentials in `.env`:

```bash
cd lambdas/api_handlers
./deploy.sh
```

This SAM-deploys the Flask Lambda + dedicated API Gateway with Cognito JWT authorizer. Record the API base URL for `NEXT_PUBLIC_AZURE_API_BASE` (historical env name — it is an AWS URL).

## Deploy Azure infrastructure

### Cosmos DB (read model)

```bash
az group create --name aussie-ecolens-rg --location australiaeast

az deployment group create \
  --resource-group aussie-ecolens-rg \
  --template-file infra/azure/cosmos.bicep \
  --parameters accountName=<globally-unique-cosmos-name>
```

Copy `documentEndpoint` and `primaryMasterKey` into `.env` as `COSMOS_ENDPOINT` and `COSMOS_KEY`. The Replicator Lambda reads these to write the read model.

### Frontend (Static Web Apps)

Production hosting via GitHub Actions on push to `main`. Setup: `infra/azure/static-web-app/README.md`.

After the SWA URL is live, allow browser uploads from that origin:

```bash
./scripts/update-frontend-cors.sh https://<your-swa-host>
# Then redeploy aussie-ecolens-infra with the updated DevOrigin
```

## Configure cross-cloud bridge

The **Replicator** Lambda needs Cosmos endpoint and key (set in its SAM template parameters or environment). The **Query API** reads the same Cosmos container. No Azure Function App or Blob Storage is required for search-by-file — temp query images use the `query-temp/` prefix in the AWS uploads bucket.

Cognito JWT verification for the query API is configured in `lambdas/api_handlers/template.yaml` (issuer, audience, JWKS). See `docs/auth-contract.md` for the claim contract (still valid; the compute layer is AWS Lambda, not Azure Functions).

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Tagger (local ML smoke test)

```bash
cd lambdas/tagger
uv sync
uv run python smoke_test.py
```

### Query API (SAM local — optional)

```bash
cd lambdas/api_handlers
sam build
sam local start-api
```

### Tagger Lambda (SAM local invoke)

```bash
cd infra/aws/tagger
sam local invoke TaggerFunction --event ../../lambdas/tagger/scripts/lambda_event.json
```

## Smoke testing

- **ML:** `lambdas/tagger/smoke_test.py` (26 ground-truth images)
- **End-to-end:** sign up → upload → wait for tags → search → manage → notifications via the web UI
- **API:** `docs/api.md` + `lambdas/api_handlers/README.md` for curl examples

## Tearing down

Delete AWS stacks via CloudFormation/SAM (`sam delete` per stack). Azure:

```bash
az group delete --name aussie-ecolens-rg --yes
```

Academy labs may retain resources until explicitly removed — tear down to avoid burning credit.
