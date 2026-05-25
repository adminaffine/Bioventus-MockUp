#!/bin/bash
# Docker Compose maps backend to host 18005; use http://localhost:8005 for local uvicorn only.
BASE="http://localhost:18005"
FAIL=0

check() {
  local url="$1"
  local label="$2"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$code" = "200" ]; then
    echo "  ✓ $label"
  else
    echo "  ✗ $label — HTTP $code"
    FAIL=1
  fi
}

echo "=== Bioventus Command Center — API Smoke Test ==="
echo "Backend: $BASE"
echo ""

echo "[ Core Endpoints ]"
check "$BASE/api/datasets" "Datasets list"
check "$BASE/api/dashboard/summary" "Dashboard summary"
check "$BASE/api/trend/simulation" "Trend simulation"
check "$BASE/api/issues/export" "Issues export"

echo ""
echo "[ Quality Profiles ]"
check "$BASE/api/quality/customer_master" "Quality: customer_master"
check "$BASE/api/quality/sales_orders" "Quality: sales_orders"
check "$BASE/api/quality/product_catalog" "Quality: product_catalog"
check "$BASE/api/quality/patient_support" "Quality: patient_support"

echo ""
echo "[ Integration & Integrity ]"
check "$BASE/api/integration/gaps" "Integration gaps"
check "$BASE/api/integrity/summary" "Integrity summary"
check "$BASE/api/governance/trust-scores" "Governance trust"
check "$BASE/api/governance/policies" "Governance policies"
check "$BASE/api/governance/stewards" "Governance stewards"
check "$BASE/api/governance/audit" "Governance audit"

echo ""
echo "[ Compliance ]"
check "$BASE/api/compliance/heatmap" "Compliance heatmap"
check "$BASE/api/compliance/fda-mdr" "Compliance: FDA MDR"
check "$BASE/api/compliance/hipaa" "Compliance: HIPAA"
check "$BASE/api/compliance/qmsr" "Compliance: QMSR"
check "$BASE/api/compliance/fda-21-cfr" "Compliance: FDA 21 CFR"
check "$BASE/api/compliance/sox" "Compliance: SOX"

echo ""
echo "[ PII Shield ]"
check "$BASE/api/pii/summary" "PII summary"
check "$BASE/api/pii/dataset/customer_master" "PII: customer_master"
check "$BASE/api/pii/dataset/patient_support" "PII: patient_support"
check "$BASE/api/pii/regulations/coverage" "PII regulations coverage"
check "$BASE/api/pii/audit-log" "PII audit log"

echo ""
echo "[ RxIntegrity ]"
check "$BASE/api/rx/summary" "Rx summary"
check "$BASE/api/rx/violations" "Rx violations"
check "$BASE/api/rx/doctors?page=1&size=10" "Rx doctors"
check "$BASE/api/rx/prescriptions?page=1&size=10" "Rx prescriptions"
check "$BASE/api/rx/duplicate-doctors" "Rx duplicate doctors"
check "$BASE/api/rx/specialty-mismatches" "Rx specialty mismatches"

echo ""
echo "[ CAPA & Products (Phase 3) ]"
check "$BASE/api/capa/summary" "CAPA summary"
check "$BASE/api/products/list" "Products list"

echo ""
echo "[ Commercial Intelligence (Phase 5) ]"
check "$BASE/api/commercial/summary" "Commercial summary"
check "$BASE/api/commercial/hierarchy" "Hierarchy data"
check "$BASE/api/commercial/gpo-contracts" "GPO contracts"
check "$BASE/api/commercial/alerts" "Alerts queue"
check "$BASE/api/commercial/tax-certs" "Tax certificates"
check "$BASE/api/products/list" "Products list"

echo ""
echo "[ Upload ]"
check "$BASE/api/upload/sessions" "Upload sessions"

echo ""
if [ $FAIL -eq 0 ]; then
  echo "=== ALL TESTS PASSED ==="
else
  echo "=== SOME TESTS FAILED — check backend logs ==="
  exit 1
fi
