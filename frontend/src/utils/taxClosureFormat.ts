/** Money KPIs on Tax Closure impact table */
const MONEY_KPI_KEYS = new Set([
  "compliance_exposure",
  "total_exposure",
  "annualized_exposure",
  "tax_overpayments",
  "tax_underpayments",
]);

/** Count KPIs (open-issue counts) */
const COUNT_KPI_KEYS = new Set(["jurisdiction_mismatches", "pre_invoice_alerts"]);

const PERCENT_KPI_KEYS = new Set(["tax_jurisdiction_accuracy"]);

export const KPI_DISPLAY_LABELS: Record<string, string> = {
  jurisdiction_mismatches: "Jurisdiction Mismatches",
  tax_jurisdiction_accuracy: "Tax Jurisdiction Accuracy",
  compliance_exposure: "Compliance Exposure",
  annualized_exposure: "Annualized Exposure",
  pre_invoice_alerts: "Pre-Invoice Alerts",
  tax_overpayments: "Tax Overpayments",
  tax_underpayments: "Tax Underpayments",
};

const CLOSURE_KPI_ORDER = [
  "jurisdiction_mismatches",
  "pre_invoice_alerts",
  "tax_jurisdiction_accuracy",
  "compliance_exposure",
  "tax_overpayments",
  "tax_underpayments",
] as const;

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toFiniteNumber(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function formatClosureKpiValue(key: string, value: number | string | null | undefined): string {
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

export function closureKpiRows(
  kpiImpact: Record<string, { before?: number | string; after?: number | string }>,
): Array<[string, { before: number | string; after: number | string }]> {
  const rows: Array<[string, { before: number | string; after: number | string }]> = [];

  for (const key of CLOSURE_KPI_ORDER) {
    if (key === "tax_jurisdiction_accuracy" && !kpiImpact[key]) continue;
    const raw = kpiImpact[key];
    if (!raw && key !== "compliance_exposure") continue;
    if (key === "compliance_exposure") {
      const compliance = kpiImpact.compliance_exposure ?? kpiImpact.total_exposure;
      if (!compliance) continue;
      rows.push([
        "compliance_exposure",
        { before: compliance.before ?? "—", after: compliance.after ?? "—" },
      ]);
      continue;
    }
    if (!raw) continue;
    rows.push([key, { before: raw.before ?? "—", after: raw.after ?? "—" }]);
  }

  return rows;
}

function formatNoteDeltaAmount(key: string, delta: number): string {
  const abs = Math.abs(delta);
  if (MONEY_KPI_KEYS.has(key)) return formatMoney(abs);
  if (COUNT_KPI_KEYS.has(key)) return String(Math.round(abs));
  if (PERCENT_KPI_KEYS.has(key)) return `${Math.round(abs * 10) / 10}%`;
  return String(abs);
}

const TAX_NOTE_KPI_KEYS = ["compliance_exposure", "tax_overpayments", "tax_underpayments"] as const;

function pushMoneyKpiNoteLine(
  lines: string[],
  key: (typeof TAX_NOTE_KPI_KEYS)[number],
  raw: { before?: number | string; after?: number | string } | undefined,
): void {
  if (!raw) return;
  const label = KPI_DISPLAY_LABELS[key] ?? key.replace(/_/g, " ");
  const beforeStr = formatClosureKpiValue(key, raw.before);
  const afterStr = formatClosureKpiValue(key, raw.after);
  if (beforeStr === afterStr) return;

  const before = toFiniteNumber(raw.before ?? "");
  const after = toFiniteNumber(raw.after ?? "");
  if (before === null || after === null) return;

  const delta = after - before;
  if (delta === 0) return;

  const amount = formatNoteDeltaAmount(key, delta);
  lines.push(
    delta < 0
      ? `${label} reduced by ${amount} after this closure.`
      : `${label} increased by ${amount} after this closure.`,
  );
}

/** Note lines for Compliance Exposure, Tax Overpayments, and Tax Underpayments when changed. */
export function buildTaxKpiImpactNoteLines(
  kpiImpact: Record<string, { before?: number | string; after?: number | string }>,
): string[] {
  const lines: string[] = [];

  pushMoneyKpiNoteLine(
    lines,
    "compliance_exposure",
    kpiImpact.compliance_exposure ?? kpiImpact.total_exposure,
  );
  pushMoneyKpiNoteLine(lines, "tax_overpayments", kpiImpact.tax_overpayments);
  pushMoneyKpiNoteLine(lines, "tax_underpayments", kpiImpact.tax_underpayments);

  if (lines.length === 0) {
    return [
      "Compliance Exposure, Tax Overpayments, and Tax Underpayments had no dollar change after this closure.",
    ];
  }
  return lines;
}
