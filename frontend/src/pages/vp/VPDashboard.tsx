import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import VPReassignModal from "../../components/vp/VPReassignModal";
import AiRecommendationQueueSection, {
  type AiRecommendationQueueRow,
} from "../../components/shared/AiRecommendationQueueSection";
import KpiDrilldownModal from "../../components/shared/KpiDrilldownModal";
import PersonaKpiCard, { PersonaKpiCardGrid } from "../../components/shared/PersonaKpiCard";
import type { VPTeamMember } from "../../config/vpTeamOwners";
import { useVPWorkflow } from "../../context/VPWorkflowContext";
import type { VPIssueRow, VPKpiCard } from "../../services/api";
import {
  buildVpTopAlerts,
  displayAiConfidence,
  displayAiFix,
  displayAiSource,
  formatVPMoney,
  priorityClass,
  rowsForVpFilter,
  scorecardSlaStatus,
  slaClass,
  slaStatusLabel,
  teamScorecardRows,
} from "../../utils/vpDashboard";
import {
  getVpPulseTargetIssueId,
  syncVpTop8Order,
  vpCtaPulseClass,
} from "../../utils/vpWorkflowStorage";

function formatKpiValue(card: VPKpiCard): string {
  if (card.unit === "%") return `${card.value}%`;
  return `${card.value} ${card.unit}`;
}

function KpiIssuesTable({ rows, onRowClick }: { rows: VPIssueRow[]; onRowClick: (id: string) => void }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No matching open issues.</p>;
  }
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
          <th className="py-2 pr-4">Issue ID</th>
          <th className="py-2 pr-4">Account</th>
          <th className="py-2 pr-4">Issue Type</th>
          <th className="py-2 pr-4">Team</th>
          <th className="py-2 pr-4">Priority</th>
          <th className="py-2 pr-4">Exposure</th>
          <th className="py-2 pr-4">SLA</th>
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
            <td className="py-2 pr-4">{row.account_name}</td>
            <td className="py-2 pr-4">{row.issue_type}</td>
            <td className="py-2 pr-4">{row.team ?? "—"}</td>
            <td className="py-2 pr-4">
              <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>{row.priority}</span>
            </td>
            <td className="py-2 pr-4">{formatVPMoney(row.dollar_exposure)}</td>
            <td className="py-2 pr-4">
              <span className={`text-xs px-2 py-0.5 rounded ${slaClass(row.sla_health, row.sla_days_remaining)}`}>
                {slaStatusLabel(row.sla_days_remaining, row.sla_health)}
              </span>
            </td>
            <td className="py-2 pr-4">{row.current_owner_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function VPDashboard() {
  const navigate = useNavigate();
  const {
    dashboard: data,
    dashboardRevision,
    loading,
    error,
    approveIssue,
    aiActionPendingId,
    refreshDashboard,
    vpReassign,
  } = useVPWorkflow();
  const [activeKpiModal, setActiveKpiModal] = useState<string | null>(null);
  const [aiDecisions, setAiDecisions] = useState<Record<string, "approved">>({});
  const [reassignIssueId, setReassignIssueId] = useState<string | null>(null);
  const [reviewQueueTick, setReviewQueueTick] = useState(0);

  useEffect(() => {
    if (!data) return;
    const fromApi: Record<string, "approved"> = {};
    for (const row of data.all_open_issues) {
      if (row.ai_decision === "approve") fromApi[row.issue_id] = "approved";
    }
    setAiDecisions((prev) => ({ ...fromApi, ...prev }));
  }, [data]);

  const topAlertsRows = useMemo(() => {
    if (!data) return [];
    return buildVpTopAlerts(data.all_open_issues);
  }, [data, dashboardRevision]);

  useEffect(() => {
    if (!topAlertsRows.length) return;
    const openIds = topAlertsRows.map((a) => a.issue_id);
    syncVpTop8Order(openIds);
    setReviewQueueTick((n) => n + 1);
  }, [topAlertsRows, dashboardRevision]);

  const openTopAlertIds = useMemo(() => topAlertsRows.map((a) => a.issue_id), [topAlertsRows]);
  const pulseTargetIssueId = useMemo(
    () => getVpPulseTargetIssueId(openTopAlertIds),
    [openTopAlertIds, reviewQueueTick],
  );

  const handleKpiRowClick = (issueId: string) => {
    setActiveKpiModal(null);
    navigate(`/vp/issue/${issueId}`);
  };

  const handleAiApprove = async (issueId: string) => {
    const closure = await approveIssue(issueId);
    setAiDecisions((s) => ({ ...s, [issueId]: "approved" }));
    navigate(`/vp/closure/${issueId}`, { state: { closure } });
  };

  const handleReassignConfirm = async (member: VPTeamMember) => {
    if (!reassignIssueId) return;
    const closure = await vpReassign(reassignIssueId, member.id, member.name);
    setReassignIssueId(null);
    navigate(`/vp/closure/${reassignIssueId}`, { state: { closure } });
  };

  const reassignRow = reassignIssueId ? data?.ai_queue.find((r) => r.issue_id === reassignIssueId) : null;

  if (loading && !data) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          {error ?? "Unable to load Operations Dashboard."}
        </p>
        <button type="button" onClick={() => void refreshDashboard()} className="mt-4 text-sm text-indigo-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const activeCard = data.kpi_cards.find((c) => c.filter_type === activeKpiModal);
  const modalRows = activeKpiModal ? rowsForVpFilter(data.all_open_issues, activeKpiModal) : [];
  const scorecardRows = teamScorecardRows(data);

  const aiQueueRows: AiRecommendationQueueRow[] = data.ai_queue.map((row) => ({
    id: row.issue_id,
    recordLabel: `${row.order_id} · ${row.account_name}`,
    onRecordClick: () => navigate(`/vp/issue/${row.issue_id}`),
    fix: displayAiFix(row),
    confidence: displayAiConfidence(row),
    source: displayAiSource(row),
    decision: aiDecisions[row.issue_id] === "approved" ? "approved" : null,
  }));

  const handleViewIssue = (issueId: string) => {
    navigate(`/vp/issue/${issueId}`);
  };

  return (
    <div key={dashboardRevision} className="space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Operations Dashboard</h1>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            {data.headline.total_open_issues} open issues
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {data.headline.sla_breach_risk} SLA breach risks
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            {data.headline.escalation_queue} in priority queue
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {data.headline.team_resolution_rate}% team resolution rate
          </span>
        </div>
      </section>

      <PersonaKpiCardGrid columns={4}>
        {data.kpi_cards.map((card) => (
          <PersonaKpiCard
            key={card.filter_type}
            label={card.name}
            valueDisplay={formatKpiValue(card)}
            description={card.description}
            onClick={() => setActiveKpiModal(card.filter_type)}
          />
        ))}
      </PersonaKpiCardGrid>

      {activeKpiModal && activeCard && (
        <KpiDrilldownModal
          title={activeCard.name}
          subtitle={activeCard.description}
          valueDisplay={formatKpiValue(activeCard)}
          recordCount={modalRows.length}
          onClose={() => setActiveKpiModal(null)}
          emptyHint="No matching open issues."
        >
          <KpiIssuesTable rows={modalRows} onRowClick={handleKpiRowClick} />
        </KpiDrilldownModal>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Team Performance Scorecard</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-4">Open Issues</th>
                <th className="py-2 pr-4">SLA Status</th>
                <th className="py-2 pr-4">Resolution Rate</th>
              </tr>
            </thead>
            <tbody>
              {scorecardRows.map((row) => {
                const sla = scorecardSlaStatus(row);
                return (
                  <tr key={row.team} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium">{row.team}</td>
                    <td className="py-2 pr-4">{row.open_issues}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${sla.className}`}>{sla.label}</span>
                    </td>
                    <td className="py-2 pr-4">{row.resolution_rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Top Alerts</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Issue ID</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">Exposure</th>
                <th className="py-2 pr-4">Invoice</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">SLA Status</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {topAlertsRows.map((row) => {
                const isPulseTarget = row.issue_id === pulseTargetIssueId;
                return (
                <tr
                  key={row.issue_id}
                  className={`border-b border-slate-100 dark:border-slate-700/60 ${
                    row.priority === "CRITICAL"
                      ? "border-l-4 border-red-400"
                      : row.priority === "HIGH"
                        ? "border-l-4 border-orange-400"
                        : ""
                  }`}
                >
                  <td className="py-2 pr-4 font-medium">{row.issue_id}</td>
                  <td className="py-2 pr-4">{row.account_name}</td>
                  <td className="py-2 pr-4">{row.issue_type}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>{row.priority}</span>
                  </td>
                  <td className="py-2 pr-4">{formatVPMoney(row.dollar_exposure)}</td>
                  <td className="py-2 pr-4">{row.invoice_status || "—"}</td>
                  <td className="py-2 pr-4">{row.current_owner_name || "Unassigned"}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${slaClass(row.sla_health, row.sla_days_remaining)}`}>
                      {slaStatusLabel(row.sla_days_remaining, row.sla_health)}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleViewIssue(row.issue_id)}
                      className={`text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap ${
                        isPulseTarget
                          ? `bg-indigo-600 hover:bg-indigo-700 ${vpCtaPulseClass}`
                          : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                    >
                      {isPulseTarget ? "View Issue →" : "View Issue"}
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AiRecommendationQueueSection
        rows={aiQueueRows}
        showReassign
        pendingId={aiActionPendingId}
        onApprove={(issueId) => void handleAiApprove(issueId)}
        onReassign={setReassignIssueId}
        emptyMessage="No pending AI recommendations."
      />

      {reassignIssueId && reassignRow && (
        <VPReassignModal
          open
          issueId={reassignIssueId}
          recordLabel={`${reassignRow.order_id} · ${reassignRow.account_name}`}
          currentOwnerId={reassignRow.current_owner_id}
          currentOwnerName={reassignRow.current_owner_name}
          onClose={() => setReassignIssueId(null)}
          onConfirm={handleReassignConfirm}
        />
      )}
    </div>
  );
}
