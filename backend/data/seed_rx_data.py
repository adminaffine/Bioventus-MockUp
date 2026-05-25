"""Generate Bioventus Rx CSVs for Phase 1 demo story."""
import csv
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent
DOCTORS_PATH = DATA_DIR / "DOCTORS_MASTER.csv"
RX_PATH = DATA_DIR / "PRESCRIPTIONS.csv"

DOCTORS_HEADER = [
    "doctor_id", "npi_number", "first_name", "last_name", "full_name",
    "specialty", "sub_specialty", "years_experience", "medical_school", "graduation_year",
    "board_certified", "board_certification_date", "license_number", "license_state", "license_status",
    "license_expiry_date", "dea_number", "dea_schedule_authorized", "dea_expiry_date",
    "practice_name", "practice_address", "city", "state", "zip", "phone", "email",
    "gender", "medical_degree", "hospital_affiliation", "is_active", "accepting_patients",
    "last_verified_date", "malpractice_cases", "created_date",
]

RX_HEADER = [
    "prescription_id", "doctor_id", "doctor_name_at_time", "doctor_specialty_at_time",
    "patient_id", "patient_name", "patient_age", "patient_gender",
    "drug_name", "drug_category", "drug_schedule", "diagnosis_code", "diagnosis_description",
    "prescribed_date", "days_supply", "quantity", "refills_authorized",
    "prescription_state", "pharmacy_id", "pharmacy_name",
    "dosage_mg", "dosage_frequency", "route_of_administration",
    "requires_prior_auth", "prior_auth_obtained", "npi_used", "dea_used",
    "prescription_status", "flagged_by_pharmacy", "flag_reason",
]


def doctor_row(item: dict) -> dict:
    full_name = item["full_name"]
    state = item["state"]
    dea_expiry = "2027-12-31" if item.get("dea_number") else ""
    return {
        "doctor_id": item["doctor_id"],
        "npi_number": item.get("npi_number", ""),
        "first_name": full_name.replace("Dr. ", "").split(" ")[0],
        "last_name": full_name.replace("Dr. ", "").split(" ", 1)[1],
        "full_name": full_name,
        "specialty": item["specialty"],
        "sub_specialty": "",
        "years_experience": item.get("years_experience", "14"),
        "medical_school": "Duke University School of Medicine",
        "graduation_year": item.get("graduation_year", "2007"),
        "board_certified": item.get("board_certified", "TRUE"),
        "board_certification_date": "2012-05-01",
        "license_number": item["license_number"],
        "license_state": state,
        "license_status": item["license_status"],
        "license_expiry_date": item.get("license_expiry_date", "2027-12-31"),
        "dea_number": item.get("dea_number", ""),
        "dea_schedule_authorized": item.get("dea_schedule_authorized", ""),
        "dea_expiry_date": dea_expiry,
        "practice_name": item.get("practice_name", f"{full_name} Orthopedic Practice"),
        "practice_address": item.get("practice_address", "100 Medical Plaza"),
        "city": item.get("city", "Durham"),
        "state": state,
        "zip": item.get("zip", "27701"),
        "phone": item.get("phone", "(919) 555-0101"),
        "email": item.get("email", f"{full_name.lower().replace('dr. ', '').replace(' ', '.')}@bioventus-demo.com"),
        "gender": item.get("gender", "U"),
        "medical_degree": "MD",
        "hospital_affiliation": item.get("hospital_affiliation", "Bioventus Partner Hospital"),
        "is_active": item.get("is_active", "TRUE"),
        "accepting_patients": item.get("accepting_patients", "TRUE"),
        "last_verified_date": item.get("last_verified_date", "2025-10-01"),
        "malpractice_cases": item.get("malpractice_cases", "0"),
        "created_date": "2024-01-01",
    }


DOCTORS = [
    {"doctor_id": "DOC-001", "full_name": "Dr. James Whitfield", "specialty": "Orthopedics", "npi_number": "1234567893", "license_number": "NC-234567", "license_status": "ACTIVE", "dea_number": "BW1234563", "dea_schedule_authorized": "II,III,IV,V", "state": "NC"},
    {"doctor_id": "DOC-002", "full_name": "Dr. Sarah Kim", "specialty": "Orthopedics", "npi_number": "2345678904", "license_number": "CA-345678", "license_status": "ACTIVE", "dea_number": "BK2345674", "dea_schedule_authorized": "II,III,IV,V", "state": "CA"},
    {"doctor_id": "DOC-003", "full_name": "Dr. Robert Patel", "specialty": "Pain Management", "npi_number": "3456789015", "license_number": "TX-456789", "license_status": "ACTIVE", "dea_number": "BP3456785", "dea_schedule_authorized": "II,III,IV,V", "state": "TX"},
    {"doctor_id": "DOC-004", "full_name": "Dr. Linda Torres", "specialty": "Neurology", "npi_number": "4567890126", "license_number": "FL-567890", "license_status": "ACTIVE", "dea_number": "BT4567896", "dea_schedule_authorized": "II,III,IV,V", "state": "FL"},
    {"doctor_id": "DOC-005", "full_name": "Dr. Marcus Chen", "specialty": "Spine Surgery", "npi_number": "5678901237", "license_number": "NY-678901", "license_status": "ACTIVE", "dea_number": "BC5678907", "dea_schedule_authorized": "II,III,IV,V", "state": "NY"},
    {"doctor_id": "DOC-006", "full_name": "Dr. Angela Davis", "specialty": "Orthopedics", "npi_number": "", "license_number": "NC-789012", "license_status": "ACTIVE", "dea_number": "BD6789018", "dea_schedule_authorized": "III,IV,V", "state": "NC", "board_certified": "FALSE"},
    {"doctor_id": "DOC-007", "full_name": "Dr. Kevin Walsh", "specialty": "Pain Management", "npi_number": "7890123459", "license_number": "CA-890123", "license_status": "EXPIRED", "license_expiry_date": "2024-11-01", "dea_number": "BW7890129", "dea_schedule_authorized": "II,III,IV,V", "state": "CA", "is_active": "FALSE"},
    {"doctor_id": "DOC-008", "full_name": "Dr. Priya Sharma", "specialty": "Neurology", "npi_number": "8901234560", "license_number": "TX-901234", "license_status": "ACTIVE", "dea_number": "", "state": "TX"},
    {"doctor_id": "DOC-009", "full_name": "Dr. James Whitfield", "specialty": "Cardiology", "npi_number": "9012345671", "license_number": "FL-012345", "license_status": "ACTIVE", "dea_number": "BW9012341", "dea_schedule_authorized": "II,III,IV,V", "state": "FL", "malpractice_cases": "1"},
    {"doctor_id": "DOC-010", "full_name": "Dr. Thomas Grant", "specialty": "Orthopedics", "npi_number": "0123456782", "license_number": "NY-112233", "license_status": "ACTIVE", "dea_number": "BG0123452", "dea_schedule_authorized": "II,III,IV,V", "state": "NY"},
    {"doctor_id": "DOC-011", "full_name": "Dr. Maria Lopez", "specialty": "Pain Management", "npi_number": "1234509873", "license_number": "NC-223344", "license_status": "ACTIVE", "dea_number": "BL1234523", "dea_schedule_authorized": "II,III,IV,V", "state": "NC"},
    {"doctor_id": "DOC-012", "full_name": "Dr. Steven Park", "specialty": "Spine Surgery", "npi_number": "2345610984", "license_number": "CA-334455", "license_status": "SUSPENDED", "license_expiry_date": "2027-01-01", "dea_number": "BP2345634", "dea_schedule_authorized": "II,III,IV,V", "state": "CA", "is_active": "FALSE", "malpractice_cases": "2"},
    {"doctor_id": "DOC-013", "full_name": "Dr. Rachel Green", "specialty": "Orthopedics", "npi_number": "3456721095", "license_number": "TX-445566", "license_status": "ACTIVE", "dea_number": "BG3456745", "dea_schedule_authorized": "II,III,IV,V", "state": "TX"},
    {"doctor_id": "DOC-014", "full_name": "Dr. David Morrison", "specialty": "Neurology", "npi_number": "4567832106", "license_number": "FL-556677", "license_status": "ACTIVE", "dea_number": "BM4567856", "dea_schedule_authorized": "II,III,IV,V", "state": "FL"},
    {"doctor_id": "DOC-015", "full_name": "Dr. James Whitfield", "specialty": "Orthopedics", "npi_number": "5678943217", "license_number": "NY-667788", "license_status": "ACTIVE", "dea_number": "BW5678967", "dea_schedule_authorized": "II,III,IV,V", "state": "NY"},
]


def rx_row(i: int, item: dict, doctors_by_id: dict) -> dict:
    doc = doctors_by_id[item["doctor_id"]]
    return {
        "prescription_id": f"RX-{i:03d}",
        "doctor_id": item["doctor_id"],
        "doctor_name_at_time": doc["full_name"],
        "doctor_specialty_at_time": doc["specialty"],
        "patient_id": f"PAT-BV-{i:03d}",
        "patient_name": item["patient_name"],
        "patient_age": str(item.get("patient_age", 52)),
        "patient_gender": item.get("patient_gender", "F"),
        "drug_name": item["drug_name"],
        "drug_category": item.get("drug_category", "Pain Management"),
        "drug_schedule": item.get("drug_schedule", ""),
        "diagnosis_code": item.get("diagnosis_code", "M17.11"),
        "diagnosis_description": item.get("diagnosis_description", "Primary osteoarthritis, right knee"),
        "prescribed_date": item["prescribed_date"],
        "days_supply": str(item.get("days_supply", 30)),
        "quantity": str(item.get("quantity", 30)),
        "refills_authorized": str(item.get("refills_authorized", 0)),
        "prescription_state": item.get("prescription_state", doc["state"]),
        "pharmacy_id": f"PH-BV-{100 + ((i - 1) % 15) + 1}",
        "pharmacy_name": f"Bioventus Authorized Pharmacy - {item.get('pharmacy_city', 'Durham')}",
        "dosage_mg": str(item.get("dosage_mg", 10)),
        "dosage_frequency": item.get("dosage_frequency", "BID"),
        "route_of_administration": "Oral",
        "requires_prior_auth": item.get("requires_prior_auth", "FALSE"),
        "prior_auth_obtained": item.get("prior_auth_obtained", "FALSE"),
        "npi_used": item.get("npi_used", doc["npi_number"]),
        "dea_used": item.get("dea_used", doc["dea_number"]),
        "prescription_status": item.get("prescription_status", "FILLED"),
        "flagged_by_pharmacy": item.get("flagged_by_pharmacy", "FALSE"),
        "flag_reason": item.get("flag_reason", ""),
    }


def build_prescriptions(doctors_by_id: dict) -> list[dict]:
    rows = []
    base = [
        # RX-001 to RX-008 clean baseline
        {"doctor_id": "DOC-001", "patient_name": "Laura Mitchell", "drug_name": "Bupivacaine", "prescribed_date": "2025-01-10", "drug_schedule": "", "pharmacy_city": "Durham"},
        {"doctor_id": "DOC-002", "patient_name": "Henry Collins", "drug_name": "Celecoxib", "prescribed_date": "2025-01-18", "drug_schedule": "", "pharmacy_city": "Raleigh"},
        {"doctor_id": "DOC-003", "patient_name": "Maya Gordon", "drug_name": "Tramadol", "prescribed_date": "2025-02-03", "drug_schedule": "IV", "pharmacy_city": "Houston"},
        {"doctor_id": "DOC-005", "patient_name": "Nathan Brooks", "drug_name": "Methylprednisolone", "prescribed_date": "2025-02-09", "drug_schedule": "", "pharmacy_city": "Albany"},
        {"doctor_id": "DOC-001", "patient_name": "Julia Thompson", "drug_name": "Celecoxib", "prescribed_date": "2025-03-01"},
        {"doctor_id": "DOC-002", "patient_name": "Avery Diaz", "drug_name": "Bupivacaine", "prescribed_date": "2025-03-12"},
        {"doctor_id": "DOC-003", "patient_name": "Caleb Rivera", "drug_name": "Tramadol", "prescribed_date": "2025-03-21", "drug_schedule": "IV"},
        {"doctor_id": "DOC-005", "patient_name": "Sophie Reed", "drug_name": "Methylprednisolone", "prescribed_date": "2025-04-05"},
        # RX-009 to RX-013 specialty mismatch
        {"doctor_id": "DOC-009", "patient_name": "Ian Morgan", "drug_name": "Oxycodone", "drug_schedule": "II", "prescribed_date": "2025-04-14", "flagged_by_pharmacy": "TRUE", "flag_reason": "Specialty mismatch: Cardiologist prescribing Schedule II opioid"},
        {"doctor_id": "DOC-009", "patient_name": "Emma Price", "drug_name": "Hydrocodone", "drug_schedule": "II", "prescribed_date": "2025-04-20", "flagged_by_pharmacy": "TRUE", "flag_reason": "Specialty mismatch: Cardiologist prescribing Schedule II opioid"},
        {"doctor_id": "DOC-009", "patient_name": "Liam Flores", "drug_name": "Oxycodone", "drug_schedule": "II", "prescribed_date": "2025-05-02", "flagged_by_pharmacy": "TRUE", "flag_reason": "Specialty mismatch: Cardiologist prescribing Schedule II opioid"},
        {"doctor_id": "DOC-009", "patient_name": "Noah Jenkins", "drug_name": "Hydrocodone", "drug_schedule": "II", "prescribed_date": "2025-05-08", "flagged_by_pharmacy": "TRUE", "flag_reason": "Specialty mismatch: Cardiologist prescribing Schedule II opioid"},
        {"doctor_id": "DOC-009", "patient_name": "Ava Foster", "drug_name": "Oxycodone", "drug_schedule": "II", "prescribed_date": "2025-05-15", "flagged_by_pharmacy": "TRUE", "flag_reason": "Specialty mismatch: Cardiologist prescribing Schedule II opioid"},
        # RX-014 to RX-017 missing DEA/NPI
        {"doctor_id": "DOC-008", "patient_name": "Mason Bell", "drug_name": "Pregabalin", "drug_schedule": "V", "prescribed_date": "2025-05-22", "flagged_by_pharmacy": "TRUE", "flag_reason": "Missing DEA number", "dea_used": ""},
        {"doctor_id": "DOC-008", "patient_name": "Grace Ward", "drug_name": "Gabapentin", "drug_schedule": "V", "prescribed_date": "2025-05-28", "flagged_by_pharmacy": "TRUE", "flag_reason": "Missing DEA number", "dea_used": ""},
        {"doctor_id": "DOC-006", "patient_name": "Carter Hughes", "drug_name": "Pregabalin", "drug_schedule": "V", "prescribed_date": "2025-06-04", "flagged_by_pharmacy": "TRUE", "flag_reason": "Missing NPI number", "npi_used": ""},
        {"doctor_id": "DOC-006", "patient_name": "Hannah Spencer", "drug_name": "Gabapentin", "drug_schedule": "V", "prescribed_date": "2025-06-10", "flagged_by_pharmacy": "TRUE", "flag_reason": "Missing NPI number", "npi_used": ""},
        # RX-018 to RX-020 expired/suspended license
        {"doctor_id": "DOC-007", "patient_name": "Ethan Walters", "drug_name": "Diclofenac", "prescribed_date": "2025-06-18"},
        {"doctor_id": "DOC-012", "patient_name": "Olivia Hayes", "drug_name": "Ketorolac", "prescribed_date": "2025-06-25"},
        {"doctor_id": "DOC-007", "patient_name": "Wyatt Murphy", "drug_name": "Diclofenac", "prescribed_date": "2025-07-02"},
        # RX-021 to RX-025 prior auth missing
        {"doctor_id": "DOC-010", "patient_name": "Lily Ross", "drug_name": "Buprenorphine", "drug_schedule": "III", "prescribed_date": "2025-07-12", "requires_prior_auth": "TRUE", "prior_auth_obtained": "FALSE", "prescription_status": "PENDING", "flagged_by_pharmacy": "TRUE", "flag_reason": "Prior authorization required but not obtained"},
        {"doctor_id": "DOC-011", "patient_name": "Jack Turner", "drug_name": "Methadone", "drug_schedule": "II", "prescribed_date": "2025-07-19", "requires_prior_auth": "TRUE", "prior_auth_obtained": "FALSE", "prescription_status": "FILLED", "flagged_by_pharmacy": "TRUE", "flag_reason": "Prior authorization required but not obtained"},
        {"doctor_id": "DOC-013", "patient_name": "Zoe Coleman", "drug_name": "Buprenorphine", "drug_schedule": "III", "prescribed_date": "2025-07-27", "requires_prior_auth": "TRUE", "prior_auth_obtained": "FALSE", "prescription_status": "PENDING", "flagged_by_pharmacy": "TRUE", "flag_reason": "Prior authorization required but not obtained"},
        {"doctor_id": "DOC-010", "patient_name": "Leo Simmons", "drug_name": "Methadone", "drug_schedule": "II", "prescribed_date": "2025-08-05", "requires_prior_auth": "TRUE", "prior_auth_obtained": "FALSE", "prescription_status": "FILLED", "flagged_by_pharmacy": "TRUE", "flag_reason": "Prior authorization required but not obtained"},
        {"doctor_id": "DOC-013", "patient_name": "Nora Powell", "drug_name": "Buprenorphine", "drug_schedule": "III", "prescribed_date": "2025-08-13", "requires_prior_auth": "TRUE", "prior_auth_obtained": "FALSE", "prescription_status": "PENDING", "flagged_by_pharmacy": "TRUE", "flag_reason": "Prior authorization required but not obtained"},
    ]
    for i, item in enumerate(base, start=1):
        rows.append(rx_row(i, item, doctors_by_id))
    return rows


def main():
    doctor_rows = [doctor_row(d) for d in DOCTORS]
    doctors_by_id = {d["doctor_id"]: d for d in doctor_rows}
    rx_rows = build_prescriptions(doctors_by_id)
    with open(DOCTORS_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=DOCTORS_HEADER, extrasaction="ignore")
        w.writeheader()
        w.writerows(doctor_rows)
    with open(RX_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=RX_HEADER, extrasaction="ignore")
        w.writeheader()
        w.writerows(rx_rows)
    print(f"DOCTORS_MASTER: {len(doctor_rows)} rows")
    print(f"PRESCRIPTIONS: {len(rx_rows)} rows")


if __name__ == "__main__":
    main()
