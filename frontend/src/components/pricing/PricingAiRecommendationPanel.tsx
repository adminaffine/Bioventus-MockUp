import { useNavigate } from "react-router-dom";
import {
  aiPanelConfidenceBadge,
  aiQueueApproveBtn,
  aiQueueApprovedBadge,
  aiQueueRejectedBadge,
  aiQueueSecondaryBtn,
  aiRecommendationPanelClass,
} from "../shared/aiRecommendationStyles";
import { usePricingWorkflow } from "../../context/PricingWorkflowContext";
import { markPricingAiRejected, clearPricingAiRejected } from "../../utils/pricingWorkflowStorage";

type Props = {
  issueId: string;
  fix: string;
  confidence: number;
  source: string;
  decision?: "approve" | "reject" | null;
  onAfterAction?: () => void;
  /** Navigate to closure after approve (dashboard / issue intelligence). */
  navigateOnApprove?: boolean;
  className?: string;
};

export default function PricingAiRecommendationPanel({
  issueId,
  fix,
  confidence,
  source,
  decision,
  onAfterAction,
  navigateOnApprove = false,
  className = "",
}: Props) {
  const navigate = useNavigate();
  const { applyAiAction, aiActionPendingId } = usePricingWorkflow();
  const pending = aiActionPendingId === issueId;

  const handleAction = async (action: "approve" | "reject") => {
    await applyAiAction(issueId, action);
    if (action === "reject") {
      markPricingAiRejected(issueId);
    } else {
      clearPricingAiRejected(issueId);
    }
    onAfterAction?.();
    if (action === "approve" && navigateOnApprove) {
      navigate(`/pricing/closure/${issueId}`);
    }
  };

  return (
    <section className={`${aiRecommendationPanelClass} ${className}`}>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Recommendation</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{fix}</p>
      <div className="mt-2 flex flex-wrap gap-2 items-center">
        <span className={aiPanelConfidenceBadge}>{confidence}% confidence</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{source}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {decision === "approve" ? (
          <span className={aiQueueApprovedBadge}>✓ Approved · pending SAP pricing master update</span>
        ) : decision === "reject" ? (
          <span className={aiQueueRejectedBadge}>✗ Rejected · follow prescribed manual actions</span>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => void handleAction("approve")} className={aiQueueApproveBtn}>
              {pending ? "Saving…" : "Approve"}
            </button>
            <button type="button" disabled={pending} onClick={() => void handleAction("reject")} className={aiQueueSecondaryBtn}>
              Reject
            </button>
          </>
        )}
      </div>
    </section>
  );
}
