import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import {
  executiveYAxisTick,
  formatExecutiveValue,
  monthOverMonthDelta,
  type ExecutiveChartFormat,
} from "../../utils/executiveChartFormat";

export type GroupedBarPoint = {
  month: string;
  [key: string]: string | number;
};

export type GroupedBarSeries = {
  dataKey: string;
  name: string;
  color: string;
  format?: ExecutiveChartFormat;
  yAxisId?: "left" | "right";
};

function useChartTheme() {
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return {
    tick: isDark ? "#94a3b8" : "#64748b",
    grid: isDark ? "#334155" : "#e2e8f0",
    axis: isDark ? "#cbd5e1" : "#94a3b8",
    tooltipBg: isDark ? "#0f172a" : "#ffffff",
    tooltipBorder: isDark ? "#334155" : "#e2e8f0",
  };
}

const TOOLTIP_WIDTH_PX = 232;

type BarTooltipProps = TooltipProps<number, string> & {
  series: GroupedBarSeries[];
  data: GroupedBarPoint[];
};

/** Keep tooltip fully visible when hovering rightmost months (e.g. May). */
function monthOnMonthTooltipPosition(
  coordinate: { x?: number; y?: number } | undefined,
  viewBox: { width?: number; height?: number } | undefined,
): { x: number; y: number } {
  const cx = coordinate?.x ?? 0;
  const cy = coordinate?.y ?? 0;
  const plotWidth = viewBox?.width ?? 400;
  const gap = 12;
  let x = cx + gap;
  if (x + TOOLTIP_WIDTH_PX > plotWidth - 4) {
    x = Math.max(4, cx - TOOLTIP_WIDTH_PX - gap);
  }
  return { x, y: Math.max(4, cy - 8) };
}

function BarTooltip({ active, payload, label, series, data }: BarTooltipProps) {
  const theme = useChartTheme();
  if (!active || !payload?.length || !label) return null;

  const metaByKey = Object.fromEntries(series.map((s) => [s.dataKey, s]));
  const monthIndex = data.findIndex((d) => d.month === label);
  const prior = monthIndex > 0 ? data[monthIndex - 1] : undefined;

  const ordered = series
    .map((s) => payload.find((p) => p.dataKey === s.dataKey))
    .filter((p): p is NonNullable<typeof p> => p != null && p.value != null);

  return (
    <div
      className="rounded-lg border shadow-lg text-left pointer-events-none"
      style={{
        width: TOOLTIP_WIDTH_PX,
        maxWidth: "min(100vw - 2rem, 232px)",
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
      }}
    >
      <div
        className="px-3 py-2 border-b text-xs font-semibold text-slate-900 dark:text-slate-100 text-center"
        style={{ borderColor: theme.tooltipBorder }}
      >
        {label}
      </div>
      <ul className="px-3 py-2.5 space-y-2.5">
        {ordered.map((entry) => {
          const meta = metaByKey[String(entry.dataKey)];
          const fmt = meta?.format ?? "money";
          const value = Number(entry.value);
          const prevVal = prior ? Number(prior[String(entry.dataKey)] ?? 0) : undefined;
          const delta = monthOverMonthDelta(value, prevVal);
          const color = entry.color ?? meta?.color ?? "#64748b";
          const seriesName = entry.name ?? meta?.name ?? "";
          return (
            <li key={String(entry.dataKey)} className="text-xs">
              <div className="flex items-start gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 dark:text-slate-200 leading-snug break-words">
                    {seriesName}
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatExecutiveValue(value, fmt)}
                  </p>
                  {delta ? (
                    <p className="mt-0.5 text-[11px] leading-snug text-indigo-600 dark:text-indigo-400 break-words">
                      {delta}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function computeDomain(data: GroupedBarPoint[], keys: string[], padding = 1.12): [number, number] {
  let max = 0;
  for (const row of data) {
    for (const key of keys) {
      const v = Number(row[key] ?? 0);
      if (v > max) max = v;
    }
  }
  if (max === 0) return [0, 1];
  return [0, Math.ceil(max * padding)];
}

type Props = {
  data: GroupedBarPoint[];
  series: GroupedBarSeries[];
  chartHeight?: number;
};

export default function ExecutiveGroupedBarChart({ data, series, chartHeight = 320 }: Props) {
  const theme = useChartTheme();

  const leftSeries = series.filter((s) => s.yAxisId !== "right");
  const rightSeries = series.filter((s) => s.yAxisId === "right");
  const hasRight = rightSeries.length > 0;

  const leftDomain = useMemo(
    () => computeDomain(data, leftSeries.map((s) => s.dataKey)),
    [data, leftSeries],
  );
  const rightDomain = useMemo(
    () => computeDomain(data, rightSeries.map((s) => s.dataKey), 1.15),
    [data, rightSeries],
  );

  const leftFormat = leftSeries[0]?.format ?? "money";
  const rightFormat = rightSeries[0]?.format ?? "number";

  const tooltipContent = useMemo(
    () =>
      function MomTooltip(props: TooltipProps<number, string>) {
        return <BarTooltip {...props} series={series} data={data} />;
      },
    [series, data],
  );

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

  const tooltipPosition = useMemo(
    () =>
      (props: { coordinate?: { x?: number; y?: number }; viewBox?: { width?: number; height?: number } }) =>
        monthOnMonthTooltipPosition(props.coordinate, props.viewBox),
    [],
  );

  return (
    <div className="w-full overflow-visible" style={{ height: chartHeight, minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: hasRight ? 28 : 32, left: 8, bottom: 4 }}
          barCategoryGap="18%"
          barGap={4}
        >
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: theme.tick, fontSize: 12, fontWeight: 500 }}
            axisLine={{ stroke: theme.axis }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            domain={leftDomain}
            tick={{ fill: theme.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v) => executiveYAxisTick(Number(v), leftFormat)}
          />
          {hasRight ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={rightDomain}
              tick={{ fill: theme.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              allowDecimals={false}
              tickFormatter={(v) => executiveYAxisTick(Number(v), rightFormat)}
            />
          ) : null}
          <Tooltip
            content={tooltipContent}
            position={tooltipPosition}
            cursor={{ fill: "rgba(148,163,184,0.12)" }}
            offset={0}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 50, outline: "none", pointerEvents: "none" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span className="text-slate-700 dark:text-slate-200">{value}</span>}
          />
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              yAxisId={s.yAxisId ?? "left"}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
