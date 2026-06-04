import { useNavigate } from "react-router-dom";
import {
  aiPanelConfidenceBadge,
  aiQueueApproveBtn,
  aiQueueApprovedBadge,
  aiQueueSecondaryBtn,
  aiRecommendationPanelClass,
} from "../shared/aiRecommendationStyles";
import { useVPWorkflow } from "../../context/VPWorkflowContext";

type Props = {
  issueId: string;
  fix: string;
  confidence: number;
  source: string;
  decision?: "approve" | null;
  onAfterAction?: () => void;
  /** Navigate to closure after approve (dashboard / issue detail). */
  navigateOnApprove?: boolean;
  onReassign?: () => void;
  className?: string;
};

export default function VPAiRecommendationPanel({
  issueId,
  fix,
  confidence,
  source,
  decision,
  onAfterAction,
  navigateOnApprove = false,
  onReassign,
  className = "",
}: Props) {
  const navigate = useNavigate();
  const { approveIssue, aiActionPendingId } = useVPWorkflow();
  const pending = aiActionPendingId === issueId;

  const handleApprove = async () => {
    await approveIssue(issueId);
    onAfterAction?.();
    if (navigateOnApprove) navigate(`/vp/closure/${issueId}`);
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
          <span className={aiQueueApprovedBadge}>✓ Approved · pending owner resolution</span>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => void handleApprove()} className={aiQueueApproveBtn}>
              {pending ? "Saving…" : "Approve"}
            </button>
            {onReassign ? (
              <button type="button" disabled={pending} onClick={onReassign} className={aiQueueSecondaryBtn}>
                Reassign
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
