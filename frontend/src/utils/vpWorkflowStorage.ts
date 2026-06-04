import { resetVPDemoSessionId } from "../services/vpSession";

export const VP_TOP_ALERTS_LIMIT = 8;

export const vpCtaPulseClass = "pricing-cta-blink ring-2 ring-indigo-400 ring-offset-1";

/** In-memory only — cleared on browser refresh so resolved issues reappear at baseline. */
let closedIssueIdsCache = new Set<string>();
let resolvedTeamsCache: Record<string, string> = {};
let top8OrderCache: string[] = [];
let reviewCursorCache = 0;

/** Remove legacy sessionStorage keys from earlier builds. */
function clearLegacyVpSessionStorage(): void {
  try {
    for (const key of [
      "vp_demo_session_id",
      "vp_top8_order",
      "vp_review_cursor",
      "vp_resolved_issue_ids",
      "vp_resolved_teams",
      "vp_resolved_session_bound",
      "vp_review_session_bound",
    ]) {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

clearLegacyVpSessionStorage();

/** Synchronous read — used while filtering dashboard rows after approve/reassign/escalate. */
export function getVpClosedIssueIds(): ReadonlySet<string> {
  return closedIssueIdsCache;
}

export function markVpAiRejected(issueId: string): void {
  sessionStorage.setItem(`vp-ai-rejected-${issueId}`, "1");
}

export function clearVpAiRejected(issueId: string): void {
  sessionStorage.removeItem(`vp-ai-rejected-${issueId}`);
}

export function isVpAiRejected(issueId: string, aiDecision?: string | null): boolean {
  if (aiDecision === "approve") return false;
  if (aiDecision === "reject") return true;
  return sessionStorage.getItem(`vp-ai-rejected-${issueId}`) === "1";
}

export function markVPNudgeSent(issueId: string): void {
  sessionStorage.setItem(`vp-nudge-${issueId}`, "1");
}

export function wasVPNudgeSent(issueId: string): boolean {
  return sessionStorage.getItem(`vp-nudge-${issueId}`) === "1";
}

export function resetVpReviewQueue(): void {
  reviewCursorCache = 0;
}

/** Persist top-alert order for this page load (recomputed when dashboard data loads). */
export function syncVpTop8Order(issueIds: string[], resetCursor = false): string[] {
  const top8 = issueIds.slice(0, VP_TOP_ALERTS_LIMIT);
  const orderChanged = top8OrderCache.length !== top8.length || top8OrderCache.some((id, i) => id !== top8[i]);
  top8OrderCache = top8;
  if (resetCursor || orderChanged) {
    resetVpReviewQueue();
  } else if (reviewCursorCache > top8.length) {
    reviewCursorCache = top8.length;
  }
  return top8;
}

export function loadVpTop8Order(): string[] {
  return top8OrderCache;
}

export function getVpReviewCursor(): number {
  return Math.min(reviewCursorCache, VP_TOP_ALERTS_LIMIT);
}

/** Advance cursor past issues no longer in the open top-alerts list (resolved). */
export function skipVpResolvedFromQueue(openIssueIds: string[]): void {
  const openSet = new Set(openIssueIds);
  let cursor = getVpReviewCursor();
  while (cursor < top8OrderCache.length && !openSet.has(top8OrderCache[cursor])) {
    cursor++;
  }
  reviewCursorCache = Math.min(cursor, VP_TOP_ALERTS_LIMIT);
}

/** Issue id whose View Issue button should pulse (next in queue). */
export function getVpPulseTargetIssueId(openIssueIds: string[]): string | null {
  if (!openIssueIds.length) return null;
  const cursor = Math.min(getVpReviewCursor(), openIssueIds.length - 1);
  return openIssueIds[cursor] ?? openIssueIds[0];
}

/** After user opens the current queue issue on issue detail, advance to the next. */
export function advanceVpReviewIfCurrent(issueId: string, openIssueIds?: string[]): boolean {
  const order = openIssueIds?.length ? openIssueIds : top8OrderCache;
  const cursor = getVpReviewCursor();
  if (order[cursor] !== issueId) return false;
  reviewCursorCache = Math.min(cursor + 1, order.length);
  return true;
}

export function getVpResolvedTeamCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const team of Object.values(resolvedTeamsCache)) {
    if (!team) continue;
    counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  return counts;
}

export function markVpIssueResolved(issueId: string, team?: string): void {
  closedIssueIdsCache = new Set(closedIssueIdsCache);
  closedIssueIdsCache.add(issueId);
  if (team?.trim()) {
    resolvedTeamsCache = { ...resolvedTeamsCache, [issueId]: team.trim() };
  }
  resetVpReviewQueue();
}

export function isVpIssueResolved(issueId: string): boolean {
  return closedIssueIdsCache.has(issueId);
}

export function clearVpResolvedMarks(): void {
  closedIssueIdsCache = new Set();
  resolvedTeamsCache = {};
  top8OrderCache = [];
  reviewCursorCache = 0;
}

/** Clear browser-side VP demo workflow state (use with backend reset-demo). */
export function resetVpDemoWorkflow(): void {
  clearVpResolvedMarks();
  resetVpReviewQueue();
  resetVPDemoSessionId();
}
