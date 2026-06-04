import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import VPAiRecommendationPanel from "../../components/vp/VPAiRecommendationPanel";
import VPReassignModal from "../../components/vp/VPReassignModal";
import type { VPTeamMember } from "../../config/vpTeamOwners";
import { useVPWorkflow } from "../../context/VPWorkflowContext";
import { api, type VPIssueDetail } from "../../services/api";
import { formatVPMoney, priorityClass, slaClass } from "../../utils/vpDashboard";
import { advanceVpReviewIfCurrent } from "../../utils/vpWorkflowStorage";

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

export default function VPIssueDetail() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { vpReassign, refreshDashboard } = useVPWorkflow();
  const [data, setData] = useState<VPIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [reassignOpen, setReassignOpen] = useState(false);

  const loadIssue = (options?: { silent?: boolean }) => {
    if (!issueId) return;
    if (!options?.silent) setLoading(true);
    api
      .getVPIssue(issueId)
      .then(setData)
      .finally(() => {
        if (!options?.silent) setLoading(false);
      });
  };

  useEffect(() => {
    loadIssue();
  }, [issueId]);

  useEffect(() => {
    if (issueId) advanceVpReviewIfCurrent(issueId);
  }, [issueId]);

  useEffect(() => {
    if (data && !data.workflow.ai_approved) {
      setOpenSections((prev) => ({ ...prev, prescribed: true }));
    }
  }, [data]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReassignConfirm = async (member: VPTeamMember) => {
    if (!issueId) return;
    await vpReassign(issueId, member.id, member.name);
    await refreshDashboard({ silent: true });
    setReassignOpen(false);
    navigate(`/vp/closure/${issueId}`);
  };

  if (loading) return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  if (!data || !issueId) return null;

  const issue = data.issue as { order_id?: string; sla_days_remaining?: number; ai_decision?: string };
  const aiDecision =
    issue.ai_decision === "approve" || data.ai_decision === "approve" || data.workflow.ai_approved
      ? ("approve" as const)
      : null;
  const orderId = issue.order_id || data.ai_recommendation.order_id || "";
  const slaDays = Number(issue.sla_days_remaining ?? 0);
  const slaHealth = String(data.header.sla_health ?? data.owner.sla_health ?? "On Track");

  return (
    <div className="space-y-6 pb-8">
      <button
        type="button"
        onClick={() => navigate("/vp-dashboard")}
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
          <span className="font-medium">{formatVPMoney(Number(data.header.dollar_impact))}</span>
          <span className="text-slate-500">Opened {String(data.header.opened_on)}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${slaClass(slaHealth, slaDays)}`}>{String(data.header.sla)}</span>
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
              <td className="py-2 pr-4">{data.owner.owner_name || "Unassigned"}</td>
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

      <VPAiRecommendationPanel
        issueId={issueId}
        fix={data.ai_recommendation.fix}
        confidence={data.ai_recommendation.confidence}
        source={data.ai_recommendation.source}
        decision={aiDecision}
        navigateOnApprove
        onReassign={() => setReassignOpen(true)}
        onAfterAction={() => loadIssue({ silent: true })}
      />
      <button
        type="button"
        onClick={() => toggleSection("prescribed")}
        className="-mt-4 text-xs text-indigo-600 dark:text-indigo-300 hover:underline px-6"
      >
        Not comfortable approving? View Prescribed Actions {openSections.prescribed ? "▼" : "▶"}
      </button>

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
              <td>{data.capa_linkage.regulation ?? data.capa_linkage.area}</td>
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

      <VPReassignModal
        open={reassignOpen}
        issueId={issueId}
        recordLabel={orderId || String(data.header.customer)}
        currentOwnerId={data.owner.owner_id}
        currentOwnerName={data.owner.owner_name}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />
    </div>
  );
}
