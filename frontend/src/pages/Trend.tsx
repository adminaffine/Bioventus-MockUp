import { useEffect, useState } from "react";
import { api } from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_TREND_BASELINE, TOOLTIP_TREND_PER_CAPA, TOOLTIP_TREND_PROJECTION, TOOLTIP_TREND_TARGET } from "../lib/tooltipContent";

export default function Trend() {
  const isDark = document.documentElement.classList.contains("dark");
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getTrendSimulation>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTrendSimulation().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-72 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return <div>Failed to load trend simulation.</div>;

  const chartData = (data.timeline || []).map((t) => ({
    week: t.week === 0 ? "Week 1 (Current)" : t.week === 4 ? "Week 5 (Post-CAPA)" : `Week ${t.week + 1}`,
    quality: t.quality_score,
    compliance: t.compliance_score,
    issues: t.issues_remaining,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-primary dark:text-primary-light">
        Data Quality Trend Simulation
      </h1>
      <p className="text-slate-600 dark:text-slate-400">
        Before AI remediation vs after AI remediation (4-week projection).
      </p>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 border-l-4 border-l-indigo-500">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">CAPA Resolution Impact Simulation</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          This simulation models the data quality improvement trajectory if BV resolves the open CAPA items identified across patient support, product catalog, and sales orders. The projected score improvement from {data.current_quality_score}% to {data.projected_quality_score}% reflects MDR gap closure, product classification completion, and consent documentation remediation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">Current quality score <InfoTooltip content={TOOLTIP_TREND_BASELINE} /></p>
          <p className="text-2xl font-bold">{data.current_quality_score}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">Projected quality score <InfoTooltip content={TOOLTIP_TREND_TARGET} /></p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.projected_quality_score}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">Estimated records fixed <InfoTooltip content={TOOLTIP_TREND_PER_CAPA} /></p>
          <p className="text-2xl font-bold text-accent">{data.estimated_records_fixed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">Compliance risk reduced</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.compliance_risk_reduction_pct}%</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Quality & Compliance Over 4 Weeks <InfoTooltip content={TOOLTIP_TREND_PROJECTION} /></h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
            <XAxis dataKey="week" tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
            <YAxis domain={[0, 100]} tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#f1f5f9" : "#0f172a" }} />
            <Legend />
            <Line type="monotone" dataKey="quality" stroke="#f97316" strokeWidth={2} name="Quality Score %" />
            <Line type="monotone" dataKey="compliance" stroke="#1e3a5f" strokeWidth={2} name="Compliance Score %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
        <h2 className="font-semibold text-amber-800 dark:text-amber-200">ROI Summary</h2>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          Estimated records fixed: <strong>{data.estimated_records_fixed}</strong>. Compliance risk reduced by{" "}
          <strong>{data.compliance_risk_reduction_pct}%</strong>. Integration gaps currently:{" "}
          <strong>{data.integration_gaps_current}</strong> — address orphaned records for full lineage integrity.
        </p>
      </div>
    </div>
  );
}
