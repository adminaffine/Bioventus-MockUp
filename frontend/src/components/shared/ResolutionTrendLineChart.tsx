import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildResolutionTrendSimpleLine,
  resolutionTrendStatusColor,
  type ResolutionTrendRow,
} from "../../utils/resolutionTrendChart";
import { executiveYAxisTick } from "../../utils/executiveChartFormat";

type Props = {
  rows: ResolutionTrendRow[];
  chartHeight?: number;
};

function useChartTheme() {
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return {
    tick: isDark ? "#94a3b8" : "#64748b",
    grid: isDark ? "#e2e8f0" : "#e2e8f0",
    axis: isDark ? "#94a3b8" : "#64748b",
    tooltipBg: isDark ? "#0f172a" : "#ffffff",
    tooltipBorder: isDark ? "#e2e8f0" : "#e2e8f0",
    dotFill: isDark ? "#0f172a" : "#ffffff",
  };
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { kpi: string; value: number; trend: string; status: string } }>;
}) {
  const theme = useChartTheme();
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const color = resolutionTrendStatusColor(row.status);

  return (
    <div
      className="rounded-lg border shadow-md min-w-[180px]"
      style={{ backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder }}
    >
      <p className="px-3 py-2 border-b text-xs font-semibold text-slate-900 dark:text-slate-100" style={{ borderColor: theme.tooltipBorder }}>
        {row.kpi}
      </p>
      <div className="px-3 py-2 text-xs space-y-1">
        <p>
          <span className="text-slate-500 dark:text-slate-400">Index: </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.value}%</span>
        </p>
        <p className="text-slate-600 dark:text-slate-300">{row.trend}</p>
        <span
          className="inline-block mt-1 px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {row.status}
        </span>
      </div>
    </div>
  );
}

/** Simple line chart — one point per resolution-trend KPI (not a time series). */
export default function ResolutionTrendLineChart({ rows, chartHeight = 320 }: Props) {
  const theme = useChartTheme();
  const data = buildResolutionTrendSimpleLine(rows);

  if (!data.length) {
    return (
      <p
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
        style={{ height: chartHeight }}
      >
        No resolution trend data available.
      </p>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg" style={{ height: chartHeight, minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 48 }}>
          <CartesianGrid stroke={theme.grid} horizontal vertical={false} />
          <XAxis
            dataKey="kpi"
            tick={{ fill: theme.tick, fontSize: 11, fontWeight: 500 }}
            axisLine={{ stroke: theme.axis }}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={56}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: theme.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => executiveYAxisTick(Number(v), "percent")}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name="Performance index"
            stroke="#2563eb"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, index } = props;
              if (cx == null || cy == null || index == null) return <g />;
              const point = data[index];
              const fill = resolutionTrendStatusColor(point.status);
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  stroke={fill}
                  strokeWidth={2}
                  fill={theme.dotFill}
                />
              );
            }}
            activeDot={{ r: 7, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
