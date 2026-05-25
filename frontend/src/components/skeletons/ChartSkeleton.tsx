import { cn } from "../../lib/utils";

export function ChartSkeleton({ height = 220, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 animate-pulse", className)}
      style={{ height }}
    />
  );
}
