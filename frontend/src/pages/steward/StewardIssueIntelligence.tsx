import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type StewardIssueDetail } from "../../services/api";
import { stewardCtaPulseClass } from "../../utils/stewardWorkflowStorage";
import StewardActionToast from "../../components/steward/StewardActionToast";
import StewardAiRecommendationPanel from "../../components/steward/StewardAiRecommendationPanel";
import StewardReassignModal from "../../components/steward/StewardReassignModal";
import type { StewardTeamOwner } from "../../config/stewardTeamOwners";
import { resolveStewardOwner } from "../../utils/stewardOwnerNormalize";
import { pricingStickyBtnPrimary } from "../../components/pricing/pricingStickyButtonStyles";

export default function StewardIssueIntelligence() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StewardIssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [clickedRecordIds, setClickedRecordIds] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [stickyPending, setStickyPending] = useState<"acknowledge" | "reassign" | null>(null);

  const loadIssue = () => {
    if (!issueId) return;
    setLoading(true);
    api.getStewardIssue(issueId).then((detail) => {
      const owner = resolveStewardOwner(detail.issue);
      setData({
        ...detail,
        issue: { ...detail.issue, owner_id: owner.owner_id, owner_name: owner.owner_name },
        owner: { ...detail.owner, owner_id: owner.owner_id, owner_name: owner.owner_name },
      });
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIssue();
  }, [issueId]);

  useEffect(() => {
    if (data && data.issue.ai_decision !== "approve") {
      setOpenSections((prev) => ({ ...prev, prescribed: true }));
    }
  }, [data]);
  if (loading || !data || !issueId) return <div className="text-sm text-slate-500">Loading...</div>;

  const aiDecision = data.issue.ai_decision ?? null;

  const toggleSection = (id: string) => {
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  };

  const firstAffectedRecordIndex = new Map<string, number>();
  data.affected_records.forEach((r, index) => {
    const recordKey = String(r.customer).trim().toUpperCase();
    if (!firstAffectedRecordIndex.has(recordKey)) {
      firstAffectedRecordIndex.set(recordKey, index);
    }
  });

  const handleReassignConfirm = async (owner: StewardTeamOwner) => {
    setStickyPending("reassign");
    try {
      const result = await api.stewardReassign(issueId, owner.owner_id);
      setActionToast(`Issue reassigned to ${result.owner_name}`);
      loadIssue();
    } finally {
      setStickyPending(null);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {actionToast && <StewardActionToast message={actionToast} onDismiss={() => setActionToast(null)} />}
      <button onClick={() => navigate("/steward-dashboard")} className="text-sm text-indigo-600">← Back to Dashboard</button>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{String(data.header.issue_type)}</span>
          <span className="text-slate-600 dark:text-slate-300">{String(data.header.customer)}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{String(data.header.priority)}</span>
          <span className="font-medium">{Number(data.header.dollar_impact).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
          <span className="text-slate-500 dark:text-slate-400">Opened {String(data.header.opened_on)}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{String(data.header.sla)}</span>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Happened</h2><p className="text-sm mt-2 text-slate-600 dark:text-slate-300">{data.what_happened}</p></section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Business Risk & Impact</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700"><th className="py-2 pr-4">Affected Team</th><th className="py-2 pr-4">Exposure</th><th className="py-2 pr-4">Risk Type</th></tr></thead>
          <tbody>{data.business_risk.map((r)=><tr key={r.affected_team} className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4">{r.affected_team}</td><td className="py-2 pr-4">{r.exposure}</td><td className="py-2 pr-4">{r.risk_type}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Owner & Next Action</h2>
        <table className="mt-4 min-w-full text-sm"><tbody>
          <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium w-32">Owner</td><td>{data.owner.owner_name} ({data.owner.owner_id})</td></tr>
          <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium">Assigned On</td><td>{data.owner.assigned_on}</td></tr>
          <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium">Next Action</td><td>{data.owner.next_action}</td></tr>
          <tr><td className="py-2 pr-4 font-medium">SLA Remaining</td><td>{data.owner.sla_remaining}</td></tr>
        </tbody></table>
      </section>

      <StewardAiRecommendationPanel
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
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Customer</th>
              <th className="py-2 pr-4">Open Orders</th>
              <th className="py-2 pr-4">Contract</th>
              <th className="py-2 pr-4">Current IDN Parent</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {data.affected_records.map((r, index) => {
              const recordKey = String(r.customer).trim().toUpperCase();
              const isOriginalRecord = firstAffectedRecordIndex.get(recordKey) === index;
              const rowKey = `${recordKey}-${index}`;
              const clicked = clickedRecordIds.has(rowKey);
              return (
                <tr key={rowKey} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4">{r.customer_name}</td>
                  <td className="py-2 pr-4">{r.open_order}</td>
                  <td className="py-2 pr-4">{r.contract}</td>
                  <td className="py-2 pr-4">{r.current_idn_parent}</td>
                  <td className="py-2 pr-4 text-right">
                    {isOriginalRecord ? (
                      <button
                        type="button"
                        className={`text-sm px-3 py-1.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 ${
                          clicked ? "" : stewardCtaPulseClass
                        }`}
                        onClick={() => {
                          setClickedRecordIds((prev) => new Set(prev).add(rowKey));
                          navigate(`/steward/record/${r.customer}`);
                        }}
                      >
                        Open Record →
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

      {openSections.prescribed && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Prescribed Actions</h2>
          <ol className="list-decimal ml-5 mt-3 text-sm text-slate-600 dark:text-slate-300">
            {data.prescribed_actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,why:!s.why}))}>▶ Why It Happened</button>{openSections.why && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.why_it_happened}</p>}</section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,preventive:!s.preventive}))}>▶ Preventive Actions</button>{openSections.preventive && <ol className="list-decimal ml-5 mt-3 text-sm text-slate-600 dark:text-slate-300">{data.preventive_actions.map((a)=><li key={a}>{a}</li>)}</ol>}</section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,capa:!s.capa}))}>▶ CAPA Linkage</button>{openSections.capa && <table className="mt-3 min-w-full text-sm"><tbody><tr><td className="py-1 pr-4 font-medium">CAPA ID</td><td>{data.capa_linkage.capa_id}</td></tr><tr><td className="py-1 pr-4 font-medium">Regulation</td><td>{data.capa_linkage.regulation}</td></tr><tr><td className="py-1 pr-4 font-medium">Status</td><td>{data.capa_linkage.status}</td></tr><tr><td className="py-1 pr-4 font-medium">Owner</td><td>{data.capa_linkage.owner}</td></tr><tr><td className="py-1 pr-4 font-medium">Due Date</td><td>{data.capa_linkage.due_date}</td></tr></tbody></table>}</section>
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t px-6 py-4 flex gap-3 z-50">
        <button
          type="button"
          className={pricingStickyBtnPrimary}
          disabled={acknowledged || stickyPending === "acknowledge"}
          onClick={() => {
            setStickyPending("acknowledge");
            setAcknowledged(true);
            setActionToast("Issue acknowledged — ownership confirmed and correction in progress");
            setStickyPending(null);
          }}
        >
          {acknowledged ? "Acknowledged ✓" : "Acknowledge"}
        </button>
        <button
          type="button"
          className={pricingStickyBtnPrimary}
          disabled={stickyPending === "reassign"}
          onClick={() => setReassignOpen(true)}
        >
          Reassign
        </button>
      </div>
      <StewardReassignModal
        open={reassignOpen}
        issueId={issueId}
        customerId={data.issue.customer_id}
        currentOwnerId={data.owner.owner_id}
        currentOwnerName={data.owner.owner_name}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignConfirm}
      />
    </div>
  );
}
