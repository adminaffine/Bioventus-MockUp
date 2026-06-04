export function markPricingAiRejected(issueId: string): void {
  sessionStorage.setItem(`pricing-ai-rejected-${issueId}`, "1");
}

export function clearPricingAiRejected(issueId: string): void {
  sessionStorage.removeItem(`pricing-ai-rejected-${issueId}`);
}

export function isPricingAiRejected(issueId: string, aiDecision?: string | null): boolean {
  if (aiDecision === "approve") return false;
  if (aiDecision === "reject") return true;
  return sessionStorage.getItem(`pricing-ai-rejected-${issueId}`) === "1";
}

export function markPricingTransactionVisited(issueId: string, orderId: string): void {
  sessionStorage.setItem(`pricing-txn-visited-${issueId}`, orderId);
}

export function isPricingTransactionVisited(issueId: string, orderId: string): boolean {
  return sessionStorage.getItem(`pricing-txn-visited-${issueId}`) === orderId;
}

export const pricingCtaPulseClass = "pricing-cta-blink ring-2 ring-indigo-400 ring-offset-1";
export const pricingCtaPulseClassAmber = "pricing-cta-blink ring-2 ring-amber-400 ring-offset-1";
