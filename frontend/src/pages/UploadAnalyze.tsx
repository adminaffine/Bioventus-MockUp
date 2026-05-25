import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type UploadReport, type UploadSession } from "../services/api";
import { useChat } from "../contexts/ChatContext";
import ComparisonCard from "../components/ComparisonCard";
import Toast from "../components/Toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "../lib/utils";
import { useDateFormat } from "../context/DateFormatContext";
import { UploadCloud, FileText, Download, Trash2, MessageSquare } from "lucide-react";

export default function UploadAnalyze() {
  const { formatDate } = useDateFormat();
  const [files, setFiles] = useState<File[]>([]);
  const [fileTypes, setFileTypes] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [baselineSummary, setBaselineSummary] = useState<{
    overall_data_quality_score: number;
    total_issues_detected: number;
    critical_compliance_risks: number;
    cross_system_integration_gaps: number;
  } | null>(null);
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "error" | "info" } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [piiScanResult, setPiiScanResult] = useState<{ pii_instances: number; pii_fields: number; masked_row_count?: number } | null>(null);
  const [piiScanning, setPiiScanning] = useState(false);
  const navigate = useNavigate();
  const { setOpen: setChatOpen, setUploadSessionId } = useChat();

  const showToast = (message: string, type: "success" | "warning" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    api.getDashboardSummary().then((d) => setBaselineSummary(d)).catch(() => {});
  }, []);

  useEffect(() => {
    api.getUploadSessions().then((r) => setSessions(r.sessions || [])).catch(() => {});
  }, [report]);

  // When user has an upload report, set it as AI context so "Ask AI" answers about this data
  useEffect(() => {
    setUploadSessionId(report?.session_id ?? null);
    return () => setUploadSessionId(null);
  }, [report?.session_id, setUploadSessionId]);

  const detectType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes("customer_master") || lower.includes("customer")) return "CUSTOMER_MASTER";
    if (lower.includes("sales_order") || lower.includes("sales")) return "SALES_ORDERS";
    if (lower.includes("product_catalog") || lower.includes("product")) return "PRODUCT_CATALOG";
    if (lower.includes("patient_support") || lower.includes("patient")) return "PATIENT_SUPPORT";
    return "unknown";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const list = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (list.length > 4) {
      showToast("Maximum 4 files. Only first 4 will be used.", "warning");
      list.splice(4);
    }
    if (list.some((f) => f.size > 10 * 1024 * 1024)) {
      showToast("One or more files exceed 10MB and will be skipped.", "warning");
    }
    const valid = list.filter((f) => f.size <= 10 * 1024 * 1024);
    setFiles((prev) => {
      const combined = [...prev, ...valid].slice(0, 4);
      const types: Record<string, string> = {};
      combined.forEach((f) => (types[f.name] = detectType(f.name)));
      setFileTypes(types);
      return combined;
    });
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []).filter((f) => f.name.toLowerCase().endsWith(".csv")).slice(0, 4);
    setFiles((prev) => {
      const combined = [...prev, ...list].slice(0, 4);
      const types: Record<string, string> = {};
      combined.forEach((f) => (types[f.name] = detectType(f.name)));
      setFileTypes(types);
      return combined;
    });
    e.target.value = "";
  };

  const setFileType = (fileName: string, type: string) => {
    setFileTypes((prev) => ({ ...prev, [fileName]: type }));
  };

  const analyze = async () => {
    if (files.length === 0) {
      showToast("Please add at least one CSV file.", "warning");
      return;
    }
    setUploading(true);
    setReport(null);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await api.uploadDatasets(formData);
      setReport(res);
      setPiiScanResult(null);
      showToast(`Analysis complete — ${res.summary?.total_issues_detected ?? 0} issues detected.`, "success");
      if ((res.summary?.critical_compliance_risks ?? 0) > 0) {
        showToast("Critical compliance gaps found in uploaded data.", "error");
      }
      try {
        const piiRes = await api.postPiiScanSession(res.session_id);
        setPiiScanResult({
          pii_instances: piiRes.pii_instances,
          pii_fields: piiRes.pii_fields,
          masked_row_count: piiRes.masked_row_count,
        });
      } catch {
        setPiiScanResult(null);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  };

  const loadSession = (sessionId: string) => {
    setPiiScanResult(null);
    api.getUploadSession(sessionId).then(setReport).catch(() => showToast("Failed to load session.", "error"));
  };

  const runPiiScanAndOpenShield = async () => {
    if (!report?.session_id) return;
    setPiiScanning(true);
    try {
      const piiRes = await api.postPiiScanSession(report.session_id);
      setPiiScanResult({
        pii_instances: piiRes.pii_instances,
        pii_fields: piiRes.pii_fields,
        masked_row_count: piiRes.masked_row_count,
      });
      showToast(`PII scan complete: ${piiRes.pii_instances} instances in ${piiRes.pii_fields} fields. Opening PII Shield.`, "success");
      navigate("/pii-shield", { state: { uploadSessionId: report.session_id } });
    } catch {
      showToast("PII scan failed. Check that the upload session still exists.", "error");
    } finally {
      setPiiScanning(false);
    }
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setFileTypes((prev => { const next = { ...prev }; delete next[name]; return next; }));
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-primary dark:text-primary-light">Upload & Analyze</h1>

      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
        Upload synthetic or anonymized test data only. Do not upload real patient or customer data.
      </div>

      {/* Section A: File upload zone */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Upload CSV files</h2>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-slate-300 dark:border-slate-600",
            "min-h-[160px] flex flex-col items-center justify-center gap-4"
          )}
        >
          <UploadCloud className="w-12 h-12 text-slate-400 mx-auto" />
          <p className="text-slate-600 dark:text-slate-400">
            Drag and drop up to 4 CSV files here, or click to browse.
          </p>
          <input
            type="file"
            accept=".csv"
            multiple
            onChange={onFileSelect}
            className="hidden"
            id="upload-csv"
          />
          <label
            htmlFor="upload-csv"
            className="cursor-pointer px-4 py-2 rounded-lg bg-primary dark:bg-primary-light text-white hover:opacity-90"
          >
            Select files
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Selected files:</p>
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate text-sm">{f.name}</span>
                <span className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
                <select
                  value={fileTypes[f.name] || "unknown"}
                  onChange={(e) => setFileType(f.name, e.target.value)}
                  className="text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                >
                  <option value="unknown">Select type</option>
                  <option value="CUSTOMER_MASTER">Customer Master</option>
                  <option value="SALES_ORDERS">Sales Orders</option>
                  <option value="PRODUCT_CATALOG">Product Catalog</option>
                  <option value="PATIENT_SUPPORT">Patient Support</option>
                </select>
                <button type="button" onClick={() => removeFile(f.name)} className="text-red-600 dark:text-red-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={analyze}
                disabled={uploading}
                className="px-4 py-2 rounded-lg bg-primary dark:bg-primary-light text-white disabled:opacity-50"
              >
                {uploading ? "Analyzing…" : "Analyze Now"}
              </button>
              <button
                type="button"
                onClick={() => { setFiles([]); setFileTypes({}); setReport(null); }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              >
                Clear
              </button>
            </div>
            {uploading && (
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                <div className="h-full w-2/3 bg-primary animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section B: Upload results dashboard */}
      {report && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Your upload results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-accent bg-accent/10 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Quality Score</p>
              <p className="text-2xl font-bold text-accent">{report.summary?.overall_data_quality_score ?? 0}/100</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Total issues</p>
              <p className="text-2xl font-bold">{report.summary?.total_issues_detected ?? 0}</p>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Critical compliance risks</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{report.summary?.critical_compliance_risks ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Integration gaps</p>
              <p className="text-2xl font-bold">{report.summary?.cross_system_integration_gaps ?? 0}</p>
            </div>
          </div>

          {/* PII Shield: analyze and open, or link to view results */}
          <div className="rounded-xl border-2 border-green-500/30 dark:border-green-500/50 bg-green-50 dark:bg-green-900/20 p-4">
            <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">🛡️ PII Shield</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
              Run a PII scan on your uploaded files to detect and mask sensitive data, then view the full report in PII Shield.
            </p>
            {piiScanResult ? (
              <Link
                to="/pii-shield"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 dark:bg-green-700 text-white font-medium hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
              >
                View in PII Shield — {piiScanResult.pii_instances} instances · {piiScanResult.pii_fields} fields
                {piiScanResult.masked_row_count != null ? ` · ${piiScanResult.masked_row_count} rows masked` : ""}
              </Link>
            ) : (
              <button
                type="button"
                onClick={runPiiScanAndOpenShield}
                disabled={piiScanning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 dark:bg-green-700 text-white font-medium hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {piiScanning ? "Scanning…" : "Run PII scan & open PII Shield"}
              </button>
            )}
          </div>

          {baselineSummary && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-semibold mb-4">Baseline (static application dataset) vs your upload</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ComparisonCard
                  title="Quality Score"
                  baselineValue={baselineSummary.overall_data_quality_score}
                  uploadedValue={report.summary?.overall_data_quality_score ?? 0}
                  suffix="/ 100"
                />
                <ComparisonCard
                  title="Total issues"
                  baselineValue={baselineSummary.total_issues_detected}
                  uploadedValue={report.summary?.total_issues_detected ?? 0}
                  invertBetter
                />
                <ComparisonCard
                  title="Critical risks"
                  baselineValue={baselineSummary.critical_compliance_risks}
                  uploadedValue={report.summary?.critical_compliance_risks ?? 0}
                  invertBetter
                />
                <ComparisonCard
                  title="Integration gaps"
                  baselineValue={baselineSummary.cross_system_integration_gaps}
                  uploadedValue={report.summary?.cross_system_integration_gaps ?? 0}
                  invertBetter
                />
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-semibold mb-4">Per-file quality</h3>
            {report.profiles?.map((p) => {
              const bars = Object.entries(p.completeness || {}).map(([name, pct]) => ({
                name,
                pct,
                fill: pct >= 90 ? "#22c55e" : pct >= 70 ? "#eab308" : "#ef4444",
              }));
              return (
                <div key={p.dataset} className="mb-6 last:mb-0">
                  <p className="font-mono text-sm mb-2">{p.dataset} — Score: {p.overall_score}%</p>
                  <ResponsiveContainer width="100%" height={Math.min(200, bars.length * 24)}>
                    <BarChart data={bars} layout="vertical" margin={{ left: 100 }}>
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                        {bars.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <h3 className="font-semibold p-6 pb-0">Issues</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-4">Dataset</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Column</th>
                    <th className="text-right p-4">Count</th>
                    <th className="text-left p-4">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.profiles?.flatMap((p) =>
                    (p.issues || []).map((i, idx) => (
                      <tr key={`${p.dataset}-${idx}`} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="p-4 font-mono">{p.dataset}</td>
                        <td className="p-4">{i.type}</td>
                        <td className="p-4">{i.column}</td>
                        <td className="p-4 text-right">{i.count}</td>
                        <td className="p-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-xs",
                              i.severity === "Critical" && "bg-red-100 text-red-800 dark:bg-red-900/30",
                              i.severity === "High" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30",
                              i.severity === "Medium" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30",
                              i.severity === "Low" && "bg-slate-100 text-slate-600 dark:bg-slate-700"
                            )}
                          >
                            {i.severity}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {report.integration_edges && report.integration_edges.length > 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-semibold mb-4">Integration (join keys & match rate)</h3>
              <div className="flex flex-wrap gap-4">
                {report.integration_edges.map((e, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm",
                      e.status === "green" && "border-green-500 bg-green-50 dark:bg-green-900/20",
                      e.status === "amber" && "border-amber-500 bg-amber-50 dark:bg-amber-900/20",
                      e.status === "red" && "border-red-500 bg-red-50 dark:bg-red-900/20"
                    )}
                  >
                    {e.from} → {e.to} | {e.join_key}: {e.match_rate}% match, {e.orphaned_count} orphaned
                  </div>
                ))}
              </div>
            </div>
          ) : (
            report.profiles && report.profiles.length < 2 && (
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Upload additional dataset types to enable cross-dataset integration analysis.
              </p>
            )
          )}

          <div className="flex gap-2">
            <a
              href={api.getUploadSessionExportUrl(report.session_id)}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary dark:bg-primary-light text-white"
            >
              <Download className="w-4 h-4" />
              Download issues report (CSV)
            </a>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
            >
              <MessageSquare className="w-4 h-4" />
              Ask AI about my data
            </button>
          </div>
        </div>
      )}

      {/* Section C: Previous sessions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Previous upload sessions (last 10)</h2>
        {sessions.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">No sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.slice(0, 10).map((s) => (
              <li
                key={s.session_id}
                className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono truncate">{s.session_id.slice(0, 8)}…</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(s.created_at)} · {s.files?.map((f) => f.filename).join(", ")}
                  </p>
                </div>
                <span className="text-sm shrink-0">Score: {s.overall_score ?? "—"} · Issues: {s.issue_count ?? "—"}</span>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadSession(s.session_id)}
                    className="text-sm text-primary dark:text-primary-light"
                  >
                    Load
                  </button>
                  <a
                    href={api.getUploadSessionExportUrl(s.session_id)}
                    download
                    className="text-sm flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
