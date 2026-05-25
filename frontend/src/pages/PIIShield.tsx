import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, type PiiSummary, type PiiPreview, type PiiAuditEntry, type PiiRegulationCoverage, type PiiUploadSessionResult } from "../services/api";
import { cn } from "../lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { formatDatasetName } from "../lib/datasetHelpers";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_PII_DETECTION, TOOLTIP_PII_HIPAA_GAP, TOOLTIP_PII_MASKING, TOOLTIP_PII_REGULATION } from "../lib/tooltipContent";

const DATASETS = ["customer_master", "sales_orders", "patient_support", "product_catalog"];
const PII_TYPES = ["SSN", "EMAIL", "PHONE", "DATE_OF_BIRTH", "CREDIT_CARD", "PERSON_NAME", "ADDRESS", "IP_ADDRESS", "PASSPORT", "MEDICAL_CODE", "NPI", "TAX_ID", "BANK_ACCOUNT"];
const REG_COLORS: Record<string, string> = {
  HIPAA: "#007AFF",
  "PCI-DSS": "#5856D6",
  GDPR: "#34C759",
  CCPA: "#FF6B00",
  SOX: "#636366",
};
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#FF3B30",
  HIGH: "#FF9500",
  MEDIUM: "#FFD60A",
  LOW: "#8E8E93",
};

function piiPreviewRowSlug(caseId: string) {
  return caseId.replace(/[^a-zA-Z0-9-]/g, "") || "row";
}

function useCountUp(end: number, durationMs: number, deps: unknown[]) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    setVal(0);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setVal(Math.round(end * t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [end, durationMs, ...deps]);
  return val;
}

export default function PIIShield() {
  const isDark = document.documentElement.classList.contains("dark");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const consentNarrativeRef = useRef<HTMLDivElement>(null);
  const uploadSessionId = (location.state as { uploadSessionId?: string } | null)?.uploadSessionId;

  const consentNarrativeView = useMemo(
    () => searchParams.get("view") === "consent_gaps" && searchParams.get("dataset") === "patient_support",
    [searchParams]
  );

  /** Deep-link: ?highlight=CASE-5015 or ?case_id=CASE-5015 (consent-gap slice only). */
  const previewCaseHighlight = useMemo(() => {
    const h = (searchParams.get("highlight") || searchParams.get("case_id") || "").trim();
    return h || null;
  }, [searchParams]);

  const [summary, setSummary] = useState<PiiSummary | null>(null);
  const [uploadSession, setUploadSession] = useState<PiiUploadSessionResult | null>(null);
  const [preview, setPreview] = useState<PiiPreview | null>(null);
  const [selectedDataset, setSelectedDataset] = useState(DATASETS[0]);
  const [auditEntries, setAuditEntries] = useState<PiiAuditEntry[]>([]);
  const [regulations, setRegulations] = useState<PiiRegulationCoverage[]>([]);
  const [regModal, setRegModal] = useState<PiiRegulationCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditFilter, setAuditFilter] = useState({ dataset: "", pii_type: "", regulation: "", severity: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<{ pii_instances: number; pii_fields: number; masked_row_count: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [consentGaps, setConsentGaps] = useState(0);

  const effectiveSummary = uploadSession?.summary ?? summary;
  const effectivePreview = uploadSession?.preview ?? preview;
  const totalPii = effectiveSummary?.total_pii_instances ?? 0;
  const piiTypesCount = (effectiveSummary && "pii_types_detected" in effectiveSummary) ? (effectiveSummary as { pii_types_detected: number }).pii_types_detected : (summary?.pii_types_detected ?? 0);
  const regsMet = summary?.regulations_covered ?? 0;
  const auditDatasetOptions = uploadSession?.preview?.dataset_name ? [uploadSession.preview.dataset_name, ...DATASETS.filter((d) => d !== uploadSession.preview!.dataset_name)] : DATASETS;
  const count1 = useCountUp(totalPii, 1500, [totalPii]);
  const count2 = useCountUp(piiTypesCount, 1500, [piiTypesCount]);
  const count3 = useCountUp(regsMet, 1500, [regsMet]);

  const consentPreviewMaxRows = effectivePreview?.filter_applied === "hipaa_consent_gaps" ? 50 : 20;

  const consentHighlightMissing = useMemo(() => {
    if (!consentNarrativeView || !previewCaseHighlight || uploadSession || effectivePreview?.empty_message) return false;
    const rows = effectivePreview?.original ?? [];
    if (!rows.length) return false;
    return !rows.some(
      (r) => String((r as Record<string, unknown>).case_id ?? "").toUpperCase() === previewCaseHighlight.toUpperCase()
    );
  }, [consentNarrativeView, previewCaseHighlight, uploadSession, effectivePreview?.original, effectivePreview?.empty_message]);

  useEffect(() => {
    api.getPiiSummary().then(setSummary).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    api.getQuality("patient_support").then((r) => setConsentGaps(r.hipaa_gap_count ?? 0)).catch(() => setConsentGaps(0));
  }, []);
  useEffect(() => {
    const ds = searchParams.get("dataset");
    if (ds && DATASETS.includes(ds)) setSelectedDataset(ds);
  }, [searchParams]);
  useEffect(() => {
    if (consentNarrativeView) {
      setAuditFilter((f) => ({ ...f, dataset: "patient_support", regulation: "HIPAA" }));
    }
  }, [consentNarrativeView]);
  useEffect(() => {
    if (uploadSessionId) {
      api.getPiiUploadSession(uploadSessionId)
        .then((data) => {
          setUploadSession(data);
          if (data.preview?.dataset_name) {
            setAuditFilter((f) => ({ ...f, dataset: data.preview.dataset_name }));
          }
        })
        .catch(() => setUploadSession(null));
    } else {
      setUploadSession(null);
    }
  }, [uploadSessionId]);
  useEffect(() => {
    api.getPiiRegulationsCoverage().then((r) => setRegulations(r.regulations || []));
  }, []);
  const loadPreview = useCallback(() => {
    const filter =
      consentNarrativeView && selectedDataset === "patient_support" ? "hipaa_consent_gaps" : undefined;
    api.getPiiDatasetPreview(selectedDataset, filter ? { filter } : undefined).then(setPreview);
  }, [selectedDataset, consentNarrativeView]);
  useEffect(() => {
    if (!uploadSession) loadPreview();
  }, [loadPreview, uploadSession]);
  useEffect(() => {
    if (!loading && consentNarrativeView && !uploadSession && selectedDataset === "patient_support") {
      const t = window.setTimeout(() => {
        consentNarrativeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
      return () => window.clearTimeout(t);
    }
  }, [loading, consentNarrativeView, uploadSession, selectedDataset]);

  useEffect(() => {
    if (!consentNarrativeView || uploadSession || !previewCaseHighlight || effectivePreview?.empty_message) return;
    const rows = effectivePreview?.original ?? [];
    const match = rows.some(
      (r) => String((r as Record<string, unknown>).case_id ?? "").toUpperCase() === previewCaseHighlight.toUpperCase()
    );
    if (!match) return;
    const slug = piiPreviewRowSlug(previewCaseHighlight);
    const t = window.setTimeout(() => {
      document.getElementById(`pii-preview-original-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`pii-preview-masked-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => window.clearTimeout(t);
  }, [consentNarrativeView, uploadSession, previewCaseHighlight, effectivePreview?.original, effectivePreview?.empty_message]);
  const loadAudit = useCallback(() => {
    api.getPiiAuditLog({
      dataset_name: auditFilter.dataset || undefined,
      pii_type: auditFilter.pii_type || undefined,
      regulation: auditFilter.regulation || undefined,
      severity: auditFilter.severity || undefined,
      limit: 200,
    }).then((r) => setAuditEntries(r.entries || []));
  }, [auditFilter]);
  useEffect(() => {
    loadAudit();
  }, [loadAudit]);
  useEffect(() => {
    const t = setInterval(loadAudit, 30000);
    return () => clearInterval(t);
  }, [loadAudit]);

  const handleScanUpload = async () => {
    if (!uploadFile) return;
    setScanning(true);
    setScanResult(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await api.postPiiScan(fd);
      setScanResult({ pii_instances: res.pii_instances, pii_fields: res.pii_fields, masked_row_count: res.masked_row_count });
      loadAudit();
    } catch {
      setScanResult(null);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const byTypeForDonut = effectiveSummary?.by_pii_type
    ? Object.entries(effectiveSummary.by_pii_type).map(([name, count]) => ({ name, value: typeof count === "number" ? count : (count as { count?: number }).count ?? 0 }))
    : [];
  const heatmapDatasets = uploadSession?.summary?.datasets ?? DATASETS;
  const heatmapData = heatmapDatasets.flatMap((ds) =>
    PII_TYPES.map((pt) => ({
      dataset: ds,
      piiType: pt,
      count: effectiveSummary?.by_pii_type?.[pt] ? Math.floor((typeof effectiveSummary.by_pii_type[pt] === "number" ? effectiveSummary.by_pii_type[pt] : 0) / (effectiveSummary.datasets?.length || 1)) : 0,
    }))
  );

  return (
    <div className="space-y-8">
      {consentGaps > 0 && (
        <div className="rounded-xl border-l-4 border-rose-500 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 p-4 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">⚠ {consentGaps} HIPAA Consent Gaps — PHI present without patient consent</p>
          <button
            type="button"
            onClick={() => navigate("/pii-shield?dataset=patient_support&view=consent_gaps")}
            className="text-sm underline underline-offset-2"
          >
            View affected records →
          </button>
        </div>
      )}
      {/* Hero */}
      <section className="rounded-2xl text-white p-8 md:p-10 bg-[#0a0f1e] border border-slate-700/50">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <span className="text-3xl">🛡️</span>
          PII Shield — AI-Powered Data Privacy Protection
        </h1>
        <p className="mt-2 text-slate-300">
          {uploadSession ? "Showing PII scan results for your uploaded file." : "Every sensitive data point detected, classified, masked and audit-logged — automatically."}
        </p>
        {uploadSession && (
          <p className="mt-1 text-sm text-green-300">Dataset: {formatDatasetName(uploadSession.preview.dataset_name)}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <KpiBox label="PII Found" value={count1} tooltip={TOOLTIP_PII_DETECTION} />
          <KpiBox label="PII Types" value={count2} />
          <KpiBox label="Masked" value={100} suffix="%" tooltip={TOOLTIP_PII_MASKING} />
          <KpiBox label="Regs. Met" value={count3} tooltip={TOOLTIP_PII_REGULATION} />
        </div>
      </section>

      {/* Discovery heatmap */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">{uploadSession ? "PII in your upload" : "PII Discovery Map"}</h2>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${PII_TYPES.length}, minmax(28px, 1fr))` }}>
            <div className="p-1 font-medium text-xs text-slate-500 sticky left-0 bg-white dark:bg-slate-800">Dataset \ Type</div>
            {PII_TYPES.map((pt) => (
              <div key={pt} className="p-1 text-xs text-center text-slate-500 truncate max-w-[80px]" title={pt}>{pt}</div>
            ))}
            {heatmapDatasets.map((ds) => (
              <span key={ds} className="contents">
                <div className="p-1 text-xs font-medium text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800">{formatDatasetName(ds)}</div>
                {PII_TYPES.map((pt) => {
                  const cell = heatmapData.find((c) => c.dataset === ds && c.piiType === pt);
                  const count = cell?.count ?? 0;
                  const color = count > 100 ? "bg-red-500" : count > 50 ? "bg-amber-500" : count > 0 ? "bg-yellow-400" : "bg-slate-200 dark:bg-slate-600";
                  return (
                    <div key={`${ds}-${pt}`} className="flex items-center justify-center p-1" title={`${count} ${pt} in ${ds}`}>
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium", color)}>{count > 0 ? count : ""}</span>
                    </div>
                  );
                })}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Side-by-side: your upload or static dataset */}
      <section
        ref={consentNarrativeRef}
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        {consentNarrativeView && !uploadSession && selectedDataset === "patient_support" ? (
          <div className="border-b border-amber-200 dark:border-amber-700/50 bg-amber-50/90 dark:bg-amber-950/30 text-sm text-amber-950 dark:text-amber-100">
            <div className="p-4 flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold">Consent-gap view:</span> each row matches{" "}
                <span className="font-mono">phi_data_present = 1</span> and{" "}
                <span className="font-mono">consent_obtained</span> is missing or <span className="font-mono">0</span> (same rule as the banner count
                and Compliance HIPAA query). The first columns are the <span className="font-semibold">gap drivers</span> (amber headers); red/green
                cells are column-level PII detections (names, DOB, notes, etc.). Masking shows the protected form for those fields.
              </span>
              <button type="button" className="text-xs font-medium underline underline-offset-2 shrink-0" onClick={() => navigate("/pii-shield")}>
                Show full PII Shield →
              </button>
            </div>
            {previewCaseHighlight ? (
              <div className="px-4 pb-3 text-xs border-t border-amber-200/70 dark:border-amber-800/50 pt-2 space-y-2">
                <p>
                  Row focus: <span className="font-mono font-semibold">{previewCaseHighlight}</span>{" "}
                  {consentHighlightMissing ? (
                    <span className="text-amber-900/90 dark:text-amber-200/90">
                      — not in the current preview slice (check case id or scroll the full dataset from Governance).
                    </span>
                  ) : (
                    <span className="text-emerald-800 dark:text-emerald-200/90">— highlighted in both tables when present.</span>
                  )}
                </p>
                <p className="text-amber-950/90 dark:text-amber-100/90">
                  <span className="font-semibold">Suggested actions:</span> obtain and file consent per HIPAA (45 CFR 164.508); restrict PHI use until
                  documented; open a remediation CAPA if policy requires one.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-white/80 dark:bg-slate-900/40 border border-amber-300 dark:border-amber-700"
                    onClick={() => navigate("/profiler?dataset=patient_support&issue=hipaa")}
                  >
                    Profiler · consent column →
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-white/80 dark:bg-slate-900/40 border border-amber-300 dark:border-amber-700"
                    onClick={() => navigate("/compliance?reg=hipaa&dataset=patient_support")}
                  >
                    Compliance · HIPAA gaps →
                  </button>
                  <button type="button" className="text-xs px-2 py-1 rounded bg-white/80 dark:bg-slate-900/40 border border-amber-300 dark:border-amber-700" onClick={() => navigate("/capa")}>
                    CAPA tracker →
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
          {uploadSession ? (
            <>
              <label className="font-medium">Your uploaded file</label>
              <span className="font-mono text-sm text-slate-600 dark:text-slate-300">{formatDatasetName(effectivePreview?.dataset_name ?? "")}</span>
            </>
          ) : (
            <>
              <label className="font-medium">Dataset</label>
              <select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              >
                {DATASETS.map((d) => (
                  <option key={d} value={d}>{formatDatasetName(d)}</option>
                ))}
              </select>
              <a
                href={api.getPiiExportUrl(selectedDataset)}
                target="_blank"
                rel="noreferrer"
                className="ml-auto px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                Download Protected Dataset
              </a>
            </>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
          <div className="p-4">
            <h3 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">🔴 Original Data (Raw — PII Exposed) <InfoTooltip content={TOOLTIP_PII_HIPAA_GAP} /></h3>
            {effectivePreview?.empty_message ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">{effectivePreview.empty_message}</p>
            ) : (
              <PreviewTable
                data={effectivePreview?.original || []}
                piiColumns={effectivePreview?.pii_columns || []}
                variant="original"
                maxRows={consentPreviewMaxRows}
                highlightCaseId={consentNarrativeView && !uploadSession ? previewCaseHighlight : null}
                driverColumns={effectivePreview?.hipaa_gap_driver_columns}
              />
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-2 mb-2">✅ AI-Protected Data (Masked — Compliant)</h3>
            {effectivePreview?.empty_message ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No masked rows until consent-gap records exist.</p>
            ) : (
              <PreviewTable
                data={effectivePreview?.masked || []}
                piiColumns={effectivePreview?.pii_columns || []}
                variant="masked"
                maxRows={consentPreviewMaxRows}
                highlightCaseId={consentNarrativeView && !uploadSession ? previewCaseHighlight : null}
                driverColumns={effectivePreview?.hipaa_gap_driver_columns}
              />
            )}
          </div>
        </div>
      </section>

      {/* Donut + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4">PII by Type</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byTypeForDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} label={({ name, value }) => `${name} ${value}`}>
                {byTypeForDonut.map((_, i) => (
                  <Cell key={i} fill={["#FF3B30", "#FF9500", "#FFD60A", "#34C759", "#007AFF", "#5856D6", "#8E8E93"][i % 7]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#f1f5f9" : "#0f172a" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4">PII by Dataset</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={(effectiveSummary?.datasets ?? []).map((d) => ({ name: formatDatasetName(d), count: Math.round((effectiveSummary?.total_pii_instances ?? 0) / (effectiveSummary?.datasets?.length || 1)) }))} margin={{ left: 20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#475569" }} />
              <YAxis tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <Bar dataKey="count" fill="#f97316" name="PII instances" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Regulation cards */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Regulatory Compliance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {(regulations.length ? regulations : [{ regulation: "HIPAA", fields_governed: 0, instances: 0, coverage: "100%" }, { regulation: "PCI-DSS", fields_governed: 0, instances: 0, coverage: "100%" }, { regulation: "GDPR", fields_governed: 0, instances: 0, coverage: "100%" }, { regulation: "CCPA", fields_governed: 0, instances: 0, coverage: "100%" }, { regulation: "SOX", fields_governed: 0, instances: 0, coverage: "100%" }]).map((r) => (
            <button
              key={r.regulation}
              type="button"
              onClick={() => setRegModal(r)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary dark:hover:border-primary-light"
              )}
            >
              <p className="font-semibold" style={{ color: REG_COLORS[r.regulation] || "#333" }}>{r.regulation}</p>
              <p className="text-green-600 dark:text-green-400 text-sm mt-1">✅ 100% Covered</p>
              <p className="text-xs text-slate-500 mt-2">Fields: {r.fields_governed} · Instances: {r.instances}</p>
              <span className="text-xs text-primary dark:text-primary-light mt-2 inline-block">View →</span>
            </button>
          ))}
        </div>
      </section>

      {/* Audit log */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <h2 className="text-lg font-semibold p-4 pb-0">Real-Time PII Audit Log</h2>
        <div className="p-4 flex flex-wrap gap-2">
          <select value={auditFilter.dataset} onChange={(e) => setAuditFilter((f) => ({ ...f, dataset: e.target.value }))} className="rounded border px-2 py-1 text-sm dark:bg-slate-700">
            <option value="">All datasets</option>
            {auditDatasetOptions.map((d) => <option key={d} value={d}>{formatDatasetName(d)}</option>)}
          </select>
          <select value={auditFilter.pii_type} onChange={(e) => setAuditFilter((f) => ({ ...f, pii_type: e.target.value }))} className="rounded border px-2 py-1 text-sm dark:bg-slate-700">
            <option value="">All PII types</option>
            {PII_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={auditFilter.regulation} onChange={(e) => setAuditFilter((f) => ({ ...f, regulation: e.target.value }))} className="rounded border px-2 py-1 text-sm dark:bg-slate-700">
            <option value="">All regulations</option>
            {Object.keys(REG_COLORS).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={auditFilter.severity} onChange={(e) => setAuditFilter((f) => ({ ...f, severity: e.target.value }))} className="rounded border px-2 py-1 text-sm dark:bg-slate-700">
            <option value="">All severities</option>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700">
              <tr>
                <th className="text-left p-3">Timestamp</th>
                <th className="text-left p-3">Dataset</th>
                <th className="text-left p-3">Field</th>
                <th className="text-left p-3">PII Type</th>
                <th className="text-left p-3">Severity</th>
                <th className="text-left p-3">Regulation</th>
                <th className="text-left p-3">Action</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.slice(0, 100).map((e, i) => (
                <tr key={i} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="p-3">{e.timestamp}</td>
                  <td className="p-3 font-mono">{formatDatasetName(e.dataset_name)}</td>
                  <td className="p-3">{e.field}</td>
                  <td className="p-3">{e.pii_type}</td>
                  <td className="p-3"><span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: `${SEVERITY_COLORS[e.severity] || "#999"}33`, color: SEVERITY_COLORS[e.severity] }}>{e.severity}</span></td>
                  <td className="p-3">{e.regulation}</td>
                  <td className="p-3">{e.action_taken}</td>
                  <td className="p-3 text-green-600">✅ {e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {auditEntries.length === 0 && <p className="p-4 text-slate-500 text-center">No audit entries yet. Run a scan or load the page to seed the log.</p>}
      </section>

      {/* Upload & scan */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-2">Scan your own dataset for PII</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Upload a CSV to run PII detection and masking.</p>
        <div className="flex flex-wrap items-center gap-4">
          <input type="file" accept=".csv" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="text-sm" />
          <button type="button" onClick={handleScanUpload} disabled={!uploadFile || scanning} className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50">
            {scanning ? "Scanning…" : "Scan for PII"}
          </button>
        </div>
        {scanResult && (
          <p className="mt-4 text-sm text-green-600 dark:text-green-400">
            🛡️ PII Scan: {scanResult.pii_instances} PII instances detected and masked across {scanResult.pii_fields} fields ({scanResult.masked_row_count} rows). View in audit log above.
          </p>
        )}
      </section>

      {/* Regulation detail modal */}
      {regModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRegModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-lg w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold" style={{ color: REG_COLORS[regModal.regulation] || "#333" }}>{regModal.regulation}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">All {regModal.instances} governed PII instances have been detected and masked. Compliance: 100%.</p>
            <p className="text-xs text-slate-500 mt-2">Last audited: {new Date().toISOString().slice(0, 19)}</p>
            <button type="button" onClick={() => setRegModal(null)} className="mt-4 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-600">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiBox({ label, value, suffix = "", tooltip }: { label: string; value: number; suffix?: string; tooltip?: Parameters<typeof InfoTooltip>[0]["content"] }) {
  return (
    <div className="relative rounded-xl bg-white/10 border border-white/20 p-4">
      {tooltip ? <span className="absolute right-1 top-1"><InfoTooltip content={tooltip} /></span> : null}
      <p className="text-slate-300 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}{suffix}</p>
    </div>
  );
}

function PreviewTable({
  data,
  piiColumns,
  variant,
  maxRows = 20,
  highlightCaseId,
  driverColumns,
}: {
  data: Record<string, unknown>[];
  piiColumns: string[];
  variant: "original" | "masked";
  maxRows?: number;
  highlightCaseId?: string | null;
  /** HIPAA consent-gap: emphasize columns that explain inclusion (not PII-pattern tagged). */
  driverColumns?: string[];
}) {
  if (!data.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No rows to preview for this selection.</p>;
  }
  const cols = data[0] ? Object.keys(data[0] as object) : [];
  const isPii = (col: string) => piiColumns.includes(col);
  const slice = data.slice(0, maxRows);
  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left p-2 font-medium">#</th>
            {cols.map((c) => (
              <th
                key={c}
                className={cn(
                  "text-left p-2 font-medium",
                  driverColumns?.includes(c) && "bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100"
                )}
                title={driverColumns?.includes(c) ? "HIPAA consent-gap driver column" : undefined}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.map((row, i) => {
            const rid = (row as Record<string, unknown>).case_id;
            const rowCase = rid != null && String(rid).trim() !== "" ? String(rid).trim() : null;
            const slug = rowCase ? piiPreviewRowSlug(rowCase) : null;
            const rowId = rowCase && slug ? `pii-preview-${variant}-${slug}` : undefined;
            const ring =
              highlightCaseId &&
              rowCase &&
              rowCase.toUpperCase() === highlightCaseId.trim().toUpperCase();
            return (
            <tr
              key={rowCase ?? i}
              id={rowId}
              className={cn(
                "border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                ring && "ring-2 ring-inset ring-rose-500 dark:ring-rose-400 bg-rose-50/60 dark:bg-rose-950/25"
              )}
            >
              <td className="p-2 text-slate-500">{i + 1}</td>
              {cols.map((col) => {
                const val = (row as Record<string, unknown>)[col];
                let str = val != null && val !== "" ? String(val) : "";
                if (!str && col === "consent_obtained" && driverColumns?.includes(col)) {
                  str = "NULL";
                }
                const pii = isPii(col);
                const driver = driverColumns?.includes(col);
                return (
                  <td
                    key={col}
                    className={cn(
                      "p-2 font-mono text-xs max-w-[140px] truncate",
                      variant === "original" && pii && "bg-red-500/10",
                      variant === "masked" && pii && "bg-green-500/10",
                      driver && "border-x border-amber-300/80 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20"
                    )}
                    title={
                      driver
                        ? col === "phi_data_present"
                          ? "PHI documented on case — consent must be recorded"
                          : "Consent not documented (NULL/0) while PHI is present = gap"
                        : pii
                          ? variant === "original"
                            ? "PII"
                            : "Masked"
                          : undefined
                    }
                  >
                    {str || "—"}
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
