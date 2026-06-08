import ExecutiveGaugePanel from "../shared/ExecutiveGaugePanel";
import { EXEC_SIDE_PANEL_CONTENT_HEIGHT } from "../../config/executiveDashboardLayout";
import type { CCODashboard } from "../../services/api";
import { buildCcoResolutionTrendGauges } from "../../utils/ccoDashboard";

type Props = {
  kpiCards: CCODashboard["kpi_cards"];
  chartHeight?: number;
};

export default function CCOResolutionTrendChart({
  kpiCards,
  chartHeight = EXEC_SIDE_PANEL_CONTENT_HEIGHT,
}: Props) {
  return (
    <ExecutiveGaugePanel
      items={buildCcoResolutionTrendGauges(kpiCards)}
      chartHeight={chartHeight}
    />
  );
}
