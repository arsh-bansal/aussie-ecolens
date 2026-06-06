#!/usr/bin/env bash
# Build the static frontend and deploy to Azure Static Web Apps.
#
# Prerequisites:
#   - Azure for Students subscription (az login)
#   - Static Web App created in Azure Portal (see infra/azure/static-web-app/README.md)
#   - Deployment token from: Portal → Static Web App → Manage deployment token
#
# Usage:
#   export AZURE_SWA_DEPLOYMENT_TOKEN='<token>'
#   npm run deploy:azure
#
#   # Or pass token inline:
#   npm run deploy:azure -- '<deployment-token>'
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

TOKEN="${1:-${AZURE_SWA_DEPLOYMENT_TOKEN:-}}"
if [[ -z "${TOKEN}" ]]; then
  echo "Missing deployment token." >&2
  echo "" >&2
  echo "Azure Portal → your Static Web App → Manage deployment token" >&2
  echo "" >&2
  echo "Then either:" >&2
  echo "  export AZURE_SWA_DEPLOYMENT_TOKEN='<token>'" >&2
  echo "  npm run deploy:azure" >&2
  echo "" >&2
  echo "Or:" >&2
  echo "  npm run deploy:azure -- '<token>'" >&2
  exit 1
fi

cd "${FRONTEND_DIR}"

ENV_FILE=".env.production.local"
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f ".env.local" ]]; then
    echo "No ${ENV_FILE}; using .env.local for this build."
    cp .env.local "${ENV_FILE}"
  else
    echo "Missing ${ENV_FILE} or .env.local — add NEXT_PUBLIC_* API URLs before deploy." >&2
    exit 1
  fi
fi

echo "Building production static export..."
npm run build

if [[ ! -d "out" ]]; then
  echo "Build did not produce out/ — check next.config.ts output: 'export'." >&2
  exit 1
fi

if [[ ! -f "out/staticwebapp.config.json" ]]; then
  echo "Warning: out/staticwebapp.config.json missing — SPA routes may 404." >&2
fi

echo "Deploying to Azure Static Web Apps..."
npx --yes @azure/static-web-apps-cli@latest deploy ./out \
  --deployment-token "${TOKEN}" \
  --env production

echo ""
echo "Deploy complete. Open your Static Web App URL from the Azure Portal."
echo ""
echo "If uploads fail in the browser, allow your SWA origin in AWS CORS:"
echo "  ./scripts/update-frontend-cors.sh https://<your-app>.azurestaticapps.net"
