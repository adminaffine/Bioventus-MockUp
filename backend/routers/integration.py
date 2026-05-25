import sqlite3
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import csv
import io

from services import startup_cache

router = APIRouter(prefix="/api", tags=["integration"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"


def get_conn():
    return sqlite3.connect(DB_PATH)


def _compute_integration_gaps():
    """Cross-dataset referential integrity report (live computation)."""
    conn = get_conn()
    try:
        c = conn.cursor()
        c.execute("SELECT customer_id FROM customer_master")
        valid_cids = set(str(r[0]) for r in c.fetchall())
        c.execute("SELECT product_id FROM product_catalog")
        valid_pids = set(str(r[0]) for r in c.fetchall())

        # SALES_ORDERS -> CUSTOMER_MASTER
        c.execute("SELECT COUNT(*) FROM sales_orders")
        so_total = c.fetchone()[0]
        c.execute("SELECT customer_id, COUNT(*) FROM sales_orders GROUP BY customer_id")
        so_orphans = []
        so_total_orphan = 0
        for r in c.fetchall():
            if r[0] and str(r[0]) not in valid_cids:
                so_orphans.append({"customer_id": r[0], "order_count": r[1]})
                so_total_orphan += r[1]
        so_match = so_total - so_total_orphan
        so_match_pct = round(100 * so_match / so_total, 1) if so_total else 0

        # PATIENT_SUPPORT -> CUSTOMER_MASTER
        c.execute("SELECT COUNT(*) FROM patient_support")
        ps_total = c.fetchone()[0]
        c.execute("SELECT customer_id, COUNT(*) FROM patient_support GROUP BY customer_id")
        ps_cust_orphans = []
        ps_cust_total = 0
        for r in c.fetchall():
            if r[0] and str(r[0]) not in valid_cids:
                ps_cust_orphans.append({"customer_id": r[0], "case_count": r[1]})
                ps_cust_total += r[1]
        ps_cust_match = ps_total - ps_cust_total
        ps_cust_pct = round(100 * ps_cust_match / ps_total, 1) if ps_total else 0

        # PATIENT_SUPPORT -> PRODUCT_CATALOG
        c.execute("SELECT product_id, COUNT(*) FROM patient_support GROUP BY product_id")
        ps_prod_orphans = []
        ps_prod_total = 0
        for r in c.fetchall():
            if r[0] and str(r[0]) not in valid_pids:
                ps_prod_orphans.append({"product_id": r[0], "case_count": r[1]})
                ps_prod_total += r[1]
        ps_prod_match = ps_total - ps_prod_total
        ps_prod_pct = round(100 * ps_prod_match / ps_total, 1) if ps_total else 0

        edges = [
            {"from": "sales_orders", "to": "customer_master", "join_key": "customer_id", "match_rate": so_match_pct, "orphaned_count": so_total_orphan, "status": "green" if so_match_pct >= 95 else "amber" if so_match_pct >= 80 else "red"},
            {"from": "patient_support", "to": "customer_master", "join_key": "customer_id", "match_rate": ps_cust_pct, "orphaned_count": ps_cust_total, "status": "green" if ps_cust_pct >= 95 else "amber" if ps_cust_pct >= 80 else "red"},
            {"from": "patient_support", "to": "product_catalog", "join_key": "product_id", "match_rate": ps_prod_pct, "orphaned_count": ps_prod_total, "status": "green" if ps_prod_pct >= 95 else "amber" if ps_prod_pct >= 80 else "red"},
        ]

        return {
            "edges": edges,
            "linkage_issues": {
                "sales_orders_to_customer_master": {"orphaned_records": so_total_orphan, "match_rate_pct": so_match_pct, "sample_orphan_ids": [x["customer_id"] for x in so_orphans[:10]]},
                "patient_support_to_customer_master": {"orphaned_records": ps_cust_total, "match_rate_pct": ps_cust_pct, "sample_orphan_ids": [x["customer_id"] for x in ps_cust_orphans[:10]]},
                "patient_support_to_product_catalog": {"orphaned_records": ps_prod_total, "match_rate_pct": ps_prod_pct, "sample_orphan_ids": [x["product_id"] for x in ps_prod_orphans[:10]]},
            },
        }
    finally:
        conn.close()


@router.get("/integration/gaps")
def get_integration_gaps():
    """Cross-dataset referential integrity report. From startup cache when ready."""
    if startup_cache.is_ready():
        return startup_cache.get_cached_integration_gaps()
    return _compute_integration_gaps()


@router.get("/issues/export")
def export_issues_csv():
    """Download all issues as CSV."""
    from services.quality_engine import get_quality_profile
    rows = [["dataset", "issue_type", "column", "records_affected", "severity"]]
    for ds in ["customer_master", "sales_orders", "product_catalog", "patient_support"]:
        p = get_quality_profile(ds)
        for i in p.get("issues", []):
            rows.append([ds, i.get("type", ""), i.get("column", ""), i.get("count", 0), i.get("severity", "")])

    output = io.StringIO()
    w = csv.writer(output)
    w.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=integration_gap_issues.csv"},
    )
