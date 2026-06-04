/** In-memory only — a full page refresh gets a new id and resets the CFO demo queue from DB. */
let cfoDemoSessionId: string | null = null;

export function getCFODemoSessionId(): string {
  if (!cfoDemoSessionId) {
    cfoDemoSessionId = crypto.randomUUID();
  }
  return cfoDemoSessionId;
}

export function cfoDemoSessionHeaders(): Record<string, string> {
  return { "X-CFO-Demo-Session": getCFODemoSessionId() };
}
