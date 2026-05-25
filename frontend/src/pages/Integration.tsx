import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { cn } from "../lib/utils";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_INT_INTEGRITY, TOOLTIP_INT_MATCH_RATE, TOOLTIP_INT_ORPHAN } from "../lib/tooltipContent";

export default function Integration() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getIntegrationGaps>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getIntegrationGaps()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return <div>Failed to load integration gaps.</div>;

  const nodes = ["customer_master", "product_catalog", "sales_orders", "patient_support"];
  const edges = data.edges || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary dark:text-primary-light">
          Data Integration & Lineage
        </h1>
        <a
          href={api.getIssuesExportUrl()}
          download
          className="px-4 py-2 rounded-lg bg-primary text-white dark:bg-primary-light hover:opacity-90"
        >
          Download integration gap report (CSV)
        </a>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-6">Lineage View</h2>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {nodes.map((n) => (
            <div
              key={n}
              className="rounded-xl border-2 border-primary/30 dark:border-primary-light/50 bg-primary/5 dark:bg-primary/10 px-6 py-4 font-mono text-sm"
            >
              {n}
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-6 justify-center">
          {edges.map((e, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                e.status === "green" && "border-green-500 bg-green-50 dark:bg-green-900/20",
                e.status === "amber" && "border-amber-500 bg-amber-50 dark:bg-amber-900/20",
                e.status === "red" && "border-red-500 bg-red-50 dark:bg-red-900/20"
              )}
            >
              <span className="font-medium">{e.from}</span> → <span className="font-medium">{e.to}</span>
              <br />
              <span className="text-slate-600 dark:text-slate-400">Join: {e.join_key}</span>
              <br />
              Match rate: <strong>{e.match_rate}%</strong><InfoTooltip content={TOOLTIP_INT_MATCH_RATE} /> · Orphaned: <strong>{e.orphaned_count}</strong><InfoTooltip content={TOOLTIP_INT_ORPHAN} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 p-5">
        <p className="font-semibold text-rose-800 dark:text-rose-200">⚠ Recalled Product Chain Detected</p>
        <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
          EXOGEN 4.0 (PRD-008) was recalled on 2025-09-15. 4 sales orders were placed after the recall date.
          4 patient support cases reference this recalled product. This chain represents a critical FDA MDR reporting obligation.
        </p>
        <button
          type="button"
          onClick={() => navigate("/compliance")}
          className="mt-3 text-sm font-medium underline underline-offset-2"
        >
          View MDR Compliance Gaps →
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <h2 className="text-lg font-semibold p-6">Referential Integrity Report <InfoTooltip content={TOOLTIP_INT_INTEGRITY} /></h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-700 px-6 pb-6">
          {Object.entries(data.linkage_issues || {}).map(([key, v]) => (
            <li key={key} className="py-4">
              <p className="font-mono text-sm font-medium">{key.replace(/_/g, " → ")}</p>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Orphaned records: <strong>{v.orphaned_records}</strong> · Match rate:{" "}
                <strong>{v.match_rate_pct}%</strong>
              </p>
              <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 w-full max-w-md">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    v.match_rate_pct >= 90 ? "bg-emerald-500" : v.match_rate_pct >= 70 ? "bg-amber-500" : "bg-rose-500"
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, v.match_rate_pct))}%` }}
                />
              </div>
              {v.sample_orphan_ids?.length ? (
                <p className="text-xs mt-2 text-slate-500">
                  Sample IDs: {v.sample_orphan_ids.slice(0, 5).join(", ")}
                </p>
              ) : null}
              {v.orphaned_records > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/profiler?dataset=${String(key).split("_to_")[0]}`)}
                  className="mt-2 text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                >
                  View Orphan Records →
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
