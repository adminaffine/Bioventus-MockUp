const ACTIVE_ISSUE_KEY = "cco_active_issue_id";
const TOP8_ORDER_KEY = "cco_top8_order";
const REVIEW_CURSOR_KEY = "cco_review_cursor";
const RESOLVED_ISSUES_KEY = "cco_resolved_issue_ids";

export const ccoCtaPulseClass = "pricing-cta-blink ring-2 ring-indigo-400 ring-offset-1";

export const CCO_TOP_ALERTS_LIMIT = 8;

export function saveCCOActiveIssue(issueId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_ISSUE_KEY, issueId);
  } catch {
    /* ignore */
  }
}

export function loadCCOActiveIssue(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_ISSUE_KEY);
  } catch {
    return null;
  }
}

export function resetCcoReviewQueue(): void {
  try {
    sessionStorage.setItem(REVIEW_CURSOR_KEY, "0");
  } catch {
    /* ignore */
  }
}

export function syncCcoTop8Order(issueIds: string[], resetCursor = false): string[] {
  const top8 = issueIds.slice(0, CCO_TOP_ALERTS_LIMIT);
  try {
    sessionStorage.setItem(TOP8_ORDER_KEY, JSON.stringify(top8));
    if (resetCursor) {
      resetCcoReviewQueue();
    } else {
      const cursor = getCcoReviewCursor();
      if (cursor > top8.length) {
        sessionStorage.setItem(REVIEW_CURSOR_KEY, String(top8.length));
      }
    }
  } catch {
    /* ignore */
  }
  return top8;
}

export function loadCcoTop8Order(): string[] {
  try {
    const raw = sessionStorage.getItem(TOP8_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function getCcoReviewCursor(): number {
  try {
    const n = parseInt(sessionStorage.getItem(REVIEW_CURSOR_KEY) ?? "0", 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, CCO_TOP_ALERTS_LIMIT);
  } catch {
    return 0;
  }
}

export function getCcoPulseTargetIssueId(): string | null {
  const order = loadCcoTop8Order();
  const cursor = getCcoReviewCursor();
  if (cursor >= order.length) return null;
  return order[cursor] ?? null;
}

export function advanceCcoReviewIfCurrent(issueId: string): boolean {
  try {
    const order = loadCcoTop8Order();
    const cursor = getCcoReviewCursor();
    if (order[cursor] !== issueId) return false;
    sessionStorage.setItem(REVIEW_CURSOR_KEY, String(Math.min(cursor + 1, CCO_TOP_ALERTS_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function markCcoIssueResolved(issueId: string): void {
  try {
    const raw = sessionStorage.getItem(RESOLVED_ISSUES_KEY);
    const ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    ids.add(issueId);
    sessionStorage.setItem(RESOLVED_ISSUES_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function isCcoIssueResolved(issueId: string): boolean {
  try {
    const raw = sessionStorage.getItem(RESOLVED_ISSUES_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) && ids.includes(issueId);
  } catch {
    return false;
  }
}

export function clearCcoResolvedMarks(): void {
  try {
    sessionStorage.removeItem(RESOLVED_ISSUES_KEY);
  } catch {
    /* ignore */
  }
}
