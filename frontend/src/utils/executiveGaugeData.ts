import {
  formatResolutionTrendSubtitle,
  resolutionTrendScore,
  resolutionTrendStatusColor,
  type ResolutionTrendRow,
} from "./resolutionTrendChart";
import type { ExecutiveGaugeItem } from "../components/shared/ExecutiveGaugePanel";

/** One semi-circular gauge per resolution-trend KPI. */
export function buildResolutionTrendGauges(rows: ResolutionTrendRow[]): ExecutiveGaugeItem[] {
  return rows.map((row) => {
    const score = resolutionTrendScore(row);
    return {
      id: row.kpi,
      label: row.kpi,
      percent: score,
      displayValue: `${score}%`,
      subtitle: formatResolutionTrendSubtitle(row),
      status: row.status,
      color: resolutionTrendStatusColor(row.status),
    };
  });
}
