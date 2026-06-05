#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} — copy .env.example to .env and fill in values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${COSMOS_ENDPOINT:?COSMOS_ENDPOINT is required in .env}"
: "${COSMOS_KEY:?COSMOS_KEY is required in .env}"
: "${COGNITO_USER_POOL_ID:?COGNITO_USER_POOL_ID is required in .env}"
: "${COGNITO_APP_CLIENT_ID:?COGNITO_APP_CLIENT_ID is required in .env}"

STACK_NAME="${QUERY_API_STACK_NAME:-aussie-ecolens-query-api}"
REGION="${AWS_REGION:-ap-southeast-2}"
TAGGER="${TAGGER_LAMBDA_NAME:-aussie-ecolens-query-tagger}"
SNS_ARN="${SNS_TOPIC_ARN:-arn:aws:sns:ap-southeast-2:247622885425:aussie-ecolens-tag-notifications}"

cd "${SCRIPT_DIR}"

echo "Building query API..."
sam build

echo "Deploying stack ${STACK_NAME} to ${REGION}..."
sam deploy \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "CosmosEndpoint=${COSMOS_ENDPOINT}" \
    "CosmosKey=${COSMOS_KEY}" \
    "CosmosDatabase=${COSMOS_DATABASE:-aussie-ecolens}" \
    "CosmosContainer=${COSMOS_CONTAINER:-files}" \
    "CognitoUserPoolId=${COGNITO_USER_POOL_ID}" \
    "CognitoClientId=${COGNITO_APP_CLIENT_ID}" \
    "TaggerLambdaName=${TAGGER}" \
    "SnsTopicArn=${SNS_ARN}"

echo "Done."
