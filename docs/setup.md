# Setup

End-to-end guide for getting Aussie EcoLens running from a clean machine.

## Prerequisites

Install on your laptop:

- Python 3.12 (matches Lambda runtime and the model code)
- Node.js 20+ (for the frontend)
- Docker Desktop (for building the Tagger Lambda container)
- AWS CLI v2 (`aws --version`)
- AWS SAM CLI (`sam --version`) — used for AWS deployment
- Azure CLI (`az --version`)
- Azure Functions Core Tools (`func --version`)

## Account setup

### AWS Academy (Learner Lab)

1. Start your AWS Academy lab. Wait for the dot to go green.
2. Click "AWS Details" → copy the credentials block.
3. Paste into `~/.aws/credentials` under a profile, e.g.:

```
[ecolens]
aws_access_key_id=...
aws_secret_access_key=...
aws_session_token=...
```

4. Important: these credentials expire when the lab session ends. You'll need to re-paste each session.
5. Set `AWS_PROFILE=ecolens` in your shell, or pass `--profile ecolens` to all AWS commands.

**Constraints to remember**:
- Region must be `us-east-1` (the lab's default).
- All Lambdas, EC2, etc. use the pre-existing `LabRole` — you cannot create new IAM roles.
- Don't try to enable services Academy blocks (e.g. some SageMaker features).

### Azure for Students

1. Activate at https://azure.microsoft.com/free/students.
2. `az login` → follow the browser flow.
3. `az account list` → confirm the subscription is "Azure for Students".
4. `az account set --subscription <subscription_id>`.

## Repo setup

```bash
git clone <your_repo_url> aussie-ecolens
cd aussie-ecolens
cp .env.example .env
# Fill in the values you know; the rest get populated by deploy scripts.
```

## Deploy AWS infrastructure

```bash
cd infra/aws
./deploy.sh
```

This creates:
- 4 S3 buckets (uploads, thumbnails, frames, models)
- DynamoDB table with GSIs and streams
- Cognito User Pool, App Client, Identity Pool
- All Lambda functions
- API Gateway with the Cognito Authorizer
- ECR repository for the Tagger container

The script writes resource IDs back into your `.env`.

### Build and push the Tagger container

```bash
cd lambdas/tagger
./build_and_push.sh
```

This builds the Docker image (with PyTorch, MegaDetector, SpeciesNet, ffmpeg, OpenCV), pushes to ECR, and updates the Lambda function to use the new image.

### Upload the ML models

```bash
cd scripts
./upload_models.sh
```

This uploads `models/mdv5a.pt` to `s3://aussie-ecolens-models/megadetector/v1/` and `models/model.pt` to `s3://aussie-ecolens-models/speciesnet/v1/`. The model files themselves are gitignored — copy them into `models/` from the supplied AussieEcoLense.zip.

## Deploy Azure infrastructure

```bash
cd infra/azure
./deploy.sh
```

This creates:
- Resource group
- Cosmos DB account (serverless)
- Storage account for ephemeral query uploads
- Function App (Python 3.12 on Linux)
- Application Insights

Then deploy the function code:

```bash
cd azure_functions
func azure functionapp publish aussie-ecolens-api
```

## Configure the cross-cloud bridge

The Replicator Lambda needs to write to Cosmos DB. The Cosmos connection string is stored in AWS Secrets Manager:

```bash
./scripts/set_cosmos_secret.sh
```

The Azure Functions need to verify Cognito JWTs. The verification config (issuer, audience, JWKS URL) is set as Function App application settings by `infra/azure/deploy.sh`.

## Deploy the frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # fill in Cognito + API URLs
npm run build
npm run deploy  # uploads to S3 static site bucket
```

## Run the smoke tests

```bash
cd tests
pytest -v
```

Tests cover: upload → tag → query end-to-end, dedup, manual tagging, deletion.

## Local development

To run a Lambda locally:

```bash
cd lambdas/tagger
sam local invoke TaggerFunction --event events/sample_image.json
```

To run an Azure Function locally:

```bash
cd azure_functions
func start
```

To run the frontend locally:

```bash
cd frontend
npm run dev
```

## Tearing down

Don't forget — Academy stops your lab but keeps resources running. To avoid burning credit:

```bash
./scripts/teardown.sh
```

Removes all AWS resources. Azure resource group can be deleted with:

```bash
az group delete --name aussie-ecolens-rg --yes
```
