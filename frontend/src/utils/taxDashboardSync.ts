import type { TaxDashboard, TaxIssueRow } from "../services/api";
import { isHighValueRecordApproved } from "./highValueRecordSync";

function isOpenIssue(row: TaxIssueRow): boolean {
  if (row.issue_id && isHighValueRecordApproved(row.issue_id)) return false;
  return (row.status ?? "Open").trim().toLowerCase() === "open";
}

function collectOpenIssues(dashboard: TaxDashboard): TaxIssueRow[] {
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

/** Recompute KPI cards and headline from open issues (includes multi-jurisdiction high-value rows). */
export function syncTaxDashboardKpis(dashboard: TaxDashboard): TaxDashboard {
  const all_open_issues = collectOpenIssues(dashboard);
  const preInvoice = all_open_issues.filter((row) => Number(row.pre_invoice) === 1);
  const totalExposure = Math.round(sumDollarValue(all_open_issues));
  const jurisdictionMismatches = all_open_issues.length;
  const preInvoiceAlerts = preInvoice.length;
  const taxOverpayments = Math.round(
    sumDollarValue(all_open_issues.filter((row) => Number(row.rate_difference) < 0)),
  );
  const taxUnderpayments = Math.round(
    sumDollarValue(all_open_issues.filter((row) => Number(row.rate_difference) > 0)),
  );
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
