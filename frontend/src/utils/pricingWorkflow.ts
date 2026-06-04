import type { NavigateFunction } from "react-router-dom";
import type { PricingWorkflowStatus } from "../services/api";

export type PricingWorkflowPage = "issue" | "transaction";

export function pricingWorkflowHint(workflow: PricingWorkflowStatus): string {
  if (workflow.ai_approved) return "AI fix approved — you can mark this issue resolved.";
  if (workflow.credit_memo_queued) return "Credit memo queued — Mark Resolved is now available.";
  return "Complete credit memo step in Transaction Lineage or approve the AI recommendation.";
}

export function handlePricingMarkResolvedClick(args: {
  workflow: PricingWorkflowStatus;
  issueId: string;
  orderId: string;
  hasOrder: boolean;
  page: PricingWorkflowPage;
  navigate: NavigateFunction;
  onNotify: (message: string) => void;
  onResolve: (issueId: string) => Promise<unknown>;
}): void {
  const { workflow, issueId, orderId, hasOrder, page, navigate, onNotify, onResolve } = args;

  if (workflow.can_mark_resolved) {
    void onResolve(issueId).then(() => navigate(`/pricing/closure/${issueId}`));
    return;
  }

  if (!hasOrder) {
    void onResolve(issueId).then(() => navigate(`/pricing/closure/${issueId}`));
    return;
  }

  if (page === "issue") {
    onNotify("Complete credit memo step in Transaction Lineage first.");
    navigate(`/pricing/transaction/${orderId}`);
    return;
  }

  onNotify(pricingWorkflowHint(workflow));
}
