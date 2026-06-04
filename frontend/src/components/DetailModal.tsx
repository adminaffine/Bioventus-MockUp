import { useEffect } from "react";
import { ArrowLeft, X } from "lucide-react";

export default function DetailModal({
  open,
  title,
  onClose,
  children,
  closeLabel = "Close",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Label for the primary dismiss control (e.g. "Back to Dashboard") */
  closeLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[85vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {closeLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
