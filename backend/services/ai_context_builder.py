"""
Build context string from DQ and compliance results for GPT-4o.
Supports both static (baseline) data and uploaded session data.
"""
import json
from pathlib import Path

from .quality_engine import get_quality_profile
from .compliance_mapper import get_compliance_heatmap

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


def build_context() -> str:
    """Full summary of all datasets and compliance for AI (static baseline)."""
    parts = [
        "You are an AI assistant for the BV (Bioventus) Command Center — a Data Quality &",
        "Compliance application for Bioventus LLC, a medical device company (Durham, NC).",
        "You have access to 5 datasets:",
        "1. CUSTOMER_MASTER (28 records) — Bioventus hospital/clinic/distributor customers",
        "2. PRODUCT_CATALOG (25 records) — Bioventus products: DUROLANE, GELSYN-3,",
        "   SUPARTZ FX, EXOGEN 4.0, StimRouter, TalisMann, StimTrial, neXus System, BGS products",
        "3. SALES_ORDERS (30 records) — product orders from customers with DQ issues",
        "4. PATIENT_SUPPORT (27 records) — patient adverse event and support cases,",
        "   including MDR gaps on EXOGEN 4.0 (recalled product)",
        "5. MASTER_CONFLICTS (15 records) — CRM vs ERP data conflicts",
        "Key regulatory context: FDA QMSR (21 CFR Part 820) effective Feb 2, 2026,",
        "FDA MDR reporting, HIPAA, EU MDR. Company has Class II and Class III devices.",
        "The most critical issue in the data: 4 EXOGEN 4.0 adverse event cases",
        "(CASE-5011 to CASE-5014) where the product was recalled but MDR was not submitted.",
        "",
        "# Data Quality & Compliance Summary (synthetic application data)\n",
    ]

    for name in ["customer_master", "sales_orders", "product_catalog", "patient_support"]:
        p = get_quality_profile(name)
        parts.append(f"## {name} (rows: {p.get('row_count', 0)})")
        parts.append(f"- Overall Data Quality Score: {p.get('overall_score', 0)}/100")
        parts.append(f"- Completeness overall: {p.get('completeness_overall', 0)}%")
        parts.append(f"- Validity: {p.get('validity_pct', 0)}%, Uniqueness: {p.get('uniqueness_pct', 0)}%, Consistency: {p.get('consistency_pct', 0)}%")
        issues = p.get("issues", [])
        if issues:
            parts.append("Issues:")
            for i in issues:
                parts.append(f"  - {i.get('type')} | {i.get('column')} | {i.get('count')} records | {i.get('severity')}")
        if p.get("mdr_gap_count"):
            parts.append(f"  - FDA MDR gap: {p['mdr_gap_count']} adverse events without MDR submitted")
        if p.get("hipaa_gap_count"):
            parts.append(f"  - HIPAA consent gap: {p['hipaa_gap_count']} records with PHI but no consent")
        if p.get("integration_orphans") is not None:
            parts.append(f"  - Orphan orders (customer_id not in customer_master): {p['integration_orphans']}")
        parts.append("")

    heat = get_compliance_heatmap()
    parts.append("# Compliance by Regulation (dataset scores %)")
    for reg, scores in heat.get("matrix", {}).items():
        parts.append(f"- {reg}: " + ", ".join(f"{d}={scores.get(d, 0)}%" for d in heat.get("datasets", [])))
    parts.append("")

    # RxIntegrity summary for AI (doctor/prescription quality, DEA, specialty mismatch, duplicate doctors)
    try:
        from .startup_cache import get_cached_rx_report
        rx = get_cached_rx_report()
        if rx and isinstance(rx, dict) and rx.get("summary"):
            s = rx["summary"]
            parts.append("# RxIntegrity — Doctor & Prescription Data Quality")
            parts.append(f"- Total doctors: {s.get('total_doctors', 0)}, Total prescriptions: {s.get('total_prescriptions', 0)}")
            parts.append(f"- Rx Trust Score: {s.get('rx_trust_score', 0)}/100 ({s.get('rx_trust_level', '')})")
            parts.append(f"- Critical violations: {s.get('critical_violations', 0)}")
            parts.append(f"- Specialty mismatches: {s.get('specialty_mismatches', 0)} (prescriptions linked to wrong specialty doctor)")
            parts.append(f"- DEA violations: {s.get('dea_violations', 0)}")
            parts.append(f"- License violations: {s.get('license_violations', 0)}")
            parts.append(f"- Ghost doctors (unregistered prescriber): {s.get('ghost_doctors', 0)}")
            parts.append(f"- Duplicate doctor clusters: {s.get('duplicate_doctor_clusters', 0)}")
            parts.append(f"- Misrouted prescriptions (wrong doctor due to duplicate name): {s.get('misrouted_prescriptions', 0)} — PATIENT SAFETY RISK")
            parts.append(f"- Patient safety flags: {s.get('patient_safety_flags', 0)}")
            parts.append("")
    except Exception:
        pass

    return "\n".join(parts)


def build_context_from_upload_session(session_id: str) -> str:
    """Build context from an upload session report (user's uploaded data)."""
    path = UPLOADS_DIR / f"session_{session_id}" / "session_meta.json"
    if not path.exists():
        return ""
    with open(path, encoding="utf-8") as f:
        meta = json.load(f)
    parts = ["# Data Quality & Compliance Summary — UPLOADED DATA (user's current dataset)\n"]
    parts.append("Answer questions ONLY about the following uploaded file(s). Do not refer to baseline or other datasets.\n")
    summary = meta.get("summary", {})
    parts.append(f"## Summary")
    parts.append(f"- Overall Data Quality Score: {summary.get('overall_data_quality_score', 0)}/100")
    parts.append(f"- Total issues detected: {summary.get('total_issues_detected', 0)}")
    parts.append(f"- Critical compliance risks: {summary.get('critical_compliance_risks', 0)}")
    parts.append(f"- Integration gaps: {summary.get('cross_system_integration_gaps', 0)}")
    parts.append("")
    for p in meta.get("profiles", []):
        name = p.get("dataset", "?")
        parts.append(f"## {name} (type: {p.get('dataset_type', '?')}, rows: {p.get('row_count', 0)})")
        parts.append(f"- Overall Data Quality Score: {p.get('overall_score', 0)}/100")
        parts.append(f"- Completeness overall: {p.get('completeness_overall', 0)}%")
        parts.append(f"- Validity: {p.get('validity_pct', 0)}%, Uniqueness: {p.get('uniqueness_pct', 0)}%, Consistency: {p.get('consistency_pct', 0)}%")
        issues = p.get("issues", [])
        if issues:
            parts.append("Issues:")
            for i in issues:
                parts.append(f"  - {i.get('type')} | {i.get('column')} | {i.get('count')} records | {i.get('severity')}")
        parts.append("")
    edges = meta.get("integration_edges", [])
    if edges:
        parts.append("# Integration (join keys)")
        for e in edges:
            parts.append(f"- {e.get('from')} → {e.get('to')}: {e.get('join_key')} — match rate {e.get('match_rate')}%, orphaned {e.get('orphaned_count')}")
        parts.append("")
    return "\n".join(parts)


def build_route_context(active_route: str | None = None) -> str:
    route = (active_route or "").strip()
    if not route:
        return "No active route provided."
    mapping = {
        "/": "Executive Dashboard: enterprise KPI, QMSR alert, critical compliance and integration risks.",
        "/profiler": "Data Quality Profiler: column-level completeness/validity/uniqueness/consistency and issue breakdown.",
        "/integration": "Integration & Lineage: cross-system linkage edges, orphan counts, match rates.",
        "/compliance": "Regulatory Compliance: regulation heatmap and detailed gap analysis.",
        "/trend": "DQ Trend Simulation: projected quality/compliance improvements over time.",
        "/pii-shield": "PII Shield: PHI/PII detection, masking coverage, regulation coverage.",
        "/governance": "Data Governance: trust scores, stewardship and policy issues.",
        "/rx-integrity": "RxIntegrity: doctor/prescription quality, DEA and specialty mismatch risks.",
        "/upload": "Upload & Analyze: user-uploaded session quality profiles and integration checks.",
        "/capa": "CAPA Tracker: corrective/preventive actions, owners, due dates, and statuses.",
        "/products": "Product Intelligence: product quality flags, recalls, FDA clearance metadata.",
        "/commercial": "Commercial Dashboard: at-risk revenue, COPQ, alerts, account-level impact.",
        "/hierarchy": "Customer Hierarchy: confidence score, orphan/conflict mapping, IQVIA deltas.",
        "/revenue": "Revenue & Risk: GPO conflicts, COPQ projection, tax mismatch exposure.",
        "/alerts": "Alert-to-Action: prioritized alerts, severity, impact, and prescribed actions.",
        "/application-guide": "Application Guide: scripted walk-through narrative and linked insights.",
    }
    return mapping.get(route, f"Active route {route}: use closest matching module context.")


def get_context_for_chat(upload_session_id: str | None = None, active_route: str | None = None) -> str:
    """Return context for AI: uploaded session if provided, else static baseline."""
    route_context = build_route_context(active_route)
    if upload_session_id and upload_session_id.strip():
        ctx = build_context_from_upload_session(upload_session_id.strip())
        if ctx:
            return f"# Active Screen Context\n- {route_context}\n\n{ctx}"
    return f"# Active Screen Context\n- {route_context}\n\n{build_context()}"
