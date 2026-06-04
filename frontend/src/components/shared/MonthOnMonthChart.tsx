import type { CCOMonthOnMonthRow, CFOKpiPeriodRow } from "../../services/api";
import ExecutiveGroupedBarChart, { type GroupedBarPoint } from "./ExecutiveGroupedBarChart";
import type { MonthOnMonthPoint, MonthOnMonthSeriesConfig } from "./MonthOnMonthChart.types";

export type { MonthOnMonthPoint, MonthOnMonthSeriesConfig } from "./MonthOnMonthChart.types";

type MoMRow = CFOKpiPeriodRow | CCOMonthOnMonthRow | MonthOnMonthPoint;

type Props = {
  data: MoMRow[];
  series: MonthOnMonthSeriesConfig[];
  chartHeight?: number;
};

function normalizeMoMData(rows: MoMRow[]): GroupedBarPoint[] {
  return rows.map((row) => {
    const month = row.month ?? (row as { period?: string }).period ?? "";
    return { ...row, month: String(month) } as GroupedBarPoint;
  });
}

/** Shared month-on-month chart: grouped bars, legend, tooltips, dual Y-axis when $ / counts are mixed. */
export default function MonthOnMonthChart({ data, series, chartHeight = 320 }: Props) {
  const points = normalizeMoMData(data);
  const barSeries = series.map((s) => ({
    dataKey: s.dataKey,
    name: s.name,
    color: s.color,
    format: s.format,
    yAxisId: s.yAxisId,
  }));

  return <ExecutiveGroupedBarChart data={points} series={barSeries} chartHeight={chartHeight} />;
}
