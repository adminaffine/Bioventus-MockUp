import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { api, type StewardClosure as StewardClosureData } from "../../services/api";
import { useStewardWorkflow } from "../../context/StewardWorkflowContext";
import {
  buildStewardKpiImpactNoteLines,
  closureStewardKpiRows,
  formatStewardKpiValue,
  STEWARD_KPI_LABELS,
} from "../../utils/stewardClosureFormat";
import { isStewardAiRejected } from "../../utils/stewardWorkflowStorage";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type StewardClosureLocationState = { closure?: StewardClosureData };

export default function StewardClosure() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const closureFromNav = (location.state as StewardClosureLocationState | null)?.closure;
  const { resolveIssue } = useStewardWorkflow();
  const [data, setData] = useState<StewardClosureData | null>(closureFromNav ?? null);
  const [loading, setLoading] = useState(!closureFromNav);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;
    if (closureFromNav) {
      setData(closureFromNav);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    resolveIssue(issueId)
      .then(setData)
      .catch(() => api.getStewardClosure(issueId).then(setData))
      .catch(() => setError("Unable to record resolution. Please try again."))
      .finally(() => setLoading(false));
  }, [issueId, closureFromNav, resolveIssue]);

  if (loading) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Recording resolution and updating dashboard…
      </div>
    );
  }
  if (error) {
    return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>;
  }
  if (!data) return null;

  const kpiEntries = closureStewardKpiRows(data.kpi_impact);
  const aiRejected = issueId ? isStewardAiRejected(issueId) : false;
  const kpiImpactNoteLines = buildStewardKpiImpactNoteLines(data.kpi_impact);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-900 dark:text-emerald-100">Master Data Corrected ✓</h1>
        <p className="mt-2 text-emerald-800 dark:text-emerald-200">
          Downstream exposure removed: {money(data.resolution_confirmation.exposure_removed)}
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          Data governance dashboard KPIs have been updated.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Resolution Confirmation</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium w-40">Issue</td>
              <td>{data.resolution_confirmation.issue}</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Resolved By</td>
              <td>
                {data.resolution_confirmation.resolved_by_name} ({data.resolution_confirmation.resolved_by})
              </td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Date</td>
              <td>{data.resolution_confirmation.date}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">Resolution Type</td>
              <td>{data.resolution_confirmation.resolution_type}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Next Actions</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {data.what_was_updated.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {!aiRejected && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Action Log</h2>
          <table className="mt-4 min-w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium w-36">Recommendation</td>
                <td>{data.ai_action_log.recommendation}</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium">Approved By</td>
                <td>{data.ai_action_log.approved_by}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Confidence</td>
                <td>{data.ai_action_log.confidence}%</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

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
            {kpiEntries.map(([key, val]) => {
              const beforeStr = formatStewardKpiValue(key, val.before);
              const afterStr = formatStewardKpiValue(key, val.after);
              const changed = beforeStr !== afterStr;
              return (
                <tr key={key} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">{STEWARD_KPI_LABELS[key] ?? key}</td>
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
            {data.cross_team_notifications.map((row) => (
              <tr key={row.team} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium">{row.team}</td>
                <td className="py-2 pr-4">{row.owner ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{row.notified_about}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex justify-center pb-8">
        <button
          type="button"
          onClick={() => navigate("/steward-dashboard")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
