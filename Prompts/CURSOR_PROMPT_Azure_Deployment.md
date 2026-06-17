# Cursor Prompt — Azure Deployment (Full-Stack SPA + API)

Use this document as a **Cursor agent prompt** to deploy a similar full-stack application (React/Vite frontend + FastAPI/Python backend) to the **same Azure subscription** used for the BV Command Center demo.

Copy the **[Cursor agent prompt](#cursor-agent-prompt-copy-paste)** section at the bottom into Cursor when starting a new deployment task.

---

## Architecture overview

```
Browser
   │
   ▼
┌─────────────────────────────────────────────┐
│  Azure Static Web App (Free)                │
│  Name: {prefix}-frontend                    │
│  Region: eastus2                            │
│  Serves: frontend/dist (React SPA)          │
│  Build-time env: VITE_API_URL → backend URL   │
└──────────────────┬──────────────────────────┘
                   │ HTTPS API calls
                   ▼
┌─────────────────────────────────────────────┐
│  Azure Container App (Consumption)          │
│  Name: {prefix}-backend                     │
│  Region: eastus                             │
│  Image: {acrname}.azurecr.io/{image}:{tag}  │
│  Ingress: external, port 8005               │
│  Scale: min 0 / max 1 (scale-to-zero)       │
│  CPU/Memory: 0.5 vCPU / 1.0 GiB             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Azure Container Registry (Basic)           │
│  Name: {acrname} (alphanumeric only)        │
│  Stores backend Docker images               │
└─────────────────────────────────────────────┘

All resources live in ONE resource group:
  rg_{app_slug}   (e.g. rg_bv_demo)
```

**Not provisioned** (by design for demo cost): App Insights, Key Vault, managed database, Azure Files, VNet integration, custom domains.

**Data persistence**: SQLite baked into the backend container image. Data resets on image redeploy / container recycle.

---

## Azure subscription (reference)

| Setting | Value |
|---------|-------|
| Subscription name | `Uniview` |
| Subscription ID | `82829532-e99a-45e3-aebe-645bd6f9a4bb` |
| Target budget | Under ~$15/month (demo) |

```powershell
az login
az account set --subscription 82829532-e99a-45e3-aebe-645bd6f9a4bb
az account show --query "{name:name, id:id}" -o table
```

---

## Resource group

| Convention | Example (BV demo) | Notes |
|------------|-------------------|-------|
| `rg_{app_slug}` | `rg_bv_demo` | Single RG holds **all** resources |
| Location (RG metadata) | `eastus` | RG is created in backend region |

Use **one resource group per application/environment**. Do not split frontend/backend across RGs.

---

## Naming conventions

### Pattern

| Resource | Pattern | BV demo example | Azure naming rules |
|----------|---------|-----------------|-------------------|
| Resource group | `rg_{app_slug}` | `rg_bv_demo` | letters, numbers, `_`, `-`, `.` |
| Name prefix (hyphenated) | `{slug}-` | `bvdemo-` | used for Container App, CAE, SWA |
| Container Apps environment | `{prefix}cae` | `bvdemo-cae` | lowercase, hyphens |
| Container App (API) | `{prefix}backend` | `bvdemo-backend` | lowercase, hyphens |
| Static Web App | `{prefix}frontend` | `bvdemo-frontend` | globally unique |
| ACR | `{slug}acr` | `bvdemoacr` | **alphanumeric only**, globally unique, 5–50 chars |
| Docker image repository | `{slug}-backend` | `bvdemo-backend` | pushed to ACR |
| Image tag | `1.0.0-{yyyyMMddHHmmss}` | `1.0.0-20260617141220` | timestamped per deploy |

### Placeholders for a new similar app

Replace these when deploying another app on the same subscription:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{app_slug}` | Short snake_case identifier | `bv_demo`, `acme_portal` |
| `{slug}` | Short alphanumeric slug (no underscores) | `bvdemo`, `acmeportal` |
| `{prefix}` | Hyphenated prefix for Azure resources | `bvdemo-`, `acmeportal-` |

### Regions (confirmed acceptable)

| Layer | Region | Reason |
|-------|--------|--------|
| Backend (RG, ACR, Container Apps) | `eastus` | Container Apps + ACR |
| Frontend (Static Web App) | `eastus2` | SWA supported region (can differ from RG) |

---

## Services provisioned

| # | Azure service | Resource name (BV demo) | SKU / sizing | Purpose |
|---|---------------|-------------------------|--------------|---------|
| 1 | Resource group | `rg_bv_demo` | — | Container for all resources |
| 2 | Container Apps environment | `bvdemo-cae` | Consumption | Hosts the API container |
| 3 | Container Registry | `bvdemoacr` | Basic, admin enabled | Stores backend images |
| 4 | Container App | `bvdemo-backend` | 0.5 CPU, 1 GiB, min 0 / max 1 | FastAPI on port 8005 |
| 5 | Static Web App | `bvdemo-frontend` | Free | Serves React production build |

### Backend environment variables (Container App)

| Variable | Value | Purpose |
|----------|-------|---------|
| `SKIP_STARTUP_CACHE` | `true` | Faster cold start for demo deploys |
| `CORS_ALLOW_ORIGINS` | `https://{swa-hostname}` | Set after frontend hostname is known |

### Frontend build variable

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_URL` | `https://{container-app-fqdn}` | Baked into Vite build at deploy time |

---

## Prerequisites (local machine)

Install and verify before deploying:

| Tool | Purpose |
|------|---------|
| [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`) | Provision and manage resources |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Build and push backend image (**must be running**) |
| [Node.js 18+](https://nodejs.org/) + `npm` | Build frontend |
| `@azure/static-web-apps-cli` | `npm install -g @azure/static-web-apps-cli` (script auto-installs if missing) |

Azure CLI extensions (script installs if missing):

```powershell
az extension add --name containerapp
az extension add --name staticwebapp
```

**Before deploy:**

1. `az login` — authenticated to target subscription
2. **Docker Desktop running** — `docker info` succeeds
3. **Stop local dev servers** — Vite/Node can lock `esbuild.exe` and break `npm ci`
4. No merge conflicts / clean `npm run build` locally (optional sanity check)

---

## Deployment paths in this repo

### Path A — Monolithic local deploy (recommended for quick demo)

**Script:** `scripts/azure_deploy.ps1`

Single PowerShell script performs end-to-end:

1. Create/ensure resource group
2. Create Container Apps environment
3. Create/reuse ACR, build & push Docker image
4. Create/update Container App
5. Create Static Web App (Free)
6. Set `VITE_API_URL` on SWA
7. `npm ci` + `npm run build` frontend
8. `swa deploy` to production
9. Set backend `CORS_ALLOW_ORIGINS`

```powershell
cd <repo-root>
.\scripts\azure_deploy.ps1
```

**Expected output:**

```
Frontend:  https://<random-name>.azurestaticapps.net
Backend:   https://bvdemo-backend.<env>.eastus.azurecontainerapps.io
```

**Typical duration:** 15–20 minutes (Docker build, npm build, SWA upload).

---

### Path B — Hybrid provision + GitHub Actions (CI/CD)

For teams without App Registration / OIDC permissions. Uses ACR admin credentials + SWA deployment token.

| Step | Where | Command / action |
|------|-------|------------------|
| 1. Provision infra | Local | `.\scripts\azure\provision.ps1` |
| 2. Add GitHub secrets | GitHub UI | ACR creds + SWA token (printed by provision script) |
| 3. Build/push backend image | GitHub Actions | Run workflow `bv-deploy-backend` |
| 4. Activate backend image | Local | `.\scripts\azure\update-backend.ps1` |
| 5. Deploy frontend | GitHub Actions | Run workflow `bv-deploy-frontend` |

**Alternate naming in Path B** (see `.azure/plan.md`):

| Resource | Path A (azure_deploy.ps1) | Path B (provision.ps1) |
|----------|---------------------------|------------------------|
| Resource group | `rg_bv_demo` | `rg-bv-mockup` |
| Prefix | `bvdemo-` | `bv-` |
| ACR | `bvdemoacr` | `bvacrmockup` |
| Container App | `bvdemo-backend` | `bv-api` |
| Static Web App | `bvdemo-frontend` | `bv-demo` |

> **Use one path per environment.** Do not mix Path A and Path B resource names in the same deployment.

---

## End-to-end procedure (Path A — copy for new app)

### 1. Customize naming in `scripts/azure_deploy.ps1`

Edit the configuration block:

```powershell
$RG = "rg_{app_slug}"           # e.g. rg_acme_demo
$Prefix = "{slug}-"             # e.g. acmeportal-
$BackendLocation = "eastus"
$FrontendLocation = "eastus2"
$SwaName = "${Prefix}frontend"  # e.g. acmeportal-frontend
$CaeName = "${Prefix}cae"
$BackendAppName = "${Prefix}backend"
$AcrName = "{slug}acr"          # alphanumeric only, globally unique
$BackendCpu = "0.5"
$BackendMemory = "1.0Gi"
```

Update the Docker image repository name:

```powershell
$Image = "$AcrLoginServer/{slug}-backend:$ImageTag"
```

### 2. Ensure backend is container-ready

- `backend/Dockerfile` exists
- API listens on **port 8005** (`uvicorn main:app --host 0.0.0.0 --port 8005`)
- SQLite seed data under `backend/data/` (run `python data/seed_data.py` locally if needed)

### 3. Ensure frontend is build-ready

- `frontend/package.json` has `"build": "tsc -b && vite build"`
- API URL read from `import.meta.env.VITE_API_URL`
- SPA routing: `frontend/staticwebapp.config.json` with `navigationFallback` → `/index.html`

### 4. Deploy

```powershell
# Stop local dev servers (avoid npm ci file locks)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Ensure Docker is running
docker info

# Deploy
cd <repo-root>
.\scripts\azure_deploy.ps1
```

### 5. Verify

```powershell
# Replace with URLs from script output
curl -I https://<swa-hostname>/
curl -I https://<backend-fqdn>/api/dashboard/summary
curl -I https://<backend-fqdn>/docs
```

### 6. Launch in browser

```powershell
start https://<swa-hostname>
start https://<backend-fqdn>/docs
```

---

## Teardown procedure

**Script:** `scripts/azure_destroy.ps1`

Deletes the resource group and **all** contained resources (async).

```powershell
# Interactive (type DELETE to confirm)
.\scripts\azure_destroy.ps1

# Non-interactive
.\scripts\azure_destroy.ps1 -Force
```

Also removes legacy group `rg_didq` if it still exists.

**Monitor deletion** (Container Apps environment is slowest, 10–20+ min):

```powershell
az group show -n rg_bv_demo --query properties.provisioningState -o tsv
# When gone:
az group show -n rg_bv_demo
# → ResourceGroupNotFound
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ResourceGroupNotFound` during deploy wait | Normal on first deploy | Script handles this; ensure `Invoke-AzAllowNotFound` pattern is present |
| `ACR login failed` / Docker pipe error | Docker Desktop not running | Start Docker Desktop, wait for `docker info` |
| `npm ci failed` EPERM on `esbuild.exe` | Local Vite dev server locking files | Stop all `node` processes, retry deploy |
| `tsc` merge conflict errors | Unresolved git merge markers | Resolve conflicts, then rebuild |
| `bvdemoacr` create fails (name taken) | ACR name globally unique | Pick a different `{slug}acr` |
| Backend 504 / slow first request | Scale-to-zero cold start | Wait 30–60s; expected with `min-replicas 0` |
| SWA shows app but API fails | Wrong `VITE_API_URL` | Redeploy frontend with correct backend FQDN |
| RG stuck in `Deleting` | CAE teardown in progress | Wait; check `az resource list -g rg_bv_demo` |

---

## Cost estimate (demo sizing)

| Service | Approx. monthly |
|---------|-----------------|
| Static Web App Free | $0 |
| Container Apps (scale-to-zero, light traffic) | $0–8 |
| ACR Basic | ~$5 |
| **Total** | **~$5–14** |

---

## Customization checklist (new similar app)

- [ ] Choose `{app_slug}`, `{slug}`, `{prefix}` — verify ACR name availability: `az acr check-name --name {slug}acr`
- [ ] Update `scripts/azure_deploy.ps1` naming variables
- [ ] Update `scripts/azure_destroy.ps1` `$RG` (and legacy RG if any)
- [ ] Confirm `backend/Dockerfile` and port `8005`
- [ ] Confirm frontend uses `VITE_API_URL`
- [ ] Add `frontend/staticwebapp.config.json` for SPA routes
- [ ] Run `az login` + select subscription
- [ ] Start Docker Desktop
- [ ] Stop local Node/Vite processes
- [ ] Run `.\scripts\azure_deploy.ps1`
- [ ] Verify frontend + `/docs` endpoints
- [ ] Record deployed URLs for the team

---

## Cursor agent prompt (copy-paste)

```
You are deploying a full-stack application to Azure on subscription 82829532-e99a-45e3-aebe-645bd6f9a4bb (Uniview).

## Application shape
- Frontend: React + Vite + TypeScript in `frontend/`
- Backend: FastAPI + Python in `backend/`, port 8005, SQLite in container
- Deploy script: `scripts/azure_deploy.ps1` (monolithic local deploy)
- Destroy script: `scripts/azure_destroy.ps1`

## Target naming (customize per app)
- Resource group: rg_{app_slug}          (example: rg_bv_demo)
- Prefix: {slug}-                       (example: bvdemo-)
- Container Apps env: {prefix}cae        (example: bvdemo-cae)
- Container App: {prefix}backend         (example: bvdemo-backend)
- Static Web App: {prefix}frontend       (example: bvdemo-frontend)
- ACR: {slug}acr                         (example: bvdemoacr — alphanumeric only, globally unique)
- Docker image: {slug}acr.azurecr.io/{slug}-backend:{tag}

## Regions
- Backend (RG, ACR, Container Apps): eastus
- Frontend (Static Web App): eastus2

## Sizing (demo defaults — do not change unless asked)
- Container App: 0.5 CPU, 1.0 GiB, min-replicas 0, max-replicas 1
- ACR: Basic SKU, admin enabled (reused across deploys)
- SWA: Free SKU
- No App Insights, Key Vault, managed DB, or Azure Files

## Your tasks
1. Read `scripts/azure_deploy.ps1` and confirm naming variables match the target app.
2. Fix any build blockers (merge conflicts, TypeScript errors) before deploying.
3. Prerequisites: `az login`, Docker Desktop running, local Node/Vite stopped.
4. Run `.\scripts\azure_deploy.ps1` from repo root.
5. On success, verify HTTP 200 on frontend URL and backend `/api/dashboard/summary` and `/docs`.
6. Open frontend and API docs in the browser.
7. Report final URLs and any errors encountered.

## Destroy (only when asked)
Run `.\scripts\azure_destroy.ps1 -Force` to delete rg_{app_slug} and all resources.

## Do not assume
- Ask before changing regions, SKU tiers, scale limits, or adding new Azure services.
- Ask before creating a second resource group.
- Do not commit or push unless explicitly requested.
```

---

## Related files in this repo

| File | Purpose |
|------|---------|
| `scripts/azure_deploy.ps1` | End-to-end local deploy (Path A) |
| `scripts/azure_destroy.ps1` | Tear down resource group(s) |
| `scripts/azure/provision.ps1` | One-time infra only (Path B) |
| `scripts/azure/update-backend.ps1` | Point Container App at latest ACR image (Path B) |
| `.azure/plan.md` | Detailed plan for Path B / GitHub Actions |
| `.github/workflows/bv-deploy-backend.yml` | CI: build + push backend to ACR |
| `.github/workflows/bv-deploy-frontend.yml` | CI: build + deploy frontend to SWA |
| `frontend/staticwebapp.config.json` | SPA fallback routing for SWA |
| `backend/Dockerfile` | Dev/demo container image (Path A) |
| `backend/Dockerfile.prod` | Production image with baked DB (Path B) |
