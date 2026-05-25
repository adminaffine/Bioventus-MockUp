"""
STEP 0: System Self-Audit - Data Integrity & Governance capabilities.
Scans the codebase and produces a gap report: what exists vs what is missing.
Used by the Data Governance module to display "System Self-Audit" panel.
"""
from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# GAP REPORT: Compiled from manual codebase audit
# ---------------------------------------------------------------------------

DATA_INTEGRITY_AUDIT: List[Dict[str, Any]] = [
    # ALREADY IMPLEMENTED
    {"feature": "Referential integrity - Sales -> Customer (orphan customer_id)", "status": "implemented", "location": "backend/services/quality_engine.py profile_sales_orders; backend/routers/integration.py get_integration_gaps"},
    {"feature": "Referential integrity - Patient Support -> Customer (orphan customer_id)", "status": "implemented", "location": "backend/services/quality_engine.py profile_patient_support; backend/routers/integration.py"},
    {"feature": "Referential integrity - Patient Support -> Product (orphan product_id)", "status": "implemented", "location": "backend/routers/integration.py get_integration_gaps (edges + linkage_issues)"},
    {"feature": "Cross-dataset join integrity (match rate, orphan counts, sample IDs)", "status": "implemented", "location": "backend/routers/integration.py - sales_orders->customer_master, patient_support->customer_master, patient_support->product_catalog"},
    {"feature": "Duplicate detection - primary key / customer_id duplicates", "status": "implemented", "location": "backend/services/quality_engine.py (customer_master uniqueness_pct, duplicate count); backend/services/dynamic_quality_engine.py (uniqueness per key)"},
    {"feature": "Null / missing value checks (completeness per column)", "status": "implemented", "location": "backend/services/quality_engine.py (completeness dict per dataset); backend/services/dynamic_quality_engine.py (null_count, severity by null_pct)"},
    {"feature": "Email format validation", "status": "implemented", "location": "backend/services/quality_engine.py _valid_email; backend/services/dynamic_quality_engine.py _valid_email"},
    {"feature": "Phone format validation", "status": "implemented", "location": "backend/services/quality_engine.py _valid_phone; backend/services/dynamic_quality_engine.py _valid_phone"},
    {"feature": "Date format validation", "status": "implemented", "location": "backend/services/quality_engine.py _valid_date; backend/services/dynamic_quality_engine.py _valid_date (date/dob/expiry columns)"},
    {"feature": "Date logic - ship_date >= order_date", "status": "implemented", "location": "backend/services/quality_engine.py profile_sales_orders (ship_date < order_date); backend/services/dynamic_quality_engine.py (order_col/ship_col)"},
    {"feature": "Date logic - resolution_date when case_status=Closed", "status": "implemented", "location": "backend/services/quality_engine.py profile_patient_support (closed_no_resolution); backend/services/dynamic_quality_engine.py (resolution_date/case_status)"},
    {"feature": "Numeric range - negative total_amount", "status": "implemented", "location": "backend/services/quality_engine.py profile_sales_orders (neg_amount); backend/services/dynamic_quality_engine.py (negative amount)"},
    {"feature": "Cross-field consistency - adverse_event -> mdr_submitted (FDA MDR)", "status": "implemented", "location": "backend/services/quality_engine.py profile_patient_support (mdr_gap); backend/services/dynamic_quality_engine.py; backend/services/compliance_mapper.py _score_fda_mdr"},
    {"feature": "Cross-field consistency - phi_data_present -> consent_obtained (HIPAA)", "status": "implemented", "location": "backend/services/quality_engine.py profile_patient_support (hipaa_gap); backend/services/dynamic_quality_engine.py; backend/services/compliance_mapper.py _score_hipaa"},
    {"feature": "Cross-field consistency - expiry past + recall_status NULL (FDA)", "status": "implemented", "location": "backend/services/quality_engine.py profile_product_catalog; backend/services/dynamic_quality_engine.py"},
    {"feature": "Completeness - revenue_recognized, sales_rep_id, fda_clearance, device_class, hcpcs, dob", "status": "implemented", "location": "backend/services/quality_engine.py (all 4 datasets); backend/services/dynamic_quality_engine.py"},
    {"feature": "PII detection & masking (column + value + classification + audit)", "status": "implemented", "location": "backend/services/pii_engine.py; backend/data/pii_patterns.py; backend/routers/pii.py; PII Shield frontend"},
    # NOT IMPLEMENTED
    {"feature": "Referential integrity - Sales -> Product (product_id to product_catalog)", "status": "missing", "location": "Needs to be built in integrity_engine / integration"},
    {"feature": "Referential integrity - Orders on recalled products (recall_status=RECALLED)", "status": "missing", "location": "Needs to be built"},
    {"feature": "Referential integrity - Ghost sales_rep_id (not in rep master)", "status": "missing", "location": "Needs to be built"},
    {"feature": "Referential integrity - Patient linked to product with device_class=NULL", "status": "missing", "location": "Needs to be built"},
    {"feature": "Referential integrity - Support case for inactive customer", "status": "missing", "location": "Needs to be built"},
    {"feature": "Fuzzy duplicate / entity resolution (same person, different spellings)", "status": "missing", "location": "Needs to be built - integrity_engine entity category"},
    {"feature": "Cross-system value consistency (CRM vs ERP conflicts)", "status": "missing", "location": "Needs MASTER_CONFLICTS + consistency checks"},
    {"feature": "Temporal - order_date <= today (no future orders)", "status": "missing", "location": "Needs to be built"},
    {"feature": "Temporal - revenue_recognized_date >= order_date (SOX)", "status": "missing", "location": "Needs to be built (currently only Yes/No completeness)"},
    {"feature": "Temporal - case_date >= product fda_clearance_date", "status": "missing", "location": "Needs to be built"},
    {"feature": "Temporal - Data staleness (last_updated, open case SLA 180 days)", "status": "missing", "location": "Needs to be built"},
    {"feature": "Domain rule registry (allowed values, casing, standardize)", "status": "missing", "location": "Needs to be built - integrity_engine domain category"},
    {"feature": "Schema drift detection (column rename/remove/add, type change)", "status": "missing", "location": "Needs to be built"},
    # PARTIALLY IMPLEMENTED
    {"feature": "Policy rule engine", "status": "partial", "location": "compliance_mapper has regulation scoring and gap descriptions; missing explicit policy registry with auto-remediation and violation counts"},
    {"feature": "Audit trail", "status": "partial", "location": "PII audit log exists (pii_audit_logger.py); no general DQ/integrity audit trail"},
    {"feature": "Data classification / sensitivity", "status": "partial", "location": "PII Shield classifies by sensitivity and regulation; no enterprise-wide classification outside PII"},
]

GOVERNANCE_AUDIT: List[Dict[str, Any]] = [
    {"feature": "Data lineage tracking", "status": "missing", "location": "Not implemented"},
    {"feature": "Issue routing / workflow (assign to owner)", "status": "missing", "location": "Not implemented"},
    {"feature": "Stewardship assignment & board", "status": "missing", "location": "Not implemented"},
    {"feature": "Policy rule registry with live violation counts", "status": "missing", "location": "Not implemented"},
    {"feature": "SLA tracking on issue resolution", "status": "missing", "location": "Not implemented"},
    {"feature": "Change data capture / full audit trail", "status": "partial", "location": "PII audit log only; no DQ/integrity event log"},
    {"feature": "Remediation playbooks per violation type", "status": "missing", "location": "Not implemented"},
    {"feature": "Data trust score (per dataset & enterprise)", "status": "missing", "location": "Not implemented"},
    {"feature": "AI root cause analysis for integrity", "status": "missing", "location": "Not implemented"},
]


def get_audit_report() -> Dict[str, Any]:
    """Return full audit for API and frontend System Self-Audit panel."""
    implemented = [x for x in DATA_INTEGRITY_AUDIT + GOVERNANCE_AUDIT if x["status"] == "implemented"]
    partial = [x for x in DATA_INTEGRITY_AUDIT + GOVERNANCE_AUDIT if x["status"] == "partial"]
    missing = [x for x in DATA_INTEGRITY_AUDIT + GOVERNANCE_AUDIT if x["status"] == "missing"]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "implemented_count": len(implemented),
            "partial_count": len(partial),
            "missing_count": len(missing),
        },
        "implemented": implemented,
        "partial": partial,
        "missing": missing,
        "integrity_audit": DATA_INTEGRITY_AUDIT,
        "governance_audit": GOVERNANCE_AUDIT,
    }


def print_gap_report_to_console() -> None:
    """Print the gap report as a formatted table to console (ASCII-safe for Windows)."""
    report = get_audit_report()
    lines = [
        "",
        "=" * 100,
        "SYSTEM SELF-AUDIT - DATA INTEGRITY & GOVERNANCE GAP REPORT",
        "Generated: " + report["generated_at"][:19],
        "=" * 100,
        "",
        "SUMMARY:",
        f"  [OK] ALREADY IMPLEMENTED: {report['summary']['implemented_count']}",
        f"  [!!] PARTIALLY IMPLEMENTED: {report['summary']['partial_count']}",
        f"  [--] NOT IMPLEMENTED: {report['summary']['missing_count']}",
        "",
        "-" * 100,
        "DATA INTEGRITY CHECKS",
        "-" * 100,
    ]
    for item in report["integrity_audit"]:
        status = item["status"]
        if status == "implemented":
            sym = "[OK]  ALREADY IMPLEMENTED"
        elif status == "partial":
            sym = "[!!]  PARTIALLY IMPLEMENTED"
        else:
            sym = "[--]  NOT IMPLEMENTED"
        lines.append(f"  {sym}: {item['feature']}")
        lines.append(f"       at {item['location']}")
        lines.append("")
    lines.extend([
        "-" * 100,
        "DATA GOVERNANCE FEATURES",
        "-" * 100,
    ])
    for item in report["governance_audit"]:
        status = item["status"]
        if status == "implemented":
            sym = "[OK]  ALREADY IMPLEMENTED"
        elif status == "partial":
            sym = "[!!]  PARTIALLY IMPLEMENTED"
        else:
            sym = "[--]  NOT IMPLEMENTED"
        lines.append(f"  {sym}: {item['feature']}")
        lines.append(f"       at {item['location']}")
        lines.append("")
    lines.append("=" * 100)
    text = "\n".join(lines)
    logger.info(text)
    return None


if __name__ == "__main__":
    print_gap_report_to_console()
