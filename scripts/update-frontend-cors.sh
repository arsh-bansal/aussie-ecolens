#!/usr/bin/env bash
# Add the production frontend origin to S3 bucket CORS (uploads + thumbnails).
# Run once after you have your live OCI URL (https://your-domain.com).
#
# Usage:
#   ./scripts/update-frontend-cors.sh https://ecolens.example.com
set -euo pipefail

ORIGIN="${1:-}"
if [[ -z "${ORIGIN}" ]]; then
  echo "Usage: $0 https://your-production-domain.com" >&2
  exit 1
fi

ORIGIN="${ORIGIN%/}"
REGION="${AWS_REGION:-ap-southeast-2}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
UPLOADS_BUCKET="aussie-ecolens-uploads-${ACCOUNT_ID}"
THUMBNAILS_BUCKET="aussie-ecolens-thumbnails-${ACCOUNT_ID}"

merge_cors() {
  local bucket="$1"
  local existing
  existing="$(aws s3api get-bucket-cors --bucket "${bucket}" --region "${REGION}" 2>/dev/null || echo '{}')"

  python3 - "${ORIGIN}" "${existing}" <<'PY'
import json, sys
origin = sys.argv[1]
raw = sys.argv[2].strip()
try:
    doc = json.loads(raw) if raw else {}
except json.JSONDecodeError:
    doc = {}
rules = doc.setdefault("CORSRules", [])
if not rules:
    rules.append({
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT", "GET", "HEAD"],
        "AllowedOrigins": [],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000,
    })
origins = rules[0].setdefault("AllowedOrigins", [])
for o in [
    "http://localhost:3000",
    "http://localhost:5173",
    origin,
]:
    if o not in origins:
        origins.append(o)
print(json.dumps(doc, indent=2))
PY
}

for bucket in "${UPLOADS_BUCKET}" "${THUMBNAILS_BUCKET}"; do
  echo "Updating CORS on s3://${bucket} ..."
  merge_cors "${bucket}" | aws s3api put-bucket-cors \
    --bucket "${bucket}" \
    --region "${REGION}" \
    --cors-configuration file:///dev/stdin
done

echo ""
echo "S3 CORS updated with ${ORIGIN}"
echo ""
echo "Also update the upload API Gateway CORS (DevOrigin parameter):"
echo "  aws cloudformation deploy --region ${REGION} \\"
echo "    --stack-name aussie-ecolens-infra \\"
echo "    --template-file infra/aws/infrastructure.yaml \\"
echo "    --capabilities CAPABILITY_NAMED_IAM \\"
echo "    --parameter-overrides \\"
echo "      UserPoolId=<pool-id> UserPoolClientId=<client-id> \\"
echo "      DevOrigin=\"http://localhost:3000,http://localhost:5173,${ORIGIN}\""
echo ""
echo "Query API (search/manage) already allows * — no change needed."
