import SemiCircularGauge from "./SemiCircularGauge";
import { EXEC_SIDE_PANEL_CONTENT_HEIGHT } from "../../config/executiveDashboardLayout";
import { resolutionTrendStatusColor } from "../../utils/resolutionTrendChart";

export type ExecutiveGaugeItem = {
  id: string;
  label: string;
  /** 0–100 fill for the gauge arc */
  percent: number;
  displayValue: string;
  subtitle?: string;
  status?: string;
  color?: string;
};

type Props = {
  items: ExecutiveGaugeItem[];
  chartHeight?: number;
  footnote?: string;
};

function statusColor(status?: string): string {
  if (!status) return "#2563eb";
  return resolutionTrendStatusColor(status);
}

export default function ExecutiveGaugePanel({
  items,
  chartHeight = EXEC_SIDE_PANEL_CONTENT_HEIGHT,
  footnote,
}: Props) {
  if (!items.length) {
    return (
      <p
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
        style={{ height: chartHeight }}
      >
        No gauge data available.
      </p>
    );
  }

  const footnoteReserve = footnote ? 28 : 0;
  const gridHeight = chartHeight - footnoteReserve;

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ height: chartHeight, minHeight: chartHeight }}
    >
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch flex-1 min-h-0"
        style={{ minHeight: gridHeight }}
      >
        {items.map((item) => {
          const stroke = item.color ?? statusColor(item.status);
          return (
            <div
              key={item.id}
              className="flex flex-col items-center h-full min-h-[200px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 px-3 py-4"
            >
              <div className="shrink-0">
                <SemiCircularGauge
                  value={item.percent}
                  max={100}
                  color={stroke}
                  size={140}
                  strokeWidth={12}
                  centerLabel={item.displayValue}
                />
              </div>
              <p className="mt-1 text-center text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug min-h-[2.5rem] flex items-center justify-center px-1">
                {item.label}
              </p>
              {item.status ? (
                <span
                  className="mt-1 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${stroke}22`,
                    color: stroke,
                  }}
                >
                  {item.status}
                </span>
              ) : (
                <span className="mt-1 shrink-0 min-h-[1.375rem]" aria-hidden />
              )}
              {item.subtitle ? (
                <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2.5rem] leading-snug px-1">
                  {item.subtitle}
                </p>
              ) : (
                <span className="mt-2 min-h-[2.5rem]" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
      {footnote ? (
        <p className="shrink-0 mt-2 text-xs text-slate-500 dark:text-slate-400 text-center leading-snug">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
