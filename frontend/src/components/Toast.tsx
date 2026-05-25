import { useEffect } from "react";
import { cn } from "../lib/utils";

export type ToastType = "success" | "warning" | "error" | "info";

export default function Toast({
  message,
  type = "info",
  onDismiss,
  duration = 5000,
}: {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2 max-w-md",
        type === "success" && "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
        type === "warning" && "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200",
        type === "error" && "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
        type === "info" && "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
      )}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-current opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
