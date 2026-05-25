from fastapi import APIRouter, HTTPException
from services.quality_engine import get_quality_profile, PROFILERS
from services import startup_cache

router = APIRouter(prefix="/api", tags=["quality"])


@router.get("/datasets")
def list_datasets():
    """List all datasets with row counts."""
    import sqlite3
    from pathlib import Path
    DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"
    conn = sqlite3.connect(DB_PATH)
    try:
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [r[0] for r in c.fetchall()]
        result = []
        for t in tables:
            c.execute(f"SELECT COUNT(*) FROM [{t}]")
            result.append({"name": t, "row_count": c.fetchone()[0]})
        return result
    finally:
        conn.close()


@router.get("/quality/{dataset_name}")
def get_quality(dataset_name: str):
    """Full quality profile for a dataset. From startup cache when ready."""
    if dataset_name not in PROFILERS:
        raise HTTPException(status_code=404, detail=f"Unknown dataset: {dataset_name}")
    if startup_cache.is_ready():
        cached = startup_cache.get_cached_quality_profile(dataset_name)
        if cached:
            return cached
    return get_quality_profile(dataset_name)
