import { taxStickyBtnInactive, taxStickyBtnPrimary } from "./taxStickyButtonStyles";
import type { TaxIssueWorkflow } from "../../services/api";
import { handleMarkResolvedClick, manualWorkflowHint, type TaxWorkflowPage } from "../../utils/taxWorkflow";
import type { NavigateFunction } from "react-router-dom";

type Props = {
  workflow: TaxIssueWorkflow;
  issueId: string;
  orderId: string;
  page: TaxWorkflowPage;
  navigate: NavigateFunction;
  onNotify: (message: string) => void;
};

export default function TaxMarkResolvedButton({
  workflow,
  issueId,
  orderId,
  page,
  navigate,
  onNotify,
}: Props) {
  const lit = workflow.can_mark_resolved;
  const title = lit
    ? workflow.ai_approved
      ? "AI approved — proceed to Tax Closure"
      : "Manual workflow complete — proceed to Tax Closure"
    : manualWorkflowHint(workflow);

  return (
    <button
      type="button"
      onClick={() =>
        handleMarkResolvedClick({ workflow, issueId, orderId, page, navigate, onNotify })
      }
      className={lit ? taxStickyBtnPrimary : taxStickyBtnInactive}
      title={title}
    >
      Mark Resolved
    </button>
  );
}
