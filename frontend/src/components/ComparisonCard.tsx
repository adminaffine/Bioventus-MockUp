import { cn } from "../lib/utils";

type Delta = "up" | "down" | "same";

export default function ComparisonCard({
  title,
  baselineValue,
  uploadedValue,
  suffix = "",
  invertBetter = false,
}: {
  title: string;
  baselineValue: number;
  uploadedValue: number;
  suffix?: string;
  /** If true, lower value is better (e.g. issues count) */
  invertBetter?: boolean;
}) {
  let delta: Delta = "same";
  if (uploadedValue !== baselineValue) {
    const higherIsBetter = !invertBetter;
    if (higherIsBetter && uploadedValue > baselineValue) delta = "up";
    else if (higherIsBetter && uploadedValue < baselineValue) delta = "down";
    else if (invertBetter && uploadedValue < baselineValue) delta = "up";
    else if (invertBetter && uploadedValue > baselineValue) delta = "down";
    else delta = "down";
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      )}
    >
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-slate-500 dark:text-slate-500 text-sm">
          Baseline: {baselineValue}
          {suffix}
        </span>
        <span className="text-slate-400">vs</span>
        <span
          className={cn(
            "font-bold",
            delta === "up" && "text-green-600 dark:text-green-400",
            delta === "down" && "text-red-600 dark:text-red-400",
            delta === "same" && "text-slate-700 dark:text-slate-300"
          )}
        >
          {uploadedValue}
          {suffix}
        </span>
        {delta === "up" && (
          <span className="text-green-600 dark:text-green-400" aria-label="improved">
            ↑
          </span>
        )}
        {delta === "down" && (
          <span className="text-red-600 dark:text-red-400" aria-label="worse">
            ↓
          </span>
        )}
        {delta === "same" && (
          <span className="text-slate-400" aria-label="same">
            =
          </span>
        )}
      </div>
    </div>
  );
}
