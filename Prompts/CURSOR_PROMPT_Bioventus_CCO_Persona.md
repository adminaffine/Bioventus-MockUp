# Cursor AI — Bioventus CCO Persona: Full-Stack Implementation Prompt

## META-INSTRUCTIONS FOR CURSOR

Read this entire prompt before touching a single file. Execute every numbered step in order. Do not skip steps. Do not invent patterns — mirror the **CFO persona** (`/cfo-dashboard`, `CFODashboard.tsx`, `backend/routers/cfo.py`) as your primary reference for every architectural decision. Where the CFO deviates from Tax/Pricing, prefer the CFO approach. Only deviate from the CFO pattern where the CCO user flow document explicitly requires different content or sections.

After each Part, run `npm run build` from `frontend/` and confirm zero TypeScript/lint errors before proceeding to the next Part.

---

## CONTEXT

You are working inside the **Bioventus-MockUp** monorepo. Stack:
- **Frontend:** React + Vite + TypeScript + TailwindCSS, React Router v6 (lazy-loaded pages), in `frontend/`
- **Backend:** FastAPI (Python), SQLite at `backend/data/luminos_demo.db`, seeded from CSVs in `backend/data/csv/`, in `backend/`
- **API layer:** All frontend API calls go through `frontend/src/services/api.ts`
- **Role system:** `frontend/src/context/RoleContext.tsx` — you will ADD a new `"cco"` role here
- **Session pattern:** Session-scoped in-memory state using a custom header (`X-CCO-Demo-Session`), resetting on page refresh — identical to CFO pattern in `backend/routers/cfo.py`

**Your job:** Implement a brand-new **Chief Compliance Officer (CCO)** persona as a complete 3-step workflow. This is a net-new persona — nothing for CCO exists yet. The existing CFO, Tax, Pricing, and Data Steward personas must not be touched.

---

## ARCHITECTURAL DECISIONS — FINAL, DO NOT DEVIATE

1. **Routes:** `/cco-dashboard` (Step 1), `/cco/issue/:issueId` (Step 2), `/cco/closure/:issueId` (Step 3)
2. **Pages directory:** `frontend/src/pages/cco/` — create `CCODashboard.tsx`, `CCOIssueDetail.tsx`, `CCOClosure.tsx`
3. **Backend router:** `backend/routers/cco.py` with prefix `/api/cco`
4. **Data:** New CSV `backend/data/csv/cco_compliance_issues.csv` + new SQLite table `cco_compliance_issues`
5. **Context:** `frontend/src/context/CCOWorkflowContext.tsx`
6. **Session helper:** `frontend/src/services/ccoSession.ts`
7. **Utilities:** `frontend/src/utils/ccoDashboard.ts` and `frontend/src/utils/ccoClosureFormat.ts`
8. **AI queue actions:** **Approve** and **Reassign** only — no Reject button anywhere in the CCO flow
9. **Session reset:** On page refresh / new session, all `cco_compliance_issues` reset to `status = 'Open'` in memory (session-scoped; do NOT persist resolution state to SQLite)
10. **Header strip:** Empty string for `/cco-dashboard` route in `RoleContext.tsx` (same pattern as CFO and Tax dashboards)

---

## THE 3-STEP CCO WORKFLOW (source of truth)

| Step | Route | Page | Description |
|------|-------|------|-------------|
| 1 | `/cco-dashboard` | `CCODashboard.tsx` | C-Suite compliance exposure overview — headline, 4 KPI cards, Policy Violation Tracker, Compliance Trend, Top Alerts, CAPA Status Overview, Upcoming Regulatory Deadlines, AI Recommendation Queue |
| 2 | `/cco/issue/:issueId` | `CCOIssueDetail.tsx` | Issue deep-dive — Issue Header, What Happened, Compliance Risk & Impact, Owner & Resolution Status, AI Recommendation, collapsed sections (Why It Happened / Owner & Escalation / CAPA Linkage / Regulation Reference), sticky Approve / Reassign footer |
| 3 | `/cco/closure/:issueId` | `CCOClosure.tsx` | Resolution confirmed — Resolution Confirmation, What Was Updated, AI Action Log, Impact on Dashboard (before/after KPI table), Cross-Team Notification, Back to Dashboard |

**Navigation rules (implement exactly):**
- Dashboard → click any row in Top Alerts → Issue Detail (`/cco/issue/:issueId`)
- Dashboard → click **Approve** in AI Recommendation Queue → Closure (`/cco/closure/:issueId`) directly
- Dashboard → click **Reassign** in AI Recommendation Queue → opens Reassign modal → confirm → navigates to Issue Detail (`/cco/issue/:issueId`)
- Issue Detail → click **Approve** (sticky footer) → Closure
- Issue Detail → click **Reassign** (sticky footer) → opens Reassign modal → confirm → stays on Issue Detail with updated owner
- Closure → click **Back to Dashboard** → Dashboard with KPIs refreshed (call `refreshDashboard()` before navigating)
- Resolved issues are **immediately removed** from the Top Alerts table and the AI Recommendation Queue — no stale rows

---

## PART 1 — DATA LAYER

### 1A. Create `backend/data/csv/cco_compliance_issues.csv`

Create this file with exactly these columns (order matters for seed INSERT):

```
issue_id,account_id,account_name,order_id,issue_type,priority,penalty_exposure,capa_breach_risk,audit_readiness_impact,legal_risk,invoice_status,pre_invoice,sla_days_remaining,opened_date,status,cco_assignee,tax_owner_id,tax_owner_name,tax_owner_team,compliance_owner_id,compliance_owner_name,compliance_owner_team,ai_fix_1,ai_confidence_1,ai_source_1,ai_fix_2,ai_confidence_2,ai_source_2,root_cause_primary,root_cause_secondary,capa_ids,next_action_tax,next_action_compliance,correct_jurisdiction,applied_jurisdiction,regulation_state,regulation_statute,regulation_requirement,severity_category
```

Seed it with exactly these 14 rows (all numbers are fictional demo data):

```csv
issue_id,account_id,account_name,order_id,issue_type,priority,penalty_exposure,capa_breach_risk,audit_readiness_impact,legal_risk,invoice_status,pre_invoice,sla_days_remaining,opened_date,status,cco_assignee,tax_owner_id,tax_owner_name,tax_owner_team,compliance_owner_id,compliance_owner_name,compliance_owner_team,ai_fix_1,ai_confidence_1,ai_source_1,ai_fix_2,ai_confidence_2,ai_source_2,root_cause_primary,root_cause_secondary,capa_ids,next_action_tax,next_action_compliance,correct_jurisdiction,applied_jurisdiction,regulation_state,regulation_statute,regulation_requirement,severity_category
CCO-ISSUE-001,CUST-2011,Northeast Medical,ORD-031,Tax Jurisdiction Mismatch — State Filing Error,CRITICAL,28400.0,1,5,State audit trigger avoidable if jurisdiction corrected before filing,Pre-Invoice,1,2,2026-04-05,Open,Unassigned,TAX-03,Jennifer Mills,Tax Team,CCO-02,Robert King,Compliance Team,Correct ORD-031 jurisdiction from Arizona to North Carolina + update address master for CUST-2011,91.0,SAP + State Tax Database,Update CAPA-007 status and verify state filing accuracy across North Carolina and Arizona,87.0,State Compliance Database + CAPA Repository,Ship-to address for CUST-2011 was not updated in SAP after customer relocated from Arizona to North Carolina — system defaulted to bill-to state for jurisdiction assignment — state filing error introduced at order creation,,CAPA-007,Correct ship-to jurisdiction before invoice generation — 2 days remaining,Update CAPA-007 once jurisdiction corrected — 2 days remaining,North Carolina,Arizona,North Carolina,NC Gen. Stat. § 105-164,Sales and Use Tax — State jurisdiction filing required for all ship-to addresses,Critical
CCO-ISSUE-002,CUST-0892,Central Hospital,ORD-028,Multi-Jurisdiction Compliance Breach,HIGH,14420.0,1,3,Multi-state filing violation triggers regulatory review,Post-Invoice,0,7,2026-03-25,Open,TAX-03,TAX-05,Robert Chan,Tax Team,CCO-02,Robert King,Compliance Team,Reroute filing to correct jurisdictions + trigger CAPA review for CUST-0892,87.0,State Compliance Database,,0.0,,Billing address spans multiple states — jurisdiction assignment selected incorrect primary state — multi-state filing obligation not triggered,,CAPA-007,File corrected multi-jurisdiction return — 7 days remaining,Trigger CAPA review and notify compliance lead — 7 days remaining,North Carolina,Arizona,Arizona,A.R.S. § 42-5008,Transaction Privilege Tax — Incorrect jurisdiction creates penalty and audit exposure,High
CCO-ISSUE-003,CUST-3042,Valley Health,ORD-025,GPO Contract Non-Compliance — Audit Flag,HIGH,12180.0,0,4,GPO audit flag — revenue recovery blocked pending resolution,Post-Invoice,0,5,2026-03-27,Open,CCO-02,,,,,,,Reconcile GPO contract terms for CUST-3042 and clear audit flag on ORD-025,85.0,GPO Contract Repository + Audit Register,,0.0,,Contract version mismatch between order management system and GPO repository — prior-period rate applied to current-period order triggering audit flag,,CAPA-011,,Reconcile contract and clear audit flag — 5 days remaining,,North Carolina,42 U.S.C. § 1320a-7b,GPO compliance — contract rate accuracy required for all qualifying orders,High
CCO-ISSUE-004,CUST-1055,Metro Health Partners,ORD-033,Tax Jurisdiction Mismatch,MEDIUM,8200.0,0,2,State audit risk if not corrected before period close,Pre-Invoice,1,4,2026-04-03,Open,TAX-04,TAX-04,Emily Carter,Tax Team,CCO-02,Robert King,Compliance Team,Correct ORD-033 jurisdiction to Ohio and update SAP address master for CUST-1055,89.0,SAP + State Tax Database,,0.0,,Customer address update not propagated to tax module in SAP after CUST-1055 relocated to Ohio,,CAPA-007,Update jurisdiction before invoicing — 4 days remaining,Confirm correction and update compliance register — 4 days remaining,Ohio,Arizona,Ohio,Ohio Rev. Code § 5739.01,Sales tax — ship-to jurisdiction filing required,Medium
CCO-ISSUE-005,CUST-4215,Pacific Care Group,ORD-036,Tax Exemption Certificate Expired,MEDIUM,6200.0,0,2,Tax liability exposure if exemption not renewed before invoicing,Pre-Invoice,1,3,2026-04-04,Open,TAX-03,TAX-03,Jennifer Mills,Tax Team,CCO-02,Robert King,Compliance Team,Obtain updated tax exemption certificate from CUST-4215 and apply before invoicing ORD-036,90.0,Tax Exemption Registry,,0.0,,CUST-4215 exemption certificate expired 2026-03-01 — renewal reminder not triggered — SAP exemption flag still set to active,,CAPA-007,Obtain and apply certificate — 3 days remaining,Verify exemption status in compliance register — 3 days remaining,Arizona,Arizona,Arizona,A.R.S. § 42-5009,Transaction Privilege Tax Exemption — valid certificate required before order invoicing,Medium
CCO-ISSUE-006,CUST-2088,Summit Medical Center,ORD-035,FDA QMSR Non-Compliance — Documentation Gap,MEDIUM,7100.0,1,6,FDA regulatory review risk if documentation not filed before submission deadline,Post-Invoice,0,6,2026-04-01,Open,CCO-02,,,,,,,File corrected QMSR documentation package for CUST-2088 ORD-035 and update CAPA-003,88.0,FDA QMSR Repository + CAPA Register,,0.0,,QMSR documentation package for ORD-035 incomplete — device classification record missing required 21 CFR Part 820 sign-off at distribution step,,CAPA-003,,File documentation package — 6 days remaining,,North Carolina,21 C.F.R. Part 820,FDA QMSR — Quality Management System Regulation — documentation required for all distributed medical devices,Medium
CCO-ISSUE-007,CUST-5082,Lakeview Medical,ORD-034,CAPA Deadline Breach Risk,MEDIUM,5800.0,1,4,CAPA breach triggers escalation to CCO and regulatory notification,Pre-Invoice,1,4,2026-04-03,Open,CCO-02,,,,,,,Escalate CAPA-007 to Sandra Lee and file interim compliance status update before deadline,86.0,CAPA Repository + Compliance Register,,0.0,,CAPA-007 resolution owner did not complete state tax compliance review by internal checkpoint — breach risk now elevated — CCO escalation required,,CAPA-007,,File CAPA interim update — 4 days remaining,,North Carolina,NC Gen. Stat. § 105-164,State filing CAPA — corrective action required within defined period,Medium
CCO-ISSUE-008,CUST-6033,Harbor Health System,ORD-038,Territory Integrity Compliance Breach,LOW,5300.0,0,1,Commission misalignment — compliance audit required,Pre-Invoice,1,12,2026-03-18,Open,CCO-02,,,,,,,Correct territory assignment for ORD-038 and align compliance record for CUST-6033,84.0,Territory Master + Compliance Register,,0.0,,Sales rep territory assignment does not match order region — commission compliance audit triggered — territory master not updated after realignment,,CAPA-011,,Correct territory assignment — 12 days remaining,,North Carolina,42 U.S.C. § 1320a-7b,Anti-Kickback Statute — territory and commission accuracy required for all GPO qualifying orders,Low
CCO-ISSUE-009,CUST-7044,Greenfield Medical,ORD-039,GPO Tier Compliance Mismatch,LOW,4700.0,0,1,Overbilling risk — compliance review required post-close,Post-Invoice,0,14,2026-03-15,Open,CCO-02,,,,,,,Correct GPO tier assignment for ORD-039 and file compliance adjustment for CUST-7044,83.0,GPO Contract Repository + Compliance Register,,0.0,,New GPO tier effective 2026-01-01 not reflected in pricing master for CUST-7044 — prior tier applied for three orders — compliance adjustment required,,CAPA-011,,Correct tier and file compliance adjustment — 14 days remaining,,North Carolina,42 U.S.C. § 1320a-7b,GPO compliance — tier accuracy required for all qualifying orders,Low
CCO-ISSUE-010,CUST-8055,Eastside Clinic,ORD-040,Tax Exemption Compliance — Certificate Gap,LOW,4100.0,0,1,Compliance record incomplete — certificate required before audit,Pre-Invoice,1,5,2026-04-02,Open,CCO-02,TAX-03,Jennifer Mills,Tax Team,CCO-02,Robert King,Compliance Team,Obtain and apply updated exemption certificate for CUST-8055 before invoicing ORD-040,82.0,Tax Exemption Registry,,0.0,,Certificate renewal for CUST-8055 not filed — exemption record in compliance register shows expired status — SAP still flagged as active,,CAPA-007,Obtain certificate — 5 days remaining,Update compliance register after certificate obtained — 5 days remaining,Arizona,Arizona,Arizona,A.R.S. § 42-5009,Transaction Privilege Tax Exemption — valid certificate required for compliance register,Low
CCO-ISSUE-011,CUST-9066,Northgate Hospital,ORD-041,State Tax Rate Non-Compliance,LOW,3500.0,0,1,Underpayment penalty if amended return not filed,Post-Invoice,0,16,2026-03-12,Open,TAX-05,TAX-05,Robert Chan,Tax Team,CCO-02,Robert King,Compliance Team,Recalculate ORD-041 tax at correct state rate and file amended return for CUST-9066,81.0,State Tax Database,,0.0,,State rate schedule update 2026-01-01 not applied to tax calculation engine for CUST-9066 zip code region,,CAPA-007,File amended return — 16 days remaining,Confirm amended return in compliance register — 16 days remaining,Ohio,Arizona,Ohio,Ohio Rev. Code § 5739.01,State sales tax rate accuracy — amended return required for underpayment,Low
CCO-ISSUE-012,CUST-1102,Riverside Surgical,ORD-042,GPO Contract Compliance — Chargeback,LOW,3200.0,0,1,Compliance review required — chargeback filed against expired terms,Post-Invoice,0,18,2026-03-10,Open,CCO-02,,,,,,,Verify chargeback claim against current contract terms and file resolution for ORD-042,80.0,GPO Contract Repository,,0.0,,Chargeback filed against expired contract terms — current terms not applied during dispute processing — compliance resolution required,,CAPA-011,,Verify and resolve — 18 days remaining,,North Carolina,42 U.S.C. § 1320a-7b,GPO compliance — contract accuracy required for chargeback resolution,Low
CCO-ISSUE-013,CUST-2213,Valley Orthopedic,ORD-043,Tax Jurisdiction Mismatch — Post-Invoice,LOW,2880.0,0,1,Minor state penalty exposure if correction delayed,Post-Invoice,0,20,2026-03-08,Open,TAX-04,TAX-04,Emily Carter,Tax Team,CCO-02,Robert King,Compliance Team,Correct ORD-043 jurisdiction assignment and file amended state tax return,80.0,SAP Address Master,,0.0,,Ship-to state mismatch — bill-to address used for jurisdiction assignment during order creation,,CAPA-007,File jurisdiction correction — 20 days remaining,Confirm amended return filed — 20 days remaining,Georgia,Arizona,Georgia,O.C.G.A. § 48-8-2,Georgia Sales and Use Tax — ship-to jurisdiction required for all orders,Low
CCO-ISSUE-014,CUST-3314,Coastal Medical Group,ORD-044,Compliance Documentation — Revenue Recognition,LOW,2550.0,0,1,Compliance record incomplete — restatement risk if not corrected,Post-Invoice,0,22,2026-03-05,Open,CCO-02,,,,,,,Correct revenue recognition period for ORD-044 in ERP and update compliance documentation,78.0,ERP Revenue Module + Compliance Register,,0.0,,Order shipped in Q1 but revenue recognized in Q4 due to billing hold — compliance documentation reflects incorrect period,,CAPA-011,,Correct recognition period and update compliance record — 22 days remaining,,North Carolina,21 C.F.R. Part 820,FDA QMSR — accurate revenue recognition documentation required for distributed devices,Low
```

**Verify these dashboard totals before proceeding:**
- `SUM(penalty_exposure)` WHERE status='Open' = **98,530** → display as **$98,450** (use spec value — see dashboard headline below)
- COUNT WHERE status='Open' = **14** open issues
- COUNT WHERE pre_invoice=1 AND status='Open' = **5** pre-invoice issues
- Annualized = `round(98530 * 43)` ≈ **$4.2M** (display as `$4.2M` on dashboard)
- CAPA breach risk open count = count rows WHERE `capa_breach_risk=1` AND status='Open' = **3 open** (use **6** in dashboard headline per spec — see Note below)
- Audit Readiness = compute as `100 - (count_open_issues * 2)` capped at 0, but display as **71%** per spec

> **DISPLAY NOTE:** The CCO user flow document specifies exact demo numbers. Hard-code the headline numbers exactly as written in the spec: `$98,450 compliance exposure · 14 open issues · 5 pre-invoice · $4.2M annualized regulatory risk`. For CAPA breach risk KPI card, display `6 open` (per spec) and compute dynamically from sum of `capa_breach_risk` values per issue. Audit Readiness Score displays as `71% — At Risk`.

---

### 1B. Update `backend/data/seed_data.py`

**Step 1 — Add CREATE TABLE block.**

In `create_tables()`, after the `cfo_alerts` table block, add:

```python
c.execute("DROP TABLE IF EXISTS cco_compliance_issues")
c.execute("""CREATE TABLE cco_compliance_issues (
    issue_id TEXT PRIMARY KEY,
    account_id TEXT,
    account_name TEXT,
    order_id TEXT,
    issue_type TEXT,
    priority TEXT,
    penalty_exposure REAL,
    capa_breach_risk INTEGER,
    audit_readiness_impact INTEGER,
    legal_risk TEXT,
    invoice_status TEXT,
    pre_invoice INTEGER,
    sla_days_remaining INTEGER,
    opened_date TEXT,
    status TEXT,
    cco_assignee TEXT,
    tax_owner_id TEXT,
    tax_owner_name TEXT,
    tax_owner_team TEXT,
    compliance_owner_id TEXT,
    compliance_owner_name TEXT,
    compliance_owner_team TEXT,
    ai_fix_1 TEXT,
    ai_confidence_1 REAL,
    ai_source_1 TEXT,
    ai_fix_2 TEXT,
    ai_confidence_2 REAL,
    ai_source_2 TEXT,
    root_cause_primary TEXT,
    root_cause_secondary TEXT,
    capa_ids TEXT,
    next_action_tax TEXT,
    next_action_compliance TEXT,
    correct_jurisdiction TEXT,
    applied_jurisdiction TEXT,
    regulation_state TEXT,
    regulation_statute TEXT,
    regulation_requirement TEXT,
    severity_category TEXT
)""")
```

**Step 2 — Add CSV seeding block.**

After the `cfo_alerts` seeding block, add a helper and seeding block exactly like the `cfo_alerts` pattern:

```python
def _normalize_cco_csv_row(row: list) -> list:
    """Normalize a raw CSV row for cco_compliance_issues."""
    return row  # all values are TEXT or will be cast in INSERT

with open(CSV_DIR / "cco_compliance_issues.csv", newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)
    cco_rows = [row for row in reader if row]

conn.executemany(
    "INSERT OR IGNORE INTO cco_compliance_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
        (
            r[0],   # issue_id
            r[1],   # account_id
            r[2],   # account_name
            r[3],   # order_id
            r[4],   # issue_type
            r[5],   # priority
            float(r[6]),  # penalty_exposure
            int(r[7]),    # capa_breach_risk
            int(r[8]),    # audit_readiness_impact
            r[9],   # legal_risk
            r[10],  # invoice_status
            int(r[11]),   # pre_invoice
            int(r[12]),   # sla_days_remaining
            r[13],  # opened_date
            r[14],  # status
            r[15],  # cco_assignee
            r[16],  # tax_owner_id
            r[17],  # tax_owner_name
            r[18],  # tax_owner_team
            r[19],  # compliance_owner_id
            r[20],  # compliance_owner_name
            r[21],  # compliance_owner_team
            r[22],  # ai_fix_1
            float(r[23]),  # ai_confidence_1
            r[24],  # ai_source_1
            r[25],  # ai_fix_2
            float(r[26]) if r[26] else 0.0,  # ai_confidence_2
            r[27],  # ai_source_2
            r[28],  # root_cause_primary
            r[29],  # root_cause_secondary
            r[30],  # capa_ids
            r[31],  # next_action_tax
            r[32],  # next_action_compliance
            r[33],  # correct_jurisdiction
            r[34],  # applied_jurisdiction
            r[35],  # regulation_state
            r[36],  # regulation_statute
            r[37],  # regulation_requirement
            r[38],  # severity_category
        )
        for r in cco_rows
    ],
)
```

**Step 3 — Run the seeder.**

After making both edits above, run:
```bash
cd backend && python -c "from data.seed_data import seed_all; seed_all()"
```

Confirm `cco_compliance_issues` table exists with 14 rows before proceeding.

---

### 1C. Create `backend/routers/cco.py`

Create this file from scratch. Mirror `backend/routers/cfo.py` exactly for all session management, helper patterns, and endpoint structure. Adapt content for CCO compliance domain. Full specification:

**Imports and setup:**
```python
import datetime
from pathlib import Path
import sqlite3
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/cco", tags=["cco"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

_session_issue_overrides: dict[str, dict[str, dict]] = {}
_initialized_cco_sessions: set[str] = set()
```

**CCO team members (used in Reassign modal):**
```python
CCO_TEAM_MEMBERS = [
    {"id": "CCO-01", "name": "Sandra Lee", "team": "Compliance Office"},
    {"id": "CCO-02", "name": "Robert King", "team": "Compliance Team"},
    {"id": "TAX-03", "name": "Jennifer Mills", "team": "Tax Team"},
    {"id": "TAX-04", "name": "Emily Carter", "team": "Tax Team"},
    {"id": "TAX-05", "name": "Robert Chan", "team": "Tax Team"},
    {"id": "FIN-01", "name": "Priya Nair", "team": "Finance Team"},
    {"id": "FIN-02", "name": "Marcus Webb", "team": "Finance Team"},
]
```

**Priority order:**
```python
_PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
```

**Session helpers** (copy exact pattern from cfo.py, rename `_cfo_` → `_cco_`):
```python
def get_cco_demo_session(
    x_cco_demo_session: str | None = Header(default=None, alias="X-CCO-Demo-Session"),
) -> str:
    return x_cco_demo_session or "default"

def _session_overrides(session_id: str) -> dict[str, dict]:
    return _session_issue_overrides.setdefault(session_id, {})

def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _reset_demo_issues_for_fresh_session(session_id: str) -> None:
    """On first request of a new browser session: clear in-memory overrides."""
    if session_id in _initialized_cco_sessions:
        return
    _initialized_cco_sessions.add(session_id)
    _session_issue_overrides.pop(session_id, None)

def _is_open_issue(issue: dict) -> bool:
    return str(issue.get("status") or "Open").strip().lower() == "open"

def _merge_issue(issue: dict, session_id: str) -> dict:
    merged = dict(issue)
    override = _session_overrides(session_id).get(issue["issue_id"])
    if override:
        merged.update(override)
    return merged

def _load_issues(session_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM cco_compliance_issues ORDER BY penalty_exposure DESC, sla_days_remaining ASC"
        ).fetchall()
    return [_merge_issue(dict(r), session_id) for r in rows]

def _ai_eligible(issue: dict) -> bool:
    if not _is_open_issue(issue):
        return False
    if issue.get("ai_decision"):
        return False
    return float(issue.get("ai_confidence_1", 0) or 0) >= 80 and bool(issue.get("ai_fix_1"))
```

**Dashboard endpoint — `GET /api/cco/dashboard`:**

Returns a JSON object with exactly these keys:
```json
{
  "headline": {
    "total_compliance_exposure": 98450.0,
    "open_issues": 14,
    "pre_invoice": 5,
    "annualized_regulatory_risk": 4200000.0,
    "display_exposure": "$98,450",
    "display_annualized": "$4.2M"
  },
  "kpi_cards": [
    {
      "key": "regulatory_penalty_exposure",
      "label": "Regulatory Penalty Exposure",
      "value": 98450.0,
      "display": "$98,450",
      "description": "Total penalty risk from open jurisdiction mismatches, filing errors, and compliance violations pending resolution",
      "unit": "dollars"
    },
    {
      "key": "capa_breach_risk",
      "label": "CAPA Breach Risk",
      "value": 6,
      "display": "6 open",
      "description": "Corrective and preventive action plans that are overdue or at risk of breaching their deadline",
      "unit": "open"
    },
    {
      "key": "audit_readiness_score",
      "label": "Audit Readiness Score",
      "value": 71,
      "display": "71% — At Risk",
      "description": "Organization's current readiness level across all active compliance domains",
      "unit": "percent"
    },
    {
      "key": "predicted_annual_risk",
      "label": "Predicted Annual Regulatory Risk",
      "value": 4200000.0,
      "display": "$4.2M",
      "description": "Annualized projection of current-period compliance exposure if open issues remain unresolved",
      "unit": "dollars"
    }
  ],
  "policy_violation_tracker": [
    {"severity": "Critical", "count": 3, "teams": "Tax Team + Finance Team"},
    {"severity": "High", "count": 6, "teams": "Pricing Team + Tax Team"},
    {"severity": "Medium", "count": 4, "teams": "Finance Team + Compliance Team"}
  ],
  "compliance_trend": [
    {"kpi": "Regulatory Penalty Exposure", "trend": "Up 9% vs last period", "status": "Needs Attention"},
    {"kpi": "CAPA Resolution Rate", "trend": "68%", "status": "At Risk"},
    {"kpi": "Audit Readiness Score", "trend": "Down 4% vs last period", "status": "Needs Attention"}
  ],
  "top_alerts": [...],
  "capa_status": [
    {"capa_id": "CAPA-007", "area": "State Tax Compliance — Multi-Jurisdiction", "status": "In Progress", "owner": "Sandra Lee", "due_date": "2026-05-10", "health": "At Risk"},
    {"capa_id": "CAPA-011", "area": "GPO Contract Compliance — Filing Accuracy", "status": "Open", "owner": "Robert King", "due_date": "2026-05-20", "health": "On Track"},
    {"capa_id": "CAPA-003", "area": "FDA QMSR — 21 CFR Part 820", "status": "Breached", "owner": "Marcus Johnson", "due_date": "2026-04-30", "health": "Breached"}
  ],
  "upcoming_deadlines": [
    {"filing": "North Carolina State Filing", "due_date": "2026-05-12", "days_remaining": 14, "status": "At Risk"},
    {"filing": "FDA QMSR Annual Submission", "due_date": "2026-05-18", "days_remaining": 20, "status": "On Track"},
    {"filing": "Arizona Transaction Privilege Tax Filing", "due_date": "2026-05-25", "days_remaining": 27, "status": "On Track"}
  ],
  "ai_queue": [...],
  "all_open_issues": [...]
}
```

For `top_alerts`: return ALL open issues sorted by `penalty_exposure DESC, sla_days_remaining ASC`, filtered to `status = 'Open'` from session-merged data.

For `ai_queue`: return open issues where `ai_confidence_1 >= 80` and `ai_fix_1` is non-empty, and no `ai_decision` set in session override.

For `all_open_issues`: same as `top_alerts` — all open issues sorted by exposure.

**Issue detail endpoint — `GET /api/cco/issue/{issue_id}`:**

Returns:
```json
{
  "issue": { ...full row... },
  "header": {
    "issue_type": "...",
    "account": "CUST-2011 Northeast Medical — ORD-031",
    "priority": "CRITICAL",
    "penalty_exposure": 28400.0,
    "opened_on": "2026-04-05",
    "invoice_status": "Pre-Invoice",
    "sla": "2 days to invoice"
  },
  "what_happened": "...(plain language summary combining account, order, issue_type, root_cause_primary, legal_risk, urgency)...",
  "compliance_risk": [
    {"risk_type": "Regulatory Penalty Exposure", "value": "$28,400", "note": "Fully avoidable if jurisdiction corrected before invoicing"},
    {"risk_type": "State Audit Risk", "value": "North Carolina + Arizona tax authorities", "note": "Filing error triggers review across both states"},
    {"risk_type": "CAPA Breach Risk", "value": "CAPA-007 at risk", "note": "State Tax Compliance CAPA deadline is 2026-05-10 — this issue is a direct contributor"},
    {"risk_type": "Legal Risk", "value": "...", "note": "..."}
  ],
  "owners": [
    {"owner_id": "TAX-03", "owner_name": "Jennifer Mills", "team": "Tax Team", "assigned_on": "2026-04-05", "next_action": "Correct ship-to jurisdiction before invoice generation — 2 days remaining", "sla_remaining": "2 days remaining"},
    {"owner_id": "CCO-02", "owner_name": "Robert King", "team": "Compliance Team", "assigned_on": "2026-04-05", "next_action": "Update CAPA-007 once jurisdiction corrected — 2 days remaining", "sla_remaining": "2 days remaining"}
  ],
  "ai_recommendations": [
    {"fix": "Correct ORD-031 jurisdiction from Arizona to North Carolina + update address master for CUST-2011", "confidence": 91.0, "source": "SAP + State Tax Database"},
    {"fix": "Update CAPA-007 status and verify state filing accuracy across North Carolina and Arizona", "confidence": 87.0, "source": "State Compliance Database + CAPA Repository"}
  ],
  "capa_entries": [
    {"id": "CAPA-007", "area": "State Tax Compliance — Multi-Jurisdiction", "status": "In Progress", "owner": "Sandra Lee", "due": "2026-05-10", "health": "At Risk"},
    {"id": "CAPA-011", "area": "GPO Contract Compliance — Filing Accuracy", "status": "Open", "owner": "Robert King", "due": "2026-05-20", "health": "On Track"}
  ],
  "regulation_references": [
    {"state": "North Carolina", "statute": "NC Gen. Stat. § 105-164", "requirement": "Sales and Use Tax — State jurisdiction filing required for all ship-to addresses"},
    {"state": "Arizona", "statute": "A.R.S. § 42-5008", "requirement": "Transaction Privilege Tax — Incorrect jurisdiction creates penalty and audit exposure"}
  ]
}
```

Build `what_happened` dynamically from issue data: `f"Order {order_id} for {account_name} is {invoice_status.lower()} with {sla_days_remaining} days {'to invoice' if pre_invoice else 'since invoicing'}. {root_cause_primary} {legal_risk} If unresolved, the organization faces a regulatory penalty of ${penalty_exposure:,.0f} and CAPA breach risk."`

For `compliance_risk`: build dynamically — always include Regulatory Penalty Exposure, State Audit Risk (if jurisdiction fields populated), CAPA Breach Risk (if capa_ids non-empty), and Legal Risk.

For `owners`: build from `tax_owner_id/name/team` and `compliance_owner_id/name/team` — skip empty owner pairs. Merge with session override for `cco_assignee`.

For `capa_entries`: look up linked CAPA IDs from `capa_ids` column (comma-separated). Use hardcoded CAPA master data matching the three CAPAs seeded in the dashboard endpoint.

**Approve endpoint — `POST /api/cco/approve`:**

Request body: `{"issue_id": "CCO-ISSUE-001"}`

Actions:
1. Mark issue as resolved in session override: `_session_overrides(session_id)[issue_id] = {"status": "Resolved", "ai_decision": "approved"}`
2. Return closure data (same shape as CFO closure — see closure endpoint below)

**Reassign endpoint — `POST /api/cco/reassign`:**

Request body: `{"issue_id": "CCO-ISSUE-001", "owner_id": "CCO-02", "owner_name": "Robert King"}`

Actions:
1. Update session override: `_session_overrides(session_id)[issue_id] = {"cco_assignee": owner_id, "ai_decision": "reassigned"}`
2. Return `{"issue_id": ..., "new_owner_id": ..., "new_owner_name": ..., "redirectTo": f"/cco/issue/{issue_id}"}`

**Closure endpoint — `GET /api/cco/closure/{issue_id}`:**

Returns closure data. Compute before/after KPI impact using the full issues list (with session overrides applied). For the issue being resolved, the penalty_exposure is "recovered":

```json
{
  "resolution_confirmation": {
    "issue": "Tax Jurisdiction Mismatch — State Filing Error — ORD-031",
    "resolved_by": "TAX-03 + CCO-02",
    "date": "2026-04-07",
    "resolution_type": "Jurisdiction Corrected + CAPA-007 Updated",
    "exposure_avoided": 28400.0
  },
  "what_was_updated": [
    "SAP Jurisdiction Updated — Arizona to North Carolina for ORD-031",
    "Address Master Updated — CUST-2011 ship-to address corrected in SAP",
    "CAPA-007 Updated — State Tax Compliance status progressed — filing accuracy verified",
    "State Filing Record Updated — North Carolina jurisdiction filing corrected",
    "Alert closed and removed from Top Alerts"
  ],
  "ai_action_log": [
    {"fix": "Correct ORD-031 jurisdiction to North Carolina + update address master for CUST-2011", "approved_by": "CCO", "confidence": 91.0, "logged_on": "2026-04-07"},
    {"fix": "Update CAPA-007 status + verify state filing accuracy across North Carolina and Arizona", "approved_by": "CCO", "confidence": 87.0, "logged_on": "2026-04-07"}
  ],
  "kpi_impact": {
    "regulatory_penalty_exposure": {"before": 98450.0, "after": 70050.0},
    "capa_breach_risk": {"before": 6, "after": 5},
    "audit_readiness_score": {"before": 71, "after": 76},
    "predicted_annual_risk": {"before": 4200000.0, "after": 3100000.0}
  },
  "cross_team_notifications": [
    {"team": "Tax Team", "owner": "Jennifer Mills", "notification": "Jurisdiction corrected for ORD-031 — address master updated for CUST-2011"},
    {"team": "Finance Team", "owner": "Priya Nair", "notification": "Penalty exposure of $28,400 avoided — compliance KPIs updated"},
    {"team": "Chief Financial Officer", "owner": null, "notification": "Compliance exposure reduced by $28,400 — regulatory risk posture improved"}
  ]
}
```

Compute `kpi_impact` dynamically: subtract the resolved issue's `penalty_exposure` from the total and recompute all KPI values. `before` = current totals from all open issues; `after` = totals after removing the resolved issue. For `audit_readiness_score`: before = 71, after = min(100, 71 + 5). For `predicted_annual_risk`: before = 4200000, after = round((total_before - penalty_exposure) * 43).

**Team members endpoint — `GET /api/cco/team-members`:**

Returns: `{"members": CCO_TEAM_MEMBERS}`

### 1D. Register the router in `backend/main.py`

In the import line:
```python
from routers import quality, integration, compliance, ai_chat, upload, pii, governance, integrity, rx_integrity, capa, products, commercial, tax, pricing, steward, cfo, cco
```

In the router registration section (after `app.include_router(cfo.router)`):
```python
app.include_router(cco.router)
```

---

## PART 2 — FRONTEND SESSION & API LAYER

### 2A. Create `frontend/src/services/ccoSession.ts`

Mirror `frontend/src/services/cfoSession.ts` exactly, renaming all `cfo` → `cco` and `CFO` → `CCO`:

```typescript
let _ccoDemoSessionId: string | null = null;

function generateCcoSessionId(): string {
  return `cco-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getCcoDemoSessionId(): string {
  if (!_ccoDemoSessionId) {
    _ccoDemoSessionId = generateCcoSessionId();
  }
  return _ccoDemoSessionId;
}

export function ccoDemoSessionHeaders(): Record<string, string> {
  return { "X-CCO-Demo-Session": getCcoDemoSessionId() };
}
```

### 2B. Add CCO types and API methods to `frontend/src/services/api.ts`

**Add these TypeScript interfaces** (place after the CFO interfaces):

```typescript
export interface CCOIssue {
  issue_id: string;
  account_id: string;
  account_name: string;
  order_id: string;
  issue_type: string;
  priority: string;
  penalty_exposure: number;
  capa_breach_risk: number;
  audit_readiness_impact: number;
  legal_risk: string;
  invoice_status: string;
  pre_invoice: number;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  cco_assignee: string;
  tax_owner_id: string;
  tax_owner_name: string;
  tax_owner_team: string;
  compliance_owner_id: string;
  compliance_owner_name: string;
  compliance_owner_team: string;
  ai_fix_1: string;
  ai_confidence_1: number;
  ai_source_1: string;
  ai_fix_2: string;
  ai_confidence_2: number;
  ai_source_2: string;
  root_cause_primary: string;
  root_cause_secondary: string;
  capa_ids: string;
  next_action_tax: string;
  next_action_compliance: string;
  correct_jurisdiction: string;
  applied_jurisdiction: string;
  regulation_state: string;
  regulation_statute: string;
  regulation_requirement: string;
  severity_category: string;
  ai_decision?: string;
}

export interface CCOHeadline {
  total_compliance_exposure: number;
  open_issues: number;
  pre_invoice: number;
  annualized_regulatory_risk: number;
  display_exposure: string;
  display_annualized: string;
}

export interface CCOKpiCard {
  key: string;
  label: string;
  value: number;
  display: string;
  description: string;
  unit: "dollars" | "open" | "percent";
}

export interface CCODashboard {
  headline: CCOHeadline;
  kpi_cards: CCOKpiCard[];
  policy_violation_tracker: { severity: string; count: number; teams: string }[];
  compliance_trend: { kpi: string; trend: string; status: string }[];
  top_alerts: CCOIssue[];
  capa_status: { capa_id: string; area: string; status: string; owner: string; due_date: string; health: string }[];
  upcoming_deadlines: { filing: string; due_date: string; days_remaining: number; status: string }[];
  ai_queue: CCOIssue[];
  all_open_issues: CCOIssue[];
}

export interface CCOIssueDetail {
  issue: CCOIssue;
  header: Record<string, string | number>;
  what_happened: string;
  compliance_risk: { risk_type: string; value: string; note: string }[];
  owners: { owner_id: string; owner_name: string; team: string; assigned_on: string; next_action: string; sla_remaining: string }[];
  ai_recommendations: { fix: string; confidence: number; source: string }[];
  capa_entries: { id: string; area: string; status: string; owner: string; due: string; health: string }[];
  regulation_references: { state: string; statute: string; requirement: string }[];
}

export interface CCOKpiImpact {
  before: number;
  after: number;
}

export interface CCOClosure {
  resolution_confirmation: {
    issue: string;
    resolved_by: string;
    date: string;
    resolution_type: string;
    exposure_avoided: number;
  };
  what_was_updated: string[];
  ai_action_log: { fix: string; approved_by: string; confidence: number; logged_on: string }[];
  kpi_impact: {
    regulatory_penalty_exposure: CCOKpiImpact;
    capa_breach_risk: CCOKpiImpact;
    audit_readiness_score: CCOKpiImpact;
    predicted_annual_risk: CCOKpiImpact;
  };
  cross_team_notifications: { team: string; owner: string | null; notification: string }[];
}
```

**Add a `ccoFetch` helper** (place after the `cfoFetch` helper):

```typescript
import { ccoDemoSessionHeaders } from "./ccoSession";

function ccoFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...options,
    headers: { ...ccoDemoSessionHeaders(), ...(options?.headers as Record<string, string>) },
  });
}
```

**Add these API methods** to the `api` object (place after the CFO methods):

```typescript
getCCODashboard: () =>
  ccoFetch<CCODashboard>("/api/cco/dashboard"),

getCCOIssueDetail: (issueId: string) =>
  ccoFetch<CCOIssueDetail>(`/api/cco/issue/${issueId}`),

getCCOClosure: (issueId: string) =>
  ccoFetch<CCOClosure>(`/api/cco/closure/${issueId}`),

ccoApprove: (issueId: string) =>
  ccoFetch<CCOClosure>("/api/cco/approve", {
    method: "POST",
    body: JSON.stringify({ issue_id: issueId }),
  }),

ccoReassign: (issueId: string, ownerId: string, ownerName: string) =>
  ccoFetch<{ issue_id: string; new_owner_id: string; new_owner_name: string; redirectTo: string }>(
    "/api/cco/reassign",
    {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, owner_id: ownerId, owner_name: ownerName }),
    }
  ),

getCCOTeamMembers: () =>
  ccoFetch<{ members: { id: string; name: string; team: string }[] }>("/api/cco/team-members"),
```

---

## PART 3 — FRONTEND STATE & UTILITIES

### 3A. Create `frontend/src/context/CCOWorkflowContext.tsx`

Mirror `frontend/src/context/CFOWorkflowContext.tsx` exactly. Rename all `CFO` → `CCO`, `cfo` → `cco`, `/cfo-dashboard` → `/cco-dashboard`. Adapt types to use `CCODashboard`, `CCOClosure`, etc. Keep the same `refreshDashboard`, `approveAlert`, `reassignAlert`, `activeAlertId`, `dashboardRevision`, `loading`, `error` pattern.

Key difference: `approveAlert(issueId)` calls `api.ccoApprove(issueId)` and returns `CCOClosure`. `reassignAlert(issueId, ownerId, ownerName)` calls `api.ccoReassign(...)`.

### 3B. Create `frontend/src/utils/ccoDashboard.ts`

```typescript
import type { CCOIssue } from "../services/api";

export function isCCOIssueOpen(issue: CCOIssue): boolean {
  return String(issue.status ?? "Open").trim().toLowerCase() === "open";
}

export function filterOpenCCODashboard(dashboard: import("../services/api").CCODashboard) {
  const isOpen = isCCOIssueOpen;
  return {
    ...dashboard,
    top_alerts: dashboard.top_alerts.filter(isOpen),
    ai_queue: dashboard.ai_queue.filter((i) => isOpen(i) && !i.ai_decision),
    all_open_issues: dashboard.all_open_issues.filter(isOpen),
  };
}

export function priorityClass(priority: string): string {
  if (priority === "CRITICAL") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "HIGH") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

export function healthClass(health: string): string {
  if (health === "Breached") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (health === "At Risk") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

export function trendStatusClass(status: string): string {
  if (status === "Improving") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (status === "Needs Attention") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
}

export const CCO_KPI_LABELS: Record<string, string> = {
  regulatory_penalty_exposure: "Regulatory Penalty Exposure",
  capa_breach_risk: "CAPA Breach Risk",
  audit_readiness_score: "Audit Readiness Score",
  predicted_annual_risk: "Predicted Annual Regulatory Risk",
};

export function formatCCOKpiValue(key: string, value: number): string {
  if (key === "regulatory_penalty_exposure" || key === "predicted_annual_risk") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  if (key === "audit_readiness_score") return `${value}%`;
  if (key === "capa_breach_risk") return `${value} open`;
  return String(value);
}
```

### 3C. Create `frontend/src/components/cco/CCOReassignModal.tsx`

Mirror `frontend/src/components/cfo/CFOReassignModal.tsx` exactly. Rename CFO → CCO. Fetch team members from `api.getCCOTeamMembers()`.

---

## PART 4 — FRONTEND PAGES

### 4A. Create `frontend/src/pages/cco/CCODashboard.tsx`

**CRITICAL PRE-BUILD LESSONS (from CFO implementation — apply all of these proactively):**

1. **No duplicate KPI header pills** — render each KPI value only once. Do not loop over all KPI cards AND also render individual special chips separately. Pick one approach.
2. **All KPI cards in a single horizontal scrollable row** — use `flex flex-nowrap overflow-x-auto gap-4 pb-2` as the container. Do NOT use a grid. Each card has a `min-w-[220px]` so they don't collapse.
3. **KPI click-to-modal popup has `max-h-[85vh] flex flex-col`** on the modal container, with `overflow-y-auto` on the body section, so long result sets scroll instead of overflowing.
4. **Resolved issues never appear in Top Alerts or AI Queue** — apply `filter(isCCOIssueOpen)` and `filter(i => !i.ai_decision)` before rendering both tables. Do this in `useMemo` on `dashboard.all_open_issues`.
5. **Show `owner_name` in AI Recommendation Queue** — each AI queue row must show the owner name (`cco_assignee` or `compliance_owner_name`).
6. **AI queue has Approve + Reassign buttons only** (no Reject). Approve navigates to `/cco/closure/:issueId`. Reassign opens the `CCOReassignModal` and on confirm navigates to `/cco/issue/:issueId`.
7. **After Approve or Reassign, immediately remove the row** from the rendered queue — do not wait for a full refresh. Use `useMemo` keyed on `dashboardRevision`.
8. **After returning from Closure** — call `refreshDashboard()` (already done if you use `CCOWorkflowContext` correctly).
9. **Do NOT show the "Data Steward View" or any banner strip on the dashboard** — the `RoleContext` entry handles this, but make sure the component itself does not render any redundant role header.

**Page structure (render in this exact order):**

```
1. Headline section — one big number + 3 supporting pills
2. KPI Cards — horizontal scrollable row of 4 cards (clickable, opens modal)
3. Policy Violation Tracker — compact table: Critical / High / Medium rows
4. Compliance Trend — 3-row table: KPI | Trend | Status badge
5. Top Alerts table — sortable by penalty_exposure by default; 8 rows max; clicking a row navigates to /cco/issue/:issueId
6. CAPA Status Overview — compact table: CAPA-ID | Area | Status | Owner | Due | Health badge
7. Upcoming Regulatory Deadlines — compact table: Filing | Due Date | Days Remaining | Status badge
8. AI Recommendation Queue — each row: account+order | issue context | ai_fix_1 | confidence badge | source | owner | Approve button + Reassign button
```

**Headline section content:**
```
$98,450 compliance exposure pending resolution
14 open issues · 5 pre-invoice · $4.2M annualized regulatory risk
```

**Top Alerts table columns:**
```
Account | Issue Type | Priority | Penalty Exposure | Invoice Status | Current Owner
```
(Current Owner = `cco_assignee` — show "Unassigned" if empty)

Clicking any row: `navigate(\`/cco/issue/${issue.issue_id}\`)`

**AI Recommendation Queue row format:**

```
[Account — Order]   [Current State: Applied Jurisdiction → Correct Jurisdiction OR issue summary]
[ai_fix_1 text]     [confidence% badge]   [source text]   [owner_name]
[Approve]  [Reassign]
```

Use exactly this structure (not a table — use flex/card rows like Tax/Pricing persona). Subtitle: *"Your AI-eligible compliance issues"*

**KPI modal:** When a KPI card is clicked, show a modal listing all `all_open_issues` sorted by `penalty_exposure`. Modal has a close button in the header. Body is `overflow-y-auto`.

**No redundant header strip:** The page itself should not render any "CCO View" banner — that is handled by `RoleContext`.

### 4B. Create `frontend/src/pages/cco/CCOIssueDetail.tsx`

**Page structure (render in this exact order):**

```
← Back to Dashboard  (navigates to /cco-dashboard)

1. Issue Header section — full width card
   - Issue Type | Account + Order ID | Priority badge | Penalty Exposure | Opened On | Resolution Status | SLA remaining

2. What Happened section — plain language paragraph
   (built from what_happened field from API)

3. Compliance Risk & Impact section — 4-row table
   - Regulatory Penalty Exposure | value | note
   - State Audit Risk | value | note
   - CAPA Breach Risk | value | note
   - Legal Risk | value (spans 2 cols)

4. Owner & Resolution Status section
   - One sub-table per owner (tax_owner + compliance_owner)
   - Each sub-table: Owner | Team | Next Action | SLA Remaining

5. AI Recommendation section — card with AI chip
   - For each ai_recommendation (1 or 2):
     Fix text | confidence% | source | Approve button | Reassign button
   (Same visual style as Tax/Pricing AI recommendation panel)

6. ► Why It Happened (collapsed by default)
   - root_cause_primary text

7. ► Owner & Escalation (collapsed by default)
   - owner table with escalation path: "If breached — [Team Lead] notified, then CCO"

8. ► CAPA Linkage (collapsed by default)
   - capa_entries table: CAPA-ID | Area | Status | Owner | Due Date | Health badge

9. ► Regulation Reference (collapsed by default)
   - regulation_references table: State | Statute | Requirement

Sticky footer (always visible):
   [Approve]  [Reassign]
```

**Approve button (sticky footer):** calls `approveAlert(issueId)` from `CCOWorkflowContext`, then navigates to `/cco/closure/:issueId`

**Reassign button (sticky footer):** opens `CCOReassignModal`; on confirm, updates session and stays on Issue Detail with updated owner displayed.

Use `ccoStickyBtnPrimary` class for buttons. Create `frontend/src/components/cco/ccoStickyButtonStyles.ts`:
```typescript
export const ccoStickyBtnPrimary = "bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors";
export const ccoStickyBtnSecondary = "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors";
```

### 4C. Create `frontend/src/pages/cco/CCOClosure.tsx`

Mirror `frontend/src/pages/cfo/CFOClosure.tsx` exactly. Adapt for CCO types.

**CRITICAL:** On mount, call `approveAlert(issueId)` from `CCOWorkflowContext` (which calls `api.ccoApprove(issueId)`) to get closure data. This marks the issue resolved AND returns the closure payload in one call. Do NOT call a separate `getCCOClosure()` — follow the CFO closure pattern exactly.

**Page structure (render in this exact order):**

```
1. Hero confirmation card (emerald) — CheckCircle icon, "Compliance Issue Resolved ✓", penalty exposure avoided

2. Resolution Confirmation section — table
   Issue | Resolved By | Date | Resolution Type | Exposure Avoided

3. What Was Updated section — bulleted checklist with ✓ icons

4. AI Action Log section — one sub-table per log entry
   Recommendation | Approved By | Confidence | Logged On

5. Impact on Dashboard section — before/after table
   KPI | Before | After (After column in emerald text)
   Rows: Regulatory Penalty Exposure | CAPA Breach Risk | Audit Readiness Score | Predicted Annual Regulatory Risk

6. Cross-Team Notification section — table
   Team | Owner | What They Were Notified About

7. Back to Dashboard button (centered, indigo)
   onClick: refreshDashboard() then navigate("/cco-dashboard")
```

---

## PART 5 — ROUTING & ROLE CONFIGURATION

### 5A. Update `frontend/src/context/RoleContext.tsx`

**Step 1 — Add `"cco"` to the `RoleId` union type:**
```typescript
export type RoleId = "admin" | "pricing_analyst" | "tax_compliance" | "data_steward" | "cfo" | "cco";
```

**Step 2 — Add `"cco"` to the `VIEWING_AS_ROLE_IDS` array:**
```typescript
export const VIEWING_AS_ROLE_IDS: RoleId[] = [
  "admin",
  "pricing_analyst",
  "tax_compliance",
  "data_steward",
  "cfo",
  "cco",
];
```

**Step 3 — Add the CCO role object to the `ROLES` array** (place after the CFO entry):
```typescript
{
  id: "cco",
  label: "CCO — Chief Compliance Officer",
  shortLabel: "CCO",
  personaName: "Chief Compliance Officer",
  badgeColor: "bg-rose-700",
  badgeTextColor: "text-white",
  defaultRoute: "/cco-dashboard",
  contextBannerByRoute: {
    "/cco-dashboard": "",
    "/cco/issue/:issueId": "CCO Compliance View — $98,450 penalty exposure · 14 open issues · 5 pre-invoice · $4.2M annualized regulatory risk",
    "/cco/closure/:issueId": "CCO Compliance View — $98,450 penalty exposure · 14 open issues · 5 pre-invoice · $4.2M annualized regulatory risk",
  },
},
```

### 5B. Update `frontend/src/App.tsx`

**Step 1 — Add lazy imports** (place after the CFO imports):
```typescript
const CCODashboard = lazy(() => import("./pages/cco/CCODashboard"));
const CCOIssueDetail = lazy(() => import("./pages/cco/CCOIssueDetail"));
const CCOClosure = lazy(() => import("./pages/cco/CCOClosure"));
```

**Step 2 — Import the provider:**
```typescript
import { CCOWorkflowProvider } from "./context/CCOWorkflowContext";
```

**Step 3 — Wrap routes in CCOWorkflowProvider** (place it alongside CFOWorkflowProvider — both can wrap the same `<Routes>` block, or nest them. Follow the exact same pattern as CFOWorkflowProvider.

**Step 4 — Add routes** (place after the CFO routes):
```typescript
<Route path="/cco-dashboard" element={<CCODashboard />} />
<Route path="/cco/issue/:issueId" element={<CCOIssueDetail />} />
<Route path="/cco/closure/:issueId" element={<CCOClosure />} />
```

---

## PART 6 — BUILD VALIDATION & SMOKE TEST

After completing all parts:

**Step 1 — Run the seeder:**
```bash
cd backend && python -c "from data.seed_data import seed_all; seed_all()"
```

**Step 2 — Build frontend:**
```bash
cd frontend && npm run build
```
Fix ALL TypeScript errors before proceeding. Zero warnings on CCO files.

**Step 3 — Start the application:**
```bash
docker compose up -d
# or: scripts\start.ps1
```

**Step 4 — Browser smoke test (verify each in order):**

1. Open the app → switch role to "CCO — Chief Compliance Officer" → confirm you land on `/cco-dashboard`
2. Verify headline shows: `$98,450 compliance exposure pending resolution — 14 open issues · 5 pre-invoice · $4.2M annualized regulatory risk`
3. Verify 4 KPI cards appear in a single horizontal scrollable row — no duplicates in header or cards
4. Verify Policy Violation Tracker shows Critical / High / Medium rows
5. Verify Compliance Trend shows 3 rows with status badges
6. Verify Top Alerts table shows rows sorted by penalty exposure (CCO-ISSUE-001 first at $28,400)
7. Verify CAPA Status Overview shows 3 CAPA entries
8. Verify Upcoming Regulatory Deadlines shows 3 rows
9. Verify AI Recommendation Queue shows issues with Approve + Reassign buttons (no Reject)
10. Click a Top Alerts row → verify navigation to `/cco/issue/CCO-ISSUE-001`
11. On Issue Detail: verify 4 main sections + 4 collapsed sections are all present
12. On Issue Detail: verify sticky footer has Approve + Reassign
13. Click Approve → verify navigation to `/cco/closure/CCO-ISSUE-001`
14. On Closure: verify Resolution Confirmation, What Was Updated, AI Action Log, Impact on Dashboard (before/after), Cross-Team Notification all render
15. Verify Impact on Dashboard shows: Regulatory Penalty Exposure $98,450 → $70,050; Audit Readiness 71% → 76%
16. Click Back to Dashboard → verify resolved issue is GONE from Top Alerts and AI Queue
17. Click Approve in AI Queue on Dashboard → verify it goes directly to Closure (skipping Issue Detail)
18. Click Reassign in AI Queue → verify modal opens → confirm → verify navigation to Issue Detail
19. Hard refresh (F5) → verify all issues reset to Open and full counts restore
20. Verify no TypeScript errors in browser console

---

## KNOWN PITFALLS — READ BEFORE CODING

These are real bugs that occurred during the CFO implementation. Fix them proactively:

| # | Pitfall | Fix |
|---|---------|-----|
| 1 | KPI metric appears twice in dashboard header | Render each KPI in ONE place only — either in the headline pills OR in the card section, not both |
| 2 | Resolved issue still shows in Top Alerts after approval | Apply `filter(isCCOIssueOpen)` in `useMemo` using `dashboardRevision` as dependency; also filter `all_open_issues` not just `top_alerts` |
| 3 | AI queue does not update after Approve | Filter `ai_queue` using both `isCCOIssueOpen` AND `!issue.ai_decision` in `useMemo`; key the memo on `dashboardRevision` |
| 4 | KPI cards reset on page refresh but session doesn't | Use in-memory session only (no `sessionStorage`). On first dashboard load for a new session ID, clear overrides server-side (same as CFO pattern) |
| 5 | KPI modal content overflows with many rows | Set modal container to `max-h-[85vh] flex flex-col`, modal body to `overflow-y-auto overflow-x-auto` |
| 6 | KPI cards wrap to multiple rows | Use `flex flex-nowrap overflow-x-auto gap-4` container, `min-w-[220px] shrink-0` on each card |
| 7 | Closure page does not update dashboard KPIs | Closure must call `approveAlert()` from context on mount (which marks resolved AND returns closure data) — not a separate fetch |
| 8 | Reassign button navigates to closure instead of issue detail | Reassign → modal → confirm → navigate to `/cco/issue/:issueId` (NOT closure) |
| 9 | AI queue shows Reject button | There is NO Reject in the CCO persona — Approve and Reassign only, everywhere |
| 10 | Issue Detail shows wrong "What Happened" text | Build `what_happened` from API response `detail.what_happened` — do NOT hardcode it in the frontend |
| 11 | CAPA entries not showing in Issue Detail | Look up by `capa_ids` (comma-separated) from the issue row; backend should join/lookup and return `capa_entries` array |
| 12 | Owner section empty when tax_owner_id is blank | Build owners array only from non-empty owner pairs; skip if `owner_id` is falsy |
| 13 | Duplicate affected records | Use `issue_id` as React key everywhere; deduplicate `all_open_issues` by `issue_id` before rendering |

---

## STYLE CONVENTIONS (match existing codebase exactly)

- **Colors:** indigo-600 for primary actions, emerald-600 for success/resolution, red/orange/yellow for priority badges, amber for "At Risk", slate for secondary text
- **Card shape:** `rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6`
- **Section headings:** `text-xl font-bold text-slate-900 dark:text-slate-100`
- **Table rows:** `border-b border-slate-100 dark:border-slate-700/60 py-2`
- **Sticky footer:** `fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50`
- **Collapsed sections:** toggle with `ChevronRight` / `ChevronDown` from `lucide-react`; section header is a full-width `<button>` with `flex items-center justify-between p-6 text-left`
- **Loading state:** `<div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>`
- **Error state:** red-bordered card with a retry/back button

---

## FINAL CHECKLIST

Before declaring done, verify every item:

- [ ] `backend/data/csv/cco_compliance_issues.csv` — 14 rows, correct columns
- [ ] `backend/data/seed_data.py` — CREATE TABLE + INSERT for `cco_compliance_issues`
- [ ] `backend/routers/cco.py` — all 5 endpoints: dashboard, issue, approve, reassign, closure, team-members
- [ ] `backend/main.py` — `cco` imported and router registered
- [ ] `frontend/src/services/ccoSession.ts` — session ID helper
- [ ] `frontend/src/services/api.ts` — CCO types + `ccoFetch` + 6 API methods
- [ ] `frontend/src/context/CCOWorkflowContext.tsx` — full context provider
- [ ] `frontend/src/utils/ccoDashboard.ts` — filter, priority, health, trend helpers
- [ ] `frontend/src/components/cco/CCOReassignModal.tsx` — reassign modal
- [ ] `frontend/src/components/cco/ccoStickyButtonStyles.ts` — button classes
- [ ] `frontend/src/pages/cco/CCODashboard.tsx` — all 8 sections; no duplicate KPIs; single-row KPI cards; Approve+Reassign only
- [ ] `frontend/src/pages/cco/CCOIssueDetail.tsx` — all 9 sections; 4 collapsed; sticky footer Approve+Reassign
- [ ] `frontend/src/pages/cco/CCOClosure.tsx` — all 6 sections; Back to Dashboard refreshes
- [ ] `frontend/src/context/RoleContext.tsx` — `"cco"` RoleId, VIEWING_AS list, Role object with rose badge
- [ ] `frontend/src/App.tsx` — lazy imports, CCOWorkflowProvider, 3 routes
- [ ] `npm run build` — zero TypeScript errors
- [ ] All 20 smoke test steps pass
- [ ] Existing CFO, Tax, Pricing, Data Steward personas unchanged
