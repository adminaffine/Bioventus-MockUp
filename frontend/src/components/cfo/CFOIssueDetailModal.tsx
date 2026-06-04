import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api, type CFOAlert } from "../../services/api";
import {
  cfoNextActionPricing,
  cfoNextActionTax,
  ownerLabel,
  priorityClass,
  sortTopAlerts,
} from "../../utils/cfoDashboard";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type Props = {
  issueType: string;
  alerts: CFOAlert[];
  onClose: () => void;
};

export default function CFOIssueDetailModal({ issueType, alerts, onClose }: Props) {
  const sorted = useMemo(() => sortTopAlerts(alerts), [alerts]);
  const primaryId = sorted[0]?.alert_id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getCFOIssueDetail>> | null>(null);

  useEffect(() => {
    if (!primaryId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getCFOIssueDetail(primaryId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load issue detail"))
      .finally(() => setLoading(false));
  }, [primaryId]);

  const totalExposure = alerts.reduce((s, a) => s + a.dollar_exposure, 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Issue Detail</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{issueType}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {alerts.length} record{alerts.length === 1 ? "" : "s"} at risk · {money(totalExposure)} total exposure
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">Exposure</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">SLA</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.alert_id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4">{a.account_name}</td>
                  <td className="py-2 pr-4">{a.order_id}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(a.priority)}`}>{a.priority}</span>
                  </td>
                  <td className="py-2 pr-4">{money(a.dollar_exposure)}</td>
                  <td className="py-2 pr-4">{ownerLabel(a)}</td>
                  <td className="py-2 pr-4">{a.sla_days_remaining}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <p className="mt-6 text-sm text-slate-500">Loading primary issue detail…</p>}
        {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {detail && !loading && (
          <div className="mt-6 space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Primary record — {detail.alert.order_id}
            </h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className={`text-xs px-2 py-0.5 rounded ${priorityClass(detail.alert.priority)}`}>
                {detail.alert.priority}
              </span>
              <span className="text-slate-600 dark:text-slate-300">{detail.alert.account_name}</span>
              <span className="font-medium">{money(detail.alert.dollar_exposure)}</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {detail.alert.root_cause_primary}
              {detail.alert.root_cause_secondary ? ` ${detail.alert.root_cause_secondary}` : ""}
            </p>
            <table className="min-w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium w-36">Margin at Risk</td>
                  <td className="py-2">{money(detail.alert.margin_at_risk)}</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-4 font-medium">Penalty Exposure</td>
                  <td className="py-2">{money(detail.alert.penalty_exposure)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Legal Risk</td>
                  <td className="py-2">{detail.alert.legal_risk}</td>
                </tr>
              </tbody>
            </table>
            {(detail.owners?.length ?? 0) > 0 && (
              <div className="text-sm space-y-2">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Owner &amp; Next Action</p>
                {detail.owners.map((o) => (
                  <p key={o.owner_id} className="text-slate-600 dark:text-slate-300">
                    {o.owner_name} ({o.team}) — {o.next_action ?? "—"}
                  </p>
                ))}
              </div>
            )}
            {!detail.owners?.length && (
              <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                {detail.alert.tax_owner_id && (
                  <p>
                    {detail.alert.tax_owner_name} — {detail.alert.next_action_tax ?? cfoNextActionTax(detail.alert)}
                  </p>
                )}
                {detail.alert.pricing_owner_id && (
                  <p>
                    {detail.alert.pricing_owner_name} —{" "}
                    {detail.alert.next_action_pricing ?? cfoNextActionPricing(detail.alert)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
