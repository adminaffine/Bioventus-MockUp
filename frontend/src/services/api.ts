import { taxDemoSessionHeaders } from "./taxSession";
import { pricingDemoSessionHeaders } from "./pricingSession";
import { stewardDemoSessionHeaders } from "./stewardSession";
import { cfoDemoSessionHeaders } from "./cfoSession";
import { ccoDemoSessionHeaders } from "./ccoSession";
import { vpDemoSessionHeaders } from "./vpSession";

const API_BASE = import.meta.env.VITE_API_URL || "";

function taxFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...options,
    headers: { ...taxDemoSessionHeaders(), ...(options?.headers as Record<string, string>) },
  });
}

function cfoFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...options,
    headers: { ...cfoDemoSessionHeaders(), ...(options?.headers as Record<string, string>) },
  });
}

function ccoFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...options,
    headers: { ...ccoDemoSessionHeaders(), ...(options?.headers as Record<string, string>) },
  });
}

function vpFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...options,
    headers: { ...vpDemoSessionHeaders(), ...(options?.headers as Record<string, string>) },
  });
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body instanceof FormData) {
    // Let browser set Content-Type for FormData (multipart)
  } else {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export interface HierarchyNode {
  node_id: string;
  node_type: string;
  node_name: string;
  parent_id: string | null;
  idn_id: string | null;
  idn_name: string | null;
  hco_id: string | null;
  hco_name: string | null;
  linked_customer_id: string | null;
  linked_doctor_npi: string | null;
  gpo_membership: string | null;
  gpo_tier: string | null;
  credit_limit: number | null;
  hierarchy_status: string;
  confidence_score: number;
  iqvia_affiliation: string | null;
  iqvia_delta: string;
  iqvia_delta_detail: string | null;
  /** Sum of sales_orders.total_amount for this orphan's customer id; null for non-orphan nodes */
  attributed_revenue?: number | null;
}

export interface HierarchyConfidenceDriver {
  name: string;
  weight: number;
  count: number;
}

export interface GPOContract {
  contract_id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  gpo_name: string | null;
  tier: string | null;
  contracted_price: number | null;
  charged_price: number;
  price_variance: number | null;
  membership_verified: boolean;
  contract_start: string | null;
  contract_end: string | null;
  days_to_expiry: number | null;
  contract_status: string;
  linked_order_id: string | null;
  conflict_flag: boolean;
  conflict_reason: string;
}

export interface AlertItem {
  alert_id: string;
  alert_type: string;
  title: string;
  description: string;
  financial_tier: string;
  dollar_impact: number;
  primary_persona: string;
  primary_owner_name: string;
  primary_owner_role: string;
  linked_records: string;
  linked_screen: string;
  linked_filter: string;
  status: string;
  detected_date: string;
  severity: string;
  prescribed_action_1: string;
  prescribed_action_2: string;
  prescribed_action_3: string;
  regulation_reference: string | null;
  secondary_persona_note: string | null;
  workflow_state?: "open" | "acknowledged" | "routed" | "resolved" | "overridden";
}

export interface TaxCert {
  cert_id: string;
  customer_id: string;
  customer_name: string;
  customer_segment: string;
  cert_status: string;
  cert_number: string | null;
  issuing_state: string | null;
  expiry_date: string | null;
  days_to_expiry: number | null;
  tax_exempt_type: string;
  revenue_at_risk: number;
  orders_affected: string | null;
  action_required: string;
}

/** Ship/bill jurisdiction vs sold-to; from /api/commercial/tax-jurisdiction-mismatches */
export interface TaxJurisdictionMismatchRow {
  order_id: string;
  customer_id: string;
  product_name: string;
  total_amount: number;
  sold_to_state: string;
  sold_to_source: "customer_master" | "demo_fallback";
  /** Intended filing jurisdiction (demo: same as sold-to) */
  original_ship_bill_to: string;
  /** State parsed from billing_address when it differs from sold-to */
  mismatch_ship_bill_to: string;
  tax_risk: number;
  tag: "PRIORITY" | "ORPHAN" | "RECALLED" | null;
}

export interface TaxHeadline {
  total_exposure: number;
  active_mismatches: number;
  pre_invoice_alerts: number;
  annualized_exposure: number;
  next_invoice_days?: number;
}

export interface TaxDataQualityHealth {
  metric: string;
  score: number;
  status: string;
}

export interface TaxKpiCard {
  name: string;
  value: number;
  unit: "open" | "dollars";
  description: string;
}

export interface TaxIssueRow {
  issue_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  issue_type: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dollar_value: number;
  invoice_status: string;
  urgency_label: string;
  owner_id: string;
  owner_name: string;
  ai_fix: string;
  ai_confidence: number;
  ai_source: string;
  correct_jurisdiction: string;
  applied_jurisdiction: string;
  ship_to_state: string;
  bill_to_state: string;
  product: string;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  address_record: string;
  pre_invoice: number;
  rate_difference: number;
  capa_id: string;
  ai_decision?: "approve" | "reject" | null;
  ai_decision_at?: string;
}

export interface TaxDashboard {
  headline: TaxHeadline;
  data_quality_health: TaxDataQualityHealth[];
  kpi_cards: TaxKpiCard[];
  top_alerts: TaxIssueRow[];
  all_open_issues: TaxIssueRow[];
  ai_queue: TaxIssueRow[];
  my_action_queue: TaxIssueRow[];
}

export interface TaxIssueWorkflow {
  ai_approved: boolean;
  manual_ready: boolean;
  can_mark_resolved: boolean;
  acknowledged_at?: string | null;
  transaction_reviewed_at?: string | null;
  address_update_queued_at?: string | null;
  resolution_path: "ai" | "manual" | "manual_in_progress";
}

export interface TaxIssueDetail {
  issue: TaxIssueRow;
  workflow: TaxIssueWorkflow;
  header: Record<string, string | number>;
  what_happened: string;
  business_risk: { risk_type: string; status: string; detail: string }[];
  owner: { owner_id: string; owner_name: string; assigned_on: string; next_action: string; sla_remaining: string };
  ai_recommendation: { fix: string; confidence: number; source: string; order_id: string; correct_jurisdiction: string; decision?: "approve" | "reject" | null };
  affected_records: { customer: string; order: string; address_record: string; current_jurisdiction: string }[];
  prescribed_actions: string[];
  why_it_happened: string;
  preventive_actions: string[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
}

export interface TaxTransactionDetail {
  order_header: Record<string, string | number>;
  jurisdiction_breakdown: {
    ship_to_state: string;
    bill_to_state: string;
    jurisdiction_applied: string;
    correct_jurisdiction: string;
    rate_difference: string;
    tax_exposure: number;
  };
  what_went_wrong: string;
  customer_id?: string;
  ai_recommendation: { fix: string; confidence: number; source: string; decision?: "approve" | "reject" | null };
  order_trail: { date: string; event: string; jurisdiction: string; status: string; correction: string }[];
  address_accuracy: { confidence: number; signal: string; penalty_exposure: number };
  customer_hierarchy: { idn: string; hospital: string; clinic: string };
  cross_team_visibility: { team: string; issue: string; owner: string }[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  issue_id: string;
  workflow: TaxIssueWorkflow;
}

export interface TaxClosure {
  resolution_confirmation: {
    issue: string;
    resolved_by: string;
    date: string;
    resolution_type: string;
    exposure_recovered: number;
  };
  what_was_updated: string[];
  ai_action_log: { recommendation: string; approved_by: string; confidence: number; logged_on: string };
  kpi_impact: Record<string, { before: number | string; after: number | string }>;
  cross_team_notifications: { team: string; owner: string; notification: string }[];
  issue_id: string;
  ai_decision?: "approve" | "reject" | null;
}

export interface PricingHeadline {
  total_exposure: number;
  active_conflicts: number;
  expiring_contracts: number;
}

export interface PricingDataQualityHealth {
  metric: string;
  score: number;
  status: string;
}

export interface PricingKpiCard {
  name: string;
  value: number;
  unit: "open" | "dollars";
  description: string;
  filter_type: string;
}

export interface PricingIssueRow {
  issue_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  issue_type: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dollar_value: number;
  invoice_status: string;
  urgency_label: string;
  owner_id: string;
  owner_name: string;
  ai_fix: string;
  ai_confidence: number;
  ai_source: string;
  correct_tier: string;
  applied_tier: string;
  gpo_name: string;
  product: string;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  contract_id: string;
  credit_memo_required: number;
  overcharge_per_unit: number;
  quantity_affected: number;
  capa_id: string;
  ai_decision?: "approve" | "reject" | null;
}

export interface PricingDashboard {
  headline: PricingHeadline;
  data_quality_health: PricingDataQualityHealth[];
  kpi_cards: PricingKpiCard[];
  top_alerts: PricingIssueRow[];
  ai_queue: PricingIssueRow[];
  my_action_queue: PricingIssueRow[];
  all_open_issues: PricingIssueRow[];
}

export interface PricingWorkflowStatus {
  ai_approved: boolean;
  credit_memo_queued: boolean;
  can_mark_resolved: boolean;
  resolution_path: string;
}

export interface PricingIssueDetail {
  issue: PricingIssueRow;
  header: Record<string, string | number>;
  what_happened: string;
  business_risk: { risk_type: string; status: string; detail: string }[];
  owner: { owner_id: string; owner_name: string; assigned_on: string; next_action: string; sla_remaining: string };
  ai_recommendation: { fix: string; confidence: number; source: string; order_id: string; correct_tier: string };
  affected_records: { record_type: string; record_id: string; customer: string; contract: string; detail: string }[];
  has_order: boolean;
  prescribed_actions: string[];
  why_it_happened: string;
  preventive_actions: string[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  workflow: PricingWorkflowStatus;
}

export interface PricingTransactionDetail {
  order_header: Record<string, string | number>;
  pricing_breakdown: { contract_price: number; charged_price: number; overcharge_per_unit: number; credit_memo_amount: number; gpo: string; correct_tier: string; applied_tier: string };
  what_went_wrong: string;
  ai_recommendation: { fix: string; confidence: number; source: string };
  order_trail: { date: string; event: string; price_applied: string; status: string; correction: string }[];
  mapping_accuracy: { gpo_roster_confidence: number; signal: string; chargeback_exposure: number };
  customer_hierarchy: { idn: string; hospital: string; clinic: string };
  cross_team_visibility: { team: string; issue: string; owner: string }[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string };
  issue_id: string;
  action_label: string;
  workflow: PricingWorkflowStatus;
}

export interface PricingClosure {
  resolution_confirmation: { issue: string; resolved_by: string; resolved_by_name: string; date: string; resolution_type: string; exposure_recovered: number };
  what_was_updated: string[];
  ai_action_log: { recommendation: string; approved_by: string; confidence: number; logged_on: string };
  kpi_impact: Record<string, { before: number | string; after: number | string }>;
  cross_team_notifications: { team: string; owner: string; notification: string }[];
  issue_id: string;
  ai_decision?: "approve" | "reject" | null;
}

export interface VPHeadline {
  total_open_issues: number;
  sla_breach_risk: number;
  escalation_queue: number;
  team_resolution_rate: number;
}

export interface VPKpiCard {
  name: string;
  value: number;
  unit: string;
  description: string;
  filter_type: string;
}

export interface VPTeamHealthRow {
  team: string;
  status: string;
  resolution_rate: number;
  detail?: string;
}

export interface VPTeamScorecardRow {
  team: string;
  open_issues: number;
  sla_status: string;
  /** @deprecated Legacy field — use sla_status */
  sla_breach_risk?: string | number;
  resolution_rate: number;
  health_status: string;
  health_detail?: string;
}

export interface VPIssueRow {
  issue_id: string;
  account_id?: string;
  account_name: string;
  order_id?: string;
  issue_type: string;
  team?: string;
  priority: string;
  dollar_exposure: number;
  invoice_status?: string;
  current_owner_id: string;
  current_owner_name: string;
  sla_days_remaining: number;
  sla_health: string;
  status: string;
  ai_fix_1?: string;
  ai_confidence_1?: number;
  ai_source_1?: string;
  ai_fix_2?: string;
  ai_confidence_2?: number;
  ai_source_2?: string;
  ai_fix?: string;
  ai_confidence?: number;
  ai_source?: string;
  ai_decision?: "approve" | "reject" | "escalate" | null;
  secondary_owner_id?: string;
}

export interface VPDashboard {
  headline: VPHeadline;
  kpi_cards: VPKpiCard[];
  team_health: VPTeamHealthRow[];
  team_scorecard: VPTeamScorecardRow[];
  top_alerts: VPIssueRow[];
  ai_queue: VPIssueRow[];
  all_open_issues: VPIssueRow[];
}

export interface VPWorkflowStatus {
  ai_approved: boolean;
  ai_decision?: string | null;
  can_mark_resolved: boolean;
  resolution_path: string;
}

export interface VPOwnerBlock {
  owner_id: string;
  owner_name: string;
  team?: string;
  assigned_on?: string;
  next_action?: string;
  sla_remaining?: string;
  sla_health?: string;
  live_progress?: string;
  completion_pct?: number;
}

export interface VPIssueDetail {
  issue: Record<string, unknown>;
  header: Record<string, string | number>;
  what_happened: string;
  business_risk: { risk_type: string; status: string; detail: string }[];
  owner: VPOwnerBlock;
  secondary_owner?: VPOwnerBlock | null;
  owners: VPOwnerBlock[];
  ai_recommendation: {
    fix: string;
    confidence: number;
    source: string;
    fix_secondary?: string;
    confidence_secondary?: number;
    source_secondary?: string;
    order_id?: string;
  };
  ai_recommendations?: { fix: string; fix_type: string; confidence: number; source: string }[];
  ai_decision?: string | null;
  prescribed_actions: string[];
  why_it_happened: string;
  preventive_actions: string[];
  root_cause_secondary?: string;
  capa_linkage: { capa_id: string; capa_ids?: string[]; area: string; status: string; owner: string; due_date: string; regulation?: string };
  workflow: VPWorkflowStatus;
  recurrence: {
    issue_type?: string;
    count?: number;
    period?: string;
    capa_exists?: string;
    capa_ids?: string[];
    vp_action_signal?: string;
  };
  reassign_options: { id: string; name: string; team: string }[];
}

export interface VPClosure {
  issue_id: string;
  resolution_confirmation: {
    issue: string;
    resolved_by: string;
    date: string;
    resolution_type: string;
    exposure_recovered: number;
  };
  sla_performance: {
    owner: string;
    owner_name: string;
    resolved_at: string;
    sla_limit: string;
    sla_outcome: string;
    vp_accountability_note: string;
  }[];
  recurring_pattern: {
    issue_type?: string;
    recurrence_count?: number;
    period?: string;
    team?: string;
    capa_exists?: string;
    capa_ids?: string[];
    vp_action_signal?: string;
  };
  what_was_updated: string[];
  next_actions: string[];
  ai_action_log: { fix: string; approved_by: string; confidence: number; logged_on: string }[];
  kpi_impact: Record<string, { before?: number | string; after?: number | string; label?: string; unit?: string }>;
  cross_team_notifications: {
    team: string;
    owner?: string;
    team_status?: string;
    notified_about?: string;
    notification?: string;
  }[];
  action_taken?: string;
}

export interface StewardHeadline {
  total_exposure: number;
  hierarchy_mismatches: number;
  orphan_records: number;
  tax_jurisdiction_gaps: number;
  annualized_exposure: number;
}
export interface StewardDataQualityHealth { metric: string; score: number; status: "Healthy" | "At Risk" | "Critical"; }
export interface StewardKpiCard { name: string; value: number; unit: "open" | "dollars"; description: string; filter_type: string; }
export interface StewardIssueRow {
  issue_id: string; customer_id: string; customer_name: string; issue_type: string; priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  dollar_value: number; hierarchy_level: string; current_idn: string; correct_idn: string; current_idn_name: string; correct_idn_name: string;
  current_jurisdiction: string; correct_jurisdiction: string; owner_id: string; owner_name: string; sla_days_remaining: number; opened_date: string;
  status: string; open_orders: string; contract_id: string; ai_fix: string; ai_confidence: number; ai_source: string; capa_id: string; ai_decision?: "approve" | "reject" | null; urgency_label?: string;
}
export interface StewardDashboard {
  headline: StewardHeadline; data_quality_health: StewardDataQualityHealth[]; kpi_cards: StewardKpiCard[]; top_alerts: StewardIssueRow[];
  ai_queue: StewardIssueRow[]; my_action_queue: StewardIssueRow[]; all_open_issues: StewardIssueRow[];
}
export interface StewardWorkflowStatus { ai_approved: boolean; manual_fix_applied: boolean; can_mark_resolved: boolean; resolution_path: string; }
export interface StewardIssueDetail {
  issue: StewardIssueRow; header: Record<string, string | number>; what_happened: string;
  business_risk: { affected_team: string; exposure: string; risk_type: string }[];
  owner: { owner_id: string; owner_name: string; assigned_on: string; next_action: string; sla_remaining: string };
  ai_recommendation: { fix: string; confidence: number; source: string; customer_id: string };
  affected_records: { customer: string; customer_name: string; open_order: string; contract: string; current_idn_parent: string }[];
  has_open_orders: boolean; prescribed_actions: string[]; why_it_happened: string; preventive_actions: string[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string }; workflow: StewardWorkflowStatus;
}
export interface StewardRecordDetail {
  record_header: { customer_id: string; customer_name: string; hierarchy_level: string; source_system: string; last_updated: string; status: string };
  hierarchy_breakdown: { current_idn: string; current_idn_name: string; correct_idn: string; correct_idn_name: string; jurisdiction_applied: string; correct_jurisdiction: string; effective_date: string; downstream_exposure: number };
  what_went_wrong: string; ai_recommendation: { fix: string; confidence: number; source: string; decision?: "approve" | "reject" | null }; open_orders: string[]; contract_id: string;
  record_trail: { date: string; event: string; detail: string }[]; source_system_mismatch: { source: string; value: string; confirmed: string; since: string }[];
  customer_hierarchy: { idn: string; hospital: string; clinic: string }; cross_team_visibility: { team: string; issue: string; exposure: string; owner: string }[];
  capa_linkage: { capa_id: string; regulation: string; status: string; owner: string; due_date: string }; issue_id: string; workflow: StewardWorkflowStatus;
}
export interface StewardClosure {
  resolution_confirmation: { issue: string; resolved_by: string; resolved_by_name: string; date: string; resolution_type: string; exposure_removed: number };
  what_was_updated: string[]; ai_action_log: { recommendation: string; approved_by: string; confidence: number; logged_on: string };
  kpi_impact: Record<string, { before: number | string; after: number | string }>;
  cross_team_notifications: { team: string; owner?: string; notified_about: string }[];
  issue_id: string;
  ai_decision?: "approve" | "reject" | null;
}

export interface CFOAlert {
  alert_id: string;
  account_id: string;
  account_name: string;
  customer_name?: string;
  order_id: string;
  issue_type: string;
  priority: string;
  dollar_exposure: number;
  margin_at_risk: number;
  penalty_exposure: number;
  legal_risk: string;
  invoice_status: string;
  pre_invoice: number;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  cfo_assignee: string;
  tax_owner_id?: string;
  tax_owner_name?: string;
  tax_owner_team?: string;
  pricing_owner_id?: string;
  pricing_owner_name?: string;
  pricing_owner_team?: string;
  ai_fix_1?: string;
  ai_confidence_1?: number;
  ai_source_1?: string;
  ai_fix_2?: string;
  ai_confidence_2?: number;
  ai_source_2?: string;
  root_cause_primary?: string;
  root_cause_secondary?: string;
  capa_ids?: string;
  next_action_tax?: string;
  next_action_pricing?: string;
  correct_jurisdiction?: string;
  applied_jurisdiction?: string;
  list_price?: number;
  contract_price?: number;
  ai_decision?: string;
  ai_recommendation_lines?: string[];
  ai_fix_display?: string;
  ai_fix?: string;
  ai_confidence?: number;
  ai_source?: string;
  queue_row_id?: string;
  queue_persona?: "tax" | "pricing" | "finance" | "steward";
  applied_tier?: string;
  correct_tier?: string;
  current_idn_name?: string;
}

export type CFOKpiTrendDirection = "improving" | "worsening" | "neutral";

export interface CFOKpiCard {
  value: number;
  label: string;
  description: string;
  trend_label?: string;
  direction?: CFOKpiTrendDirection;
}

export interface CFORiskHeatmapRow {
  issue_type: string;
  severity: "Critical" | "Caution" | "Healthy";
  records_at_risk: number;
  dollar_exposure: number;
}

export interface CFOKpiPeriodRow {
  month: string;
  revenue_at_risk: number;
  margin_at_risk: number;
  compliance_exposure: number;
}

export interface CCOMonthOnMonthRow {
  month: string;
  penalty_exposure: number;
  open_issues: number;
  capa_breach_risk: number;
}

export interface CFODashboard {
  headline: {
    total_exposure: number;
    open_issues: number;
    pre_invoice_count: number;
    predicted_annual_exposure: number;
  };
  kpi_cards: Record<string, CFOKpiCard>;
  kpi_period_comparison?: CFOKpiPeriodRow[];
  risk_heatmap?: CFORiskHeatmapRow[];
  resolution_trend: Array<{ kpi: string; trend: string; status: string; direction: string }>;
  top_alerts: CFOAlert[];
  ai_queue: CFOAlert[];
  high_value_approval_queue: CFOAlert[];
  all_open_alerts: CFOAlert[];
}

export interface CFOClosure {
  resolution_confirmation: {
    issue: string;
    resolved_by: string;
    date: string;
    resolution_type: string;
    exposure_recovered: number;
  };
  what_was_updated: string[];
  ai_action_log: Array<{ fix: string; approved_by: string; confidence: number; logged_on: string }>;
  kpi_impact: Record<string, { before: number | string; after: number | string; delta?: number; label?: string }>;
  cross_team_notifications: { team: string; owner?: string; notification: string }[];
  alert_id: string;
  account_id?: string;
  order_id?: string;
}

export interface CCOIssue {
  issue_id: string;
  account_id: string;
  account_name: string;
  order_id: string;
  issue_type: string;
  priority: string;
  penalty_exposure: number;
  capa_breach_risk: number;
  audit_readiness_impact: number;
  legal_risk: string;
  invoice_status: string;
  pre_invoice: number;
  sla_days_remaining: number;
  opened_date: string;
  status: string;
  cco_assignee: string;
  tax_owner_id: string;
  tax_owner_name: string;
  tax_owner_team: string;
  compliance_owner_id: string;
  compliance_owner_name: string;
  compliance_owner_team: string;
  ai_fix_1: string;
  ai_confidence_1: number;
  ai_source_1: string;
  ai_fix_2: string;
  ai_confidence_2: number;
  ai_source_2: string;
  root_cause_primary: string;
  root_cause_secondary: string;
  capa_ids: string;
  next_action_tax: string;
  next_action_compliance: string;
  correct_jurisdiction: string;
  applied_jurisdiction: string;
  regulation_state: string;
  regulation_statute: string;
  regulation_requirement: string;
  severity_category: string;
  ai_decision?: string;
}

export interface CCOHeadline {
  total_compliance_exposure: number;
  open_issues: number;
  pre_invoice: number;
  annualized_regulatory_risk: number;
  display_exposure: string;
  display_annualized: string;
}

export type CCOKpiKey =
  | "regulatory_penalty_exposure"
  | "capa_breach_risk"
  | "audit_readiness_score"
  | "predicted_annual_risk";

export interface CCOKpiCard {
  value: number;
  label: string;
  display: string;
  description: string;
  unit: "dollars" | "open" | "percent";
}

export interface CCODashboard {
  headline: CCOHeadline;
  kpi_cards: Record<CCOKpiKey, CCOKpiCard>;
  month_on_month?: CCOMonthOnMonthRow[];
  policy_violation_tracker: { severity: string; count: number; teams: string }[];
  compliance_trend: { kpi: string; trend: string; status: string }[];
  top_alerts: CCOIssue[];
  capa_status: {
    capa_id: string;
    area: string;
    status: string;
    owner: string;
    due_date: string;
    health: string;
  }[];
  upcoming_deadlines: { filing: string; due_date: string; days_remaining: number; status: string }[];
  ai_queue: CCOIssue[];
  high_value_approval_queue: CCOIssue[];
  all_open_issues: CCOIssue[];
  risk_heatmap?: {
    issue_id: string;
    risk_area: string;
    label: string;
    severity: "Critical" | "Caution";
    issues_at_risk: number;
    penalty_exposure: number;
    priority: string;
  }[];
}

export interface CCOIssueDetail {
  issue: CCOIssue;
  header: Record<string, string | number>;
  what_happened: string;
  compliance_risk: { risk_type: string; value: string; note: string }[];
  owners: {
    owner_id: string;
    owner_name: string;
    team: string;
    assigned_on: string;
    next_action: string;
    sla_remaining: string;
  }[];
  ai_recommendations: string[];
  capa_entries: { id: string; area: string; status: string; owner: string; due: string; health: string }[];
  regulation_references: { state: string; statute: string; requirement: string }[];
}

export interface CCOClosure {
  resolution_confirmation: {
    issue: string;
    resolved_by: string;
    date: string;
    resolution_type: string;
    exposure_recovered: number;
  };
  what_was_updated: string[];
  ai_action_log: Array<{ fix: string; approved_by: string; confidence: number; logged_on: string }>;
  kpi_impact: {
    regulatory_penalty_exposure: { before: number; after: number };
    capa_breach_risk: { before: number; after: number };
    audit_readiness_score: { before: number; after: number };
    predicted_annual_risk: { before: number; after: number };
  };
  cross_team_notifications: { team: string; owner: string | null; notification: string }[];
}

export interface TerritoryAlignment {
  alignment_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  sales_rep_id: string;
  rep_name: string;
  rep_assigned_territory: string;
  order_region: string;
  product_name: string;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  misalignment_flag: number;
  misaligned_commission: number;
  misalignment_reason: string;
  action_required: string;
}

export interface ChargebackDispute {
  chargeback_id: string;
  contract_id: string | null;
  order_id: string;
  customer_id: string;
  customer_name: string;
  product_name: string;
  gpo_name: string | null;
  tier: string | null;
  price_variance_per_unit: number | null;
  quantity: number;
  total_dispute_amount: number;
  membership_verified: string;
  dispute_status: string;
  days_to_expiry: number | null;
  detected_date: string;
  distributor_flag: number;
  action_required: string;
  financial_impact: string;
}

export interface SLATicket {
  sla_id: string;
  linked_record_id: string;
  linked_record_type: string;
  linked_screen: string;
  linked_filter: string | null;
  department: string;
  owner_name: string;
  sla_description: string;
  sla_target_value: number;
  sla_target_unit: string;
  actual_elapsed: number;
  elapsed_unit: string;
  sla_status: string;
  breach_severity: string | null;
  financial_impact: number;
  prescribed_action: string;
  is_breached: number;
}

export interface OnboardingApplication {
  onboarding_id: string;
  customer_id: string;
  applicant_name: string;
  customer_segment: string;
  city: string;
  state: string;
  submitted_hours_ago: number;
  stalled_flag: number;
  blocking_department: string | null;
  blocking_reason: string;
  pipeline_value_estimate: number;
  sales_rep_id: string;
  action_required: string;
}

export interface DSORecord {
  dso_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  product_name: string;
  order_amount: number;
  payment_method: string;
  simulated_dso_days: number;
  dso_benchmark: number;
  dso_variance: number;
  dq_issue_type: string;
  collection_at_risk: number;
  action_required: string;
}

export interface PricingDiscrepancy {
  id: string;
  customer_id: string;
  product_name: string;
  tier: string | null;
  contracted_price: number;
  charged_price: number;
  price_variance: number;
  severity: string;
  owner: string;
  status: string;
  action_required: string;
  linked_order_id: string | null;
}

export interface AgreementExpiryRecord {
  id: string;
  customer_id: string;
  product_name: string;
  gpo_name: string | null;
  contract_end: string | null;
  days_to_expiry: number;
  status: string;
  owner: string;
  estimated_value: number;
  renewal_action: string;
}

export interface CreditExposureRecord {
  idn_id: string;
  idn_name: string;
  credit_limit: number;
  utilized_amount: number;
  utilization_pct: number;
  risk_tier: string;
  status: string;
  owner: string;
}

export interface RosterDeltaRecord {
  delta_id: string;
  doctor: string;
  npi: string;
  internal_affiliation: string;
  external_affiliation: string;
  delta_type: string;
  delta_detail: string | null;
  risk_tier: string;
  recommended_action: string;
}

export interface DuplicateCandidateRecord {
  duplicate_id: string;
  record_a: { customer_id: string; customer_name: string; city: string; state: string };
  record_b: { customer_id: string; customer_name: string; city: string; state: string };
  confidence_score: number;
  status: string;
  recommended_action: string;
}

export interface TerritoryExceptionRecord {
  exception_id: string;
  order_id: string;
  product_name: string;
  customer_id: string;
  customer_name: string;
  rep_name: string;
  order_region: string;
  assigned_territory: string;
  order_amount: number;
  misaligned_commission: number;
  risk_tier: string;
  state: string;
  assigned_owner: string | null;
  commission_status: string;
  reason: string;
  recommended_action: string;
}

export interface CopqDrilldownRow {
  category: string;
  filter: string;
  orders: number;
  value: number;
  pct: number;
}

export interface CopqDrilldownRecord {
  order_id: string;
  customer_id: string;
  product_name: string;
  total_amount: number;
  issue_category: string;
  filter: string;
}

export interface AlertWorkflowEvent {
  id: number;
  alert_id: string;
  actor_role: string;
  actor_name: string | null;
  action: string;
  reason: string | null;
  from_state: string | null;
  to_state: string;
  created_at: string;
}

export const api = {
  getDatasets: () => fetchApi<{ name: string; row_count: number }[]>("/api/datasets"),
  getDashboardSummary: () =>
    fetchApi<{
      overall_data_quality_score: number;
      total_issues_detected: number;
      critical_compliance_risks: number;
      cross_system_integration_gaps: number;
      traffic_light_by_dataset: { dataset: string; status: string; score: number }[];
      dataset_scores: { dataset: string; score: number }[];
      regulation_coverage: { regulation: string; score: number }[];
      enterprise_trust_score?: number | null;
      integrity_violations?: number;
      qmsr_alert?: {
        active: boolean;
        message: string;
        effective_date: string;
        gaps_detected: number;
        severity: string;
        affected_regulations: string[];
        days_since_effective: number;
      };
    }>("/api/dashboard/summary"),
  getCAPASummary: () =>
    fetchApi<{
      total_capas: number;
      open: number;
      in_progress: number;
      resolved: number;
      overdue: number;
      capas: CAPAItem[];
    }>("/api/capa/summary"),
  getProductList: () =>
    fetchApi<{
      product_id: string;
      product_name: string;
      product_category: string;
      device_class: string | null;
      fda_clearance_number: string | null;
      fda_clearance_date: string | null;
      recall_status: string | null;
      expiry_date: string;
      manufacturer: string;
      hcpcs_code: string | null;
      dq_flags: string[];
    }[]>("/api/products/list"),
  getCommercialSummary: () =>
    fetchApi<{
      total_at_risk_revenue: number;
      copq_current_period: number;
      copq_annual_estimate: number;
      gpo_conflict_current: number;
      gpo_annualized: number;
      unmapped_revenue: number;
      active_alerts: number;
      critical_alerts: number;
      revenue_by_category: { category: string; revenue: number }[];
      copq_breakdown: { category: string; amount: number; pct: number; filter: string; orders: string[] }[];
      top_accounts_by_revenue: Record<string, string | number | boolean>[];
    }>("/api/commercial/summary", { cache: "no-store" }),
  getCopqDrilldown: () =>
    fetchApi<{
      rows: CopqDrilldownRow[];
      records: CopqDrilldownRecord[];
      total_value: number;
    }>("/api/commercial/copq-drilldown"),
  getHierarchy: () =>
    fetchApi<{
      nodes: HierarchyNode[];
      confidence_score: number;
      orphan_count: number;
      conflict_count: number;
      mapped_count: number;
      pending_count: number;
      /** Sum of attributed_revenue across ORPHAN nodes (from sales_orders) */
      orphan_attributed_revenue_total?: number;
      confidence_drivers?: HierarchyConfidenceDriver[];
      /** 2 = current commercial.build_hierarchy weights & IQVIA rules; missing or 1 = older API process */
      metrics_schema_version?: number;
    }>("/api/commercial/hierarchy", { cache: "no-store" }),
  getGPOContracts: () =>
    fetchApi<{
      contracts: GPOContract[];
      conflict_count: number;
      conflict_total_exposure: number;
      conflict_annualized: number;
      expiring_count: number;
      expiring_total_value: number;
      unverified_membership_count: number;
      no_gpo_count: number;
    }>("/api/commercial/gpo-contracts"),
  getAlerts: () =>
    fetchApi<{
      alerts: AlertItem[];
      total_alerts: number;
      critical: number;
      high: number;
      medium: number;
      total_dollar_impact: number;
      open_count: number;
      acknowledged_count: number;
    }>("/api/commercial/alerts"),
  getTaxCerts: () =>
    fetchApi<{
      certs: TaxCert[];
      valid_count: number;
      expired_count: number;
      missing_count: number;
      total_revenue_at_risk: number;
      priority_alert_orders: string[];
    }>("/api/commercial/tax-certs"),
  getTaxJurisdictionMismatches: () =>
    fetchApi<{
      rows: TaxJurisdictionMismatchRow[];
      total_mismatch_count: number;
      total_order_value: number;
      estimated_tax_exposure: number;
    }>("/api/commercial/tax-jurisdiction-mismatches", { cache: "no-store" }),
  getTerritoryAlignment: () =>
    fetchApi<{
      records: TerritoryAlignment[];
      total_misaligned_revenue: number;
      total_misaligned_commission: number;
      misaligned_count: number;
      largest_misalignment: unknown;
    }>("/api/commercial/territory"),
  getTerritoryExceptions: () =>
    fetchApi<{
      policy: {
        high_impact_revenue_threshold: number;
        high_commission_threshold: number;
        approval_matrix: Record<string, string[]>;
      };
      records: TerritoryExceptionRecord[];
      open_count: number;
      commission_hold_count: number;
    }>("/api/commercial/territory-exceptions"),
  transitionTerritoryException: (payload: {
    exception_id: string;
    to_state: string;
    actor_role: string;
    actor_name?: string;
    reason?: string;
  }) =>
    fetchApi<{ ok: boolean; error?: string; exception_id?: string; from_state?: string; to_state?: string }>(
      "/api/commercial/territory-exceptions/transition",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
  commissionHoldAction: (payload: {
    exception_id: string;
    action: "hold" | "release";
    actor_role: string;
    actor_name?: string;
    reason?: string;
  }) =>
    fetchApi<{
      ok: boolean;
      error?: string;
      exception_id?: string;
      commission_status?: string;
      integration_contract?: { event_type: string; version: string; status: string; target_system: string };
    }>("/api/commercial/commission-hold", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getChargebacks: () =>
    fetchApi<{
      records: ChargebackDispute[];
      active_disputes: number;
      total_active_dispute_amount: number;
      expiring_soon_count: number;
      expiring_soon_amount: number;
      priority_alert: string;
    }>("/api/commercial/chargebacks"),
  getSLATickets: () =>
    fetchApi<{
      records: SLATicket[];
      breached_count: number;
      at_risk_count: number;
      total_financial_impact_breached: number;
      departments_with_breach: Record<string, number>;
    }>("/api/commercial/sla"),
  getOnboarding: () =>
    fetchApi<{
      records: OnboardingApplication[];
      stalled_count: number;
      stalled_pipeline_value: number;
      longest_stall_hours: number;
      departments_blocking: Record<string, number>;
    }>("/api/commercial/onboarding"),
  getDSOAnalysis: () =>
    fetchApi<{
      records: DSORecord[];
      total_collection_at_risk: number;
      orphan_dso_risk: number;
      inactive_dso_risk: number;
    }>("/api/commercial/dso"),
  getPricingDiscrepancies: () =>
    fetchApi<{
      total_open: number;
      total_exposure: number;
      records: PricingDiscrepancy[];
    }>("/api/commercial/pricing-discrepancies"),
  getAgreementExpiry: () =>
    fetchApi<{
      expiring_count: number;
      expired_count: number;
      records: AgreementExpiryRecord[];
    }>("/api/commercial/agreement-expiry"),
  getCreditExposure: () =>
    fetchApi<{
      records: CreditExposureRecord[];
      breach_count: number;
      high_risk_count: number;
    }>("/api/commercial/credit-exposure"),
  getRosterDeltas: () =>
    fetchApi<{
      records: RosterDeltaRecord[];
      pending_count: number;
    }>("/api/commercial/roster-deltas", { cache: "no-store" }),
  decideRosterDelta: (payload: { delta_id: string; decision: string; actor_role: string; actor_name?: string; reason?: string }) =>
    fetchApi<{ ok: boolean; delta_id: string; decision: string }>("/api/commercial/roster-deltas/decision", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDuplicateCandidates: () =>
    fetchApi<{
      records: DuplicateCandidateRecord[];
      total_candidates: number;
    }>("/api/commercial/duplicate-candidates"),
  decideDuplicateCandidate: (payload: { duplicate_id: string; action: string; actor_role: string; actor_name?: string; reason?: string }) =>
    fetchApi<{ ok: boolean; duplicate_id: string; action: string }>("/api/commercial/duplicate-candidates/decision", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  transitionAlertWorkflow: (payload: { alert_id: string; to_state: string; actor_role: string; actor_name?: string; reason?: string }) =>
    fetchApi<{ ok: boolean; error?: string; alert_id?: string; from_state?: string; to_state?: string }>("/api/commercial/alert-workflow/transition", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getAlertWorkflowEvents: (alertId?: string) =>
    fetchApi<{ events: AlertWorkflowEvent[] }>(
      `/api/commercial/alert-workflow/events${alertId ? `?alert_id=${encodeURIComponent(alertId)}` : ""}`
    ),
  getQuality: (dataset: string) =>
    fetchApi<{
      dataset: string;
      row_count: number;
      completeness: Record<string, number>;
      completeness_overall: number;
      validity_pct: number;
      uniqueness_pct: number;
      consistency_pct: number;
      overall_score: number;
      issues: { type: string; column: string; count: number; severity: string }[];
      sample_bad_records?: unknown[];
      integration_orphans?: number;
      mdr_gap_count?: number;
      hipaa_gap_count?: number;
    }>(`/api/quality/${dataset}`),
  getIntegrationGaps: () =>
    fetchApi<{
      edges: { from: string; to: string; join_key: string; match_rate: number; orphaned_count: number; status: string }[];
      linkage_issues: Record<string, { orphaned_records: number; match_rate_pct: number; sample_orphan_ids: string[] }>;
    }>("/api/integration/gaps"),
  getComplianceHeatmap: () =>
    fetchApi<{
      regulations: string[];
      datasets: string[];
      matrix: Record<string, Record<string, number>>;
    }>("/api/compliance/heatmap"),
  getComplianceDetail: (regulation: string) =>
    fetchApi<{
      regulation: string;
      description: string;
      gaps: { case_id?: string; order_id?: string; product_id?: string; remediation: string }[];
      dataset_scores: Record<string, number>;
    }>(`/api/compliance/${regulation}`),
  postAiChat: (message: string, history: { role: string; content: string }[], uploadSessionId?: string | null, activeRoute?: string) =>
    fetchApi<{ reply: string }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, history, upload_session_id: uploadSessionId || undefined, active_route: activeRoute || undefined }),
    }),
  getTrendSimulation: () =>
    fetchApi<{
      current_quality_score: number;
      projected_quality_score: number;
      estimated_records_fixed: number;
      compliance_risk_reduction_pct: number;
      integration_gaps_current: number;
      timeline: { week: number; quality_score: number; compliance_score: number; issues_remaining: number }[];
    }>("/api/trend/simulation"),
  getIssuesExportUrl: () => `${API_BASE}/api/issues/export`,

  // Upload & Analyze
  uploadDatasets: (formData: FormData) =>
    fetchApi<UploadReport>(`/api/upload/datasets`, { method: "POST", body: formData }),
  getUploadSessions: () =>
    fetchApi<{ sessions: UploadSession[] }>("/api/upload/sessions"),
  getUploadSession: (sessionId: string) =>
    fetchApi<UploadReport>(`/api/upload/session/${sessionId}`),
  getUploadSessionExportUrl: (sessionId: string) =>
    `${API_BASE}/api/upload/session/${sessionId}/export`,
  deleteUploadSession: (sessionId: string) =>
    fetchApi<{ status: string }>(`/api/upload/session/${sessionId}`, { method: "DELETE" }),

  // PII Shield
  getPiiSummary: () =>
    fetchApi<PiiSummary>("/api/pii/summary"),
  getPiiDatasetReport: (datasetName: string) =>
    fetchApi<PiiDatasetReport>(`/api/pii/dataset/${datasetName}`),
  getPiiDatasetPreview: (datasetName: string, opts?: { filter?: string }) => {
    const q = new URLSearchParams();
    if (opts?.filter) q.set("filter", opts.filter);
    const suffix = q.toString() ? `?${q}` : "";
    return fetchApi<PiiPreview>(`/api/pii/dataset/${datasetName}/preview${suffix}`);
  },
  getPiiAuditLog: (params?: { dataset_name?: string; pii_type?: string; regulation?: string; severity?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.dataset_name) q.set("dataset_name", params.dataset_name);
    if (params?.pii_type) q.set("pii_type", params.pii_type);
    if (params?.regulation) q.set("regulation", params.regulation);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.limit) q.set("limit", String(params.limit));
    return fetchApi<{ entries: PiiAuditEntry[]; count: number }>(`/api/pii/audit-log?${q}`);
  },
  getPiiRegulationsCoverage: () =>
    fetchApi<{ regulations: PiiRegulationCoverage[] }>("/api/pii/regulations/coverage"),
  getPiiExportUrl: (datasetName: string) => `${API_BASE}/api/pii/export/${datasetName}`,
  postPiiScan: (formData: FormData) =>
    fetchApi<{ report: PiiAudit; masked_row_count: number; pii_instances: number; pii_fields: number }>("/api/pii/scan", { method: "POST", body: formData }),
  postPiiScanSession: (sessionId: string) =>
    fetchApi<{ report: PiiAudit; masked_row_count: number; pii_instances: number; pii_fields: number }>(`/api/pii/scan?session_id=${sessionId}`, { method: "POST" }),
  getPiiUploadSession: (sessionId: string) =>
    fetchApi<PiiUploadSessionResult>(`/api/pii/upload-session/${sessionId}`),

  // Data Governance & Integrity
  getGovernanceAudit: () =>
    fetchApi<GovernanceAuditReport>("/api/governance/audit"),
  getGovernanceTrustScores: () =>
    fetchApi<TrustScores>("/api/governance/trust-scores"),
  getGovernanceStewards: () =>
    fetchApi<{ stewards: GovernanceSteward[] }>("/api/governance/stewards"),
  getGovernancePolicies: () =>
    fetchApi<{ policies: GovernancePolicy[] }>("/api/governance/policies"),
  getGovernanceIssues: () =>
    fetchApi<{ issues: GovernanceIssue[]; total: number; error?: string }>("/api/governance/issues"),
  getGovernanceRemediation: (violationType: string) =>
    fetchApi<RemediationPlaybook>(`/api/governance/remediation/${encodeURIComponent(violationType)}`),
  getGovernanceAuditTrail: (limit?: number) =>
    fetchApi<{ events: unknown[]; limit: number }>(`/api/governance/audit-trail${limit != null ? `?limit=${limit}` : ""}`),
  postGovernanceAiDiagnose: (body: { issue_id?: string; category?: string; sample_ids?: string[] }) =>
    fetchApi<AiDiagnoseResponse>("/api/governance/ai-diagnose", { method: "POST", body: JSON.stringify(body) }),

  getIntegritySummary: () =>
    fetchApi<IntegrityScanResult>("/api/integrity/summary"),
  getIntegrityReferential: () =>
    fetchApi<{ referential: IntegrityRefRule[]; summary: IntegritySummary }>("/api/integrity/referential"),
  getIntegrityEntity: () =>
    fetchApi<{ entity: IntegrityEntity; summary: IntegritySummary }>("/api/integrity/entity"),
  getIntegrityDomain: () =>
    fetchApi<{ domain: IntegrityDomainRule[]; summary: IntegritySummary }>("/api/integrity/domain"),
  getIntegrityTemporal: () =>
    fetchApi<{ temporal: IntegrityTemporalRule[]; summary: IntegritySummary }>("/api/integrity/temporal"),
  getIntegrityConsistency: () =>
    fetchApi<{ consistency: IntegrityConsistency; summary: IntegritySummary }>("/api/integrity/consistency"),
  getIntegrityTrustScores: () =>
    fetchApi<TrustScores>("/api/integrity/trust-scores"),
  getIntegritySchemaDrift: (datasetName: string, columns: string) =>
    fetchApi<SchemaDriftResult>(`/api/integrity/schema-drift?dataset_name=${encodeURIComponent(datasetName)}&columns=${encodeURIComponent(columns)}`),

  // RxIntegrity
  getRxSummary: () =>
    fetchApi<{
      total_doctors: number;
      total_prescriptions: number;
      rx_trust_score: number;
      rx_trust_level: string;
      critical_violations: number;
      specialty_mismatches: number;
      dea_violations: number;
      license_violations: number;
      ghost_doctors: number;
      duplicate_doctor_clusters: number;
      misrouted_prescriptions: number;
      patient_safety_flags: number;
      by_violation_type: Record<string, number>;
      by_specialty: Record<string, Record<string, number>>;
    }>("/api/rx/summary"),
  getRxViolations: (params?: { type?: string; severity?: string; page?: number; size?: number }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set("type", params.type);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.page) q.set("page", String(params.page));
    if (params?.size) q.set("size", String(params.size ?? 20));
    return fetchApi<{ violations: unknown[]; total: number; page: number; size: number }>(`/api/rx/violations?${q}`);
  },
  getRxDuplicateDoctors: () =>
    fetchApi<{ clusters: unknown[]; duplicate_clusters: unknown[] }>("/api/rx/duplicate-doctors"),
  getRxSpecialtyMismatches: () =>
    fetchApi<{ specialty_mismatches: unknown[] }>("/api/rx/specialty-mismatches"),
  getRxDeaViolations: () =>
    fetchApi<{ dea_violations: unknown[] }>("/api/rx/dea-violations"),
  getRxDoctors: (params?: { specialty?: string; page?: number; size?: number }) => {
    const q = new URLSearchParams();
    if (params?.specialty) q.set("specialty", params.specialty);
    if (params?.page) q.set("page", String(params.page ?? 1));
    if (params?.size) q.set("size", String(params.size ?? 20));
    return fetchApi<{ doctors: unknown[]; total: number; page: number; size: number }>(`/api/rx/doctors?${q}`);
  },
  getRxPrescriptions: (params?: { doctor_id?: string; page?: number; size?: number }) => {
    const q = new URLSearchParams();
    if (params?.doctor_id) q.set("doctor_id", params.doctor_id);
    if (params?.page) q.set("page", String(params.page ?? 1));
    if (params?.size) q.set("size", String(params.size ?? 20));
    return fetchApi<{ prescriptions: unknown[]; total: number; page: number; size: number }>(`/api/rx/prescriptions?${q}`);
  },
  getRxExportViolationsUrl: () => `${API_BASE}/api/rx/export/violations`,
  getTaxDashboard: () => taxFetch<TaxDashboard>("/api/tax/dashboard"),
  postTaxAiAction: (payload: { issue_id: string; action: "approve" | "reject" }) =>
    taxFetch<{ ok: boolean; issue_id: string; dashboard: TaxDashboard }>("/api/tax/ai-action", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  postTaxResolve: (payload: { issue_id: string }) =>
    taxFetch<{
      ok: boolean;
      issue_id: string;
      already_resolved: boolean;
      closure: TaxClosure;
      dashboard: TaxDashboard;
    }>("/api/tax/resolve", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  postTaxIssueAction: (payload: {
    issue_id: string;
    action: "acknowledge" | "reassign" | "update_address";
    owner_id?: string;
    owner_name?: string;
  }) =>
    taxFetch<{
      ok: boolean;
      issue_id: string;
      action: string;
      message: string;
      issue: TaxIssueRow;
      dashboard: TaxDashboard;
    }>("/api/tax/issue-action", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getTaxIssue: (issueId: string) => taxFetch<TaxIssueDetail>(`/api/tax/issue/${issueId}`),
  getTaxTransaction: (orderId: string) => taxFetch<TaxTransactionDetail>(`/api/tax/transaction/${orderId}`),
  getTaxClosure: (issueId: string) => taxFetch<TaxClosure>(`/api/tax/closure/${issueId}`),
  getPricingDashboard: () =>
    fetchApi<PricingDashboard>("/api/pricing/dashboard", { headers: pricingDemoSessionHeaders() }),
  getPricingIssue: (issueId: string) =>
    fetchApi<PricingIssueDetail>(`/api/pricing/issue/${issueId}`, { headers: pricingDemoSessionHeaders() }),
  getPricingTransaction: (orderId: string) =>
    fetchApi<PricingTransactionDetail>(`/api/pricing/transaction/${orderId}`, { headers: pricingDemoSessionHeaders() }),
  getPricingClosure: (issueId: string) =>
    fetchApi<PricingClosure>(`/api/pricing/closure/${issueId}`, { headers: pricingDemoSessionHeaders() }),
  pricingAiAction: (issueId: string, action: "approve" | "reject") =>
    fetchApi<{ issue_id: string; action: string; workflow: PricingWorkflowStatus }>(
      "/api/pricing/ai-action",
      { method: "POST", body: JSON.stringify({ issue_id: issueId, action }), headers: pricingDemoSessionHeaders() },
    ),
  pricingResolve: (issueId: string) =>
    fetchApi<{
      ok: boolean;
      issue_id: string;
      already_resolved: boolean;
      closure: PricingClosure;
      dashboard: PricingDashboard;
    }>("/api/pricing/resolve", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
      headers: pricingDemoSessionHeaders(),
    }),
  pricingReassign: (issueId: string, ownerId?: string) =>
    fetchApi<{ issue_id: string; owner_id: string; owner_name: string }>("/api/pricing/reassign", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, owner_id: ownerId }),
      headers: pricingDemoSessionHeaders(),
    }),
  pricingCreditMemoQueued: (issueId: string) =>
    fetchApi<{ issue_id: string; workflow: PricingWorkflowStatus }>("/api/pricing/credit-memo-queued", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
      headers: pricingDemoSessionHeaders(),
    }),
  getVPDashboard: () => vpFetch<VPDashboard>("/api/vp/dashboard"),
  vpResetDemo: () =>
    vpFetch<{ ok: boolean; dashboard: VPDashboard }>("/api/vp/reset-demo", { method: "POST" }),
  getVPIssue: (issueId: string) => vpFetch<VPIssueDetail>(`/api/vp/issue/${issueId}`),
  getVPClosure: (issueId: string) => vpFetch<VPClosure>(`/api/vp/closure/${issueId}`),
  getVPTeamMembers: () => vpFetch<{ id: string; name: string; team: string }[]>("/api/vp/team-members"),
  vpApprove: (issueId: string) =>
    vpFetch<{ dashboard: VPDashboard; closure: VPClosure }>("/api/vp/approve", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
    }),
  vpAiAction: (issueId: string, action: "approve" | "reject") =>
    vpFetch<{ ok: boolean; issue_id: string; dashboard: VPDashboard }>("/api/vp/ai-action", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, action }),
    }),
  vpReassign: (issueId: string, newOwnerId: string, newOwnerName: string) =>
    vpFetch<{ dashboard: VPDashboard; closure: VPClosure }>("/api/vp/reassign", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, new_owner_id: newOwnerId, new_owner_name: newOwnerName }),
    }),
  vpEscalate: (issueId: string) =>
    vpFetch<{ dashboard: VPDashboard; closure: VPClosure }>("/api/vp/escalate", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
    }),
  getStewardDashboard: () =>
    fetchApi<StewardDashboard>("/api/steward/dashboard", { headers: stewardDemoSessionHeaders() }),
  getStewardIssue: (issueId: string) =>
    fetchApi<StewardIssueDetail>(`/api/steward/issue/${issueId}`, { headers: stewardDemoSessionHeaders() }),
  getStewardRecord: (customerId: string) =>
    fetchApi<StewardRecordDetail>(`/api/steward/record/${customerId}`, { headers: stewardDemoSessionHeaders() }),
  getStewardClosure: (issueId: string) =>
    fetchApi<StewardClosure>(`/api/steward/closure/${issueId}`, { headers: stewardDemoSessionHeaders() }),
  stewardAiAction: (issueId: string, action: "approve" | "reject") =>
    fetchApi<{ issue_id: string; action: string; workflow: StewardWorkflowStatus; dashboard: StewardDashboard }>(
      "/api/steward/ai-action",
      { method: "POST", body: JSON.stringify({ issue_id: issueId, action }), headers: stewardDemoSessionHeaders() },
    ),
  stewardResolve: (issueId: string) =>
    fetchApi<{
      ok: boolean;
      issue_id: string;
      already_resolved: boolean;
      closure: StewardClosure;
      dashboard: StewardDashboard;
    }>("/api/steward/resolve", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
      headers: stewardDemoSessionHeaders(),
    }),
  stewardReassign: (issueId: string, ownerId?: string) =>
    fetchApi<{ issue_id: string; owner_id: string; owner_name: string }>("/api/steward/reassign", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, owner_id: ownerId }),
      headers: stewardDemoSessionHeaders(),
    }),
  stewardManualFixApplied: (issueId: string) =>
    fetchApi<{ issue_id: string; workflow: StewardWorkflowStatus }>("/api/steward/manual-fix-applied", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
      headers: stewardDemoSessionHeaders(),
    }),
  getCFODashboard: () => cfoFetch<CFODashboard>("/api/cfo/dashboard"),
  getCFOIssueDetail: (alertId: string) =>
    cfoFetch<{
      alert: CFOAlert;
      header: {
        issue_type: string;
        customer: string;
        priority: string;
        dollar_impact: number;
        opened_on: string;
        sla: string;
        invoice_status?: string;
        margin_at_risk?: number;
      };
      owners: Array<{
        owner_id: string;
        owner_name?: string;
        team?: string;
        assigned_on?: string;
        next_action?: string | null;
      }>;
      ai_recommendations: string[];
      capa_entries: Array<{ id: string; area: string; status: string; owner: string; due: string }>;
      reassign_options: Array<{ id: string; name: string; team: string }>;
    }>(`/api/cfo/issue/${alertId}`),
  cfoAiAction: (alertId: string, action: "approve" | "reject") =>
    cfoFetch<{ ok: boolean; alert_id: string; dashboard: CFODashboard }>("/api/cfo/ai-action", {
      method: "POST",
      body: JSON.stringify({ alert_id: alertId, action }),
    }),
  getCFOClosure: (alertId: string) => cfoFetch<CFOClosure>(`/api/cfo/closure/${alertId}`),
  cfoApprove: (alertId: string) =>
    cfoFetch<{ dashboard: CFODashboard; closure: CFOClosure }>("/api/cfo/approve", {
      method: "POST",
      body: JSON.stringify({ alert_id: alertId }),
    }),
  cfoReassign: (alertId: string, newOwnerId: string, newOwnerName: string) =>
    cfoFetch<CFODashboard>("/api/cfo/reassign", {
      method: "POST",
      body: JSON.stringify({
        alert_id: alertId,
        new_owner_id: newOwnerId,
        new_owner_name: newOwnerName,
      }),
    }),
  getCCODashboard: () => ccoFetch<CCODashboard>("/api/cco/dashboard"),
  getCCOIssueDetail: (issueId: string) => ccoFetch<CCOIssueDetail>(`/api/cco/issue/${issueId}`),
  getCCOClosure: (issueId: string) => ccoFetch<CCOClosure>(`/api/cco/closure/${issueId}`),
  ccoApprove: (issueId: string) =>
    ccoFetch<{ dashboard: CCODashboard; closure: CCOClosure }>("/api/cco/approve", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId }),
    }),
  ccoReassign: (issueId: string, ownerId: string, ownerName: string) =>
    ccoFetch<CCODashboard>("/api/cco/reassign", {
      method: "POST",
      body: JSON.stringify({ issue_id: issueId, owner_id: ownerId, owner_name: ownerName }),
    }),
  getCCOTeamMembers: () =>
    ccoFetch<{ members: { id: string; name: string; team: string }[] }>("/api/cco/team-members"),
};

export async function streamAiChat(
  args: { message: string; history: { role: string; content: string }[]; uploadSessionId?: string | null; activeRoute?: string },
  onDelta: (delta: string) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: args.message,
      history: args.history,
      upload_session_id: args.uploadSessionId || undefined,
      active_route: args.activeRoute || undefined,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(await res.text());
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      const obj = JSON.parse(payload) as { delta?: string; error?: string };
      if (obj.error) throw new Error(obj.error);
      if (obj.delta) onDelta(obj.delta);
    }
  }
}

export type GovernanceAuditReport = {
  data_integrity: { item: string; status: string; notes: string }[];
  governance: { item: string; status: string; notes: string }[];
};

export type TrustScores = {
  customer_master: number;
  sales_orders: number;
  patient_support: number;
  product_catalog: number;
  enterprise_score: number;
  by_dimension?: Record<string, number>;
};

export type GovernanceSteward = {
  id: string;
  name: string;
  role: string;
  domain: string;
  open_issues: number;
  sla_breaches: number;
};

export type GovernancePolicy = {
  policy_id: string;
  name: string;
  description: string;
  applies_to: string[];
  rule_type: string;
  severity_on_violation: string;
  regulation: string[];
  auto_remediation: string;
  status: string;
  violations_today: number;
};

export type GovernanceIssue = {
  issue_id: string;
  category: string;
  rule_name: string;
  dataset: string;
  severity: string;
  regulation: string[];
  violations: number;
  sample_ids: string[];
  owner: string;
  status: string;
  sla_deadline: string;
  created_at: string;
};

export type RemediationPlaybook = {
  violation_type: string;
  playbook_id: string;
  immediate_actions: string[];
  short_term_actions: string[];
  long_term_prevention: string[];
  estimated_effort: string;
  risk_if_ignored: string;
  automation_possible: boolean;
};

export type AiDiagnoseResponse = {
  issue_id?: string;
  category?: string;
  suggested_root_causes: string[];
  recommended_actions: string[];
  confidence: number;
};

export type IntegrityRefRule = {
  rule_name: string;
  source: string;
  target: string;
  total_checked: number;
  violations: number;
  violation_pct: number;
  sample_ids: string[];
  severity: string;
  regulation: string[];
  business_impact?: string;
};

export type IntegrityEntity = {
  exact_duplicate_count: number;
  exact_duplicate_clusters: number;
  sample_clusters: unknown[];
  fuzzy_merge_candidates: number;
};

export type IntegrityDomainRule = { dataset: string; field: string; violations: number; sample_values?: string[] };
export type IntegrityTemporalRule = { rule: string; dataset: string; order_id?: string; case_id?: string; severity: string };
export type IntegrityConsistency = { total_conflicts: number; by_conflict_type: Record<string, number>; sample?: unknown[] };

export type IntegritySummary = {
  referential_violations?: number;
  entity_duplicates?: number;
  domain_violations?: number;
  temporal_violations?: number;
  consistency_conflicts?: number;
};

export type IntegrityScanResult = {
  error?: string;
  referential: IntegrityRefRule[];
  entity: IntegrityEntity;
  domain: IntegrityDomainRule[];
  temporal: IntegrityTemporalRule[];
  consistency: IntegrityConsistency;
  trust_scores: TrustScores;
  total_violations: number;
  summary: IntegritySummary;
};

export type SchemaDriftResult = {
  dataset: string;
  baseline_columns: string[];
  uploaded_columns: string[];
  drift_detected: boolean;
  changes: { type: string; from?: string; to?: string; column?: string; impact: string }[];
  pipeline_break_risk: string;
};

export type PiiSummary = {
  total_pii_instances: number;
  pii_types_detected: number;
  masking_coverage_pct: string;
  regulations_covered: number;
  records_containing_pii: number;
  total_records_scanned: number;
  by_pii_type: Record<string, number>;
  by_regulation: Record<string, { fields: number; instances: number }>;
  datasets: string[];
};

export type PiiDatasetReport = {
  dataset_name: string;
  total_records: number;
  pii_fields_detected: number;
  pii_instances_total: number;
  records_containing_pii: number;
  records_clean: number;
  by_pii_type: Record<string, { count: number; masked: number; regulation: string[] }>;
  by_regulation: Record<string, { fields: number; instances: number; coverage: string }>;
  field_details: { field: string; pii_type: string; instance_count: number; masking_strategy: string; regulations: string[] }[];
  masking_completeness: string;
  processed_at?: string;
};

export type PiiPreview = {
  dataset_name: string;
  original: Record<string, unknown>[];
  masked: Record<string, unknown>[];
  pii_columns: string[];
  total_records: number;
  filter_applied?: string;
  empty_message?: string;
  /** Present when filter=hipaa_consent_gaps: columns that explain row inclusion (PHI vs consent). */
  hipaa_gap_driver_columns?: string[];
};

export type PiiUploadSessionResult = {
  summary: {
    total_pii_instances: number;
    pii_types_detected: number;
    pii_fields_detected: number;
    masked_row_count: number;
    records_containing_pii: number;
    by_pii_type: Record<string, number>;
    datasets: string[];
  };
  preview: PiiPreview;
};

export type PiiAuditEntry = {
  timestamp: string;
  dataset_name: string;
  field: string;
  pii_type: string;
  severity: string;
  regulation: string;
  action_taken: string;
  status: string;
};

export type PiiRegulationCoverage = {
  regulation: string;
  fields_governed: number;
  instances: number;
  coverage: string;
  governed_pii_types?: string[];
  masking_by_type?: Record<string, string>;
};

export type PiiAudit = {
  audit_id: string;
  dataset_name: string;
  processed_at: string;
  total_records: number;
  pii_fields_detected: number;
  pii_instances_total: number;
  records_containing_pii: number;
  records_clean: number;
  by_pii_type: Record<string, { count: number; masked: number; regulation: string[] }>;
  by_regulation: Record<string, { fields: number; instances: number; coverage: string }>;
  masking_completeness: string;
};

export type UploadSession = {
  session_id: string;
  created_at: string;
  files: { filename: string; dataset_type: string; rows: number }[];
  overall_score?: number;
  issue_count?: number;
};

export type UploadReport = {
  session_id: string;
  created_at: string;
  files: { filename: string; dataset_type: string; rows: number }[];
  profiles: {
    dataset: string;
    dataset_type: string;
    row_count: number;
    completeness: Record<string, number>;
    completeness_overall: number;
    validity_pct: number;
    uniqueness_pct: number;
    consistency_pct: number;
    overall_score: number;
    issues: { type: string; column: string; count: number; severity: string; regulation?: string }[];
  }[];
  integration_edges: { from: string; to: string; join_key: string; match_rate: number; orphaned_count: number; status: string }[];
  summary: {
    overall_data_quality_score: number;
    total_issues_detected: number;
    critical_compliance_risks: number;
    cross_system_integration_gaps: number;
  };
};

export interface CAPAItem {
  capa_id: string;
  title: string;
  description: string;
  root_cause: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "Open" | "In Progress" | "Resolved";
  regulation: string;
  affected_dataset: string;
  affected_records: string[];
  affected_product: string;
  owner: string;
  owner_role: string;
  created_date: string;
  due_date: string;
  days_open: number;
  is_overdue: boolean;
  corrective_action: string;
  preventive_action: string;
  linked_regulation_slug: string;
  priority: number;
  resolved_date?: string;
  resolved_by?: string;
  resolution_notes?: string;
}
