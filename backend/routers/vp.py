import csv
import datetime
import re
from pathlib import Path

import sqlite3
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/vp", tags=["vp"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"
VP_CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "csv" / "vp_alerts.csv"

_session_issue_overrides: dict[str, dict[str, dict]] = {}
_initialized_vp_sessions: set[str] = set()
_vp_table_ready = False

VP_TEAM_MEMBERS = [
    {"id": "TAX-03", "name": "Jennifer Mills", "team": "Tax Team"},
    {"id": "TAX-04", "name": "Emily Carter", "team": "Tax Team"},
    {"id": "TAX-05", "name": "Robert Chan", "team": "Tax Team"},
    {"id": "PRICE-04", "name": "David Chen", "team": "Pricing Team"},
    {"id": "PRICE-05", "name": "Sarah Mitchell", "team": "Pricing Team"},
    {"id": "FIN-01", "name": "Victoria Hale", "team": "Finance Team"},
    {"id": "FIN-02", "name": "Marcus Webb", "team": "Finance Team"},
    {"id": "FIN-03", "name": "Rachel Kim", "team": "Finance Team"},
    {"id": "CCO-01", "name": "Sandra Lee", "team": "Compliance Team"},
    {"id": "CCO-02", "name": "James Torres", "team": "Compliance Team"},
]

_PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

VP_CROSS_TEAM_NOTIFY_OWNERS = {
    "Tax Team": "Jennifer Mills",
    "Pricing Team": "David Chen",
    "SAP Team": "Marcus Hale",
}

_HEADLINE_TOTAL_OPEN = 47
_HEADLINE_SLA_BREACH_RISK = 9
_HEADLINE_ESCALATION_QUEUE = 4
_HEADLINE_TEAM_RESOLUTION_RATE = 71

_TEAM_SCORECARD = [
    {
        "team": "Tax & Compliance Team",
        "open_issues": 26,
        "sla_status": "At Risk",
        "resolution_rate": 66,
        "health_status": "At Risk",
        "health_detail": "CAPA-007 contributor unresolved; 2 issues within 1 day of SLA breach",
    },
    {
        "team": "Pricing Team",
        "open_issues": 9,
        "sla_status": "Watch",
        "resolution_rate": 79,
        "health_status": "Watch",
        "health_detail": "Resolution rate improving but SLA risk remains",
    },
    {
        "team": "Finance Team",
        "open_issues": 12,
        "sla_status": "On Track",
        "resolution_rate": 81,
        "health_status": "On Track",
        "health_detail": "Lowest breach risk this period",
    },
]

_SCORECARD_TEAM_SOURCES = {
    "Tax & Compliance Team": ("Tax Team", "Compliance Team"),
}

_VP_ALERTS_DDL = """
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
"""

_VP_INSERT_SQL = """
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
"""


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


def _reload_vp_alerts_from_csv(conn: sqlite3.Connection) -> None:
    if not VP_CSV_PATH.is_file():
        return
    with open(VP_CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            conn.execute(_VP_INSERT_SQL, row)


def _ensure_vp_alerts_ready() -> None:
    """Create vp_alerts and seed from CSV when missing (existing DBs without migration)."""
    global _vp_table_ready
    if _vp_table_ready:
        return
    with _connect() as conn:
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='vp_alerts'"
        ).fetchone()
        if not cur:
            conn.execute(_VP_ALERTS_DDL)
            _reload_vp_alerts_from_csv(conn)
            conn.commit()
        elif VP_CSV_PATH.is_file():
            count = conn.execute("SELECT COUNT(*) FROM vp_alerts").fetchone()[0]
            if count == 0:
                _reload_vp_alerts_from_csv(conn)
                conn.commit()
    _vp_table_ready = True


def _reset_vp_alerts_to_seed(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM vp_alerts")
    _reload_vp_alerts_from_csv(conn)


def _reset_all_vp_demo_state() -> None:
    _session_issue_overrides.clear()
    _initialized_vp_sessions.clear()


def _reset_demo_issues_for_fresh_session(session_id: str) -> None:
    if session_id in _initialized_vp_sessions:
        return
    _initialized_vp_sessions.add(session_id)
    _session_issue_overrides.pop(session_id, None)
    with _connect() as conn:
        conn.execute("UPDATE vp_alerts SET status = 'Open'")
        conn.commit()


def _is_open_issue(issue: dict) -> bool:
    if str(issue.get("status") or "Open").strip().lower() != "open":
        return False
    # VP-approved issues leave the open queue even if status merge lags
    if issue.get("ai_decision") == "approve":
        return False
    return True


def _sla_days_remaining(issue: dict, default: int = 999) -> int:
    """Return SLA days; 0 is valid (breached) — do not use `or` which treats 0 as missing."""
    val = issue.get("sla_days_remaining")
    if val is None or val == "":
        return default
    return int(val)


def _merge_issue(issue: dict, session_id: str) -> dict:
    merged = dict(issue)
    override = _session_overrides(session_id).get(issue["issue_id"])
    if override:
        merged.update(override)
    id_to_name = {m["id"]: m["name"] for m in VP_TEAM_MEMBERS}
    owner_id = merged.get("current_owner_id")
    if owner_id and owner_id in id_to_name:
        merged["current_owner_name"] = id_to_name[owner_id]
    secondary_id = merged.get("secondary_owner_id")
    if secondary_id and secondary_id in id_to_name:
        merged["secondary_owner_name"] = id_to_name[secondary_id]
    return merged


def _load_issues(session_id: str) -> list[dict]:
    _ensure_vp_alerts_ready()
    _reset_demo_issues_for_fresh_session(session_id)
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM vp_alerts ORDER BY sla_days_remaining ASC, priority DESC"
        ).fetchall()
    return [_merge_issue(dict(r), session_id) for r in rows]


def _team_health_from_scorecard(scorecard: list[dict] | None = None) -> list[dict]:
    rows = scorecard if scorecard is not None else _TEAM_SCORECARD
    return [
        {
            "team": row["team"],
            "status": row["sla_status"],
            "resolution_rate": row["resolution_rate"],
            "detail": row["health_detail"],
        }
        for row in rows
    ]


def _is_sla_risk_issue(issue: dict) -> bool:
    health = str(issue.get("sla_health") or "")
    sla = _sla_days_remaining(issue, default=999)
    return health in ("At Risk", "Breached") or sla <= 2


def _is_escalation_issue(issue: dict) -> bool:
    return str(issue.get("priority") or "").upper() in ("CRITICAL", "HIGH")


def _effective_team_scorecard(issues: list[dict]) -> list[dict]:
    open_issues = [i for i in issues if _is_open_issue(i)]
    rows = []
    for baseline in _TEAM_SCORECARD:
        team = baseline["team"]
        sources = _SCORECARD_TEAM_SOURCES.get(team, (team,))
        open_count = sum(1 for i in open_issues if i.get("team") in sources)
        resolved_delta = max(0, baseline["open_issues"] - open_count)
        rows.append(
            {
                **baseline,
                "open_issues": open_count,
                "resolution_rate": min(100, baseline["resolution_rate"] + resolved_delta * 2),
            }
        )
    return rows


def _headline_from_open_issues(open_issues: list[dict], resolved_count: int = 0) -> dict:
    return {
        "total_open_issues": len(open_issues),
        "sla_breach_risk": sum(1 for i in open_issues if _is_sla_risk_issue(i)),
        "escalation_queue": sum(1 for i in open_issues if _is_escalation_issue(i)),
        "team_resolution_rate": min(100, _HEADLINE_TEAM_RESOLUTION_RATE + (resolved_count * 2)),
    }


def _kpi_impact_for_closed_issue(issues: list[dict], closing_issue: dict) -> dict:
    open_before = [i for i in issues if _is_open_issue(i)]
    resolved_count = sum(1 for i in issues if not _is_open_issue(i))
    before = _headline_from_open_issues(open_before, resolved_count)
    open_after = [i for i in open_before if i.get("issue_id") != closing_issue.get("issue_id")]
    after = _headline_from_open_issues(open_after, resolved_count + 1)
    return {
        "Issues Pending Resolution": {
            "before": before["total_open_issues"],
            "after": after["total_open_issues"],
            "label": "Issues Pending Resolution",
        },
        "SLA Breach Risk": {
            "before": before["sla_breach_risk"],
            "after": after["sla_breach_risk"],
            "label": "SLA Breach Risk",
        },
        "Priority Queue": {
            "before": before["escalation_queue"],
            "after": after["escalation_queue"],
            "label": "Priority Queue",
        },
        "Team Resolution Rate": {
            "before": before["team_resolution_rate"],
            "after": after["team_resolution_rate"],
            "label": "Team Resolution Rate",
            "unit": "%",
        },
    }


def _kpi_cards_array(headline: dict) -> list[dict]:
    return [
        {
            "name": "Issues Pending Resolution",
            "value": headline["total_open_issues"],
            "unit": "open",
            "description": "Total unresolved issues across Tax, Pricing, Compliance, and Finance teams",
            "filter_type": "pending",
        },
        {
            "name": "SLA Breach Risk",
            "value": headline["sla_breach_risk"],
            "unit": "open",
            "description": "Issues at risk of or already breaching their resolution deadline",
            "filter_type": "sla_risk",
        },
        {
            "name": "Priority Queue",
            "value": headline["escalation_queue"],
            "unit": "open",
            "description": "Issues that have crossed dollar or regulatory threshold requiring CFO / CCO visibility",
            "filter_type": "escalation",
        },
        {
            "name": "Team Resolution Rate",
            "value": headline["team_resolution_rate"],
            "unit": "%",
            "description": "Percentage of issues resolved on time across all teams this period",
            "filter_type": "resolution_rate",
        },
    ]


def _effective_ai_fix(issue: dict) -> str:
    fix = (issue.get("ai_fix_1") or "").strip()
    if fix:
        return fix
    primary = (issue.get("next_action_primary") or "").strip()
    if primary:
        return primary
    signal = (issue.get("vp_action_signal") or "").strip()
    if signal:
        return f"Monitor and execute: {signal}"
    return _vp_fallback_resolution_statement(issue)


def _effective_ai_confidence(issue: dict) -> float:
    confidence = float(issue.get("ai_confidence_1") or 0)
    return confidence if confidence > 0 else 86.0


def _effective_ai_source(issue: dict) -> str:
    source = (issue.get("ai_source_1") or "").strip()
    return source if source else "Operations Intelligence Engine"


def _issue_to_alert_row(issue: dict) -> dict:
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
        "sla_days_remaining": _sla_days_remaining(issue, default=0),
        "sla_health": issue.get("sla_health") or "On Track",
        "status": issue.get("status") or "Open",
        "ai_fix_1": _effective_ai_fix(issue),
        "ai_confidence_1": _effective_ai_confidence(issue),
        "ai_source_1": _effective_ai_source(issue),
        "ai_fix_2": issue.get("ai_fix_2"),
        "ai_confidence_2": issue.get("ai_confidence_2") or 0,
        "ai_source_2": issue.get("ai_source_2"),
        "ai_decision": issue.get("ai_decision"),
    }


def _alert_sort_key(issue: dict) -> tuple:
    exposure = float(issue.get("dollar_exposure") or 0)
    return (-exposure,)


def _build_dashboard(issues: list[dict]) -> dict:
    open_issues = [i for i in issues if _is_open_issue(i)]
    resolved_count = sum(1 for i in issues if not _is_open_issue(i))
    headline = _headline_from_open_issues(open_issues, resolved_count)

    top_alerts = sorted(open_issues, key=_alert_sort_key)[:8]
    ai_queue = [
        i for i in sorted(open_issues, key=_alert_sort_key) if not i.get("ai_decision")
    ][:3]

    team_scorecard = _effective_team_scorecard(issues)
    return {
        "headline": headline,
        "kpi_cards": _kpi_cards_array(headline),
        "team_health": _team_health_from_scorecard(team_scorecard),
        "team_scorecard": team_scorecard,
        "top_alerts": [_issue_to_alert_row(i) for i in top_alerts],
        "ai_queue": [_issue_to_alert_row(i) for i in ai_queue],
        "all_open_issues": [_issue_to_alert_row(i) for i in open_issues],
    }


def _sla_label(issue: dict) -> str:
    sla_days = int(issue.get("sla_days_remaining") or 0)
    if sla_days <= 0:
        return "SLA Breached"
    if sla_days <= 2:
        return f"{sla_days} day{'s' if sla_days != 1 else ''} to SLA breach"
    return f"{sla_days} days remaining"


def _capa_list(issue: dict) -> list[str]:
    capa_raw = issue.get("capa_ids") or ""
    return [c.strip() for c in capa_raw.replace("|", ",").split(",") if c.strip()]


def _capa_linkage_object(issue: dict) -> dict:
    capa_list = _capa_list(issue)
    primary = capa_list[0] if capa_list else ""
    is_007 = "007" in primary
    return {
        "capa_id": primary,
        "capa_ids": capa_list,
        "area": "Tax Compliance" if is_007 else "GPO Contract Rate Accuracy",
        "status": "In Progress",
        "owner": "Sandra Lee — CCO" if is_007 else "David Chen — Pricing Team",
        "due_date": "2026-05-10" if is_007 else "2026-05-20",
        "regulation": "State Tax Compliance — Multi-Jurisdiction" if is_007 else "GPO Contract Rate Accuracy",
    }


def _workflow_status(issue: dict) -> dict:
    decision = issue.get("ai_decision")
    ai_approved = decision == "approve"
    resolved = str(issue.get("status") or "").lower() == "resolved"
    if ai_approved or resolved:
        path = "ai" if ai_approved else "manual_complete"
    else:
        path = "manual_in_progress"
    return {
        "ai_approved": ai_approved,
        "ai_decision": decision,
        "can_mark_resolved": ai_approved or resolved,
        "resolution_path": path,
    }


_SLA_REMAINING_SUFFIX = re.compile(r"\s*—\s*\d+\s+days?\s+remaining\s*$", re.IGNORECASE)


def _clean_prescribed_action_text(text: str | None) -> str:
    if not text:
        return ""
    return _SLA_REMAINING_SUFFIX.sub("", text.strip()).strip()


def _build_prescribed_actions(issue: dict) -> list[str]:
    order_id = issue.get("order_id") or ""
    account_name = issue.get("account_name") or issue.get("account_id") or ""
    issue_type = issue.get("issue_type") or "issue"
    team = issue.get("team") or issue.get("current_owner_team") or "Operations"
    owner = issue.get("current_owner_name") or "assigned owner"
    primary = _clean_prescribed_action_text(issue.get("next_action_primary") or "")
    secondary = _clean_prescribed_action_text(issue.get("next_action_secondary") or "")
    signal = _clean_prescribed_action_text(issue.get("vp_action_signal") or "")

    steps = [
        f"Step 1 — Confirm {owner} ({team}) owns {order_id} — {issue_type} for {account_name}",
    ]
    if primary:
        steps.append(f"Step 2 — Primary action: {primary}")
    else:
        steps.append(f"Step 2 — Review open actions for {issue_type} on {order_id}")

    if secondary and issue.get("secondary_owner_name"):
        sec = issue.get("secondary_owner_name")
        sec_team = issue.get("secondary_owner_team") or team
        steps.append(f"Step 3 — Secondary owner {sec} ({sec_team}): {secondary}")
    elif issue.get("secondary_owner_name"):
        steps.append(
            f"Step 3 — Align with {issue.get('secondary_owner_name')} "
            f"({issue.get('secondary_owner_team') or team}) on cross-team work"
        )
    else:
        steps.append(f"Step 3 — Monitor {team} progress until {order_id} is cleared")

    if signal:
        steps.append(f"Step 4 — VP signal: {signal}")
    else:
        steps.append("Step 4 — Approve AI recommendation or reassign if SLA is at risk")
    return steps


def _build_preventive_actions(issue: dict) -> list[str]:
    team = str(issue.get("team") or "")
    if "Tax" in team:
        return [
            "Step 1 — Automate jurisdiction validation at order entry against SAP address master",
            "Step 2 — Add pre-invoice SLA checkpoint for tax compliance owners",
            "Step 3 — Quarterly multi-jurisdiction filing audit across affected accounts",
        ]
    if "Pricing" in team:
        return [
            "Step 1 — Enable automated GPO contract rate sync with pricing engine",
            "Step 2 — Add contract verification checkpoint at order creation",
            "Step 3 — Quarterly GPO contract repository and SAP pricing master audit",
        ]
    if "Compliance" in team:
        return [
            "Step 1 — Automate multi-jurisdiction filing obligation detection at order entry",
            "Step 2 — Add compliance register validation before invoice release",
            "Step 3 — Monthly CAPA linkage review for recurring breach patterns",
        ]
    return [
        "Step 1 — Enable automated SLA breach alerts for finance team owners",
        "Step 2 — Add escalation checkpoint when chargeback disputes exceed threshold",
        "Step 3 — Quarterly rebate calculation and contract terms audit",
    ]


def _build_business_risk(issue: dict) -> list[dict]:
    dollar_exposure = float(issue.get("dollar_exposure") or 0)
    margin_at_risk = float(issue.get("margin_at_risk") or 0)
    penalty_exposure = float(issue.get("penalty_exposure") or 0)
    sla_health = issue.get("sla_health") or "On Track"
    pre_invoice = int(issue.get("pre_invoice") or 0) == 1
    margin_pct = round((margin_at_risk / dollar_exposure * 100) if dollar_exposure else 0)
    sla_label = _sla_label(issue)

    return [
        {
            "risk_type": "Revenue at Risk",
            "status": "Preventable" if pre_invoice else "Exposed",
            "detail": (
                "Preventable if resolved before invoicing"
                if pre_invoice
                else "Revenue already recognized — credit memo required"
            ),
        },
        {
            "risk_type": "Margin at Risk",
            "status": "At Risk" if margin_at_risk > 0 else "Clear",
            "detail": f"{margin_pct}% of order value at risk (${margin_at_risk:,.0f})",
        },
        {
            "risk_type": "Penalty Exposure",
            "status": "Elevated" if penalty_exposure > 5000 else "Moderate",
            "detail": f"${penalty_exposure:,.0f} penalty exposure — avoidable if resolved within SLA",
        },
        {
            "risk_type": "SLA Breach Risk",
            "status": sla_health,
            "detail": sla_label,
        },
    ]


def _format_owner_label(name: str | None, team: str | None, owner_id: str | None) -> str | None:
    if not owner_id or owner_id == "Unassigned":
        return None
    display_name = (name or "").strip() or owner_id
    display_team = (team or "").strip()
    if display_team:
        return f"{display_name} ({display_team})"
    return display_name


def _build_owner_summary(issue: dict) -> str:
    owners: list[str] = []
    primary = _format_owner_label(
        issue.get("current_owner_name"),
        issue.get("current_owner_team"),
        issue.get("current_owner_id"),
    )
    if primary:
        owners.append(primary)
    secondary = _format_owner_label(
        issue.get("secondary_owner_name"),
        issue.get("secondary_owner_team"),
        issue.get("secondary_owner_id"),
    )
    if secondary:
        owners.append(secondary)
    if not owners:
        return "No owner assigned"
    if len(owners) == 1:
        return owners[0]
    return f"{owners[0]} and {owners[1]}"


def _build_what_happened(issue: dict) -> str:
    sla_days = int(issue.get("sla_days_remaining") or 0)
    owner_text = _build_owner_summary(issue)
    sla_health = issue.get("sla_health") or "On Track"
    dollar_exposure = float(issue.get("dollar_exposure") or 0)

    if sla_days > 0:
        invoice_part = (
            f"is scheduled to be invoiced in {sla_days} day{'s' if sla_days != 1 else ''}"
        )
    else:
        invoice_part = "has breached its SLA"

    return (
        f"Order {issue.get('order_id')} for {issue.get('account_name')} {invoice_part}. "
        f"{issue.get('root_cause_primary', '')} "
        f"Combined financial exposure is ${dollar_exposure:,.0f}. "
        f"Resolution is owned by {owner_text} — "
        f"{'at risk of breaching SLA' if sla_health in ('At Risk', 'Breached') else 'on track'}."
    )


def _primary_owner_block(issue: dict) -> dict:
    owner_id = issue.get("current_owner_id") or "Unassigned"
    return {
        "owner_id": owner_id,
        "owner_name": issue.get("current_owner_name") or "Unassigned",
        "team": issue.get("current_owner_team") or issue.get("team"),
        "assigned_on": issue.get("opened_date"),
        "next_action": _clean_prescribed_action_text(
            issue.get("next_action_primary") or issue.get("vp_action_signal")
        ) or None,
        "sla_remaining": _sla_label(issue),
        "sla_health": issue.get("sla_health") or "On Track",
        "live_progress": issue.get("live_progress_primary"),
        "completion_pct": int(issue.get("completion_primary") or 0),
    }


def _build_issue_detail(issue: dict) -> dict:
    capa_list = _capa_list(issue)
    ai_fix_1 = _effective_ai_fix(issue)
    ai_fix_2 = (issue.get("ai_fix_2") or "").strip()
    ai_confidence_1 = _effective_ai_confidence(issue)
    ai_source_1 = _effective_ai_source(issue)

    secondary_owner = None
    if issue.get("secondary_owner_id"):
        secondary_owner = {
            "owner_id": issue["secondary_owner_id"],
            "owner_name": issue.get("secondary_owner_name"),
            "team": issue.get("secondary_owner_team"),
            "assigned_on": issue.get("opened_date"),
            "next_action": _clean_prescribed_action_text(issue.get("next_action_secondary")) or None,
            "sla_remaining": _sla_label(issue),
            "sla_health": issue.get("sla_health") or "On Track",
            "live_progress": issue.get("live_progress_secondary"),
            "completion_pct": int(issue.get("completion_secondary") or 0),
        }

    ai_recommendations = [
        {
            "fix": ai_fix_1,
            "fix_type": "Fix 1",
            "confidence": ai_confidence_1,
            "source": ai_source_1,
        }
    ]
    if ai_fix_2:
        ai_recommendations.append(
            {
                "fix": ai_fix_2,
                "fix_type": "Fix 2",
                "confidence": float(issue.get("ai_confidence_2") or 0),
                "source": issue.get("ai_source_2") or "",
            }
        )

    return {
        "issue": issue,
        "header": {
            "issue_type": issue.get("issue_type"),
            "customer": (
                f"{issue.get('account_id')} {issue.get('account_name')} — {issue.get('order_id')}"
            ),
            "priority": issue.get("priority"),
            "dollar_impact": float(issue.get("dollar_exposure") or 0),
            "opened_on": issue.get("opened_date"),
            "sla": _sla_label(issue),
            "invoice_status": issue.get("invoice_status"),
            "margin_at_risk": float(issue.get("margin_at_risk") or 0),
            "sla_health": issue.get("sla_health") or "On Track",
            "resolution_status": f"Pending — {_sla_label(issue)}",
        },
        "what_happened": _build_what_happened(issue),
        "business_risk": _build_business_risk(issue),
        "owner": _primary_owner_block(issue),
        "secondary_owner": secondary_owner,
        "owners": [o for o in [_primary_owner_block(issue), secondary_owner] if o],
        "ai_recommendation": {
            "fix": ai_fix_1,
            "confidence": ai_confidence_1,
            "source": ai_source_1,
            "fix_secondary": ai_fix_2,
            "confidence_secondary": float(issue.get("ai_confidence_2") or 0),
            "source_secondary": issue.get("ai_source_2") or "",
            "order_id": issue.get("order_id") or "",
        },
        "ai_recommendations": ai_recommendations,
        "ai_decision": issue.get("ai_decision"),
        "prescribed_actions": _build_prescribed_actions(issue),
        "why_it_happened": issue.get("root_cause_primary") or "",
        "preventive_actions": _build_preventive_actions(issue),
        "root_cause_secondary": issue.get("root_cause_secondary") or "",
        "capa_linkage": _capa_linkage_object(issue),
        "workflow": _workflow_status(issue),
        "recurrence": {
            "issue_type": issue.get("issue_type"),
            "count": issue.get("recurrence_count") or 0,
            "period": issue.get("recurrence_period") or "this period",
            "capa_exists": issue.get("capa_exists") or "No",
            "capa_ids": capa_list,
            "vp_action_signal": issue.get("vp_action_signal") or "",
        },
        "reassign_options": VP_TEAM_MEMBERS,
    }


def _vp_fallback_resolution_statement(issue: dict) -> str:
    """Issue-type fallback when no AI fix text is on the record (CFO/CCO style)."""
    issue_type = issue.get("issue_type") or ""
    order_id = issue.get("order_id") or ""
    account_id = issue.get("account_id") or ""
    if "Tax Jurisdiction" in issue_type and any(x in issue_type for x in ("Pricing", "GPO")):
        return (
            f"Request Jurisdiction Correction for {order_id} + "
            f"Request for GPO Contract Rate to be Applied for {account_id}"
        )
    if "Tax Jurisdiction" in issue_type or "Jurisdiction" in issue_type:
        return f"Request for SAP Jurisdiction correction for {order_id}"
    if any(x in issue_type for x in ("GPO", "Pricing", "Chargeback", "List Price")):
        exposure = float(issue.get("dollar_exposure") or 0)
        if exposure > 0:
            return (
                f"Request for Credit Memo of ${exposure:,.0f} to be Issued + "
                f"Request for SAP Pricing Master data to be Updated for {account_id}"
            )
        return f"Request for SAP Pricing Master data to be Updated for {account_id}"
    if "Compliance" in issue_type:
        return f"Request for compliance filing correction for {order_id}"
    if "Exemption" in issue_type:
        return f"Request for tax exemption certificate to be applied for {account_id}"
    return f"Request for issue resolution in ERP and SAP for {order_id}"


def _build_vp_resolution_type(issue: dict, action: str, new_owner_name: str | None = None) -> str:
    """Resolution confirmation type — AI recommendation statement (Pricing/Tax/CFO style)."""
    order_id = issue.get("order_id") or ""
    if action == "reassign":
        return (
            f"Request for issue reassignment to {new_owner_name or 'new owner'} for {order_id}"
        )
    if action == "escalate":
        exposure = float(issue.get("dollar_exposure") or 0)
        return (
            f"Request for C-Suite executive review on {order_id} + "
            f"Request for executive escalation — ${exposure:,.0f} exposure"
        )
    if action == "approve":
        fixes: list[str] = []
        ai_fix_1 = (issue.get("ai_fix_1") or "").strip()
        ai_fix_2 = (issue.get("ai_fix_2") or "").strip()
        if ai_fix_1:
            fixes.append(ai_fix_1)
        if ai_fix_2 and float(issue.get("ai_confidence_2") or 0) > 0:
            fixes.append(ai_fix_2)
        if fixes:
            return " + ".join(fixes)
        return _vp_fallback_resolution_statement(issue)
    return _vp_fallback_resolution_statement(issue)


def _owner_team_status(issue: dict, *, primary: bool, closure_action: str) -> str:
    """Cross-team status: Pending or Completed (from owner completion %)."""
    _ = closure_action
    if primary:
        completion = int(issue.get("completion_primary") or 0)
    else:
        completion = int(issue.get("completion_secondary") or 0)
    return "Completed" if completion >= 100 else "Pending"


def _executive_team_status(closure_action: str, role: str) -> str:
    """Executive / SAP notification rows stay Pending until downstream work is done."""
    _ = closure_action, role
    return "Pending"


def _build_vp_what_was_updated(
    issue: dict,
    action: str = "approve",
    new_owner_name: str | None = None,
) -> list[str]:
    """Next actions / what was updated — Pricing, Tax, and CFO closure style."""
    issue_type = issue.get("issue_type") or ""
    order_id = issue.get("order_id") or ""
    account_id = issue.get("account_id") or ""
    capa_list = _capa_list(issue)
    lines: list[str] = []

    if action == "reassign":
        target = new_owner_name or "new owner"
        owner = issue.get("current_owner_name") or "prior owner"
        team = issue.get("current_owner_team") or "Operations"
        lines.append(f"Request for ownership transfer — {order_id} reassigned to {target}")
        lines.append(f"Request for prior owner notification — {owner} ({team})")
        lines.append("Operations dashboard reflects updated ownership")
        return lines

    if action == "escalate":
        exposure = float(issue.get("dollar_exposure") or 0)
        lines.append(f"Request for C-Suite executive review on {order_id}")
        lines.append(f"Request for executive escalation log update — ${exposure:,.0f} exposure flagged")
        lines.append("Request for CFO and CCO notification on escalated issue")
        lines.append("Alert removed from VP open queue — tracked on executive escalation log")
        return lines

    if "Tax" in issue_type or "Jurisdiction" in issue_type:
        lines.append(f"Request for SAP Jurisdiction correction for {order_id}")
        lines.append(f"Request for Address Master data to be updated for {account_id}")
    if any(x in issue_type for x in ("Pricing", "GPO", "Chargeback", "List Price")):
        lines.append(f"Request for SAP Pricing Master data to be updated for {account_id}")
        exposure = float(issue.get("dollar_exposure") or 0)
        if exposure > 0 and any(x in issue_type for x in ("Chargeback", "Pricing", "GPO", "List Price")):
            lines.append(f"Request for Credit Memo to be issued for {order_id} — ${exposure:,.0f}")
    if "Compliance" in issue_type:
        lines.append(f"Request for compliance filing correction for {order_id}")
    if "Exemption" in issue_type:
        lines.append(
            f"Request for tax exemption certificate to be applied for {account_id} before invoicing {order_id}"
        )
    for capa in capa_list:
        lines.append(f"Request for {capa} to be updated")
    lines.append("Alert closed and removed from queue once the SAP data is updated")
    return lines


def _vp_cross_team_notification_message(issue: dict, team: str) -> str:
    """Cross-team row copy — aligned with Pricing / Tax / CCO personas."""
    order_id = issue.get("order_id") or "N/A"
    account_id = issue.get("account_id") or ""
    account_name = issue.get("account_name") or account_id
    issue_type = issue.get("issue_type") or ""
    capa_label = ", ".join(_capa_list(issue)) or "CAPA"
    team_lower = (team or "").lower()
    exposure = float(issue.get("dollar_exposure") or 0)
    penalty = float(issue.get("penalty_exposure") or 0)

    if "tax" in team_lower:
        if "Exemption" in issue_type:
            return (
                f"Request for tax exemption certificate renewal for {account_name} — "
                f"{order_id} hold until applied"
            )
        return (
            f"Order {order_id} jurisdiction correction requested — "
            f"address master update for {account_id}"
        )
    if "pricing" in team_lower:
        return (
            f"Request for contract rate application on {order_id} — "
            f"pricing engine update for {account_id}"
        )
    if "finance" in team_lower:
        return (
            f"Request for chargeback and rebate reconciliation on {order_id} — "
            f"credit memo review ${exposure:,.0f} may apply"
        )
    if "compliance" in team_lower:
        return (
            f"Request for compliance filing correction on {order_id} — "
            f"{capa_label} linkage, penalty exposure ${penalty:,.0f}"
        )
    if "chief financial" in team_lower:
        return f"Request for revenue exposure update — ${exposure:,.0f} at risk on {order_id}"
    if "chief compliance" in team_lower:
        return f"Request for compliance exposure update — ${penalty:,.0f} regulatory risk on {order_id}"
    if "sap" in team_lower:
        return "Request for SAP master data correction"
    return f"Request for issue resolution follow-through on {order_id} for {account_name}"


def _vp_tax_compliance_combined_message(issue: dict) -> str:
    """Single cross-team recommendation when both Tax and Compliance are notified."""
    order_id = issue.get("order_id") or "N/A"
    account_id = issue.get("account_id") or ""
    account_name = issue.get("account_name") or account_id
    issue_type = issue.get("issue_type") or ""
    capa_label = ", ".join(_capa_list(issue)) or "CAPA"
    penalty = float(issue.get("penalty_exposure") or 0)

    if "Exemption" in issue_type:
        tax_action = f"tax exemption certificate renewal for {account_name}"
    else:
        tax_action = f"tax jurisdiction correction and address master update for {account_id}"

    compliance_action = f"compliance filing correction with {capa_label} linkage"
    if penalty > 0:
        compliance_action += f" (${penalty:,.0f} penalty exposure)"

    return f"Request for {tax_action} and {compliance_action} on {order_id}"


def _vp_tax_compliance_merged_owner(issue: dict, tax_row: dict, comp_row: dict) -> str:
    """Single accountable owner for the combined Tax & Compliance notification."""
    primary_team = (issue.get("current_owner_team") or "").strip().lower()
    if primary_team in ("tax team", "compliance team"):
        owner = (issue.get("current_owner_name") or "").strip()
        if owner:
            return owner

    secondary_team = (issue.get("secondary_owner_team") or "").strip().lower()
    if secondary_team in ("tax team", "compliance team"):
        owner = (issue.get("secondary_owner_name") or "").strip()
        if owner:
            return owner

    for row in (comp_row, tax_row):
        owner = (row.get("owner") or "").strip()
        if owner:
            return owner

    return VP_CROSS_TEAM_NOTIFY_OWNERS["Tax Team"]


def _merge_tax_compliance_cross_team_rows(issue: dict, notifications: list[dict]) -> list[dict]:
    """Combine separate Tax and Compliance rows into one recommendation."""
    tax_idx = next(
        (i for i, n in enumerate(notifications) if (n.get("team") or "").strip().lower() == "tax team"),
        None,
    )
    comp_idx = next(
        (i for i, n in enumerate(notifications) if (n.get("team") or "").strip().lower() == "compliance team"),
        None,
    )
    if tax_idx is None or comp_idx is None:
        return notifications

    tax_row = notifications[tax_idx]
    comp_row = notifications[comp_idx]
    message = _vp_tax_compliance_combined_message(issue)
    owner = _vp_tax_compliance_merged_owner(issue, tax_row, comp_row)

    statuses = {tax_row.get("team_status"), comp_row.get("team_status")}
    merged_status = "Completed" if statuses == {"Completed"} else "Pending"

    merged = {
        "team": "Tax & Compliance Team",
        "owner": owner,
        "team_status": merged_status,
        "notification": message,
        "notified_about": message,
    }

    for idx in sorted([tax_idx, comp_idx], reverse=True):
        notifications.pop(idx)
    notifications.insert(min(tax_idx, comp_idx), merged)
    return notifications


def _build_vp_cross_team_notifications(issue: dict, closure_action: str = "approve") -> list[dict]:
    notifications: list[dict] = []

    def _row(team: str, owner: str, *, primary: bool | None = None, executive_role: str | None = None) -> dict:
        if executive_role:
            status = _executive_team_status(closure_action, executive_role)
        elif primary is not None:
            status = _owner_team_status(issue, primary=primary, closure_action=closure_action)
        else:
            status = _executive_team_status(closure_action, "SAP")
        message = _vp_cross_team_notification_message(issue, team)
        return {
            "team": team,
            "owner": owner,
            "team_status": status,
            "notification": message,
            "notified_about": message,
        }

    if issue.get("current_owner_team") and issue.get("current_owner_name"):
        notifications.append(
            _row(issue["current_owner_team"], issue["current_owner_name"], primary=True)
        )
    if issue.get("secondary_owner_team") and issue.get("secondary_owner_name"):
        notifications.append(
            _row(issue["secondary_owner_team"], issue["secondary_owner_name"], primary=False)
        )
    notified_teams = {(n.get("team") or "").strip().lower() for n in notifications}
    for team in ("Tax Team", "Pricing Team"):
        if team.lower() not in notified_teams:
            notifications.append(_row(team, VP_CROSS_TEAM_NOTIFY_OWNERS[team]))
            notified_teams.add(team.lower())
    if "sap team" not in notified_teams:
        notifications.append(_row("SAP Team", VP_CROSS_TEAM_NOTIFY_OWNERS["SAP Team"]))
    return _merge_tax_compliance_cross_team_rows(issue, notifications)


def _apply_fresh_cross_team_notifications(closure: dict, issue: dict) -> dict:
    """Recompute cross-team rows so owner/copy updates apply to cached closure snapshots."""
    result = dict(closure)
    action = str(closure.get("action_taken") or issue.get("ai_decision") or "approve")
    result["cross_team_notifications"] = _build_vp_cross_team_notifications(
        issue, closure_action=action
    )
    return result


def _build_closure(
    issue: dict,
    action: str,
    new_owner_name: str | None = None,
    *,
    issues: list[dict] | None = None,
) -> dict:
    today = datetime.date.today().strftime("%m-%d-%Y")
    now_ts = datetime.datetime.now().strftime("%m-%d-%Y %I:%M %p")
    dollar_exposure = float(issue.get("dollar_exposure") or 0)
    issue_type = issue.get("issue_type") or "Issue"
    order_id = issue.get("order_id") or ""
    account = f"{issue.get('account_id')} {issue.get('account_name')}"

    owners = []
    if issue.get("current_owner_id") and issue.get("current_owner_id") != "Unassigned":
        owners.append(
            {
                "owner_id": issue["current_owner_id"],
                "owner_name": issue.get("current_owner_name") or issue["current_owner_id"],
            }
        )
    if issue.get("secondary_owner_id"):
        owners.append(
            {
                "owner_id": issue["secondary_owner_id"],
                "owner_name": issue.get("secondary_owner_name") or issue["secondary_owner_id"],
            }
        )

    resolved_by = new_owner_name or " + ".join(o["owner_name"] for o in owners) or "VP / Director"
    capa_list = _capa_list(issue)

    ai_action_log = []
    if issue.get("ai_fix_1") and action in ("approve", "escalate"):
        ai_action_log.append(
            {
                "fix": issue["ai_fix_1"],
                "approved_by": "VP / Director",
                "confidence": issue.get("ai_confidence_1") or 0,
                "logged_on": today,
            }
        )
    if issue.get("ai_fix_2") and action in ("approve", "escalate"):
        ai_action_log.append(
            {
                "fix": issue["ai_fix_2"],
                "approved_by": "VP / Director",
                "confidence": issue.get("ai_confidence_2") or 0,
                "logged_on": today,
            }
        )

    resolution_type = _build_vp_resolution_type(issue, action, new_owner_name)

    sla_days = int(issue.get("sla_days_remaining") or 0)
    sla_outcome = "Breached" if sla_days <= 0 else "On Time"
    sla_limit = "2 days" if sla_days <= 2 else f"{sla_days} days"

    what_was_updated = _build_vp_what_was_updated(issue, action, new_owner_name)
    next_actions = what_was_updated
    cross_team_notifications = _build_vp_cross_team_notifications(issue, closure_action=action)

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
                "vp_accountability_note": (
                    "Resolved within SLA — no breach"
                    if sla_outcome == "On Time"
                    else "SLA breached — escalation path triggered"
                ),
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
        "next_actions": next_actions,
        "ai_action_log": ai_action_log,
        "kpi_impact": _kpi_impact_for_closed_issue(issues, issue)
        if issues
        else _kpi_impact_for_closed_issue([issue], issue),
        "cross_team_notifications": cross_team_notifications,
        "action_taken": action,
    }


class VPApproveRequest(BaseModel):
    issue_id: str


class VPAiActionRequest(BaseModel):
    issue_id: str
    action: str


class VPReassignRequest(BaseModel):
    issue_id: str
    new_owner_id: str
    new_owner_name: str


class VPEscalateRequest(BaseModel):
    issue_id: str


@router.post("/reset-demo")
def vp_reset_demo(session_id: str = Depends(get_vp_demo_session)):
    """Restore VP alerts from CSV seed and clear all in-memory session overrides."""
    _reset_all_vp_demo_state()
    _ensure_vp_alerts_ready()
    with _connect() as conn:
        _reset_vp_alerts_to_seed(conn)
        conn.commit()
    issues = _load_issues(session_id)
    return {"ok": True, "dashboard": _build_dashboard(issues)}


@router.get("/dashboard")
def vp_dashboard(session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    return _build_dashboard(issues)


@router.get("/issue/{issue_id}")
def vp_issue_detail(issue_id: str, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")
    return _build_issue_detail(issue)


@router.post("/approve")
def vp_approve(req: VPApproveRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")

    closure = _build_closure(issue, "approve", issues=issues)
    _session_overrides(session_id)[req.issue_id] = {
        "status": "Resolved",
        "ai_decision": "approve",
        "closure_snapshot": closure,
    }
    issues = _load_issues(session_id)
    return {"dashboard": _build_dashboard(issues), "closure": closure}


@router.post("/ai-action")
def vp_ai_action(req: VPAiActionRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")
    if req.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be approve or reject")

    override: dict = {"ai_decision": req.action}
    if req.action == "approve":
        override["status"] = "Resolved"
        override["closure_snapshot"] = _build_closure(issue, "approve", issues=issues)
    _session_overrides(session_id)[req.issue_id] = override
    issues = _load_issues(session_id)
    return {"ok": True, "issue_id": req.issue_id, "dashboard": _build_dashboard(issues)}


@router.post("/reassign")
def vp_reassign(req: VPReassignRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")

    closure = _build_closure(issue, "reassign", req.new_owner_name, issues=issues)
    _session_overrides(session_id)[req.issue_id] = {
        "status": "Resolved",
        "current_owner_id": req.new_owner_id,
        "current_owner_name": req.new_owner_name,
        "closure_snapshot": closure,
    }
    issues = _load_issues(session_id)
    return {"dashboard": _build_dashboard(issues), "closure": closure}


@router.post("/escalate")
def vp_escalate(req: VPEscalateRequest, session_id: str = Depends(get_vp_demo_session)):
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == req.issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {req.issue_id} not found")

    closure = _build_closure(issue, "escalate", issues=issues)
    _session_overrides(session_id)[req.issue_id] = {
        "status": "Resolved",
        "ai_decision": "escalate",
        "closure_snapshot": closure,
    }
    issues = _load_issues(session_id)
    return {"dashboard": _build_dashboard(issues), "closure": closure}


@router.get("/closure/{issue_id}")
def vp_closure(issue_id: str, session_id: str = Depends(get_vp_demo_session)):
    overrides = _session_overrides(session_id)
    issues = _load_issues(session_id)
    issue = next((i for i in issues if i["issue_id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")

    snapshot = overrides.get(issue_id, {}).get("closure_snapshot")
    if snapshot:
        return _apply_fresh_cross_team_notifications(snapshot, issue)

    action = issue.get("ai_decision") or "approve"
    return _build_closure(issue, action, issues=issues)


@router.get("/team-members")
def vp_team_members():
    return VP_TEAM_MEMBERS
