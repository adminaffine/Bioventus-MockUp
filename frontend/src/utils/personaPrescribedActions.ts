import type { CFOAlert, CCOIssue } from "../services/api";

/** Matches backend/routers/tax.py prescribed_actions wording. */
export function buildTaxPrescribedActions(issue: {
  customer_id: string;
  applied_jurisdiction?: string | null;
  correct_jurisdiction?: string | null;
}): string[] {
  const applied = issue.applied_jurisdiction ?? "prior state";
  const correct = issue.correct_jurisdiction ?? "correct state";
  return [
    `Step 1 — Verify ship-to address for ${issue.customer_id} in SAP`,
    `Step 2 — Correct tax jurisdiction from ${applied} to ${correct}`,
    "Step 3 — Confirm order re-routes through correct state tax rule",
    "Step 4 — Mark issue resolved and close alert",
  ];
}

/** Matches backend/routers/pricing.py prescribed_actions wording. */
export function buildPricingPrescribedActions(issue: {
  customer_id: string;
  list_price?: number | null;
  contract_price?: number | null;
  contract_id?: string | null;
}): string[] {
  const overcharge = Math.max(0, (issue.list_price ?? 0) - (issue.contract_price ?? 0));
  const step2 =
    overcharge > 0
      ? `Step 2 — Issue credit memo for $${overcharge.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `Step 2 — Initiate contract renewal for ${issue.contract_id ?? issue.customer_id}`;
  return [
    `Step 1 — Validate GPO roster tier for ${issue.customer_id} in IQVIA`,
    step2,
    `Step 3 — Update SAP pricing master for ${issue.customer_id}`,
    "Step 4 — Mark issue resolved and close alert",
  ];
}

function stepBody(step: string): string {
  return step.replace(/^Step \d+ —\s*/, "");
}

function combinePersonaSteps(left: string[], right: string[]): string[] {
  const count = Math.max(left.length, right.length);
  return Array.from({ length: count }, (_, i) => {
    const l = left[i] ?? left[left.length - 1];
    const r = right[i] ?? right[right.length - 1];
    const lb = stepBody(l);
    const rb = stepBody(r);
    const n = i + 1;
    if (lb === rb) return `Step ${n} — ${lb}`;
    return `Step ${n} — ${lb} and ${rb}`;
  });
}

/** CFO: tax and/or pricing steps; dual alerts merge each step with "and". */
export function buildCfoPrescribedActions(alert: CFOAlert): string[] {
  const taxSteps = alert.tax_owner_id
    ? buildTaxPrescribedActions({
        customer_id: alert.account_id,
        applied_jurisdiction: alert.applied_jurisdiction,
        correct_jurisdiction: alert.correct_jurisdiction,
      })
    : [];
  const pricingSteps = alert.pricing_owner_id
    ? buildPricingPrescribedActions({
        customer_id: alert.account_id,
        list_price: alert.list_price,
        contract_price: alert.contract_price,
      })
    : [];

  if (taxSteps.length > 0 && pricingSteps.length > 0) {
    return combinePersonaSteps(taxSteps, pricingSteps);
  }
  if (taxSteps.length > 0) return taxSteps;
  if (pricingSteps.length > 0) return pricingSteps;

  return [
    `Step 1 — Validate source records for ${alert.order_id}`,
    `Step 2 — Apply correction workflow for ${alert.issue_type}`,
    `Step 3 — Update SAP master data for ${alert.account_id}`,
    "Step 4 — Mark issue resolved and close alert",
  ];
}

/** CCO: tax and/or compliance steps; dual issues merge each step with "and". */
export function buildCcoPrescribedActions(issue: CCOIssue): string[] {
  const taxSteps = issue.tax_owner_id
    ? buildTaxPrescribedActions({
        customer_id: issue.account_id,
        applied_jurisdiction: issue.applied_jurisdiction,
        correct_jurisdiction: issue.correct_jurisdiction,
      })
    : [];
  const complianceSteps = issue.compliance_owner_id
    ? [
        `Step 1 — Review compliance register for ${issue.order_id}`,
        `Step 2 — ${(issue.next_action_compliance ?? "Complete compliance corrective action").replace(/^Correct /i, "Correct ")}`,
        `Step 3 — Verify CAPA linkage for ${(issue.capa_ids ?? "linked CAPA").split(",")[0].trim()}`,
        "Step 4 — Mark issue resolved and close alert",
      ]
    : [];

  if (taxSteps.length > 0 && complianceSteps.length > 0) {
    return combinePersonaSteps(taxSteps, complianceSteps);
  }
  if (taxSteps.length > 0) return taxSteps;
  if (complianceSteps.length > 0) return complianceSteps;

  return [
    `Step 1 — Validate compliance records for ${issue.order_id}`,
    `Step 2 — Apply correction workflow for ${issue.issue_type}`,
    `Step 3 — Update SAP master data for ${issue.account_id}`,
    "Step 4 — Mark issue resolved and close alert",
  ];
}
