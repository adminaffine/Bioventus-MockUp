import { useId, useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  executiveYAxisTick,
  formatExecutiveValue,
  monthOverMonthDelta,
  type ExecutiveChartFormat,
} from "../../utils/executiveChartFormat";

export type ExecutiveLineSeries = {
  dataKey: string;
  name: string;
  color: string;
  format?: ExecutiveChartFormat;
  yAxisId?: "left" | "right";
  status?: string;
};

export type ExecutiveLinePoint = {
  month: string;
  [key: string]: string | number;
};

function useChartTheme() {
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return {
    isDark,
    tick: isDark ? "#94a3b8" : "#64748b",
    grid: isDark ? "#334155" : "#e2e8f0",
    axis: isDark ? "#475569" : "#cbd5e1",
    tooltipBg: isDark ? "#0f172a" : "#ffffff",
    tooltipBorder: isDark ? "#334155" : "#e2e8f0",
    surface: isDark ? "#1e293b" : "#f8fafc",
  };
}

function ExecutiveTooltip({
  active,
  payload,
  label,
  series,
  data,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
  series: ExecutiveLineSeries[];
  data: ExecutiveLinePoint[];
}) {
  const theme = useChartTheme();
  if (!active || !payload?.length || !label) return null;

  const metaByKey = Object.fromEntries(series.map((s) => [s.dataKey, s]));
  const monthIndex = data.findIndex((d) => d.month === label);
  const prior = monthIndex > 0 ? data[monthIndex - 1] : undefined;

  return (
    <div
      className="rounded-xl border shadow-xl min-w-[200px] overflow-hidden"
      style={{
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
      }}
    >
      <div className="px-3 py-2 border-b text-xs font-semibold" style={{ borderColor: theme.tooltipBorder }}>
        <span className="text-slate-900 dark:text-slate-100">{label}</span>
      </div>
      <ul className="px-3 py-2 space-y-2">
        {payload.map((entry) => {
          const meta = metaByKey[entry.dataKey];
          const fmt = meta?.format ?? "money";
          const prevVal = prior ? Number(prior[entry.dataKey] ?? 0) : undefined;
          const delta = monthOverMonthDelta(entry.value, prevVal);
          return (
            <li key={entry.dataKey} className="text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-900"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium text-slate-700 dark:text-slate-200">{entry.name}</span>
              </div>
              <p className="mt-0.5 pl-4 font-semibold text-slate-900 dark:text-slate-100">
                {formatExecutiveValue(entry.value, fmt)}
              </p>
              {meta?.status ? (
                <p className="pl-4 text-slate-500 dark:text-slate-400">{meta.status}</p>
              ) : null}
              {delta ? <p className="pl-4 text-indigo-600 dark:text-indigo-400">{delta}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function computeDomain(
  data: ExecutiveLinePoint[],
  seriesKeys: string[],
  padding = 1.1,
): [number, number] {
  let max = 0;
  let min = Infinity;
  for (const row of data) {
    for (const key of seriesKeys) {
      const v = Number(row[key] ?? 0);
      if (v > max) max = v;
      if (v < min) min = v;
    }
  }
  if (!Number.isFinite(min)) min = 0;
  if (max === 0) return [0, 1];
  const floor = min > 0 && min / max > 0.5 ? Math.floor(min * 0.92) : 0;
  return [floor, Math.ceil(max * padding)];
}

type Props = {
  data: ExecutiveLinePoint[];
  series: ExecutiveLineSeries[];
  chartHeight?: number;
  /** Fixed Y domain for left axis (e.g. 0–100 for performance index). */
  leftDomain?: [number, number];
  showArea?: boolean;
  animationDuration?: number;
};

export default function ExecutiveMultiLineChart({
  data,
  series,
  chartHeight = 320,
  leftDomain: leftDomainFixed,
  showArea = true,
  animationDuration = 800,
}: Props) {
  const chartId = useId().replace(/:/g, "");
  const theme = useChartTheme();

  const leftSeries = series.filter((s) => s.yAxisId !== "right");
  const rightSeries = series.filter((s) => s.yAxisId === "right");
  const hasRight = rightSeries.length > 0;

  const leftDomain = useMemo(
    () => leftDomainFixed ?? computeDomain(data, leftSeries.map((s) => s.dataKey)),
    [data, leftSeries, leftDomainFixed],
  );

  const rightDomain = useMemo(
    () => computeDomain(data, rightSeries.map((s) => s.dataKey), 1.2),
    [data, rightSeries],
  );

  const primaryFormat = leftSeries[0]?.format ?? (hasRight ? "money" : "percent");

  if (!data.length || !series.length) {
    return (
      <p
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
        style={{ height: chartHeight }}
      >
        No chart data available.
      </p>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="shrink-0 flex flex-wrap gap-2">
        {series.map((s) => (
          <span
            key={s.dataKey}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color, boxShadow: `0 0 0 2px ${s.color}33` }}
            />
            {s.name}
          </span>
        ))}
      </div>

      <div
        className="w-full flex-1 min-h-0 rounded-xl border border-slate-100 dark:border-slate-700/80 p-2"
        style={{ backgroundColor: theme.surface, height: chartHeight, minHeight: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: hasRight ? 8 : 16, left: 4, bottom: 8 }}
          >
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={s.dataKey}
                  id={`${chartId}-fill-${s.dataKey}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid stroke={theme.grid} strokeDasharray="4 6" vertical={false} />

            <XAxis
              dataKey="month"
              tick={{ fill: theme.tick, fontSize: 12, fontWeight: 500 }}
              axisLine={{ stroke: theme.axis }}
              tickLine={false}
              dy={6}
            />

            <YAxis
              yAxisId="left"
              domain={leftDomain}
              tick={{ fill: theme.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => executiveYAxisTick(Number(v), primaryFormat)}
            />

            {hasRight ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={rightDomain}
                tick={{ fill: theme.tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                allowDecimals={false}
                tickFormatter={(v) => executiveYAxisTick(Number(v), rightSeries[0]?.format ?? "number")}
              />
            ) : null}

            <Tooltip
              content={<ExecutiveTooltip series={series} data={data} />}
              cursor={{ stroke: theme.axis, strokeWidth: 1, strokeDasharray: "4 4" }}
            />

            {showArea
              ? series.map((s) => (
                  <Area
                    key={`area-${s.dataKey}`}
                    yAxisId={s.yAxisId ?? "left"}
                    type="monotone"
                    dataKey={s.dataKey}
                    stroke="none"
                    fill={`url(#${chartId}-fill-${s.dataKey})`}
                    animationDuration={animationDuration}
                    isAnimationActive
                  />
                ))
              : null}

            {series.map((s) => (
              <Line
                key={`line-${s.dataKey}`}
                yAxisId={s.yAxisId ?? "left"}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={2.75}
                dot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: s.color,
                  fill: theme.isDark ? "#0f172a" : "#ffffff",
                }}
                activeDot={{
                  r: 7,
                  strokeWidth: 3,
                  stroke: "#fff",
                  fill: s.color,
                }}
                animationDuration={animationDuration}
                isAnimationActive
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
