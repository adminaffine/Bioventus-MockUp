export type ExecutiveChartFormat = "money" | "number" | "percent";

export function formatExecutiveValue(value: number, format: ExecutiveChartFormat = "money"): string {
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "number") return Math.round(value).toLocaleString("en-US");
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000).toLocaleString("en-US")}k`;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function executiveYAxisTick(value: number, format: ExecutiveChartFormat): string {
  if (format === "percent") return `${value}%`;
  if (format === "number") return String(Math.round(value));
  const n = Number(value);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

export function monthOverMonthDelta(current: number, previous: number | undefined): string | null {
  if (previous === undefined || previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}% vs prior month`;
}
