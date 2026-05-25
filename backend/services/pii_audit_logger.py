"""
In-memory PII audit log for demo. Append on each scan; filter by dataset, regulation, PII type, severity.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# In-memory store (persists for process lifetime)
_audit_entries: List[Dict[str, Any]] = []


def append_entries(entries: List[Dict[str, Any]], dataset_name: str, audit_id: str) -> None:
    """Append audit log rows from a scan. Each entry gets timestamp, dataset, audit_id."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    if not entries:
        return
    for e in entries:
        _audit_entries.append({
            "timestamp": now,
            "dataset_name": dataset_name,
            "audit_id": audit_id,
            "field": e.get("column", ""),
            "pii_type": e.get("pii_type", ""),
            "severity": e.get("sensitivity", ""),
            "regulation": ", ".join(e.get("regulations", [])),
            "action_taken": f"{e.get('strategy', 'full_mask')} applied",
            "status": "Protected",
        })


def get_log(
    dataset_name: Optional[str] = None,
    pii_type: Optional[str] = None,
    regulation: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    """Return chronological audit entries, most recent first, with optional filters."""
    out = list(_audit_entries)
    if dataset_name:
        out = [e for e in out if e.get("dataset_name") == dataset_name]
    if pii_type:
        out = [e for e in out if e.get("pii_type") == pii_type]
    if regulation:
        out = [e for e in out if regulation in (e.get("regulation") or "")]
    if severity:
        out = [e for e in out if e.get("severity") == severity]
    out.reverse()
    return out[:limit]


def get_all_entries() -> List[Dict[str, Any]]:
    """Return all entries (for export)."""
    return list(reversed(_audit_entries))
