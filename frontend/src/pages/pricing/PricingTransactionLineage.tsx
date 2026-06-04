import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import PricingActionToast from "../../components/pricing/PricingActionToast";
import PricingAiRecommendationPanel from "../../components/pricing/PricingAiRecommendationPanel";
import { pricingStickyBtnPrimary } from "../../components/pricing/pricingStickyButtonStyles";
import { usePricingWorkflow } from "../../context/PricingWorkflowContext";
import { api } from "../../services/api";
import type { PricingTransactionDetail } from "../../services/api";
import { isPricingAiRejected, pricingCtaPulseClass } from "../../utils/pricingWorkflowStorage";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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

export default function PricingTransactionLineage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { resolveIssue } = usePricingWorkflow();
  const [data, setData] = useState<PricingTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [stickyPending, setStickyPending] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);

  const loadTransaction = () => {
    if (!orderId) return;
    setLoading(true);
    api.getPricingTransaction(orderId).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTransaction();
  }, [orderId]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const runPrimaryAction = async () => {
    if (!data) return;
    setStickyPending(true);
    try {
      if (data.action_label === "Enroll in GPO") {
        await resolveIssue(data.issue_id);
        setActionToast("Renewal initiated — proceeding to Pricing Closure");
      } else {
        await api.pricingCreditMemoQueued(data.issue_id);
        await resolveIssue(data.issue_id);
        setActionToast(`${data.action_label} queued — proceeding to Pricing Closure`);
      }
      navigate(`/pricing/closure/${data.issue_id}`);
    } finally {
      setStickyPending(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  if (!data) return null;

  const pb = data.pricing_breakdown;
  const aiApproved = data.workflow.ai_approved;
  const aiRejected = isPricingAiRejected(data.issue_id);
  const aiDecision = aiApproved ? "approve" : aiRejected ? "reject" : null;
  const primaryActionLabel = data.action_label === "Issue Credit Memo" ? "Request Credit Memo" : data.action_label;
  const showPrimaryCtaNudge = !stickyPending;

  return (
    <div className="space-y-6 pb-24">
      {actionToast && <PricingActionToast message={actionToast} onDismiss={() => setActionToast(null)} />}

      <button
        type="button"
        onClick={() => navigate(`/pricing/issue/${data.issue_id}`)}
        className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline"
      >
        ← Back to Issue
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Order Header</h2>
        <table className="min-w-full text-sm">
          <tbody>
            {Object.entries(data.order_header).map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium capitalize w-40">{k.replace(/_/g, " ")}</td>
                <td className="py-2 pr-4">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pricing Breakdown</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Price Type</th>
              <th className="py-2 pr-4">Tier</th>
              <th className="py-2 pr-4">GPO</th>
              <th className="py-2 pr-4">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Contract Price</td>
              <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="h-4 w-4" />
                {pb.correct_tier}
              </td>
              <td className="py-2 pr-4">{pb.gpo}</td>
              <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400">{formatMoney(pb.contract_price)}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">Charged Price</td>
              <td className="py-2 pr-4 text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {pb.applied_tier}
              </td>
              <td className="py-2 pr-4">{pb.gpo}</td>
              <td className="py-2 pr-4 text-red-600 dark:text-red-400">{formatMoney(pb.charged_price)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          Overcharge per unit: {formatMoney(pb.overcharge_per_unit)} · Credit memo required:{" "}
          <strong>{formatMoney(pb.credit_memo_amount)}</strong>
          <div className="mt-2 text-xs text-red-700 dark:text-red-300">
            Contract and charged values are unit prices; credit memo is the correction delta (difference x quantity).
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Went Wrong</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.what_went_wrong}</p>
      </section>

      <PricingAiRecommendationPanel
        issueId={data.issue_id}
        fix={data.ai_recommendation.fix}
        confidence={data.ai_recommendation.confidence}
        source={data.ai_recommendation.source}
        decision={aiDecision}
        navigateOnApprove
        onAfterAction={loadTransaction}
      />

      <AccordionSection id="trail" title="Order Trail" open={!!openSections.trail} onToggle={toggleSection}>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">Price Applied</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Correction</th>
            </tr>
          </thead>
          <tbody>
            {data.order_trail.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4">{row.date}</td>
                <td className="py-2 pr-4">{row.event}</td>
                <td className="py-2 pr-4">{row.price_applied}</td>
                <td className="py-2 pr-4">{row.status}</td>
                <td className="py-2 pr-4">{row.correction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AccordionSection>

      <AccordionSection id="mapping" title="Mapping Accuracy & Risk Signal" open={!!openSections.mapping} onToggle={toggleSection}>
        <p>GPO roster confidence: {data.mapping_accuracy.gpo_roster_confidence}%</p>
        <p className="mt-2">{data.mapping_accuracy.signal}</p>
        <p className="mt-2">Chargeback exposure: {formatMoney(data.mapping_accuracy.chargeback_exposure)}</p>
      </AccordionSection>

      <AccordionSection id="hierarchy" title="Customer Hierarchy" open={!!openSections.hierarchy} onToggle={toggleSection}>
        <p className="font-medium">{data.customer_hierarchy.idn}</p>
        <p className="mt-2 pl-4">→ {data.customer_hierarchy.hospital}</p>
        <p className="mt-1 pl-8">→ {data.customer_hierarchy.clinic}</p>
      </AccordionSection>

      <AccordionSection id="cross" title="Cross-Team Visibility" open={!!openSections.cross} onToggle={toggleSection}>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-4">Team</th>
              <th className="py-2 pr-4">Issue</th>
              <th className="py-2 pr-4">Owner</th>
            </tr>
          </thead>
          <tbody>
            {data.cross_team_visibility.map((row) => (
              <tr key={row.team} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4">{row.team}</td>
                <td className="py-2 pr-4">{row.issue}</td>
                <td className="py-2 pr-4">{row.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AccordionSection>

      <AccordionSection id="capa" title="CAPA Linkage" open={!!openSections.capa} onToggle={toggleSection}>
        <table className="min-w-full text-sm">
          <tbody>
            {Object.entries(data.capa_linkage).map(([k, v]) => (
              <tr key={k}>
                <td className="py-1 pr-4 font-medium capitalize">{k.replace(/_/g, " ")}</td>
                <td>{k === "capa_id" ? <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{String(v)}</span> : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AccordionSection>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50">
        <button
          type="button"
          disabled={stickyPending}
          onClick={() => void runPrimaryAction()}
          className={`${pricingStickyBtnPrimary} ${showPrimaryCtaNudge ? pricingCtaPulseClass : ""}`}
        >
          {stickyPending ? "Processing…" : primaryActionLabel}
        </button>
        <button type="button" onClick={() => setContractModalOpen(true)} className={pricingStickyBtnPrimary}>
          View Contract
        </button>
        <button type="button" onClick={() => navigate("/hierarchy")} className={pricingStickyBtnPrimary}>
          View Customer
        </button>
      </div>

      {contractModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Contract Details</h3>
              <button
                type="button"
                onClick={() => setContractModalOpen(false)}
                className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2 text-sm">
              <div className="space-y-2">
                <p><span className="font-medium">Contract ID:</span> {String(data.order_header.contract_id ?? "—")}</p>
                <p><span className="font-medium">Customer:</span> {String(data.order_header.customer_name ?? "—")}</p>
                <p><span className="font-medium">Order ID:</span> {String(data.order_header.order_id ?? "—")}</p>
                <p><span className="font-medium">Product:</span> {String(data.order_header.product ?? "—")}</p>
              </div>
              <div className="space-y-2">
                <p><span className="font-medium">GPO:</span> {pb.gpo}</p>
                <p><span className="font-medium">Contract Tier:</span> {pb.correct_tier}</p>
                <p><span className="font-medium">Applied Tier:</span> {pb.applied_tier}</p>
                <p><span className="font-medium">Contract Price:</span> {formatMoney(pb.contract_price)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
