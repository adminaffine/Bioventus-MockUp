"""Expand vp_alerts.csv to 47 unique open issues with KPI-aligned filters."""
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "csv" / "vp_alerts.csv"

HEADER = [
    "issue_id", "account_id", "account_name", "order_id", "issue_type", "team", "priority",
    "dollar_exposure", "margin_at_risk", "penalty_exposure", "invoice_status", "pre_invoice",
    "sla_days_remaining", "opened_date", "status", "current_owner_id", "current_owner_name",
    "current_owner_team", "secondary_owner_id", "secondary_owner_name", "secondary_owner_team",
    "sla_health", "live_progress_primary", "live_progress_secondary", "completion_primary",
    "completion_secondary", "ai_fix_1", "ai_confidence_1", "ai_source_1", "ai_fix_2",
    "ai_confidence_2", "ai_source_2", "root_cause_primary", "root_cause_secondary", "capa_ids",
    "next_action_primary", "next_action_secondary", "recurrence_count", "recurrence_period",
    "capa_exists", "vp_action_signal",
]

ACCOUNTS = [
    ("CUST-2201", "Regional Health Alliance"),
    ("CUST-2202", "NorthStar Medical Group"),
    ("CUST-2203", "Coastal Care Network"),
    ("CUST-2204", "Midwest Surgical Partners"),
    ("CUST-2205", "Sunrise Health System"),
    ("CUST-2206", "Heritage Medical Center"),
    ("CUST-2207", "Pioneer Orthopedics"),
    ("CUST-2208", "Riverbend Hospital"),
    ("CUST-2209", "Crescent Valley Health"),
    ("CUST-2210", "Blue Ridge Medical"),
    ("CUST-2211", "Gateway Health Partners"),
    ("CUST-2212", "Summit Care Associates"),
    ("CUST-2213", "Horizon Medical Group"),
    ("CUST-2214", "Evergreen Health"),
    ("CUST-2215", "Liberty Hospital Network"),
    ("CUST-2216", "Meridian Surgical"),
    ("CUST-2217", "Oakwood Medical"),
    ("CUST-2218", "Prairie Health Cooperative"),
    ("CUST-2219", "Seaside Regional"),
    ("CUST-2220", "Trinity Care Group"),
    ("CUST-2221", "Unity Health Partners"),
    ("CUST-2222", "Vanguard Medical"),
    ("CUST-2223", "Westbridge Health"),
    ("CUST-2224", "Alpine Care System"),
    ("CUST-2225", "Beacon Medical Group"),
    ("CUST-2226", "Canyon Health Network"),
    ("CUST-2227", "Delta Regional Medical"),
    ("CUST-2228", "Eagle Point Health"),
    ("CUST-2229", "Frontier Surgical Center"),
    ("CUST-2230", "Granite State Medical"),
    ("CUST-2231", "Harborview Health"),
    ("CUST-2232", "Ironwood Medical Partners"),
    ("CUST-2233", "Juniper Health System"),
    ("CUST-2234", "Keystone Care Network"),
    ("CUST-2235", "Lakeshore Medical Group"),
    ("CUST-2236", "Mosaic Health Partners"),
    ("CUST-2237", "NovaCare Regional"),
    ("CUST-2238", "Orchard Medical Center"),
]

ISSUE_TYPES = [
    "Tax Jurisdiction Mismatch",
    "GPO Chargeback Dispute",
    "Compliance Breach — Multi-Jurisdiction Filing",
    "GPO Contract Non-Compliance — Audit Flag",
    "Pricing Override — List Price Applied",
    "GPO Contract Discrepancy",
    "Tax Exemption Certificate Expired",
    "Chargeback Dispute — Rebate Discrepancy",
    "Contract Ceiling Exceeded",
    "Rebate Calculation Error",
    "Address Master Sync Failure",
    "Pricing Engine Stale Contract",
]

TEAMS = {
    "Tax Team": ("TAX-03", "Jennifer Mills", "TAX-04", "Emily Carter", "TAX-05", "Robert Chan"),
    "Pricing Team": ("PRICE-04", "David Chen", "PRICE-05", "Sarah Mitchell"),
    "Compliance Team": ("CCO-02", "James Torres", "CCO-01", "Sandra Lee"),
    "Finance Team": ("FIN-02", "Marcus Webb", "FIN-01", "Victoria Hale", "FIN-03", "Rachel Kim"),
}

TEAM_QUOTAS = {"Tax Team": 12, "Pricing Team": 9, "Compliance Team": 14, "Finance Team": 12}


def is_sla_risk(row: dict) -> bool:
    health = (row.get("sla_health") or "").strip()
    sla = int(row.get("sla_days_remaining") or 99)
    return health in ("At Risk", "Breached") or sla <= 2


def is_escalation(row: dict) -> bool:
    return (row.get("priority") or "").upper() in ("CRITICAL", "HIGH")


def make_row(
    idx: int,
    team: str,
    *,
    priority: str,
    sla_days: int,
    sla_health: str,
    issue_type: str,
    account_id: str,
    account_name: str,
    ai_fix: str = "",
) -> dict:
    owners = TEAMS[team]
    owner_id, owner_name = owners[0], owners[1]
    exposure = 5200 + (idx * 137) % 24000
    margin = round(exposure * 0.34)
    penalty = round(exposure * 0.57)
    pre_invoice = 1 if idx % 3 == 0 else 0
    invoice = "Pre-Invoice" if pre_invoice else "Post-Invoice"
    return {
        "issue_id": f"VP-ISS-{idx:03d}",
        "account_id": account_id,
        "account_name": account_name,
        "order_id": f"ORD-{40 + idx}",
        "issue_type": issue_type,
        "team": team,
        "priority": priority,
        "dollar_exposure": float(exposure),
        "margin_at_risk": float(margin),
        "penalty_exposure": float(penalty),
        "invoice_status": invoice,
        "pre_invoice": pre_invoice,
        "sla_days_remaining": sla_days,
        "opened_date": f"2026-03-{(idx % 28) + 1:02d}",
        "status": "Open",
        "current_owner_id": owner_id,
        "current_owner_name": owner_name,
        "current_owner_team": team,
        "secondary_owner_id": "",
        "secondary_owner_name": "",
        "secondary_owner_team": "",
        "sla_health": sla_health,
        "live_progress_primary": "Investigation in progress",
        "live_progress_secondary": "",
        "completion_primary": 30 + (idx % 50),
        "completion_secondary": "",
        "ai_fix_1": ai_fix,
        "ai_confidence_1": 86.0 if ai_fix else 0.0,
        "ai_source_1": "SAP + Contract Repository" if ai_fix else "",
        "ai_fix_2": "",
        "ai_confidence_2": 0.0,
        "ai_source_2": "",
        "root_cause_primary": f"Operational data mismatch detected for {account_name} — {issue_type.lower()}",
        "root_cause_secondary": "",
        "capa_ids": "CAPA-007" if idx % 2 == 0 else "CAPA-012",
        "next_action_primary": f"Resolve {issue_type.lower()} for {account_name}",
        "next_action_secondary": "",
        "recurrence_count": 1 + (idx % 3),
        "recurrence_period": "this period",
        "capa_exists": "Yes",
        "vp_action_signal": "Monitor — standard portfolio review",
    }


def main() -> None:
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        existing = list(reader)

    base = existing[:9]
    sla_risk_needed = 9 - sum(1 for r in base if is_sla_risk(r))
    escalation_needed = 4 - sum(1 for r in base if is_escalation(r))

    team_counts = {t: sum(1 for r in base if r["team"] == t) for t in TEAM_QUOTAS}
    new_rows: list[dict] = []
    idx = 10

    while idx <= 47:
        team = min(TEAM_QUOTAS, key=lambda t: team_counts[t] / TEAM_QUOTAS[t])
        if team_counts[team] >= TEAM_QUOTAS[team]:
            team = next(t for t in TEAM_QUOTAS if team_counts[t] < TEAM_QUOTAS[t])

        acct_id, acct_name = ACCOUNTS[(idx - 10) % len(ACCOUNTS)]
        issue_type = ISSUE_TYPES[(idx - 10) % len(ISSUE_TYPES)]

        if escalation_needed > 0:
            priority = "CRITICAL" if escalation_needed == 1 else "HIGH"
            escalation_needed -= 1
        else:
            priority = ("MEDIUM", "LOW", "MEDIUM", "LOW")[idx % 4]

        if sla_risk_needed > 0:
            if sla_risk_needed % 2 == 0:
                sla_days, sla_health = 0, "Breached"
            elif sla_risk_needed % 3 == 0:
                sla_days, sla_health = 1, "At Risk"
            else:
                sla_days, sla_health = 2, "On Track"
            sla_risk_needed -= 1
        else:
            sla_days = 3 + (idx % 10)
            sla_health = ("On Track", "Watch", "On Track")[idx % 3]

        ai_fix = ""
        if idx <= 12:
            ai_fix = f"Apply recommended correction for {acct_name} — {issue_type.split('—')[0].strip()}"

        row = make_row(
            idx,
            team,
            priority=priority,
            sla_days=sla_days,
            sla_health=sla_health,
            issue_type=issue_type,
            account_id=acct_id,
            account_name=acct_name,
            ai_fix=ai_fix,
        )
        new_rows.append(row)
        team_counts[team] += 1
        idx += 1

    all_rows = base + new_rows
    assert len(all_rows) == 47, len(all_rows)
    assert sum(1 for r in all_rows if is_sla_risk(r)) == 9, sum(1 for r in all_rows if is_sla_risk(r))
    assert sum(1 for r in all_rows if is_escalation(r)) == 4, sum(1 for r in all_rows if is_escalation(r))
    assert all(r["issue_id"] != r2["issue_id"] or r is r2 for r in all_rows for r2 in all_rows)

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADER)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"Wrote {len(all_rows)} rows to {CSV_PATH}")
    print(f"SLA risk: {sum(1 for r in all_rows if is_sla_risk(r))}")
    print(f"Escalation: {sum(1 for r in all_rows if is_escalation(r))}")
    for t in TEAM_QUOTAS:
        print(f"  {t}: {sum(1 for r in all_rows if r['team'] == t)}")


if __name__ == "__main__":
    main()
