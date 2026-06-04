import { useNavigate } from "react-router-dom";
import {
  aiPanelConfidenceBadge,
  aiQueueApproveBtn,
  aiQueueApprovedBadge,
  aiQueueRejectedBadge,
  aiQueueSecondaryBtn,
  aiRecommendationPanelStewardClass,
} from "../shared/aiRecommendationStyles";
import { useStewardWorkflow } from "../../context/StewardWorkflowContext";
import { clearStewardAiRejected, markStewardAiRejected } from "../../utils/stewardWorkflowStorage";

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

export default function StewardAiRecommendationPanel({
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
  const { applyAiAction, approveAndResolve, aiActionPendingId } = useStewardWorkflow();
  const pending = aiActionPendingId === issueId;

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "reject") {
      await applyAiAction(issueId, action);
      markStewardAiRejected(issueId);
      onAfterAction?.();
      return;
    }

    if (navigateOnApprove) {
      clearStewardAiRejected(issueId);
      try {
        const closure = await approveAndResolve(issueId);
        onAfterAction?.();
        navigate(`/steward/closure/${issueId}`, { state: { closure } });
      } catch {
        onAfterAction?.();
      }
      return;
    }

    clearStewardAiRejected(issueId);
    await applyAiAction(issueId, "approve");
    onAfterAction?.();
  };

  return (
    <section className={`${aiRecommendationPanelStewardClass} ${className}`}>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Recommendation</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{fix}</p>
      <div className="mt-2 flex flex-wrap gap-2 items-center">
        <span className={aiPanelConfidenceBadge}>{confidence}% confidence</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{source}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {decision === "approve" ? (
          <span className={aiQueueApprovedBadge}>✓ Approved · pending SAP master update</span>
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
