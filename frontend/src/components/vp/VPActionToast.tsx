import { CheckCircle, X } from "lucide-react";

type Props = {
  message: string;
  onDismiss: () => void;
};

export default function VPActionToast({ message, onDismiss }: Props) {
  return (
    <div className="fixed bottom-24 right-6 z-[1400] max-w-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 shadow-lg">
        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 flex-1">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-0.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/50"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
