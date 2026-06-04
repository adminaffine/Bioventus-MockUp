import ExecutiveGaugePanel from "../shared/ExecutiveGaugePanel";
import { EXEC_SIDE_PANEL_CONTENT_HEIGHT } from "../../config/executiveDashboardLayout";
import { buildResolutionTrendGauges } from "../../utils/executiveGaugeData";
import type { ResolutionTrendRow } from "../../utils/resolutionTrendChart";

type Props = {
  rows: ResolutionTrendRow[];
  chartHeight?: number;
};

export default function CCOResolutionTrendChart({
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
