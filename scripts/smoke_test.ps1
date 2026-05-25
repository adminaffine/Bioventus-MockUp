# Docker Compose maps backend to host 18005; use http://localhost:8005 for local uvicorn only.
$base = "http://localhost:18005"
$failed = 0

$endpoints = @(
    @{url="/api/datasets"; label="Datasets list"},
    @{url="/api/dashboard/summary"; label="Dashboard summary"},
    @{url="/api/trend/simulation"; label="Trend simulation"},
    @{url="/api/issues/export"; label="Issues export"},
    @{url="/api/quality/customer_master"; label="Quality: customer_master"},
    @{url="/api/quality/sales_orders"; label="Quality: sales_orders"},
    @{url="/api/quality/product_catalog"; label="Quality: product_catalog"},
    @{url="/api/quality/patient_support"; label="Quality: patient_support"},
    @{url="/api/integration/gaps"; label="Integration gaps"},
    @{url="/api/integrity/summary"; label="Integrity summary"},
    @{url="/api/governance/trust-scores"; label="Governance trust"},
    @{url="/api/governance/policies"; label="Governance policies"},
    @{url="/api/governance/stewards"; label="Governance stewards"},
    @{url="/api/governance/audit"; label="Governance audit"},
    @{url="/api/compliance/heatmap"; label="Compliance heatmap"},
    @{url="/api/compliance/fda-mdr"; label="Compliance: FDA MDR"},
    @{url="/api/compliance/hipaa"; label="Compliance: HIPAA"},
    @{url="/api/compliance/qmsr"; label="Compliance: QMSR"},
    @{url="/api/compliance/fda-21-cfr"; label="Compliance: FDA 21 CFR"},
    @{url="/api/compliance/sox"; label="Compliance: SOX"},
    @{url="/api/pii/summary"; label="PII summary"},
    @{url="/api/pii/dataset/customer_master"; label="PII: customer_master"},
    @{url="/api/pii/dataset/patient_support"; label="PII: patient_support"},
    @{url="/api/pii/regulations/coverage"; label="PII regulations coverage"},
    @{url="/api/pii/audit-log"; label="PII audit log"},
    @{url="/api/rx/summary"; label="Rx summary"},
    @{url="/api/rx/violations"; label="Rx violations"},
    @{url="/api/rx/doctors?page=1&size=10"; label="Rx doctors"},
    @{url="/api/rx/prescriptions?page=1&size=10"; label="Rx prescriptions"},
    @{url="/api/rx/duplicate-doctors"; label="Rx duplicate doctors"},
    @{url="/api/rx/specialty-mismatches"; label="Rx specialty mismatches"},
    @{url="/api/capa/summary"; label="CAPA summary"},
    @{url="/api/products/list"; label="Products list"},
    @{url="/api/commercial/summary"; label="Commercial summary"},
    @{url="/api/commercial/hierarchy"; label="Hierarchy data"},
    @{url="/api/commercial/gpo-contracts"; label="GPO contracts"},
    @{url="/api/commercial/alerts"; label="Alerts queue"},
    @{url="/api/commercial/tax-certs"; label="Tax certificates"},
    @{url="/api/products/list"; label="Products list"},
    @{url="/api/upload/sessions"; label="Upload sessions"}
)

Write-Host "=== Bioventus Command Center - API Smoke Test ==="
Write-Host "Backend: $base"
Write-Host ""

foreach ($ep in $endpoints) {
    try {
        $r = Invoke-WebRequest -Uri "$base$($ep.url)" -UseBasicParsing -TimeoutSec 8
        if ($r.StatusCode -eq 200) {
            Write-Host "  [OK] $($ep.label)" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $($ep.label) - HTTP $($r.StatusCode)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "  [FAIL] $($ep.label) - $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host "=== ALL TESTS PASSED ===" -ForegroundColor Green
    exit 0
} else {
    Write-Host "=== SOME TESTS FAILED - check backend logs ===" -ForegroundColor Red
    exit 1
}
