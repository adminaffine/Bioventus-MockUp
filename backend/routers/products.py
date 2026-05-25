import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from services import startup_cache

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/list")
def product_list():
    if startup_cache.is_ready():
        cached = startup_cache.get_cached_commercial("products_list")
        if cached:
            return cached
    if not DB_PATH.exists():
        return []
    today = datetime.now(timezone.utc).date()
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute(
            "SELECT product_id, product_name, product_category, device_class, "
            "fda_clearance_number, fda_clearance_date, recall_status, expiry_date, "
            "manufacturer, hcpcs_code FROM product_catalog ORDER BY product_id"
        )
        out = []
        for row in c.fetchall():
            (
                product_id,
                product_name,
                product_category,
                device_class,
                fda_clearance_number,
                fda_clearance_date,
                recall_status,
                expiry_date,
                manufacturer,
                hcpcs_code,
            ) = row
            dq_flags = []
            if not fda_clearance_number:
                dq_flags.append("Missing FDA Clearance")
            if not device_class:
                dq_flags.append("Missing Device Classification")
            if recall_status == "RECALLED":
                dq_flags.append("⚠ RECALLED")
            if expiry_date:
                try:
                    exp = datetime.strptime(str(expiry_date)[:10], "%Y-%m-%d").date()
                    if exp < today and recall_status is None:
                        dq_flags.append("Expired — No Recall Flag")
                except Exception:
                    pass
            if not hcpcs_code:
                dq_flags.append("Missing HCPCS Code")
            out.append(
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "product_category": product_category,
                    "device_class": device_class,
                    "fda_clearance_number": fda_clearance_number,
                    "fda_clearance_date": fda_clearance_date,
                    "recall_status": recall_status,
                    "expiry_date": expiry_date,
                    "manufacturer": manufacturer,
                    "hcpcs_code": hcpcs_code,
                    "dq_flags": dq_flags,
                }
            )
        return out
    finally:
        conn.close()
