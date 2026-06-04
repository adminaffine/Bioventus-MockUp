"""Generate Phase 1 Bioventus data for Luminos demo."""
import csv
import random
import sqlite3
from pathlib import Path

random.seed(42)

try:
    from pii_generators import (
        ssn, credit_card, bank_account, insurance_id, ethnicity, annual_income,
        ip_address, passport_number, drivers_license, emergency_contact_phone,
        billing_address, cardholder_name, card_last_four, billing_email, tax_id,
        treatment_notes_with_pii, patient_dob, home_address, health_plan_id, copay_amount,
    )
except ImportError as exc:
    raise RuntimeError("pii_generators.py is required") from exc

DB_DIR = Path(__file__).resolve().parent
DB_PATH = DB_DIR / "luminos_demo.db"
CSV_DIR = DB_DIR / "csv"
CSV_DIR.mkdir(exist_ok=True)


def create_tables(conn):
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS customer_master")
    c.execute("DROP TABLE IF EXISTS product_catalog")
    c.execute("DROP TABLE IF EXISTS sales_orders")
    c.execute("DROP TABLE IF EXISTS patient_support")
    c.execute("DROP TABLE IF EXISTS master_conflicts")
    c.execute("DROP TABLE IF EXISTS customer_hierarchy")
    c.execute("DROP TABLE IF EXISTS gpo_contracts")
    c.execute("DROP TABLE IF EXISTS alerts_queue")
    c.execute("DROP TABLE IF EXISTS tax_exemption_certs")
    c.execute("DROP TABLE IF EXISTS tax_jurisdiction_issues")
    c.execute("DROP TABLE IF EXISTS pricing_issues")
    c.execute("DROP TABLE IF EXISTS territory_alignment")
    c.execute("DROP TABLE IF EXISTS chargeback_disputes")
    c.execute("DROP TABLE IF EXISTS sla_tickets")
    c.execute("DROP TABLE IF EXISTS onboarding_queue")
    c.execute("DROP TABLE IF EXISTS dso_analysis")
    c.execute("""CREATE TABLE customer_master (
        customer_id TEXT, first_name TEXT, last_name TEXT, email TEXT, phone TEXT, dob TEXT,
        address TEXT, city TEXT, state TEXT, zip TEXT, country TEXT, customer_segment TEXT,
        account_status TEXT, ssn TEXT, credit_card_number TEXT, bank_account_number TEXT,
        insurance_id TEXT, ethnicity TEXT, annual_income INTEGER, ip_address TEXT,
        passport_number TEXT, drivers_license TEXT, emergency_contact_phone TEXT)""")
    c.execute("""CREATE TABLE product_catalog (
        product_id TEXT, product_name TEXT, product_category TEXT, fda_clearance_number TEXT,
        fda_clearance_date TEXT, device_class TEXT, manufacturer TEXT, lot_number TEXT,
        expiry_date TEXT, recall_status TEXT, hcpcs_code TEXT)""")
    c.execute("""CREATE TABLE sales_orders (
        order_id TEXT, customer_id TEXT, product_id TEXT, product_name TEXT, order_date TEXT,
        ship_date TEXT, quantity INTEGER, unit_price REAL, total_amount REAL, sales_rep_id TEXT,
        region TEXT, payment_method TEXT, revenue_recognized TEXT, billing_address TEXT,
        cardholder_name TEXT, card_last_four TEXT, billing_email TEXT, tax_id TEXT)""")
    c.execute("""CREATE TABLE patient_support (
        case_id TEXT, patient_id TEXT, customer_id TEXT, product_id TEXT, case_type TEXT,
        case_date TEXT, resolution_date TEXT, adverse_event_flag INTEGER, mdr_submitted INTEGER,
        consent_obtained INTEGER, phi_data_present INTEGER, case_status TEXT, assigned_rep TEXT,
        diagnosis_code TEXT, treatment_notes TEXT, prescribing_physician TEXT, npi_number TEXT,
        patient_dob TEXT, home_address TEXT, health_plan_id TEXT, copay_amount REAL)""")
    c.execute("""CREATE TABLE master_conflicts (
        customer_id TEXT, field_name TEXT, crm_value TEXT, erp_value TEXT, conflict_type TEXT)""")
    c.execute("""CREATE TABLE customer_hierarchy (
        node_id TEXT, node_type TEXT, node_name TEXT, parent_id TEXT, parent_type TEXT,
        idn_id TEXT, idn_name TEXT, hco_id TEXT, hco_name TEXT,
        linked_customer_id TEXT, linked_doctor_npi TEXT,
        gpo_membership TEXT, gpo_tier TEXT, credit_limit REAL,
        hierarchy_status TEXT, confidence_score REAL,
        iqvia_affiliation TEXT, iqvia_delta TEXT, iqvia_delta_detail TEXT)""")
    c.execute("""CREATE TABLE gpo_contracts (
        contract_id TEXT, customer_id TEXT, product_id TEXT, product_name TEXT, gpo_name TEXT, tier TEXT,
        contracted_price REAL, charged_price REAL, price_variance REAL, membership_verified TEXT,
        contract_start TEXT, contract_end TEXT, days_to_expiry INTEGER,
        contract_status TEXT, linked_order_id TEXT, conflict_flag TEXT, conflict_reason TEXT)""")
    c.execute("""CREATE TABLE alerts_queue (
        alert_id TEXT, alert_type TEXT, title TEXT, description TEXT,
        financial_tier TEXT, dollar_impact REAL, primary_persona TEXT, primary_owner_name TEXT,
        primary_owner_role TEXT, linked_records TEXT, linked_screen TEXT, linked_filter TEXT,
        status TEXT, detected_date TEXT, severity TEXT,
        prescribed_action_1 TEXT, prescribed_action_2 TEXT, prescribed_action_3 TEXT,
        regulation_reference TEXT, secondary_persona_note TEXT)""")
    c.execute("""CREATE TABLE tax_exemption_certs (
        cert_id TEXT, customer_id TEXT, customer_name TEXT, customer_segment TEXT,
        cert_status TEXT, cert_number TEXT, issuing_state TEXT, expiry_date TEXT,
        days_to_expiry INTEGER, tax_exempt_type TEXT, revenue_at_risk REAL,
        orders_affected TEXT, action_required TEXT)""")
    c.execute("""CREATE TABLE tax_jurisdiction_issues (
        issue_id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, customer_name TEXT,
        issue_type TEXT, priority TEXT, dollar_value REAL, invoice_status TEXT,
        urgency_label TEXT, owner_id TEXT, owner_name TEXT, ai_fix TEXT,
        ai_confidence REAL, ai_source TEXT, correct_jurisdiction TEXT,
        applied_jurisdiction TEXT, ship_to_state TEXT, bill_to_state TEXT,
        product TEXT, sla_days_remaining INTEGER, opened_date TEXT, status TEXT,
        address_record TEXT, pre_invoice INTEGER, rate_difference REAL,
        capa_id TEXT, root_cause TEXT, risk_compliance TEXT, risk_penalty TEXT,
        risk_legal TEXT, risk_jurisdiction TEXT)""")
    c.execute("""CREATE TABLE pricing_issues (
        issue_id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, customer_name TEXT,
        issue_type TEXT, priority TEXT, dollar_value REAL, invoice_status TEXT,
        urgency_label TEXT, owner_id TEXT, owner_name TEXT, ai_fix TEXT,
        ai_confidence REAL, ai_source TEXT, correct_tier TEXT, applied_tier TEXT,
        gpo_name TEXT, product TEXT, sla_days_remaining INTEGER, opened_date TEXT, status TEXT,
        contract_id TEXT, credit_memo_required INTEGER, overcharge_per_unit REAL,
        quantity_affected INTEGER, capa_id TEXT, root_cause TEXT,
        risk_revenue TEXT, risk_chargeback TEXT, risk_compliance TEXT, risk_gpo TEXT)""")
    c.execute("DROP TABLE IF EXISTS data_steward_issues")
    c.execute("""CREATE TABLE data_steward_issues (
        issue_id TEXT PRIMARY KEY, customer_id TEXT, customer_name TEXT,
        issue_type TEXT, priority TEXT, dollar_value REAL,
        hierarchy_level TEXT, current_idn TEXT, correct_idn TEXT,
        current_idn_name TEXT, correct_idn_name TEXT,
        current_jurisdiction TEXT, correct_jurisdiction TEXT,
        owner_id TEXT, owner_name TEXT, sla_days_remaining INTEGER,
        opened_date TEXT, status TEXT, open_orders TEXT, contract_id TEXT,
        ai_fix TEXT, ai_confidence REAL, ai_source TEXT, root_cause TEXT,
        effective_date TEXT, last_updated TEXT, source_system TEXT,
        capa_id TEXT, risk_pricing TEXT, risk_tax TEXT,
        risk_credit TEXT, risk_gpo TEXT, ai_decision TEXT)""")
    c.execute("DROP TABLE IF EXISTS cfo_alerts")
    c.execute("""CREATE TABLE cfo_alerts (
        alert_id TEXT PRIMARY KEY,
        account_id TEXT,
        account_name TEXT,
        order_id TEXT,
        issue_type TEXT,
        priority TEXT,
        dollar_exposure REAL,
        margin_at_risk REAL,
        penalty_exposure REAL,
        legal_risk TEXT,
        invoice_status TEXT,
        pre_invoice INTEGER,
        sla_days_remaining INTEGER,
        opened_date TEXT,
        status TEXT,
        cfo_assignee TEXT,
        tax_owner_id TEXT,
        tax_owner_name TEXT,
        tax_owner_team TEXT,
        pricing_owner_id TEXT,
        pricing_owner_name TEXT,
        pricing_owner_team TEXT,
        ai_fix_1 TEXT,
        ai_confidence_1 REAL,
        ai_source_1 TEXT,
        ai_fix_2 TEXT,
        ai_confidence_2 REAL,
        ai_source_2 TEXT,
        root_cause_primary TEXT,
        root_cause_secondary TEXT,
        capa_ids TEXT,
        next_action_tax TEXT,
        next_action_pricing TEXT,
        correct_jurisdiction TEXT,
        applied_jurisdiction TEXT,
        list_price REAL,
        contract_price REAL
    )""")
    c.execute("DROP TABLE IF EXISTS cco_compliance_issues")
    c.execute("""CREATE TABLE cco_compliance_issues (
        issue_id TEXT PRIMARY KEY,
        account_id TEXT,
        account_name TEXT,
        order_id TEXT,
        issue_type TEXT,
        priority TEXT,
        penalty_exposure REAL,
        capa_breach_risk INTEGER,
        audit_readiness_impact INTEGER,
        legal_risk TEXT,
        invoice_status TEXT,
        pre_invoice INTEGER,
        sla_days_remaining INTEGER,
        opened_date TEXT,
        status TEXT,
        cco_assignee TEXT,
        tax_owner_id TEXT,
        tax_owner_name TEXT,
        tax_owner_team TEXT,
        compliance_owner_id TEXT,
        compliance_owner_name TEXT,
        compliance_owner_team TEXT,
        ai_fix_1 TEXT,
        ai_confidence_1 REAL,
        ai_source_1 TEXT,
        ai_fix_2 TEXT,
        ai_confidence_2 REAL,
        ai_source_2 TEXT,
        root_cause_primary TEXT,
        root_cause_secondary TEXT,
        capa_ids TEXT,
        next_action_tax TEXT,
        next_action_compliance TEXT,
        correct_jurisdiction TEXT,
        applied_jurisdiction TEXT,
        regulation_state TEXT,
        regulation_statute TEXT,
        regulation_requirement TEXT,
        severity_category TEXT
    )""")
    c.execute("DROP TABLE IF EXISTS vp_alerts")
    c.execute("""CREATE TABLE vp_alerts (
        issue_id              TEXT PRIMARY KEY,
        account_id            TEXT,
        account_name          TEXT,
        order_id              TEXT,
        issue_type            TEXT,
        team                  TEXT,
        priority              TEXT,
        dollar_exposure       REAL,
        margin_at_risk        REAL,
        penalty_exposure      REAL,
        invoice_status        TEXT,
        pre_invoice           INTEGER,
        sla_days_remaining    INTEGER,
        opened_date           TEXT,
        status                TEXT DEFAULT 'Open',
        current_owner_id      TEXT,
        current_owner_name    TEXT,
        current_owner_team    TEXT,
        secondary_owner_id    TEXT,
        secondary_owner_name  TEXT,
        secondary_owner_team  TEXT,
        sla_health            TEXT,
        live_progress_primary TEXT,
        live_progress_secondary TEXT,
        completion_primary    INTEGER,
        completion_secondary  INTEGER,
        ai_fix_1              TEXT,
        ai_confidence_1       REAL,
        ai_source_1           TEXT,
        ai_fix_2              TEXT,
        ai_confidence_2       REAL,
        ai_source_2           TEXT,
        root_cause_primary    TEXT,
        root_cause_secondary  TEXT,
        capa_ids              TEXT,
        next_action_primary   TEXT,
        next_action_secondary TEXT,
        recurrence_count      INTEGER,
        recurrence_period     TEXT,
        capa_exists           TEXT,
        vp_action_signal      TEXT
    )""")
    c.execute("""CREATE TABLE territory_alignment (
        alignment_id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, customer_name TEXT,
        sales_rep_id TEXT, rep_name TEXT, rep_assigned_territory TEXT, order_region TEXT,
        product_name TEXT, order_amount REAL, commission_rate REAL, commission_amount REAL,
        misalignment_flag INTEGER, misaligned_commission REAL, misalignment_reason TEXT, action_required TEXT)""")
    c.execute("""CREATE TABLE chargeback_disputes (
        chargeback_id TEXT PRIMARY KEY, contract_id TEXT, order_id TEXT, customer_id TEXT,
        customer_name TEXT, product_name TEXT, gpo_name TEXT, tier TEXT, price_variance_per_unit REAL,
        quantity INTEGER, total_dispute_amount REAL, membership_verified TEXT, dispute_status TEXT,
        days_to_expiry INTEGER, detected_date TEXT, distributor_flag INTEGER, action_required TEXT, financial_impact TEXT)""")
    c.execute("""CREATE TABLE sla_tickets (
        sla_id TEXT PRIMARY KEY, linked_record_id TEXT, linked_record_type TEXT, linked_screen TEXT,
        linked_filter TEXT, department TEXT, owner_name TEXT, sla_description TEXT,
        sla_target_value INTEGER, sla_target_unit TEXT, actual_elapsed INTEGER, elapsed_unit TEXT,
        sla_status TEXT, breach_severity TEXT, financial_impact REAL, prescribed_action TEXT, is_breached INTEGER)""")
    c.execute("""CREATE TABLE onboarding_queue (
        onboarding_id TEXT PRIMARY KEY, customer_id TEXT, applicant_name TEXT, customer_segment TEXT,
        city TEXT, state TEXT, submitted_hours_ago INTEGER, stalled_flag INTEGER, blocking_department TEXT,
        blocking_reason TEXT, pipeline_value_estimate REAL, sales_rep_id TEXT, action_required TEXT)""")
    c.execute("""CREATE TABLE dso_analysis (
        dso_id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, customer_name TEXT, product_name TEXT,
        order_amount REAL, payment_method TEXT, simulated_dso_days INTEGER, dso_benchmark INTEGER,
        dso_variance INTEGER, dq_issue_type TEXT, collection_at_risk REAL, action_required TEXT)""")


def _load_csv_table(conn, table_name, columns):
    path = CSV_DIR / f"{table_name}.csv"
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        placeholders = ",".join(["?"] * len(columns))
        sql = f"INSERT INTO {table_name} ({','.join(columns)}) VALUES ({placeholders})"
        rows = []
        for row in reader:
            vals = []
            for col in columns:
                value = row.get(col, "")
                vals.append(None if value in ("", "NULL") else value)
            rows.append(tuple(vals))
    conn.executemany(sql, rows)


def seed_commercial_tables(conn):
    _load_csv_table(
        conn,
        "customer_hierarchy",
        [
            "node_id", "node_type", "node_name", "parent_id", "parent_type",
            "idn_id", "idn_name", "hco_id", "hco_name",
            "linked_customer_id", "linked_doctor_npi",
            "gpo_membership", "gpo_tier", "credit_limit",
            "hierarchy_status", "confidence_score",
            "iqvia_affiliation", "iqvia_delta", "iqvia_delta_detail",
        ],
    )
    _load_csv_table(
        conn,
        "gpo_contracts",
        [
            "contract_id", "customer_id", "product_id", "product_name", "gpo_name", "tier",
            "contracted_price", "charged_price", "price_variance", "membership_verified",
            "contract_start", "contract_end", "days_to_expiry", "contract_status",
            "linked_order_id", "conflict_flag", "conflict_reason",
        ],
    )
    _load_csv_table(
        conn,
        "alerts_queue",
        [
            "alert_id", "alert_type", "title", "description",
            "financial_tier", "dollar_impact", "primary_persona", "primary_owner_name",
            "primary_owner_role", "linked_records", "linked_screen", "linked_filter",
            "status", "detected_date", "severity",
            "prescribed_action_1", "prescribed_action_2", "prescribed_action_3",
            "regulation_reference", "secondary_persona_note",
        ],
    )
    _load_csv_table(
        conn,
        "tax_exemption_certs",
        [
            "cert_id", "customer_id", "customer_name", "customer_segment",
            "cert_status", "cert_number", "issuing_state", "expiry_date",
            "days_to_expiry", "tax_exempt_type", "revenue_at_risk",
            "orders_affected", "action_required",
        ],
    )
    _load_csv_table(
        conn,
        "tax_jurisdiction_issues",
        [
            "issue_id", "order_id", "customer_id", "customer_name", "issue_type", "priority",
            "dollar_value", "invoice_status", "urgency_label", "owner_id", "owner_name", "ai_fix",
            "ai_confidence", "ai_source", "correct_jurisdiction", "applied_jurisdiction",
            "ship_to_state", "bill_to_state", "product", "sla_days_remaining", "opened_date",
            "status", "address_record", "pre_invoice", "rate_difference", "capa_id", "root_cause",
            "risk_compliance", "risk_penalty", "risk_legal", "risk_jurisdiction",
        ],
    )
    _load_csv_table(
        conn,
        "pricing_issues",
        [
            "issue_id", "order_id", "customer_id", "customer_name", "issue_type", "priority",
            "dollar_value", "invoice_status", "urgency_label", "owner_id", "owner_name", "ai_fix",
            "ai_confidence", "ai_source", "correct_tier", "applied_tier", "gpo_name", "product",
            "sla_days_remaining", "opened_date", "status", "contract_id", "credit_memo_required",
            "overcharge_per_unit", "quantity_affected", "capa_id", "root_cause", "risk_revenue",
            "risk_chargeback", "risk_compliance", "risk_gpo",
        ],
    )
    def _parse_cfo_narrative_tail(parts: list[str]) -> list[str]:
        def _is_num(value: str) -> bool:
            try:
                float(value)
                return True
            except ValueError:
                return False

        if not parts:
            return [""] * 8
        num_idxs = [i for i, p in enumerate(parts) if _is_num(p)]
        if len(num_idxs) >= 2:
            c1, c2 = num_idxs[0], num_idxs[1]
            ai_fix_1 = ",".join(parts[:c1])
            ai_source_1 = parts[c1 + 1] if c1 + 1 < c2 else ""
            ai_fix_2 = ",".join(parts[c1 + 2 : c2]) if c2 > c1 + 2 else ""
            ai_source_2 = parts[c2 + 1] if c2 + 1 < len(parts) else ""
            roots = ",".join(parts[c2 + 2 :]) if c2 + 2 < len(parts) else ""
            return [ai_fix_1, parts[c1], ai_source_1, ai_fix_2, parts[c2], ai_source_2, roots, ""]
        if len(num_idxs) == 1:
            c1 = num_idxs[0]
            ai_fix_1 = ",".join(parts[:c1])
            rest = parts[c1 + 1 :]
            ai_source_1 = rest[0] if rest else ""
            root_primary = ",".join(rest[1:]) if len(rest) > 1 else ""
            return [ai_fix_1, parts[c1], ai_source_1, "", "0.0", "", root_primary, ""]
        merged = ",".join(parts)
        return [merged, "0.0", "", "", "0.0", "", "", ""]

    def _normalize_cfo_csv_row(fields: list[str]) -> list[str]:
        """Merge overflow columns caused by unquoted commas in narrative fields."""
        if len(fields) <= 37:
            return (fields + [""] * 37)[:37]
        row = list(fields)
        contract_price = row.pop()
        list_price = row.pop()
        applied_jurisdiction = row.pop()
        correct_jurisdiction = row.pop()
        next_action_pricing = row.pop()
        next_action_tax = row.pop()
        capa_ids = row.pop()
        head = row[:22]
        tail_text = _parse_cfo_narrative_tail(row[22:])
        return head + tail_text + [
            capa_ids,
            next_action_tax,
            next_action_pricing,
            correct_jurisdiction,
            applied_jurisdiction,
            list_price,
            contract_price,
        ]

    with open(CSV_DIR / "cfo_alerts.csv", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        cfo_rows = [_normalize_cfo_csv_row(row) for row in reader if row]
    conn.executemany(
        "INSERT INTO cfo_alerts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                r[0],
                r[1],
                r[2],
                r[3],
                r[4],
                r[5],
                float(r[6]),
                float(r[7]),
                float(r[8]),
                r[9],
                r[10],
                int(r[11]),
                int(r[12]),
                r[13],
                r[14],
                r[15],
                r[16],
                r[17],
                r[18],
                r[19],
                r[20],
                r[21],
                r[22],
                float(r[23]),
                r[24],
                r[25],
                float(r[26]),
                r[27],
                r[28],
                r[29],
                r[30],
                r[31],
                r[32],
                r[33],
                r[34],
                float(r[35] or 0),
                float(r[36] or 0),
            )
            for r in cfo_rows
        ],
    )
    with open(CSV_DIR / "cco_compliance_issues.csv", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)
        cco_rows = [row for row in reader if row]
    conn.executemany(
        "INSERT OR IGNORE INTO cco_compliance_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                r[0],
                r[1],
                r[2],
                r[3],
                r[4],
                r[5],
                float(r[6]),
                int(r[7]),
                int(r[8]),
                r[9],
                r[10],
                int(r[11]),
                int(r[12]),
                r[13],
                r[14],
                r[15],
                r[16],
                r[17],
                r[18],
                r[19],
                r[20],
                r[21],
                r[22],
                float(r[23]),
                r[24],
                r[25],
                float(r[26]) if r[26] else 0.0,
                r[27],
                r[28],
                r[29],
                r[30],
                r[31],
                r[32],
                r[33],
                r[34],
                r[35],
                r[36],
                r[37],
                r[38],
            )
            for r in cco_rows
        ],
    )
    _vp_csv = CSV_DIR / "vp_alerts.csv"
    if _vp_csv.exists():
        with open(_vp_csv, newline="", encoding="utf-8") as f:
            _vp_reader = csv.DictReader(f)
            for _vp_row in _vp_reader:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO vp_alerts VALUES (
                        :issue_id,:account_id,:account_name,:order_id,:issue_type,:team,
                        :priority,:dollar_exposure,:margin_at_risk,:penalty_exposure,
                        :invoice_status,:pre_invoice,:sla_days_remaining,:opened_date,:status,
                        :current_owner_id,:current_owner_name,:current_owner_team,
                        :secondary_owner_id,:secondary_owner_name,:secondary_owner_team,
                        :sla_health,:live_progress_primary,:live_progress_secondary,
                        :completion_primary,:completion_secondary,
                        :ai_fix_1,:ai_confidence_1,:ai_source_1,
                        :ai_fix_2,:ai_confidence_2,:ai_source_2,
                        :root_cause_primary,:root_cause_secondary,:capa_ids,
                        :next_action_primary,:next_action_secondary,
                        :recurrence_count,:recurrence_period,:capa_exists,:vp_action_signal
                    )
                    """,
                    _vp_row,
                )
    with open(CSV_DIR / "data_steward_issues.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    conn.executemany(
        "INSERT INTO data_steward_issues VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                r["issue_id"], r["customer_id"], r["customer_name"],
                r["issue_type"], r["priority"], float(r["dollar_value"]),
                r["hierarchy_level"], r["current_idn"], r["correct_idn"],
                r["current_idn_name"], r["correct_idn_name"],
                r["current_jurisdiction"], r["correct_jurisdiction"],
                r["owner_id"], r["owner_name"],
                int(r["sla_days_remaining"]) if r["sla_days_remaining"] else 0,
                r["opened_date"], r["status"], r["open_orders"], r["contract_id"],
                r["ai_fix"], float(r["ai_confidence"]), r["ai_source"],
                r["root_cause"], r["effective_date"], r["last_updated"],
                r["source_system"], r["capa_id"], r["risk_pricing"],
                r["risk_tax"], r["risk_credit"], r["risk_gpo"],
                r.get("ai_decision", ""),
            )
            for r in rows
        ],
    )


def seed_tax_workflow_customers(conn):
    """Tax persona demo customers (ship-to vs bill-to jurisdiction mismatches)."""
    rows = [
        ("CUST-0892", "Central", "Hospital", "contact892@bioventus-demo.com", "(602) 500-0892", "1975-01-01", "88 South Ave", "Phoenix", "AZ", "85001", "USA", "Health System", "Active", None, None, None, None, None, None, None, None, None, None),
        ("CUST-1087", "Riverside", "Clinic", "contact1087@bioventus-demo.com", "(602) 501-1087", "1976-01-01", "200 River Rd", "Phoenix", "AZ", "85002", "USA", "Spine Center", "Active", None, None, None, None, None, None, None, None, None, None),
        ("CUST-2011", "Northeast", "Medical", "contact2011@bioventus-demo.com", "(704) 502-2011", "1977-01-01", "450 NE Blvd", "Charlotte", "NC", "28201", "USA", "Health System", "Active", None, None, None, None, None, None, None, None, None, None),
        ("CUST-3042", "Valley", "Health", "contact3042@bioventus-demo.com", "(614) 503-3042", "1978-01-01", "30 Valley Dr", "Columbus", "OH", "43001", "USA", "Health System", "Active", None, None, None, None, None, None, None, None, None, None),
    ]
    conn.executemany(
        "INSERT INTO customer_master VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        rows,
    )


def patch_tax_workflow_sales_orders(conn):
    """Replace demo orders used by the Tax Team persona workflow."""
    updates = [
        ("ORD-011", "CUST-0892", "PRD-001", "Exogen", "2026-01-15", "2026-01-20", 2, 1820.0, 3640.0, "REP-05", "Southeast", "Credit", "Yes", "Central Hospital, 88 South Ave, Phoenix, AZ 85001", "David Marsh", "4421", "dmarsh@central.org", "55-1234567"),
        ("ORD-015", "CUST-1087", "PRD-002", "Exogen", "2026-02-01", "2026-02-06", 2, 2160.0, 4320.0, "REP-03", "Southeast", "Credit", "Yes", "Riverside Clinic, 200 River Rd, Phoenix, AZ 85002", "Karen Fields", "3317", "kfields@riverside.org", "55-2345678"),
        ("ORD-018", "CUST-2011", "PRD-001", "Exogen", "2026-04-01", None, 2, 4120.0, 8240.0, "REP-02", "Southeast", "Credit", "No", "Northeast Medical, 450 NE Blvd, Phoenix, AZ 85001", "James Liu", "7782", "jliu@nemedical.org", "55-3456789"),
        ("ORD-019", "CUST-3042", "PRD-002", "Exogen", "2026-04-03", None, 2, 3090.0, 6180.0, "REP-04", "Southeast", "Credit", "No", "Valley Health, 30 Valley Dr, Phoenix, AZ 85001", "Sara Patel", "5591", "spatel@valleyhealth.org", "55-4567890"),
        ("ORD-022", "CUST-2011", "PRD-003", "Exogen", "2026-04-05", None, 4, 2060.0, 8240.0, "REP-02", "Southeast", "Credit", "No", "Northeast Medical, 450 NE Blvd, Phoenix, AZ 85001", "James Liu", "7782", "jliu@nemedical.org", "55-3456789"),
        ("ORD-033", "CUST-0892", "PRD-001", "Exogen", "2026-04-02", None, 1, 3300.0, 3300.0, "REP-05", "Southeast", "Credit", "No", "Central Hospital, 88 South Ave, Phoenix, AZ 85001", "David Marsh", "4421", "dmarsh@central.org", "55-1234567"),
        ("ORD-034", "CUST-1087", "PRD-002", "Exogen", "2026-04-01", None, 1, 3300.0, 3300.0, "REP-03", "Southeast", "Credit", "No", "Riverside Clinic, 200 River Rd, Phoenix, AZ 85002", "Karen Fields", "3317", "kfields@riverside.org", "55-2345678"),
    ]
    for row in updates:
        conn.execute(
            """UPDATE sales_orders SET
                customer_id=?, product_id=?, product_name=?, order_date=?, ship_date=?,
                quantity=?, unit_price=?, total_amount=?, sales_rep_id=?, region=?,
                payment_method=?, revenue_recognized=?, billing_address=?, cardholder_name=?,
                card_last_four=?, billing_email=?, tax_id=?
            WHERE order_id=?""",
            (*row[1:], row[0]),
        )
    inserts = [
        ("ORD-035", "CUST-3042", "PRD-002", "Exogen", "2026-03-18", "2026-03-22", 1, 3300.0, 3300.0, "REP-04", "Southeast", "Credit", "Yes", "Valley Health, 30 Valley Dr, Phoenix, AZ 85001", "Sara Patel", "5591", "spatel@valleyhealth.org", "55-4567890"),
        ("ORD-036", "CUST-2011", "PRD-001", "Exogen", "2026-03-10", "2026-03-14", 1, 3300.0, 3300.0, "REP-02", "Southeast", "Credit", "Yes", "Northeast Medical, 450 NE Blvd, Phoenix, AZ 85001", "James Liu", "7782", "jliu@nemedical.org", "55-3456789"),
        ("ORD-037", "CUST-0892", "PRD-003", "Exogen", "2026-03-15", "2026-03-19", 1, 2160.0, 2160.0, "REP-05", "Southeast", "Credit", "Yes", "Central Hospital, 88 South Ave, Phoenix, AZ 85001", "David Marsh", "4421", "dmarsh@central.org", "55-1234567"),
    ]
    conn.executemany(
        """INSERT INTO sales_orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        inserts,
    )


def seed_product_catalog(conn):
    rows = [
        ("PRD-001", "DUROLANE 3mL", "Pain Treatment / KOA", "K173588", "2017-09-05", "III", "Bioventus LLC", "LOT-BV-2024-001", "2027-01-31", "None", "J7323"),
        ("PRD-002", "GELSYN-3 6mL", "Pain Treatment / KOA", "K162919", "2016-09-15", "III", "Bioventus LLC", "LOT-BV-2024-002", "2027-03-31", "None", "J7325"),
        ("PRD-003", "SUPARTZ FX 2.5mL", "Pain Treatment / KOA", "K130042", "2013-01-22", "II", "Bioventus LLC", "LOT-BV-2024-003", "2027-05-15", "None", "J7321"),
        ("PRD-004", "XCELL PRP System", "Pain Treatment / PRP", "K183562", "2018-11-30", "II", "Bioventus LLC", "LOT-BV-2024-004", "2027-06-30", "None", "Q4151"),
        ("PRD-005", "StimRouter", "Pain Treatment / PNS", "K192731", "2019-09-20", "III", "Bioventus LLC", "LOT-BV-2024-005", "2027-08-31", "None", "C1767"),
        ("PRD-006", "TalisMann", "Pain Treatment / PNS", "K250821", "2025-07-30", "III", "Bioventus LLC", "LOT-BV-2024-006", "2028-01-31", "None", "C1823"),
        ("PRD-007", "StimTrial", "Pain Treatment / PNS", "K250822", "2025-07-30", "III", "Bioventus LLC", "LOT-BV-2024-007", "2028-06-30", "None", "C1824"),
        ("PRD-008", "EXOGEN 4.0", "Fracture Care", "P900009", "1994-10-05", "III", "Bioventus LLC", "LOT-BV-2024-008", "2025-09-15", "RECALLED", "E0760"),
        ("PRD-009", "EXOGEN Lite", "Fracture Care", "K991137", "1999-11-18", "III", "Bioventus LLC", "LOT-BV-2024-009", "2025-11-30", None, "E0762"),
        ("PRD-010", "neXus System", "Surgical / Ultrasonics", "K211983", "2021-10-14", None, "Bioventus LLC", "LOT-BV-2024-010", "2027-04-30", "None", "A4263"),
        ("PRD-011", "SonaStar Elite", "Surgical / Ultrasonics", "K223041", "2022-08-22", None, "Bioventus LLC", "LOT-BV-2024-011", "2027-07-31", "None", "A4264"),
        ("PRD-012", "Osteocel Plus", "Surgical / BGS", None, "2009-12-01", "II", "Bioventus LLC", "LOT-BV-2024-012", "2027-11-30", "None", "V2690"),
        ("PRD-013", "ViviGen Cellular", "Surgical / BGS", None, "2011-07-19", "II", "Bioventus LLC", "LOT-BV-2024-013", "2028-01-15", "None", "V2691"),
        ("PRD-014", "Corelink SSL", "Surgical / BGS", None, "2014-09-30", "II", "Bioventus LLC", "LOT-BV-2024-014", "2028-03-31", "None", "V2692"),
        ("PRD-015", "Corelink Kore", "Surgical / BGS", "K161234", "2016-05-12", None, "Bioventus LLC", "LOT-BV-2024-015", "2028-05-30", "None", None),
        ("PRD-016", "DUROLANE 3mL Refill Kit", "Pain Treatment / KOA", "K173588", "2017-09-05", "III", "Bioventus LLC", "LOT-BV-2024-016", "2027-09-30", "None", "J7323"),
        ("PRD-017", "GELSYN-3 Starter Pack", "Pain Treatment / KOA", "K162919", "2016-09-15", "III", "Bioventus LLC", "LOT-BV-2024-017", "2027-10-30", "None", "J7325"),
        ("PRD-018", "StimRouter Lead Kit", "Pain Treatment / PNS", "K192731", "2019-09-20", "III", "Bioventus LLC", "LOT-BV-2024-018", "2028-02-28", "None", None),
        ("PRD-019", "EXOGEN Replacement Transducer", "Fracture Care", "P900009", "1994-10-05", "III", "Bioventus LLC", "LOT-BV-2024-019", "2027-12-31", "None", "E0760"),
        ("PRD-020", "neXus Handpiece 36kHz", "Surgical / Ultrasonics", "K211983", "2021-10-14", "II", "Bioventus LLC", "LOT-BV-2024-020", "2027-08-15", "None", "A4263"),
        ("PRD-021", "ViviGen Flex", "Surgical / BGS", "K112034", "2011-07-19", "II", "Bioventus LLC", "LOT-BV-2024-021", "2028-04-30", "None", "V2691"),
        ("PRD-022", "Corelink CoreDisc", "Surgical / BGS", "K143891", "2014-09-30", "II", "Bioventus LLC", "LOT-BV-2024-022", "2028-01-31", "None", "V2692"),
        ("PRD-023", "Osteocel XO", "Surgical / BGS", "K093982", "2009-12-01", None, "Bioventus LLC", "LOT-BV-2024-023", "2028-02-15", "None", "V2690"),
        ("PRD-024", "BioBurs System", "Surgical / Ultrasonics", "K223041", "2022-08-22", "II", "Bioventus LLC", "LOT-BV-2024-024", "2028-05-01", "None", None),
        ("PRD-025", "XCELL Cartridge Pack", "Pain Treatment / PRP", "K183562", "2018-11-30", "II", "Bioventus LLC", "LOT-BV-2024-025", "2028-06-15", "None", "Q4151"),
    ]
    conn.executemany("INSERT INTO product_catalog VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows)


def seed_customer_master(conn):
    rows = []
    names = [
        ("Northside Orthopedics", "Durham", "NC"), ("Durham Spine Center", "Durham", "NC"),
        ("Raleigh Pain Clinic", "Raleigh", "NC"), ("Triangle Health System", "Chapel Hill", "NC"),
        ("Southeast Orthopedic Group", "Charlotte", "NC"), ("Coastal Pain Partners", "Wilmington", "NC"),
        ("Piedmont Pain Associates", "Greensboro", "NC"), ("Blue Ridge Pain Clinic", "Asheville", "NC"),
        ("Cape Fear Pain Institute", "Fayetteville", "NC"), ("Sandhills Pain Center", "Pinehurst", "NC"),
        ("Atlantic Medical Distribution", "Jacksonville", "NC"), ("Carolina Device Logistics", "Raleigh", "NC"),
        ("Pine State MedSupply", "Charlotte", "NC"), ("Tarheel Surgical Supply", "Greenville", "North Carolina"),
        ("Bluewater Distribution", "Winston-Salem", "NC"), ("Inactive Ortho One", "Durham", "NC"),
        ("Inactive Ortho Two", "Raleigh", "NC"), ("Inactive Ortho Three", "Greensboro", "NC"),
        ("Inactive Ortho Four", "Charlotte", "NC"), ("Inactive Ortho Five", "Wilmington", "NC"),
        ("Pending Spine One", "Cary", "NC"), ("Pending Spine Two", "Apex", "NC"),
        ("Pending Pain One", "Morrisville", "NC"), ("Pending Pain Two", "Knightdale", "NC"),
        ("Pending Distributor", "Garner", "NC"), ("Capital Spine Institute", "Raleigh", "NC"),
        ("Triad Spine Specialists", "Greensboro", "NC"), ("East Coast Spine Center", "Wilmington", "NC"),
    ]
    segments = ["Health System", "Orthopedic Practice", "Spine Center", "Pain Management Clinic", "Distributor"]
    statuses = ["Active"] * 15 + ["Inactive"] * 5 + ["Pending"] * 5 + ["Active"] * 3
    for i in range(28):
        cid = f"CUST-{1001 + i}"
        first_name = names[i][0].split(" ")[0]
        last_name = names[i][0].split(" ")[-1]
        email = f"contact{i+1}@bioventus-demo.com"
        phone = f"(919) 55{(i % 10)}-{1000+i:04d}"
        dob = f"19{70 + (i % 20)}-0{(i % 9) + 1}-15"
        if 5 <= i <= 9 and i in (5, 7, 9):
            email = None
        if 5 <= i <= 9 and i in (6, 8):
            phone = "555-CALL" if i == 6 else "N/A"
        if i == 11:
            cid = "CUST-1012"
        if i == 12:
            cid = "CUST-1012"
        if 20 <= i <= 24 and i in (21, 23):
            dob = None
        if 20 <= i <= 24 and i in (20, 24):
            email = None
        row = (
            cid, first_name, last_name, email, phone, dob, f"{100+i} Medical Way",
            names[i][1], names[i][2], f"27{700 + i}", "USA", segments[i % len(segments)], statuses[i],
            ssn(), credit_card(), bank_account(), insurance_id(), ethnicity(), annual_income(),
            ip_address(), passport_number(), drivers_license(), emergency_contact_phone(),
        )
        rows.append(row)
    conn.executemany("INSERT INTO customer_master VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return {r[0] for r in rows}


def unit_price(name):
    mapping = {"DUROLANE 3mL": 850, "GELSYN-3 6mL": 720, "SUPARTZ FX 2.5mL": 650, "EXOGEN 4.0": 4200, "neXus System": 8500, "StimRouter": 12000, "TalisMann": 14000, "StimTrial": 13500}
    return mapping.get(name, 900)


def seed_sales_orders(conn):
    rows = []
    base = [
        ("CUST-1001", "PRD-001", "DUROLANE 3mL", "2025-01-10", "2025-01-14"),
        ("CUST-1002", "PRD-002", "GELSYN-3 6mL", "2025-02-12", "2025-02-17"),
        ("CUST-1003", "PRD-003", "SUPARTZ FX 2.5mL", "2025-03-05", "2025-03-10"),
        ("CUST-1004", "PRD-009", "EXOGEN Lite", "2025-03-21", "2025-03-27"),
        ("CUST-1005", "PRD-010", "neXus System", "2025-04-01", "2025-04-08"),
        ("CUST-1026", "PRD-001", "DUROLANE 3mL", "2025-04-14", "2025-04-18"),
        ("CUST-1027", "PRD-002", "GELSYN-3 6mL", "2025-05-03", "2025-05-10"),
        ("CUST-1028", "PRD-010", "neXus System", "2025-05-16", "2025-05-22"),
    ]
    order_num = 1
    for item in base:
        qty = 2
        price = unit_price(item[2])
        rows.append((f"ORD-{order_num:03d}", item[0], item[1], item[2], item[3], item[4], qty, price, qty * price, f"REP-0{(order_num % 10) or 10}", "Southeast", "Credit", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()))
        order_num += 1
    for orphan in ["CUST-9901", "CUST-9902", "CUST-9903", "CUST-9904"]:
        pname = "DUROLANE 3mL" if order_num % 2 else "StimRouter"
        pid = "PRD-001" if pname == "DUROLANE 3mL" else "PRD-005"
        price = unit_price(pname)
        rows.append((f"ORD-{order_num:03d}", orphan, pid, pname, "2025-06-01", "2025-06-07", 1, price, price, "REP-04", "Central", "PO", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()))
        order_num += 1
    for d in ["2025-10-05", "2025-10-20", "2025-11-02", "2025-12-10"]:
        rows.append((f"ORD-{order_num:03d}", f"CUST-10{25 + (order_num % 3) + 1}", "PRD-008", "EXOGEN 4.0", d, "2025-12-20", 1, 4200, 4200, "REP-07", "Southeast", "Wire", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()))
        order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1006", "PRD-005", "StimRouter", "2025-06-12", "2025-06-20", 1, 12000, -1250.0, "REP-05", "West", "Credit", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1007", "PRD-005", "StimRouter", "2025-06-15", "2025-06-22", 1, 12000, -3400.0, "REP-05", "West", "Credit", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1008", "PRD-002", "GELSYN-3 6mL", "2025-07-01", "2025-07-05", 3, 720, 2160, "REP-03", "Northeast", "PO", None, billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1009", "PRD-003", "SUPARTZ FX 2.5mL", "2025-07-08", "2025-07-12", 2, 650, 1300, "REP-03", "Northeast", "PO", None, billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1010", "PRD-002", "GELSYN-3 6mL", "2025-06-15", "2025-06-10", 1, 720, 720, "REP-02", "Midwest", "Check", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1011", "PRD-003", "SUPARTZ FX 2.5mL", "2025-07-20", "2025-07-15", 1, 650, 650, "REP-02", "Midwest", "Check", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1012", "PRD-001", "DUROLANE 3mL", "2026-06-01", "2026-06-08", 1, 850, 850, "REP-01", "Central", "Credit", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1013", "PRD-010", "neXus System", "2026-08-15", "2026-08-21", 1, 8500, 8500, "REP-01", "Central", "Credit", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    for cid in ["CUST-1014", "CUST-1015", "CUST-1016", "CUST-1017"]:
        rows.append((f"ORD-{order_num:03d}", cid, "PRD-001", "DUROLANE 3mL", "2025-09-01", "2025-09-06", 2, 850, 1700, "GHOST-REP-99", "Southeast", "Net30", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1027", "PRD-006", "TalisMann", "2025-11-10", "2025-11-17", 1, 14000, 14000, "REP-10", "Southeast", "Wire", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id())); order_num += 1
    rows.append((f"ORD-{order_num:03d}", "CUST-1028", "PRD-007", "StimTrial", "2025-12-01", "2025-12-08", 1, 13500, 13500, "REP-09", "Southeast", "Wire", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()))
    order_num += 1
    rows.extend([
        (f"ORD-{order_num:03d}", "CUST-1010", "PRD-002", "GELSYN-3 6mL", "2025-08-15", "2025-08-22", 2, 720, 1440, "REP-02", "Southeast", "Check", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()),
        (f"ORD-{order_num + 1:03d}", "CUST-1015", "PRD-001", "DUROLANE 3mL", "2025-09-10", "2025-09-17", 3, 850, 2550, "REP-06", "Southeast", "Net30", "Yes", billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()),
        (f"ORD-{order_num + 2:03d}", "CUST-1020", "PRD-003", "SUPARTZ FX 2.5mL", "2025-10-05", "2025-10-12", 4, 650, 2600, "REP-08", "Southeast", "PO", None, billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()),
        (f"ORD-{order_num + 3:03d}", "CUST-1025", "PRD-002", "GELSYN-3 6mL", "2025-11-20", "2025-11-27", 3, 720, 2160, "REP-02", "Central", "Check", None, billing_address(), cardholder_name(), card_last_four(), billing_email(), tax_id()),
    ])
    conn.executemany("INSERT INTO sales_orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def seed_patient_support(conn):
    rows = []
    def note(name): return treatment_notes_with_pii(name.split()[0], name.split()[-1], ssn(), emergency_contact_phone(), f"{name.lower().replace(' ', '.')}@patient.com", credit_card())
    for i in range(1, 7):
        code = "M17.11" if i % 2 else "M17.12"
        rows.append((f"CASE-{5000+i}", f"PAT-BV-{i:03d}", f"CUST-100{i if i <=5 else 1}", f"PRD-00{(i % 3)+1}", "Product Question" if i % 2 else "Technical", f"2025-01-{10+i:02d}", f"2025-01-{18+i:02d}", 0, 0, 1, 0, "Closed", f"REP-0{i}", code, note(f"Patient {i}"), "Dr. Sarah Kim", "2345678904", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    for i in range(7, 11):
        rows.append((f"CASE-{5000+i}", f"PAT-BV-{i:03d}", f"CUST-100{i-5}", "PRD-008" if i % 2 else "PRD-005", "Adverse Event", f"2025-09-{10+i:02d}", None if i % 2 else f"2025-10-{10+i:02d}", 1, 1, 1, 1, "In Progress" if i % 2 else "Closed", f"REP-0{i-3}", "M84.352" if i % 2 else "G89.29", note(f"Patient {i}"), "Dr. Robert Patel", "3456789015", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    for i, cid in enumerate(["CUST-1026", "CUST-1027", "CUST-1028", "CUST-1026"], start=11):
        rows.append((f"CASE-{5000+i}", f"PAT-BV-{i:03d}", cid, "PRD-008", "Adverse Event", f"2025-10-{(i+1):02d}", None, 1, 0, 1, 1, "Open" if i % 2 else "In Progress", "REP-07", "T85.698A" if i % 2 else "M84.552", note(f"Patient {i}"), "Dr. Marcus Chen", "5678901237", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    for i in range(15, 19):
        rows.append((f"CASE-{5000+i}", f"PAT-BV-{i:03d}", f"CUST-100{i-10}", "PRD-005" if i % 2 else "PRD-006", "Technical", f"2025-11-{i:02d}", None, 0, None, None, 1, "Open" if i % 2 else "In Progress", f"REP-0{i-8}", "G89.29", note(f"Patient {i}"), "Dr. Linda Torres", "4567890126", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    for i, cid in enumerate(["CUST-1016", "CUST-1017", "CUST-1018"], start=19):
        rows.append((f"CASE-{5000+i}", f"PAT-BV-{i:03d}", cid, "PRD-002" if i % 2 else "PRD-003", "Product Question", f"2025-12-{i:02d}", None, 0, 0, 1, 0, "Open", f"REP-0{i-12}", "M17.12", note(f"Patient {i}"), "Dr. Sarah Kim", "2345678904", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    rows.append(("CASE-5022", "PAT-BV-022", "CUST-1002", "PRD-010", "Technical", "2025-09-01", None, 0, 0, 1, 0, "Closed", "REP-03", "M17.11", note("Patient 22"), "Dr. Thomas Grant", "0123456782", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    rows.append(("CASE-5023", "PAT-BV-023", "CUST-1003", "PRD-009", "Product Question", "2025-09-05", None, 0, 0, 1, 0, "Closed", "REP-03", "M17.12", note("Patient 23"), "Dr. Maria Lopez", "1234509873", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    rows.append(("CASE-5024", "PAT-BV-024", "CUST-1004", "PRD-010", "Technical", "2025-09-09", None, 0, 0, 1, 0, "Closed", "REP-04", "M17.11", note("Patient 24"), "Dr. Rachel Green", "3456721095", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    for i in range(25, 28):
        rows.append((f"CASE-50{i}", f"PAT-BV-{i:03d}", f"CUST-10{20+i-20}", "PRD-006" if i % 2 else "PRD-007", "Adverse Event", f"2025-12-{i:02d}", None, 1, 1, 1, 1, "In Progress", "REP-07", "G89.29", note(f"Patient {i}"), "Dr. James Whitfield", "1234567893", patient_dob(), home_address(), health_plan_id(), copay_amount()))
    conn.executemany("INSERT INTO patient_support VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def seed_master_conflicts(conn):
    rows = []
    issue_customers = [f"CUST-{1006+i}" for i in range(15)]
    for i, cid in enumerate(issue_customers[:5]):
        rows.append((cid, "email", f"contact{i}@clinic.com", f"admin{i}@clinic.org", "Email mismatch CRM vs ERP"))
    for i, cid in enumerate(issue_customers[5:10]):
        rows.append((cid, "address", f"{100+i} Billing Ave", f"{200+i} Shipping Blvd", "Address conflict — billing vs shipping"))
    for cid in issue_customers[10:15]:
        rows.append((cid, "account_status", "ACTIVE", "SUSPENDED", "Status conflict — reactivation pending"))
    conn.executemany("INSERT INTO master_conflicts VALUES (?,?,?,?,?)", rows)


def seed_territory_alignment(conn):
    rows = [
        ("TALIGN-001", "ORD-002", "CUST-1002", "Durham Center", "REP-02", "Jordan Kim", "Midwest", "Southeast", "GELSYN-3 6mL", 1440, 0.03, 43.2, 1, 43.2, "REP-02 assigned to Midwest territory but ORD-002 is in Southeast region", "Route order to Southeast rep. Adjust commission: deduct $43 from REP-02, credit REP-01 (Southeast)."),
        ("TALIGN-002", "ORD-004", "CUST-1004", "Triangle System", "REP-04", "Marcus Webb", "Central", "Southeast", "EXOGEN Lite", 1800, 0.03, 54.0, 1, 54.0, "REP-04 assigned to Central territory but ORD-004 is in Southeast region", "Route order to Southeast rep. Adjust commission: deduct $54 from REP-04, credit REP-01."),
        ("TALIGN-003", "ORD-005", "CUST-1005", "Southeast Group", "REP-05", "Diana Torres", "West", "Southeast", "neXus System", 17000, 0.03, 510.0, 1, 510.0, "REP-05 assigned to West territory but ORD-005 is in Southeast region — LARGEST misalignment ($510 commission at risk)", "Route to Southeast rep. Deduct $510 from REP-05, credit REP-06 or REP-08 (Charlotte area)."),
        ("TALIGN-004", "ORD-019", "CUST-1008", "Blue Clinic", "REP-03", "Sarah Chen", "Southeast", "Northeast", "GELSYN-3 6mL", 2160, 0.03, 64.8, 1, 64.8, "REP-03 assigned to Southeast territory but ORD-019 is in Northeast region", "Route order to Northeast rep. Adjust commission $65."),
        ("TALIGN-005", "ORD-020", "CUST-1009", "Cape Institute", "REP-03", "Sarah Chen", "Southeast", "Northeast", "SUPARTZ FX 2.5mL", 1300, 0.03, 39.0, 1, 39.0, "REP-03 assigned to Southeast but ORD-020 is in Northeast region", "Route to Northeast rep. Commission adjustment $39."),
        ("TALIGN-006", "ORD-023", "CUST-1012", "Carolina Logistics", "REP-01", "Alex Martinez", "Southeast", "Central", "DUROLANE 3mL", 850, 0.03, 25.5, 1, 25.5, "REP-01 assigned to Southeast but ORD-023 is in Central region. ALSO: CUST-1012 is a duplicate record — territory assignment ambiguous", "Resolve CUST-1012 duplicate first, then re-assign territory. Commission $26 on hold."),
        ("TALIGN-007", "ORD-024", "CUST-1013", "Unknown Customer", "REP-01", "Alex Martinez", "Southeast", "Central", "neXus System", 8500, 0.03, 255.0, 1, 255.0, "REP-01 assigned to Southeast but ORD-024 is in Central region. ALSO: CUST-1013 is an orphan customer with no master record", "Cannot attribute commission until customer record created. Revenue $8,500 unattributed."),
        ("TALIGN-008", "ORD-001", "CUST-1001", "Northside Orthopedics", "REP-01", "Alex Martinez", "Southeast", "Southeast", "DUROLANE 3mL", 1700, 0.03, 51.0, 0, 0, "Aligned. REP-01 Southeast territory matches Southeast region.", "No action required."),
        ("TALIGN-009", "ORD-003", "CUST-1003", "Raleigh Clinic", "REP-03", "Sarah Chen", "Southeast", "Southeast", "SUPARTZ FX 2.5mL", 1300, 0.03, 39.0, 0, 0, "Aligned.", "No action required."),
        ("TALIGN-010", "ORD-006", "CUST-1026", "Capital Institute", "REP-06", "Tyler Brooks", "Southeast", "Southeast", "DUROLANE 3mL", 1700, 0.03, 51.0, 0, 0, "Aligned.", "No action required."),
        ("TALIGN-011", "ORD-007", "CUST-1027", "Triad Specialists", "REP-07", "Rachel Nguyen", "Southeast", "Southeast", "GELSYN-3 6mL", 1440, 0.03, 43.2, 0, 0, "Aligned.", "No action required."),
        ("TALIGN-012", "ORD-008", "CUST-1028", "East Center", "REP-08", "James Okafor", "Southeast", "Southeast", "neXus System", 17000, 0.03, 510.0, 0, 0, "Aligned.", "No action required."),
        ("TALIGN-013", "ORD-009", "CUST-9901", "Unknown Customer", "REP-04", "Marcus Webb", "Central", "Central", "DUROLANE 3mL", 850, 0.03, 25.5, 0, 0, "Territory aligned but customer is orphan.", "Create customer record."),
        ("TALIGN-014", "ORD-013", "CUST-1027", "Triad Specialists", "REP-07", "Rachel Nguyen", "Southeast", "Southeast", "EXOGEN 4.0", 4200, 0.03, 126.0, 0, 0, "Territory aligned but product is RECALLED.", "Halt commission pending retrieval resolution."),
        ("TALIGN-015", "ORD-029", "CUST-1027", "Triad Specialists", "REP-10", "Ben Castillo", "Southeast", "Southeast", "TalisMann", 14000, 0.03, 420.0, 0, 0, "Aligned. Contract expiring 28 days.", "Ensure contract renewal to protect future commission."),
    ]
    conn.executemany("INSERT INTO territory_alignment VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def seed_chargeback_disputes(conn):
    rows = [
        ("CHB-001", "GPC-001", "ORD-001", "CUST-1001", "Northside Orthopedics", "DUROLANE 3mL", "Premier", "Tier2", 130.00, 2, 260.00, "TRUE", "Under Review", 45, "2026-03-01", 0, "Review Premier contract GPC-001. Issue credit memo $260 to CUST-1001. Update SAP pricing master for Premier Tier2 DUROLANE accounts.", "$260 overcharge on 2 units. Premier contract requires $720/unit, charged $850/unit. Membership verified — clear-cut dispute."),
        ("CHB-002", "GPC-002", "ORD-006", "CUST-1026", "Capital Institute", "DUROLANE 3mL", "Premier", "Tier2", 130.00, 2, 260.00, "TRUE", "Under Review", 45, "2026-03-05", 0, "Issue credit memo $260 to CUST-1026. NOTE: CUST-1026 also has recalled EXOGEN 4.0 order and MDR gap — coordinate with VP Quality.", "$260 overcharge. CUST-1026 is a triple-risk account: overcharge + recalled product + MDR gap."),
        ("CHB-003", "GPC-003", "ORD-010", "CUST-1005", "Southeast Group", "StimRouter", "HealthTrust", "Tier1", 1200.00, 1, 1200.00, "FALSE", "Expiring Soon", 12, "2026-03-10", 0, "URGENT: Dispute expires 12 days. Validate HealthTrust Tier1 membership for CUST-1005 BEFORE filing. If unverified, dispute cannot be filed — $1,200 lost.", "$1,200 dispute expiring in 12 days. Membership UNVERIFIED — must confirm with HealthTrust GPO roster before submission deadline."),
        ("CHB-004", "GPC-004", "ORD-012", "CUST-1007", "Piedmont Associates", "StimRouter", "HealthTrust", "Tier1", 1200.00, 1, 1200.00, "FALSE", "Expiring Soon", 12, "2026-03-10", 0, "URGENT: Dispute expires 12 days. Same issue as CHB-003 — validate HealthTrust membership for CUST-1007 immediately.", "$1,200 expiring. CUST-1007 and CUST-1005 both claim HealthTrust Tier1 without verified membership."),
        ("CHB-005", "GPC-005", "ORD-005", "CUST-1003", "Raleigh Clinic", "neXus System", "Vizient", "Tier2", 850.00, 2, 1700.00, "TRUE", "Submitted", 60, "2026-03-15", 0, "Dispute submitted to Vizient. Awaiting confirmation. Membership verified — expected resolution within 30 days.", "$1,700 dispute submitted. Vizient membership confirmed. Strongest case of the 5 active disputes."),
        ("CHB-006", "GPC-006", "ORD-002", "CUST-1002", "Durham Center", "GELSYN-3 6mL", "Premier", "Tier2", 70.00, 2, 140.00, "TRUE", "Resolved", None, "2026-01-10", 0, "Resolved Q1 2026. Credit memo issued.", "Prior period dispute resolved. $140 credit applied to CUST-1002 account."),
        ("CHB-007", "GPC-007", "ORD-007", "CUST-1027", "Triad Specialists", "GELSYN-3 6mL", "Vizient", "Tier2", 70.00, 2, 140.00, "TRUE", "Resolved", None, "2026-01-15", 0, "Resolved Q1 2026. Credit memo issued.", "Prior period dispute resolved. $140 credit issued."),
        ("CHB-008", "GPC-008", "ORD-003", "CUST-1003", "Raleigh Clinic", "SUPARTZ FX 2.5mL", "Vizient", "Tier3", 65.00, 2, 130.00, "TRUE", "Settled", None, "2026-01-20", 0, "Settled at 50% — $65 credit issued. Vizient agreed partial settlement.", "Partial settlement. $65 of $130 recovered."),
        ("CHB-009", "GPC-009", "ORD-004", "CUST-1004", "Triangle System", "EXOGEN Lite", "Vizient", "Tier2", 90.00, 2, 180.00, "TRUE", "Resolved", None, "2026-02-01", 0, "Resolved. Full credit $180 issued to CUST-1004.", "Prior period resolved. Demonstrates workflow effectiveness."),
        ("CHB-010", None, "ORD-031", "CUST-1010", "Sandhills Center", "GELSYN-3 6mL", None, None, None, 2, 1440.00, "FALSE", "Under Review", 30, "2026-04-01", 1, "Distributor ordered GELSYN-3 without active GPO contract. Full order value $1,440 is off-contract. Enroll CUST-1010 in Vizient or issue list-price invoice.", "Off-contract distributor order. No GPO enrolled. $1,440 exposure."),
        ("CHB-011", None, "ORD-032", "CUST-1015", "Bluewater Distribution", "DUROLANE 3mL", None, None, None, 3, 2550.00, "FALSE", "Under Review", 30, "2026-04-03", 1, "Distributor ordered DUROLANE without GPO contract. $2,550 off-contract. Enroll in Premier or enforce list price.", "Off-contract distributor order. $2,550 exposure."),
        ("CHB-012", None, "ORD-033", "CUST-1020", "Inactive Five", "SUPARTZ FX 2.5mL", None, None, None, 4, 2600.00, "FALSE", "Blocked", None, "2026-04-05", 1, "INACTIVE distributor placed order. Revenue recognition blocked. Off-contract AND inactive account — dual violation.", "Order from INACTIVE distributor. Blocked. $2,600 unrecognizable revenue."),
    ]
    conn.executemany("INSERT INTO chargeback_disputes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def seed_sla_tickets(conn):
    rows = [
        ("SLA-001", "CASE-5011", "patient_support", "/profiler", "dataset=patient_support&highlight=CASE-5011", "VP Quality", "Dr. Sarah Kim", "MDR filing required within 30 days of adverse event", 30, "days", 47, "days", "BREACHED", "CRITICAL", 4200.00, "File retroactive MDR via FDA MedWatch immediately. EXOGEN 4.0 adverse event — 30-day window exceeded by 17 days.", 1),
        ("SLA-002", "CASE-5012", "patient_support", "/profiler", "dataset=patient_support&highlight=CASE-5012", "VP Quality", "Dr. Sarah Kim", "MDR filing required within 30 days of adverse event", 30, "days", 39, "days", "BREACHED", "CRITICAL", 4200.00, "File retroactive MDR. 39 days elapsed, 9 days over SLA.", 1),
        ("SLA-003", "ALT-003", "alerts_queue", "/hierarchy", "customer=CUST-1009", "Commercial Ops", "Linda Torres", "Orphaned clinic resolution within 48 hours of detection", 48, "hours", 312, "hours", "BREACHED", "HIGH", 1300.00, "Map Cape Institute to IDN-002, enroll in Vizient GPO. 312 hours since detection — 264 hours over SLA.", 1),
        ("SLA-004", "CAPA-001", "capa", "/capa", "highlight=CAPA-001", "VP Quality", "Dr. Sarah Kim", "CAPA closure within 45 days of opening", 45, "days", 47, "days", "BREACHED", "CRITICAL", 16800.00, "Close CAPA-001: file MDR, initiate EXOGEN retrieval, update workflow. 2 days over SLA.", 1),
        ("SLA-005", "ALT-009", "alerts_queue", "/hierarchy", "idn=IDN-003", "Credit & AR", "Finance Team", "Credit limit review within 24 hours of breach detection", 24, "hours", 72, "hours", "BREACHED", "HIGH", 56280.00, "Review IDN-003 MedStar credit exposure $56,280. Place hold on CUST-1028. 48 hours over SLA.", 1),
        ("SLA-006", "CASE-5015", "patient_support", "/pii-shield", "dataset=patient_support&view=consent_gaps&highlight=CASE-5015", "CCO", "CCO", "Patient consent documentation within 7 days of case open", 7, "days", 14, "days", "BREACHED", "HIGH", 0.00, "Obtain consent documentation for CASE-5015. PHI present without consent. SLA breached — 7 days over.", 1),
        ("SLA-007", "GPC-011", "gpo_contracts", "/revenue", "tab=market-access&highlight=GPC-011", "Market Access", "Market Access Team", "Contract renewal initiated 30 days before expiry", 30, "days", 28, "days", "ON TRACK", None, 14000.00, "Initiate Premier renewal for TalisMann GPC-011. 2 days remaining in SLA window.", 0),
        ("SLA-008", "GPC-012", "gpo_contracts", "/revenue", "tab=market-access&highlight=GPC-012", "Market Access", "Market Access Team", "Contract renewal initiated 30 days before expiry", 30, "days", 28, "days", "ON TRACK", None, 13500.00, "Initiate Premier renewal for StimTrial GPC-012. 2 days remaining in SLA window.", 0),
        ("SLA-009", "CHB-003", "chargeback_disputes", "/revenue", "tab=market-access&highlight=CHB-003", "Market Access", "Market Access Team", "Chargeback dispute filed before expiry date", 90, "days", 12, "days", "AT RISK", "HIGH", 1200.00, "File CHB-003 StimRouter dispute before 12-day expiry. Validate HealthTrust membership FIRST.", 0),
        ("SLA-010", "ALT-017", "alerts_queue", "/profiler", "dataset=sales_orders&filter=ghost_rep", "Commercial Ops", "Linda Torres", "Ghost rep resolution within 48 hours of detection", 48, "hours", 96, "hours", "BREACHED", "HIGH", 6800.00, "Identify GHOST-REP-99. Re-attribute ORD-025 to ORD-028. Adjust commission. 48 hours over SLA.", 1),
    ]
    conn.executemany("INSERT INTO sla_tickets VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def seed_onboarding_queue(conn):
    rows = [
        ("ONB-001", "CUST-1021", "Cary Orthopedic Group", "Health System", "Cary", "NC", 72, 1, "Finance", "Credit limit approval pending — no response after 2 follow-ups", 85000.00, "REP-01", "Escalate credit approval to Finance Director. Customer is 501(c)(3) hospital — expedited process available."),
        ("ONB-002", "CUST-1022", "Apex Orthopedic Partners", "Orthopedic Practice", "Apex", "NC", 96, 1, "MDM", "Duplicate NPI detected — NPI 4567832106 matches existing record", 62000.00, "REP-03", "Resolve NPI conflict in DOCTORS_MASTER before activating account. Run NPI crosswalk with NC Medical Board."),
        ("ONB-003", "CUST-1023", "Morrisville Spine Center", "Spine Center", "Morrisville", "NC", 120, 1, "Tax", "Missing tax exemption certificate — no 501(c)(3) documentation", 71000.00, "REP-03", "Request tax exemption certificate from applicant. Route to Tax & Compliance for review."),
        ("ONB-004", "CUST-1024", "Knightdale Pain Clinic", "Pain Management Clinic", "Knightdale", "NC", 51, 1, "Commercial Ops", "Territory assignment disputed — overlaps REP-01 and REP-03 coverage area", 44000.00, "REP-01", "Resolve territory assignment with Sales Leadership before activation."),
        ("ONB-005", "CUST-1025", "Garner Medical Distribution", "Distributor", "Garner", "NC", 168, 1, "Market Access", "GPO membership unverified — claims HealthTrust Tier1 but roster check pending", 120000.00, "REP-04", "Validate HealthTrust membership before assigning GPO tier. LONGEST stall at 168 hours."),
        ("ONB-006", "CUST-1029", "Apex Orthopedics", "Health System", "Durham", "NC", 144, 1, "Finance", "Credit application incomplete — missing 3 required financial documents", 95000.00, "REP-02", "Ping Finance dept: 3 missing documents from applicant. Application at risk of expiry."),
        ("ONB-007", "CUST-1030", "Pinecrest Spine Institute", "Spine Center", "Cary", "NC", 192, 1, "MDM", "Account already exists as CUST-1028 East Center — possible duplicate submission", 78000.00, "REP-08", "Compare with CUST-1028 before activating. May be duplicate onboarding — longest stall 192 hours."),
        ("ONB-008", "CUST-1031", "Triangle Medical Associates", "Orthopedic Practice", "Chapel Hill", "NC", 36, 0, None, "On track — all documents received, processing within normal window", 55000.00, "REP-03", "No action required. Expected activation within 12 hours."),
    ]
    conn.executemany("INSERT INTO onboarding_queue VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def seed_dso_analysis(conn):
    rows = [
        ("DSO-001", "ORD-009", "CUST-9901", "Unknown Customer (Orphan)", "DUROLANE 3mL", 850, "PO", 42, 30, 12, "Orphan customer — no billing contact in master", 850, "Cannot send invoice to orphan customer. Create customer master record to unblock collection."),
        ("DSO-002", "ORD-010", "CUST-9902", "Unknown Customer (Orphan)", "StimRouter", 12000, "PO", 42, 30, 12, "Orphan customer — no billing contact in master", 12000, "Cannot collect $12,000 without valid customer record. Highest DSO risk item."),
        ("DSO-003", "ORD-011", "CUST-9903", "Unknown Customer (Orphan)", "DUROLANE 3mL", 850, "PO", 42, 30, 12, "Orphan customer — no billing contact in master", 850, "Restore customer master record to enable invoicing."),
        ("DSO-004", "ORD-012", "CUST-9904", "Unknown Customer (Orphan)", "StimRouter", 12000, "PO", 42, 30, 12, "Orphan customer — no billing contact in master", 12000, "$12,000 blocked. Second-largest DSO risk item after DSO-002."),
        ("DSO-005", "ORD-027", "CUST-1016", "Inactive One", "DUROLANE 3mL", 1700, "Net30", 35, 30, 5, "Inactive account — collection process uncertain", 1700, "Account marked Inactive. Confirm collection status with Finance. May require write-off process."),
        ("DSO-006", "ORD-028", "CUST-1017", "Inactive Two", "DUROLANE 3mL", 1700, "Net30", 35, 30, 5, "Inactive account — collection process uncertain", 1700, "Inactive account DSO risk. Confirm with Finance whether to collect or write off."),
    ]
    conn.executemany("INSERT INTO dso_analysis VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def export_to_csv(conn):
    for table in [
        "customer_master",
        "product_catalog",
        "sales_orders",
        "patient_support",
        "master_conflicts",
        "customer_hierarchy",
        "gpo_contracts",
        "alerts_queue",
        "tax_exemption_certs",
        "tax_jurisdiction_issues",
        "pricing_issues",
        "data_steward_issues",
        "territory_alignment",
        "chargeback_disputes",
        "sla_tickets",
        "onboarding_queue",
        "dso_analysis",
    ]:
        c = conn.execute(f"SELECT * FROM {table}")
        path = CSV_DIR / f"{table}.csv"
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow([d[0] for d in c.description])
            w.writerows(c.fetchall())


def main():
    conn = sqlite3.connect(DB_PATH)
    try:
        create_tables(conn)
        seed_product_catalog(conn)
        seed_customer_master(conn)
        seed_sales_orders(conn)
        seed_patient_support(conn)
        seed_master_conflicts(conn)
        seed_commercial_tables(conn)
        seed_tax_workflow_customers(conn)
        patch_tax_workflow_sales_orders(conn)
        seed_territory_alignment(conn)
        seed_chargeback_disputes(conn)
        seed_sla_tickets(conn)
        seed_onboarding_queue(conn)
        seed_dso_analysis(conn)
        export_to_csv(conn)
        conn.commit()
    finally:
        conn.close()
    print("Seed complete. Database:", DB_PATH)


if __name__ == "__main__":
    main()
