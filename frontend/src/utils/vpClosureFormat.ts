const COUNT_KPI_KEYS = new Set([
  "Issues Pending Resolution",
  "SLA Breach Risk",
  "Priority Queue",
]);

const PERCENT_KPI_KEYS = new Set(["Team Resolution Rate"]);

export const VP_KPI_DISPLAY_LABELS: Record<string, string> = {
  "Issues Pending Resolution": "Issues Pending Resolution",
  "SLA Breach Risk": "SLA Breach Risk",
  "Priority Queue": "Priority Queue",
  "Team Resolution Rate": "Team Resolution Rate",
};

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value ?? "").replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function formatVPClosureKpiValue(
  label: string,
  value: number | string | null | undefined,
  unit?: string,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = toFiniteNumber(value);
  if (PERCENT_KPI_KEYS.has(label) || unit === "%") {
    if (n !== null) return `${n}%`;
    const s = String(value);
    return s.includes("%") ? s : `${s}%`;
  }
  if (n !== null && COUNT_KPI_KEYS.has(label)) return String(Math.round(n));
  return String(value);
}

export function vpClosureKpiRows(
  kpiImpact: Record<string, { before?: number | string; after?: number | string; label?: string; unit?: string }>,
): Array<[string, { before: number | string; after: number | string; unit?: string }]> {
  const order = [
    "Issues Pending Resolution",
    "SLA Breach Risk",
    "Priority Queue",
    "Team Resolution Rate",
  ];
  return Object.entries(kpiImpact)
    .map(([key, raw]) => [
      key,
      { before: raw?.before ?? "—", after: raw?.after ?? "—", unit: raw?.unit },
    ] as [string, { before: number | string; after: number | string; unit?: string }])
    .sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

export function buildVPClosureHeroTitle(actionTaken?: string, resolutionType?: string): string {
  const action = (actionTaken || "").toLowerCase();
  const type = (resolutionType || "").toLowerCase();
  if (action === "escalate" || type.includes("escalat")) return "Escalated to C-Suite ✓";
  if (action === "reassign" || type.includes("reassign")) return "Issue Reassigned ✓";
  if (action === "approve" || type.includes("approved")) return "Operations Issue Approved ✓";
  if (type.includes("resolved")) return "Operations Issue Resolved ✓";
  return "Operations Issue Closed ✓";
}
