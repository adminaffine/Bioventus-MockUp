"""
Data Integrity Engine: 6 categories of checks.
Referential, Entity, Domain, Temporal, Cross-System Consistency, Schema.
"""
from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

# ---------------------------------------------------------------------------
# Category 1: Referential integrity rules
# ---------------------------------------------------------------------------
REFERENTIAL_RULES = [
    {"name": "Sales -> Customer Linkage", "source": "sales_orders", "source_key": "customer_id", "target": "customer_master", "target_key": "customer_id", "severity": "CRITICAL", "regulation": ["SOX"], "business_impact": "Revenue cannot be attributed to unknown customers"},
    {"name": "Sales -> Product Linkage", "source": "sales_orders", "source_key": "product_id", "target": "product_catalog", "target_key": "product_id", "severity": "HIGH", "regulation": ["FDA"], "business_impact": "Orders linked to untracked or recalled products"},
    {"name": "Patient -> Customer Linkage", "source": "patient_support", "source_key": "customer_id", "target": "customer_master", "target_key": "customer_id", "severity": "CRITICAL", "regulation": ["HIPAA", "FDA MDR"], "business_impact": "Patient cases cannot be traced to verified customers"},
    {"name": "Patient -> Product Linkage", "source": "patient_support", "source_key": "product_id", "target": "product_catalog", "target_key": "product_id", "severity": "CRITICAL", "regulation": ["FDA MDR"], "business_impact": "Adverse events linked to unregistered devices"},
]

# Orders on recalled products (filter on target)
RECALLED_PRODUCT_RULE = {"name": "Orders on Recalled Products", "source": "sales_orders", "source_key": "product_id", "target": "product_catalog", "target_key": "product_id", "target_filter": "recall_status = 'RECALLED'", "severity": "CRITICAL", "regulation": ["FDA"], "business_impact": "Recalled products still being sold"}


def _get_conn():
    return sqlite3.connect(DB_PATH)


def _run_referential_checks(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    reports = []
    c = conn.cursor()
    for rule in REFERENTIAL_RULES:
        c.execute(f"SELECT {rule['source_key']} FROM [{rule['source']}]")
        source_keys = [str(r[0]) for r in c.fetchall() if r[0] is not None]
        c.execute(f"SELECT {rule['target_key']} FROM [{rule['target']}]")
        valid_keys = set(str(r[0]) for r in c.fetchall() if r[0] is not None)
        violations = [k for k in source_keys if k not in valid_keys]
        total = len(source_keys)
        reports.append({
            "rule_name": rule["name"],
            "source": rule["source"],
            "target": rule["target"],
            "total_checked": total,
            "violations": len(violations),
            "violation_pct": round(100 * len(violations) / total, 1) if total else 0,
            "sample_ids": violations[:10],
            "severity": rule["severity"],
            "regulation": rule.get("regulation", []),
            "business_impact": rule.get("business_impact", ""),
        })
    # Recalled products: orders whose product_id points to a RECALLED product
    c.execute("SELECT product_id FROM product_catalog WHERE recall_status = 'RECALLED'")
    recalled = set(str(r[0]) for r in c.fetchall())
    c.execute("SELECT order_id, customer_id, product_id FROM sales_orders")
    orders = c.fetchall()
    recalled_orders = [r for r in orders if str(r[2]) in recalled]
    reports.append({
        "rule_name": RECALLED_PRODUCT_RULE["name"],
        "source": "sales_orders",
        "target": "product_catalog",
        "total_checked": len(orders),
        "violations": len(recalled_orders),
        "violation_pct": round(100 * len(recalled_orders) / len(orders), 1) if orders else 0,
        "sample_ids": [r[0] for r in recalled_orders[:10]],
        "severity": RECALLED_PRODUCT_RULE["severity"],
        "regulation": RECALLED_PRODUCT_RULE["regulation"],
        "business_impact": RECALLED_PRODUCT_RULE["business_impact"],
    })
    return reports


# ---------------------------------------------------------------------------
# Category 2: Entity integrity (duplicates, fuzzy)
# ---------------------------------------------------------------------------
def _run_entity_checks(conn: sqlite3.Connection) -> Dict[str, Any]:
    c = conn.cursor()
    # Exact duplicate customer_id
    c.execute("SELECT customer_id, COUNT(*) FROM customer_master GROUP BY customer_id HAVING COUNT(*) > 1")
    dup_rows = c.fetchall()
    exact_dup_count = sum(r[1] for r in dup_rows)
    clusters = [{"customer_id": r[0], "count": r[1]} for r in dup_rows[:20]]
    # Fuzzy: simple name similarity (same first letter + same last name prefix) - placeholder for real fuzzy
    c.execute("SELECT customer_id, first_name, last_name, address, dob FROM customer_master")
    rows = c.fetchall()
    fuzzy_candidates = 0
    for i, r1 in enumerate(rows):
        for r2 in rows[i + 1 : min(i + 50, len(rows))]:
            if r1[2] and r2[2] and r1[2][:3].upper() == r2[2][:3].upper() and (r1[1] or "").upper()[:1] == (r2[1] or "").upper()[:1]:
                fuzzy_candidates += 1
                break
    return {
        "exact_duplicate_count": exact_dup_count,
        "exact_duplicate_clusters": len(dup_rows),
        "sample_clusters": clusters,
        "fuzzy_merge_candidates": min(fuzzy_candidates, 50),
    }


# ---------------------------------------------------------------------------
# Category 3: Domain integrity (allowed values)
# ---------------------------------------------------------------------------
FIELD_RULES = {
    "account_status": {"allowed": ["Active", "Inactive", "Pending", "Churned"], "case_sensitive": False},
    "device_class": {"allowed": ["I", "II", "III"], "case_sensitive": True, "null_allowed": False},
    "case_status": {"allowed": ["Open", "Closed", "Pending", "Escalated"], "case_sensitive": True},
    "recall_status": {"allowed": ["Active", "RECALLED", "Resolved", "None", "UNDER_REVIEW"], "null_allowed": True},
}


def _run_domain_checks(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    c = conn.cursor()
    reports = []
    for table, col_map in [("customer_master", ["account_status"]), ("product_catalog", ["device_class", "recall_status"]), ("patient_support", ["case_status"])]:
        for col in col_map:
            if col not in FIELD_RULES:
                continue
            rule = FIELD_RULES[col]
            c.execute(f"SELECT {col} FROM [{table}]")
            values = [r[0] for r in c.fetchall()]
            allowed = set(s.strip().lower() for s in rule["allowed"]) if not rule.get("case_sensitive") else set(rule["allowed"])
            violations = []
            for v in values:
                if v is None or str(v).strip() == "":
                    if not rule.get("null_allowed", True):
                        violations.append(v)
                    continue
                vn = str(v).strip().lower() if not rule.get("case_sensitive") else str(v).strip()
                if vn not in allowed and (str(v).strip() not in rule["allowed"]):
                    violations.append(v)
            if violations:
                reports.append({"dataset": table, "field": col, "violations": len(violations), "sample_values": list(set(str(x) for x in violations))[:5]})
    return reports


# ---------------------------------------------------------------------------
# Category 4: Temporal integrity
# ---------------------------------------------------------------------------
def _run_temporal_checks(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    c = conn.cursor()
    reports = []
    today = datetime.now().date()
    # ship_date >= order_date
    c.execute("SELECT order_id, order_date, ship_date FROM sales_orders WHERE order_date IS NOT NULL AND ship_date IS NOT NULL")
    for r in c.fetchall():
        try:
            od = datetime.strptime(str(r[1])[:10], "%Y-%m-%d").date()
            sd = datetime.strptime(str(r[2])[:10], "%Y-%m-%d").date()
            if sd < od:
                reports.append({"rule": "Ship After Order", "dataset": "sales_orders", "order_id": r[0], "order_date": str(r[1]), "ship_date": str(r[2]), "severity": "HIGH"})
        except Exception:
            pass
    # order_date <= today (no future)
    c.execute("SELECT order_id, order_date FROM sales_orders WHERE order_date IS NOT NULL")
    for r in c.fetchall():
        try:
            od = datetime.strptime(str(r[1])[:10], "%Y-%m-%d").date()
            if od > today:
                reports.append({"rule": "No Future Order Dates", "dataset": "sales_orders", "order_id": r[0], "order_date": str(r[1]), "severity": "HIGH"})
        except Exception:
            pass
    # resolution_date >= case_date when both present
    c.execute("SELECT case_id, case_date, resolution_date FROM patient_support WHERE case_date IS NOT NULL AND resolution_date IS NOT NULL")
    for r in c.fetchall():
        try:
            cd = datetime.strptime(str(r[1])[:10], "%Y-%m-%d").date()
            rd = datetime.strptime(str(r[2])[:10], "%Y-%m-%d").date()
            if rd < cd:
                reports.append({"rule": "Resolution After Case", "dataset": "patient_support", "case_id": r[0], "case_date": str(r[1]), "resolution_date": str(r[2]), "severity": "MEDIUM"})
        except Exception:
            pass
    return reports


# ---------------------------------------------------------------------------
# Category 5: Cross-system consistency (MASTER_CONFLICTS)
# ---------------------------------------------------------------------------
def _run_consistency_checks(conn: sqlite3.Connection) -> Dict[str, Any]:
    c = conn.cursor()
    c.execute("SELECT customer_id, field_name, crm_value, erp_value, conflict_type FROM master_conflicts")
    rows = c.fetchall()
    by_type: Dict[str, int] = {}
    for r in rows:
        t = r[4] or "Unknown"
        by_type[t] = by_type.get(t, 0) + 1
    return {
        "total_conflicts": len(rows),
        "by_conflict_type": by_type,
        "sample": [{"customer_id": r[0], "field": r[1], "crm_value": r[2], "erp_value": r[3], "conflict_type": r[4]} for r in rows[:15]],
    }


# ---------------------------------------------------------------------------
# Category 6: Schema integrity (drift) - compare baseline vs upload
# ---------------------------------------------------------------------------
BASELINE_SCHEMAS = {
    "customer_master": ["customer_id", "first_name", "last_name", "email", "phone", "dob", "address", "city", "state", "zip", "country", "customer_segment", "account_status"],
    "sales_orders": ["order_id", "customer_id", "product_id", "product_name", "order_date", "ship_date", "quantity", "unit_price", "total_amount", "sales_rep_id", "region", "payment_method", "revenue_recognized"],
    "patient_support": ["case_id", "patient_id", "customer_id", "product_id", "case_type", "case_date", "resolution_date", "adverse_event_flag", "mdr_submitted", "consent_obtained", "phi_data_present", "case_status", "assigned_rep"],
    "product_catalog": ["product_id", "product_name", "product_category", "fda_clearance_number", "fda_clearance_date", "device_class", "manufacturer", "lot_number", "expiry_date", "recall_status", "hcpcs_code"],
}


def detect_schema_drift(dataset_name: str, uploaded_columns: List[str]) -> Dict[str, Any]:
    baseline = BASELINE_SCHEMAS.get(dataset_name.lower().replace("-", "_").replace(" ", "_"), [])
    if not baseline:
        baseline = BASELINE_SCHEMAS.get("customer_master", [])  # default
    baseline_set = set(baseline)
    upload_set = set(c.strip() for c in uploaded_columns if c)
    changes = []
    # Renamed: dob -> date_of_birth
    if "dob" not in upload_set and "date_of_birth" in upload_set:
        changes.append({"type": "COLUMN_RENAMED", "from": "dob", "to": "date_of_birth", "impact": "HIGH"})
    if "customer_segment" in baseline_set and "customer_segment" not in upload_set:
        changes.append({"type": "COLUMN_REMOVED", "column": "customer_segment", "impact": "MEDIUM"})
    for col in upload_set - baseline_set:
        if col not in ["dob", "date_of_birth"]:
            changes.append({"type": "COLUMN_ADDED", "column": col, "impact": "LOW"})
    return {
        "dataset": dataset_name,
        "baseline_columns": baseline,
        "uploaded_columns": uploaded_columns,
        "drift_detected": len(changes) > 0,
        "changes": changes,
        "pipeline_break_risk": "HIGH" if any(c.get("impact") == "HIGH" or c.get("impact") == "CRITICAL" for c in changes) else "MEDIUM" if changes else "LOW",
    }


# ---------------------------------------------------------------------------
# Trust score (0-100) per dataset
# ---------------------------------------------------------------------------
def compute_trust_scores(conn: sqlite3.Connection) -> Dict[str, Any]:
    ref_reports = _run_referential_checks(conn)
    ref_score = 100 - min(100, sum(r["violation_pct"] for r in ref_reports) / max(len(ref_reports), 1))
    entity = _run_entity_checks(conn)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM customer_master")
    n_c = c.fetchone()[0]
    entity_score = 100 - min(100, (entity["exact_duplicate_count"] or 0) / max(n_c, 1) * 50)
    domain_reports = _run_domain_checks(conn)
    domain_score = 100 - min(100, len(domain_reports) * 10)
    temporal_reports = _run_temporal_checks(conn)
    c.execute("SELECT COUNT(*) FROM sales_orders")
    n_so = c.fetchone()[0]
    temporal_score = 100 - min(100, len(temporal_reports) / max(n_so, 1) * 500)
    consistency = _run_consistency_checks(conn)
    consistency_score = 100 - min(100, consistency["total_conflicts"] / 2)
    freshness_score = 80  # placeholder
    # Weighted
    weights = (0.25, 0.20, 0.15, 0.15, 0.15, 0.10)
    enterprise = (
        ref_score * weights[0] + entity_score * weights[1] + domain_score * weights[2]
        + temporal_score * weights[3] + consistency_score * weights[4] + freshness_score * weights[5]
    ) * 100 / 100
    return {
        "customer_master": round(entity_score, 1),
        "sales_orders": round(min(ref_score, temporal_score), 1),
        "patient_support": 100 - min(100, len([r for r in ref_reports if r["source"] == "patient_support"]) * 5),
        "product_catalog": round(domain_score, 1),
        "enterprise_score": round(enterprise, 1),
        "by_dimension": {"referential": ref_score, "entity": entity_score, "domain": domain_score, "temporal": temporal_score, "consistency": consistency_score, "freshness": freshness_score},
    }


# ---------------------------------------------------------------------------
# Full integrity scan
# ---------------------------------------------------------------------------
def run_full_scan() -> Dict[str, Any]:
    if not DB_PATH.exists():
        return {"error": "Database not found", "referential": [], "entity": {}, "domain": [], "temporal": [], "consistency": {}, "trust_scores": {}}
    conn = _get_conn()
    try:
        ref = _run_referential_checks(conn)
        entity = _run_entity_checks(conn)
        domain = _run_domain_checks(conn)
        temporal = _run_temporal_checks(conn)
        consistency = _run_consistency_checks(conn)
        trust = compute_trust_scores(conn)
        total_violations = sum(r["violations"] for r in ref) + entity.get("exact_duplicate_count", 0) + sum(d.get("violations", 0) for d in domain) + len(temporal) + consistency.get("total_conflicts", 0)
        return {
            "referential": ref,
            "entity": entity,
            "domain": domain,
            "temporal": temporal,
            "consistency": consistency,
            "trust_scores": trust,
            "total_violations": total_violations,
            "summary": {
                "referential_violations": sum(r["violations"] for r in ref),
                "entity_duplicates": entity.get("exact_duplicate_count", 0),
                "domain_violations": sum(d.get("violations", 0) for d in domain),
                "temporal_violations": len(temporal),
                "consistency_conflicts": consistency.get("total_conflicts", 0),
            },
        }
    finally:
        conn.close()
