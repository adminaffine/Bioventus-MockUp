import type { VPDashboard, VPHeadline, VPIssueRow, VPKpiCard, VPTeamHealthRow, VPTeamScorecardRow } from "../services/api";
import { VP_DEMO_BASELINE, VP_TEAM_SCORECARD_BASELINE } from "../config/vpDemoBaseline";
import { sortByDollarDesc } from "./personaKpiSort";
import { getVpClosedIssueIds, isVpIssueResolved, VP_TOP_ALERTS_LIMIT } from "./vpWorkflowStorage";

export function formatVPMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function priorityClass(priority: string): string {
  const p = priority.toUpperCase();
  if (p === "CRITICAL" || p === "HIGH") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (p === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

export function slaClass(slaHealth: string, daysRemaining?: number): string {
  const health = (slaHealth || "").toLowerCase();
  if (health === "breached" || (daysRemaining !== undefined && daysRemaining <= 0)) {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
  if (health === "at risk" || (daysRemaining !== undefined && daysRemaining <= 2)) {
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  }
  if (health === "watch" || health === "awaiting assignment" || (daysRemaining !== undefined && daysRemaining <= 5)) {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  }
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

export function slaStatusLabel(daysRemaining: number, slaHealth?: string): string {
  if (daysRemaining <= 0 || slaHealth === "Breached") return "Breached — SLA exceeded";
  if (daysRemaining === 1) return "1 day to SLA breach";
  if (daysRemaining === 2) return "2 days remaining";
  return `${daysRemaining} days remaining`;
}

export function teamHealthStatusClass(status: string): string {
  switch (status) {
    case "At Risk":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "Watch":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "On Track":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  }
}

const SCORECARD_SLA_LABELS = ["At Risk", "Watch", "On Track", "Breached"] as const;

function normalizeScorecardSlaLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return SCORECARD_SLA_LABELS.includes(trimmed as (typeof SCORECARD_SLA_LABELS)[number]) ? trimmed : null;
}

/** SLA Status column badges: At Risk / Watch / On Track */
export function scorecardSlaStatus(
  rowOrStatus:
    | (Pick<VPTeamScorecardRow, "sla_status" | "health_status"> & { sla_breach_risk?: string | number })
    | string,
): { label: string; className: string } {
  const label =
    typeof rowOrStatus === "string"
      ? (normalizeScorecardSlaLabel(rowOrStatus) ?? (rowOrStatus.trim() || "Watch"))
      : normalizeScorecardSlaLabel(rowOrStatus.sla_status) ??
        normalizeScorecardSlaLabel(rowOrStatus.sla_breach_risk) ??
        normalizeScorecardSlaLabel(rowOrStatus.health_status) ??
        "Watch";
  if (label === "At Risk" || label === "Breached") {
    return { label, className: teamHealthStatusClass("At Risk") };
  }
  if (label === "Watch") return { label, className: teamHealthStatusClass("Watch") };
  return { label, className: teamHealthStatusClass("On Track") };
}

export function healthClass(status: string): string {
  switch (status) {
    case "At Risk":
      return "text-red-600 dark:text-red-400 font-medium";
    case "Watch":
      return "text-yellow-600 dark:text-yellow-400 font-medium";
    case "On Track":
      return "text-emerald-600 dark:text-emerald-400 font-medium";
    default:
      return "text-slate-600 dark:text-slate-300";
  }
}

export function teamHealthBarColor(score: number): string {
  if (score < 70) return "bg-red-500";
  if (score < 80) return "bg-yellow-500";
  return "bg-emerald-500";
}

/** VP-approved or session-resolved issues must not appear on the dashboard as open. */
export function isVpIssueStillOpen(issue: VPIssueRow, closedIds?: ReadonlySet<string>): boolean {
  const closed = closedIds instanceof Set ? closedIds : getVpClosedIssueIds();
  if (closed.has(issue.issue_id)) return false;
  const status = (issue.status || "Open").trim().toLowerCase();
  if (status !== "open") return false;
  if (issue.ai_decision === "approve") return false;
  if (isVpIssueResolved(issue.issue_id)) return false;
  return true;
}

/** Rebuild top alerts from open issues — highest dollar exposure first. */
export function buildVpTopAlerts(openIssues: VPIssueRow[]): VPIssueRow[] {
  const eligible = openIssues.filter((issue) => isVpIssueStillOpen(issue));
  return sortByDollarDesc(eligible, (i) => i.dollar_exposure).slice(0, VP_TOP_ALERTS_LIMIT);
}

/** Portfolio headline KPIs derived from open issue rows (matches backend filters). */
export function isVpSlaRiskIssue(issue: VPIssueRow): boolean {
  const health = (issue.sla_health || "").trim();
  const sla = issue.sla_days_remaining ?? 999;
  return health === "At Risk" || health === "Breached" || sla <= 2;
}

export function isVpEscalationIssue(issue: VPIssueRow): boolean {
  return ["CRITICAL", "HIGH"].includes((issue.priority || "").toUpperCase());
}

export function computeVpHeadlineFromOpenIssues(open: VPIssueRow[]): VPHeadline {
  const resolvedCount = Math.max(0, VP_DEMO_BASELINE.totalOpenIssues - open.length);
  return {
    total_open_issues: open.length,
    sla_breach_risk: open.filter(isVpSlaRiskIssue).length,
    escalation_queue: open.filter(isVpEscalationIssue).length,
    team_resolution_rate: Math.min(100, VP_DEMO_BASELINE.teamResolutionRate + resolvedCount * 2),
  };
}

/** @deprecated Use computeVpHeadlineFromOpenIssues — kept for callers passing resolved count only. */
export function computeVpEffectiveHeadline(resolvedCount: number): VPHeadline {
  return {
    total_open_issues: Math.max(0, VP_DEMO_BASELINE.totalOpenIssues - resolvedCount),
    sla_breach_risk: Math.max(0, VP_DEMO_BASELINE.slaBreachRisk - Math.floor(resolvedCount / 2)),
    escalation_queue: Math.max(0, VP_DEMO_BASELINE.escalationQueue - resolvedCount),
    team_resolution_rate: Math.min(100, VP_DEMO_BASELINE.teamResolutionRate + resolvedCount * 2),
  };
}

function patchVpKpiCardsFromHeadline(cards: VPKpiCard[], headline: VPHeadline): VPKpiCard[] {
  return cards.map((card) => {
    if (card.filter_type === "pending") return { ...card, value: headline.total_open_issues };
    if (card.filter_type === "sla_risk") return { ...card, value: headline.sla_breach_risk };
    if (card.filter_type === "escalation") return { ...card, value: headline.escalation_queue };
    if (card.filter_type === "resolution_rate") return { ...card, value: headline.team_resolution_rate };
    return card;
  });
}

/** Team scorecard open counts from live open issues — sums align with headline total. */
export function computeVpTeamScorecardFromOpen(open: VPIssueRow[]): VPTeamScorecardRow[] {
  return VP_TEAM_SCORECARD_BASELINE.map((row) => {
    const openCount = open.filter((issue) => issue.team === row.team).length;
    const resolvedDelta = Math.max(0, row.open_issues - openCount);
    return {
      ...row,
      open_issues: openCount,
      resolution_rate: Math.min(100, row.resolution_rate + resolvedDelta * 2),
    };
  });
}

/** Remove a VP-closed issue (approve / reassign / escalate) from all dashboard queues immediately. */
export function patchDashboardAfterVpClosedAction(dashboard: VPDashboard, issueId: string): VPDashboard {
  const without = (rows: VPIssueRow[]) => rows.filter((r) => r.issue_id !== issueId);
  return filterOpenVPDashboard({
    ...dashboard,
    all_open_issues: without(dashboard.all_open_issues),
    ai_queue: without(dashboard.ai_queue),
    top_alerts: without(dashboard.top_alerts),
  });
}

export function filterOpenVPDashboard(dashboard: VPDashboard, closedIds?: ReadonlySet<string>): VPDashboard {
  const closed = closedIds instanceof Set ? closedIds : getVpClosedIssueIds();
  const isOpen = (issue: VPIssueRow) => isVpIssueStillOpen(issue, closed);

  // Merge rows from every queue so a stale API slice cannot keep a closed issue visible.
  const openById = new Map<string, VPIssueRow>();
  for (const row of [...dashboard.all_open_issues, ...dashboard.top_alerts, ...dashboard.ai_queue]) {
    if (isOpen(row)) openById.set(row.issue_id, row);
  }
  const open = [...openById.values()];
  const topAlerts = buildVpTopAlerts(open);
  const aiQueue = dashboard.ai_queue.filter(isOpen).slice(0, 3);
  const headline = computeVpHeadlineFromOpenIssues(open);
  const kpi_cards = patchVpKpiCardsFromHeadline(dashboard.kpi_cards, headline);
  const team_scorecard = computeVpTeamScorecardFromOpen(open);
  return {
    ...dashboard,
    headline,
    kpi_cards,
    team_scorecard,
    top_alerts: topAlerts,
    ai_queue: aiQueue,
    all_open_issues: open,
  };
}

export function rowsForVpFilter(issues: VPIssueRow[], filterType: string): VPIssueRow[] {
  let rows = issues;
  if (filterType === "sla_risk") {
    rows = issues.filter(isVpSlaRiskIssue);
  } else if (filterType === "escalation") {
    rows = issues.filter(isVpEscalationIssue);
  }
  return sortByDollarDesc(rows, (row) => row.dollar_exposure);
}

export function displayAiFix(row: VPIssueRow): string {
  return row.ai_fix_1 || row.ai_fix || "";
}

export function displayAiConfidence(row: VPIssueRow): number {
  return row.ai_confidence_1 ?? row.ai_confidence ?? 0;
}

export function displayAiSource(row: VPIssueRow): string {
  return row.ai_source_1 || row.ai_source || "";
}

export function teamHealthRows(dashboard: VPDashboard): VPTeamHealthRow[] {
  return dashboard.team_health ?? [];
}

export function teamScorecardRows(dashboard: VPDashboard): VPTeamScorecardRow[] {
  return dashboard.team_scorecard?.length ? dashboard.team_scorecard : VP_TEAM_SCORECARD_BASELINE;
}
