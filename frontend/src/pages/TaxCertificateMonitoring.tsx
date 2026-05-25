import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type TaxCert } from "../services/api";

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

export default function TaxCertificateMonitoring() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TaxCert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getTaxCerts()
      .then((payload) => setRows(payload.certs))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tax Certificate Monitoring</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Monitor certificate expiry and exemption status before invoice processing.
        </p>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Parent flows: <Link to="/revenue?tab=tax" className="text-indigo-600 dark:text-indigo-300">Revenue & Risk (Tax)</Link> · <Link to="/compliance" className="text-indigo-600 dark:text-indigo-300">Compliance</Link> · <Link to="/alerts" className="text-indigo-600 dark:text-indigo-300">Alerts</Link>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading tax certificate queue...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">Cert ID</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Days to Expiry</th>
                  <th className="py-2 pr-4">Revenue at Risk</th>
                  <th className="py-2 pr-4">Drilldown</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.cert_id} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{row.cert_id}</td>
                    <td className="py-2 pr-4">{row.customer_id}</td>
                    <td className="py-2 pr-4">{row.cert_status}</td>
                    <td className="py-2 pr-4">{row.days_to_expiry ?? "N/A"}</td>
                    <td className="py-2 pr-4">{formatMoney(row.revenue_at_risk)}</td>
                    <td className="py-2 pr-4">
                      <button type="button" onClick={() => navigate("/revenue?tab=tax")} className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        Open in Revenue →
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
