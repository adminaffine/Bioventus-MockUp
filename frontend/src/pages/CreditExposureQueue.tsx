import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CreditExposureRecord } from "../services/api";

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

export default function CreditExposureQueue() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CreditExposureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCreditExposure()
      .then((payload) => {
        setRows(payload.records);
        setError(null);
      })
      .catch(() => {
        setRows([]);
        setError("Unable to load credit exposure queue. Please refresh or restart backend services.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Credit Exposure Queue</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Parent-level IDN credit utilization with hold/release prioritization context.
        </p>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Parent flows: <Link to="/csuite" className="text-indigo-600 dark:text-indigo-300">C-Suite</Link> · <Link to="/hierarchy" className="text-indigo-600 dark:text-indigo-300">Hierarchy</Link> · <Link to="/alerts" className="text-indigo-600 dark:text-indigo-300">Alerts</Link>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading credit exposure queue...</div>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No high-risk credit exposures found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">IDN</th>
                  <th className="py-2 pr-4">Credit Limit</th>
                  <th className="py-2 pr-4">Utilized</th>
                  <th className="py-2 pr-4">Utilization %</th>
                  <th className="py-2 pr-4">Risk</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Drilldown</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.idn_id} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{row.idn_name}</td>
                    <td className="py-2 pr-4">{formatMoney(row.credit_limit)}</td>
                    <td className="py-2 pr-4">{formatMoney(row.utilized_amount)}</td>
                    <td className="py-2 pr-4">{row.utilization_pct}%</td>
                    <td className="py-2 pr-4">{row.risk_tier}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2 pr-4">
                      <button type="button" onClick={() => navigate(`/hierarchy?idn=${row.idn_id}`)} className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        Open in Hierarchy →
                      </button>
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
