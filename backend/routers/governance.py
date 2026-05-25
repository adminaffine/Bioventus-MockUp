"""
Data Governance API: system self-audit, integrity, policies, stewards, trust scores, audit trail.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

from services.governance_audit import get_audit_report
from services.governance_engine import (
    get_trust_scores,
    get_stewards_with_workload,
    get_policies_with_violations,
    get_remediation_playbook,
    build_governance_issues_from_scan,
    _get_scan,
)

router = APIRouter(prefix="/api/governance", tags=["governance"])


@router.get("/audit")
def governance_system_audit():
    """Return the System Self-Audit gap report (what integrity/governance exists vs missing)."""
    return get_audit_report()


@router.get("/trust-scores")
def governance_trust_scores():
    """Trust scores (0-100) per dataset and enterprise. Wraps integrity trust score computation."""
    return get_trust_scores()


@router.get("/stewards")
def governance_stewards():
    """Stewardship board with open issue counts per steward."""
    return {"stewards": get_stewards_with_workload()}


@router.get("/policies")
def governance_policies():
    """Policy registry with current violation counts."""
    return {"policies": get_policies_with_violations()}


@router.get("/issues")
def governance_issues():
    """Governance issues derived from integrity scan. From cache when ready."""
    scan = _get_scan()
    if scan.get("error"):
        return {"issues": [], "error": scan["error"]}
    issues = build_governance_issues_from_scan(scan)
    return {"issues": issues, "total": len(issues)}


@router.get("/remediation/{violation_type}")
def governance_remediation(violation_type: str):
    """Remediation playbook for a violation type."""
    return get_remediation_playbook(violation_type)


@router.get("/audit-trail")
def governance_audit_trail(limit: int = 50):
    """Audit trail of governance actions (placeholder: empty until actions are logged)."""
    return {"events": [], "limit": limit}


class AIDiagnoseRequest(BaseModel):
    issue_id: Optional[str] = None
    category: Optional[str] = None
    sample_ids: Optional[List[str]] = None


@router.post("/ai-diagnose")
def governance_ai_diagnose(body: AIDiagnoseRequest):
    """Placeholder for AI root-cause diagnosis. Returns suggested actions."""
    return {
        "issue_id": body.issue_id,
        "category": body.category,
        "suggested_root_causes": ["Upstream system sync delay", "Validation rule gap", "Manual data entry error"],
        "recommended_actions": ["Verify source system timestamps", "Add pre-load validation", "Review steward assignment"],
        "confidence": 0.72,
    }
