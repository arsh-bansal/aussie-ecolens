"""
lambda_handler.py — AWS Lambda entry point for the Query API.

Wraps the Flask (WSGI) app for Lambda behind API Gateway using apig-wsgi, which
natively understands the API Gateway HTTP API v2.0 payload format (as well as
REST/HTTP v1.0). binary_support=True base64-decodes binary request bodies — the
multipart image upload for POST /search/by-file — and base64-encodes binary
responses, transparently.

Deploy via SAM, pointing Handler at:
    lambda_handler.handler

Environment variables (set in the SAM template / Lambda console):
    COSMOS_ENDPOINT          – Azure Cosmos documentEndpoint
    COSMOS_KEY               – Azure Cosmos primaryMasterKey
    COSMOS_DATABASE          – default: aussie-ecolens
    COSMOS_CONTAINER         – default: files
    COGNITO_USER_POOL_ID     – e.g. ap-southeast-2_XXXXXXXXX
    COGNITO_CLIENT_ID        – Cognito app client ID
    AWS_REGION               – default: ap-southeast-2
    S3_BUCKET_NAME           – uploads bucket name
    DYNAMODB_TABLE           – system-of-record table (tag edit / delete writes)
    TAGGER_LAMBDA_NAME       – Arsh's image tag-only Lambda (for /search/by-file)
"""

from apig_wsgi import make_lambda_handler
from app import app

# Returns a handler(event, context) that speaks API Gateway v1 AND v2.
handler = make_lambda_handler(app, binary_support=True)
