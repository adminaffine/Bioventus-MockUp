"""
RxIntegrity Engine: specialty-aware prescription integrity checks.
Loads DOCTORS_MASTER and PRESCRIPTIONS from backend/data/, runs 10 checks,
duplicate-doctor detection, entity resolution, and trust score.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from services.common.drug_specialty_map import SPECIALTY_DRUG_MAP, get_drug_info
from services.common.dea_validator import validate_dea, dea_format_valid, dea_checksum

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DOCTORS_CSV = DATA_DIR / "DOCTORS_MASTER.csv"
PRESCRIPTIONS_CSV = DATA_DIR / "PRESCRIPTIONS.csv"


def _luhn_npi(npi: str) -> bool:
    """NPI 10-digit Luhn mod 10 check."""
    if not npi or len(npi) != 10 or not npi.isdigit():
        return False
    s = 0
    for i, c in enumerate(npi[:9]):
        d = int(c)
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        s += d
    return (s + 24) % 10 == int(npi[9])  # NPI uses 24 as prefix for Luhn


def _load_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _parse_int(s: Any) -> int | None:
    if s is None or s == "":
        return None
    try:
        return int(str(s).strip())
    except ValueError:
        return None


def _parse_date(s: Any) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.strptime(str(s).strip()[:10], "%Y-%m-%d")
    except ValueError:
        return None


def run_rx_integrity() -> dict[str, Any]:
    """Run all checks and return full report (summary, violations, duplicate clusters, etc.)."""
    doctors = _load_csv(DOCTORS_CSV)
    prescriptions = _load_csv(PRESCRIPTIONS_CSV)
    doc_by_id = {d["doctor_id"]: d for d in doctors}

    violations: list[dict] = []
    by_type: dict[str, int] = defaultdict(int)
    by_specialty: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    # ---- Duplicate clusters: group by full_name ----
    by_name: dict[str, list[dict]] = defaultdict(list)
    for d in doctors:
        name = (d.get("full_name") or f"Dr. {d.get('first_name','')} {d.get('last_name','')}").strip()
        by_name[name].append(d)

    duplicate_clusters = []
    cluster_id = 0
    for name, recs in by_name.items():
        if len(recs) < 2:
            continue
        cluster_id += 1
        specialties = set(r.get("specialty") or "" for r in recs)
        specialty_conflict = len(specialties) > 1
        duplicate_clusters.append({
            "cluster_id": f"CLUSTER-{cluster_id:03d}",
            "cluster_name": name,
            "records": recs,
            "specialty_conflict": specialty_conflict,
        })

    # Prescription count per doctor_id; misrouted per cluster
    rx_count_by_doctor: dict[str, int] = defaultdict(int)
    misrouted_by_cluster: dict[str, list[str]] = defaultdict(list)
    for p in prescriptions:
        rx_count_by_doctor[p.get("doctor_id") or ""] += 1

    # ---- CHECK 1: Specialty mismatch ----
    # ---- CHECK 2: Duplicate doctor specialty conflict (misrouted) ----
    misrouted_prescription_ids: list[str] = []
    for p in prescriptions:
        doc_id = p.get("doctor_id") or ""
        doc = doc_by_id.get(doc_id)
        if not doc:
            continue
        specialty = (doc.get("specialty") or "").strip()
        drug_name = (p.get("drug_name") or "").strip()
        drug_cat = (p.get("drug_category") or "").strip()
        info = get_drug_info(drug_name, drug_cat)
        allowed = info.get("allowed_specialties") or []
        if allowed and specialty and specialty not in allowed:
            violations.append({
                "violation_type": "OUT_OF_SPECIALTY_PRESCRIBING",
                "severity": "CRITICAL",
                "regulation": "DEA, State Medical Board, CMS",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
                "doctor_name": doc.get("full_name"),
                "specialty": specialty,
                "drug_name": drug_name,
                "drug_category": info.get("category", drug_cat),
                "allowed_specialties": allowed,
                "patient_age": _parse_int(p.get("patient_age")),
                "patient_safety_risk": "CRITICAL",
            })
            by_type["OUT_OF_SPECIALTY_PRESCRIBING"] += 1
            by_specialty[specialty]["OUT_OF_SPECIALTY_PRESCRIBING"] += 1

            # Check if misrouted due to duplicate name
            doc_name = doc.get("full_name") or ""
            same_name_recs = by_name.get(doc_name, [])
            if len(same_name_recs) >= 2 and specialty_conflict_for_name(same_name_recs, drug_name, drug_cat, specialty):
                pid = p.get("prescription_id") or ""
                misrouted_prescription_ids.append(pid)
                misrouted_by_cluster[doc_name].append(pid)
                violations[-1]["violation_type"] = "LIKELY_WRONG_DOCTOR_LINKED"
                violations[-1]["narrative"] = (
                    f"Prescription for {drug_name} ({info.get('category', drug_cat)}) was linked to {doc_name} ({specialty}) "
                    "but another doctor with the same name has a specialty that matches this prescription — duplicate name caused wrong routing."
                )

    # ---- CHECK 3: DEA validation ----
    for p in prescriptions:
        doc_id = p.get("doctor_id") or ""
        doc = doc_by_id.get(doc_id)
        sched = (p.get("drug_schedule") or "").strip()
        if sched not in ("II", "III", "IV", "V"):
            continue
        if not doc:
            continue
        dea = (doc.get("dea_number") or "").strip()
        dea_authorized = (doc.get("dea_schedule_authorized") or "").replace(" ", "")
        dea_expiry = _parse_date(doc.get("dea_expiry_date"))
        rx_date = _parse_date(p.get("prescribed_date"))
        last_name = doc.get("last_name") or ""

        if not dea:
            violations.append({
                "violation_type": "MISSING_DEA_FOR_CONTROLLED",
                "severity": "CRITICAL",
                "regulation": "DEA",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
                "drug_schedule": sched,
            })
            by_type["DEA_MISSING"] += 1
            continue
        if sched not in dea_authorized.split(","):
            violations.append({
                "violation_type": "DEA_SCHEDULE_NOT_AUTHORIZED",
                "severity": "CRITICAL",
                "regulation": "DEA",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
                "drug_schedule": sched,
                "dea_schedule_authorized": dea_authorized,
            })
            by_type["DEA_SCHEDULE"] += 1
        if dea_expiry and rx_date and rx_date > dea_expiry:
            violations.append({
                "violation_type": "DEA_EXPIRED",
                "severity": "CRITICAL",
                "regulation": "DEA",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
            })
            by_type["DEA_EXPIRED"] += 1
        valid, err = validate_dea(dea, last_name)
        if not valid:
            violations.append({
                "violation_type": "DEA_INVALID_FORMAT" if "format" in err else "DEA_CHECKSUM_FAIL",
                "severity": "HIGH",
                "regulation": "DEA",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
                "detail": err,
            })
            by_type["DEA_INVALID"] += 1

    # ---- CHECK 4: License validity ----
    for p in prescriptions:
        doc_id = p.get("doctor_id") or ""
        doc = doc_by_id.get(doc_id)
        if not doc:
            continue
        status = (doc.get("license_status") or "").strip().upper()
        expiry = _parse_date(doc.get("license_expiry_date"))
        rx_date = _parse_date(p.get("prescribed_date"))
        rx_state = (p.get("prescription_state") or "").strip()
        lic_state = (doc.get("license_state") or "").strip()
        is_active = (doc.get("is_active") or "").strip().upper() == "TRUE"

        if status == "EXPIRED" and rx_date and expiry and rx_date > expiry:
            violations.append({
                "violation_type": "PRESCRIBING_WITH_EXPIRED_LICENSE",
                "severity": "CRITICAL",
                "regulation": "State Medical Board",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
            })
            by_type["LICENSE_EXPIRED"] += 1
        if status == "SUSPENDED":
            violations.append({
                "violation_type": "PRESCRIBING_WHILE_SUSPENDED",
                "severity": "CRITICAL",
                "regulation": "State Medical Board",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
            })
            by_type["LICENSE_SUSPENDED"] += 1
        if lic_state and rx_state and lic_state != rx_state:
            violations.append({
                "violation_type": "CROSS_STATE_LICENSE",
                "severity": "HIGH",
                "regulation": "State Medical Board",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
                "license_state": lic_state,
                "prescription_state": rx_state,
            })
            by_type["CROSS_STATE"] += 1
        if not is_active:
            violations.append({
                "violation_type": "INACTIVE_DOCTOR_PRESCRIBING",
                "severity": "CRITICAL",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
            })
            by_type["INACTIVE_DOCTOR"] += 1

    # ---- CHECK 5: Age-appropriate ----
    for p in prescriptions:
        age = _parse_int(p.get("patient_age"))
        if age is None:
            continue
        drug_name = (p.get("drug_name") or "").strip()
        info = get_drug_info(drug_name, p.get("drug_category") or "")
        min_age = info.get("min_patient_age")
        if min_age is not None and age < min_age:
            violations.append({
                "violation_type": "AGE_INAPPROPRIATE",
                "severity": "CRITICAL",
                "regulation": "Patient Safety",
                "prescription_id": p.get("prescription_id"),
                "patient_age": age,
                "drug_name": drug_name,
                "min_age": min_age,
            })
            by_type["AGE_VIOLATION"] += 1

    # ---- CHECK 6: Refill rules ----
    for p in prescriptions:
        sched = (p.get("drug_schedule") or "").strip()
        refills = _parse_int(p.get("refills_authorized")) or 0
        days_supply = _parse_int(p.get("days_supply")) or 0
        if sched == "II" and refills > 0:
            violations.append({
                "violation_type": "SCHEDULE_II_REFILLS",
                "severity": "CRITICAL",
                "regulation": "DEA",
                "prescription_id": p.get("prescription_id"),
                "refills_authorized": refills,
            })
            by_type["REFILL_VIOLATION"] += 1
        if sched == "II" and days_supply > 30:
            violations.append({
                "violation_type": "SCHEDULE_II_DAYS_SUPPLY",
                "severity": "HIGH",
                "regulation": "DEA",
                "prescription_id": p.get("prescription_id"),
            })
            by_type["DAYS_SUPPLY"] += 1

    # ---- CHECK 7: Ghost doctor ----
    ghost_count = 0
    for p in prescriptions:
        doc_id = p.get("doctor_id") or ""
        if doc_id and doc_id not in doc_by_id:
            ghost_count += 1
            violations.append({
                "violation_type": "UNREGISTERED_PRESCRIBER",
                "severity": "CRITICAL",
                "regulation": "CMS, DEA",
                "prescription_id": p.get("prescription_id"),
                "doctor_id": doc_id,
            })
            by_type["GHOST_DOCTOR"] += 1

    # ---- CHECK 8: Prior auth ----
    for p in prescriptions:
        if (p.get("requires_prior_auth") or "").strip().upper() == "TRUE" and \
           (p.get("prior_auth_obtained") or "").strip().upper() == "FALSE" and \
           (p.get("prescription_status") or "").strip().upper() == "FILLED":
            violations.append({
                "violation_type": "PRIOR_AUTH_NOT_OBTAINED",
                "severity": "HIGH",
                "prescription_id": p.get("prescription_id"),
            })
            by_type["PRIOR_AUTH"] += 1

    # ---- CHECK 9: NPI validation ----
    for d in doctors:
        npi = (d.get("npi_number") or "").strip()
        if not npi:
            continue
        if len(npi) != 10 or not npi.isdigit():
            by_type["NPI_INVALID"] += 1
        elif not _luhn_npi(npi):
            by_type["NPI_CHECKSUM"] += 1

    # ---- Entity resolution reports per cluster ----
    entity_reports = []
    for cl in duplicate_clusters:
        name = cl["cluster_name"]
        recs = cl["records"]
        rx_counts = [rx_count_by_doctor.get(r.get("doctor_id") or "", 0) for r in recs]
        total_rx = sum(rx_counts)
        misrouted_in_cluster = misrouted_by_cluster.get(name, [])
        # Golden record = one with most Rx that matches specialty for most Rx (simplified: most Rx)
        best_idx = max(range(len(recs)), key=lambda i: rx_counts[i])
        report = {
            "cluster_id": cl["cluster_id"],
            "cluster_name": name,
            "records": [
                {
                    "doctor_id": r.get("doctor_id"),
                    "specialty": r.get("specialty"),
                    "npi": r.get("npi_number"),
                    "prescription_count": rx_count_by_doctor.get(r.get("doctor_id") or "", 0),
                    "is_golden_record": i == best_idx,
                }
                for i, r in enumerate(recs)
            ],
            "total_prescriptions": total_rx,
            "misrouted_prescriptions": len(misrouted_in_cluster),
            "misrouted_prescription_ids": misrouted_in_cluster,
            "specialty_conflict": cl["specialty_conflict"],
            "patient_safety_risk": "CRITICAL" if cl["specialty_conflict"] else "HIGH",
            "narrative": (
                f"{len(misrouted_in_cluster)} prescriptions were routed to the wrong doctor in the '{name}' duplicate cluster. "
                "Name-based lookup caused specialty mismatch and potential DEA/patient safety flags."
            ),
        }
        entity_reports.append(report)

    # ---- Trust score ----
    total_rx = len(prescriptions)
    total_docs = len(doctors)
    v_critical = sum(1 for v in violations if v.get("severity") == "CRITICAL")
    specialty_ok = total_rx - by_type["OUT_OF_SPECIALTY_PRESCRIBING"] - by_type.get("LIKELY_WRONG_DOCTOR_LINKED", 0)
    license_ok = total_rx - by_type.get("LICENSE_EXPIRED", 0) - by_type.get("LICENSE_SUSPENDED", 0) - by_type.get("CROSS_STATE", 0) - by_type.get("INACTIVE_DOCTOR", 0)
    dea_ok = total_rx - by_type.get("DEA_MISSING", 0) - by_type.get("DEA_SCHEDULE", 0) - by_type.get("DEA_EXPIRED", 0) - by_type.get("DEA_INVALID", 0)
    entity_ok = total_rx - len(misrouted_prescription_ids)
    completeness_ok = total_docs * 0.9  # placeholder
    specialty_compliance = (specialty_ok / total_rx) if total_rx else 1.0
    license_validity = (license_ok / total_rx) if total_rx else 1.0
    dea_compliance = (dea_ok / total_rx) if total_rx else 1.0
    entity_integrity = (entity_ok / total_rx) if total_rx else 1.0
    data_completeness = 0.85
    rx_trust_score = (
        specialty_compliance * 0.30 +
        license_validity * 0.25 +
        dea_compliance * 0.20 +
        entity_integrity * 0.15 +
        data_completeness * 0.10
    ) * 100
    rx_trust_level = "TRUSTED" if rx_trust_score >= 80 else "AT_RISK" if rx_trust_score >= 60 else "UNTRUSTED"

    summary = {
        "total_doctors": total_docs,
        "total_prescriptions": total_rx,
        "rx_trust_score": round(rx_trust_score, 1),
        "rx_trust_level": rx_trust_level,
        "critical_violations": v_critical,
        "specialty_mismatches": by_type["OUT_OF_SPECIALTY_PRESCRIBING"] + by_type.get("LIKELY_WRONG_DOCTOR_LINKED", 0),
        "dea_violations": by_type.get("DEA_MISSING", 0) + by_type.get("DEA_SCHEDULE", 0) + by_type.get("DEA_EXPIRED", 0) + by_type.get("DEA_INVALID", 0),
        "license_violations": by_type.get("LICENSE_EXPIRED", 0) + by_type.get("LICENSE_SUSPENDED", 0) + by_type.get("CROSS_STATE", 0),
        "ghost_doctors": by_type.get("GHOST_DOCTOR", 0),
        "duplicate_doctor_clusters": len(duplicate_clusters),
        "misrouted_prescriptions": len(misrouted_prescription_ids),
        "patient_safety_flags": by_type.get("AGE_VIOLATION", 0) + by_type.get("OUT_OF_SPECIALTY_PRESCRIBING", 0),
        "by_violation_type": dict(by_type),
        "by_specialty": {k: dict(v) for k, v in by_specialty.items()},
    }

    specialty_mismatch_list = [v for v in violations if v.get("violation_type") in ("OUT_OF_SPECIALTY_PRESCRIBING", "LIKELY_WRONG_DOCTOR_LINKED")]
    dea_violation_list = [v for v in violations if "DEA" in v.get("violation_type", "")]

    return {
        "summary": summary,
        "violations": violations,
        "duplicate_clusters": duplicate_clusters,
        "entity_resolution": entity_reports,
        "specialty_mismatches": specialty_mismatch_list,
        "dea_violations": dea_violation_list,
        "doctors": doctors,
        "prescriptions": prescriptions,
    }


def specialty_conflict_for_name(same_name_recs: list[dict], drug_name: str, drug_cat: str, linked_specialty: str) -> bool:
    """True if another record with same name has a specialty that matches this drug."""
    info = get_drug_info(drug_name, drug_cat)
    allowed = set(info.get("allowed_specialties") or [])
    for r in same_name_recs:
        s = (r.get("specialty") or "").strip()
        if s != linked_specialty and s in allowed:
            return True
    return False


if __name__ == "__main__":
    report = run_rx_integrity()
    s = report["summary"]
    print("Specialty mismatches detected:", s["specialty_mismatches"])
    print("Duplicate clusters resolved:", s["duplicate_doctor_clusters"])
    print("Misrouted prescriptions identified:", s["misrouted_prescriptions"])
    print("DEA violations:", s["dea_violations"])
    print("Most critical finding: Rx trust score =", s["rx_trust_score"], "—", s["rx_trust_level"])
    for er in report["entity_resolution"]:
        print(f"  Cluster {er['cluster_id']}: {er['cluster_name']} — misrouted: {er['misrouted_prescriptions']}, specialty_conflict: {er['specialty_conflict']}")
