import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "../lib/utils";
import { formatDatasetName, scoreTextClass } from "../lib/datasetHelpers";
import InfoTooltip from "../components/InfoTooltip";
import {
  TOOLTIP_PROF_COMPLETENESS,
  TOOLTIP_PROF_CONSISTENCY,
  TOOLTIP_PROF_CRITICAL,
  TOOLTIP_PROF_HIGH,
  TOOLTIP_PROF_MEDIUM,
  TOOLTIP_PROF_OVERALL,
  TOOLTIP_PROF_UNIQUENESS,
  TOOLTIP_PROF_VALIDITY,
} from "../lib/tooltipContent";

const DATASETS = ["customer_master", "sales_orders", "product_catalog", "patient_support"] as const;
const ALL_DATASETS = "__all__";
type DatasetKey = (typeof DATASETS)[number];

function isDatasetKey(value: string): value is DatasetKey {
  return (DATASETS as readonly string[]).includes(value);
}

const FIX_SUGGESTIONS: Record<string, string> = {
  Completeness: "Backfill from source system or apply default where business rules allow. Consider validation at ingestion.",
  Uniqueness: "Deduplicate on key (e.g. customer_id); merge or flag duplicates for review.",
  Validity: "Apply format rules (e.g. phone, email). Reject or correct invalid values in pipeline.",
  Consistency: "Standardize values (e.g. state codes: use 2-letter codes) and enforce cross-field rules.",
  "Referential Integrity": "Align keys with master (e.g. customer_id in CUSTOMER_MASTER) or create placeholder master records.",
  Compliance: "Complete required fields (e.g. MDR submitted, consent obtained) per regulation and remediate gaps.",
};

/** Stable DOM id for an issue row (used with ?issue=mdr | ?highlight=CASE-… on patient_support). */
function profilerIssueRowId(column: string) {
  return `profiler-issue-${column.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "row"}`;
}

export default function Profiler() {
  const isDark = document.documentElement.classList.contains("dark");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>(DATASETS[0]);
  useEffect(() => {
    const scope = searchParams.get("scope");
    const urlDataset = searchParams.get("dataset");
    if (scope === "all") {
      setSelected(ALL_DATASETS);
      return;
    }
    if (urlDataset && isDatasetKey(urlDataset)) {
      setSelected(urlDataset);
      return;
    }
    setSelected(DATASETS[0]);
  }, [searchParams]);

  type QualityProfile = Awaited<ReturnType<typeof api.getQuality>>;
  const [profile, setProfile] = useState<QualityProfile | null>(null);
  const [piiReport, setPiiReport] = useState<Awaited<ReturnType<typeof api.getPiiDatasetReport>> | null>(null);
  const [allProfiles, setAllProfiles] = useState<QualityProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const isAllDatasetsView = selected === ALL_DATASETS;

  useEffect(() => {
    setLoading(true);
    if (isAllDatasetsView) {
      Promise.all(DATASETS.map((dataset) => api.getQuality(dataset)))
        .then((profiles) => {
          setAllProfiles(profiles);
          setProfile(null);
        })
        .finally(() => setLoading(false));
      return;
    }
    api
      .getQuality(selected)
      .then((nextProfile) => {
        setProfile(nextProfile);
        setAllProfiles(null);
      })
      .finally(() => setLoading(false));
  }, [selected, isAllDatasetsView]);

  useEffect(() => {
    if (isAllDatasetsView) {
      setPiiReport(null);
      return;
    }
    api.getPiiDatasetReport(selected).then(setPiiReport).catch(() => setPiiReport(null));
  }, [selected]);

  const aggregateProfile = useMemo<QualityProfile | null>(() => {
    if (!allProfiles?.length) return null;
    const totalRows = allProfiles.reduce((sum, p) => sum + (p.row_count || 0), 0);
    const weightedAvg = (pick: (p: QualityProfile) => number) => {
      if (!totalRows) return 0;
      return Number((allProfiles.reduce((sum, p) => sum + pick(p) * (p.row_count || 0), 0) / totalRows).toFixed(1));
    };
    const issuesMap = new Map<string, { type: string; column: string; severity: string; count: number }>();
    allProfiles.forEach((p) => {
      p.issues.forEach((issue) => {
        const key = `${p.dataset}|${issue.type}|${issue.column}|${issue.severity}`;
        const existing = issuesMap.get(key);
        if (existing) {
          existing.count += issue.count;
        } else {
          issuesMap.set(key, {
            type: issue.type,
            column: `${formatDatasetName(p.dataset)} · ${issue.column}`,
            severity: issue.severity,
            count: issue.count,
          });
        }
      });
    });
    return {
      dataset: ALL_DATASETS,
      row_count: totalRows,
      completeness: Object.fromEntries(allProfiles.map((p) => [formatDatasetName(p.dataset), p.completeness_overall])),
      completeness_overall: weightedAvg((p) => p.completeness_overall),
      validity_pct: weightedAvg((p) => p.validity_pct),
      uniqueness_pct: weightedAvg((p) => p.uniqueness_pct),
      consistency_pct: weightedAvg((p) => p.consistency_pct),
      overall_score: weightedAvg((p) => p.overall_score),
      issues: Array.from(issuesMap.values()).sort((a, b) => b.count - a.count),
      sample_bad_records: [],
      integration_orphans: allProfiles.reduce((sum, p) => sum + (p.integration_orphans || 0), 0),
      mdr_gap_count: allProfiles.reduce((sum, p) => sum + (p.mdr_gap_count || 0), 0),
      hipaa_gap_count: allProfiles.reduce((sum, p) => sum + (p.hipaa_gap_count || 0), 0),
      mdr_gap_cases: [] as Record<string, unknown>[],
    };
  }, [allProfiles]);

  const activeProfile = isAllDatasetsView ? aggregateProfile : profile;

  type PatientProfilerFocus =
    | null
    | { mode: "column"; column: string; recordId: string | null }
    | { mode: "neutral"; unknownCaseId: string };

  const patientSupportIssueFocus: PatientProfilerFocus = useMemo(() => {
    if (isAllDatasetsView || selected !== "patient_support") return null;
    const issueParam = searchParams.get("issue")?.trim().toLowerCase();
    const highlight = searchParams.get("highlight")?.trim();
    const byIssue: Record<string, string> = { mdr: "mdr_submitted", hipaa: "consent_obtained" };
    if (issueParam && byIssue[issueParam]) {
      return { mode: "column", column: byIssue[issueParam], recordId: null };
    }
    if (highlight && /^case-\d+/i.test(highlight)) {
      const n = parseInt(highlight.replace(/^case-/i, ""), 10);
      if (n >= 5011 && n <= 5014) return { mode: "column", column: "mdr_submitted", recordId: highlight };
      if (n >= 5015 && n <= 5018) return { mode: "column", column: "consent_obtained", recordId: highlight };
      return { mode: "neutral", unknownCaseId: highlight };
    }
    return null;
  }, [searchParams, selected, isAllDatasetsView]);

  useEffect(() => {
    if (loading || isAllDatasetsView || !patientSupportIssueFocus || patientSupportIssueFocus.mode !== "column") return;
    const rowId = profilerIssueRowId(patientSupportIssueFocus.column);
    const timer = window.setTimeout(() => {
      document.getElementById(rowId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loading, isAllDatasetsView, patientSupportIssueFocus, activeProfile?.issues]);

  useEffect(() => {
    if (loading || isAllDatasetsView || patientSupportIssueFocus?.mode !== "column" || !patientSupportIssueFocus.recordId) return;
    if (patientSupportIssueFocus.column !== "mdr_submitted") return;
    const cid = patientSupportIssueFocus.recordId.replace(/[^a-zA-Z0-9-]/g, "");
    const timer = window.setTimeout(() => {
      document.getElementById(`profiler-mdr-case-${cid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [loading, isAllDatasetsView, patientSupportIssueFocus, profile]);

  if (loading && !activeProfile) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!activeProfile) return <div>Select a dataset.</div>;

  const completenessBars = Object.entries(activeProfile.completeness || {}).map(([name, pct]) => ({
    name,
    pct,
    fill: pct >= 85 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#f43f5e",
  }));
  const totalIssues = activeProfile.issues.reduce((sum, issue) => sum + issue.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary dark:text-primary-light">
        Data Quality Profiler — {isAllDatasetsView ? "All Datasets" : formatDatasetName(selected)}
      </h1>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium">Dataset</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2"
        >
          <option value={ALL_DATASETS}>All Datasets (Executive Aggregate)</option>
          {DATASETS.map((d) => (
            <option key={d} value={d}>
              {formatDatasetName(d)}
            </option>
          ))}
        </select>
      </div>
      {isAllDatasetsView && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-200">
          This aggregate view maps directly to Dashboard "Total Issues Detected" by summing issue counts across all profiled datasets.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isAllDatasetsView ? <MetricCard label="Total Issues (All Datasets)" value={String(totalIssues)} /> : null}
        <MetricCard label="Overall Score" value={`${activeProfile.overall_score}%`} tooltip={TOOLTIP_PROF_OVERALL} />
        <MetricCard label="Completeness" value={`${activeProfile.completeness_overall}%`} tooltip={TOOLTIP_PROF_COMPLETENESS} />
        <MetricCard label="Validity" value={`${activeProfile.validity_pct}%`} tooltip={TOOLTIP_PROF_VALIDITY} />
        <MetricCard label="Uniqueness" value={`${activeProfile.uniqueness_pct}%`} tooltip={TOOLTIP_PROF_UNIQUENESS} />
        <MetricCard label="Consistency" value={`${activeProfile.consistency_pct}%`} tooltip={TOOLTIP_PROF_CONSISTENCY} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">{isAllDatasetsView ? "Completeness by Dataset" : "Completeness by Column"}</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, completenessBars.length * 28)}>
          <BarChart data={completenessBars} layout="vertical" margin={{ left: 120, right: 20 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#475569" }} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Completeness"]} contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#f1f5f9" : "#0f172a" }} />
            <Bar dataKey="pct" name="Completeness %" radius={[0, 4, 4, 0]}>
              {completenessBars.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div id="profiler-issues-panel" className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <h2 className="text-lg font-semibold p-6 pb-0">Issues (sortable)</h2>
        {!isAllDatasetsView && selected === "patient_support" && patientSupportIssueFocus?.mode === "neutral" ? (
          <div className="mx-6 mb-3 rounded-lg border border-amber-300 dark:border-amber-600/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            Case id <span className="font-mono font-semibold">{patientSupportIssueFocus.unknownCaseId}</span> is outside the demo highlight bands (MDR: CASE-5011–5014; consent: CASE-5015–5018). Open a linked SLA or pick a case from the MDR gap table below when available.
            <button
              type="button"
              className="ml-2 text-xs font-medium underline underline-offset-2"
              onClick={() => navigate("/profiler?dataset=patient_support")}
            >
              Clear highlight →
            </button>
          </div>
        ) : null}
        {!isAllDatasetsView && selected === "patient_support" && patientSupportIssueFocus?.mode === "column" ? (
          <div className="mx-6 mb-3 rounded-lg border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/90 dark:bg-indigo-950/40 px-3 py-2 text-sm text-indigo-900 dark:text-indigo-100">
            {patientSupportIssueFocus.recordId ? (
              <span>
                Highlighted support case <span className="font-mono font-semibold">{patientSupportIssueFocus.recordId}</span> — focusing{" "}
                <span className="font-mono">{patientSupportIssueFocus.column}</span> in the issues table.
              </span>
            ) : (
              <span>
                Deep link: focusing <span className="font-mono">{patientSupportIssueFocus.column}</span> (adverse events / MDR or consent gaps).
              </span>
            )}
            <button
              type="button"
              className="ml-2 text-xs font-medium underline underline-offset-2"
              onClick={() =>
                navigate(
                  patientSupportIssueFocus.column === "consent_obtained"
                    ? "/compliance?reg=hipaa&dataset=patient_support"
                    : "/compliance?reg=fda-mdr&dataset=patient_support"
                )
              }
            >
              Open matching regulation view →
            </button>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left p-4 font-medium">Issue Type</th>
                <th className="text-left p-4 font-medium">Column</th>
                <th className="text-left p-4 font-medium">PII Risk</th>
                <th className="text-right p-4 font-medium">Records Affected</th>
                <th className="text-left p-4 font-medium">Severity <InfoTooltip content={TOOLTIP_PROF_CRITICAL} /> <InfoTooltip content={TOOLTIP_PROF_HIGH} /> <InfoTooltip content={TOOLTIP_PROF_MEDIUM} /></th>
              </tr>
            </thead>
            <tbody>
              {(activeProfile.issues || []).map((issue, i) => {
                const piiField = piiReport?.field_details?.find((f) => f.field === issue.column);
                const severity = String(issue.severity || "").toUpperCase();
                const regulatoryHint = /MDR|consent|compliance|FDA|HIPAA/i.test(`${issue.type} ${issue.column}`);
                const focused =
                  patientSupportIssueFocus?.mode === "column" && issue.column === patientSupportIssueFocus.column;
                return (
                <tr
                  key={i}
                  id={profilerIssueRowId(String(issue.column))}
                  className={cn(
                    "border-b border-slate-100 dark:border-slate-700/50 group hover:bg-slate-50 dark:hover:bg-slate-700/50",
                    focused && "ring-2 ring-inset ring-rose-500 dark:ring-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
                  )}
                >
                  <td className="p-4">{issue.type}</td>
                  <td className="p-4 font-mono">{issue.column}</td>
                  <td className="p-4">
                    {piiField ? (
                      <span className="flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" title="PII">🔴 {piiField.pii_type}</span>
                        {piiField.regulations?.slice(0, 2).map((r) => (
                          <span key={r} className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-200">{r}</span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">{issue.count}</td>
                  <td className="p-4">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium cursor-help",
                        severity === "CRITICAL" && "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
                        severity === "HIGH" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                        severity === "MEDIUM" && "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
                        severity === "LOW" && "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      )}
                    >
                      {severity || issue.severity}
                    </span>
                    <span className="ml-2 text-slate-400 cursor-help" title={FIX_SUGGESTIONS[issue.type] || "Review and remediate per data governance policy."}>ⓘ</span>
                    {regulatoryHint && (
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams();
                          const col = String(issue.column || "").toLowerCase();
                          if (col.includes("mdr")) {
                            params.set("reg", "fda-mdr");
                            params.set("dataset", "patient_support");
                          } else if (col.includes("consent")) {
                            params.set("reg", "hipaa");
                            params.set("dataset", "patient_support");
                          } else {
                            params.set("reg", "qmsr");
                            if (selected === "product_catalog" || selected === "patient_support" || selected === "sales_orders") {
                              params.set("dataset", selected);
                            }
                          }
                          navigate(`/compliance?${params.toString()}`);
                        }}
                        className="ml-2 text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      >
                        ⚖ View in Compliance →
                      </button>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {!isAllDatasetsView &&
        selected === "patient_support" &&
        ((activeProfile as unknown as { mdr_gap_cases?: Record<string, unknown>[] }).mdr_gap_cases?.length ?? 0) >
          0 ? (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm mb-2">MDR gap cases (adverse event, no MDR filed)</h3>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {Object.keys(
                      ((activeProfile as unknown as { mdr_gap_cases: Record<string, unknown>[] }).mdr_gap_cases[0] ||
                        {}) as object
                    ).map((k) => (
                      <th key={k} className="text-left p-2 font-medium">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(activeProfile as unknown as { mdr_gap_cases: Record<string, unknown>[] }).mdr_gap_cases.map((row, idx) => {
                    const cid = row.case_id != null ? String(row.case_id) : `idx-${idx}`;
                    const safeId = cid.replace(/[^a-zA-Z0-9-]/g, "");
                    const hl =
                      patientSupportIssueFocus?.mode === "column" &&
                      patientSupportIssueFocus.recordId &&
                      patientSupportIssueFocus.recordId === cid;
                    return (
                      <tr
                        key={cid}
                        id={`profiler-mdr-case-${safeId}`}
                        className={cn(
                          "border-b border-slate-100 dark:border-slate-700/50",
                          hl && "ring-2 ring-inset ring-rose-500 dark:ring-rose-400 bg-rose-50/40 dark:bg-rose-950/25"
                        )}
                      >
                        {Object.values(row).map((v, i) => (
                          <td key={i} className="p-2 font-mono max-w-[160px] truncate" title={String(v ?? "")}>
                            {String(v ?? "—")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {(activeProfile.sample_bad_records as Record<string, unknown>[] | undefined)?.length ? (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700">
            <details>
              <summary className="font-medium mb-2 cursor-pointer">Sample Records with Issues ({(activeProfile.sample_bad_records as Record<string, unknown>[]).length} shown)</summary>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {Object.keys((activeProfile.sample_bad_records as Record<string, unknown>[])[0] || {}).map((k) => (
                        <th key={k} className="text-left p-2">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(activeProfile.sample_bad_records as Record<string, unknown>[]).slice(0, 5).map((r, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        {Object.values(r).map((v, i) => (
                          <td key={i} className="p-2">{String(v ?? "—")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tooltip }: { label: string; value: string; tooltip?: Parameters<typeof InfoTooltip>[0]["content"] }) {
  const numeric = Number(value.replace("%", ""));
  return (
    <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500 transition-all duration-200">
      {tooltip ? <span className="absolute right-2 top-2"><InfoTooltip content={tooltip} /></span> : null}
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      <p className={cn("text-xl font-bold mt-1", Number.isNaN(numeric) ? "" : scoreTextClass(numeric))}>{value}</p>
    </div>
  );
}
