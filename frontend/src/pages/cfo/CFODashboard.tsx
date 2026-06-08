import { useMemo, useState } from "react";
import type { CFOAlert } from "../../services/api";
import ExecutiveHighValueApprovalSection from "../../components/shared/ExecutiveHighValueApprovalSection";
import KpiDrilldownModal from "../../components/shared/KpiDrilldownModal";
import PersonaKpiCard, { PersonaKpiCardGrid } from "../../components/shared/PersonaKpiCard";
import CFOIssueDetailModal from "../../components/cfo/CFOIssueDetailModal";
import CFOResolutionTrendChart from "../../components/cfo/CFOResolutionTrendChart";
import CFORiskHeatmapVisual from "../../components/cfo/CFORiskHeatmapVisual";
import MonthOnMonthChart from "../../components/shared/MonthOnMonthChart";
import {
  EXEC_CHART_PANEL_BODY,
  EXEC_CHART_PANEL_HEADER,
  EXEC_MONTH_ON_MONTH_CHART_HEIGHT,
  EXEC_SIDE_PANEL_CONTENT_HEIGHT,
} from "../../config/executiveDashboardLayout";
import { useCFOWorkflow } from "../../context/CFOWorkflowContext";
import { fmtCFOCompact } from "../../utils/cfoClosureFormat";
import {
  cfoAlertToApprovalRow,
  pickCfoExecutiveApprovalRecord,
} from "../../utils/executiveApprovalRecord";
import {
  alertRowHiddenDetails,
  buildCfoKpiPeriodComparison,
  buildCfoRiskHeatmapBarRecords,
  CFO_KPI_CARD_META,
  CFO_KPI_ORDER,
  CFO_MONTH_ON_MONTH_SERIES,
  DEFAULT_CFO_RESOLUTION_TREND,
  cfoKpiDrilldownMetricLabel,
  cfoKpiDrilldownMetricValue,
  rowsForCfoKpi,
  type CFOHeatmapBarRow,
  type CFOKpiKey,
} from "../../utils/cfoDashboard";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const sectionCard =
  "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6";

const panelShell = `${sectionCard} flex flex-col h-full min-h-0`;

const sectionTitle = "text-xl font-bold text-slate-900 dark:text-slate-100";

const sectionSubtitle = "mt-1 text-xs text-slate-500 dark:text-slate-400 leading-snug";

export default function CFODashboard() {
  const {
    dashboard,
    loading,
    error,
    dashboardRevision,
    refreshDashboard,
    approveAlert,
  } = useCFOWorkflow();
  const [kpiModalKey, setKpiModalKey] = useState<CFOKpiKey | null>(null);
  const [heatmapRow, setHeatmapRow] = useState<CFOHeatmapBarRow | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalApproved, setApprovalApproved] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalDetailAlert, setApprovalDetailAlert] = useState<CFOAlert | null>(null);

  const heatmapRows = useMemo(() => {
    if (!dashboard) return [];
    return buildCfoRiskHeatmapBarRecords(dashboard.all_open_alerts);
  }, [dashboard, dashboardRevision]);

  const heatmapModalAlerts = useMemo(() => {
    if (!heatmapRow || !dashboard) return [];
    const alert = dashboard.all_open_alerts.find((a) => a.alert_id === heatmapRow.alertId);
    return alert ? [alert] : [];
  }, [heatmapRow, dashboard]);

  const resolutionTrendRows = useMemo(() => {
    if (!dashboard) return DEFAULT_CFO_RESOLUTION_TREND;
    return dashboard.resolution_trend?.length ? dashboard.resolution_trend : DEFAULT_CFO_RESOLUTION_TREND;
  }, [dashboard]);

  const monthOnMonthRows = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.kpi_period_comparison?.length
      ? dashboard.kpi_period_comparison
      : buildCfoKpiPeriodComparison(dashboard.kpi_cards);
  }, [dashboard]);

  const cfoApprovalAlert = useMemo(() => {
    if (!dashboard) return null;
    return pickCfoExecutiveApprovalRecord(
      dashboard.high_value_approval_queue,
      dashboard.all_open_alerts,
    );
  }, [dashboard, dashboardRevision]);

  const cfoApprovalRow = useMemo(
    () => (cfoApprovalAlert ? cfoAlertToApprovalRow(cfoApprovalAlert) : null),
    [cfoApprovalAlert],
  );

  const handleHighValueApprove = async () => {
    if (!cfoApprovalAlert) return;
    setApprovalPending(true);
    setApprovalMessage(null);
    try {
      await approveAlert(cfoApprovalAlert.alert_id);
      setApprovalApproved(true);
      setApprovalMessage(
        `Approved ${cfoApprovalAlert.alert_id} for ${cfoApprovalAlert.customer_name || cfoApprovalAlert.account_name} — ${money(cfoApprovalAlert.dollar_exposure)} cleared for resolution.`,
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
          {error ?? "CFO dashboard data is unavailable."}
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
  const modalMeta = kpiModalKey ? CFO_KPI_CARD_META[kpiModalKey] : null;
  const modalRows = kpiModalKey ? rowsForCfoKpi(kpiModalKey, dashboard.all_open_alerts) : [];

  return (
    <div key={dashboardRevision} className="flex flex-col gap-6 pb-8 w-full">
      <section className={sectionCard}>
        <h1 className={sectionTitle}>C-Suite Financial Dashboard</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Exposure {money(dashboard.headline.total_exposure)}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {dashboard.headline.open_issues} open issues
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            {dashboard.headline.pre_invoice_count} pre-invoice
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            Annualized Exposure — {fmtCFOCompact(dashboard.headline.predicted_annual_exposure)}
          </span>
        </div>
      </section>

      <PersonaKpiCardGrid
        key={CFO_KPI_ORDER.map((k) => `${k}-${dashboard.kpi_cards[k]?.value ?? 0}`).join("|")}
        columns={4}
      >
        {CFO_KPI_ORDER.map((key) => {
          const card = dashboard.kpi_cards[key];
          if (!card) return null;
          return (
            <PersonaKpiCard
              key={`${key}-${card.value}`}
              label={card.label}
              valueDisplay={money(card.value)}
              description={card.description}
              onClick={() => setKpiModalKey(key)}
            />
          );
        })}
      </PersonaKpiCardGrid>

      <section className={sectionCard} aria-label="Month-on-month financial exposure">
        <div className={EXEC_CHART_PANEL_HEADER}>
          <h2 className={sectionTitle}>Month-on-Month Exposure</h2>
          <p className={sectionSubtitle}>
            Trailing six months — grouped bars by month · hover for values and month-over-month change
          </p>
        </div>
        <div className="mt-4 overflow-visible">
          <MonthOnMonthChart
            data={monthOnMonthRows}
            series={CFO_MONTH_ON_MONTH_SERIES}
            chartHeight={EXEC_MONTH_ON_MONTH_CHART_HEIGHT}
          />
        </div>
      </section>

      <section
        className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch"
        aria-label="Financial charts"
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
            <CFOResolutionTrendChart
              rows={resolutionTrendRows}
              chartHeight={EXEC_SIDE_PANEL_CONTENT_HEIGHT}
            />
          </div>
        </div>

        <div className={panelShell}>
          <div className={EXEC_CHART_PANEL_HEADER}>
            <h2 className={sectionTitle}>Risk Heatmap</h2>
            <p className={sectionSubtitle}>
              Top 8 open records by dollar exposure · bar color = severity
            </p>
          </div>
          <div
            className={EXEC_CHART_PANEL_BODY}
            style={{ minHeight: EXEC_SIDE_PANEL_CONTENT_HEIGHT }}
          >
            <CFORiskHeatmapVisual
              key={`cfo-heatmap-${dashboardRevision}`}
              rows={heatmapRows}
              slotHeight={EXEC_SIDE_PANEL_CONTENT_HEIGHT}
              onSelect={setHeatmapRow}
            />
          </div>
        </div>
      </section>

      {heatmapRow && heatmapModalAlerts.length > 0 && (
        <CFOIssueDetailModal
          issueType={heatmapRow.issueType}
          alerts={heatmapModalAlerts}
          onClose={() => setHeatmapRow(null)}
        />
      )}

      {kpiModalKey && activeKpiCard && modalMeta && (
        <KpiDrilldownModal
          title={activeKpiCard.label}
          subtitle={modalMeta.modalSubtitle}
          valueDisplay={money(activeKpiCard.value)}
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
                <th className="py-2 pr-4">{cfoKpiDrilldownMetricLabel(kpiModalKey)}</th>
              </tr>
            </thead>
            <tbody>
              {modalRows.map((a) => (
                <tr
                  key={a.alert_id}
                  title={alertRowHiddenDetails(a)}
                  className="border-b border-slate-100 dark:border-slate-700/60"
                >
                  <td className="py-2 pr-4">{a.account_name}</td>
                  <td className="py-2 pr-4">{a.issue_type}</td>
                  <td className="py-2 pr-4">{a.priority}</td>
                  <td className="py-2 pr-4">{money(cfoKpiDrilldownMetricValue(a, kpiModalKey))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </KpiDrilldownModal>
      )}

      <ExecutiveHighValueApprovalSection
        sectionTitle="High-Value Financial Approval"
        record={cfoApprovalRow}
        formatMoney={money}
        pending={approvalPending}
        approved={approvalApproved}
        successMessage={approvalMessage}
        onApprove={() => void handleHighValueApprove()}
        onViewDetails={() => {
          if (cfoApprovalAlert) setApprovalDetailAlert(cfoApprovalAlert);
        }}
      />

      {approvalDetailAlert && (
        <CFOIssueDetailModal
          issueType={approvalDetailAlert.issue_type}
          alerts={[approvalDetailAlert]}
          onClose={() => setApprovalDetailAlert(null)}
        />
      )}
    </div>
  );
}
