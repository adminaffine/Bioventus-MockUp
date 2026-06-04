import csv
import datetime
from pathlib import Path

import sqlite3
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/cco", tags=["cco"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

_session_issue_overrides: dict[str, dict[str, dict]] = {}
_initialized_cco_sessions: set[str] = set()
CCO_CSV_SEED_VERSION = 4
CCO_HEATMAP_TOP_N = 5
_PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
_cco_csv_seed_loaded: int | None = None

CCO_TEAM_MEMBERS = [
    {"id": "CCO-01", "name": "Sandra Lee", "team": "Compliance Office"},
    {"id": "CCO-02", "name": "James Torres", "team": "Compliance Team"},
    {"id": "TAX-03", "name": "Jennifer Mills", "team": "Tax Team"},
    {"id": "TAX-04", "name": "Emily Carter", "team": "Tax Team"},
    {"id": "TAX-05", "name": "Robert Chan", "team": "Tax Team"},
    {"id": "FIN-01", "name": "Victoria Hale", "team": "Finance Team"},
    {"id": "FIN-02", "name": "Marcus Webb", "team": "Finance Team"},
]

CROSS_TEAM_OWNERS = {
    "Tax Team": "Jennifer Mills",
    "Compliance Team": "James Torres",
    "Finance Team": "Marcus Webb",
    "Chief Compliance Officer": "Sandra Lee",
    "Chief Financial Officer": "Victoria Hale",
    "SAP Team": "Marcus Hale",
}

CAPA_MASTER = {
    "CAPA-007": {
        "area": "State Tax Compliance — Multi-Jurisdiction",
        "status": "In Progress",
        "owner": "Sandra Lee",
        "due": "2026-05-10",
        "health": "At Risk",
    },
    "CAPA-011": {
        "area": "GPO Contract Compliance — Filing Accuracy",
        "status": "Open",
        "owner": "James Torres",
        "due": "2026-05-20",
        "health": "On Track",
    },
    "CAPA-003": {
        "area": "FDA QMSR — 21 CFR Part 820",
        "status": "Breached",
        "owner": "Sofia Petrov",
        "due": "2026-04-30",
        "health": "Breached",
    },
}

POLICY_VIOLATION_TRACKER = [
    {"severity": "Critical", "count": 3, "teams": "Tax Team + Finance Team"},
    {"severity": "High", "count": 6, "teams": "Pricing Team + Tax Team"},
    {"severity": "Medium", "count": 4, "teams": "Finance Team + Compliance Team"},
]

COMPLIANCE_TREND = [
    {"kpi": "Regulatory Penalty Exposure", "trend": "Up 9% vs last period", "status": "Needs Attention"},
    {"kpi": "CAPA Resolution Rate", "trend": "68% on-time closure rate vs target", "status": "At Risk"},
    {"kpi": "Audit Readiness Score", "trend": "Down 4% vs last period", "status": "Needs Attention"},
]

CAPA_STATUS_OVERVIEW = [
    {
        "capa_id": "CAPA-007",
        "area": "State Tax Compliance — Multi-Jurisdiction",
        "status": "In Progress",
        "owner": "Sandra Lee",
        "due_date": "2026-05-10",
        "health": "At Risk",
    },
    {
        "capa_id": "CAPA-011",
        "area": "GPO Contract Compliance — Filing Accuracy",
        "status": "Open",
        "owner": "James Torres",
        "due_date": "2026-05-20",
        "health": "On Track",
    },
    {
        "capa_id": "CAPA-003",
        "area": "FDA QMSR — 21 CFR Part 820",
        "status": "Breached",
        "owner": "Sofia Petrov",
        "due_date": "2026-04-30",
        "health": "Breached",
    },
]

UPCOMING_DEADLINES = [
    {
        "filing": "North Carolina State Filing",
        "due_date": "2026-05-12",
        "days_remaining": 14,
        "status": "At Risk",
    },
    {
        "filing": "FDA QMSR Annual Submission",
        "due_date": "2026-05-18",
        "days_remaining": 20,
        "status": "On Track",
    },
    {
        "filing": "Arizona Transaction Privilege Tax Filing",
        "due_date": "2026-05-25",
        "days_remaining": 27,
        "status": "On Track",
    },
]


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
    """First request after a browser refresh: restore seed Open status and clear in-memory overrides."""
    if session_id in _initialized_cco_sessions:
        return
    _initialized_cco_sessions.add(session_id)
    _session_issue_overrides.pop(session_id, None)
    with _connect() as conn:
        conn.execute("UPDATE cco_compliance_issues SET status = 'Open'")
        conn.commit()


def _is_open_issue(issue: dict) -> bool:
    return str(issue.get("status") or "Open").strip().lower() == "open"


def _is_high_priority(priority: str | None) -> bool:
    p = (priority or "").strip().upper()
    return p in ("CRITICAL", "HIGH")


def _build_cco_risk_heatmap(open_issues: list[dict]) -> list[dict]:
    """Top N open Critical/High issues by penalty exposure for the dashboard bar chart."""
    high = [i for i in open_issues if _is_open_issue(i) and _is_high_priority(i.get("priority"))]
    high.sort(
        key=lambda i: (
            -float(i.get("penalty_exposure", 0)),
            _PRIORITY_ORDER.get((i.get("priority") or "").strip().upper(), 9),
        )
    )
    rows: list[dict] = []
    for issue in high[:CCO_HEATMAP_TOP_N]:
        issue_type = (issue.get("issue_type") or "Unknown").strip()
        p = (issue.get("priority") or "").strip().upper()
        rows.append(
            {
                "issue_id": issue["issue_id"],
                "risk_area": issue_type,
                "label": f"{issue.get('account_name', '')} · {issue_type}",
                "severity": "Critical" if p == "CRITICAL" else "Caution",
                "issues_at_risk": 1,
                "penalty_exposure": round(float(issue.get("penalty_exposure", 0))),
                "priority": issue.get("priority"),
            }
        )
    return rows


def _build_cco_ai_recommendation_lines(issue: dict) -> list[str]:
    lines: list[str] = []
    if issue.get("ai_fix_1"):
        lines.append(str(issue["ai_fix_1"]).strip())
    if issue.get("ai_fix_2") and float(issue.get("ai_confidence_2") or 0) > 0:
        lines.append(str(issue["ai_fix_2"]).strip())
    return lines


def _merge_issue(issue: dict, session_id: str) -> dict:
    merged = dict(issue)
    override = _session_overrides(session_id).get(issue["issue_id"])
    if override:
        merged.update(override)
    lines = _build_cco_ai_recommendation_lines(merged)
    merged["ai_recommendation_lines"] = lines
    merged["ai_fix_display"] = " · ".join(lines) if len(lines) > 1 else (lines[0] if lines else "")
    return merged


def _reload_cco_issues_from_csv(conn: sqlite3.Connection, csv_path: Path) -> None:
    conn.execute("DELETE FROM cco_compliance_issues")
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        rows = [row + [""] * (39 - len(row)) for row in reader if row]
    conn.executemany(
        "INSERT OR IGNORE INTO cco_compliance_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                r[0],
                r[1],
                r[2],
                r[3],
                r[4],
                r[5],
                float(r[6]),
                int(r[7]),
                int(r[8]),
                r[9],
                r[10],
                int(r[11]),
                int(r[12]),
                r[13],
                r[14],
                r[15],
                r[16],
                r[17],
                r[18],
                r[19],
                r[20],
                r[21],
                r[22],
                float(r[23]),
                r[24],
                r[25],
                float(r[26]) if r[26] else 0.0,
                r[27],
                r[28],
                r[29],
                r[30],
                r[31],
                r[32],
                r[33],
                r[34],
                r[35],
                r[36],
                r[37],
                r[38],
            )
            for r in rows
        ],
    )


def _ensure_cco_table_seeded() -> None:
    """Create CCO table and seed from CSV when missing or after data version bump."""
    global _cco_csv_seed_loaded
    if _cco_csv_seed_loaded == CCO_CSV_SEED_VERSION:
        return

    csv_path = Path(__file__).resolve().parent.parent / "data" / "csv" / "cco_compliance_issues.csv"
    with _connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS cco_compliance_issues (
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
        )"""
        )
        if csv_path.is_file():
            _reload_cco_issues_from_csv(conn, csv_path)
        conn.commit()

    _cco_csv_seed_loaded = CCO_CSV_SEED_VERSION


def _load_issues(session_id: str) -> list[dict]:
    _ensure_cco_table_seeded()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM cco_compliance_issues ORDER BY penalty_exposure DESC, sla_days_remaining ASC"
        ).fetchall()
    return [_merge_issue(dict(r), session_id) for r in rows]


def _open_issues_for_before_snapshot(issues: list[dict], issue_id: str) -> list[dict]:
    return [i for i in issues if _is_open_issue(i) or i.get("issue_id") == issue_id]


def _ai_eligible(issue: dict) -> bool:
    if not _is_open_issue(issue):
        return False
    if issue.get("ai_decision"):
        return False
    return float(issue.get("ai_confidence_1", 0) or 0) >= 80 and bool(issue.get("ai_fix_1"))


def _build_high_value_approval_queue(open_issues: list[dict], limit: int = 1) -> list[dict]:
    """Open issues ranked by penalty exposure — C-suite approval queue (highest $ first)."""
    pending = [i for i in open_issues if _is_open_issue(i)]
    return sorted(pending, key=lambda x: -float(x.get("penalty_exposure", 0) or 0))[:limit]


def _format_currency(value: float) -> str:
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    return f"${value:,.0f}"


def _capa_breach_value(open_issues: list[dict]) -> int:
    """Count open issues flagged with CAPA breach risk (matches KPI drill-down list)."""
    return sum(1 for issue in open_issues if int(issue.get("capa_breach_risk") or 0) == 1)


def _audit_readiness_value(open_count: int) -> int:
    return max(0, 100 - open_count * 2)


def _compute_kpi_cards(open_issues: list[dict]) -> dict:
    penalty_total = round(sum(float(i.get("penalty_exposure", 0)) for i in open_issues), 2)
    capa_value = _capa_breach_value(open_issues)
    audit_value = _audit_readiness_value(len(open_issues))
    predicted_annual = round(penalty_total * 43)

    audit_display = f"{audit_value}% — At Risk" if audit_value < 80 else f"{audit_value}%"

    return {
        "regulatory_penalty_exposure": {
            "value": penalty_total,
            "label": "Regulatory Penalty Exposure",
            "display": _format_currency(penalty_total),
            "description": (
                "Total penalty risk from open jurisdiction mismatches, filing errors, "
                "and compliance violations pending resolution"
            ),
            "unit": "dollars",
        },
        "capa_breach_risk": {
            "value": capa_value,
            "label": "CAPA Breach Risk",
            "display": str(capa_value),
            "description": (
                "Corrective and preventive action plans that are overdue or at risk "
                "of breaching their deadline"
            ),
            "unit": "count",
        },
        "audit_readiness_score": {
            "value": audit_value,
            "label": "Audit Readiness Score",
            "display": audit_display,
            "description": "Organization's current readiness level across all active compliance domains",
            "unit": "percent",
        },
        "predicted_annual_risk": {
            "value": predicted_annual,
            "label": "Predicted Annual Regulatory Risk",
            "display": _format_currency(predicted_annual),
            "description": (
                "Annualized projection of current-period compliance exposure if open issues "
                "remain unresolved"
            ),
            "unit": "dollars",
        },
    }


def _kpi_impact_snapshot(before: dict, after: dict) -> dict:
    impact = {}
    for key in before:
        b = float(before[key]["value"])
        a = float(after[key]["value"])
        impact[key] = {
            "before": b,
            "after": a,
            "delta": round(a - b, 2),
            "label": before[key]["label"],
        }
    return impact


def _sorted_open_issues(open_issues: list[dict]) -> list[dict]:
    return sorted(
        open_issues,
        key=lambda x: (
            -float(x.get("penalty_exposure", 0)),
            int(x.get("sla_days_remaining") or 0),
        ),
    )


def _build_headline(open_issues: list[dict], kpi_cards: dict) -> dict:
    pre_invoice = sum(1 for i in open_issues if int(i.get("pre_invoice") or 0) == 1)
    penalty_total = float(kpi_cards["regulatory_penalty_exposure"]["value"])
    predicted = float(kpi_cards["predicted_annual_risk"]["value"])
    return {
        "total_compliance_exposure": penalty_total,
        "open_issues": len(open_issues),
        "pre_invoice": pre_invoice,
        "annualized_regulatory_risk": predicted,
        "display_exposure": kpi_cards["regulatory_penalty_exposure"]["display"],
        "display_annualized": kpi_cards["predicted_annual_risk"]["display"],
    }


def _lookup_capa_entries(capa_ids: str) -> list[dict]:
    entries: list[dict] = []
    for capa_id in (capa_ids or "").split(","):
        capa_id = capa_id.strip()
        if not capa_id:
            continue
        master = CAPA_MASTER.get(capa_id)
        if master:
            entries.append({"id": capa_id, **master})
    return entries


def _build_what_happened(issue: dict) -> str:
    order_id = issue.get("order_id", "")
    account_name = issue.get("account_name", "")
    invoice_status = str(issue.get("invoice_status") or "Unknown")
    sla = int(issue.get("sla_days_remaining") or 0)
    pre_invoice = int(issue.get("pre_invoice") or 0) == 1
    timing = "to invoice" if pre_invoice else "since invoicing"
    root_cause = (issue.get("root_cause_primary") or "").strip()
    legal_risk = (issue.get("legal_risk") or "").strip()
    penalty = float(issue.get("penalty_exposure", 0))
    capa_note = ""
    if int(issue.get("capa_breach_risk") or 0):
        capa_note = " CAPA breach risk."
    return (
        f"Order {order_id} for {account_name} is {invoice_status.lower()} with {sla} days "
        f"{timing}. {root_cause} {legal_risk} If unresolved, the organization faces a regulatory "
        f"penalty of ${penalty:,.0f} and CAPA breach risk.{capa_note}"
    ).strip()


def _build_compliance_risk(issue: dict) -> list[dict]:
    risks: list[dict] = []
    penalty = float(issue.get("penalty_exposure", 0))
    pre_invoice = int(issue.get("pre_invoice") or 0) == 1
    avoid_note = (
        "Fully avoidable if jurisdiction corrected before invoicing"
        if pre_invoice
        else "Penalty exposure increases if correction delayed post-invoice"
    )
    risks.append(
        {
            "risk_type": "Regulatory Penalty Exposure",
            "value": f"${penalty:,.0f}",
            "note": avoid_note,
        }
    )

    applied = (issue.get("applied_jurisdiction") or "").strip()
    correct = (issue.get("correct_jurisdiction") or "").strip()
    if applied or correct:
        states = " + ".join(s for s in {applied, correct} if s)
        risks.append(
            {
                "risk_type": "State Audit Risk",
                "value": f"{states} tax authorities" if states else "Multi-state review",
                "note": (
                    f"Filing error triggers review across {states}"
                    if states
                    else "Jurisdiction mismatch triggers regulatory review"
                ),
            }
        )

    capa_ids = (issue.get("capa_ids") or "").strip()
    if capa_ids:
        first_capa = capa_ids.split(",")[0].strip()
        master = CAPA_MASTER.get(first_capa, {})
        due = master.get("due", "upcoming deadline")
        risks.append(
            {
                "risk_type": "CAPA Breach Risk",
                "value": f"{first_capa} at risk",
                "note": (
                    f"{master.get('area', 'Linked CAPA')} deadline is {due} — "
                    "this issue is a direct contributor"
                ),
            }
        )

    legal = (issue.get("legal_risk") or "").strip()
    if legal:
        risks.append({"risk_type": "Legal Risk", "value": legal, "note": issue.get("severity_category", "")})

    return risks


def _build_ai_recommendations(issue: dict) -> list[dict]:
    recs: list[dict] = []
    if issue.get("ai_fix_1"):
        recs.append(
            {
                "fix": issue["ai_fix_1"],
                "confidence": float(issue.get("ai_confidence_1") or 0),
                "source": issue.get("ai_source_1") or "",
            }
        )
    if issue.get("ai_fix_2") and float(issue.get("ai_confidence_2") or 0) > 0:
        recs.append(
            {
                "fix": issue["ai_fix_2"],
                "confidence": float(issue.get("ai_confidence_2") or 0),
                "source": issue.get("ai_source_2") or "",
            }
        )
    return recs


def _build_owners(issue: dict) -> list[dict]:
    owners: list[dict] = []
    sla_remaining = f"{issue.get('sla_days_remaining', 0)} days remaining"
    opened = issue.get("opened_date", "")

    if issue.get("tax_owner_id"):
        owners.append(
            {
                "owner_id": issue["tax_owner_id"],
                "owner_name": issue.get("tax_owner_name"),
                "team": issue.get("tax_owner_team"),
                "assigned_on": opened,
                "next_action": issue.get("next_action_tax") or "",
                "sla_remaining": sla_remaining,
            }
        )
    if issue.get("compliance_owner_id"):
        owners.append(
            {
                "owner_id": issue["compliance_owner_id"],
                "owner_name": issue.get("compliance_owner_name"),
                "team": issue.get("compliance_owner_team"),
                "assigned_on": opened,
                "next_action": issue.get("next_action_compliance") or "",
                "sla_remaining": sla_remaining,
            }
        )
    return owners


def _build_regulation_references(issue: dict) -> list[dict]:
    refs: list[dict] = []
    state = (issue.get("regulation_state") or "").strip()
    statute = (issue.get("regulation_statute") or "").strip()
    requirement = (issue.get("regulation_requirement") or "").strip()
    if state or statute or requirement:
        refs.append({"state": state, "statute": statute, "requirement": requirement})

    applied = (issue.get("applied_jurisdiction") or "").strip()
    correct = (issue.get("correct_jurisdiction") or "").strip()
    if applied and applied != state:
        refs.append(
            {
                "state": applied,
                "statute": issue.get("regulation_statute", ""),
                "requirement": "Transaction Privilege Tax — Incorrect jurisdiction creates penalty and audit exposure",
            }
        )
    if correct and correct != state and correct != applied:
        refs.append(
            {
                "state": correct,
                "statute": issue.get("regulation_statute", ""),
                "requirement": issue.get("regulation_requirement", ""),
            }
        )
    return refs


def _resolution_type_label(issue: dict) -> str:
    issue_type = issue.get("issue_type", "")
    capa_ids = (issue.get("capa_ids") or "").strip()
    parts: list[str] = []
    if "Jurisdiction" in issue_type:
        applied = issue.get("applied_jurisdiction", "prior state")
        correct = issue.get("correct_jurisdiction", "correct state")
        parts.append(
            f"Request Jurisdiction Correction from {applied} to {correct}"
        )
    if "GPO" in issue_type:
        parts.append("Request for GPO Contract Reconciliation + Audit Flag Clearance")
    if "FDA" in issue_type or "QMSR" in issue_type:
        parts.append("Request for QMSR Documentation Filing")
    if "Exemption" in issue_type:
        parts.append("Request for Tax Exemption Certificate to be Applied")
    if "CAPA" in issue_type and capa_ids:
        parts.append(f"Request for {capa_ids.split(',')[0].strip()} to be Updated")
    if not parts:
        return "Request for Compliance Issue Resolution in ERP and SAP"
    return " + ".join(parts)


def _build_closure_payload(issue: dict, kpi_before: dict, kpi_after: dict) -> dict:
    today = datetime.date.today().isoformat()
    owner_names = []
    if issue.get("tax_owner_name"):
        owner_names.append(issue["tax_owner_name"])
    if issue.get("compliance_owner_name"):
        owner_names.append(issue["compliance_owner_name"])
    resolved_by = " + ".join(owner_names) if owner_names else issue.get("cco_assignee", "CCO")

    what_was_updated: list[str] = []
    applied = issue.get("applied_jurisdiction", "")
    correct = issue.get("correct_jurisdiction", "")
    order_id = issue.get("order_id", "")
    account_id = issue.get("account_id", "")
    issue_type = issue.get("issue_type", "")

    if applied and correct:
        what_was_updated.append(
            f"Request for SAP Jurisdiction Update — {applied} to {correct} for {order_id}"
        )
        what_was_updated.append(
            f"Request for SAP Customer Master data to be updated for {account_id}"
        )
    elif "Jurisdiction" in issue_type:
        what_was_updated.append(f"Request for SAP Jurisdiction Update for {order_id}")

    if issue.get("tax_owner_id") or "Tax" in issue_type:
        tax_action = (issue.get("next_action_tax") or "").strip()
        if tax_action:
            what_was_updated.append(f"Request for {tax_action}")

    if issue.get("compliance_owner_id"):
        compliance_action = (issue.get("next_action_compliance") or "").strip()
        if compliance_action:
            what_was_updated.append(f"Request for {compliance_action}")

    for capa_id in (issue.get("capa_ids") or "").split(","):
        capa_id = capa_id.strip()
        if capa_id:
            what_was_updated.append(f"Request for {capa_id} record updation")

    if issue.get("regulation_state"):
        what_was_updated.append(
            f"Request for State Filing Record Update — {issue['regulation_state']} jurisdiction filing"
        )

    what_was_updated.append("Alert closed and removed from queue once the SAP data is updated")

    ai_action_log = []
    for line in _build_cco_ai_recommendation_lines(issue):
        ai_action_log.append(
            {
                "fix": line,
                "approved_by": "CCO",
                "confidence": issue.get("ai_confidence_1", 0),
                "logged_on": today,
            }
        )

    notifications: list[dict] = []
    if issue.get("tax_owner_team"):
        notifications.append(
            {
                "team": issue["tax_owner_team"],
                "owner": issue.get("tax_owner_name") or CROSS_TEAM_OWNERS.get("Tax Team"),
                "notification": (
                    f"Request for jurisdiction correction on {order_id} — "
                    f"address master update for {account_id}"
                ),
            }
        )
    if issue.get("compliance_owner_team"):
        notifications.append(
            {
                "team": issue["compliance_owner_team"],
                "owner": issue.get("compliance_owner_name")
                or CROSS_TEAM_OWNERS.get("Compliance Team"),
                "notification": (
                    f"Request for compliance register update on {order_id} — CAPA status verification"
                ),
            }
        )

    penalty = float(issue.get("penalty_exposure", 0))
    notifications.append(
        {
            "team": "Finance Team",
            "owner": CROSS_TEAM_OWNERS["Finance Team"],
            "notification": f"Request for penalty exposure review — ${penalty:,.0f} regulatory risk",
        }
    )
    notifications.append(
        {
            "team": "Chief Financial Officer",
            "owner": CROSS_TEAM_OWNERS["Chief Financial Officer"] or "CFO",
            "notification": (
                f"Request for compliance exposure update — ${penalty:,.0f} regulatory risk posture"
            ),
        }
    )
    notifications.append(
        {
            "team": "SAP Team",
            "owner": CROSS_TEAM_OWNERS["SAP Team"],
            "notification": "Request for SAP master data correction",
        }
    )

    return {
        "resolution_confirmation": {
            "issue": f"{issue.get('issue_type')} — {order_id}",
            "resolved_by": resolved_by,
            "date": issue.get("resolved_at", today),
            "resolution_type": _resolution_type_label(issue),
            "exposure_recovered": penalty,
        },
        "what_was_updated": what_was_updated,
        "ai_action_log": ai_action_log,
        "kpi_impact": _kpi_impact_snapshot(kpi_before, kpi_after),
        "cross_team_notifications": notifications,
        "issue_id": issue["issue_id"],
        "account_id": account_id,
        "order_id": order_id,
    }


def _build_month_on_month(kpi_cards: dict, open_count: int) -> list[dict]:
    """Trailing six months — penalty exposure, open issues, CAPA breach count."""
    penalty = float(kpi_cards["regulatory_penalty_exposure"]["value"])
    capa = int(kpi_cards["capa_breach_risk"]["value"])
    months = [
        ("Dec", 1.28, 1.22, 1.30),
        ("Jan", 1.18, 1.14, 1.20),
        ("Feb", 1.10, 1.08, 1.12),
        ("Mar", 1.06, 1.05, 1.08),
        ("Apr", 1.03, 1.02, 1.04),
        ("May", 1.0, 1.0, 1.0),
    ]
    return [
        {
            "month": label,
            "penalty_exposure": round(penalty * pen_m),
            "open_issues": max(1, round(open_count * iss_m)),
            "capa_breach_risk": max(0, round(capa * cap_m)),
        }
        for label, pen_m, iss_m, cap_m in months
    ]


def _build_dashboard(all_issues: list[dict]) -> dict:
    open_issues = [i for i in all_issues if _is_open_issue(i)]
    kpi_cards = _compute_kpi_cards(open_issues)
    sorted_open = _sorted_open_issues(open_issues)

    return {
        "headline": _build_headline(open_issues, kpi_cards),
        "kpi_cards": kpi_cards,
        "month_on_month": _build_month_on_month(kpi_cards, len(open_issues)),
        "policy_violation_tracker": POLICY_VIOLATION_TRACKER,
        "compliance_trend": COMPLIANCE_TREND,
        "top_alerts": sorted_open[:8],
        "capa_status": CAPA_STATUS_OVERVIEW,
        "upcoming_deadlines": UPCOMING_DEADLINES,
        "ai_queue": [i for i in sorted_open if _ai_eligible(i)],
        "high_value_approval_queue": _build_high_value_approval_queue(open_issues),
        "all_open_issues": sorted_open,
        "risk_heatmap": _build_cco_risk_heatmap(open_issues),
    }


class CCOApproveRequest(BaseModel):
    issue_id: str


class CCOReassignRequest(BaseModel):
    issue_id: str
    owner_id: str
    owner_name: str


@router.get("/dashboard")
def cco_dashboard(session_id: str = Depends(get_cco_demo_session)):
    _reset_demo_issues_for_fresh_session(session_id)
    return _build_dashboard(_load_issues(session_id))


@router.get("/issue/{issue_id}")
def cco_issue_detail(issue_id: str, session_id: str = Depends(get_cco_demo_session)):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM cco_compliance_issues WHERE issue_id = ?", (issue_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")

    issue = _merge_issue(dict(row), session_id)
    sla = int(issue.get("sla_days_remaining") or 0)
    pre_invoice = int(issue.get("pre_invoice") or 0) == 1
    sla_label = f"{sla} days to invoice" if pre_invoice else f"{sla} days remaining"

    return {
        "issue": issue,
        "header": {
            "issue_type": issue.get("issue_type"),
            "account": f"{issue.get('account_id')} {issue.get('account_name')} — {issue.get('order_id')}",
            "priority": issue.get("priority"),
            "penalty_exposure": float(issue.get("penalty_exposure", 0)),
            "opened_on": issue.get("opened_date"),
            "invoice_status": issue.get("invoice_status"),
            "sla": sla_label,
        },
        "what_happened": _build_what_happened(issue),
        "compliance_risk": _build_compliance_risk(issue),
        "owners": _build_owners(issue),
        "ai_recommendations": _build_cco_ai_recommendation_lines(issue),
        "capa_entries": _lookup_capa_entries(issue.get("capa_ids", "")),
        "regulation_references": _build_regulation_references(issue),
        "reassign_options": CCO_TEAM_MEMBERS,
    }


@router.get("/closure/{issue_id}")
def cco_closure(issue_id: str, session_id: str = Depends(get_cco_demo_session)):
    overrides = _session_overrides(session_id)
    snapshot = overrides.get(issue_id, {}).get("closure_snapshot")
    if snapshot:
        return snapshot

    all_issues = _load_issues(session_id)
    issue = next((i for i in all_issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")

    before_open = _open_issues_for_before_snapshot(all_issues, issue_id)
    after_open = [i for i in all_issues if _is_open_issue(i) and i["issue_id"] != issue_id]
    kpi_before = _compute_kpi_cards(before_open)
    kpi_after = _compute_kpi_cards(after_open)
    return _build_closure_payload(issue, kpi_before, kpi_after)


@router.post("/approve")
def cco_approve(req: CCOApproveRequest, session_id: str = Depends(get_cco_demo_session)):
    today = datetime.date.today().isoformat()
    overrides = _session_overrides(session_id)
    existing = overrides.get(req.issue_id, {})
    if existing.get("status") == "Resolved" and existing.get("closure_snapshot"):
        dashboard = _build_dashboard(_load_issues(session_id))
        return {"dashboard": dashboard, "closure": existing["closure_snapshot"]}

    before_issues = _load_issues(session_id)
    issue_before = next((i for i in before_issues if i["issue_id"] == req.issue_id), None)
    if not issue_before:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")

    before_open = [i for i in before_issues if _is_open_issue(i)]
    kpi_before = _compute_kpi_cards(before_open)

    overrides[req.issue_id] = {
        **existing,
        "status": "Resolved",
        "cco_assignee": issue_before.get("cco_assignee") or "CCO",
        "ai_decision": "approve",
        "resolved_at": today,
    }

    after_issues = _load_issues(session_id)
    issue = next(i for i in after_issues if i["issue_id"] == req.issue_id)
    after_open = [i for i in after_issues if _is_open_issue(i)]
    kpi_after = _compute_kpi_cards(after_open)
    closure = _build_closure_payload(issue, kpi_before, kpi_after)
    overrides[req.issue_id]["closure_snapshot"] = closure
    overrides[req.issue_id]["kpi_before"] = kpi_before
    overrides[req.issue_id]["kpi_after"] = kpi_after

    dashboard = _build_dashboard(after_issues)
    return {"dashboard": dashboard, "closure": closure}


@router.post("/reassign")
def cco_reassign(req: CCOReassignRequest, session_id: str = Depends(get_cco_demo_session)):
    overrides = _session_overrides(session_id)
    overrides[req.issue_id] = {
        **overrides.get(req.issue_id, {}),
        "cco_assignee": req.owner_name,
        "status": "Open",
    }
    return _build_dashboard(_load_issues(session_id))


@router.get("/team-members")
def cco_team_members():
    return {"members": CCO_TEAM_MEMBERS}
