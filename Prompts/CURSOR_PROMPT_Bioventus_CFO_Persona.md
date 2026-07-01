# Cursor AI — Bioventus CFO Persona: Full-Stack Implementation Prompt

## CONTEXT

You are working inside the **Bioventus-MockUp** monorepo. The stack is:
- **Frontend:** React + Vite + TypeScript + TailwindCSS, React Router v6 (lazy-loaded pages), located in `frontend/`
- **Backend:** FastAPI (Python), SQLite database at `backend/data/luminos_demo.db`, seeded from CSVs in `backend/data/csv/`, located in `backend/`
- **API layer:** All frontend API calls go through `frontend/src/services/api.ts`
- **Role system:** `frontend/src/context/RoleContext.tsx` — the `cfo` role already exists with `defaultRoute: "/csuite"`

Your job is to implement a **3-step CFO persona workflow** as described below. Follow every instruction in order. Do not skip any step. Do not invent patterns — match the existing codebase conventions exactly as the Tax (`tax_compliance`), Pricing (`pricing_analyst`), and Data Steward (`data_steward`) persona workflows demonstrate.

---

## ARCHITECTURAL DECISIONS (ALREADY MADE — DO NOT DEVIATE)

These decisions are final. Apply them consistently throughout:

1. **Routes:** Create NEW pages at `/cfo-dashboard`, `/cfo/issue/:alertId`, `/cfo/closure/:alertId`. Leave the existing `/csuite` route and `CSuiteDashboard.tsx` completely untouched — it is used by Admin, CDO, CCO, and other roles.
2. **Data source:** Create a new dedicated `backend/data/csv/cfo_alerts.csv` and `cfo_alerts` SQLite table. Do NOT read from or join `tax_jurisdiction_issues` or `pricing_issues` tables.
3. **AI action state:** Use session-scoped in-memory state (same pattern as `backend/routers/tax.py` — `_session_issue_overrides` dict, `X-CFO-Demo-Session` header, resets on page refresh). Do NOT write resolved state to the SQLite DB.

---

## THE 3-STEP CFO WORKFLOW (source of truth)

| Step | Route | Page File | Description |
|------|-------|-----------|-------------|
| 1 | `/cfo-dashboard` | `frontend/src/pages/cfo/CFODashboard.tsx` | C-Suite financial exposure overview — headline KPIs, 4 KPI cards, resolution trend, top alerts sorted by dollar exposure, AI recommendation queue with approve/reassign |
| 2 | `/cfo/issue/:alertId` | `frontend/src/pages/cfo/CFOIssueDetail.tsx` | Issue deep-dive — financial risk breakdown, dual owner status, AI recommendations with confidence scores, sticky Approve/Reassign footer, collapsed Why It Happened / Owner Escalation / CAPA Linkage sections |
| 3 | `/cfo/closure/:alertId` | `frontend/src/pages/cfo/CFOClosure.tsx` | Resolution confirmation — what was resolved, systems updated, AI action audit log, before/after KPI impact table, cross-team notifications, Back to Dashboard |

**Navigation flow:**
- Dashboard → click any alert row in Top Alerts → Issue Detail (Step 2)
- Dashboard → click Approve in AI Queue → Closure (Step 3) directly, skipping Issue Detail
- Issue Detail → click Approve or Reassign → Closure (Step 3)
- Closure → click "Back to Dashboard" → Dashboard (Step 1) with KPIs refreshed

---

## PART 1 — DATA LAYER

### 1A. Create `backend/data/csv/cfo_alerts.csv`

Create this file verbatim. Column order must be exact — the seed script uses positional INSERT.

```
alert_id,account_id,account_name,order_id,issue_type,priority,dollar_exposure,margin_at_risk,penalty_exposure,legal_risk,invoice_status,pre_invoice,sla_days_remaining,opened_date,status,cfo_assignee,tax_owner_id,tax_owner_name,tax_owner_team,pricing_owner_id,pricing_owner_name,pricing_owner_team,ai_fix_1,ai_confidence_1,ai_source_1,ai_fix_2,ai_confidence_2,ai_source_2,root_cause_primary,root_cause_secondary,capa_ids,next_action_tax,next_action_pricing,correct_jurisdiction,applied_jurisdiction,list_price,contract_price
CFO-ALERT-001,CUST-2011,Northeast Medical,ORD-031,Tax Jurisdiction Mismatch + Pricing Override,CRITICAL,28400.0,9660.0,16220.0,State audit trigger avoidable if jurisdiction corrected before filing,Pre-Invoice,1,2,2026-04-05,Open,Unassigned,TAX-03,Jennifer Mills,Tax Team,PRICE-04,David Chen,Pricing Team,Correct ORD-031 jurisdiction from Arizona to North Carolina + update address master for CUST-2011,91.0,SAP + State Tax Database,Revert ORD-031 from list price $850 to GPO Tier-2 rate $720 for CUST-2011,88.0,GPO Contract Repository,Sold-to address for CUST-2011 not updated in SAP after customer relocated from Arizona to North Carolina — system defaulted to bill-to state for tax jurisdiction assignment,GPO Tier-2 contract rate not refreshed in pricing engine after last contract renewal — system fell back to list price,CAPA-007,CAPA-012,Correct sold-to jurisdiction before invoice generation — 2 days remaining,Revert ORD-031 to GPO Tier-2 rate before invoice generation — 2 days remaining,North Carolina,Arizona,850.0,720.0
CFO-ALERT-002,CUST-4019,Alliance Health Group,ORD-029,GPO Chargeback Dispute,HIGH,18750.0,6375.0,8740.0,GPO contract penalty exposure if dispute unresolved,Post-Invoice,0,5,2026-03-28,Open,FIN-02,,,,FIN-02,Marcus Webb,Finance Team,Reroute CUST-4019 chargeback to correct GPO contract tier,88.0,GPO Contract Repository,,0.0,,Chargeback amount exceeds contract ceiling — incorrect GPO tier applied at order creation for CUST-4019,,CAPA-012,,Reroute to correct contract tier — 5 days remaining,,,1220.0,980.0
CFO-ALERT-003,CUST-0892,Central Hospital,ORD-028,Compliance Breach — Multi-Jurisdiction Filing,HIGH,14420.0,4903.0,6680.0,Multi-state filing violation — regulatory review triggered,Post-Invoice,0,7,2026-03-25,Open,CCO-01,TAX-05,Robert Chan,Tax Team,,,,,Correct multi-jurisdiction filing for CUST-0892 and align tax records across all affected states,87.0,State Tax Database + Compliance Register,,0.0,,Billing address spans multiple states — jurisdiction assignment logic selected incorrect primary state — multi-state filing obligation not triggered,,CAPA-007,File corrected multi-jurisdiction return — 7 days remaining,,North Carolina,Arizona,0.0,0.0
CFO-ALERT-004,CUST-1055,Metro Health Partners,ORD-033,Tax Jurisdiction Mismatch,MEDIUM,8200.0,2788.0,3813.0,State audit risk if not corrected before period close,Pre-Invoice,1,4,2026-04-03,Open,TAX-04,TAX-04,Emily Carter,Tax Team,,,,,Correct ORD-033 jurisdiction to Ohio and update SAP address master for CUST-1055,89.0,SAP + State Tax Database,,0.0,,Customer address update not propagated to tax module in SAP after CUST-1055 relocated to Ohio,,CAPA-007,Update jurisdiction before invoicing — 4 days remaining,,Ohio,Arizona,0.0,0.0
CFO-ALERT-005,CUST-2088,Summit Medical Center,ORD-035,GPO Contract Discrepancy,MEDIUM,7100.0,2414.0,3302.0,Revenue recovery blocked pending contract reconciliation,Post-Invoice,0,6,2026-04-01,Open,FIN-03,,,,FIN-03,Rachel Kim,Finance Team,Reconcile CUST-2088 GPO contract and issue credit memo for ORD-035,85.0,GPO Contract Repository,,0.0,,Contract version mismatch between SAP pricing engine and GPO repository — prior-period rate applied to current-period order,,CAPA-012,,Reconcile and credit — 6 days remaining,,,1050.0,890.0
CFO-ALERT-006,CUST-3101,Westfield Health,ORD-027,Pricing Override — List Price Applied,MEDIUM,6800.0,2312.0,3162.0,Credit memo required — revenue recognized at incorrect price,Post-Invoice,0,9,2026-03-22,Open,PRICE-04,,,,PRICE-04,David Chen,Pricing Team,Revert ORD-027 pricing to contracted rate and issue credit memo for CUST-3101,86.0,GPO Contract Repository,,0.0,,Sales order pricing engine bypassed contract rate lookup — manual override applied list price instead of GPO Tier-2 rate,,CAPA-012,,Revert to contract rate and issue credit memo — 9 days remaining,,,920.0,760.0
CFO-ALERT-007,CUST-4215,Pacific Care Group,ORD-036,Tax Exemption Certificate Expired,MEDIUM,6200.0,2108.0,2883.0,Tax liability exposure if exemption not renewed before invoicing,Pre-Invoice,1,3,2026-04-04,Open,TAX-03,TAX-03,Jennifer Mills,Tax Team,,,,,Obtain updated tax exemption certificate from CUST-4215 and apply before invoicing ORD-036,90.0,Tax Exemption Registry,,0.0,,CUST-4215 exemption certificate expired 2026-03-01 — renewal reminder not triggered — SAP exemption flag still set to active,,CAPA-007,Obtain and apply certificate — 3 days remaining,,,Arizona,0.0,0.0
CFO-ALERT-008,CUST-5082,Lakeview Medical,ORD-034,Chargeback Dispute — Rebate Discrepancy,MEDIUM,5800.0,1972.0,2697.0,Rebate reversal required — dispute in escalation,Pre-Invoice,1,4,2026-04-03,Open,FIN-02,,,,FIN-02,Marcus Webb,Finance Team,Reconcile rebate discrepancy and apply correct chargeback credit for ORD-034,84.0,GPO Contract Repository,,0.0,,Rebate calculation used stale contract terms — quarterly update cycle missed CUST-5082 renewal in 2026-Q1,,CAPA-012,,Apply correct rebate calculation — 4 days remaining,,,870.0,740.0
CFO-ALERT-009,CUST-6033,Harbor Health System,ORD-038,Tax Jurisdiction Mismatch,LOW,5300.0,1802.0,2465.0,Underpayment risk — secondary state filing required,Pre-Invoice,1,12,2026-03-18,Open,TAX-04,TAX-04,Emily Carter,Tax Team,,,,,Correct ORD-038 jurisdiction to match sold-to state and update SAP address master,86.0,SAP Address Master,,0.0,,Customer relocated — SAP address master not updated after relocation — system assigned default billing state,,CAPA-007,File jurisdiction correction — 12 days remaining,,North Carolina,Arizona,0.0,0.0
CFO-ALERT-010,CUST-7044,Greenfield Medical,ORD-039,GPO Tier Mismatch,LOW,4700.0,1598.0,2186.0,Overbilling risk — revenue adjustment required post-close,Post-Invoice,0,14,2026-03-15,Open,FIN-03,,,,FIN-03,Rachel Kim,Finance Team,Correct GPO tier assignment for ORD-039 and issue credit memo to CUST-7044,83.0,GPO Contract Repository,,0.0,,New GPO tier effective 2026-01-01 not reflected in pricing master for CUST-7044 — prior tier applied for three orders,,CAPA-012,,Correct tier and issue credit memo — 14 days remaining,,,1120.0,950.0
CFO-ALERT-011,CUST-8055,Eastside Clinic,ORD-040,Pricing Override — List Price Applied,LOW,4100.0,1394.0,1907.0,Credit memo required before invoicing,Pre-Invoice,1,5,2026-04-02,Open,PRICE-04,,,,PRICE-04,David Chen,Pricing Team,Revert ORD-040 to contract rate before invoicing CUST-8055,82.0,GPO Contract Repository,,0.0,,Contract renewal effective 2026-03-15 not synchronized to order management system — list price applied for new-period order,,CAPA-012,,Revert before invoicing — 5 days remaining,,,850.0,710.0
CFO-ALERT-012,CUST-9066,Northgate Hospital,ORD-041,Tax Rate Discrepancy,LOW,3500.0,1190.0,1628.0,Underpayment penalty exposure if not corrected within period,Post-Invoice,0,16,2026-03-12,Open,TAX-05,TAX-05,Robert Chan,Tax Team,,,,,Recalculate ORD-041 tax at correct state rate and file amended return for CUST-9066,81.0,State Tax Database,,0.0,,State rate schedule update 2026-01-01 not applied to tax calculation engine for CUST-9066 zip code region,,CAPA-007,File amended return — 16 days remaining,,,0.0,0.0
CFO-ALERT-013,CUST-1102,Riverside Surgical,ORD-042,GPO Chargeback Dispute,LOW,3200.0,1088.0,1488.0,Chargeback reversal required — pending contract verification,Post-Invoice,0,18,2026-03-10,Open,FIN-02,,,,FIN-02,Marcus Webb,Finance Team,Verify chargeback claim against current contract terms and issue resolution for ORD-042,80.0,GPO Contract Repository,,0.0,,Chargeback filed against expired contract terms — current terms not applied during dispute processing,,CAPA-012,,Verify and resolve chargeback — 18 days remaining,,,990.0,830.0
CFO-ALERT-014,CUST-2213,Valley Orthopedic,ORD-043,Tax Jurisdiction Mismatch,LOW,2880.0,979.0,1339.0,Minor state penalty exposure if correction delayed,Post-Invoice,0,20,2026-03-08,Open,TAX-04,TAX-04,Emily Carter,Tax Team,,,,,Correct ORD-043 jurisdiction assignment and file amended state tax return,80.0,SAP Address Master,,0.0,,Sold-to state mismatch — bill-to address used for jurisdiction assignment during order creation,,CAPA-007,File jurisdiction correction — 20 days remaining,,Georgia,Arizona,0.0,0.0
CFO-ALERT-015,CUST-3314,Coastal Medical Group,ORD-044,Revenue Recognition Timing Error,LOW,2550.0,867.0,1186.0,Revenue restatement risk if recognition period not corrected,Post-Invoice,0,22,2026-03-05,Open,FIN-01,,,,FIN-01,Priya Nair,Finance Team,Correct revenue recognition period for ORD-044 from Q4 to Q1 in ERP,78.0,ERP Revenue Module,,0.0,,Order shipped in Q1 but revenue recognized in Q4 due to billing hold not cleared at period close,,,,Correct recognition period — 22 days remaining,,,0.0,0.0
CFO-ALERT-016,CUST-4415,Meridian Health,ORD-045,GPO Contract Discrepancy,LOW,1800.0,612.0,837.0,Minor revenue leakage — current-period correction required,Post-Invoice,0,25,2026-03-02,Open,FIN-03,,,,FIN-03,Rachel Kim,Finance Team,Apply current GPO contract rate for CUST-4415 and correct ORD-045 pricing,77.0,GPO Contract Repository,,0.0,,GPO contract refresh cycle missed CUST-4415 — previous rate tier applied to current-period order,,CAPA-012,,Apply correct rate — 25 days remaining,,,780.0,660.0
CFO-ALERT-017,CUST-5516,Pioneer Medical,ORD-046,Tax Exemption Certificate Expired,LOW,1600.0,544.0,744.0,Tax liability exposure if exemption not renewed,Post-Invoice,0,28,2026-02-28,Open,TAX-05,TAX-05,Robert Chan,Tax Team,,,,,Obtain renewed tax exemption certificate from CUST-5516 for ORD-046,76.0,Tax Exemption Registry,,0.0,,Exemption certificate expired 2026-01-15 — no automated renewal alert triggered in SAP — liability accruing,,,,Obtain certificate — 28 days remaining,,,0.0,0.0
```

**Verify these totals match the dashboard KPIs exactly:**
- `SUM(dollar_exposure)` WHERE status='Open' = **125,300.0** (displays as "$125,300" in headline — acceptable deviation from spec's "imaginary" $124,600)
- COUNT WHERE status='Open' = **17** open issues
- COUNT WHERE pre_invoice=1 AND status='Open' = **6** pre-invoice alerts (rows 1,4,7,8,9,11)
- `SUM(margin_at_risk)` WHERE status='Open' = **~42,625** (displays as approx. $42,310 in KPI card — use actual sum from DB)
- `SUM(penalty_exposure)` WHERE status='Open' = **~61,276** (compliance exposure KPI — use actual sum from DB)
- Annualized = `round(total_dollar_exposure * 30.5)` = **$3,821,650** → display as `$3.82M` (rounds to `$3.8M` in compact display)

---

### 1B. Update `backend/data/seed_data.py`

**Step 1 — Add CREATE TABLE block.**

In `create_tables()`, after the `tax_exemption_certs` table block (or any existing table block near the bottom), add:

```python
c.execute("DROP TABLE IF EXISTS cfo_alerts")
c.execute("""CREATE TABLE cfo_alerts (
    alert_id TEXT PRIMARY KEY,
    account_id TEXT,
    account_name TEXT,
    order_id TEXT,
    issue_type TEXT,
    priority TEXT,
    dollar_exposure REAL,
    margin_at_risk REAL,
    penalty_exposure REAL,
    legal_risk TEXT,
    invoice_status TEXT,
    pre_invoice INTEGER,
    sla_days_remaining INTEGER,
    opened_date TEXT,
    status TEXT,
    cfo_assignee TEXT,
    tax_owner_id TEXT,
    tax_owner_name TEXT,
    tax_owner_team TEXT,
    pricing_owner_id TEXT,
    pricing_owner_name TEXT,
    pricing_owner_team TEXT,
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
    next_action_pricing TEXT,
    correct_jurisdiction TEXT,
    applied_jurisdiction TEXT,
    list_price REAL,
    contract_price REAL
)""")
```

**Step 2 — Add CSV load block.**

In the CSV loading section (after the `tax_exemption_certs` load block), add:

```python
with open(CSV_DIR / "cfo_alerts.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
conn.executemany(
    "INSERT INTO cfo_alerts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
        (
            r["alert_id"], r["account_id"], r["account_name"], r["order_id"],
            r["issue_type"], r["priority"], float(r["dollar_exposure"]),
            float(r["margin_at_risk"]), float(r["penalty_exposure"]),
            r["legal_risk"], r["invoice_status"], int(r["pre_invoice"]),
            int(r["sla_days_remaining"]), r["opened_date"], r["status"],
            r["cfo_assignee"], r["tax_owner_id"], r["tax_owner_name"],
            r["tax_owner_team"], r["pricing_owner_id"], r["pricing_owner_name"],
            r["pricing_owner_team"], r["ai_fix_1"], float(r["ai_confidence_1"]),
            r["ai_source_1"], r["ai_fix_2"], float(r["ai_confidence_2"]),
            r["ai_source_2"], r["root_cause_primary"], r["root_cause_secondary"],
            r["capa_ids"], r["next_action_tax"], r["next_action_pricing"],
            r["correct_jurisdiction"], r["applied_jurisdiction"],
            float(r["list_price"]), float(r["contract_price"]),
        )
        for r in rows
    ],
)
```

**Step 3 — Re-run the seed script after all changes:**
```bash
cd backend && python data/seed_data.py
```

---

## PART 2 — BACKEND ROUTER

### 2A. Create `backend/routers/cfo.py`

Create this file from scratch. Follow the exact pattern of `backend/routers/tax.py`: use `sqlite3`, `sqlite3.Row`, session-scoped in-memory overrides, and the `X-CFO-Demo-Session` header.

```python
import datetime
import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, Header

router = APIRouter(prefix="/api/cfo", tags=["cfo"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

# Demo overrides scoped per browser session — resets on page refresh
_session_issue_overrides: dict[str, dict[str, dict]] = {}

CFO_TEAM_MEMBERS = [
    {"id": "FIN-01", "name": "Priya Nair", "team": "Finance Team"},
    {"id": "FIN-02", "name": "Marcus Webb", "team": "Finance Team"},
    {"id": "FIN-03", "name": "Rachel Kim", "team": "Finance Team"},
    {"id": "TAX-03", "name": "Jennifer Mills", "team": "Tax Team"},
    {"id": "TAX-04", "name": "Emily Carter", "team": "Tax Team"},
    {"id": "TAX-05", "name": "Robert Chan", "team": "Tax Team"},
    {"id": "PRICE-04", "name": "David Chen", "team": "Pricing Team"},
    {"id": "CCO-01", "name": "Sandra Lee", "team": "Compliance Office"},
]


def get_cfo_demo_session(
    x_cfo_demo_session: str | None = Header(default=None, alias="X-CFO-Demo-Session"),
) -> str:
    return x_cfo_demo_session or "default"


def _session_overrides(session_id: str) -> dict[str, dict]:
    return _session_issue_overrides.setdefault(session_id, {})


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _merge_alert(alert: dict, session_id: str) -> dict:
    """Apply any session-scoped overrides (approve/reassign) on top of base DB row."""
    merged = dict(alert)
    override = _session_overrides(session_id).get(alert["alert_id"])
    if override:
        merged.update(override)
    return merged


def _build_dashboard(all_alerts: list[dict]) -> dict:
    """Compute all KPIs and collections from the full alert list."""
    open_alerts = [a for a in all_alerts if a.get("status") == "Open"]
    pre_invoice = [a for a in open_alerts if a.get("pre_invoice") == 1]

    total_exposure = round(sum(float(a.get("dollar_exposure", 0)) for a in open_alerts), 2)
    margin_at_risk = round(sum(float(a.get("margin_at_risk", 0)) for a in open_alerts), 2)
    compliance_exposure = round(sum(float(a.get("penalty_exposure", 0)) for a in open_alerts), 2)
    predicted_annual = round(total_exposure * 30.5, 0)

    # Top Alerts — sorted by dollar_exposure DESC, pre-invoice first
    top_alerts = sorted(
        open_alerts,
        key=lambda x: (0 if x.get("pre_invoice") == 1 else 1, -float(x.get("dollar_exposure", 0))),
    )[:10]  # Return top 10 for dashboard table

    # AI Recommendation Queue — only alerts with ai_confidence_1 >= 85 that are unresolved
    ai_queue = [
        a for a in open_alerts
        if float(a.get("ai_confidence_1", 0)) >= 85 and a.get("ai_fix_1")
    ]

    return {
        "headline": {
            "total_exposure": total_exposure,
            "open_issues": len(open_alerts),
            "pre_invoice_count": len(pre_invoice),
            "predicted_annual_exposure": predicted_annual,
        },
        "kpi_cards": {
            "revenue_at_risk": {"value": total_exposure, "label": "Revenue at Risk", "description": "Total revenue leakage from open issues across tax, pricing, and chargebacks pending resolution"},
            "margin_at_risk": {"value": margin_at_risk, "label": "Margin at Risk", "description": "Current-period margin exposure from unresolved pricing errors, tax mismatches, and rebate discrepancies"},
            "compliance_exposure": {"value": compliance_exposure, "label": "Compliance Exposure", "description": "Penalty and legal risk from unresolved jurisdiction mismatches and regulatory non-compliance"},
            "predicted_annual_exposure": {"value": predicted_annual, "label": "Predicted Annual Exposure", "description": "Annualized projection of current-period exposure if open issues remain unresolved"},
        },
        "resolution_trend": [
            {"kpi": "Revenue at Risk", "trend": "Down 12% vs last period", "status": "Improving", "direction": "down"},
            {"kpi": "Compliance Exposure", "trend": "Up 8% vs last period", "status": "Needs Attention", "direction": "up"},
            {"kpi": "Issues Resolved on Time", "trend": "74%", "status": "At Risk", "direction": "neutral"},
        ],
        "top_alerts": top_alerts,
        "ai_queue": ai_queue,
        "all_open_alerts": open_alerts,  # Used by KPI card drill-down modals
    }
```

#### Endpoint 1: `GET /api/cfo/dashboard`

```python
@router.get("/dashboard")
def cfo_dashboard(session_id: str = Depends(get_cfo_demo_session)):
    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM cfo_alerts ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()]

    all_alerts = [_merge_alert(r, session_id) for r in rows]
    return _build_dashboard(all_alerts)
```

#### Endpoint 2: `GET /api/cfo/issue/{alertId}`

```python
@router.get("/issue/{alert_id}")
def cfo_issue_detail(alert_id: str, session_id: str = Depends(get_cfo_demo_session)):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM cfo_alerts WHERE alert_id = ?", (alert_id,)
        ).fetchone()

    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert = _merge_alert(dict(row), session_id)

    # Build CAPA list from the capa_ids comma-separated field
    capa_entries = []
    if alert.get("capa_ids"):
        for capa_id in alert["capa_ids"].split(","):
            capa_id = capa_id.strip()
            if capa_id == "CAPA-007":
                capa_entries.append({"id": "CAPA-007", "area": "State Tax Compliance — Multi-Jurisdiction", "status": "In Progress", "owner": "Sandra Lee — Chief Compliance Officer", "due": "2026-05-10"})
            elif capa_id == "CAPA-012":
                capa_entries.append({"id": "CAPA-012", "area": "GPO Contract Rate Accuracy", "status": "Open", "owner": "David Chen — Pricing Team", "due": "2026-05-20"})

    return {
        "alert": alert,
        "capa_entries": capa_entries,
        "reassign_options": CFO_TEAM_MEMBERS,
    }
```

#### Endpoint 3: `GET /api/cfo/closure/{alertId}`

```python
@router.get("/closure/{alert_id}")
def cfo_closure(alert_id: str, session_id: str = Depends(get_cfo_demo_session)):
    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM cfo_alerts ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()]

    all_alerts = [_merge_alert(r, session_id) for r in rows]
    alert = next((a for a in all_alerts if a["alert_id"] == alert_id), None)

    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    # Build resolved by string from available owner data
    owners = []
    if alert.get("tax_owner_id"):
        owners.append(alert["tax_owner_name"])
    if alert.get("pricing_owner_id"):
        owners.append(alert["pricing_owner_name"])
    resolved_by = " + ".join(owners) if owners else alert.get("cfo_assignee", "Finance Team")

    # Determine resolution type label based on issue_type
    issue_type = alert.get("issue_type", "")
    if "Tax Jurisdiction" in issue_type and "Pricing" in issue_type:
        resolution_type = "Jurisdiction Corrected + GPO Rate Applied"
    elif "Tax Jurisdiction" in issue_type or "Jurisdiction" in issue_type:
        resolution_type = "Jurisdiction Corrected"
    elif "GPO" in issue_type or "Pricing" in issue_type or "Chargeback" in issue_type:
        resolution_type = "Contract Rate Applied + Credit Memo Issued"
    elif "Compliance" in issue_type:
        resolution_type = "Compliance Filing Corrected"
    elif "Exemption" in issue_type:
        resolution_type = "Tax Exemption Certificate Applied"
    else:
        resolution_type = "Issue Resolved"

    # Build systems updated list
    systems_updated = []
    if alert.get("tax_owner_id") or "Tax" in issue_type or "Jurisdiction" in issue_type:
        systems_updated.append(f"SAP Jurisdiction Updated — {alert.get('applied_jurisdiction', 'prior state')} to {alert.get('correct_jurisdiction', 'correct state')} for {alert.get('order_id')}")
        systems_updated.append(f"SAP Address Master Updated for {alert.get('account_id')}")
    if alert.get("pricing_owner_id") or "Pricing" in issue_type or "GPO" in issue_type or "Chargeback" in issue_type:
        contract_price = alert.get("contract_price", 0)
        systems_updated.append(f"SAP Pricing Master Updated — Contract Rate ${contract_price} applied for {alert.get('account_id')}")
    if alert.get("capa_ids"):
        for capa_id in alert["capa_ids"].split(","):
            capa_id = capa_id.strip()
            if capa_id:
                systems_updated.append(f"{capa_id} updated")
    systems_updated.append("Alert closed and removed from Top Alerts")

    # Build AI action log
    ai_action_log = []
    resolved_on = datetime.date.today().strftime("%Y-%m-%d")
    if alert.get("ai_fix_1"):
        ai_action_log.append({
            "fix": alert["ai_fix_1"],
            "approved_by": "CFO",
            "confidence": alert.get("ai_confidence_1", 0),
            "logged_on": resolved_on,
        })
    if alert.get("ai_fix_2"):
        ai_action_log.append({
            "fix": alert["ai_fix_2"],
            "approved_by": "CFO",
            "confidence": alert.get("ai_confidence_2", 0),
            "logged_on": resolved_on,
        })

    # Build cross-team notifications
    notifications = []
    if alert.get("tax_owner_name") and alert.get("tax_owner_team"):
        notifications.append({
            "team": alert["tax_owner_team"],
            "message": f"Jurisdiction corrected for {alert.get('order_id')} — address master updated for {alert.get('account_id')}"
        })
    if alert.get("pricing_owner_name") and alert.get("pricing_owner_team"):
        notifications.append({
            "team": alert["pricing_owner_team"],
            "message": f"Contract rate applied for {alert.get('order_id')} — pricing engine updated for {alert.get('account_id')}"
        })
    if "Compliance" in issue_type or alert.get("capa_ids"):
        penalty = float(alert.get("penalty_exposure", 0))
        notifications.append({
            "team": "Chief Compliance Officer",
            "message": f"Compliance exposure reduced by ${penalty:,.0f} — CAPAs updated"
        })

    # Compute before/after KPI impact
    kpi_before = _build_dashboard(all_alerts)["kpi_cards"]
    # The alert is already marked resolved in session; compute "after" by treating it as resolved
    after_alerts = [a for a in all_alerts if a["alert_id"] != alert_id]
    kpi_after = _build_dashboard(after_alerts)["kpi_cards"]

    return {
        "alert": alert,
        "resolved_by": resolved_by,
        "resolved_on": resolved_on,
        "resolution_type": resolution_type,
        "exposure_recovered": float(alert.get("dollar_exposure", 0)),
        "systems_updated": systems_updated,
        "ai_action_log": ai_action_log,
        "kpi_before": kpi_before,
        "kpi_after": kpi_after,
        "notifications": notifications,
    }
```

#### Endpoint 4: `POST /api/cfo/approve`

```python
from pydantic import BaseModel

class CFOApproveRequest(BaseModel):
    alert_id: str

@router.post("/approve")
def cfo_approve(req: CFOApproveRequest, session_id: str = Depends(get_cfo_demo_session)):
    """Mark alert as Resolved in session scope. Returns updated dashboard."""
    _session_overrides(session_id)[req.alert_id] = {"status": "Resolved", "cfo_assignee": "CFO"}

    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM cfo_alerts ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()]

    all_alerts = [_merge_alert(r, session_id) for r in rows]
    return _build_dashboard(all_alerts)
```

#### Endpoint 5: `POST /api/cfo/reassign`

```python
class CFOReassignRequest(BaseModel):
    alert_id: str
    new_owner_id: str
    new_owner_name: str

@router.post("/reassign")
def cfo_reassign(req: CFOReassignRequest, session_id: str = Depends(get_cfo_demo_session)):
    """Reassign the alert's cfo_assignee to a new owner in session scope. Returns updated dashboard."""
    _session_overrides(session_id)[req.alert_id] = {
        "cfo_assignee": req.new_owner_id,
        "status": "Open",  # stays open, just reassigned
    }

    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM cfo_alerts ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()]

    all_alerts = [_merge_alert(r, session_id) for r in rows]
    return _build_dashboard(all_alerts)
```

---

### 2B. Register the router in `backend/main.py`

Open `backend/main.py`. Import and register the CFO router exactly as the other persona routers are registered. Add these two lines adjacent to the existing tax/pricing/steward router registration blocks:

```python
from routers import cfo   # add this import
app.include_router(cfo.router)   # add this registration
```

---

## PART 3 — CAPA INTEGRATION

Open `backend/routers/capa.py`. Find the `_base_capas()` function (or equivalent list/dict that seeds the CAPA Tracker). Add `CAPA-012` as a new entry adjacent to the existing tax `CAPA-007` entry:

```python
{
    "capa_id": "CAPA-012",
    "area": "GPO Contract Rate Accuracy",
    "category": "Revenue",
    "status": "Open",
    "owner": "David Chen",
    "team": "Pricing Team",
    "due_date": "2026-05-20",
    "description": "Systematic review of GPO contract rate synchronization between GPO repository and SAP pricing engine to prevent pricing overrides defaulting to list price.",
    "root_cause": "GPO contract refresh cycle does not auto-propagate updated tiers to SAP pricing master — manual sync required but not consistently performed.",
    "linked_issues": "CFO-ALERT-001, CFO-ALERT-002, CFO-ALERT-005, CFO-ALERT-006, CFO-ALERT-008, CFO-ALERT-010, CFO-ALERT-011, CFO-ALERT-013, CFO-ALERT-016",
},
```

---

## PART 4 — FRONTEND CONFIG

### 4A. Create `frontend/src/config/cfoTeamNav.ts`

```typescript
import type { ComponentType } from "react";
import { LayoutDashboard, FileSearch, CircleCheck } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

/** Demo deep-link IDs for sidebar nav when no active alert is in context */
export const CFO_DEMO = {
  alertId: "CFO-ALERT-001",
  closureAlertId: "CFO-ALERT-001",
} as const;

export type CFOTeamNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const CFO_TEAM_SECTION = "CFO USER";

export const cfoTeamNavItems: CFOTeamNavItem[] = [
  {
    path: "/cfo-dashboard",
    label: "CFO Dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["cfo"],
    isActive: ({ pathname }) => pathname === "/cfo-dashboard",
  },
  {
    path: `/cfo/issue/${CFO_DEMO.alertId}`,
    label: "Issue Detail",
    icon: FileSearch,
    allowedRoles: ["cfo"],
    isActive: ({ pathname }) => pathname.startsWith("/cfo/issue/"),
  },
  {
    path: `/cfo/closure/${CFO_DEMO.closureAlertId}`,
    label: "Closure & Accountability",
    icon: CircleCheck,
    allowedRoles: ["cfo"],
    isActive: ({ pathname }) => pathname.startsWith("/cfo/closure/"),
  },
];

export function canAccessCFOTeamNav(roleId: RoleId): boolean {
  return roleId === "cfo" || roleId === "admin";
}
```

---

## PART 5 — FRONTEND CONTEXT

### 5A. Create `frontend/src/context/CFOWorkflowContext.tsx`

Follow the exact same structure as `frontend/src/context/TaxWorkflowContext.tsx` and `frontend/src/context/PricingWorkflowContext.tsx`.

```typescript
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface CFODashboardKPIs {
  revenue_at_risk: number;
  margin_at_risk: number;
  compliance_exposure: number;
  predicted_annual_exposure: number;
}

interface CFOWorkflowContextType {
  activeAlertId: string | null;
  setActiveAlertId: (id: string | null) => void;
  approvedAlerts: Set<string>;
  markApproved: (alertId: string) => void;
  reassignedAlerts: Set<string>;
  markReassigned: (alertId: string) => void;
  dashboardKPIs: CFODashboardKPIs | null;
  setDashboardKPIs: (kpis: CFODashboardKPIs) => void;
}

const CFOWorkflowContext = createContext<CFOWorkflowContextType | null>(null);

export function CFOWorkflowProvider({ children }: { children: ReactNode }) {
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [approvedAlerts, setApprovedAlerts] = useState<Set<string>>(new Set());
  const [reassignedAlerts, setReassignedAlerts] = useState<Set<string>>(new Set());
  const [dashboardKPIs, setDashboardKPIs] = useState<CFODashboardKPIs | null>(null);

  const markApproved = (alertId: string) =>
    setApprovedAlerts((prev) => new Set([...prev, alertId]));

  const markReassigned = (alertId: string) =>
    setReassignedAlerts((prev) => new Set([...prev, alertId]));

  return (
    <CFOWorkflowContext.Provider
      value={{ activeAlertId, setActiveAlertId, approvedAlerts, markApproved, reassignedAlerts, markReassigned, dashboardKPIs, setDashboardKPIs }}
    >
      {children}
    </CFOWorkflowContext.Provider>
  );
}

export function useCFOWorkflow(): CFOWorkflowContextType {
  const ctx = useContext(CFOWorkflowContext);
  if (!ctx) throw new Error("useCFOWorkflow must be used within CFOWorkflowProvider");
  return ctx;
}
```

---

## PART 6 — FRONTEND SESSION SERVICE

### 6A. Create `frontend/src/services/cfoSession.ts`

Follow the exact pattern of `frontend/src/services/taxSession.ts`:

```typescript
const SESSION_KEY = "cfo_demo_session_id";

export function getCFODemoSession(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
```

---

## PART 7 — FRONTEND UTILS

### 7A. Create `frontend/src/utils/cfoWorkflowStorage.ts`

```typescript
const ACTIVE_ALERT_KEY = "cfo_active_alert_id";

export function saveCFOActiveAlert(alertId: string): void {
  try { sessionStorage.setItem(ACTIVE_ALERT_KEY, alertId); } catch {}
}

export function loadCFOActiveAlert(): string | null {
  try { return sessionStorage.getItem(ACTIVE_ALERT_KEY); } catch { return null; }
}

export function clearCFOActiveAlert(): void {
  try { sessionStorage.removeItem(ACTIVE_ALERT_KEY); } catch {}
}
```

### 7B. Create `frontend/src/utils/cfoClosureFormat.ts`

```typescript
export function fmtCFOExposure(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${value.toLocaleString()}`;
  return `$${value.toFixed(0)}`;
}

export function fmtCFOCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export function fmtCFOPercent(before: number, after: number): string {
  if (before === 0) return "—";
  const pct = ((after - before) / before) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
```

---

## PART 8 — API.TS ADDITIONS

Open `frontend/src/services/api.ts`. Add the following CFO methods to the `api` object, following the exact same pattern as the `tax.*` methods (using `getCFODemoSession()` for the session header).

Import `getCFODemoSession` at the top of the file:
```typescript
import { getCFODemoSession } from "./cfoSession";
```

Add these methods to the `api` object:

```typescript
// ── CFO ─────────────────────────────────────────────────────────────────────
getCFODashboard: async () => {
  const res = await fetch(`${BASE_URL}/api/cfo/dashboard`, {
    headers: { "X-CFO-Demo-Session": getCFODemoSession() },
  });
  if (!res.ok) throw new Error(`CFO dashboard error ${res.status}`);
  return res.json() as Promise<{
    headline: { total_exposure: number; open_issues: number; pre_invoice_count: number; predicted_annual_exposure: number };
    kpi_cards: Record<string, { value: number; label: string; description: string }>;
    resolution_trend: Array<{ kpi: string; trend: string; status: string; direction: string }>;
    top_alerts: CFOAlert[];
    ai_queue: CFOAlert[];
    all_open_alerts: CFOAlert[];
  }>;
},

getCFOIssueDetail: async (alertId: string) => {
  const res = await fetch(`${BASE_URL}/api/cfo/issue/${alertId}`, {
    headers: { "X-CFO-Demo-Session": getCFODemoSession() },
  });
  if (!res.ok) throw new Error(`CFO issue detail error ${res.status}`);
  return res.json() as Promise<{
    alert: CFOAlert;
    capa_entries: Array<{ id: string; area: string; status: string; owner: string; due: string }>;
    reassign_options: Array<{ id: string; name: string; team: string }>;
  }>;
},

getCFOClosure: async (alertId: string) => {
  const res = await fetch(`${BASE_URL}/api/cfo/closure/${alertId}`, {
    headers: { "X-CFO-Demo-Session": getCFODemoSession() },
  });
  if (!res.ok) throw new Error(`CFO closure error ${res.status}`);
  return res.json() as Promise<{
    alert: CFOAlert;
    resolved_by: string;
    resolved_on: string;
    resolution_type: string;
    exposure_recovered: number;
    systems_updated: string[];
    ai_action_log: Array<{ fix: string; approved_by: string; confidence: number; logged_on: string }>;
    kpi_before: Record<string, { value: number; label: string }>;
    kpi_after: Record<string, { value: number; label: string }>;
    notifications: Array<{ team: string; message: string }>;
  }>;
},

cfoApprove: async (alertId: string) => {
  const res = await fetch(`${BASE_URL}/api/cfo/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CFO-Demo-Session": getCFODemoSession() },
    body: JSON.stringify({ alert_id: alertId }),
  });
  if (!res.ok) throw new Error(`CFO approve error ${res.status}`);
  return res.json();
},

cfoReassign: async (alertId: string, newOwnerId: string, newOwnerName: string) => {
  const res = await fetch(`${BASE_URL}/api/cfo/reassign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CFO-Demo-Session": getCFODemoSession() },
    body: JSON.stringify({ alert_id: alertId, new_owner_id: newOwnerId, new_owner_name: newOwnerName }),
  });
  if (!res.ok) throw new Error(`CFO reassign error ${res.status}`);
  return res.json();
},
```

Also add the `CFOAlert` type definition near the other type exports in `api.ts`:

```typescript
export interface CFOAlert {
  alert_id: string;
  account_id: string;
  account_name: string;
  order_id: string;
  issue_type: string;
  priority: string;
  dollar_exposure: number;
  margin_at_risk: number;
  penalty_exposure: number;
  legal_risk: string;
  invoice_status: string;
  pre_invoice: number;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  cfo_assignee: string;
  tax_owner_id: string;
  tax_owner_name: string;
  tax_owner_team: string;
  pricing_owner_id: string;
  pricing_owner_name: string;
  pricing_owner_team: string;
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
  next_action_pricing: string;
  correct_jurisdiction: string;
  applied_jurisdiction: string;
  list_price: number;
  contract_price: number;
}
```

---

## PART 9 — FRONTEND PAGES

Create the directory `frontend/src/pages/cfo/` and create these three pages inside it.

### 9A. Create `frontend/src/pages/cfo/CFODashboard.tsx`

**Visual theme:** Use `indigo-700` / `indigo-600` / `indigo-50` as the CFO accent color (matches the CFO badge color in RoleContext). Follow the exact component structure, loading skeleton, error state, and data-loading pattern from `frontend/src/pages/tax/TaxDashboard.tsx`. Do not copy-paste the Tax UI — build the CFO-specific UI described below.

**State:**
```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof api.getCFODashboard>> | null>(null);
const [kpiModalKey, setKpiModalKey] = useState<string | null>(null);  // which KPI modal is open
const [reassignTarget, setReassignTarget] = useState<string | null>(null);  // alertId being reassigned
const [toast, setToast] = useState<string | null>(null);
```

**Data loading:**
```typescript
useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getCFODashboard();
      setDashboard(data);
      // Cache KPIs in workflow context for before/after comparison on closure page
      setDashboardKPIs({
        revenue_at_risk: data.kpi_cards.revenue_at_risk.value,
        margin_at_risk: data.kpi_cards.margin_at_risk.value,
        compliance_exposure: data.kpi_cards.compliance_exposure.value,
        predicted_annual_exposure: data.kpi_cards.predicted_annual_exposure.value,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load CFO dashboard");
    } finally {
      setLoading(false);
    }
  };
  void load();
}, []);
```

**Layout structure (build this JSX, do not skip any section):**

```
<RoleContextBanner />

Headline Row:
  - Left: Page title "C-Suite Financial Dashboard" + subtitle "Total exposure pending resolution"
  - Right: Headline stats in a row:
      "$125,300" (or computed value) — "Total Pending Exposure"
      "17" — "Open Issues"
      "6" — "Pre-Invoice"
      "$3.82M" — "Annualized Exposure"

KPI Cards (4 cards in a grid, 2×2 on mobile / 4×1 on desktop):
  Each card shows: KPI label, dollar value (large), description text
  Colors: Revenue at Risk = red/rose, Margin at Risk = amber/orange,
          Compliance Exposure = purple/violet, Predicted Annual = indigo
  Clicking any card → opens a KPI detail MODAL (not inline panel, not navigation)
  Each modal shows: KPI title, description, filtered list of contributing alerts from
  all_open_alerts, with columns: Account | Issue Type | Priority | Amount | Invoice Status
  Modal has an X close button. Use the same modal/overlay pattern as other pages in the codebase.

Resolution Trend Table:
  Table columns: KPI | Trend vs Last Period | Status
  Status chip colors: "Improving" = green, "Needs Attention" = amber/yellow, "At Risk" = red

Top Alerts Table:
  Section header: "Top Alerts" with badge showing open count
  Table columns: Account | Issue Type | Priority | Dollar Exposure | Invoice Status | Current Owner
  Priority chips: CRITICAL = red, HIGH = orange, MEDIUM = amber, LOW = slate
  Invoice Status chips: Pre-Invoice = yellow, Post-Invoice = slate
  Row click → navigate to /cfo/issue/:alertId (set setActiveAlertId in context)
  The row for CFO-ALERT-001 should show the most visual prominence (CRITICAL red chip, top of list)

AI Recommendation Queue:
  Section header: "AI Recommendation Queue" with badge showing count
  For each alert with ai_fix_1 and ai_confidence_1 >= 85 and status = "Open":
    Show: Account | Current Issue State | AI Suggested Resolution | Confidence | Source | Approve / Reassign buttons
  "Approve" button → calls api.cfoApprove(alertId) → on success:
    - markApproved(alertId) in context
    - saveCFOActiveAlert(alertId) in session storage
    - navigate to /cfo/closure/:alertId
  "Reassign" button → opens inline reassign mini-panel or the reassign modal showing CFO_TEAM_MEMBERS list
  After reassign API call completes: optimistically refresh dashboard data, show toast "Reassigned to [name]"

Toast (same pattern as TaxDashboard — top-right, auto-dismiss after 2.2s)
```

---

### 9B. Create `frontend/src/pages/cfo/CFOIssueDetail.tsx`

This page is opened when a CFO clicks an alert row from the Top Alerts table on the dashboard.

**Route params:** `const { alertId } = useParams<{ alertId: string }>();`

**State:**
```typescript
const [loading, setLoading] = useState(true);
const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getCFOIssueDetail>> | null>(null);
const [showReassignModal, setShowReassignModal] = useState(false);
const [collapsed, setCollapsed] = useState({ whyHappened: true, ownerEscalation: true, capaLinkage: true });
```

**Layout structure:**

```
<RoleContextBanner />

Issue Header (prominent card at top):
  - Large badge: priority chip (CRITICAL/HIGH/etc.)
  - Issue type as H1: e.g. "Tax Jurisdiction Mismatch + Pricing Override"
  - Account + Order: "CUST-2011 Northeast Medical — ORD-031"
  - Row of chips: dollar_exposure | invoice_status | opened_date | sla_days_remaining + " days to invoice"

"What Happened" section:
  Plain language explanation auto-generated from alert data:
  "Order [order_id] for [account_name] is scheduled to be invoiced in [sla_days_remaining] days.
   [root_cause_primary]. [root_cause_secondary]. Combined financial exposure is $[dollar_exposure]
   if not resolved before invoicing."
  Use actual field values — do not hardcode strings.

Business Risk & Impact (4-row table):
  Revenue at Risk | $[dollar_exposure] | "Fully preventable if resolved before invoicing"
  Margin at Risk  | $[margin_at_risk]  | "[margin_pct]% of order value at risk"
  Penalty Exposure | $[penalty_exposure] | "Penalty avoidable if resolved pre-invoice"
  Legal Risk       | [legal_risk text]  | "—"

Owner & Resolution Status:
  Show TWO owner rows IF both tax_owner_id and pricing_owner_id are populated.
  Show ONE owner row if only one owner type is populated.
  Row format: [owner_id] | [owner_name] | [owner_team] | [next_action] | "[sla_days_remaining] days remaining"
  If cfo_assignee === "Unassigned", show a yellow banner: "No CFO-level assignee — approve AI recommendation or reassign below"

AI Recommendation section:
  For each fix (ai_fix_1 / ai_fix_2) where confidence > 0:
    Fix number | Recommended action text | Confidence badge (color: ≥90% = green, 80-89% = amber) | Source | Approve / Reassign button
  The "Approve" button approves ALL fixes for this alert at once.

Sticky footer (always visible, position: sticky bottom-0):
  Two buttons: [Approve All Fixes] [Reassign]
  "Approve All Fixes" → calls api.cfoApprove(alertId) → navigate to /cfo/closure/:alertId
  "Reassign" → opens reassign modal

Collapsed sections (accordion, same pattern as Tax IssueIntelligence.tsx):
  ► Why It Happened
    Two sub-rows: Tax cause | Pricing cause (from root_cause_primary / root_cause_secondary)
  ► Owner & Escalation
    Same data as Owner section above, plus escalation path text
  ► CAPA Linkage
    Table: CAPA ID | Area | Status | Owner | Due Date
    Rendered from capa_entries array returned by API

Reassign Modal:
  Shows list of CFO_TEAM_MEMBERS from detail.reassign_options
  Selecting a member → calls api.cfoReassign(alertId, id, name) → closes modal, shows toast, navigate back to dashboard
```

---

### 9C. Create `frontend/src/pages/cfo/CFOClosure.tsx`

This page is reached when the CFO approves from either Step 1 or Step 2.

**Route params:** `const { alertId } = useParams<{ alertId: string }>();`

**State:**
```typescript
const [loading, setLoading] = useState(true);
const [closure, setClosure] = useState<Awaited<ReturnType<typeof api.getCFOClosure>> | null>(null);
```

**Data loading:**
```typescript
useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getCFOClosure(alertId!);
      setClosure(data);
    } catch (e) { ... } finally { setLoading(false); }
  };
  void load();
}, [alertId]);
```

**Layout structure:**

```
<RoleContextBanner />

Resolution Confirmation Banner (green success card at top):
  Large checkmark icon
  "[issue_type] — [order_id]"
  "Resolved by [resolved_by] · [resolved_on] · [resolution_type]"
  "$[exposure_recovered] exposure recovered" in large green text

What Was Updated (bulleted list with icons):
  Each item in closure.systems_updated on its own row with a check icon

AI Action Log Table:
  Columns: Recommended Fix | Approved By | Confidence | Logged On
  Map over closure.ai_action_log
  Show "Approved by CFO" chip in indigo

Impact on Dashboard (before/after KPI comparison table):
  Header: "Impact on Dashboard KPIs"
  Table columns: KPI | Before | After | Change
  Rows:
    Revenue at Risk       | kpi_before.revenue_at_risk.value → kpi_after.revenue_at_risk.value
    Margin at Risk        | kpi_before.margin_at_risk.value → kpi_after.margin_at_risk.value
    Compliance Exposure   | kpi_before.compliance_exposure.value → kpi_after.compliance_exposure.value
    Predicted Annual Exp. | kpi_before.predicted_annual_exposure.value → kpi_after.predicted_annual_exposure.value
  Color the "After" values green (lower = better for all 4 KPIs)
  Show the change amount (e.g. "−$28,400") in green

Cross-Team Notifications:
  Section header "Cross-Team Notifications — Sent Automatically"
  List each closure.notifications item:
    Team name chip | Message text

Back to Dashboard button (prominent, indigo, full-width on mobile):
  onClick → navigate("/cfo-dashboard")
  This clears the active alert context: setActiveAlertId(null), clearCFOActiveAlert()
```

---

## PART 10 — APP.TSX UPDATES

Open `frontend/src/App.tsx`. Make these exact changes:

**Step 1 — Add lazy imports** adjacent to the existing steward imports:
```typescript
const CFODashboard = lazy(() => import("./pages/cfo/CFODashboard"));
const CFOIssueDetail = lazy(() => import("./pages/cfo/CFOIssueDetail"));
const CFOClosure = lazy(() => import("./pages/cfo/CFOClosure"));
```

**Step 2 — Import CFOWorkflowProvider** at the top of the file:
```typescript
import { CFOWorkflowProvider } from "./context/CFOWorkflowContext";
```

**Step 3 — Wrap the app** with `<CFOWorkflowProvider>` immediately inside `<PricingWorkflowProvider>` (or at the same nesting level as the other workflow providers — adjacent to them, not replacing them):
```typescript
<CFOWorkflowProvider>
  {/* existing content */}
</CFOWorkflowProvider>
```

**Step 4 — Add routes** inside `<Routes>`, adjacent to the existing steward routes:
```typescript
<Route path="/cfo-dashboard" element={<CFODashboard />} />
<Route path="/cfo/issue/:alertId" element={<CFOIssueDetail />} />
<Route path="/cfo/closure/:alertId" element={<CFOClosure />} />
```

---

## PART 11 — LAYOUT.TSX UPDATES

Open `frontend/src/components/Layout.tsx`. Make these exact changes in order:

**Step 1 — Add imports at the top**, adjacent to the existing persona nav imports:
```typescript
import {
  cfoTeamNavItems,
  CFO_TEAM_SECTION,
  canAccessCFOTeamNav,
} from "../config/cfoTeamNav";
```

**Step 2 — Add to `DEFAULT_SECTION_OPEN`** (the object that defines which sections start open):
```typescript
[CFO_TEAM_SECTION]: true,
```

**Step 3 — Add CFO to the role-specific section collapse logic.**

Find the `useEffect` that collapses sections based on `currentRole.id` (the block with `currentRole.id === "tax_compliance" || currentRole.id === "pricing_analyst" || ...`). Add `currentRole.id === "cfo"` to the condition, and add this line to the `setSectionOpen` call inside:
```typescript
[CFO_TEAM_SECTION]: currentRole.id === "cfo",
```

**Step 4 — Add the CFO nav section block** in the sidebar JSX, adjacent to the existing Tax Team section block. Place it BEFORE the Tax section block (CFO comes first as an executive persona):

```tsx
{/* CFO TEAM USER section */}
<div key={CFO_TEAM_SECTION}>
  <button
    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-slate-400 hover:text-slate-200 transition-colors"
    onClick={() => setSectionOpen((prev) => ({ ...prev, [CFO_TEAM_SECTION]: !prev[CFO_TEAM_SECTION] }))}
  >
    <span>{CFO_TEAM_SECTION}</span>
    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOpen[CFO_TEAM_SECTION] ? "rotate-0" : "-rotate-90")} />
  </button>
  {sectionOpen[CFO_TEAM_SECTION] &&
    cfoTeamNavItems.map((item) => {
      const loc = { pathname: location.pathname, search: location.search };
      const active = item.isActive ? item.isActive(loc) : location.pathname === item.path;
      return (
        <NavLink
          key={item.path}
          to={item.path}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
            active
              ? "bg-indigo-700/30 text-indigo-300 border border-indigo-600/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {item.label}
        </NavLink>
      );
    })}
</div>
```

**Step 5 — Update `RoleContextBanner` path resolution.**

Find the `RoleContextBanner` component or the `contextBannerByRoute` lookup logic. Ensure it resolves `/cfo/issue/*` and `/cfo/closure/*` paths using a `startsWith` check, exactly as it resolves `/tax/issue/*` and `/tax/closure/*`. If the banner uses a `matchesRoute` helper, add entries for the CFO paths. If it does a direct key lookup on `contextBannerByRoute`, add the same wildcard resolution logic that the Tax persona uses.

---

## PART 12 — ROLECONTEXT.TSX UPDATES

Open `frontend/src/context/RoleContext.tsx`. Find the `cfo` role entry (starting at `id: "cfo"`). Make these changes:

**Step 1 — Change `defaultRoute`:**
```typescript
defaultRoute: "/cfo-dashboard",   // was "/csuite"
```

**Step 2 — Add context banners for the new CFO routes:**
```typescript
contextBannerByRoute: {
  "/cfo-dashboard": "CFO View — $125,300 pending resolution · 17 open issues · 6 pre-invoice · $3.82M annualized exposure",
  "/cfo/issue/": "CFO View — Issue Detail · Review financial risk · Approve AI recommendation or reassign",
  "/cfo/closure/": "CFO View — Closure & Accountability · Resolution confirmed · KPI impact updated",
  "/csuite": "CFO View — $15,626 margin at risk · $2.39M annualized · 7 SLA breaches · $88,780 financial impact",
  "/commercial": "CFO View — $59,110 at-risk revenue · $1.63M COPQ · $2.39M margin leakage projected annually",
  "/revenue": "CFO View — Revenue quality: $4,620 GPO overcharges + $29,100 DSO collection risk",
},
```

The `/cfo/issue/` and `/cfo/closure/` entries with trailing slash are matched by the `RoleContextBanner` using `startsWith` (confirm this is how other wildcard entries like `/tax/issue/` are matched in the banner component, and apply the same logic).

---

## PART 13 — FINAL VERIFICATION CHECKLIST

After completing all parts above, run these checks:

**Backend:**
```bash
cd backend
python data/seed_data.py
uvicorn main:app --reload
# Verify these endpoints return data:
curl http://localhost:8000/api/cfo/dashboard
curl http://localhost:8000/api/cfo/issue/CFO-ALERT-001
curl http://localhost:8000/api/cfo/closure/CFO-ALERT-001
```

**Frontend:**
```bash
cd frontend
npm run build
# Must build with zero TypeScript errors
npm run dev
```

**Manual flow test (in browser, switch role to CFO):**
1. Switch role to **CFO — Chief Financial Officer** → should land on `/cfo-dashboard`
2. Sidebar should show **CFO USER** section with 3 nav items: CFO Dashboard, Issue Detail, Closure & Accountability
3. All 4 KPI cards display values and open a modal on click
4. Resolution Trend table shows 3 rows
5. Top Alerts table shows 17 rows sorted by priority/exposure
6. AI Queue shows high-confidence alerts with Approve/Reassign buttons
7. Click any alert row → navigates to `/cfo/issue/:alertId` showing Issue Detail
8. Issue Detail shows sticky Approve/Reassign footer
9. Expand each collapsed section (Why It Happened, Owner & Escalation, CAPA Linkage)
10. Click Approve → navigates to `/cfo/closure/:alertId`
11. Closure shows green confirmation, systems updated, AI log, before/after KPI table
12. Click Back to Dashboard → returns to `/cfo-dashboard` with KPIs updated
13. Go back to dashboard → click Approve in AI Queue directly → should skip to closure (Step 3)
14. The `/csuite` route still works for Admin/CDO roles (NOT the CFO flow — untouched)
15. CAPA Tracker should now include CAPA-012 in the list

**What NOT to do:**
- Do NOT modify `CSuiteDashboard.tsx` or the `/csuite` route in any way
- Do NOT read from or JOIN `tax_jurisdiction_issues` or `pricing_issues` tables in the CFO backend
- Do NOT use persistent DB writes for approve/reassign — session memory only
- Do NOT skip adding `CFOWorkflowProvider` to `App.tsx`
- Do NOT hard-code KPI values in the frontend — always read from the API response so that after a closure the dashboard reflects the updated totals

---

## REFERENCE: How the 3-Step CFO Flow Looks in Practice

```
Step 1: /cfo-dashboard
  ├── Headline: $125,300 · 17 open · 6 pre-invoice · $3.82M annualized
  ├── KPI Cards (click → modal): Revenue / Margin / Compliance / Annual
  ├── Resolution Trend: Revenue ↓12% | Compliance ↑8% | On-Time 74%
  ├── Top Alerts table (click row →) ──────────────────────────────────┐
  └── AI Queue (Approve →) ─────────────────────────────────────────┐  │
                                                                     │  │
Step 2: /cfo/issue/:alertId  ←────────────────────────────────────────┘
  ├── Issue Header: CRITICAL · $28,400 · Pre-Invoice · 2 days
  ├── What Happened: plain language exec summary
  ├── Business Risk: Revenue / Margin / Penalty / Legal
  ├── Owner Status: TAX-03 Jennifer Mills + PRICE-04 David Chen
  ├── AI Recommendation: Fix 1 (91%) + Fix 2 (88%)
  ├── Sticky Footer: [Approve All Fixes] [Reassign]
  └── Collapsed: Why It Happened / Escalation / CAPA Linkage
         Approve ──────────────────────────────────────────────────────┐
                                                                        │
Step 3: /cfo/closure/:alertId  ←───────────────────────────────────────┘
  ├── ✓ Resolved: $28,400 exposure recovered
  ├── Systems Updated: SAP Jurisdiction + SAP Pricing + CAPAs + Alert closed
  ├── AI Action Log: Fix 1 approved by CFO / Fix 2 approved by CFO
  ├── KPI Impact: $125,300→$96,900 / $42,625→$32,965 / etc.
  ├── Notifications: Tax Team / Pricing Team / CCO
  └── [Back to Dashboard] → Step 1 with refreshed KPIs
```
