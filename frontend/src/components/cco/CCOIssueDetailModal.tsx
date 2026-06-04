import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api, type CCOIssue } from "../../services/api";
import { issueRowHiddenDetails, ownerLabel, priorityClass, sortTopAlerts } from "../../utils/ccoDashboard";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type Props = {
  riskArea: string;
  issues: CCOIssue[];
  onClose: () => void;
};

export default function CCOIssueDetailModal({ riskArea, issues, onClose }: Props) {
  const sorted = useMemo(() => sortTopAlerts(issues), [issues]);
  const primaryIssueId = sorted[0]?.issue_id;
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getCCOIssueDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!primaryIssueId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getCCOIssueDetail(primaryIssueId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load issue detail"))
      .finally(() => setLoading(false));
  }, [primaryIssueId]);

  const totalExposure = issues.reduce((sum, i) => sum + i.penalty_exposure, 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Issue Detail</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{riskArea}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {issues.length} issue{issues.length === 1 ? "" : "s"} at risk · {money(totalExposure)} penalty exposure
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">Penalty</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">SLA</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((issue) => (
                <tr key={issue.issue_id} title={issueRowHiddenDetails(issue)} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4">{issue.account_name}</td>
                  <td className="py-2 pr-4">{issue.issue_type}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(issue.priority)}`}>{issue.priority}</span>
                  </td>
                  <td className="py-2 pr-4">{money(issue.penalty_exposure)}</td>
                  <td className="py-2 pr-4">{ownerLabel(issue)}</td>
                  <td className="py-2 pr-4">{issue.sla_days_remaining}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <p className="mt-5 text-sm text-slate-500">Loading primary issue detail…</p>}
        {error && <p className="mt-5 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {detail && !loading && (
          <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Primary Record Context</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{detail.what_happened}</p>
          </div>
        )}
      </div>
    </div>
  );
}

