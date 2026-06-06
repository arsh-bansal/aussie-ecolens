# Deploy frontend on Azure Static Web Apps

Host the Aussie EcoLens UI on **Azure Static Web Apps** (free tier on Azure for Students). You get a live HTTPS URL like `https://aussie-ecolens.azurestaticapps.net`.

APIs stay on **AWS** (Cognito, upload, query). **Azure** hosts the website + Cosmos DB.

## What you need

- Azure for Students subscription
- GitHub repo admin access (for Actions + secrets)
- AWS CLI (to patch S3 CORS after first deploy)

---

## Option A — GitHub Actions (recommended)

Auto-deploys on every push to `main`. Workflow: `.github/workflows/azure-static-web-apps.yml`.

### Step 1 — Create Static Web App (Portal)

1. [Azure Portal](https://portal.azure.com) → **Create a resource** → **Static Web App**
2. Fill in:

| Field | Value |
|-------|-------|
| Subscription | Azure for Students |
| Resource group | `aussie-ecolens-rg` |
| Name | `aussie-ecolens-web` (globally unique) |
| Plan type | **Free** |
| Region | **Australia East** (or nearest Free tier region) |
| Deployment source | **GitHub** |
| Organization | your GitHub user/org |
| Repository | `aussie-ecolens-clean` (your repo) |
| Branch | `main` |

3. **Build Details** (critical — Next.js static export):

| Field | Value |
|-------|-------|
| Build Presets | **Custom** |
| App location | `frontend` |
| Api location | *(leave empty)* |
| Output location | `out` |

4. **Review + create** → **Create**

Azure links GitHub and adds `AZURE_STATIC_WEB_APPS_API_TOKEN` to repo secrets automatically.

### Step 2 — Add GitHub secrets (API URLs)

Repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these (copy values from `frontend/.env.local`):

| Secret name | Example |
|-------------|---------|
| `NEXT_PUBLIC_AWS_REGION` | `ap-southeast-2` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `ap-southeast-2_1XdbAo4mu` |
| `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID` | `50d6nn8afslqudlmd37gssnv6n` |
| `NEXT_PUBLIC_AWS_API_BASE` | `https://1tj4gsxbke.execute-api...` |
| `NEXT_PUBLIC_AZURE_API_BASE` | `https://3g03m0f4v2.execute-api...` |

`AZURE_STATIC_WEB_APPS_API_TOKEN` is added by Azure when you connect GitHub.

### Step 3 — Push the workflow

Merge/commit `.github/workflows/azure-static-web-apps.yml` to `main`. GitHub Actions builds `frontend/out` and deploys.

Check: repo → **Actions** tab → workflow should go green in ~3 min.

### Step 4 — CORS + verify

```bash
./scripts/update-frontend-cors.sh https://<your-app>.azurestaticapps.net
```

---

## Option B — Manual deploy from laptop

Use if you need a one-off deploy without pushing to `main`.

```bash
cd frontend
export AZURE_SWA_DEPLOYMENT_TOKEN='<token-from-portal>'
npm run deploy:azure
```

Token: Portal → Static Web App → **Manage deployment token**.

## Step 4 — Allow uploads from your Azure URL (AWS)

Browsers block S3 uploads unless CORS allows your site origin.

Replace with your real SWA URL from the portal:

```bash
# From repo root
chmod +x scripts/update-frontend-cors.sh
./scripts/update-frontend-cors.sh https://aussie-ecolens.azurestaticapps.net
```

Also update the upload API `DevOrigin` in the AWS infra stack (the script prints the command).

## Step 5 — Verify

1. Open your `https://….azurestaticapps.net` URL
2. Sign in (Cognito)
3. Dashboard shows real data
4. Upload an image
5. Search / Manage work

## Redeploy after UI changes

**GitHub:** push to `main` — Actions redeploys automatically.

**Manual:** `cd frontend && npm run deploy:azure`

Env vars are baked in at build time — update GitHub secrets (or `.env.production.local`) if API URLs change.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `/dashboard` 404 | Redeploy — `public/staticwebapp.config.json` handles SPA routing |
| Upload CORS error | Run `update-frontend-cors.sh` with your SWA URL |
| Login works, API fails | Check `.env.production.local` Cognito + API URLs |
| `az login` fails | Portal → Azure for Students → activate subscription |
| Token invalid | Regenerate in Portal → Manage deployment token |

## Team handoff

Give markers / client:

- **Live app:** `https://<your-swa-name>.azurestaticapps.net`
- **Redeploy:** `npm run deploy:azure` with deployment token

## Cost

Static Web Apps **Free** tier fits student workloads. Stays within Azure for Students credits.
