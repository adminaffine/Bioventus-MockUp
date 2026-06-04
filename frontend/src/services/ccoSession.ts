import { fetchApi } from "./api";

/** In-memory only — a full page refresh gets a new id and resets the CCO demo queue from DB. */
let ccoDemoSessionId: string | null = null;

export function getCCODemoSessionId(): string {
  if (!ccoDemoSessionId) {
    ccoDemoSessionId = crypto.randomUUID();
  }
  return ccoDemoSessionId;
}

export function ccoDemoSessionHeaders(): Record<string, string> {
  return { "X-CCO-Demo-Session": getCCODemoSessionId() };
}

export function ccoFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchApi<T>(path, {
    ...options,
    headers: {
      ...ccoDemoSessionHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
}
