import datetime
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from routers.capa import _base_capas

router = APIRouter(prefix="/api/steward", tags=["steward"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"
_session_issue_overrides: dict[str, dict[str, dict]] = {}

LOGGED_IN_STEWARD = {"owner_id": "DS-02", "owner_name": "Jordan Lee"}
STEWARD_TEAM_OWNERS = [
    {"owner_id": "DS-02", "owner_name": "Jordan Lee"},
    {"owner_id": "DS-01", "owner_name": "Rachel Torres"},
    {"owner_id": "DS-03", "owner_name": "Ethan Park"},
]

DEMO_TYPE_OVERRIDES: dict[str, str] = {
    "DS-ISS-005": "Hierarchy Mismatch",
    "DS-ISS-014": "Hierarchy Mismatch",
}
ANNUALIZED_EXPOSURE_MULTIPLIER = 2_100_000.0 / 89_240.0


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


_STEWARD_OWNER_IDS = {o["owner_id"] for o in STEWARD_TEAM_OWNERS}


def _is_unassigned_owner_value(value: object) -> bool:
    text = str(value or "").strip().lower()
    return not text or text in ("unassigned", "none", "null", "-", "—")


def _ensure_steward_owner(issue: dict) -> dict:
    """Every steward issue is owned by a data steward team member (never Unassigned)."""
    owner_id = str(issue.get("owner_id") or "").strip()
    owner_name = str(issue.get("owner_name") or "").strip()
    if owner_id in _STEWARD_OWNER_IDS and not _is_unassigned_owner_value(owner_id) and not _is_unassigned_owner_value(owner_name):
        owner = next(o for o in STEWARD_TEAM_OWNERS if o["owner_id"] == owner_id)
        return {**issue, "owner_id": owner["owner_id"], "owner_name": owner["owner_name"]}
    idx = sum(ord(c) for c in str(issue.get("issue_id") or "")) % len(STEWARD_TEAM_OWNERS)
    owner = STEWARD_TEAM_OWNERS[idx]
    return {**issue, "owner_id": owner["owner_id"], "owner_name": owner["owner_name"]}


def _merge_issue(issue: dict, session_id: str) -> dict:
    merged = dict(issue)
    if issue["issue_id"] in DEMO_TYPE_OVERRIDES:
        merged["issue_type"] = DEMO_TYPE_OVERRIDES[issue["issue_id"]]
    override = _session_overrides(session_id).get(issue["issue_id"])
    if override:
        merged.update(override)
    return _ensure_steward_owner(merged)


def _load_issues(session_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM data_steward_issues ORDER BY sla_days_remaining ASC"
        ).fetchall()
        issues: list[dict] = []
        for row in rows:
            raw = dict(row)
            merged = _merge_issue(raw, session_id)
            if merged["owner_id"] != raw.get("owner_id") or merged["owner_name"] != raw.get("owner_name"):
                conn.execute(
                    "UPDATE data_steward_issues SET owner_id = ?, owner_name = ? WHERE issue_id = ?",
                    (merged["owner_id"], merged["owner_name"], merged["issue_id"]),
                )
            issues.append(merged)
        conn.commit()
    return issues


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


def _annualized_exposure(total_exposure: float) -> float:
    return round(total_exposure * ANNUALIZED_EXPOSURE_MULTIPLIER, 2)


def _build_affected_records(issue: dict) -> list[dict]:
    orders = [o.strip() for o in (issue.get("open_orders") or "").split(";") if o.strip()]
    idn_parent = f"{issue.get('current_idn', '—')} ({issue.get('current_idn_name', 'No IDN')})"

    def make_row(customer_id: str, customer_name: str, open_order: str) -> dict:
        return {
            "customer": customer_id,
            "customer_name": customer_name,
            "open_order": open_order,
            "contract": issue.get("contract_id", "—"),
            "current_idn_parent": idn_parent,
        }

    return [
        make_row(issue["customer_id"], issue["customer_name"], order_id if orders else "—")
        for order_id in (orders or ["—"])
    ]


def _issue_orders(issue: dict) -> list[str]:
    return [o.strip() for o in (issue.get("open_orders") or "").split(";") if o.strip()]


def _orders_phrase(issue: dict) -> str:
    orders = _issue_orders(issue)
    return " and ".join(orders) if orders else issue["customer_id"]


def _build_capa_linkage(issue: dict) -> dict:
    capa_id = issue.get("capa_id") or "CAPA-009"
    capa = next((c for c in _base_capas() if c["capa_id"] == capa_id), None)
    if capa:
        owner = capa["owner"]
        if capa.get("owner_role"):
            owner = f"{capa['owner']} — {capa['owner_role']}"
        return {
            "capa_id": capa_id,
            "regulation": capa["regulation"],
            "status": capa["status"],
            "owner": owner,
            "due_date": capa["due_date"],
        }
    return {
        "capa_id": capa_id,
        "regulation": "FDA QMSR — 21 CFR Part 820",
        "status": "In Progress",
        "owner": "Marcus Johnson — Chief Data Officer",
        "due_date": "2026-05-10",
    }


def _owner_next_action(issue: dict) -> str:
    issue_type = issue["issue_type"]
    customer_id = issue["customer_id"]
    if issue_type == "Hierarchy Mismatch":
        return (
            f"Update IDN parent from {issue.get('current_idn', '—')} "
            f"to {issue.get('correct_idn', '—')}"
        )
    if issue_type == "Tax Jurisdiction Gap":
        return (
            f"Correct Sold-To jurisdiction from {issue.get('current_jurisdiction', '—')} "
            f"to {issue.get('correct_jurisdiction', '—')} for {customer_id}"
        )
    if issue_type == "Orphan Record":
        return (
            f"Assign {customer_id} to {issue.get('correct_idn_name', 'target IDN')} "
            f"({issue.get('correct_idn', '—')}) in SAP master"
        )
    if issue_type == "Stale Master Record":
        return f"Refresh {customer_id} from IQVIA — last validated {issue.get('last_updated', '—')}"
    return issue.get("ai_fix") or f"Resolve duplicate suspect for {customer_id}"


def _build_prescribed_actions(issue: dict) -> list[str]:
    issue_type = issue["issue_type"]
    customer_id = issue["customer_id"]
    if issue_type == "Hierarchy Mismatch":
        return [
            f"Step 1 — Cross-check IQVIA roster for {customer_id} effective date of IDN transfer",
            (
                f"Step 2 — Update IDN parent in SAP customer master from "
                f"{issue.get('current_idn', 'None')} to {issue.get('correct_idn', 'Target IDN')}"
            ),
            (
                f"Step 3 — Trigger re-pricing on all open orders for {customer_id} against "
                f"{issue.get('correct_idn_name', 'correct IDN')} contract"
            ),
            "Step 4 — Notify Pricing Team and Tax Team of correction applied",
        ]
    if issue_type == "Tax Jurisdiction Gap":
        return [
            f"Step 1 — Verify sold-to address for {customer_id} in SAP",
            (
                f"Step 2 — Correct tax jurisdiction from {issue.get('current_jurisdiction', '—')} "
                f"to {issue.get('correct_jurisdiction', '—')} in SAP address master"
            ),
            f"Step 3 — Re-calculate tax on {_orders_phrase(issue)}",
            "Step 4 — Mark issue resolved and close alert",
        ]
    if issue_type == "Orphan Record":
        return [
            f"Step 1 — Validate {customer_id} affiliation in IQVIA roster",
            (
                f"Step 2 — Assign {customer_id} to {issue.get('correct_idn_name', 'target IDN')} "
                f"({issue.get('correct_idn', '—')}) in SAP master"
            ),
            "Step 3 — Validate downstream impact on pricing, tax, and credit modules",
            "Step 4 — Notify Pricing Team and Tax Team of correction applied",
        ]
    if issue_type == "Stale Master Record":
        return [
            (
                f"Step 1 — Pull latest IQVIA roster signal for {customer_id} "
                f"(last SAP update: {issue.get('last_updated', '—')})"
            ),
            f"Step 2 — Refresh {customer_id} in SAP customer master against IQVIA match",
            "Step 3 — Validate hierarchy, jurisdiction, and contract fields post-refresh",
            "Step 4 — Notify downstream teams if deltas detected",
        ]
    return [
        f"Step 1 — Review duplicate pair flagged for {customer_id} in AI deduplication scan",
        f"Step 2 — {issue.get('ai_fix', 'Merge duplicate records per AI recommendation')}",
        "Step 3 — Consolidate open orders under canonical customer record",
        "Step 4 — Notify Pricing, Tax, and Credit teams of merge",
    ]


def _build_what_was_updated(issue: dict) -> list[str]:
    capa_id = issue.get("capa_id", "CAPA-009")
    customer_id = issue["customer_id"]
    orders_str = _orders_phrase(issue)
    issue_type = issue["issue_type"]

    if issue_type == "Hierarchy Mismatch":
        lines = [
            (
                f"Request for SAP Customer Master data to be updated — "
                f"{issue.get('current_idn_name', 'prior IDN')} to {issue.get('correct_idn_name', 'correct IDN')} "
                f"for {customer_id}"
            ),
        ]
        if _issue_orders(issue):
            lines.append(f"Request for SAP Pricing revalidation — re-pricing for {orders_str}")
        else:
            lines.append(f"Request for SAP Pricing validation for {customer_id}")
    elif issue_type == "Tax Jurisdiction Gap":
        lines = [
            (
                f"Request for SAP Jurisdiction correction — "
                f"{issue.get('current_jurisdiction', '—')} to {issue.get('correct_jurisdiction', '—')} "
                f"for {customer_id}"
            ),
        ]
        if _issue_orders(issue):
            lines.append(f"Request for tax re-calculation on {orders_str}")
        else:
            lines.append(f"Request for address master validation for {customer_id}")
    elif issue_type == "Orphan Record":
        lines = [
            (
                f"Request for SAP Customer Master data to be updated — assign {customer_id} "
                f"to {issue.get('correct_idn_name', 'target IDN')} ({issue.get('correct_idn', '—')})"
            ),
            f"Request for SAP Pricing master validation for {customer_id}",
        ]
    elif issue_type == "Stale Master Record":
        lines = [
            f"Request for SAP Customer Master data to be refreshed from IQVIA for {customer_id}",
            f"Request for hierarchy and jurisdiction revalidation for {customer_id}",
        ]
    else:
        lines = [
            f"Request for SAP Customer Master data to be updated — {issue.get('ai_fix', 'merge duplicate records')}",
        ]
        if _issue_orders(issue):
            lines.append(f"Request for open orders {orders_str} to be consolidated under canonical record")
        else:
            lines.append(f"Request for duplicate record merge for {customer_id}")

    lines.append(f"Request for {capa_id} record updation")
    lines.append("Alert closed and removed from queue once the SAP Data is updated")
    return lines


def _build_resolution_type(issue: dict) -> str:
    customer_id = issue["customer_id"]
    issue_type = issue["issue_type"]
    orders_str = _orders_phrase(issue)

    if issue_type == "Hierarchy Mismatch":
        master_part = (
            f"Request for SAP Customer Master data to be Updated — "
            f"{issue.get('current_idn_name', 'prior IDN')} to {issue.get('correct_idn_name', 'correct IDN')} "
            f"for {customer_id}"
        )
        if _issue_orders(issue):
            return f"{master_part} + Request for SAP Pricing revalidation on {orders_str}"
        return master_part
    if issue_type == "Tax Jurisdiction Gap":
        return (
            f"Request for SAP Jurisdiction correction from {issue.get('current_jurisdiction', '—')} "
            f"to {issue.get('correct_jurisdiction', '—')} for {customer_id} + "
            f"Request for Address Master data to be Updated"
        )
    if issue_type == "Orphan Record":
        return (
            f"Request for SAP Customer Master data to be Updated — assign {customer_id} "
            f"to {issue.get('correct_idn_name', 'target IDN')} ({issue.get('correct_idn', '—')})"
        )
    if issue_type == "Stale Master Record":
        return (
            f"Request for SAP Customer Master data to be Updated from IQVIA refresh for {customer_id} + "
            f"Request for hierarchy and jurisdiction revalidation"
        )
    return (
        f"Request for SAP Customer Master data to be Updated — "
        f"{issue.get('ai_fix', 'merge duplicate records')}"
    )


@router.get("/dashboard")
def steward_dashboard(session_id: str = Depends(get_steward_demo_session)):
    return _build_dashboard_payload(session_id)


def _build_dashboard_payload(session_id: str) -> dict:
    issues = _load_issues(session_id)
    open_issues = [i for i in issues if i.get("status") == "Open"]
    hierarchy_mismatches = [i for i in open_issues if i.get("issue_type") == "Hierarchy Mismatch"]
    orphan_records = [i for i in open_issues if i.get("issue_type") == "Orphan Record"]
    tax_jurisdiction_gaps = [i for i in open_issues if i.get("issue_type") == "Tax Jurisdiction Gap"]
    stale_records = [i for i in open_issues if i.get("issue_type") == "Stale Master Record"]
    duplicate_suspects = [i for i in open_issues if i.get("issue_type") == "Duplicate Suspect"]

    total_exposure = round(sum(float(i.get("dollar_value", 0)) for i in open_issues), 2)
    annualized_exposure = _annualized_exposure(total_exposure)
    my_queue = [i for i in open_issues if i.get("owner_id") == LOGGED_IN_STEWARD["owner_id"]]
    ai_queue = [i for i in my_queue if float(i.get("ai_confidence", 0)) >= 89]
    sorted_alerts = sorted(open_issues, key=lambda x: -float(x.get("dollar_value", 0) or 0))
    target_count = min(8, max(5, len(sorted_alerts)))
    top_results = sorted_alerts[:target_count]
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
        "top_alerts": top_results,
        "ai_queue": ai_queue,
        "my_action_queue": my_queue,
        "all_open_issues": open_issues,
    }


@router.get("/issue/{issue_id}")
def steward_issue(issue_id: str, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    orders = [o.strip() for o in (issue.get("open_orders") or "").split(";") if o.strip()]
    is_hierarchy = issue["issue_type"] == "Hierarchy Mismatch"
    is_orphan = issue["issue_type"] == "Orphan Record"
    is_tax_gap = issue["issue_type"] == "Tax Jurisdiction Gap"
    is_stale = issue["issue_type"] == "Stale Master Record"
    if is_hierarchy:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) is currently mapped to "
            f"{issue.get('current_idn_name', 'No IDN')} ({issue.get('current_idn', '—')}), but roster signals confirm "
            f"{issue.get('correct_idn_name', 'target IDN')} ({issue.get('correct_idn', '—')}). "
            "Downstream pricing, tax, credit, and GPO alignment are running against the wrong parent."
        )
    elif is_orphan:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) has no parent IDN assigned in SAP master. "
            f"Revenue attribution and controls are incomplete for this account. "
            f"Current downstream exposure: ${float(issue['dollar_value']):,.2f}."
        )
    elif is_tax_gap:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) has a jurisdiction mismatch. "
            f"SAP applies {issue.get('current_jurisdiction', '—')} while validated state is {issue.get('correct_jurisdiction', '—')}. "
            f"Tax exposure currently estimated at ${float(issue['dollar_value']):,.2f}."
        )
    elif is_stale:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) was not refreshed in the last 90 days. "
            "Potential hierarchy, jurisdiction, and contract deltas may be missing from the master record."
        )
    else:
        what_happened = (
            f"{issue['customer_name']} ({issue['customer_id']}) is flagged as a duplicate suspect by AI deduplication scan. "
            "Parallel records can distort pricing, tax, credit, and GPO downstream controls."
        )
    affected_records = _build_affected_records(issue)
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
            "next_action": _owner_next_action(issue),
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
        "prescribed_actions": _build_prescribed_actions(issue),
        "why_it_happened": issue["root_cause"],
        "preventive_actions": [
            "Step 1 — Set up automated IQVIA roster sync with SAP master monthly",
            "Step 2 — Add hierarchy validation checkpoint at order creation",
            "Step 3 — Create alert when IQVIA signal detects IDN movement for any active customer",
        ],
        "capa_linkage": _build_capa_linkage(issue),
        "workflow": _workflow_status(issue),
    }


@router.get("/record/{customer_id}")
def steward_record(customer_id: str, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    customer_issues = [i for i in issues if i["customer_id"] == customer_id]
    if not customer_issues:
        raise HTTPException(status_code=404, detail="Customer record not found")
    primary = next((i for i in customer_issues if i.get("status") == "Open"), customer_issues[0])
    orders = [o.strip() for o in (primary.get("open_orders") or "").split(";") if o.strip()]
    trail = [
        {"date": primary["opened_date"], "event": "Issue opened", "detail": f"{primary['issue_type']} detected for {primary['customer_id']}"},
        {"date": primary.get("effective_date", "—"), "event": "IQVIA signal", "detail": f"Target mapping {primary.get('correct_idn_name', 'target IDN')}"},
        {"date": primary["last_updated"], "event": "SAP master last updated", "detail": "Record remains stale or mismatched"},
    ]
    mismatch = [
        {"source": "IQVIA", "value": f"{primary.get('correct_idn', '—')} {primary.get('correct_idn_name', '—')}", "confirmed": "Yes", "since": primary.get("effective_date", "—")},
        {"source": "SAP Master", "value": f"{primary.get('current_idn', '—')} {primary.get('current_idn_name', 'No IDN')}", "confirmed": "Stale", "since": primary["last_updated"]},
        {"source": "GPO Roster", "value": f"{primary.get('correct_idn', '—')} confirmed", "confirmed": "Yes", "since": primary.get("effective_date", "—")},
    ]
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
            "downstream_exposure": float(primary.get("dollar_value", 0)),
        },
        "what_went_wrong": primary.get("root_cause", ""),
        "ai_recommendation": {
            "fix": primary["ai_fix"],
            "confidence": primary["ai_confidence"],
            "source": primary["ai_source"],
            "decision": primary.get("ai_decision"),
        },
        "open_orders": orders,
        "contract_id": primary.get("contract_id", "—"),
        "record_trail": trail,
        "source_system_mismatch": mismatch,
        "customer_hierarchy": {
            "idn": f"{primary.get('correct_idn', '—')} {primary.get('correct_idn_name', '—')}",
            "hospital": f"{primary['customer_name']} Regional",
            "clinic": f"{customer_id} {primary['customer_name']}",
        },
        "cross_team_visibility": [
            {"team": "Pricing Team", "issue": "Contract tier mismatch", "exposure": primary["risk_pricing"], "owner": "Olivia Bennett"},
            {"team": "Tax & Compliance", "issue": "Wrong jurisdiction applied", "exposure": primary["risk_tax"], "owner": "Sophia Reed"},
            {"team": "Credit & AR", "issue": "Credit limit mismatch", "exposure": "Credit limit is ok", "owner": "Ethan Walker"},
            {"team": "SAP Team", "issue": "Request for SAP Customer Master data to be updated", "exposure": "System integrity", "owner": "Marcus Hale"},
        ],
        "capa_linkage": _build_capa_linkage(primary),
        "issue_id": primary["issue_id"],
        "workflow": _workflow_status(primary),
    }


@router.get("/closure/{issue_id}")
def steward_closure(issue_id: str, session_id: str = Depends(get_steward_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    open_issues_before = [
        i for i in issues if i.get("status") == "Open" or i.get("issue_id") == issue_id
    ]
    open_issues_after = [i for i in open_issues_before if i.get("issue_id") != issue_id]
    total_exposure_before = round(sum(float(i.get("dollar_value", 0)) for i in open_issues_before), 2)
    total_exposure_after = round(sum(float(i.get("dollar_value", 0)) for i in open_issues_after), 2)
    annualized_before = _annualized_exposure(total_exposure_before)
    annualized_after = _annualized_exposure(total_exposure_after)
    hierarchy_before = len([i for i in open_issues_before if i.get("issue_type") == "Hierarchy Mismatch"])
    hierarchy_after = len([i for i in open_issues_after if i.get("issue_type") == "Hierarchy Mismatch"])
    orphan_before = len([i for i in open_issues_before if i.get("issue_type") == "Orphan Record"])
    orphan_after = len([i for i in open_issues_after if i.get("issue_type") == "Orphan Record"])
    tax_gap_before = len([i for i in open_issues_before if i.get("issue_type") == "Tax Jurisdiction Gap"])
    tax_gap_after = len([i for i in open_issues_after if i.get("issue_type") == "Tax Jurisdiction Gap"])
    stale_before = len([i for i in open_issues_before if i.get("issue_type") == "Stale Master Record"])
    stale_after = len([i for i in open_issues_after if i.get("issue_type") == "Stale Master Record"])
    duplicate_before = len([i for i in open_issues_before if i.get("issue_type") == "Duplicate Suspect"])
    duplicate_after = len([i for i in open_issues_after if i.get("issue_type") == "Duplicate Suspect"])
    kpi_impact = {
        "hierarchy_mapping_issues": {"before": hierarchy_before, "after": hierarchy_after},
        "orphan_records": {"before": orphan_before, "after": orphan_after},
        "tax_jurisdiction_gaps": {"before": tax_gap_before, "after": tax_gap_after},
        "stale_master_records": {"before": stale_before, "after": stale_after},
        "duplicate_suspects": {"before": duplicate_before, "after": duplicate_after},
        "total_exposure": {"before": int(total_exposure_before), "after": max(0, int(total_exposure_after))},
        "annualized_exposure": {"before": int(annualized_before), "after": max(0, int(annualized_after))},
    }

    return {
        "resolution_confirmation": {
            "issue": f"{issue['issue_type']} — {issue['customer_id']} {issue['customer_name']}",
            "resolved_by": issue.get("owner_id", LOGGED_IN_STEWARD["owner_id"]),
            "resolved_by_name": issue.get("owner_name", LOGGED_IN_STEWARD["owner_name"]),
            "date": datetime.date.today().isoformat(),
            "resolution_type": _build_resolution_type(issue),
            "exposure_removed": float(issue.get("dollar_value", 0)),
        },
        "what_was_updated": _build_what_was_updated(issue),
        "ai_action_log": {
            "recommendation": issue["ai_fix"],
            "approved_by": issue.get("owner_id", LOGGED_IN_STEWARD["owner_id"]),
            "confidence": issue["ai_confidence"],
            "logged_on": datetime.date.today().isoformat(),
        },
        "kpi_impact": kpi_impact,
        "ai_decision": issue.get("ai_decision"),
        "cross_team_notifications": [
            {
                "team": "Pricing Team",
                "owner": "Olivia Bennett",
                "notified_about": "Request for SAP Pricing Master data to be updated",
            },
            {
                "team": "Tax & Compliance",
                "owner": "Sophia Reed",
                "notified_about": f"Request for SAP Jurisdiction correction update for {issue['customer_id']}",
            },
            {
                "team": "Credit & AR",
                "owner": "Ethan Walker",
                "notified_about": (
                    f"Request to re-evaluate credit exposure against corrected parent {issue.get('correct_idn_name', 'Correct IDN')}"
                ),
            },
            {
                "team": "SAP Team",
                "owner": "Marcus Hale",
                "notified_about": "Request for SAP Customer Master data to be updated",
            },
        ],
        "issue_id": issue_id,
    }


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
    patch["urgency_label"] = (
        "AI fix approved — pending SAP master update"
        if body.action == "approve"
        else "AI rejected — follow prescribed manual actions"
    )
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **patch}
    merged = _merge_issue(issue, session_id)
    return {
        "issue_id": body.issue_id,
        "action": body.action,
        "workflow": _workflow_status(merged),
        "dashboard": _build_dashboard_payload(session_id),
    }


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
    closure = steward_closure(body.issue_id, session_id)
    return {
        "ok": True,
        "issue_id": body.issue_id,
        "already_resolved": False,
        "closure": closure,
        "dashboard": _build_dashboard_payload(session_id),
    }


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
    if not new_owner:
        new_owner = LOGGED_IN_STEWARD
    overrides = _session_overrides(session_id)
    overrides[body.issue_id] = {**overrides.get(body.issue_id, {}), **new_owner}
    return {"issue_id": body.issue_id, **new_owner}


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
