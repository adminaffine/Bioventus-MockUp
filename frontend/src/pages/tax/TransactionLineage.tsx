import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import TaxActionToast from "../../components/tax/TaxActionToast";
import TaxAiRecommendationPanel from "../../components/tax/TaxAiRecommendationPanel";
import { taxStickyBtnPrimary } from "../../components/tax/taxStickyButtonStyles";
import { useTaxWorkflow } from "../../context/TaxWorkflowContext";
import { api, type TaxTransactionDetail } from "../../services/api";
import { isTaxAiRejected, taxCtaPulseClassAmber } from "../../utils/taxWorkflowStorage";

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

export default function TransactionLineage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { resolveIssue } = useTaxWorkflow();
  const [data, setData] = useState<TaxTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [stickyPending, setStickyPending] = useState(false);

  const loadTransaction = (options?: { silent?: boolean }) => {
    if (!orderId) return;
    if (!options?.silent) setLoading(true);
    api.getTaxTransaction(orderId).then(setData).finally(() => {
      if (!options?.silent) setLoading(false);
    });
  };

  useEffect(() => {
    loadTransaction();
  }, [orderId]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const runJurisdictionCorrection = async () => {
    if (!data) return;
    setStickyPending(true);
    try {
      const closure = await resolveIssue(data.issue_id);
      setActionToast("Jurisdiction correction requested — proceeding to Tax Closure");
      navigate(`/tax/closure/${data.issue_id}`, { state: { closure } });
    } catch {
      setActionToast("Unable to complete jurisdiction correction — check workflow steps and try again.");
    } finally {
      setStickyPending(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }
  if (!data) return null;

  const jb = data.jurisdiction_breakdown;
  const aiApproved = data.workflow.ai_approved;
  const aiRejected = isTaxAiRejected(data.issue_id, data.ai_recommendation.decision);
  const aiDecision = aiApproved ? "approve" : aiRejected ? "reject" : null;
  const showPrimaryCtaNudge = !stickyPending;

  return (
    <div className="space-y-6 pb-24">
      {actionToast && <TaxActionToast message={actionToast} onDismiss={() => setActionToast(null)} />}
      <button
        type="button"
        onClick={() => navigate(`/tax/issue/${data.issue_id}`)}
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tax Jurisdiction Breakdown</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Ship-To State</th>
              <th className="py-2 pr-4">Bill-To State</th>
              <th className="py-2 pr-4">Jurisdiction Applied</th>
              <th className="py-2 pr-4">Correct Jurisdiction</th>
              <th className="py-2 pr-4">Rate Difference</th>
              <th className="py-2 pr-4">Tax Exposure</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 pr-4">{jb.ship_to_state}</td>
              <td className="py-2 pr-4">{jb.bill_to_state}</td>
              <td className="py-2 pr-4 text-red-600 dark:text-red-400">
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {jb.jurisdiction_applied}
                </span>
              </td>
              <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400">
                <span className="inline-flex items-center gap-1">
                  <Check className="h-4 w-4 shrink-0" />
                  {jb.correct_jurisdiction}
                </span>
              </td>
              <td className="py-2 pr-4">{jb.rate_difference}</td>
              <td className="py-2 pr-4 font-medium">{formatMoney(Number(jb.tax_exposure ?? 0))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Went Wrong</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.what_went_wrong}</p>
      </section>

      <TaxAiRecommendationPanel
        issueId={data.issue_id}
        fix={data.ai_recommendation.fix}
        confidence={data.ai_recommendation.confidence}
        source={data.ai_recommendation.source}
        decision={aiDecision}
        navigateOnApprove
        onAfterAction={() => loadTransaction({ silent: true })}
      />

      <AccordionSection id="trail" title="Order Trail" open={!!openSections.trail} onToggle={toggleSection}>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">Jurisdiction</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Correction</th>
            </tr>
          </thead>
          <tbody>
            {data.order_trail.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4">{row.date}</td>
                <td className="py-2 pr-4">{row.event}</td>
                <td className="py-2 pr-4">{row.jurisdiction}</td>
                <td className="py-2 pr-4">{row.status}</td>
                <td className="py-2 pr-4">{row.correction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AccordionSection>

      <AccordionSection id="accuracy" title="Address Accuracy & Risk Signal" open={!!openSections.accuracy} onToggle={toggleSection}>
        <p>Confidence: {data.address_accuracy.confidence}%</p>
        <p className="mt-2">{data.address_accuracy.signal}</p>
        <p className="mt-2">Penalty exposure: {formatMoney(data.address_accuracy.penalty_exposure)}</p>
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
                <td>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AccordionSection>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50">
        <button
          type="button"
          disabled={stickyPending}
          onClick={() => void runJurisdictionCorrection()}
          className={`${taxStickyBtnPrimary} ${showPrimaryCtaNudge ? taxCtaPulseClassAmber : ""}`}
        >
          {stickyPending ? "Processing…" : "Request Jurisdiction Correction"}
        </button>
        <button
          type="button"
          onClick={() => {
            const cid = data.customer_id;
            if (!cid) return;
            navigate(`/hierarchy?customer=${encodeURIComponent(cid)}`);
          }}
          disabled={!data.customer_id}
          className={taxStickyBtnPrimary}
        >
          View Customer
        </button>
        <button
          type="button"
          onClick={() => setComplianceModalOpen(true)}
          className={taxStickyBtnPrimary}
        >
          View Compliance Record
        </button>
      </div>

      {complianceModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Compliance Record</h3>
              <button
                type="button"
                onClick={() => setComplianceModalOpen(false)}
                className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline"
              >
                Close
              </button>
            </div>
            <table className="mt-4 min-w-full text-sm">
              <tbody>
                {Object.entries(data.capa_linkage).map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                    <td className="py-2 pr-4 font-medium capitalize">{k.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-4">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
