let stewardDemoSessionId: string | null = null;

export function getStewardDemoSessionId(): string {
  if (!stewardDemoSessionId) {
    stewardDemoSessionId = crypto.randomUUID();
  }
  return stewardDemoSessionId;
}

export function stewardDemoSessionHeaders(): Record<string, string> {
  return { "X-Steward-Demo-Session": getStewardDemoSessionId() };
}
