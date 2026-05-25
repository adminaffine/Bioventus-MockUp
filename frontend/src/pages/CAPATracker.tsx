import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type CAPAItem } from "../services/api";
import { formatDatasetName } from "../lib/datasetHelpers";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_CAPA_001_OVERDUE, TOOLTIP_CAPA_DAYS_OPEN, TOOLTIP_CAPA_FINANCIAL } from "../lib/tooltipContent";
import DetailModal from "../components/DetailModal";
import { useDateFormat } from "../context/DateFormatContext";

type Filter = "all" | "Open" | "In Progress" | "Resolved" | "Critical" | "Overdue";

type ToastState = { message: string; type: "success" | "error" } | null;

export default function CAPATracker() {
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [capas, setCapas] = useState<CAPAItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolvedBy, setResolvedBy] = useState("Dr. Sarah Kim");
  const [toast, setToast] = useState<ToastState>(null);
  const requestedHighlight = searchParams.get("highlight");
  const requestedReg = searchParams.get("reg");
  const requestedDataset = searchParams.get("dataset");
  const requestedRecord = searchParams.get("record");
  const source = searchParams.get("source");
  const isComplianceRedirect = source === "compliance";

  useEffect(() => {
    api.getCAPASummary().then((d) => setCapas(d.capas || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const summary = useMemo(() => {
    const total = capas.length;
    const open = capas.filter((c) => c.status === "Open").length;
    const inProgress = capas.filter((c) => c.status === "In Progress").length;
    const resolved = capas.filter((c) => c.status === "Resolved").length;
    const overdue = capas.filter((c) => c.is_overdue).length;
    const critical = capas.filter((c) => c.severity === "CRITICAL").length;
    return { total, open, inProgress, resolved, overdue, critical };
  }, [capas]);

  const filtered = useMemo(() => {
    let rows = capas;
    if (filter === "Critical") rows = rows.filter((c) => c.severity === "CRITICAL");
    else if (filter === "Overdue") rows = rows.filter((c) => c.is_overdue);
    else if (filter !== "all") rows = rows.filter((c) => c.status === filter);

    // Apply redirect context only when user came from Compliance deep-link.
    if (isComplianceRedirect) {
      if (requestedReg) rows = rows.filter((c) => c.linked_regulation_slug === requestedReg);
      if (requestedDataset) rows = rows.filter((c) => c.affected_dataset === requestedDataset);
      if (requestedRecord) rows = rows.filter((c) => c.affected_records.includes(requestedRecord));
    }
    return rows;
  }, [filter, capas, isComplianceRedirect, requestedDataset, requestedRecord, requestedReg]);

  const contextualCapaId = useMemo(() => {
    if (!capas.length) return null;
    if (requestedHighlight) {
      const exists = capas.some((c) => c.capa_id === requestedHighlight);
      if (exists) return requestedHighlight;
    }
    if (!isComplianceRedirect) return null;
    if (!requestedReg && !requestedDataset && !requestedRecord) return null;

    // Strict context matching for compliance redirects: no fallback to unrelated CAPAs.
    const candidate = capas.find((c) => {
      if (requestedReg && c.linked_regulation_slug !== requestedReg) return false;
      if (requestedDataset && c.affected_dataset !== requestedDataset) return false;
      if (requestedRecord && !c.affected_records.includes(requestedRecord)) return false;
      return true;
    });
    return candidate ? candidate.capa_id : null;
  }, [capas, isComplianceRedirect, requestedDataset, requestedHighlight, requestedRecord, requestedReg]);

  useEffect(() => {
    if (!contextualCapaId) return;
    setExpandedId(contextualCapaId);
    setFilter("all");
    const element = document.getElementById(`capa-${contextualCapaId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [contextualCapaId]);

  const tabCount = (f: Filter) =>
    f === "all" ? summary.total :
      f === "Critical" ? summary.critical :
        f === "Overdue" ? summary.overdue :
          capas.filter((c) => c.status === f).length;

  const confirmResolve = (capa: CAPAItem) => {
    const today = new Date().toISOString().slice(0, 10);
    setCapas((prev) => prev.map((c) => c.capa_id === capa.capa_id ? {
      ...c,
      status: "Resolved",
      is_overdue: false,
      resolved_date: today,
      resolved_by: resolvedBy,
      resolution_notes: resolutionNotes || "Marked resolved via application workflow.",
    } : c));
    setResolvingId(null);
    setResolutionNotes("");
    setToast({ message: `✓ ${capa.capa_id} marked as resolved`, type: "success" });
  };

  if (loading) {
    return <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary dark:text-primary-light">CAPA Tracker</h1>
          <p className="text-slate-600 dark:text-slate-400">Corrective & Preventive Actions — BV Data Quality & Compliance</p>
          <p className="text-sm text-slate-500 mt-1">
            Actions linked to open DQ violations, MDR gaps, and QMSR compliance findings. State changes in this application reset on page refresh.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setToast({ message: "Export not available in application mode", type: "error" })}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
        >
          ↓ Export Report
        </button>
      </div>
      {isComplianceRedirect && (
        <div className={`rounded-lg border p-3 text-sm ${contextualCapaId ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"}`}>
          Opened from Compliance:
          {" "}
          {(requestedReg ?? "n/a").toUpperCase()}
          {" / "}
          {requestedDataset ? formatDatasetName(requestedDataset) : "All datasets"}
          {" / "}
          {requestedRecord ?? "No specific record"}
          {!contextualCapaId ? " — no exact CAPA match found for this record." : ""}
          <button
            type="button"
            onClick={() => navigate("/capa")}
            className="ml-3 text-xs px-2 py-1 rounded bg-white/70 dark:bg-slate-700/50 border border-current"
          >
            Clear context
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Pill label={`Total: ${summary.total}`} cls="bg-slate-100 text-slate-700 border-slate-200" />
        <Pill label={`🔴 Critical: ${summary.critical}`} cls="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800" />
        <Pill label={`🟡 Open: ${summary.open}`} cls="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" />
        <Pill label={`🔵 In Progress: ${summary.inProgress}`} cls="bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800" />
        <Pill label={`🟢 Resolved: ${summary.resolved}`} cls="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" />
        <Pill label={`⏰ Overdue: ${summary.overdue}`} cls="bg-rose-200 text-rose-800 border-rose-300 animate-pulse dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800" tooltip={TOOLTIP_CAPA_DAYS_OPEN} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "Open", "In Progress", "Resolved", "Critical", "Overdue"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
          >
            {f === "all" ? `All (${tabCount(f)})` : `${f} (${tabCount(f)})`}
          </button>
        ))}
      </div>

      {isComplianceRedirect && filtered.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold">No CAPAs match this Compliance link</p>
          <p className="mt-1 text-amber-800/95 dark:text-amber-200/90">
            Filters applied: regulation <span className="font-mono">{requestedReg ?? "—"}</span>, dataset{" "}
            <span className="font-mono">{requestedDataset ?? "—"}</span>
            {requestedRecord ? (
              <>
                , record <span className="font-mono">{requestedRecord}</span>
              </>
            ) : null}
            . Open the full tracker to browse all CAPAs or return to Compliance to pick another gap.
          </p>
          <button
            type="button"
            onClick={() => navigate("/capa")}
            className="mt-3 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            View all CAPAs
          </button>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((capa) => {
          const critical = capa.severity === "CRITICAL";
          const resolved = capa.status === "Resolved";
          return (
            <div
              key={capa.capa_id}
              id={`capa-${capa.capa_id}`}
              className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all ${critical ? "border-l-4 border-l-rose-500" : capa.severity === "HIGH" ? "border-l-4 border-l-amber-500" : ""} ${resolved ? "opacity-75 border-l-4 border-l-emerald-500" : ""} ${contextualCapaId === capa.capa_id ? "ring-2 ring-indigo-400 dark:ring-indigo-500" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Badge label={capa.severity} cls={capa.severity === "CRITICAL" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"} />
                  <Badge label={capa.status} cls={capa.status === "Resolved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : capa.status === "In Progress" ? "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"} />
                </div>
                {capa.is_overdue && <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full animate-pulse dark:bg-rose-900/30 dark:text-rose-300">⏰ Overdue<InfoTooltip content={capa.capa_id === "CAPA-001" ? TOOLTIP_CAPA_001_OVERDUE : TOOLTIP_CAPA_DAYS_OPEN} /></span>}
              </div>

              <h3 className="font-semibold mt-2">{capa.capa_id} · {capa.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Regulation: {capa.regulation}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Affected: {formatDatasetName(capa.affected_dataset)} · {capa.affected_records.slice(0, 2).join(", ")}{capa.affected_records.length > 2 ? ` (+${capa.affected_records.length - 2} more)` : ""}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Product: {capa.affected_product}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Owner: {capa.owner} · {capa.owner_role}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Created: {formatDate(capa.created_date)} · Due: {formatDate(capa.due_date)} · Open: {capa.days_open} days{" "}
                <InfoTooltip content={TOOLTIP_CAPA_FINANCIAL} />
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" onClick={() => setExpandedId(capa.capa_id)} className="text-sm px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-700">
                  View Details
                </button>
                {!resolved ? (
                  <button type="button" onClick={() => { setExpandedId(capa.capa_id); setResolvingId(capa.capa_id); }} className="text-sm px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    ✓ Mark Resolved
                  </button>
                ) : (
                  <span className="text-sm px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    ✓ Resolved — {capa.resolved_by || capa.owner}
                  </span>
                )}
                <button type="button" onClick={() => navigate("/compliance")} className="text-sm px-3 py-1.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  🔗 View in Compliance
                </button>
              </div>

            </div>
          );
        })}
      </div>
      <DetailModal
        open={Boolean(expandedId)}
        onClose={() => {
          setExpandedId(null);
          setResolvingId(null);
        }}
        title={`CAPA Detail${expandedId ? ` — ${expandedId}` : ""}`}
      >
        {(() => {
          const capa = capas.find((c) => c.capa_id === expandedId);
          if (!capa) return <p className="text-sm text-slate-500">No details available.</p>;
          return (
            <div className="space-y-3 text-sm">
              <p>{capa.description}</p>
              <div><strong>📋 Root Cause</strong><p>{capa.root_cause}</p></div>
              <div><strong>✅ Corrective Action</strong><p>{capa.corrective_action}</p></div>
              <div><strong>🛡 Preventive Action</strong><p>{capa.preventive_action}</p></div>
              {capa.status === "Resolved" && (
                <div>
                  <strong>Resolution</strong>
                  <p>{capa.resolution_notes || "Resolved."}</p>
                  <p className="text-xs text-slate-500">
                    {capa.resolved_date ? formatDate(capa.resolved_date) : "—"} · {capa.resolved_by}
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500">Reassign owner</label>
                <select
                  value={capa.owner}
                  onChange={(e) => {
                    const owner = e.target.value;
                    setCapas((prev) => prev.map((x) => x.capa_id === capa.capa_id ? { ...x, owner } : x));
                    setToast({ message: `${capa.capa_id} reassigned to ${owner}`, type: "success" });
                  }}
                  className="mt-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                >
                  {["Dr. Sarah Kim", "Marcus Johnson", "Linda Torres", "Robert Patel"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {resolvingId === capa.capa_id && capa.status !== "Resolved" && (
                <div className="border border-slate-200 dark:border-slate-700 rounded p-3 space-y-2">
                  <label className="text-xs text-slate-500">Resolution notes (optional):</label>
                  <input value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 px-2 py-1" />
                  <label className="text-xs text-slate-500">Resolved by:</label>
                  <select value={resolvedBy} onChange={(e) => setResolvedBy(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 px-2 py-1">
                    {["Dr. Sarah Kim", "Marcus Johnson", "Linda Torres", "Robert Patel"].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => confirmResolve(capa)} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Confirm Resolution</button>
                    <button type="button" onClick={() => setResolvingId(null)} className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </DetailModal>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg shadow-lg text-sm ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Pill({ label, cls, tooltip }: { label: string; cls: string; tooltip?: Parameters<typeof InfoTooltip>[0]["content"] }) {
  return <span className={`rounded-full px-4 py-1.5 text-sm font-medium border ${cls}`}>{label}{tooltip ? <InfoTooltip content={tooltip} /> : null}</span>;
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}
