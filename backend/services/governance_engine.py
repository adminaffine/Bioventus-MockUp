"""
Data Governance Engine: issue classification, routing, stewardship, policies, trust scores.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
import uuid

from services.integrity_engine import run_full_scan, compute_trust_scores, _get_conn, DB_PATH

try:
    from services import startup_cache
    _has_startup_cache = True
except ImportError:
    _has_startup_cache = False


def _get_scan() -> Dict[str, Any]:
    if _has_startup_cache and startup_cache.is_ready():
        return startup_cache.get_cached_integrity_scan() or run_full_scan()
    return run_full_scan()

# ---------------------------------------------------------------------------
# Stewardship board
# ---------------------------------------------------------------------------
STEWARDS = [
    {"id": "DS001", "name": "Dr. Sarah Kim", "role": "VP Quality & Regulatory Affairs", "domain": "patient_support", "open_issues": 6, "sla_breaches": 0},
    {"id": "DS002", "name": "Marcus Johnson", "role": "Chief Data Officer", "domain": "product_catalog", "open_issues": 5, "sla_breaches": 0},
    {"id": "DS003", "name": "Linda Torres", "role": "Finance & Compliance Lead", "domain": "sales_orders", "open_issues": 4, "sla_breaches": 0},
    {"id": "DS004", "name": "Robert Patel", "role": "CRM Data Owner", "domain": "customer_master", "open_issues": 2, "sla_breaches": 0},
]

# ---------------------------------------------------------------------------
# Policy registry
# ---------------------------------------------------------------------------
POLICIES = [
    {"policy_id": "POL-001", "name": "Customer Identity Uniqueness Policy", "description": "Every customer must have a unique customer_id across all systems", "applies_to": ["CUSTOMER_MASTER", "SALES_ORDERS", "PATIENT_SUPPORT"], "rule_type": "Uniqueness", "severity_on_violation": "CRITICAL", "regulation": ["HIPAA", "GDPR"], "auto_remediation": "Flag and route to MDM steward", "status": "ACTIVE", "violations_today": 0},
    {"policy_id": "POL-002", "name": "FDA MDR Adverse Event Reporting Policy", "description": "All adverse event cases must have mdr_submitted=TRUE within 30 days", "applies_to": ["PATIENT_SUPPORT"], "rule_type": "Completeness + Temporal", "severity_on_violation": "CRITICAL", "regulation": ["FDA MDR 21 CFR 803"], "auto_remediation": "Escalate to Regulatory Affairs within 24hrs", "status": "ACTIVE", "violations_today": 0},
    {"policy_id": "POL-002B", "name": "FDA QMSR Adverse Event Documentation", "description": "All adverse events must have resolution date and MDR status documented", "applies_to": ["PATIENT_SUPPORT"], "rule_type": "Completeness + Temporal", "severity_on_violation": "CRITICAL", "regulation": ["FDA QMSR (21 CFR Part 820)"], "auto_remediation": "Escalate to CAPA workflow", "status": "VIOLATED", "violations_today": 4},
    {"policy_id": "POL-003", "name": "Revenue Recognition Timing Policy", "description": "Revenue cannot be recognized before order date", "applies_to": ["SALES_ORDERS"], "rule_type": "Temporal Integrity", "severity_on_violation": "CRITICAL", "regulation": ["SOX 302", "SOX 404"], "auto_remediation": "Flag for Finance audit review", "status": "ACTIVE", "violations_today": 0},
    {"policy_id": "POL-004", "name": "No Sales on Recalled Products Policy", "description": "No sales orders permitted for products with recall_status = RECALLED", "applies_to": ["SALES_ORDERS", "PRODUCT_CATALOG"], "rule_type": "Cross-dataset Business Rule", "severity_on_violation": "CRITICAL", "regulation": ["FDA 21 CFR 806"], "auto_remediation": "Block order + alert Regulatory", "status": "ACTIVE", "violations_today": 0},
    {"policy_id": "POL-005", "name": "HIPAA Consent Before PHI Collection", "description": "consent_obtained must be TRUE before phi_data_present can be TRUE", "applies_to": ["PATIENT_SUPPORT"], "rule_type": "Conditional Completeness", "severity_on_violation": "CRITICAL", "regulation": ["HIPAA Privacy Rule"], "auto_remediation": "Quarantine record + alert CPO", "status": "ACTIVE", "violations_today": 0},
    {"policy_id": "POL-006", "name": "Master Data Freshness Policy", "description": "Customer master records must be reviewed within 24 months", "applies_to": ["CUSTOMER_MASTER"], "rule_type": "Temporal / Staleness", "severity_on_violation": "MEDIUM", "regulation": ["GDPR"], "auto_remediation": "Flag for steward review", "status": "ACTIVE", "violations_today": 0},
    {"policy_id": "POL-007", "name": "Schema Change Approval Policy", "description": "No schema changes without Architecture approval", "applies_to": ["ALL_DATASETS"], "rule_type": "Schema Governance", "severity_on_violation": "HIGH", "regulation": ["Internal IT Governance"], "auto_remediation": "Block pipeline + alert Data Architecture", "status": "ACTIVE", "violations_today": 0},
]

# In-memory governance issues (from last scan) and audit trail
_governance_issues: List[Dict[str, Any]] = []
_audit_trail: List[Dict[str, Any]] = []


def _owner_for_category(category: str, regulation: List[str]) -> str:
    if "Referential" in category:
        return "Data Engineering Team"
    if "Entity" in category:
        return "MDM / Data Stewardship Team"
    if "Domain" in category:
        return "Business Data Owner"
    if "HIPAA" in str(regulation) or "PII" in category:
        return "Chief Privacy Officer"
    if "FDA" in str(regulation):
        return "Regulatory Affairs Team"
    if "SOX" in str(regulation):
        return "Finance / Audit Team"
    if "Schema" in category:
        return "Data Architecture Team"
    return "Data Stewardship Team"


def _sla_hours_for_severity(severity: str) -> int:
    return {"CRITICAL": 24, "HIGH": 72, "MEDIUM": 168, "LOW": 720}.get(severity, 72)


def build_governance_issues_from_scan(scan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Turn integrity scan results into governance issues with owner, priority, SLA."""
    issues = []
    for r in scan.get("referential", []):
        if r.get("violations", 0) == 0:
            continue
        issue_id = f"DI-{uuid.uuid4().hex[:6].upper()}"
        severity = r.get("severity", "HIGH")
        regulation = r.get("regulation", [])
        owner = _owner_for_category("Referential", regulation)
        due = datetime.now(timezone.utc) + timedelta(hours=_sla_hours_for_severity(severity))
        issues.append({
            "issue_id": issue_id,
            "category": "Referential",
            "rule_name": r.get("rule_name"),
            "dataset": r.get("source"),
            "severity": severity,
            "regulation": regulation,
            "violations": r.get("violations"),
            "sample_ids": r.get("sample_ids", []),
            "owner": owner,
            "status": "Open",
            "sla_deadline": due.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    for t in scan.get("temporal", []):
        issue_id = f"DI-{uuid.uuid4().hex[:6].upper()}"
        severity = t.get("severity", "MEDIUM")
        issues.append({
            "issue_id": issue_id,
            "category": "Temporal",
            "rule_name": t.get("rule"),
            "dataset": t.get("dataset"),
            "severity": severity,
            "regulation": ["SOX"] if "order" in str(t.get("rule", "")).lower() else [],
            "violations": 1,
            "sample_ids": [t.get("order_id") or t.get("case_id")],
            "owner": _owner_for_category("Temporal", []),
            "status": "Open",
            "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=_sla_hours_for_severity(severity))).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return issues


def get_trust_scores() -> Dict[str, Any]:
    if _has_startup_cache and startup_cache.is_ready():
        trust = (startup_cache.get_cached_integrity_scan() or {}).get("trust_scores")
        if trust:
            return trust
    if not DB_PATH.exists():
        return {"customer_master": 0, "sales_orders": 0, "patient_support": 0, "product_catalog": 0, "enterprise_score": 0, "by_dimension": {}}
    conn = _get_conn()
    try:
        return compute_trust_scores(conn)
    finally:
        conn.close()


def get_stewards_with_workload() -> List[Dict[str, Any]]:
    return STEWARDS


def get_policies_with_violations() -> List[Dict[str, Any]]:
    scan = _get_scan()
    ref = scan.get("referential", [])
    policies_copy = [dict(p) for p in POLICIES]
    for p in policies_copy:
        if "POL-002" in p["policy_id"]:
            p["violations_today"] = 4
            p["status"] = "VIOLATED"
        if "POL-002B" in p["policy_id"]:
            p["violations_today"] = 4
            p["status"] = "VIOLATED"
        if "POL-004" in p["policy_id"]:
            p["violations_today"] = next((r["violations"] for r in ref if "Recalled" in str(r.get("rule_name", ""))), 0)
        if "POL-003" in p["policy_id"]:
            p["violations_today"] = len(scan.get("temporal", []))
    return policies_copy


def get_remediation_playbook(violation_type: str) -> Dict[str, Any]:
    return {
        "violation_type": violation_type,
        "playbook_id": "REM-001",
        "immediate_actions": ["Quarantine affected records", "Alert relevant team", "Suspend downstream use"],
        "short_term_actions": ["Cross-reference with master", "Manual review of samples", "Implement validation"],
        "long_term_prevention": ["Add real-time validation", "Implement golden record service", "Monthly monitoring"],
        "estimated_effort": "2-3 days",
        "risk_if_ignored": "Regulatory finding, data quality degradation",
        "automation_possible": True,
    }
