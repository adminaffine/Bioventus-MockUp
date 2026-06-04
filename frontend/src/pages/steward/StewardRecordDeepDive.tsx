import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type StewardRecordDetail } from "../../services/api";
import { pricingStickyBtnPrimary } from "../../components/pricing/pricingStickyButtonStyles";
import StewardAiRecommendationPanel from "../../components/steward/StewardAiRecommendationPanel";
import { useStewardWorkflow } from "../../context/StewardWorkflowContext";
import { stewardCtaPulseClass } from "../../utils/stewardWorkflowStorage";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function StewardRecordDeepDive() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { resolveIssue } = useStewardWorkflow();
  const [data, setData] = useState<StewardRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const loadRecord = () => {
    if (!customerId) return;
    setLoading(true);
    api.getStewardRecord(customerId).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRecord();
  }, [customerId]);

  if (loading || !data) return <div className="text-sm text-slate-500">Loading...</div>;

  const aiDecision = data.ai_recommendation.decision ?? null;

  return (
    <div className="space-y-6 pb-24">
      <button onClick={() => navigate(`/steward/issue/${data.issue_id}`)} className="text-sm text-indigo-600">← Back to Issue</button>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Record Deep Dive</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {data.record_header.customer_id || "—"} · {data.record_header.customer_name || "—"}
        </p>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Record Header</h2>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium w-40">Customer ID</td><td>{data.record_header.customer_id || "—"}</td></tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium">Customer Name</td><td>{data.record_header.customer_name || "—"}</td></tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium">Hierarchy Level</td><td>{data.record_header.hierarchy_level || "—"}</td></tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium">Source System</td><td>{data.record_header.source_system || "—"}</td></tr>
            <tr className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4 font-medium">Last Updated</td><td>{data.record_header.last_updated || "—"}</td></tr>
            <tr><td className="py-2 pr-4 font-medium">Status</td><td>{data.record_header.status || "—"}</td></tr>
          </tbody>
        </table>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Hierarchy Breakdown</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-4">Mapping Type</th>
              <th className="py-2 pr-4">IDN</th>
              <th className="py-2 pr-4">IDN Name</th>
              <th className="py-2 pr-4">Jurisdiction</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-700/60">
              <td className="py-2 pr-4 font-medium text-red-600 dark:text-red-400">Current in SAP</td>
              <td className="py-2 pr-4">{data.hierarchy_breakdown.current_idn || "—"}</td>
              <td className="py-2 pr-4">{data.hierarchy_breakdown.current_idn_name || "—"}</td>
              <td className="py-2 pr-4">{data.hierarchy_breakdown.jurisdiction_applied || "—"}</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium text-emerald-600 dark:text-emerald-400">Correct (IQVIA)</td>
              <td className="py-2 pr-4">{data.hierarchy_breakdown.correct_idn || "—"}</td>
              <td className="py-2 pr-4">{data.hierarchy_breakdown.correct_idn_name || "—"}</td>
              <td className="py-2 pr-4">{data.hierarchy_breakdown.correct_jurisdiction || "—"}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Effective Date: {data.hierarchy_breakdown.effective_date || "—"} · Downstream Exposure: {money(data.hierarchy_breakdown.downstream_exposure || 0)}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">What Went Wrong</h2><p className="text-sm mt-2 text-slate-600 dark:text-slate-300">{data.what_went_wrong}</p></section>

      <StewardAiRecommendationPanel
        issueId={data.issue_id}
        fix={data.ai_recommendation.fix}
        confidence={data.ai_recommendation.confidence}
        source={data.ai_recommendation.source}
        decision={aiDecision}
        navigateOnApprove
        onAfterAction={loadRecord}
      />

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,trail:!s.trail}))}>▶ Record Trail</button>{openSections.trail && <table className="mt-3 min-w-full text-sm"><thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700"><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Event</th><th className="py-2 pr-4">Detail</th></tr></thead><tbody>{data.record_trail.map((r,idx)=><tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4">{r.date}</td><td className="py-2 pr-4">{r.event}</td><td className="py-2 pr-4">{r.detail}</td></tr>)}</tbody></table>}</section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,mismatch:!s.mismatch}))}>▶ Source System Mismatch</button>{openSections.mismatch && <table className="mt-3 min-w-full text-sm"><thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700"><th className="py-2 pr-4">Source</th><th className="py-2 pr-4">Value</th><th className="py-2 pr-4">Confirmed</th><th className="py-2 pr-4">Since</th></tr></thead><tbody>{data.source_system_mismatch.map((r,idx)=><tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4">{r.source}</td><td className="py-2 pr-4">{r.value}</td><td className="py-2 pr-4">{r.confirmed}</td><td className="py-2 pr-4">{r.since}</td></tr>)}</tbody></table>}</section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,hierarchy:!s.hierarchy}))}>▶ Customer Hierarchy</button>{openSections.hierarchy && <div className="mt-3 text-sm text-slate-600 dark:text-slate-300"><p>{data.customer_hierarchy.idn}</p><p className="pl-4 mt-1">→ {data.customer_hierarchy.hospital}</p><p className="pl-8 mt-1">→ {data.customer_hierarchy.clinic}</p></div>}</section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,cross:!s.cross}))}>▶ Cross-Team Visibility</button>{openSections.cross && <table className="mt-3 min-w-full text-sm"><thead><tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700"><th className="py-2 pr-4">Team</th><th className="py-2 pr-4">Issue</th><th className="py-2 pr-4">Exposure</th><th className="py-2 pr-4">Owner</th></tr></thead><tbody>{data.cross_team_visibility.map((r)=> <tr key={r.team} className="border-b border-slate-100 dark:border-slate-700/60"><td className="py-2 pr-4">{r.team}</td><td className="py-2 pr-4">{r.issue}</td><td className="py-2 pr-4">{r.exposure}</td><td className="py-2 pr-4">{r.owner}</td></tr>)}</tbody></table>}</section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"><button className="text-sm text-indigo-600 dark:text-indigo-300" onClick={()=>setOpenSections((s)=>({...s,capa:!s.capa}))}>▶ CAPA Linkage</button>{openSections.capa && <table className="mt-3 min-w-full text-sm"><tbody><tr><td className="py-1 pr-4 font-medium">CAPA ID</td><td>{data.capa_linkage.capa_id}</td></tr><tr><td className="py-1 pr-4 font-medium">Regulation</td><td>{data.capa_linkage.regulation}</td></tr><tr><td className="py-1 pr-4 font-medium">Status</td><td>{data.capa_linkage.status}</td></tr><tr><td className="py-1 pr-4 font-medium">Owner</td><td>{data.capa_linkage.owner}</td></tr><tr><td className="py-1 pr-4 font-medium">Due Date</td><td>{data.capa_linkage.due_date}</td></tr></tbody></table>}</section>
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 z-50">
        <button
          type="button"
          onClick={async () => {
            await api.stewardManualFixApplied(data.issue_id);
            try {
              const closure = await resolveIssue(data.issue_id);
              navigate(`/steward/closure/${data.issue_id}`, { state: { closure } });
            } catch {
              navigate(`/steward/closure/${data.issue_id}`);
            }
          }}
          className={`${pricingStickyBtnPrimary} ${stewardCtaPulseClass}`}
        >
          Request Record Correction
        </button>
        <button
          type="button"
          onClick={() => navigate("/hierarchy")}
          className={pricingStickyBtnPrimary}
        >
          View Hierarchy
        </button>
        <button
          type="button"
          onClick={() => {
            const cid = data.record_header.customer_id;
            if (!cid) return;
            navigate(`/hierarchy?customer=${encodeURIComponent(cid)}`);
          }}
          disabled={!data.record_header.customer_id}
          className={pricingStickyBtnPrimary}
        >
          View Customer
        </button>
      </div>
    </div>
  );
}
