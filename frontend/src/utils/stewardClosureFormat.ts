const MONEY_KPI_KEYS = new Set(["total_exposure", "annualized_exposure"]);

const COUNT_KPI_KEYS = new Set([
  "hierarchy_mapping_issues",
  "orphan_records",
  "tax_jurisdiction_gaps",
  "stale_master_records",
  "duplicate_suspects",
]);

export const STEWARD_KPI_LABELS: Record<string, string> = {
  hierarchy_mapping_issues: "Hierarchy Mapping Issues",
  orphan_records: "Orphan Records",
  tax_jurisdiction_gaps: "Tax Jurisdiction Gaps",
  stale_master_records: "Stale Master Records",
  duplicate_suspects: "Duplicate Suspects",
  total_exposure: "Total Exposure",
  annualized_exposure: "Annualized Exposure",
};

const CLOSURE_KPI_ORDER = [
  "hierarchy_mapping_issues",
  "orphan_records",
  "tax_jurisdiction_gaps",
  "stale_master_records",
  "duplicate_suspects",
  "total_exposure",
  "annualized_exposure",
] as const;

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toFiniteNumber(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function formatStewardKpiValue(key: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_KPI_KEYS.has(key)) {
    const n = toFiniteNumber(value);
    return n !== null ? formatMoney(n) : String(value);
  }
  if (COUNT_KPI_KEYS.has(key)) {
    const n = toFiniteNumber(value);
    return n !== null ? String(Math.round(n)) : String(value);
  }
  return String(value);
}

export function closureStewardKpiRows(
  kpiImpact: Record<string, { before?: number | string; after?: number | string }>,
): Array<[string, { before: number | string; after: number | string }]> {
  return CLOSURE_KPI_ORDER.filter((key) => kpiImpact[key]).map((key) => {
    const raw = kpiImpact[key]!;
    return [key, { before: raw.before ?? "—", after: raw.after ?? "—" }] as [
      string,
      { before: number | string; after: number | string },
    ];
  });
}

const STEWARD_NOTE_KPI_KEYS = ["total_exposure", "annualized_exposure"] as const;

/** Note lines for dollar KPI cards only (Total Exposure + Annualized Exposure). */
export function buildStewardKpiImpactNoteLines(
  kpiImpact: Record<string, { before?: number | string; after?: number | string }>,
): string[] {
  const lines: string[] = [];

  for (const key of STEWARD_NOTE_KPI_KEYS) {
    const raw = kpiImpact[key];
    if (!raw) continue;

    const label = STEWARD_KPI_LABELS[key] ?? key.replace(/_/g, " ");
    const before = toFiniteNumber(raw.before ?? "");
    const after = toFiniteNumber(raw.after ?? "");
    if (before === null || after === null) continue;

    const delta = after - before;
    if (delta === 0) continue;

    const amount = formatMoney(Math.abs(delta));
    lines.push(
      delta < 0
        ? `${label} reduced by ${amount} after this closure.`
        : `${label} increased by ${amount} after this closure.`,
    );
  }

  if (lines.length === 0) {
    return ["Total Exposure and Annualized Exposure had no dollar change after this closure."];
  }
  return lines;
}
