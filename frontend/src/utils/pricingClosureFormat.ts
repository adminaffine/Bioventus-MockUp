const MONEY_KPI_KEYS = new Set(["total_exposure", "annualized_exposure"]);
const COUNT_KPI_KEYS = new Set([
  "expiring_contracts",
  "expiring_contracts_kpi",
  "product_recalls",
  "active_conflicts",
  "gpo_conflicts",
]);
const PERCENT_KPI_KEYS = new Set(["gpo_mapping_accuracy", "contract_data_completeness"]);

export const PRICING_KPI_DISPLAY_LABELS: Record<string, string> = {
  active_conflicts: "GPO Conflicts (Dashboard Header)",
  expiring_contracts: "Contracts Expiring / Recalled (Dashboard Header)",
  expiring_contracts_kpi: "Expiring Contracts (KPI Card)",
  product_recalls: "Product Recalls (KPI Card)",
  gpo_conflicts: "GPO Pricing Conflicts",
  gpo_mapping_accuracy: "GPO Mapping Accuracy",
  contract_data_completeness: "Contract Data Completeness",
  total_exposure: "Compliance Exposure",
  annualized_exposure: "Annualized Exposure",
};

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toFiniteNumber(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatSignedMoney(value: number): string {
  const abs = Math.abs(value);
  const formatted = formatMoney(abs);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return "$0";
}

function formatSignedCount(value: number): string {
  if (value > 0) return `+${Math.round(value)}`;
  if (value < 0) return `${Math.round(value)}`;
  return "0";
}

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `${rounded}%`;
  return "0%";
}

export function formatPricingClosureKpiValue(key: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (PERCENT_KPI_KEYS.has(key)) {
    const s = String(value).trim();
    return s.includes("%") ? s : `${s}%`;
  }
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

export function pricingClosureKpiRows(
  kpiImpact: Record<string, { before?: number | string; after?: number | string }>,
): Array<[string, { before: number | string; after: number | string }]> {
  const order = [
    "active_conflicts",
    "expiring_contracts",
    "expiring_contracts_kpi",
    "product_recalls",
    "gpo_conflicts",
    "gpo_mapping_accuracy",
    "contract_data_completeness",
    "total_exposure",
    "annualized_exposure",
  ];
  return Object.entries(kpiImpact)
    .map(([key, raw]) => [key, { before: raw?.before ?? "—", after: raw?.after ?? "—" }] as [string, { before: number | string; after: number | string }])
    .sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

export function formatPricingClosureKpiDelta(
  key: string,
  before: number | string | null | undefined,
  after: number | string | null | undefined,
): string {
  const beforeNum = toFiniteNumber(before ?? "");
  const afterNum = toFiniteNumber(after ?? "");
  if (beforeNum === null || afterNum === null) return "—";
  const delta = afterNum - beforeNum;

  if (MONEY_KPI_KEYS.has(key)) return formatSignedMoney(delta);
  if (COUNT_KPI_KEYS.has(key)) return formatSignedCount(delta);
  if (PERCENT_KPI_KEYS.has(key)) return formatSignedPercent(delta);
  return formatSignedCount(delta);
}

const PRICING_NOTE_KPI_KEYS = ["total_exposure", "annualized_exposure"] as const;

/** KPI change lines for closure impact note (Compliance + Annualized exposure). */
export function buildPricingKpiImpactNoteLines(
  kpiImpact: Record<string, { before?: number | string; after?: number | string }>,
): string[] {
  const lines: string[] = [];

  for (const key of PRICING_NOTE_KPI_KEYS) {
    const raw = kpiImpact[key];
    if (!raw) continue;
    const label = PRICING_KPI_DISPLAY_LABELS[key] ?? key.replace(/_/g, " ");
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
    return ["Compliance Exposure and Annualized Exposure had no dollar change after this closure."];
  }
  return lines;
}
