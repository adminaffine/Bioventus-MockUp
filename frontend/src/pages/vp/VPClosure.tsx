import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { api, type VPClosure as VPClosureData } from "../../services/api";
import { useVPWorkflow } from "../../context/VPWorkflowContext";
import {
  buildVPClosureHeroTitle,
  formatVPClosureKpiValue,
  VP_KPI_DISPLAY_LABELS,
  vpClosureKpiRows,
} from "../../utils/vpClosureFormat";
import { formatVPMoney, scorecardSlaStatus } from "../../utils/vpDashboard";

export default function VPClosure() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { refreshDashboard } = useVPWorkflow();
  const [data, setData] = useState<VPClosureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    api
      .getVPClosure(issueId)
      .then(setData)
      .catch(() => setError("Unable to load closure details. Complete an action from the dashboard or issue detail first."))
      .finally(() => setLoading(false));
  }, [issueId]);

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading closure summary…</div>;
  }
  if (error) return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (!data?.resolution_confirmation) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        Unable to load closure details. Return to the dashboard and try again.
      </div>
    );
  }

  const rc = data.resolution_confirmation;
  const heroTitle = buildVPClosureHeroTitle(data.action_taken, rc.resolution_type);
  const kpiEntries = vpClosureKpiRows(data.kpi_impact);
  const pattern = data.recurring_pattern;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{heroTitle}</h1>
        <p className="mt-2 text-emerald-800 dark:text-emerald-200">
          Exposure addressed: {formatVPMoney(rc.exposure_recovered)}
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          Operations dashboard KPIs and team scorecard have been updated.
        </p>
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
              <td>{formatVPMoney(rc.exposure_recovered)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">SLA Performance</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2 pr-4">Resolved At</th>
              <th className="py-2 pr-4">SLA Limit</th>
              <th className="py-2 pr-4">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {data.sla_performance.map((row) => {
              const outcomeBadge =
                row.sla_outcome === "On Time"
                  ? scorecardSlaStatus("On Track")
                  : scorecardSlaStatus("At Risk");
              return (
                <tr key={row.owner} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">{row.owner_name}</td>
                  <td className="py-2 pr-4">{row.resolved_at}</td>
                  <td className="py-2 pr-4">{row.sla_limit}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${outcomeBadge.className}`}>{row.sla_outcome}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recurring Pattern</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium w-44">Issue Type</td>
              <td>{pattern.issue_type ?? "—"}</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Recurrence</td>
              <td>
                {pattern.recurrence_count ?? 0} occurrence(s) {pattern.period ?? ""}
              </td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Team</td>
              <td>{pattern.team ?? "—"}</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">CAPA Exists</td>
              <td>{pattern.capa_exists ?? "—"}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">CAPA IDs</td>
              <td>{(pattern.capa_ids ?? []).join(", ") || "—"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Next Actions</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {(data.what_was_updated?.length ? data.what_was_updated : data.next_actions ?? []).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.ai_action_log.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Action Log</h2>
          <div className="mt-4 space-y-4">
            {data.ai_action_log.map((entry) => (
              <table key={entry.fix} className="min-w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium w-36">Recommendation</td>
                    <td>{entry.fix}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium">Approved By</td>
                    <td>{entry.approved_by}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium">Confidence</td>
                    <td>{entry.confidence}%</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Logged On</td>
                    <td>{entry.logged_on}</td>
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Impact on Dashboard</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">KPI</th>
              <th className="py-2 pr-4">Before</th>
              <th className="py-2 pr-4">After</th>
            </tr>
          </thead>
          <tbody>
            {kpiEntries.map(([key, val]) => {
              const label = VP_KPI_DISPLAY_LABELS[key] ?? key;
              const beforeStr = formatVPClosureKpiValue(key, val.before, val.unit);
              const afterStr = formatVPClosureKpiValue(key, val.after, val.unit);
              const changed = beforeStr !== afterStr;
              return (
                <tr key={key} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">{label}</td>
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
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cross-Team Notification</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Team</th>
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2 pr-4">Team Status</th>
              <th className="py-2 pr-4">What They Were Notified About</th>
            </tr>
          </thead>
          <tbody>
            {data.cross_team_notifications.map((row, i) => (
              <tr key={`${row.team}-${i}`} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium">{row.team}</td>
                <td className="py-2 pr-4">{row.owner ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {row.team_status ?? "—"}
                </td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                  {row.notification ?? row.notified_about ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex justify-center pb-8">
        <button
          type="button"
          onClick={async () => {
            await refreshDashboard({ silent: true });
            navigate("/vp-dashboard");
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
