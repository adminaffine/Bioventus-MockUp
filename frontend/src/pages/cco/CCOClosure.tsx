import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useCCOWorkflow, type CCOClosure } from "../../context/CCOWorkflowContext";
import {
  buildCcoKpiImpactNoteLines,
  closureCcoKpiRows,
  formatCCOKpiValue,
  CCO_KPI_LABELS,
} from "../../utils/ccoClosureFormat";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CCOClosure() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { approveAlert, refreshDashboard } = useCCOWorkflow();
  const [data, setData] = useState<CCOClosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;
    setLoading(true);
    setLoadError(null);
    approveAlert(issueId)
      .then(setData)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to record resolution"))
      .finally(() => setLoading(false));
  }, [issueId, approveAlert]);

  if (loading) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Recording resolution and updating dashboard…
      </div>
    );
  }
  if (loadError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-6 text-sm text-red-800 dark:text-red-200">
        {loadError ?? "Closure data unavailable."}
        <button type="button" className="mt-3 block text-indigo-600" onClick={() => navigate("/cco-dashboard")}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const rc = data.resolution_confirmation;
  const kpiRows = closureCcoKpiRows(data.kpi_impact);
  const kpiImpactNoteLines = buildCcoKpiImpactNoteLines(data.kpi_impact);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-900 dark:text-emerald-100">Compliance Exposure Resolved ✓</h1>
        <p className="mt-2 text-emerald-800 dark:text-emerald-200">
          Exposure recovered: {money(rc.exposure_recovered)}
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">CCO dashboard KPIs have been updated.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Resolution Confirmation</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium w-40">Issue</td>
              <td>{rc.issue}</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Resolved By</td>
              <td>{rc.resolved_by}</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Date</td>
              <td>{rc.date}</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Resolution Type</td>
              <td>{rc.resolution_type}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">Exposure Recovered</td>
              <td>{money(rc.exposure_recovered)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Next Actions</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {data.what_was_updated.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Action Log</h2>
        <div className="mt-4 space-y-4">
          {data.ai_action_log.map((entry, i) => (
            <table key={i} className="min-w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium w-36">Recommendation</td>
                  <td>{entry.fix}</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">Approved By</td>
                  <td>{entry.approved_by}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Confidence</td>
                  <td>{entry.confidence}%</td>
                </tr>
              </tbody>
            </table>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Impact on Dashboard</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">KPI</th>
              <th className="py-2 pr-4">Before</th>
              <th className="py-2 pr-4">After</th>
            </tr>
          </thead>
          <tbody>
            {kpiRows.map(([key, vals]) => {
              const beforeStr = formatCCOKpiValue(key, vals.before);
              const afterStr = formatCCOKpiValue(key, vals.after);
              const changed = beforeStr !== afterStr;
              return (
                <tr key={key} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">{CCO_KPI_LABELS[key] ?? key}</td>
                  <td className="py-2 pr-4">{beforeStr}</td>
                  <td
                    className={`py-2 pr-4 font-medium ${
                      changed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {afterStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
          <p className="font-medium text-slate-700 dark:text-slate-200">Note:</p>
          {kpiImpactNoteLines.map((line) => (
            <p key={line} className="mt-0.5">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cross-Team Notification</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Team</th>
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2 pr-4">What They Were Notified About</th>
            </tr>
          </thead>
          <tbody>
            {data.cross_team_notifications.map((n) => (
              <tr key={`${n.team}-${n.notification}`} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium">{n.team}</td>
                <td className="py-2 pr-4">{n.owner ?? "—"}</td>
                <td className="py-2 pr-4">{n.notification}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex justify-center pb-8">
        <button
          type="button"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold"
          onClick={() => {
            void refreshDashboard();
            navigate("/cco-dashboard");
          }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
