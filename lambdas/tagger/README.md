# Aussie EcoLens — Tagger Lambda

AWS Lambda containerized service that classifies Australian wildlife
species in user-uploaded media for the Aussie EcoLens platform
(FIT5225 Assignment 2, Monash University).

## Pipeline

1. **Trigger**: S3 ObjectCreated event on an image or video frame
2. **Detect**: MegaDetector v5a (YOLOv5) localizes animals via bounding boxes
3. **Crop**: Each detection is cropped and resized to 600x600
4. **Classify**: Fine-tuned SpeciesNet predicts species from the 45-class
   Australian wildlife taxonomy
5. **Persist**: Detected species + counts written to DynamoDB
6. **Fan out**: DynamoDB Streams trigger downstream Replicator (Cosmos DB)
   and Notifier (SNS) Lambdas

## Local development

This package targets the AWS Lambda Python 3.12 runtime. Local development
uses uv for dependency management and Python version isolation.

    uv sync
    uv run python smoke_test.py
    uv run python smoke_test.py --single Casuarius_casuarius_1.JPG

## Project layout

    src/aussie_ecolens_tagger/    Production package source
      __init__.py
      config.py                   Pydantic-settings env configuration
      exceptions.py               Typed pipeline exceptions
      handler.py                  AWS Lambda entry point
      logging.py                  Structlog setup for CloudWatch
      species.py                  45-class taxonomy + common name mapping
      services/
        megadetector.py           MegaDetector inference wrapper
        speciesnet.py             SpeciesNet classification wrapper

    tests/                        Pytest unit and integration tests
    reference/                    Vendored AussieEcoLense reference scripts
    smoke_test.py                 Local end-to-end pipeline verification

## Model artifacts

The model files (mdv5a.pt, model.pt) are not committed to git.
Copy them from the supplied AussieEcoLense.zip into ../../models/
before running locally.

## Tooling

- Python 3.12 (matches Lambda runtime)
- uv for package management
- ruff for linting
- mypy in strict mode for type checking
- pytest for tests
- structlog for JSON logging to CloudWatch
- pydantic-settings for env config
