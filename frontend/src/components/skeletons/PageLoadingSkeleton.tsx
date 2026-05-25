import { KPICardSkeleton } from "./KPICardSkeleton";
import { ChartSkeleton } from "./ChartSkeleton";

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-10 w-72 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <ChartSkeleton height={280} />
    </div>
  );
}
