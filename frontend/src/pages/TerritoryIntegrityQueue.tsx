import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type TerritoryExceptionRecord } from "../services/api";
import { useRole } from "../context/RoleContext";
import InfoTooltip from "../components/InfoTooltip";
import {
  TOOLTIP_TERR_COMM_AT_RISK,
  TOOLTIP_TERR_GAP,
  TOOLTIP_TERR_HOLD_STATUS,
  TOOLTIP_TERR_ORDER_REVENUE,
  TOOLTIP_TERR_RISK_TIER,
  TOOLTIP_TERR_SUMMARY_ORDER_REVENUE,
} from "../lib/tooltipContent";

function money(value: number): string {
  return `$${value.toLocaleString()}`;
}

function holdLabel(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "held") return "Held";
  if (s === "released") return "Released";
  return status || "—";
}

export default function TerritoryIntegrityQueue() {
  const { currentRole } = useRole();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TerritoryExceptionRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [policy, setPolicy] = useState<{ high_impact_revenue_threshold: number; high_commission_threshold: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTerritoryExceptions()
      .then((payload) => {
        setRows(payload.records);
        setPolicy({
          high_impact_revenue_threshold: payload.policy.high_impact_revenue_threshold,
          high_commission_threshold: payload.policy.high_commission_threshold,
        });
        setError(null);
      })
      .catch(() => {
        setRows([]);
        setPolicy(null);
        setError("Unable to load territory exceptions. Please refresh or restart backend services.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const summary = useMemo(
    () => ({
      open: rows.filter((r) => r.state !== "closed").length,
      held: rows.filter((r) => r.commission_status === "held").length,
      orderRevenue: rows.reduce((sum, r) => sum + r.order_amount, 0),
      commissionAtRisk: rows.reduce((sum, r) => sum + r.misaligned_commission, 0),
    }),
    [rows]
  );

  const applyState = async (row: TerritoryExceptionRecord, toState: string) => {
    setBusy(row.exception_id);
    try {
      const result = await api.transitionTerritoryException({
        exception_id: row.exception_id,
        to_state: toState,
        actor_role: currentRole.id,
        actor_name: currentRole.personaName,
        reason: `Transition to ${toState}`,
      });
      if (result.ok) {
        setRows((prev) => prev.map((item) => (item.exception_id === row.exception_id ? { ...item, state: toState } : item)));
        setToast(`${row.exception_id} moved to ${toState}`);
      } else {
        setToast(result.error ?? "Unable to update state");
      }
    } catch {
      setToast("Unable to update state");
    }
    setBusy(null);
  };

  const toggleHold = async (row: TerritoryExceptionRecord) => {
    setBusy(row.exception_id);
    const action = row.commission_status === "held" ? "release" : "hold";
    try {
      const result = await api.commissionHoldAction({
        exception_id: row.exception_id,
        action,
        actor_role: currentRole.id,
        actor_name: currentRole.personaName,
        reason: action === "hold" ? "Commission hold due to unresolved territory misalignment" : "Release after exception remediation",
      });
      if (result.ok) {
        setRows((prev) =>
          prev.map((item) => (item.exception_id === row.exception_id ? { ...item, commission_status: result.commission_status ?? item.commission_status } : item))
        );
        setToast(`${row.exception_id} commission ${action} recorded`);
      } else {
        setToast(result.error ?? "Unable to update commission status");
      }
    } catch {
      setToast("Unable to update commission status");
    }
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-6 z-50 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm">{toast}</div>}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Ops - Territory Integrity</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {currentRole.label} workflow for territory exception triage and commission governance.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Each row is a <strong>territory misalignment</strong>: the rep&apos;s <span className="font-mono">assigned book</span> (CRM territory) does not match the{" "}
          <span className="font-mono">order region</span> (where the order/customer sits). That is a{" "}
          <strong>revenue and commission attribution</strong> risk — wrong quota credit, wrong comp accrual, or disputes — not a PHI / &quot;data leak&quot; in the privacy sense.{" "}
          <span className="font-mono">Order revenue</span> is booked sale dollars; <span className="font-mono">Comm. at risk</span> is the commission modeled on that order that may need
          correction per policy.
        </p>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Parent flows: <Link to="/csuite" className="text-indigo-600 dark:text-indigo-300">C-Suite</Link> · <Link to="/commercial" className="text-indigo-600 dark:text-indigo-300">Commercial Dashboard</Link> · <Link to="/alerts" className="text-indigo-600 dark:text-indigo-300">Alerts</Link>
        </div>
        {policy && (
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            Policy thresholds: Revenue ≥ {money(policy.high_impact_revenue_threshold)} or commission ≥ {money(policy.high_commission_threshold)} triggers high-impact handling.
          </div>
        )}
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Open Exceptions</p>
          <p className="text-2xl font-bold">{summary.open}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Commission holds</p>
          <p className="text-2xl font-bold">{summary.held}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            Order revenue (queue) <InfoTooltip content={TOOLTIP_TERR_SUMMARY_ORDER_REVENUE} />
          </p>
          <p className="text-2xl font-bold">{money(summary.orderRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            Commission at risk (sum) <InfoTooltip content={TOOLTIP_TERR_COMM_AT_RISK} />
          </p>
          <p className="text-2xl font-bold">{money(summary.commissionAtRisk)}</p>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading territory exception queue...</div>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No territory exceptions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-4">Exception</th>
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4 min-w-[8rem]">Product</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4 min-w-[10rem]">
                    <span className="inline-flex items-center gap-1">
                      Rep &amp; territory gap <InfoTooltip content={TOOLTIP_TERR_GAP} />
                    </span>
                  </th>
                  <th className="py-2 pr-4 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Order revenue <InfoTooltip content={TOOLTIP_TERR_ORDER_REVENUE} />
                    </span>
                  </th>
                  <th className="py-2 pr-4 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Comm. at risk <InfoTooltip content={TOOLTIP_TERR_COMM_AT_RISK} />
                    </span>
                  </th>
                  <th className="py-2 pr-4">
                    <span className="inline-flex items-center gap-1">
                      Tier <InfoTooltip content={TOOLTIP_TERR_RISK_TIER} />
                    </span>
                  </th>
                  <th className="py-2 pr-4">
                    <span className="inline-flex items-center gap-1">
                      Comp hold <InfoTooltip content={TOOLTIP_TERR_HOLD_STATUS} />
                    </span>
                  </th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4 min-w-[12rem]">Issue (why)</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.exception_id} className="border-b border-slate-100 dark:border-slate-700/60 align-top">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{row.exception_id}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-mono">{row.order_id}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200 max-w-[11rem]">
                      <span className="line-clamp-2" title={row.product_name || undefined}>
                        {row.product_name || "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {row.customer_name}
                      <div className="text-xs text-slate-500 font-mono">{row.customer_id}</div>
                    </td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">
                      <div className="font-medium">{row.rep_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Book: <span className="font-mono text-slate-600 dark:text-slate-300">{row.assigned_territory}</span>
                        {" · "}
                        Order region: <span className="font-mono text-slate-600 dark:text-slate-300">{row.order_region}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono whitespace-nowrap">{money(row.order_amount)}</td>
                    <td className="py-2 pr-4 text-right font-mono whitespace-nowrap">{money(row.misaligned_commission)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          row.risk_tier === "High"
                            ? "text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                            : "text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        }
                      >
                        {row.risk_tier}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{holdLabel(row.commission_status)}</td>
                    <td className="py-2 pr-4 capitalize">{row.state}</td>
                    <td className="py-2 pr-4 text-xs text-slate-600 dark:text-slate-300 max-w-[14rem]">
                      <p className="line-clamp-2" title={row.reason}>
                        {row.reason}
                      </p>
                      {row.recommended_action ? (
                        <p className="line-clamp-2 mt-1 text-indigo-700 dark:text-indigo-300" title={row.recommended_action}>
                          <span className="font-semibold">Next:</span> {row.recommended_action}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy === row.exception_id || row.state === "closed"}
                          onClick={() => applyState(row, "assigned")}
                          className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-60"
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          disabled={busy === row.exception_id || row.state === "closed"}
                          onClick={() => applyState(row, "investigating")}
                          className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-60"
                        >
                          Investigate
                        </button>
                        <button
                          type="button"
                          disabled={busy === row.exception_id || row.state === "closed"}
                          onClick={() => applyState(row, "remediated")}
                          className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-60"
                        >
                          Remediate
                        </button>
                        <button
                          type="button"
                          disabled={busy === row.exception_id || row.state === "closed"}
                          onClick={() => applyState(row, "closed")}
                          className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 disabled:opacity-60"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          disabled={busy === row.exception_id}
                          onClick={() => toggleHold(row)}
                          className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 disabled:opacity-60"
                        >
                          {row.commission_status === "held" ? "Release Hold" : "Hold Commission"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              Recommended next step for each exception comes from CRM routing rules in <span className="font-mono">action_required</span> on the server; extend the UI to show it if you want one-click playbooks.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
