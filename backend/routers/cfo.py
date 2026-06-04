import datetime
from pathlib import Path

import sqlite3
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/cfo", tags=["cfo"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

_session_issue_overrides: dict[str, dict[str, dict]] = {}
_initialized_cfo_sessions: set[str] = set()

CFO_TEAM_MEMBERS = [
    {"id": "FIN-01", "name": "Victoria Hale", "team": "Finance Team"},
    {"id": "FIN-02", "name": "Marcus Webb", "team": "Finance Team"},
    {"id": "FIN-03", "name": "Rachel Kim", "team": "Finance Team"},
    {"id": "TAX-03", "name": "Jennifer Mills", "team": "Tax Team"},
    {"id": "TAX-04", "name": "Emily Carter", "team": "Tax Team"},
    {"id": "TAX-05", "name": "Robert Chan", "team": "Tax Team"},
    {"id": "PRICE-04", "name": "David Chen", "team": "Pricing Team"},
    {"id": "CCO-01", "name": "Sandra Lee", "team": "Compliance Office"},
]

_PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

CROSS_TEAM_OWNERS = {
    "Tax Team": "Jennifer Mills",
    "Pricing Team": "David Chen",
    "Finance Team": "Marcus Webb",
    "Chief Compliance Officer": "Sandra Lee",
    "SAP Team": "Marcus Hale",
}


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


def _reset_demo_alerts_for_fresh_session(session_id: str) -> None:
    """First request after a browser refresh: restore seed Open status and clear in-memory overrides."""
    if session_id in _initialized_cfo_sessions:
        return
    _initialized_cfo_sessions.add(session_id)
    _session_issue_overrides.pop(session_id, None)
    with _connect() as conn:
        conn.execute("UPDATE cfo_alerts SET status = 'Open'")
        conn.commit()


def _is_open_alert(alert: dict) -> bool:
    return str(alert.get("status") or "Open").strip().lower() == "open"


def _merge_alert(alert: dict, session_id: str) -> dict:
    merged = dict(alert)
    override = _session_overrides(session_id).get(alert["alert_id"])
    if override:
        merged.update(override)
    lines = _build_cfo_ai_recommendations(merged)
    merged["ai_recommendation_lines"] = lines
    merged["ai_fix_display"] = " · ".join(lines) if len(lines) > 1 else (lines[0] if lines else "")
    merged["ai_fix"] = lines[0] if len(lines) == 1 else merged["ai_fix_display"]
    return merged


def _load_alerts(session_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM cfo_alerts ORDER BY priority DESC, sla_days_remaining ASC"
        ).fetchall()
    return [_merge_alert(dict(r), session_id) for r in rows]


def _open_alerts_for_before_snapshot(alerts: list[dict], alert_id: str) -> list[dict]:
    return [a for a in alerts if _is_open_alert(a) or a.get("alert_id") == alert_id]


def _ai_eligible_for_cfo_queue(alert: dict) -> bool:
    if not _is_open_alert(alert):
        return False
    if alert.get("ai_decision"):
        return False
    return float(alert.get("ai_confidence_1", 0) or 0) >= 85 and bool(alert.get("ai_fix_1"))


def _build_high_value_approval_queue(open_alerts: list[dict], limit: int = 1) -> list[dict]:
    """Open alerts ranked by dollar exposure — executive approval queue (highest $ first)."""
    pending = [a for a in open_alerts if _is_open_alert(a)]
    return sorted(pending, key=lambda x: -float(x.get("dollar_exposure", 0) or 0))[:limit]


def _lookup_tax_issue(conn: sqlite3.Connection, order_id: str, account_id: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM tax_jurisdiction_issues WHERE order_id = ? AND status = 'Open' LIMIT 1",
        (order_id,),
    ).fetchone()
    if not row and account_id:
        row = conn.execute(
            """
            SELECT * FROM tax_jurisdiction_issues
            WHERE customer_id = ? AND status = 'Open'
            ORDER BY ai_confidence DESC LIMIT 1
            """,
            (account_id,),
        ).fetchone()
    return dict(row) if row else None


def _lookup_pricing_issue(conn: sqlite3.Connection, order_id: str, account_id: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM pricing_issues WHERE order_id = ? AND status = 'Open' LIMIT 1",
        (order_id,),
    ).fetchone()
    if not row and account_id:
        row = conn.execute(
            """
            SELECT * FROM pricing_issues
            WHERE customer_id = ? AND status = 'Open'
            ORDER BY ai_confidence DESC LIMIT 1
            """,
            (account_id,),
        ).fetchone()
    return dict(row) if row else None


def _lookup_steward_issue(conn: sqlite3.Connection, account_id: str) -> dict | None:
    if not account_id:
        return None
    row = conn.execute(
        """
        SELECT * FROM data_steward_issues
        WHERE customer_id = ? AND status = 'Open'
        ORDER BY ai_confidence DESC LIMIT 1
        """,
        (account_id,),
    ).fetchone()
    return dict(row) if row else None


def _tax_persona_ai_fix(issue: dict) -> str:
    """Identical to tax._merge_issue ai_fix string."""
    return (
        f"Request Correction {issue['order_id']} jurisdiction from {issue['applied_jurisdiction']} "
        f"to {issue['correct_jurisdiction']} + Rquest update for {issue['address_record']} in SAP address master"
    )


def _pricing_persona_ai_fix_from_alert(alert: dict) -> str:
    """Pricing dashboard uses CSV ai_fix; CFO seeds mirror that style."""
    fix2 = (alert.get("ai_fix_2") or "").strip()
    if fix2 and float(alert.get("ai_confidence_2") or 0) > 0:
        return fix2
    fix1 = (alert.get("ai_fix_1") or "").strip()
    if fix1 and alert.get("pricing_owner_id"):
        return fix1
    return _build_pricing_ai_recommendation_line(alert)


def _pricing_persona_tiers_from_alert(alert: dict) -> tuple[str, str]:
    pricing_issue_hint = (alert.get("ai_fix_2") or alert.get("ai_fix_1") or "").lower()
    if "list price" in pricing_issue_hint and "tier" in pricing_issue_hint:
        return "List Price", "GPO Tier-2"
    list_price = float(alert.get("list_price") or 0)
    contract_price = float(alert.get("contract_price") or 0)
    if list_price > 0 and contract_price > 0:
        return "List Price", "GPO Tier-2"
    return alert.get("issue_type", ""), ""


def _is_steward_style_cfo_alert(alert: dict) -> bool:
    issue_type = str(alert.get("issue_type") or "")
    return any(
        token in issue_type
        for token in ("Hierarchy", "Orphan", "Stale", "Duplicate", "Master Record", "Data Steward")
    )


def _build_cfo_ai_queue(open_alerts: list[dict]) -> list[dict]:
    """Queue rows use the same ai_fix / context fields as Tax, Pricing, and Steward dashboards."""
    queue: list[dict] = []
    with _connect() as conn:
        for alert in open_alerts:
            if not _ai_eligible_for_cfo_queue(alert):
                continue
            order_id = alert.get("order_id", "")
            account_id = alert.get("account_id", "")

            if alert.get("tax_owner_id"):
                tax_issue = _lookup_tax_issue(conn, order_id, account_id)
                if tax_issue:
                    entry = dict(alert)
                    entry.update(
                        {
                            "queue_row_id": f"{alert['alert_id']}-tax",
                            "queue_persona": "tax",
                            "order_id": tax_issue["order_id"],
                            "ai_fix": _tax_persona_ai_fix(tax_issue),
                            "ai_confidence": float(tax_issue.get("ai_confidence") or 0),
                            "ai_source": tax_issue.get("ai_source") or "",
                            "applied_jurisdiction": tax_issue.get("applied_jurisdiction") or "",
                        }
                    )
                else:
                    tax_fields = {
                        **alert,
                        "address_record": account_id,
                    }
                    entry = dict(alert)
                    entry.update(
                        {
                            "queue_row_id": f"{alert['alert_id']}-tax",
                            "queue_persona": "tax",
                            "ai_fix": _tax_persona_ai_fix(tax_fields),
                            "ai_confidence": float(alert.get("ai_confidence_1") or 0),
                            "ai_source": alert.get("ai_source_1") or "",
                            "applied_jurisdiction": alert.get("applied_jurisdiction") or "",
                        }
                    )
                queue.append(entry)

            if alert.get("pricing_owner_id"):
                pricing_issue = _lookup_pricing_issue(conn, order_id, account_id)
                if pricing_issue:
                    entry = dict(alert)
                    entry.update(
                        {
                            "queue_row_id": f"{alert['alert_id']}-pricing",
                            "queue_persona": "pricing",
                            "customer_name": pricing_issue.get("customer_name") or alert.get("account_name"),
                            "ai_fix": pricing_issue["ai_fix"],
                            "ai_confidence": float(pricing_issue.get("ai_confidence") or 0),
                            "ai_source": pricing_issue.get("ai_source") or "",
                            "applied_tier": pricing_issue.get("applied_tier") or "",
                            "correct_tier": pricing_issue.get("correct_tier") or "",
                        }
                    )
                else:
                    applied_tier, correct_tier = _pricing_persona_tiers_from_alert(alert)
                    conf = float(alert.get("ai_confidence_2") or 0) or float(alert.get("ai_confidence_1") or 0)
                    entry = dict(alert)
                    entry.update(
                        {
                            "queue_row_id": f"{alert['alert_id']}-pricing",
                            "queue_persona": "pricing",
                            "customer_name": alert.get("account_name"),
                            "ai_fix": _pricing_persona_ai_fix_from_alert(alert),
                            "ai_confidence": conf,
                            "ai_source": alert.get("ai_source_2") or alert.get("ai_source_1") or "",
                            "applied_tier": applied_tier,
                            "correct_tier": correct_tier,
                        }
                    )
                queue.append(entry)

            steward_issue = _lookup_steward_issue(conn, account_id)
            if steward_issue and float(steward_issue.get("ai_confidence", 0) or 0) >= 89:
                if _is_steward_style_cfo_alert(alert) or (
                    not alert.get("tax_owner_id") and not alert.get("pricing_owner_id")
                ):
                    entry = dict(alert)
                    entry.update(
                        {
                            "queue_row_id": f"{alert['alert_id']}-steward",
                            "queue_persona": "steward",
                            "customer_name": steward_issue.get("customer_name") or alert.get("account_name"),
                            "current_idn_name": steward_issue.get("current_idn_name") or "No IDN mapped",
                            "ai_fix": steward_issue["ai_fix"],
                            "ai_confidence": float(steward_issue.get("ai_confidence") or 0),
                            "ai_source": steward_issue.get("ai_source") or "",
                        }
                    )
                    queue.append(entry)

            if not alert.get("tax_owner_id") and not alert.get("pricing_owner_id") and not any(
                q.get("alert_id") == alert["alert_id"] for q in queue
            ):
                entry = dict(alert)
                entry.update(
                    {
                        "queue_row_id": alert["alert_id"],
                        "queue_persona": "finance",
                        "ai_fix": (alert.get("ai_fix_1") or "").strip(),
                        "ai_confidence": float(alert.get("ai_confidence_1") or 0),
                        "ai_source": alert.get("ai_source_1") or "",
                    }
                )
                queue.append(entry)
    return queue


_CFO_KPI_TRENDS = {
    "revenue_at_risk": {"trend_label": "Down 12% vs last period", "direction": "improving"},
    "margin_at_risk": {"trend_label": "Down 5% vs last period", "direction": "improving"},
    "compliance_exposure": {"trend_label": "Up 8% vs last period", "direction": "worsening"},
    "predicted_annual_exposure": {"trend_label": "Down 12% vs last period", "direction": "improving"},
}


def _severity_from_alerts(alerts: list[dict]) -> str:
    if not alerts:
        return "Healthy"
    worst = min(_PRIORITY_ORDER.get(a.get("priority"), 9) for a in alerts)
    if worst == 0:
        return "Critical"
    if worst <= 1:
        return "Caution"
    return "Healthy"


def _build_risk_heatmap(open_alerts: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    for alert in open_alerts:
        key = (alert.get("issue_type") or "Unknown").strip()
        groups.setdefault(key, []).append(alert)
    rows = []
    for issue_type, alerts in groups.items():
        rows.append(
            {
                "issue_type": issue_type,
                "severity": _severity_from_alerts(alerts),
                "records_at_risk": len(alerts),
                "dollar_exposure": round(sum(float(a.get("dollar_exposure", 0)) for a in alerts), 2),
            }
        )
    rows.sort(key=lambda r: (-r["dollar_exposure"], r["issue_type"]))
    return rows


def _build_kpi_period_comparison(kpi_cards: dict) -> list[dict]:
    """Trailing six months of financial exposure (month-on-month demo series)."""
    rev = float(kpi_cards["revenue_at_risk"]["value"])
    mar = float(kpi_cards["margin_at_risk"]["value"])
    comp = float(kpi_cards["compliance_exposure"]["value"])
    months = [
        ("Dec", 1.26, 1.24, 1.28),
        ("Jan", 1.16, 1.14, 1.18),
        ("Feb", 1.10, 1.08, 1.12),
        ("Mar", 1.06, 1.05, 1.08),
        ("Apr", 1.03, 1.02, 1.04),
        ("May", 1.0, 1.0, 1.0),
    ]
    return [
        {
            "month": label,
            "revenue_at_risk": round(rev * rev_m),
            "margin_at_risk": round(mar * mar_m),
            "compliance_exposure": round(comp * comp_m),
        }
        for label, rev_m, mar_m, comp_m in months
    ]


def _compute_kpi_cards(open_alerts: list[dict]) -> dict:
    total_exposure = round(sum(float(a.get("dollar_exposure", 0)) for a in open_alerts), 2)
    margin_at_risk = round(sum(float(a.get("margin_at_risk", 0)) for a in open_alerts), 2)
    compliance_exposure = round(sum(float(a.get("penalty_exposure", 0)) for a in open_alerts), 2)
    predicted_annual = round(total_exposure * 30.5, 0)

    def _card(key: str, value: float, label: str, description: str) -> dict:
        trend = _CFO_KPI_TRENDS.get(key, {"trend_label": "Flat vs last period", "direction": "neutral"})
        return {
            "value": value,
            "label": label,
            "description": description,
            "trend_label": trend["trend_label"],
            "direction": trend["direction"],
        }

    return {
        "revenue_at_risk": _card(
            "revenue_at_risk",
            total_exposure,
            "Revenue at Risk",
            "Total revenue leakage from open issues across tax, pricing, and chargebacks pending resolution",
        ),
        "margin_at_risk": _card(
            "margin_at_risk",
            margin_at_risk,
            "Margin at Risk",
            "Current-period margin exposure from unresolved pricing errors, tax mismatches, and rebate discrepancies",
        ),
        "compliance_exposure": _card(
            "compliance_exposure",
            compliance_exposure,
            "Compliance Exposure",
            "Penalty and legal risk from unresolved jurisdiction mismatches and regulatory non-compliance",
        ),
        "predicted_annual_exposure": _card(
            "predicted_annual_exposure",
            predicted_annual,
            "Predicted Annual Exposure",
            "Annualized projection of current-period exposure if open issues remain unresolved",
        ),
    }


def _kpi_impact_snapshot(before: dict, after: dict) -> dict:
    impact = {}
    for key in before:
        b = float(before[key]["value"])
        a = float(after[key]["value"])
        impact[key] = {"before": b, "after": a, "delta": round(a - b, 2), "label": before[key]["label"]}
    return impact


def _sap_timing_phrase(alert: dict) -> str:
    pre = int(alert.get("pre_invoice") or 0) == 1
    return "before invoice generation" if pre else "via post-invoice adjustment"


def _build_cfo_next_action_tax(alert: dict) -> str | None:
    if not alert.get("tax_owner_id"):
        return None
    return f"Correct ship-to jurisdiction in SAP {_sap_timing_phrase(alert)}"


def _build_cfo_next_action_pricing(alert: dict) -> str | None:
    if not alert.get("pricing_owner_id"):
        return None
    account_id = alert.get("account_id", "")
    issue_type = alert.get("issue_type", "")
    margin = float(alert.get("margin_at_risk") or alert.get("dollar_exposure") or 0)
    if any(x in issue_type for x in ("GPO", "Pricing", "Chargeback", "Override")):
        return f"Issue credit memo for ${margin:,.0f} + update SAP pricing master for {account_id}"
    if "Exemption" in issue_type:
        return f"Apply tax exemption certificate in SAP for {account_id}"
    return f"Update SAP pricing master for {account_id}"


def _build_tax_ai_recommendation_line(alert: dict) -> str:
    """Same wording as Tax Issue Intelligence ai_recommendation.fix."""
    tax_fields = {**alert, "address_record": alert.get("address_record") or alert.get("account_id", "")}
    return _tax_persona_ai_fix(tax_fields)


def _build_pricing_ai_recommendation_line(alert: dict) -> str:
    """Same wording as Pricing transaction / issue ai_recommendation.fix."""
    order_id = alert.get("order_id", "")
    account_id = alert.get("account_id", "")
    list_price = float(alert.get("list_price") or 0)
    contract_price = float(alert.get("contract_price") or 0)
    credit_amount = max(0.0, list_price - contract_price) if list_price and contract_price else float(
        alert.get("margin_at_risk") or alert.get("dollar_exposure") or 0
    )
    return (
        f"Request to Issue credit memo of ${credit_amount:,.2f} for {order_id} "
        f"+ request to update SAP pricing master data for {account_id}"
    )


def _build_cfo_ai_recommendations(alert: dict) -> list[str]:
    """One recommendation line per combined issue (tax and/or pricing)."""
    recs: list[str] = []
    if alert.get("tax_owner_id"):
        recs.append(_build_tax_ai_recommendation_line(alert))
    if alert.get("pricing_owner_id"):
        recs.append(_build_pricing_ai_recommendation_line(alert))
    if not recs:
        issue_type = alert.get("issue_type", "")
        order_id = alert.get("order_id", "")
        account_id = alert.get("account_id", "")
        recs.append(
            f"Request Correction for {order_id} — coordinate resolution for {issue_type} "
            f"and update SAP master data for {account_id}"
        )
    return recs


def _resolution_type_label(alert: dict) -> str:
    issue_type = alert.get("issue_type", "")
    if "Tax Jurisdiction" in issue_type and "Pricing" in issue_type:
        return (
            f"Request Jurisdiction Correction from {alert.get('applied_jurisdiction', 'prior state')} to "
            f"{alert.get('correct_jurisdiction', 'correct state')} + Request for GPO Contract Rate to be Applied"
        )
    if "Tax Jurisdiction" in issue_type or "Jurisdiction" in issue_type:
        return (
            f"Request Jurisdiction Correction from {alert.get('applied_jurisdiction', 'prior state')} to "
            f"{alert.get('correct_jurisdiction', 'correct state')}"
        )
    if "GPO" in issue_type or "Pricing" in issue_type or "Chargeback" in issue_type:
        return "Request for Contract Rate to be Applied + Request for Credit Memo to be Issued"
    if "Compliance" in issue_type:
        return "Request for Compliance Filing to be Corrected"
    if "Exemption" in issue_type:
        return "Request for Tax Exemption Certificate to be Applied"
    return "Request for Issue Resolution in ERP and SAP"


def _build_closure_payload(alert: dict, kpi_before: dict, kpi_after: dict) -> dict:
    today = datetime.date.today().isoformat()
    owners = []
    if alert.get("tax_owner_name"):
        owners.append(alert["tax_owner_name"])
    if alert.get("pricing_owner_name"):
        owners.append(alert["pricing_owner_name"])
    resolved_by = " + ".join(owners) if owners else alert.get("cfo_assignee", "CFO")

    issue_type = alert.get("issue_type", "")
    what_was_updated = []
    if alert.get("tax_owner_id") or "Tax" in issue_type or "Jurisdiction" in issue_type:
        what_was_updated.append(
            f"Request for SAP Jurisdiction Update — {alert.get('applied_jurisdiction', 'prior state')} to "
            f"{alert.get('correct_jurisdiction', 'correct state')} for {alert.get('order_id')}"
        )
        what_was_updated.append(
            f"Request for SAP Customer Master data to be updated for {alert.get('account_id')}"
        )
    if alert.get("pricing_owner_id") or any(x in issue_type for x in ("Pricing", "GPO", "Chargeback")):
        contract_price = alert.get("contract_price", 0)
        what_was_updated.append(
            f"Request for SAP Pricing Master Update — Contract Rate ${contract_price} for {alert.get('account_id')}"
        )
    for capa_id in (alert.get("capa_ids") or "").split(","):
        capa_id = capa_id.strip()
        if capa_id:
            what_was_updated.append(f"Request for {capa_id} to be updated")
    what_was_updated.append("Alert closed and removed from queue once the SAP data is updated")

    ai_action_log = []
    for line in _build_cfo_ai_recommendations(alert):
        ai_action_log.append(
            {
                "fix": line,
                "approved_by": "CFO",
                "confidence": alert.get("ai_confidence_1", 0),
                "logged_on": today,
            }
        )

    notifications = []
    if alert.get("tax_owner_team"):
        notifications.append(
            {
                "team": alert["tax_owner_team"],
                "owner": alert.get("tax_owner_name") or CROSS_TEAM_OWNERS.get("Tax Team", "Tax Team"),
                "notification": (
                    f"Request for jurisdiction correction on {alert.get('order_id')} — "
                    f"address master update for {alert.get('account_id')}"
                ),
            }
        )
    if alert.get("pricing_owner_team"):
        notifications.append(
            {
                "team": alert["pricing_owner_team"],
                "owner": alert.get("pricing_owner_name") or CROSS_TEAM_OWNERS.get("Pricing Team", "Pricing Team"),
                "notification": (
                    f"Request for contract rate application on {alert.get('order_id')} — "
                    f"pricing engine update for {alert.get('account_id')}"
                ),
            }
        )
    if "Compliance" in issue_type or alert.get("capa_ids"):
        penalty = float(alert.get("penalty_exposure", 0))
        notifications.append(
            {
                "team": "Chief Compliance Officer",
                "owner": CROSS_TEAM_OWNERS["Chief Compliance Officer"],
                "notification": f"Compliance exposure reduced by ${penalty:,.0f} — CAPAs updated",
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
            "issue": f"{alert.get('issue_type')} — {alert.get('order_id')}",
            "resolved_by": resolved_by,
            "date": alert.get("resolved_at", today),
            "resolution_type": _resolution_type_label(alert),
            "exposure_recovered": float(alert.get("dollar_exposure", 0)),
        },
        "what_was_updated": what_was_updated,
        "ai_action_log": ai_action_log,
        "kpi_impact": _kpi_impact_snapshot(kpi_before, kpi_after),
        "cross_team_notifications": notifications,
        "alert_id": alert["alert_id"],
        "account_id": alert.get("account_id"),
        "order_id": alert.get("order_id"),
    }


def _build_dashboard(all_alerts: list[dict]) -> dict:
    open_alerts = [a for a in all_alerts if _is_open_alert(a)]
    pre_invoice = [a for a in open_alerts if int(a.get("pre_invoice") or 0) == 1]

    total_exposure = round(sum(float(a.get("dollar_exposure", 0)) for a in open_alerts), 2)
    margin_at_risk = round(sum(float(a.get("margin_at_risk", 0)) for a in open_alerts), 2)
    compliance_exposure = round(sum(float(a.get("penalty_exposure", 0)) for a in open_alerts), 2)
    predicted_annual = round(total_exposure * 30.5, 0)

    top_alerts = sorted(
        [a for a in open_alerts if _is_open_alert(a)],
        key=lambda x: (
            _PRIORITY_ORDER.get(x.get("priority"), 9),
            int(x.get("sla_days_remaining") or 0),
        ),
    )[:8]

    ai_queue = _build_cfo_ai_queue(open_alerts)
    high_value_approval_queue = _build_high_value_approval_queue(open_alerts)

    kpi_cards = _compute_kpi_cards(open_alerts)

    return {
        "headline": {
            "total_exposure": total_exposure,
            "open_issues": len(open_alerts),
            "pre_invoice_count": len(pre_invoice),
            "predicted_annual_exposure": predicted_annual,
        },
        "kpi_cards": kpi_cards,
        "kpi_period_comparison": _build_kpi_period_comparison(kpi_cards),
        "risk_heatmap": _build_risk_heatmap(open_alerts),
        "resolution_trend": [
            {"kpi": "Revenue at Risk", "trend": "Down 12% vs last period", "status": "Improving", "direction": "down"},
            {"kpi": "Compliance Exposure", "trend": "Up 8% vs last period", "status": "Needs Attention", "direction": "up"},
            {"kpi": "Issues Resolved on Time", "trend": "74% resolved on time vs target", "status": "At Risk", "direction": "neutral"},
        ],
        "top_alerts": top_alerts,
        "ai_queue": ai_queue,
        "high_value_approval_queue": high_value_approval_queue,
        "all_open_alerts": open_alerts,
    }


class CFOApproveRequest(BaseModel):
    alert_id: str


class CFOAiActionBody(BaseModel):
    alert_id: str
    action: str


class CFOReassignRequest(BaseModel):
    alert_id: str
    new_owner_id: str
    new_owner_name: str


@router.get("/dashboard")
def cfo_dashboard(session_id: str = Depends(get_cfo_demo_session)):
    _reset_demo_alerts_for_fresh_session(session_id)
    return _build_dashboard(_load_alerts(session_id))


@router.get("/issue/{alert_id}")
def cfo_issue_detail(alert_id: str, session_id: str = Depends(get_cfo_demo_session)):
    with _connect() as conn:
        row = conn.execute("SELECT * FROM cfo_alerts WHERE alert_id = ?", (alert_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert = _merge_alert(dict(row), session_id)
    capa_entries = []
    if alert.get("capa_ids"):
        for capa_id in alert["capa_ids"].split(","):
            capa_id = capa_id.strip()
            if capa_id == "CAPA-007":
                capa_entries.append(
                    {
                        "id": "CAPA-007",
                        "area": "State Tax Compliance — Multi-Jurisdiction",
                        "status": "In Progress",
                        "owner": "Sandra Lee — Chief Compliance Officer",
                        "due": "2026-05-10",
                    }
                )
            elif capa_id == "CAPA-012":
                capa_entries.append(
                    {
                        "id": "CAPA-012",
                        "area": "GPO Contract Rate Accuracy",
                        "status": "Open",
                        "owner": "David Chen — Pricing Team",
                        "due": "2026-05-20",
                    }
                )

    alert["next_action_tax"] = _build_cfo_next_action_tax(alert)
    alert["next_action_pricing"] = _build_cfo_next_action_pricing(alert)

    owners = []
    if alert.get("tax_owner_id"):
        owners.append(
            {
                "owner_id": alert["tax_owner_id"],
                "owner_name": alert.get("tax_owner_name"),
                "team": alert.get("tax_owner_team"),
                "assigned_on": alert.get("opened_date"),
                "next_action": alert["next_action_tax"],
            }
        )
    if alert.get("pricing_owner_id"):
        owners.append(
            {
                "owner_id": alert["pricing_owner_id"],
                "owner_name": alert.get("pricing_owner_name"),
                "team": alert.get("pricing_owner_team"),
                "assigned_on": alert.get("opened_date"),
                "next_action": alert["next_action_pricing"],
            }
        )

    return {
        "alert": alert,
        "header": {
            "issue_type": alert.get("issue_type"),
            "customer": f"{alert.get('account_id')} {alert.get('account_name')} — {alert.get('order_id')}",
            "priority": alert.get("priority"),
            "dollar_impact": float(alert.get("dollar_exposure", 0)),
            "opened_on": alert.get("opened_date"),
            "sla": f"{alert.get('sla_days_remaining')} days remaining",
            "invoice_status": alert.get("invoice_status"),
            "margin_at_risk": float(alert.get("margin_at_risk", 0)),
        },
        "owners": owners,
        "ai_recommendations": _build_cfo_ai_recommendations(alert),
        "capa_entries": capa_entries,
        "reassign_options": CFO_TEAM_MEMBERS,
    }


@router.get("/closure/{alert_id}")
def cfo_closure(alert_id: str, session_id: str = Depends(get_cfo_demo_session)):
    overrides = _session_overrides(session_id)
    snapshot = overrides.get(alert_id, {}).get("closure_snapshot")
    if snapshot:
        return snapshot

    all_alerts = _load_alerts(session_id)
    alert = next((a for a in all_alerts if a["alert_id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    before_open = _open_alerts_for_before_snapshot(all_alerts, alert_id)
    after_open = [a for a in all_alerts if _is_open_alert(a) and a["alert_id"] != alert_id]
    kpi_before = _compute_kpi_cards(before_open)
    kpi_after = _compute_kpi_cards(after_open)
    return _build_closure_payload(alert, kpi_before, kpi_after)


@router.post("/ai-action")
def cfo_ai_action(body: CFOAiActionBody, session_id: str = Depends(get_cfo_demo_session)):
    alerts = _load_alerts(session_id)
    alert = next((a for a in alerts if a["alert_id"] == body.alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be approve or reject")

    overrides = _session_overrides(session_id)
    overrides[body.alert_id] = {
        **overrides.get(body.alert_id, {}),
        "ai_decision": body.action,
    }
    return {"ok": True, "alert_id": body.alert_id, "dashboard": _build_dashboard(_load_alerts(session_id))}


@router.post("/approve")
def cfo_approve(req: CFOApproveRequest, session_id: str = Depends(get_cfo_demo_session)):
    today = datetime.date.today().isoformat()
    overrides = _session_overrides(session_id)
    existing = overrides.get(req.alert_id, {})
    if existing.get("status") == "Resolved" and existing.get("closure_snapshot"):
        dashboard = _build_dashboard(_load_alerts(session_id))
        return {"dashboard": dashboard, "closure": existing["closure_snapshot"]}

    before_alerts = _load_alerts(session_id)
    alert_before = next((a for a in before_alerts if a["alert_id"] == req.alert_id), None)
    if not alert_before:
        raise HTTPException(status_code=404, detail=f"Alert {req.alert_id} not found")

    # Include the alert being closed even if session state already marked it resolved.
    before_open = _open_alerts_for_before_snapshot(before_alerts, req.alert_id)
    kpi_before = _compute_kpi_cards(before_open)

    overrides[req.alert_id] = {
        **existing,
        "status": "Resolved",
        "cfo_assignee": "CFO",
        "ai_decision": "approve",
        "resolved_at": today,
    }

    after_alerts = _load_alerts(session_id)
    alert = next(a for a in after_alerts if a["alert_id"] == req.alert_id)
    after_open = [a for a in after_alerts if _is_open_alert(a)]
    kpi_after = _compute_kpi_cards(after_open)
    closure = _build_closure_payload(alert, kpi_before, kpi_after)
    overrides[req.alert_id]["closure_snapshot"] = closure
    overrides[req.alert_id]["kpi_before"] = kpi_before
    overrides[req.alert_id]["kpi_after"] = kpi_after

    dashboard = _build_dashboard(after_alerts)
    return {"dashboard": dashboard, "closure": closure}


@router.post("/reassign")
def cfo_reassign(req: CFOReassignRequest, session_id: str = Depends(get_cfo_demo_session)):
    overrides = _session_overrides(session_id)
    overrides[req.alert_id] = {
        **overrides.get(req.alert_id, {}),
        "cfo_assignee": req.new_owner_name,
        "status": "Open",
    }
    return _build_dashboard(_load_alerts(session_id))
