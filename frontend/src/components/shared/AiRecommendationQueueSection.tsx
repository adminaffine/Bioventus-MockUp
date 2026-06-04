import {
  aiQueueApproveBtn,
  aiQueueApprovedBadge,
  aiQueueConfidenceBadge,
  aiQueueRejectedBadge,
  aiQueueSecondaryBtn,
  aiQueueSectionClass,
} from "./aiRecommendationStyles";

export type AiQueueDecision = "approved" | "rejected" | null;

export type AiRecommendationQueueRow = {
  id: string;
  recordLabel: string;
  /** Secondary line under the record id (account, order, status, etc.). */
  recordMeta?: string;
  onRecordClick?: () => void;
  context?: string;
  fix: string;
  confidence: number;
  source: string;
  owner?: string;
  decision?: AiQueueDecision;
};

type Props = {
  rows: AiRecommendationQueueRow[];
  title?: string;
  subtitle?: string;
  contextColumnLabel?: string;
  recommendationColumnLabel?: string;
  recordColumnLabel?: string;
  showContext?: boolean;
  showOwner?: boolean;
  showReject?: boolean;
  showReassign?: boolean;
  pendingId?: string | null;
  onApprove: (id: string) => void;
  onReject?: (id: string) => void;
  onReassign?: (id: string) => void;
  emptyMessage?: string;
  /** When true, omit outer card — for use inside ExecutiveHighValueApprovalSection. */
  embedded?: boolean;
};

function ActionCell({
  row,
  pending,
  showReject,
  showReassign,
  onApprove,
  onReject,
  onReassign,
}: {
  row: AiRecommendationQueueRow;
  pending: boolean;
  showReject: boolean;
  showReassign: boolean;
  onApprove: (id: string) => void;
  onReject?: (id: string) => void;
  onReassign?: (id: string) => void;
}) {
  if (row.decision === "approved") {
    return <span className={aiQueueApprovedBadge}>✓ Approved</span>;
  }
  if (row.decision === "rejected") {
    return <span className={aiQueueRejectedBadge}>✗ Rejected</span>;
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" disabled={pending} onClick={() => onApprove(row.id)} className={aiQueueApproveBtn}>
        {pending ? "Saving…" : "Approve"}
      </button>
      {showReject && onReject ? (
        <button type="button" disabled={pending} onClick={() => onReject(row.id)} className={aiQueueSecondaryBtn}>
          Reject
        </button>
      ) : null}
      {showReassign && onReassign ? (
        <button type="button" disabled={pending} onClick={() => onReassign(row.id)} className={aiQueueSecondaryBtn}>
          Reassign
        </button>
      ) : null}
    </div>
  );
}

export default function AiRecommendationQueueSection({
  rows,
  title = "AI Recommendation Queue",
  subtitle,
  contextColumnLabel = "Context",
  recommendationColumnLabel = "AI Recommendation",
  recordColumnLabel = "Record",
  showContext = false,
  showOwner = false,
  showReject = false,
  showReassign = false,
  pendingId = null,
  onApprove,
  onReject,
  onReassign,
  emptyMessage = "No pending AI recommendations.",
  embedded = false,
}: Props) {
  const Shell = embedded ? "div" : "section";
  return (
    <Shell className={embedded ? "mt-6 pt-6 border-t border-slate-200 dark:border-slate-700" : aiQueueSectionClass}>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{recordColumnLabel}</th>
                {showContext ? (
                  <th className="py-2 pr-4 font-medium whitespace-nowrap">{contextColumnLabel}</th>
                ) : null}
                <th className="py-2 pr-4 font-medium min-w-[14rem]">{recommendationColumnLabel}</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">Confidence</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">Source</th>
                {showOwner ? <th className="py-2 pr-4 font-medium whitespace-nowrap">Owner</th> : null}
                <th className="py-2 pr-4 font-medium text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pending = pendingId === row.id;
                return (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 align-top">
                    <td className="py-3 pr-4 font-medium">
                      <div className="space-y-0.5">
                        {row.onRecordClick ? (
                          <button
                            type="button"
                            onClick={row.onRecordClick}
                            className="text-left text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline"
                          >
                            {row.recordLabel}
                          </button>
                        ) : (
                          <span className="text-slate-800 dark:text-slate-200">{row.recordLabel}</span>
                        )}
                        {row.recordMeta ? (
                          <p className="text-xs font-normal text-slate-500 dark:text-slate-400">{row.recordMeta}</p>
                        ) : null}
                      </div>
                    </td>
                    {showContext ? (
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.context || "—"}</td>
                    ) : null}
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.fix}</td>
                    <td className="py-3 pr-4">
                      <span className={aiQueueConfidenceBadge}>{row.confidence}%</span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400 break-words">{row.source}</td>
                    {showOwner ? (
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.owner || "—"}</td>
                    ) : null}
                    <td className="py-3 pr-4 text-right">
                      <ActionCell
                        row={row}
                        pending={pending}
                        showReject={showReject}
                        showReassign={showReassign}
                        onApprove={onApprove}
                        onReject={onReject}
                        onReassign={onReassign}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
