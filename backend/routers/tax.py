import datetime
import copy
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/tax", tags=["tax"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

# Demo overrides scoped per browser session (reset on full page refresh)
_session_issue_overrides: dict[str, dict[str, dict]] = {}

LOGGED_IN_TAX_OWNER = {"owner_id": "TAX-03", "owner_name": "Jennifer Mills"}

TAX_TEAM_OWNERS = [
    {"owner_id": "TAX-03", "owner_name": "Jennifer Mills"},
    {"owner_id": "TAX-04", "owner_name": "Emily Carter"},
    {"owner_id": "TAX-05", "owner_name": "Robert Chan"},
]


def _next_tax_owner(current_owner_id: str) -> dict:
    ids = [o["owner_id"] for o in TAX_TEAM_OWNERS]
    try:
        idx = ids.index(current_owner_id)
    except ValueError:
        idx = -1
    return TAX_TEAM_OWNERS[(idx + 1) % len(TAX_TEAM_OWNERS)]


def get_tax_demo_session(
    x_tax_demo_session: str | None = Header(default=None, alias="X-Tax-Demo-Session"),
) -> str:
    return x_tax_demo_session or "default"


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
    merged["ai_fix"] = (
        f"Request Correction {merged['order_id']} jurisdiction from {merged['applied_jurisdiction']} "
        f"to {merged['correct_jurisdiction']} + Rquest update for {merged['address_record']} in SAP address master"
    )
    return merged


def _load_issues(session_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM tax_jurisdiction_issues ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()
    return [_merge_issue(dict(r), session_id) for r in rows]


def _is_overpayment(issue: dict) -> bool:
    return float(issue.get("rate_difference", 0)) < 0


def _is_underpayment(issue: dict) -> bool:
    return float(issue.get("rate_difference", 0)) > 0


def _manual_workflow_ready(issue: dict) -> bool:
    """Manual 4-step path: Issue (acknowledge) → Transaction (review + address update)."""
    return bool(issue.get("acknowledged_at")) and bool(issue.get("transaction_reviewed_at")) and bool(
        issue.get("address_update_queued_at")
    )


def _can_mark_resolved(issue: dict) -> bool:
    if issue.get("status") == "Resolved":
        return False
    if issue.get("ai_decision") == "approve":
        return True
    return _manual_workflow_ready(issue)


def _workflow_status(issue: dict) -> dict:
    ai_approved = issue.get("ai_decision") == "approve"
    manual_ready = _manual_workflow_ready(issue)
    if ai_approved:
        path = "ai"
    elif manual_ready:
        path = "manual"
    else:
        path = "manual_in_progress"
    return {
        "ai_approved": ai_approved,
        "manual_ready": manual_ready,
        "can_mark_resolved": _can_mark_resolved(issue),
        "acknowledged_at": issue.get("acknowledged_at"),
        "transaction_reviewed_at": issue.get("transaction_reviewed_at"),
        "address_update_queued_at": issue.get("address_update_queued_at"),
        "resolution_path": path,
    }


def _compute_metrics(open_issues: list[dict]) -> dict:
    pre_invoice = [i for i in open_issues if int(i.get("pre_invoice") or 0) == 1]
    total_exposure = round(sum(float(i.get("dollar_value", 0)) for i in open_issues), 2)
    jurisdiction_mismatches = len(open_issues)
    pre_invoice_alerts = len(pre_invoice)
    tax_overpayments = round(
        sum(float(i.get("dollar_value", 0)) for i in open_issues if _is_overpayment(i)),
        2,
    )
    tax_underpayments = round(
        sum(float(i.get("dollar_value", 0)) for i in open_issues if _is_underpayment(i)),
        2,
    )
    next_invoice_days = min((i.get("sla_days_remaining", 99) for i in pre_invoice), default=0)
    return {
        "headline": {
            "total_exposure": total_exposure,
            "active_mismatches": jurisdiction_mismatches,
            "pre_invoice_alerts": pre_invoice_alerts,
            "annualized_exposure": round(total_exposure * 12, 2),
            "next_invoice_days": next_invoice_days,
        },
        "jurisdiction_mismatches": jurisdiction_mismatches,
        "pre_invoice_alerts": pre_invoice_alerts,
        "total_exposure": total_exposure,
        "annualized_exposure": round(total_exposure * 12, 2),
        "tax_overpayments": tax_overpayments,
        "tax_underpayments": tax_underpayments,
        "pre_invoice": pre_invoice,
    }


def _data_quality_health(metrics: dict) -> list[dict]:
    mismatch_count = int(metrics.get("jurisdiction_mismatches", 0))
    pre_invoice_count = int(metrics.get("pre_invoice_alerts", 0))
    jurisdiction_accuracy = max(70, 96 - mismatch_count * 2)
    ship_to_completeness = max(75, 95 - pre_invoice_count * 2)
    return [
        {
            "metric": "Tax Jurisdiction Accuracy",
            "score": jurisdiction_accuracy,
            "status": "At Risk" if jurisdiction_accuracy < 90 else "Healthy",
        },
        {
            "metric": "Ship-To Address Completeness",
            "score": ship_to_completeness,
            "status": "At Risk" if ship_to_completeness < 90 else "Healthy",
        },
    ]


def _owner_with_most_open_issues(open_issues: list[dict]) -> dict:
    counts: dict[str, int] = {}
    owner_name_by_id: dict[str, str] = {}
    for issue in open_issues:
        owner_id = str(issue.get("owner_id") or "").strip()
        owner_name = str(issue.get("owner_name") or "").strip()
        if owner_id in ("", "Unassigned"):
            continue
        counts[owner_id] = counts.get(owner_id, 0) + 1
        if owner_name:
            owner_name_by_id[owner_id] = owner_name
    if not counts:
        return LOGGED_IN_TAX_OWNER
    max_count = max(counts.values())
    candidate_ids = [owner_id for owner_id, count in counts.items() if count == max_count]
    chosen_id = sorted(candidate_ids)[0]
    return {
        "owner_id": chosen_id,
        "owner_name": owner_name_by_id.get(chosen_id, LOGGED_IN_TAX_OWNER["owner_name"]),
    }


def _kpi_impact_snapshot(before: dict, after: dict) -> dict:
    # Demo accuracy model: every resolved mismatch improves accuracy by ~1 point.
    # Baseline is 83% when 10 mismatches are open (seed state).
    def _accuracy(mismatch_count: int) -> str:
        pct = max(0, min(100, 93 - int(mismatch_count)))
        return f"{pct}%"

    def _count(v) -> int:
        return int(v or 0)

    def _money(v) -> float:
        return round(float(v or 0), 2)

    return {
        "jurisdiction_mismatches": {
            "before": _count(before["jurisdiction_mismatches"]),
            "after": _count(after["jurisdiction_mismatches"]),
        },
        "tax_jurisdiction_accuracy": {
            "before": _accuracy(before["jurisdiction_mismatches"]),
            "after": _accuracy(after["jurisdiction_mismatches"]),
        },
        "compliance_exposure": {
            "before": _money(before["total_exposure"]),
            "after": _money(after["total_exposure"]),
        },
        "total_exposure": {
            "before": _money(before["total_exposure"]),
            "after": _money(after["total_exposure"]),
        },
        "annualized_exposure": {
            "before": _money(before.get("annualized_exposure", before["total_exposure"] * 12)),
            "after": _money(after.get("annualized_exposure", after["total_exposure"] * 12)),
        },
        "pre_invoice_alerts": {
            "before": _count(before["pre_invoice_alerts"]),
            "after": _count(after["pre_invoice_alerts"]),
        },
        "tax_overpayments": {
            "before": _money(before["tax_overpayments"]),
            "after": _money(after["tax_overpayments"]),
        },
        "tax_underpayments": {
            "before": _money(before["tax_underpayments"]),
            "after": _money(after["tax_underpayments"]),
        },
    }


def _build_closure_payload(issue: dict, metrics_before: dict, metrics_after: dict) -> dict:
    today = datetime.date.today().isoformat()
    team_owner = {
        "Pricing Team": "Olivia Bennett",
        "Credit & AR": "Ethan Walker",
        "Data Steward": "Sophia Reed",
        "SAP Team": "Oliver Bennett",
    }
    return {
        "resolution_confirmation": {
            "issue": f"Tax Jurisdiction Mismatch — {issue['order_id']}",
            "resolved_by": issue.get("owner_id", LOGGED_IN_TAX_OWNER["owner_id"]),
            "date": issue.get("resolved_at", today),
            "resolution_type": (
                f"Request Jurisdiction Correction from {issue['applied_jurisdiction']} to "
                f"{issue['correct_jurisdiction']} + Request for Address Master data to be Updated"
            ),
            "exposure_recovered": issue["dollar_value"],
        },
        "what_was_updated": [
            f"Request for SAP Jurisdiction Update — {issue['applied_jurisdiction']} to {issue['correct_jurisdiction']} for {issue['order_id']}",
            f"Request for Address Master {issue['address_record']} to be corrected for {issue['customer_id']}",
            f"Request for {issue['capa_id']} to be closed",
            f"Request for {issue['capa_id']} to be updated",
            "Alert closed and removed from queue once the SAP Data is updated",
        ],
        "ai_action_log": {
            "recommendation": (
                f"Request Correction {issue['order_id']} jurisdiction from {issue['applied_jurisdiction']} to "
                f"{issue['correct_jurisdiction']} + Rquest update for {issue['address_record']} in SAP address master"
            ),
            "approved_by": issue.get("owner_id", LOGGED_IN_TAX_OWNER["owner_id"]),
            "confidence": issue["ai_confidence"],
            "logged_on": today,
        },
        "kpi_impact": _kpi_impact_snapshot(metrics_before, metrics_after),
        "ai_decision": issue.get("ai_decision"),
        "cross_team_notifications": [
            {
                "team": "Pricing Team",
                "owner": team_owner["Pricing Team"],
                "notification": (
                    f"Order {issue['order_id']} re-confirmed at correct jurisdiction — no pricing impact on this order"
                ),
            },
            {
                "team": "Credit & AR",
                "owner": team_owner["Credit & AR"],
                "notification": (
                    f"Payment terms cleared for processing under correct {issue['correct_jurisdiction']} jurisdiction"
                ),
            },
            {
                "team": "Data Steward",
                "owner": team_owner["Data Steward"],
                "notification": (
                    f"Address master correction for {issue['customer_id']} logged for MDM review and IQVIA sync"
                ),
            },
            {
                "team": "SAP Team",
                "owner": team_owner["SAP Team"],
                "notification": "Request for SAP Jurisdiction correction update",
            },
        ],
        "issue_id": issue["issue_id"],
        "customer_id": issue["customer_id"],
        "capa_id": issue["capa_id"],
        "address_record": issue["address_record"],
    }


def _build_dashboard_payload(session_id: str) -> dict:
    issues = _load_issues(session_id)
    open_issues = [i for i in issues if i.get("status") == "Open"]
    metrics = _compute_metrics(open_issues)
    focus_owner = _owner_with_most_open_issues(open_issues)

    sorted_alerts_all = sorted(
        open_issues,
        key=lambda x: (
            0 if int(x.get("pre_invoice") or 0) == 1 else 1,
            {"HIGH": 0, "MEDIUM": 1, "LOW": 2}.get(str(x.get("priority") or "LOW"), 9),
            x.get("sla_days_remaining", 99),
        ),
    )
    target_count = min(8, max(5, len(sorted_alerts_all)))
    overrides = _session_overrides(session_id)
    dashboard_state = overrides.setdefault("__dashboard__", {})
    snapshot = dashboard_state.get("top_alert_snapshot")
    if isinstance(snapshot, list) and snapshot:
        sorted_alerts = copy.deepcopy(snapshot)
    else:
        sorted_alerts = copy.deepcopy(sorted_alerts_all[:target_count])
        dashboard_state["top_alert_snapshot"] = copy.deepcopy(sorted_alerts)

    ai_queue = [
        i
        for i in open_issues
        if i.get("owner_id") == focus_owner["owner_id"]
        and float(i.get("ai_confidence", 0)) >= 89
        and i.get("ai_decision") != "approve"
    ]
    my_queue = sorted(
        [i for i in open_issues if i.get("owner_id") == focus_owner["owner_id"]],
        key=lambda x: (
            {"HIGH": 0, "MEDIUM": 1, "LOW": 2}.get(str(x.get("priority") or "LOW"), 9),
            x.get("sla_days_remaining", 99),
        ),
    )
    my_by_id = {i["issue_id"]: i for i in my_queue}
    for issue in ai_queue:
        my_by_id[issue["issue_id"]] = issue
    my_queue = list(my_by_id.values())

    return {
        "headline": metrics["headline"],
        "data_quality_health": _data_quality_health(metrics),
        "kpi_cards": [
            {
                "name": "Jurisdiction Mismatches",
                "value": metrics["jurisdiction_mismatches"],
                "unit": "open",
                "description": "Orders where ship-to and bill-to state do not match",
            },
            {
                "name": "Pre-Invoice Alerts",
                "value": metrics["pre_invoice_alerts"],
                "unit": "open",
                "description": "Orders with mismatches that can still be corrected before invoicing",
            },
            {
                "name": "Compliance Exposure",
                "value": metrics["total_exposure"],
                "unit": "dollars",
                "description": "Total penalty and legal risk from active jurisdiction mismatches",
            },
            {
                "name": "Tax Overpayments",
                "value": metrics["tax_overpayments"],
                "unit": "dollars",
                "description": "Orders where a higher tax rate was incorrectly applied",
            },
            {
                "name": "Tax Underpayments",
                "value": metrics["tax_underpayments"],
                "unit": "dollars",
                "description": "Orders where a lower rate was applied creating audit and penalty risk",
            },
        ],
        "top_alerts": sorted_alerts,
        "all_open_issues": open_issues,
        "ai_queue": ai_queue,
        "my_action_queue": my_queue,
    }


class TaxAiActionBody(BaseModel):
    issue_id: str
    action: Literal["approve", "reject"]


class TaxResolveBody(BaseModel):
    issue_id: str


class TaxIssueActionBody(BaseModel):
    issue_id: str
    action: Literal["acknowledge", "reassign", "update_address"]
    owner_id: str | None = None
    owner_name: str | None = None


@router.get("/dashboard")
def tax_dashboard(session_id: str = Depends(get_tax_demo_session)):
    return _build_dashboard_payload(session_id)


@router.post("/ai-action")
def tax_ai_action(body: TaxAiActionBody, session_id: str = Depends(get_tax_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    patch = {
        **LOGGED_IN_TAX_OWNER,
        "ai_decision": body.action,
        "ai_decision_at": datetime.date.today().isoformat(),
    }
    if body.action == "approve":
        patch["urgency_label"] = "AI fix approved — pending SAP jurisdiction update"
    else:
        patch["urgency_label"] = "AI rejected — follow prescribed manual actions"

    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **patch}
    return {"ok": True, "issue_id": body.issue_id, "dashboard": _build_dashboard_payload(session_id)}


@router.post("/issue-action")
def tax_issue_action(body: TaxIssueActionBody, session_id: str = Depends(get_tax_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    today = datetime.date.today().isoformat()
    patch: dict = {}

    message = "Action recorded"

    if body.action == "acknowledge":
        patch = {
            "acknowledged_at": today,
            "urgency_label": "Acknowledged — jurisdiction correction in progress",
        }
        if issue.get("owner_id") in ("Unassigned", None, ""):
            patch.update(LOGGED_IN_TAX_OWNER)
        message = "Issue accepted — ownership confirmed and correction in progress"
    elif body.action == "reassign":
        if body.owner_id and body.owner_name:
            next_owner = {"owner_id": body.owner_id, "owner_name": body.owner_name}
        else:
            next_owner = _next_tax_owner(str(issue.get("owner_id", "")))
        patch = {
            **next_owner,
            "reassigned_at": today,
            "urgency_label": f"Reassigned to {next_owner['owner_name']} — pending review",
        }
        message = f"Issue reassigned to {next_owner['owner_name']}"
    elif body.action == "update_address":
        patch = {
            "address_update_queued_at": today,
            "urgency_label": f"Address master update queued for {issue['address_record']}",
        }
        if issue.get("owner_id") in ("Unassigned", None, ""):
            patch.update(LOGGED_IN_TAX_OWNER)

    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **patch}
    updated = next(i for i in _load_issues(session_id) if i["issue_id"] == body.issue_id)

    if body.action == "update_address":
        message = patch.get("urgency_label", "Address master update queued")

    return {
        "ok": True,
        "issue_id": body.issue_id,
        "action": body.action,
        "message": message,
        "issue": updated,
        "dashboard": _build_dashboard_payload(session_id),
    }


@router.post("/resolve")
def tax_resolve(body: TaxResolveBody, session_id: str = Depends(get_tax_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == body.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    overrides = _session_overrides(session_id)
    if issue.get("status") == "Resolved":
        snapshot = overrides.get(body.issue_id, {}).get("closure_snapshot")
        if snapshot:
            closure = _build_closure_payload(
                issue,
                snapshot.get("metrics_before", _compute_metrics([])),
                snapshot.get("metrics_after", _compute_metrics([])),
            )
            overrides[body.issue_id]["closure_snapshot"] = {
                **snapshot,
                "closure": closure,
            }
            return {
                "ok": True,
                "issue_id": body.issue_id,
                "already_resolved": True,
                "closure": closure,
                "dashboard": _build_dashboard_payload(session_id),
            }

    open_before = [i for i in issues if i.get("status") == "Open"]
    metrics_before = _compute_metrics(open_before)
    today = datetime.date.today().isoformat()

    overrides[body.issue_id] = {
        **overrides.get(body.issue_id, {}),
        "status": "Resolved",
        "resolved_at": today,
        "urgency_label": "Resolved — jurisdiction corrected",
    }

    resolved_issue = next((i for i in _load_issues(session_id) if i["issue_id"] == body.issue_id), issue)
    open_after = [i for i in _load_issues(session_id) if i.get("status") == "Open"]
    metrics_after = _compute_metrics(open_after)
    closure = _build_closure_payload(resolved_issue, metrics_before, metrics_after)
    overrides[body.issue_id]["closure_snapshot"] = {
        "metrics_before": metrics_before,
        "metrics_after": metrics_after,
        "closure": closure,
    }

    return {
        "ok": True,
        "issue_id": body.issue_id,
        "already_resolved": False,
        "closure": closure,
        "dashboard": _build_dashboard_payload(session_id),
    }


@router.get("/issue/{issue_id}")
def tax_issue(issue_id: str, session_id: str = Depends(get_tax_demo_session)):
    issue = next((i for i in _load_issues(session_id) if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

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
        )
        if issue["pre_invoice"]
        else (
            f"Order {issue['order_id']} for {issue['customer_name']} was invoiced with {issue['applied_jurisdiction']} "
            f"tax jurisdiction applied. The correct jurisdiction is {issue['correct_jurisdiction']} — "
            f"tax exposure of ${issue['dollar_value']:,.2f} requiring post-invoice correction."
        ),
        "business_risk": [
            {
                "risk_type": "Compliance Risk",
                "status": issue["risk_compliance"],
                "detail": "Jurisdiction mismatch can be corrected before invoice is generated"
                if issue["pre_invoice"]
                else "Post-invoice correction required via SAP adjustment",
            },
            {
                "risk_type": "Penalty Exposure",
                "status": f"${issue['dollar_value']:,.2f} avoidable",
                "detail": "Tax authority fine avoidable if corrected before invoicing"
                if issue["pre_invoice"]
                else "Penalty risk active — correction required immediately",
            },
            {
                "risk_type": "Legal Risk",
                "status": issue["risk_legal"],
                "detail": "Incorrect jurisdiction filing triggers state tax authority review",
            },
            {
                "risk_type": "Jurisdiction Accuracy",
                "status": issue["risk_jurisdiction"],
                "detail": "Every open mismatch reduces overall tax accuracy score",
            },
        ],
        "owner": {
            "owner_id": issue["owner_id"],
            "owner_name": issue["owner_name"],
            "assigned_on": issue["opened_date"],
            "next_action": f"Correct ship-to jurisdiction in SAP {'before invoice generation' if issue['pre_invoice'] else 'via post-invoice adjustment'}",
            "sla_remaining": f"{issue['sla_days_remaining']} days remaining",
        },
        "ai_recommendation": {
            "fix": (
                f"Request Correction {issue['order_id']} jurisdiction from {issue['applied_jurisdiction']} to "
                f"{issue['correct_jurisdiction']} + Rquest update for {issue['address_record']} in SAP address master"
            ),
            "confidence": issue["ai_confidence"],
            "source": issue["ai_source"],
            "order_id": issue["order_id"],
            "correct_jurisdiction": issue["correct_jurisdiction"],
            "decision": issue.get("ai_decision"),
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
        "workflow": _workflow_status(issue),
    }


@router.get("/transaction/{order_id}")
def tax_transaction(order_id: str, session_id: str = Depends(get_tax_demo_session)):
    with _connect() as conn:
        order = conn.execute(
            "SELECT * FROM sales_orders WHERE order_id = ?", (order_id,)
        ).fetchone()

    issue = next((i for i in _load_issues(session_id) if i["order_id"] == order_id), None)

    if not order or not issue:
        raise HTTPException(status_code=404, detail="Transaction not found")

    order = dict(order)
    today = datetime.date.today().isoformat()
    team_owner = {
        "Pricing Team": "Olivia Bennett",
        "Credit & AR": "Ethan Walker",
        "Data Steward": "Sophia Reed",
    }
    overrides = _session_overrides(session_id)
    overrides[issue["issue_id"]] = {
        **overrides.get(issue["issue_id"], {}),
        "transaction_reviewed_at": today,
    }
    issue = next((i for i in _load_issues(session_id) if i["issue_id"] == issue["issue_id"]), issue)

    return {
        "order_header": {
            "order_id": order["order_id"],
            "customer": f"{order['customer_id']} {issue['customer_name']}",
            "product": order["product_name"],
            "order_date": order["order_date"],
            "invoice_status": "Pending"
            if not order.get("revenue_recognized") or order.get("revenue_recognized") == "No"
            else "Invoiced",
            "ship_to_state": issue["ship_to_state"],
            "bill_to_state": issue["bill_to_state"],
        },
        "jurisdiction_breakdown": {
            "ship_to_state": issue["ship_to_state"],
            "bill_to_state": issue["bill_to_state"],
            "jurisdiction_applied": issue["applied_jurisdiction"],
            "correct_jurisdiction": issue["correct_jurisdiction"],
            "rate_difference": f"{issue['rate_difference']}%",
            "tax_exposure": float(issue.get("dollar_value") or 0),
        },
        "what_went_wrong": (
            f"{order['product_name']} was scheduled for invoicing under {issue['applied_jurisdiction']} tax jurisdiction "
            f"because the ship-to address for {issue['customer_id']} was not updated in SAP after customer relocation — "
            f"tax exposure of ${issue['dollar_value']:,.2f} on this order."
        ),
        "ai_recommendation": {
            "fix": (
                f"Request Correction {order['order_id']} jurisdiction from {issue['applied_jurisdiction']} to "
                f"{issue['correct_jurisdiction']} + Rquest update for {issue['address_record']} in SAP address master"
            ),
            "confidence": float(issue["ai_confidence"]) + 2,
            "source": issue["ai_source"],
            "decision": issue.get("ai_decision"),
        },
        "order_trail": [
            {
                "date": order["order_date"],
                "event": "Order created",
                "jurisdiction": issue["applied_jurisdiction"],
                "status": order.get("invoice_status", "Pending"),
                "correction": "In Progress",
            },
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
            {
                "team": "Pricing Team",
                "issue": "No pricing conflict on this order",
                "owner": team_owner["Pricing Team"],
            },
            {
                "team": "Credit & AR",
                "issue": "Payment terms under review",
                "owner": team_owner["Credit & AR"],
            },
            {
                "team": "Data Steward",
                "issue": "Address master update required",
                "owner": team_owner["Data Steward"],
            },
        ],
        "capa_linkage": {
            "capa_id": "CAPA-011",
            "regulation": "State Tax Compliance — Ship-To Jurisdiction",
            "status": "Open",
            "owner": f"{issue['owner_name']} — Tax Team Member",
            "due_date": "2026-05-20",
        },
        "customer_id": issue["customer_id"],
        "issue_id": issue["issue_id"],
        "workflow": _workflow_status(issue),
    }


@router.get("/closure/{issue_id}")
def tax_closure(issue_id: str, session_id: str = Depends(get_tax_demo_session)):
    """Preview closure impact without persisting (use POST /resolve to fix and update KPIs)."""
    issue = next((i for i in _load_issues(session_id) if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.get("status") == "Resolved":
        snapshot = _session_overrides(session_id).get(issue_id, {}).get("closure_snapshot")
        if snapshot:
            return snapshot["closure"]

    open_issues = [i for i in _load_issues(session_id) if i.get("status") == "Open"]
    metrics_before = _compute_metrics(open_issues)
    hypothetical_open = [i for i in open_issues if i["issue_id"] != issue_id]
    metrics_after = _compute_metrics(hypothetical_open)
    return _build_closure_payload(issue, metrics_before, metrics_after)
