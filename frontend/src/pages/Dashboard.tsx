import { useMemo, memo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { cn } from "../lib/utils";
import { useCachedFetch, getCachedTimestamp } from "../hooks/useCachedFetch";
import { KPICardSkeleton } from "../components/skeletons/KPICardSkeleton";
import { ChartSkeleton } from "../components/skeletons/ChartSkeleton";
import { formatDatasetName, scoreTextClass } from "../lib/datasetHelpers";
import InfoTooltip, { type TooltipContent } from "../components/InfoTooltip";
import {
  TOOLTIP_DASH_CAPA_STATUS,
  TOOLTIP_DASH_COMPLIANCE_RISKS,
  TOOLTIP_DASH_CONSENT_PILLS,
  TOOLTIP_DASH_DQ_SCORE,
  TOOLTIP_DASH_EXOGEN_RED,
  TOOLTIP_DASH_INTEGRATION_GAPS,
  TOOLTIP_DASH_MDR_PILLS,
  TOOLTIP_DASH_QMSR_BANNER,
  TOOLTIP_DASH_TOTAL_ISSUES,
} from "../lib/tooltipContent";

type DashboardSummary = Awaited<ReturnType<typeof api.getDashboardSummary>>;
type PiiSummary = Awaited<ReturnType<typeof api.getPiiSummary>> | null;

const CACHE_KEY = "dashboard-combined";
const TTL_MS = 60_000;

function fetchDashboardCombined(): Promise<{ dashboard: DashboardSummary; pii: PiiSummary; capa: Awaited<ReturnType<typeof api.getCAPASummary>> | null }> {
  return Promise.all([
    api.getDashboardSummary(),
    api.getPiiSummary().catch(() => null),
    api.getCAPASummary().catch(() => null),
  ]).then(([dashboard, pii, capa]) => ({ dashboard, pii, capa }));
}

type RxSummary = Awaited<ReturnType<typeof api.getRxSummary>> | null;

export default function Dashboard() {
  const isDark = document.documentElement.classList.contains("dark");
  const datasetNavTarget = (label: string) => {
    const value = label.toLowerCase();
    if (value.includes("patient_support") || value.includes("exogen")) return "patient_support";
    if (value.includes("product_catalog") || value.includes("durolane")) return "product_catalog";
    if (value.includes("sales_orders") || value.includes("sales orders")) return "sales_orders";
    if (value.includes("customer_master") || value.includes("customer master")) return "customer_master";
    return "customer_master";
  };

  const navigate = useNavigate();
  const { data, loading, isStale, error } = useCachedFetch(
    CACHE_KEY,
    fetchDashboardCombined,
    TTL_MS
  );
  const dashboard = data?.dashboard ?? null;
  const piiSummary = data?.pii ?? null;
  const capaSummary = data?.capa ?? null;
  const [rxSummary, setRxSummary] = useState<RxSummary>(null);
  const [patientSupportQuality, setPatientSupportQuality] = useState<Awaited<ReturnType<typeof api.getQuality>> | null>(null);
  useEffect(() => {
    api.getRxSummary().then(setRxSummary).catch(() => setRxSummary(null));
    api.getQuality("patient_support").then(setPatientSupportQuality).catch(() => setPatientSupportQuality(null));
  }, []);

  const radarData = useMemo(() => {
    if (!dashboard?.regulation_coverage) return [];
    return dashboard.regulation_coverage.map((r) => ({
      regulation: r.regulation.replace(/^FDA |\(.*\)|Section \d+\/\d+/g, "").trim() || r.regulation.slice(0, 12),
      score: r.score,
      fullMark: 100,
    }));
  }, [dashboard?.regulation_coverage]);

  const cachedAt = getCachedTimestamp(CACHE_KEY);
  const lastUpdatedSeconds = cachedAt ? Math.floor((Date.now() - cachedAt) / 1000) : null;

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton height={220} />
          <ChartSkeleton height={220} />
        </div>
        <ChartSkeleton height={320} />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400">
        {error ? error.message : "Failed to load dashboard."}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center py-6 relative">
        {(isStale || lastUpdatedSeconds !== null) && (
          <p className="absolute top-0 right-0 text-xs text-slate-500 dark:text-slate-400">
            {lastUpdatedSeconds !== null && `Last updated ${lastUpdatedSeconds}s ago`}
            {isStale && " · Refreshing…"}
          </p>
        )}
        <h1 className="text-3xl font-bold text-primary dark:text-primary-light">
          AI-Powered Data Quality & Compliance Intelligence
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Life Sciences & Medical Device — Synthetic Application
        </p>
      </div>

      {dashboard.qmsr_alert?.active && (
        <div className="rounded-xl border-l-4 border-rose-500 dark:border-rose-400 bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse inline-block" />
                FDA QMSR — Quality Management System Regulation
              </p>
              <p className="text-sm mt-1">
                Effective February 2, 2026 · {dashboard.qmsr_alert.days_since_effective} days elapsed
              </p>
              <p className="text-sm mt-1">
                {dashboard.qmsr_alert.gaps_detected} compliance gaps detected across product_catalog and patient_support
                <InfoTooltip content={TOOLTIP_DASH_QMSR_BANNER} />
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/compliance")}
              className="text-sm font-medium underline underline-offset-2 hover:opacity-80"
            >
              View Compliance Gaps →
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Overall Data Quality Score"
          subtitle="Across 5 BV datasets"
          value={dashboard.overall_data_quality_score}
          suffix="/ 100"
          accent
          tooltipContent={TOOLTIP_DASH_DQ_SCORE}
        />
        <KpiCard
          title="Total Issues Detected"
          subtitle="Patient support & product catalog"
          value={dashboard.total_issues_detected}
          onClick={() => navigate("/profiler?scope=all")}
          tooltipContent={TOOLTIP_DASH_TOTAL_ISSUES}
        />
        <KpiCard
          title="Critical Compliance Risks"
          subtitle="MDR, HIPAA, QMSR gaps"
          value={dashboard.critical_compliance_risks}
          danger
          onClick={() => navigate("/compliance")}
          tooltipContent={TOOLTIP_DASH_COMPLIANCE_RISKS}
        />
        <KpiCard
          title="Integration Gaps"
          subtitle="Cross-system linkage failures"
          value={dashboard.cross_system_integration_gaps}
          tooltipContent={TOOLTIP_DASH_INTEGRATION_GAPS}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate("/profiler?dataset=patient_support&issue=mdr")}
          className="rounded-full px-4 py-2 text-sm font-medium cursor-pointer bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300"
        >
          🔴 {patientSupportQuality?.mdr_gap_count ?? 0} — Patient support: adverse events / MDR gaps →
          <InfoTooltip content={TOOLTIP_DASH_MDR_PILLS} />
        </button>
        <button
          type="button"
          onClick={() => navigate("/compliance?reg=qmsr&dataset=product_catalog")}
          className="rounded-full px-4 py-2 text-sm font-medium cursor-pointer bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300"
        >
          🔴 {dashboard.qmsr_alert?.gaps_detected ?? 0} QMSR Violations — Product Catalog →
        </button>
        <button
          type="button"
          onClick={() => navigate("/pii-shield?dataset=patient_support&view=consent_gaps&highlight=CASE-5015")}
          className="rounded-full px-4 py-2 text-sm font-medium cursor-pointer bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
        >
          🟡 {patientSupportQuality?.hipaa_gap_count ?? 0} Consent Gaps — Patient Support →
          <InfoTooltip content={TOOLTIP_DASH_CONSENT_PILLS} />
        </button>
      </div>

      {capaSummary && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 border border-slate-200 dark:border-slate-700">
          <span className="text-sm font-medium">{capaSummary.total_capas} CAPAs tracked · {capaSummary.capas.filter((c) => c.severity === "CRITICAL").length} Critical · {capaSummary.overdue} Overdue</span>
          <InfoTooltip content={TOOLTIP_DASH_CAPA_STATUS} />
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{capaSummary.capas.filter((c) => c.severity === "CRITICAL").length} Critical</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{capaSummary.open} Open</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{capaSummary.overdue} Overdue</span>
          <button type="button" onClick={() => navigate("/capa")} className="ml-auto text-sm font-medium underline underline-offset-2">
            View All CAPAs →
          </button>
        </div>
      )}

      {rxSummary && rxSummary.misrouted_prescriptions > 0 && (
        <div className="rounded-xl border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-red-800 dark:text-red-200 font-medium">
            💊 CRITICAL: {rxSummary.misrouted_prescriptions} prescriptions linked to wrong specialty doctor due to duplicate name — patient safety risk
            <InfoTooltip content={TOOLTIP_DASH_EXOGEN_RED} />
          </p>
          <Link to="/rx-integrity" className="text-red-600 dark:text-red-400 text-sm font-medium mt-1 inline-block">View RxIntegrity →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dashboard.enterprise_trust_score != null && (
          <Link
            to="/governance"
            className="block rounded-xl border-2 border-primary/30 dark:border-primary-light/50 bg-primary/5 dark:bg-primary/10 p-6 hover:border-primary dark:hover:border-primary-light transition-colors"
          >
            <h2 className="text-lg font-semibold text-primary dark:text-primary-light flex items-center gap-2">
              Data Governance & Integrity
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              Enterprise trust score: <strong>{dashboard.enterprise_trust_score.toFixed(1)}</strong>/100
              {(dashboard.integrity_violations ?? 0) > 0 && (
                <> · <strong className="text-amber-600 dark:text-amber-400">{dashboard.integrity_violations}</strong> integrity violations</>
              )}
            </p>
            <span className="inline-block mt-3 text-primary dark:text-primary-light font-medium text-sm">
              Open Command Center →
            </span>
          </Link>
        )}
        {piiSummary && (
          <Link
            to="/pii-shield"
            className="block rounded-xl border-2 border-green-500/30 dark:border-green-500/50 bg-green-50 dark:bg-green-900/20 p-6 hover:border-green-500 dark:hover:border-green-500 transition-colors"
          >
            <h2 className="text-lg font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
              <span>🛡️</span> PII Protection
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              {piiSummary.total_pii_instances.toLocaleString()} instances masked · {piiSummary.masking_coverage_pct} coverage | {piiSummary.regulations_covered} regs met
            </p>
            <span className="inline-block mt-3 text-green-600 dark:text-green-400 font-medium text-sm">
              View PII Shield →
            </span>
          </Link>
        )}
        {rxSummary && (
          <Link
            to="/rx-integrity"
            className="block rounded-xl border-2 border-[#00897B]/40 dark:border-[#00897B]/60 bg-[#00897B]/10 dark:bg-[#00897B]/20 p-6 hover:border-[#00897B] dark:hover:border-[#00897B] transition-colors"
          >
            <h2 className="text-lg font-semibold text-[#00695C] dark:text-teal-200 flex items-center gap-2">
              <span>💊</span> RxIntegrity
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              {rxSummary.critical_violations} violations detected · {rxSummary.specialty_mismatches} specialty | {rxSummary.dea_violations} DEA · Trust: {rxSummary.rx_trust_score}/100 {rxSummary.rx_trust_level === "UNTRUSTED" ? "🔴" : rxSummary.rx_trust_level === "AT_RISK" ? "🟠" : "🟢"}
            </p>
            <span className="inline-block mt-3 text-[#00897B] dark:text-teal-400 font-medium text-sm">
              View RxIntegrity →
            </span>
          </Link>
        )}
      </div>

      <Link
        to="/upload"
        className="block rounded-xl border-2 border-primary/30 dark:border-primary-light/50 bg-primary/5 dark:bg-primary/10 p-6 hover:border-primary dark:hover:border-primary-light transition-colors"
      >
        <h2 className="text-lg font-semibold text-primary dark:text-primary-light">
          Analyze your own data
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
          Upload your CSV files and get instant DQ scores and compliance gap report.
        </p>
        <span className="inline-block mt-3 text-primary dark:text-primary-light font-medium text-sm">
          Upload now →
        </span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Traffic Light by Dataset</h2>
          <div className="space-y-3">
            {(dashboard.traffic_light_by_dataset || []).map((d) => (
              <button
                key={d.dataset}
                type="button"
                onClick={() => navigate(`/profiler?dataset=${datasetNavTarget(d.dataset)}`)}
                className="w-full text-left flex items-center justify-between gap-4 p-2 rounded-lg cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 dark:hover:ring-offset-slate-800"
              >
                <span className="font-mono text-sm">{formatDatasetName(d.dataset)}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full",
                      d.status === "green" && "bg-green-500",
                      d.status === "amber" && "bg-amber-500",
                      d.status === "red" && "bg-red-500"
                    )}
                  />
                  <span className="text-sm font-medium">{d.score}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Dataset Quality Scores</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dashboard.dataset_scores || []} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
              <YAxis type="category" dataKey="dataset" width={120} tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#475569" }} tickFormatter={(v) => formatDatasetName(String(v))} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <Bar dataKey="score" fill="#f97316" name="Score" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Regulation Coverage (Radar)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="regulation" tick={{ fontSize: 10, fill: isDark ? "#94a3b8" : "#475569" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            <Radar name="Compliance %" dataKey="score" stroke="#1e3a5f" fill="#1e3a5f" fillOpacity={0.5} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-200">Commercial Intelligence Available</h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
              $59,110 at-risk revenue · $3.88M GPO exposure · 18 alerts requiring action
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/commercial")}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            View Commercial Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}

const KpiCard = memo(function KpiCard({
  title,
  subtitle,
  value,
  suffix = "",
  accent,
  danger,
  onClick,
  tooltipContent,
}: {
  title: string;
  subtitle?: string;
  value: number;
  suffix?: string;
  accent?: boolean;
  danger?: boolean;
  onClick?: () => void;
  tooltipContent?: TooltipContent;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-xl border p-6 text-left w-full",
        accent && "border-accent bg-accent/5 dark:bg-accent/10",
        danger && "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20",
        !accent && !danger && "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800",
        onClick && "cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500 transition-all duration-200"
      )}
    >
      {tooltipContent ? (
        <span className="absolute right-2 top-2">
          <InfoTooltip content={tooltipContent} />
        </span>
      ) : null}
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      <p className={cn("text-2xl font-bold mt-1", accent && "text-accent", danger && "text-rose-600 dark:text-rose-300", !accent && !danger && scoreTextClass(value))}>
        {value}
        {suffix}
      </p>
    </button>
  );
});
