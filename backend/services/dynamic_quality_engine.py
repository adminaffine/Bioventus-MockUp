"""
Dynamic Data Quality engine for ANY uploaded CSV.
Dataset type inferred from filename/columns; runs completeness, validity,
uniqueness, consistency, integration (when 2+ files), and regulatory mapping.
"""
import re
from datetime import datetime
from typing import Any

import pandas as pd

# Same formula as existing engine
SCORE_WEIGHTS = (0.35, 0.25, 0.20, 0.20)  # completeness, validity, uniqueness, consistency

DATASET_TYPE_PATTERNS = {
    "CUSTOMER_MASTER": ["customer_master", "customer"],
    "SALES_ORDERS": ["sales_order", "sales"],
    "PRODUCT_CATALOG": ["product_catalog", "product"],
    "PATIENT_SUPPORT": ["patient_support", "patient"],
}


def detect_dataset_type(filename: str, columns: list[str]) -> str:
    lower = filename.lower()
    cols_lower = [c.lower() for c in columns]
    for dtype, patterns in DATASET_TYPE_PATTERNS.items():
        if any(p in lower for p in patterns):
            return dtype
    if "customer_id" in cols_lower and "email" in cols_lower and "first_name" in cols_lower:
        return "CUSTOMER_MASTER"
    if "order_id" in cols_lower and "customer_id" in cols_lower and "total_amount" in cols_lower:
        return "SALES_ORDERS"
    if "product_id" in cols_lower and "fda_clearance" in " ".join(cols_lower):
        return "PRODUCT_CATALOG"
    if "case_id" in cols_lower and "adverse_event" in cols_lower:
        return "PATIENT_SUPPORT"
    return "unknown"


def _empty(v: Any) -> bool:
    return v is None or (isinstance(v, str) and str(v).strip() == "")


def _pct(null_count: int, total: int) -> float:
    return round(100 * (total - null_count) / total, 1) if total else 0


def _valid_email(v: Any) -> bool:
    if _empty(v):
        return False
    return bool(re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", str(v).strip()))


def _valid_phone(v: Any) -> bool:
    if _empty(v):
        return False
    s = str(v).strip()
    if re.match(r"^\(\d{3}\)\s*\d{3}-\d{4}$", s):
        return True
    if re.match(r"^\d{3}-\d{3}-\d{4}$", s):
        return True
    if len(s) == 10 and s.isdigit():
        return True
    return False


def _valid_date(v: Any) -> bool:
    if _empty(v):
        return False
    try:
        datetime.strptime(str(v).strip()[:10], "%Y-%m-%d")
        return True
    except Exception:
        return False


def _severity_from_null_pct(pct: float) -> str:
    if pct >= 30:
        return "Critical"
    if pct >= 15:
        return "High"
    if pct >= 5:
        return "Medium"
    return "Low"


def profile_dataframe(
    df: pd.DataFrame,
    dataset_type: str,
    display_name: str,
    reference_ids: dict[str, set] | None = None,
) -> dict:
    """Profile a single DataFrame. reference_ids: e.g. {'customer_id': set(), 'product_id': set()} for integration."""
    reference_ids = reference_ids or {}
    n = len(df)
    cols = list(df.columns)
    if n == 0:
        return _empty_profile(display_name, dataset_type)

    # Completeness per column
    completeness = {}
    completeness_issues = []
    for c in cols:
        null_count = df[c].isna().sum() + (df[c].astype(str).str.strip() == "").sum()
        pct = round(100 * (n - null_count) / n, 1)
        completeness[c] = pct
        null_pct = 100 - pct
        if null_pct > 5:
            completeness_issues.append({
                "type": "Completeness",
                "column": c,
                "count": int(null_count),
                "severity": _severity_from_null_pct(null_pct),
                "regulation": _map_column_to_regulation(c, dataset_type),
            })

    completeness_overall = round(sum(completeness.values()) / len(cols), 1) if cols else 0

    # Validity by column name patterns
    validity_issues = []
    validity_issue_record_count = 0
    for c in cols:
        c_lower = c.lower()
        if "email" in c_lower:
            invalid = (~df[c].astype(str).str.strip().replace("", pd.NA).isna()) & ~df[c].apply(_valid_email)
            count = invalid.sum()
            if count:
                validity_issues.append({"type": "Validity", "column": c, "count": int(count), "severity": "Medium", "regulation": "HIPAA"})
                validity_issue_record_count += count
        if "phone" in c_lower:
            invalid = (~df[c].astype(str).str.strip().replace("", pd.NA).isna()) & ~df[c].apply(_valid_phone)
            count = invalid.sum()
            if count:
                validity_issues.append({"type": "Validity", "column": c, "count": int(count), "severity": "Medium"})
                validity_issue_record_count += count
        if "amount" in c_lower or "price" in c_lower or "total" in c_lower:
            try:
                numeric = pd.to_numeric(df[c], errors="coerce")
                neg = (numeric < 0).sum()
                if neg:
                    validity_issues.append({"type": "Validity", "column": c, "count": int(neg), "severity": "Critical"})
                    validity_issue_record_count += neg
            except Exception:
                pass
        if "date" in c_lower or "dob" in c_lower or "expiry" in c_lower:
            invalid = (~df[c].astype(str).str.strip().replace("", pd.NA).isna()) & ~df[c].apply(_valid_date)
            count = invalid.sum()
            if count:
                validity_issues.append({"type": "Validity", "column": c, "count": int(count), "severity": "Medium"})
                validity_issue_record_count += count
    validity_ok = max(0, n - int(validity_issue_record_count))
    validity_pct = round(100 * validity_ok / n, 1) if n else 100

    # Uniqueness: id columns
    uniqueness_issues = []
    uniqueness_pct = 100
    for c in cols:
        c_lower = c.lower()
        if "id" in c_lower and ("customer" in c_lower or "order" in c_lower or "product" in c_lower or "case" in c_lower):
            dup = n - df[c].nunique()
            if dup > 0:
                uniqueness_issues.append({"type": "Uniqueness", "column": c, "count": int(dup), "severity": "Critical"})
                uniqueness_pct = min(uniqueness_pct, round(100 * (n - dup) / n, 1))
    if not uniqueness_issues:
        uniqueness_pct = 100

    # Consistency + domain rules
    consistency_issues = []
    consistency_ok = n

    if dataset_type == "SALES_ORDERS":
        order_col = next((x for x in cols if "order_date" in x.lower()), None)
        ship_col = next((x for x in cols if "ship_date" in x.lower()), None)
        if order_col and ship_col:
            try:
                order_d = pd.to_datetime(df[order_col], errors="coerce")
                ship_d = pd.to_datetime(df[ship_col], errors="coerce")
                bad = (ship_d < order_d).sum()
                if bad:
                    consistency_issues.append({"type": "Consistency", "column": f"{ship_col}/{order_col}", "count": int(bad), "severity": "High"})
                    consistency_ok -= bad
            except Exception:
                pass
        rev_col = next((x for x in cols if "revenue" in x.lower()), None)
        if rev_col:
            missing = _empty_count(df[rev_col])
            if missing:
                consistency_issues.append({"type": "Compliance", "column": rev_col, "count": int(missing), "severity": "High", "regulation": "SOX"})
                consistency_ok -= int(missing)

    if dataset_type == "PATIENT_SUPPORT":
        adverse_col = next((x for x in cols if "adverse_event" in x.lower()), None)
        mdr_col = next((x for x in cols if "mdr_submitted" in x.lower()), None)
        if adverse_col and mdr_col:
            adverse_true = df[adverse_col].astype(str).str.upper().isin(["TRUE", "1", "YES"])
            mdr_missing = df[mdr_col].astype(str).str.strip().replace("", pd.NA).isna() | (df[mdr_col].astype(str).str.upper() == "FALSE")
            critical = (adverse_true & mdr_missing).sum()
            if critical:
                consistency_issues.append({"type": "Compliance", "column": mdr_col, "count": int(critical), "severity": "Critical", "regulation": "FDA MDR"})
                consistency_ok -= int(critical)
        phi_col = next((x for x in cols if "phi_data" in x.lower()), None)
        consent_col = next((x for x in cols if "consent" in x.lower()), None)
        if phi_col and consent_col:
            phi_true = df[phi_col].astype(str).str.upper().isin(["TRUE", "1", "YES"])
            consent_missing = df[consent_col].astype(str).str.strip().replace("", pd.NA).isna() | (df[consent_col].astype(str).str.upper() == "FALSE")
            critical = (phi_true & consent_missing).sum()
            if critical:
                consistency_issues.append({"type": "Compliance", "column": consent_col, "count": int(critical), "severity": "Critical", "regulation": "HIPAA"})
                consistency_ok -= int(critical)
        status_col = next((x for x in cols if "case_status" in x.lower() or "status" in x.lower()), None)
        res_col = next((x for x in cols if "resolution_date" in x.lower()), None)
        if status_col and res_col:
            closed = df[status_col].astype(str).str.upper().str.contains("CLOSED", na=False)
            no_res = df[res_col].astype(str).str.strip().replace("", pd.NA).isna()
            bad = (closed & no_res).sum()
            if bad:
                consistency_issues.append({"type": "Consistency", "column": f"{res_col}/{status_col}", "count": int(bad), "severity": "High"})
                consistency_ok -= int(bad)

    if dataset_type == "PRODUCT_CATALOG":
        fda_col = next((x for x in cols if "fda_clearance" in x.lower() and "date" not in x.lower()), None)
        if fda_col:
            missing = _empty_count(df[fda_col])
            if missing:
                consistency_issues.append({"type": "Compliance", "column": fda_col, "count": int(missing), "severity": "Critical", "regulation": "FDA 21 CFR"})
        class_col = next((x for x in cols if "device_class" in x.lower()), None)
        if class_col:
            missing = _empty_count(df[class_col])
            if missing:
                consistency_issues.append({"type": "Compliance", "column": class_col, "count": int(missing), "severity": "High", "regulation": "FDA 21 CFR"})
        expiry_col = next((x for x in cols if "expiry" in x.lower()), None)
        recall_col = next((x for x in cols if "recall" in x.lower()), None)
        if expiry_col and recall_col:
            try:
                expiry_d = pd.to_datetime(df[expiry_col], errors="coerce")
                past = expiry_d < pd.Timestamp.now()
                recall_empty = df[recall_col].astype(str).str.strip().replace("", pd.NA).isna()
                bad = (past & recall_empty).sum()
                if bad:
                    consistency_issues.append({"type": "Compliance", "column": f"{expiry_col}/{recall_col}", "count": int(bad), "severity": "Critical", "regulation": "FDA"})
                    consistency_ok -= int(bad)
            except Exception:
                pass
        hcpcs_col = next((x for x in cols if "hcpcs" in x.lower()), None)
        if hcpcs_col:
            missing = _empty_count(df[hcpcs_col])
            if missing:
                consistency_issues.append({"type": "Compliance", "column": hcpcs_col, "count": missing, "severity": "Medium"})

    if dataset_type == "CUSTOMER_MASTER":
        dob_col = next((x for x in cols if "dob" in x.lower() or "birth" in x.lower()), None)
        if dob_col:
            missing = _empty_count(df[dob_col])
            if missing:
                consistency_issues.append({"type": "Compliance", "column": dob_col, "count": int(missing), "severity": "High", "regulation": "HIPAA"})

    consistency_pct = round(100 * max(0, consistency_ok) / n, 1) if n else 100

    # Referential integrity (orphans) when reference_ids provided
    for ref_key, ref_set in reference_ids.items():
        if ref_key not in cols or not ref_set:
            continue
        orphans = ~df[ref_key].astype(str).isin(ref_set)
        orphan_count = orphans.sum()
        if orphan_count:
            uniqueness_issues.append({"type": "Referential Integrity", "column": ref_key, "count": int(orphan_count), "severity": "Critical"})
            uniqueness_pct = min(uniqueness_pct, round(100 * (n - orphan_count) / n, 1))

    all_issues = completeness_issues + validity_issues + uniqueness_issues + consistency_issues

    score = (
        completeness_overall / 100 * SCORE_WEIGHTS[0]
        + validity_pct / 100 * SCORE_WEIGHTS[1]
        + (uniqueness_pct / 100 if uniqueness_pct else 1) * SCORE_WEIGHTS[2]
        + consistency_pct / 100 * SCORE_WEIGHTS[3]
    ) * 100
    score = round(min(100, max(0, score)), 1)

    return {
        "dataset": display_name,
        "dataset_type": dataset_type,
        "row_count": n,
        "completeness": completeness,
        "completeness_overall": completeness_overall,
        "validity_pct": validity_pct,
        "uniqueness_pct": uniqueness_pct,
        "consistency_pct": consistency_pct,
        "overall_score": score,
        "issues": all_issues,
    }


def _empty_count(ser: pd.Series) -> int:
    n = ser.isna().sum() + (ser.astype(str).str.strip() == "").sum()
    return int(n)


def _map_column_to_regulation(col: str, dataset_type: str) -> str | None:
    c = col.lower()
    if "email" in c or "dob" in c or "phi" in c or "consent" in c:
        return "HIPAA"
    if "fda" in c or "device_class" in c or "mdr" in c or "adverse" in c:
        return "FDA 21 CFR / FDA MDR"
    if "revenue" in c:
        return "SOX"
    if "payment" in c:
        return "PCI-DSS"
    return None


def _empty_profile(display_name: str, dataset_type: str) -> dict:
    return {
        "dataset": display_name,
        "dataset_type": dataset_type,
        "row_count": 0,
        "completeness": {},
        "completeness_overall": 0,
        "validity_pct": 0,
        "uniqueness_pct": 0,
        "consistency_pct": 0,
        "overall_score": 0,
        "issues": [],
    }


def run_integration_checks(
    file_profiles: list[dict],
    id_columns_by_type: dict[str, str],
) -> list[dict]:
    """Given list of profiles (each has dataset_type, and we need to get IDs from data), return edges with match rate.
    We don't have DF here - we need to be called with DFs. So instead, accept (dataset_type, display_name, df) list
    and compute integration from DFs.
    """
    # This is called from upload router with session data that has DFs stored or we re-read CSVs
    return []


def compute_integration_edges(
    uploaded: list[tuple[str, str, pd.DataFrame]],
) -> list[dict]:
    """uploaded = [(dataset_type, display_name, df), ...]. Returns edges with match_rate, orphaned_count."""
    edges = []
    type_to_df = {t: (name, df) for t, name, df in uploaded}
    type_to_ids: dict[str, set] = {}

    for dtype, (name, df) in type_to_df.items():
        if "customer_id" in df.columns:
            type_to_ids.setdefault("customer_id", {})[dtype] = set(df["customer_id"].astype(str).dropna().str.strip())
        if "product_id" in df.columns:
            type_to_ids.setdefault("product_id", {})[dtype] = set(df["product_id"].astype(str).dropna().str.strip())

    # SALES_ORDERS / PATIENT_SUPPORT -> CUSTOMER_MASTER on customer_id
    customer_master_types = ["CUSTOMER_MASTER"]
    for left_type, (left_name, left_df) in type_to_df.items():
        if "customer_id" not in left_df.columns:
            continue
        for right_type in customer_master_types:
            if right_type not in type_to_df:
                continue
            _, right_df = type_to_df[right_type]
            valid = set(right_df["customer_id"].astype(str).dropna().str.strip())
            left_ids = left_df["customer_id"].astype(str).str.strip()
            matched = left_ids.isin(valid).sum()
            total = len(left_df)
            orphaned = total - matched
            match_rate = round(100 * matched / total, 1) if total else 0
            right_name = type_to_df[right_type][0]
            status = "green" if match_rate >= 95 else "amber" if match_rate >= 80 else "red"
            edges.append({
                "from": left_name,
                "to": right_name,
                "join_key": "customer_id",
                "match_rate": match_rate,
                "orphaned_count": int(orphaned),
                "status": status,
            })

    # SALES_ORDERS / PATIENT_SUPPORT -> PRODUCT_CATALOG on product_id
    for left_type, (left_name, left_df) in type_to_df.items():
        if "product_id" not in left_df.columns:
            continue
        if "PRODUCT_CATALOG" not in type_to_df:
            continue
        _, right_df = type_to_df["PRODUCT_CATALOG"]
        valid = set(right_df["product_id"].astype(str).dropna().str.strip())
        left_ids = left_df["product_id"].astype(str).str.strip()
        matched = left_ids.isin(valid).sum()
        total = len(left_df)
        orphaned = total - matched
        match_rate = round(100 * matched / total, 1) if total else 0
        right_name = type_to_df["PRODUCT_CATALOG"][0]
        status = "green" if match_rate >= 95 else "amber" if match_rate >= 80 else "red"
        edges.append({
            "from": left_name,
            "to": right_name,
            "join_key": "product_id",
            "match_rate": match_rate,
            "orphaned_count": int(orphaned),
            "status": status,
        })

    return edges
