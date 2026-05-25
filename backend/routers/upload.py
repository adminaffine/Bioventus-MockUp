"""
Upload CSV datasets, run dynamic DQ profiling and integration checks.
"""
import csv
import io
import json
import shutil
import uuid
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from services.dynamic_quality_engine import (
    detect_dataset_type,
    profile_dataframe,
    compute_integration_edges,
)


def _make_json_serializable(obj):
    """Convert numpy/pandas types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _make_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_json_serializable(i) for i in obj]
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _ensure_uploads_dir():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _cleanup_old_sessions(max_age_hours: int = 24):
    """Remove session directories older than max_age_hours."""
    _ensure_uploads_dir()
    now = datetime.utcnow()
    for path in UPLOADS_DIR.iterdir():
        if not path.is_dir() or not path.name.startswith("session_"):
            continue
        try:
            meta_file = path / "session_meta.json"
            if meta_file.exists():
                import json
                with open(meta_file, encoding="utf-8") as f:
                    meta = json.load(f)
                ts = meta.get("created_at")
                if ts:
                    created = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    if (now - created.replace(tzinfo=None)) > timedelta(hours=max_age_hours):
                        shutil.rmtree(path, ignore_errors=True)
            else:
                if (now - datetime.fromtimestamp(path.stat().st_mtime)) > timedelta(hours=max_age_hours):
                    shutil.rmtree(path, ignore_errors=True)
        except Exception:
            pass


def _validate_csv_file(file: UploadFile) -> None:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")
    # Size check is done by reading; we'll check after read


@router.post("/datasets")
async def upload_datasets(files: list[UploadFile] = File(...)):
    """
    Upload 1–4 CSV files. Auto-detect dataset type by filename.
    Validate: .csv, max 10MB, headers in row 1. Store in session_{uuid}, run DQ + integration.
    """
    if not files or len(files) > 4:
        raise HTTPException(status_code=400, detail="Upload 1 to 4 CSV files")
    for f in files:
        _validate_csv_file(f)

    _cleanup_old_sessions()
    _ensure_uploads_dir()
    session_id = str(uuid.uuid4())
    session_dir = UPLOADS_DIR / f"session_{session_id}"
    session_dir.mkdir(parents=True, exist_ok=True)

    uploaded: list[tuple[str, str, pd.DataFrame]] = []
    profiles: list[dict] = []
    file_meta: list[dict] = []

    for file in files:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds 10MB limit")
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8", encoding_errors="replace")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not parse CSV {file.filename}: {e}")
        if df.empty:
            raise HTTPException(status_code=400, detail=f"File {file.filename} appears empty")
        if list(df.columns)[0].startswith("Unnamed") or "" in df.columns:
            raise HTTPException(status_code=400, detail=f"No headers detected in row 1 for {file.filename}")

        dataset_type = detect_dataset_type(file.filename or "", list(df.columns))
        display_name = file.filename or "uploaded.csv"
        # Save CSV to session dir
        out_path = session_dir / (file.filename or "upload.csv")
        with open(out_path, "wb") as f:
            f.write(content)

        reference_ids = {}
        if dataset_type == "CUSTOMER_MASTER" and "customer_id" in df.columns:
            reference_ids["customer_id"] = set()
        if dataset_type == "PRODUCT_CATALOG" and "product_id" in df.columns:
            reference_ids["product_id"] = set()

        profile = profile_dataframe(df, dataset_type, display_name, reference_ids)
        profiles.append(profile)
        uploaded.append((dataset_type, display_name, df))
        file_meta.append({"filename": file.filename, "dataset_type": dataset_type, "rows": len(df)})

    # Build reference IDs for integration (from CUSTOMER_MASTER and PRODUCT_CATALOG)
    ref_customer_ids = set()
    ref_product_ids = set()
    for dtype, _, df in uploaded:
        if dtype == "CUSTOMER_MASTER" and "customer_id" in df.columns:
            ref_customer_ids.update(df["customer_id"].astype(str).dropna().str.strip())
        if dtype == "PRODUCT_CATALOG" and "product_id" in df.columns:
            ref_product_ids.update(df["product_id"].astype(str).dropna().str.strip())

    # Re-run profiles with reference IDs for orphan detection (for non-master files)
    profiles = []
    for dtype, display_name, df in uploaded:
        refs = {}
        if "customer_id" in df.columns:
            refs["customer_id"] = ref_customer_ids
        if "product_id" in df.columns:
            refs["product_id"] = ref_product_ids
        profile = profile_dataframe(df, dtype, display_name, refs if refs else None)
        profiles.append(profile)

    edges = []
    if len(uploaded) >= 2:
        edges = compute_integration_edges(uploaded)

    total_issues = sum(sum(i.get("count", 0) for i in p.get("issues", [])) for p in profiles)
    critical = sum(
        sum(i.get("count", 0) for i in p.get("issues", []) if i.get("severity") == "Critical")
        for p in profiles
    )
    integration_gaps = sum(e.get("orphaned_count", 0) for e in edges)
    avg_score = sum(p.get("overall_score", 0) for p in profiles) / len(profiles) if profiles else 0

    report = {
        "session_id": session_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "files": file_meta,
        "profiles": profiles,
        "integration_edges": edges,
        "summary": {
            "overall_data_quality_score": round(float(avg_score), 1),
            "total_issues_detected": int(total_issues),
            "critical_compliance_risks": int(critical),
            "cross_system_integration_gaps": int(integration_gaps),
        },
    }
    report = _make_json_serializable(report)

    meta_path = session_dir / "session_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report


@router.get("/sessions")
def list_sessions():
    """List all upload sessions with timestamps and file names."""
    _cleanup_old_sessions()
    _ensure_uploads_dir()
    import json
    sessions = []
    for path in sorted(UPLOADS_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not path.is_dir() or not path.name.startswith("session_"):
            continue
        session_id = path.name.replace("session_", "")
        meta_file = path / "session_meta.json"
        if not meta_file.exists():
            continue
        try:
            with open(meta_file, encoding="utf-8") as f:
                meta = json.load(f)
            summary = meta.get("summary", {})
            sessions.append({
                "session_id": session_id,
                "created_at": meta.get("created_at"),
                "files": meta.get("files", []),
                "overall_score": summary.get("overall_data_quality_score"),
                "issue_count": summary.get("total_issues_detected"),
            })
        except Exception:
            pass
    sessions.sort(key=lambda s: s.get("created_at") or "", reverse=True)
    return {"sessions": sessions[:20]}


@router.get("/session/{session_id}")
def get_session(session_id: str):
    """Retrieve full DQ + integration report for a session."""
    path = UPLOADS_DIR / f"session_{session_id}"
    meta_file = path / "session_meta.json"
    if not path.is_dir() or not meta_file.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    import json
    with open(meta_file, encoding="utf-8") as f:
        return json.load(f)


@router.get("/session/{session_id}/export")
def export_session_issues(session_id: str):
    """Download full issues report as CSV for the session."""
    path = UPLOADS_DIR / f"session_{session_id}"
    meta_file = path / "session_meta.json"
    if not path.is_dir() or not meta_file.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    import json
    with open(meta_file, encoding="utf-8") as f:
        meta = json.load(f)
    rows = [["dataset", "dataset_type", "issue_type", "column", "records_affected", "severity", "regulation"]]
    for p in meta.get("profiles", []):
        for i in p.get("issues", []):
            rows.append([
                p.get("dataset", ""),
                p.get("dataset_type", ""),
                i.get("type", ""),
                i.get("column", ""),
                i.get("count", 0),
                i.get("severity", ""),
                i.get("regulation", "") or "",
            ])
    output = io.StringIO()
    w = csv.writer(output)
    w.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=upload_issues_{session_id[:8]}.csv"},
    )


@router.delete("/session/{session_id}")
def delete_session(session_id: str):
    """Remove uploaded files and session data."""
    path = UPLOADS_DIR / f"session_{session_id}"
    if not path.is_dir():
        raise HTTPException(status_code=404, detail="Session not found")
    shutil.rmtree(path, ignore_errors=True)
    return {"status": "deleted", "session_id": session_id}
