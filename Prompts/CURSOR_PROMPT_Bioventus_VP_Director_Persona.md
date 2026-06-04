# Cursor AI — Bioventus VP / Director Persona: Full-Stack Implementation Prompt

## CONTEXT

You are working inside the **Bioventus-MockUp** monorepo. The stack is:
- **Frontend:** React + Vite + TypeScript + TailwindCSS, React Router v6 (lazy-loaded pages), located in `frontend/`
- **Backend:** FastAPI (Python), SQLite database at `backend/data/luminos_demo.db`, seeded from CSVs in `backend/data/csv/`, located in `backend/`
- **API layer:** All frontend API calls go through `frontend/src/services/api.ts`
- **Role system:** `frontend/src/context/RoleContext.tsx` — you will add a new `vp_director` role

Your job is to implement a **3-step VP / Director persona workflow** exactly as described below. Follow every instruction in order. Do not skip any step. Do not invent patterns — match existing codebase conventions exactly as the CFO (`cfo`) and CCO (`cco`) persona workflows demonstrate.

---

## ARCHITECTURAL DECISIONS (ALREADY MADE — DO NOT DEVIATE)

1. **Role ID:** `vp_director` — add to `ROLES` and `VIEWING_AS_ROLE_IDS` in `frontend/src/context/RoleContext.tsx`
2. **Routes:** `/vp-dashboard`, `/vp/issue/:issueId`, `/vp/closure/:issueId`
3. **Data source:** New dedicated `backend/data/csv/vp_alerts.csv` → new `vp_alerts` SQLite table. Do NOT read from or join cfo_alerts, cco_compliance_issues, pricing_issues, or tax_jurisdiction_issues tables.
4. **AI action state:** Session-scoped in-memory state on the backend (`_session_issue_overrides`, `X-VP-Demo-Session` header) plus browser `sessionStorage` marks on the frontend for instant Top Alerts removal. Approved issues vanish for the current demo session only. **`POST /api/vp/reset-demo`** (and the dashboard **Reset demo data** button) reload `vp_alerts` from CSV and restore the baseline headline: **47 open · 9 SLA breach risk · 4 priority queue · 71% resolution rate**. Do NOT persist resolved state to SQLite beyond the seed CSV.
5. **Step 2 action "Nudge Owner":** Stays on Issue Detail. Shows an inline confirmation badge ("✓ Nudge Sent — Owner notified") immediately on click (optimistic local state). Does NOT navigate away.
6. **Step 2 action "Escalate to C-Suite":** Navigates to Step 3 (Closure) — same as Approve/Reassign.
7. **Dashboard charts:** Step 1 shows NO charts and NO Team Health section. Only KPI headline stat, 4 KPI cards, Team Performance Scorecard table, Top Alerts table (max 8 rows), and AI Recommendation Queue table (3 items at baseline).
8. **Approve flow:** Top Alerts → View Issue → Approve on Issue Detail → Closure → Return to Dashboard removes the approved issue from Top Alerts and decrements headline KPIs for the session.
9. **Workflow utilities:** Create `VPWorkflowContext.tsx`, `vpWorkflowStorage.ts`, `vpClosureFormat.ts`, `vpDashboard.ts`, `vpSession.ts`, `vpDemoBaseline.ts` matching CFO equivalents where applicable.

---

## THE 3-STEP VP / DIRECTOR WORKFLOW

| Step | Route | Page File | Description |
|------|-------|-----------|-------------|
| 1 | `/vp-dashboard` | `frontend/src/pages/vp/VPDashboard.tsx` | Operational Command Dashboard — headline, 4 KPI cards, Team Performance Scorecard, Top Alerts sorted by SLA urgency, AI Recommendation Queue |
| 2 | `/vp/issue/:issueId` | `frontend/src/pages/vp/VPIssueDetail.tsx` | Issue Detail & Intervention — issue header, what happened, business risk, owner & SLA status, resolution progress, AI recommendation, sticky footer with Nudge Owner · Reassign · Escalate to C-Suite, collapsed sections |
| 3 | `/vp/closure/:issueId` | `frontend/src/pages/vp/VPClosure.tsx` | Closure & Team Accountability — resolution confirmation, SLA performance record, recurring pattern flag, what was updated, AI action log, KPI impact table, cross-team notifications, Back to Dashboard |

**Navigation flow:**
- Dashboard → click any alert row in Top Alerts → Issue Detail (Step 2)
- Dashboard → click Approve in AI Recommendation Queue → Closure (Step 3) directly
- Dashboard → click Reassign in AI Recommendation Queue → Closure (Step 3) directly
- Issue Detail → click "Nudge Owner" → stay on Issue Detail, show badge confirmation inline
- Issue Detail → click "Reassign" → open Reassign modal → on confirm → Closure (Step 3)
- Issue Detail → click "Escalate to C-Suite" → Closure (Step 3)
- Closure → click "Back to Operational Dashboard" → `/vp-dashboard` with KPIs refreshed

---

## PART 1 — DATA LAYER

### 1A. Create `backend/data/csv/vp_alerts.csv`

Create this file verbatim. Column order must be exact.

```
issue_id,account_id,account_name,order_id,issue_type,team,priority,dollar_exposure,margin_at_risk,penalty_exposure,invoice_status,pre_invoice,sla_days_remaining,opened_date,status,current_owner_id,current_owner_name,current_owner_team,secondary_owner_id,secondary_owner_name,secondary_owner_team,sla_health,live_progress_primary,live_progress_secondary,completion_primary,completion_secondary,ai_fix_1,ai_confidence_1,ai_source_1,ai_fix_2,ai_confidence_2,ai_source_2,root_cause_primary,root_cause_secondary,capa_ids,next_action_primary,next_action_secondary,recurrence_count,recurrence_period,capa_exists,vp_action_signal
VP-ISS-001,CUST-2011,Northeast Medical,ORD-031,Tax Jurisdiction Mismatch + Pricing Override,Tax Team,CRITICAL,28400.0,9660.0,16220.0,Pre-Invoice,1,1,2026-04-05,Open,TAX-03,Jennifer Mills,Tax Team,PRICE-04,David Morrison,Pricing Team,At Risk,Jurisdiction lookup in progress,Awaiting contract confirmation,50,30,Correct ORD-031 jurisdiction from Arizona to North Carolina + update address master for CUST-2011,91.0,SAP + State Tax Database,Revert ORD-031 from list price $850 to GPO Tier-2 rate $720 for CUST-2011,88.0,GPO Contract Repository,Ship-to address for CUST-2011 not updated in SAP after customer relocated from Arizona to North Carolina — system defaulted to bill-to state,GPO Tier-2 contract rate not refreshed in pricing engine after last contract renewal — system fell back to list price,CAPA-007|CAPA-012,Correct ship-to jurisdiction in SAP before invoice,Revert ORD-031 to GPO Tier-2 rate before invoice,3,this period,Yes,Monitor CAPA-007 — if pattern repeats escalate to CCO
VP-ISS-002,CUST-4019,Alliance Health Group,ORD-029,GPO Chargeback Dispute — Contract Ceiling Exceeded,Finance Team,HIGH,18750.0,6375.0,8740.0,Post-Invoice,0,2,2026-03-28,Open,FIN-02,Marcus Webb,Finance Team,,,,On Track,Chargeback verification in progress,,65,,Reroute CUST-4019 chargeback to correct GPO contract tier,88.0,GPO Contract Repository,,0.0,,Chargeback amount exceeds contract ceiling — incorrect GPO tier applied at order creation for CUST-4019,,CAPA-012,Reroute to correct contract tier,,2,this period,Yes,Follow up with Finance Lead — CAPA-012 due 05-20-2026
VP-ISS-003,CUST-0892,Central Hospital,ORD-028,Compliance Breach — Multi-Jurisdiction Filing,Compliance Team,HIGH,14420.0,4903.0,6680.0,Post-Invoice,0,0,2026-03-25,Open,CCO-02,James Torres,Compliance Team,TAX-05,Robert Hayes,Tax Team,Breached,Filing correction initiated,Jurisdiction records under review,40,25,Correct multi-jurisdiction filing for CUST-0892 and align tax records across all affected states,87.0,State Tax Database + Compliance Register,,0.0,,Billing address spans multiple states — jurisdiction assignment logic selected incorrect primary state — multi-state filing obligation not triggered,Secondary state obligations not captured in compliance register at order entry,CAPA-007,File corrected multi-jurisdiction return — SLA breached 4 hours ago,Support compliance filing correction — urgent,1,this period,Yes,CAPA-007 in progress — escalation to CCO if breach not remediated today
VP-ISS-004,CUST-3042,Valley Health,ORD-032,GPO Contract Non-Compliance — Audit Flag,Finance Team,MEDIUM,12180.0,4141.0,5661.0,Post-Invoice,0,3,2026-04-02,Open,Unassigned,,,,,,,Awaiting assignment,,0,,Assign and resolve GPO contract non-compliance for CUST-3042 before audit review,85.0,GPO Contract Repository,,0.0,,GPO contract terms for CUST-3042 not updated in pricing engine after most recent GPO renewal cycle,,CAPA-012,Assign owner and initiate GPO contract review — 3 days remaining,,1,this period,Yes,Assign owner immediately — unassigned with 3 days remaining
VP-ISS-005,CUST-1055,Metro Health Partners,ORD-033,Tax Jurisdiction Mismatch,Tax Team,MEDIUM,8200.0,2788.0,3813.0,Pre-Invoice,1,4,2026-04-03,Open,TAX-04,Emily Carter,Tax Team,,,,,Watch,Jurisdiction verification underway,,45,,Correct ORD-033 jurisdiction to Ohio and update SAP address master for CUST-1055,89.0,SAP + State Tax Database,,0.0,,Customer address update not propagated to tax module in SAP after CUST-1055 relocated to Ohio,,CAPA-007,Update jurisdiction before invoicing — 4 days remaining,,2,this period,Yes,Monitor progress — CAPA-007 linked
VP-ISS-006,CUST-2088,Summit Medical Center,ORD-035,GPO Contract Discrepancy,Pricing Team,MEDIUM,7100.0,2414.0,3302.0,Post-Invoice,0,6,2026-04-01,Open,PRICE-04,David Morrison,Pricing Team,,,,On Track,Contract reconciliation in progress,,55,,Reconcile CUST-2088 GPO contract and issue credit memo for ORD-035,85.0,GPO Contract Repository,,0.0,,Contract version mismatch between SAP pricing engine and GPO repository — prior-period rate applied to current-period order,,CAPA-012,Reconcile and credit,,1,this period,Yes,Monitor — CAPA-012 linked
VP-ISS-007,CUST-3101,Westfield Health,ORD-027,Pricing Override — List Price Applied,Pricing Team,MEDIUM,6800.0,2312.0,3162.0,Post-Invoice,0,5,2026-03-22,Open,PRICE-04,David Morrison,Pricing Team,,,,Watch,Credit memo preparation underway,,35,,Revert ORD-027 pricing to contracted rate and issue credit memo for CUST-3101,86.0,GPO Contract Repository,,0.0,,Sales order pricing engine bypassed contract rate lookup — manual override applied list price instead of GPO Tier-2 rate,,CAPA-012,Revert to contract rate and issue credit memo,,2,this period,Yes,Follow up with Pricing Lead on credit memo status
VP-ISS-008,CUST-4215,Pacific Care Group,ORD-036,Tax Exemption Certificate Expired,Tax Team,LOW,6200.0,2108.0,2883.0,Pre-Invoice,1,7,2026-04-04,Open,TAX-03,Jennifer Mills,Tax Team,,,,,On Track,Certificate renewal request sent,,60,,Obtain updated tax exemption certificate from CUST-4215 and apply before invoicing ORD-036,90.0,Tax Exemption Registry,,0.0,,CUST-4215 exemption certificate expired 2026-03-01 — renewal reminder not triggered — SAP exemption flag still set to active,,CAPA-007,Obtain and apply certificate — 7 days remaining,,1,this period,Yes,Monitor renewal — SLA comfortable
VP-ISS-009,CUST-5082,Lakeview Medical,ORD-034,Chargeback Dispute — Rebate Discrepancy,Finance Team,LOW,5800.0,1972.0,2697.0,Pre-Invoice,1,8,2026-04-03,Open,FIN-02,Marcus Webb,Finance Team,,,,,On Track,Rebate recalculation in progress,,50,,Reconcile rebate discrepancy and apply correct chargeback credit for ORD-034,84.0,GPO Contract Repository,,0.0,,Rebate calculation used stale contract terms — quarterly update cycle missed CUST-5082 renewal in 2026-Q1,,CAPA-012,Apply correct rebate calculation — 8 days remaining,,1,this period,Yes,Standard resolution — no escalation required
```

**Verify these totals match the dashboard KPIs exactly:**
- COUNT WHERE status='Open' = **9 open issues** (headline: "47 open" uses synthetic display value — see Step 1A note below)
- COUNT WHERE sla_days_remaining <= 2 AND status='Open' = **2** (VP-ISS-001 at 1 day, VP-ISS-002 at 2 days)
- COUNT WHERE status='Open' AND current_owner_id='Unassigned' = **1** (VP-ISS-004)
- Avg resolution rate across teams = **71%** (synthetic — hardcoded in backend, not computed from CSV)

> **NOTE on synthetic headline numbers:** The VP user flow document specifies "47 open issues · 9 SLA breach risks · 4 in escalation queue · 71% team resolution rate" as illustrative numbers. These are hardcoded display values in the backend dashboard response — the CSV drives issue detail data, the headline uses fixed demo numbers. See Part 2A for the backend implementation.

---

### 1B. Add `vp_alerts` table to `backend/data/seed_data.py`

Open `backend/data/seed_data.py`. Find the section where `cfo_alerts` is seeded (search for `CREATE TABLE IF NOT EXISTS cfo_alerts`). Immediately after the entire CFO alerts block (CREATE TABLE + INSERT + commit), add the following VP block in the same position/style:

```python
# ── VP / Director alerts ──────────────────────────────────────────────────────
conn.execute("""
CREATE TABLE IF NOT EXISTS vp_alerts (
    issue_id              TEXT PRIMARY KEY,
    account_id            TEXT,
    account_name          TEXT,
    order_id              TEXT,
    issue_type            TEXT,
    team                  TEXT,
    priority              TEXT,
    dollar_exposure       REAL,
    margin_at_risk        REAL,
    penalty_exposure      REAL,
    invoice_status        TEXT,
    pre_invoice           INTEGER,
    sla_days_remaining    INTEGER,
    opened_date           TEXT,
    status                TEXT DEFAULT 'Open',
    current_owner_id      TEXT,
    current_owner_name    TEXT,
    current_owner_team    TEXT,
    secondary_owner_id    TEXT,
    secondary_owner_name  TEXT,
    secondary_owner_team  TEXT,
    sla_health            TEXT,
    live_progress_primary TEXT,
    live_progress_secondary TEXT,
    completion_primary    INTEGER,
    completion_secondary  INTEGER,
    ai_fix_1              TEXT,
    ai_confidence_1       REAL,
    ai_source_1           TEXT,
    ai_fix_2              TEXT,
    ai_confidence_2       REAL,
    ai_source_2           TEXT,
    root_cause_primary    TEXT,
    root_cause_secondary  TEXT,
    capa_ids              TEXT,
    next_action_primary   TEXT,
    next_action_secondary TEXT,
    recurrence_count      INTEGER,
    recurrence_period     TEXT,
    capa_exists           TEXT,
    vp_action_signal      TEXT
)
""")

_vp_csv = Path(__file__).resolve().parent / "csv" / "vp_alerts.csv"
if _vp_csv.exists():
    import csv as _csv_mod
    with open(_vp_csv, newline="", encoding="utf-8") as _f:
        _reader = _csv_mod.DictReader(_f)
        for _row in _reader:
            conn.execute("""
                INSERT OR REPLACE INTO vp_alerts VALUES (
                    :issue_id,:account_id,:account_name,:order_id,:issue_type,:team,
                    :priority,:dollar_exposure,:margin_at_risk,:penalty_exposure,
                    :invoice_status,:pre_invoice,:sla_days_remaining,:opened_date,:status,
                    :current_owner_id,:current_owner_name,:current_owner_team,
                    :secondary_owner_id,:secondary_owner_name,:secondary_owner_team,
                    :sla_health,:live_progress_primary,:live_progress_secondary,
                    :completion_primary,:completion_secondary,
                    :ai_fix_1,:ai_confidence_1,:ai_source_1,
                    :ai_fix_2,:ai_confidence_2,:ai_source_2,
                    :root_cause_primary,:root_cause_secondary,:capa_ids,
                    :next_action_primary,:next_action_secondary,
                    :recurrence_count,:recurrence_period,:capa_exists,:vp_action_signal
                )
            """, _row)
    conn.commit()
    print(f"Seeded vp_alerts from {_vp_csv}")
```

---

## PART 2 — BACKEND ROUTER

### 2A. Create `backend/routers/vp.py`

Create this file in full. Model it exactly on `backend/routers/cfo.py`. Key differences from CFO:

- Router prefix: `/api/vp`
- Session header: `X-VP-Demo-Session`
- Table: `vp_alerts`
- Primary key column: `issue_id`
- Dependency function: `get_vp_demo_session`
- Headline numbers are **partially synthetic** (demo fixture) — see below

```python
import datetime
from pathlib import Path
import sqlite3
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/vp", tags=["vp"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

_session_issue_overrides: dict[str, dict[str, dict]] = {}
_initialized_vp_sessions: set[str] = set()

VP_TEAM_MEMBERS = [
    {"id": "TAX-03", "name": "Jennifer Mills", "team": "Tax Team"},
    {"id": "TAX-04", "name": "Emily Carter", "team": "Tax Team"},
    {"id": "TAX-05", "name": "Robert Chan", "team": "Tax Team"},
    {"id": "PRICE-04", "name": "David Chen", "team": "Pricing Team"},
    {"id": "PRICE-05", "name": "Sarah Park", "team": "Pricing Team"},
    {"id": "FIN-01", "name": "Priya Nair", "team": "Finance Team"},
    {"id": "FIN-02", "name": "Marcus Webb", "team": "Finance Team"},
    {"id": "FIN-03", "name": "Rachel Kim", "team": "Finance Team"},
    {"id": "CCO-01", "name": "Sandra Lee", "team": "Compliance Team"},
    {"id": "CCO-02", "name": "James Torres", "team": "Compliance Team"},
]

_PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
_SLA_HEALTH_ORDER = {"Breached": 0, "At Risk": 1, "Watch": 2, "On Track": 3}

# Synthetic headline fixtures (demo values as per VP user flow doc)
_HEADLINE_TOTAL_OPEN = 47
_HEADLINE_SLA_BREACH_RISK = 9
_HEADLINE_ESCALATION_QUEUE = 4
_HEADLINE_TEAM_RESOLUTION_RATE = 71

# Synthetic team scorecard fixtures
_TEAM_SCORECARD = [
    {"team": "Tax Team", "open_issues": 12, "sla_breach_risk": 3, "resolution_rate": 68,
     "health_status": "At Risk", "health_detail": "2 issues within 1 day of SLA breach"},
    {"team": "Pricing Team", "open_issues": 9, "sla_breach_risk": 2, "resolution_rate": 79,
     "health_status": "Watch", "health_detail": "Resolution rate improving but SLA risk remains"},
    {"team": "Compliance Team", "open_issues": 14, "sla_breach_risk": 3, "resolution_rate": 65,
     "health_status": "At Risk", "health_detail": "CAPA-007 contributor unresolved"},
    {"team": "Finance Team", "open_issues": 12, "sla_breach_risk": 1, "resolution_rate": 81,
     "health_status": "On Track", "health_detail": "Lowest breach risk this period"},
]


def get_vp_demo_session(
    x_vp_demo_session: str | None = Header(default=None, alias="X-VP-Demo-Session"),
) -> str:
    return x_vp_demo_session or "default"


def _session_overrides(session_id: str) -> dict[str, dict]:
    return _session_issue_overrides.setdefault(session_id, {})


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _reset_demo_issues_for_fresh_session(session_id: str) -> None:
    if session_id in _initialized_vp_sessions:
        return
    _initialized_vp_sessions.add(session_id)
    _session_issue_overrides.pop(session_id, None)
    with _connect() as conn:
        conn.execute("UPDATE vp_alerts SET status = 'Open'")
        conn.commit()


def _is_open_issue(issue: dict) -> bool:
    return str(issue.get("status") or "Open").strip().lower() == "open"


def _merge_issue(issue: dict, session_id: str) -> dict:
    merged = dict(issue)
    override = _session_overrides(session_id).get(issue["issue_id"])
    if override:
        merged.update(override)
    return merged


def _load_issues(session_id: str) -> list[dict]:
    _reset_demo_issues_for_fresh_session(session_id)
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM vp_alerts").fetchall()
    issues = [_merge_issue(dict(r), session_id) for r in rows]
    return issues


def _build_dashboard(issues: list[dict], session_id: str) -> dict:
    open_issues = [i for i in issues if _is_open_issue(i)]

    # Top Alerts: sort by SLA urgency first (sla_days_remaining ASC), then priority, then dollar exposure DESC
    def alert_sort_key(i):
        sla = i.get("sla_days_remaining") or 999
        p = _PRIORITY_ORDER.get(str(i.get("priority") or "LOW").upper(), 3)
        return (sla, p, -(i.get("dollar_exposure") or 0))

    top_alerts = sorted(open_issues, key=alert_sort_key)[:8]

    # AI Recommendation Queue: issues that have ai_fix_1 and no ai_decision
    ai_queue = [
        i for i in open_issues
        if i.get("ai_fix_1") and not i.get("ai_decision")
    ][:3]

    # Compute real-time KPI deltas from overrides
    resolved_count = sum(1 for i in issues if not _is_open_issue(i))
    open_count = len(open_issues)
    sla_breach = sum(1 for i in open_issues if (i.get("sla_days_remaining") or 999) <= 2)
    escalation_q = sum(1 for i in open_issues if str(i.get("priority") or "").upper() in ("CRITICAL", "HIGH"))

    # KPI cards — use synthetic headline as base, adjust for session resolutions
    effective_open = max(0, _HEADLINE_TOTAL_OPEN - resolved_count)
    effective_sla = max(0, _HEADLINE_SLA_BREACH_RISK - (resolved_count // 2))
    effective_esc = max(0, _HEADLINE_ESCALATION_QUEUE - resolved_count)
    effective_rate = min(100, _HEADLINE_TEAM_RESOLUTION_RATE + (resolved_count * 2))

    kpi_cards = {
        "issues_pending": {
            "value": effective_open,
            "label": "Issues Pending Resolution",
            "description": "Total unresolved issues across Tax, Pricing, Compliance, and Finance teams",
        },
        "sla_breach_risk": {
            "value": effective_sla,
            "label": "SLA Breach Risk",
            "description": "Issues at risk of or already breaching their resolution deadline",
        },
        "escalation_queue": {
            "value": effective_esc,
            "label": "Escalation Queue",
            "description": "Issues that have crossed dollar or regulatory threshold requiring CFO / CCO visibility",
        },
        "team_resolution_rate": {
            "value": effective_rate,
            "label": "Team Resolution Rate",
            "description": "Percentage of issues resolved on time across all teams this period",
            "unit": "%",
        },
    }

    return {
        "headline": {
            "total_open_issues": effective_open,
            "sla_breach_risk": effective_sla,
            "escalation_queue": effective_esc,
            "team_resolution_rate": effective_rate,
        },
        "kpi_cards": kpi_cards,
        "team_scorecard": _TEAM_SCORECARD,
        "top_alerts": [_issue_to_alert_row(i) for i in top_alerts],
        "ai_queue": [_issue_to_alert_row(i) for i in ai_queue],
        "all_open_issues": [_issue_to_alert_row(i) for i in open_issues],
    }


def _issue_to_alert_row(issue: dict) -> dict:
    """Flatten a vp_alerts row to the shape the frontend alert table expects."""
    return {
        "issue_id": issue.get("issue_id"),
        "account_id": issue.get("account_id"),
        "account_name": issue.get("account_name"),
        "order_id": issue.get("order_id"),
        "issue_type": issue.get("issue_type"),
        "team": issue.get("team"),
        "priority": issue.get("priority"),
        "dollar_exposure": issue.get("dollar_exposure") or 0,
        "invoice_status": issue.get("invoice_status"),
        "current_owner_id": issue.get("current_owner_id") or "Unassigned",
        "current_owner_name": issue.get("current_owner_name") or "Unassigned",
        "sla_days_remaining": issue.get("sla_days_remaining") or 0,
        "sla_health": issue.get("sla_health") or "On Track",
        "status": issue.get("status") or "Open",
        "ai_fix_1": issue.get("ai_fix_1"),
        "ai_confidence_1": issue.get("ai_confidence_1") or 0,
        "ai_source_1": issue.get("ai_source_1"),
        "ai_fix_2": issue.get("ai_fix_2"),
        "ai_confidence_2": issue.get("ai_confidence_2") or 0,
        "ai_source_2": issue.get("ai_source_2"),
        "ai_decision": issue.get("ai_decision"),
    }


def _build_issue_detail(issue: dict) -> dict:
    """Build the full Issue Detail & Intervention payload for Step 2."""
    sla_days = issue.get("sla_days_remaining") or 0
    sla_label = (
        "SLA Breached" if sla_days <= 0
        else f"{sla_days} day{'s' if sla_days != 1 else ''} to SLA breach"
        if sla_days <= 2 else f"{sla_days} days remaining"
    )
    sla_health = issue.get("sla_health") or "On Track"

    capa_raw = issue.get("capa_ids") or ""
    capa_list = [c.strip() for c in capa_raw.replace("|", ",").split(",") if c.strip()]

    owners = []
    if issue.get("current_owner_id") and issue.get("current_owner_id") != "Unassigned":
        owners.append({
            "owner_id": issue["current_owner_id"],
            "owner_name": issue.get("current_owner_name"),
            "team": issue.get("current_owner_team"),
            "next_action": issue.get("next_action_primary"),
            "sla_health": sla_health,
            "live_progress": issue.get("live_progress_primary"),
            "completion_pct": issue.get("completion_primary") or 0,
        })
    if issue.get("secondary_owner_id") and issue.get("secondary_owner_id") not in ("", None):
        owners.append({
            "owner_id": issue["secondary_owner_id"],
            "owner_name": issue.get("secondary_owner_name"),
            "team": issue.get("secondary_owner_team"),
            "next_action": issue.get("next_action_secondary"),
            "sla_health": sla_health,
            "live_progress": issue.get("live_progress_secondary"),
            "completion_pct": issue.get("completion_secondary") or 0,
        })

    ai_recs = []
    if issue.get("ai_fix_1"):
        ai_recs.append({
            "fix": issue["ai_fix_1"],
            "fix_type": "Fix 1",
            "confidence": issue.get("ai_confidence_1") or 0,
            "source": issue.get("ai_source_1") or "",
        })
    if issue.get("ai_fix_2"):
        ai_recs.append({
            "fix": issue["ai_fix_2"],
            "fix_type": "Fix 2",
            "confidence": issue.get("ai_confidence_2") or 0,
            "source": issue.get("ai_source_2") or "",
        })

    capa_linkage = [
        {
            "capa_id": c,
            "area": "Tax Compliance" if "007" in c else "GPO Contract Rate Accuracy",
            "status": "In Progress",
            "owner": "Sandra Lee — CCO" if "007" in c else "David Chen — Pricing Team",
            "due_date": "05-10-2026" if "007" in c else "05-20-2026",
        }
        for c in capa_list
    ]

    root_causes = []
    if issue.get("root_cause_primary"):
        rc_type = "Tax" if issue.get("team") == "Tax Team" else "Primary"
        root_causes.append({"error_type": rc_type, "root_cause": issue["root_cause_primary"]})
    if issue.get("root_cause_secondary"):
        rc_type = "Pricing" if "pricing" in (issue.get("root_cause_secondary") or "").lower() else "Secondary"
        root_causes.append({"error_type": rc_type, "root_cause": issue["root_cause_secondary"]})

    dollar_exposure = issue.get("dollar_exposure") or 0
    margin_at_risk = issue.get("margin_at_risk") or 0
    penalty_exposure = issue.get("penalty_exposure") or 0

    return {
        "issue_id": issue["issue_id"],
        "header": {
            "issue_type": issue.get("issue_type"),
            "account": f"{issue.get('account_id')} {issue.get('account_name')} — {issue.get('order_id')}",
            "account_id": issue.get("account_id"),
            "account_name": issue.get("account_name"),
            "order_id": issue.get("order_id"),
            "priority": issue.get("priority"),
            "dollar_exposure": dollar_exposure,
            "opened_on": issue.get("opened_date"),
            "resolution_status": f"Pending — {sla_label}",
            "sla_health": sla_health,
            "sla_days_remaining": sla_days,
        },
        "what_happened": (
            f"Order {issue.get('order_id')} for {issue.get('account_name')} "
            f"{'is scheduled to be invoiced in ' + str(sla_days) + ' day' + ('s' if sla_days != 1 else '') if sla_days > 0 else 'has breached its SLA'}. "
            f"{issue.get('root_cause_primary', '')}. "
            f"Combined financial exposure is ${dollar_exposure:,.0f}. "
            f"{', '.join(o['owner_id'] for o in owners) or 'No owner assigned'} — "
            f"{'at risk of breaching SLA' if sla_health in ('At Risk', 'Breached') else 'on track'}."
        ),
        "business_risk": [
            {"risk_type": "Revenue at Risk", "value": dollar_exposure, "vp_context": "Preventable if resolved before invoicing" if issue.get("pre_invoice") else "Revenue already recognized — credit memo required"},
            {"risk_type": "Margin at Risk", "value": margin_at_risk, "vp_context": f"{round((margin_at_risk / dollar_exposure * 100) if dollar_exposure else 0)}% of order value at risk"},
            {"risk_type": "Penalty Exposure", "value": penalty_exposure, "vp_context": "Avoidable if resolved within SLA"},
            {"risk_type": "SLA Breach Risk", "value": None, "vp_context": sla_label, "text_value": sla_label},
        ],
        "owners": owners,
        "resolution_progress": [
            {
                "task": f"{o['team']} — {issue.get('issue_type', 'Resolution')}",
                "what_done": o.get("live_progress") or "In progress",
                "completion_pct": o.get("completion_pct") or 0,
                "vp_risk_signal": "At risk — delayed" if (o.get("completion_pct") or 0) < 40 else "On track if completed by EOD",
            }
            for o in owners
        ],
        "ai_recommendations": ai_recs,
        "ai_decision": issue.get("ai_decision"),
        "collapsed": {
            "why_it_happened": root_causes,
            "owner_escalation": [
                {
                    "owner": o["owner_id"],
                    "name": o.get("owner_name"),
                    "assigned_on": issue.get("opened_date"),
                    "sla_remaining": sla_label,
                    "escalation_path": "Team Lead notified → VP → CFO",
                    "status": sla_health,
                }
                for o in owners
            ],
            "capa_linkage": capa_linkage,
        },
        "team": issue.get("team"),
        "recurrence": {
            "issue_type": issue.get("issue_type"),
            "count": issue.get("recurrence_count") or 0,
            "period": issue.get("recurrence_period") or "this period",
            "capa_exists": issue.get("capa_exists") or "No",
            "capa_ids": capa_list,
            "vp_action_signal": issue.get("vp_action_signal") or "",
        },
    }


def _build_closure(issue: dict, action: str, new_owner_name: str | None = None) -> dict:
    today = datetime.date.today().strftime("%m-%d-%Y")
    now_ts = datetime.datetime.now().strftime("%m-%d-%Y %I:%M %p")
    dollar_exposure = issue.get("dollar_exposure") or 0
    issue_type = issue.get("issue_type") or "Issue"
    account = f"{issue.get('account_id')} {issue.get('account_name')}"
    order_id = issue.get("order_id") or ""

    owners = []
    if issue.get("current_owner_id") and issue.get("current_owner_id") != "Unassigned":
        owners.append({
            "owner_id": issue["current_owner_id"],
            "owner_name": issue.get("current_owner_name") or issue["current_owner_id"],
        })
    if issue.get("secondary_owner_id"):
        owners.append({
            "owner_id": issue["secondary_owner_id"],
            "owner_name": issue.get("secondary_owner_name") or issue["secondary_owner_id"],
        })

    resolved_by = new_owner_name or " + ".join(o["owner_id"] for o in owners) or "VP / Director"

    capa_raw = issue.get("capa_ids") or ""
    capa_list = [c.strip() for c in capa_raw.replace("|", ",").split(",") if c.strip()]

    ai_action_log = []
    if issue.get("ai_fix_1") and action in ("approve", "escalate"):
        ai_action_log.append({
            "fix": issue["ai_fix_1"],
            "approved_by": "VP / Director",
            "confidence": issue.get("ai_confidence_1") or 0,
            "logged_on": today,
        })
    if issue.get("ai_fix_2") and action in ("approve", "escalate"):
        ai_action_log.append({
            "fix": issue["ai_fix_2"],
            "approved_by": "VP / Director",
            "confidence": issue.get("ai_confidence_2") or 0,
            "logged_on": today,
        })

    action_label_map = {
        "approve": "AI Recommendation Approved",
        "reassign": f"Reassigned to {new_owner_name or 'New Owner'}",
        "escalate": "Escalated to C-Suite",
    }
    resolution_type = action_label_map.get(action, "VP Action Taken")

    sla_days = issue.get("sla_days_remaining") or 0
    sla_outcome = "Breached" if sla_days <= 0 else "On Time"
    sla_limit = "2 days" if sla_days <= 2 else f"{sla_days} days"

    what_was_updated = []
    if "Tax" in (issue.get("issue_type") or ""):
        what_was_updated.append(f"SAP Jurisdiction Updated — corrected for {order_id}")
    if "Pricing" in (issue.get("issue_type") or "") or "GPO" in (issue.get("issue_type") or ""):
        what_was_updated.append(f"SAP Pricing Master Updated — contract rate applied for {account}")
    for capa in capa_list:
        what_was_updated.append(f"{capa} updated with resolution details")
    what_was_updated.append("Alert closed and removed from Top Alerts")
    what_was_updated.append("Team Performance Scorecard updated — resolution rate improved")

    cross_team_notifications = []
    if issue.get("current_owner_team"):
        cross_team_notifications.append({
            "team": issue["current_owner_team"],
            "notification": f"Issue resolved for {order_id} — {issue_type} — SLA {sla_outcome}",
        })
    if issue.get("secondary_owner_team"):
        cross_team_notifications.append({
            "team": issue["secondary_owner_team"],
            "notification": f"Supporting action completed for {order_id} — {issue_type}",
        })
    cross_team_notifications.append({
        "team": "Chief Financial Officer",
        "notification": f"Revenue exposure of ${dollar_exposure:,.0f} resolved — KPIs updated — no escalation required",
    })
    cross_team_notifications.append({
        "team": "Chief Compliance Officer",
        "notification": f"Compliance exposure reduced — {', '.join(capa_list) or 'CAPA'} updated — filing accuracy verified",
    })

    return {
        "issue_id": issue["issue_id"],
        "resolution_confirmation": {
            "issue": f"{issue_type} — {order_id}",
            "resolved_by": resolved_by,
            "date": today,
            "resolution_type": resolution_type,
            "exposure_recovered": dollar_exposure,
        },
        "sla_performance": [
            {
                "owner": o["owner_id"],
                "owner_name": o["owner_name"],
                "resolved_at": now_ts,
                "sla_limit": sla_limit,
                "sla_outcome": sla_outcome,
                "vp_accountability_note": f"Resolved within SLA — no breach" if sla_outcome == "On Time" else "SLA breached — escalation path triggered",
            }
            for o in (owners or [{"owner_id": "VP / Director", "owner_name": "VP / Director"}])
        ],
        "recurring_pattern": {
            "issue_type": issue.get("issue_type"),
            "recurrence_count": issue.get("recurrence_count") or 0,
            "period": issue.get("recurrence_period") or "this period",
            "team": issue.get("team") or issue.get("current_owner_team"),
            "capa_exists": issue.get("capa_exists") or "No",
            "capa_ids": capa_list,
            "vp_action_signal": issue.get("vp_action_signal") or "",
        },
        "what_was_updated": what_was_updated,
        "ai_action_log": ai_action_log,
        "kpi_impact": {
            "Issues Pending Resolution": {"before": _HEADLINE_TOTAL_OPEN, "after": max(0, _HEADLINE_TOTAL_OPEN - 1), "label": "Issues Pending Resolution"},
            "SLA Breach Risk": {"before": _HEADLINE_SLA_BREACH_RISK, "after": max(0, _HEADLINE_SLA_BREACH_RISK - (2 if sla_days <= 2 else 0)), "label": "SLA Breach Risk"},
            "Escalation Queue": {"before": _HEADLINE_ESCALATION_QUEUE, "after": max(0, _HEADLINE_ESCALATION_QUEUE - 1), "label": "Escalation Queue"},
            "Team Resolution Rate": {"before": _HEADLINE_TEAM_RESOLUTION_RATE, "after": min(100, _HEADLINE_TEAM_RESOLUTION_RATE + 3), "label": "Team Resolution Rate", "unit": "%"},
        },
        "cross_team_notifications": cross_team_notifications,
        "action_taken": action,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def vp_dashboard(session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    return _build_dashboard(issues, session_id)


@router.get("/issue/{issue_id}")
def vp_issue_detail(issue_id: str, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")
    return _build_issue_detail(issue)


class VPApproveRequest(BaseModel):
    issue_id: str


@router.post("/approve")
def vp_approve(req: VPApproveRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")
    _session_overrides(session_id)[req.issue_id] = {"status": "Resolved", "ai_decision": "approve"}
    issues = _load_issues(session_id)
    return {
        "dashboard": _build_dashboard(issues, session_id),
        "closure": _build_closure(issue, "approve"),
    }


class VPAiActionRequest(BaseModel):
    issue_id: str
    action: str  # "approve" | "reject"


@router.post("/ai-action")
def vp_ai_action(req: VPAiActionRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")
    override = {"ai_decision": req.action}
    if req.action == "approve":
        override["status"] = "Resolved"
    _session_overrides(session_id)[req.issue_id] = override
    issues = _load_issues(session_id)
    return {"ok": True, "issue_id": req.issue_id, "dashboard": _build_dashboard(issues, session_id)}


class VPReassignRequest(BaseModel):
    issue_id: str
    new_owner_id: str
    new_owner_name: str


@router.post("/reassign")
def vp_reassign(req: VPReassignRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")
    _session_overrides(session_id)[req.issue_id] = {
        "status": "Resolved",
        "current_owner_id": req.new_owner_id,
        "current_owner_name": req.new_owner_name,
    }
    issues = _load_issues(session_id)
    return {
        "dashboard": _build_dashboard(issues, session_id),
        "closure": _build_closure(issue, "reassign", req.new_owner_name),
    }


class VPEscalateRequest(BaseModel):
    issue_id: str


@router.post("/escalate")
def vp_escalate(req: VPEscalateRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")
    _session_overrides(session_id)[req.issue_id] = {"status": "Resolved", "ai_decision": "escalate"}
    issues = _load_issues(session_id)
    return {
        "dashboard": _build_dashboard(issues, session_id),
        "closure": _build_closure(issue, "escalate"),
    }


@router.get("/closure/{issue_id}")
def vp_closure(issue_id: str, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")
    action = issue.get("ai_decision") or "approve"
    return _build_closure(issue, action)


@router.get("/team-members")
def vp_team_members():
    return VP_TEAM_MEMBERS
```

---

### 2B. Register VP router in `backend/main.py`

Open `backend/main.py`. Find the routers import line:
```python
from routers import quality, integration, compliance, ai_chat, upload, pii, governance, integrity, rx_integrity, capa, products, commercial, tax, pricing, steward, cfo, cco
```
Add `vp` at the end:
```python
from routers import quality, integration, compliance, ai_chat, upload, pii, governance, integrity, rx_integrity, capa, products, commercial, tax, pricing, steward, cfo, cco, vp
```

Find the line `app.include_router(cco.router)` and add immediately after:
```python
app.include_router(vp.router)
```

---

## PART 3 — FRONTEND UTILITIES

### 3A. Create `frontend/src/services/vpSession.ts`

```typescript
/** In-memory only — a full page refresh gets a new id and resets the VP demo queue from DB. */
let vpDemoSessionId: string | null = null;

export function getVPDemoSessionId(): string {
  if (!vpDemoSessionId) {
    vpDemoSessionId = crypto.randomUUID();
  }
  return vpDemoSessionId;
}

export function vpDemoSessionHeaders(): Record<string, string> {
  return { "X-VP-Demo-Session": getVPDemoSessionId() };
}
```

---

### 3B. Create `frontend/src/utils/vpWorkflowStorage.ts`

Model exactly on `frontend/src/utils/cfoWorkflowStorage.ts`. Replace all `cfo` / `CFO` references with `vp` / `VP`. Key differences:

- `ACTIVE_ISSUE_KEY = "vp_active_issue_id"`
- `TOP8_ORDER_KEY = "vp_top8_order"`
- `REVIEW_CURSOR_KEY = "vp_review_cursor"`
- `RESOLVED_ISSUES_KEY = "vp_resolved_issue_ids"`
- Export constant: `VP_TOP_ALERTS_LIMIT = 8`
- Export `vpCtaPulseClass = "pricing-cta-blink ring-2 ring-amber-400 ring-offset-1"` (amber for VP to differentiate from CFO indigo)

Export all the same functions with VP prefix: `saveVPActiveIssue`, `loadVPActiveIssue`, `clearVPActiveIssue`, `resetVpReviewQueue`, `syncVpTop8Order`, `loadVpTop8Order`, `getVpReviewCursor`, `getVpPulseTargetIssueId`, `advanceVpReviewIfCurrent`, `isVpReviewQueueComplete`, `markVpIssueResolved`, `isVpIssueResolved`, `clearVpResolvedMarks`.

---

### 3C. Create `frontend/src/utils/vpClosureFormat.ts`

Model exactly on `frontend/src/utils/cfoClosureFormat.ts`. Rename all `CFO` / `cfo` to `VP` / `vp`. The `fmtVPCompact` function is identical to `fmtCFOCompact` — format dollar values compactly (e.g. `$3.8M`, `$28.4K`).

Add a VP-specific note builder:

```typescript
/** KPI keys where the Closure note should show dollar differences */
const VP_NOTE_KPI_KEYS = ["Issues Pending Resolution", "SLA Breach Risk", "Escalation Queue", "Team Resolution Rate"];

export function buildVPClosureNote(
  kpiImpact: Record<string, { before: number | string; after: number | string; label?: string; unit?: string }>
): string {
  const lines: string[] = [];
  for (const key of VP_NOTE_KPI_KEYS) {
    const row = kpiImpact[key];
    if (!row) continue;
    const before = Number(row.before);
    const after = Number(row.after);
    const diff = before - after;
    if (!Number.isFinite(diff) || diff === 0) continue;
    const unit = row.unit === "%" ? "%" : "";
    const label = row.label || key;
    if (diff > 0) {
      lines.push(`${label} reduced by ${diff}${unit} after this closure.`);
    } else {
      lines.push(`${label} improved by ${Math.abs(diff)}${unit} after this closure.`);
    }
  }
  return lines.join(" ");
}
```

---

### 3D. Create `frontend/src/utils/vpDashboard.ts`

```typescript
export type VPKpiKey = "issues_pending" | "sla_breach_risk" | "escalation_queue" | "team_resolution_rate";

export const VP_KPI_ORDER: VPKpiKey[] = [
  "issues_pending",
  "sla_breach_risk",
  "escalation_queue",
  "team_resolution_rate",
];

export interface VPKpiCardMeta {
  label: string;
  icon: string;
  toneClass: string;
  description: string;
}

export const VP_KPI_CARD_META: Record<VPKpiKey, VPKpiCardMeta> = {
  issues_pending: {
    label: "Issues Pending Resolution",
    icon: "📋",
    toneClass: "text-rose-700 dark:text-rose-300",
    description: "Total unresolved issues across all teams",
  },
  sla_breach_risk: {
    label: "SLA Breach Risk",
    icon: "⏱",
    toneClass: "text-amber-700 dark:text-amber-300",
    description: "Issues at risk of or already breaching deadline",
  },
  escalation_queue: {
    label: "Escalation Queue",
    icon: "🔺",
    toneClass: "text-indigo-700 dark:text-indigo-300",
    description: "Issues requiring CFO / CCO visibility",
  },
  team_resolution_rate: {
    label: "Team Resolution Rate",
    icon: "✅",
    toneClass: "text-emerald-700 dark:text-emerald-300",
    description: "Percentage of issues resolved on time",
  },
};

/** Priority sort order for VP (SLA urgency first, then priority, then exposure) */
export function vpAlertSortKey(alert: { sla_days_remaining: number; priority: string; dollar_exposure: number }) {
  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return [
    alert.sla_days_remaining,
    PRIORITY_ORDER[alert.priority?.toUpperCase()] ?? 3,
    -alert.dollar_exposure,
  ];
}

export function priorityClass(priority: string): string {
  switch (priority?.toUpperCase()) {
    case "CRITICAL": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "HIGH": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    default: return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  }
}

export function slaClass(days: number): string {
  if (days <= 0) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (days <= 2) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (days <= 5) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

export function healthClass(status: string): string {
  switch (status) {
    case "At Risk": return "text-red-600 dark:text-red-400";
    case "Breached": return "text-red-700 font-semibold dark:text-red-300";
    case "Watch": return "text-yellow-600 dark:text-yellow-400";
    default: return "text-emerald-600 dark:text-emerald-400";
  }
}

export function filterOpenVPDashboard(dashboard: VPDashboard): VPDashboard {
  return {
    ...dashboard,
    top_alerts: dashboard.top_alerts.filter((a) => a.status?.toLowerCase() === "open"),
    ai_queue: dashboard.ai_queue.filter((a) => a.status?.toLowerCase() === "open"),
    all_open_issues: dashboard.all_open_issues.filter((a) => a.status?.toLowerCase() === "open"),
  };
}

// Re-export type (defined in api.ts — import from there in actual files)
export type { VPDashboard } from "../services/api";
```

---

## PART 4 — TYPESCRIPT TYPES IN `frontend/src/services/api.ts`

Open `frontend/src/services/api.ts`. Find the CCO type definitions (search for `export interface CCOIssue`). Immediately before the CCO block, add the following VP types:

```typescript
// ── VP / Director types ──────────────────────────────────────────────────────

export interface VPAlert {
  issue_id: string;
  account_id: string;
  account_name: string;
  order_id: string;
  issue_type: string;
  team: string;
  priority: string;
  dollar_exposure: number;
  invoice_status: string;
  current_owner_id: string;
  current_owner_name: string;
  sla_days_remaining: number;
  sla_health: string;
  status: string;
  ai_fix_1?: string;
  ai_confidence_1?: number;
  ai_source_1?: string;
  ai_fix_2?: string;
  ai_confidence_2?: number;
  ai_source_2?: string;
  ai_decision?: string;
}

export interface VPKpiCard {
  value: number;
  label: string;
  description: string;
  unit?: string;
}

export interface VPTeamScorecardRow {
  team: string;
  open_issues: number;
  sla_breach_risk: number;
  resolution_rate: number;
  health_status: string;
  health_detail: string;
}

export interface VPDashboard {
  headline: {
    total_open_issues: number;
    sla_breach_risk: number;
    escalation_queue: number;
    team_resolution_rate: number;
  };
  kpi_cards: Record<string, VPKpiCard>;
  team_scorecard: VPTeamScorecardRow[];
  top_alerts: VPAlert[];
  ai_queue: VPAlert[];
  all_open_issues: VPAlert[];
}

export interface VPOwnerBlock {
  owner_id: string;
  owner_name?: string;
  team?: string;
  next_action?: string;
  sla_health?: string;
  live_progress?: string;
  completion_pct?: number;
}

export interface VPBusinessRisk {
  risk_type: string;
  value?: number | null;
  text_value?: string;
  vp_context: string;
}

export interface VPIssueDetail {
  issue_id: string;
  header: {
    issue_type: string;
    account: string;
    account_id: string;
    account_name: string;
    order_id: string;
    priority: string;
    dollar_exposure: number;
    opened_on: string;
    resolution_status: string;
    sla_health: string;
    sla_days_remaining: number;
  };
  what_happened: string;
  business_risk: VPBusinessRisk[];
  owners: VPOwnerBlock[];
  resolution_progress: Array<{
    task: string;
    what_done: string;
    completion_pct: number;
    vp_risk_signal: string;
  }>;
  ai_recommendations: Array<{
    fix: string;
    fix_type: string;
    confidence: number;
    source: string;
  }>;
  ai_decision?: string;
  collapsed: {
    why_it_happened: Array<{ error_type: string; root_cause: string }>;
    owner_escalation: Array<{
      owner: string;
      name?: string;
      assigned_on?: string;
      sla_remaining: string;
      escalation_path: string;
      status: string;
    }>;
    capa_linkage: Array<{
      capa_id: string;
      area: string;
      status: string;
      owner: string;
      due_date: string;
    }>;
  };
  team: string;
  recurrence: {
    issue_type: string;
    count: number;
    period: string;
    capa_exists: string;
    capa_ids: string[];
    vp_action_signal: string;
  };
}

export interface VPClosure {
  issue_id: string;
  resolution_confirmation: {
    issue: string;
    resolved_by: string;
    date: string;
    resolution_type: string;
    exposure_recovered: number;
  };
  sla_performance: Array<{
    owner: string;
    owner_name: string;
    resolved_at: string;
    sla_limit: string;
    sla_outcome: string;
    vp_accountability_note: string;
  }>;
  recurring_pattern: {
    issue_type: string;
    recurrence_count: number;
    period: string;
    team: string;
    capa_exists: string;
    capa_ids: string[];
    vp_action_signal: string;
  };
  what_was_updated: string[];
  ai_action_log: Array<{
    fix: string;
    approved_by: string;
    confidence: number;
    logged_on: string;
  }>;
  kpi_impact: Record<string, { before: number | string; after: number | string; label?: string; unit?: string }>;
  cross_team_notifications: Array<{ team: string; notification: string }>;
  action_taken: string;
}
```

Then find the `api` object (the exported object with all the API methods). Add the VP API methods after the CCO methods — match the exact fetch pattern:

```typescript
// ── VP fetch helper (mirrors cfoFetch) ────────────────────────────────────
function vpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...vpDemoSessionHeaders(),
      ...(init?.headers ?? {}),
    },
  });
}
```

Add `vpDemoSessionHeaders` import from `./vpSession` at the top of `api.ts` alongside the other session imports (`cfoSession`, `ccoSession`, etc.). Check how the existing session imports are structured and follow the same pattern exactly.

Then add to the `api` object:

```typescript
  getVPDashboard: () => vpFetch<VPDashboard>("/api/vp/dashboard"),
  getVPIssueDetail: (issueId: string) => vpFetch<VPIssueDetail>(`/api/vp/issue/${issueId}`),
  vpAiAction: (issueId: string, action: "approve" | "reject") =>
    vpFetch<{ ok: boolean; issue_id: string; dashboard: VPDashboard }>("/api/vp/ai-action", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, action }),
    }),
  vpApprove: (issueId: string) =>
    vpFetch<{ dashboard: VPDashboard; closure: VPClosure }>("/api/vp/approve", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
    }),
  vpReassign: (issueId: string, newOwnerId: string, newOwnerName: string) =>
    vpFetch<{ dashboard: VPDashboard; closure: VPClosure }>("/api/vp/reassign", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, new_owner_id: newOwnerId, new_owner_name: newOwnerName }),
    }),
  vpEscalate: (issueId: string) =>
    vpFetch<{ dashboard: VPDashboard; closure: VPClosure }>("/api/vp/escalate", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
    }),
  getVPClosure: (issueId: string) => vpFetch<VPClosure>(`/api/vp/closure/${issueId}`),
  getVPTeamMembers: () => vpFetch<Array<{ id: string; name: string; team: string }>>("/api/vp/team-members"),
```

---

## PART 5 — WORKFLOW CONTEXT

### 5A. Create `frontend/src/context/VPWorkflowContext.tsx`

Model exactly on `frontend/src/context/CFOWorkflowContext.tsx`. Replace all `CFO`/`cfo` with `VP`/`vp`. Key differences:

```typescript
type VPWorkflowContextValue = {
  dashboard: VPDashboard | null;
  loading: boolean;
  error: string | null;
  vpBannerStats: string | null;
  dashboardRevision: number;
  refreshDashboard: () => Promise<void>;
  applyAiAction: (issueId: string, action: "approve" | "reject") => Promise<void>;
  aiActionPendingId: string | null;
  approveIssue: (issueId: string) => Promise<VPClosure>;
  reassignIssue: (issueId: string, ownerId: string, ownerName: string) => Promise<VPClosure>;
  escalateIssue: (issueId: string) => Promise<VPClosure>;
  activeIssueId: string | null;
  setActiveIssueId: (id: string | null) => void;
};
```

The `vpBannerStats` string should be:
```typescript
`${effective_open} open issues · ${sla_breach} SLA at risk · ${esc_queue} escalation queue · ${resolution_rate}% resolution rate`
```
where values come from `dashboard.headline`.

The `escalateIssue` action calls `api.vpEscalate(issueId)` — same pattern as `approveIssue` (marks resolved, updates dashboard, returns closure).

Wrap with `VPWorkflowProvider` and export `useVPWorkflow` and `useVPWorkflowOptional` hooks.

---

## PART 6 — ROLE SYSTEM UPDATE

### 6A. Update `frontend/src/context/RoleContext.tsx`

**Step 1 — Add `vp_director` to the `RoleId` type:**
```typescript
export type RoleId = "admin" | "pricing_analyst" | "tax_compliance" | "data_steward" | "cfo" | "cco" | "vp_director";
```

**Step 2 — Add to `VIEWING_AS_ROLE_IDS`:**
```typescript
export const VIEWING_AS_ROLE_IDS: RoleId[] = [
  "admin",
  "cfo",
  "cco",
  "vp_director",
  "pricing_analyst",
  "tax_compliance",
  "data_steward",
];
```

**Step 3 — Add to `ROLES` array** (insert after the `cco` entry, before `pricing_analyst`):
```typescript
{
  id: "vp_director",
  label: "VP / Director — Operations",
  shortLabel: "VP / Dir",
  personaName: "VP / Director",
  badgeColor: "bg-amber-600",
  badgeTextColor: "text-white",
  defaultRoute: "/vp-dashboard",
  contextBannerByRoute: {
    "/vp-dashboard": "",
    "/vp/issue/:issueId": "VP / Director View — Issue Detail & Intervention · Review owner progress · Nudge, Reassign, or Escalate",
    "/vp/closure/:issueId": "VP / Director View — Closure & Team Accountability · SLA record · Recurring pattern flag",
  },
},
```

---

## PART 7 — WORKFLOW CONTEXT WIRING IN `App.tsx`

### 7A. Update `frontend/src/App.tsx`

**Add lazy import:**
```typescript
const VPDashboard = lazy(() => import("./pages/vp/VPDashboard"));
const VPIssueDetail = lazy(() => import("./pages/vp/VPIssueDetail"));
const VPClosure = lazy(() => import("./pages/vp/VPClosure"));
```

**Add provider import:**
```typescript
import { VPWorkflowProvider } from "./context/VPWorkflowContext";
```

**Wrap inside providers** (inside `StewardWorkflowProvider`, following the exact nesting pattern):
```tsx
<VPWorkflowProvider>
  {/* existing children */}
</VPWorkflowProvider>
```

**Add routes** (after the CCO routes):
```tsx
<Route path="/vp-dashboard" element={<VPDashboard />} />
<Route path="/vp/issue/:issueId" element={<VPIssueDetail />} />
<Route path="/vp/closure/:issueId" element={<VPClosure />} />
```

---

## PART 8 — FRONTEND PAGES

### 8A. Create `frontend/src/pages/vp/VPDashboard.tsx`

**Model on:** `frontend/src/pages/cfo/CFODashboard.tsx`

**Structural differences from CFO:**

1. **NO charts** — remove both the `CFOResolutionTrendChart` and `CFORiskHeatmapVisual` side-by-side panel. The VP dashboard has no chart row.

2. **Page title:** `"Operations Dashboard"` (not "Operational Command Dashboard" or "C-Suite Financial Dashboard")

3. **Headline stat:** Baseline from `vpDemoBaseline.ts` / backend constants:
   ```
   47 open issues · 9 SLA breach risks · 4 in priority queue · 71% team resolution rate
   ```
   Subtitle: `Top 8 alerts by SLA urgency`. Include **Reset demo data** button (calls `resetDemo()` → `POST /api/vp/reset-demo`).

4. **KPI Cards:** 4 cards using `VP_KPI_ORDER` and `VP_KPI_CARD_META` from `vpDashboard.ts`. Clicking a KPI card opens a **modal** showing the filtered issues contributing to that metric (same pattern as CFO). Use `kpi_cards` from the dashboard response.

5. **Team Performance Scorecard** — NEW table unique to VP. Render below the KPI cards:

   ```
   Heading: "Team Performance Scorecard"
   Subheading: "One row per function — who is on track, at risk, contributing to SLA breach count"
   ```
   
   Table columns: `Team | Open Issues | SLA Breach Risk | Resolution Rate | Health Status`
   
   Data source: `dashboard.team_scorecard` — the array of `VPTeamScorecardRow` returned from backend.
   
   Row style: Color-code the `Health Status` cell using `healthClass(row.health_status)` from `vpDashboard.ts`. Show the `health_detail` as a smaller subtitle inside the Health Status cell.

6. **Top Alerts table** — sorted by SLA urgency (1 day to breach at top). Max **8 rows** at baseline (VP-ISS-001 through VP-ISS-008). Columns include Issue ID, Account, Issue Type, Priority, Exposure, Invoice, Owner, SLA Status, and **View Issue** button.
   - First row in queue: blinking **View Issue →** CTA on the next issue to review (`getVpPulseTargetIssueId`)
   - **Approve flow:** approved issues vanish from Top Alerts for the session; KPI counts decrement
   - `SLA Status` cell: use `slaClass(alert.sla_days_remaining)` pill. VP-ISS-003 (Central Hospital) shows **Breached**
   - VP-ISS-004 (Valley Health) owner shows **Unassigned**

7. **AI Recommendation Queue** — **3 items at baseline** (VP-ISS-001, VP-ISS-002, VP-ISS-003). Approve / Reassign actions.
   - Approve: calls `approveIssue(issue_id)` → navigates to `/vp/closure/:issueId` → Return to Dashboard removes issue from Top Alerts and AI queue
   - Reassign: opens reassign modal → on confirm → navigates to closure

8. **KPI modal** (for clicking a KPI card): show filtered `all_open_issues` for that KPI key. Use the same `X` close button style as CFO.

---

### 8B. Create `frontend/src/pages/vp/VPIssueDetail.tsx`

**Model on:** `frontend/src/pages/cco/CCOIssueDetail.tsx`

**Key sections to render (in order):**

1. **Back button** → `/vp-dashboard`

2. **Issue Header** — table row:
   `Issue Type | Account & Order | Priority | $ Exposure | Opened On | Resolution Status`
   Priority badge uses `priorityClass`. Resolution Status shows SLA countdown in amber/red.

3. **What Happened** — plain-text paragraph from `detail.what_happened`. Style as a rounded card with a left amber border.

4. **Business Risk & Impact** — table:
   `Risk Type | Dollar Value / Status | VP Context`
   Money cells formatted with `$` comma-separated. "SLA Breach Risk" row shows `text_value` instead of a dollar amount.

5. **Owner & SLA Status** — table, one row per owner in `detail.owners`:
   `Owner ID | Name | Team | Next Action & SLA | SLA Health | Live Progress`
   SLA Health cell: color-coded using `slaClass`. Live Progress is plain text.

6. **Resolution Progress** — table, one row per item in `detail.resolution_progress`:
   `Task | What Has Been Done | Completion | VP Risk Signal`
   Completion shown as a percentage bar (e.g. `50%` with a thin progress bar). VP Risk Signal color-coded (red if "At risk", green if "On track").

7. **AI Recommendation** — if `detail.ai_decision` is already set, show the badge only (`✓ Approved` or `✗ Rejected`). If no decision, show the recommendation table:
   `Recommended Fix | Fix Type | Confidence | Data Source | Action`
   Action buttons: `Approve` (calls `vpApprove` → navigates to closure) / `Reassign` (opens reassign modal).

8. **Sticky footer — 3 action buttons:**
   ```
   [Nudge Owner]  [Reassign]  [Escalate to C-Suite]
   ```
   
   - **Nudge Owner:** On click → set local state `nudgeSent: true` immediately (optimistic). Show a confirmation badge inline below the footer: `"✓ Nudge Sent — Owner notified and reminded of SLA"`. Do NOT navigate. Do NOT call any API endpoint (demo only).
   - **Reassign:** Opens `VPReassignModal`. On confirm → calls `useVPWorkflow().reassignIssue(issueId, ownerId, ownerName)` → on success navigates to `/vp/closure/:issueId`.
   - **Escalate to C-Suite:** Calls `useVPWorkflow().escalateIssue(issueId)` → on success navigates to `/vp/closure/:issueId`.
   
   Button styles: Nudge = amber outline, Reassign = slate outline, Escalate = red filled. All three always visible regardless of AI decision state.

9. **Collapsed accordion sections** (same AccordionSection component pattern as CCO):
   - `▶ Why It Happened` → renders `detail.collapsed.why_it_happened` as a table: `Error Type | Root Cause`
   - `▶ Owner & Escalation` → renders `detail.collapsed.owner_escalation` as a table: `Owner | Name | Assigned On | SLA Remaining | Escalation Path | Status`
   - `▶ CAPA Linkage` → renders `detail.collapsed.capa_linkage` as a table: `CAPA ID | Area | Status | Owner | Due Date`

---

### 8C. Create `frontend/src/pages/vp/VPClosure.tsx`

**Model on:** `frontend/src/pages/cfo/CFOClosure.tsx`

**Key sections to render (in order):**

1. **Page title:** `"Closure & Team Accountability"` with subtitle showing the action taken (e.g. "Nudge sent · SLA record captured", "Escalated to C-Suite", "Reassigned to [name]").

2. **Resolution Confirmation** — card with green left border:
   `Issue | Resolved By | Date | Resolution Type | Exposure Recovered`
   Exposure Recovered shown as `$X,XXX recovered` in bold green.

3. **SLA Performance Record** — table, one row per owner:
   `Owner | Resolved At | SLA Limit | SLA Outcome | VP Accountability Note`
   SLA Outcome: green "On Time" or red "Breached" badge.
   > This section header includes the note: *"Unique to VP / Director flow — not shown to CFO or CCO"* as a small italic subtitle.

4. **Recurring Pattern Flag** — table (one row per issue type in `recurring_pattern`):
   `Issue Type | Recurrence | Team | CAPA Exists? | VP Action Signal`
   If `recurrence_count > 1`, highlight the row with a subtle amber background.
   > Section header subtitle: *"Unique to VP / Director flow — systemic pattern detection"*

5. **What Was Updated** — bulleted list from `closure.what_was_updated`.

6. **AI Action Log** — only show if `closure.ai_action_log.length > 0`. Table:
   `Recommended Fix | Approved By | Confidence | Logged On`

7. **Impact on Dashboard** — table using `closure.kpi_impact`:
   `KPI | Before → After`
   Show directional arrow (↓ for reduction, ↑ for improvement) color-coded.
   Below table, render the closure note from `buildVPClosureNote(closure.kpi_impact)`.

8. **Cross-Team Notifications** — table:
   `Team / Persona | What They Were Notified About`

9. **Back to Operational Dashboard button** — calls `refreshDashboard()` then navigates to `/vp-dashboard`. Style: full-width amber filled button at the bottom.

---

### 8D. Create `frontend/src/components/vp/VPReassignModal.tsx`

Model exactly on `frontend/src/components/cfo/CFOReassignModal.tsx` (or CCO equivalent). Replace all CFO references with VP. Data source: `useVPWorkflow()` context. Team members list: fetched from `/api/vp/team-members` on mount (or passed as prop from parent). Same modal UX: overlay, dropdown of team members, Confirm / Cancel buttons.

---

### 8E. Create `frontend/src/config/vpTeamOwners.ts`

```typescript
export interface VPTeamOwner {
  id: string;
  name: string;
  team: string;
}

export const VP_TEAM_MEMBERS: VPTeamOwner[] = [
  { id: "TAX-03", name: "Jennifer Mills", team: "Tax Team" },
  { id: "TAX-04", name: "Emily Carter", team: "Tax Team" },
  { id: "TAX-05", name: "Robert Chan", team: "Tax Team" },
  { id: "PRICE-04", name: "David Chen", team: "Pricing Team" },
  { id: "PRICE-05", name: "Sarah Park", team: "Pricing Team" },
  { id: "FIN-01", name: "Priya Nair", team: "Finance Team" },
  { id: "FIN-02", name: "Marcus Webb", team: "Finance Team" },
  { id: "FIN-03", name: "Rachel Kim", team: "Finance Team" },
  { id: "CCO-01", name: "Sandra Lee", team: "Compliance Team" },
  { id: "CCO-02", name: "James Torres", team: "Compliance Team" },
];
```

---

## PART 9 — DOCKER / SEED

### 9A. Rebuild and re-seed

After all files are created and saved, run:

```bash
docker compose down
docker compose up --build -d
```

Then verify the seed ran:
```bash
docker compose exec backend python data/seed_data.py
```

Check the VP router is reachable:
```bash
curl http://localhost:18005/api/vp/dashboard
```

Expected: JSON with `headline`, `kpi_cards`, `team_scorecard`, `top_alerts`, `ai_queue`.

---

## PART 10 — VALIDATION CHECKLIST

After implementation, verify the following manually in the browser:

### Step 1 — VP Dashboard (`/vp-dashboard`)
- [ ] "Viewing as" dropdown shows "VP / Director — Operations"
- [ ] Selecting VP / Director navigates to `/vp-dashboard`
- [ ] Headline shows: **47 open issues · 9 SLA breach risks · 4 in priority queue · 71% team resolution rate**
- [ ] Operations View banner shows live KPI stats on dashboard
- [ ] **Reset demo data** button restores baseline after a demo walk-through
- [ ] 4 KPI cards: Issues Pending (47 open), SLA Breach Risk (9), Priority Queue (4), Team Resolution Rate (71%)
- [ ] Team Performance Scorecard: 4 rows (Tax, Pricing, Compliance, Finance)
- [ ] Top Alerts: 8 rows, VP-ISS-001 (Northeast Medical) at top with blinking **View Issue →**
- [ ] VP-ISS-003 Central Hospital — Breached SLA badge; VP-ISS-004 Valley Health — Unassigned owner
- [ ] AI Recommendation Queue: ORD-031 (Northeast Medical), ORD-029 (Alliance Health), ORD-032 (Valley Health)
- [ ] Approve flow: issue vanishes from Top Alerts + AI queue; KPIs decrement; returns after Closure

### Step 2 — Issue Detail (`/vp/issue/VP-ISS-001`)
- [ ] Issue Header: CRITICAL, $28,400, 1 day to SLA breach
- [ ] Owners: TAX-03 Jennifer Mills + PRICE-04 **David Morrison** (cross-team)
- [ ] Resolution Progress: Tax at 50%, Pricing at 30% with progress bars
- [ ] AI Recommendation: two rows with Approve / Reassign per row
- [ ] Sticky footer: 3 buttons — Nudge Owner (amber), Reassign (slate), Escalate to C-Suite (red)
- [ ] Click "Nudge Owner" → confirmation badge appears inline, buttons remain, NO navigation
- [ ] Click "Reassign" → modal opens with team member dropdown
- [ ] Click "Escalate to C-Suite" → navigates to `/vp/closure/VP-ISS-001`
- [ ] Collapsed sections expand: Why It Happened, Owner & Escalation, CAPA Linkage
- [ ] CAPA Linkage shows CAPA-007 and CAPA-012

### Step 3 — Closure (`/vp/closure/VP-ISS-001`)
- [ ] Page title: "Closure & Team Accountability"
- [ ] Resolution Confirmation card: issue, resolved by, date, resolution type, exposure recovered in green
- [ ] SLA Performance Record table: TAX-03 and PRICE-04 rows, sla_outcome badge
- [ ] Recurring Pattern Flag table: Tax Jurisdiction Mismatch (3 times) + GPO Pricing Override (2 times)
- [ ] Recurrence rows with count > 1 have amber background highlight
- [ ] What Was Updated: bullet list
- [ ] AI Action Log: shows if action was "approve" or "escalate"
- [ ] Impact on Dashboard table: 4 KPI rows with Before → After values
- [ ] Cross-Team Notifications: Tax Team, Pricing Team, CFO, CCO rows
- [ ] "Back to Operational Dashboard" amber button → navigates to `/vp-dashboard` with refreshed KPIs

---

## KNOWN PATTERNS — DO NOT DEVIATE

The following patterns are established in the existing codebase. Match them exactly:

1. **Session header pattern:** Every VP API call uses `vpFetch()` with `X-VP-Demo-Session`. Backend scopes approve/reassign/escalate in `_session_issue_overrides`. Frontend mirrors with `vpWorkflowStorage` session marks. **`POST /api/vp/reset-demo`** reloads CSV seed and clears all overrides; **`resetDemo()`** in `VPWorkflowContext` clears browser marks. Baseline headline: 47 / 9 / 4 / 71%.

2. **Optimistic UI:** The Nudge Owner button uses local React state only — no API call. The `markVpIssueResolved` in workflow storage is called only after a successful API mutation (approve/reassign/escalate) — not on nudge.

3. **Reject stays in queue:** In the AI Recommendation Queue, Reject sets `ai_decision: "reject"` via `applyAiAction` but does NOT mark the issue resolved. The issue stays in the queue with a `✗ Rejected` badge. Only Approve removes it.

4. **Dashboard revision:** `dashboardRevision` counter increments on every dashboard mutation. The `key={dashboardRevision}` prop on the outermost dashboard `div` forces React to remount charts/tables when data changes. Apply the same pattern on `VPDashboard`.

5. **Collapsed accordion sections:** Use the same `AccordionSection` component pattern as `CCOIssueDetail.tsx` — local `openSections` state, toggle on click, `▼` / `▶` prefix in the title button.

6. **Sticky footer:** The 3-button footer in `VPIssueDetail` must use `position: sticky; bottom: 0` with a white/dark background and top border, always visible while scrolling. Look at how `CFOIssueDetail.tsx` implements its sticky Approve/Reassign footer and replicate.

7. **TypeScript strict:** Do not use `any`. All API response shapes must match the declared interfaces. Use optional chaining for nullable fields.

8. **Dark mode:** Every Tailwind class must have a `dark:` variant where color is applied. Look at existing CFO/CCO pages for the exact dark mode patterns.

---

## FILE CREATION SUMMARY

When complete, the following new files must exist:

```
backend/data/csv/vp_alerts.csv                          ← NEW
backend/routers/vp.py                                   ← NEW
frontend/src/services/vpSession.ts                      ← NEW
frontend/src/utils/vpWorkflowStorage.ts                 ← NEW
frontend/src/utils/vpClosureFormat.ts                   ← NEW
frontend/src/utils/vpDashboard.ts                       ← NEW
frontend/src/context/VPWorkflowContext.tsx              ← NEW
frontend/src/config/vpTeamOwners.ts                     ← NEW
frontend/src/components/vp/VPReassignModal.tsx          ← NEW
frontend/src/pages/vp/VPDashboard.tsx                   ← NEW
frontend/src/pages/vp/VPIssueDetail.tsx                 ← NEW
frontend/src/pages/vp/VPClosure.tsx                     ← NEW
```

Modified files:
```
backend/data/seed_data.py                               ← ADD VP block
backend/main.py                                         ← ADD vp router import + include
frontend/src/services/api.ts                            ← ADD VP types + vpFetch + api methods
frontend/src/context/RoleContext.tsx                    ← ADD vp_director role
frontend/src/App.tsx                                    ← ADD lazy imports + VPWorkflowProvider + routes
```

Do not modify any other file. Do not touch CFO, CCO, Tax, Pricing, or Steward persona files.
