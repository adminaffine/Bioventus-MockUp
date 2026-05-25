"""
RxIntegrity API: doctor & prescription data quality, specialty scope, DEA, duplicate doctors.
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
import csv
import io
from typing import Optional

from services.rx_integrity_engine import run_rx_integrity

router = APIRouter(prefix="/api/rx", tags=["rx-integrity"])

# Module-level cache populated by startup_cache
_rx_report: dict | None = None


def get_rx_report() -> dict:
    global _rx_report
    if _rx_report is None:
        _rx_report = run_rx_integrity()
    return _rx_report


def set_rx_report(report: dict | None) -> None:
    global _rx_report
    _rx_report = report


@router.get("/summary")
def rx_summary():
    """RxIntegrity summary: trust score, violation counts, by type and specialty."""
    report = get_rx_report()
    return report["summary"]


@router.get("/violations")
def rx_violations(
    type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    specialty: Optional[str] = Query(None),
    regulation: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """Paginated list of all Rx violations with optional filters."""
    report = get_rx_report()
    violations = report.get("violations", [])
    if type:
        violations = [v for v in violations if v.get("violation_type") == type]
    if severity:
        violations = [v for v in violations if v.get("severity") == severity]
    if specialty:
        violations = [v for v in violations if v.get("specialty") == specialty]
    if regulation:
        violations = [v for v in violations if regulation in (v.get("regulation") or "")]
    total = len(violations)
    start = (page - 1) * size
    page_items = violations[start : start + size]
    return {"violations": page_items, "total": total, "page": page, "size": size}


@router.get("/violations/{violation_id}")
def rx_violation_detail(violation_id: str):
    """Full violation detail by index (violation_id = index in list). Not prescription_id."""
    report = get_rx_report()
    violations = report.get("violations", [])
    try:
        idx = int(violation_id)
        if 0 <= idx < len(violations):
            v = violations[idx].copy()
            v["remediation"] = "Review prescribing doctor linkage; verify NPI/DEA and license state; correct duplicate record if applicable."
            return v
    except ValueError:
        pass
    raise HTTPException(status_code=404, detail="Violation not found")


@router.get("/duplicate-doctors")
def rx_duplicate_doctors():
    """All duplicate name clusters with entity resolution report."""
    report = get_rx_report()
    return {"clusters": report.get("entity_resolution", []), "duplicate_clusters": report.get("duplicate_clusters", [])}


@router.get("/specialty-mismatches")
def rx_specialty_mismatches():
    """All out-of-specialty prescriptions."""
    report = get_rx_report()
    return {"specialty_mismatches": report.get("specialty_mismatches", [])}


@router.get("/dea-violations")
def rx_dea_violations():
    """All DEA compliance issues."""
    report = get_rx_report()
    return {"dea_violations": report.get("dea_violations", [])}


@router.get("/doctors")
def rx_doctors(
    specialty: Optional[str] = Query(None),
    license_status: Optional[str] = Query(None),
    has_violations: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """Paginated doctor list with quality flags."""
    report = get_rx_report()
    doctors = report.get("doctors", [])
    doc_ids_with_violations = set()
    for v in report.get("violations", []):
        if v.get("doctor_id"):
            doc_ids_with_violations.add(v["doctor_id"])
    if specialty:
        doctors = [d for d in doctors if (d.get("specialty") or "") == specialty]
    if license_status:
        doctors = [d for d in doctors if (d.get("license_status") or "").upper() == license_status.upper()]
    if has_violations is True:
        doctors = [d for d in doctors if (d.get("doctor_id") or "") in doc_ids_with_violations]
    elif has_violations is False:
        doctors = [d for d in doctors if (d.get("doctor_id") or "") not in doc_ids_with_violations]
    total = len(doctors)
    start = (page - 1) * size
    page_items = doctors[start : start + size]
    for d in page_items:
        d["violation_count"] = sum(1 for v in report.get("violations", []) if v.get("doctor_id") == d.get("doctor_id"))
        d["prescription_count"] = sum(1 for p in report.get("prescriptions", []) if p.get("doctor_id") == d.get("doctor_id"))
    return {"doctors": page_items, "total": total, "page": page, "size": size}


@router.get("/doctors/{doctor_id}")
def rx_doctor_detail(doctor_id: str):
    """Full doctor profile + prescriptions + violations."""
    report = get_rx_report()
    doc_by_id = {d.get("doctor_id"): d for d in report.get("doctors", []) if d.get("doctor_id")}
    doc = doc_by_id.get(doctor_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    prescriptions = [p for p in report.get("prescriptions", []) if p.get("doctor_id") == doctor_id]
    violations = [v for v in report.get("violations", []) if v.get("doctor_id") == doctor_id]
    return {"doctor": doc, "prescriptions": prescriptions, "violations": violations}


@router.get("/prescriptions")
def rx_prescriptions(
    doctor_id: Optional[str] = Query(None),
    specialty: Optional[str] = Query(None),
    drug_schedule: Optional[str] = Query(None),
    flagged: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """Paginated prescription list with integrity flags."""
    report = get_rx_report()
    prescriptions = report.get("prescriptions", [])
    rx_ids_with_violations = set(v.get("prescription_id") for v in report.get("violations", []) if v.get("prescription_id"))
    if doctor_id:
        prescriptions = [p for p in prescriptions if p.get("doctor_id") == doctor_id]
    if specialty:
        prescriptions = [p for p in prescriptions if (p.get("doctor_specialty_at_time") or "") == specialty]
    if drug_schedule:
        prescriptions = [p for p in prescriptions if (p.get("drug_schedule") or "") == drug_schedule]
    if flagged is True:
        prescriptions = [p for p in prescriptions if p.get("prescription_id") in rx_ids_with_violations]
    total = len(prescriptions)
    start = (page - 1) * size
    page_items = prescriptions[start : start + size]
    for p in page_items:
        p["has_violation"] = (p.get("prescription_id") or "") in rx_ids_with_violations
    return {"prescriptions": page_items, "total": total, "page": page, "size": size}


@router.get("/prescriptions/{prescription_id}")
def rx_prescription_detail(prescription_id: str):
    """Full prescription + linked doctor + violations."""
    report = get_rx_report()
    pres_by_id = {p.get("prescription_id"): p for p in report.get("prescriptions", []) if p.get("prescription_id")}
    doc_by_id = {d.get("doctor_id"): d for d in report.get("doctors", []) if d.get("doctor_id")}
    pres = pres_by_id.get(prescription_id)
    if not pres:
        raise HTTPException(status_code=404, detail="Prescription not found")
    doc = doc_by_id.get(pres.get("doctor_id")) if pres.get("doctor_id") else None
    violations = [v for v in report.get("violations", []) if v.get("prescription_id") == prescription_id]
    return {"prescription": pres, "doctor": doc, "violations": violations}


@router.get("/entity-resolution")
def rx_entity_resolution():
    """Full duplicate doctor cluster report (entity resolution)."""
    report = get_rx_report()
    return {"entity_resolution": report.get("entity_resolution", [])}


@router.get("/compliance/report")
def rx_compliance_report():
    """Regulation-by-regulation compliance summary."""
    report = get_rx_report()
    s = report.get("summary", {})
    return {
        "DEA": {"compliant": s.get("total_prescriptions", 0) - s.get("dea_violations", 0), "violations": s.get("dea_violations", 0)},
        "State_Medical_Board": {"compliant": s.get("total_prescriptions", 0) - s.get("license_violations", 0), "violations": s.get("license_violations", 0)},
        "CMS_NPI": {"note": "NPI validation in engine"},
        "Patient_Safety": {"flags": s.get("patient_safety_flags", 0)},
        "Controlled_Substance_Act": {"dea_violations": s.get("dea_violations", 0)},
    }


class AIAnalyzeRequest(dict):
    scope: Optional[str] = "full"


@router.post("/ai/analyze")
def rx_ai_analyze(body: dict = None):
    """Application-mode AI analysis of Rx integrity (scope: full|violations|duplicates|dea)."""
    scope = (body or {}).get("scope", "full")
    report = get_rx_report()
    s = report.get("summary", {})
    return {
        "scope": scope,
        "summary": s,
        "narrative": f"RxIntegrity analysis ({scope}): {s.get('critical_violations', 0)} critical violations, {s.get('specialty_mismatches', 0)} specialty mismatches, {s.get('dea_violations', 0)} DEA issues. Trust score: {s.get('rx_trust_score', 0)} ({s.get('rx_trust_level', '')}).",
    }


@router.get("/export/violations")
def rx_export_violations():
    """Download all Rx violations as CSV."""
    report = get_rx_report()
    violations = report.get("violations", [])
    if not violations:
        keys = ["violation_type", "severity", "prescription_id", "doctor_id"]
    else:
        keys = list(violations[0].keys())
    output = io.StringIO()
    w = csv.DictWriter(output, fieldnames=keys, extrasaction="ignore")
    w.writeheader()
    w.writerows(violations)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rx_violations.csv"},
    )
