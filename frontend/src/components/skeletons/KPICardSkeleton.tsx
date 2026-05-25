import { cn } from "../../lib/utils";

export function KPICardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-700 p-6 bg-slate-100 dark:bg-slate-800/50",
        className
      )}
    >
      <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded mt-3 animate-pulse" />
    </div>
  );
}
