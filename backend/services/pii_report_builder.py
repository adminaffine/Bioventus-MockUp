"""
Build regulation-focused reports from PII audit/summary data.
"""
import sys
from pathlib import Path
from typing import Any, Dict, List

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))
from data.pii_patterns import MASKING_STRATEGIES, REGULATIONS_BY_TYPE


def build_regulation_coverage(
    by_pii_type: Dict[str, Dict],
    by_regulation: Dict[str, Dict],
) -> List[Dict[str, Any]]:
    """
    For each regulation (HIPAA, PCI-DSS, GDPR, CCPA, SOX), return:
    fields governed, instance count, coverage %, masking strategy per field type.
    """
    regulations = ["HIPAA", "PCI-DSS", "GDPR", "CCPA", "SOX"]
    result = []
    for reg in regulations:
        info = by_regulation.get(reg, {"fields": 0, "instances": 0, "coverage": "100%"})
        # Which PII types map to this regulation
        governed_types = [t for t, regs in REGULATIONS_BY_TYPE.items() if reg in regs]
        strategies = {t: MASKING_STRATEGIES.get(t, "full_mask") for t in governed_types}
        result.append({
            "regulation": reg,
            "fields_governed": info.get("fields", 0),
            "instances": info.get("instances", 0),
            "coverage": info.get("coverage", "100%"),
            "governed_pii_types": governed_types,
            "masking_by_type": strategies,
        })
    return result


def build_dataset_report(
    dataset_name: str,
    audit: Dict[str, Any],
    field_pii_map: Dict[str, str],
) -> Dict[str, Any]:
    """Full PII report for one dataset: field-level map, counts, strategies, regulation tags."""
    by_type = audit.get("by_pii_type", {})
    by_reg = audit.get("by_regulation", {})
    field_details = []
    for col, pii_type in field_pii_map.items():
        type_info = by_type.get(pii_type, {})
        from data.pii_patterns import REGULATIONS_BY_TYPE
        regs = REGULATIONS_BY_TYPE.get(pii_type, [])
        field_details.append({
            "field": col,
            "pii_type": pii_type,
            "instance_count": type_info.get("count", 0),
            "masking_strategy": MASKING_STRATEGIES.get(pii_type, "full_mask"),
            "regulations": regs,
        })
    return {
        "dataset_name": dataset_name,
        "total_records": audit.get("total_records", 0),
        "pii_fields_detected": audit.get("pii_fields_detected", 0),
        "pii_instances_total": audit.get("pii_instances_total", 0),
        "records_containing_pii": audit.get("records_containing_pii", 0),
        "records_clean": audit.get("records_clean", 0),
        "by_pii_type": by_type,
        "by_regulation": by_reg,
        "field_details": field_details,
        "masking_completeness": audit.get("masking_completeness", "100%"),
        "processed_at": audit.get("processed_at"),
    }
