from contextlib import asynccontextmanager
import os
from pathlib import Path
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv

from routers import quality, integration, compliance, ai_chat, upload, pii, governance, integrity, rx_integrity, capa, products, commercial
from services.quality_engine import get_quality_profile
from services import startup_cache

# Load .env from backend directory so it works regardless of cwd or Docker
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("SKIP_STARTUP_CACHE", "").lower() in {"1", "true", "yes"}:
        print("Skipping startup cache initialization (SKIP_STARTUP_CACHE set).")
        yield
        return
    print("Pre-computing analytics cache...")
    try:
        startup_cache.initialize()
        if startup_cache.is_ready():
            print("Cache ready — dashboard and summary endpoints will respond from cache.")
        else:
            print("Cache not ready (e.g. DB missing) — endpoints will compute on demand.")
    except Exception as e:
        print(f"Startup cache init failed: {e} — endpoints will compute on demand.")
    yield


app = FastAPI(title="Luminos Data Quality & Compliance Application API", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quality.router)
app.include_router(integration.router)
app.include_router(compliance.router)
app.include_router(ai_chat.router)
app.include_router(upload.router)
app.include_router(pii.router)
app.include_router(governance.router)
app.include_router(integrity.router)
app.include_router(rx_integrity.router)
app.include_router(capa.router)
app.include_router(products.router)
app.include_router(commercial.router, prefix="/api")


@app.get("/api/dashboard/summary")
def dashboard_summary(response: Response):
    """Executive KPIs: from startup cache when ready, else computed on demand."""
    response.headers["Cache-Control"] = "max-age=60, stale-while-revalidate=30"
    if startup_cache.is_ready():
        return startup_cache.get_dashboard_summary()
    from routers.integration import get_integration_gaps
    from services.integrity_engine import run_full_scan
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

    from services.compliance_mapper import get_compliance_heatmap
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
        enterprise_trust_score = (scan.get("trust_scores") or {}).get("enterprise_score")
    except Exception:
        pass

    return {
        "overall_data_quality_score": round(avg_score, 1),
        "total_issues_detected": total_issue_count,
        "critical_compliance_risks": critical,
        "cross_system_integration_gaps": integration_gaps,
        "traffic_light_by_dataset": traffic,
        "dataset_scores": [{"dataset": p.get("dataset"), "score": p.get("overall_score")} for p in profiles],
        "regulation_coverage": regulation_radar,
        "enterprise_trust_score": enterprise_trust_score,
        "integrity_violations": integrity_violations,
        "qmsr_alert": startup_cache.get_qmsr_alert(),
    }


@app.get("/api/trend/simulation")
def trend_simulation():
    """Simulated before/after remediation quality and compliance over 4 weeks. Uses cache when ready."""
    if startup_cache.is_ready():
        profiles = [startup_cache.get_cached_quality_profile(d) for d in ["customer_master", "sales_orders", "product_catalog", "patient_support"]]
        gaps_data = startup_cache.get_cached_integration_gaps()
    else:
        from routers.integration import get_integration_gaps
        profiles = [get_quality_profile(d) for d in ["customer_master", "sales_orders", "product_catalog", "patient_support"]]
        gaps_data = get_integration_gaps()
    current_avg = sum(p.get("overall_score", 0) for p in profiles) / 4 if profiles else 0
    total_issues = sum(sum(i.get("count", 0) for i in p.get("issues", [])) for p in profiles)
    integration_gaps = sum(e.get("orphaned_count", 0) for e in gaps_data.get("edges", []))

    # Simulate 4 weeks: week0=current, week4=improved
    weeks = [
        {"week": 0, "quality_score": round(current_avg, 1), "compliance_score": 72, "issues_remaining": total_issues},
        {"week": 1, "quality_score": round(current_avg + 4, 1), "compliance_score": 76, "issues_remaining": int(total_issues * 0.85)},
        {"week": 2, "quality_score": round(current_avg + 9, 1), "compliance_score": 82, "issues_remaining": int(total_issues * 0.6)},
        {"week": 3, "quality_score": round(current_avg + 14, 1), "compliance_score": 88, "issues_remaining": int(total_issues * 0.35)},
        {"week": 4, "quality_score": round(min(95, current_avg + 18), 1), "compliance_score": 94, "issues_remaining": int(total_issues * 0.1)},
    ]
    return {
        "current_quality_score": round(current_avg, 1),
        "projected_quality_score": round(min(95, current_avg + 18), 1),
        "estimated_records_fixed": total_issues - int(total_issues * 0.1),
        "compliance_risk_reduction_pct": round((1 - 0.1) * 100, 0),
        "integration_gaps_current": integration_gaps,
        "timeline": weeks,
    }
