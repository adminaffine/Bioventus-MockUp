import type { PricingClosure, PricingDashboard, PricingIssueRow, TaxClosure, TaxDashboard, TaxIssueRow } from "../services/api";
import {
  buildPricingClosureKpiImpact,
  computePricingMetricsBeforeResolve,
  findPricingIssueRow,
  pricingMetricsFromDashboardCards,
  syncPricingDashboardKpis,
} from "./pricingDashboard";
import {
  buildTaxClosureKpiImpact,
  computeTaxMetricsBeforeResolve,
  findTaxIssueRow,
  syncTaxDashboardKpis,
  taxMetricsFromDashboardCards,
} from "./taxDashboardSync";
import { isExecutiveClosureKpiPatchNeeded } from "./highValueRecordSync";

export function parseClosureKpiMoney(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Impact on Dashboard — Before/After both use dashboard KPI card math.
 * Before = post-resolve open set plus the resolved issue (pre-close state).
 * After = live KPI cards on the post-resolve dashboard.
 */
export function pricingClosureKpiImpactForDisplay(
  kpiImpact: PricingClosure["kpi_impact"],
  issueId: string | undefined,
  dashboard: PricingDashboard | null,
  resolvedIssue?: PricingIssueRow | null,
): PricingClosure["kpi_impact"] {
  if (!issueId || !dashboard) return kpiImpact;

  const synced = syncPricingDashboardKpis(dashboard);
  const afterMetrics = pricingMetricsFromDashboardCards(synced);
  const issue =
    resolvedIssue ?? findPricingIssueRow(synced, issueId) ?? findPricingIssueRow(dashboard, issueId);
  const beforeMetrics = isExecutiveClosureKpiPatchNeeded(issueId)
    ? afterMetrics
    : computePricingMetricsBeforeResolve(synced, issueId, issue);

  return buildPricingClosureKpiImpact(beforeMetrics, afterMetrics);
}

export function taxClosureKpiImpactForDisplay(
  kpiImpact: TaxClosure["kpi_impact"],
  issueId: string | undefined,
  dashboard: TaxDashboard | null,
  resolvedIssue?: TaxIssueRow | null,
): TaxClosure["kpi_impact"] {
  if (!issueId || !dashboard) return kpiImpact;

  const synced = syncTaxDashboardKpis(dashboard);
  const afterMetrics = taxMetricsFromDashboardCards(synced);
  const issue =
    resolvedIssue ?? findTaxIssueRow(synced, issueId) ?? findTaxIssueRow(dashboard, issueId);
  const beforeMetrics = isExecutiveClosureKpiPatchNeeded(issueId)
    ? afterMetrics
    : computeTaxMetricsBeforeResolve(synced, issueId, issue);

  return buildTaxClosureKpiImpact(beforeMetrics, afterMetrics);
}

export function patchPricingClosureKpiForExecutiveApproval(
  closure: PricingClosure,
  issueId: string,
  dashboard: PricingDashboard,
  resolvedIssue?: PricingIssueRow | null,
): PricingClosure {
  return {
    ...closure,
    kpi_impact: pricingClosureKpiImpactForDisplay(closure.kpi_impact, issueId, dashboard, resolvedIssue),
  };
}

export function patchTaxClosureKpiForExecutiveApproval(
  closure: TaxClosure,
  issueId: string,
  dashboard: TaxDashboard,
  resolvedIssue?: TaxIssueRow | null,
): TaxClosure {
  return {
    ...closure,
    kpi_impact: taxClosureKpiImpactForDisplay(closure.kpi_impact, issueId, dashboard, resolvedIssue),
  };
}
