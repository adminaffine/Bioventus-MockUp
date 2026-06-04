import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api, type CCOIssue } from "../../services/api";
import CCOActionToast from "../../components/cco/CCOActionToast";
import CCOAiRecommendationPanel from "../../components/cco/CCOAiRecommendationPanel";
import CCOReassignModal from "../../components/cco/CCOReassignModal";
import { ccoStickyBtnPrimary } from "../../components/cco/ccoStickyButtonStyles";
import type { CCOTeamOwner } from "../../config/ccoTeamOwners";
import { CCO_TEAM_MEMBERS } from "../../config/ccoTeamOwners";
import { useCCOWorkflow } from "../../context/CCOWorkflowContext";
import { priorityClass, healthClass } from "../../utils/ccoDashboard";
import { buildCcoPrescribedActions } from "../../utils/personaPrescribedActions";
import {
  advanceCcoReviewIfCurrent,
  ccoCtaPulseClass,
  saveCCOActiveIssue,
} from "../../utils/ccoWorkflowStorage";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type OwnerBlock = {
  owner_id: string;
  owner_name?: string;
  team?: string;
  assigned_on?: string;
  next_action?: string;
};

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
        <span>
          {open ? "▼" : "▶"} {title}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-6 pb-6 text-sm text-slate-600 dark:text-slate-300">{children}</div>}
    </div>
  );
}

function resolveCcoAssigneeId(ccoAssignee: string | undefined, owners: OwnerBlock[]): string {
  const match = CCO_TEAM_MEMBERS.find((o) => o.id === ccoAssignee || o.name === ccoAssignee);
  if (match) return match.id;
  return owners[0]?.owner_id ?? CCO_TEAM_MEMBERS[0].id;
}

export default function CCOIssueDetail() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { reassignAlert } = useCCOWorkflow();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getCCOIssueDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState({ why: true, capa: true, regulation: true });
  const [reassignOpen, setReassignOpen] = useState(false);
  const [stickyPending, setStickyPending] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;
    setLoading(true);
    setLoadError(null);
    api
      .getCCOIssueDetail(issueId)
      .then(setDetail)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load issue"))
      .finally(() => setLoading(false));
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    advanceCcoReviewIfCurrent(issueId);
    saveCCOActiveIssue(issueId);
  }, [issueId]);

  useEffect(() => {
    if (detail) {
      setOpenSections((prev) => ({ ...prev, prescribed: true }));
    }
  }, [detail]);

  const reloadDetail = () => {
    if (!issueId) return;
    return api.getCCOIssueDetail(issueId).then(setDetail);
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReassignConfirm = async (owner: CCOTeamOwner) => {
    if (!issueId) return;
    setStickyPending("reassign");
    try {
      await reassignAlert(issueId, owner.id, owner.name);
      setActionToast(`Issue reassigned to ${owner.name}`);
      await reloadDetail();
    } finally {
      setStickyPending(null);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Loading...</div>;
  if (loadError || !detail || !issueId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-6 text-sm text-red-800 dark:text-red-200">
        {loadError ?? "Issue not found."}
        <button type="button" className="mt-3 block text-indigo-600" onClick={() => navigate("/cco-dashboard")}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const issue = detail.issue as CCOIssue;
  const header = detail.header;
  const aiRecommendations =
    detail.ai_recommendations?.length > 0
      ? detail.ai_recommendations
      : [issue.ai_fix_1, issue.ai_fix_2].filter((line): line is string => Boolean(line?.trim()));

  const owners: OwnerBlock[] = detail.owners ?? [];
  const toggle = (key: keyof typeof collapsed) => setCollapsed((s) => ({ ...s, [key]: !s[key] }));
  const prescribedActions = buildCcoPrescribedActions(issue);
  const currentAssigneeId = resolveCcoAssigneeId(issue.cco_assignee, owners);

  return (
    <div className="space-y-6 pb-24">
      {actionToast && <CCOActionToast message={actionToast} onDismiss={() => setActionToast(null)} />}
      <button type="button" onClick={() => navigate("/cco-dashboard")} className="text-sm text-indigo-600 dark:text-indigo-400">
        ← Back to Dashboard
      </button>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {header?.issue_type ?? issue.issue_type}
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            {header?.account ?? `${issue.account_id} ${issue.account_name} — ${issue.order_id}`}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(String(header?.priority ?? issue.priority))}`}>
            {header?.priority ?? issue.priority}
          </span>
          <span className="font-medium">{money(Number(header?.penalty_exposure ?? issue.penalty_exposure))}</span>
          <span className="text-slate-500 dark:text-slate-400">Opened {header?.opened_on ?? issue.opened_date}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${slaClass(issue.sla_days_remaining)}`}>
            {header?.sla ?? `${issue.sla_days_remaining} days remaining`}
          </span>
          {header?.invoice_status && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {String(header.invoice_status)}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Happened</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{detail.what_happened}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Compliance Risk & Impact</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            {detail.compliance_risk.map((row) => (
              <tr key={row.risk_type} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-2 pr-4 font-medium w-48">{row.risk_type}</td>
                <td className="py-2 pr-4">{row.value}</td>
                <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Owner & Next Action</h2>
        <div className="mt-4 space-y-6">
          {owners.length === 0 ? (
            <p className="text-sm text-slate-500">No owners assigned.</p>
          ) : (
            owners.map((owner, index) => (
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
                    <td className="py-2 pr-4">{owner.assigned_on ?? issue.opened_date}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Next Action</td>
                    <td className="py-2 pr-4">{owner.next_action ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            ))
          )}
        </div>
      </section>

      <CCOAiRecommendationPanel recommendations={aiRecommendations} />
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
            <p>{issue.root_cause_primary}</p>
            {issue.root_cause_secondary && <p>{issue.root_cause_secondary}</p>}
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
                  <th className="py-2 pr-4">Health</th>
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
                    <td className="py-2 pr-4">
                      {c.health ? (
                        <span className={`text-xs px-2 py-0.5 rounded ${healthClass(c.health)}`}>{c.health}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <button
          type="button"
          onClick={() => toggle("regulation")}
          className="w-full flex items-center justify-between p-6 text-left"
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Regulation Reference</h2>
          {collapsed.regulation ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {!collapsed.regulation && (
          <div className="px-6 pb-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Statute</th>
                  <th className="py-2 pr-4">Requirement</th>
                </tr>
              </thead>
              <tbody>
                {detail.regulation_references.map((ref, i) => (
                  <tr key={`${ref.state}-${i}`} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium">{ref.state}</td>
                    <td className="py-2 pr-4">{ref.statute}</td>
                    <td className="py-2 pr-4">{ref.requirement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CCOReassignModal
        open={reassignOpen}
        issueId={issueId}
        orderId={issue.order_id}
        currentAssignee={currentAssigneeId}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50">
        <button
          type="button"
          onClick={() => navigate(`/cco/closure/${issueId}`)}
          className={`${ccoStickyBtnPrimary} ${ccoCtaPulseClass}`}
        >
          Request Correction
        </button>
        <button
          type="button"
          onClick={() => setReassignOpen(true)}
          disabled={stickyPending === "reassign"}
          className={ccoStickyBtnPrimary}
        >
          Reassign
        </button>
      </div>
    </div>
  );
}
