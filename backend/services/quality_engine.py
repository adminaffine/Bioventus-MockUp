"""
Data Quality rules and scoring logic for all 4 datasets.
Score = (Completeness×0.35 + Validity×0.25 + Uniqueness×0.20 + Consistency×0.20) × 100
"""
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

# DB path
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

def get_conn():
    return sqlite3.connect(DB_PATH)

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
def _valid_email(v: Any) -> bool:
    if v is None or str(v).strip() == "":
        return False
    return bool(re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", str(v).strip()))

def _valid_phone(v: Any) -> bool:
    if v is None or str(v).strip() == "":
        return False
    s = str(v).strip()
    # (XXX) XXX-XXXX or similar
    if re.match(r"^\(\d{3}\)\s*\d{3}-\d{4}$", s):
        return True
    if re.match(r"^\d{3}-\d{3}-\d{4}$", s):
        return True
    if len(s) == 10 and s.isdigit():
        return True
    return False

def _valid_date(v: Any) -> bool:
    if v is None or str(v).strip() == "":
        return False
    try:
        datetime.strptime(str(v).strip()[:10], "%Y-%m-%d")
        return True
    except Exception:
        return False

# ---------------------------------------------------------------------------
# CUSTOMER_MASTER quality
# ---------------------------------------------------------------------------
def profile_customer_master(conn: sqlite3.Connection) -> dict:
    c = conn.cursor()
    c.execute("SELECT * FROM customer_master")
    rows = c.fetchall()
    cols = [d[0] for d in c.description]
    n = len(rows)
    if n == 0:
        return _empty_profile("customer_master")

    # Completeness per column
    completeness = {}
    for i, col in enumerate(cols):
        non_null = sum(1 for r in rows if r[i] is not None and str(r[i]).strip() != "")
        completeness[col] = round(100 * non_null / n, 1)

    # Uniqueness: duplicate customer_id
    customer_ids = [r[0] for r in rows]
    unique_ids = set(customer_ids)
    dup_count = n - len(unique_ids)
    uniqueness_pct = 100 - round(100 * dup_count / n, 1) if n else 100

    # Validity: email format, phone format, dob
    email_invalid = sum(1 for r in rows if r[3] is not None and str(r[3]).strip() != "" and not _valid_email(r[3]))
    email_missing = sum(1 for r in rows if r[3] is None or str(r[3]).strip() == "")
    phone_invalid = sum(1 for r in rows if r[4] is not None and str(r[4]).strip() != "" and not _valid_phone(r[4]))
    dob_missing = sum(1 for r in rows if r[5] is None or str(r[5]).strip() == "")
    validity_ok = n - (email_invalid + phone_invalid)
    validity_pct = round(100 * validity_ok / n, 1) if n else 100

    # Consistency: state codes (mix of "CA" vs "California")
    state_inconsistent = 0
    for r in rows:
        s = r[8]
        if s and len(str(s)) > 2:  # full name
            state_inconsistent += 1
    consistency_ok = n - state_inconsistent
    consistency_pct = round(100 * consistency_ok / n, 1) if n else 100

    issues = []
    if email_missing:
        issues.append({"type": "Completeness", "column": "email", "count": email_missing, "severity": "High"})
    if dup_count:
        issues.append({"type": "Uniqueness", "column": "customer_id", "count": dup_count, "severity": "Critical"})
    if phone_invalid:
        issues.append({"type": "Validity", "column": "phone", "count": phone_invalid, "severity": "Medium"})
    if dob_missing:
        issues.append({"type": "Completeness", "column": "dob", "count": dob_missing, "severity": "High"})
    if state_inconsistent:
        issues.append({"type": "Consistency", "column": "state", "count": state_inconsistent, "severity": "Medium"})

    score = (completeness.get("email", 0) / 100 * 0.35 + validity_pct / 100 * 0.25 +
             uniqueness_pct / 100 * 0.20 + consistency_pct / 100 * 0.20) * 100
    score = round(min(100, max(0, score)), 1)

    return {
        "dataset": "customer_master",
        "row_count": n,
        "completeness": completeness,
        "completeness_overall": round(sum(completeness.values()) / len(cols), 1),
        "validity_pct": validity_pct,
        "uniqueness_pct": uniqueness_pct,
        "consistency_pct": consistency_pct,
        "overall_score": score,
        "issues": issues,
        "sample_bad_records": _sample_bad_customer(conn, email_missing, dup_count, phone_invalid),
    }


def _sample_bad_customer(conn, email_missing, dup_count, phone_invalid):
    c = conn.cursor()
    samples = []
    c.execute("SELECT * FROM customer_master WHERE email IS NULL OR email = '' LIMIT 3")
    for r in c.fetchall():
        samples.append({"issue": "missing_email", "customer_id": r[0], "email": r[3]})
    c.execute("SELECT customer_id, COUNT(*) FROM customer_master GROUP BY customer_id HAVING COUNT(*) > 1 LIMIT 2")
    for r in c.fetchall():
        samples.append({"issue": "duplicate_id", "customer_id": r[0], "count": r[1]})
    c.execute("SELECT customer_id, phone FROM customer_master WHERE phone IS NOT NULL AND phone != '' LIMIT 5")
    for r in c.fetchall():
        if not _valid_phone(r[1]):
            samples.append({"issue": "invalid_phone", "customer_id": r[0], "phone": r[1]})
            break
    return samples[:5]


# ---------------------------------------------------------------------------
# SALES_ORDERS quality
# ---------------------------------------------------------------------------
def profile_sales_orders(conn: sqlite3.Connection) -> dict:
    c = conn.cursor()
    c.execute("SELECT customer_id FROM customer_master")
    valid_cids = set(str(r[0]) for r in c.fetchall())
    c.execute("SELECT * FROM sales_orders")
    rows = c.fetchall()
    cols = [d[0] for d in c.description]
    n = len(rows)
    if n == 0:
        return _empty_profile("sales_orders")

    completeness = {}
    for i, col in enumerate(cols):
        non_null = sum(1 for r in rows if r[i] is not None and str(r[i]).strip() != "")
        completeness[col] = round(100 * non_null / n, 1)

    # Orphan customer_ids
    orphan = sum(1 for r in rows if str(r[1]) not in valid_cids)
    # ship_date < order_date
    bad_dates = 0
    neg_amount = 0
    missing_revenue = 0
    null_rep = 0
    for r in rows:
        order_date = r[4]
        ship_date = r[5]
        if order_date and ship_date:
            try:
                if datetime.strptime(str(ship_date)[:10], "%Y-%m-%d") < datetime.strptime(str(order_date)[:10], "%Y-%m-%d"):
                    bad_dates += 1
            except Exception:
                pass
        if r[8] is not None and float(r[8]) < 0:
            neg_amount += 1
        if r[12] is None or str(r[12]).strip() == "":
            missing_revenue += 1
        if r[9] is None or str(r[9]).strip() == "":
            null_rep += 1

    uniqueness_pct = 100  # order_id assumed unique
    validity_ok = n - orphan - bad_dates - neg_amount
    validity_pct = round(100 * max(0, validity_ok) / n, 1)
    consistency_ok = n - missing_revenue - null_rep
    consistency_pct = round(100 * consistency_ok / n, 1)

    issues = [
        {"type": "Referential Integrity", "column": "customer_id", "count": orphan, "severity": "Critical"},
        {"type": "Validity", "column": "ship_date/order_date", "count": bad_dates, "severity": "High"},
        {"type": "Validity", "column": "total_amount", "count": neg_amount, "severity": "High"},
        {"type": "Completeness", "column": "revenue_recognized", "count": missing_revenue, "severity": "High"},
        {"type": "Completeness", "column": "sales_rep_id", "count": null_rep, "severity": "Medium"},
    ]
    issues = [i for i in issues if i["count"] > 0]

    score = (sum(completeness.values()) / len(cols) / 100 * 0.35 + validity_pct / 100 * 0.25 +
             uniqueness_pct / 100 * 0.20 + consistency_pct / 100 * 0.20) * 100
    score = round(min(100, max(0, score)), 1)

    return {
        "dataset": "sales_orders",
        "row_count": n,
        "completeness": completeness,
        "completeness_overall": round(sum(completeness.values()) / len(cols), 1),
        "validity_pct": validity_pct,
        "uniqueness_pct": uniqueness_pct,
        "consistency_pct": consistency_pct,
        "overall_score": score,
        "issues": issues,
        "integration_orphans": orphan,
    }


# ---------------------------------------------------------------------------
# PRODUCT_CATALOG quality
# ---------------------------------------------------------------------------
def profile_product_catalog(conn: sqlite3.Connection) -> dict:
    c = conn.cursor()
    c.execute("SELECT * FROM product_catalog")
    rows = c.fetchall()
    cols = [d[0] for d in c.description]
    n = len(rows)
    if n == 0:
        return _empty_profile("product_catalog")

    completeness = {}
    for i, col in enumerate(cols):
        non_null = sum(1 for r in rows if r[i] is not None and str(r[i]).strip() != "")
        completeness[col] = round(100 * non_null / n, 1)

    missing_fda = sum(1 for r in rows if r[3] is None or str(r[3]).strip() == "")
    missing_class = sum(1 for r in rows if r[5] is None or str(r[5]).strip() == "")
    expiry_past_no_recall = 0
    for r in rows:
        exp = r[8]
        recall = r[9]
        if exp and _valid_date(exp):
            try:
                if datetime.strptime(str(exp)[:10], "%Y-%m-%d") < datetime.now() and (recall is None or str(recall).strip() == ""):
                    expiry_past_no_recall += 1
            except Exception:
                pass
    missing_hcpcs = sum(1 for r in rows if r[10] is None or str(r[10]).strip() == "")
    # Inconsistent casing (simplified: check if product_name is all upper or all lower)
    casing_issues = 0
    for r in rows:
        name = str(r[1]) if r[1] else ""
        if name and (name.isupper() or name.islower()) and len(name) > 3:
            casing_issues += 1

    validity_pct = round(100 * (n - expiry_past_no_recall) / n, 1)
    consistency_pct = round(100 * (n - casing_issues) / n, 1) if n else 100
    uniqueness_pct = 100

    issues = [
        {"type": "Completeness", "column": "fda_clearance_number", "count": missing_fda, "severity": "Critical"},
        {"type": "Completeness", "column": "device_class", "count": missing_class, "severity": "High"},
        {"type": "Consistency", "column": "expiry_date/recall_status", "count": expiry_past_no_recall, "severity": "High"},
        {"type": "Completeness", "column": "hcpcs_code", "count": missing_hcpcs, "severity": "Medium"},
        {"type": "Consistency", "column": "product_name", "count": casing_issues, "severity": "Low"},
    ]
    issues = [i for i in issues if i["count"] > 0]

    score = (sum(completeness.values()) / len(cols) / 100 * 0.35 + validity_pct / 100 * 0.25 +
             uniqueness_pct / 100 * 0.20 + consistency_pct / 100 * 0.20) * 100
    score = round(min(100, max(0, score)), 1)

    return {
        "dataset": "product_catalog",
        "row_count": n,
        "completeness": completeness,
        "completeness_overall": round(sum(completeness.values()) / len(cols), 1),
        "validity_pct": validity_pct,
        "uniqueness_pct": uniqueness_pct,
        "consistency_pct": consistency_pct,
        "overall_score": score,
        "issues": issues,
    }


# ---------------------------------------------------------------------------
# PATIENT_SUPPORT quality
# ---------------------------------------------------------------------------
def profile_patient_support(conn: sqlite3.Connection) -> dict:
    c = conn.cursor()
    c.execute("SELECT customer_id FROM customer_master")
    valid_cids = set(str(r[0]) for r in c.fetchall())
    c.execute("SELECT * FROM patient_support")
    rows = c.fetchall()
    cols = [d[0] for d in c.description]
    n = len(rows)
    if n == 0:
        return _empty_profile("patient_support")

    completeness = {}
    for i, col in enumerate(cols):
        non_null = sum(1 for r in rows if r[i] is not None and str(r[i]).strip() != "")
        completeness[col] = round(100 * non_null / n, 1)

    mdr_gap = sum(1 for r in rows if r[7] == 1 and (r[8] is None or r[8] == 0))
    # Align with PII consent-gap filter and compliance_mapper: PHI flagged without documented consent (NULL or 0).
    hipaa_gap = sum(1 for r in rows if r[10] == 1 and (r[9] is None or r[9] == 0))
    closed_no_resolution = sum(1 for r in rows if (r[11] == "Closed" or (r[11] and "losed" in str(r[11]))) and (r[6] is None or str(r[6]).strip() == ""))
    orphan = sum(1 for r in rows if str(r[2]) not in valid_cids)

    validity_pct = round(100 * (n - mdr_gap - hipaa_gap - closed_no_resolution) / n, 1)
    consistency_pct = round(100 * (n - closed_no_resolution) / n, 1)
    uniqueness_pct = 100

    issues = [
        {"type": "Compliance", "column": "mdr_submitted", "count": mdr_gap, "severity": "Critical"},
        {"type": "Compliance", "column": "consent_obtained", "count": hipaa_gap, "severity": "Critical"},
        {"type": "Consistency", "column": "resolution_date/case_status", "count": closed_no_resolution, "severity": "High"},
        {"type": "Referential Integrity", "column": "customer_id", "count": orphan, "severity": "High"},
    ]
    issues = [i for i in issues if i["count"] > 0]

    mdr_gap_cases: List[Dict[str, Any]] = []
    for r in rows:
        if r[7] == 1 and (r[8] is None or r[8] == 0):
            mdr_gap_cases.append({cols[i]: r[i] for i in range(len(cols))})
            if len(mdr_gap_cases) >= 20:
                break

    score = (sum(completeness.values()) / len(cols) / 100 * 0.35 + validity_pct / 100 * 0.25 +
             uniqueness_pct / 100 * 0.20 + consistency_pct / 100 * 0.20) * 100
    score = round(min(100, max(0, score)), 1)

    return {
        "dataset": "patient_support",
        "row_count": n,
        "completeness": completeness,
        "completeness_overall": round(sum(completeness.values()) / len(cols), 1),
        "validity_pct": validity_pct,
        "uniqueness_pct": uniqueness_pct,
        "consistency_pct": consistency_pct,
        "overall_score": score,
        "issues": issues,
        "mdr_gap_count": mdr_gap,
        "hipaa_gap_count": hipaa_gap,
        "mdr_gap_cases": mdr_gap_cases,
    }


def _empty_profile(name: str) -> dict:
    return {
        "dataset": name,
        "row_count": 0,
        "completeness": {},
        "completeness_overall": 0,
        "validity_pct": 0,
        "uniqueness_pct": 0,
        "consistency_pct": 0,
        "overall_score": 0,
        "issues": [],
    }


PROFILERS = {
    "customer_master": profile_customer_master,
    "sales_orders": profile_sales_orders,
    "product_catalog": profile_product_catalog,
    "patient_support": profile_patient_support,
}


def get_quality_profile(dataset_name: str) -> dict:
    conn = get_conn()
    try:
        fn = PROFILERS.get(dataset_name)
        if not fn:
            return _empty_profile(dataset_name)
        return fn(conn)
    finally:
        conn.close()
