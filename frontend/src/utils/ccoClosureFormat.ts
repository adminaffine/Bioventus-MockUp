const MONEY_KEYS = new Set([
  "regulatory_penalty_exposure",
  "predicted_annual_risk",
]);

/** Dollar KPI cards — note shows difference amounts for these only (matches CFO). */
const CCO_NOTE_KPI_KEYS = [
  "regulatory_penalty_exposure",
  "predicted_annual_risk",
] as const;

export const CCO_KPI_LABELS: Record<string, string> = {
  regulatory_penalty_exposure: "Regulatory Penalty Exposure",
  capa_breach_risk: "CAPA Breach Risk",
  audit_readiness_score: "Audit Readiness Score",
  predicted_annual_risk: "Predicted Annual Regulatory Risk",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatCCOKpiValue(key: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "audit_readiness_score") {
    const n = Number(value);
    return Number.isFinite(n) ? `${n}%` : String(value);
  }
  if (key === "capa_breach_risk") {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : String(value);
  }
  if (MONEY_KEYS.has(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? money(n) : String(value);
  }
  return String(value);
}

type CcoKpiImpact = Record<
  string,
  { before?: number | string; after?: number | string; delta?: number; label?: string }
>;

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Note lines for dollar KPI cards only — difference amounts when before/after changed. */
export function buildCcoKpiImpactNoteLines(kpiImpact: CcoKpiImpact): string[] {
  const lines: string[] = [];

  for (const key of CCO_NOTE_KPI_KEYS) {
    const raw = kpiImpact[key];
    if (!raw) continue;

    const label = CCO_KPI_LABELS[key] ?? raw.label ?? key.replace(/_/g, " ");
    const before = toFiniteNumber(raw.before);
    const after = toFiniteNumber(raw.after);
    let delta =
      typeof raw.delta === "number" && Number.isFinite(raw.delta) ? raw.delta : null;
    if (delta === null && before !== null && after !== null) {
      delta = after - before;
    }
    if (delta === null || delta === 0) continue;

    const amount = money(Math.abs(delta));
    lines.push(
      delta < 0
        ? `${label} reduced by ${amount} after this closure.`
        : `${label} increased by ${amount} after this closure.`,
    );
  }

  if (lines.length === 0) {
    return [
      "Regulatory Penalty Exposure and Predicted Annual Regulatory Risk had no dollar change after this closure.",
    ];
  }
  return lines;
}

export function closureCcoKpiRows(
  kpiImpact: CcoKpiImpact,
): Array<[string, { before: number | string; after: number | string }]> {
  const order = [
    "regulatory_penalty_exposure",
    "capa_breach_risk",
    "audit_readiness_score",
    "predicted_annual_risk",
  ] as const;
  return order.map((key) => {
    const raw = kpiImpact[key];
    return [key, { before: raw?.before ?? "—", after: raw?.after ?? "—" }] as [
      string,
      { before: number | string; after: number | string },
    ];
  });
}

export function fmtCCOCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}
