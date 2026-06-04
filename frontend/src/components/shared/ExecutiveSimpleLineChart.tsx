import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

export type SimpleLinePoint = {
  month: string;
  [key: string]: string | number;
};

export type SimpleLineSeries = {
  dataKey: string;
  name: string;
  color: string;
  format?: ExecutiveChartFormat;
};

function useChartTheme() {
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return {
    isDark,
    tick: isDark ? "#94a3b8" : "#64748b",
    grid: isDark ? "#e2e8f0" : "#e2e8f0",
    axis: isDark ? "#94a3b8" : "#64748b",
    tooltipBg: isDark ? "#0f172a" : "#ffffff",
    tooltipBorder: isDark ? "#e2e8f0" : "#e2e8f0",
    dotFill: isDark ? "#0f172a" : "#ffffff",
  };
}

function LineTooltip({
  active,
  payload,
  label,
  series,
  data,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
  series: SimpleLineSeries[];
  data: SimpleLinePoint[];
}) {
  const theme = useChartTheme();
  if (!active || !payload?.length || !label) return null;

  const metaByKey = Object.fromEntries(series.map((s) => [s.dataKey, s]));
  const monthIndex = data.findIndex((d) => d.month === label);
  const prior = monthIndex > 0 ? data[monthIndex - 1] : undefined;

  return (
    <div
      className="rounded-lg border shadow-md min-w-[180px]"
      style={{ backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder }}
    >
      <p className="px-3 py-2 border-b text-xs font-semibold text-slate-900 dark:text-slate-100" style={{ borderColor: theme.tooltipBorder }}>
        {label}
      </p>
      <ul className="px-3 py-2 space-y-1.5">
        {payload.map((entry) => {
          const meta = metaByKey[entry.dataKey];
          const fmt = meta?.format ?? "percent";
          const prevVal = prior ? Number(prior[entry.dataKey] ?? 0) : undefined;
          const delta = monthOverMonthDelta(entry.value, prevVal);
          return (
            <li key={entry.dataKey} className="text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="ml-3 font-semibold text-slate-900 dark:text-slate-100">
                {formatExecutiveValue(entry.value, fmt)}
              </span>
              {delta ? <p className="text-indigo-600 dark:text-indigo-400">{delta}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Props = {
  data: SimpleLinePoint[];
  series: SimpleLineSeries[];
  chartHeight?: number;
  yDomain?: [number, number];
  /** Rotate month labels vertically (reference chart style). */
  verticalXLabels?: boolean;
};

export default function ExecutiveSimpleLineChart({
  data,
  series,
  chartHeight = 320,
  yDomain = [0, 100],
  verticalXLabels = false,
}: Props) {
  const theme = useChartTheme();
  const format = series[0]?.format ?? "percent";

  const xAxisHeight = verticalXLabels ? 56 : 28;

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
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg" style={{ height: chartHeight, minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: verticalXLabels ? 8 : 4 }}>
          <CartesianGrid stroke={theme.grid} horizontal vertical={false} />
          <XAxis
            dataKey="month"
            tick={{
              fill: theme.tick,
              fontSize: 11,
              fontWeight: 500,
            }}
            axisLine={{ stroke: theme.axis }}
            tickLine={false}
            angle={verticalXLabels ? -90 : 0}
            textAnchor={verticalXLabels ? "end" : "middle"}
            height={xAxisHeight}
            interval={0}
            dy={verticalXLabels ? 4 : 8}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: theme.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => executiveYAxisTick(Number(v), format)}
          />
          <Tooltip content={<LineTooltip series={series} data={data} />} />
          <Legend
            verticalAlign="top"
            align="center"
            wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
            formatter={(value) => <span className="text-slate-700 dark:text-slate-200">{value}</span>}
          />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{
                r: 5,
                strokeWidth: 2,
                stroke: s.color,
                fill: theme.dotFill,
              }}
              activeDot={{ r: 7, strokeWidth: 2, stroke: s.color, fill: s.color }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
