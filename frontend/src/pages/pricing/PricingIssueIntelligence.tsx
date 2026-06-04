import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Lock } from "lucide-react";
import PricingActionToast from "../../components/pricing/PricingActionToast";
import PricingAiRecommendationPanel from "../../components/pricing/PricingAiRecommendationPanel";
import PricingReassignModal from "../../components/pricing/PricingReassignModal";
import { pricingStickyBtnPrimary } from "../../components/pricing/pricingStickyButtonStyles";
import type { PricingTeamOwner } from "../../config/pricingTeamOwners";
import { usePricingWorkflow } from "../../context/PricingWorkflowContext";
import { api, type PricingIssueDetail } from "../../services/api";
import { markPricingTransactionVisited, pricingCtaPulseClass } from "../../utils/pricingWorkflowStorage";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function priorityClass(priority: string): string {
  if (priority === "CRITICAL" || priority === "HIGH") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

function slaClass(days: number): string {
  if (days <= 3) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (days <= 7) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

function AccordionSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-4 text-left text-sm font-semibold text-slate-800 dark:text-slate-200"
      >
        <span>{open ? "▼" : "▶"} {title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-6 pb-6 text-sm text-slate-600 dark:text-slate-300">{children}</div>}
    </div>
  );
}

export default function PricingIssueIntelligence() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { pricingReassign, resolveIssue, refreshDashboard } = usePricingWorkflow();
  const [data, setData] = useState<PricingIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [transactionBtnClicked, setTransactionBtnClicked] = useState(false);
  const [renewalPending, setRenewalPending] = useState(false);

  const loadIssue = () => {
    if (!issueId) return;
    setLoading(true);
    api.getPricingIssue(issueId).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIssue();
  }, [issueId]);

  useEffect(() => {
    setTransactionBtnClicked(false);
  }, [issueId]);

  useEffect(() => {
    if (data && !data.workflow.ai_approved) {
      setOpenSections((prev) => ({ ...prev, prescribed: true }));
    }
  }, [data]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReassignConfirm = async (owner: PricingTeamOwner) => {
    if (!issueId) return;
    const { owner_name } = await pricingReassign(issueId, owner.owner_id);
    setActionToast(`Issue reassigned to ${owner_name}`);
    loadIssue();
  };

  if (loading) return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  if (!data || !issueId) return null;

  const issue = data.issue;
  const isRecalled = issue.issue_type === "Product Recalled";
  const isExpiring = issue.issue_type === "Contract Expiring";
  const aiDecision = issue.ai_decision ?? null;
  const orderId = issue.order_id || "";

  const handleInitiateRenewal = async () => {
    try {
      setRenewalPending(true);
      const closure = await resolveIssue(issueId);
      await refreshDashboard({ silent: true });
      navigate(`/pricing/closure/${issueId}`, { state: { closure } });
    } catch {
      setActionToast("Unable to initiate renewal right now. Please try again.");
    } finally {
      setRenewalPending(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {actionToast && <PricingActionToast message={actionToast} onDismiss={() => setActionToast(null)} />}

      <button
        type="button"
        onClick={() => navigate("/pricing-dashboard")}
        className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline"
      >
        ← Back to Dashboard
      </button>

      {isRecalled && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-200">
          ⚠ REGULATORY VIOLATION — immediate credit and customer notification required
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{String(data.header.issue_type)}</span>
          <span className="text-slate-600 dark:text-slate-300">{String(data.header.customer)}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(String(data.header.priority))}`}>
            {String(data.header.priority)}
          </span>
          <span className="font-medium">{formatMoney(Number(data.header.dollar_impact))}</span>
          <span className="text-slate-500">Opened {String(data.header.opened_on)}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${slaClass(issue.sla_days_remaining)}`}>{String(data.header.sla)}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Happened</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.what_happened}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Business Risk & Impact</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Risk Type</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Detail</th>
            </tr>
          </thead>
          <tbody>
            {data.business_risk.map((r) => (
              <tr key={r.risk_type} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium">{r.risk_type}</td>
                <td className="py-2 pr-4">{r.status}</td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Owner & Next Action</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium w-32">Owner</td>
              <td className="py-2 pr-4">
                {data.owner.owner_name} ({data.owner.owner_id})
              </td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Assigned On</td>
              <td className="py-2 pr-4">{data.owner.assigned_on}</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Next Action</td>
              <td className="py-2 pr-4">{data.owner.next_action}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">SLA Remaining</td>
              <td className="py-2 pr-4">{data.owner.sla_remaining}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <PricingAiRecommendationPanel
        issueId={issueId}
        fix={data.ai_recommendation.fix}
        confidence={data.ai_recommendation.confidence}
        source={data.ai_recommendation.source}
        decision={aiDecision}
        navigateOnApprove
        onAfterAction={loadIssue}
      />
      <button
        type="button"
        onClick={() => toggleSection("prescribed")}
        className="-mt-4 text-xs text-indigo-600 dark:text-indigo-300 hover:underline px-6"
      >
        Not comfortable approving? View Prescribed Actions {openSections.prescribed ? "▼" : "▶"}
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Affected Records</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            {data.affected_records.map((r) => {
              const isOrderRecord = data.has_order && r.record_type === "Order";
              const isContractRecord = isExpiring && r.record_type === "Contract";
              const showViewTransactionNudge = isOrderRecord && !transactionBtnClicked;
              const showRenewalNudge = isContractRecord && !renewalPending;
              const openTransaction = () => {
                if (!isOrderRecord || !issueId) return;
                setTransactionBtnClicked(true);
                markPricingTransactionVisited(issueId, r.record_id);
                navigate(`/pricing/transaction/${r.record_id}`);
              };
              return (
                <tr key={r.record_id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-3 pr-4 text-slate-500 w-28">{r.record_type}</td>
                  <td className="py-3 pr-4 font-medium flex items-center gap-1">
                    {r.record_id}
                    {!isOrderRecord && !isContractRecord && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                  </td>
                  <td className="py-3 pr-4">{r.customer}</td>
                  <td className="py-3 pr-4">{r.contract}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{r.detail}</td>
                  <td className="py-3 pr-4 text-right">
                    {isOrderRecord ? (
                      <button
                        type="button"
                        onClick={openTransaction}
                        className={`text-sm px-3 py-1.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 ${
                          showViewTransactionNudge ? pricingCtaPulseClass : ""
                        }`}
                      >
                        View Transaction →
                      </button>
                    ) : isContractRecord ? (
                      <button
                        type="button"
                        disabled={renewalPending}
                        onClick={() => void handleInitiateRenewal()}
                        className={`text-sm px-3 py-1.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 ${
                          showRenewalNudge ? pricingCtaPulseClass : ""
                        }`}
                      >
                        {renewalPending ? "Processing…" : "Initiate Renewal →"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <AccordionSection id="prescribed" title="Prescribed Actions" open={!!openSections.prescribed} onToggle={toggleSection}>
        <ol className="list-decimal list-inside space-y-2">
          {data.prescribed_actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </AccordionSection>

      <AccordionSection id="why" title="Why It Happened" open={!!openSections.why} onToggle={toggleSection}>
        <p>{data.why_it_happened}</p>
      </AccordionSection>

      <AccordionSection id="preventive" title="Preventive Actions" open={!!openSections.preventive} onToggle={toggleSection}>
        <ol className="list-decimal list-inside space-y-2">
          {data.preventive_actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </AccordionSection>

      <AccordionSection id="capa" title="CAPA Linkage" open={!!openSections.capa} onToggle={toggleSection}>
        <table className="min-w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 font-medium">CAPA ID</td>
              <td>
                <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">
                  {data.capa_linkage.capa_id}
                </span>
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-medium">Regulation</td>
              <td>{data.capa_linkage.regulation}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-medium">Status</td>
              <td>{data.capa_linkage.status}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-medium">Owner</td>
              <td>{data.capa_linkage.owner}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-medium">Due Date</td>
              <td>{data.capa_linkage.due_date}</td>
            </tr>
          </tbody>
        </table>
      </AccordionSection>

      <PricingReassignModal
        open={reassignOpen}
        issueId={issueId}
        recordLabel={orderId || issue.contract_id}
        currentOwnerId={data.owner.owner_id}
        currentOwnerName={data.owner.owner_name}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50">
        <button
          type="button"
          onClick={() => {
            setAcknowledged(true);
            setActionToast("Issue acknowledged — ownership confirmed and correction in progress");
          }}
          disabled={acknowledged}
          className={pricingStickyBtnPrimary}
        >
          {acknowledged ? "Acknowledged ✓" : "Acknowledge"}
        </button>
        <button type="button" onClick={() => setReassignOpen(true)} className={pricingStickyBtnPrimary}>
          Reassign
        </button>
      </div>
    </div>
  );
}
