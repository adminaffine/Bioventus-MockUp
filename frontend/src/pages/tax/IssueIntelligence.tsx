import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import TaxActionToast from "../../components/tax/TaxActionToast";
import TaxAiRecommendationPanel from "../../components/tax/TaxAiRecommendationPanel";
import TaxReassignModal from "../../components/tax/TaxReassignModal";
import { taxStickyBtnPrimary } from "../../components/tax/taxStickyButtonStyles";
import type { TaxTeamOwner } from "../../config/taxTeamOwners";
import { useTaxWorkflow } from "../../context/TaxWorkflowContext";
import { api, type TaxIssueDetail } from "../../services/api";
import { isTaxAiRejected } from "../../utils/taxWorkflowStorage";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function priorityClass(priority: string): string {
  if (priority === "HIGH") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (priority === "MEDIUM") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

function slaClass(days: number): string {
  if (days <= 2) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (days <= 5) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
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

export default function IssueIntelligence() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TaxIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const { issueAction } = useTaxWorkflow();
  const [stickyPending, setStickyPending] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [transactionBtnClicked, setTransactionBtnClicked] = useState(false);

  const loadIssue = (options?: { silent?: boolean }) => {
    if (!issueId) return;
    if (!options?.silent) setLoading(true);
    api
      .getTaxIssue(issueId)
      .then(setData)
      .finally(() => {
        if (!options?.silent) setLoading(false);
      });
  };

  const runAcknowledge = async () => {
    if (!issueId) return;
    setStickyPending("acknowledge");
    try {
      const { message } = await issueAction(issueId, "acknowledge");
      setActionToast(message);
      loadIssue();
    } finally {
      setStickyPending(null);
    }
  };

  const handleReassignConfirm = async (owner: TaxTeamOwner) => {
    if (!issueId) return;
    setStickyPending("reassign");
    try {
      const { message } = await issueAction(issueId, "reassign", {
        owner_id: owner.owner_id,
        owner_name: owner.owner_name,
      });
      setActionToast(message);
      loadIssue();
    } finally {
      setStickyPending(null);
    }
  };

  useEffect(() => {
    loadIssue();
  }, [issueId]);

  useEffect(() => {
    if (data && (data.issue.ai_decision !== "approve" || (issueId && isTaxAiRejected(issueId, data.issue.ai_decision)))) {
      setOpenSections((prev) => ({ ...prev, prescribed: true }));
    }
  }, [data, issueId]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }
  if (!data || !issueId) return null;

  const issue = data.issue;
  const slaDays = issue.sla_days_remaining;
  const aiDecision =
    issue.ai_decision === "approve"
      ? "approve"
      : issue.ai_decision === "reject" || isTaxAiRejected(issueId, issue.ai_decision)
        ? "reject"
        : null;

  const orderId = data.affected_records[0]?.order ?? issue.order_id ?? "";

  return (
    <div className="space-y-6 pb-24">
      {actionToast && <TaxActionToast message={actionToast} onDismiss={() => setActionToast(null)} />}
      <button
        type="button"
        onClick={() => navigate("/tax-dashboard")}
        className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline"
      >
        ← Back to Dashboard
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{String(data.header.issue_type)}</span>
          <span className="text-slate-600 dark:text-slate-300">{String(data.header.customer)}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(String(data.header.priority))}`}>
            {String(data.header.priority)}
          </span>
          <span className="font-medium">{formatMoney(Number(data.header.dollar_impact))}</span>
          <span className="text-slate-500 dark:text-slate-400">Opened {String(data.header.opened_on)}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${slaClass(slaDays)}`}>{String(data.header.sla)}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Went Wrong</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.what_went_wrong ?? data.what_happened}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Business Risk & Impact</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
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
              <td className="py-2 pr-4">{data.owner.owner_name} ({data.owner.owner_id})</td>
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

      <TaxAiRecommendationPanel
        issueId={issueId}
        fix={data.ai_recommendation.fix}
        confidence={data.ai_recommendation.confidence}
        source={data.ai_recommendation.source}
        decision={aiDecision}
        navigateOnApprove
        onAfterAction={() => loadIssue({ silent: true })}
      />
      <button
        type="button"
        onClick={() => toggleSection("prescribed")}
        className="-mt-4 text-xs text-indigo-600 dark:text-indigo-300 hover:underline px-6"
      >
        Not comfortable approving? View Prescribed Actions {openSections.prescribed ? "▼" : "▶"}
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tax Jurisdiction</h2>
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
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4">{issue.ship_to_state}</td>
              <td className="py-2 pr-4">{issue.bill_to_state}</td>
              <td className="py-2 pr-4 text-red-600 dark:text-red-400">{issue.applied_jurisdiction}</td>
              <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400">{issue.correct_jurisdiction}</td>
              <td className="py-2 pr-4">{issue.rate_difference}%</td>
              <td className="py-2 pr-4 font-medium">{formatMoney(Number(issue.dollar_value ?? 0))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Affected Records</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Order</th>
              <th className="py-2 pr-4">Address Record</th>
              <th className="py-2 pr-4">Current Jurisdiction</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {data.affected_records.map((r) => (
              <tr key={r.order} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4">{r.customer}</td>
                <td className="py-2 pr-4 font-medium">{r.order}</td>
                <td className="py-2 pr-4">{r.address_record}</td>
                <td className="py-2 pr-4">{r.current_jurisdiction}</td>
                <td className="py-2 pr-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionBtnClicked(true);
                      navigate(`/tax/transaction/${r.order}`);
                    }}
                    className={`text-sm px-3 py-1.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 ${
                      !transactionBtnClicked ? "pricing-cta-blink ring-2 ring-indigo-400 ring-offset-1" : ""
                    }`}
                  >
                    View Transaction →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AccordionSection
        id="prescribed"
        title="Prescribed Actions"
        open={!!openSections.prescribed}
        onToggle={toggleSection}
      >
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
              <td>{data.capa_linkage.capa_id}</td>
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

      <TaxReassignModal
        open={reassignOpen}
        issueId={issueId}
        orderId={String(orderId)}
        currentOwnerId={data.owner.owner_id}
        currentOwnerName={data.owner.owner_name}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50">
        <button
          type="button"
          onClick={() => void runAcknowledge()}
          disabled={stickyPending === "acknowledge"}
          className={taxStickyBtnPrimary}
        >
          {stickyPending === "acknowledge" ? "Acknowledging…" : "Acknowledge"}
        </button>
        <button
          type="button"
          onClick={() => setReassignOpen(true)}
          disabled={stickyPending === "reassign"}
          className={taxStickyBtnPrimary}
        >
          Reassign
        </button>
      </div>
    </div>
  );
}
