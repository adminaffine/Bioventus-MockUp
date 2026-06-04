/** New ID on each full page load — demo actions reset when the user refreshes. */
let pricingDemoSessionId: string | null = null;

export function getPricingDemoSessionId(): string {
  if (!pricingDemoSessionId) {
    pricingDemoSessionId = crypto.randomUUID();
  }
  return pricingDemoSessionId;
}

export function pricingDemoSessionHeaders(): Record<string, string> {
  return { "X-Pricing-Demo-Session": getPricingDemoSessionId() };
}
