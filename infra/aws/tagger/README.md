# Tagger infrastructure (SAM)

Infrastructure-as-code for the Tagger write path: a container-image Lambda
triggered by S3 uploads that runs MegaDetector + SpeciesNet and writes
species tags to DynamoDB.

Location in the repo: `infra/aws/tagger/`
Component code: `lambdas/tagger/`

## What this stack creates

| Resource  | Name                                | Purpose                             |
| --------- | ----------------------------------- | ----------------------------------- |
| Lambda    | `aussie-ecolens-tagger`             | The tagger (container image, arm64) |
| S3 bucket | `aussie-ecolens-uploads-<acct>`     | Upload here to trigger tagging      |
| S3 bucket | `aussie-ecolens-models-<acct>`      | Holds the model `.pt` files         |
| DynamoDB  | `aussie-ecolens-files-tagger`       | File/tag records, streams on        |
| Log group | `/aws/lambda/aussie-ecolens-tagger` | 14-day retention                    |
| IAM role  | (managed by SAM)                    | Least-privilege execution role      |

The Lambda execution role can only: read objects from the two buckets,
write items to the one table, and write its own logs. Nothing else.

> Shared-resource note: this stack currently _creates_ the uploads/models
> buckets and the files table. Other AWS stacks (replicator, notifier,
> api_handlers) that need these should _reference_ them, not recreate them.
> If the team later wants a dedicated `infra/aws/shared/` stack to own
> them, the resource definitions move there and this stack imports them.

## Prerequisites

- AWS CLI configured (`aws sts get-caller-identity` returns your user)
- SAM CLI installed (`sam --version`; `brew install aws-sam-cli`)
- Docker running (for the image build)
- Exported account/region:

```bash
export AWS_ACCOUNT_ID=247622885425
export AWS_REGION=ap-southeast-2
```

## One-time: create the ECR repo

SAM references a pre-pushed image, so the ECR repository must exist first.

```bash
aws ecr create-repository \
  --repository-name aussie-ecolens-tagger \
  --region ap-southeast-2 \
  --image-scanning-configuration scanOnPush=true
```

## Deploy workflow

The build and the deploy run from two different directories:

```bash
# 1. Build + push the image to ECR  (from the component dir)
cd lambdas/tagger
make push                     # builds linux/arm64, pushes :dev tag

# 2. Deploy the stack  (from the infra dir)
cd ../../infra/aws/tagger
sam deploy \
  --template-file template.yaml \
  --parameter-overrides \
    ImageUri=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/aussie-ecolens-tagger:dev
```

First deploy creates everything; subsequent deploys update in place.

## One-time: upload the models

The Lambda lazy-loads models from S3 at cold start. Upload them once.
Adjust the source paths to wherever your `.pt` files live (the project
keeps them at repo-root `models/`).

```bash
aws s3 cp models/mdv5a.pt \
  s3://aussie-ecolens-models-${AWS_ACCOUNT_ID}/megadetector/v5a/mdv5a.pt

aws s3 cp models/model.pt \
  s3://aussie-ecolens-models-${AWS_ACCOUNT_ID}/speciesnet/v1/model.pt
```

The S3 keys must match `MEGADETECTOR_S3_KEY` / `SPECIESNET_S3_KEY` in the
template (or override those at deploy time).

## End-to-end test

```bash
# Upload a test image -> triggers the tagger
aws s3 cp Casuarius_casuarius_1.JPG \
  s3://aussie-ecolens-uploads-${AWS_ACCOUNT_ID}/users/test/Casuarius_casuarius_1.JPG

# Watch the logs (first invocation is a cold start: model download + load,
# expect ~30-60s)
sam logs --stack-name aussie-ecolens-tagger --tail

# Check the DynamoDB record was written
aws dynamodb get-item \
  --table-name aussie-ecolens-files-tagger \
  --key '{"pk":{"S":"FILE#users/test/Casuarius_casuarius_1.JPG"},"sk":{"S":"METADATA"}}'
```

## Swapping a model (assignment 4.1)

No code change or image rebuild required:

1. Upload the new `.pt` to a new S3 key, e.g. `megadetector/v5b/mdv5a.pt`
2. Redeploy pointing the key env var at the new object:
   ```bash
   sam deploy --parameter-overrides \
     ImageUri=... \
     MegadetectorS3Key=megadetector/v5b/mdv5a.pt
   ```
   (add a `MegadetectorS3Key` / `SpeciesnetS3Key` parameter to the template
   if you want this overridable without editing it — currently the keys are
   set directly in the Environment block.)

## Tear down

```bash
sam delete --stack-name aussie-ecolens-tagger
```

Note: S3 buckets must be empty before deletion. Empty them first if the
delete fails on a non-empty bucket.
