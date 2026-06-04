/** High-contrast palette for multi-series charts (readable on light and dark UI). */
export const CHART_SERIES_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // violet
  "#ea580c", // orange
  "#0891b2", // cyan
  "#db2777", // pink
  "#ca8a04", // amber
  "#4f46e5", // indigo
  "#0d9488", // teal
] as const;

export function chartSeriesColor(index: number): string {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}
