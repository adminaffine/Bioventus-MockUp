import type { PricingClosure, PricingDashboard, PricingIssueRow } from "../services/api";
import { isHighValueRecordApproved } from "./highValueRecordSync";
import { sortByDollarDesc } from "./personaKpiSort";

const CONFLICT_TYPES = new Set([
  "GPO Pricing Conflict",
  "No GPO Membership",
  "GPO Chargeback Dispute",
]);

export type PricingMetrics = {
  gpo_conflicts: number;
  expiring_contracts: number;
  product_recalls: number;
  total_exposure: number;
  annualized_exposure: number;
};

function isOpenIssue(row: PricingIssueRow): boolean {
  if (row.issue_id && isHighValueRecordApproved(row.issue_id)) return false;
  return (row.status ?? "Open").trim().toLowerCase() === "open";
}

function filterOpenRows<T extends PricingIssueRow>(rows: T[]): T[] {
  return rows.filter(isOpenIssue);
}

/** Find an issue row on a dashboard payload (open lists or resolved rows still present). */
export function findPricingIssueRow(
  dashboard: PricingDashboard | null | undefined,
  issueId: string,
): PricingIssueRow | undefined {
  if (!dashboard) return undefined;
  const seen = new Set<string>();
  const sources = [
    ...(dashboard.all_open_issues ?? []),
    ...dashboard.top_alerts,
    ...dashboard.ai_queue,
    ...dashboard.my_action_queue,
  ];
  for (const row of sources) {
    if (!seen.has(row.issue_id) && row.issue_id === issueId) return row;
    seen.add(row.issue_id);
  }
  return undefined;
}

/**
 * Pre-resolve KPI metrics using the same rules as dashboard cards (add resolved issue back to open set).
 */
export function computePricingMetricsBeforeResolve(
  postResolveDashboard: PricingDashboard,
  issueId: string,
  resolvedIssue: PricingIssueRow | null | undefined,
): PricingMetrics {
  const synced = syncPricingDashboardKpis(postResolveDashboard);
  const afterMetrics = pricingMetricsFromDashboardCards(synced);
  if (!resolvedIssue) return afterMetrics;

  const openAfter = collectPricingOpenIssues(synced);
  const openBefore = openAfter.some((r) => r.issue_id === issueId)
    ? openAfter
    : [...openAfter, { ...resolvedIssue, status: "Open" }];
  return computePricingMetricsFromIssues(openBefore);
}

/** Open pricing issues for KPI math (excludes executive-approved linked records). */
export function collectPricingOpenIssues(dashboard: PricingDashboard): PricingIssueRow[] {
  if (dashboard.all_open_issues?.length) {
    return dashboard.all_open_issues.filter(isOpenIssue);
  }
  const byId = new Map<string, PricingIssueRow>();
  for (const row of [...dashboard.top_alerts, ...dashboard.ai_queue, ...dashboard.my_action_queue]) {
    if (isOpenIssue(row)) byId.set(row.issue_id, row);
  }
  return [...byId.values()];
}

function sumDollarValue(rows: PricingIssueRow[]): number {
  return rows.reduce((total, row) => total + Number(row.dollar_value || 0), 0);
}

function visibleIssues(issues: PricingIssueRow[]): PricingIssueRow[] {
  return issues.filter((i) => i.issue_type !== "No GPO Membership");
}

/** Live KPI card values — used so closure Impact table matches the dashboard. */
export function pricingMetricsFromDashboardCards(dashboard: PricingDashboard): PricingMetrics {
  const card = (name: string) => Number(dashboard.kpi_cards.find((c) => c.name === name)?.value ?? 0);
  return {
    gpo_conflicts: card("GPO Pricing Conflicts"),
    expiring_contracts: card("Expiring Contracts"),
    product_recalls: card("Product Recalls"),
    total_exposure: card("Compliance Exposure"),
    annualized_exposure: card("Annualized Exposure"),
  };
}

/** Metrics from open issues (matches backend _compute_pricing_metrics). */
export function computePricingMetricsFromIssues(openIssues: PricingIssueRow[]): PricingMetrics {
  const visible = visibleIssues(openIssues);
  const conflicts = visible.filter((i) => CONFLICT_TYPES.has(i.issue_type));
  const expiring = visible.filter((i) => i.issue_type === "Contract Expiring");
  const recalled = visible.filter((i) => i.issue_type === "Product Recalled");
  const totalExposure = Math.round(
    sumDollarValue(conflicts) + sumDollarValue(expiring) + sumDollarValue(recalled),
  );
  return {
    gpo_conflicts: conflicts.length,
    expiring_contracts: expiring.length,
    product_recalls: recalled.length,
    total_exposure: totalExposure,
    annualized_exposure: totalExposure * 12,
  };
}

/** Closure Impact on Dashboard rows (matches backend _kpi_impact_snapshot). */
export function buildPricingClosureKpiImpact(
  metricsBefore: PricingMetrics,
  metricsAfter: PricingMetrics,
): PricingClosure["kpi_impact"] {
  return {
    gpo_conflicts: { before: metricsBefore.gpo_conflicts, after: metricsAfter.gpo_conflicts },
    expiring_contracts_kpi: {
      before: metricsBefore.expiring_contracts,
      after: metricsAfter.expiring_contracts,
    },
    product_recalls: { before: metricsBefore.product_recalls, after: metricsAfter.product_recalls },
    total_exposure: { before: metricsBefore.total_exposure, after: metricsAfter.total_exposure },
    annualized_exposure: {
      before: metricsBefore.annualized_exposure,
      after: metricsAfter.annualized_exposure,
    },
  };
}

/** Recompute KPI cards and headline from open issues (matches backend + high-value chargeback rows). */
export function syncPricingDashboardKpis(dashboard: PricingDashboard): PricingDashboard {
  const all_open_issues = collectPricingOpenIssues(dashboard);
  const metrics = computePricingMetricsFromIssues(all_open_issues);
  const { total_exposure: totalExposure, annualized_exposure: annualizedExposure } = metrics;
  const gpoConflicts = metrics.gpo_conflicts;
  const expiringCount = metrics.expiring_contracts;
  const recalledCount = metrics.product_recalls;
  const mappingScore = Math.max(0, Math.min(100, 94 - gpoConflicts));
  const contractScore = Math.round(Math.max(70, Math.min(100, 100 - expiringCount * 1.6)) * 10) / 10;

  const kpi_cards = dashboard.kpi_cards.map((card) => {
    switch (card.name) {
      case "GPO Pricing Conflicts":
        return { ...card, value: gpoConflicts };
      case "Expiring Contracts":
        return { ...card, value: expiringCount };
      case "Product Recalls":
        return { ...card, value: recalledCount };
      case "Compliance Exposure":
        return { ...card, value: totalExposure };
      case "Annualized Exposure":
        return { ...card, value: annualizedExposure };
      default:
        return card;
    }
  });

  return {
    ...dashboard,
    all_open_issues,
    top_alerts: sortByDollarDesc(filterOpenRows(dashboard.top_alerts), (row) => row.dollar_value),
    ai_queue: filterOpenRows(dashboard.ai_queue),
    my_action_queue: filterOpenRows(dashboard.my_action_queue),
    kpi_cards,
    headline: {
      ...dashboard.headline,
      total_exposure: totalExposure,
      active_conflicts: gpoConflicts,
      expiring_contracts: expiringCount + recalledCount,
    },
    data_quality_health: dashboard.data_quality_health.map((row) => {
      if (row.metric === "GPO Mapping Accuracy") {
        return { ...row, score: mappingScore, status: mappingScore < 90 ? "At Risk" : "Healthy" };
      }
      if (row.metric === "Contract Data Completeness") {
        return { ...row, score: contractScore, status: contractScore < 90 ? "At Risk" : "Healthy" };
      }
      return row;
    }),
  };
}
