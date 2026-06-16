import type { VPTeamScorecardRow } from "../services/api";

/** Canonical VP / Director demo baseline — matches seed CSV + backend headline constants. */
export const VP_DEMO_BASELINE = {
  /** Portfolio-wide headline KPI (synthetic — not row count from vp_alerts.csv). */
  totalOpenIssues: 47,
  slaBreachRisk: 9,
  escalationQueue: 4,
  teamResolutionRate: 71,
  /** Top Alerts table shows up to this many rows, sorted by SLA urgency. */
  topAlertsLimit: 8,
  /** Rows in backend/data/csv/vp_alerts.csv (seed detail records). */
  seedIssueCount: 47,
  /** High-confidence AI fixes awaiting VP approval at baseline. */
  aiQueueCount: 3,
  demoIssueId: "VP-ISS-001",
  demoAccount: "Northeast Medical",
  demoOrderId: "ORD-031",
  topAlertIssueIds: [
    "VP-ISS-001",
    "VP-ISS-002",
    "VP-ISS-003",
    "VP-ISS-004",
    "VP-ISS-005",
    "VP-ISS-006",
    "VP-ISS-007",
    "VP-ISS-008",
  ] as const,
  aiQueueIssueIds: ["VP-ISS-001", "VP-ISS-002", "VP-ISS-003"] as const,
  teamScorecardTeams: ["Tax & Compliance Team", "Pricing Team", "Finance Team"] as const,
} as const;

/** Baseline team scorecard — open_issues sum to totalOpenIssues (47). */
export const VP_TEAM_SCORECARD_BASELINE: VPTeamScorecardRow[] = [
  {
    team: "Tax & Compliance Team",
    open_issues: 26,
    sla_status: "At Risk",
    resolution_rate: 66,
    health_status: "At Risk",
    health_detail: "CAPA-007 contributor unresolved; 2 issues within 1 day of SLA breach",
  },
  {
    team: "Pricing Team",
    open_issues: 9,
    sla_status: "Watch",
    resolution_rate: 79,
    health_status: "Watch",
    health_detail: "Resolution rate improving but SLA risk remains",
  },
  {
    team: "Finance Team",
    open_issues: 12,
    sla_status: "On Track",
    resolution_rate: 81,
    health_status: "On Track",
    health_detail: "Lowest breach risk this period",
  },
];

export function formatVpBaselineHeadline(): string {
  const b = VP_DEMO_BASELINE;
  return `${b.totalOpenIssues} open issues · ${b.slaBreachRisk} SLA breach risks · ${b.escalationQueue} in priority queue · ${b.teamResolutionRate}% team resolution rate`;
}

export function formatVpDashboardContextBanner(): string {
  return `Operations View — ${formatVpBaselineHeadline()} · ${VP_DEMO_BASELINE.topAlertsLimit} top alerts by SLA urgency`;
}
