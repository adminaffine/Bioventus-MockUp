/** Shared chart panel layout for CFO / CCO executive dashboards. */

export const EXEC_CHART_PANEL_HEADER =
  "shrink-0 min-h-[5rem] flex flex-col justify-start";

export const EXEC_CHART_PANEL_BODY = "mt-4 flex flex-1 flex-col min-h-0";

/** Fixed height for side-by-side Resolution Trend + Risk Heatmap content. */
export const EXEC_SIDE_PANEL_CONTENT_HEIGHT = 392;

/** Bar plot area inside heatmap (legend + plot + click hint). */
export const EXEC_HEATMAP_LEGEND_HEIGHT = 40;
export const EXEC_HEATMAP_HINT_HEIGHT = 20;
export const EXEC_HEATMAP_SECTION_GAP = 12;

export function execHeatmapPlotHeight(
  slotHeight: number = EXEC_SIDE_PANEL_CONTENT_HEIGHT,
): number {
  return (
    slotHeight -
    EXEC_HEATMAP_LEGEND_HEIGHT -
    EXEC_HEATMAP_HINT_HEIGHT -
    EXEC_HEATMAP_SECTION_GAP * 2
  );
}

export const EXEC_MONTH_ON_MONTH_CHART_HEIGHT = 320;
