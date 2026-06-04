const ACTIVE_ALERT_KEY = "cfo_active_alert_id";
const TOP8_ORDER_KEY = "cfo_top8_order";
const REVIEW_CURSOR_KEY = "cfo_review_cursor";
const RESOLVED_ALERTS_KEY = "cfo_resolved_alert_ids";

export const cfoCtaPulseClass = "pricing-cta-blink ring-2 ring-indigo-400 ring-offset-1";

export const CFO_TOP_ALERTS_LIMIT = 8;

export function saveCFOActiveAlert(alertId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_ALERT_KEY, alertId);
  } catch {
    /* ignore */
  }
}

export function loadCFOActiveAlert(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_ALERT_KEY);
  } catch {
    return null;
  }
}

export function clearCFOActiveAlert(): void {
  try {
    sessionStorage.removeItem(ACTIVE_ALERT_KEY);
  } catch {
    /* ignore */
  }
}

/** Reset View detail pulse to the first top alert (e.g. after dashboard refresh). */
export function resetCfoReviewQueue(): void {
  try {
    sessionStorage.setItem(REVIEW_CURSOR_KEY, "0");
  } catch {
    /* ignore */
  }
}

/** Persist top-8 alert order for this session (recomputed when dashboard data loads). */
export function syncCfoTop8Order(alertIds: string[], resetCursor = false): string[] {
  const top8 = alertIds.slice(0, CFO_TOP_ALERTS_LIMIT);
  try {
    sessionStorage.setItem(TOP8_ORDER_KEY, JSON.stringify(top8));
    if (resetCursor) {
      resetCfoReviewQueue();
    } else {
      const cursor = getCfoReviewCursor();
      if (cursor > top8.length) {
        sessionStorage.setItem(REVIEW_CURSOR_KEY, String(top8.length));
      }
    }
  } catch {
    /* ignore */
  }
  return top8;
}

export function loadCfoTop8Order(): string[] {
  try {
    const raw = sessionStorage.getItem(TOP8_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function getCfoReviewCursor(): number {
  try {
    const n = parseInt(sessionStorage.getItem(REVIEW_CURSOR_KEY) ?? "0", 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, CFO_TOP_ALERTS_LIMIT);
  } catch {
    return 0;
  }
}

/** Alert id whose View detail button should pulse (next in queue). */
export function getCfoPulseTargetAlertId(): string | null {
  const order = loadCfoTop8Order();
  const cursor = getCfoReviewCursor();
  if (cursor >= order.length) return null;
  return order[cursor] ?? null;
}

/** After user opens the current queue alert on issue detail, advance to the next. */
export function advanceCfoReviewIfCurrent(alertId: string): boolean {
  try {
    const order = loadCfoTop8Order();
    const cursor = getCfoReviewCursor();
    if (order[cursor] !== alertId) return false;
    sessionStorage.setItem(REVIEW_CURSOR_KEY, String(Math.min(cursor + 1, CFO_TOP_ALERTS_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function isCfoReviewQueueComplete(): boolean {
  const order = loadCfoTop8Order();
  return getCfoReviewCursor() >= order.length && order.length > 0;
}

/** Session marks for alerts resolved this visit (instant Top Alerts removal before refetch). */
export function markCfoAlertResolved(alertId: string): void {
  try {
    const raw = sessionStorage.getItem(RESOLVED_ALERTS_KEY);
    const ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    ids.add(alertId);
    sessionStorage.setItem(RESOLVED_ALERTS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function isCfoAlertResolved(alertId: string): boolean {
  try {
    const raw = sessionStorage.getItem(RESOLVED_ALERTS_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) && ids.includes(alertId);
  } catch {
    return false;
  }
}

export function clearCfoResolvedMarks(): void {
  try {
    sessionStorage.removeItem(RESOLVED_ALERTS_KEY);
  } catch {
    /* ignore */
  }
}
