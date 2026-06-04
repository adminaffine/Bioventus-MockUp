import type { ExecutiveApprovalRow } from "../../utils/executiveApprovalRecord";
import { aiQueueApproveBtn, aiQueueSectionClass } from "./aiRecommendationStyles";

type Props = {
  record: ExecutiveApprovalRow | null;
  sectionTitle: string;
  formatMoney: (n: number) => string;
  onApprove: () => void;
  onViewDetails: () => void;
  pending?: boolean;
  approved?: boolean;
  successMessage?: string | null;
  emptyMessage?: string;
};

export default function ExecutiveHighValueApprovalSection({
  record,
  sectionTitle,
  formatMoney,
  onApprove,
  onViewDetails,
  pending = false,
  approved = false,
  successMessage = null,
  emptyMessage = "No high-value records require approval.",
}: Props) {
  return (
    <section className={aiQueueSectionClass} aria-label={sectionTitle}>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{sectionTitle}</h2>

      {!record || approved ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {!record ? emptyMessage : "This record has been approved."}
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums leading-none">
              {formatMoney(record.exposure)}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={onApprove}
              className={aiQueueApproveBtn}
            >
              {pending ? "Saving…" : "Approve"}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Issue type
              </p>
              <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200 break-words">{record.issueType}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Customer
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
                {record.customerName}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Issue ID
              </p>
              <p className="mt-0.5 font-mono text-sm text-slate-700 dark:text-slate-300 break-all">{record.issueId}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewDetails}
            className="mt-5 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:underline"
          >
            View details
          </button>
        </div>
      )}

      {successMessage ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          {successMessage}
        </p>
      ) : null}
    </section>
  );
}
