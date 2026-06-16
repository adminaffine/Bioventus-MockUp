import type { ExecutiveGaugeItem } from "../components/shared/ExecutiveGaugePanel";
import type { CCODashboard, CCOIssue, CCOKpiKey, CCOMonthOnMonthRow } from "../services/api";
import { resolveCcoAssigneeName } from "../config/ccoTeamOwners";
import { EXECUTIVE_APPROVAL_CCO_ISSUE_ID } from "./executiveApprovalRecord";
import { isCcoIssueResolved } from "./ccoWorkflowStorage";
import { isHighValueRecordApproved } from "./highValueRecordSync";
import { sortByDollarDesc } from "./personaKpiSort";
import { buildResolutionTrendGauges } from "./executiveGaugeData";
import { resolutionTrendStatusColor } from "./resolutionTrendChart";

/** Static resolution-trend rows for penalty exposure and CAPA (unchanged from demo baseline). */
const CCO_RESOLUTION_TREND_BASELINE: CCODashboard["compliance_trend"] = [
  { kpi: "Regulatory Penalty Exposure", trend: "Up 9% vs last period", status: "Needs Attention" },
  { kpi: "CAPA Resolution Rate", trend: "68% on-time closure rate vs target", status: "At Risk" },
];

export type { CCODashboard, CCOIssue, CCOKpiKey } from "../services/api";

export const CCO_KPI_ORDER: CCOKpiKey[] = [
  "regulatory_penalty_exposure",
  "capa_breach_risk",
  "audit_readiness_score",
  "predicted_annual_risk",
];

export const CCO_KPI_CARD_META: Record<
  CCOKpiKey,
  { accent: string; valueTone: string; modalSubtitle: string; emptyHint: string }
> = {
  regulatory_penalty_exposure: {
    accent:
      "border-rose-300 dark:border-rose-700 hover:border-rose-400 bg-rose-50/50 dark:bg-rose-950/20",
    valueTone: "text-rose-700 dark:text-rose-300",
    modalSubtitle: "Open issues ranked by regulatory penalty exposure pending resolution",
    emptyHint: "No open regulatory penalty exposure issues.",
  },
  capa_breach_risk: {
    accent:
      "border-amber-300 dark:border-amber-700 hover:border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
    valueTone: "text-amber-700 dark:text-amber-300",
    modalSubtitle: "Issues contributing to CAPA breach or deadline risk",
    emptyHint: "No CAPA breach risk on open issues.",
  },
  audit_readiness_score: {
    accent:
      "border-violet-300 dark:border-violet-700 hover:border-violet-400 bg-violet-50/50 dark:bg-violet-950/20",
    valueTone: "text-violet-700 dark:text-violet-300",
    modalSubtitle: "Each open issue reduces audit readiness by 2% — portfolio score = 100 − (open issues × 2)",
    emptyHint: "No open issues reducing audit readiness.",
  },
  predicted_annual_risk: {
    accent:
      "border-indigo-300 dark:border-indigo-700 hover:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20",
    valueTone: "text-indigo-700 dark:text-indigo-300",
    modalSubtitle: "Annualized regulatory risk if open issues remain unresolved (×43)",
    emptyHint: "No issues contributing to annualized regulatory risk.",
  },
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function isHighPriority(priority: string): boolean {
  const p = (priority ?? "").trim().toUpperCase();
  return p === "CRITICAL" || p === "HIGH";
}

export const CCO_HEATMAP_TOP_N = 8;

/** Short labels for the CCO dashboard risk heatmap bar chart only. */
const CCO_HEATMAP_ISSUE_TYPE_SHORT: Record<string, string> = {
  "Tax Jurisdiction Mismatch — State Filing Error": "Tax Jurisdiction",
  "Multi-Jurisdiction Compliance Breach": "Multi-Jurisdiction",
  "GPO Contract Non-Compliance — Audit Flag": "GPO Non-Compliance",
  "Tax Jurisdiction Mismatch": "Tax Mismatch",
  "FDA QMSR Non-Compliance — Documentation Gap": "FDA QMSR",
  "Tax Exemption Certificate Expired": "Tax Exemption",
  "CAPA Deadline Breach Risk": "CAPA Breach",
  "Territory Integrity Compliance Breach": "Territory Integrity",
  "GPO Tier Compliance Mismatch": "GPO Tier",
  "Tax Exemption Compliance — Certificate Gap": "Tax Cert Gap",
  "State Tax Rate Non-Compliance": "State Tax Rate",
};

function normalizeCcoIssueTypeKey(issueType: string): string {
  return issueType
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

const CCO_HEATMAP_ISSUE_TYPE_SHORT_NORM = Object.fromEntries(
  Object.entries(CCO_HEATMAP_ISSUE_TYPE_SHORT).map(([longName, shortName]) => [
    normalizeCcoIssueTypeKey(longName),
    shortName,
  ]),
);

const CCO_HEATMAP_SHORT_ENTRIES_LONGEST_FIRST = Object.entries(CCO_HEATMAP_ISSUE_TYPE_SHORT_NORM).sort(
  (a, b) => b[0].length - a[0].length,
);

export function ccoHeatmapIssueTypeShortName(issueType: string): string {
  const t = normalizeCcoIssueTypeKey(issueType);
  if (!t) return "Unknown";
  const exact = CCO_HEATMAP_ISSUE_TYPE_SHORT_NORM[t];
  if (exact) return exact;
  const lower = t.toLowerCase();
  for (const [longName, shortName] of CCO_HEATMAP_SHORT_ENTRIES_LONGEST_FIRST) {
    if (lower.includes(longName) || longName.includes(lower)) {
      return shortName;
    }
  }
  return t.length > 28 ? `${t.slice(0, 27)}…` : t;
}

export type CCORiskHeatmapRow = {
  issueId: string;
  accountName: string;
  issueType: string;
  shortIssueType: string;
  riskArea: string;
  label: string;
  severity: "Critical" | "Caution" | "Healthy";
  issuesAtRisk: number;
  penaltyExposure: number;
  priority: string;
};

export function ccoHeatmapSeverityHex(severity: CCORiskHeatmapRow["severity"]): string {
  if (severity === "Critical") return "#ef4444";
  if (severity === "Caution") return "#f59e0b";
  return "#10b981";
}

function ccoHeatmapSeverityFromPriority(priority: string): CCORiskHeatmapRow["severity"] {
  const p = priority.trim().toUpperCase();
  if (p === "CRITICAL") return "Critical";
  if (p === "HIGH") return "Caution";
  return "Healthy";
}

function ccoHeatmapRowFromParts(
  issueId: string,
  issueType: string,
  accountName: string,
  severity: CCORiskHeatmapRow["severity"],
  penaltyExposure: number,
  priority: string,
): CCORiskHeatmapRow {
  const shortIssueType = ccoHeatmapIssueTypeShortName(issueType);
  return {
    issueId,
    accountName,
    issueType,
    shortIssueType,
    riskArea: issueType,
    label: `${accountName} · ${shortIssueType}`,
    severity,
    issuesAtRisk: 1,
    penaltyExposure,
    priority,
  };
}

export function mapCcoHeatmapFromApi(
  rows: NonNullable<CCODashboard["risk_heatmap"]>,
): CCORiskHeatmapRow[] {
  return rows.map((row) => {
    const issueType = row.risk_area?.trim() || "Unknown";
    const accountName = row.label?.split("·")[0]?.trim() || "Unknown";
    return ccoHeatmapRowFromParts(
      row.issue_id,
      issueType,
      accountName,
      row.priority
        ? ccoHeatmapSeverityFromPriority(row.priority)
        : row.severity === "Critical"
          ? "Critical"
          : "Caution",
      row.penalty_exposure,
      row.priority,
    );
  });
}

export function resolveCcoHeatmapRows(dashboard: CCODashboard): CCORiskHeatmapRow[] {
  const openIssues = dashboard.all_open_issues ?? dashboard.top_alerts ?? [];
  if (dashboard.risk_heatmap?.length) {
    return mapCcoHeatmapFromApi(dashboard.risk_heatmap);
  }
  return buildCcoRiskHeatmap(openIssues);
}

export function buildCcoRiskHeatmap(openIssues: CCOIssue[]): CCORiskHeatmapRow[] {
  return openIssues
    .filter(isCCOIssueOpen)
    .sort((a, b) => {
      const byExposure = b.penalty_exposure - a.penalty_exposure;
      if (byExposure !== 0) return byExposure;
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    })
    .slice(0, CCO_HEATMAP_TOP_N)
    .map((issue) => {
      const issueType = issue.issue_type?.trim() || "Unknown";
      return ccoHeatmapRowFromParts(
        issue.issue_id,
        issueType,
        issue.account_name,
        ccoHeatmapSeverityFromPriority(issue.priority ?? ""),
        Math.round(issue.penalty_exposure),
        issue.priority,
      );
    });
}

/** Open issues only — resolved records must not appear on dashboard tables. */
export function isCCOIssueOpen(issue: { status?: string; issue_id?: string }): boolean {
  if (issue.issue_id && isHighValueRecordApproved(issue.issue_id)) return false;
  const status = (issue.status ?? "Open").trim().toLowerCase();
  if (status !== "open") return false;
  if (issue.issue_id && isCcoIssueResolved(issue.issue_id)) return false;
  return true;
}

/** Designated $156K executive approval only — no fallback to other issues. */
export function buildCcoHighValueApprovalQueue(
  fromApi: CCOIssue[] | undefined,
  openIssues: CCOIssue[],
  _limit = 1,
): CCOIssue[] {
  const apiRows = (fromApi ?? []).filter(isCCOIssueOpen);
  const source = apiRows.length > 0 ? apiRows : openIssues.filter(isCCOIssueOpen);
  const designated = source.find((i) => i.issue_id === EXECUTIVE_APPROVAL_CCO_ISSUE_ID);
  return designated ? [designated] : [];
}

function ccoTrendStatusForAudit(value: number): string {
  return value >= 80 ? "Improving" : "Needs Attention";
}

/** Resolution trend API rows — baseline penalty/CAPA + live audit readiness from KPI cards. */
export function buildCcoComplianceTrend(
  kpiCards: CCODashboard["kpi_cards"],
): CCODashboard["compliance_trend"] {
  const audit = kpiCards.audit_readiness_score;
  return [
    ...CCO_RESOLUTION_TREND_BASELINE,
    {
      kpi: audit.label,
      trend: audit.display,
      status: ccoTrendStatusForAudit(audit.value),
    },
  ];
}

/** Resolution trend gauges — penalty/CAPA use demo baseline; audit matches KPI card. */
export function buildCcoResolutionTrendGauges(
  kpiCards: CCODashboard["kpi_cards"],
): ExecutiveGaugeItem[] {
  const audit = kpiCards.audit_readiness_score;
  const auditStatus = ccoTrendStatusForAudit(audit.value);
  const auditArc = Math.min(100, Math.max(0, audit.value));

  return [
    ...buildResolutionTrendGauges(CCO_RESOLUTION_TREND_BASELINE),
    {
      id: "audit_readiness_score",
      label: audit.label,
      percent: auditArc,
      displayValue: audit.display,
      subtitle: "Audit readiness score",
      status: auditStatus,
      color: resolutionTrendStatusColor(auditStatus),
    },
  ];
}

export function buildCcoMonthOnMonth(
  kpiCards: CCODashboard["kpi_cards"],
  openCount: number,
): CCOMonthOnMonthRow[] {
  const penalty = kpiCards.regulatory_penalty_exposure?.value ?? 0;
  const capa = kpiCards.capa_breach_risk?.value ?? 0;
  const months: [string, number, number, number][] = [
    ["Dec", 1.28, 1.22, 1.3],
    ["Jan", 1.18, 1.14, 1.2],
    ["Feb", 1.1, 1.08, 1.12],
    ["Mar", 1.06, 1.05, 1.08],
    ["Apr", 1.03, 1.02, 1.04],
    ["May", 1.0, 1.0, 1.0],
  ];
  return months.map(([month, penM, issM, capM]) => ({
    month,
    penalty_exposure: Math.round(penalty * penM),
    open_issues: Math.max(1, Math.round(openCount * issM)),
    capa_breach_risk: Math.max(0, Math.round(capa * capM)),
  }));
}

export const CCO_MONTH_ON_MONTH_SERIES = [
  { dataKey: "penalty_exposure", name: "Penalty Exposure", color: "#dc2626", format: "money" as const, yAxisId: "left" as const },
  { dataKey: "open_issues", name: "Open Issues", color: "#2563eb", format: "number" as const, yAxisId: "right" as const },
  { dataKey: "capa_breach_risk", name: "CAPA Breach Risk", color: "#16a34a", format: "number" as const, yAxisId: "right" as const },
];

/** Strip resolved rows from every dashboard list (Top Alerts, AI queue, KPI drill-down). */
export function filterOpenCCODashboard(dashboard: CCODashboard): CCODashboard {
  const top_alerts = dashboard.top_alerts.filter(isCCOIssueOpen);
  const ai_queue = dashboard.ai_queue.filter((i) => isCCOIssueOpen(i) && !i.ai_decision);
  const all_open_issues = (dashboard.all_open_issues ?? []).filter(isCCOIssueOpen);
  const high_value_approval_queue = buildCcoHighValueApprovalQueue(
    dashboard.high_value_approval_queue,
    all_open_issues,
  );
  const totalExposure = all_open_issues.reduce((s, i) => s + i.penalty_exposure, 0);
  const annualized = Math.round(totalExposure * 43);
  const capaBreachCount = all_open_issues.filter((i) => i.capa_breach_risk === 1).length;
  const auditValue = ccoAuditReadinessScore(all_open_issues.length);
  const auditDisplay = `${auditValue}%`;
  const kpi_cards = {
      ...dashboard.kpi_cards,
      regulatory_penalty_exposure: {
        ...dashboard.kpi_cards.regulatory_penalty_exposure,
        value: totalExposure,
        display:
          totalExposure >= 1_000_000
            ? `$${(totalExposure / 1_000_000).toFixed(1)}M`
            : `$${Math.round(totalExposure).toLocaleString("en-US")}`,
      },
      capa_breach_risk: {
        ...dashboard.kpi_cards.capa_breach_risk,
        value: capaBreachCount,
        display: String(capaBreachCount),
      },
      audit_readiness_score: {
        ...dashboard.kpi_cards.audit_readiness_score,
        value: auditValue,
        display: auditDisplay,
      },
      predicted_annual_risk: {
        ...dashboard.kpi_cards.predicted_annual_risk,
        value: annualized,
        display:
          annualized >= 1_000_000
            ? `$${(annualized / 1_000_000).toFixed(1)}M`
            : `$${Math.round(annualized).toLocaleString("en-US")}`,
      },
  };
  return {
    ...dashboard,
    top_alerts,
    ai_queue,
    high_value_approval_queue,
    all_open_issues,
    kpi_cards,
    compliance_trend: buildCcoComplianceTrend(kpi_cards),
    month_on_month: buildCcoMonthOnMonth(kpi_cards, all_open_issues.length),
    risk_heatmap: buildCcoRiskHeatmap(all_open_issues).map((row) => ({
      issue_id: row.issueId,
      risk_area: row.issueType,
      label: row.label,
      severity: row.severity === "Healthy" ? "Caution" : row.severity,
      issues_at_risk: row.issuesAtRisk,
      penalty_exposure: row.penaltyExposure,
      priority: row.priority,
    })),
    headline: {
      ...dashboard.headline,
      open_issues: all_open_issues.length,
      total_compliance_exposure: totalExposure,
      pre_invoice: all_open_issues.filter((i) => i.pre_invoice === 1).length,
      annualized_regulatory_risk: annualized,
      display_exposure: totalExposure >= 1_000_000
        ? `$${(totalExposure / 1_000_000).toFixed(1)}M`
        : `$${Math.round(totalExposure).toLocaleString("en-US")}`,
      display_annualized:
        annualized >= 1_000_000
          ? `$${(annualized / 1_000_000).toFixed(1)}M`
          : `$${Math.round(annualized).toLocaleString("en-US")}`,
    },
  };
}

export function ownerLabel(issue: CCOIssue): string {
  if (issue.compliance_owner_name?.trim()) return issue.compliance_owner_name;
  if (issue.tax_owner_name?.trim()) return issue.tax_owner_name;
  const resolved = resolveCcoAssigneeName(issue.cco_assignee);
  if (resolved) return resolved;
  return "Unassigned";
}

/** Hover tooltip — penalty exposure, legal risk, and root cause */
export function issueRowHiddenDetails(issue: CCOIssue): string {
  const parts: string[] = [];

  if (issue.penalty_exposure > 0) {
    parts.push(`Penalty exposure: ${money(issue.penalty_exposure)}`);
  }
  if (issue.legal_risk?.trim()) {
    parts.push(`Legal risk: ${issue.legal_risk}`);
  }
  const rootCause = [issue.root_cause_primary, issue.root_cause_secondary].filter(Boolean).join(" ");
  if (rootCause.trim()) {
    parts.push(`Root cause: ${rootCause}`);
  }

  if (parts.length === 0) {
    return "No additional compliance detail for this record.";
  }
  return parts.join("\n");
}

export function issueRowSubline(issue: CCOIssue): string {
  return `${issue.account_id} · ${issue.order_id} · SLA ${issue.sla_days_remaining}d`;
}

/** Top alerts: highest priority first (CRITICAL → LOW), then tightest SLA within tier */
export function sortTopAlerts(issues: CCOIssue[]): CCOIssue[] {
  return [...issues].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9;
    const pb = PRIORITY_ORDER[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.sla_days_remaining - b.sla_days_remaining;
  });
}

const CCO_ANNUALIZATION_FACTOR = 43;
/** Matches backend _audit_readiness_value — each open issue deducts this many points from 100%. */
export const CCO_AUDIT_READINESS_DEDUCTION_PER_ISSUE = 2;

export function ccoAuditReadinessScore(openCount: number): number {
  return Math.max(0, 100 - openCount * CCO_AUDIT_READINESS_DEDUCTION_PER_ISSUE);
}

export function ccoKpiDrilldownMetricLabel(key: CCOKpiKey): string {
  switch (key) {
    case "regulatory_penalty_exposure":
      return "Regulatory Penalty Exposure";
    case "capa_breach_risk":
      return "CAPA Breach Risk";
    case "audit_readiness_score":
      return "Contribution to Score";
    case "predicted_annual_risk":
      return "Annualized Regulatory Risk";
  }
}

export function ccoKpiDrilldownMetricValue(issue: CCOIssue, key: CCOKpiKey): number {
  switch (key) {
    case "regulatory_penalty_exposure":
      return issue.penalty_exposure;
    case "capa_breach_risk":
      return issue.capa_breach_risk;
    case "audit_readiness_score":
      return CCO_AUDIT_READINESS_DEDUCTION_PER_ISSUE;
    case "predicted_annual_risk":
      return issue.penalty_exposure * CCO_ANNUALIZATION_FACTOR;
  }
}

export function formatCcoKpiDrilldownMetric(issue: CCOIssue, key: CCOKpiKey): string {
  const value = ccoKpiDrilldownMetricValue(issue, key);
  switch (key) {
    case "capa_breach_risk":
      return value === 1 ? "Yes" : "No";
    case "audit_readiness_score":
      return `−${CCO_AUDIT_READINESS_DEDUCTION_PER_ISSUE}%`;
    case "regulatory_penalty_exposure":
    case "predicted_annual_risk":
      return money(value);
  }
}

export function rowsForCcoKpi(key: CCOKpiKey, issues: CCOIssue[]): CCOIssue[] {
  let rows = issues;
  if (key === "capa_breach_risk") {
    rows = issues.filter((i) => i.capa_breach_risk === 1);
  }
  if (key === "audit_readiness_score") {
    return sortTopAlerts(rows);
  }
  return sortByDollarDesc(rows, (row) => ccoKpiDrilldownMetricValue(row, key));
}

export function priorityClass(priority: string): string {
  if (priority === "CRITICAL") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "HIGH") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

export function healthClass(health: string): string {
  if (health === "Breached") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (health === "At Risk") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

export function trendStatusClass(status: string): string {
  if (status === "Improving") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (status === "Needs Attention")
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
}
