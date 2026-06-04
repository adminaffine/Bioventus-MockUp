/** VP demo session — scoped to the current page load; a browser refresh starts a new session. */
let vpDemoSessionId: string | null = null;

export function getVPDemoSessionId(): string {
  if (!vpDemoSessionId) {
    vpDemoSessionId = crypto.randomUUID();
  }
  return vpDemoSessionId;
}

/** Start a fresh backend demo session (used by Reset demo data). */
export function resetVPDemoSessionId(): void {
  vpDemoSessionId = crypto.randomUUID();
}

export function vpDemoSessionHeaders(): Record<string, string> {
  return { "X-VP-Demo-Session": getVPDemoSessionId() };
}
