import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import KpiDrilldownModal from "../../components/shared/KpiDrilldownModal";
import PersonaKpiCard, { formatPersonaKpiValue, PersonaKpiCardGrid } from "../../components/shared/PersonaKpiCard";
import AiRecommendationQueueSection, {
  type AiRecommendationQueueRow,
} from "../../components/shared/AiRecommendationQueueSection";
import { usePricingWorkflow } from "../../context/PricingWorkflowContext";
import type { PricingIssueRow, PricingKpiCard } from "../../services/api";
import { sortByDollarDesc } from "../../utils/personaKpiSort";
import {
  markPricingAiRejected,
  clearPricingAiRejected,
  pricingCtaPulseClass,
  pricingCtaPulseClassAmber,
} from "../../utils/pricingWorkflowStorage";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function priorityClass(priority: string): string {
  if (priority === "CRITICAL" || priority === "HIGH") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

function ActionRequiredDot({ title = "AI recommendation rejected — manual action required" }: { title?: string }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" title={title}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
    </span>
  );
}

function isAiRejected(row: PricingIssueRow, local: Record<string, "approved" | "rejected">): boolean {
  return local[row.issue_id] === "rejected" || row.ai_decision === "reject";
}

function displayIssueValue(row: PricingIssueRow): number {
  const memoAmount = Number(row.overcharge_per_unit || 0) * Number(row.quantity_affected || 0);
  if (memoAmount > 0) return memoAmount;
  return Number(row.dollar_value || 0);
}

function rowAnnualizedExposure(row: PricingIssueRow): number {
  return displayIssueValue(row) * 12;
}

function rowsForFilter(
  issues: PricingIssueRow[],
  filterType: string,
  cardName?: string,
): PricingIssueRow[] {
  const visibleIssues = issues.filter((i) => i.issue_type !== "No GPO Membership");
  const exposureFilter =
    cardName === "Annualized Exposure" ? "annualized" : cardName === "Compliance Exposure" ? "all" : filterType;
  let rows = visibleIssues;
  if (exposureFilter === "conflict") {
    rows = visibleIssues.filter((i) =>
      i.issue_type === "GPO Pricing Conflict" || i.issue_type === "GPO Chargeback Dispute",
    );
    return sortByDollarDesc(rows, (row) => row.dollar_value);
  } else if (filterType === "expiring") {
    rows = visibleIssues.filter((i) => i.issue_type === "Contract Expiring");
  } else if (filterType === "recalled") {
    rows = visibleIssues.filter((i) => i.issue_type === "Product Recalled");
  }
  const dollarPick =
    exposureFilter === "annualized"
      ? (row: PricingIssueRow) => rowAnnualizedExposure(row)
      : (row: PricingIssueRow) => displayIssueValue(row);
  return sortByDollarDesc(rows, dollarPick);
}

function KpiIssuesTable({
  rows,
  onRowClick,
  formatValue,
}: {
  rows: PricingIssueRow[];
  onRowClick: (id: string) => void;
  formatValue?: (row: PricingIssueRow) => string;
}) {
  const valueFor = formatValue ?? ((row: PricingIssueRow) => formatMoney(row.dollar_value));
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No matching open issues.</p>;
  }
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
          <th className="py-2 pr-4">Issue ID</th>
          <th className="py-2 pr-4">Customer</th>
          <th className="py-2 pr-4">Product</th>
          <th className="py-2 pr-4">Issue Type</th>
          <th className="py-2 pr-4">Priority</th>
          <th className="py-2 pr-4">$ Value</th>
          <th className="py-2 pr-4">Owner</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.issue_id}
            onClick={() => onRowClick(row.issue_id)}
            className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer"
          >
            <td className="py-2 pr-4 font-medium">{row.issue_id}</td>
            <td className="py-2 pr-4">{row.customer_name}</td>
            <td className="py-2 pr-4">{row.product}</td>
            <td className="py-2 pr-4">{row.issue_type}</td>
            <td className="py-2 pr-4">
              <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>{row.priority}</span>
            </td>
            <td className="py-2 pr-4">{valueFor(row)}</td>
            <td className="py-2 pr-4">{row.owner_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PricingDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dashboard: data, dashboardRevision, loading, applyAiAction, aiActionPendingId, refreshDashboard, resolveIssue } =
    usePricingWorkflow();
  const [activeKpiModal, setActiveKpiModal] = useState<string | null>(null);
  const [aiDecisions, setAiDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const dashboardVisitedRef = useRef(false);

  useEffect(() => {
    if (location.pathname === "/pricing-dashboard") {
      void refreshDashboard({ silent: dashboardVisitedRef.current });
      dashboardVisitedRef.current = true;
    }
  }, [location.pathname, refreshDashboard]);

  useEffect(() => {
    if (!data) return;
    const fromApi: Record<string, "approved" | "rejected"> = {};
    for (const row of data.all_open_issues) {
      if (row.ai_decision === "approve") fromApi[row.issue_id] = "approved";
      if (row.ai_decision === "reject") fromApi[row.issue_id] = "rejected";
    }
    setAiDecisions((prev) => ({ ...fromApi, ...prev }));
  }, [data]);

  const handleKpiRowClick = (issueId: string) => {
    setActiveKpiModal(null);
    navigate(`/pricing/issue/${issueId}`);
  };

  const handleAiApprove = async (issueId: string) => {
    await applyAiAction(issueId, "approve");
    clearPricingAiRejected(issueId);
    setAiDecisions((s) => ({ ...s, [issueId]: "approved" }));
    const closure = await resolveIssue(issueId);
    navigate(`/pricing/closure/${issueId}`, { state: { closure } });
  };

  const topAlertsRows = useMemo(() => {
    if (!data) return [];
    return sortByDollarDesc(data.top_alerts, (row) => displayIssueValue(row));
  }, [data]);

  if (loading && !data) return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  if (!data) return null;

  const activeCard = data.kpi_cards.find((c) => c.name === activeKpiModal || c.filter_type === activeKpiModal);
  const modalRows = activeCard
    ? rowsForFilter(data.all_open_issues, activeCard.filter_type, activeCard.name)
    : [];
  const nudgeNextPriorityIssueId = data.ai_queue.length === 0 ? data.my_action_queue[0]?.issue_id ?? null : null;
  const annualizedExposureTotal =
    data.kpi_cards.find((c) => c.name === "Annualized Exposure")?.value ?? data.headline.total_exposure * 12;

  const aiQueueRows: AiRecommendationQueueRow[] = data.ai_queue.map((row) => ({
    id: row.issue_id,
    recordLabel: row.customer_name,
    context: `${row.applied_tier} → ${row.correct_tier}`,
    fix: row.ai_fix,
    confidence: row.ai_confidence,
    source: row.ai_source,
    decision: aiDecisions[row.issue_id] ?? null,
  }));

  return (
    <div key={dashboardRevision} className="space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pricing Exposure Dashboard</h1>
        <div
          key={`h-${data.headline.total_exposure}-${data.headline.active_conflicts}-${data.headline.expiring_contracts}-${annualizedExposureTotal}`}
          className="mt-3 flex flex-wrap gap-2"
        >
          <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Exposure - {formatMoney(data.headline.total_exposure)}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            {data.headline.active_conflicts} conflicts
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
            {data.headline.expiring_contracts} contracts expiring
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            Annualized Exposure - {formatMoney(annualizedExposureTotal)}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Data Quality Health</h2>
        <div
          key={data.data_quality_health.map((r) => `${r.metric}-${r.score}`).join("|")}
          className="mt-4 space-y-4"
        >
          {data.data_quality_health.map((row) => (
            <div key={`${row.metric}-${row.score}`} className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 w-56">{row.metric}</span>
              <div className="flex-1 min-w-[120px] h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.score < 90 ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, row.score)}%` }}
                />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300 w-10">{row.score}%</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  row.status === "Healthy"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                }`}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <PersonaKpiCardGrid key={data.kpi_cards.map((c) => `${c.name}-${c.value}`).join("|")} columns={5}>
        {data.kpi_cards.map((card: PricingKpiCard) => (
          <PersonaKpiCard
            key={`${card.name}-${card.value}`}
            label={card.name}
            valueDisplay={formatPersonaKpiValue(card.value, card.unit, formatMoney)}
            description={card.description}
            onClick={() => setActiveKpiModal(card.name)}
          />
        ))}
      </PersonaKpiCardGrid>

      {activeKpiModal && activeCard && (
        <KpiDrilldownModal
          title={activeCard.name}
          subtitle={activeCard.description}
          valueDisplay={`${activeCard.value} ${activeCard.unit}`}
          recordCount={modalRows.length}
          onClose={() => setActiveKpiModal(null)}
          emptyHint="No matching open issues."
        >
          <KpiIssuesTable
            rows={modalRows}
            onRowClick={handleKpiRowClick}
            formatValue={
              activeCard.name === "Annualized Exposure"
                ? (row) => formatMoney(rowAnnualizedExposure(row))
                : activeCard.name === "Compliance Exposure"
                  ? (row) => formatMoney(displayIssueValue(row))
                  : undefined
            }
          />
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
              {topAlertsRows.map((row) => (
                <tr
                  key={row.issue_id}
                  onClick={() => navigate(`/pricing/issue/${row.issue_id}`)}
                  className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer"
                >
                  <td className="py-2 pr-4 font-medium">{row.issue_id}</td>
                  <td className="py-2 pr-4">{row.customer_name}</td>
                  <td className="py-2 pr-4">{row.issue_type}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>{row.priority}</span>
                  </td>
                  <td className="py-2 pr-4">{formatMoney(displayIssueValue(row))}</td>
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
        onReject={async (issueId) => {
          await applyAiAction(issueId, "reject");
          markPricingAiRejected(issueId);
          setAiDecisions((s) => ({ ...s, [issueId]: "rejected" }));
        }}
      />

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Action Queue</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Issue ID</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Product</th>
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
                const nudgeNextPriority = !rejected && nudgeNextPriorityIssueId === row.issue_id;
                return (
                <tr key={row.issue_id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {rejected && <ActionRequiredDot />}
                      {row.issue_id}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{row.issue_type}</td>
                  <td className="py-2 pr-4">{row.product}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>{row.priority}</span>
                  </td>
                  <td className="py-2 pr-4">{formatMoney(displayIssueValue(row))}</td>
                  <td className="py-2 pr-4">{row.sla_days_remaining} days</td>
                  <td className="py-2 pr-4">{row.owner_name}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/pricing/issue/${row.issue_id}`)}
                      className={`text-white text-sm px-3 py-1.5 rounded-lg ${
                        rejected
                          ? `bg-amber-600 hover:bg-amber-700 ${pricingCtaPulseClassAmber}`
                          : nudgeNextPriority
                            ? `bg-indigo-600 hover:bg-indigo-700 ${pricingCtaPulseClass}`
                          : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                    >
                      {rejected || nudgeNextPriority ? "Act Now" : "Triage"}
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
