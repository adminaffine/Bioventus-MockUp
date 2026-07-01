import type { TaxDashboard, TaxIssueRow, TaxJurisdictionMismatchRow, TaxTransactionDetail } from "../services/api";

const LEGACY_SOLD_TO_COMPLETENESS = "Ship-To Address Completeness";
const SOLD_TO_COMPLETENESS = "Sold-To Address Completeness";

type LegacyStateRow = {
  sold_to_state?: string;
  ship_to_state?: string;
};

type LegacyMismatchRow = TaxJurisdictionMismatchRow & {
  original_ship_bill_to?: string;
  mismatch_ship_bill_to?: string;
  ship_to_state?: string;
};

export function normalizeSoldToState<T extends LegacyStateRow>(row: T): T {
  if (row.sold_to_state) return row;
  if (row.ship_to_state) return { ...row, sold_to_state: row.ship_to_state };
  return row;
}

export function normalizeTaxMismatchRow(row: LegacyMismatchRow): TaxJurisdictionMismatchRow {
  return {
    ...row,
    sold_to_state: row.sold_to_state ?? row.ship_to_state ?? "",
    original_sold_to_bill_to: row.original_sold_to_bill_to ?? row.original_ship_bill_to ?? "",
    mismatch_sold_to_bill_to: row.mismatch_sold_to_bill_to ?? row.mismatch_ship_bill_to ?? "",
  };
}

export function normalizeTaxDashboard(dashboard: TaxDashboard): TaxDashboard {
  const issue = (row: TaxIssueRow) => normalizeSoldToState(row);
  return {
    ...dashboard,
    top_alerts: dashboard.top_alerts.map(issue),
    all_open_issues: dashboard.all_open_issues?.map(issue) ?? [],
    tax_underpayment_issues: dashboard.tax_underpayment_issues?.map(issue),
    ai_queue: dashboard.ai_queue.map(issue),
    my_action_queue: dashboard.my_action_queue.map(issue),
    data_quality_health: dashboard.data_quality_health.map((row) =>
      row.metric === LEGACY_SOLD_TO_COMPLETENESS ? { ...row, metric: SOLD_TO_COMPLETENESS } : row,
    ),
    kpi_cards: dashboard.kpi_cards.map((card) =>
      card.description?.includes("ship-to and bill-to")
        ? { ...card, description: card.description.replace(/ship-to/gi, "sold-to") }
        : card,
    ),
  };
}

export function normalizeTaxTransactionDetail(detail: TaxTransactionDetail): TaxTransactionDetail {
  return {
    ...detail,
    jurisdiction_breakdown: normalizeSoldToState(detail.jurisdiction_breakdown),
  };
}
