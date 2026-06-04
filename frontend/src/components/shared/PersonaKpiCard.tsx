import { Children, isValidElement, type ReactNode } from "react";

/** Pricing persona KPI card — shared across executive / operations dashboards. */
export const PERSONA_KPI_CARD_BUTTON_CLASS =
  "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-left hover:ring-2 hover:ring-indigo-400 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

const GRID_BY_COLUMNS = {
  4: "grid grid-cols-2 xl:grid-cols-4 gap-4",
  5: "grid grid-cols-2 xl:grid-cols-5 gap-4",
} as const;

/** One horizontal row — all cards fit the container width (Data Steward). */
const SINGLE_ROW_GRID_CLASS = "grid grid-cols-7 gap-4 w-full min-w-0";

export type PersonaKpiCardProps = {
  label: string;
  valueDisplay: string;
  description?: string;
  onClick: () => void;
  className?: string;
};

export default function PersonaKpiCard({ label, valueDisplay, description, onClick, className }: PersonaKpiCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[PERSONA_KPI_CARD_BUTTON_CLASS, className].filter(Boolean).join(" ")}
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">{valueDisplay}</p>
      {description ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{description}</p>
      ) : null}
      <p className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-300">View details →</p>
    </button>
  );
}

export function PersonaKpiCardGrid({
  children,
  columns = 5,
  singleRow = false,
  className,
  ariaLabel = "Key performance indicators",
}: {
  children: ReactNode;
  columns?: 4 | 5;
  /** All KPI cards in one row (Data Steward only). */
  singleRow?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const gridClass = singleRow ? SINGLE_ROW_GRID_CLASS : GRID_BY_COLUMNS[columns];

  const content = singleRow
    ? Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return (
          <div key={child.key ?? undefined} className="min-w-0 [&>button]:h-full [&>button]:w-full">
            {child}
          </div>
        );
      })
    : children;

  return (
    <section className={[gridClass, className].filter(Boolean).join(" ")} aria-label={ariaLabel}>
      {content}
    </section>
  );
}

/** Format KPI value like Pricing dashboard (dollars vs count/unit). */
export function formatPersonaKpiValue(
  value: number,
  unit: "dollars" | string,
  formatMoney: (n: number) => string = (n) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
): string {
  if (unit === "dollars") return formatMoney(value);
  if (unit === "open" || unit === "issues") return String(value);
  return `${value} ${unit}`;
}
