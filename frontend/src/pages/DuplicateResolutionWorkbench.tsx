import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DuplicateCandidateRecord } from "../services/api";
import { useRole } from "../context/RoleContext";

export default function DuplicateResolutionWorkbench() {
  const { currentRole } = useRole();
  const [rows, setRows] = useState<DuplicateCandidateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDuplicateCandidates()
      .then((payload) => {
        setRows(payload.records);
        setError(null);
      })
      .catch(() => {
        setRows([]);
        setError("Unable to load duplicate candidates. Please refresh or restart backend services.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const applyDecision = async (duplicateId: string, action: "merge" | "sunset") => {
    setBusyId(duplicateId);
    try {
      const result = await api.decideDuplicateCandidate({
        duplicate_id: duplicateId,
        action,
        actor_role: currentRole.id,
        actor_name: currentRole.personaName,
        reason: action === "merge" ? "High confidence duplicate merge approved" : "Secondary record sunset approved",
      });
      if (result.ok) {
        setRows((prev) => prev.filter((row) => row.duplicate_id !== duplicateId));
        setToast(`Duplicate ${duplicateId} ${action} action recorded`);
      } else {
        setToast(`Unable to process ${duplicateId}`);
      }
    } catch {
      setToast(`Unable to process ${duplicateId}`);
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-6 z-50 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm">{toast}</div>}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Duplicate Resolution Workbench</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Data Stewardship workspace to resolve duplicate entities that distort hierarchy, pricing eligibility, and downstream reporting.
        </p>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Parent flows: <Link to="/hierarchy" className="text-indigo-600 dark:text-indigo-300">Hierarchy Intelligence</Link> · <Link to="/alerts" className="text-indigo-600 dark:text-indigo-300">Alerts</Link> · <Link to="/governance" className="text-indigo-600 dark:text-indigo-300">Governance</Link>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading duplicate candidates...</div>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No duplicate candidates found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">Duplicate Pair</th>
                  <th className="py-2 pr-4">Candidate A</th>
                  <th className="py-2 pr-4">Candidate B</th>
                  <th className="py-2 pr-4">Confidence</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.duplicate_id} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{row.duplicate_id}</td>
                    <td className="py-2 pr-4">
                      {row.record_a.customer_name}
                      <div className="text-xs text-slate-500">{row.record_a.customer_id}</div>
                    </td>
                    <td className="py-2 pr-4">
                      {row.record_b.customer_name}
                      <div className="text-xs text-slate-500">{row.record_b.customer_id}</div>
                    </td>
                    <td className="py-2 pr-4">{row.confidence_score}%</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === row.duplicate_id}
                          onClick={() => applyDecision(row.duplicate_id, "merge")}
                          className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          Merge
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.duplicate_id}
                          onClick={() => applyDecision(row.duplicate_id, "sunset")}
                          className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700"
                        >
                          Sunset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
