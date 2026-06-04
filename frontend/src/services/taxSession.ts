/** New ID on each full page load — demo actions reset when the user refreshes. */
let taxDemoSessionId: string | null = null;

export function getTaxDemoSessionId(): string {
  if (!taxDemoSessionId) {
    taxDemoSessionId = crypto.randomUUID();
  }
  return taxDemoSessionId;
}

export function taxDemoSessionHeaders(): Record<string, string> {
  return { "X-Tax-Demo-Session": getTaxDemoSessionId() };
}
