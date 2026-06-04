import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import type { PricingClosure as PricingClosureData } from "../../services/api";
import { usePricingWorkflow } from "../../context/PricingWorkflowContext";
import {
  buildPricingKpiImpactNoteLines,
  formatPricingClosureKpiValue,
  PRICING_KPI_DISPLAY_LABELS,
  pricingClosureKpiRows,
} from "../../utils/pricingClosureFormat";
import { isPricingAiRejected } from "../../utils/pricingWorkflowStorage";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PricingClosure() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { resolveIssue, refreshDashboard } = usePricingWorkflow();
  const [data, setData] = useState<PricingClosureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    resolveIssue(issueId)
      .then(setData)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("cannot be resolved") || msg.includes("credit memo")) {
          setError(
            "Resolution blocked — approve the AI recommendation or complete the credit memo step in Transaction Lineage first.",
          );
        } else {
          setError("Unable to record resolution. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [issueId, resolveIssue]);

  if (loading) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Recording resolution and updating dashboard…
      </div>
    );
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
  const isRenewal =
    rc.resolution_type.toLowerCase().includes("renewal") ||
    rc.resolution_type.toLowerCase().includes("enrollment") ||
    rc.issue.toLowerCase().includes("expiring");
  const kpiEntries = pricingClosureKpiRows(data.kpi_impact);
  const aiRejected = issueId ? isPricingAiRejected(issueId, data.ai_decision) : false;
  const kpiImpactNoteLines = buildPricingKpiImpactNoteLines(data.kpi_impact);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
          {isRenewal ? "Contract Renewal Initiated ✓" : "GPO Conflict Resolved ✓"}
        </h1>
        <p className="mt-2 text-emerald-800 dark:text-emerald-200">
          Compliance exposure recovered: {formatMoney(rc.exposure_recovered)}
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          Pricing dashboard KPIs have been updated.
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
              <td>
                {rc.resolved_by_name} ({rc.resolved_by})
              </td>
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
              <td>{formatMoney(rc.exposure_recovered)}</td>
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
              <tr className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium">Confidence</td>
                <td>{data.ai_action_log.confidence}%</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Logged On</td>
                <td>{data.ai_action_log.logged_on}</td>
              </tr>
            </tbody>
          </table>
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
              const beforeStr = formatPricingClosureKpiValue(key, val.before);
              const afterStr = formatPricingClosureKpiValue(key, val.after);
              const changed = beforeStr !== afterStr;
              return (
                <tr key={key} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">{PRICING_KPI_DISPLAY_LABELS[key] ?? key}</td>
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
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Team</th>
              <th className="py-2 pr-4">Owner</th>
              <th className="py-2 pr-4">What They Were Notified About</th>
            </tr>
          </thead>
          <tbody>
            {data.cross_team_notifications.map((row) => (
              <tr key={row.team} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium">{row.team}</td>
                <td className="py-2 pr-4">{row.owner}</td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{row.notification}</td>
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
            navigate("/pricing-dashboard");
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
