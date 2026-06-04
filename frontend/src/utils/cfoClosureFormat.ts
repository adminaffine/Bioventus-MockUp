const MONEY_KEYS = new Set([
  "revenue_at_risk",
  "margin_at_risk",
  "compliance_exposure",
  "predicted_annual_exposure",
]);

/** Dollar KPI cards — note shows difference amounts for these only. */
const CFO_NOTE_KPI_KEYS = [
  "revenue_at_risk",
  "margin_at_risk",
  "compliance_exposure",
  "predicted_annual_exposure",
] as const;

export const CFO_KPI_LABELS: Record<string, string> = {
  revenue_at_risk: "Revenue at Risk",
  margin_at_risk: "Margin at Risk",
  compliance_exposure: "Compliance Exposure",
  predicted_annual_exposure: "Predicted Annual Exposure",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatCFOKpiValue(key: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_KEYS.has(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? money(n) : String(value);
  }
  return String(value);
}

type CfoKpiImpact = Record<
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
export function buildCfoKpiImpactNoteLines(kpiImpact: CfoKpiImpact): string[] {
  const lines: string[] = [];

  for (const key of CFO_NOTE_KPI_KEYS) {
    if (!MONEY_KEYS.has(key)) continue;
    const raw = kpiImpact[key];
    if (!raw) continue;

    const label = CFO_KPI_LABELS[key] ?? raw.label ?? key.replace(/_/g, " ");
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
      "Revenue at Risk, Margin at Risk, Compliance Exposure, and Predicted Annual Exposure had no dollar change after this closure.",
    ];
  }
  return lines;
}

export function closureKpiRows(
  kpiImpact: CfoKpiImpact,
): Array<[string, { before: number | string; after: number | string }]> {
  const order = [
    "revenue_at_risk",
    "margin_at_risk",
    "compliance_exposure",
    "predicted_annual_exposure",
  ] as const;
  return order.map((key) => {
    const raw = kpiImpact[key];
    return [key, { before: raw?.before ?? "—", after: raw?.after ?? "—" }] as [
      string,
      { before: number | string; after: number | string },
    ];
  });
}

export function fmtCFOCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}
