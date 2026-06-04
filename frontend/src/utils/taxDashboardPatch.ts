import type { TaxDashboard, TaxIssueRow } from "../services/api";

const LOGGED_IN_OWNER = { owner_id: "TAX-03", owner_name: "Jennifer Mills" };

/** Optimistic dashboard update after AI approve/reject (matches Pricing: reject stays in queue). */
export function patchDashboardAfterAiAction(
  dashboard: TaxDashboard,
  issueId: string,
  action: "approve" | "reject",
): TaxDashboard {
  const issue =
    dashboard.ai_queue.find((r) => r.issue_id === issueId) ??
    dashboard.all_open_issues.find((r) => r.issue_id === issueId);
  if (!issue) return dashboard;

  const patched: TaxIssueRow = {
    ...issue,
    ...LOGGED_IN_OWNER,
    ai_decision: action,
    urgency_label:
      action === "approve"
        ? "AI fix approved — pending SAP jurisdiction update"
        : "AI rejected — follow prescribed manual actions",
  };

  const all_open_issues = dashboard.all_open_issues.map((r) =>
    r.issue_id === issueId ? patched : r,
  );
  let ai_queue = dashboard.ai_queue.map((r) => (r.issue_id === issueId ? patched : r));
  if (action === "approve") {
    ai_queue = ai_queue.filter((r) => r.issue_id !== issueId);
  } else if (!ai_queue.some((r) => r.issue_id === issueId)) {
    ai_queue = [...ai_queue, patched];
  }
  const my_action_queue = [
    ...dashboard.my_action_queue.filter((r) => r.issue_id !== issueId),
    patched,
  ];

  return { ...dashboard, all_open_issues, ai_queue, my_action_queue };
}
