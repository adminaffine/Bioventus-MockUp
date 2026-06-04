import type { NavigateFunction } from "react-router-dom";
import type { TaxIssueWorkflow } from "../services/api";

export type TaxWorkflowPage = "issue" | "transaction";

export function manualWorkflowHint(workflow: TaxIssueWorkflow): string {
  if (workflow.ai_approved) {
    return "AI fix approved — you can mark this issue resolved.";
  }
  const pending: string[] = [];
  if (!workflow.acknowledged_at) pending.push("Acknowledge on Issue Intelligence (Step 2)");
  if (!workflow.transaction_reviewed_at) pending.push("Open Transaction Lineage (Step 3)");
  if (!workflow.address_update_queued_at) pending.push("Queue Address Master update (Step 3)");
  if (pending.length === 0) {
    return "Manual workflow complete — Mark Resolved is now available.";
  }
  return `Manual 4-step workflow — complete: ${pending.join(" · ")}`;
}

export function handleMarkResolvedClick(args: {
  workflow: TaxIssueWorkflow;
  issueId: string;
  orderId: string;
  page: TaxWorkflowPage;
  navigate: NavigateFunction;
  onNotify: (message: string) => void;
}): void {
  const { workflow, issueId, orderId, page, navigate, onNotify } = args;

  if (workflow.can_mark_resolved) {
    navigate(`/tax/closure/${issueId}`);
    return;
  }

  if (page === "issue") {
    onNotify("Manual workflow — Step 3 of 4: review transaction lineage and queue address update.");
    navigate(`/tax/transaction/${orderId}`);
    return;
  }

  onNotify(manualWorkflowHint(workflow));
}
