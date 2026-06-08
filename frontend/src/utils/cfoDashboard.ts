import type {
  CFOAlert,
  CFODashboard,
  CFOKpiPeriodRow,
  CFORiskHeatmapRow,
} from "../services/api";
import { EXECUTIVE_APPROVAL_CFO_ALERT_ID } from "./executiveApprovalRecord";
import { isCfoAlertResolved } from "./cfoWorkflowStorage";
import { isHighValueRecordApproved } from "./highValueRecordSync";
import { sortByDollarDesc } from "./personaKpiSort";

export type CFOKpiKey =
  | "revenue_at_risk"
  | "margin_at_risk"
  | "compliance_exposure"
  | "predicted_annual_exposure";

export const CFO_KPI_ORDER: CFOKpiKey[] = [
  "revenue_at_risk",
  "margin_at_risk",
  "compliance_exposure",
  "predicted_annual_exposure",
];

export const CFO_KPI_CARD_META: Record<
  CFOKpiKey,
  { accent: string; valueTone: string; modalSubtitle: string; emptyHint: string }
> = {
  revenue_at_risk: {
    accent: "border-rose-300 dark:border-rose-700 hover:border-rose-400 bg-rose-50/50 dark:bg-rose-950/20",
    valueTone: "text-rose-700 dark:text-rose-300",
    modalSubtitle: "Open alerts ranked by total dollar exposure pending resolution",
    emptyHint: "No open revenue exposure alerts.",
  },
  margin_at_risk: {
    accent: "border-amber-300 dark:border-amber-700 hover:border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
    valueTone: "text-amber-700 dark:text-amber-300",
    modalSubtitle: "Current-period margin leakage from pricing errors and contract mismatches",
    emptyHint: "No margin-at-risk alerts open.",
  },
  compliance_exposure: {
    accent: "border-violet-300 dark:border-violet-700 hover:border-violet-400 bg-violet-50/50 dark:bg-violet-950/20",
    valueTone: "text-violet-700 dark:text-violet-300",
    modalSubtitle: "Penalty and legal risk from jurisdiction and regulatory gaps",
    emptyHint: "No compliance exposure on open alerts.",
  },
  predicted_annual_exposure: {
    accent: "border-indigo-300 dark:border-indigo-700 hover:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20",
    valueTone: "text-indigo-700 dark:text-indigo-300",
    modalSubtitle: "Annualized projection if current open issues remain unresolved (×30.5)",
    emptyHint: "No alerts contributing to annualized exposure.",
  },
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function isHighPriority(priority: string): boolean {
  const p = (priority ?? "").trim().toUpperCase();
  return p === "CRITICAL" || p === "HIGH";
}

/** Open alerts only — resolved records must not appear on dashboard tables. */
export function isCfoAlertOpen(alert: { status?: string; alert_id?: string }): boolean {
  if (alert.alert_id && isHighValueRecordApproved(alert.alert_id)) return false;
  const status = (alert.status ?? "Open").trim().toLowerCase();
  if (status !== "open") return false;
  if (alert.alert_id && isCfoAlertResolved(alert.alert_id)) return false;
  return true;
}

/** Highest dollar-exposure open alerts for executive approval (API field or client fallback). */
export function buildCfoHighValueApprovalQueue(
  fromApi: CFOAlert[] | undefined,
  openAlerts: CFOAlert[],
  limit = 1,
): CFOAlert[] {
  const apiRows = (fromApi ?? []).filter(isCfoAlertOpen);
  const source = apiRows.length > 0 ? apiRows : openAlerts.filter(isCfoAlertOpen);
  const designated = source.find((a) => a.alert_id === EXECUTIVE_APPROVAL_CFO_ALERT_ID);
  if (designated) return [designated];
  return [...source]
    .sort((a, b) => b.dollar_exposure - a.dollar_exposure)
    .slice(0, limit);
}

/** Recompute KPI cards from open alert rows (keeps dashboard cards in sync with Top Alerts). */
export function computeCfoKpiCardsFromAlerts(
  openAlerts: CFOAlert[],
  existing?: CFODashboard["kpi_cards"],
): CFODashboard["kpi_cards"] {
  const totalExposure = Math.round(openAlerts.reduce((s, a) => s + a.dollar_exposure, 0));
  const marginAtRisk = Math.round(openAlerts.reduce((s, a) => s + a.margin_at_risk, 0));
  const complianceExposure = Math.round(openAlerts.reduce((s, a) => s + a.penalty_exposure, 0));
  const predictedAnnual = Math.round(totalExposure * 30.5);

  return {
    revenue_at_risk: {
      value: totalExposure,
      label: existing?.revenue_at_risk?.label ?? "Revenue at Risk",
      description:
        existing?.revenue_at_risk?.description ??
        "Total revenue leakage from open issues across tax, pricing, and chargebacks pending resolution",
      trend_label: existing?.revenue_at_risk?.trend_label,
      direction: existing?.revenue_at_risk?.direction,
    },
    margin_at_risk: {
      value: marginAtRisk,
      label: existing?.margin_at_risk?.label ?? "Margin at Risk",
      description:
        existing?.margin_at_risk?.description ??
        "Current-period margin exposure from unresolved pricing errors, tax mismatches, and rebate discrepancies",
      trend_label: existing?.margin_at_risk?.trend_label,
      direction: existing?.margin_at_risk?.direction,
    },
    compliance_exposure: {
      value: complianceExposure,
      label: existing?.compliance_exposure?.label ?? "Compliance Exposure",
      description:
        existing?.compliance_exposure?.description ??
        "Penalty and legal risk from unresolved jurisdiction mismatches and regulatory non-compliance",
      trend_label: existing?.compliance_exposure?.trend_label,
      direction: existing?.compliance_exposure?.direction,
    },
    predicted_annual_exposure: {
      value: predictedAnnual,
      label: existing?.predicted_annual_exposure?.label ?? "Predicted Annual Exposure",
      description:
        existing?.predicted_annual_exposure?.description ??
        "Annualized projection of current-period exposure if open issues remain unresolved",
      trend_label: existing?.predicted_annual_exposure?.trend_label,
      direction: existing?.predicted_annual_exposure?.direction,
    },
  };
}

export const CFO_HEATMAP_TOP_N = 8;

/** Short labels for the CFO dashboard risk heatmap bar chart only. */
const CFO_HEATMAP_ISSUE_TYPE_SHORT: Record<string, string> = {
  "Tax Jurisdiction Mismatch — State Filing Error": "Tax Jurisdiction",
  "Tax Jurisdiction Mismatch": "Tax Jurisdiction",
  "Tax Jurisdiction Mismatch + Pricing Override": "Tax Jurisdiction",
  "Tax Jurisdiction Mismatch — Arizona": "AZ Tax Mismatch",
  "Tax Jurisdiction Mismatch — Post-Invoice": "Post-Invoice Tax",
  "Tax Jurisdiction Mismatch — Post Invoice": "Post-Invoice Tax",
  "Multi-Jurisdiction Compliance Breach": "Multi-Jurisdiction",
  "Compliance Breach — Multi-Jurisdiction Filing": "Multi-Jurisdiction",
  "GPO Contract Non-Compliance — Audit Flag": "GPO Non-Compliance",
  "GPO Contract Non-Compliance": "GPO Non-Compliance",
  "GPO Contract Discrepancy": "GPO Non-Compliance",
  "FDA QMSR Non-Compliance — Documentation Gap": "FDA QMSR",
  "FDA QMSR Non-Compliance — Documentation": "FDA QMSR",
  "Tax Exemption Certificate Expired": "Tax Exemption",
  "Tax Exemption Certificate Expiry": "Tax Exemption",
  "CAPA Deadline Breach Risk": "CAPA Breach",
  "Territory Integrity Compliance Breach": "Territory Integrity",
  "Territory Integrity Compliance": "Territory Integrity",
  "GPO Tier Compliance Mismatch": "GPO Tier",
  "GPO Tier Mismatch": "GPO Tier",
  "Tax Exemption Compliance — Certificate Gap": "Tax Cert",
  "Tax Exemption Compliance — Certificate": "Tax Cert",
  "State Tax Rate Non-Compliance": "State Tax Rate",
  "Tax Rate Discrepancy": "State Tax Rate",
  "GPO Contract Compliance — Chargeback": "GPO Chargeback",
  "GPO Chargeback Dispute": "GPO Chargeback",
  "Chargeback Dispute — Rebate Discrepancy": "GPO Chargeback",
  "Compliance Documentation — Revenue Recognition": "Compliance Docs",
  "Revenue Recognition Timing Error": "Compliance Docs",
  "Pricing Override — List Price Applied": "Pricing Override",
};

/** Normalize dashes/spacing so API/CSV variants still match the short-name map. */
function normalizeCfoIssueTypeKey(issueType: string): string {
  return issueType
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s+/g, " ")
    .trim();
}

const CFO_HEATMAP_ISSUE_TYPE_SHORT_NORM = Object.fromEntries(
  Object.entries(CFO_HEATMAP_ISSUE_TYPE_SHORT).map(([longName, shortName]) => [
    normalizeCfoIssueTypeKey(longName),
    shortName,
  ]),
);

export function cfoHeatmapIssueTypeShortName(issueType: string): string {
  const t = normalizeCfoIssueTypeKey(issueType);
  if (!t) return "Unknown";
  const exact = CFO_HEATMAP_ISSUE_TYPE_SHORT_NORM[t];
  if (exact) return exact;
  const lower = t.toLowerCase();
  for (const [longName, shortName] of Object.entries(CFO_HEATMAP_ISSUE_TYPE_SHORT_NORM)) {
    if (lower.includes(longName) || longName.includes(lower)) {
      return shortName;
    }
  }
  return shortCfoIssueTypeLabel(issueType.trim(), 28);
}

export type CFOHeatmapBarRow = {
  alertId: string;
  accountName: string;
  issueType: string;
  shortIssueType: string;
  label: string;
  severity: "Critical" | "Caution" | "Healthy";
  dollarExposure: number;
  priority: string;
};

/** Top N open alerts by dollar exposure for the CFO dashboard bar heatmap. */
export function buildCfoRiskHeatmapBarRecords(openAlerts: CFOAlert[]): CFOHeatmapBarRow[] {
  return openAlerts
    .filter(isCfoAlertOpen)
    .sort((a, b) => {
      const byExposure = b.dollar_exposure - a.dollar_exposure;
      if (byExposure !== 0) return byExposure;
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    })
    .slice(0, CFO_HEATMAP_TOP_N)
    .map((alert) => {
      const issueType = alert.issue_type?.trim() || "Unknown";
      const shortIssueType = cfoHeatmapIssueTypeShortName(issueType);
      const p = (alert.priority ?? "").trim().toUpperCase();
      let severity: CFOHeatmapBarRow["severity"] = "Healthy";
      if (p === "CRITICAL") severity = "Critical";
      else if (p === "HIGH") severity = "Caution";
      return {
        alertId: alert.alert_id,
        accountName: alert.account_name,
        issueType,
        shortIssueType,
        label: `${alert.account_name} · ${shortIssueType}`,
        severity,
        dollarExposure: Math.round(alert.dollar_exposure),
        priority: alert.priority,
      };
    });
}

export function buildCfoRiskHeatmap(openAlerts: CFOAlert[]): CFORiskHeatmapRow[] {
  const groups = new Map<string, CFOAlert[]>();
  for (const alert of openAlerts) {
    const key = alert.issue_type?.trim() || "Unknown";
    const list = groups.get(key) ?? [];
    list.push(alert);
    groups.set(key, list);
  }
  const rows: CFORiskHeatmapRow[] = [];
  for (const [issue_type, alerts] of groups) {
    const worst = Math.min(...alerts.map((a) => PRIORITY_ORDER[a.priority] ?? 9));
    let severity: CFORiskHeatmapRow["severity"] = "Healthy";
    if (worst === 0) severity = "Critical";
    else if (worst <= 1) severity = "Caution";
    rows.push({
      issue_type,
      severity,
      records_at_risk: alerts.length,
      dollar_exposure: Math.round(alerts.reduce((s, a) => s + a.dollar_exposure, 0)),
    });
  }
  return rows.sort((a, b) => b.dollar_exposure - a.dollar_exposure);
}

export function buildCfoKpiPeriodComparison(
  kpiCards: CFODashboard["kpi_cards"],
): CFOKpiPeriodRow[] {
  const rev = kpiCards.revenue_at_risk?.value ?? 0;
  const mar = kpiCards.margin_at_risk?.value ?? 0;
  const comp = kpiCards.compliance_exposure?.value ?? 0;
  const months: [string, number, number, number][] = [
    ["Dec", 1.26, 1.24, 1.28],
    ["Jan", 1.16, 1.14, 1.18],
    ["Feb", 1.1, 1.08, 1.12],
    ["Mar", 1.06, 1.05, 1.08],
    ["Apr", 1.03, 1.02, 1.04],
    ["May", 1.0, 1.0, 1.0],
  ];
  return months.map(([month, revM, marM, compM]) => ({
    month,
    revenue_at_risk: Math.round(rev * revM),
    margin_at_risk: Math.round(mar * marM),
    compliance_exposure: Math.round(comp * compM),
  }));
}

export const CFO_MONTH_ON_MONTH_SERIES = [
  { dataKey: "revenue_at_risk", name: "Revenue at Risk", color: "#2563eb", format: "money" as const },
  { dataKey: "margin_at_risk", name: "Margin at Risk", color: "#ea580c", format: "money" as const },
  { dataKey: "compliance_exposure", name: "Compliance Exposure", color: "#dc2626", format: "money" as const },
];

export function heatmapSeverityClass(severity: CFORiskHeatmapRow["severity"]): string {
  if (severity === "Critical") return "bg-red-100 text-red-800 dark:bg-red-900/35 dark:text-red-200";
  if (severity === "Caution") return "bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200";
}

/** Solid fill for pictorial heatmap tiles */
export function heatmapSeverityHex(severity: CFORiskHeatmapRow["severity"]): string {
  if (severity === "Critical") return "#ef4444";
  if (severity === "Caution") return "#f59e0b";
  return "#10b981";
}

export function shortCfoIssueTypeLabel(issueType: string, maxLen = 42): string {
  const t = issueType.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

export function kpiTrendArrowClass(direction?: string): string {
  if (direction === "improving") return "text-emerald-600 dark:text-emerald-400";
  if (direction === "worsening") return "text-red-600 dark:text-red-400";
  return "text-slate-500 dark:text-slate-400";
}

export type CfoResolutionTrendRow = {
  kpi: string;
  trend: string;
  status: string;
  direction: string;
};

export const DEFAULT_CFO_RESOLUTION_TREND: CfoResolutionTrendRow[] = [
  { kpi: "Revenue at Risk", trend: "Down 12% vs last period", status: "Improving", direction: "down" },
  { kpi: "Compliance Exposure", trend: "Up 8% vs last period", status: "Needs Attention", direction: "up" },
  { kpi: "Issues Resolved on Time", trend: "74% resolved on time vs target", status: "At Risk", direction: "neutral" },
];

export function resolutionTrendStatusFill(status: string): string {
  if (status === "Improving") return "#10b981";
  if (status === "Needs Attention") return "#f59e0b";
  if (status === "At Risk") return "#ef4444";
  return "#94a3b8";
}

export function parseResolutionTrendPercent(trend: string): number {
  const match = trend.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : 0;
}

export function buildResolutionTrendChartData(rows: CfoResolutionTrendRow[]) {
  return rows.map((row) => ({
    ...row,
    chartValue: parseResolutionTrendPercent(row.trend),
    fill: resolutionTrendStatusFill(row.status),
    kpiShort: row.kpi.length > 24 ? `${row.kpi.slice(0, 23)}…` : row.kpi,
  }));
}

/** Strip resolved rows from every dashboard list (Top Alerts, AI queue, KPI drill-down). */
export function filterOpenCfoDashboard(dashboard: CFODashboard): CFODashboard {
  const top_alerts = dashboard.top_alerts.filter(isCfoAlertOpen);
  const ai_queue = dashboard.ai_queue.filter(isCfoAlertOpen);
  const all_open_alerts = (dashboard.all_open_alerts ?? []).filter(isCfoAlertOpen);
  const high_value_approval_queue = buildCfoHighValueApprovalQueue(
    dashboard.high_value_approval_queue,
    all_open_alerts,
  );
  const kpi_cards = computeCfoKpiCardsFromAlerts(all_open_alerts, dashboard.kpi_cards);
  const totalExposure = kpi_cards.revenue_at_risk.value;
  return {
    ...dashboard,
    top_alerts,
    ai_queue,
    high_value_approval_queue,
    all_open_alerts,
    kpi_cards,
    kpi_period_comparison: buildCfoKpiPeriodComparison(kpi_cards),
    risk_heatmap: buildCfoRiskHeatmap(all_open_alerts),
    headline: {
      ...dashboard.headline,
      open_issues: all_open_alerts.length,
      total_exposure: totalExposure,
      pre_invoice_count: all_open_alerts.filter((a) => a.pre_invoice === 1).length,
      predicted_annual_exposure: kpi_cards.predicted_annual_exposure.value,
    },
  };
}

function sapTimingPhrase(alert: CFOAlert): string {
  return alert.pre_invoice === 1 ? "before invoice generation" : "via post-invoice adjustment";
}

/** Next action for tax owner row — matches Tax Issue Intelligence. */
export function cfoNextActionTax(alert: CFOAlert): string | null {
  if (!alert.tax_owner_id) return null;
  return `Correct ship-to jurisdiction in SAP ${sapTimingPhrase(alert)}`;
}

/** Next action for pricing owner row — matches Pricing Issue Intelligence. */
export function cfoNextActionPricing(alert: CFOAlert): string | null {
  if (!alert.pricing_owner_id) return null;
  const accountId = alert.account_id ?? "";
  const margin = alert.margin_at_risk ?? alert.dollar_exposure ?? 0;
  const issueType = alert.issue_type ?? "";
  if (/(GPO|Pricing|Chargeback|Override)/i.test(issueType)) {
    return `Issue credit memo for ${money(margin)} + update SAP pricing master for ${accountId}`;
  }
  if (/Exemption/i.test(issueType)) {
    return `Apply tax exemption certificate in SAP for ${accountId}`;
  }
  return `Update SAP pricing master for ${accountId}`;
}

/** Client fallback when API omits ai_recommendations — mirrors backend cfo.py builders. */
export function buildCfoAiRecommendationsFromAlert(alert: CFOAlert): string[] {
  const recs: string[] = [];
  const orderId = alert.order_id ?? "";
  const accountId = alert.account_id ?? "";

  if (alert.tax_owner_id) {
    const applied = alert.applied_jurisdiction ?? "prior state";
    const correct = alert.correct_jurisdiction ?? "correct state";
    recs.push(
      `Request Correction ${orderId} jurisdiction from ${applied} to ${correct} + Rquest update for ${accountId} in SAP address master`,
    );
  }

  if (alert.pricing_owner_id) {
    const listPrice = alert.list_price ?? 0;
    const contractPrice = alert.contract_price ?? 0;
    const creditAmount =
      listPrice && contractPrice
        ? Math.max(0, listPrice - contractPrice)
        : alert.margin_at_risk ?? alert.dollar_exposure ?? 0;
    const creditFormatted = creditAmount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    recs.push(
      `Request to Issue credit memo of ${creditFormatted} for ${orderId} + request to update SAP pricing master data for ${accountId}`,
    );
  }

  if (recs.length === 0) {
    recs.push(
      `Request Correction for ${orderId} — coordinate resolution for ${alert.issue_type} and update SAP master data for ${accountId}`,
    );
  }
  return recs;
}

export function ownerLabel(a: CFOAlert): string {
  if (a.tax_owner_name) return a.tax_owner_name;
  if (a.pricing_owner_name) return a.pricing_owner_name;
  return a.cfo_assignee || "Unassigned";
}

/** Hover tooltip — penalty exposure, legal risk, and root cause only */
export function alertRowHiddenDetails(a: CFOAlert): string {
  const parts: string[] = [];

  if (a.penalty_exposure > 0) {
    parts.push(`Penalty exposure: ${money(a.penalty_exposure)}`);
  }
  if (a.legal_risk?.trim()) {
    parts.push(`Legal risk: ${a.legal_risk}`);
  }
  const rootCause = [a.root_cause_primary, a.root_cause_secondary].filter(Boolean).join(" ");
  if (rootCause.trim()) {
    parts.push(`Root cause: ${rootCause}`);
  }

  if (parts.length === 0) {
    return "No additional risk detail for this record.";
  }
  return parts.join("\n");
}

/** Top alerts: highest priority first (CRITICAL → LOW), then tightest SLA within tier */
export function sortTopAlerts(alerts: CFOAlert[]): CFOAlert[] {
  return [...alerts].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9;
    const pb = PRIORITY_ORDER[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.sla_days_remaining - b.sla_days_remaining;
  });
}


export function alertRowSubline(a: CFOAlert): string {
  return `${a.account_id} · ${a.order_id} · SLA ${a.sla_days_remaining}d`;
}

const CFO_ANNUALIZATION_FACTOR = 30.5;

export function cfoKpiDrilldownMetricLabel(key: CFOKpiKey): string {
  switch (key) {
    case "revenue_at_risk":
      return "Revenue at Risk";
    case "margin_at_risk":
      return "Margin at Risk";
    case "compliance_exposure":
      return "Compliance Exposure";
    case "predicted_annual_exposure":
      return "Annualized Exposure";
  }
}

export function cfoKpiDrilldownMetricValue(alert: CFOAlert, key: CFOKpiKey): number {
  switch (key) {
    case "revenue_at_risk":
      return alert.dollar_exposure;
    case "margin_at_risk":
      return alert.margin_at_risk;
    case "compliance_exposure":
      return alert.penalty_exposure;
    case "predicted_annual_exposure":
      return alert.dollar_exposure * CFO_ANNUALIZATION_FACTOR;
  }
}

export function rowsForCfoKpi(key: CFOKpiKey, alerts: CFOAlert[]): CFOAlert[] {
  return sortByDollarDesc(alerts, (row) => cfoKpiDrilldownMetricValue(row, key));
}

export function priorityClass(priority: string): string {
  if (priority === "CRITICAL") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "HIGH") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  if (priority === "MEDIUM") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}
