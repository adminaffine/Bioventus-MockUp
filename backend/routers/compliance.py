from fastapi import APIRouter, HTTPException
from services.compliance_mapper import get_compliance_heatmap, get_regulation_detail, REGULATIONS
from services import startup_cache

router = APIRouter(prefix="/api", tags=["compliance"])


@router.get("/compliance/heatmap")
def compliance_heatmap():
    """Regulation x dataset compliance matrix. From startup cache when ready."""
    if startup_cache.is_ready():
        return startup_cache.get_cached_compliance_heatmap()
    return get_compliance_heatmap()


@router.get("/compliance/{regulation}")
def compliance_detail(regulation: str):
    """Detailed gaps for a specific regulation. Use slug: fda-21-cfr, fda-mdr, hipaa, sox, gdpr, pci-dss."""
    from services.compliance_mapper import REGULATION_SLUGS
    key = regulation.replace("%20", " ").strip().lower()
    reg_name = REGULATION_SLUGS.get(key) or next((r for r in REGULATIONS if r.lower().replace(" ", "").replace("-", "") == key.replace("-", "")), None)
    if reg_name:
        return get_regulation_detail(reg_name)
    raise HTTPException(status_code=404, detail=f"Unknown regulation: {regulation}")
