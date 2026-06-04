# Cursor AI — Bioventus Pricing Team Persona: Full-Stack Implementation Prompt

## CONTEXT

You are working inside the **Bioventus-MockUp** monorepo. The stack is:
- **Frontend:** React + Vite + TypeScript + TailwindCSS, React Router v6 (lazy-loaded pages), located in `frontend/`
- **Backend:** FastAPI (Python), SQLite database at `backend/data/luminos_demo.db`, seeded from CSVs in `backend/data/csv/`
- **API layer:** All frontend API calls go through `frontend/src/services/api.ts`
- **Role system:** `frontend/src/context/RoleContext.tsx` — the `pricing_analyst` role already exists

**The Tax Team persona has already been fully implemented.** Study these existing files as your primary reference before writing a single line:
- `backend/routers/tax.py` — session-based state, `_load_issues()`, `_merge_issue()`, `_workflow_status()`, `_can_mark_resolved()`, approve/reject/resolve/reassign endpoints
- `frontend/src/services/taxSession.ts` — demo session ID pattern (copy this for `pricingSession.ts`)
- `frontend/src/config/taxTeamNav.ts` — PRICING TEAM USER sidebar section pattern to mirror exactly
- `frontend/src/pages/tax/TaxDashboard.tsx` — KPI card → popup modal pattern (the evolved final state)
- `frontend/src/pages/tax/IssueIntelligence.tsx` — Mark Resolved gating, sticky footer, accordion sections
- `frontend/src/pages/tax/TransactionLineage.tsx` — "Fix Tax Jurisdiction" button → Closure navigation
- `frontend/src/pages/tax/TaxClosure.tsx` — KPI impact table, dynamic formatting
- `frontend/src/utils/taxClosureFormat.ts` — KPI formatting utility (copy and adapt)
- `frontend/src/context/TaxWorkflowContext.tsx` — workflow context pattern

Your job is to implement a **4-step Pricing Team persona workflow**. Follow every instruction in order. Match the Tax implementation patterns exactly — do not invent new patterns.

---

## DECISIONS PRE-MADE — Apply these exactly, no choices needed

| Decision | Choice |
|----------|--------|
| KPI card click behaviour | Opens a **popup modal** on top of the dashboard (mirror Tax evolved pattern) |
| Sidebar section | **PRICING TEAM USER** — visible to `pricing_analyst` and `admin` roles only |
| AI Approve / Reject | Calls real backend endpoints (`POST /api/pricing/ai-action`) — mirror Tax pattern |
| Mark Resolved gating | Green when AI approved; otherwise navigates user to Transaction Lineage |
| `pricing_analyst` defaultRoute | Change from `/revenue?tab=pricing` to `/pricing-dashboard` |
| CAPA linkage | CAPA-002 already exists in `capa.py` — no change to `capa.py` needed; display as a linked reference in Pricing pages |
| Existing `/revenue?tab=pricing` | **Do not touch** — leave it fully intact and accessible |
| "Issue Credit Memo" button | In Transaction Lineage (Step 3) → navigates to Closure page |
| Dataset size | 11 pricing issues (7 GPO conflicts + 4 contract-risk issues) |

---

## THE 4-STEP PRICING TEAM WORKFLOW (source of truth)

| Step | Route | Page File | Description |
|------|-------|-----------|-------------|
| 1 | `/pricing-dashboard` | `PricingDashboard.tsx` | Full pricing exposure overview — KPIs, alerts, AI queue, action queue |
| 2 | `/pricing/issue/:issueId` | `PricingIssueIntelligence.tsx` | Deep-dive into one GPO conflict or contract risk |
| 3 | `/pricing/transaction/:orderId` | `PricingTransactionLineage.tsx` | Order-level detail + pricing breakdown |
| 4 | `/pricing/closure/:issueId` | `PricingClosure.tsx` | Resolution confirmation + KPI delta + audit log |

**Navigation flow:** Dashboard → click alert row or "Triage" button → Issue Intelligence → click Affected Record → Transaction Lineage → click "Issue Credit Memo" → Closure → "Return to Dashboard" → Step 1 with updated KPIs.

---

## PART 1 — DATA LAYER

### 1A. Create `backend/data/csv/pricing_issues.csv`

Create this NEW file. It is the canonical source for the Pricing Team workflow.

**Column order (31 columns):**
`issue_id,order_id,customer_id,customer_name,issue_type,priority,dollar_value,invoice_status,urgency_label,owner_id,owner_name,ai_fix,ai_confidence,ai_source,correct_tier,applied_tier,gpo_name,product,sla_days_remaining,opened_date,status,contract_id,credit_memo_required,overcharge_per_unit,quantity_affected,capa_id,root_cause,risk_revenue,risk_chargeback,risk_compliance,risk_gpo`

```csv
issue_id,order_id,customer_id,customer_name,issue_type,priority,dollar_value,invoice_status,urgency_label,owner_id,owner_name,ai_fix,ai_confidence,ai_source,correct_tier,applied_tier,gpo_name,product,sla_days_remaining,opened_date,status,contract_id,credit_memo_required,overcharge_per_unit,quantity_affected,capa_id,root_cause,risk_revenue,risk_chargeback,risk_compliance,risk_gpo
PRK-ISS-001,ORD-010,CUST-1005,Southeast Group,GPO Pricing Conflict,HIGH,12000.0,Invoiced,3 days to next audit,REP-05,Marcus Johnson,"Update CUST-1005 GPO tier to HealthTrust Tier1 in SAP + issue credit memo for $1200",94.0,IQVIA Roster + GPO Contract,HealthTrust Tier1,List Price,HealthTrust,StimRouter,3,2026-04-05,Open,GPC-003,1,600.0,2,CAPA-002,"GPO membership tier for CUST-1005 not updated in SAP pricing master after IQVIA roster change — list price $12000 applied instead of contracted HealthTrust Tier1 $10800","Revenue at risk — chargeback initiated","$1200 chargeback exposure","GPO compliance audit flag active","Contributing to 87% GPO mapping accuracy flag"
PRK-ISS-002,ORD-012,CUST-1007,Northeast Alliance Clinic,GPO Pricing Conflict,HIGH,12000.0,Invoiced,5 days to next audit,Unassigned,Unassigned,"Update CUST-1007 GPO tier to HealthTrust Tier1 in SAP + issue credit memo for $1200",91.0,IQVIA Roster + GPO Contract,HealthTrust Tier1,List Price,HealthTrust,StimRouter,5,2026-04-03,Open,GPC-004,1,600.0,2,CAPA-002,"GPO membership tier for CUST-1007 not updated in SAP pricing master — system applied list price instead of contracted HealthTrust Tier1","Revenue at risk if chargeback escalates","$1200 chargeback exposure","GPO compliance flag","Contributing to 87% GPO mapping accuracy flag"
PRK-ISS-003,ORD-005,CUST-1003,Valley Medical Center,GPO Pricing Conflict,HIGH,17000.0,Invoiced,7 days to resolution,Unassigned,Unassigned,"Update CUST-1003 GPO tier to Vizient Tier2 in SAP + issue credit memo for $1700",89.0,IQVIA Roster + GPO Contract,Vizient Tier2,List Price,Vizient,neXus System,7,2026-04-01,Open,GPC-005,1,850.0,2,CAPA-002,"Vizient Tier2 contract for CUST-1003 not reflected in SAP at order creation — list price applied instead of contracted rate","Revenue at risk","$1700 chargeback exposure","GPO audit flag","Contributing to 87% GPO mapping flag"
PRK-ISS-004,ORD-001,CUST-1001,Premier Health Group,GPO Pricing Conflict,MEDIUM,6800.0,Invoiced,12 days to resolution,REP-03,Jennifer Mills,"Update CUST-1001 GPO tier to Premier Tier2 in SAP + issue credit memo for $260",88.0,IQVIA Roster,Premier Tier2,List Price,Premier,DUROLANE 3mL,12,2026-03-20,Open,GPC-001,1,130.0,2,CAPA-002,"Premier Tier2 contract not applied at order creation for CUST-1001 — SAP pricing master not updated after GPO enrollment","Revenue at risk","$260 chargeback exposure","Low audit risk","Contributing to 87% GPO mapping flag"
PRK-ISS-005,ORD-006,CUST-1026,Midtown Orthopedic Clinic,GPO Pricing Conflict,MEDIUM,6800.0,Invoiced,14 days to resolution,REP-05,Marcus Johnson,"Update CUST-1026 GPO tier to Premier Tier2 in SAP + issue credit memo for $260",85.0,IQVIA Roster,Premier Tier2,List Price,Premier,DUROLANE 3mL,14,2026-03-18,Open,GPC-001,1,130.0,2,CAPA-002,"Premier Tier2 contract not applied at order creation for CUST-1026 — same root cause as CUST-1001","Revenue at risk","$260 chargeback exposure","Low audit risk","Contributing to 87% GPO mapping flag"
PRK-ISS-006,ORD-023,CUST-1012,Regional Surgical Center,GPO Pricing Conflict,HIGH,4270.0,Invoiced,6 days to resolution,Unassigned,Unassigned,"Resolve CUST-1012 duplicate GPO contract conflict — verify correct tier and issue correction memo",87.0,IQVIA Roster + Contract Master,Verified GPO Tier,CONFLICT,Premier,DUROLANE 3mL,6,2026-04-02,Open,GPC-014,1,0.0,2,CAPA-002,"Duplicate GPO contract assignment detected for CUST-1012 — conflicting tier records in SAP prevent correct price application","Revenue at risk from disputed pricing","$4270 potential chargeback","Compliance flag active","Contributing to 87% accuracy flag"
PRK-ISS-007,ORD-020,CUST-1009,Greenfield Spine Clinic,No GPO Membership,LOW,2500.0,Invoiced,18 days to action,Unassigned,Unassigned,"Enroll CUST-1009 in Vizient GPO and update SAP pricing master to apply Tier3 savings going forward",84.0,IQVIA Roster,Vizient Tier3,List Price (No GPO),None — No Membership,SUPARTZ FX 2.5mL,18,2026-03-15,Open,GPC-013,0,65.0,7,CAPA-002,"CUST-1009 has no active GPO membership on file — paying full list price $650 vs available Vizient Tier3 $585. Customer losing $65/unit savings","Revenue leakage (customer overpaying)","N/A — no chargeback","Low compliance risk","Unmapped — contributing to 87% accuracy flag"
PRK-ISS-008,,CUST-1027,Lakeside Medical Partners,Contract Expiring,MEDIUM,14000.0,,28 days to expiry,REP-05,Marcus Johnson,"Initiate GPC-011 TalisMann contract renewal with Premier Tier1 pricing before expiry",90.0,Contract Master + IQVIA,Premier Tier1,Expiring,Premier,TalisMann,28,2026-04-01,Open,GPC-011,0,0.0,0,CAPA-002,"GPC-011 TalisMann contract expires in 28 days — no renewal initiated. Customer will revert to list price $14000 vs Tier1 $12000","Revenue risk on renewal gap","$14000 contract value at risk","Compliance — contract lapse","GPO contract coverage at risk"
PRK-ISS-009,,CUST-1028,Westside Surgical Institute,Contract Expiring,MEDIUM,13500.0,,28 days to expiry,REP-03,Jennifer Mills,"Initiate GPC-012 StimTrial contract renewal with Premier Tier1 pricing before expiry",90.0,Contract Master + IQVIA,Premier Tier1,Expiring,Premier,StimTrial,28,2026-04-01,Open,GPC-012,0,0.0,0,CAPA-002,"GPC-012 StimTrial contract expires in 28 days — renewal required to maintain Tier1 pricing for CUST-1028","Revenue risk on renewal","$13500 contract value at risk","Compliance — lapse risk","GPO coverage at risk"
PRK-ISS-010,ORD-013,CUST-1027,Lakeside Medical Partners,Product Recalled,HIGH,4200.0,Invoiced,Immediate — regulatory violation,REP-05,Marcus Johnson,"Recall ORD-013 EXOGEN 4.0 — issue full credit of $4200 and notify CUST-1027 of recall status immediately",93.0,Regulatory Database + Contract Master,N/A — Recalled,RECALLED,Vizient,EXOGEN 4.0,0,2026-04-03,Open,GPC-017,1,0.0,1,CAPA-002,"ORD-013 for CUST-1027 was placed after EXOGEN 4.0 recall date (2025-09-15). Contract GPC-017 is now void — regulatory violation requiring immediate credit and notification","Regulatory and revenue risk","$4200 refund required","Regulatory violation — immediate action","Product removed from GPO catalog"
PRK-ISS-011,ORD-015,CUST-1026,Midtown Orthopedic Clinic,Product Recalled,HIGH,4200.0,Invoiced,Immediate — regulatory violation,REP-03,Jennifer Mills,"Recall ORD-015 EXOGEN 4.0 — issue full credit of $4200 and notify CUST-1026 of recall status immediately",93.0,Regulatory Database + Contract Master,N/A — Recalled,RECALLED,Premier,EXOGEN 4.0,0,2026-04-04,Open,GPC-016,1,0.0,1,CAPA-002,"ORD-015 for CUST-1026 was placed after EXOGEN 4.0 recall date (2025-09-15). Contract GPC-016 is now void — regulatory violation requiring immediate credit and notification","Regulatory and revenue risk","$4200 refund required","Regulatory violation — immediate action","Product removed from GPO catalog"
```

**Key data facts (the backend must compute and return these consistently):**
- **7 GPO Pricing Conflicts** (PRK-ISS-001 to 007): total `dollar_value` sum = **$61,370**
- **4 Contract-Risk issues** (PRK-ISS-008 to 011): 2 expiring + 2 recalled
- **Total open issues** = 11
- **Pre-invoice alerts** = 0 (all are post-invoice for pricing)
- **Annualized GPO exposure** = **$2,950,000** (hardcoded in dashboard endpoint)
- **My action queue** for logged-in persona (REP-05 Marcus Johnson): PRK-ISS-001, PRK-ISS-005, PRK-ISS-008, PRK-ISS-010
- **AI recommendation queue** (confidence ≥ 89%): PRK-ISS-001 (94%), PRK-ISS-002 (91%), PRK-ISS-003 (89%), PRK-ISS-008 (90%), PRK-ISS-009 (90%), PRK-ISS-010 (93%), PRK-ISS-011 (93%)
- **Contract Expiring issues** (PRK-ISS-008, 009) have empty `order_id` — **do not render "Affected Records" table or navigate to Transaction Lineage for these**. In Issue Intelligence, replace "Affected Records" with a "Contract Details" section showing the contract_id. The sticky footer for contract-expiring issues shows "Initiate Renewal" (navigates to Closure) instead of "Issue Credit Memo".
- **Product Recalled issues** (PRK-ISS-010, 011) have order_ids and navigate to Transaction Lineage normally.
- **PRK-ISS-007** (No GPO Membership) — `credit_memo_required = 0`, so no credit memo. In Transaction Lineage for this issue, the action button label is "Enroll in GPO" (navigates to Closure).

### 1B. Update `backend/data/seed_data.py`

In the `create_tables()` function, after the `tax_jurisdiction_issues` table block, add:

```python
c.execute("DROP TABLE IF EXISTS pricing_issues")
c.execute("""CREATE TABLE pricing_issues (
    issue_id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, customer_name TEXT,
    issue_type TEXT, priority TEXT, dollar_value REAL, invoice_status TEXT,
    urgency_label TEXT, owner_id TEXT, owner_name TEXT, ai_fix TEXT,
    ai_confidence REAL, ai_source TEXT, correct_tier TEXT, applied_tier TEXT,
    gpo_name TEXT, product TEXT, sla_days_remaining INTEGER, opened_date TEXT,
    status TEXT, contract_id TEXT, credit_memo_required INTEGER,
    overcharge_per_unit REAL, quantity_affected INTEGER, capa_id TEXT,
    root_cause TEXT, risk_revenue TEXT, risk_chargeback TEXT,
    risk_compliance TEXT, risk_gpo TEXT)""")
```

In the CSV loading section, after the `tax_jurisdiction_issues` load block, add:

```python
with open(CSV_DIR / "pricing_issues.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
conn.executemany(
    "INSERT INTO pricing_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
        (r["issue_id"], r["order_id"], r["customer_id"], r["customer_name"],
         r["issue_type"], r["priority"], float(r["dollar_value"]), r["invoice_status"],
         r["urgency_label"], r["owner_id"], r["owner_name"], r["ai_fix"],
         float(r["ai_confidence"]), r["ai_source"], r["correct_tier"],
         r["applied_tier"], r["gpo_name"], r["product"],
         int(r["sla_days_remaining"]) if r["sla_days_remaining"] else 0,
         r["opened_date"], r["status"], r["contract_id"],
         int(r["credit_memo_required"]) if r["credit_memo_required"] else 0,
         float(r["overcharge_per_unit"]) if r["overcharge_per_unit"] else 0.0,
         int(r["quantity_affected"]) if r["quantity_affected"] else 0,
         r["capa_id"], r["root_cause"], r["risk_revenue"],
         r["risk_chargeback"], r["risk_compliance"], r["risk_gpo"])
        for r in rows
    ],
)
```

After all seed edits, re-run:
```bash
cd backend && python data/seed_data.py
```

---

## PART 2 — BACKEND ROUTER

### 2A. Create `backend/routers/pricing.py`

**Mirror `backend/routers/tax.py` exactly** for the session management, override dict, load/merge functions, and `_workflow_status()` pattern. Adapt all tax-specific field names to pricing equivalents.

```python
import datetime
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

# Demo overrides scoped per browser session (reset on full page refresh)
_session_issue_overrides: dict[str, dict[str, dict]] = {}

LOGGED_IN_PRICING_OWNER = {"owner_id": "REP-05", "owner_name": "Marcus Johnson"}

PRICING_TEAM_OWNERS = [
    {"owner_id": "REP-05", "owner_name": "Marcus Johnson"},
    {"owner_id": "REP-03", "owner_name": "Jennifer Mills"},
    {"owner_id": "REP-04", "owner_name": "Linda Torres"},
]


def _next_pricing_owner(current_owner_id: str) -> dict:
    ids = [o["owner_id"] for o in PRICING_TEAM_OWNERS]
    try:
        idx = ids.index(current_owner_id)
    except ValueError:
        idx = -1
    return PRICING_TEAM_OWNERS[(idx + 1) % len(PRICING_TEAM_OWNERS)]


def get_pricing_demo_session(
    x_pricing_demo_session: str | None = Header(default=None, alias="X-Pricing-Demo-Session"),
) -> str:
    return x_pricing_demo_session or "default"


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
            "SELECT * FROM pricing_issues ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()
    return [_merge_issue(dict(r), session_id) for r in rows]


def _can_mark_resolved(issue: dict) -> bool:
    if issue.get("status") == "Resolved":
        return False
    if issue.get("ai_decision") == "approve":
        return True
    # Manual path: credit memo queued via Transaction Lineage
    return bool(issue.get("credit_memo_queued_at"))


def _workflow_status(issue: dict) -> dict:
    ai_approved = issue.get("ai_decision") == "approve"
    credit_memo_queued = bool(issue.get("credit_memo_queued_at"))
    can_resolve = _can_mark_resolved(issue)
    if ai_approved:
        path = "ai"
    elif credit_memo_queued:
        path = "manual_complete"
    else:
        path = "manual_in_progress"
    return {
        "ai_approved": ai_approved,
        "credit_memo_queued": credit_memo_queued,
        "can_mark_resolved": can_resolve,
        "resolution_path": path,
    }
```

#### Endpoint 1: `GET /api/pricing/dashboard`

```python
@router.get("/dashboard")
def pricing_dashboard(session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    open_issues = [i for i in issues if i.get("status") == "Open"]
    conflicts = [i for i in open_issues if i.get("issue_type") == "GPO Pricing Conflict" or i.get("issue_type") == "No GPO Membership"]
    contract_risks = [i for i in open_issues if i.get("issue_type") in ("Contract Expiring", "Product Recalled")]
    expiring = [i for i in contract_risks if i.get("issue_type") == "Contract Expiring"]
    recalled = [i for i in contract_risks if i.get("issue_type") == "Product Recalled"]

    total_exposure = round(sum(float(i.get("dollar_value", 0)) for i in conflicts), 2)
    annualized_gpo = 2_950_000.0

    # AI queue — confidence >= 89
    ai_queue = [i for i in open_issues if float(i.get("ai_confidence", 0)) >= 89]

    # My action queue — issues assigned to logged-in persona (REP-05)
    my_queue = [i for i in open_issues if i.get("owner_id") == LOGGED_IN_PRICING_OWNER["owner_id"]]

    # Top 5 alerts — sort by priority then dollar_value desc
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    sorted_alerts = sorted(
        open_issues,
        key=lambda x: (priority_order.get(x.get("priority", "LOW"), 9), -float(x.get("dollar_value", 0)))
    )[:5]

    return {
        "headline": {
            "total_exposure": total_exposure,
            "active_conflicts": len(conflicts),
            "expiring_contracts": len(expiring) + len(recalled),
            "annualized_gpo_exposure": annualized_gpo,
        },
        "data_quality_health": [
            {"metric": "GPO Mapping Accuracy", "score": 87, "status": "At Risk"},
            {"metric": "Contract Data Completeness", "score": 96.8, "status": "Healthy"},
        ],
        "kpi_cards": [
            {"name": "GPO Pricing Conflicts", "value": len(conflicts), "unit": "open", "description": "Customers charged above or outside their GPO contract price", "filter_type": "conflict"},
            {"name": "Expiring Contracts", "value": len(expiring), "unit": "open", "description": "GPO contracts expiring within 30 days requiring renewal action", "filter_type": "expiring"},
            {"name": "Product Recalls", "value": len(recalled), "unit": "open", "description": "Orders placed after product recall date — regulatory violations requiring immediate credit", "filter_type": "recalled"},
            {"name": "Compliance Exposure", "value": total_exposure, "unit": "dollars", "description": "Total dollar exposure from active GPO conflicts and recalled product orders", "filter_type": "all"},
            {"name": "Annualized GPO Exposure", "value": annualized_gpo, "unit": "dollars", "description": "Projected annual chargeback and revenue risk across active GPO contracts", "filter_type": "annualized"},
        ],
        "top_alerts": sorted_alerts,
        "ai_queue": ai_queue,
        "my_action_queue": my_queue,
        "all_open_issues": open_issues,
    }
```

#### Endpoint 2: `GET /api/pricing/issue/{issue_id}`

```python
@router.get("/issue/{issue_id}")
def pricing_issue(issue_id: str, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    is_conflict = issue["issue_type"] in ("GPO Pricing Conflict", "No GPO Membership")
    is_expiring = issue["issue_type"] == "Contract Expiring"
    is_recalled = issue["issue_type"] == "Product Recalled"

    overcharge = float(issue.get("overcharge_per_unit", 0)) * int(issue.get("quantity_affected", 0) or 0)

    if is_conflict:
        what_happened = (
            f"{issue['customer_name']} was charged at {issue['applied_tier']} — "
            f"their {issue['gpo_name']} contract ({issue['contract_id']}) entitles them to {issue['correct_tier']} pricing. "
            f"Overcharge of ${overcharge:,.2f} on this order. Total compliance exposure: ${float(issue['dollar_value']):,.2f}."
        )
    elif is_expiring:
        what_happened = (
            f"Contract {issue['contract_id']} for {issue['customer_name']} expires in {issue['sla_days_remaining']} days. "
            f"No renewal has been initiated. Customer will revert to list price — ${float(issue['dollar_value']):,.2f} contract value at risk."
        )
    else:
        what_happened = (
            f"Order {issue['order_id']} for {issue['customer_name']} was placed after the {issue['product']} recall date. "
            f"Contract {issue['contract_id']} is now void. A credit of ${float(issue['dollar_value']):,.2f} is required immediately."
        )

    affected_records = []
    if issue.get("order_id"):
        affected_records.append({
            "record_type": "Order",
            "record_id": issue["order_id"],
            "customer": issue["customer_name"],
            "contract": issue["contract_id"],
            "detail": f"{issue['applied_tier']} applied — should be {issue['correct_tier']}" if is_conflict else f"Order placed after recall — credit required",
        })
    else:
        affected_records.append({
            "record_type": "Contract",
            "record_id": issue["contract_id"],
            "customer": issue["customer_name"],
            "contract": issue["contract_id"],
            "detail": f"Expires in {issue['sla_days_remaining']} days — renewal required",
        })

    return {
        "issue": issue,
        "header": {
            "issue_type": issue["issue_type"],
            "customer": f"{issue['customer_id']} {issue['customer_name']} — {issue.get('order_id', issue['contract_id'])}",
            "priority": issue["priority"],
            "dollar_impact": issue["dollar_value"],
            "opened_on": issue["opened_date"],
            "sla": f"{issue['sla_days_remaining']} days remaining",
        },
        "what_happened": what_happened,
        "business_risk": [
            {"risk_type": "Revenue at Risk", "status": issue["risk_revenue"], "detail": "Chargeback initiated by customer will recover overcharge" if is_conflict else "Contract gap creates immediate revenue leakage"},
            {"risk_type": "Chargeback Exposure", "status": issue["risk_chargeback"], "detail": "Customer will dispute invoice once overcharge detected" if is_conflict else "N/A"},
            {"risk_type": "GPO Compliance", "status": issue["risk_compliance"], "detail": "GPO contract obligation requires correct tier pricing at all times"},
            {"risk_type": "Mapping Accuracy", "status": issue["risk_gpo"], "detail": "Every open conflict reduces overall GPO mapping accuracy score"},
        ],
        "owner": {
            "owner_id": issue["owner_id"],
            "owner_name": issue["owner_name"],
            "assigned_on": issue["opened_date"],
            "next_action": f"Issue credit memo for ${overcharge:,.2f} + update SAP pricing master for {issue['customer_id']}" if is_conflict else f"Initiate contract renewal for {issue['contract_id']}",
            "sla_remaining": f"{issue['sla_days_remaining']} days remaining",
        },
        "ai_recommendation": {
            "fix": issue["ai_fix"],
            "confidence": issue["ai_confidence"],
            "source": issue["ai_source"],
            "order_id": issue.get("order_id", ""),
            "correct_tier": issue["correct_tier"],
        },
        "affected_records": affected_records,
        "has_order": bool(issue.get("order_id")),
        "prescribed_actions": [
            f"Step 1 — Validate GPO roster tier for {issue['customer_id']} in IQVIA",
            f"Step 2 — Issue credit memo for ${overcharge:,.2f}" if overcharge > 0 else f"Step 2 — Initiate contract renewal for {issue['contract_id']}",
            f"Step 3 — Update SAP pricing master for {issue['customer_id']}",
            "Step 4 — Mark issue resolved and close alert",
        ],
        "why_it_happened": issue["root_cause"],
        "preventive_actions": [
            "Step 1 — Set up automated GPO roster sync with IQVIA",
            "Step 2 — Add membership verification checkpoint at order creation",
            "Step 3 — Quarterly IQVIA roster review and SAP pricing master audit",
        ],
        "capa_linkage": {
            "capa_id": issue["capa_id"],
            "regulation": "FDA QMSR — 21 CFR Part 820",
            "status": "In Progress",
            "owner": "Marcus Johnson — Chief Data Officer",
            "due_date": "2026-05-01",
        },
        "workflow": _workflow_status(issue),
    }
```

#### Endpoint 3: `GET /api/pricing/transaction/{order_id}`

```python
@router.get("/transaction/{order_id}")
def pricing_transaction(order_id: str, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i.get("order_id") == order_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Transaction not found")

    with _connect() as conn:
        order = conn.execute("SELECT * FROM sales_orders WHERE order_id = ?", (order_id,)).fetchone()
        gpo = conn.execute("SELECT * FROM gpo_contracts WHERE contract_id = ?", (issue["contract_id"],)).fetchone()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order = dict(order)
    gpo = dict(gpo) if gpo else {}
    overcharge_per_unit = float(issue.get("overcharge_per_unit", 0))
    qty = int(issue.get("quantity_affected", 0) or 0)
    credit_memo_amount = round(overcharge_per_unit * qty, 2)
    is_conflict = issue["issue_type"] in ("GPO Pricing Conflict", "No GPO Membership")

    action_label = "Issue Credit Memo" if int(issue.get("credit_memo_required", 0)) else "Enroll in GPO"

    return {
        "order_header": {
            "order_id": order["order_id"],
            "customer": f"{order['customer_id']} {issue['customer_name']}",
            "product": order["product_name"],
            "order_date": order["order_date"],
            "invoice_date": order.get("ship_date", ""),
            "status": "Invoiced" if order.get("revenue_recognized") == "Yes" else "Pending",
        },
        "pricing_breakdown": {
            "contract_price": float(gpo.get("contracted_price", 0)),
            "charged_price": float(gpo.get("charged_price", float(order.get("unit_price", 0)))),
            "overcharge_per_unit": overcharge_per_unit,
            "credit_memo_amount": credit_memo_amount,
            "gpo": issue["gpo_name"],
            "correct_tier": issue["correct_tier"],
            "applied_tier": issue["applied_tier"],
        },
        "what_went_wrong": (
            f"{order['product_name']} was invoiced at {issue['applied_tier']} because GPO membership tier "
            f"was not updated in SAP at time of order creation — overcharge of ${credit_memo_amount:,.2f} on this order."
        ) if is_conflict else (
            f"{order['product_name']} order {order_id} was placed after the product recall date. "
            f"A full credit of ${float(issue['dollar_value']):,.2f} is required."
        ),
        "ai_recommendation": {
            "fix": f"Issue credit memo of ${credit_memo_amount:,.2f} for {order_id} + update SAP pricing master for {issue['customer_id']}",
            "confidence": float(issue["ai_confidence"]) + 2,
            "source": issue["ai_source"],
        },
        "order_trail": [
            {"date": order["order_date"], "event": "Order created", "price_applied": issue["applied_tier"], "status": "Processed", "correction": "Pending"},
            {"date": order.get("ship_date", ""), "event": "Invoiced", "price_applied": issue["applied_tier"], "status": "Invoiced", "correction": "Credit memo required"},
        ],
        "mapping_accuracy": {
            "gpo_roster_confidence": 87,
            "signal": f"Tier mismatch detected at order creation — {issue['applied_tier']} applied instead of {issue['correct_tier']}",
            "chargeback_exposure": credit_memo_amount,
        },
        "customer_hierarchy": {
            "idn": "IDN-003 MedStar Alliance",
            "hospital": f"{issue['customer_name']} Regional",
            "clinic": f"{issue['customer_id']} {issue['customer_name']}",
        },
        "cross_team_visibility": [
            {"team": "Tax & Compliance", "issue": f"Tax jurisdiction mismatch on {order_id}", "owner": "Linda Torres"},
            {"team": "Credit & AR", "issue": "Payment hold recommended pending credit memo", "owner": "Finance Team"},
            {"team": "Market Access", "issue": f"GPO membership unverified for {issue['customer_id']}", "owner": "Market Access Team"},
        ],
        "capa_linkage": {
            "capa_id": issue["capa_id"],
            "regulation": "FDA QMSR — 21 CFR Part 820",
            "status": "In Progress",
            "owner": f"{issue['owner_name']} — Pricing Analyst",
            "due_date": "2026-05-01",
        },
        "issue_id": issue["issue_id"],
        "action_label": action_label,
        "workflow": _workflow_status(issue),
    }
```

#### Endpoint 4: `GET /api/pricing/closure/{issue_id}`

```python
@router.get("/closure/{issue_id}")
def pricing_closure(issue_id: str, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    today = datetime.date.today().isoformat()
    overcharge = float(issue.get("overcharge_per_unit", 0)) * int(issue.get("quantity_affected", 0) or 0)
    credit_memo_amount = overcharge if overcharge > 0 else float(issue.get("dollar_value", 0))

    open_issues_before = [i for i in issues if i.get("status") == "Open"]
    conflicts_before = [i for i in open_issues_before if i.get("issue_type") in ("GPO Pricing Conflict", "No GPO Membership")]
    exposure_before = round(sum(float(i.get("dollar_value", 0)) for i in conflicts_before), 2)
    exposure_after = round(exposure_before - float(issue.get("dollar_value", 0)), 2) if issue.get("issue_type") in ("GPO Pricing Conflict", "No GPO Membership") else exposure_before

    accuracy_before = 87
    accuracy_after = min(100, accuracy_before + 1)

    return {
        "resolution_confirmation": {
            "issue": f"{issue['issue_type']} — {issue.get('order_id', issue['contract_id'])}",
            "resolved_by": issue.get("owner_id", LOGGED_IN_PRICING_OWNER["owner_id"]),
            "resolved_by_name": issue.get("owner_name", LOGGED_IN_PRICING_OWNER["owner_name"]),
            "date": today,
            "resolution_type": f"Credit Memo ${credit_memo_amount:,.2f} Issued + SAP Pricing Master Updated" if int(issue.get("credit_memo_required", 0)) else "GPO Enrollment Initiated + SAP Pricing Master Updated",
            "exposure_recovered": float(issue.get("dollar_value", 0)),
        },
        "what_was_updated": [
            f"SAP Pricing Master updated — {issue['applied_tier']} corrected to {issue['correct_tier']} for {issue['customer_id']}",
            f"Credit memo ${credit_memo_amount:,.2f} issued for {issue.get('order_id', 'N/A')}" if int(issue.get("credit_memo_required", 0)) else f"GPO enrollment initiated for {issue['customer_id']}",
            f"{issue['capa_id']} updated",
            "Alert closed and removed from queue",
            f"Cross-team notifications sent to Tax & Compliance, Credit & AR, Market Access",
        ],
        "ai_action_log": {
            "recommendation": issue["ai_fix"],
            "approved_by": issue.get("owner_id", LOGGED_IN_PRICING_OWNER["owner_id"]),
            "confidence": issue["ai_confidence"],
            "logged_on": today,
        },
        "kpi_impact": {
            "gpo_conflicts": {"before": len(conflicts_before), "after": max(0, len(conflicts_before) - 1)},
            "gpo_mapping_accuracy": {"before": f"{accuracy_before}%", "after": f"{accuracy_after}%"},
            "total_exposure": {"before": int(exposure_before), "after": max(0, int(exposure_after))},
            "annualized_gpo_exposure": {"before": 2950000, "after": max(0, 2950000 - int(float(issue.get("dollar_value", 0)) * 12))},
        },
        "cross_team_notifications": [
            {"team": "Tax & Compliance", "notification": f"Order {issue.get('order_id', 'N/A')} tax jurisdiction recheck recommended after pricing correction"},
            {"team": "Credit & AR", "notification": f"Credit memo ${credit_memo_amount:,.2f} issued — payment hold for {issue['customer_id']} can be released"},
            {"team": "Market Access", "notification": f"GPO membership verification completed for {issue['customer_id']} — {issue['gpo_name']} {issue['correct_tier']} confirmed"},
        ],
        "issue_id": issue_id,
    }
```

#### Endpoint 5: `POST /api/pricing/ai-action` (Approve / Reject)

Mirror `POST /api/tax/ai-action` exactly. Store the decision in `_session_overrides`:

```python
class PricingAiActionBody(BaseModel):
    issue_id: str
    action: Literal["approve", "reject"]

@router.post("/ai-action")
def pricing_ai_action(body: PricingAiActionBody, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    overrides = _session_overrides(session_id)
    patch: dict = {"ai_decision": body.action}
    if body.action == "approve":
        patch["urgency_label"] = "AI fix approved — pending SAP pricing master update"
    else:
        patch["urgency_label"] = "AI rejected — follow prescribed manual actions"
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **patch}
    merged = _merge_issue(issue, session_id)
    return {"issue_id": body.issue_id, "action": body.action, "workflow": _workflow_status(merged)}
```

#### Endpoint 6: `POST /api/pricing/resolve`

Mirror `POST /api/tax/resolve` exactly. Mark the issue resolved in session overrides, return closure payload:

```python
class PricingResolveBody(BaseModel):
    issue_id: str

@router.post("/resolve")
def pricing_resolve(body: PricingResolveBody, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if not _can_mark_resolved(issue):
        raise HTTPException(status_code=400, detail="Issue cannot be resolved yet — approve AI recommendation or complete credit memo step")
    today = datetime.date.today().isoformat()
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), "status": "Resolved", "resolved_at": today}
    # Return closure payload via existing GET endpoint logic
    return pricing_closure(body.issue_id, session_id)
```

#### Endpoint 7: `POST /api/pricing/reassign`

```python
class PricingReassignBody(BaseModel):
    issue_id: str
    owner_id: str | None = None

@router.post("/reassign")
def pricing_reassign(body: PricingReassignBody, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    new_owner = next((o for o in PRICING_TEAM_OWNERS if o["owner_id"] == body.owner_id), None) if body.owner_id else _next_pricing_owner(issue.get("owner_id", ""))
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **new_owner}
    return {"issue_id": body.issue_id, **new_owner}
```

#### Endpoint 8: `POST /api/pricing/credit-memo-queued`

Called when the user clicks "Issue Credit Memo" in Transaction Lineage — marks manual path step complete:

```python
class PricingCreditMemoBody(BaseModel):
    issue_id: str

@router.post("/credit-memo-queued")
def pricing_credit_memo_queued(body: PricingCreditMemoBody, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    today = datetime.date.today().isoformat()
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), "credit_memo_queued_at": today}
    merged = _merge_issue(issue, session_id)
    return {"issue_id": body.issue_id, "workflow": _workflow_status(merged)}
```

### 2B. Register in `backend/main.py`

Add import:
```python
from routers import pricing
```

Add after the last `app.include_router(...)`:
```python
app.include_router(pricing.router)
```

---

## PART 3 — FRONTEND API TYPES & SERVICE

### 3A. Create `frontend/src/services/pricingSession.ts`

Copy `taxSession.ts` and adapt:

```typescript
/** New ID on each full page load — demo actions reset when the user refreshes. */
let pricingDemoSessionId: string | null = null;

export function getPricingDemoSessionId(): string {
  if (!pricingDemoSessionId) {
    pricingDemoSessionId = crypto.randomUUID();
  }
  return pricingDemoSessionId;
}

export function pricingDemoSessionHeaders(): Record<string, string> {
  return { "X-Pricing-Demo-Session": getPricingDemoSessionId() };
}
```

### 3B. Add to `frontend/src/services/api.ts`

Import the new session helper at the top (alongside the existing taxDemoSessionHeaders import):
```typescript
import { pricingDemoSessionHeaders } from "./pricingSession";
```

After the existing Tax interfaces, add these new TypeScript interfaces:

```typescript
// ── Pricing Dashboard ─────────────────────────────────────────────────────────

export interface PricingHeadline {
  total_exposure: number;
  active_conflicts: number;
  expiring_contracts: number;
  annualized_gpo_exposure: number;
}

export interface PricingDataQualityHealth {
  metric: string;
  score: number;
  status: string;
}

export interface PricingKpiCard {
  name: string;
  value: number;
  unit: "open" | "dollars";
  description: string;
  filter_type: string;
}

export interface PricingIssueRow {
  issue_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  issue_type: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dollar_value: number;
  invoice_status: string;
  urgency_label: string;
  owner_id: string;
  owner_name: string;
  ai_fix: string;
  ai_confidence: number;
  ai_source: string;
  correct_tier: string;
  applied_tier: string;
  gpo_name: string;
  product: string;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  contract_id: string;
  credit_memo_required: number;
  overcharge_per_unit: number;
  quantity_affected: number;
  capa_id: string;
}

export interface PricingDashboard {
  headline: PricingHeadline;
  data_quality_health: PricingDataQualityHealth[];
  kpi_cards: PricingKpiCard[];
  top_alerts: PricingIssueRow[];
  ai_queue: PricingIssueRow[];
  my_action_queue: PricingIssueRow[];
  all_open_issues: PricingIssueRow[];
}

// ── Pricing Issue Intelligence ────────────────────────────────────────────────

export interface PricingWorkflowStatus {
  ai_approved: boolean;
  credit_memo_queued: boolean;
  can_mark_resolved: boolean;
  resolution_path: string;
}

export interface PricingIssueDetail {
  issue: PricingIssueRow;
  header: Record<string, string | number>;
  what_happened: string;
  business_risk: { risk_type: string; status: string; detail: string }[];
  owner: { owner_id: string; owner_name: string; assigned_on: string; next_action: string; sla_remaining: string };
  ai_recommendation: { fix: string; confidence: number; source: string; order_id: string; correct_tier: string };
  affected_records: { record_type: string; record_id: string; customer: string; contract: string; detail: string }[];
  has_order: boolean;
  prescribed_actions: string[];
  why_it_happened: string;
  preventive_actions: string[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  workflow: PricingWorkflowStatus;
}

// ── Pricing Transaction Lineage ───────────────────────────────────────────────

export interface PricingTransactionDetail {
  order_header: Record<string, string | number>;
  pricing_breakdown: { contract_price: number; charged_price: number; overcharge_per_unit: number; credit_memo_amount: number; gpo: string; correct_tier: string; applied_tier: string };
  what_went_wrong: string;
  ai_recommendation: { fix: string; confidence: number; source: string };
  order_trail: { date: string; event: string; price_applied: string; status: string; correction: string }[];
  mapping_accuracy: { gpo_roster_confidence: number; signal: string; chargeback_exposure: number };
  customer_hierarchy: { idn: string; hospital: string; clinic: string };
  cross_team_visibility: { team: string; issue: string; owner: string }[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  issue_id: string;
  action_label: string;
  workflow: PricingWorkflowStatus;
}

// ── Pricing Closure ───────────────────────────────────────────────────────────

export interface PricingClosure {
  resolution_confirmation: { issue: string; resolved_by: string; resolved_by_name: string; date: string; resolution_type: string; exposure_recovered: number };
  what_was_updated: string[];
  ai_action_log: { recommendation: string; approved_by: string; confidence: number; logged_on: string };
  kpi_impact: Record<string, { before: number | string; after: number | string }>;
  cross_team_notifications: { team: string; notification: string }[];
  issue_id: string;
}
```

In the `api` object, add these methods. **Each call includes `pricingDemoSessionHeaders()` as extra headers** — look at how the Tax API methods pass `taxDemoSessionHeaders()` and mirror that pattern exactly:

```typescript
getPricingDashboard: () =>
  get<PricingDashboard>("/api/pricing/dashboard", { headers: pricingDemoSessionHeaders() }),

getPricingIssue: (issueId: string) =>
  get<PricingIssueDetail>(`/api/pricing/issue/${issueId}`, { headers: pricingDemoSessionHeaders() }),

getPricingTransaction: (orderId: string) =>
  get<PricingTransactionDetail>(`/api/pricing/transaction/${orderId}`, { headers: pricingDemoSessionHeaders() }),

getPricingClosure: (issueId: string) =>
  get<PricingClosure>(`/api/pricing/closure/${issueId}`, { headers: pricingDemoSessionHeaders() }),

pricingAiAction: (issueId: string, action: "approve" | "reject") =>
  post<{ issue_id: string; action: string; workflow: PricingWorkflowStatus }>(
    "/api/pricing/ai-action",
    { issue_id: issueId, action },
    { headers: pricingDemoSessionHeaders() }
  ),

pricingResolve: (issueId: string) =>
  post<PricingClosure>("/api/pricing/resolve", { issue_id: issueId }, { headers: pricingDemoSessionHeaders() }),

pricingReassign: (issueId: string, ownerId?: string) =>
  post<{ issue_id: string; owner_id: string; owner_name: string }>(
    "/api/pricing/reassign",
    { issue_id: issueId, owner_id: ownerId },
    { headers: pricingDemoSessionHeaders() }
  ),

pricingCreditMemoQueued: (issueId: string) =>
  post<{ issue_id: string; workflow: PricingWorkflowStatus }>(
    "/api/pricing/credit-memo-queued",
    { issue_id: issueId },
    { headers: pricingDemoSessionHeaders() }
  ),
```

**Note on `get()` / `post()` helpers:** Look at how the existing `getTaxDashboard` and `taxAiAction` methods are implemented in `api.ts` and mirror the exact same call signature, including how the session headers are passed. Do not invent a new pattern.

---

## PART 4 — FRONTEND PAGES

Create `frontend/src/pages/pricing/` directory and create 4 files inside it.

### Styling conventions — identical to Tax pages:
- Cards: `rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6`
- Page wrapper: `<div className="space-y-6 pb-24">` (pb-24 for sticky footer clearance)
- Section headings: `text-xl font-bold text-slate-900 dark:text-slate-100`
- Priority badge HIGH: `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`
- Priority badge MEDIUM: `bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300`
- Priority badge LOW: `bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300`
- AI Approve button: `bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg`
- Reject button: `bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-sm px-4 py-2 rounded-lg`
- Sticky footer: `fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-3 z-50`
- Tables: `min-w-full text-sm`, thead `text-left text-slate-500 border-b`, tbody rows with `hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer`
- Money format: `toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })`
- Loading state: `<div className="text-sm text-slate-500">Loading...</div>`

---

### 4A. `frontend/src/pages/pricing/PricingDashboard.tsx` — Step 1

**Study `TaxDashboard.tsx` first.** This page must be a structural clone with pricing-specific content.

```
State:
  - data: PricingDashboard | null
  - loading: boolean
  - aiState: Record<string, "approved" | "rejected">  ← tracks AI decisions per issue_id
  - activeKpiModal: string | null  ← which KPI filter_type is open in modal

On mount: call api.getPricingDashboard() → set data

Layout sections (in this order):

1. PAGE TITLE ROW
   "Pricing Exposure Dashboard" (h1) + role context banner
   Subtitle with 4 pill badges from data.headline:
   - "${total_exposure}" in red
   - "${active_conflicts} conflicts" in orange
   - "${expiring_contracts} contracts expiring" in yellow
   - "$2.95M annualized GPO exposure" in slate

2. DATA QUALITY HEALTH
   Two rows: metric name | color-coded progress bar (red if score < 90%, green if ≥ 90%) | status badge

3. KPI CARDS — 5 cards in responsive grid (2 col mobile, 5 col xl)
   Each card is a <button> (not a div).
   On click → set activeKpiModal to the card's filter_type.
   Card hover: `hover:ring-2 hover:ring-indigo-400 cursor-pointer transition-all`
   Each card shows: name, formatted value, description, small hint "View details →"

4. KPI MODAL (rendered as a fixed overlay when activeKpiModal is not null)
   Mirror the Tax KPI modal pattern from TaxDashboard.tsx exactly.
   Modal structure:
   - Fixed overlay: `fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4`
   - Inner panel: `bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-y-auto p-6`
   - Header row: KPI name + "Back to Dashboard" button (closes modal) + X button
   - Filtered issues table — columns: Issue ID | Customer | Product | Issue Type | Priority | $ Value | Owner
   - For filter_type "conflict": show PRK-ISS-001 to 007 (issue_type in GPO Pricing Conflict, No GPO Membership)
   - For filter_type "expiring": show PRK-ISS-008, 009
   - For filter_type "recalled": show PRK-ISS-010, 011
   - For filter_type "all": show all open issues
   - For filter_type "annualized": show a text explanation + the 5 largest contracts, NOT a table of issues
   - Each row clickable → navigate to /pricing/issue/${row.issue_id}, close modal first
   Close on overlay click or X button.

5. TOP 5 ALERTS TABLE (always visible, not affected by KPI modal)
   Columns: Issue ID | Customer | Issue Type | Priority | $ Value | Invoice Status | Owner
   - Each row clickable → navigate to /pricing/issue/${row.issue_id}
   - HIGH priority rows: left border accent `border-l-4 border-red-400`
   - MEDIUM rows: `border-l-4 border-yellow-400`

6. AI RECOMMENDATION QUEUE
   For each row in data.ai_queue:
   Show: Customer | Current Tier | AI Suggested Fix | Confidence % | Source | Approve / Reject buttons
   - Approve click:
     1. call api.pricingAiAction(issue_id, "approve")
     2. update aiState[issue_id] = "approved"
     3. show ✓ Approved green badge, disable both buttons
   - Reject click:
     1. call api.pricingAiAction(issue_id, "reject")
     2. update aiState[issue_id] = "rejected"
     3. show ✗ Rejected slate badge, disable both buttons

7. MY ACTION QUEUE
   Columns: Issue ID | Issue Type | Product | Priority | $ Value | SLA | Action button "Triage"
   - "Triage" click → navigate to /pricing/issue/${row.issue_id}
```

---

### 4B. `frontend/src/pages/pricing/PricingIssueIntelligence.tsx` — Step 2

**Study `IssueIntelligence.tsx` first.** Mirror it with pricing-specific fields.

```
Route param: issueId from useParams()
State:
  - data: PricingIssueDetail | null
  - loading: boolean
  - aiAction: "approved" | "rejected" | null
  - openSections: Record<string, boolean>

On mount: call api.getPricingIssue(issueId) → set data

Layout sections (in this order):

1. BACK BUTTON
   "← Back to Dashboard" → navigate to /pricing-dashboard

2. ISSUE HEADER CARD
   Banner row: Issue Type | Customer (customer_id + customer_name + order/contract) | Priority badge | $ Impact | Opened On | SLA countdown
   - SLA badge: red if sla_days_remaining ≤ 3, yellow if ≤ 7, else slate
   - If issue_type is "Product Recalled": show a red "⚠ REGULATORY VIOLATION" banner above the header

3. WHAT HAPPENED
   Plain text paragraph from data.what_happened inside an info card

4. BUSINESS RISK & IMPACT
   4-row table: Risk Type | Status | Detail

5. OWNER & NEXT ACTION
   Table row: Owner | Assigned On | Next Action | SLA Remaining

6. AI RECOMMENDATION BOX (distinct card, yellow-500 left border)
   - Shows: fix text | confidence % badge | source
   - Approve / Reject buttons with same backend-call pattern as Dashboard
     (call api.pricingAiAction, update aiAction state)
   - After approval: show green ✓ Approved badge, disable buttons, show "Mark Resolved" pulsing green below
   - Link: "Not comfortable approving? View Prescribed Actions ▼" — opens Prescribed Actions accordion

7. AFFECTED RECORDS
   Table: Record Type | Record ID | Customer | Contract | Detail
   - Each row with order_id (has_order == true): clickable → navigate to /pricing/transaction/${order_id}
   - Rows with only contract_id (has_order == false — Contract Expiring): NOT clickable, show a lock icon, tooltip "Navigate to contract view"
   - For Product Recalled issues: the row is clickable → /pricing/transaction/${order_id}

8. STICKY FOOTER (3 buttons):
   - "Acknowledge" → POST to set acknowledged (use pricingAiAction or a simple local state flag)
   - "Mark Resolved" →
       - If data.workflow.can_mark_resolved: call api.pricingResolve(issueId) then navigate to /pricing/closure/${issueId}
       - If NOT can_mark_resolved AND has_order: navigate to /pricing/transaction/${issue.order_id} with a toast "Complete credit memo step first"
       - If NOT can_mark_resolved AND NOT has_order (contract expiring): navigate to /pricing/closure/${issueId} anyway (renewal is the closure)
   - Button style for Mark Resolved:
       - Green (enabled): `bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium`
       - Gray (disabled): `bg-slate-300 dark:bg-slate-700 text-slate-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed`
   - "Reassign" → call api.pricingReassign(issueId) then show a toast with the new owner name

9. COLLAPSED ACCORDION SECTIONS (start closed, toggle on header click):
   - ▶ Prescribed Actions — numbered list from data.prescribed_actions
     (Auto-expands if aiAction === null, mirror Tax pattern)
   - ▶ Why It Happened — paragraph from data.why_it_happened
   - ▶ Preventive Actions — numbered list from data.preventive_actions
   - ▶ CAPA Linkage — table row: CAPA ID | Regulation | Status | Owner | Due Date
```

---

### 4C. `frontend/src/pages/pricing/PricingTransactionLineage.tsx` — Step 3

**Study `TransactionLineage.tsx` first.** Mirror with pricing-specific pricing_breakdown instead of jurisdiction_breakdown.

```
Route param: orderId from useParams()
State:
  - data: PricingTransactionDetail | null
  - loading: boolean
  - aiApproved: boolean
  - openSections: Record<string, boolean>

On mount: call api.getPricingTransaction(orderId) → set data

Layout sections (in this order):

1. BREADCRUMB
   "← Back to Issue" → navigate to /pricing/issue/${data.issue_id}

2. ORDER HEADER CARD
   Table row: Order ID | Customer | Product | Order Date | Invoice Date | Status

3. PRICING BREAKDOWN TABLE (the core of this page)
   Two-row comparison:
   Row 1 — "Contract Price": correct_tier | gpo | contracted_price (green text ✓)
   Row 2 — "Charged Price": applied_tier | gpo | charged_price (red text ✗ + warning icon)
   Below: "Overcharge per unit: $X | Quantity: N | Credit Memo Required: $Y" highlighted in red banner

4. WHAT WENT WRONG
   Plain text paragraph from data.what_went_wrong

5. AI RECOMMENDATION BOX (yellow-500 left border, same pattern as Step 2)
   - Shows: fix text | confidence (+2 over Step 2 value) | source
   - Approve / Reject buttons
   - Note: if user already approved in Step 2, pre-fill as approved (check workflow.ai_approved)

6. STICKY FOOTER:
   Buttons (in order):
   - data.action_label ("Issue Credit Memo" OR "Enroll in GPO" OR "Recall Order"):
     1. call api.pricingCreditMemoQueued(data.issue_id) to mark manual path step complete
     2. navigate to /pricing/closure/${data.issue_id}
   - "View Contract" → link to /revenue?tab=agreement-expiry (opens existing Revenue page)
   - "View Customer" → link to /hierarchy (opens existing Hierarchy page)
   - "Back to Issue" → navigate to /pricing/issue/${data.issue_id}

7. COLLAPSED ACCORDION SECTIONS:
   - ▶ Order Trail — table: date | event | price_applied | status | correction
   - ▶ Mapping Accuracy & Risk Signal — shows gpo_roster_confidence, signal text, chargeback_exposure
   - ▶ Customer Hierarchy — IDN → Hospital → Clinic tree
   - ▶ Cross-Team Visibility — table: Team | Issue | Owner
   - ▶ CAPA Linkage — table: CAPA ID | Regulation | Status | Owner | Due Date
```

---

### 4D. `frontend/src/pages/pricing/PricingClosure.tsx` — Step 4

**Study `TaxClosure.tsx` first.** Create `frontend/src/utils/pricingClosureFormat.ts` (copy `taxClosureFormat.ts` and adapt for pricing KPI types).

```
Route param: issueId from useParams()
State:
  - data: PricingClosure | null
  - loading: boolean

On mount: call api.getPricingClosure(issueId) → set data

Layout sections (in this order):

1. RESOLUTION BANNER
   Large green success card with CheckCircle icon from lucide-react:
   Title: "GPO Conflict Resolved ✓" (or "Contract Renewal Initiated ✓" for expiring issues)
   Subtitle: "Compliance exposure recovered: ${resolution_confirmation.exposure_recovered formatted}"

2. RESOLUTION CONFIRMATION TABLE
   Rows: Issue | Resolved By | Date | Resolution Type | Exposure Recovered

3. WHAT WAS UPDATED
   Bulleted list from data.what_was_updated, each prefixed with green ✓

4. AI ACTION LOG
   Table: Recommendation | Approved By | Confidence | Logged On

5. IMPACT ON DASHBOARD (KPI before/after table)
   Use pricingClosureFormat.ts for correct formatting by KPI type:
   - gpo_conflicts: integer (e.g. "7" → "6")
   - gpo_mapping_accuracy: percentage string (e.g. "87%" → "88%")
   - total_exposure: money (e.g. "$61,370" → "$49,370")
   - annualized_gpo_exposure: money
   "After" column values in emerald/green text.

6. CROSS-TEAM NOTIFICATION TABLE
   Columns: Team | What They Were Notified About

7. "Return to Dashboard" BUTTON
   Centered, large: `bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold`
   onClick: navigate to /pricing-dashboard
```

---

## PART 5 — ROUTING, NAVIGATION & ROLE UPDATES

### 5A. Update `frontend/src/App.tsx`

Add 4 new lazy imports after the existing Tax lazy imports:

```typescript
const PricingDashboard = lazy(() => import("./pages/pricing/PricingDashboard"));
const PricingIssueIntelligence = lazy(() => import("./pages/pricing/PricingIssueIntelligence"));
const PricingTransactionLineage = lazy(() => import("./pages/pricing/PricingTransactionLineage"));
const PricingClosure = lazy(() => import("./pages/pricing/PricingClosure"));
```

Inside `<Routes>`, after the tax routes, add:

```tsx
<Route path="/pricing-dashboard" element={<PricingDashboard />} />
<Route path="/pricing/issue/:issueId" element={<PricingIssueIntelligence />} />
<Route path="/pricing/transaction/:orderId" element={<PricingTransactionLineage />} />
<Route path="/pricing/closure/:issueId" element={<PricingClosure />} />
```

### 5B. Create `frontend/src/config/pricingTeamNav.ts`

Mirror `taxTeamNav.ts` exactly:

```typescript
import type { ComponentType } from "react";
import { DollarSign, Search, Route, CircleCheck } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

export const PRICING_DEMO = {
  issueId: "PRK-ISS-001",
  orderId: "ORD-010",
  closureIssueId: "PRK-ISS-001",
} as const;

export type PricingTeamNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const PRICING_TEAM_SECTION = "PRICING TEAM USER";

export const pricingTeamNavItems: PricingTeamNavItem[] = [
  {
    path: "/pricing-dashboard",
    label: "Pricing Dashboard",
    icon: DollarSign,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname === "/pricing-dashboard",
  },
  {
    path: `/pricing/issue/${PRICING_DEMO.issueId}`,
    label: "Issue Intelligence",
    icon: Search,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname.startsWith("/pricing/issue/"),
  },
  {
    path: `/pricing/transaction/${PRICING_DEMO.orderId}`,
    label: "Transaction Lineage",
    icon: Route,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname.startsWith("/pricing/transaction/"),
  },
  {
    path: `/pricing/closure/${PRICING_DEMO.closureIssueId}`,
    label: "Pricing Closure",
    icon: CircleCheck,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname.startsWith("/pricing/closure/"),
  },
];

export function canAccessPricingTeamNav(roleId: RoleId): boolean {
  return roleId === "pricing_analyst" || roleId === "admin";
}
```

### 5C. Update `frontend/src/components/Layout.tsx`

**Step 1 — Add imports at top** (alongside existing taxTeamNav imports):
```typescript
import {
  canAccessPricingTeamNav,
  pricingTeamNavItems,
  PRICING_TEAM_SECTION,
} from "../config/pricingTeamNav";
```

**Step 2 — Add PRICING TEAM USER sidebar section** after the existing TAX TEAM USER section block. Copy the entire `{canAccessTaxTeamNav(currentRole.id) && (...)}` block and replace all `Tax` references with `Pricing`. The section must:
- Check `canAccessPricingTeamNav(currentRole.id)`
- Use `PRICING_TEAM_SECTION` as the collapse key
- Render `pricingTeamNavItems` the same way `taxTeamNavItems` are rendered
- Use `setSectionOpen` with `PRICING_TEAM_SECTION` as the key

### 5D. Update `frontend/src/context/RoleContext.tsx`

For the `pricing_analyst` role:

**Change 1 — defaultRoute:**
```typescript
// BEFORE:
defaultRoute: "/revenue?tab=pricing",

// AFTER:
defaultRoute: "/pricing-dashboard",
```

**Change 2 — contextBannerByRoute** (add new route entries):
```typescript
contextBannerByRoute: {
  "/pricing-dashboard": "Pricing Team View — $61,370 at risk · 7 GPO conflicts · 4 contracts expiring · $2.95M annualized GPO exposure",
  "/pricing/issue/:issueId": "Pricing Team View — Issue Intelligence · Review GPO conflict · Approve AI fix or follow prescribed actions",
  "/pricing/transaction/:orderId": "Pricing Team View — Transaction Lineage · Order-level pricing breakdown · Issue credit memo",
  "/pricing/closure/:issueId": "Pricing Team View — Resolution confirmed · Exposure recovered · Dashboard KPIs updated",
  "/revenue": "Pricing Team View — 5 GPO conflicts · $4,620 current period · $3.88M annualized chargeback risk",
  "/revenue?tab=pricing": "Pricing Team View — variance queue: triage contract vs charged price, credit memos, and SAP master updates from GPO intelligence.",
  "/revenue?tab=agreement-expiry": "Pricing Team View — renewal window contracts; pair with pricing queue when the same contract_id shows open variance.",
  "/commercial": "Pricing Team View — $3.88M GPO exposure. Click the KPI to open Revenue → Pricing work queue.",
  "/alerts": "Pricing Team View — showing GPO and contract alerts requiring your action today",
},
```

**Note on dynamic route matching:** The banner for `/pricing/issue/:issueId` and similar parameterised paths must be resolved at render time by matching the current `location.pathname` against the route patterns. Look at how `RoleContextBanner.tsx` already handles `/tax/issue/:issueId` and apply the same logic for the pricing routes.

---

## PART 6 — CAPA LINKAGE

**No changes to `backend/routers/capa.py` are required.** CAPA-002 already exists in the CAPA Tracker with the correct owner (Marcus Johnson — Chief Data Officer), regulation (FDA QMSR — 21 CFR Part 820), due date (2026-05-01), and status (In Progress).

All pricing issues reference `capa_id = "CAPA-002"`. The Pricing pages display the CAPA link which, when clicked by a future enhancement, would navigate to the CAPA Tracker filtered on CAPA-002. For now, display it as read-only text with the CAPA ID styled as a code badge (e.g., `<span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">CAPA-002</span>`).

---

## PART 7 — FINAL CHECKLIST

After implementing all parts, verify each item before declaring done:

### Data
- [ ] `backend/data/csv/pricing_issues.csv` created with 11 rows (7 conflicts + 4 contract-risk)
- [ ] `backend/data/seed_data.py` — `pricing_issues` table created + CSV loaded (31 columns, 31 values)
- [ ] Seed script re-run: `cd backend && python data/seed_data.py` — no errors
- [ ] `GET /api/pricing/dashboard` returns headline total_exposure = 61370, active_conflicts = 7, expiring_contracts = 4

### Backend
- [ ] `backend/routers/pricing.py` created with 8 endpoints (dashboard, issue, transaction, closure, ai-action, resolve, reassign, credit-memo-queued)
- [ ] `backend/main.py` imports and registers pricing router
- [ ] Backend starts without errors: `cd backend && uvicorn main:app --reload`
- [ ] All 8 endpoints return 200 for valid inputs

### Frontend Service
- [ ] `frontend/src/services/pricingSession.ts` created (mirrors taxSession.ts)
- [ ] `frontend/src/services/api.ts` — 9 new interfaces + 8 new api methods added + pricingSession import
- [ ] `frontend/src/utils/pricingClosureFormat.ts` created (mirrors taxClosureFormat.ts for pricing KPI types)
- [ ] `frontend/src/config/pricingTeamNav.ts` created

### Frontend Pages
- [ ] `frontend/src/pages/pricing/PricingDashboard.tsx` created — KPI cards open popup modals, AI queue wired to backend
- [ ] `frontend/src/pages/pricing/PricingIssueIntelligence.tsx` created — Mark Resolved gated by workflow.can_mark_resolved
- [ ] `frontend/src/pages/pricing/PricingTransactionLineage.tsx` created — "Issue Credit Memo" calls credit-memo-queued then navigates to Closure
- [ ] `frontend/src/pages/pricing/PricingClosure.tsx` created — KPI impact table uses pricingClosureFormat

### Routing & Navigation
- [ ] `frontend/src/App.tsx` — 4 lazy imports + 4 routes added
- [ ] `frontend/src/components/Layout.tsx` — pricingTeamNav imported + PRICING TEAM USER section rendered after TAX TEAM USER section
- [ ] `frontend/src/context/RoleContext.tsx` — `pricing_analyst.defaultRoute` changed to `/pricing-dashboard`, contextBannerByRoute updated
- [ ] `frontend/src/context/RoleContext.tsx` — `RoleContextBanner` (or wherever banner resolution happens) handles `/pricing/issue/:issueId` and `/pricing/transaction/:orderId` patterns

### End-to-end Flow
- [ ] Dev server starts without TypeScript errors: `cd frontend && npm run dev`
- [ ] Switching to `pricing_analyst` role lands on `/pricing-dashboard`
- [ ] PRICING TEAM USER sidebar section is visible to pricing_analyst and admin only
- [ ] Dashboard headline shows: $61,370 | 7 conflicts | 4 expiring/recalled | $2.95M
- [ ] KPI card click opens a popup modal with the correct filtered data table
- [ ] Clicking a row in Top 5 Alerts navigates to `/pricing/issue/:id`
- [ ] Clicking AI Approve calls backend and shows ✓ Approved badge
- [ ] Clicking Affected Record (order) in Issue Intelligence navigates to `/pricing/transaction/:orderId`
- [ ] Clicking Affected Record (contract-expiring, no order) is NOT navigable to Transaction Lineage
- [ ] Clicking "Issue Credit Memo" in Transaction Lineage calls `POST /api/pricing/credit-memo-queued` then navigates to Closure
- [ ] Closure page shows correct KPI before/after table with right number formatting
- [ ] "Return to Dashboard" on Closure returns to `/pricing-dashboard`
- [ ] After resolving one issue, re-opening dashboard shows updated data (session overrides persist)

---

## IMPORTANT NOTES

1. **Do not modify any existing pages.** The Pricing workflow is entirely additive. `/revenue?tab=pricing` stays untouched.
2. **Sticky footers on Steps 2 and 3** must use `pb-24` on the page wrapper to prevent content hiding.
3. **Contract Expiring issues (PRK-ISS-008, PRK-ISS-009)** have empty `order_id`. Do not attempt to navigate these to Transaction Lineage. In Issue Intelligence for these, the "Affected Records" section shows "Contract Details" with the contract_id. The "Mark Resolved" button navigates directly to Closure (renewal initiation IS the resolution).
4. **"No GPO Membership" issue (PRK-ISS-007)** has `credit_memo_required = 0`. Its action label is "Enroll in GPO" and the credit_memo_queued call still marks the manual path complete even though no credit memo is issued.
5. **All money values** must use `toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })`.
6. **Dark mode** — every element must include `dark:` variants. Use `TaxDashboard.tsx` and `TaxClosure.tsx` as your reference.
7. **Session headers** — every pricing API call must include `pricingDemoSessionHeaders()`. Missing this on any call will cause the AI approve/reject state to not persist between page navigations.
8. **The `sectionOpen` state in Layout.tsx** already handles the accordion toggling for the Tax section. Add `PRICING_TEAM_SECTION` as an additional key with the same `useState` initialization and toggle handler.
9. **Numbers must be consistent.** The dashboard headline, KPI cards, modal drill-down, and closure KPI impact table must all derive from the same API response. Never hardcode a number that is also returned by the API.
10. **Frontend build must pass** with zero TypeScript errors before you consider the implementation complete: `cd frontend && npm run build`.
