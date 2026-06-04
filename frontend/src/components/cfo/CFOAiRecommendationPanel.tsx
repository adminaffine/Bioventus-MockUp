import { aiRecommendationPanelClass } from "../shared/aiRecommendationStyles";

type Props = {
  recommendations: string[];
  className?: string;
};

/** Display-only AI recommendations (no approve/reject — matches CFO issue detail spec). */
export default function CFOAiRecommendationPanel({ recommendations, className = "" }: Props) {
  if (recommendations.length === 0) return null;

  return (
    <section className={`${aiRecommendationPanelClass} ${className}`}>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Recommendation</h2>
      <div className="mt-3 space-y-3">
        {recommendations.map((line, index) => (
          <p key={index} className="text-sm text-slate-600 dark:text-slate-300">
            {recommendations.length > 1 ? (
              <>
                <span className="font-medium text-slate-700 dark:text-slate-200">{index + 1}. </span>
                {line}
              </>
            ) : (
              line
            )}
          </p>
        ))}
      </div>
    </section>
  );
}
