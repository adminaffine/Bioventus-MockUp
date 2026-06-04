import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { api, type TaxClosure as TaxClosureData, type TaxIssueRow } from "../../services/api";
import { useTaxWorkflow } from "../../context/TaxWorkflowContext";
import { taxClosureKpiImpactForDisplay } from "../../utils/executiveClosureKpiPatch";
import { findTaxIssueRow } from "../../utils/taxDashboardSync";
import {
  buildTaxKpiImpactNoteLines,
  closureKpiRows,
  formatClosureKpiValue,
  KPI_DISPLAY_LABELS,
} from "../../utils/taxClosureFormat";
import { isTaxAiRejected } from "../../utils/taxWorkflowStorage";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type TaxClosureLocationState = { closure?: TaxClosureData };

export default function TaxClosure() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const closureFromNav = (location.state as TaxClosureLocationState | null)?.closure;
  const { resolveIssue, refreshDashboard, dashboard, dashboardRevision } = useTaxWorkflow();
  const [data, setClosure] = useState<TaxClosureData | null>(closureFromNav ?? null);
  const [resolvedIssue, setResolvedIssue] = useState<TaxIssueRow | null>(null);
  const [loading, setLoading] = useState(!closureFromNav);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;
    if (closureFromNav) {
      setClosure(closureFromNav);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    resolveIssue(issueId)
      .then(setClosure)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("manual") || msg.includes("Approve the AI")) {
          setError(
            "Resolution blocked — approve the AI recommendation or complete the manual 4-step workflow (acknowledge → transaction review → address update) before closure.",
          );
        } else {
          setError("Unable to record resolution. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [issueId, closureFromNav, resolveIssue]);

  useEffect(() => {
    if (!issueId) return;
    const fromDashboard = dashboard ? findTaxIssueRow(dashboard, issueId) : undefined;
    if (fromDashboard) {
      setResolvedIssue(fromDashboard);
      return;
    }
    void api.getTaxIssue(issueId).then((detail) => setResolvedIssue(detail.issue)).catch(() => setResolvedIssue(null));
  }, [issueId, dashboard, dashboardRevision]);

  const kpiImpact = useMemo(() => {
    if (!data || !issueId) return data?.kpi_impact ?? {};
    if (!dashboard) return data.kpi_impact;
    return taxClosureKpiImpactForDisplay(data.kpi_impact, issueId, dashboard, resolvedIssue);
  }, [data, issueId, dashboard, dashboardRevision, resolvedIssue]);

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Recording resolution and updating dashboard…</div>;
  }
  if (error) {
    return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>;
  }
  if (!data) return null;

  const rc = data.resolution_confirmation;
  const kpiEntries = closureKpiRows(kpiImpact);
  const aiRejected = issueId ? isTaxAiRejected(issueId) : false;
  const kpiImpactNoteLines = buildTaxKpiImpactNoteLines(kpiImpact);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-900 dark:text-emerald-100">Jurisdiction Corrected ✓</h1>
        <p className="mt-2 text-emerald-800 dark:text-emerald-200">
          Compliance exposure recovered: {formatMoney(rc.exposure_recovered)}
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          Tax dashboard KPIs have been updated.
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
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">KPI</th>
              <th className="py-2 pr-4">Before</th>
              <th className="py-2 pr-4">After</th>
            </tr>
          </thead>
          <tbody>
            {kpiEntries.map(([key, val]) => {
              const beforeStr = formatClosureKpiValue(key, val.before);
              const afterStr = formatClosureKpiValue(key, val.after);
              const changed = beforeStr !== afterStr;
              return (
                <tr key={key} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">{KPI_DISPLAY_LABELS[key] ?? key.replace(/_/g, " ")}</td>
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
            await refreshDashboard();
            navigate("/tax-dashboard");
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
