import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import ActionPanel from "../components/ActionPanel";
import { useAlerts } from "../context/AlertContext";
import { useRole } from "../context/RoleContext";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_ALERT_SORT, TOOLTIP_ALERT_TIER, TOOLTIP_ALERT_TOTAL } from "../lib/tooltipContent";
import DetailModal from "../components/DetailModal";
import { useDateFormat } from "../context/DateFormatContext";

type Filter = "all" | "Critical" | "High" | "Medium" | "unacknowledged";

const OWNER_OPTIONS = ["all", "VP Quality", "Pricing Analyst", "MDM Lead", "Commercial Ops", "Tax & Compliance", "Market Access", "Credit & AR"];

function formatType(value: string): string {
  const map: Record<string, string> = {
    RECALLED_PRODUCT_ORDER: "Recalled Product",
    GPO_PRICING_CONFLICT: "GPO Pricing Conflict",
    ORPHANED_CLINIC: "Orphaned Clinic",
    IQVIA_AFFILIATION_CHANGE: "IQVIA Roster Delta",
    CREDIT_LIMIT_BREACH: "Credit Limit Breach",
    DUPLICATE_HCP: "Duplicate HCP",
    CONTRACT_EXPIRING: "Contract Expiring",
    GHOST_SALES_REP: "Ghost Sales Rep",
    TAX_JURISDICTION_MISMATCH: "Tax Jurisdiction",
    UNVERIFIED_GPO_MEMBERSHIP: "Unverified Membership",
    IQVIA_NPI_UPDATE: "IQVIA NPI Update",
  };
  return map[value] ?? value;
}

function navLabel(type: string): string {
  if (type.includes("RECALLED")) return "View CAPA";
  if (type.includes("GPO")) return "View GPO";
  if (type.includes("ORPHANED")) return "View Hierarchy";
  if (type.includes("IQVIA")) return "View IQVIA Delta";
  if (type.includes("CREDIT")) return "View IDN";
  if (type.includes("DUPLICATE")) return "View RxIntegrity";
  if (type.includes("TAX")) return "View Tax";
  if (type.includes("GHOST")) return "View Orders";
  if (type.includes("CONTRACT")) return "View Contract";
  return "Navigate";
}

export default function AlertsPage() {
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const { currentRole } = useRole();
  const { acknowledgeAlert, transitionAlert, workflowStates, refreshAlerts } = useAlerts();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getAlerts>> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAlerts()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshAlerts().catch(() => undefined);
  }, [refreshAlerts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (currentRole.id === "pricing_analyst") setOwnerFilter("Pricing Analyst");
    else if (currentRole.id === "tax_compliance") setOwnerFilter("Tax & Compliance");
    else if (currentRole.id === "commercial_ops") setOwnerFilter("Commercial Ops");
    else if (currentRole.id === "vp_quality") setOwnerFilter("VP Quality");
    else setOwnerFilter("all");
  }, [currentRole.id]);

  const alerts = useMemo(() => {
    const all = [...(data?.alerts ?? [])]
      .map((a) => ({ ...a, workflow_state: workflowStates[a.alert_id] ?? a.workflow_state ?? "open" }))
      .sort((a, b) => b.dollar_impact - a.dollar_impact);
    return all.filter((a) => {
      if (filter === "Critical" && a.severity !== "CRITICAL") return false;
      if (filter === "High" && a.severity !== "HIGH") return false;
      if (filter === "Medium" && a.severity !== "MEDIUM") return false;
      if (filter === "unacknowledged" && a.workflow_state !== "open") return false;
      if (ownerFilter !== "all" && !a.primary_persona.includes(ownerFilter)) return false;
      return true;
    });
  }, [data?.alerts, filter, ownerFilter, workflowStates]);

  if (loading || !data) {
    return <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />;
  }

  const counts = {
    critical: data.alerts.filter((a) => a.severity === "CRITICAL").length,
    high: data.alerts.filter((a) => a.severity === "HIGH").length,
    medium: data.alerts.filter((a) => a.severity === "MEDIUM").length,
  };

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">{toast}</div>}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h1 className="text-2xl font-bold">Alert-to-Action Center</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          {data.total_alerts} active alerts · ${data.total_dollar_impact.toLocaleString()} total financial exposure<InfoTooltip content={TOOLTIP_ALERT_TOTAL} /> · Sorted by dollar impact <InfoTooltip content={TOOLTIP_ALERT_SORT} />
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 flex flex-wrap items-center gap-2">
        {(["all", "Critical", "High", "Medium", "unacknowledged"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
            {f === "all" ? `All (${data.total_alerts})` : f === "Critical" ? `Critical (${counts.critical})` : f === "High" ? `High (${counts.high})` : f === "Medium" ? `Medium (${counts.medium})` : "Unacknowledged"}
          </button>
        ))}
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="ml-auto rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm">
          {OWNER_OPTIONS.map((o) => <option key={o} value={o}>{o === "all" ? "All Owners" : o}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
        <div className="rounded-lg p-3 bg-rose-50 dark:bg-rose-900/10">4 Critical · $16,800 critical exposure</div>
        <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-900/10">8 High · $103,680 high exposure</div>
        <div className="rounded-lg p-3 bg-slate-100 dark:bg-slate-700/30">6 Medium · $14,330 medium exposure</div>
        <div className="rounded-lg p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Total: $134,810 across 18 alerts <InfoTooltip content={TOOLTIP_ALERT_TOTAL} /></div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const alertState = alert.workflow_state ?? "open";
          const isAck = alertState !== "open";
          const isRouted = alertState === "routed" || alertState === "resolved" || alertState === "overridden";
          const isResolved = alertState === "resolved" || alertState === "overridden";
          const expanded = expandedId === alert.alert_id;
          const severityClass = alert.severity === "CRITICAL" ? "border-l-4 border-l-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : alert.severity === "HIGH" ? "border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10" : "border-l-4 border-l-sky-400 bg-sky-50/30 dark:bg-sky-900/10";
          return (
            <div key={alert.alert_id} className={`rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${severityClass} ${isAck ? "opacity-60 border-l-slate-400" : ""}`}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${alert.severity === "CRITICAL" ? "bg-rose-100 text-rose-700" : alert.severity === "HIGH" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{alert.severity}<InfoTooltip content={TOOLTIP_ALERT_TIER} /></span>
                  <span>{formatType(alert.alert_type)} · ${alert.dollar_impact.toLocaleString()} impact</span>
                </div>
                <span>{formatDate(alert.detected_date)}</span>
              </div>
              <p className="font-semibold mt-2">{alert.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{expanded ? alert.description : `${alert.description.slice(0, 160)}${alert.description.length > 160 ? "…" : ""}`}</p>
              <p className="text-xs text-slate-500 mt-2">👤 Primary: {alert.primary_persona} · Owner: {alert.primary_owner_name}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {alert.linked_records.split("|").map((rec) => <span key={rec} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{rec}</span>)}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  disabled={isAck}
                  onClick={async () => {
                    await acknowledgeAlert(alert.alert_id);
                    setToast(`Alert ${alert.alert_id} acknowledged`);
                  }}
                  className={`text-sm px-2 py-1 rounded ${isAck ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-700"}`}
                >
                  {isAck ? "✓ Acknowledged" : "Acknowledge ✓"}
                </button>
                <button type="button" onClick={() => setExpandedId(alert.alert_id)} className="text-sm px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">
                  View Details
                </button>
                <button type="button" onClick={() => navigate(`${alert.linked_screen}${alert.linked_filter ? `?${alert.linked_filter}` : ""}`)} className="text-sm px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {navLabel(alert.alert_type)} →
                </button>
                <button
                  type="button"
                  disabled={isRouted}
                  onClick={async () => {
                    const ok = await transitionAlert(alert.alert_id, "routed");
                    setToast(ok ? `Alert ${alert.alert_id} routed to ${alert.primary_owner_name} — notification sent` : `Unable to route ${alert.alert_id}`);
                  }}
                  className={`text-sm px-2 py-1 rounded ${isRouted ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 dark:bg-slate-700"}`}
                >
                  {isRouted ? "✓ Routed" : "Route to Owner 👤"}
                </button>
                <button
                  type="button"
                  disabled={isResolved}
                  onClick={async () => {
                    const ok = await transitionAlert(alert.alert_id, "resolved");
                    setToast(ok ? `Alert ${alert.alert_id} resolved` : `Unable to resolve ${alert.alert_id}`);
                  }}
                  className={`text-sm px-2 py-1 rounded ${isResolved ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-700"}`}
                >
                  {isResolved ? "✓ Resolved" : "Resolve"}
                </button>
                <button
                  type="button"
                  disabled={alertState === "overridden"}
                  onClick={async () => {
                    const ok = await transitionAlert(alert.alert_id, "overridden", "Manual override applied");
                    setToast(ok ? `Alert ${alert.alert_id} overridden` : `Unable to override ${alert.alert_id}`);
                  }}
                  className={`text-sm px-2 py-1 rounded ${alertState === "overridden" ? "bg-violet-100 text-violet-700" : "bg-slate-100 dark:bg-slate-700"}`}
                >
                  {alertState === "overridden" ? "✓ Overridden" : "Override"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <DetailModal
        open={Boolean(expandedId)}
        onClose={() => setExpandedId(null)}
        title={`Alert Detail${expandedId ? ` — ${expandedId}` : ""}`}
      >
        {(() => {
          const alert = alerts.find((a) => a.alert_id === expandedId);
          if (!alert) return <p className="text-sm text-slate-500">No details available.</p>;
          return (
            <div className="space-y-3">
              <ol className="list-decimal pl-5 text-sm space-y-1">
                {[alert.prescribed_action_1, alert.prescribed_action_2, alert.prescribed_action_3].filter(Boolean).map((a) => <li key={a}>{a}</li>)}
              </ol>
              {alert.regulation_reference && <span className="inline-block text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">{alert.regulation_reference}</span>}
              <ActionPanel
                severity={(alert.severity.toLowerCase() as "critical" | "high" | "medium" | "low")}
                primaryPersona={alert.primary_persona}
                ownerName={alert.primary_owner_name}
                actions={[
                  { step: 1, description: alert.prescribed_action_1, regulation: alert.regulation_reference?.split("|")[0] },
                  { step: 2, description: alert.prescribed_action_2, regulation: alert.regulation_reference?.split("|")[1] },
                  { step: 3, description: alert.prescribed_action_3 },
                ].filter((a) => a.description)}
                secondaryPersonaNote={alert.secondary_persona_note ?? undefined}
                ctaButtons={[{ label: "Navigate to Source", navigateTo: `${alert.linked_screen}${alert.linked_filter ? `?${alert.linked_filter}` : ""}`, variant: "primary" }]}
              />
            </div>
          );
        })()}
      </DetailModal>
    </div>
  );
}
