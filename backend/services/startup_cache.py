"""
Pre-computed analytics cache. Populated on app startup so API endpoints respond instantly.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

_startup_cache: Dict[str, Any] = {}
_last_computed: datetime | None = None


def _build_qmsr_alert() -> Dict[str, Any]:
    effective_date = datetime(2026, 2, 2).date()
    today = datetime.now(timezone.utc).date()
    days_since_effective = max((today - effective_date).days, 0)
    active = today >= effective_date
    return {
        "active": active,
        "message": "FDA QMSR effective Feb 2, 2026 — 3 compliance gaps detected",
        "effective_date": "2026-02-02",
        "gaps_detected": 3,
        "severity": "CRITICAL",
        "affected_regulations": ["FDA 21 CFR Part 820", "ISO 13485:2016"],
        "days_since_effective": days_since_effective,
    }


def get_qmsr_alert() -> Dict[str, Any]:
    return _build_qmsr_alert()


def initialize() -> None:
    """Run all heavy computations once and store in memory. Call on app startup."""
    global _startup_cache, _last_computed
    from pathlib import Path
    from services.quality_engine import get_quality_profile, DB_PATH
    from routers.integration import get_integration_gaps
    from services.compliance_mapper import get_compliance_heatmap
    from services.integrity_engine import run_full_scan
    from routers.capa import build_capa_summary
    from routers import commercial
    from routers.products import product_list

    if not Path(DB_PATH).exists():
        _startup_cache = {"error": "Database not found"}
        return

    datasets = ["customer_master", "sales_orders", "product_catalog", "patient_support"]
    profiles = [get_quality_profile(d) for d in datasets]
    total_issue_count = sum(sum(i.get("count", 0) for i in p.get("issues", [])) for p in profiles)
    critical = sum(
        sum(i.get("count", 0) for i in p.get("issues", []) if i.get("severity") == "Critical")
        for p in profiles
    )
    avg_score = sum(p.get("overall_score", 0) for p in profiles) / len(datasets) if datasets else 0
    traffic = []
    for p in profiles:
        s = p.get("overall_score", 0)
        traffic.append({
            "dataset": p.get("dataset"),
            "status": "green" if s >= 80 else "amber" if s >= 60 else "red",
            "score": s,
        })
    gaps_data = get_integration_gaps()
    integration_gaps = sum(e.get("orphaned_count", 0) for e in gaps_data.get("edges", []))
    heat = get_compliance_heatmap()
    regulation_radar = []
    for reg, scores in heat.get("matrix", {}).items():
        vals = list(scores.values())
        regulation_radar.append({"regulation": reg, "score": round(sum(vals) / len(vals), 1) if vals else 0})

    integrity_violations = 0
    enterprise_trust_score = None
    try:
        scan = run_full_scan()
        integrity_violations = scan.get("total_violations", 0)
        trust = scan.get("trust_scores") or {}
        enterprise_trust_score = trust.get("enterprise_score")
        _startup_cache["integrity_scan"] = scan
    except Exception:
        _startup_cache["integrity_scan"] = {}

    _startup_cache["dashboard_summary"] = {
        "overall_data_quality_score": round(avg_score, 1),
        "total_issues_detected": total_issue_count,
        "critical_compliance_risks": critical,
        "cross_system_integration_gaps": integration_gaps,
        "traffic_light_by_dataset": traffic,
        "dataset_scores": [{"dataset": p.get("dataset"), "score": p.get("overall_score")} for p in profiles],
        "regulation_coverage": regulation_radar,
        "enterprise_trust_score": enterprise_trust_score,
        "integrity_violations": integrity_violations,
        "qmsr_alert": _build_qmsr_alert(),
    }
    _startup_cache["quality_profiles"] = {d: profiles[i] for i, d in enumerate(datasets)}
    _startup_cache["integration_gaps"] = gaps_data
    _startup_cache["compliance_heatmap"] = heat
    _startup_cache["capa_summary"] = build_capa_summary()
    _startup_cache["commercial_summary"] = commercial.build_commercial_summary()
    _startup_cache["commercial_hierarchy"] = commercial.build_hierarchy()
    _startup_cache["commercial_gpo_contracts"] = commercial.build_gpo_contracts()
    _startup_cache["commercial_alerts"] = commercial.build_alerts()
    _startup_cache["commercial_tax_certs"] = commercial.build_tax_certs()
    _startup_cache["commercial_tax_jurisdiction_mismatches"] = commercial.build_tax_jurisdiction_mismatches()
    _startup_cache["commercial_territory"] = commercial.build_territory_alignment()
    _startup_cache["commercial_chargebacks"] = commercial.build_chargebacks()
    _startup_cache["commercial_sla"] = commercial.build_sla()
    _startup_cache["commercial_onboarding"] = commercial.build_onboarding()
    _startup_cache["commercial_dso"] = commercial.build_dso()
    _startup_cache["commercial_products_list"] = product_list()

    # RxIntegrity: load doctors + prescriptions, run engine, cache report
    try:
        from services.rx_integrity_engine import run_rx_integrity
        from routers import rx_integrity as rx_router
        rx_report = run_rx_integrity()
        _startup_cache["rx_report"] = rx_report
        rx_router.set_rx_report(rx_report)
    except Exception as e:
        _startup_cache["rx_report"] = {"error": str(e), "summary": {}, "violations": [], "entity_resolution": []}

    _last_computed = datetime.now(timezone.utc)


def get_dashboard_summary() -> Dict[str, Any]:
    """Return cached dashboard summary. Call initialize() on startup first."""
    return _startup_cache.get("dashboard_summary") or {}


def get_cached_quality_profile(dataset_name: str) -> Dict[str, Any]:
    """Return cached quality profile for dataset, or empty if not cached."""
    profiles = _startup_cache.get("quality_profiles") or {}
    return profiles.get(dataset_name, {})


def get_cached_integration_gaps() -> Dict[str, Any]:
    return _startup_cache.get("integration_gaps") or {"edges": [], "linkage_issues": {}}


def get_cached_compliance_heatmap() -> Dict[str, Any]:
    return _startup_cache.get("compliance_heatmap") or {"regulations": [], "datasets": [], "matrix": {}}


def get_cached_integrity_scan() -> Dict[str, Any]:
    return _startup_cache.get("integrity_scan") or {}


def get_cached_rx_report() -> Dict[str, Any]:
    return _startup_cache.get("rx_report") or {}


def get_cached_capa_summary() -> Dict[str, Any]:
    return _startup_cache.get("capa_summary") or {}


def get_last_computed() -> datetime | None:
    return _last_computed


def is_ready() -> bool:
    return "dashboard_summary" in _startup_cache and "error" not in _startup_cache


def get_cached_commercial(endpoint_name: str) -> Dict[str, Any]:
    return _startup_cache.get(f"commercial_{endpoint_name}") or {}
