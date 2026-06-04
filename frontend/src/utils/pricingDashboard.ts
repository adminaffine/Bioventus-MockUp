import type { PricingDashboard, PricingIssueRow } from "../services/api";
import { isHighValueRecordApproved } from "./highValueRecordSync";

const CONFLICT_TYPES = new Set([
  "GPO Pricing Conflict",
  "No GPO Membership",
  "GPO Chargeback Dispute",
]);

function isOpenIssue(row: PricingIssueRow): boolean {
  if (row.issue_id && isHighValueRecordApproved(row.issue_id)) return false;
  return (row.status ?? "Open").trim().toLowerCase() === "open";
}

function collectOpenIssues(dashboard: PricingDashboard): PricingIssueRow[] {
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

/** Recompute KPI cards and headline from open issues (matches backend + high-value chargeback rows). */
export function syncPricingDashboardKpis(dashboard: PricingDashboard): PricingDashboard {
  const all_open_issues = collectOpenIssues(dashboard);
  const visibleIssues = all_open_issues.filter((i) => i.issue_type !== "No GPO Membership");
  const conflicts = visibleIssues.filter((i) => CONFLICT_TYPES.has(i.issue_type));
  const expiring = visibleIssues.filter((i) => i.issue_type === "Contract Expiring");
  const recalled = visibleIssues.filter((i) => i.issue_type === "Product Recalled");

  const totalExposure = Math.round(sumDollarValue(conflicts) + sumDollarValue(expiring) + sumDollarValue(recalled));
  const annualizedExposure = totalExposure * 12;
  const gpoConflicts = conflicts.length;
  const expiringCount = expiring.length;
  const recalledCount = recalled.length;
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
