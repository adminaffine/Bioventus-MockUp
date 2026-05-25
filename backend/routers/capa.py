from datetime import datetime, timezone
from fastapi import APIRouter

from services import startup_cache

router = APIRouter(prefix="/api/capa", tags=["capa"])


def _base_capas():
    return [
        {
            "capa_id": "CAPA-001",
            "title": "EXOGEN 4.0 Adverse Event MDR Reporting Gap",
            "description": "4 patient support cases (CASE-5011 to CASE-5014) involve adverse events on the recalled EXOGEN 4.0 device where FDA MDR was not submitted within the required 30-day window. Regulatory obligation unmet.",
            "root_cause": "MDR submission workflow not triggered for recalled product adverse events. Product recall status not propagated to case management system.",
            "severity": "CRITICAL",
            "status": "Open",
            "regulation": "FDA MDR (Medical Device Reporting) / 21 CFR Part 803",
            "affected_dataset": "patient_support",
            "affected_records": ["CASE-5011", "CASE-5012", "CASE-5013", "CASE-5014"],
            "affected_product": "EXOGEN 4.0 (PRD-008)",
            "owner": "Dr. Sarah Kim",
            "owner_role": "VP Quality & Regulatory Affairs",
            "created_date": "2026-03-10",
            "due_date": "2026-04-10",
            "corrective_action": "Implement automated MDR trigger for all adverse events on recalled products. File retroactive MDR reports for CASE-5011 to CASE-5014 immediately.",
            "preventive_action": "Add recall-status check to case creation workflow. Mandatory MDR review for all Class III device adverse events.",
            "linked_regulation_slug": "fda-mdr",
            "priority": 1,
        },
        {
            "capa_id": "CAPA-002",
            "title": "QMSR — Product Device Classification Gaps",
            "description": "3 products in the product catalog are missing FDA device classification (device_class = NULL), violating 21 CFR Part 820.3(e) device classification requirements under the new QMSR effective February 2, 2026.",
            "root_cause": "Product registration workflow does not enforce device_class field completion. Legacy products migrated without classification data.",
            "severity": "CRITICAL",
            "status": "In Progress",
            "regulation": "FDA QMSR (21 CFR Part 820 / ISO 13485:2016)",
            "affected_dataset": "product_catalog",
            "affected_records": ["PRD-010", "PRD-011", "PRD-015"],
            "affected_product": "neXus System, SonaStar Elite, Corelink Kore",
            "owner": "Marcus Johnson",
            "owner_role": "Chief Data Officer",
            "created_date": "2026-02-15",
            "due_date": "2026-05-01",
            "corrective_action": "Assign device class to all 3 unclassified products based on FDA 510(k) clearance records. Update product master within 30 days.",
            "preventive_action": "Add device_class as a mandatory field in product registration form. Block product activation without device classification.",
            "linked_regulation_slug": "qmsr",
            "priority": 2,
        },
        {
            "capa_id": "CAPA-003",
            "title": "HIPAA Patient Consent Documentation Gap",
            "description": "4 patient support cases have PHI data present (phi_data_present=1) but no patient consent recorded (consent_obtained=NULL). This represents a HIPAA Privacy Rule violation.",
            "root_cause": "Consent capture form is optional in the current case management workflow. Representatives closing cases do not verify consent completion.",
            "severity": "HIGH",
            "status": "Open",
            "regulation": "HIPAA Privacy Rule (45 CFR §164.508)",
            "affected_dataset": "patient_support",
            "affected_records": ["CASE-5015", "CASE-5016", "CASE-5017", "CASE-5018"],
            "affected_product": "StimRouter, TalisMann",
            "owner": "Dr. Sarah Kim",
            "owner_role": "VP Quality & Regulatory Affairs",
            "created_date": "2026-03-15",
            "due_date": "2026-04-30",
            "corrective_action": "Retroactively obtain consent for all 4 cases where patient can be contacted. Document consent status for all remaining cases.",
            "preventive_action": "Make consent_obtained a required field before case can be saved when phi_data_present=1. Add validation rule to case management system.",
            "linked_regulation_slug": "hipaa",
            "priority": 3,
        },
        {
            "capa_id": "CAPA-004",
            "title": "Sales Orders on Recalled EXOGEN 4.0 Product",
            "description": "4 sales orders (ORD-013 to ORD-016) were placed for EXOGEN 4.0 (PRD-008) after the product recall date of 2025-09-15. Product distribution controls failed to prevent post-recall sales.",
            "root_cause": "Recall status in the product catalog was not integrated with the order management system. No order-block rule existed for recalled products.",
            "severity": "CRITICAL",
            "status": "Open",
            "regulation": "FDA 21 CFR Part 806 (Medical Device Corrections and Removals)",
            "affected_dataset": "sales_orders",
            "affected_records": ["ORD-013", "ORD-014", "ORD-015", "ORD-016"],
            "affected_product": "EXOGEN 4.0 (PRD-008)",
            "owner": "Linda Torres",
            "owner_role": "Finance & Compliance Lead",
            "created_date": "2026-03-20",
            "due_date": "2026-04-15",
            "corrective_action": "Contact all 4 customers immediately. Initiate product retrieval. File correction report with FDA under 21 CFR Part 806.",
            "preventive_action": "Integrate product recall_status check into order creation API. Block orders where product recall_status = RECALLED.",
            "linked_regulation_slug": "fda-mdr",
            "priority": 4,
        },
        {
            "capa_id": "CAPA-005",
            "title": "Orphan Customer Records in Sales and Patient Support",
            "description": "4 sales orders and 3 patient support cases reference customer_ids that do not exist in the Customer Master, creating referential integrity failures that prevent complete audit trails.",
            "root_cause": "Customer data was deleted or never migrated from legacy CRM. No referential integrity constraint enforced at the data layer.",
            "severity": "HIGH",
            "status": "Open",
            "regulation": "SOX Section 302/404 — Revenue Attribution",
            "affected_dataset": "sales_orders",
            "affected_records": ["ORD-009", "ORD-010", "ORD-011", "ORD-012"],
            "affected_product": "Multiple",
            "owner": "Robert Patel",
            "owner_role": "CRM Data Owner",
            "created_date": "2026-03-25",
            "due_date": "2026-05-15",
            "corrective_action": "Identify and restore orphan customer records from backup or legacy system. For irrecoverable records, create placeholder records with available data.",
            "preventive_action": "Implement foreign key constraint between sales_orders.customer_id and customer_master.customer_id. Add pre-save validation in order entry.",
            "linked_regulation_slug": "sox",
            "priority": 5,
        },
        {
            "capa_id": "CAPA-006",
            "title": "RxIntegrity — Physician License Compliance Gap",
            "description": "2 physicians in the Doctor Master (DOC-007, DOC-012) have expired or suspended licenses but prescriptions were filled without flagging. Pharmacy compliance check failed.",
            "root_cause": "License status verification is not automated. License expiry date is stored but not checked against current date during prescription processing.",
            "severity": "HIGH",
            "status": "Resolved",
            "regulation": "21 CFR Part 1306 — Prescriptions for Controlled Substances",
            "affected_dataset": "rx_integrity",
            "affected_records": ["DOC-007", "DOC-012"],
            "affected_product": "StimRouter prescriptions",
            "owner": "Dr. Sarah Kim",
            "owner_role": "VP Quality & Regulatory Affairs",
            "created_date": "2026-02-20",
            "due_date": "2026-03-20",
            "days_open": 28,
            "is_overdue": False,
            "corrective_action": "Suspended DOC-012 from prescribing immediately. Added license expiry alert to RxIntegrity dashboard. Reviewed all filled prescriptions from suspended doctors.",
            "preventive_action": "Automated license status check against state licensing board API (monthly). Block prescriptions from doctors with non-ACTIVE license status.",
            "linked_regulation_slug": "fda-21-cfr",
            "priority": 6,
            "resolved_date": "2026-03-18",
            "resolved_by": "Dr. Sarah Kim",
            "resolution_notes": "DOC-012 deactivated in system. License reinstatement pending with NC Medical Board. All affected prescriptions reviewed and documented.",
        },
        {
            "capa_id": "CAPA-007",
            "title": "QMSR — Adverse event case file completeness (CASE-5009)",
            "description": "Patient support CASE-5009 (PRD-008 adverse event) lacks closed resolution and traceable MDR submission in the demo dataset, violating complaint / adverse event documentation expectations under FDA QMSR (820.198) for complaint records.",
            "root_cause": "Case closure workflow does not require resolution_date and mdr_submitted when adverse_event_flag is set.",
            "severity": "HIGH",
            "status": "Open",
            "regulation": "FDA QMSR (21 CFR Part 820) — Complaint handling & adverse event records",
            "affected_dataset": "patient_support",
            "affected_records": ["CASE-5009"],
            "affected_product": "EXOGEN / PRD-008",
            "owner": "Dr. Sarah Kim",
            "owner_role": "VP Quality & Regulatory Affairs",
            "created_date": "2026-03-22",
            "due_date": "2026-04-22",
            "corrective_action": "Complete resolution documentation and verify MDR status for CASE-5009; align with recall and complaint handling SOPs.",
            "preventive_action": "Block case status moves to closed for adverse_event cases until resolution_date and mdr_submitted are populated and validated.",
            "linked_regulation_slug": "qmsr",
            "priority": 7,
        },
    ]


def build_capa_summary():
    today = datetime.now(timezone.utc).date()
    capas = _base_capas()
    for c in capas:
        if c.get("status") == "Resolved" and c.get("days_open") is not None:
            continue
        created = datetime.strptime(c["created_date"], "%Y-%m-%d").date()
        due = datetime.strptime(c["due_date"], "%Y-%m-%d").date()
        c["days_open"] = max((today - created).days, 0)
        c["is_overdue"] = today > due and c["status"] != "Resolved"
    open_count = sum(1 for c in capas if c["status"] == "Open")
    in_progress = sum(1 for c in capas if c["status"] == "In Progress")
    resolved = sum(1 for c in capas if c["status"] == "Resolved")
    overdue = sum(1 for c in capas if c.get("is_overdue"))
    return {
        "total_capas": len(capas),
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "overdue": overdue,
        "capas": capas,
    }


@router.get("/summary")
def capa_summary():
    if startup_cache.is_ready():
        cached = startup_cache.get_cached_capa_summary()
        if cached:
            return cached
    return build_capa_summary()
