import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  aiPanelConfidenceBadge,
  aiQueueApproveBtn,
  aiQueueApprovedBadge,
  aiQueueRejectedBadge,
  aiQueueSecondaryBtn,
  aiRecommendationPanelClass,
} from "../shared/aiRecommendationStyles";
import { useTaxWorkflow } from "../../context/TaxWorkflowContext";
import { clearTaxAiRejected, isTaxAiRejected, markTaxAiRejected } from "../../utils/taxWorkflowStorage";

type Props = {
  issueId: string;
  fix: string;
  confidence: number;
  source: string;
  decision?: "approve" | "reject" | null;
  /** Called after a successful AI action (e.g. reload issue detail). */
  onAfterAction?: () => void;
  /** When true, Approve navigates to Tax Closure after the action completes. */
  navigateOnApprove?: boolean;
  className?: string;
};

function resolveDisplayDecision(
  issueId: string,
  decision?: "approve" | "reject" | null,
): "approve" | "reject" | null {
  if (decision === "approve") return "approve";
  if (decision === "reject" || isTaxAiRejected(issueId, decision)) return "reject";
  return null;
}

export default function TaxAiRecommendationPanel({
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
  const { applyAiAction, approveAndResolve, aiActionPendingId } = useTaxWorkflow();
  const pending = aiActionPendingId === issueId;
  const [displayDecision, setDisplayDecision] = useState<"approve" | "reject" | null>(() =>
    resolveDisplayDecision(issueId, decision),
  );

  useEffect(() => {
    setDisplayDecision(resolveDisplayDecision(issueId, decision));
  }, [issueId, decision]);

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "approve" && navigateOnApprove) {
      try {
        clearTaxAiRejected(issueId);
        setDisplayDecision("approve");
        const closure = await approveAndResolve(issueId);
        onAfterAction?.();
        navigate(`/tax/closure/${issueId}`, { state: { closure } });
      } catch {
        setDisplayDecision(resolveDisplayDecision(issueId, decision));
        onAfterAction?.();
      }
      return;
    }

    if (action === "reject") {
      markTaxAiRejected(issueId);
      setDisplayDecision("reject");
    } else {
      clearTaxAiRejected(issueId);
      setDisplayDecision("approve");
    }

    try {
      await applyAiAction(issueId, action);
      onAfterAction?.();
    } catch {
      clearTaxAiRejected(issueId);
      setDisplayDecision(resolveDisplayDecision(issueId, decision));
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
        {displayDecision === "approve" ? (
          <span className={aiQueueApprovedBadge}>✓ Approved · assigned to Jennifer Mills</span>
        ) : displayDecision === "reject" ? (
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
