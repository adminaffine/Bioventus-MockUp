"""
Data Integrity API: full scan, per-category endpoints, trust scores, schema drift.
"""
from fastapi import APIRouter, Query

from services import startup_cache
from services.integrity_engine import (
    run_full_scan,
    compute_trust_scores,
    detect_schema_drift,
    _get_conn,
    DB_PATH,
)

router = APIRouter(prefix="/api/integrity", tags=["integrity"])


def _get_scan():
    """Return cached scan when ready, else run full scan."""
    if startup_cache.is_ready():
        return startup_cache.get_cached_integrity_scan() or run_full_scan()
    return run_full_scan()


@router.get("/summary")
def integrity_summary():
    """Full integrity scan: all categories, total violations, trust scores. From cache when ready."""
    return _get_scan()


@router.get("/referential")
def integrity_referential():
    """Referential integrity. From cache when ready."""
    scan = _get_scan()
    if scan.get("error"):
        return scan
    return {"referential": scan.get("referential", []), "summary": scan.get("summary", {})}


@router.get("/entity")
def integrity_entity():
    """Entity integrity. From cache when ready."""
    scan = _get_scan()
    if scan.get("error"):
        return scan
    return {"entity": scan.get("entity", {}), "summary": scan.get("summary", {})}


@router.get("/domain")
def integrity_domain():
    """Domain integrity. From cache when ready."""
    scan = _get_scan()
    if scan.get("error"):
        return scan
    return {"domain": scan.get("domain", []), "summary": scan.get("summary", {})}


@router.get("/temporal")
def integrity_temporal():
    """Temporal integrity. From cache when ready."""
    scan = _get_scan()
    if scan.get("error"):
        return scan
    return {"temporal": scan.get("temporal", []), "summary": scan.get("summary", {})}


@router.get("/consistency")
def integrity_consistency():
    """Cross-system consistency. From cache when ready."""
    scan = _get_scan()
    if scan.get("error"):
        return scan
    return {"consistency": scan.get("consistency", {}), "summary": scan.get("summary", {})}


@router.get("/schema-drift")
def integrity_schema_drift(
    dataset_name: str = Query(..., description="Dataset name (e.g. customer_master)"),
    columns: str = Query(..., description="Comma-separated list of uploaded column names"),
):
    """Detect schema drift for an upload vs baseline (renames, removed/added columns)."""
    cols = [c.strip() for c in columns.split(",") if c.strip()]
    return detect_schema_drift(dataset_name, cols)


@router.get("/trust-scores")
def integrity_trust_scores():
    """Trust scores (0-100) per dataset and enterprise. From cache when ready."""
    if startup_cache.is_ready():
        trust = (startup_cache.get_cached_integrity_scan() or {}).get("trust_scores")
        if trust:
            return trust
    if not DB_PATH.exists():
        return {"customer_master": 0, "sales_orders": 0, "patient_support": 0, "product_catalog": 0, "enterprise_score": 0, "by_dimension": {}}
    conn = _get_conn()
    try:
        return compute_trust_scores(conn)
    finally:
        conn.close()
