import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiDrilldownModal from "../../components/shared/KpiDrilldownModal";
import PersonaKpiCard, { formatPersonaKpiValue, PersonaKpiCardGrid } from "../../components/shared/PersonaKpiCard";
import AiRecommendationQueueSection, {
  type AiRecommendationQueueRow,
} from "../../components/shared/AiRecommendationQueueSection";
import { useStewardWorkflow } from "../../context/StewardWorkflowContext";
import type { StewardIssueRow } from "../../services/api";
import { markStewardAiRejected, stewardCtaPulseClassAmber } from "../../utils/stewardWorkflowStorage";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function priorityClass(priority: string): string {
  if (priority === "HIGH" || priority === "CRITICAL") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

function ActionRequiredDot({ title = "AI recommendation rejected — manual action required" }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-amber-300/60 shrink-0"
      aria-hidden
    />
  );
}

function isAiRejected(row: StewardIssueRow, local: Record<string, "approved" | "rejected">): boolean {
  return local[row.issue_id] === "rejected" || row.ai_decision === "reject";
}

export default function StewardDashboard() {
  const navigate = useNavigate();
  const { dashboard: data, loading, dashboardRevision, applyAiAction, approveAndResolve, aiActionPendingId } =
    useStewardWorkflow();
  const [aiDecisions, setAiDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const [activeKpiModal, setActiveKpiModal] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const fromApi: Record<string, "approved" | "rejected"> = {};
    const sources = [...data.my_action_queue, ...data.ai_queue, ...(data.all_open_issues ?? [])];
    for (const row of sources) {
      if (row.ai_decision === "approve") fromApi[row.issue_id] = "approved";
      if (row.ai_decision === "reject") fromApi[row.issue_id] = "rejected";
    }
    setAiDecisions((prev) => ({ ...fromApi, ...prev }));
  }, [data]);

  const handleAiApprove = async (issueId: string) => {
    try {
      const closure = await approveAndResolve(issueId);
      setAiDecisions((s) => ({ ...s, [issueId]: "approved" }));
      navigate(`/steward/closure/${issueId}`, { state: { closure } });
    } catch {
      /* keep user on dashboard if resolve fails */
    }
  };

  const handleAiReject = async (issueId: string) => {
    await applyAiAction(issueId, "reject");
    markStewardAiRejected(issueId);
    setAiDecisions((s) => ({ ...s, [issueId]: "rejected" }));
  };

  if (loading && !data) return <div className="text-sm text-slate-500">Loading...</div>;
  if (!data) return null;

  const displayKpiCards = [
    ...data.kpi_cards,
    {
      name: "Total Exposure",
      value: data.headline.total_exposure,
      unit: "dollars",
      description: "Total open downstream exposure across active steward issues.",
      filter_type: "total_exposure",
    },
    {
      name: "Annualized Exposure",
      value: data.headline.annualized_exposure,
      unit: "dollars",
      description: "Projected annualized exposure if these issues remain unresolved.",
      filter_type: "annualized_exposure",
    },
  ];

  const rows = data.all_open_issues.filter((r) => {
    if (activeKpiModal === "hierarchy") return r.issue_type === "Hierarchy Mismatch";
    if (activeKpiModal === "orphan") return r.issue_type === "Orphan Record";
    if (activeKpiModal === "tax_gap") return r.issue_type === "Tax Jurisdiction Gap";
    if (activeKpiModal === "stale") return r.issue_type === "Stale Master Record";
    if (activeKpiModal === "duplicate") return r.issue_type === "Duplicate Suspect";
    if (activeKpiModal === "total_exposure") return true;
    if (activeKpiModal === "annualized_exposure") return true;
    return false;
  });

  const activeKpiCard = displayKpiCards.find((k) => k.filter_type === activeKpiModal);

  const aiQueueRows: AiRecommendationQueueRow[] = data.ai_queue.map((row) => ({
    id: row.issue_id,
    recordLabel: row.issue_id,
    onRecordClick: () => navigate(`/steward/issue/${row.issue_id}`),
    context: row.current_idn_name || "No IDN mapped",
    fix: row.ai_fix,
    confidence: row.ai_confidence,
    source: row.ai_source,
    decision: aiDecisions[row.issue_id] ?? null,
  }));

  return (
    <div key={dashboardRevision} className="space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Data Governance Dashboard</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {displayKpiCards
            .filter((kpi) => kpi.name !== "Total Exposure" && kpi.name !== "Annualized Exposure")
            .map((kpi) => (
              <span
                key={`pill-${kpi.name}`}
                className={`text-xs px-3 py-1 rounded-full ${
                  kpi.name === "Hierarchy Mapping Issues"
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                    : kpi.name === "Orphan Records"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : kpi.name === "Tax Jurisdiction Gaps"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : kpi.name === "Stale Master Records"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {kpi.unit === "dollars"
                  ? `${kpi.name}: ${money(kpi.value)}`
                  : `${kpi.value} ${kpi.name.toLowerCase()}`}
              </span>
            ))}
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            Total Exposure: {money(data.headline.total_exposure)}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            Annualized Exposure: {money(data.headline.annualized_exposure)}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Data Quality Health</h2>
        <div className="mt-4 space-y-4">
          {data.data_quality_health.map((m) => (
            <div className="flex flex-wrap items-center gap-4" key={m.metric}>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 w-64">{m.metric}</span>
              <div className="flex-1 min-w-[120px] h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${m.score >= 90 ? "bg-emerald-500" : m.score >= 75 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, m.score)}%` }}
                />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300 w-10">{m.score}%</span>
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <PersonaKpiCardGrid singleRow>
        {displayKpiCards.map((k) => (
          <PersonaKpiCard
            key={k.name}
            label={k.name}
            valueDisplay={formatPersonaKpiValue(k.value, k.unit, money)}
            description={k.description}
            onClick={() => setActiveKpiModal(k.filter_type)}
          />
        ))}
      </PersonaKpiCardGrid>

      {activeKpiModal && activeKpiCard && (
        <KpiDrilldownModal
          title={activeKpiCard.name}
          subtitle={activeKpiCard.description}
          valueDisplay={activeKpiCard.unit === "dollars" ? money(activeKpiCard.value) : String(activeKpiCard.value)}
          recordCount={rows.length}
          onClose={() => setActiveKpiModal(null)}
          emptyHint="No matching open issues."
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Issue ID</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">$ Value</th>
                <th className="py-2 pr-4">IDN</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">SLA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.issue_id}
                  onClick={() => {
                    setActiveKpiModal(null);
                    navigate(`/steward/issue/${r.issue_id}`);
                  }}
                  className="border-b border-slate-100 dark:border-slate-700/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <td className="py-2 pr-4 font-medium">{r.issue_id}</td>
                  <td className="py-2 pr-4">{r.customer_name}</td>
                  <td className="py-2 pr-4">{r.issue_type}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(r.priority)}`}>{r.priority}</span>
                  </td>
                  <td className="py-2 pr-4">{money(r.dollar_value)}</td>
                  <td className="py-2 pr-4">{r.current_idn || "—"}</td>
                  <td className="py-2 pr-4">{r.owner_name}</td>
                  <td className="py-2 pr-4">{r.sla_days_remaining} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </KpiDrilldownModal>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Top Alerts</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Portfolio view — AI recommendations and high-priority issues ({data.top_alerts.length} shown)
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Issue ID</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">$ Value</th>
                <th className="py-2 pr-4">Owner</th>
              </tr>
            </thead>
            <tbody>
              {data.top_alerts.map((row) => (
                <tr
                  key={row.issue_id}
                  onClick={() => navigate(`/steward/issue/${row.issue_id}`)}
                  className="border-b border-slate-100 dark:border-slate-700/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <td className="py-2 pr-4 font-medium">{row.issue_id}</td>
                  <td className="py-2 pr-4">{row.customer_name}</td>
                  <td className="py-2 pr-4">{row.issue_type}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>{row.priority}</span>
                  </td>
                  <td className="py-2 pr-4">{money(row.dollar_value)}</td>
                  <td className="py-2 pr-4">{row.owner_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AiRecommendationQueueSection
        rows={aiQueueRows}
        subtitle="Your AI-eligible issues from Top Alerts"
        showContext
        showReject
        pendingId={aiActionPendingId}
        onApprove={(issueId) => void handleAiApprove(issueId)}
        onReject={(issueId) => void handleAiReject(issueId)}
        emptyMessage="No pending AI recommendations — all high-confidence fixes reviewed."
      />

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Action Queue</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Issue ID</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">$ Value</th>
                <th className="py-2 pr-4">SLA</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {data.my_action_queue.map((row) => {
                const rejected = isAiRejected(row, aiDecisions);
                return (
                  <tr key={row.issue_id} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {rejected && <ActionRequiredDot />}
                        {row.issue_id}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{row.issue_type}</td>
                    <td className="py-2 pr-4">{row.customer_name}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{money(row.dollar_value)}</td>
                    <td className="py-2 pr-4">{row.sla_days_remaining} days</td>
                    <td className="py-2 pr-4">{row.owner_name}</td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/steward/issue/${row.issue_id}`)}
                        className={`text-white text-sm px-3 py-1.5 rounded-lg ${
                          rejected
                            ? `bg-amber-600 hover:bg-amber-700 ${stewardCtaPulseClassAmber}`
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {rejected ? "Act Now" : "Fix"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
