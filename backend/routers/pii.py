"""
PII Shield API: summary, dataset report, preview (side-by-side), scan, audit log, export, regulations coverage.
"""
import csv
import io
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
import time

from services.pii_engine import PIIEngine, redact_unstructured_text
from services.pii_audit_logger import append_entries, get_log, get_all_entries
from services.pii_report_builder import build_regulation_coverage, build_dataset_report
from data.pii_patterns import get_column_pii_type, MASKING_STRATEGIES

router = APIRouter(prefix="/api/pii", tags=["pii"])

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"

STATIC_DATASETS = ["customer_master", "sales_orders", "patient_support", "product_catalog"]
PREVIEW_ROW_LIMIT = 20

# When showing HIPAA consent-gap slice, surface compliance fields first (not PII-tagged; easy to miss in wide tables).
_HIPAA_GAP_LEAD_KEYS = ("case_id", "patient_id", "phi_data_present", "consent_obtained")


def _row_keys_hipaa_gap_narrative(row: Dict[str, Any]) -> Dict[str, Any]:
    """Put PHI/consent driver columns first so the preview explains why each row is in the slice."""
    ordered: Dict[str, Any] = {}
    for k in _HIPAA_GAP_LEAD_KEYS:
        if k in row:
            ordered[k] = row[k]
    for k, v in row.items():
        if k not in ordered:
            ordered[k] = v
    return ordered


def _get_conn():
    return sqlite3.connect(DB_PATH)


def _table_to_rows(table_name: str) -> List[Dict[str, Any]]:
    """Load a table from SQLite as list of dicts."""
    conn = _get_conn()
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(f"SELECT * FROM [{table_name}]")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ---------- Summary aggregation & caching ----------

# Simple in-memory cache for PII summary to avoid re-scanning all datasets
_SUMMARY_CACHE: Dict[str, Any] | None = None
_SUMMARY_CACHE_TS: float | None = None
SUMMARY_CACHE_TTL_SECONDS = 60


def _run_scan_on_rows(rows: List[Dict], dataset_name: str) -> tuple:
    """Run PII engine on rows; return (masked_rows, audit, findings)."""
    engine = PIIEngine()
    masked, audit, findings = engine.scan_and_mask_dataset(rows, dataset_name)
    return masked, audit, findings


def _aggregate_summary(append_to_audit_log: bool = False) -> Dict[str, Any]:
    """Run PII scan on all static datasets and aggregate summary. Optionally append to audit log."""
    engine = PIIEngine()
    total_instances = 0
    total_by_type: Dict[str, int] = {}
    total_by_reg: Dict[str, Dict] = {}
    records_affected = 0
    all_audits = []
    for name in STATIC_DATASETS:
        if not DB_PATH.exists():
            continue
        try:
            rows = _table_to_rows(name)
        except Exception:
            continue
        if not rows:
            continue
        masked, audit, findings = engine.scan_and_mask_dataset(rows, name)
        if append_to_audit_log:
            append_entries(findings, name, audit.get("audit_id", ""))
        all_audits.append(audit)
        total_instances += audit.get("pii_instances_total", 0)
        records_affected += audit.get("records_containing_pii", 0)
        for t, info in audit.get("by_pii_type", {}).items():
            total_by_type[t] = total_by_type.get(t, 0) + info.get("count", 0)
        for reg, info in audit.get("by_regulation", {}).items():
            if reg not in total_by_reg:
                total_by_reg[reg] = {"fields": 0, "instances": 0}
            total_by_reg[reg]["fields"] += info.get("fields", 0)
            total_by_reg[reg]["instances"] += info.get("instances", 0)
    pii_types_count = len(total_by_type)
    regs_met = len(total_by_reg)
    total_records = sum(a.get("total_records", 0) for a in all_audits)
    masking_pct = "100%" if total_instances else "0%"
    return {
        "total_pii_instances": total_instances,
        "pii_types_detected": pii_types_count,
        "masking_coverage_pct": masking_pct,
        "regulations_covered": regs_met,
        "records_containing_pii": records_affected,
        "total_records_scanned": total_records,
        "by_pii_type": total_by_type,
        "by_regulation": total_by_reg,
        "datasets": [a.get("dataset_name") for a in all_audits],
    }


def _get_summary_cached() -> Dict[str, Any]:
    """
    Return cached PII summary if within TTL; otherwise recompute and refresh cache.
    Also ensures the audit log is seeded once when empty.
    """
    global _SUMMARY_CACHE, _SUMMARY_CACHE_TS
    now = time.time()
    if _SUMMARY_CACHE is not None and _SUMMARY_CACHE_TS is not None:
        if now - _SUMMARY_CACHE_TS < SUMMARY_CACHE_TTL_SECONDS:
            return _SUMMARY_CACHE

    if not DB_PATH.exists():
        summary: Dict[str, Any] = {
            "total_pii_instances": 0,
            "pii_types_detected": 0,
            "masking_coverage_pct": "0%",
            "regulations_covered": 0,
            "records_containing_pii": 0,
            "total_records_scanned": 0,
            "by_pii_type": {},
            "by_regulation": {},
            "datasets": [],
        }
        _SUMMARY_CACHE = summary
        _SUMMARY_CACHE_TS = now
        return summary

    # Seed audit log once if empty so the log has initial entries
    if not get_all_entries():
        _aggregate_summary(append_to_audit_log=True)

    summary = _aggregate_summary(append_to_audit_log=False)
    _SUMMARY_CACHE = summary
    _SUMMARY_CACHE_TS = now
    return summary


@router.get("/summary")
def pii_summary():
    """Aggregate PII stats across all static datasets."""
    return _get_summary_cached()


@router.get("/dataset/{dataset_name}")
def pii_dataset_report(dataset_name: str):
    """Full PII report for one dataset: field-level map, instance counts, masking strategy, regulation tags."""
    if dataset_name not in STATIC_DATASETS:
        raise HTTPException(status_code=404, detail=f"Unknown dataset: {dataset_name}")
    rows = _table_to_rows(dataset_name)
    if not rows:
        raise HTTPException(status_code=404, detail="Dataset empty")
    masked, audit, _ = _run_scan_on_rows(rows, dataset_name)
    engine = PIIEngine()
    col_map = engine.build_column_pii_map(list(rows[0].keys()))
    field_pii_map = {c: t for c, t in col_map.items() if not c.startswith("_") and c in rows[0]}
    report = build_dataset_report(dataset_name, audit, field_pii_map)
    return report


@router.get("/dataset/{dataset_name}/preview")
def pii_dataset_preview(
    dataset_name: str,
    filter: Optional[str] = Query(
        None,
        description="Optional slice. hipaa_consent_gaps = patient_support rows with PHI and missing consent (max 50 rows scanned).",
    ),
):
    """Side-by-side: original (raw) vs masked sample of 20 rows (or filtered slice for consent-gap narrative)."""
    if dataset_name not in STATIC_DATASETS:
        raise HTTPException(status_code=404, detail=f"Unknown dataset: {dataset_name}")
    rows = _table_to_rows(dataset_name)
    if not rows:
        raise HTTPException(status_code=404, detail="Dataset empty")
    filter_norm = (filter or "").strip().lower()
    if filter_norm:
        if filter_norm != "hipaa_consent_gaps":
            raise HTTPException(status_code=400, detail=f"Unsupported filter: {filter}")
        if dataset_name != "patient_support":
            raise HTTPException(
                status_code=400,
                detail="filter=hipaa_consent_gaps is only supported for dataset patient_support",
            )
        rows = [
            r
            for r in rows
            if r.get("phi_data_present") == 1 and (r.get("consent_obtained") is None or r.get("consent_obtained") == 0)
        ]
        if not rows:
            return {
                "dataset_name": dataset_name,
                "original": [],
                "masked": [],
                "pii_columns": [],
                "total_records": 0,
                "filter_applied": filter_norm,
                "empty_message": "No rows match PHI-present without documented consent for this dataset.",
            }
    sample = rows[:PREVIEW_ROW_LIMIT] if filter_norm != "hipaa_consent_gaps" else rows[: min(len(rows), 50)]
    masked, audit, findings = _run_scan_on_rows(sample, dataset_name)
    engine = PIIEngine()
    col_pii_map = engine.build_column_pii_map(list(rows[0].keys()))
    # Build row-by-row for frontend: { original: {...}, masked: {...}, pii_columns: [...] }
    pii_columns = [c for c in sample[0].keys() if get_column_pii_type(c)]
    # For treatment_notes (unstructured), redact inline
    unstructured_cols = ["treatment_notes"]
    for i, row in enumerate(sample):
        for uc in unstructured_cols:
            if uc in row and row.get(uc):
                masked[i][uc] = redact_unstructured_text(str(row[uc]))
    if filter_norm == "hipaa_consent_gaps":
        sample = [_row_keys_hipaa_gap_narrative(dict(r)) for r in sample]
        masked = [_row_keys_hipaa_gap_narrative(dict(r)) for r in masked]
        pii_columns = [c for c in sample[0].keys() if get_column_pii_type(c)] if sample else pii_columns
    out = {
        "dataset_name": dataset_name,
        "original": sample,
        "masked": masked,
        "pii_columns": pii_columns,
        "total_records": len(sample),
    }
    if filter_norm:
        out["filter_applied"] = filter_norm
    if filter_norm == "hipaa_consent_gaps":
        out["hipaa_gap_driver_columns"] = ["phi_data_present", "consent_obtained"]
    return out


# In-memory cache for upload-session PII results so PII Shield can show "your uploaded data"
_UPLOAD_SCAN_CACHE: Dict[str, Dict[str, Any]] = {}
_UPLOAD_SCAN_CACHE_TS: Dict[str, float] = {}
UPLOAD_SCAN_CACHE_TTL = 3600  # 1 hour


def _build_by_pii_type_counts(audit: Dict[str, Any]) -> Dict[str, int]:
    """Flatten audit by_pii_type to { type: count } for summary."""
    out: Dict[str, int] = {}
    for t, info in audit.get("by_pii_type", {}).items():
        out[t] = info.get("count", 0) if isinstance(info, dict) else int(info)
    return out


@router.post("/scan")
async def pii_scan(file: Optional[UploadFile] = File(None), session_id: Optional[str] = Query(None)):
    """
    Run full PII scan. Either upload a CSV file or pass session_id to scan an upload session.
    Returns complete PII report.
    """
    if file:
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="File must be a .csv")
        content = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8", encoding_errors="replace")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")
        if df.empty:
            raise HTTPException(status_code=400, detail="CSV is empty")
        rows = df.to_dict("records")
        dataset_name = (file.filename or "uploaded").replace(".csv", "")
    elif session_id:
        path = UPLOADS_DIR / f"session_{session_id}"
        meta_file = path / "session_meta.json"
        if not path.is_dir() or not meta_file.exists():
            raise HTTPException(status_code=404, detail="Session not found")
        with open(meta_file, encoding="utf-8") as f:
            meta = json.load(f)
        files = meta.get("files", [])
        if not files:
            raise HTTPException(status_code=400, detail="Session has no files")
        # Load first CSV in session (or aggregate - spec says "run PII scan on uploaded files")
        first_file = files[0].get("filename") or "upload.csv"
        csv_path = path / first_file
        if not csv_path.exists():
            raise HTTPException(status_code=404, detail="Session CSV not found")
        df = pd.read_csv(csv_path, encoding="utf-8", encoding_errors="replace")
        rows = df.to_dict("records")
        dataset_name = first_file.replace(".csv", "")
    else:
        raise HTTPException(status_code=400, detail="Provide either file or session_id")
    engine = PIIEngine()
    masked, audit, findings = engine.scan_and_mask_dataset(rows, dataset_name)
    append_entries(findings, dataset_name, audit.get("audit_id", ""))

    # Cache result for upload sessions so PII Shield can show "your uploaded data"
    if session_id and rows:
        sample = rows[:PREVIEW_ROW_LIMIT]
        sample_masked = masked[:PREVIEW_ROW_LIMIT]
        pii_columns = [c for c in sample[0].keys() if get_column_pii_type(c)]
        for i, row in enumerate(sample):
            if "treatment_notes" in row and row.get("treatment_notes"):
                sample_masked[i]["treatment_notes"] = redact_unstructured_text(str(row["treatment_notes"]))
        _UPLOAD_SCAN_CACHE[session_id] = {
            "summary": {
                "total_pii_instances": audit.get("pii_instances_total", 0),
                "pii_types_detected": len(audit.get("by_pii_type", {})),
                "pii_fields_detected": audit.get("pii_fields_detected", 0),
                "masked_row_count": len(masked),
                "records_containing_pii": audit.get("records_containing_pii", 0),
                "by_pii_type": _build_by_pii_type_counts(audit),
                "datasets": [dataset_name],
            },
            "preview": {
                "dataset_name": dataset_name,
                "original": sample,
                "masked": sample_masked,
                "pii_columns": pii_columns,
                "total_records": len(sample),
            },
        }
        _UPLOAD_SCAN_CACHE_TS[session_id] = time.time()

    return {
        "report": audit,
        "masked_row_count": len(masked),
        "pii_instances": audit.get("pii_instances_total", 0),
        "pii_fields": audit.get("pii_fields_detected", 0),
    }


@router.get("/upload-session/{session_id}")
def pii_upload_session_result(session_id: str):
    """
    Return cached PII scan result for an upload session so PII Shield can show
    the uploaded file's summary and preview (original vs masked). Returns 404 if
    not found or cache expired.
    """
    now = time.time()
    if session_id in _UPLOAD_SCAN_CACHE:
        if now - _UPLOAD_SCAN_CACHE_TS.get(session_id, 0) < UPLOAD_SCAN_CACHE_TTL:
            return _UPLOAD_SCAN_CACHE[session_id]
        # Expired
        del _UPLOAD_SCAN_CACHE[session_id]
        if session_id in _UPLOAD_SCAN_CACHE_TS:
            del _UPLOAD_SCAN_CACHE_TS[session_id]
    raise HTTPException(status_code=404, detail="Upload session PII result not found or expired. Run PII scan from Upload & Analyze first.")


@router.get("/audit-log")
def pii_audit_log(
    dataset_name: Optional[str] = None,
    pii_type: Optional[str] = None,
    regulation: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 200,
):
    """Chronological audit log of PII scans; filter by dataset, PII type, regulation, severity."""
    entries = get_log(dataset_name=dataset_name, pii_type=pii_type, regulation=regulation, severity=severity, limit=limit)
    return {"entries": entries, "count": len(entries)}


@router.get("/export/{dataset_name}")
def pii_export(dataset_name: str):
    """Download the MASKED version of the dataset as CSV."""
    if dataset_name not in STATIC_DATASETS:
        raise HTTPException(status_code=404, detail=f"Unknown dataset: {dataset_name}")
    try:
        rows = _table_to_rows(dataset_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e!s}")
    if not rows:
        raise HTTPException(status_code=404, detail="Dataset empty")
    try:
        _, masked, _ = _run_scan_on_rows(rows, dataset_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PII scan failed: {e!s}")
    # Coerce all values to strings for CSV (handles int, float, None, bytes from SQLite)
    def _row_to_str(d: Dict[str, Any]) -> Dict[str, str]:
        return {k: ("" if v is None else str(v)) for k, v in d.items()}
    masked_str = [_row_to_str(r) for r in masked]
    output = io.StringIO()
    if masked_str:
        fieldnames = list(masked_str[0].keys())
        w = csv.DictWriter(output, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(masked_str)
    csv_content = output.getvalue()
    return StreamingResponse(
        iter([csv_content.encode("utf-8")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={dataset_name}_masked.csv"},
    )


@router.get("/regulations/coverage")
def pii_regulations_coverage():
    """Per-regulation: which fields are compliant vs at-risk; coverage."""
    summary = _get_summary_cached() if DB_PATH.exists() else {}
    by_reg = summary.get("by_regulation", {})
    by_type_agg = summary.get("by_pii_type", {})
    coverage = build_regulation_coverage(by_type_agg, by_reg)
    return {"regulations": coverage}
