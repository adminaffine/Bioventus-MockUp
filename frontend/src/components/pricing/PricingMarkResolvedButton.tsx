import { pricingStickyBtnInactive, pricingStickyBtnPrimary } from "./pricingStickyButtonStyles";
import type { PricingWorkflowStatus } from "../../services/api";
import { handlePricingMarkResolvedClick, pricingWorkflowHint, type PricingWorkflowPage } from "../../utils/pricingWorkflow";
import type { NavigateFunction } from "react-router-dom";

type Props = {
  workflow: PricingWorkflowStatus;
  issueId: string;
  orderId: string;
  hasOrder: boolean;
  page: PricingWorkflowPage;
  navigate: NavigateFunction;
  onNotify: (message: string) => void;
  onResolve: (issueId: string) => Promise<unknown>;
};

export default function PricingMarkResolvedButton({
  workflow,
  issueId,
  orderId,
  hasOrder,
  page,
  navigate,
  onNotify,
  onResolve,
}: Props) {
  const lit = workflow.can_mark_resolved || !hasOrder;
  const title = lit
    ? workflow.ai_approved
      ? "AI approved — proceed to Pricing Closure"
      : hasOrder
        ? "Credit memo path complete — proceed to Pricing Closure"
        : "Contract renewal path — proceed to Pricing Closure"
    : pricingWorkflowHint(workflow);

  return (
    <button
      type="button"
      onClick={() =>
        handlePricingMarkResolvedClick({
          workflow,
          issueId,
          orderId,
          hasOrder,
          page,
          navigate,
          onNotify,
          onResolve,
        })
      }
      className={lit ? pricingStickyBtnPrimary : pricingStickyBtnInactive}
      title={title}
    >
      Mark Resolved
    </button>
  );
}
