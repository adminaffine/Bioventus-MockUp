export type ResolutionTrendRow = {
  kpi: string;
  trend: string;
  status: string;
  direction?: string;
};

export type ResolutionTrendChartPoint = {
  kpi: string;
  value: number;
  trend: string;
  status: string;
};

export function resolutionTrendStatusColor(status: string): string {
  if (status === "Improving") return "#16a34a";
  if (status === "Needs Attention") return "#ea580c";
  return "#dc2626";
}

export function parseResolutionTrendPercent(trend: string): number {
  const match = trend.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : 0;
}

/** Human-readable subtitle when API trend is only a bare % (e.g. "68%"). */
export function formatResolutionTrendSubtitle(row: ResolutionTrendRow): string {
  const t = row.trend.trim();
  if (!t) return "";
  if (/vs\s+last|period|quarter|month|target|rate|score|exposure|readiness|closure|resolved/i.test(t)) {
    return t;
  }

  const pctOnly = t.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pctOnly) {
    const n = pctOnly[1];
    const kpi = row.kpi.toLowerCase();
    if (kpi.includes("capa")) return `${n}% on-time closure rate vs target`;
    if (kpi.includes("resolved") || kpi.includes("on time")) return `${n}% resolved on time vs target`;
    if (kpi.includes("audit")) return `${n}% audit readiness score`;
    if (kpi.includes("penalty") || kpi.includes("exposure")) return `${n}% vs last period`;
    return `${n}% current performance`;
  }

  return t;
}

function shortKpiLabel(kpi: string, maxLen = 28): string {
  if (kpi.length <= maxLen) return kpi;
  return `${kpi.slice(0, maxLen - 1)}…`;
}

/** Numeric score (0–100) from trend text and status for charting. */
export function resolutionTrendScore(row: ResolutionTrendRow): number {
  const pct = parseResolutionTrendPercent(row.trend);
  if (pct >= 40 && !/down|up/i.test(row.trend)) return pct;
  if (row.status === "Improving") return Math.max(pct, 76);
  if (row.status === "Needs Attention") return Math.max(pct, 58);
  return Math.max(pct, 44);
}

/** One point per KPI — simple line across resolution trend metrics. */
export function buildResolutionTrendSimpleLine(rows: ResolutionTrendRow[]): ResolutionTrendChartPoint[] {
  return rows.map((row) => ({
    kpi: shortKpiLabel(row.kpi),
    value: resolutionTrendScore(row),
    trend: row.trend,
    status: row.status,
  }));
}

/** @deprecated Use buildResolutionTrendSimpleLine — kept for type compatibility if imported elsewhere */
export type ResolutionTrendLinePoint = ResolutionTrendChartPoint & { month?: string };
export type ResolutionTrendLineSeries = {
  dataKey: string;
  name: string;
  color: string;
  status: string;
};
