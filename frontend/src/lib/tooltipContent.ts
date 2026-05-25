import type { TooltipContent } from "../components/InfoTooltip";

export const TOOLTIP_DASH_DQ_SCORE: TooltipContent = { title: "Overall DQ Score", formula: "Completeness×0.35 + Validity×0.25 + Uniqueness×0.20 + Consistency×0.20", example: "A weighted score is computed per dataset, then averaged across core datasets.", source: "quality_engine.py startup computation.", variant: "formula" };
export const TOOLTIP_DASH_TOTAL_ISSUES: TooltipContent = { title: "Total Issues Detected", formula: "SUM(all detected issue counts across scanned datasets)", example: "Null required fields + format violations + duplicates + integrity failures.", source: "quality_engine.py field-level scan.", variant: "formula" };
export const TOOLTIP_DASH_COMPLIANCE_RISKS: TooltipContent = { title: "Critical Compliance Risks", formula: "COUNT(regulations WHERE score < 70%)", example: "Any regulation score below 70% is counted critical.", source: "compliance_mapper.py scoring.", variant: "formula" };
export const TOOLTIP_DASH_INTEGRATION_GAPS: TooltipContent = { title: "Integration Gaps", formula: "COUNT(orphan records where FK has no parent)", example: "Orders with customer_id missing in customer_master.", source: "integrity_engine.py referential checks.", variant: "formula" };
export const TOOLTIP_DASH_EXOGEN_RED: TooltipContent = { title: "EXOGEN Traffic Light RED", formula: "RED if recalled product has unresolved adverse-event MDR gaps", example: "Recalled EXOGEN with open adverse-event filing gaps triggers RED.", source: "product_catalog + patient_support join.", variant: "formula" };
export const TOOLTIP_DASH_QMSR_BANNER: TooltipContent = { title: "QMSR Gap Banner", formula: "COUNT(gap categories violating QMSR required fields)", example: "Missing device class + unresolved adverse events + missing rev recognition.", source: "compliance_mapper._score_qmsr().", variant: "formula" };
export const TOOLTIP_DASH_MDR_PILLS: TooltipContent = { title: "MDR Gaps", formula: "COUNT(patient_support WHERE adverse_event_flag=1 AND mdr_submitted=0)", example: "Adverse events without MDR filing count as MDR gaps.", source: "patient_support table.", variant: "formula" };
export const TOOLTIP_DASH_CONSENT_PILLS: TooltipContent = { title: "Consent Gaps", formula: "COUNT(patient_support WHERE phi_data_present=1 AND consent_obtained IS NULL)", example: "PHI present without documented consent is flagged.", source: "patient_support + HIPAA rule mapping.", variant: "formula" };
export const TOOLTIP_DASH_CAPA_STATUS: TooltipContent = { title: "CAPA Status", formula: "Derived counts by CAPA status + overdue logic by due_date", example: "Open / in-progress / resolved and overdue are computed in tracker state.", source: "CAPA summary response and frontend overdue calculation.", variant: "formula" };

export const TOOLTIP_PROF_COMPLETENESS: TooltipContent = { title: "Completeness Score", formula: "(non-null cells / total cells) × 100", example: "Null-heavy columns reduce completeness score.", source: "quality_engine.py completeness.", variant: "formula" };
export const TOOLTIP_PROF_VALIDITY: TooltipContent = { title: "Validity Score", formula: "(rows passing format/domain rules / total rows) × 100", example: "Invalid phone/email/state values reduce validity.", source: "quality_engine.py validity rules.", variant: "formula" };
export const TOOLTIP_PROF_UNIQUENESS: TooltipContent = { title: "Uniqueness Score", formula: "(1 - duplicate_key_count/total_count) × 100", example: "Duplicate IDs lower uniqueness.", source: "quality_engine.py uniqueness checks.", variant: "formula" };
export const TOOLTIP_PROF_CONSISTENCY: TooltipContent = { title: "Consistency Score", formula: "(records meeting cross-field rules / total) × 100", example: "Date-order and value dependency checks drive score.", source: "quality_engine.py consistency rules.", variant: "formula" };
export const TOOLTIP_PROF_OVERALL: TooltipContent = { title: "Overall DQ Score (Dataset)", formula: "Completeness×0.35 + Validity×0.25 + Uniqueness×0.20 + Consistency×0.20", example: "Weighted dimensions produce final dataset score.", source: "quality_engine.py DIMENSION_WEIGHTS.", variant: "formula" };
export const TOOLTIP_PROF_CRITICAL: TooltipContent = { title: "Severity: CRITICAL", formula: "Regulatory-blocking, recall-linked, or revenue-blocking issues", example: "MDR non-submission and recalled-product ordering are critical.", source: "severity classification rules.", variant: "formula" };
export const TOOLTIP_PROF_HIGH: TooltipContent = { title: "Severity: HIGH", formula: "High financial or operational impact without immediate hard regulatory breach", example: "Orphan orders and duplicate identity conflicts.", source: "severity classification rules.", variant: "formula" };
export const TOOLTIP_PROF_MEDIUM: TooltipContent = { title: "Severity: MEDIUM", formula: "Data quality issues with lower immediate operational impact", example: "Format and soft standardization issues.", source: "severity classification rules.", variant: "formula" };

export const TOOLTIP_COMP_HEATMAP_CELL: TooltipContent = { title: "Compliance Heatmap Cell", formula: "(compliant_records / applicable_records) × 100", example: "Each regulation/dataset pair is scored independently.", source: "compliance_mapper.py per-regulation scoring.", variant: "formula" };
export const TOOLTIP_COMP_FDA_MDR: TooltipContent = { title: "FDA-MDR Score", formula: "(adverse events with MDR submitted / total adverse events) × 100", example: "Missing MDR filings lower score.", source: "compliance_mapper._score_fda_mdr().", variant: "formula" };
export const TOOLTIP_COMP_QMSR: TooltipContent = { title: "QMSR Score", formula: "Average of product classification, adverse resolution, and revenue recognition sub-scores", example: "Three QMSR sub-domains are averaged.", source: "compliance_mapper._score_qmsr().", variant: "formula" };
export const TOOLTIP_COMP_HIPAA: TooltipContent = { title: "HIPAA Score", formula: "(consented PHI cases / PHI-present cases) × 100", example: "PHI rows lacking consent reduce HIPAA score.", source: "compliance_mapper._score_hipaa().", variant: "formula" };
export const TOOLTIP_COMP_SOX: TooltipContent = { title: "SOX Score", formula: "(orders with valid customer mapping and recognized revenue / total orders) × 100", example: "Orphan and unrecognized orders reduce SOX score.", source: "compliance_mapper._score_sox().", variant: "formula" };
export const TOOLTIP_COMP_THRESHOLDS: TooltipContent = { title: "Score Thresholds", formula: "Green >=85, Amber 70-84, Red <70", example: "Threshold color is applied uniformly to all compliance scores.", source: "datasetHelpers.scoreColor().", variant: "formula" };

export const TOOLTIP_INT_MATCH_RATE: TooltipContent = { title: "Match Rate", formula: "(child rows with valid parent FK / total child rows) × 100", example: "Orders linked to known customers/products determine match rate.", source: "integrity_engine.py FK checks.", variant: "formula" };
export const TOOLTIP_INT_ORPHAN: TooltipContent = { title: "Orphan Count", formula: "COUNT(child rows WHERE FK not found in parent key set)", example: "Customer or product references without parent rows are counted.", source: "integrity SQL checks.", variant: "formula" };
export const TOOLTIP_INT_INTEGRITY: TooltipContent = { title: "Integrity Score", formula: "AVG(match rate across checked FK relationships)", example: "All key linkage checks are averaged into one score.", source: "integrity_engine summary.", variant: "formula" };

export const TOOLTIP_GOV_TRUST: TooltipContent = { title: "Dataset Trust Score", formula: "DQ + Freshness + Steward Recency + Policy Compliance composite", example: "Composite governance score balances data quality and stewardship health.", source: "governance audit/trust scoring.", variant: "formula" };
export const TOOLTIP_GOV_POLICY_VIOLATED: TooltipContent = { title: "Policy Violated", formula: "Status VIOLATED when compliance ratio is below policy threshold", example: "Regulatory policies require stricter threshold than operational policies.", source: "governance policy definitions.", variant: "formula" };

export const TOOLTIP_RX_NPI_SCORE: TooltipContent = { title: "NPI Integrity Score", formula: "(valid NPI + valid license + DEA present records / total doctors) × 100", example: "Missing NPI, expired/suspended license, and DEA gaps reduce score.", source: "rx_integrity_engine NPI checks.", variant: "formula" };
export const TOOLTIP_RX_DUPLICATE: TooltipContent = { title: "Duplicate Cluster Score", formula: "Name/entity similarity rules flag likely duplicate provider records", example: "Same name with conflicting specialties/NPI creates duplicate clusters.", source: "rx_integrity duplicate clustering logic.", variant: "formula" };
export const TOOLTIP_RX_SPECIALTY: TooltipContent = { title: "Specialty Mismatch", formula: "Mismatch if prescribed schedule/category not allowed for provider specialty", example: "Out-of-scope specialty-drug pair is flagged for review.", source: "SPECIALTY_ALLOWED_SCHEDULES mapping.", variant: "formula" };
export const TOOLTIP_RX_DEA: TooltipContent = { title: "DEA Compliance", formula: "(scheduled prescriptions with valid DEA match / total scheduled prescriptions) × 100", example: "Missing/unverifiable DEA for controlled prescriptions lowers score.", source: "rx DEA compliance checks.", variant: "formula" };

export const TOOLTIP_TREND_BASELINE: TooltipContent = { title: "DQ Baseline", formula: "Current weighted platform DQ score across core datasets", example: "Baseline reflects present unresolved DQ conditions.", source: "trend simulation baseline from quality engine.", variant: "formula" };
export const TOOLTIP_TREND_TARGET: TooltipContent = { title: "Post-CAPA Target", formula: "Baseline + modeled CAPA improvements (capped realistic target)", example: "Each CAPA contributes modeled score uplift.", source: "CAPA improvement model.", variant: "formula" };
export const TOOLTIP_TREND_PER_CAPA: TooltipContent = { title: "Per-CAPA Improvement", formula: "(records fixed/total) × dimension weight × dataset weight", example: "Larger fixes in highly weighted datasets yield bigger gains.", source: "trend impact computation.", variant: "formula" };
export const TOOLTIP_TREND_PROJECTION: TooltipContent = { title: "Weekly Projection", formula: "Sequential progression from baseline to target over projected weeks", example: "Each week layers expected resolved CAPA impact.", source: "trend timeline simulation.", variant: "formula" };

export const TOOLTIP_PII_DETECTION: TooltipContent = { title: "PII Detection Count", formula: "Regex and semantic field-pattern detection across text and structured fields", example: "SSN/email/phone/DOB and healthcare identifiers are flagged.", source: "pii_engine detection scan.", variant: "formula" };
export const TOOLTIP_PII_HIPAA_GAP: TooltipContent = {
  title: "HIPAA Consent Gap",
  formula: "phi_data_present = 1 AND (consent_obtained IS NULL OR consent_obtained = 0)",
  example: "Same rule as Profiler / Compliance HIPAA slice: PHI is flagged on the case but consent is not documented.",
  source: "patient_support; quality hipaa_gap_count; PII preview filter=hipaa_consent_gaps.",
  variant: "formula",
};
export const TOOLTIP_PII_REGULATION: TooltipContent = { title: "Regulation Coverage", formula: "(protected PII fields under regulation / total applicable PII fields) × 100", example: "Coverage increases as masking/protection policies are applied.", source: "pii regulation coverage computation.", variant: "formula" };
export const TOOLTIP_PII_MASKING: TooltipContent = { title: "PII Masking Score", formula: "(masked PII instances / total detected PII instances) × 100", example: "Higher masked instance count improves score.", source: "pii summary masking metrics.", variant: "formula" };

export const TOOLTIP_CAPA_DAYS_OPEN: TooltipContent = { title: "Days Open / Overdue", formula: "days_open=today-created_date; overdue=today>due_date && status!=Resolved", example: "CAPAs past due date while unresolved are overdue.", source: "CAPA tracker frontend date logic.", variant: "formula" };
export const TOOLTIP_CAPA_001_OVERDUE: TooltipContent = { title: "CAPA-001 Overdue", formula: "days_overdue=today-due_date", example: "Shows elapsed overrun versus closure SLA window.", source: "CAPA seed data + date arithmetic.", variant: "formula" };
export const TOOLTIP_CAPA_FINANCIAL: TooltipContent = { title: "CAPA Financial Impact", formula: "SUM(linked order values for affected records)", example: "Affected orders tied to CAPA drive financial exposure.", source: "CAPA linkage to sales order values.", variant: "formula" };

export const TOOLTIP_PROD_DQ_FLAGS: TooltipContent = { title: "Product DQ Flags", formula: "Rule-based flag penalties for recalled, missing class/clearance/HCPCS", example: "Recalled product and missing mandatory attributes trigger higher-severity flags.", source: "products router DQ flag rules.", variant: "formula" };
export const TOOLTIP_PROD_ORDERS_AT_RISK: TooltipContent = { title: "Orders at Risk (Recalled Product)", formula: "COUNT(orders for recalled product after recall date)", example: "Post-recall orders are counted as high-risk exposure.", source: "product recall + orders date join.", variant: "formula" };

export const TOOLTIP_COMM_AT_RISK: TooltipContent = {
  title: "Total At-Risk Revenue",
  formula: "Sum of COPQ drilldown category $ (same as /api/commercial/copq-drilldown total_value)",
  example: "Orphan + recalled + negative (signed $) + missing rev. + ghost rep; matches Revenue COPQ tab.",
  source: "commercial summary — shared bucket logic with copq-drilldown.",
  variant: "formula",
};
export const TOOLTIP_COMM_COPQ: TooltipContent = { title: "Annual COPQ Estimate", formula: "At-risk revenue × 18% rework rate × annualization factor", example: "Uses benchmark remediation rate and annualized volume assumptions.", source: "Commercial assumptions model.", variant: "assumption" };
export const TOOLTIP_COMM_GPO: TooltipContent = { title: "GPO Annualized Exposure", formula: "Current conflict total × estimated annual orders", example: "Extrapolates current observed GPO conflicts to annual volume.", source: "Commercial assumptions model.", variant: "assumption" };
export const TOOLTIP_COMM_COPQ_DONUT: TooltipContent = {
  title: "COPQ Breakdown",
  formula: "Category % = category amount / total at-risk revenue (same denominator as Revenue COPQ)",
  example: "Includes ghost-rep bucket; negative bucket uses signed line totals.",
  source: "commercial.copq_breakdown (aligned with copq-drilldown).",
  variant: "formula",
};
export const TOOLTIP_COMM_REVENUE_CAT: TooltipContent = { title: "Revenue by Category", formula: "SUM(positive order amounts) grouped by mapped product category", example: "Product category rollups power chart bars.", source: "commercial revenue_by_category mapping.", variant: "formula" };

export const TOOLTIP_HIER_CONFIDENCE: TooltipContent = {
  title: "Hierarchy Confidence",
  formula: "100 − Σ(weight × count) for orphans, hierarchy conflicts, pending mapping rows, and IQVIA roster signals (same filter as /api/commercial/roster-deltas)",
  example: "Low scores mean master data disagrees with stewardship or external roster — use Issues and IQVIA tabs to clear the same row counts shown in the driver list.",
  source: "commercial.build_hierarchy() — recomputed on each request so drivers match roster-deltas.",
  variant: "formula",
};
export const TOOLTIP_HIER_IDN_REVENUE: TooltipContent = { title: "IDN Revenue", formula: "SUM(order amounts for customers linked to selected IDN)", example: "Aggregates linked subsidiaries to IDN-level revenue.", source: "hierarchy + sales order linkage.", variant: "formula" };
export const TOOLTIP_HIER_CREDIT: TooltipContent = { title: "Credit Utilization", formula: "(IDN aggregate revenue / IDN credit limit) × 100", example: "Higher utilization indicates tighter credit headroom.", source: "customer_hierarchy + sales aggregation.", variant: "formula" };
export const TOOLTIP_HIER_IQVIA: TooltipContent = { title: "IQVIA Delta", formula: "Internal affiliation/specialty differs from external roster feed", example: "Delta may require territory/GPO/ownership remapping.", source: "Simulated IQVIA delta feed.", variant: "assumption" };

export const TOOLTIP_REV_GPO_VARIANCE: TooltipContent = { title: "GPO Price Variance", formula: "charged_price - contracted_price per unit", example: "Positive variance indicates overcharge versus contract.", source: "gpo_contracts + linked order prices.", variant: "formula" };
export const TOOLTIP_REV_DISPUTE_TOTAL: TooltipContent = { title: "Total Dispute Amount", formula: "price_variance_per_unit × quantity", example: "Per-dispute total is variance multiplied by ordered units.", source: "chargeback dispute computation.", variant: "formula" };
export const TOOLTIP_REV_GPO_ANNUAL: TooltipContent = { title: "Annualized GPO Exposure", formula: "current conflict total × estimated annual order count", example: "Extrapolated annual estimate from current period conflicts.", source: "Assumed annual volume multiplier.", variant: "assumption" };
export const TOOLTIP_REV_COPQ_CURRENT: TooltipContent = { title: "Current COPQ", formula: "at-risk revenue × 18% benchmark remediation rate", example: "Current period estimated remediation burden.", source: "Benchmark-driven model.", variant: "assumption" };
export const TOOLTIP_REV_COPQ_SLIDER: TooltipContent = { title: "COPQ Annualization Slider", formula: "annual COPQ = current COPQ × selected factor", example: "Slider changes annualization multiplier to model volume.", source: "Frontend scenario modeling.", variant: "assumption" };
export const TOOLTIP_REV_MARGIN: TooltipContent = { title: "Margin at Risk", formula: "at-risk revenue × 34% benchmark gross margin", example: "Uses benchmark gross margin to estimate margin exposure.", source: "Industry benchmark assumption.", variant: "assumption" };
export const TOOLTIP_REV_TAX: TooltipContent = { title: "Tax Exposure Estimate", formula: "order amount × blended tax rate for jurisdiction mismatch", example: "Mismatch rows estimate risk by applying blended rate.", source: "Tax mismatch simulation model.", variant: "assumption" };
export const TOOLTIP_REV_DSO: TooltipContent = { title: "DSO Simulation", formula: "proxy DSO by payment method vs 30-day benchmark", example: "Positive variance indicates slower expected collection.", source: "dso_analysis simulated method-based proxy.", variant: "assumption" };

export const TOOLTIP_ALERT_TOTAL: TooltipContent = { title: "Total Alert Exposure", formula: "SUM(dollar_impact) across active alerts", example: "Alert queue impact totals current financial exposure.", source: "alerts_queue aggregation.", variant: "formula" };
export const TOOLTIP_ALERT_TIER: TooltipContent = { title: "Financial Tier Classification", formula: "Tier by dollar threshold + regulatory criticality", example: "Higher-impact and regulatory alerts are elevated tiers.", source: "Alert tiering rules.", variant: "formula" };
export const TOOLTIP_ALERT_SORT: TooltipContent = { title: "Alert Sort Order", formula: "severity DESC, dollar impact DESC, detected date ASC", example: "Most urgent and financially material items appear first.", source: "Alerts page client sort logic.", variant: "formula" };

export const TOOLTIP_CSUITE_MARGIN_CURRENT: TooltipContent = { title: "Margin at Risk (Current)", formula: "positive at-risk revenue × 34% margin benchmark", example: "Current-period margin exposure from unresolved risky orders.", source: "Commercial summary + margin benchmark.", variant: "assumption" };
export const TOOLTIP_CSUITE_MARGIN_ANNUAL: TooltipContent = { title: "Projected Annual Margin Risk", formula: "current margin at risk × annualization factor", example: "Extrapolates current exposure to annual projection.", source: "Annualization assumption model.", variant: "assumption" };
export const TOOLTIP_CSUITE_SLA_COUNT: TooltipContent = { title: "SLA Breaches", formula: "COUNT(sla_tickets WHERE is_breached=1)", example: "Breach count reflects tickets past target thresholds.", source: "SLA tickets endpoint.", variant: "formula" };
export const TOOLTIP_CSUITE_SLA_IMPACT: TooltipContent = { title: "SLA Financial Impact", formula: "SUM(financial_impact WHERE is_breached=1)", example: "Adds financial impact of breached SLA tickets.", source: "SLA ticket impact fields.", variant: "formula" };
export const TOOLTIP_CSUITE_PIPELINE: TooltipContent = { title: "Stalled Onboarding Pipeline", formula: "SUM(pipeline_value WHERE stalled_flag=1)", example: "Only stalled onboarding rows contribute to blocked pipeline.", source: "onboarding_queue summary.", variant: "formula" };
export const TOOLTIP_CSUITE_DSO: TooltipContent = { title: "DSO Collection Risk", formula: "SUM(collection_at_risk WHERE dso_variance>0)", example: "Rows above benchmark variance are included.", source: "dso_analysis endpoint.", variant: "formula" };
export const TOOLTIP_CSUITE_COMMISSION: TooltipContent = { title: "Misattributed Commission", formula: "SUM(order_amount × 3% on misaligned territories)", example: "Commission leakage estimated using standard rate on misaligned orders.", source: "territory_alignment model with assumed commission rate.", variant: "assumption" };
export const TOOLTIP_CSUITE_MARGIN_RATE: TooltipContent = { title: "34% Margin Benchmark", formula: "Industry benchmark used where ERP COGS-derived margin is unavailable", example: "Conservative benchmark chosen for scenario modeling.", source: "Industry benchmark assumption.", variant: "assumption" };

/** Territory integrity queue — not a PHI/data leak; sales attribution / comp governance */
export const TOOLTIP_TERR_ORDER_REVENUE: TooltipContent = {
  title: "Order revenue (booked)",
  formula: "sales_orders.total_amount for the linked order",
  example: "Dollar volume of the sale while territory rules disagree with geography — quota and revenue credit may be misassigned.",
  source: "territory_alignment.order_amount",
  variant: "formula",
};
export const TOOLTIP_TERR_COMM_AT_RISK: TooltipContent = {
  title: "Commission at risk (misaligned)",
  formula: "territory_alignment.misaligned_commission",
  example: "Estimated commission dollars tied to this order under the wrong territory assignment — accrual or payout may need correction (deduct/credit per policy).",
  source: "territory_alignment seed + commercial.build_territory_exceptions",
  variant: "formula",
};
export const TOOLTIP_TERR_GAP: TooltipContent = {
  title: "Rep book vs order region",
  formula: "rep_assigned_territory (CRM/route-of-record) compared to order_region (ship-to / geo on the order)",
  example: "When they differ, the rep earning commission may not match who should own the account geographically.",
  source: "territory_alignment columns",
  variant: "formula",
};
export const TOOLTIP_TERR_RISK_TIER: TooltipContent = {
  title: "Impact tier",
  formula: "High if order_amount ≥ policy revenue threshold OR misaligned_commission ≥ policy commission threshold; else Medium",
  example: "Tier drives escalation — not a separate dollar leak; it flags how hot the exception is.",
  source: "TERRITORY_POLICY in commercial.py",
  variant: "formula",
};
export const TOOLTIP_TERR_HOLD_STATUS: TooltipContent = {
  title: "Commission hold (payroll)",
  formula: "territory_commission_holds.hold_status — released vs held",
  example: "Hold pauses commission payout while Sales Ops resolves the territory exception; unrelated to the $ commission-at-risk column.",
  source: "territory_commission_holds",
  variant: "formula",
};
export const TOOLTIP_TERR_SUMMARY_ORDER_REVENUE: TooltipContent = {
  title: "Revenue Impact (summary card)",
  formula: "SUM(order_amount) across loaded exception rows",
  example: "Adds booked order dollars for the queue — not the sum of commission-at-risk. Use the table for commission exposure per row.",
  source: "TerritoryIntegrityQueue summary reducer",
  variant: "formula",
};
