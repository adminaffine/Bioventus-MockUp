# Cursor AI — Bioventus Tax Team Persona: Full-Stack Implementation Prompt

## CONTEXT

You are working inside the **Bioventus-MockUp** monorepo. The stack is:
- **Frontend:** React + Vite + TypeScript + TailwindCSS, React Router v6 (lazy-loaded pages), located in `frontend/`
- **Backend:** FastAPI (Python), SQLite database at `backend/data/luminos_demo.db`, seeded from CSVs in `backend/data/csv/`, located in `backend/`
- **API layer:** All frontend API calls go through `frontend/src/services/api.ts`
- **Role system:** `frontend/src/context/RoleContext.tsx` — the `tax_compliance` role already exists

Your job is to implement a **4-step Tax Team persona workflow** as described below. Follow every instruction in order. Do not skip any step. Do not invent patterns — match the existing codebase conventions exactly as described.

---

## ⚠️ TWO DECISIONS YOU MUST MAKE BEFORE STARTING

The developer did not specify these two points. Choose ONE option for each and apply it consistently throughout:

**Decision A — CAPA Linkage:**
- **Option A1 (Recommended):** Add `CAPA-007` and `CAPA-011` to the `_base_capas()` list in `backend/routers/capa.py` so they appear in the existing CAPA Tracker page.
- **Option A2:** Render CAPA IDs as display-only text in the Tax UI. Do not touch `capa.py`.

**Decision B — Tax Dashboard Nav Entry:**
- **Option B1 (Recommended):** Add a new nav item `"Tax Dashboard"` to the `nav` array in `frontend/src/components/Layout.tsx` with `path: "/tax-dashboard"`, an appropriate icon (e.g. `Receipt` from lucide-react), and `allowedRoles: ["tax_compliance"]`. Also update `tax_compliance.defaultRoute` in `RoleContext.tsx` from `"/revenue"` to `"/tax-dashboard"`.
- **Option B2:** Do not add a new nav item. Update `tax_compliance.defaultRoute` to `"/tax-dashboard"` only. Users reach the dashboard via role switch.

---

## THE 4-STEP TAX TEAM WORKFLOW (source of truth)

| Step | Route | Page File | Description |
|------|-------|-----------|-------------|
| 1 | `/tax-dashboard` | `TaxDashboard.tsx` | Full tax exposure overview — KPIs, alerts, AI queue, action queue |
| 2 | `/tax/issue/:issueId` | `IssueIntelligence.tsx` | Deep-dive into one jurisdiction mismatch |
| 3 | `/tax/transaction/:orderId` | `TransactionLineage.tsx` | Order-level detail + jurisdiction breakdown |
| 4 | `/tax/closure/:issueId` | `TaxClosure.tsx` | Resolution confirmation + KPI delta + audit log |

Navigation flow: Dashboard → click alert row or "Fix" button → Issue Intelligence → click Affected Record → Transaction Lineage → click "Fix Tax Jurisdiction" or "Approve AI" → Closure → "Back to Dashboard" returns to Step 1.

---

## PART 1 — DATA LAYER

### 1A. Add new rows to `backend/data/csv/sales_orders.csv`

Append these 5 rows to the END of `sales_orders.csv`. Match the existing column order exactly:
`order_id,customer_id,product_id,product_name,order_date,ship_date,quantity,unit_price,total_amount,sales_rep_id,region,payment_method,revenue_recognized,billing_address,cardholder_name,card_last_four,billing_email,tax_id`

```
ORD-011,CUST-0892,PRD-001,Exogen,2026-01-15,2026-01-20,2,1820.0,3640.0,REP-05,Southeast,Credit,Yes,"Central Hospital, 88 South Ave, Phoenix, AZ 85001",David Marsh,4421,dmarsh@central.org,55-1234567
ORD-015,CUST-1087,PRD-002,Exogen,2026-02-01,2026-02-06,2,2160.0,4320.0,REP-03,Southeast,Credit,Yes,"Riverside Clinic, 200 River Rd, Phoenix, AZ 85002",Karen Fields,3317,kfields@riverside.org,55-2345678
ORD-018,CUST-2011,PRD-001,Exogen,2026-04-01,,2,4120.0,8240.0,REP-02,Southeast,Credit,No,"Northeast Medical, 450 NE Blvd, Charlotte, NC 28201",James Liu,7782,jliu@nemedical.org,55-3456789
ORD-019,CUST-3042,PRD-002,Exogen,2026-04-03,,2,3090.0,6180.0,REP-04,Southeast,Credit,No,"Valley Health, 30 Valley Dr, Columbus, OH 43001",Sara Patel,5591,spatel@valleyhealth.org,55-4567890
ORD-022,CUST-2011,PRD-003,Exogen,2026-04-05,,4,2060.0,8240.0,REP-02,Southeast,Credit,No,"Northeast Medical, 450 NE Blvd, Charlotte, NC 28201",James Liu,7782,jliu@nemedical.org,55-3456789
```

**Note on billing addresses:** ORD-018 and ORD-022 ship to North Carolina but the `billing_address` intentionally uses an Arizona ZIP (`AZ 85001` pattern) to trigger the existing jurisdiction mismatch detection logic in `build_tax_jurisdiction_mismatches()`. Update the billing addresses to:
- ORD-018: `"Northeast Medical, 450 NE Blvd, Phoenix, AZ 85001"`
- ORD-019: `"Valley Health, 30 Valley Dr, Phoenix, AZ 85001"`
- ORD-022: `"Northeast Medical, 450 NE Blvd, Phoenix, AZ 85001"`

This ensures the existing `_parse_state_from_billing_address()` regex parses `AZ` and flags them as mismatches against `NC`/`OH` sold-to states.

Also add these customers to `customer_master.csv` if they don't exist (minimal rows, follow column order):
```
CUST-0892,Central,Hospital,contact892@bioventus-demo.com,(602) 500-0892,1975-01-01,88 South Ave,Phoenix,AZ,85001,USA,Health System,Active,,,,,,,,,,
CUST-1087,Riverside,Clinic,contact1087@bioventus-demo.com,(602) 501-1087,1976-01-01,200 River Rd,Phoenix,AZ,85002,USA,Spine Center,Active,,,,,,,,,,
CUST-2011,Northeast,Medical,contact2011@bioventus-demo.com,(704) 502-2011,1977-01-01,450 NE Blvd,Charlotte,NC,28201,USA,Health System,Active,,,,,,,,,,
CUST-3042,Valley,Health,contact3042@bioventus-demo.com,(614) 503-3042,1978-01-01,30 Valley Dr,Columbus,OH,43001,USA,Health System,Active,,,,,,,,,,
```

### 1B. Create `backend/data/csv/tax_jurisdiction_issues.csv`

Create this NEW file with the following content verbatim. This is the canonical data source for the Tax Team's issue intelligence workflow.

```csv
issue_id,order_id,customer_id,customer_name,issue_type,priority,dollar_value,invoice_status,urgency_label,owner_id,owner_name,ai_fix,ai_confidence,ai_source,correct_jurisdiction,applied_jurisdiction,ship_to_state,bill_to_state,product,sla_days_remaining,opened_date,status,address_record,pre_invoice,rate_difference,capa_id,root_cause,risk_compliance,risk_penalty,risk_legal,risk_jurisdiction
TAX-ISS-001,ORD-022,CUST-2011,Northeast Medical,Tax Jurisdiction Mismatch,HIGH,8240.0,Pre-Invoice,2 days to invoice,Unassigned,Unassigned,Correct to North Carolina Jurisdiction,92,SAP Address Master + State Tax Database,North Carolina,Arizona,NC,AZ,Exogen,2,2026-04-05,Open,ADDR-0441,1,2.5,CAPA-007,Ship-to address for CUST-2011 not updated in SAP after customer relocated from Arizona to North Carolina — system defaulted to bill-to state for tax jurisdiction assignment.,Preventable if corrected before invoicing,8240.0 avoidable,State audit trigger avoidable,Contributing to 83% At Risk flag
TAX-ISS-002,ORD-019,CUST-3042,Valley Health,Tax Jurisdiction Mismatch,HIGH,6180.0,Pre-Invoice,4 days to invoice,Unassigned,Unassigned,Correct to Ohio Jurisdiction,91,SAP Address Master + State Tax Database,Ohio,Arizona,OH,AZ,Exogen,4,2026-04-03,Open,ADDR-0380,1,2.5,CAPA-007,Ship-to address for CUST-3042 not updated in SAP after customer relocated from Arizona to Ohio.,Preventable if corrected before invoicing,6180.0 avoidable,State audit trigger avoidable,Contributing to 83% At Risk flag
TAX-ISS-003,ORD-018,CUST-2011,Northeast Medical,Tax Jurisdiction Mismatch,HIGH,8240.0,Post-Invoice,6 days since invoiced,Unassigned,Unassigned,Correct to North Carolina — Post-Invoice correction required,89,SAP Address Master + State Tax Database,North Carolina,Arizona,NC,AZ,Exogen,2,2026-04-05,Open,ADDR-0441,0,2.5,CAPA-011,Ship-to address for CUST-2011 was not updated in SAP after customer relocated from Arizona to North Carolina.,Post-invoice correction required,8240.0 penalty risk,State audit trigger active,Contributing to 83% At Risk flag
TAX-ISS-004,ORD-015,CUST-1087,Riverside Clinic,Tax Jurisdiction Mismatch,MEDIUM,4320.0,Post-Invoice,12 days since invoiced,TAX-03,Jennifer Mills,Correct to correct state jurisdiction,88,SAP Address Master + State Tax Database,North Carolina,Arizona,NC,AZ,Exogen,5,2026-03-20,Open,ADDR-0290,0,2.5,CAPA-007,Billing address mismatch not caught at order creation for CUST-1087.,Post-invoice correction required,4320.0 penalty risk,Audit risk active,Contributing to 83% At Risk flag
TAX-ISS-005,ORD-011,CUST-0892,Central Hospital,Tax Jurisdiction Mismatch,MEDIUM,3640.0,Post-Invoice,18 days since invoiced,TAX-05,Robert Chan,Correct to correct state jurisdiction,85,SAP Address Master + State Tax Database,North Carolina,Arizona,NC,AZ,Exogen,7,2026-03-08,Open,ADDR-0120,0,2.5,CAPA-007,Billing address mismatch for CUST-0892 not flagged during order processing.,Post-invoice correction required,3640.0 penalty risk,Audit risk active,Contributing to 83% At Risk flag
```

### 1C. Update `backend/data/seed_data.py`

In the `create_tables()` function, after the `tax_exemption_certs` table creation block, add:

```python
c.execute("DROP TABLE IF EXISTS tax_jurisdiction_issues")
c.execute("""CREATE TABLE tax_jurisdiction_issues (
    issue_id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, customer_name TEXT,
    issue_type TEXT, priority TEXT, dollar_value REAL, invoice_status TEXT,
    urgency_label TEXT, owner_id TEXT, owner_name TEXT, ai_fix TEXT,
    ai_confidence REAL, ai_source TEXT, correct_jurisdiction TEXT,
    applied_jurisdiction TEXT, ship_to_state TEXT, bill_to_state TEXT,
    product TEXT, sla_days_remaining INTEGER, opened_date TEXT, status TEXT,
    address_record TEXT, pre_invoice INTEGER, rate_difference REAL,
    capa_id TEXT, root_cause TEXT, risk_compliance TEXT, risk_penalty TEXT,
    risk_legal TEXT, risk_jurisdiction TEXT)""")
```

In the CSV loading section (where it loads `tax_exemption_certs`), add the equivalent block for `tax_jurisdiction_issues`:

```python
with open(CSV_DIR / "tax_jurisdiction_issues.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
conn.executemany(
    "INSERT INTO tax_jurisdiction_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
        (r["issue_id"], r["order_id"], r["customer_id"], r["customer_name"],
         r["issue_type"], r["priority"], float(r["dollar_value"]), r["invoice_status"],
         r["urgency_label"], r["owner_id"], r["owner_name"], r["ai_fix"],
         float(r["ai_confidence"]), r["ai_source"], r["correct_jurisdiction"],
         r["applied_jurisdiction"], r["ship_to_state"], r["bill_to_state"],
         r["product"], int(r["sla_days_remaining"]), r["opened_date"], r["status"],
         r["address_record"], int(r["pre_invoice"]), float(r["rate_difference"]),
         r["capa_id"], r["root_cause"], r["risk_compliance"], r["risk_penalty"],
         r["risk_legal"], r["risk_jurisdiction"])
        for r in rows
    ],
)
```

After all edits to seed files, **re-run the seed script** to rebuild the database:
```bash
cd backend && python data/seed_data.py
```

---

## PART 2 — BACKEND ROUTER

### 2A. Create `backend/routers/tax.py`

Create this file from scratch. Follow the exact pattern of `backend/routers/commercial.py`: use `sqlite3`, `sqlite3.Row`, `Path(__file__).resolve().parent.parent`, and `startup_cache` where applicable.

```python
import sqlite3
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/tax", tags=["tax"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
```

#### Endpoint 1: `GET /api/tax/dashboard`

Returns the full Tax Dashboard payload. Query the `tax_jurisdiction_issues` table and `tax_exemption_certs` table. Return this shape:

```python
@router.get("/dashboard")
def tax_dashboard():
    with _connect() as conn:
        issues = [dict(r) for r in conn.execute(
            "SELECT * FROM tax_jurisdiction_issues ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()]
        certs = [dict(r) for r in conn.execute(
            "SELECT * FROM tax_exemption_certs"
        ).fetchall()]

    open_issues = [i for i in issues if i.get("status") == "Open"]
    pre_invoice = [i for i in open_issues if i.get("pre_invoice") == 1]
    total_exposure = round(sum(float(i.get("dollar_value", 0)) for i in open_issues), 2)
    annualized = round(total_exposure * 12, 2)

    # KPI cards
    jurisdiction_mismatches = len(open_issues)
    pre_invoice_alerts = len(pre_invoice)
    tax_overpayments = round(sum(
        float(i.get("dollar_value", 0)) for i in open_issues
        if float(i.get("rate_difference", 0)) < 0
    ), 2)
    tax_underpayments = round(sum(
        float(i.get("dollar_value", 0)) for i in open_issues
        if float(i.get("rate_difference", 0)) > 0
    ), 2)

    # Top 5 alerts table (pre-invoice first, then post sorted by urgency)
    sorted_alerts = sorted(
        open_issues,
        key=lambda x: (0 if x.get("pre_invoice") == 1 else 1, x.get("sla_days_remaining", 99))
    )[:5]

    # AI recommendation queue — only issues with confidence >= 89
    ai_queue = [i for i in open_issues if float(i.get("ai_confidence", 0)) >= 89]

    # My action queue — issues assigned to TAX-03 (the logged-in persona)
    my_queue = [i for i in open_issues if i.get("owner_id") == "TAX-03"]

    return {
        "headline": {
            "total_exposure": total_exposure,
            "active_mismatches": jurisdiction_mismatches,
            "pre_invoice_alerts": pre_invoice_alerts,
            "annualized_exposure": annualized,
        },
        "data_quality_health": [
            {"metric": "Tax Jurisdiction Accuracy", "score": 83, "status": "At Risk"},
            {"metric": "Ship-To Address Completeness", "score": 91, "status": "At Risk"},
        ],
        "kpi_cards": [
            {"name": "Jurisdiction Mismatches", "value": jurisdiction_mismatches, "unit": "open", "description": "Orders where ship-to and bill-to state do not match"},
            {"name": "Pre-Invoice Alerts", "value": pre_invoice_alerts, "unit": "open", "description": "Orders with mismatches that can still be corrected before invoicing"},
            {"name": "Compliance Exposure", "value": total_exposure, "unit": "dollars", "description": "Total penalty and legal risk from active jurisdiction mismatches"},
            {"name": "Tax Overpayments", "value": tax_overpayments if tax_overpayments > 0 else 12400.0, "unit": "dollars", "description": "Orders where a higher tax rate was incorrectly applied"},
            {"name": "Tax Underpayments", "value": tax_underpayments if tax_underpayments > 0 else 31420.0, "unit": "dollars", "description": "Orders where a lower rate was applied creating audit and penalty risk"},
        ],
        "top_alerts": sorted_alerts,
        "ai_queue": ai_queue,
        "my_action_queue": my_queue,
    }
```

#### Endpoint 2: `GET /api/tax/issue/{issue_id}`

```python
@router.get("/issue/{issue_id}")
def tax_issue(issue_id: str):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM tax_jurisdiction_issues WHERE issue_id = ?", (issue_id,)
        ).fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Issue not found")
    issue = dict(row)

    return {
        "issue": issue,
        "header": {
            "issue_type": issue["issue_type"],
            "customer": f"{issue['customer_id']} {issue['customer_name']} — {issue['order_id']}",
            "priority": issue["priority"],
            "dollar_impact": issue["dollar_value"],
            "opened_on": issue["opened_date"],
            "sla": f"{issue['sla_days_remaining']} days remaining  │  {'pre-invoice' if issue['pre_invoice'] else 'post-invoice'}",
        },
        "what_happened": (
            f"Order {issue['order_id']} for {issue['customer_name']} is scheduled to be invoiced in "
            f"{issue['sla_days_remaining']} days. The ship-to address is {issue['correct_jurisdiction']} "
            f"but the system has applied {issue['applied_jurisdiction']} tax jurisdiction — "
            f"tax exposure of ${issue['dollar_value']:,.2f} if invoiced as-is."
        ) if issue["pre_invoice"] else (
            f"Order {issue['order_id']} for {issue['customer_name']} was invoiced with {issue['applied_jurisdiction']} "
            f"tax jurisdiction applied. The correct jurisdiction is {issue['correct_jurisdiction']} — "
            f"tax exposure of ${issue['dollar_value']:,.2f} requiring post-invoice correction."
        ),
        "business_risk": [
            {"risk_type": "Compliance Risk", "status": issue["risk_compliance"], "detail": "Jurisdiction mismatch can be corrected before invoice is generated" if issue["pre_invoice"] else "Post-invoice correction required via SAP adjustment"},
            {"risk_type": "Penalty Exposure", "status": f"${issue['dollar_value']:,.2f} avoidable", "detail": "Tax authority fine avoidable if corrected before invoicing" if issue["pre_invoice"] else "Penalty risk active — correction required immediately"},
            {"risk_type": "Legal Risk", "status": issue["risk_legal"], "detail": "Incorrect jurisdiction filing triggers state tax authority review"},
            {"risk_type": "Jurisdiction Accuracy", "status": issue["risk_jurisdiction"], "detail": "Every open mismatch reduces overall tax accuracy score"},
        ],
        "owner": {
            "owner_id": issue["owner_id"],
            "owner_name": issue["owner_name"],
            "assigned_on": issue["opened_date"],
            "next_action": f"Correct ship-to jurisdiction in SAP {'before invoice generation' if issue['pre_invoice'] else 'via post-invoice adjustment'}",
            "sla_remaining": f"{issue['sla_days_remaining']} days remaining",
        },
        "ai_recommendation": {
            "fix": issue["ai_fix"],
            "confidence": issue["ai_confidence"],
            "source": issue["ai_source"],
            "order_id": issue["order_id"],
            "correct_jurisdiction": issue["correct_jurisdiction"],
        },
        "affected_records": [
            {
                "customer": issue["customer_name"],
                "order": issue["order_id"],
                "address_record": issue["address_record"],
                "current_jurisdiction": f"{issue['applied_jurisdiction']} (incorrect — should be {issue['correct_jurisdiction']})",
            }
        ],
        "prescribed_actions": [
            f"Step 1 — Verify ship-to address for {issue['customer_id']} in SAP",
            f"Step 2 — Correct tax jurisdiction from {issue['applied_jurisdiction']} to {issue['correct_jurisdiction']}",
            "Step 3 — Confirm order re-routes through correct state tax rule",
            "Step 4 — Mark issue resolved and close alert",
        ],
        "why_it_happened": issue["root_cause"],
        "preventive_actions": [
            "Step 1 — Set up automated ship-to address verification at order creation",
            "Step 2 — Add jurisdiction validation checkpoint before invoice generation",
            "Step 3 — Quarterly state tax database sync with SAP address master",
        ],
        "capa_linkage": {
            "capa_id": issue["capa_id"],
            "regulation": "State Tax Compliance — Multi-Jurisdiction",
            "status": "In Progress",
            "owner": "Sandra Lee — Chief Compliance Officer",
            "due_date": "2026-05-10",
        },
    }
```

#### Endpoint 3: `GET /api/tax/transaction/{order_id}`

```python
@router.get("/transaction/{order_id}")
def tax_transaction(order_id: str):
    with _connect() as conn:
        order = conn.execute(
            "SELECT * FROM sales_orders WHERE order_id = ?", (order_id,)
        ).fetchone()
        issue = conn.execute(
            "SELECT * FROM tax_jurisdiction_issues WHERE order_id = ?", (order_id,)
        ).fetchone()
        customer = conn.execute(
            "SELECT * FROM customer_master WHERE customer_id = ?",
            (order["customer_id"] if order else "",)
        ).fetchone() if order else None

    if not order or not issue:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Transaction not found")

    order = dict(order)
    issue = dict(issue)

    return {
        "order_header": {
            "order_id": order["order_id"],
            "customer": f"{order['customer_id']} {issue['customer_name']}",
            "product": order["product_name"],
            "order_date": order["order_date"],
            "invoice_status": "Pending" if not order.get("revenue_recognized") or order.get("revenue_recognized") == "No" else "Invoiced",
            "ship_to_state": issue["ship_to_state"],
            "bill_to_state": issue["bill_to_state"],
        },
        "jurisdiction_breakdown": {
            "ship_to_state": issue["ship_to_state"],
            "bill_to_state": issue["bill_to_state"],
            "jurisdiction_applied": issue["applied_jurisdiction"],
            "correct_jurisdiction": issue["correct_jurisdiction"],
            "rate_difference": f"{issue['rate_difference']}%",
            "tax_exposure": issue["dollar_value"],
        },
        "what_went_wrong": (
            f"{order['product_name']} was scheduled for invoicing under {issue['applied_jurisdiction']} tax jurisdiction "
            f"because the ship-to address for {issue['customer_id']} was not updated in SAP after customer relocation — "
            f"tax exposure of ${issue['dollar_value']:,.2f} on this order."
        ),
        "ai_recommendation": {
            "fix": f"Correct jurisdiction from {issue['applied_jurisdiction']} to {issue['correct_jurisdiction']} for {order['order_id']} + update {issue['address_record']} in SAP address master for {issue['customer_id']}",
            "confidence": float(issue["ai_confidence"]) + 2,  # slightly higher confidence at transaction level
            "source": issue["ai_source"],
        },
        "order_trail": [
            {"date": order["order_date"], "event": "Order created", "jurisdiction": issue["applied_jurisdiction"], "status": order.get("invoice_status", "Pending"), "correction": "In Progress"},
        ],
        "address_accuracy": {
            "confidence": 83,
            "signal": "Jurisdiction mismatch detected at order creation",
            "penalty_exposure": issue["dollar_value"],
        },
        "customer_hierarchy": {
            "idn": "IDN-007 Northeast Alliance",
            "hospital": f"{issue['customer_name']} Regional",
            "clinic": f"{issue['customer_id']} {issue['customer_name']}",
        },
        "cross_team_visibility": [
            {"team": "Pricing Team", "issue": "No pricing conflict on this order", "owner": "Pricing Analyst"},
            {"team": "Credit & AR", "issue": "Payment terms under review", "owner": "Finance Team"},
            {"team": "Data Steward", "issue": "Address master update required", "owner": "MDM Team"},
        ],
        "capa_linkage": {
            "capa_id": "CAPA-011",
            "regulation": "State Tax Compliance — Ship-To Jurisdiction",
            "status": "Open",
            "owner": f"{issue['owner_name']} — Tax Team Member",
            "due_date": "2026-05-20",
        },
        "issue_id": issue["issue_id"],
    }
```

#### Endpoint 4: `GET /api/tax/closure/{issue_id}`

This endpoint returns mock closure data. It takes the `issue_id` and returns the "what changed" confirmation payload. There is no real DB write — the frontend manages resolved state.

```python
@router.get("/closure/{issue_id}")
def tax_closure(issue_id: str):
    with _connect() as conn:
        issue = conn.execute(
            "SELECT * FROM tax_jurisdiction_issues WHERE issue_id = ?", (issue_id,)
        ).fetchone()
    if not issue:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Issue not found")
    issue = dict(issue)

    import datetime
    today = datetime.date.today().isoformat()

    return {
        "resolution_confirmation": {
            "issue": f"Tax Jurisdiction Mismatch — {issue['order_id']}",
            "resolved_by": issue.get("owner_id", "TAX-03"),
            "date": today,
            "resolution_type": f"Jurisdiction Corrected {issue['applied_jurisdiction']} to {issue['correct_jurisdiction']} + Address Master Updated",
            "exposure_recovered": issue["dollar_value"],
        },
        "what_was_updated": [
            f"SAP Jurisdiction Updated — {issue['applied_jurisdiction']} to {issue['correct_jurisdiction']} for {issue['order_id']}",
            f"Address Master {issue['address_record']} corrected for {issue['customer_id']}",
            f"{issue['capa_id']} closed",
            "CAPA-007 updated",
            "Alert closed and removed from queue",
        ],
        "ai_action_log": {
            "recommendation": f"Correct {issue['order_id']} jurisdiction from {issue['applied_jurisdiction']} to {issue['correct_jurisdiction']} + update {issue['address_record']} in SAP address master",
            "approved_by": issue.get("owner_id", "TAX-03"),
            "confidence": issue["ai_confidence"],
            "logged_on": today,
        },
        "kpi_impact": {
            "jurisdiction_mismatches": {"before": 9, "after": 8},
            "tax_jurisdiction_accuracy": {"before": "83%", "after": "84%"},
            "total_exposure": {"before": 43820, "after": round(43820 - float(issue["dollar_value"]), 2)},
            "pre_invoice_alerts": {"before": 4, "after": 3},
        },
        "cross_team_notifications": [
            {"team": "Pricing Team", "notification": f"Order {issue['order_id']} re-confirmed at correct jurisdiction — no pricing impact on this order"},
            {"team": "Credit & AR", "notification": f"Payment terms cleared for processing under correct {issue['correct_jurisdiction']} jurisdiction"},
            {"team": "Data Steward", "notification": f"Address master correction for {issue['customer_id']} logged for MDM review and IQVIA sync"},
        ],
        "issue_id": issue_id,
    }
```

### 2B. Register the new router in `backend/main.py`

At the top of `backend/main.py`, add the import:
```python
from routers import tax
```

After the last `app.include_router(...)` line, add:
```python
app.include_router(tax.router)
```

---

## PART 3 — FRONTEND API TYPES & SERVICE

### 3A. Add to `frontend/src/services/api.ts`

After the existing `TaxJurisdictionMismatchRow` interface, add these new TypeScript interfaces:

```typescript
// ── Tax Dashboard ─────────────────────────────────────────────────────────────

export interface TaxHeadline {
  total_exposure: number;
  active_mismatches: number;
  pre_invoice_alerts: number;
  annualized_exposure: number;
}

export interface TaxDataQualityHealth {
  metric: string;
  score: number;
  status: string;
}

export interface TaxKpiCard {
  name: string;
  value: number;
  unit: "open" | "dollars";
  description: string;
}

export interface TaxIssueRow {
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
  correct_jurisdiction: string;
  applied_jurisdiction: string;
  ship_to_state: string;
  bill_to_state: string;
  product: string;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  address_record: string;
  pre_invoice: number;
  rate_difference: number;
  capa_id: string;
}

export interface TaxDashboard {
  headline: TaxHeadline;
  data_quality_health: TaxDataQualityHealth[];
  kpi_cards: TaxKpiCard[];
  top_alerts: TaxIssueRow[];
  ai_queue: TaxIssueRow[];
  my_action_queue: TaxIssueRow[];
}

// ── Tax Issue Intelligence ────────────────────────────────────────────────────

export interface TaxIssueDetail {
  issue: TaxIssueRow;
  header: Record<string, string | number>;
  what_happened: string;
  business_risk: { risk_type: string; status: string; detail: string }[];
  owner: { owner_id: string; owner_name: string; assigned_on: string; next_action: string; sla_remaining: string };
  ai_recommendation: { fix: string; confidence: number; source: string; order_id: string; correct_jurisdiction: string };
  affected_records: { customer: string; order: string; address_record: string; current_jurisdiction: string }[];
  prescribed_actions: string[];
  why_it_happened: string;
  preventive_actions: string[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
}

// ── Tax Transaction Lineage ───────────────────────────────────────────────────

export interface TaxTransactionDetail {
  order_header: Record<string, string | number>;
  jurisdiction_breakdown: { ship_to_state: string; bill_to_state: string; jurisdiction_applied: string; correct_jurisdiction: string; rate_difference: string; tax_exposure: number };
  what_went_wrong: string;
  ai_recommendation: { fix: string; confidence: number; source: string };
  order_trail: { date: string; event: string; jurisdiction: string; status: string; correction: string }[];
  address_accuracy: { confidence: number; signal: string; penalty_exposure: number };
  customer_hierarchy: { idn: string; hospital: string; clinic: string };
  cross_team_visibility: { team: string; issue: string; owner: string }[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  issue_id: string;
}

// ── Tax Closure ───────────────────────────────────────────────────────────────

export interface TaxClosure {
  resolution_confirmation: { issue: string; resolved_by: string; date: string; resolution_type: string; exposure_recovered: number };
  what_was_updated: string[];
  ai_action_log: { recommendation: string; approved_by: string; confidence: number; logged_on: string };
  kpi_impact: Record<string, { before: number | string; after: number | string }>;
  cross_team_notifications: { team: string; notification: string }[];
  issue_id: string;
}
```

In the `api` object (at the bottom of `api.ts`, alongside the other `get*` methods), add these new methods:

```typescript
getTaxDashboard: () =>
  get<TaxDashboard>("/api/tax/dashboard"),

getTaxIssue: (issueId: string) =>
  get<TaxIssueDetail>(`/api/tax/issue/${issueId}`),

getTaxTransaction: (orderId: string) =>
  get<TaxTransactionDetail>(`/api/tax/transaction/${orderId}`),

getTaxClosure: (issueId: string) =>
  get<TaxClosure>(`/api/tax/closure/${issueId}`),
```

---

## PART 4 — FRONTEND PAGES

Create a new directory `frontend/src/pages/tax/` and create these 4 files inside it.

### Styling conventions to follow throughout all 4 pages:
- Cards: `rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6`
- Page wrapper: `<div className="space-y-6">`
- Section headings: `text-xl font-bold text-slate-900 dark:text-slate-100`
- Sub-labels: `text-xs text-slate-500 dark:text-slate-400`
- Priority badge HIGH: `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`
- Priority badge MEDIUM: `bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300`
- Pre-Invoice badge: `bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300`
- Post-Invoice badge: `bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300`
- AI Approve button: `bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg`
- Reject button: `bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-sm px-4 py-2 rounded-lg`
- Sticky footer: `fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex gap-3 z-50`
- Collapsed sections: use `useState(false)` per section, render a `▶ / ▼` toggle button + `ChevronDown` icon
- Tables: `min-w-full text-sm`, thead `text-left text-slate-500 border-b`, tbody rows `border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer`

---

### 4A. `frontend/src/pages/tax/TaxDashboard.tsx` — Step 1

```
State:
  - data: TaxDashboard | null
  - loading: boolean
  - aiApproved: Set<string>  ← tracks which issue_ids the user has approved
  - aiRejected: Set<string>

On mount: call api.getTaxDashboard() → set data

Layout sections (in this order):
  1. Page title "Tax Exposure Dashboard" + subtitle with the headline 4 numbers from data.headline as pill badges
  2. Data Quality Health — two rows: metric name | score as a color-coded bar (red if < 85%) | status badge
  3. KPI Cards — 5 cards in a responsive grid (2 cols on mobile, 5 on xl), each showing name, formatted value ($X,XXX or N open), description
  4. Top 5 Alerts table — columns: Order ID | Customer | Issue Type | Priority | $ Value | Invoice Status | Urgency | Owner
     - Each row is clickable: onClick navigate to /tax/issue/${row.issue_id}
     - Pre-Invoice rows get a left border accent: `border-l-4 border-orange-400`
  5. AI Recommendation Queue — for each row in data.ai_queue:
     - Show: Order ID | Current State (applied_jurisdiction) | AI Suggested Fix | Confidence % | Source | Approve / Reject buttons
     - Approve click: add to aiApproved set, show ✓ Approved green badge, disable both buttons
     - Reject click: add to aiRejected set, show ✗ Rejected slate badge, disable both buttons
  6. My Action Queue — table with columns: Order ID | Issue Type | Priority | $ Value | Invoice Status | Urgency | Due By | "Fix" button
     - "Fix" button onClick: navigate to /tax/issue/${row.issue_id}
```

---

### 4B. `frontend/src/pages/tax/IssueIntelligence.tsx` — Step 2

```
Route param: issueId from useParams()
State:
  - data: TaxIssueDetail | null
  - loading: boolean
  - aiAction: "approved" | "rejected" | null
  - openSections: Record<string, boolean>  ← for collapsed accordions

On mount: call api.getTaxIssue(issueId) → set data

Layout sections (in this order):
  1. Back button: "← Back to Dashboard" navigates to /tax-dashboard
  2. Issue Header card — a banner row showing: Issue Type | Customer | Priority badge | $ Impact | Opened On | SLA countdown
     - SLA badge: red if sla_days_remaining <= 2, yellow if <= 5, else slate
  3. What Happened — plain text paragraph from data.what_happened inside an info card
  4. Business Risk & Impact — table with 4 rows from data.business_risk: Risk Type | Status | Detail
  5. Owner & Next Action — table row: Owner | Assigned On | Next Action | SLA Remaining
  6. AI Recommendation box — distinct card with yellow-500 left border accent
     - Shows: fix text | confidence % badge | source
     - Approve / Reject buttons (same state pattern as dashboard)
     - Below buttons: small link text "Not comfortable approving? View Prescribed Actions ▼" — clicking this opens the Prescribed Actions accordion
  7. Affected Records — table: Customer | Order | Address Record | Current Jurisdiction
     - Each row is clickable → navigate to /tax/transaction/${row.order} (the order_id from the row)
  8. Sticky footer — 3 buttons: Acknowledge | Mark Resolved | Reassign
     - "Mark Resolved" onClick: navigate to /tax/closure/${issueId}
  9. Collapsed accordion sections (each starts closed, toggles on header click):
     - ▶ Prescribed Actions — numbered list from data.prescribed_actions
     - ▶ Why It Happened — paragraph from data.why_it_happened
     - ▶ Preventive Actions — numbered list from data.preventive_actions
     - ▶ CAPA Linkage — table row: CAPA ID | Regulation | Status | Owner | Due Date
```

---

### 4C. `frontend/src/pages/tax/TransactionLineage.tsx` — Step 3

```
Route param: orderId from useParams()
State:
  - data: TaxTransactionDetail | null
  - loading: boolean
  - aiApproved: boolean
  - openSections: Record<string, boolean>

On mount: call api.getTaxTransaction(orderId) → set data

Layout sections (in this order):
  1. Breadcrumb: "← Back to Issue" → navigates to /tax/issue/${data.issue_id}
  2. Order Header card — table row: Order ID | Customer | Product | Order Date | Invoice Status | Ship-To State | Bill-To State
  3. Tax Jurisdiction Breakdown — table: Ship-To State | Bill-To State | Jurisdiction Applied | Correct Jurisdiction | Rate Difference | Tax Exposure
     - Applied jurisdiction column: red text + warning icon
     - Correct jurisdiction column: green text + check icon
  4. What Went Wrong — plain text paragraph from data.what_went_wrong
  5. AI Recommendation — same yellow-bordered card pattern as Step 2
     - Shows: fix text | confidence (note: will be +2 higher than Step 2) | source
     - Approve / Reject with same state pattern
  6. Sticky footer — buttons: Fix Tax Jurisdiction | Update Address Master | View Customer | View Compliance Record | Back to Issue
     - "Fix Tax Jurisdiction": navigate to /tax/closure/${data.issue_id}
     - "Back to Issue": navigate to /tax/issue/${data.issue_id}
  7. Collapsed accordion sections:
     - ▶ Order Trail — table: date | event | jurisdiction | status | correction
     - ▶ Address Accuracy & Risk Signal — shows confidence score, risk signal text, penalty exposure
     - ▶ Customer Hierarchy — IDN → Hospital → Clinic tree display
     - ▶ Cross-Team Visibility — table: Team | Issue | Owner for each entry in data.cross_team_visibility
     - ▶ CAPA Linkage — table row: CAPA ID | Regulation | Status | Owner | Due Date
```

---

### 4D. `frontend/src/pages/tax/TaxClosure.tsx` — Step 4

```
Route param: issueId from useParams()
State:
  - data: TaxClosure | null
  - loading: boolean

On mount: call api.getTaxClosure(issueId) → set data

Layout sections (in this order):
  1. Resolution banner — large green success card with checkmark icon (CheckCircle from lucide-react)
     - Title: "Jurisdiction Corrected ✓"
     - Subtitle: "Compliance exposure recovered: $X,XXX"
  2. Resolution Confirmation table — Issue | Resolved By | Date | Resolution Type | Exposure Recovered
  3. What Was Updated — bulleted list from data.what_was_updated, each item prefixed with a green ✓
  4. AI Action Log — table: Recommendation | Approved By | Confidence | Logged On
  5. Impact on Dashboard — 2x4 table: KPI | Before | After
     - "After" column values in green text
  6. Cross-Team Notification — table: Team | What They Were Notified About
  7. "Return to Dashboard" button — large, centered, navigates to /tax-dashboard
     - Button style: `bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold`
```

---

## PART 5 — ROUTING, NAVIGATION & ROLE UPDATES

### 5A. Update `frontend/src/App.tsx`

Add 4 new lazy imports at the top of the file, after the existing lazy imports:

```typescript
const TaxDashboard = lazy(() => import("./pages/tax/TaxDashboard"));
const IssueIntelligence = lazy(() => import("./pages/tax/IssueIntelligence"));
const TransactionLineage = lazy(() => import("./pages/tax/TransactionLineage"));
const TaxClosure = lazy(() => import("./pages/tax/TaxClosure"));
```

Inside the `<Routes>` block, after the `/territory-integrity` route, add:

```tsx
<Route path="/tax-dashboard" element={<TaxDashboard />} />
<Route path="/tax/issue/:issueId" element={<IssueIntelligence />} />
<Route path="/tax/transaction/:orderId" element={<TransactionLineage />} />
<Route path="/tax/closure/:issueId" element={<TaxClosure />} />
```

### 5B. Update `frontend/src/components/Layout.tsx`

Add `Receipt` to the lucide-react import list at the top.

In the `nav` array, after the `tax-certificate-monitoring` entry, insert:

```typescript
{
  path: "/tax-dashboard",
  label: "Tax Dashboard",
  icon: Receipt,
  allowedRoles: ["tax_compliance"],
},
```

### 5C. Update `frontend/src/context/RoleContext.tsx`

For the `tax_compliance` role object, make these two changes:

**Change 1 — defaultRoute:**
```typescript
// BEFORE:
defaultRoute: "/revenue",

// AFTER:
defaultRoute: "/tax-dashboard",
```

**Change 2 — contextBannerByRoute** (add the new route entries):
```typescript
contextBannerByRoute: {
  "/tax-dashboard": "Tax Team View — $43,820 at risk · 9 jurisdiction mismatches · 4 pre-invoice alerts · 2 days to next invoice",
  "/tax/issue/:issueId": "Tax Team View — Issue Intelligence · Review jurisdiction mismatch · Approve AI fix or follow prescribed actions",
  "/tax/transaction/:orderId": "Tax Team View — Transaction Lineage · Order-level jurisdiction breakdown · Apply correction",
  "/revenue": "Tax & Compliance View — 25 jurisdiction mismatches · $6,510 exposure · 4 expired exemption certs",
  "/alerts": "Tax & Compliance View — showing jurisdiction mismatch and certificate alerts",
  "/tax-certificate-monitoring": "Tax & Compliance View — monitor expiring certificates and exemption suspension risk",
},
```

---

## PART 6 — CONDITIONAL: CAPA LINKAGE (choose based on Decision A above)

### If Decision A1 (add to capa.py):

In `backend/routers/capa.py`, inside the `_base_capas()` function, append these two new CAPA entries to the return list:

```python
{
    "capa_id": "CAPA-007",
    "title": "State Tax Compliance — Multi-Jurisdiction Address Accuracy",
    "description": "Multiple sales orders processed with incorrect tax jurisdictions due to stale ship-to addresses in SAP. Customers CUST-2011, CUST-3042, CUST-1087, CUST-0892 impacted. Tax exposure of $26,380.",
    "root_cause": "Ship-to address update workflow in SAP does not trigger tax jurisdiction re-validation. Customers who relocated between states retain the old jurisdiction until manual correction.",
    "severity": "HIGH",
    "status": "In Progress",
    "regulation": "State Tax Compliance — Multi-Jurisdiction Filing",
    "affected_dataset": "sales_orders",
    "affected_records": ["ORD-011", "ORD-015", "ORD-018", "ORD-019", "ORD-022"],
    "affected_product": "Exogen",
    "owner": "Sandra Lee",
    "owner_role": "Chief Compliance Officer",
    "created_date": "2026-04-01",
    "due_date": "2026-05-10",
    "corrective_action": "Correct all 5 jurisdiction mismatches in SAP. Update ship-to address master for all affected customers. File amended tax returns where required.",
    "preventive_action": "Add automated ship-to address jurisdiction validation at order creation. Quarterly state tax database sync with SAP address master.",
    "linked_regulation_slug": "state-tax-compliance",
    "priority": 7,
},
{
    "capa_id": "CAPA-011",
    "title": "State Tax Compliance — Ship-To Jurisdiction ORD-018",
    "description": "ORD-018 for CUST-2011 Northeast Medical was processed with Arizona jurisdiction despite ship-to address being in North Carolina. Post-invoice correction required.",
    "root_cause": "Same root cause as CAPA-007. Ship-to address for CUST-2011 not updated after relocation.",
    "severity": "HIGH",
    "status": "Open",
    "regulation": "State Tax Compliance — Ship-To Jurisdiction",
    "affected_dataset": "sales_orders",
    "affected_records": ["ORD-018"],
    "affected_product": "Exogen",
    "owner": "Jennifer Mills",
    "owner_role": "Tax Team Member",
    "created_date": "2026-04-05",
    "due_date": "2026-05-20",
    "corrective_action": "Correct ORD-018 jurisdiction from Arizona to North Carolina in SAP. Update ADDR-0441 in address master for CUST-2011.",
    "preventive_action": "Add jurisdiction validation checkpoint before invoice generation for all orders where ship-to state differs from sold-to state.",
    "linked_regulation_slug": "state-tax-compliance",
    "priority": 8,
},
```

---

## PART 7 — FINAL CHECKLIST

After completing all parts above, verify each item:

- [ ] `backend/data/csv/sales_orders.csv` — 5 new ORD rows appended (ORD-011, ORD-015, ORD-018, ORD-019, ORD-022) with AZ billing addresses for ORD-018, ORD-019, ORD-022
- [ ] `backend/data/csv/customer_master.csv` — 4 new CUST rows appended (CUST-0892, CUST-1087, CUST-2011, CUST-3042)
- [ ] `backend/data/csv/tax_jurisdiction_issues.csv` — new file created with 5 issue rows
- [ ] `backend/data/seed_data.py` — `tax_jurisdiction_issues` table created + CSV loaded
- [ ] Seed script re-run: `cd backend && python data/seed_data.py`
- [ ] `backend/routers/tax.py` — new file with 4 endpoints
- [ ] `backend/main.py` — `from routers import tax` and `app.include_router(tax.router)` added
- [ ] `frontend/src/services/api.ts` — 7 new interfaces + 4 new api methods added
- [ ] `frontend/src/pages/tax/TaxDashboard.tsx` — created
- [ ] `frontend/src/pages/tax/IssueIntelligence.tsx` — created
- [ ] `frontend/src/pages/tax/TransactionLineage.tsx` — created
- [ ] `frontend/src/pages/tax/TaxClosure.tsx` — created
- [ ] `frontend/src/App.tsx` — 4 lazy imports + 4 routes added
- [ ] `frontend/src/components/Layout.tsx` — `Receipt` icon imported + Tax Dashboard nav item added with `allowedRoles: ["tax_compliance"]`
- [ ] `frontend/src/context/RoleContext.tsx` — `tax_compliance.defaultRoute` changed to `"/tax-dashboard"`, contextBannerByRoute updated
- [ ] CAPA-007 and CAPA-011 added to `capa.py` (if Decision A1)
- [ ] Dev server starts without TypeScript errors: `cd frontend && npm run dev`
- [ ] Backend starts without errors: `cd backend && uvicorn main:app --reload`
- [ ] Switching to the `tax_compliance` role in the UI lands on `/tax-dashboard`
- [ ] Clicking a row in Top 5 Alerts navigates to `/tax/issue/:id` and loads data
- [ ] Clicking an Affected Record in Issue Intelligence navigates to `/tax/transaction/:orderId`
- [ ] Clicking "Fix Tax Jurisdiction" navigates to `/tax/closure/:id`
- [ ] "Return to Dashboard" on Closure returns to `/tax-dashboard`

---

## IMPORTANT NOTES

1. **Do not modify any existing pages** (RevenueRisk.tsx, TaxCertificateMonitoring.tsx, etc.). The new Tax Dashboard is additive.
2. **The `tax_compliance` role's `defaultRevenueTab` field can stay as `"tax"` in RoleContext** — it's used by the existing Revenue page which remains accessible via nav.
3. **Sticky footers on Steps 2 and 3** must account for the existing app layout — add `pb-24` to the page wrapper `<div>` so content isn't hidden behind the footer.
4. **All money values** must be formatted with `$X,XXX` using `toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })` or a local `formatMoney` helper.
5. **Loading states** — match the existing pattern: show `<div className="text-sm text-slate-500">Loading...</div>` while fetching, render content after.
6. **Dark mode** — every element must include `dark:` variants. Follow patterns from `TaxCertificateMonitoring.tsx` as the closest existing reference.
7. **The existing `build_tax_jurisdiction_mismatches()` function in commercial.py is NOT replaced** — it continues to serve the Revenue & Risk page's tax tab. The new `/api/tax/*` endpoints are entirely additive.
