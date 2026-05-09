# Work breakdown

This project decomposes naturally into 4 vertical slices. Each slice can be done by one person without blocking the others, once the data model and API contracts are agreed.

The architecture, data model, and API contracts (`docs/architecture.md`, `docs/data-model.md`, `docs/api.md`) are the contract. Don't change them without team agreement.

## Slice A — AWS infrastructure and ingest pipeline

**Owner**: TBD

- AWS infra (CloudFormation/SAM): S3 buckets, DynamoDB, Cognito, IAM bindings to LabRole
- Thumbnail Lambda (image resize with OpenCV)
- Video Splitter Lambda (ffmpeg, 1 fps)
- Aggregator Lambda (frame tag merging)
- Replicator Lambda (DDB Stream → Cosmos)
- Notifier Lambda (DDB Stream → SNS)
- Model upload script

**Deliverable**: an upload to S3 reliably produces a fully-tagged DynamoDB record (image and video paths both work end-to-end).

## Slice B — ML pipeline (Tagger Lambda)

**Owner**: TBD

- Containerized Tagger Lambda
  - Dockerfile with PyTorch CPU, MegaDetector, SpeciesNet dependencies
  - Lazy model loading from S3 with `/tmp` cache
  - Inference code adapted from `batch.py`
- Tag normalization (model class name → human-readable species name from `labels.txt`)
- ECR build + push script
- Confidence threshold tuning

**Deliverable**: given an S3 URI, the Tagger produces accurate species detections. Tested on sample images for at least 5 species.

## Slice C — Azure query API

**Owner**: TBD

- Azure infra (Bicep): resource group, Cosmos, storage, function app, App Insights
- Cognito JWT verifier shared module
- The 6 query endpoints (see `docs/api.md`)
- Cross-cloud "find by file" query (Azure → AWS Tagger callback)
- Manual tag edit and bulk delete handlers (these mutate AWS, replication carries to Cosmos)

**Deliverable**: every query endpoint passes its integration test against deployed infra.

## Slice D — Frontend and integration

**Owner**: TBD

- React app (Vite)
  - Login/signup using Amplify Auth or amazon-cognito-identity-js
  - Upload page with client-side SHA-256 + dedup check
  - Browse/search page with thumbnail grid
  - Tag editor and delete UI
  - Subscribe-to-tag UI for SNS
- API client wrappers (one for AWS, one for Azure)
- Smoke test suite (Playwright or just shell scripts hitting the deployed API)
- The team report and architecture diagram refresh

**Deliverable**: a working UI that exercises every backend feature, deployed to a public URL.

## Cross-cutting

These belong to whoever finishes their slice first:

- Demo script and recording
- Final integration testing
- Polishing the report

## Suggested timeline (5 weeks)

| Week | Focus |
| --- | --- |
| 1 | Read brief, finalize architecture, set up repo, deploy empty AWS + Azure stacks, get Cognito working |
| 2 | Slice A and B in parallel — full image upload → tag flow working |
| 3 | Video pipeline working, Slice C's first 3 query endpoints |
| 4 | Slice D frontend, last 3 query endpoints, manual tags, delete, notifications |
| 5 | Integration, demo prep, reports, peer review |
