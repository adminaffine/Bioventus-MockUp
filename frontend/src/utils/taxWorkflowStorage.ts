export function markTaxAiRejected(issueId: string): void {
  sessionStorage.setItem(`tax-ai-rejected-${issueId}`, "1");
}

export function clearTaxAiRejected(issueId: string): void {
  sessionStorage.removeItem(`tax-ai-rejected-${issueId}`);
}

export function isTaxAiRejected(issueId: string, aiDecision?: string | null): boolean {
  return aiDecision === "reject" || sessionStorage.getItem(`tax-ai-rejected-${issueId}`) === "1";
}

export const taxCtaPulseClassAmber = "pricing-cta-blink ring-2 ring-amber-400 ring-offset-1";
