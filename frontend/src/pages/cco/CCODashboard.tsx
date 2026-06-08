import { useMemo, useState } from "react";
import type { CCOIssue } from "../../services/api";
import ExecutiveHighValueApprovalSection from "../../components/shared/ExecutiveHighValueApprovalSection";
import KpiDrilldownModal from "../../components/shared/KpiDrilldownModal";
import PersonaKpiCard, { PersonaKpiCardGrid } from "../../components/shared/PersonaKpiCard";
import CCOIssueDetailModal from "../../components/cco/CCOIssueDetailModal";
import CCORiskHeatmapVisual from "../../components/cco/CCORiskHeatmapVisual";
import CCOResolutionTrendChart from "../../components/cco/CCOResolutionTrendChart";
import MonthOnMonthChart from "../../components/shared/MonthOnMonthChart";
import {
  EXEC_CHART_PANEL_BODY,
  EXEC_CHART_PANEL_HEADER,
  EXEC_MONTH_ON_MONTH_CHART_HEIGHT,
  EXEC_SIDE_PANEL_CONTENT_HEIGHT,
} from "../../config/executiveDashboardLayout";
import { useCCOWorkflow } from "../../context/CCOWorkflowContext";
import {
  buildCcoMonthOnMonth,
  CCO_HEATMAP_TOP_N,
  CCO_KPI_CARD_META,
  CCO_KPI_ORDER,
  CCO_MONTH_ON_MONTH_SERIES,
  ccoKpiDrilldownMetricLabel,
  formatCcoKpiDrilldownMetric,
  issueRowHiddenDetails,
  resolveCcoHeatmapRows,
  rowsForCcoKpi,
  type CCOKpiKey,
  type CCORiskHeatmapRow,
} from "../../utils/ccoDashboard";
import { fmtCCOCompact } from "../../utils/ccoClosureFormat";
import {
  ccoIssueToApprovalRow,
  pickCcoExecutiveApprovalRecord,
} from "../../utils/executiveApprovalRecord";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const sectionCard =
  "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6";

const panelShell = `${sectionCard} flex flex-col h-full min-h-0`;

const sectionTitle = "text-xl font-bold text-slate-900 dark:text-slate-100";

const sectionSubtitle = "mt-1 text-xs text-slate-500 dark:text-slate-400 leading-snug";

export default function CCODashboard() {
  const { dashboard, loading, error, dashboardRevision, refreshDashboard, approveAlert } =
    useCCOWorkflow();
  const [kpiModalKey, setKpiModalKey] = useState<CCOKpiKey | null>(null);
  const [heatmapRow, setHeatmapRow] = useState<CCORiskHeatmapRow | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalApproved, setApprovalApproved] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalDetailIssue, setApprovalDetailIssue] = useState<CCOIssue | null>(null);

  const heatmapRows = useMemo(() => {
    if (!dashboard) return [];
    return resolveCcoHeatmapRows(dashboard);
  }, [dashboard, dashboardRevision]);

  const heatmapModalIssues = useMemo(() => {
    if (!heatmapRow || !dashboard) return [];
    const issue = dashboard.all_open_issues.find((i) => i.issue_id === heatmapRow.issueId);
    return issue ? [issue] : [];
  }, [heatmapRow, dashboard]);

  const monthOnMonthRows = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.month_on_month?.length
      ? dashboard.month_on_month
      : buildCcoMonthOnMonth(dashboard.kpi_cards, dashboard.headline.open_issues);
  }, [dashboard]);

  const ccoApprovalIssue = useMemo(() => {
    if (!dashboard) return null;
    return pickCcoExecutiveApprovalRecord(
      dashboard.high_value_approval_queue,
      dashboard.all_open_issues,
    );
  }, [dashboard, dashboardRevision]);

  const ccoApprovalRow = useMemo(
    () => (ccoApprovalIssue ? ccoIssueToApprovalRow(ccoApprovalIssue) : null),
    [ccoApprovalIssue],
  );

  const handleHighValueApprove = async () => {
    if (!ccoApprovalIssue) return;
    setApprovalPending(true);
    setApprovalMessage(null);
    try {
      await approveAlert(ccoApprovalIssue.issue_id);
      setApprovalApproved(true);
      setApprovalMessage(
        `Approved ${ccoApprovalIssue.issue_id} for ${ccoApprovalIssue.account_name} — ${money(ccoApprovalIssue.penalty_exposure)} regulatory penalty authorized for remediation.`,
      );
    } finally {
      setApprovalPending(false);
    }
  };

  if (loading && !dashboard) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }
  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          {error ?? "CCO dashboard data is unavailable."}
        </p>
        <button
          type="button"
          onClick={() => void refreshDashboard()}
          className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeKpiCard = kpiModalKey ? dashboard.kpi_cards[kpiModalKey] : null;
  const modalMeta = kpiModalKey ? CCO_KPI_CARD_META[kpiModalKey] : null;
  const modalRows = kpiModalKey ? rowsForCcoKpi(kpiModalKey, dashboard.all_open_issues) : [];

  const h = dashboard.headline;

  return (
    <div key={dashboardRevision} className="flex flex-col gap-6 pb-8 w-full">
      <section className={sectionCard}>
        <h1 className={sectionTitle}>C-Suite Compliance Dashboard</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Exposure {money(h.total_compliance_exposure)}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {h.open_issues} open issues
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            {h.pre_invoice} pre-invoice
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            Annualized Exposure — {fmtCCOCompact(h.annualized_regulatory_risk)}
          </span>
        </div>
      </section>

      <PersonaKpiCardGrid
        key={CCO_KPI_ORDER.map((k) => `${k}-${dashboard.kpi_cards[k]?.value ?? 0}`).join("|")}
        columns={4}
      >
        {CCO_KPI_ORDER.map((key) => {
          const card = dashboard.kpi_cards[key];
          if (!card) return null;
          return (
            <PersonaKpiCard
              key={`${key}-${card.value}`}
              label={card.label}
              valueDisplay={card.display}
              description={card.description}
              onClick={() => setKpiModalKey(key)}
            />
          );
        })}
      </PersonaKpiCardGrid>

      <section className={sectionCard} aria-label="Month-on-month compliance metrics">
        <div className={EXEC_CHART_PANEL_HEADER}>
          <h2 className={sectionTitle}>Month-on-Month Compliance</h2>
          <p className={sectionSubtitle}>
            Trailing six months — grouped bars · penalty exposure ($) and counts on dual axes
          </p>
        </div>
        <div className="mt-4 overflow-visible">
          <MonthOnMonthChart
            data={monthOnMonthRows}
            series={CCO_MONTH_ON_MONTH_SERIES}
            chartHeight={EXEC_MONTH_ON_MONTH_CHART_HEIGHT}
          />
        </div>
      </section>

      <section
        className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch"
        aria-label="Compliance charts"
      >
        <div className={panelShell}>
          <div className={EXEC_CHART_PANEL_HEADER}>
            <h2 className={sectionTitle}>Resolution Trend</h2>
            <p className={sectionSubtitle}>Performance gauges by KPI — index and status at a glance</p>
          </div>
          <div
            className={EXEC_CHART_PANEL_BODY}
            style={{ minHeight: EXEC_SIDE_PANEL_CONTENT_HEIGHT }}
          >
            <CCOResolutionTrendChart
              kpiCards={dashboard.kpi_cards}
              chartHeight={EXEC_SIDE_PANEL_CONTENT_HEIGHT}
            />
          </div>
        </div>

        <div className={panelShell}>
          <div className={EXEC_CHART_PANEL_HEADER}>
            <h2 className={sectionTitle}>Risk Heatmap</h2>
            <p className={sectionSubtitle}>
              Top {CCO_HEATMAP_TOP_N} open records by penalty exposure · bar color = severity
            </p>
          </div>
          <div
            className={EXEC_CHART_PANEL_BODY}
            style={{ minHeight: EXEC_SIDE_PANEL_CONTENT_HEIGHT }}
          >
            <CCORiskHeatmapVisual
              key={`cco-heatmap-${dashboardRevision}`}
              rows={heatmapRows}
              slotHeight={EXEC_SIDE_PANEL_CONTENT_HEIGHT}
              onSelect={setHeatmapRow}
            />
          </div>
        </div>
      </section>

      {heatmapRow && heatmapModalIssues.length > 0 && (
        <CCOIssueDetailModal
          riskArea={heatmapRow.issueType}
          issues={heatmapModalIssues}
          onClose={() => setHeatmapRow(null)}
        />
      )}

      {kpiModalKey && activeKpiCard && modalMeta && (
        <KpiDrilldownModal
          title={activeKpiCard.label}
          subtitle={modalMeta.modalSubtitle}
          valueDisplay={activeKpiCard.display}
          valueToneClassName="text-slate-900 dark:text-slate-100"
          recordCount={modalRows.length}
          onClose={() => setKpiModalKey(null)}
          emptyHint={modalMeta.emptyHint}
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Priority</th>
                {kpiModalKey !== "audit_readiness_score" && (
                  <th className="py-2 pr-4">{ccoKpiDrilldownMetricLabel(kpiModalKey)}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {modalRows.map((issue) => (
                <tr
                  key={issue.issue_id}
                  title={issueRowHiddenDetails(issue)}
                  className="border-b border-slate-100 dark:border-slate-700/60"
                >
                  <td className="py-2 pr-4">{issue.account_name}</td>
                  <td className="py-2 pr-4">{issue.issue_type}</td>
                  <td className="py-2 pr-4">{issue.priority}</td>
                  {kpiModalKey !== "audit_readiness_score" && (
                    <td className="py-2 pr-4">{formatCcoKpiDrilldownMetric(issue, kpiModalKey)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </KpiDrilldownModal>
      )}

      <ExecutiveHighValueApprovalSection
        sectionTitle="High-Value Compliance Approval"
        record={ccoApprovalRow}
        formatMoney={money}
        pending={approvalPending}
        approved={approvalApproved}
        successMessage={approvalMessage}
        onApprove={() => void handleHighValueApprove()}
        onViewDetails={() => {
          if (ccoApprovalIssue) setApprovalDetailIssue(ccoApprovalIssue);
        }}
      />

      {approvalDetailIssue && (
        <CCOIssueDetailModal
          riskArea={approvalDetailIssue.issue_type}
          issues={[approvalDetailIssue]}
          onClose={() => setApprovalDetailIssue(null)}
        />
      )}
    </div>
  );
}
