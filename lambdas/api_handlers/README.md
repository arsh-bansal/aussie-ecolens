# Aussie EcoLens — Query API

Rachana's component. Read side of the CQRS architecture: Flask app deployed
as AWS Lambda, reading from Azure Cosmos DB.

## Files

| File | Purpose |
|------|---------|
| `app.py` | Flask app, registers all blueprints |
| `lambda_handler.py` | AWS Lambda entry point (wraps Flask via awsgi) |
| `auth.py` | Cognito JWT validation middleware |
| `cosmos_client.py` | Azure Cosmos DB client wrapper |
| `search_handler.py` | `GET /search` — find by tag counts / species presence |
| `thumbnail_handler.py` | `GET /thumbnail` — thumbnail URL → full-size URL |
| `query_file_handler.py` | `POST /query-file` — tag uploaded file + find matches |
| `tags_handler.py` | `POST /tags` — bulk add/remove tags |
| `delete_handler.py` | `DELETE /files` — remove files from S3 + Cosmos |
| `tagging.py` | ML pipeline wrapper (MegaDetector + SpeciesNet) |
| `species_catalog.py` | Canonical species registry + free-form input → canonical name resolution |
| `template.yaml` | SAM/CloudFormation deployment template |
| `requirements.txt` | Python dependencies |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `COSMOS_ENDPOINT` | Azure Cosmos documentEndpoint |
| `COSMOS_KEY` | Azure Cosmos primaryMasterKey |
| `COSMOS_DATABASE` | default: `aussie-ecolens` |
| `COSMOS_CONTAINER` | default: `files` |
| `COGNITO_USER_POOL_ID` | e.g. `ap-southeast-2_XXXXXXXXX` |
| `COGNITO_CLIENT_ID` | Cognito app client ID |
| `S3_BUCKET_NAME` | uploads bucket name |
| `MODEL_PT_PATH` | path to `model.pt` |
| `MD_MODEL_PATH` | path to `mdv5a.pt` |

## API Endpoints

### `GET /search`
Find user's files by tag counts (AND logic) or species presence.

```json
// Body or ?tags=koala:3,wombat:1
{"koala": 3, "wombat": 1}

// Response
{
  "results": [{"s3_url": "...", "thumbnail_url": "...", "tags": {"koala": 3}}],
  "count": 1
}
```

Count of `0` or `null` = presence-only (any count of that species).

### `GET /thumbnail`
Map a thumbnail URL to the full-size image URL.

```
GET /thumbnail?url=https://...
```

### `POST /query-file`
Upload a file, detect species, return matching files from DB. File is NOT stored.

```
POST /query-file
Content-Type: multipart/form-data
file: <binary>
```

### `POST /tags`
Bulk add (`operation: 1`) or remove (`operation: 0`) tags.

```json
{
  "urls": ["s3://..."],
  "tags": ["koala", "wombat"],
  "operation": 1
}
```

### `DELETE /files`
Delete files from S3 (original + thumbnail) and Cosmos.

```json
{"urls": ["s3://...", "s3://..."]}
```

## Local Dev

```bash
pip install -r requirements.txt

export COSMOS_ENDPOINT=...
export COSMOS_KEY=...
export COGNITO_USER_POOL_ID=...
export COGNITO_CLIENT_ID=...
export S3_BUCKET_NAME=...
export MODEL_PT_PATH=../AussieEcoLense/model.pt
export MD_MODEL_PATH=../AussieEcoLense/mdv5a.pt

python app.py
```

## Deploy

Copy `model.pt` and `mdv5a.pt` into this directory first (Lambda needs them
in the deployment package).

```bash
cp ../AussieEcoLense/model.pt .
cp ../AussieEcoLense/mdv5a.pt .

sam build
sam deploy --guided \
  --parameter-overrides \
    CosmosEndpoint=<from az cosmosdb show> \
    CosmosKey=<from az cosmosdb keys list> \
    CognitoUserPoolId=<from Adam> \
    CognitoClientId=<from Adam> \
    S3BucketName=<from Adam> \
    FilesTableArn=<from your DynamoDB stack>
```

## DynamoDB Table (deploy first)

Paste the YAML from `files-table-for-rachana.md` into a CloudFormation
stack and deploy:

```bash
aws cloudformation deploy \
  --template-file files-table.yaml \
  --stack-name aussie-ecolens-data \
  --parameter-overrides AppName=aussie-ecolens \
  --capabilities CAPABILITY_IAM
```

Then send Arsh the `FilesTableStreamArn` output.

## Cosmos DB (deploy first)

```bash
az group create -n aussie-ecolens-rg -l australiaeast
az bicep build -f cosmos.bicep   # validate first
az deployment group create \
  -g aussie-ecolens-rg \
  -f cosmos.bicep \
  -p accountName=aussieecolens<uniquesuffix>
```

Then send Arsh the `documentEndpoint` and `primaryMasterKey`.
