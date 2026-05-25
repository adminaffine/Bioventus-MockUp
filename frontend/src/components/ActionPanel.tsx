import { useNavigate } from "react-router-dom";

export interface ActionStep {
  step: number;
  description: string;
  regulation?: string;
  deadline?: string;
}

export interface ActionPanelProps {
  severity: "critical" | "high" | "medium" | "low";
  primaryPersona: string;
  ownerName: string;
  actions: ActionStep[];
  secondaryPersonaNote?: string;
  ctaButtons: Array<{
    label: string;
    navigateTo: string;
    variant?: "primary" | "secondary";
  }>;
}

const severityClasses = {
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export default function ActionPanel({
  severity,
  primaryPersona,
  ownerName,
  actions,
  secondaryPersonaNote,
  ctaButtons,
}: ActionPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mt-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${severityClasses[severity]}`}>
          {severity.toUpperCase()}
        </span>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          This action is for: <span className="font-semibold">{primaryPersona}</span> — {ownerName}
        </p>
      </div>

      <p className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">Prescribed Actions:</p>
      <ol className="list-decimal pl-5 space-y-2">
        {actions.map((action) => (
          <li key={`${action.step}-${action.description}`} className="text-sm text-slate-700 dark:text-slate-300">
            {action.description}
            {(action.regulation || action.deadline) && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {action.regulation && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Regulation: {action.regulation}
                  </span>
                )}
                {action.deadline && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Deadline: {action.deadline}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {secondaryPersonaNote && <p className="text-sm italic text-slate-500 dark:text-slate-400 mt-3">{secondaryPersonaNote}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {ctaButtons.map((button) => (
          <button
            key={`${button.label}-${button.navigateTo}`}
            type="button"
            onClick={() => navigate(button.navigateTo)}
            className={
              button.variant === "primary"
                ? "bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-sm"
                : "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm"
            }
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
}
