import type { TaxIssueWorkflow } from "../../services/api";

const STEPS = [
  { key: "dashboard", label: "Tax Dashboard", step: 1 },
  { key: "issue", label: "Issue Intelligence", step: 2 },
  { key: "transaction", label: "Transaction Lineage", step: 3 },
  { key: "closure", label: "Tax Closure", step: 4 },
] as const;

type Props = {
  workflow: TaxIssueWorkflow;
  currentStep: 2 | 3;
};

export default function TaxManualWorkflowProgress({ workflow, currentStep }: Props) {
  if (workflow.ai_approved) return null;

  const step2Done = Boolean(workflow.acknowledged_at);
  const step3Done = Boolean(workflow.transaction_reviewed_at && workflow.address_update_queued_at);
  const doneFor = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return step2Done;
    if (step === 3) return step3Done;
    if (step === 4) return workflow.can_mark_resolved;
    return false;
  };

  return (
    <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-3">
      <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 uppercase tracking-wide">
        Manual 4-step resolution path
      </p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
        Without an approved AI action, complete each step below. Mark Resolved lights up after Steps 2–3 are done.
      </p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {STEPS.map((s) => {
          const done = doneFor(s.step);
          const current = s.step === currentStep;
          return (
            <li
              key={s.key}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                done
                  ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-200"
                  : current
                    ? "bg-white border-amber-400 text-amber-900 dark:bg-slate-800 dark:border-amber-600 dark:text-amber-100 font-medium"
                    : "bg-white/60 border-amber-200 text-amber-700 dark:bg-slate-800/60 dark:border-amber-800 dark:text-amber-300"
              }`}
            >
              {done ? "✓ " : current ? "→ " : ""}
              {s.step}. {s.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
