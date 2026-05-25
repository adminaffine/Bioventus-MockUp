"""
Generate 4 sample CSV datasets with intentional quality issues for the
Upload & Analyze feature. Saves to Test_Uploads/ at project root.
"""
import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from faker import Faker

random.seed(42)
Faker.seed(42)
fake = Faker()

# Project root = parent of backend
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
OUT_DIR = PROJECT_ROOT / "Test_Uploads"
OUT_DIR.mkdir(parents=True, exist_ok=True)

STATES_CODE = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
               "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
               "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
               "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
               "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"]
STATES_FULL = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
               "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
               "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
               "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
               "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
               "New Hampshire", "New Jersey", "New Mexico", "New York",
               "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
               "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
               "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
               "West Virginia", "Wisconsin", "Wyoming"]

INVALID_PHONES = ["123", "abcdefg", "00-00-0000", "N/A", "xxx", "555-1234", ""]

try:
    from pii_generators import (
        ssn, credit_card, bank_account, insurance_id, ethnicity, annual_income,
        ip_address, passport_number, drivers_license, emergency_contact_phone,
        billing_address, cardholder_name, card_last_four, billing_email, tax_id,
        diagnosis_code_icd10, treatment_notes_with_pii, prescribing_physician,
        npi_number, patient_dob, home_address, health_plan_id, copay_amount,
    )
    HAS_PII = True
except ImportError:
    HAS_PII = False
SEGMENT_VARIANTS = ["Enterprise", "enterprise", "ENTERPRISE", "Mid-Market", "SMB", "Clinical", "Distributor"]
PAYMENT_VARIANTS = ["Credit Card", "credit card", "CC", "CreditCard", "PO", "Wire", "Net30"]
PRODUCT_NAME_VARIANTS = ["BONE GRAFT MATRIX", "Bone Graft Matrix", "bone graft matrix", "Exogen Unit", "EXOGEN UNIT", "Durolane Kit"]


def _w(s: str | None) -> str:
    return "" if s is None else str(s).strip()


# ---------------------------------------------------------------------------
# FILE 1: CUSTOMER_MASTER_One.csv — 200 rows max
# ---------------------------------------------------------------------------
def generate_customer_master_one() -> tuple[list[dict], dict]:
    cols = ["customer_id", "first_name", "last_name", "email", "phone", "dob",
            "address", "city", "state", "zip", "country", "customer_segment", "account_status"]
    if HAS_PII:
        cols += ["ssn", "credit_card_number", "bank_account_number", "insurance_id", "ethnicity",
                 "annual_income", "ip_address", "passport_number", "drivers_license", "emergency_contact_phone"]
    # 200 rows: 180 unique IDs + 20 duplicate (10 IDs each used twice)
    unique_count = 180
    duplicate_ids = random.sample(range(100000, 100000 + unique_count), 10)
    missing_email_idx = set(random.sample(range(200), 20))
    invalid_phone_idx = set(random.sample(range(200), 10))
    missing_dob_idx = set(random.sample(range(200), 30))
    missing_lastname_idx = set(random.sample(range(200), 10))

    rows = []
    valid_customer_ids = set()
    for i in range(unique_count):
        cid = 100000 + i
        valid_customer_ids.add(str(cid))
        first = fake.first_name()
        last = fake.last_name() if i not in missing_lastname_idx else ""
        email = fake.email() if i not in missing_email_idx else ""
        phone = fake.numerify(text="(###) ###-####") if i not in invalid_phone_idx else random.choice(INVALID_PHONES)
        dob = (fake.date_of_birth(minimum_age=18, maximum_age=90)).strftime("%Y-%m-%d") if i not in missing_dob_idx else ""
        state = random.choice(STATES_CODE) if random.random() < 0.5 else random.choice(STATES_FULL)
        segment = random.choice(SEGMENT_VARIANTS)
        row = {
            "customer_id": str(cid),
            "first_name": first,
            "last_name": last,
            "email": email,
            "phone": phone,
            "dob": dob,
            "address": fake.street_address(),
            "city": fake.city(),
            "state": state,
            "zip": fake.zipcode(),
            "country": "USA",
            "customer_segment": segment,
            "account_status": random.choice(["Active", "Inactive", "Pending", "Churned"]),
        }
        if HAS_PII:
            row.update(ssn=ssn(), credit_card_number=credit_card(), bank_account_number=bank_account(),
                       insurance_id=insurance_id(), ethnicity=ethnicity(), annual_income=annual_income(),
                       ip_address=ip_address(), passport_number=passport_number(), drivers_license=drivers_license(),
                       emergency_contact_phone=emergency_contact_phone())
        rows.append(row)

    for _ in range(20):
        cid = str(random.choice(duplicate_ids))
        first, last = fake.first_name(), fake.last_name()
        email = fake.email() if random.random() > 0.1 else ""
        phone = fake.numerify(text="(###) ###-####") if random.random() > 0.05 else random.choice(INVALID_PHONES)
        dob = fake.date_of_birth(minimum_age=18, maximum_age=90).strftime("%Y-%m-%d") if random.random() > 0.15 else ""
        state = random.choice(STATES_CODE) if random.random() < 0.5 else random.choice(STATES_FULL)
        dup_row = {
            "customer_id": cid,
            "first_name": first,
            "last_name": last,
            "email": email,
            "phone": phone,
            "dob": dob,
            "address": fake.street_address(),
            "city": fake.city(),
            "state": state,
            "zip": fake.zipcode(),
            "country": "USA",
            "customer_segment": random.choice(SEGMENT_VARIANTS),
            "account_status": random.choice(["Active", "Inactive", "Pending", "Churned"]),
        }
        if HAS_PII:
            dup_row.update(ssn=ssn(), credit_card_number=credit_card(), bank_account_number=bank_account(),
                           insurance_id=insurance_id(), ethnicity=ethnicity(), annual_income=annual_income(),
                           ip_address=ip_address(), passport_number=passport_number(), drivers_license=drivers_license(),
                           emergency_contact_phone=emergency_contact_phone())
        rows.append(dup_row)

    issues = {
        "missing_email": 20,
        "duplicate_customer_id": 20,
        "invalid_phone": 10,
        "missing_dob": 30,
        "inconsistent_state": "mixed",
        "missing_last_name": 10,
        "customer_segment_casing": "mixed",
    }
    return rows, {"columns": cols, "issues": issues, "valid_customer_ids": valid_customer_ids}


# ---------------------------------------------------------------------------
# FILE 2: SALES_ORDERS_One.csv — 200 rows max
# ---------------------------------------------------------------------------
def generate_sales_orders_one(valid_customer_ids: set, valid_product_ids: list) -> tuple[list[dict], dict]:
    cols = ["order_id", "customer_id", "product_id", "product_name", "order_date", "ship_date",
            "quantity", "unit_price", "total_amount", "sales_rep_id", "region", "payment_method", "revenue_recognized"]
    if HAS_PII:
        cols += ["billing_address", "cardholder_name", "card_last_four", "billing_email", "tax_id"]
    valid_cids = list(valid_customer_ids)
    orphan_cids = [random.randint(900000, 999999) for _ in range(30)]
    order_date_start = datetime(2023, 1, 1)
    order_date_end = datetime(2024, 12, 31)

    orphan_orders = 20
    bad_dates = 10
    negative_amount = 6
    missing_revenue = 16
    null_rep = 20
    qty_zero_amount_positive = 4

    bad_date_idx = set(random.sample(range(200), bad_dates))
    negative_idx = set(random.sample(range(200), negative_amount))
    missing_revenue_idx = set(random.sample(range(200), missing_revenue))
    null_rep_idx = set(random.sample(range(200), null_rep))
    qty_zero_idx = set(random.sample(range(200), qty_zero_amount_positive))

    rows = []
    for i in range(200):
        oid = f"ORD-{30000 + i}"
        if i < orphan_orders:
            cid = str(random.choice(orphan_cids))
        else:
            cid = random.choice(valid_cids)
        pid = random.choice(valid_product_ids)
        pname = random.choice(["Exogen Unit", "Durolane Kit", "Supartz FX", "Bone Graft Matrix"])
        order_d = order_date_start + timedelta(seconds=random.randint(0, int((order_date_end - order_date_start).total_seconds())))
        order_date = order_d.strftime("%Y-%m-%d")
        if i in bad_date_idx:
            ship_date = (order_d - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
        else:
            ship_date = (order_d + timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d")
        qty = 0 if i in qty_zero_idx else random.randint(1, 20)
        unit_price = round(random.uniform(50, 5000), 2)
        total = round(qty * unit_price, 2)
        if i in negative_idx:
            total = -abs(total) if total != 0 else -299.99
        if i in qty_zero_idx and total <= 0:
            total = round(random.uniform(100, 1000), 2)
        sales_rep = "" if i in null_rep_idx else f"REP-{random.randint(1, 30)}"
        revenue = "" if i in missing_revenue_idx else random.choice(["Yes", "No"])
        so_row = {
            "order_id": oid,
            "customer_id": cid,
            "product_id": pid,
            "product_name": pname,
            "order_date": order_date,
            "ship_date": ship_date,
            "quantity": str(qty),
            "unit_price": f"{unit_price:.2f}",
            "total_amount": f"{total:.2f}",
            "sales_rep_id": sales_rep,
            "region": random.choice(["North", "South", "East", "West", "Central"]),
            "payment_method": random.choice(PAYMENT_VARIANTS),
            "revenue_recognized": revenue,
        }
        if HAS_PII:
            so_row.update(billing_address=billing_address(), cardholder_name=cardholder_name(),
                          card_last_four=card_last_four(), billing_email=billing_email(), tax_id=tax_id())
        rows.append(so_row)

    issues = {
        "orphan_customer_id": orphan_orders,
        "ship_date_before_order_date": bad_dates,
        "negative_total_amount": negative_amount,
        "missing_revenue_recognized": missing_revenue,
        "null_sales_rep_id": null_rep,
        "quantity_zero_total_positive": qty_zero_amount_positive,
        "payment_method_inconsistent": "mixed",
    }
    return rows, {"columns": cols, "issues": issues}


# ---------------------------------------------------------------------------
# FILE 3: PRODUCT_CATALOG_One.csv — 100 rows (max 200)
# ---------------------------------------------------------------------------
def generate_product_catalog_one() -> tuple[list[dict], dict, list[str]]:
    cols = ["product_id", "product_name", "product_category", "fda_clearance_number", "fda_clearance_date",
            "device_class", "manufacturer", "lot_number", "expiry_date", "recall_status", "hcpcs_code"]
    device_classes = ["I", "II", "III"]
    categories = ["Bone Graft", "Stimulation Device", "Orthobiologics", "Surgical Kit"]
    today = datetime.now().date()

    missing_fda_idx = set(random.sample(range(100), 10))
    missing_class_idx = set(random.sample(range(100), 15))
    expiry_past_no_recall_idx = set(random.sample(range(100), 20))
    missing_hcpcs_idx = set(random.sample(range(100), 25))
    fda_after_expiry_idx = set(random.sample(range(100), 5))
    whitespace_manufacturer_idx = set(random.sample(range(100), 12))

    product_ids = []
    rows = []
    for i in range(100):
        pid = f"PRD-{5000 + i}"
        product_ids.append(pid)
        name = random.choice(PRODUCT_NAME_VARIANTS) + f" {i}"
        fda_num = "" if i in missing_fda_idx else f"K{random.randint(100000, 999999)}"
        fda_date = (today - timedelta(days=random.randint(365, 3650))).strftime("%Y-%m-%d") if random.random() > 0.1 else ""
        device_class = random.choice(device_classes) if i not in missing_class_idx else ""
        manufacturer = "Luminos LLC"
        if i in whitespace_manufacturer_idx:
            manufacturer = "  Luminos LLC  " if random.random() > 0.5 else "\tPartner Med Co\t"
        lot = f"LOT-{random.randint(100000, 999999)}"
        if i in expiry_past_no_recall_idx:
            expiry = (today - timedelta(days=random.randint(1, 365))).strftime("%Y-%m-%d")
            recall = ""
        else:
            expiry = (today + timedelta(days=random.randint(30, 1095))).strftime("%Y-%m-%d")
            recall = random.choice(["", "None", "Active", "Resolved"])
        if i in fda_after_expiry_idx and fda_date and expiry:
            fda_date = (datetime.strptime(expiry, "%Y-%m-%d") + timedelta(days=30)).strftime("%Y-%m-%d")
        hcpcs = "" if i in missing_hcpcs_idx else f"J{random.randint(1000, 9999)}"
        rows.append({
            "product_id": pid,
            "product_name": name,
            "product_category": random.choice(categories),
            "fda_clearance_number": fda_num,
            "fda_clearance_date": fda_date,
            "device_class": device_class,
            "manufacturer": manufacturer,
            "lot_number": lot,
            "expiry_date": expiry,
            "recall_status": recall,
            "hcpcs_code": hcpcs,
        })

    issues = {
        "missing_fda_clearance_number": 10,
        "missing_device_class": 15,
        "expiry_past_recall_null": 20,
        "missing_hcpcs_code": 25,
        "product_name_casing_inconsistent": "mixed",
        "fda_date_after_expiry_date": 5,
        "manufacturer_whitespace": len(whitespace_manufacturer_idx),
    }
    return rows, {"columns": cols, "issues": issues}, product_ids


# ---------------------------------------------------------------------------
# FILE 4: PATIENT_SUPPORT_One.csv — 200 rows max
# ---------------------------------------------------------------------------
def generate_patient_support_one(valid_customer_ids: set, valid_product_ids: list) -> tuple[list[dict], dict]:
    cols = ["case_id", "patient_id", "customer_id", "product_id", "case_type", "case_date", "resolution_date",
            "adverse_event_flag", "mdr_submitted", "consent_obtained", "phi_data_present", "case_status", "assigned_rep"]
    if HAS_PII:
        cols += ["diagnosis_code", "treatment_notes", "prescribing_physician", "npi_number",
                 "patient_dob", "home_address", "health_plan_id", "copay_amount"]
    valid_cids = list(valid_customer_ids)
    orphan_cids = [random.randint(900000, 999999) for _ in range(15)]
    case_start = datetime(2023, 6, 1)
    case_end = datetime(2024, 12, 31)

    mdr_violation_idx = set(random.sample(range(200), 27))
    hipaa_violation_idx = set(random.sample(range(200), 40))
    closed_no_resolution_idx = set(random.sample(range(200), 20))
    orphan_customer_idx = set(random.sample(range(200), 10))
    orphan_product_idx = set(random.sample(range(200), 8))
    resolution_before_case_idx = set(random.sample(range(200), 5))

    invalid_pids = [f"INVALID-{i}" for i in range(20)]

    rows = []
    for i in range(200):
        case_id = f"CASE-{10000 + i}"
        patient_id = f"PT-{random.randint(100000, 999999)}"
        if i in orphan_customer_idx:
            cid = str(random.choice(orphan_cids))
        else:
            cid = random.choice(valid_cids)
        if i in orphan_product_idx:
            pid = random.choice(invalid_pids)
        else:
            pid = random.choice(valid_product_ids)
        case_type = random.choice(["Complaint", "Inquiry", "Adverse Event", "Return"])
        case_d = case_start + timedelta(seconds=random.randint(0, int((case_end - case_start).total_seconds())))
        case_date = case_d.strftime("%Y-%m-%d")
        if i in closed_no_resolution_idx:
            resolution_date = ""
            case_status = "Closed"
        elif i in resolution_before_case_idx:
            resolution_date = (case_d - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
            case_status = "Closed"
        else:
            case_status = random.choice(["Open", "Closed", "Pending", "Escalated"])
            resolution_date = (case_d + timedelta(days=random.randint(1, 90))).strftime("%Y-%m-%d") if case_status == "Closed" else ""
        adverse = i in mdr_violation_idx or random.random() < 0.1
        if i in mdr_violation_idx:
            mdr_val = random.choice(["FALSE", ""])
        else:
            mdr_val = "TRUE" if adverse else random.choice(["TRUE", "FALSE"])
        phi = i in hipaa_violation_idx or random.random() < 0.2
        if i in hipaa_violation_idx:
            consent_val = random.choice(["", "FALSE"])
        else:
            consent_val = "TRUE" if phi else random.choice(["TRUE", "FALSE"])
        ps_row = {
            "case_id": case_id,
            "patient_id": patient_id,
            "customer_id": cid,
            "product_id": pid,
            "case_type": case_type,
            "case_date": case_date,
            "resolution_date": resolution_date,
            "adverse_event_flag": "TRUE" if adverse else "FALSE",
            "mdr_submitted": mdr_val,
            "consent_obtained": consent_val,
            "phi_data_present": "TRUE" if phi else "FALSE",
            "case_status": case_status,
            "assigned_rep": f"REP-{random.randint(1, 25)}",
        }
        if HAS_PII:
            first, last = fake.first_name(), fake.last_name()
            cc = credit_card()
            cc_fmt = f"{cc[:4]}-{cc[4:8]}-{cc[8:12]}-{cc[12:]}" if len(cc) >= 16 else cc
            notes = treatment_notes_with_pii(first, last, ssn(), emergency_contact_phone(), fake.email(), cc_fmt)
            ps_row.update(
                diagnosis_code=diagnosis_code_icd10(),
                treatment_notes=notes,
                prescribing_physician=prescribing_physician(),
                npi_number=npi_number(),
                patient_dob=patient_dob(),
                home_address=home_address(),
                health_plan_id=health_plan_id(),
                copay_amount=copay_amount(),
            )
        rows.append(ps_row)

    issues = {
        "adverse_event_mdr_not_submitted": 27,
        "phi_present_consent_missing": 40,
        "closed_no_resolution_date": 20,
        "orphan_customer_id": 10,
        "orphan_product_id": 8,
        "resolution_before_case_date": 5,
    }
    return rows, {"columns": cols, "issues": issues}


# ---------------------------------------------------------------------------
# Write CSV and manifest
# ---------------------------------------------------------------------------
def write_csv(path: Path, rows: list[dict], columns: list[str]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "seed": 42,
        "description": "Test uploads for Upload & Analyze, Data Quality Profiler, and Data Governance (integrity/schema drift).",
        "datasets": [],
        "join_keys": [
            {"left": "SALES_ORDERS_One.csv", "right": "CUSTOMER_MASTER_One.csv", "key": "customer_id"},
            {"left": "SALES_ORDERS_One.csv", "right": "PRODUCT_CATALOG_One.csv", "key": "product_id"},
            {"left": "PATIENT_SUPPORT_One.csv", "right": "CUSTOMER_MASTER_One.csv", "key": "customer_id"},
            {"left": "PATIENT_SUPPORT_One.csv", "right": "PRODUCT_CATALOG_One.csv", "key": "product_id"},
        ],
    }

    # 1. CUSTOMER_MASTER_One
    cm_rows, cm_meta = generate_customer_master_one()
    path_cm = OUT_DIR / "CUSTOMER_MASTER_One.csv"
    write_csv(path_cm, cm_rows, cm_meta["columns"])
    issue_count = sum(1 for k, v in cm_meta["issues"].items() if isinstance(v, int)) + 2  # +2 for mixed
    manifest["datasets"].append({
        "file": "CUSTOMER_MASTER_One.csv",
        "row_count": len(cm_rows),
        "columns": cm_meta["columns"],
        "embedded_issue_counts": cm_meta["issues"],
        "expected_join_key": "customer_id",
    })
    print(f"[OK] CUSTOMER_MASTER_One.csv - {len(cm_rows)} rows | Issues embedded: {issue_count}")

    # 1b. CUSTOMER_MASTER_v2.csv - schema drift demo (renamed/removed/added columns, type change)
    v2_cols = ["customer_id", "first_name", "last_name", "email", "phone", "date_of_birth", "address", "city", "state", "zip", "country", "account_status", "loyalty_tier"]
    v2_rows = []
    for r in cm_rows[:40]:
        zip_val = r.get("zip", "")
        try:
            zip_int = int(str(zip_val).strip()) if zip_val else 0
        except ValueError:
            zip_int = 0
        v2_rows.append({
            "customer_id": r.get("customer_id"),
            "first_name": r.get("first_name"),
            "last_name": r.get("last_name"),
            "email": r.get("email"),
            "phone": r.get("phone"),
            "date_of_birth": r.get("dob"),
            "address": r.get("address"),
            "city": r.get("city"),
            "state": r.get("state"),
            "zip": zip_int,
            "country": r.get("country"),
            "account_status": r.get("account_status"),
            "loyalty_tier": random.choice(["Bronze", "Silver", "Gold", "Platinum"]),
        })
    write_csv(OUT_DIR / "CUSTOMER_MASTER_v2.csv", v2_rows, v2_cols)
    manifest["datasets"].append({
        "file": "CUSTOMER_MASTER_v2.csv",
        "row_count": len(v2_rows),
        "columns": v2_cols,
        "purpose": "Data Governance / Schema drift demo",
        "embedded_issue_counts": {
            "schema_drift": "dob->date_of_birth, customer_segment removed, loyalty_tier added, zip as integer",
        },
        "expected_join_key": "customer_id",
    })
    print("[OK] CUSTOMER_MASTER_v2.csv - 40 rows | Schema drift: dob->date_of_birth, customer_segment removed, loyalty_tier added, zip integer")

    # 2. PRODUCT_CATALOG_One (need product_ids for orders and patient_support)
    pc_rows, pc_meta, product_ids = generate_product_catalog_one()
    path_pc = OUT_DIR / "PRODUCT_CATALOG_One.csv"
    write_csv(path_pc, pc_rows, pc_meta["columns"])
    issue_count_pc = sum(1 for k, v in pc_meta["issues"].items() if isinstance(v, int)) + 1
    manifest["datasets"].append({
        "file": "PRODUCT_CATALOG_One.csv",
        "row_count": len(pc_rows),
        "columns": pc_meta["columns"],
        "embedded_issue_counts": pc_meta["issues"],
        "expected_join_key": "product_id",
    })
    print(f"[OK] PRODUCT_CATALOG_One.csv - {len(pc_rows)} rows | Issues embedded: {issue_count_pc}")

    # 3. SALES_ORDERS_One
    so_rows, so_meta = generate_sales_orders_one(cm_meta["valid_customer_ids"], product_ids)
    path_so = OUT_DIR / "SALES_ORDERS_One.csv"
    write_csv(path_so, so_rows, so_meta["columns"])
    issue_count_so = sum(1 for k, v in so_meta["issues"].items() if isinstance(v, int)) + 1
    manifest["datasets"].append({
        "file": "SALES_ORDERS_One.csv",
        "row_count": len(so_rows),
        "columns": so_meta["columns"],
        "embedded_issue_counts": so_meta["issues"],
        "expected_join_key": "customer_id",
    })
    print(f"[OK] SALES_ORDERS_One.csv - {len(so_rows)} rows | Issues embedded: {issue_count_so}")

    # 4. PATIENT_SUPPORT_One
    ps_rows, ps_meta = generate_patient_support_one(cm_meta["valid_customer_ids"], product_ids)
    path_ps = OUT_DIR / "PATIENT_SUPPORT_One.csv"
    write_csv(path_ps, ps_rows, ps_meta["columns"])
    issue_count_ps = sum(1 for k, v in ps_meta["issues"].items() if isinstance(v, int))
    manifest["datasets"].append({
        "file": "PATIENT_SUPPORT_One.csv",
        "row_count": len(ps_rows),
        "columns": ps_meta["columns"],
        "embedded_issue_counts": ps_meta["issues"],
        "expected_join_key": "customer_id",
    })
    print(f"[OK] PATIENT_SUPPORT_One.csv - {len(ps_rows)} rows | Issues embedded: {issue_count_ps}")

    manifest_path = OUT_DIR / "dataset_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"All files saved to: {OUT_DIR}/")


if __name__ == "__main__":
    main()
