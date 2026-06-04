import type { ReactNode } from "react";
import { X } from "lucide-react";

export interface KpiDrilldownModalProps {
  title: string;
  subtitle?: string;
  valueDisplay?: ReactNode;
  valueToneClassName?: string;
  recordCount: number;
  onClose: () => void;
  emptyHint?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function KpiDrilldownModal({
  title,
  subtitle,
  valueDisplay,
  valueToneClassName = "text-indigo-700 dark:text-indigo-300",
  recordCount,
  onClose,
  emptyHint = "No matching records.",
  children,
  footer,
}: KpiDrilldownModalProps) {
  const hasRows = recordCount > 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpi-drilldown-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="kpi-drilldown-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {valueDisplay ? (
          <p className={`mt-3 text-lg font-semibold shrink-0 ${valueToneClassName}`}>
            {valueDisplay}
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              · {recordCount} record{recordCount === 1 ? "" : "s"}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 shrink-0">
            {recordCount} record{recordCount === 1 ? "" : "s"}
          </p>
        )}

        <div className="mt-4 overflow-y-auto flex-1 min-h-0">
          {!hasRows ? <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{emptyHint}</p> : children}
        </div>

        {footer ? <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 shrink-0">{footer}</div> : null}
      </div>
    </div>
  );
}
