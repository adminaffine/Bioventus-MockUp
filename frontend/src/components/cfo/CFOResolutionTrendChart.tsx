import ExecutiveGaugePanel from "../shared/ExecutiveGaugePanel";
import { EXEC_SIDE_PANEL_CONTENT_HEIGHT } from "../../config/executiveDashboardLayout";
import { buildResolutionTrendGauges } from "../../utils/executiveGaugeData";
import type { CfoResolutionTrendRow } from "../../utils/cfoDashboard";

type Props = {
  rows: CfoResolutionTrendRow[];
  chartHeight?: number;
};

export default function CFOResolutionTrendChart({
  rows,
  chartHeight = EXEC_SIDE_PANEL_CONTENT_HEIGHT,
}: Props) {
  return (
    <ExecutiveGaugePanel
      items={buildResolutionTrendGauges(rows)}
      chartHeight={chartHeight}
    />
  );
}
