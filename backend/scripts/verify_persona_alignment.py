"""Verify interlinked order_ids align across persona tables."""
import sqlite3
import sys
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"
LINKED_ORDERS = (
    "ORD-025", "ORD-028", "ORD-029", "ORD-031",
    "ORD-033", "ORD-034", "ORD-035", "ORD-036",
)
PH = ",".join("?" * len(LINKED_ORDERS))

TABLES = [
    ("sales_orders", "order_id", "customer_id", "total_amount"),
    ("tax_jurisdiction_issues", "order_id", "customer_id", "dollar_value"),
    ("vp_alerts", "order_id", "account_id", "dollar_exposure"),
    ("cfo_alerts", "order_id", "account_id", "dollar_exposure"),
    ("cco_compliance_issues", "order_id", "account_id", "penalty_exposure"),
    ("pricing_issues", "order_id", "customer_id", "dollar_value"),
]

STEWARD_CUSTOMERS = ("CUST-0892", "CUST-1087", "CUST-2011", "CUST-3042", "CUST-4019")


def fetch_by_order(conn, table, id_col, cust_col, amt_col):
    sql = f"SELECT {id_col} AS order_id, {cust_col} AS customer_id, {amt_col} AS amount FROM {table} WHERE {id_col} IN ({PH})"
    rows = {}
    for row in conn.execute(sql, LINKED_ORDERS):
        rows[row["order_id"]] = (row["customer_id"], float(row["amount"]))
    return rows


def main() -> int:
    if not DB.exists():
        print(f"Database not found: {DB}")
        return 1

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    errors: list[str] = []

    by_table = {table: fetch_by_order(conn, table, oid, cid, amt) for table, oid, cid, amt in TABLES}

    print("=== Linked order alignment ===")
    for order_id in LINKED_ORDERS:
        refs = []
        for name, data in by_table.items():
            if order_id in data:
                refs.append((name, data[order_id]))
        if not refs:
            continue
        cust_ids = {r[1][0] for r in refs}
        amounts = {r[1][1] for r in refs}
        print(f"{order_id}: customers={sorted(cust_ids)} amounts={sorted(amounts)}")
        if len(cust_ids) > 1:
            errors.append(f"{order_id}: customer_id mismatch across tables: {refs}")
        if len(amounts) > 1:
            errors.append(f"{order_id}: amount mismatch across tables: {refs}")

    print("\n=== Steward customer names ===")
    master = {
        r["customer_id"]: f"{r['first_name']} {r['last_name']}".strip()
        for r in conn.execute("SELECT customer_id, first_name, last_name FROM customer_master")
    }
    for row in conn.execute(
        "SELECT customer_id, customer_name FROM data_steward_issues WHERE customer_id IN ("
        + ",".join("?" * len(STEWARD_CUSTOMERS))
        + ")",
        STEWARD_CUSTOMERS,
    ):
        expected = master.get(row["customer_id"])
        print(f"{row['customer_id']}: steward={row['customer_name']!r} master={expected!r}")
        if expected and row["customer_name"] != expected:
            errors.append(
                f"Steward {row['customer_id']}: {row['customer_name']!r} != master {expected!r}"
            )

    print()
    if errors:
        print("FAILED — mismatches:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("OK — all linked records align.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
