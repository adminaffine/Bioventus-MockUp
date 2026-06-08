import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiDrilldownModal from "../../components/shared/KpiDrilldownModal";
import PersonaKpiCard, { formatPersonaKpiValue, PersonaKpiCardGrid } from "../../components/shared/PersonaKpiCard";
import AiRecommendationQueueSection, {
  type AiRecommendationQueueRow,
} from "../../components/shared/AiRecommendationQueueSection";
import { useTaxWorkflow } from "../../context/TaxWorkflowContext";
import type { TaxIssueRow } from "../../services/api";
import { sortByDollarDesc } from "../../utils/personaKpiSort";
import { buildTaxUnderpaymentIssuesDesc } from "../../utils/taxDashboardSync";
import { markTaxAiRejected, taxCtaPulseClassAmber } from "../../utils/taxWorkflowStorage";

export type KpiPanelId =
  | "Jurisdiction Mismatches"
  | "Pre-Invoice Alerts"
  | "Compliance Exposure"
  | "Tax Overpayments"
  | "Tax Underpayments";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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

function isAiRejected(row: TaxIssueRow, local: Record<string, "approved" | "rejected">): boolean {
  return local[row.issue_id] === "rejected" || row.ai_decision === "reject";
}

function priorityClass(priority: string): string {
  if (priority === "HIGH") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

function invoiceBadge(_status: string, preInvoice: number): string {
  if (preInvoice === 1) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

function allIssues(data: NonNullable<ReturnType<typeof useTaxWorkflow>["dashboard"]>): TaxIssueRow[] {
  if (data.all_open_issues?.length) return data.all_open_issues;
  const map = new Map<string, TaxIssueRow>();
  for (const row of [...data.top_alerts, ...data.ai_queue, ...data.my_action_queue]) {
    map.set(row.issue_id, row);
  }
  return [...map.values()];
}

function rowsForKpi(data: NonNullable<ReturnType<typeof useTaxWorkflow>["dashboard"]>, kpi: KpiPanelId): TaxIssueRow[] {
  const issues = allIssues(data);
  let rows: TaxIssueRow[];
  switch (kpi) {
    case "Jurisdiction Mismatches":
      rows = issues;
      break;
    case "Pre-Invoice Alerts":
      rows = issues.filter((r) => r.pre_invoice === 1);
      break;
    case "Compliance Exposure":
      rows = issues;
      break;
    case "Tax Overpayments":
      rows = issues.filter((r) => Number(r.rate_difference) < 0);
      break;
    case "Tax Underpayments":
      rows =
        data.tax_underpayment_issues?.length
          ? data.tax_underpayment_issues
          : buildTaxUnderpaymentIssuesDesc(issues);
      return rows;
    default:
      rows = issues;
  }
  return sortByDollarDesc(rows, (row) => row.dollar_value);
}

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const LOGGED_IN_TAX_OWNER_ID = "TAX-03";

function buildMyActionRows(myActionQueue: TaxIssueRow[]): TaxIssueRow[] {
  return myActionQueue.filter((row) => row.owner_id === LOGGED_IN_TAX_OWNER_ID).sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9;
    const pb = PRIORITY_ORDER[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.sla_days_remaining - b.sla_days_remaining;
  });
}

function panelMeta(kpi: KpiPanelId): { subtitle: string; emptyHint: string } {
  switch (kpi) {
    case "Jurisdiction Mismatches":
      return {
        subtitle: "All open orders where ship-to and bill-to state do not match",
        emptyHint: "No open jurisdiction mismatches.",
      };
    case "Pre-Invoice Alerts":
      return {
        subtitle: "Mismatches that can still be corrected before invoicing",
        emptyHint: "No pre-invoice alerts right now.",
      };
    case "Compliance Exposure":
      return {
        subtitle: "Active issues ranked by penalty and legal risk exposure",
        emptyHint: "No compliance exposure on open issues.",
      };
    case "Tax Overpayments":
      return {
        subtitle: "Orders where a higher tax rate was incorrectly applied",
        emptyHint:
          "No overpayment rows in the current open-issue set. Portfolio overpayment total may include resolved or historical orders — see Revenue & Risk (Tax tab) for the full jurisdiction view.",
      };
    case "Tax Underpayments":
      return {
        subtitle: "Orders where a lower rate was applied, creating audit and penalty risk",
        emptyHint: "No underpayment rows in the current open-issue set.",
      };
    default:
      return { subtitle: "", emptyHint: "No records." };
  }
}

function IssuesTable({
  rows,
  onRowClick,
}: {
  rows: TaxIssueRow[];
  onRowClick: (issueId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
          <th className="py-2 pr-4">Order ID</th>
          <th className="py-2 pr-4">Customer</th>
          <th className="py-2 pr-4">Issue Type</th>
          <th className="py-2 pr-4">Priority</th>
          <th className="py-2 pr-4">$ Value</th>
          <th className="py-2 pr-4">Invoice Status</th>
          <th className="py-2 pr-4">Urgency</th>
          <th className="py-2 pr-4">Owner</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.issue_id}
            onClick={() => onRowClick(row.issue_id)}
            className={`border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer ${
              row.pre_invoice === 1 ? "border-l-4 border-orange-400" : ""
            }`}
          >
            <td className="py-2 pr-4 font-medium">{row.order_id}</td>
            <td className="py-2 pr-4">{row.customer_name}</td>
            <td className="py-2 pr-4">{row.issue_type}</td>
            <td className="py-2 pr-4">
              <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>{row.priority}</span>
            </td>
            <td className="py-2 pr-4">{formatMoney(row.dollar_value)}</td>
            <td className="py-2 pr-4">
              <span className={`text-xs px-2 py-0.5 rounded ${invoiceBadge(row.invoice_status, row.pre_invoice)}`}>
                {row.invoice_status}
              </span>
            </td>
            <td className="py-2 pr-4">{row.urgency_label}</td>
            <td className="py-2 pr-4">{row.owner_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function TaxDashboard() {
  const navigate = useNavigate();
  const { dashboard: data, dashboardRevision, loading, applyAiAction, approveAndResolve, aiActionPendingId, refreshDashboard } =
    useTaxWorkflow();
  const [activeKpiModal, setActiveKpiModal] = useState<KpiPanelId | null>(null);
  const [aiDecisions, setAiDecisions] = useState<Record<string, "approved" | "rejected">>({});

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

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

  const handleKpiRowClick = (issueId: string) => {
    setActiveKpiModal(null);
    navigate(`/tax/issue/${issueId}`);
  };

  const handleAiApprove = async (issueId: string) => {
    try {
      const closure = await approveAndResolve(issueId);
      setAiDecisions((s) => ({ ...s, [issueId]: "approved" }));
      navigate(`/tax/closure/${issueId}`, { state: { closure } });
    } catch {
      /* keep user on dashboard if resolve fails */
    }
  };

  const handleAiReject = async (issueId: string) => {
    await applyAiAction(issueId, "reject");
    markTaxAiRejected(issueId);
    setAiDecisions((s) => ({ ...s, [issueId]: "rejected" }));
  };

  const myActionRows = useMemo(() => {
    if (!data) return [];
    return buildMyActionRows(data.my_action_queue);
  }, [data]);

  const topAlertsRows = useMemo(() => {
    if (!data) return [];
    return sortByDollarDesc(data.top_alerts, (row) => row.dollar_value);
  }, [data]);

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }
  if (!data) return null;

  const { headline } = data;
  const complianceExposure =
    data.kpi_cards.find((c) => c.name === "Compliance Exposure")?.value ?? headline.total_exposure;
  const fifthKpiCard =
    data.kpi_cards.find((c) => c.name === "Tax Underpayments") ?? data.kpi_cards[4];
  const fifthKpiValue = fifthKpiCard
    ? fifthKpiCard.unit === "dollars"
      ? formatMoney(fifthKpiCard.value)
      : `${fifthKpiCard.value} ${fifthKpiCard.unit}`
    : null;
  const activeCard = data.kpi_cards.find((c) => c.name === activeKpiModal);
  const modalRows = activeKpiModal ? rowsForKpi(data, activeKpiModal) : [];
  const { subtitle, emptyHint } = activeKpiModal ? panelMeta(activeKpiModal) : { subtitle: "", emptyHint: "" };

  const aiQueueRows: AiRecommendationQueueRow[] = data.ai_queue.map((row) => ({
    id: row.issue_id,
    recordLabel: row.order_id,
    onRecordClick: () => navigate(`/tax/issue/${row.issue_id}`),
    fix: row.ai_fix,
    confidence: row.ai_confidence,
    source: row.ai_source,
    decision: aiDecisions[row.issue_id] ?? null,
  }));

  return (
    <div key={dashboardRevision} className="space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tax Exposure Dashboard</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            Exposure {formatMoney(Number(complianceExposure))}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            {headline.active_mismatches} mismatches
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            {headline.pre_invoice_alerts} pre-invoice
          </span>
          {fifthKpiCard && (
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {fifthKpiCard.name}: {fifthKpiValue}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Data Quality Health</h2>
        <div className="mt-4 space-y-4">
          {data.data_quality_health.map((row) => (
            <div key={row.metric} className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 w-56">{row.metric}</span>
              <div className="flex-1 min-w-[120px] h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.score < 85 ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${row.score}%` }}
                />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300 w-10">{row.score}%</span>
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <PersonaKpiCardGrid columns={5}>
        {data.kpi_cards.map((card) => (
          <PersonaKpiCard
            key={card.name}
            label={card.name}
            valueDisplay={formatPersonaKpiValue(card.value, card.unit, formatMoney)}
            description={card.description}
            onClick={() => setActiveKpiModal(card.name as KpiPanelId)}
          />
        ))}
      </PersonaKpiCardGrid>

      {activeKpiModal && activeCard && (
        <KpiDrilldownModal
          title={activeKpiModal}
          subtitle={subtitle}
          valueDisplay={activeCard.unit === "dollars" ? formatMoney(activeCard.value) : `${activeCard.value} ${activeCard.unit}`}
          recordCount={modalRows.length}
          onClose={() => setActiveKpiModal(null)}
          emptyHint={emptyHint}
          footer={
            activeKpiModal === "Tax Overpayments" || activeKpiModal === "Tax Underpayments" ? (
              <button
                type="button"
                onClick={() => {
                  setActiveKpiModal(null);
                  navigate("/revenue?tab=tax");
                }}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
              >
                Open full jurisdiction analysis in Revenue & Risk →
              </button>
            ) : undefined
          }
        >
          <IssuesTable rows={modalRows} onRowClick={handleKpiRowClick} />
        </KpiDrilldownModal>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Top Alerts</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Highest dollar exposure first</p>
        <div className="mt-4 overflow-x-auto">
          <IssuesTable rows={topAlertsRows} onRowClick={(id) => navigate(`/tax/issue/${id}`)} />
        </div>
      </section>

      <AiRecommendationQueueSection
        rows={aiQueueRows}
        subtitle="High-confidence jurisdiction fixes awaiting review"
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
                <th className="py-2 pr-4">Order ID</th>
                <th className="py-2 pr-4">Issue Type</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">$ Value</th>
                <th className="py-2 pr-4">Invoice Status</th>
                <th className="py-2 pr-4">Urgency</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {myActionRows.map((row) => {
                const rejected = isAiRejected(row, aiDecisions);
                return (
                  <tr key={row.issue_id} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {rejected && <ActionRequiredDot />}
                        {row.order_id}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{row.issue_type}</td>
                    <td className="py-2 pr-4">{row.owner_name}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(row.priority)}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{formatMoney(row.dollar_value)}</td>
                    <td className="py-2 pr-4">{row.invoice_status}</td>
                    <td className="py-2 pr-4">{row.urgency_label}</td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/tax/issue/${row.issue_id}`)}
                        className={`text-white text-sm px-3 py-1.5 rounded-lg ${
                          rejected
                            ? `bg-amber-600 hover:bg-amber-700 ${taxCtaPulseClassAmber}`
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
