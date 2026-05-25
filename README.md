# BV Command Center — DI/DQ & Compliance Platform

A full-stack Data Quality & Compliance application built for BV LLC. Powered by FastAPI + React 19 + TypeScript.

## Quick Start

### Docker

```bash
docker compose up --build -d
```

Windows shortcuts:

```powershell
.\scripts\start.ps1
```

- Frontend: `http://localhost:15174` (host port → container `5174`)
- Backend API: `http://localhost:18005` (host port → container `8005`)
- API docs: `http://localhost:18005/docs`
- Built-in UI sanity checker service: `ui_sanity` (validation profile)

#### Launch + Validate (fail fast)

Use this for every new instance when you want the run to fail if screen sanity checks fail:

```bash
docker compose --profile validation up --build --abort-on-container-exit --exit-code-from ui_sanity
```

Windows shortcut:

```powershell
.\scripts\start-validated.ps1
```

What this now does automatically:
- Waits for backend and frontend healthchecks.
- Runs API-backed route sanity checks across primary screens and drill-down URLs.
- Exits non-zero if a blank screen or runtime route error is detected.

### Local

```bash
cd backend
pip install -r requirements.txt
python data/seed_data.py
uvicorn main:app --reload --host 0.0.0.0 --port 8005
```

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5174` (see `frontend/vite.config.ts`).

## Application Narrative

- Dashboard shows QMSR alert and the EXOGEN risk chain.
- Compliance highlights MDR gaps and routes to overdue CAPA-001.
- Profiler shows incomplete records; PII Shield shows HIPAA exposure.
- Integration shows broken product-to-order-to-case lineage and orphans.
- Trend shows remediation impact: DQ improves from 72% to 89%.

## Modules (11 screens)

| Screen Name | Route | Audience | Key Story |
|---|---|---|---|
| Executive Dashboard | `/` | CDO / Exec | QMSR alert, risk KPIs, top issues |
| Data Quality Profiler | `/profiler` | Data Ops | Column-level DQ root cause |
| Integration & Lineage | `/integration` | Data Engineering | Cross-system breaks and orphans |
| Regulatory Compliance | `/compliance` | CCO / QA | Regulation-by-dataset gaps |
| Data Governance | `/governance` | CDO / Governance | Stewardship, policies, trust |
| RxIntegrity | `/rx-integrity` | Medical Affairs | Duplicate doctors and prescribing risk |
| DQ Trend Simulation | `/trend` | Leadership | Before/after CAPA remediation impact |
| PII Shield | `/pii-shield` | Privacy / Compliance | PHI detection, masking, audit log |
| Upload & Analyze | `/upload` | Data Teams | Analyze external CSVs with same rules |
| CAPA Tracker | `/capa` | VP Quality | CAPA workflow linked to violations |
| Product Intelligence | `/products` | Product / Quality | Recall, FDA, and class risk by product |

## Synthetic Data Summary

| Dataset | Rows | Key DQ Issues |
|---|---:|---|
| customer_master | 28 | Duplicate IDs, null emails, mixed state codes |
| product_catalog | 25 | EXOGEN recalled, missing device class, missing FDA clearance |
| sales_orders | 30 | Orphan customers, post-recall orders, negative amounts |
| patient_support | 27 | MDR gaps, consent gaps, inactive customer cases |
| master_conflicts | 15 | CRM vs ERP email/address/status conflicts |
| DOCTORS_MASTER | 15 | James Whitfield duplicate cluster, expired/suspended licenses |
| PRESCRIPTIONS | 25 | Specialty mismatches, missing DEA/NPI, prior auth gaps |

## Regulatory Coverage

- FDA QMSR (21 CFR Part 820 / ISO 13485) — effective Feb 2, 2026
- FDA MDR (21 CFR Part 803) — adverse event reporting
- HIPAA Privacy Rule (45 CFR §164.508) — consent and PHI
- SOX Section 302/404 — revenue attribution
- EU MDR — international compliance
- 21 CFR Part 11 — electronic records
- 21 CFR Part 1306 — prescription compliance

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/datasets` | Dataset list and row counts |
| GET | `/api/dashboard/summary` | KPI summary, QMSR alert, coverage |
| GET | `/api/trend/simulation` | Remediation simulation timeline |
| GET | `/api/issues/export` | Issues CSV export |
| GET | `/api/quality/{dataset}` | Dataset quality profile |
| GET | `/api/integration/gaps` | Integration/linkage gaps |
| GET | `/api/compliance/heatmap` | Regulation heatmap |
| GET | `/api/compliance/{regulation}` | Regulation details (`fda-mdr`, `hipaa`, `qmsr`, etc.) |
| GET | `/api/pii/summary` | PII summary |
| GET | `/api/pii/dataset/{name}` | PII report for dataset |
| GET | `/api/pii/dataset/{name}/preview` | Original vs masked preview |
| GET | `/api/pii/regulations/coverage` | PII regulation coverage |
| GET | `/api/pii/audit-log` | PII audit entries |
| POST | `/api/pii/scan` | Scan uploaded CSV for PII |
| GET | `/api/governance/audit` | Governance self-audit |
| GET | `/api/governance/trust-scores` | Trust scores |
| GET | `/api/governance/policies` | Policy registry |
| GET | `/api/governance/stewards` | Steward board |
| GET | `/api/integrity/summary` | Integrity summary |
| GET | `/api/rx/summary` | RxIntegrity summary |
| GET | `/api/rx/violations` | Rx violations feed |
| GET | `/api/rx/doctors` | Doctors list (paged) |
| GET | `/api/rx/prescriptions` | Prescriptions list (paged) |
| GET | `/api/rx/duplicate-doctors` | Duplicate doctor clusters |
| GET | `/api/rx/specialty-mismatches` | Specialty mismatch records |
| GET | `/api/capa/summary` | CAPA summary and cards |
| GET | `/api/products/list` | Product quality flags |
| GET | `/api/upload/sessions` | Upload session list |

## Running the Smoke Test

- Linux/Mac: `bash scripts/smoke_test.sh`
- Windows: `.\scripts\smoke_test.ps1`

## Environment Variables

Documented in `backend/.env.example`.

- `OPENAI_API_KEY`: Enables AI assistant responses.

## License

Application use only. Synthetic data only. Not for production or real patient/customer data.
