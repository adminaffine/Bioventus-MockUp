export function parsePersonaDollar(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** KPI drill-down tables: highest dollar exposure first. */
export function sortByDollarDesc<T>(rows: T[], pickDollar: (row: T) => unknown): T[] {
  return [...rows].sort((a, b) => parsePersonaDollar(pickDollar(b)) - parsePersonaDollar(pickDollar(a)));
}
