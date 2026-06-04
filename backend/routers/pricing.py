import datetime
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"
_session_issue_overrides: dict[str, dict[str, dict]] = {}

LOGGED_IN_PRICING_OWNER = {"owner_id": "REP-03", "owner_name": "Jennifer Mills"}
PRICING_TEAM_OWNERS = [
    {"owner_id": "REP-05", "owner_name": "Marcus Johnson"},
    {"owner_id": "REP-03", "owner_name": "Jennifer Mills"},
    {"owner_id": "REP-04", "owner_name": "Daniel Ortiz"},
]


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_pricing_demo_session(
    x_pricing_demo_session: str | None = Header(default=None, alias="X-Pricing-Demo-Session"),
) -> str:
    return x_pricing_demo_session or "default"


def _session_overrides(session_id: str) -> dict[str, dict]:
    return _session_issue_overrides.setdefault(session_id, {})


def _next_pricing_owner(current_owner_id: str) -> dict:
    ids = [o["owner_id"] for o in PRICING_TEAM_OWNERS]
    try:
        idx = ids.index(current_owner_id)
    except ValueError:
        idx = -1
    return PRICING_TEAM_OWNERS[(idx + 1) % len(PRICING_TEAM_OWNERS)]


OWNER_FALLBACK_BY_ISSUE: dict[str, dict] = {
    "PRK-ISS-002": {"owner_id": "REP-03", "owner_name": "Jennifer Mills"},
    "PRK-ISS-003": {"owner_id": "REP-04", "owner_name": "Daniel Ortiz"},
    "PRK-ISS-006": {"owner_id": "REP-04", "owner_name": "Daniel Ortiz"},
    "PRK-ISS-007": {"owner_id": "REP-03", "owner_name": "Jennifer Mills"},
    "PRK-ISS-012": {"owner_id": "REP-04", "owner_name": "Daniel Ortiz"},
}


def _normalize_owner(issue: dict) -> dict:
    owner_id = str(issue.get("owner_id") or "").strip()
    if owner_id.lower() not in ("", "unassigned"):
        return issue
    fallback = OWNER_FALLBACK_BY_ISSUE.get(issue["issue_id"])
    if not fallback:
        idx = sum(ord(c) for c in issue["issue_id"]) % len(PRICING_TEAM_OWNERS)
        fallback = PRICING_TEAM_OWNERS[idx]
    return {**issue, **fallback}


def _merge_issue(issue: dict, session_id: str) -> dict:
    merged = _normalize_owner(dict(issue))
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


SUGGESTED_OWNER_BY_PERSONA: dict[str, str] = {
    "Tax & Compliance": "Jennifer Mills",
    "Credit & AR": "Michael Carter",
    "Market Access": "Emma Collins",
    "SAP Team": "Oliver Bennett",
}


def _owner_name_for_persona(persona: str, fallback: str) -> str:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT primary_owner_name
            FROM alerts_queue
            WHERE primary_persona = ?
              AND primary_owner_name IS NOT NULL
              AND TRIM(primary_owner_name) <> ''
            ORDER BY alert_id ASC
            LIMIT 1
            """,
            (persona,),
        ).fetchone()
    if not row:
        return fallback
    raw = str(row["primary_owner_name"] or "").strip()
    if (
        raw == ""
        or raw.lower().endswith("team")
        or raw.upper().startswith("REP-")
    ):
        return fallback
    return raw


def _gpo_mapping_accuracy_pct(conflict_count: int) -> int:
    return max(0, min(100, 94 - int(conflict_count)))


def _contract_data_completeness_pct(expiring_count: int) -> float:
    # Seed has 2 open expiring contracts at 96.8%.
    return round(max(70.0, min(100.0, 100 - expiring_count * 1.6)), 1)


def _compute_pricing_metrics(open_issues: list[dict]) -> dict:
    conflicts = [i for i in open_issues if i.get("issue_type") in ("GPO Pricing Conflict", "No GPO Membership", "GPO Chargeback Dispute")]
    expiring = [i for i in open_issues if i.get("issue_type") == "Contract Expiring"]
    recalled = [i for i in open_issues if i.get("issue_type") == "Product Recalled"]
    conflict_count = len(conflicts)
    expiring_count = len(expiring)
    recalled_count = len(recalled)
    total_exposure = round(
        sum(float(i.get("dollar_value", 0)) for i in conflicts)
        + sum(float(i.get("dollar_value", 0)) for i in expiring)
        + sum(float(i.get("dollar_value", 0)) for i in recalled),
        2,
    )
    annualized_exposure = round(total_exposure * 12, 2)
    contract_completeness = _contract_data_completeness_pct(expiring_count)
    return {
        "gpo_conflicts": conflict_count,
        "expiring_contracts": expiring_count,
        "product_recalls": recalled_count,
        "expiring_contracts_combined": expiring_count + recalled_count,
        "total_exposure": total_exposure,
        "annualized_exposure": annualized_exposure,
        "gpo_mapping_accuracy": _gpo_mapping_accuracy_pct(conflict_count),
        "contract_data_completeness": contract_completeness,
    }


def _kpi_impact_snapshot(metrics_before: dict, metrics_after: dict, issue: dict) -> dict:
    """Dashboard KPI cards for Impact on Dashboard."""
    _ = issue
    return {
        "gpo_conflicts": {
            "before": metrics_before["gpo_conflicts"],
            "after": metrics_after["gpo_conflicts"],
        },
        "expiring_contracts_kpi": {
            "before": metrics_before["expiring_contracts"],
            "after": metrics_after["expiring_contracts"],
        },
        "product_recalls": {
            "before": metrics_before["product_recalls"],
            "after": metrics_after["product_recalls"],
        },
        "total_exposure": {
            "before": metrics_before["total_exposure"],
            "after": metrics_after["total_exposure"],
        },
        "annualized_exposure": {
            "before": metrics_before["annualized_exposure"],
            "after": metrics_after["annualized_exposure"],
        },
    }


def _build_closure_payload(issue: dict, metrics_before: dict, metrics_after: dict) -> dict:
    today = datetime.date.today().isoformat()
    overcharge = float(issue.get("overcharge_per_unit", 0)) * int(issue.get("quantity_affected", 0) or 0)
    credit_memo_amount = overcharge if overcharge > 0 else float(issue.get("dollar_value", 0))
    update_target = issue.get("order_id") or issue.get("contract_id", "N/A")
    credit_memo_label = f"${credit_memo_amount:,.2f}"
    tax_owner = _owner_name_for_persona("Tax & Compliance", SUGGESTED_OWNER_BY_PERSONA["Tax & Compliance"])
    credit_owner = _owner_name_for_persona("Credit & AR", SUGGESTED_OWNER_BY_PERSONA["Credit & AR"])
    market_access_owner = _owner_name_for_persona("Market Access", SUGGESTED_OWNER_BY_PERSONA["Market Access"])
    sap_owner = _owner_name_for_persona("SAP Team", SUGGESTED_OWNER_BY_PERSONA["SAP Team"])

    return {
        "resolution_confirmation": {
            "issue": f"{issue['issue_type']} — {issue.get('order_id', issue['contract_id'])}",
            "resolved_by": issue.get("owner_id", LOGGED_IN_PRICING_OWNER["owner_id"]),
            "resolved_by_name": issue.get("owner_name", LOGGED_IN_PRICING_OWNER["owner_name"]),
            "date": issue.get("resolved_at", today),
            "resolution_type": (
                f"Credit Memo of {credit_memo_label} has to be Issued + "
                f"Request for SAP Pricing Master data to be Updated"
            ),
            "exposure_recovered": float(issue.get("dollar_value", 0)),
        },
        "what_was_updated": [
            "Request for SAP Pricing Master data to be updated",
            f"Credit memo for {credit_memo_label} has to be issued for {update_target}",
            f"{issue['capa_id']} updated",
            "Alert closed and removed from queue once the SAP Data is updated",
        ],
        "ai_action_log": {
            "recommendation": issue["ai_fix"],
            "approved_by": issue.get("owner_id", LOGGED_IN_PRICING_OWNER["owner_id"]),
            "confidence": issue["ai_confidence"],
            "logged_on": today,
        },
        "kpi_impact": _kpi_impact_snapshot(metrics_before, metrics_after, issue),
        "cross_team_notifications": [
            {
                "team": "Tax & Compliance",
                "owner": tax_owner,
                "notification": f"Order {issue.get('order_id', 'N/A')} tax jurisdiction recheck recommended after pricing correction",
            },
            {
                "team": "Credit & AR",
                "owner": credit_owner,
                "notification": (
                    f"Credit memo {credit_memo_label} has to be issued — "
                    f"then the payment hold can be released"
                ),
            },
            {
                "team": "Market Access",
                "owner": market_access_owner,
                "notification": f"GPO membership verification completed for {issue['customer_id']}",
            },
            {
                "team": "SAP Team",
                "owner": sap_owner,
                "notification": "Request for SAP Pricing Master data to be updated",
            },
        ],
        "issue_id": issue["issue_id"],
        "ai_decision": issue.get("ai_decision"),
    }


def _can_mark_resolved(issue: dict) -> bool:
    if issue.get("status") == "Resolved":
        return False
    if issue.get("issue_type") == "Contract Expiring":
        # Renewal issues do not require AI approval or credit-memo queueing.
        return True
    if issue.get("ai_decision") == "approve":
        return True
    return bool(issue.get("credit_memo_queued_at"))


def _workflow_status(issue: dict) -> dict:
    ai_approved = issue.get("ai_decision") == "approve"
    credit_memo_queued = bool(issue.get("credit_memo_queued_at"))
    if ai_approved:
        path = "ai"
    elif credit_memo_queued:
        path = "manual_complete"
    else:
        path = "manual_in_progress"
    return {
        "ai_approved": ai_approved,
        "credit_memo_queued": credit_memo_queued,
        "can_mark_resolved": _can_mark_resolved(issue),
        "resolution_path": path,
    }


def _ai_eligible_for_queue(issue: dict) -> bool:
    return float(issue.get("ai_confidence", 0)) >= 89 and issue.get("ai_decision") != "approve"


def _is_no_gpo_membership(issue: dict) -> bool:
    return str(issue.get("issue_type") or "").strip().lower() == "no gpo membership"


def _build_dashboard_payload(session_id: str) -> dict:
    issues = _load_issues(session_id)
    # Keep "No GPO Membership" out of dashboard views and aggregates.
    open_issues = [
        i
        for i in issues
        if i.get("status") == "Open" and not _is_no_gpo_membership(i)
    ]
    metrics = _compute_pricing_metrics(open_issues)
    mapping_score = metrics["gpo_mapping_accuracy"]
    contract_score = metrics["contract_data_completeness"]
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

    def _priority_sort_key(issue: dict) -> tuple:
        return (priority_order.get(issue.get("priority", "LOW"), 9), -float(issue.get("dollar_value", 0)))

    portfolio_sorted = sorted(open_issues, key=_priority_sort_key)
    my_queue = [i for i in open_issues if i.get("owner_id") == LOGGED_IN_PRICING_OWNER["owner_id"]]
    my_sorted = sorted(my_queue, key=_priority_sort_key)

    # Top Alerts: AI-eligible rows first, then other high-priority issues (5–8 records).
    top_alerts: list[dict] = []
    seen: set[str] = set()
    for issue in portfolio_sorted:
        if not _ai_eligible_for_queue(issue):
            continue
        top_alerts.append(issue)
        seen.add(issue["issue_id"])
        if len(top_alerts) >= 8:
            break
    for issue in portfolio_sorted:
        if len(top_alerts) >= 8:
            break
        if issue["issue_id"] in seen:
            continue
        top_alerts.append(issue)
        seen.add(issue["issue_id"])
    target_count = min(8, max(5, len(portfolio_sorted)))
    while len(top_alerts) < target_count:
        added = False
        for issue in portfolio_sorted:
            if issue["issue_id"] in seen:
                continue
            top_alerts.append(issue)
            seen.add(issue["issue_id"])
            added = True
            break
        if not added:
            break

    ai_queue = [
        i
        for i in top_alerts
        if i.get("owner_id") == LOGGED_IN_PRICING_OWNER["owner_id"] and _ai_eligible_for_queue(i)
    ]
    my_action_queue = my_sorted[:8]

    return {
        "headline": {
            "total_exposure": metrics["total_exposure"],
            "active_conflicts": metrics["gpo_conflicts"],
            "expiring_contracts": metrics["expiring_contracts_combined"],
        },
        "data_quality_health": [
            {
                "metric": "GPO Mapping Accuracy",
                "score": mapping_score,
                "status": "At Risk" if mapping_score < 90 else "Healthy",
            },
            {
                "metric": "Contract Data Completeness",
                "score": contract_score,
                "status": "At Risk" if contract_score < 90 else "Healthy",
            },
        ],
        "kpi_cards": [
            {"name": "GPO Pricing Conflicts", "value": metrics["gpo_conflicts"], "unit": "open", "description": "Customers charged above or outside their GPO contract price", "filter_type": "conflict"},
            {"name": "Expiring Contracts", "value": metrics["expiring_contracts"], "unit": "open", "description": "GPO contracts expiring within 30 days requiring renewal action", "filter_type": "expiring"},
            {"name": "Product Recalls", "value": metrics["product_recalls"], "unit": "open", "description": "Orders placed after product recall date — regulatory violations requiring immediate credit", "filter_type": "recalled"},
            {"name": "Compliance Exposure", "value": metrics["total_exposure"], "unit": "dollars", "description": "Total dollar exposure from active GPO conflicts, expiring contracts, and recalled product orders", "filter_type": "all"},
            {"name": "Annualized Exposure", "value": metrics["annualized_exposure"], "unit": "dollars", "description": "Projected annualized exposure based on the current active conflict volume", "filter_type": "annualized"},
        ],
        "top_alerts": top_alerts,
        "ai_queue": ai_queue,
        "my_action_queue": my_action_queue,
        "all_open_issues": open_issues,
    }


@router.get("/dashboard")
def pricing_dashboard(session_id: str = Depends(get_pricing_demo_session)):
    return _build_dashboard_payload(session_id)


@router.get("/issue/{issue_id}")
def pricing_issue(issue_id: str, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    is_conflict = issue["issue_type"] in ("GPO Pricing Conflict", "No GPO Membership", "GPO Chargeback Dispute")
    is_expiring = issue["issue_type"] == "Contract Expiring"
    is_chargeback = issue["issue_type"] == "GPO Chargeback Dispute"
    is_recalled = issue["issue_type"] == "Product Recalled"
    overcharge = float(issue.get("overcharge_per_unit", 0)) * int(issue.get("quantity_affected", 0) or 0)
    dollar_value = float(issue.get("dollar_value", 0) or 0)
    if is_chargeback:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) filed a GPO chargeback on {issue['order_id']} — "
            f"contract tier mismatch leaves ${dollar_value:,.0f} revenue at risk. "
            f"Applied {issue['applied_tier']} vs contracted {issue['correct_tier']} under {issue['gpo_name']} ({issue['contract_id']})."
        )
    elif is_conflict:
        what_happened = f"{issue['customer_name']} was charged at {issue['applied_tier']} — their {issue['gpo_name']} contract ({issue['contract_id']}) entitles them to {issue['correct_tier']} pricing. Overcharge of ${overcharge:,.2f} on this order."
    elif is_expiring:
        what_happened = f"Contract {issue['contract_id']} for {issue['customer_name']} expires in {issue['sla_days_remaining']} days. No renewal has been initiated."
    else:
        what_happened = f"Order {issue['order_id']} for {issue['customer_name']} was placed after the {issue['product']} recall date. A credit is required immediately."
    affected_records = [{
        "record_type": "Order" if issue.get("order_id") else "Contract",
        "record_id": issue.get("order_id") or issue["contract_id"],
        "customer": issue["customer_name"],
        "contract": issue["contract_id"],
        "detail": (
            f"{issue['applied_tier']} applied — should be {issue['correct_tier']}"
            if is_conflict
            else f"Expires in {issue['sla_days_remaining']} days — renewal required"
        ),
    }]
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
            {
                "risk_type": "Revenue at Risk",
                "status": issue["risk_revenue"],
                "detail": (
                    str(issue.get("risk_revenue") or "").strip()
                    if is_chargeback or is_recalled
                    else (
                        "Chargeback initiated by customer will recover overcharge"
                        if is_conflict
                        else (
                            f"Contract renewal gap — ${dollar_value:,.0f} at risk if {issue['contract_id']} lapses"
                            if is_expiring
                            else "Contract gap creates immediate revenue leakage"
                        )
                    )
                ),
            },
            {
                "risk_type": "Chargeback Exposure",
                "status": issue["risk_chargeback"],
                "detail": (
                    str(issue.get("risk_chargeback") or "").strip()
                    if is_chargeback or is_recalled
                    else (
                        "Customer will dispute invoice once overcharge detected"
                        if is_conflict
                        else (
                            "N/A — contract renewal risk only"
                            if is_expiring
                            else "N/A"
                        )
                    )
                )
                or (
                    f"${dollar_value:,.0f} full credit required — order placed after {issue.get('product', 'product')} recall"
                    if is_recalled
                    else ""
                ),
            },
            {"risk_type": "GPO Compliance", "status": issue["risk_compliance"], "detail": "GPO contract obligation requires correct tier pricing at all times"},
            {"risk_type": "Mapping Accuracy", "status": issue["risk_gpo"], "detail": "Every open conflict reduces overall GPO mapping accuracy score"},
        ],
        "owner": {
            "owner_id": issue["owner_id"],
            "owner_name": issue["owner_name"],
            "assigned_on": issue["opened_date"],
            "next_action": (
                f"Reroute chargeback to {issue['correct_tier']} + update SAP pricing master for {issue['customer_id']}"
                if is_chargeback
                else (
                    f"Issue credit memo for ${overcharge:,.2f} + update SAP pricing master for {issue['customer_id']}"
                    if is_conflict
                    else f"Initiate contract renewal for {issue['contract_id']}"
                )
            ),
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
            (
                f"Step 2 — Reroute chargeback to {issue['correct_tier']} and reconcile ${dollar_value:,.0f} exposure"
                if is_chargeback
                else (
                    f"Step 2 — Issue credit memo for ${overcharge:,.2f}"
                    if overcharge > 0
                    else f"Step 2 — Initiate contract renewal for {issue['contract_id']}"
                )
            ),
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
    is_chargeback = issue["issue_type"] == "GPO Chargeback Dispute"
    is_conflict = issue["issue_type"] in ("GPO Pricing Conflict", "No GPO Membership", "GPO Chargeback Dispute")
    if is_chargeback and credit_memo_amount <= 0:
        credit_memo_amount = float(issue.get("dollar_value", 0) or 0)
    action_label = "Issue Credit Memo" if int(issue.get("credit_memo_required", 0)) else "Enroll in GPO"
    tax_owner = _owner_name_for_persona("Tax & Compliance", SUGGESTED_OWNER_BY_PERSONA["Tax & Compliance"])
    credit_owner = _owner_name_for_persona("Credit & AR", SUGGESTED_OWNER_BY_PERSONA["Credit & AR"])
    market_access_owner = _owner_name_for_persona("Market Access", SUGGESTED_OWNER_BY_PERSONA["Market Access"])
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
            f"GPO chargeback on {order_id} — {issue['applied_tier']} invoiced vs {issue['correct_tier']} contracted (${credit_memo_amount:,.0f} exposure)."
            if is_chargeback
            else f"{order['product_name']} was invoiced at {issue['applied_tier']}."
        ),
        "ai_recommendation": {
            "fix": (
                f"Reroute chargeback to {issue['correct_tier']} + update SAP pricing master for {issue['customer_id']}"
                if is_chargeback
                else f"Issue credit memo of ${credit_memo_amount:,.2f} for {order_id} + update SAP pricing master for {issue['customer_id']}"
            ),
            "confidence": float(issue["ai_confidence"]) + 2,
            "source": issue["ai_source"],
        },
        "order_trail": [
            {"date": order["order_date"], "event": "Order created", "price_applied": issue["applied_tier"], "status": "Processed", "correction": "Pending"},
            {"date": order.get("ship_date", ""), "event": "Invoiced", "price_applied": issue["applied_tier"], "status": "Invoiced", "correction": "Credit memo required"},
        ],
        "mapping_accuracy": {
            "gpo_roster_confidence": 87,
            "signal": f"Tier mismatch detected — {issue['applied_tier']} instead of {issue['correct_tier']}",
            "chargeback_exposure": credit_memo_amount,
        },
        "customer_hierarchy": {"idn": "IDN-003 MedStar Alliance", "hospital": f"{issue['customer_name']} Regional", "clinic": f"{issue['customer_id']} {issue['customer_name']}"},
        "cross_team_visibility": [
            {"team": "Tax & Compliance", "issue": f"Tax jurisdiction mismatch on {order_id}", "owner": tax_owner},
            {"team": "Credit & AR", "issue": "Payment hold recommended pending credit memo", "owner": credit_owner},
            {"team": "Market Access", "issue": f"GPO membership unverified for {issue['customer_id']}", "owner": market_access_owner},
        ],
        "capa_linkage": {"capa_id": issue["capa_id"], "regulation": "FDA QMSR — 21 CFR Part 820", "status": "In Progress", "owner": f"{issue['owner_name']} — Pricing Analyst", "due_date": "2026-05-01"},
        "issue_id": issue["issue_id"],
        "action_label": action_label,
        "workflow": _workflow_status(issue),
    }


@router.get("/closure/{issue_id}")
def pricing_closure(issue_id: str, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    overrides = _session_overrides(session_id)
    snapshot = overrides.get(issue_id, {}).get("closure_snapshot")
    if snapshot:
        return snapshot["closure"]

    open_issues = [i for i in issues if i.get("status") == "Open"]
    metrics_before = _compute_pricing_metrics(open_issues)
    open_after = [i for i in open_issues if i["issue_id"] != issue_id]
    metrics_after = _compute_pricing_metrics(open_after)
    return _build_closure_payload(issue, metrics_before, metrics_after)


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
    patch["urgency_label"] = (
        "AI fix approved — pending SAP pricing master update"
        if body.action == "approve"
        else "AI rejected — follow prescribed manual actions"
    )
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **patch}
    merged = _merge_issue(issue, session_id)
    return {"issue_id": body.issue_id, "action": body.action, "workflow": _workflow_status(merged)}


class PricingResolveBody(BaseModel):
    issue_id: str


@router.post("/resolve")
def pricing_resolve(body: PricingResolveBody, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    overrides = _session_overrides(session_id)
    if issue.get("status") == "Resolved":
        snapshot = overrides.get(body.issue_id, {}).get("closure_snapshot")
        closure = snapshot["closure"] if snapshot else pricing_closure(body.issue_id, session_id)
        return {
            "ok": True,
            "issue_id": body.issue_id,
            "already_resolved": True,
            "closure": closure,
            "dashboard": _build_dashboard_payload(session_id),
        }

    if not _can_mark_resolved(issue):
        raise HTTPException(status_code=400, detail="Issue cannot be resolved yet — approve AI recommendation or complete credit memo step")

    open_before = [i for i in issues if i.get("status") == "Open"]
    metrics_before = _compute_pricing_metrics(open_before)
    today = datetime.date.today().isoformat()

    resolved_issue = next((i for i in issues if i["issue_id"] == body.issue_id), issue)
    open_after = [i for i in open_before if i["issue_id"] != body.issue_id]
    metrics_after = _compute_pricing_metrics(open_after)
    closure = _build_closure_payload(resolved_issue, metrics_before, metrics_after)

    urgency = (
        "Contract renewal initiated — alert closed"
        if resolved_issue.get("issue_type") == "Contract Expiring"
        else "Resolved — pricing correction complete"
    )
    overrides[body.issue_id] = {
        **overrides.get(body.issue_id, {}),
        "status": "Resolved",
        "resolved_at": today,
        "urgency_label": urgency,
        "closure_snapshot": {
            "metrics_before": metrics_before,
            "metrics_after": metrics_after,
            "closure": closure,
        },
    }
    return {
        "ok": True,
        "issue_id": body.issue_id,
        "already_resolved": False,
        "closure": closure,
        "dashboard": _build_dashboard_payload(session_id),
    }


class PricingReassignBody(BaseModel):
    issue_id: str
    owner_id: str | None = None


@router.post("/reassign")
def pricing_reassign(body: PricingReassignBody, session_id: str = Depends(get_pricing_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    new_owner = (
        next((o for o in PRICING_TEAM_OWNERS if o["owner_id"] == body.owner_id), None)
        if body.owner_id
        else _next_pricing_owner(issue.get("owner_id", ""))
    )
    if not new_owner:
        new_owner = LOGGED_IN_PRICING_OWNER
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **new_owner}
    return {"issue_id": body.issue_id, **new_owner}


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
