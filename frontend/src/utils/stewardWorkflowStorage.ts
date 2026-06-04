export function markStewardAiRejected(issueId: string): void {
  sessionStorage.setItem(`steward-ai-rejected-${issueId}`, "1");
}

export function clearStewardAiRejected(issueId: string): void {
  sessionStorage.removeItem(`steward-ai-rejected-${issueId}`);
}

export function isStewardAiRejected(issueId: string, aiDecision?: string | null): boolean {
  return aiDecision === "reject" || sessionStorage.getItem(`steward-ai-rejected-${issueId}`) === "1";
}

export function markStewardRecordVisited(issueId: string, customerId: string): void {
  sessionStorage.setItem(`steward-record-visited-${issueId}`, customerId);
}

export function isStewardRecordVisited(issueId: string, customerId: string): boolean {
  return sessionStorage.getItem(`steward-record-visited-${issueId}`) === customerId;
}

export const stewardCtaPulseClass = "pricing-cta-blink ring-2 ring-indigo-400 ring-offset-1";
export const stewardCtaPulseClassAmber = "pricing-cta-blink ring-2 ring-amber-400 ring-offset-1";
