export function formatDatasetName(raw: string): string {
  const map: Record<string, string> = {
    customer_master: "Customer Master",
    sales_orders: "Sales Orders",
    product_catalog: "Product Catalog",
    patient_support: "Patient Support Cases",
    master_conflicts: "Master Data Conflicts",
  };
  return map[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function scoreColor(score: number): "emerald" | "amber" | "rose" {
  if (score >= 85) return "emerald";
  if (score >= 70) return "amber";
  return "rose";
}

export function scoreTextClass(score: number, dark = false): string {
  const c = scoreColor(score);
  if (c === "emerald") return dark ? "text-emerald-300" : "text-emerald-700";
  if (c === "amber") return dark ? "text-amber-300" : "text-amber-700";
  return dark ? "text-rose-300" : "text-rose-700";
}

export function scoreBgClass(score: number, dark = false): string {
  const c = scoreColor(score);
  if (c === "emerald") return dark ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-100 text-emerald-700";
  if (c === "amber") return dark ? "bg-amber-900/30 text-amber-300" : "bg-amber-100 text-amber-700";
  return dark ? "bg-rose-900/30 text-rose-300" : "bg-rose-100 text-rose-700";
}
