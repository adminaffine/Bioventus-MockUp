# Cursor AI — Bioventus Data Governance Platform: Data Steward Persona Full-Stack Implementation Prompt

## CODEBASE CONTEXT — READ THIS FIRST

You are working inside the **Bioventus-MockUp** monorepo. The stack is:
- **Frontend:** React + Vite + TypeScript + TailwindCSS, React Router v6 (lazy-loaded pages), located in `frontend/`
- **Backend:** FastAPI (Python), SQLite database at `backend/data/luminos_demo.db`, seeded from CSVs in `backend/data/csv/`
- **API layer:** All frontend API calls go through `frontend/src/services/api.ts`
- **Role system:** `frontend/src/context/RoleContext.tsx`

**Two full personas already exist — study them both before writing one line of code:**

| Reference File | What to study |
|----------------|---------------|
| `backend/routers/pricing.py` | Session management, `_load_issues()`, `_merge_issue()`, `_workflow_status()`, `_can_mark_resolved()`, all 8 endpoints |
| `backend/routers/tax.py` | Same pattern, tax-specific fields. Cross-check both to understand the shared skeleton |
| `frontend/src/services/taxSession.ts` | Demo session ID pattern — copy this for `stewardSession.ts` |
| `frontend/src/config/taxTeamNav.ts` | Sidebar nav section pattern — mirror exactly |
| `frontend/src/config/pricingTeamNav.ts` | Additional nav reference |
| `frontend/src/pages/pricing/PricingDashboard.tsx` | KPI card → popup modal (evolved final pattern) |
| `frontend/src/pages/pricing/PricingIssueIntelligence.tsx` | Mark Resolved gating, sticky footer, accordion sections, AI approve/reject |
| `frontend/src/pages/pricing/PricingTransactionLineage.tsx` | Sticky CTA, action buttons, popup modal for View Contract |
| `frontend/src/pages/pricing/PricingClosure.tsx` | KPI before/after table, dynamic formatting |
| `frontend/src/utils/pricingClosureFormat.ts` | KPI formatting utility — copy and adapt |
| `frontend/src/pages/tax/TaxDashboard.tsx` | Second reference for dashboard pattern |
| `frontend/src/pages/tax/IssueIntelligence.tsx` | Second reference for issue intelligence |
| `frontend/src/pages/tax/TaxClosure.tsx` | Second reference for closure |
| `frontend/src/utils/taxWorkflowStorage.ts` | Blinking dot / rejected state storage pattern |
| `frontend/src/utils/pricingWorkflowStorage.ts` | Blinking button state storage — copy for steward |

**Your job is to implement a 4-step Data Steward persona workflow — additive only, touching NO existing files except where explicitly instructed.**

---

## DECISIONS PRE-MADE — Apply these exactly, no choices needed

| Decision | Value |
|----------|-------|
| New Role ID | `data_steward` |
| Logged-in Data Steward | DS-02 — Jordan Lee |
| Other stewards in pool | DS-01 — Rachel Torres · DS-03 — Ethan Park |
| Route prefix | `/steward-*` and `/steward/*` |
| Sidebar section label | `DATA STEWARD` |
| Visible to roles | `data_steward` and `admin` |
| Default route for `data_steward` | `/steward-dashboard` |
| Step 3 page | Record Deep Dive (NOT Transaction Lineage) — route param is `customerId` |
| CAPA note | CAPA-007 is already taken in `capa.py` by Tax persona. Use **CAPA-009** for all Data Steward issues. Add CAPA-009 to `capa.py`. |
| Session header | `X-Steward-Demo-Session` |
| Dataset size | 20 issues across 5 categories |
| Demo issue (full 4-step flow) | DS-ISS-001 — CUST-1887 Riverside Clinic — Hierarchy Mismatch |
| Dashboard headline numbers | $89,240 at risk · 5 hierarchy mismatches · 3 orphan records · 6 tax jurisdiction gaps · $2.1M annualized exposure |

---

## THE 4-STEP DATA STEWARD WORKFLOW (source of truth)

| Step | Route | Page File | Description |
|------|-------|-----------|-------------|
| 1 | `/steward-dashboard` | `StewardDashboard.tsx` | Data quality health · KPI cards · Top 5 alerts · AI recommendation queue · My action queue |
| 2 | `/steward/issue/:issueId` | `StewardIssueIntelligence.tsx` | Issue deep-dive — what happened, business risk, owner, AI fix, affected records |
| 3 | `/steward/record/:customerId` | `StewardRecordDeepDive.tsx` | SAP master record detail — hierarchy breakdown, what went wrong, apply correction |
| 4 | `/steward/closure/:issueId` | `StewardClosure.tsx` | Resolution confirmation · KPI delta · AI audit log · cross-team notifications |

**Navigation flow:**
Dashboard → click alert row or "Fix" button → Issue Intelligence → click customer in Affected Records → Record Deep Dive → click "Fix Issue" or approve AI → Closure → "Back to Dashboard" → Step 1 with updated KPIs.

---

## PART 1 — DATA LAYER

### 1A. Create `backend/data/csv/data_steward_issues.csv`

**Column order (33 columns):**
`issue_id,customer_id,customer_name,issue_type,priority,dollar_value,hierarchy_level,current_idn,correct_idn,current_idn_name,correct_idn_name,current_jurisdiction,correct_jurisdiction,owner_id,owner_name,sla_days_remaining,opened_date,status,open_orders,contract_id,ai_fix,ai_confidence,ai_source,root_cause,effective_date,last_updated,source_system,capa_id,risk_pricing,risk_tax,risk_credit,risk_gpo,ai_decision`

```csv
issue_id,customer_id,customer_name,issue_type,priority,dollar_value,hierarchy_level,current_idn,correct_idn,current_idn_name,correct_idn_name,current_jurisdiction,correct_jurisdiction,owner_id,owner_name,sla_days_remaining,opened_date,status,open_orders,contract_id,ai_fix,ai_confidence,ai_source,root_cause,effective_date,last_updated,source_system,capa_id,risk_pricing,risk_tax,risk_credit,risk_gpo,ai_decision
DS-ISS-001,CUST-1887,Riverside Clinic,Hierarchy Mismatch,HIGH,12400.0,Hospital,IDN-003,IDN-007,MedStar Alliance,Memorial Health System,IDN-003,IDN-007,DS-02,Jordan Lee,2,2026-04-10,Open,ORD-214;ORD-218,GPC-007,"Update CUST-1887 parent IDN from IDN-003 to IDN-007 in SAP master + trigger re-pricing on open orders",93.0,IQVIA Roster + GPO Roster Delta,IQVIA roster update from March 2026 showed CUST-1887 moved to IDN-007 but the SAP master was not updated — no automated sync is in place and the manual update cycle runs quarterly. The gap has existed for 6 weeks.,2026-03-01,2026-02-15,SAP,CAPA-009,"Contract tier mismatch — wrong price applied to open orders — $8,200 exposure","Wrong tax jurisdiction applied to invoices — $1,105 exposure","Credit limit evaluated against wrong IDN parent — hold risk","GPO fees calculated against incorrect membership tier",
DS-ISS-002,CUST-2201,Memorial Health,Hierarchy Mismatch,CRITICAL,34500.0,Hospital,,,,,IDN-003,,Unassigned,Unassigned,1,2026-04-08,Open,ORD-301;ORD-302,GPC-021,"Assign CUST-2201 to IDN-007 Memorial Health System in SAP master — IQVIA roster confirms affiliation",94.0,IQVIA Roster,No IDN assigned at customer creation — CUST-2201 onboarded without hierarchy mapping in SAP. Revenue has been unmapped for 8 weeks.,2026-02-10,2026-02-10,SAP,CAPA-009,"All pricing calculated at list price — no IDN contract rate applied — $18,400 exposure","Tax jurisdiction defaults to billing state — not verified against IDN — $2,800 exposure","Credit limit not anchored to IDN parent — unlimited exposure risk","No GPO membership credit — customer paying outside contracted rates",
DS-ISS-003,CUST-3340,Lake View Surgery,Tax Jurisdiction Gap,HIGH,8100.0,Clinic,IDN-001,IDN-001,Southeast Health System,Southeast Health System,NC,TX,DS-02,Jordan Lee,3,2026-04-09,Open,ORD-215;ORD-219,GPC-012,"Correct Sold-To jurisdiction for CUST-3340 from NC to TX in SAP address master + re-calculate tax on ORD-215 and ORD-219",91.0,Address Validation + SAP Audit,Sold-To address for CUST-3340 relocated to Texas Q1 2026 — SAP address master not updated. All invoices since relocation charged North Carolina tax rate.,2026-01-15,2026-01-15,SAP,CAPA-009,"Pricing unaffected — IDN mapping is correct","Tax overcollection of $8,100 across open invoices — refund or credit required","Credit limit correct — IDN parent unchanged","GPO membership unaffected",
DS-ISS-004,CUST-0892,Apex Ortho Group,Orphan Record,MEDIUM,6750.0,Clinic,,,,,,,,DS-01,Rachel Torres,4,2026-04-07,Open,,,"Assign CUST-0892 to nearest IDN parent based on IQVIA affiliation signals — IDN-002 Carolina Medical Group confirmed",88.0,IQVIA Roster,CUST-0892 created in SAP without parent hierarchy assignment. Record has been orphaned since account creation. Revenue from this account is unmapped to any IDN.,2026-01-01,2026-01-10,SAP,CAPA-009,"No IDN contract applied — all orders priced at list rate — $4,200 revenue exposure","Tax defaults to account billing state — not cross-validated","No credit parent — individual credit limit only","No GPO enrollment possible without IDN parent",
DS-ISS-005,CUST-4412,Northside Clinic,Stale Master Record,MEDIUM,4200.0,Clinic,IDN-002,IDN-002,Carolina Medical Group,Carolina Medical Group,NC,NC,Unassigned,Unassigned,6,2026-04-05,Open,ORD-220,,Refresh CUST-4412 from SAP master — IQVIA match confirmed — last validated 6 months ago,91.0,SAP Audit Log,CUST-4412 record was last validated against IQVIA data in October 2025 — 6 months ago. Potential IDN movement or address change not detected.,2025-10-01,2025-10-01,SAP,CAPA-009,"Pricing may reflect outdated contract — refresh required","Tax jurisdiction may be stale — revalidation required","Credit limit may not reflect current IDN standing","GPO tier may have changed — undetected without IQVIA sync",
DS-ISS-006,CUST-1120,Greenfield Medical,Orphan Record,MEDIUM,5200.0,Clinic,,,,,,,,Unassigned,Unassigned,7,2026-04-06,Open,,,"Assign CUST-1120 to IDN-003 MedStar Alliance based on IQVIA affiliation data",86.0,IQVIA Roster,CUST-1120 was onboarded via a third-party distributor channel — SAP hierarchy mapping was skipped during rapid onboarding.,2026-01-15,2026-01-15,SAP,CAPA-009,"List pricing applied — no IDN contract","Tax jurisdiction unvalidated","No credit parent","Not enrolled in GPO",
DS-ISS-007,CUST-2290,Bayside Orthopedics,Orphan Record,LOW,3100.0,Clinic,,,,,,,,DS-03,Ethan Park,10,2026-04-03,Open,,,"Assign CUST-2290 to IDN-001 Southeast Health System — IQVIA signal confirmed",84.0,IQVIA Roster,CUST-2290 record imported from legacy CRM system during migration — hierarchy fields left blank in migration script.,2026-02-01,2026-02-01,SAP,CAPA-009,"Pricing at list rate","Tax not validated","Credit standalone only","GPO unmapped",
DS-ISS-008,CUST-1510,Valley Surgical Partners,Hierarchy Mismatch,HIGH,9800.0,Hospital,IDN-001,IDN-003,Southeast Health System,MedStar Alliance,NC,NC,DS-03,Ethan Park,3,2026-04-09,Open,ORD-230,GPC-015,"Update CUST-1510 parent IDN from IDN-001 to IDN-003 in SAP master + re-price ORD-230",90.0,IQVIA + GPO Delta,CUST-1510 was acquired by MedStar Alliance in February 2026 — IQVIA roster signal confirmed affiliation change but SAP master not updated.,2026-02-20,2026-01-15,SAP,CAPA-009,"Wrong GPO contract applied — $9,800 pricing exposure","Tax jurisdiction unaffected — same state","Credit limit anchored to wrong IDN","GPO fees invoiced against IDN-001 — should be IDN-003",
DS-ISS-009,CUST-2011,Metro Spine Center,Tax Jurisdiction Gap,HIGH,7400.0,Hospital,IDN-002,IDN-002,Carolina Medical Group,Carolina Medical Group,NC,AZ,DS-02,Jordan Lee,5,2026-04-08,Open,ORD-222,GPC-009,"Correct Sold-To jurisdiction for CUST-2011 from NC to AZ in SAP address master",89.0,Address Validation,CUST-2011 relocated main office to Arizona Q4 2025. Sold-To address not updated in SAP — all invoices using North Carolina jurisdiction.,2025-12-01,2025-11-15,SAP,CAPA-009,"Pricing unaffected","Tax exposure of $7,400 across 3 invoices","Credit OK","GPO unaffected",
DS-ISS-010,CUST-3042,Ridgeline Health,Tax Jurisdiction Gap,MEDIUM,3900.0,Clinic,IDN-001,IDN-001,Southeast Health System,Southeast Health System,NC,FL,Unassigned,Unassigned,9,2026-04-04,Open,ORD-225,,Correct Sold-To jurisdiction for CUST-3042 from NC to FL in SAP address master,87.0,Address Validation,CUST-3042 Sold-To address not updated after Florida branch opened as primary billing location in January 2026.,2026-01-10,2025-12-01,SAP,CAPA-009,"Pricing unaffected","$3,900 tax exposure","Credit OK","GPO unaffected",
DS-ISS-011,CUST-1087,Summit Ortho Clinic,Tax Jurisdiction Gap,MEDIUM,2800.0,Clinic,IDN-003,IDN-003,MedStar Alliance,MedStar Alliance,NC,VA,DS-01,Rachel Torres,8,2026-04-05,Open,ORD-227,,Correct Sold-To jurisdiction for CUST-1087 from NC to VA in SAP address master,88.0,Address Validation,CUST-1087 acquired a Virginia location that became the primary Sold-To address — SAP not updated.,2025-11-20,2025-10-01,SAP,CAPA-009,"Pricing unaffected","$2,800 tax exposure","Credit OK","GPO unaffected",
DS-ISS-012,CUST-1650,Lakeside Orthopedics,Tax Jurisdiction Gap,HIGH,6200.0,Clinic,IDN-002,IDN-002,Carolina Medical Group,Carolina Medical Group,NC,GA,Unassigned,Unassigned,4,2026-04-09,Open,ORD-231,,Correct Sold-To jurisdiction for CUST-1650 from NC to GA in SAP address master,86.0,Address Validation,CUST-1650 moved to a Georgia facility in March 2026. Address master not updated.,2026-03-05,2026-01-01,SAP,CAPA-009,"Pricing unaffected","$6,200 tax exposure","Credit OK","GPO unaffected",
DS-ISS-013,CUST-1780,Coastal Medical Center,Tax Jurisdiction Gap,MEDIUM,4100.0,Hospital,IDN-001,IDN-001,Southeast Health System,Southeast Health System,NC,SC,DS-03,Ethan Park,7,2026-04-06,Open,ORD-233,,Correct Sold-To jurisdiction for CUST-1780 from NC to SC in SAP address master,85.0,Address Validation,CUST-1780 expanded to a South Carolina campus which became the primary Sold-To — SAP not updated.,2026-02-15,2026-01-15,SAP,CAPA-009,"Pricing unaffected","$4,100 tax exposure","Credit OK","GPO unaffected",
DS-ISS-014,CUST-1920,Horizon Spine Group,Tax Jurisdiction Gap,MEDIUM,3600.0,Clinic,IDN-003,IDN-003,MedStar Alliance,MedStar Alliance,NC,TN,Unassigned,Unassigned,11,2026-04-03,Open,ORD-235,,Correct Sold-To jurisdiction for CUST-1920 from NC to TN in SAP address master,84.0,Address Validation,CUST-1920 Tennessee branch opened Q4 2025 and became primary Sold-To — SAP not updated.,2025-11-01,2025-10-15,SAP,CAPA-009,"Pricing unaffected","$3,600 tax exposure","Credit OK","GPO unaffected",
DS-ISS-015,CUST-2100,Clearview Medical,Stale Master Record,MEDIUM,3800.0,Clinic,IDN-001,IDN-001,Southeast Health System,Southeast Health System,NC,NC,Unassigned,Unassigned,8,2026-04-05,Open,ORD-237,,Refresh CUST-2100 from SAP master — IQVIA match confirmed,87.0,SAP Audit Log,CUST-2100 not validated against IQVIA in 95 days. Possible IDN movement or address change undetected.,2025-12-20,2025-12-20,SAP,CAPA-009,"Potentially stale contract tier","Potentially stale jurisdiction","Credit may be outdated","GPO tier unverified",
DS-ISS-016,CUST-2350,Pinehurst Ortho,Stale Master Record,LOW,2900.0,Clinic,IDN-002,IDN-002,Carolina Medical Group,Carolina Medical Group,NC,NC,DS-01,Rachel Torres,12,2026-04-02,Open,,,Refresh CUST-2350 from SAP master — IQVIA match confirmed,83.0,SAP Audit Log,CUST-2350 record last validated 110 days ago — exceeds 90-day threshold.,2025-12-01,2025-12-01,SAP,CAPA-009,"Potentially stale contract tier","Potentially stale jurisdiction","Credit may be outdated","GPO tier unverified",
DS-ISS-017,CUST-2500,Southgate Medical,Stale Master Record,MEDIUM,4400.0,Hospital,IDN-003,IDN-003,MedStar Alliance,MedStar Alliance,NC,NC,Unassigned,Unassigned,6,2026-04-06,Open,ORD-239,,Refresh CUST-2500 from SAP master — IQVIA match confirmed and possible IDN movement detected,88.0,IQVIA + SAP Audit Log,CUST-2500 not validated in 98 days. IQVIA signal shows potential affiliation change — needs verification.,2025-12-15,2025-12-15,SAP,CAPA-009,"Potentially stale contract tier","Potentially stale jurisdiction","Credit may need refresh","GPO tier unverified",
DS-ISS-018,CUST-2650,Westbrook Orthopedics,Stale Master Record,LOW,2100.0,Clinic,IDN-001,IDN-001,Southeast Health System,Southeast Health System,NC,NC,DS-03,Ethan Park,14,2026-04-01,Open,,,Refresh CUST-2650 from SAP master — IQVIA match confirmed,82.0,SAP Audit Log,CUST-2650 last validated 105 days ago — no IQVIA delta signal detected but routine validation required.,2025-12-10,2025-12-10,SAP,CAPA-009,"Contract tier likely still valid","Jurisdiction likely still valid","Credit likely current","GPO tier likely valid",
DS-ISS-019,CUST-2800,Apex Medical Group,Duplicate Suspect,HIGH,11200.0,Hospital,IDN-002,IDN-002,Carolina Medical Group,Carolina Medical Group,NC,NC,DS-02,Jordan Lee,3,2026-04-08,Open,ORD-241;ORD-242,GPC-019,"Merge CUST-2800 and CUST-2801 — CUST-2801 is the canonical record — consolidate open orders under CUST-2801",92.0,AI Deduplication Scan,Two customer records (CUST-2800 and CUST-2801) created for the same physical entity — likely created by two separate sales reps during onboarding. Name similarity 94% — address match confirmed.,2026-03-15,2026-03-15,SAP,CAPA-009,"Duplicate pricing contracts active — $11,200 total revenue at risk of double-counting","Tax filings could duplicate","Dual credit limits inflating exposure","Dual GPO membership creating compliance flag",
DS-ISS-020,CUST-3100,Northern Surgical Group,Duplicate Suspect,MEDIUM,5500.0,Clinic,IDN-003,IDN-003,MedStar Alliance,MedStar Alliance,NC,NC,DS-01,Rachel Torres,9,2026-04-04,Open,,,"Merge CUST-3100 and CUST-3101 — CUST-3101 is the canonical record",85.0,AI Deduplication Scan,CUST-3100 and CUST-3101 detected as duplicates — name similarity 89% — same NPI number in IQVIA. Created during a batch SAP import.,2026-02-20,2026-02-20,SAP,CAPA-009,"Duplicate revenue attribution","Potential duplicate tax filings","Dual credit exposure","Dual GPO membership",
```

---

### 1B. Update `backend/data/seed_data.py`

In the `create_tables()` function, after the `pricing_issues` table block, add:

```python
c.execute("DROP TABLE IF EXISTS data_steward_issues")
c.execute("""CREATE TABLE data_steward_issues (
    issue_id TEXT PRIMARY KEY, customer_id TEXT, customer_name TEXT,
    issue_type TEXT, priority TEXT, dollar_value REAL,
    hierarchy_level TEXT, current_idn TEXT, correct_idn TEXT,
    current_idn_name TEXT, correct_idn_name TEXT,
    current_jurisdiction TEXT, correct_jurisdiction TEXT,
    owner_id TEXT, owner_name TEXT, sla_days_remaining INTEGER,
    opened_date TEXT, status TEXT, open_orders TEXT, contract_id TEXT,
    ai_fix TEXT, ai_confidence REAL, ai_source TEXT, root_cause TEXT,
    effective_date TEXT, last_updated TEXT, source_system TEXT,
    capa_id TEXT, risk_pricing TEXT, risk_tax TEXT,
    risk_credit TEXT, risk_gpo TEXT, ai_decision TEXT)""")
```

In the CSV loading section, after the `pricing_issues` load block, add:

```python
with open(CSV_DIR / "data_steward_issues.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
conn.executemany(
    "INSERT INTO data_steward_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
        (r["issue_id"], r["customer_id"], r["customer_name"],
         r["issue_type"], r["priority"], float(r["dollar_value"]),
         r["hierarchy_level"], r["current_idn"], r["correct_idn"],
         r["current_idn_name"], r["correct_idn_name"],
         r["current_jurisdiction"], r["correct_jurisdiction"],
         r["owner_id"], r["owner_name"],
         int(r["sla_days_remaining"]) if r["sla_days_remaining"] else 0,
         r["opened_date"], r["status"], r["open_orders"], r["contract_id"],
         r["ai_fix"], float(r["ai_confidence"]), r["ai_source"],
         r["root_cause"], r["effective_date"], r["last_updated"],
         r["source_system"], r["capa_id"], r["risk_pricing"],
         r["risk_tax"], r["risk_credit"], r["risk_gpo"],
         r.get("ai_decision", ""))
        for r in rows
    ],
)
```

After all seed edits, re-run:
```bash
cd backend && python data/seed_data.py
```

---

### 1C. Add CAPA-009 to `backend/routers/capa.py`

In the CAPA list (after the CAPA-008 entry), add CAPA-009:

```python
{
    "capa_id": "CAPA-009",
    "title": "Master Data Governance — Customer Hierarchy & IDN Mapping Accuracy",
    "description": "Multiple customer records missing IDN parent assignments or incorrectly mapped in SAP master. Impacts pricing tier accuracy, tax jurisdiction, credit limits, and GPO membership fees across 20 open issues. Total downstream exposure $89,240.",
    "root_cause": "No automated IQVIA roster sync with SAP customer master. Manual update cycle runs quarterly — too slow for real-time IDN affiliation changes. Onboarding workflow allows record creation without mandatory hierarchy assignment.",
    "severity": "HIGH",
    "status": "In Progress",
    "regulation": "FDA QMSR — 21 CFR Part 820",
    "affected_dataset": "customer_master",
    "affected_records": ["CUST-1887", "CUST-2201", "CUST-0892", "CUST-4412", "CUST-3340"],
    "affected_product": "All",
    "owner": "Marcus Johnson",
    "owner_role": "Chief Data Officer",
    "created_date": "2026-04-01",
    "due_date": "2026-05-10",
    "corrective_action": "Correct all 20 open hierarchy, jurisdiction, orphan, stale, and duplicate issues in SAP master. Assign all orphan records to validated IDN parents per IQVIA roster.",
    "preventive_action": "Implement automated monthly IQVIA roster sync with SAP master. Add mandatory hierarchy validation at customer record creation. Set up IQVIA delta alert for IDN movement detection.",
    "linked_regulation_slug": "fda-21-cfr",
    "priority": 9,
},
```

---

## PART 2 — BACKEND ROUTER

### 2A. Create `backend/routers/steward.py`

**Mirror `backend/routers/pricing.py` exactly for session management, override dict, load/merge functions, and `_workflow_status()` pattern. Adapt all pricing-specific field names to steward equivalents.**

```python
import datetime
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/steward", tags=["steward"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

_session_issue_overrides: dict[str, dict[str, dict]] = {}

LOGGED_IN_STEWARD = {"owner_id": "DS-02", "owner_name": "Jordan Lee"}

STEWARD_TEAM_OWNERS = [
    {"owner_id": "DS-02", "owner_name": "Jordan Lee"},
    {"owner_id": "DS-01", "owner_name": "Rachel Torres"},
    {"owner_id": "DS-03", "owner_name": "Ethan Park"},
]


def _next_steward_owner(current_owner_id: str) -> dict:
    ids = [o["owner_id"] for o in STEWARD_TEAM_OWNERS]
    try:
        idx = ids.index(current_owner_id)
    except ValueError:
        idx = -1
    return STEWARD_TEAM_OWNERS[(idx + 1) % len(STEWARD_TEAM_OWNERS)]


def get_steward_demo_session(
    x_steward_demo_session: str | None = Header(default=None, alias="X-Steward-Demo-Session"),
) -> str:
    return x_steward_demo_session or "default"


def _session_overrides(session_id: str) -> dict[str, dict]:
    return _session_issue_overrides.setdefault(session_id, {})


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _merge_issue(issue: dict, session_id: str) -> dict:
    merged = dict(issue)
    override = _session_overrides(session_id).get(issue["issue_id"])
    if override:
        merged.update(override)
    return merged


def _load_issues(session_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM data_steward_issues ORDER BY sla_days_remaining ASC"
        ).fetchall()
    return [_merge_issue(dict(r), session_id) for r in rows]


def _can_mark_resolved(issue: dict) -> bool:
    if issue.get("status") == "Resolved":
        return False
    if issue.get("ai_decision") == "approve":
        return True
    return bool(issue.get("manual_fix_applied_at"))


def _workflow_status(issue: dict) -> dict:
    ai_approved = issue.get("ai_decision") == "approve"
    manual_applied = bool(issue.get("manual_fix_applied_at"))
    can_resolve = _can_mark_resolved(issue)
    if ai_approved:
        path = "ai"
    elif manual_applied:
        path = "manual_complete"
    else:
        path = "manual_in_progress"
    return {
        "ai_approved": ai_approved,
        "manual_fix_applied": manual_applied,
        "can_mark_resolved": can_resolve,
        "resolution_path": path,
    }
```

#### Endpoint 1: `GET /api/steward/dashboard`

```python
@router.get("/dashboard")
def steward_dashboard(session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    open_issues = [i for i in issues if i.get("status") == "Open"]

    hierarchy_mismatches = [i for i in open_issues if i.get("issue_type") == "Hierarchy Mismatch"]
    orphan_records = [i for i in open_issues if i.get("issue_type") == "Orphan Record"]
    tax_jurisdiction_gaps = [i for i in open_issues if i.get("issue_type") == "Tax Jurisdiction Gap"]
    stale_records = [i for i in open_issues if i.get("issue_type") == "Stale Master Record"]
    duplicate_suspects = [i for i in open_issues if i.get("issue_type") == "Duplicate Suspect"]

    total_exposure = round(sum(float(i.get("dollar_value", 0)) for i in open_issues), 2)
    annualized_exposure = 2_100_000.0

    # My action queue — issues assigned to logged-in steward (DS-02)
    my_queue = [i for i in open_issues if i.get("owner_id") == LOGGED_IN_STEWARD["owner_id"]]

    # AI recommendation queue — only items in my_queue with confidence >= 89
    ai_queue = [i for i in my_queue if float(i.get("ai_confidence", 0)) >= 89]

    # Top 5 alerts — sort by priority (CRITICAL first) then dollar_value desc
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    sorted_alerts = sorted(
        open_issues,
        key=lambda x: (priority_order.get(x.get("priority", "LOW"), 9), -float(x.get("dollar_value", 0)))
    )[:5]

    return {
        "headline": {
            "total_exposure": total_exposure,
            "hierarchy_mismatches": len(hierarchy_mismatches),
            "orphan_records": len(orphan_records),
            "tax_jurisdiction_gaps": len(tax_jurisdiction_gaps),
            "annualized_exposure": annualized_exposure,
        },
        "data_quality_health": [
            {"metric": "Customer Hierarchy Completeness", "score": 82, "status": "At Risk"},
            {"metric": "IDN Mapping Accuracy", "score": 79, "status": "Critical"},
            {"metric": "Sold-To / Bill-To Match Rate", "score": 91, "status": "At Risk"},
            {"metric": "Master Record Uniqueness", "score": 96.4, "status": "Healthy"},
        ],
        "kpi_cards": [
            {"name": "Hierarchy Mapping Issues", "value": len(hierarchy_mismatches), "unit": "open", "description": "IDN / GPO parent links missing or incorrectly assigned in SAP master", "filter_type": "hierarchy"},
            {"name": "Orphan Records", "value": len(orphan_records), "unit": "open", "description": "Customer records with no parent hierarchy assigned — revenue unmapped", "filter_type": "orphan"},
            {"name": "Tax Jurisdiction Gaps", "value": len(tax_jurisdiction_gaps), "unit": "open", "description": "Sold-To / Bill-To state mismatches creating tax exposure on invoices", "filter_type": "tax_gap"},
            {"name": "Stale Master Records", "value": len(stale_records), "unit": "open", "description": "Customer records not validated or refreshed against IQVIA in 90+ days", "filter_type": "stale"},
            {"name": "Duplicate Suspects", "value": len(duplicate_suspects), "unit": "open", "description": "Potential duplicate customer entries flagged by AI deduplication scan", "filter_type": "duplicate"},
        ],
        "top_alerts": sorted_alerts,
        "ai_queue": ai_queue,
        "my_action_queue": my_queue,
        "all_open_issues": open_issues,
    }
```

#### Endpoint 2: `GET /api/steward/issue/{issue_id}`

```python
@router.get("/issue/{issue_id}")
def steward_issue(issue_id: str, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    is_hierarchy = issue["issue_type"] == "Hierarchy Mismatch"
    is_orphan = issue["issue_type"] == "Orphan Record"
    is_tax_gap = issue["issue_type"] == "Tax Jurisdiction Gap"
    is_stale = issue["issue_type"] == "Stale Master Record"
    is_duplicate = issue["issue_type"] == "Duplicate Suspect"

    if is_hierarchy:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) is currently mapped to "
            f"{issue['current_idn_name']} ({issue['current_idn']}), but IQVIA and GPO roster signals confirm "
            f"they joined {issue['correct_idn_name']} ({issue['correct_idn']}) effective {issue['effective_date']}. "
            f"All pricing, rebates, and tax jurisdiction are being calculated against the wrong parent IDN."
        )
    elif is_orphan:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) has no parent IDN assigned in SAP master. "
            f"Revenue from this account is unmapped — no IDN contract rate or GPO pricing is applied. "
            f"Total downstream exposure: ${float(issue['dollar_value']):,.2f}."
        )
    elif is_tax_gap:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) Sold-To address reflects "
            f"{issue['correct_jurisdiction']} but SAP master still applies {issue['current_jurisdiction']} "
            f"tax jurisdiction. All invoices since relocation are using the wrong tax rate — "
            f"total exposure: ${float(issue['dollar_value']):,.2f}."
        )
    elif is_stale:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) was last validated against IQVIA on "
            f"{issue['last_updated']} — over 90 days ago. Potential IDN movement, address change, or "
            f"GPO tier update may have gone undetected. Record needs immediate refresh."
        )
    else:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) has been flagged as a potential duplicate "
            f"by AI deduplication scan. Two separate records exist for the same entity — "
            f"${float(issue['dollar_value']):,.2f} revenue is at risk of double-counting or misallocation."
        )

    # Affected records — build from open_orders and customer_id
    orders = [o.strip() for o in (issue.get("open_orders") or "").split(";") if o.strip()]
    affected_records = []
    if orders:
        for ord_id in orders:
            affected_records.append({
                "customer": issue["customer_id"],
                "customer_name": issue["customer_name"],
                "open_order": ord_id,
                "contract": issue.get("contract_id", "—"),
                "current_idn_parent": f"{issue.get('current_idn', '—')} ({issue.get('current_idn_name', 'No IDN')})",
            })
    else:
        # No open orders (orphan or stale)
        affected_records.append({
            "customer": issue["customer_id"],
            "customer_name": issue["customer_name"],
            "open_order": "—",
            "contract": issue.get("contract_id", "—"),
            "current_idn_parent": f"{issue.get('current_idn', '—')} ({issue.get('current_idn_name', 'No IDN')})",
        })

    return {
        "issue": issue,
        "header": {
            "issue_type": issue["issue_type"],
            "customer": f"{issue['customer_id']} {issue['customer_name']}",
            "priority": issue["priority"],
            "dollar_impact": issue["dollar_value"],
            "opened_on": issue["opened_date"],
            "sla": f"{issue['sla_days_remaining']} days remaining",
        },
        "what_happened": what_happened,
        "business_risk": [
            {"affected_team": "Pricing Team", "exposure": issue["risk_pricing"], "risk_type": "Contract tier / price applied to open orders"},
            {"affected_team": "Tax & Compliance", "exposure": issue["risk_tax"], "risk_type": "Tax jurisdiction applied to invoices"},
            {"affected_team": "Credit & AR", "exposure": issue["risk_credit"], "risk_type": "Credit limit evaluated against wrong IDN parent"},
            {"affected_team": "GPO / Market Access", "exposure": issue["risk_gpo"], "risk_type": "GPO fees calculated against incorrect membership tier"},
        ],
        "owner": {
            "owner_id": issue["owner_id"],
            "owner_name": issue["owner_name"],
            "assigned_on": issue["opened_date"],
            "next_action": f"Update IDN parent in SAP master from {issue.get('current_idn', '—')} to {issue.get('correct_idn', '—')}" if is_hierarchy else f"Apply correction per AI recommendation for {issue['customer_id']}",
            "sla_remaining": f"{issue['sla_days_remaining']} days remaining",
        },
        "ai_recommendation": {
            "fix": issue["ai_fix"],
            "confidence": issue["ai_confidence"],
            "source": issue["ai_source"],
            "customer_id": issue["customer_id"],
        },
        "affected_records": affected_records,
        "has_open_orders": bool(orders),
        "prescribed_actions": [
            f"Step 1 — Cross-check IQVIA roster for {issue['customer_id']} effective date of IDN transfer" if is_hierarchy else f"Step 1 — Validate {issue['customer_id']} affiliation in IQVIA roster",
            f"Step 2 — Update IDN parent in SAP customer master from {issue.get('current_idn', 'None')} to {issue.get('correct_idn', 'Target IDN')}" if is_hierarchy else f"Step 2 — Apply correction in SAP master for {issue['customer_id']}",
            f"Step 3 — Trigger re-pricing on all open orders for {issue['customer_id']} against {issue.get('correct_idn_name', 'correct IDN')} contract" if is_hierarchy else f"Step 3 — Validate downstream impact on pricing, tax, and credit modules",
            "Step 4 — Notify Pricing Team and Tax Team of correction applied",
        ],
        "why_it_happened": issue["root_cause"],
        "preventive_actions": [
            "Step 1 — Set up automated IQVIA roster sync with SAP master monthly",
            "Step 2 — Add hierarchy validation checkpoint at order creation",
            "Step 3 — Create alert when IQVIA signal detects IDN movement for any active customer",
        ],
        "capa_linkage": {
            "capa_id": issue["capa_id"],
            "regulation": "FDA QMSR — 21 CFR Part 820",
            "status": "In Progress",
            "owner": "Marcus Johnson — Chief Data Officer",
            "due_date": "2026-05-10",
        },
        "workflow": _workflow_status(issue),
    }
```

#### Endpoint 3: `GET /api/steward/record/{customer_id}`

```python
@router.get("/record/{customer_id}")
def steward_record(customer_id: str, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    # Find open issue(s) for this customer
    customer_issues = [i for i in issues if i["customer_id"] == customer_id]
    if not customer_issues:
        raise HTTPException(status_code=404, detail="Customer record not found")

    # Use the first open issue or first issue overall
    primary = next((i for i in customer_issues if i.get("status") == "Open"), customer_issues[0])

    orders = [o.strip() for o in (primary.get("open_orders") or "").split(";") if o.strip()]
    downstream_exposure = float(primary.get("dollar_value", 0))

    return {
        "record_header": {
            "customer_id": primary["customer_id"],
            "customer_name": primary["customer_name"],
            "hierarchy_level": primary["hierarchy_level"],
            "source_system": primary["source_system"],
            "last_updated": primary["last_updated"],
            "status": primary.get("status", "Active"),
        },
        "hierarchy_breakdown": {
            "current_idn": primary.get("current_idn", "—"),
            "current_idn_name": primary.get("current_idn_name", "No IDN"),
            "correct_idn": primary.get("correct_idn", "—"),
            "correct_idn_name": primary.get("correct_idn_name", "—"),
            "jurisdiction_applied": primary.get("current_jurisdiction", "—"),
            "correct_jurisdiction": primary.get("correct_jurisdiction", "—"),
            "effective_date": primary.get("effective_date", "—"),
            "downstream_exposure": downstream_exposure,
        },
        "what_went_wrong": (
            f"{primary['customer_name']} ({customer_id}) was not updated in SAP master after IQVIA roster "
            f"confirmed the move from {primary.get('current_idn_name', 'old IDN')} to "
            f"{primary.get('correct_idn_name', 'correct IDN')} effective {primary.get('effective_date', 'N/A')} — "
            f"all downstream pricing, tax, and credit calculations are running against the wrong parent."
        ),
        "ai_recommendation": {
            "fix": primary["ai_fix"],
            "confidence": primary["ai_confidence"],
            "source": primary["ai_source"],
        },
        "open_orders": orders,
        "contract_id": primary.get("contract_id", "—"),
        "record_trail": [
            {"date": primary["opened_date"], "event": "Issue opened", "detail": f"IDN mismatch detected — {primary.get('current_idn_name', 'No IDN')} vs IQVIA signal"},
            {"date": primary.get("effective_date", "—"), "event": "IQVIA signal", "detail": f"IDN change detected — {primary.get('correct_idn_name', 'target IDN')}"},
            {"date": primary["last_updated"], "event": "SAP master last updated", "detail": "Not synced — gap still open"},
        ],
        "source_system_mismatch": [
            {"source": "IQVIA", "value": f"{primary.get('correct_idn', '—')} {primary.get('correct_idn_name', '—')}", "confirmed": "Yes", "since": primary.get("effective_date", "—")},
            {"source": "SAP Master", "value": f"{primary.get('current_idn', '—')} {primary.get('current_idn_name', 'No IDN')}", "confirmed": "Stale", "since": primary["last_updated"]},
            {"source": "GPO Roster", "value": f"{primary.get('correct_idn', '—')} confirmed", "confirmed": "Yes", "since": primary.get("effective_date", "—")},
        ],
        "customer_hierarchy": {
            "idn": f"{primary.get('correct_idn', '—')} {primary.get('correct_idn_name', '—')}",
            "hospital": f"{primary['customer_name']} Regional",
            "clinic": f"{customer_id} {primary['customer_name']}",
        },
        "cross_team_visibility": [
            {"team": "Pricing Team", "issue": f"Contract tier mismatch on {', '.join(orders) if orders else 'open orders'}", "exposure": primary["risk_pricing"], "owner": "Olivia Bennett"},
            {"team": "Tax & Compliance", "issue": "Wrong jurisdiction applied", "exposure": primary["risk_tax"], "owner": "Sophia Reed"},
            {"team": "Credit & AR", "issue": f"Credit limit evaluated against {primary.get('current_idn_name', 'wrong IDN')}", "exposure": primary["risk_credit"], "owner": "Ethan Walker"},
        ],
        "capa_linkage": {
            "capa_id": primary["capa_id"],
            "regulation": "FDA QMSR — 21 CFR Part 820",
            "status": "In Progress",
            "owner": "Marcus Johnson — Chief Data Officer",
            "due_date": "2026-05-10",
        },
        "issue_id": primary["issue_id"],
        "workflow": _workflow_status(primary),
    }
```

#### Endpoint 4: `GET /api/steward/closure/{issue_id}`

```python
@router.get("/closure/{issue_id}")
def steward_closure(issue_id: str, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    today = datetime.date.today().isoformat()
    orders = [o.strip() for o in (issue.get("open_orders") or "").split(";") if o.strip()]

    open_issues_before = [i for i in issues if i.get("status") == "Open"]
    total_exposure_before = round(sum(float(i.get("dollar_value", 0)) for i in open_issues_before), 2)
    total_exposure_after = round(total_exposure_before - float(issue.get("dollar_value", 0)), 2)

    hierarchy_before = len([i for i in open_issues_before if i.get("issue_type") == "Hierarchy Mismatch"])
    idn_accuracy_before = 79
    idn_accuracy_after = min(100, idn_accuracy_before + 2)

    orders_str = " and ".join(orders) if orders else "N/A"
    contract_id = issue.get("contract_id", "N/A") or "N/A"

    return {
        "resolution_confirmation": {
            "issue": f"{issue['issue_type']} — {issue['customer_id']} {issue['customer_name']}",
            "resolved_by": issue.get("owner_id", LOGGED_IN_STEWARD["owner_id"]),
            "resolved_by_name": issue.get("owner_name", LOGGED_IN_STEWARD["owner_name"]),
            "date": today,
            "resolution_type": f"IDN Updated in SAP + Re-pricing Triggered on {orders_str}" if orders else f"SAP Master Record Corrected for {issue['customer_id']}",
            "exposure_removed": float(issue.get("dollar_value", 0)),
        },
        "what_was_updated": [
            f"SAP Customer Master — {issue.get('current_idn_name', 'Old IDN')} to {issue.get('correct_idn_name', 'Correct IDN')} updated for {issue['customer_id']}",
            f"SAP Pricing Module — Re-pricing triggered on {orders_str}" if orders else f"SAP Pricing Module — Pricing validated for {issue['customer_id']}",
            f"{issue['capa_id']} — Status updated to In Progress",
            "Alert Queue — Alert closed and removed",
            f"My Action Queue — Item removed from {issue.get('owner_id', 'DS-02')} queue",
        ],
        "ai_action_log": {
            "recommendation": issue["ai_fix"],
            "approved_by": issue.get("owner_id", LOGGED_IN_STEWARD["owner_id"]),
            "confidence": issue["ai_confidence"],
            "logged_on": today,
        },
        "kpi_impact": {
            "hierarchy_mismatches": {"before": hierarchy_before, "after": max(0, hierarchy_before - 1)},
            "idn_mapping_accuracy": {"before": f"{idn_accuracy_before}%", "after": f"{idn_accuracy_after}%"},
            "total_exposure": {"before": int(total_exposure_before), "after": max(0, int(total_exposure_after))},
        },
        "cross_team_notifications": [
            {"team": "Pricing Team", "notified_about": f"Re-pricing triggered on {orders_str} against {issue.get('correct_idn_name', 'correct IDN')} contract"},
            {"team": "Tax & Compliance", "notified_about": f"Tax jurisdiction recheck required following IDN parent update for {issue['customer_id']}"},
            {"team": "Credit & AR", "notified_about": f"Credit limit to be re-evaluated against {issue.get('correct_idn_name', 'correct IDN')} parent account"},
        ],
        "issue_id": issue_id,
    }
```

#### Endpoint 5: `POST /api/steward/ai-action`

```python
class StewardAiActionBody(BaseModel):
    issue_id: str
    action: Literal["approve", "reject"]

@router.post("/ai-action")
def steward_ai_action(body: StewardAiActionBody, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    overrides = _session_overrides(session_id)
    patch: dict = {"ai_decision": body.action}
    if body.action == "approve":
        patch["urgency_label"] = "AI fix approved — pending SAP master update"
    else:
        patch["urgency_label"] = "AI rejected — follow prescribed manual actions"
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **patch}
    merged = _merge_issue(issue, session_id)
    return {"issue_id": body.issue_id, "action": body.action, "workflow": _workflow_status(merged)}
```

#### Endpoint 6: `POST /api/steward/resolve`

```python
class StewardResolveBody(BaseModel):
    issue_id: str

@router.post("/resolve")
def steward_resolve(body: StewardResolveBody, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if not _can_mark_resolved(issue):
        raise HTTPException(status_code=400, detail="Issue cannot be resolved yet — approve AI recommendation or complete manual fix step")
    today = datetime.date.today().isoformat()
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), "status": "Resolved", "resolved_at": today}
    return steward_closure(body.issue_id, session_id)
```

#### Endpoint 7: `POST /api/steward/reassign`

```python
class StewardReassignBody(BaseModel):
    issue_id: str
    owner_id: str | None = None

@router.post("/reassign")
def steward_reassign(body: StewardReassignBody, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    new_owner = next((o for o in STEWARD_TEAM_OWNERS if o["owner_id"] == body.owner_id), None) if body.owner_id else _next_steward_owner(issue.get("owner_id", ""))
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **new_owner}
    return {"issue_id": body.issue_id, **new_owner}
```

#### Endpoint 8: `POST /api/steward/manual-fix-applied`

```python
class StewardManualFixBody(BaseModel):
    issue_id: str

@router.post("/manual-fix-applied")
def steward_manual_fix_applied(body: StewardManualFixBody, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    today = datetime.date.today().isoformat()
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), "manual_fix_applied_at": today}
    merged = _merge_issue(issue, session_id)
    return {"issue_id": body.issue_id, "workflow": _workflow_status(merged)}
```

### 2B. Register in `backend/main.py`

Add to the import line:
```python
from routers import ..., steward
```

Add after `app.include_router(pricing.router)`:
```python
app.include_router(steward.router)
```

---

## PART 3 — FRONTEND SERVICE & TYPES

### 3A. Create `frontend/src/services/stewardSession.ts`

Mirror `taxSession.ts` exactly:

```typescript
let stewardDemoSessionId: string | null = null;

export function getStewardDemoSessionId(): string {
  if (!stewardDemoSessionId) {
    stewardDemoSessionId = crypto.randomUUID();
  }
  return stewardDemoSessionId;
}

export function stewardDemoSessionHeaders(): Record<string, string> {
  return { "X-Steward-Demo-Session": getStewardDemoSessionId() };
}
```

### 3B. Add to `frontend/src/services/api.ts`

Add import at top:
```typescript
import { stewardDemoSessionHeaders } from "./stewardSession";
```

Add these TypeScript interfaces after the Pricing interfaces:

```typescript
// ── Data Steward Dashboard ────────────────────────────────────────────────────

export interface StewardHeadline {
  total_exposure: number;
  hierarchy_mismatches: number;
  orphan_records: number;
  tax_jurisdiction_gaps: number;
  annualized_exposure: number;
}

export interface StewardDataQualityHealth {
  metric: string;
  score: number;
  status: "Healthy" | "At Risk" | "Critical";
}

export interface StewardKpiCard {
  name: string;
  value: number;
  unit: "open" | "dollars";
  description: string;
  filter_type: string;
}

export interface StewardIssueRow {
  issue_id: string;
  customer_id: string;
  customer_name: string;
  issue_type: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  dollar_value: number;
  hierarchy_level: string;
  current_idn: string;
  correct_idn: string;
  current_idn_name: string;
  correct_idn_name: string;
  current_jurisdiction: string;
  correct_jurisdiction: string;
  owner_id: string;
  owner_name: string;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  open_orders: string;
  contract_id: string;
  ai_fix: string;
  ai_confidence: number;
  ai_source: string;
  capa_id: string;
  ai_decision?: string;
  urgency_label?: string;
}

export interface StewardDashboard {
  headline: StewardHeadline;
  data_quality_health: StewardDataQualityHealth[];
  kpi_cards: StewardKpiCard[];
  top_alerts: StewardIssueRow[];
  ai_queue: StewardIssueRow[];
  my_action_queue: StewardIssueRow[];
  all_open_issues: StewardIssueRow[];
}

// ── Steward Workflow Status ───────────────────────────────────────────────────

export interface StewardWorkflowStatus {
  ai_approved: boolean;
  manual_fix_applied: boolean;
  can_mark_resolved: boolean;
  resolution_path: string;
}

// ── Steward Issue Intelligence ────────────────────────────────────────────────

export interface StewardIssueDetail {
  issue: StewardIssueRow;
  header: Record<string, string | number>;
  what_happened: string;
  business_risk: { affected_team: string; exposure: string; risk_type: string }[];
  owner: { owner_id: string; owner_name: string; assigned_on: string; next_action: string; sla_remaining: string };
  ai_recommendation: { fix: string; confidence: number; source: string; customer_id: string };
  affected_records: { customer: string; customer_name: string; open_order: string; contract: string; current_idn_parent: string }[];
  has_open_orders: boolean;
  prescribed_actions: string[];
  why_it_happened: string;
  preventive_actions: string[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  workflow: StewardWorkflowStatus;
}

// ── Steward Record Deep Dive ──────────────────────────────────────────────────

export interface StewardRecordDetail {
  record_header: { customer_id: string; customer_name: string; hierarchy_level: string; source_system: string; last_updated: string; status: string };
  hierarchy_breakdown: { current_idn: string; current_idn_name: string; correct_idn: string; correct_idn_name: string; jurisdiction_applied: string; correct_jurisdiction: string; effective_date: string; downstream_exposure: number };
  what_went_wrong: string;
  ai_recommendation: { fix: string; confidence: number; source: string };
  open_orders: string[];
  contract_id: string;
  record_trail: { date: string; event: string; detail: string }[];
  source_system_mismatch: { source: string; value: string; confirmed: string; since: string }[];
  customer_hierarchy: { idn: string; hospital: string; clinic: string };
  cross_team_visibility: { team: string; issue: string; exposure: string; owner: string }[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  issue_id: string;
  workflow: StewardWorkflowStatus;
}

// ── Steward Closure ───────────────────────────────────────────────────────────

export interface StewardClosure {
  resolution_confirmation: { issue: string; resolved_by: string; resolved_by_name: string; date: string; resolution_type: string; exposure_removed: number };
  what_was_updated: string[];
  ai_action_log: { recommendation: string; approved_by: string; confidence: number; logged_on: string };
  kpi_impact: Record<string, { before: number | string; after: number | string }>;
  cross_team_notifications: { team: string; notified_about: string }[];
  issue_id: string;
}
```

Add these API methods (mirror the exact call pattern of `pricingDemoSessionHeaders()` usage):

```typescript
getStewardDashboard: () =>
  get<StewardDashboard>("/api/steward/dashboard", { headers: stewardDemoSessionHeaders() }),

getStewardIssue: (issueId: string) =>
  get<StewardIssueDetail>(`/api/steward/issue/${issueId}`, { headers: stewardDemoSessionHeaders() }),

getStewardRecord: (customerId: string) =>
  get<StewardRecordDetail>(`/api/steward/record/${customerId}`, { headers: stewardDemoSessionHeaders() }),

getStewardClosure: (issueId: string) =>
  get<StewardClosure>(`/api/steward/closure/${issueId}`, { headers: stewardDemoSessionHeaders() }),

stewardAiAction: (issueId: string, action: "approve" | "reject") =>
  post<{ issue_id: string; action: string; workflow: StewardWorkflowStatus }>(
    "/api/steward/ai-action",
    { issue_id: issueId, action },
    { headers: stewardDemoSessionHeaders() }
  ),

stewardResolve: (issueId: string) =>
  post<StewardClosure>("/api/steward/resolve", { issue_id: issueId }, { headers: stewardDemoSessionHeaders() }),

stewardReassign: (issueId: string, ownerId?: string) =>
  post<{ issue_id: string; owner_id: string; owner_name: string }>(
    "/api/steward/reassign",
    { issue_id: issueId, owner_id: ownerId },
    { headers: stewardDemoSessionHeaders() }
  ),

stewardManualFixApplied: (issueId: string) =>
  post<{ issue_id: string; workflow: StewardWorkflowStatus }>(
    "/api/steward/manual-fix-applied",
    { issue_id: issueId },
    { headers: stewardDemoSessionHeaders() }
  ),
```

### 3C. Create `frontend/src/utils/stewardClosureFormat.ts`

Copy `pricingClosureFormat.ts` and adapt for steward KPI types:

```typescript
export function formatStewardKpiValue(key: string, value: number | string): string {
  if (key === "total_exposure") {
    return typeof value === "number"
      ? value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
      : String(value);
  }
  if (key === "idn_mapping_accuracy") return String(value);
  if (key === "hierarchy_mismatches") return String(value);
  return String(value);
}

export const STEWARD_KPI_LABELS: Record<string, string> = {
  hierarchy_mismatches: "Hierarchy Mismatches",
  idn_mapping_accuracy: "IDN Mapping Accuracy",
  total_exposure: "Total Exposure",
};
```

---

## PART 4 — FRONTEND PAGES

Create `frontend/src/pages/steward/` directory and 4 files.

### Styling conventions — identical to Pricing/Tax pages:
- Cards: `rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6`
- Page wrapper: `<div className="space-y-6 pb-24">` (pb-24 for sticky footer)
- Section headings: `text-xl font-bold text-slate-900 dark:text-slate-100`
- Priority CRITICAL: `bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200`
- Priority HIGH: `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`
- Priority MEDIUM: `bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300`
- Priority LOW: `bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300`
- AI Approve: `bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg`
- Reject: `bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-sm px-4 py-2 rounded-lg`
- Sticky footer: `fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-3 z-50`
- Data quality score bar: green if ≥ 90, yellow if ≥ 75, red if < 75
- Money format: `toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })`

---

### 4A. `frontend/src/pages/steward/StewardDashboard.tsx` — Step 1

**Study `PricingDashboard.tsx` first — this is your structural template.**

```
State:
  - data: StewardDashboard | null
  - loading: boolean
  - aiState: Record<string, "approved" | "rejected">
  - activeKpiModal: string | null

On mount: call api.getStewardDashboard() → set data

Layout sections (in this order):

1. PAGE TITLE ROW
   "Data Governance Dashboard" (h1) + role context banner
   Subtitle with 5 pill badges from data.headline:
   - "${total_exposure} at risk" in red
   - "${hierarchy_mismatches} hierarchy mismatches" in orange
   - "${orphan_records} orphan records" in yellow
   - "${tax_jurisdiction_gaps} tax jurisdiction gaps" in amber
   - "$2.1M annualized exposure" in slate

2. DATA QUALITY HEALTH
   4 rows: metric name | color-coded progress bar | status badge
   - "At Risk" badge: bg-yellow-100 text-yellow-700
   - "Critical" badge: bg-red-100 text-red-700 (pulsing dot)
   - "Healthy" badge: bg-emerald-100 text-emerald-700
   Progress bar fills based on score: <75 red, <90 yellow, ≥90 green

3. KPI CARDS — 5 cards in a responsive grid (2-col mobile, 5-col xl)
   Each card is a <button>.
   On click → set activeKpiModal to the card's filter_type.
   Card hover: `hover:ring-2 hover:ring-indigo-400 cursor-pointer transition-all`
   Each card shows: name, value (large number), description, "View details →"

4. KPI MODAL (fixed overlay, same pattern as PricingDashboard)
   - "hierarchy": show issues where issue_type === "Hierarchy Mismatch"
   - "orphan": show issues where issue_type === "Orphan Record"
   - "tax_gap": show issues where issue_type === "Tax Jurisdiction Gap"
   - "stale": show issues where issue_type === "Stale Master Record"
   - "duplicate": show issues where issue_type === "Duplicate Suspect"
   Table columns: Issue ID | Customer | Issue Type | Priority | $ Value | IDN | Owner | SLA
   Each row clickable → navigate to /steward/issue/${issue_id}, close modal first
   Close on overlay click or X button.

5. TOP 5 ALERTS TABLE
   Columns: Customer | Issue Type | Priority | Downstream Impact | Current Owner | Action
   - Action column: "Assign" button (amber) for Unassigned rows, "View" button (slate) for assigned rows
     - "Assign" click → call api.stewardReassign(issue_id) to assign to DS-02 (logged-in steward), refresh data
     - "View" click → navigate to /steward/issue/${issue_id}
   - CRITICAL rows: left border `border-l-4 border-red-500` + red background tint
   - HIGH rows: `border-l-4 border-red-400`
   - MEDIUM rows: `border-l-4 border-yellow-400`

6. AI RECOMMENDATION QUEUE
   Heading: "AI Recommendation Queue" with note "(Showing recommendations for your queue only)"
   Columns: Customer | Current State | AI Suggested Fix | Confidence | Source | Action
   For each row in data.ai_queue:
   - "Current State" = current_idn_name (or "No IDN mapped" for orphans)
   - Approve / Reject buttons with backend call pattern (mirror PricingDashboard exactly)
   - After approval: green ✓ badge, disable buttons
   - After rejection: amber blinking dot next to issue, "Act Now" pulsing amber CTA (mirror pricingWorkflowStorage / taxWorkflowStorage pattern)
   - Rejected state persisted via stewardWorkflowStorage (create this file mirroring pricingWorkflowStorage.ts)

7. MY ACTION QUEUE
   Columns: Record | Issue Type | Priority | Downstream Risk | SLA Remaining | Action
   - "Fix" button → navigate to /steward/issue/${issue_id}
   - SLA badge: red if ≤ 2 days, yellow if ≤ 5 days, green otherwise
   - If issue is rejected (ai_decision === "reject"): amber pulsing dot next to Record ID
```

---

### 4B. `frontend/src/pages/steward/StewardIssueIntelligence.tsx` — Step 2

**Study `PricingIssueIntelligence.tsx` first.**

```
Route param: issueId from useParams()
State:
  - data: StewardIssueDetail | null
  - loading: boolean
  - aiAction: "approved" | "rejected" | null
  - openSections: Record<string, boolean>

On mount: call api.getStewardIssue(issueId) → set data

Layout sections (in this order):

1. BACK BUTTON
   "← Back to Dashboard" → navigate to /steward-dashboard

2. ISSUE HEADER CARD
   Banner row: Issue Type | Customer (ID + name) | Priority badge | Downstream Impact | Opened On | SLA countdown
   - CRITICAL: full red banner above header — "⚠ CRITICAL DATA GAP — Immediate action required"
   - SLA badge: red if ≤ 2 days, yellow if ≤ 5 days

3. WHAT HAPPENED
   Plain text paragraph from data.what_happened inside a pale blue info card

4. BUSINESS RISK & IMPACT TABLE
   4 rows: Affected Team | Exposure | Risk Type
   (Pricing Team · Tax & Compliance · Credit & AR · GPO/Market Access)

5. OWNER & NEXT ACTION
   Table row: Owner | Assigned On | Next Action | SLA Remaining

6. AI RECOMMENDATION BOX (indigo-500 left border — different from pricing's yellow to differentiate)
   - Shows: fix text | confidence % badge | source
   - Approve / Reject buttons (call api.stewardAiAction)
   - After approval: green ✓ badge, show pulsing "Mark Resolved" button
   - Link: "Not comfortable approving? View Prescribed Actions ▼"

7. AFFECTED RECORDS TABLE
   Columns: Customer | Open Orders | Contract | Current IDN Parent
   - Each row: blinking "Open Record →" button (pulses until clicked, stops after click — same pattern as pricing affected records)
   - Clicking → navigate to /steward/record/${customer_id}
   - Remove full-row highlight — button only blinks, not the row

8. STICKY FOOTER (4 buttons — always visible):
   - "Approve Fix" → call api.stewardAiAction(issueId, "approve") then show green toast
   - "Mark Resolved" →
       If data.workflow.can_mark_resolved: call api.stewardResolve(issueId) → navigate to /steward/closure/${issueId}
       If NOT: navigate to /steward/record/${customer_id} with toast "Complete record correction first"
   - "Validate Manually" → opens Prescribed Actions accordion (expand it)
   - "Reassign" → call api.stewardReassign(issueId) → toast with new owner name
   Button style for Mark Resolved: green when can_mark_resolved, gray when not

9. COLLAPSED ACCORDION SECTIONS:
   - ▶ Prescribed Actions — numbered steps from data.prescribed_actions
     (auto-expands if aiAction === null)
   - ▶ Why It Happened — paragraph from data.why_it_happened
   - ▶ Preventive Actions — numbered steps from data.preventive_actions
   - ▶ CAPA Linkage — table: CAPA ID | Regulation | Status | Owner | Due Date
```

---

### 4C. `frontend/src/pages/steward/StewardRecordDeepDive.tsx` — Step 3

**This is unique to the Data Steward persona — no direct equivalent in Pricing/Tax. Study `PricingTransactionLineage.tsx` for the structural patterns (breadcrumb, sticky footer, accordion sections) and adapt them.**

```
Route param: customerId from useParams()
State:
  - data: StewardRecordDetail | null
  - loading: boolean
  - aiApproved: boolean
  - openSections: Record<string, boolean>

On mount: call api.getStewardRecord(customerId) → set data

Layout sections (in this order):

1. BREADCRUMB
   "← Back to Issue" → navigate to /steward/issue/${data.issue_id}

2. RECORD HEADER CARD
   Table row: Customer ID | Customer Name | Hierarchy Level | Source System | Last Updated | Status
   Status badge: green "Active", amber "Stale", red "Error"

3. HIERARCHY BREAKDOWN TABLE (the core of this page — mirror pricing breakdown style)
   Two-row comparison (side by side or stacked):
   Row 1 — "Current in SAP": Current IDN | Current IDN Name | Jurisdiction Applied (red text ✗)
   Row 2 — "Correct (IQVIA)": Correct IDN | Correct IDN Name | Correct Jurisdiction (green text ✓)
   Below: "Effective Date: [date] | Downstream Exposure: $[amount]" in red info banner

4. WHAT WENT WRONG
   Plain text paragraph from data.what_went_wrong

5. AI RECOMMENDATION BOX (indigo-500 left border)
   - Shows: fix text | confidence | source
   - Approve / Reject buttons
   - If already approved in Step 2 (check workflow.ai_approved): pre-fill as approved

6. STICKY FOOTER (5 buttons):
   - "Fix Issue" (pulsing — same blinking pattern as pricing CTA):
     1. Call api.stewardManualFixApplied(data.issue_id) to mark manual path complete
     2. Navigate to /steward/closure/${data.issue_id}
   - "Update Address Master" → shows a simple inline toast "Address Master update requested"
   - "View Customer" → navigate to /hierarchy (existing Hierarchy page)
   - "View Hierarchy" → navigate to /hierarchy (same)
   - "Back to Issue" → navigate to /steward/issue/${data.issue_id}
   IMPORTANT: "Fix Issue" button must pulse/blink until clicked (same pattern as PricingTransactionLineage CTA)

7. COLLAPSED ACCORDION SECTIONS:
   - ▶ Record Trail — table: Date | Event | Detail
   - ▶ Source System Mismatch — table: Source | Value | Confirmed | Discrepancy Since
   - ▶ Customer Hierarchy — IDN → Hospital → Clinic tree (visual indented list)
   - ▶ Cross-Team Visibility — table: Team | Issue | Exposure | Owner
   - ▶ CAPA Linkage — table: CAPA ID | Regulation | Status | Owner | Due Date
```

---

### 4D. `frontend/src/pages/steward/StewardClosure.tsx` — Step 4

**Study `PricingClosure.tsx` first — structural clone with steward-specific content.**

```
Route param: issueId from useParams()
State:
  - data: StewardClosure | null
  - loading: boolean

On mount: call api.getStewardClosure(issueId) → set data

Layout sections (in this order):

1. RESOLUTION BANNER
   Large emerald success card with CheckCircle icon:
   Title: "Master Data Corrected ✓"
   Subtitle: "Downstream exposure removed: ${resolution_confirmation.exposure_removed formatted}"

2. RESOLUTION CONFIRMATION TABLE
   Rows: Issue | Resolved By | Date | Resolution Type | Exposure Removed

3. WHAT WAS UPDATED
   Bulleted list from data.what_was_updated, each prefixed with green ✓

4. AI ACTION LOG
   Table: Recommendation | Approved By | Confidence | Logged On

5. IMPACT ON DASHBOARD (KPI before/after table)
   Use stewardClosureFormat.ts for formatting:
   - hierarchy_mismatches: integer
   - idn_mapping_accuracy: string (e.g. "79%" → "81%")
   - total_exposure: money
   "After" column in emerald/green text.

6. CROSS-TEAM NOTIFICATION TABLE
   Columns: Team | What They Were Notified About

7. "Back to Dashboard" BUTTON
   Centered, large: `bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold`
   onClick: navigate to /steward-dashboard
```

---

## PART 5 — ROUTING, NAVIGATION & ROLE UPDATES

### 5A. Create `frontend/src/utils/stewardWorkflowStorage.ts`

Copy `pricingWorkflowStorage.ts` and rename all `pricing` references to `steward`. This stores the rejected-issue state for the blinking amber dot in My Action Queue.

### 5B. Update `frontend/src/App.tsx`

Add 4 new lazy imports after the pricing imports:

```typescript
const StewardDashboard = lazy(() => import("./pages/steward/StewardDashboard"));
const StewardIssueIntelligence = lazy(() => import("./pages/steward/StewardIssueIntelligence"));
const StewardRecordDeepDive = lazy(() => import("./pages/steward/StewardRecordDeepDive"));
const StewardClosure = lazy(() => import("./pages/steward/StewardClosure"));
```

Inside `<Routes>`, after the pricing routes, add:

```tsx
<Route path="/steward-dashboard" element={<StewardDashboard />} />
<Route path="/steward/issue/:issueId" element={<StewardIssueIntelligence />} />
<Route path="/steward/record/:customerId" element={<StewardRecordDeepDive />} />
<Route path="/steward/closure/:issueId" element={<StewardClosure />} />
```

### 5C. Create `frontend/src/config/stewardTeamNav.ts`

Mirror `pricingTeamNav.ts` exactly:

```typescript
import type { ComponentType } from "react";
import { Database, Search, FileSearch, CircleCheck } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

export const STEWARD_DEMO = {
  issueId: "DS-ISS-001",
  customerId: "CUST-1887",
  closureIssueId: "DS-ISS-001",
} as const;

export type StewardNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const STEWARD_TEAM_SECTION = "DATA STEWARD";

export const stewardNavItems: StewardNavItem[] = [
  {
    path: "/steward-dashboard",
    label: "Data Governance Dashboard",
    icon: Database,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname === "/steward-dashboard",
  },
  {
    path: `/steward/issue/${STEWARD_DEMO.issueId}`,
    label: "Issue Intelligence",
    icon: Search,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname.startsWith("/steward/issue/"),
  },
  {
    path: `/steward/record/${STEWARD_DEMO.customerId}`,
    label: "Record Deep Dive",
    icon: FileSearch,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname.startsWith("/steward/record/"),
  },
  {
    path: `/steward/closure/${STEWARD_DEMO.closureIssueId}`,
    label: "Closure & Accountability",
    icon: CircleCheck,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname.startsWith("/steward/closure/"),
  },
];

export function canAccessStewardNav(roleId: RoleId): boolean {
  return roleId === "data_steward" || roleId === "admin";
}
```

### 5D. Update `frontend/src/components/Layout.tsx`

**Step 1 — Add imports** (alongside existing pricingTeamNav imports):
```typescript
import {
  canAccessStewardNav,
  stewardNavItems,
  STEWARD_TEAM_SECTION,
} from "../config/stewardTeamNav";
```

**Step 2 — Add DATA STEWARD sidebar section** after the PRICING TEAM USER section block. Copy the entire `{canAccessPricingTeamNav(...) && (...)}` block and replace all Pricing/pricing references with Steward/steward. The section must:
- Check `canAccessStewardNav(currentRole.id)`
- Use `STEWARD_TEAM_SECTION` as the collapse/expand key
- Render `stewardNavItems` the same way `pricingTeamNavItems` are rendered
- Use `setSectionOpen` with `STEWARD_TEAM_SECTION` as the key

### 5E. Update `frontend/src/context/RoleContext.tsx`

**Change 1 — Add `data_steward` to the `RoleId` union type:**
```typescript
export type RoleId =
  | "admin"
  | "cdo"
  | "cco"
  | "vp_quality"
  | "pricing_analyst"
  | "tax_compliance"
  | "data_steward"     // ← ADD THIS
  | "commercial_ops"
  | "cfo"
  | "credit_ar"
  | "market_access"
  | "sales_leadership"
  | "revenue_assurance";
```

**Change 2 — Add `data_steward` role to the `ROLES` array** (after the `tax_compliance` entry):
```typescript
{
  id: "data_steward",
  label: "Data Steward",
  shortLabel: "Steward",
  personaName: "Jordan Lee",
  badgeColor: "bg-indigo-600",
  badgeTextColor: "text-white",
  defaultRoute: "/steward-dashboard",
  contextBannerByRoute: {
    "/steward-dashboard": "Data Steward View — $89,240 at risk · 5 hierarchy mismatches · 3 orphan records · 6 tax jurisdiction gaps · $2.1M annualized exposure",
    "/steward/issue/:issueId": "Data Steward View — Issue Intelligence · Understand the data gap · Approve AI fix or follow prescribed actions",
    "/steward/record/:customerId": "Data Steward View — Record Deep Dive · SAP master record · Apply correction",
    "/steward/closure/:issueId": "Data Steward View — Closure & Accountability · Correction confirmed · KPIs updated in real time",
  },
},
```

**Change 3 — Ensure `RoleContextBanner` handles parameterised steward routes.** Find where `/pricing/issue/:issueId` and `/tax/issue/:issueId` are pattern-matched for the banner and add the three steward patterns using the same matching logic:
- `/steward/issue/:issueId`
- `/steward/record/:customerId`
- `/steward/closure/:issueId`

---

## PART 6 — UI BEHAVIOR DETAILS (EXACT SPECS FROM USER FLOW DOC)

### Affected Records blinking button (Step 2)
- Remove full-row highlight
- Each row has an "Open Record →" button that `animate-pulse` until clicked
- Once clicked, pulse stops — state stored in `stewardWorkflowStorage` per issue per session
- Navigates to `/steward/record/${customer_id}`

### "Fix Issue" pulsing CTA (Step 3)
- The "Fix Issue" sticky footer button pulses with `animate-pulse` ring until clicked
- While processing: disables, shows "Processing…"
- Same pattern as `Credit Memo Request` button in `PricingTransactionLineage.tsx`

### Rejected AI → blinking dot in My Action Queue
- When Reject is clicked: amber blinking dot (`animate-pulse`) appears next to the customer/issue ID
- "Fix" button changes to "Act Now" with pulsing amber style
- State persisted via `stewardWorkflowStorage.ts` — survives navigation within the session

### KPI modal drill-down
- Clicking any KPI card opens a popup modal (NOT a new page)
- Modal shows filtered issues table for that category
- Each row navigates to `/steward/issue/${issue_id}` and closes the modal

---

## PART 7 — FINAL CHECKLIST

Verify every item before declaring done:

### Data
- [ ] `backend/data/csv/data_steward_issues.csv` created — 20 rows (5 hierarchy + 3 orphan + 6 tax_gap + 4 stale + 2 duplicate)
- [ ] `backend/data/seed_data.py` — `data_steward_issues` table created + CSV loaded (33 columns, 33 values)
- [ ] Seed script re-run without errors: `cd backend && python data/seed_data.py`
- [ ] `GET /api/steward/dashboard` returns: total_exposure ≈ 89,240, hierarchy_mismatches = 5, orphan_records = 3, tax_jurisdiction_gaps = 6

### Backend
- [ ] `backend/routers/steward.py` created — 8 endpoints (dashboard, issue, record, closure, ai-action, resolve, reassign, manual-fix-applied)
- [ ] CAPA-009 added to `backend/routers/capa.py`
- [ ] `backend/main.py` imports and registers steward router
- [ ] Backend starts without errors

### Frontend Service
- [ ] `frontend/src/services/stewardSession.ts` created
- [ ] `frontend/src/services/api.ts` — 8 new interfaces + 8 new api methods + stewardSession import
- [ ] `frontend/src/utils/stewardClosureFormat.ts` created
- [ ] `frontend/src/utils/stewardWorkflowStorage.ts` created
- [ ] `frontend/src/config/stewardTeamNav.ts` created

### Frontend Pages
- [ ] `frontend/src/pages/steward/StewardDashboard.tsx` — KPI modals, AI queue, Top 5 Alerts with Assign/View buttons
- [ ] `frontend/src/pages/steward/StewardIssueIntelligence.tsx` — Affected Records blinking button, Mark Resolved gating
- [ ] `frontend/src/pages/steward/StewardRecordDeepDive.tsx` — Hierarchy Breakdown side-by-side, Fix Issue pulsing CTA
- [ ] `frontend/src/pages/steward/StewardClosure.tsx` — KPI before/after, cross-team notifications

### Routing & Navigation
- [ ] `frontend/src/App.tsx` — 4 lazy imports + 4 routes added
- [ ] `frontend/src/components/Layout.tsx` — `DATA STEWARD` section visible to `data_steward` and `admin`
- [ ] `frontend/src/context/RoleContext.tsx` — `data_steward` role added to type + ROLES array
- [ ] `RoleContextBanner` pattern-matches `/steward/issue/:issueId`, `/steward/record/:customerId`, `/steward/closure/:issueId`

### End-to-End Flow
- [ ] Dev server starts without TypeScript errors: `cd frontend && npm run dev`
- [ ] Switching to `data_steward` role lands on `/steward-dashboard`
- [ ] `DATA STEWARD` sidebar section visible only to `data_steward` and `admin`
- [ ] Dashboard headline: $89,240 | 5 hierarchy mismatches | 3 orphan records | 6 tax jurisdiction gaps | $2.1M
- [ ] Data Quality Health shows 4 rows with correct color-coded progress bars
- [ ] KPI card click opens popup modal with filtered issue table
- [ ] Top 5 Alerts: CUST-2201 (CRITICAL) appears first; Assign button triggers DS-02 assignment
- [ ] AI Recommendation Queue shows only DS-02's queue items
- [ ] "Fix" in My Action Queue → /steward/issue/:id
- [ ] Affected Records "Open Record →" button pulses until clicked → /steward/record/CUST-1887
- [ ] Hierarchy Breakdown shows IDN-003 MedStar Alliance (red ✗) vs IDN-007 Memorial Health System (green ✓)
- [ ] "Fix Issue" CTA pulses in sticky footer → marks manual fix → navigates to Closure
- [ ] Approve AI in Step 2 or 3 → Mark Resolved becomes green → resolve → Closure
- [ ] Closure KPI table: Hierarchy Mismatches 5→4, IDN Mapping Accuracy 79%→81%, Total Exposure $89,240→$76,840
- [ ] "Back to Dashboard" on Closure → /steward-dashboard with updated KPIs
- [ ] Frontend build passes with zero TypeScript errors: `cd frontend && npm run build`

---

## IMPORTANT NOTES

1. **Do not modify any existing pages.** This is entirely additive. All existing Tax, Pricing, and other persona pages remain untouched.

2. **CAPA-007 conflict:** The Data Steward user flow document references CAPA-007, but that ID is already used by the Tax persona in `capa.py`. Use **CAPA-009** in all Data Steward data, backend, and frontend. Do not change CAPA-007.

3. **Cross-team owner names must be unique.** The Data Steward cross-team visibility uses: Pricing Team → `Olivia Bennett`, Tax & Compliance → `Sophia Reed`, Credit & AR → `Ethan Walker`. These are the same names already used in Tax Transaction Lineage — this is acceptable because in both cases they represent OTHER teams being notified FROM the Data Steward context.

4. **Route param for Step 3 is `customerId`** (e.g., `CUST-1887`) — NOT `issueId`. The Record Deep Dive is customer-centric. The backend endpoint is `GET /api/steward/record/{customer_id}`. Multiple issues may exist for the same customer; always use the primary open one.

5. **`data_steward` role must be added to `EXECUTIVE_ROLE_IDS`? No.** It is a frontline worker persona — do NOT add it to `EXECUTIVE_ROLE_IDS`. Only `admin`, `cdo`, `cco`, `cfo` are in that array.

6. **Sticky footers on Steps 2 and 3** must use `pb-24` on the page wrapper.

7. **Session headers** — every steward API call must include `stewardDemoSessionHeaders()`. Missing this on any call will break AI approve/reject persistence between page navigations.

8. **All money values** must use `toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })`.

9. **Dark mode** — every element must include `dark:` variants. Use `PricingDashboard.tsx` and `PricingClosure.tsx` as reference.

10. **Numbers must be consistent.** Dashboard headline, KPI cards, modal drill-down, and Closure KPI impact table must all derive from the same API response. Never hardcode a value also returned by the API.

11. **Frontend build must pass** with zero TypeScript errors before the implementation is considered complete: `cd frontend && npm run build`.

12. **The `sectionOpen` state in Layout.tsx** already handles accordion toggling for Tax and Pricing sections. Add `STEWARD_TEAM_SECTION` as an additional key with the same `useState` initialization and toggle handler.

13. **The Step 3 page label in the sidebar is "Record Deep Dive"** — not "Transaction Lineage". The icon should be `FileSearch` from `lucide-react` to visually distinguish it from the Tax/Pricing "Route" icon.
