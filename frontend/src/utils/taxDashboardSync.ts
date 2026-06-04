import type { TaxClosure, TaxDashboard, TaxIssueRow } from "../services/api";
import { isHighValueRecordApproved } from "./highValueRecordSync";

export type TaxMetrics = {
  jurisdiction_mismatches: number;
  pre_invoice_alerts: number;
  total_exposure: number;
  annualized_exposure: number;
  tax_overpayments: number;
  tax_underpayments: number;
};

function isOpenIssue(row: TaxIssueRow): boolean {
  if (row.issue_id && isHighValueRecordApproved(row.issue_id)) return false;
  return (row.status ?? "Open").trim().toLowerCase() === "open";
}

function filterOpenRows<T extends TaxIssueRow>(rows: T[]): T[] {
  return rows.filter(isOpenIssue);
}

/** Find an issue row on a dashboard payload. */
export function findTaxIssueRow(
  dashboard: TaxDashboard | null | undefined,
  issueId: string,
): TaxIssueRow | undefined {
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

/** Pre-resolve KPI metrics using the same rules as dashboard cards. */
export function computeTaxMetricsBeforeResolve(
  postResolveDashboard: TaxDashboard,
  issueId: string,
  resolvedIssue: TaxIssueRow | null | undefined,
): TaxMetrics {
  const synced = syncTaxDashboardKpis(postResolveDashboard);
  const afterMetrics = taxMetricsFromDashboardCards(synced);
  if (!resolvedIssue) return afterMetrics;

  const openAfter = collectTaxOpenIssues(synced);
  const openBefore = openAfter.some((r) => r.issue_id === issueId)
    ? openAfter
    : [...openAfter, { ...resolvedIssue, status: "Open" }];
  return computeTaxMetricsFromIssues(openBefore);
}

/** Open tax issues for KPI math (excludes executive-approved linked records). */
export function collectTaxOpenIssues(dashboard: TaxDashboard): TaxIssueRow[] {
  if (dashboard.all_open_issues?.length) {
    return dashboard.all_open_issues.filter(isOpenIssue);
  }
  const byId = new Map<string, TaxIssueRow>();
  for (const row of [...dashboard.top_alerts, ...dashboard.ai_queue, ...dashboard.my_action_queue]) {
    if (isOpenIssue(row)) byId.set(row.issue_id, row);
  }
  return [...byId.values()];
}

function sumDollarValue(rows: TaxIssueRow[]): number {
  return rows.reduce((total, row) => total + Number(row.dollar_value || 0), 0);
}

function parseTaxDollar(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Underpayment rows for KPI modal — descending dollar exposure (highest first). */
export function buildTaxUnderpaymentIssuesDesc(rows: TaxIssueRow[]): TaxIssueRow[] {
  return [...rows]
    .filter((row) => Number(row.rate_difference) > 0)
    .sort((a, b) => parseTaxDollar(b.dollar_value) - parseTaxDollar(a.dollar_value));
}

/** Live KPI card values — used so closure Impact table matches the dashboard. */
export function taxMetricsFromDashboardCards(dashboard: TaxDashboard): TaxMetrics {
  const card = (name: string) => Number(dashboard.kpi_cards.find((c) => c.name === name)?.value ?? 0);
  const totalExposure = card("Compliance Exposure");
  return {
    jurisdiction_mismatches: card("Jurisdiction Mismatches"),
    pre_invoice_alerts: card("Pre-Invoice Alerts"),
    total_exposure: totalExposure,
    annualized_exposure: totalExposure * 12,
    tax_overpayments: card("Tax Overpayments"),
    tax_underpayments: card("Tax Underpayments"),
  };
}

/** Metrics from open issues (matches backend _compute_metrics). */
export function computeTaxMetricsFromIssues(openIssues: TaxIssueRow[]): TaxMetrics {
  const preInvoice = openIssues.filter((row) => Number(row.pre_invoice) === 1);
  const totalExposure = Math.round(sumDollarValue(openIssues));
  return {
    jurisdiction_mismatches: openIssues.length,
    pre_invoice_alerts: preInvoice.length,
    total_exposure: totalExposure,
    annualized_exposure: totalExposure * 12,
    tax_overpayments: Math.round(
      sumDollarValue(openIssues.filter((row) => Number(row.rate_difference) < 0)),
    ),
    tax_underpayments: Math.round(
      sumDollarValue(openIssues.filter((row) => Number(row.rate_difference) > 0)),
    ),
  };
}

function taxJurisdictionAccuracyPct(mismatchCount: number): string {
  const pct = Math.max(0, Math.min(100, 93 - mismatchCount));
  return `${pct}%`;
}

/** Closure Impact on Dashboard rows (matches backend _kpi_impact_snapshot). */
export function buildTaxClosureKpiImpact(
  metricsBefore: TaxMetrics,
  metricsAfter: TaxMetrics,
): TaxClosure["kpi_impact"] {
  return {
    jurisdiction_mismatches: {
      before: metricsBefore.jurisdiction_mismatches,
      after: metricsAfter.jurisdiction_mismatches,
    },
    tax_jurisdiction_accuracy: {
      before: taxJurisdictionAccuracyPct(metricsBefore.jurisdiction_mismatches),
      after: taxJurisdictionAccuracyPct(metricsAfter.jurisdiction_mismatches),
    },
    compliance_exposure: {
      before: metricsBefore.total_exposure,
      after: metricsAfter.total_exposure,
    },
    total_exposure: {
      before: metricsBefore.total_exposure,
      after: metricsAfter.total_exposure,
    },
    annualized_exposure: {
      before: metricsBefore.annualized_exposure,
      after: metricsAfter.annualized_exposure,
    },
    pre_invoice_alerts: {
      before: metricsBefore.pre_invoice_alerts,
      after: metricsAfter.pre_invoice_alerts,
    },
    tax_overpayments: {
      before: metricsBefore.tax_overpayments,
      after: metricsAfter.tax_overpayments,
    },
    tax_underpayments: {
      before: metricsBefore.tax_underpayments,
      after: metricsAfter.tax_underpayments,
    },
  };
}

/** Recompute KPI cards and headline from open issues (includes multi-jurisdiction high-value rows). */
export function syncTaxDashboardKpis(dashboard: TaxDashboard): TaxDashboard {
  const all_open_issues = collectTaxOpenIssues(dashboard);
  const metrics = computeTaxMetricsFromIssues(all_open_issues);
  const {
    total_exposure: totalExposure,
    jurisdiction_mismatches: jurisdictionMismatches,
    pre_invoice_alerts: preInvoiceAlerts,
    tax_overpayments: taxOverpayments,
    tax_underpayments: taxUnderpayments,
  } = metrics;

  const preInvoice = all_open_issues.filter((row) => Number(row.pre_invoice) === 1);
  const nextInvoiceDays = preInvoice.length
    ? Math.min(...preInvoice.map((row) => Number(row.sla_days_remaining ?? 99)))
    : 0;

  const jurisdictionAccuracy = Math.max(70, 96 - jurisdictionMismatches * 2);
  const shipToCompleteness = Math.max(75, 95 - preInvoiceAlerts * 2);

  const kpi_cards = dashboard.kpi_cards.map((card) => {
    switch (card.name) {
      case "Jurisdiction Mismatches":
        return { ...card, value: jurisdictionMismatches };
      case "Pre-Invoice Alerts":
        return { ...card, value: preInvoiceAlerts };
      case "Compliance Exposure":
        return { ...card, value: totalExposure };
      case "Tax Overpayments":
        return { ...card, value: taxOverpayments };
      case "Tax Underpayments":
        return { ...card, value: taxUnderpayments };
      default:
        return card;
    }
  });

  return {
    ...dashboard,
    all_open_issues,
    tax_underpayment_issues: buildTaxUnderpaymentIssuesDesc(all_open_issues),
    top_alerts: filterOpenRows(dashboard.top_alerts),
    ai_queue: filterOpenRows(dashboard.ai_queue),
    my_action_queue: filterOpenRows(dashboard.my_action_queue),
    kpi_cards,
    headline: {
      ...dashboard.headline,
      total_exposure: totalExposure,
      active_mismatches: jurisdictionMismatches,
      pre_invoice_alerts: preInvoiceAlerts,
      annualized_exposure: totalExposure * 12,
      next_invoice_days: nextInvoiceDays,
    },
    data_quality_health: dashboard.data_quality_health.map((row) => {
      if (row.metric === "Tax Jurisdiction Accuracy") {
        return {
          ...row,
          score: jurisdictionAccuracy,
          status: jurisdictionAccuracy < 90 ? "At Risk" : "Healthy",
        };
      }
      if (row.metric === "Ship-To Address Completeness") {
        return {
          ...row,
          score: shipToCompleteness,
          status: shipToCompleteness < 90 ? "At Risk" : "Healthy",
        };
      }
      return row;
    }),
  };
}
