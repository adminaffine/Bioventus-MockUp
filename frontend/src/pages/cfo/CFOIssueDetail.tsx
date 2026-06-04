import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../services/api";
import CFOActionToast from "../../components/cfo/CFOActionToast";
import CFOAiRecommendationPanel from "../../components/cfo/CFOAiRecommendationPanel";
import CFOReassignModal from "../../components/cfo/CFOReassignModal";
import { cfoStickyBtnPrimary } from "../../components/cfo/cfoStickyButtonStyles";
import type { CFOTeamOwner } from "../../config/cfoTeamOwners";
import { CFO_TEAM_OWNERS } from "../../config/cfoTeamOwners";
import { useCFOWorkflow } from "../../context/CFOWorkflowContext";
import {
  buildCfoAiRecommendationsFromAlert,
  cfoNextActionPricing,
  cfoNextActionTax,
  priorityClass,
} from "../../utils/cfoDashboard";
import { buildCfoPrescribedActions } from "../../utils/personaPrescribedActions";
import { advanceCfoReviewIfCurrent, cfoCtaPulseClass, saveCFOActiveAlert } from "../../utils/cfoWorkflowStorage";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function slaClass(days: number): string {
  if (days <= 2) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (days <= 5) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
}

type OwnerBlock = {
  owner_id: string;
  owner_name?: string;
  team?: string;
  assigned_on?: string;
  next_action?: string | null;
};

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
        <span>
          {open ? "▼" : "▶"} {title}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-6 pb-6 text-sm text-slate-600 dark:text-slate-300">{children}</div>}
    </div>
  );
}

function resolveCfoAssigneeId(cfoAssignee: string | undefined, owners: OwnerBlock[]): string {
  const match = CFO_TEAM_OWNERS.find((o) => o.id === cfoAssignee || o.name === cfoAssignee);
  if (match) return match.id;
  return owners[0]?.owner_id ?? CFO_TEAM_OWNERS[0].id;
}

export default function CFOIssueDetail() {
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();
  const { reassignAlert } = useCFOWorkflow();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getCFOIssueDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState({ why: true, capa: true });
  const [reassignOpen, setReassignOpen] = useState(false);
  const [stickyPending, setStickyPending] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  useEffect(() => {
    if (!alertId) return;
    setLoading(true);
    setLoadError(null);
    api
      .getCFOIssueDetail(alertId)
      .then(setDetail)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load issue"))
      .finally(() => setLoading(false));
  }, [alertId]);

  useEffect(() => {
    if (!alertId) return;
    advanceCfoReviewIfCurrent(alertId);
    saveCFOActiveAlert(alertId);
  }, [alertId]);

  useEffect(() => {
    if (detail) {
      setOpenSections((prev) => ({ ...prev, prescribed: true }));
    }
  }, [detail]);

  const reloadDetail = () => {
    if (!alertId) return;
    return api.getCFOIssueDetail(alertId).then(setDetail);
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReassignConfirm = async (owner: CFOTeamOwner) => {
    if (!alertId) return;
    setStickyPending("reassign");
    try {
      await reassignAlert(alertId, owner.id, owner.name);
      setActionToast(`Alert reassigned to ${owner.name}`);
      await reloadDetail();
    } finally {
      setStickyPending(null);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Loading...</div>;
  if (loadError || !detail || !alertId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-6 text-sm text-red-800 dark:text-red-200">
        {loadError ?? "Issue not found."}
        <button type="button" className="mt-3 block text-indigo-600" onClick={() => navigate("/cfo-dashboard")}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const a = detail.alert;
  const header = detail.header;
  const aiRecommendations =
    (a as { ai_recommendation_lines?: string[] }).ai_recommendation_lines?.length
      ? (a as { ai_recommendation_lines: string[] }).ai_recommendation_lines
      : detail.ai_recommendations?.length
        ? detail.ai_recommendations
        : buildCfoAiRecommendationsFromAlert(a);

  const owners: OwnerBlock[] = (() => {
    if (detail.owners?.length) return detail.owners;
    const fallback: OwnerBlock[] = [];
    if (a.tax_owner_id) {
      fallback.push({
        owner_id: a.tax_owner_id,
        owner_name: a.tax_owner_name,
        team: a.tax_owner_team,
        assigned_on: a.opened_date,
        next_action: a.next_action_tax ?? cfoNextActionTax(a),
      });
    }
    if (a.pricing_owner_id) {
      fallback.push({
        owner_id: a.pricing_owner_id,
        owner_name: a.pricing_owner_name,
        team: a.pricing_owner_team,
        assigned_on: a.opened_date,
        next_action: a.next_action_pricing ?? cfoNextActionPricing(a),
      });
    }
    return fallback;
  })();

  const marginPct =
    a.dollar_exposure > 0 ? ((a.margin_at_risk / a.dollar_exposure) * 100).toFixed(1) : "0";

  const whatHappened = `Order ${a.order_id} for ${a.account_name} is scheduled to be invoiced in ${a.sla_days_remaining} days. ${a.root_cause_primary || ""}${
    a.root_cause_secondary ? ` ${a.root_cause_secondary}` : ""
  } Combined financial exposure is ${money(a.dollar_exposure)} if not resolved before invoicing.`;

  const toggle = (key: keyof typeof collapsed) => setCollapsed((s) => ({ ...s, [key]: !s[key] }));
  const prescribedActions = buildCfoPrescribedActions(a);
  const currentAssigneeId = resolveCfoAssigneeId(a.cfo_assignee, owners);

  return (
    <div className="space-y-6 pb-24">
      {actionToast && <CFOActionToast message={actionToast} onDismiss={() => setActionToast(null)} />}
      <button type="button" onClick={() => navigate("/cfo-dashboard")} className="text-sm text-indigo-600 dark:text-indigo-400">
        ← Back to Dashboard
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {header?.issue_type ?? a.issue_type}
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            {header?.customer ?? `${a.account_id} ${a.account_name} — ${a.order_id}`}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(String(header?.priority ?? a.priority))}`}>
            {header?.priority ?? a.priority}
          </span>
          <span className="font-medium">{money(Number(header?.dollar_impact ?? a.dollar_exposure))}</span>
          <span className="text-slate-500 dark:text-slate-400">Opened {header?.opened_on ?? a.opened_date}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${slaClass(a.sla_days_remaining)}`}>
            {header?.sla ?? `${a.sla_days_remaining} days remaining`}
          </span>
          {header?.invoice_status && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {header.invoice_status}
            </span>
          )}
          <span className="text-slate-500 dark:text-slate-400">
            Margin at risk {money(Number(header?.margin_at_risk ?? a.margin_at_risk))}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Happened</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{whatHappened}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Business Risk & Impact</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium w-40">Revenue at Risk</td>
              <td className="py-2 pr-4">{money(a.dollar_exposure)}</td>
              <td className="py-2 pr-4 text-slate-500">Fully preventable if resolved before invoicing</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Margin at Risk</td>
              <td className="py-2 pr-4">{money(a.margin_at_risk)}</td>
              <td className="py-2 pr-4 text-slate-500">{marginPct}% of order value at risk</td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium">Penalty Exposure</td>
              <td className="py-2 pr-4">{money(a.penalty_exposure)}</td>
              <td className="py-2 pr-4 text-slate-500">Penalty avoidable if resolved pre-invoice</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">Legal Risk</td>
              <td className="py-2 pr-4" colSpan={2}>
                {a.legal_risk}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Owner & Next Action</h2>
        <div className="mt-4 space-y-6">
          {owners.map((owner, index) => (
            <table key={owner.owner_id} className="min-w-full text-sm">
              {owners.length > 1 && (
                <caption className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  {owner.team ?? `Owner ${index + 1}`}
                </caption>
              )}
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium w-32">Owner</td>
                  <td className="py-2 pr-4">
                    {owner.owner_name} ({owner.owner_id})
                  </td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">Assigned On</td>
                  <td className="py-2 pr-4">{owner.assigned_on ?? a.opened_date}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Next Action</td>
                  <td className="py-2 pr-4">{owner.next_action ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          ))}
        </div>
      </section>

      <CFOAiRecommendationPanel recommendations={aiRecommendations} />
      <button
        type="button"
        onClick={() => toggleSection("prescribed")}
        className="-mt-4 text-xs text-indigo-600 dark:text-indigo-300 hover:underline px-6"
      >
        Not comfortable approving? View Prescribed Actions {openSections.prescribed ? "▼" : "▶"}
      </button>

      <AccordionSection id="prescribed" title="Prescribed Actions" open={!!openSections.prescribed} onToggle={toggleSection}>
        <ol className="list-decimal list-inside space-y-2">
          {prescribedActions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </AccordionSection>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <button type="button" onClick={() => toggle("why")} className="w-full flex items-center justify-between p-6 text-left">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Why It Happened</h2>
          {collapsed.why ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {!collapsed.why && (
          <div className="px-6 pb-6 text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <p>{a.root_cause_primary}</p>
            {a.root_cause_secondary && <p>{a.root_cause_secondary}</p>}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <button type="button" onClick={() => toggle("capa")} className="w-full flex items-center justify-between p-6 text-left">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">CAPA Linkage</h2>
          {collapsed.capa ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {!collapsed.capa && (
          <div className="px-6 pb-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">CAPA</th>
                  <th className="py-2 pr-4">Area</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Owner</th>
                  <th className="py-2 pr-4">Due</th>
                </tr>
              </thead>
              <tbody>
                {detail.capa_entries.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium">{c.id}</td>
                    <td className="py-2 pr-4">{c.area}</td>
                    <td className="py-2 pr-4">{c.status}</td>
                    <td className="py-2 pr-4">{c.owner}</td>
                    <td className="py-2 pr-4">{c.due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CFOReassignModal
        open={reassignOpen}
        alertId={alertId}
        orderId={a.order_id}
        currentAssignee={currentAssigneeId}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50">
        <button
          type="button"
          onClick={() => navigate(`/cfo/closure/${alertId}`)}
          className={`${cfoStickyBtnPrimary} ${cfoCtaPulseClass}`}
        >
          Request Correction
        </button>
        <button
          type="button"
          onClick={() => setReassignOpen(true)}
          disabled={stickyPending === "reassign"}
          className={cfoStickyBtnPrimary}
        >
          Reassign
        </button>
      </div>
    </div>
  );
}
