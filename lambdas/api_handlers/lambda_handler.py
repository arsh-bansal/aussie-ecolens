"""
lambda_handler.py — AWS Lambda entry point for the Query API.

Uses aws-wsgi to wrap the Flask app for Lambda + API Gateway (HTTP API or
REST API with Lambda proxy integration).

Deploy via SAM or CloudFormation, pointing Handler at:
    lambda_handler.handler

Environment variables (set in SAM template / Lambda console):
    COSMOS_ENDPOINT          – Azure Cosmos documentEndpoint
    COSMOS_KEY               – Azure Cosmos primaryMasterKey
    COSMOS_DATABASE          – default: aussie-ecolens
    COSMOS_CONTAINER         – default: files
    COGNITO_USER_POOL_ID     – e.g. ap-southeast-2_XXXXXXXXX
    COGNITO_CLIENT_ID        – Cognito app client ID
    AWS_REGION               – default: ap-southeast-2
    S3_BUCKET_NAME           – uploads bucket name
    MODEL_PT_PATH            – path to model.pt (in Lambda deployment package)
    MD_MODEL_PATH            – path to mdv5a.pt (in Lambda deployment package)
"""

import awsgi
from app import app


def handler(event, context):
    return awsgi.response(app, event, context, base64_content_types={"image/jpeg", "image/png"})
