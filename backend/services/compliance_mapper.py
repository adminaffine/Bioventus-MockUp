"""
Regulation-to-dataset/field mappings and compliance scoring.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

REGULATIONS = [
    "FDA 21 CFR Part 11",
    "FDA QMSR (21 CFR Part 820 / ISO 13485:2016)",
    "FDA MDR (Medical Device Reporting)",
    "HIPAA Privacy Rule",
    "SOX Section 302/404",
    "GDPR/Privacy",
    "PCI-DSS",
]

REGULATION_SLUGS = {
    "fda-21-cfr": "FDA 21 CFR Part 11",
    "qmsr": "FDA QMSR (21 CFR Part 820 / ISO 13485:2016)",
    "fda-mdr": "FDA MDR (Medical Device Reporting)",
    "hipaa": "HIPAA Privacy Rule",
    "sox": "SOX Section 302/404",
    "gdpr": "GDPR/Privacy",
    "pci-dss": "PCI-DSS",
}

def get_conn():
    return sqlite3.connect(DB_PATH)


def _score_fda_21_cfr(conn) -> dict:
    """Electronic records - completeness of key fields, audit trail readiness."""
    scores = {}
    c = conn.cursor()
    # customer_master: critical fields complete
    c.execute("SELECT COUNT(*) FROM customer_master")
    n_c = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM customer_master WHERE email IS NOT NULL AND email != '' AND dob IS NOT NULL")
    ok_c = c.fetchone()[0]
    scores["customer_master"] = round(100 * ok_c / n_c, 1) if n_c else 0
    # product_catalog: fda_clearance, device_class
    c.execute("SELECT COUNT(*) FROM product_catalog")
    n_p = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM product_catalog WHERE fda_clearance_number IS NOT NULL AND fda_clearance_number != '' AND device_class IS NOT NULL")
    ok_p = c.fetchone()[0]
    scores["product_catalog"] = round(100 * ok_p / n_p, 1) if n_p else 0
    # sales_orders: revenue_recognized (audit trail)
    c.execute("SELECT COUNT(*) FROM sales_orders")
    n_s = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM sales_orders WHERE revenue_recognized IS NOT NULL AND revenue_recognized != ''")
    ok_s = c.fetchone()[0]
    scores["sales_orders"] = round(100 * ok_s / n_s, 1) if n_s else 0
    # patient_support: consent, resolution
    c.execute("SELECT COUNT(*) FROM patient_support")
    n_ps = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM patient_support WHERE (phi_data_present = 0 OR (phi_data_present = 1 AND consent_obtained = 1))")
    ok_ps = c.fetchone()[0]
    scores["patient_support"] = round(100 * ok_ps / n_ps, 1) if n_ps else 0
    return scores


def _score_fda_mdr(conn) -> dict:
    """Adverse events with MDR submitted."""
    scores = {}
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM customer_master")
    scores["customer_master"] = 100.0  # N/A
    c.execute("SELECT COUNT(*) FROM product_catalog")
    scores["product_catalog"] = 100.0  # N/A
    c.execute("SELECT COUNT(*) FROM sales_orders")
    scores["sales_orders"] = 100.0  # N/A
    c.execute("SELECT COUNT(*) FROM patient_support")
    n = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM patient_support WHERE adverse_event_flag = 1 AND (mdr_submitted IS NULL OR mdr_submitted = 0)")
    gap = c.fetchone()[0]
    ok = n - gap
    scores["patient_support"] = round(100 * ok / n, 1) if n else 0
    return scores


def _score_qmsr(conn) -> dict:
    c = conn.cursor()
    scores = {"customer_master": 100.0}

    c.execute("SELECT COUNT(*) FROM product_catalog")
    product_total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM product_catalog WHERE device_class IS NULL OR TRIM(device_class) = ''")
    product_gap = c.fetchone()[0]
    scores["product_catalog"] = round(100 * (product_total - product_gap) / product_total, 1) if product_total else 0

    c.execute("SELECT COUNT(*) FROM patient_support WHERE adverse_event_flag = 1")
    adverse_total = c.fetchone()[0]
    c.execute(
        "SELECT COUNT(*) FROM patient_support "
        "WHERE adverse_event_flag = 1 AND (resolution_date IS NULL OR mdr_submitted IS NULL)"
    )
    adverse_gap = c.fetchone()[0]
    scores["patient_support"] = round(100 * (adverse_total - adverse_gap) / adverse_total, 1) if adverse_total else 100.0

    c.execute("SELECT COUNT(*) FROM sales_orders")
    sales_total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM sales_orders WHERE revenue_recognized IS NULL OR TRIM(revenue_recognized) = ''")
    sales_gap = c.fetchone()[0]
    scores["sales_orders"] = round(100 * (sales_total - sales_gap) / sales_total, 1) if sales_total else 0
    return scores


def _score_hipaa(conn) -> dict:
    """PHI present + consent obtained."""
    c = conn.cursor()
    scores = {}
    c.execute("SELECT COUNT(*) FROM customer_master")
    n = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM customer_master WHERE dob IS NOT NULL AND dob != ''")
    # Having DOB is PHI-relevant; we score completeness
    scores["customer_master"] = round(100 * c.fetchone()[0] / n, 1) if n else 0
    c.execute("SELECT COUNT(*) FROM product_catalog")
    scores["product_catalog"] = 100.0
    c.execute("SELECT COUNT(*) FROM sales_orders")
    scores["sales_orders"] = 100.0
    c.execute("SELECT COUNT(*) FROM patient_support")
    n = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM patient_support WHERE phi_data_present = 1 AND (consent_obtained IS NULL OR consent_obtained = 0)")
    gap = c.fetchone()[0]
    scores["patient_support"] = round(100 * (n - gap) / n, 1) if n else 0
    return scores


def _score_sox(conn) -> dict:
    """Revenue recognition, financial controls."""
    c = conn.cursor()
    scores = {}
    c.execute("SELECT COUNT(*) FROM customer_master")
    scores["customer_master"] = 100.0
    c.execute("SELECT COUNT(*) FROM product_catalog")
    scores["product_catalog"] = 100.0
    c.execute("SELECT COUNT(*) FROM sales_orders")
    n = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM sales_orders WHERE revenue_recognized IS NOT NULL AND revenue_recognized != '' AND total_amount >= 0")
    ok = c.fetchone()[0]
    scores["sales_orders"] = round(100 * ok / n, 1) if n else 0
    c.execute("SELECT COUNT(*) FROM patient_support")
    scores["patient_support"] = 100.0
    return scores


def _score_gdpr_privacy(conn) -> dict:
    """Consent, data minimization - similar to HIPAA for this demo."""
    return _score_hipaa(conn)


def _score_pci_dss(conn) -> dict:
    """Payment data - we don't have card data; score payment_method presence."""
    c = conn.cursor()
    scores = {}
    c.execute("SELECT COUNT(*) FROM customer_master")
    scores["customer_master"] = 100.0
    c.execute("SELECT COUNT(*) FROM product_catalog")
    scores["product_catalog"] = 100.0
    c.execute("SELECT COUNT(*) FROM sales_orders")
    n = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM sales_orders WHERE payment_method IS NOT NULL AND payment_method != ''")
    ok = c.fetchone()[0]
    scores["sales_orders"] = round(100 * ok / n, 1) if n else 0
    c.execute("SELECT COUNT(*) FROM patient_support")
    scores["patient_support"] = 100.0
    return scores


REGULATION_SCORERS = {
    "FDA 21 CFR Part 11": _score_fda_21_cfr,
    "FDA QMSR (21 CFR Part 820 / ISO 13485:2016)": _score_qmsr,
    "FDA MDR (Medical Device Reporting)": _score_fda_mdr,
    "HIPAA Privacy Rule": _score_hipaa,
    "SOX Section 302/404": _score_sox,
    "GDPR/Privacy": _score_gdpr_privacy,
    "PCI-DSS": _score_pci_dss,
}

DATASETS = ["customer_master", "sales_orders", "product_catalog", "patient_support"]


def get_compliance_heatmap() -> dict:
    conn = get_conn()
    try:
        matrix = {}
        for reg in REGULATIONS:
            fn = REGULATION_SCORERS.get(reg)
            if fn:
                matrix[reg] = fn(conn)
            else:
                matrix[reg] = {d: 100.0 for d in DATASETS}
        return {"regulations": REGULATIONS, "datasets": DATASETS, "matrix": matrix}
    finally:
        conn.close()


def get_regulation_detail(regulation_key: str) -> dict:
    """Detail for one regulation: description, gaps, remediation."""
    conn = get_conn()
    try:
        c = conn.cursor()
        desc = {
            "FDA 21 CFR Part 11": "Electronic records and signatures. Requires complete audit trail, validated systems, and data integrity.",
            "FDA QMSR (21 CFR Part 820 / ISO 13485:2016)": "Quality Management System Regulation aligned to ISO 13485 for classification, complaint handling, and device history records.",
            "FDA MDR (Medical Device Reporting)": "Mandatory reporting of adverse events for medical devices. Adverse events must have MDR submitted.",
            "HIPAA Privacy Rule": "PHI must be protected. When PHI is present, consent must be obtained and documented.",
            "SOX Section 302/404": "Financial reporting controls. Revenue recognition must be documented and consistent.",
            "GDPR/Privacy": "Consent and data minimization for personal data.",
            "PCI-DSS": "Payment card data security. Payment method and handling must be tracked.",
        }.get(regulation_key, "")

        gaps = []
        if "QMSR" in regulation_key:
            c.execute(
                "SELECT product_id, product_name FROM product_catalog "
                "WHERE device_class IS NULL OR TRIM(device_class) = '' LIMIT 50"
            )
            for r in c.fetchall():
                gaps.append({
                    "product_id": r[0],
                    "product_name": r[1],
                    "issue": "Missing device classification",
                    "remediation": "Assign FDA device class per 21 CFR Part 820.3(e)",
                    "regulation_reference": "820.3(e) — Device Classification",
                })
            c.execute(
                "SELECT case_id, product_id FROM patient_support "
                "WHERE adverse_event_flag = 1 AND (resolution_date IS NULL OR mdr_submitted IS NULL) LIMIT 50"
            )
            for r in c.fetchall():
                gaps.append({
                    "case_id": r[0],
                    "product_id": r[1],
                    "issue": "Adverse event not resolved/documented",
                    "remediation": "Complete MDR filing per 21 CFR Part 803 within 30 days",
                    "regulation_reference": "820.198 — Complaint Files",
                })
            c.execute(
                "SELECT order_id FROM sales_orders "
                "WHERE revenue_recognized IS NULL OR TRIM(revenue_recognized) = '' LIMIT 50"
            )
            for r in c.fetchall():
                gaps.append({
                    "order_id": r[0],
                    "issue": "Missing revenue recognition record",
                    "remediation": "Complete Device History Record per 820.186",
                    "regulation_reference": "820.186 — Device History Record",
                })
        elif "MDR" in regulation_key:
            c.execute("SELECT case_id, patient_id, adverse_event_flag, mdr_submitted FROM patient_support WHERE adverse_event_flag = 1 AND (mdr_submitted IS NULL OR mdr_submitted = 0) LIMIT 20")
            for r in c.fetchall():
                gaps.append({"case_id": r[0], "patient_id": r[1], "adverse_event_flag": r[2], "mdr_submitted": r[3], "remediation": "Submit MDR for this adverse event."})
        elif "HIPAA" in regulation_key or "Privacy" in regulation_key:
            c.execute("SELECT case_id, patient_id, phi_data_present, consent_obtained FROM patient_support WHERE phi_data_present = 1 AND (consent_obtained IS NULL OR consent_obtained = 0) LIMIT 20")
            for r in c.fetchall():
                gaps.append({"case_id": r[0], "patient_id": r[1], "phi_data_present": r[2], "consent_obtained": r[3], "remediation": "Obtain and record patient consent for PHI."})
        elif "SOX" in regulation_key:
            c.execute("SELECT order_id, customer_id, total_amount, revenue_recognized FROM sales_orders WHERE revenue_recognized IS NULL OR revenue_recognized = '' LIMIT 20")
            for r in c.fetchall():
                gaps.append({"order_id": r[0], "customer_id": r[1], "total_amount": r[2], "revenue_recognized": r[3], "remediation": "Set revenue_recognized flag for SOX compliance."})
        elif "FDA 21" in regulation_key:
            c.execute("SELECT product_id, product_name, fda_clearance_number, device_class FROM product_catalog WHERE fda_clearance_number IS NULL OR fda_clearance_number = '' LIMIT 10")
            for r in c.fetchall():
                gaps.append({"product_id": r[0], "product_name": r[1], "fda_clearance_number": r[2], "device_class": r[3], "remediation": "Add FDA clearance number and device class."})
        elif "PCI" in regulation_key:
            c.execute("SELECT order_id, payment_method FROM sales_orders WHERE payment_method IS NULL OR payment_method = '' LIMIT 10")
            for r in c.fetchall():
                gaps.append({"order_id": r[0], "payment_method": r[1], "remediation": "Record payment method for PCI scope."})

        matrix = REGULATION_SCORERS.get(regulation_key, lambda conn: {})(conn)
        return {"regulation": regulation_key, "description": desc, "gaps": gaps, "dataset_scores": matrix}
    finally:
        conn.close()
