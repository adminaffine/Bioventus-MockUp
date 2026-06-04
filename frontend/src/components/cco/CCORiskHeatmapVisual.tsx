import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartBarClickHint from "../shared/ChartBarClickHint";
import {
  EXEC_HEATMAP_HINT_HEIGHT,
  EXEC_HEATMAP_LEGEND_HEIGHT,
  EXEC_HEATMAP_SECTION_GAP,
  EXEC_SIDE_PANEL_CONTENT_HEIGHT,
  execHeatmapPlotHeight,
} from "../../config/executiveDashboardLayout";
import {
  CCO_HEATMAP_TOP_N,
  ccoHeatmapIssueTypeShortName,
  ccoHeatmapSeverityHex,
  type CCORiskHeatmapRow,
} from "../../utils/ccoDashboard";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function shortLabel(label: string, maxLen = 32): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
}

type ChartRow = CCORiskHeatmapRow & {
  chartLabel: string;
  fill: string;
};

function HeatmapBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs shadow-lg max-w-xs">
      <p className="font-semibold text-slate-900 dark:text-slate-100">{row.accountName}</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">{row.issueType}</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        Penalty Exposure: {money(row.penaltyExposure)}
      </p>
    </div>
  );
}

type Props = {
  rows: CCORiskHeatmapRow[];
  slotHeight?: number;
  chartHeight?: number;
  onSelect?: (row: CCORiskHeatmapRow) => void;
  showClickHint?: boolean;
};

export default function CCORiskHeatmapVisual({
  rows,
  slotHeight = EXEC_SIDE_PANEL_CONTENT_HEIGHT,
  chartHeight,
  onSelect,
  showClickHint = true,
}: Props) {
  const chartData = useMemo((): ChartRow[] => {
    return rows.map((row) => {
      const shortType =
        row.shortIssueType?.trim() ||
        ccoHeatmapIssueTypeShortName(row.issueType);
      return {
        ...row,
        shortIssueType: shortType,
        chartLabel: shortLabel(shortType, 36),
        fill: ccoHeatmapSeverityHex(row.severity),
      };
    });
  }, [rows]);

  const hintH = showClickHint && onSelect ? EXEC_HEATMAP_HINT_HEIGHT : 0;
  const plotHeight = chartHeight ?? execHeatmapPlotHeight(slotHeight);
  const maxBarSize = Math.max(6, Math.round((plotHeight / Math.max(chartData.length, 1)) * 0.22));

  if (chartData.length === 0) {
    return (
      <p
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 w-full"
        style={{ height: slotHeight, minHeight: slotHeight }}
      >
        No open records to display.
      </p>
    );
  }

  return (
    <div
      className="flex flex-col h-full min-h-0 w-full"
      style={{ height: slotHeight, minHeight: slotHeight, gap: EXEC_HEATMAP_SECTION_GAP }}
    >
      <div
        className="shrink-0 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400 items-center"
        style={{ minHeight: EXEC_HEATMAP_LEGEND_HEIGHT }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500" aria-hidden />
          Critical
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500" aria-hidden />
          Caution
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500" aria-hidden />
          Healthy
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          Top {CCO_HEATMAP_TOP_N} · bar length = penalty exposure
        </span>
      </div>

      <div className="w-full flex-1 min-h-0 shrink-0" style={{ height: plotHeight, minHeight: plotHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 8, right: 56, left: 4, bottom: 8 }}
            barCategoryGap="28%"
            onClick={(state) => {
              if (!onSelect || !state?.activePayload?.[0]?.payload) return;
              const row = state.activePayload[0].payload as ChartRow;
              onSelect(row);
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              className="stroke-slate-200 dark:stroke-slate-600"
              strokeWidth={0.5}
            />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              type="category"
              dataKey="chartLabel"
              width={148}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <Tooltip content={<HeatmapBarTooltip />} cursor={{ fill: "rgba(99, 102, 241, 0.08)" }} />
            <Bar
              dataKey="penaltyExposure"
              name="Penalty Exposure"
              maxBarSize={maxBarSize}
              radius={[0, 4, 4, 0]}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              {chartData.map((entry) => (
                <Cell key={entry.issueId} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="penaltyExposure"
                position="right"
                formatter={(v: number) => money(v)}
                style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {showClickHint && onSelect ? (
        <div className="shrink-0 flex items-center justify-center" style={{ minHeight: hintH || EXEC_HEATMAP_HINT_HEIGHT }}>
          <ChartBarClickHint />
        </div>
      ) : null}
    </div>
  );
}
