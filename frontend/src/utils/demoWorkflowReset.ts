import { resetHighValueApprovalCache } from "./highValueRecordSync";
import { clearVpResolvedMarks } from "./vpWorkflowStorage";

/** Persona workflow keys — cleared on every full page load so demo data returns to seed state. */
const EXACT_SESSION_KEYS = [
  "lumina-high-value-approved-ids",
  "cfo_active_alert_id",
  "cfo_top8_order",
  "cfo_review_cursor",
  "cfo_resolved_alert_ids",
  "cco_active_issue_id",
  "cco_top8_order",
  "cco_review_cursor",
  "cco_resolved_issue_ids",
  "vp_demo_session_id",
  "vp_top8_order",
  "vp_review_cursor",
  "vp_resolved_issue_ids",
  "vp_resolved_teams",
  "vp_resolved_session_bound",
  "vp_review_session_bound",
] as const;

const SESSION_KEY_PREFIXES = [
  "tax-ai-rejected-",
  "pricing-ai-rejected-",
  "pricing-txn-visited-",
  "steward-ai-rejected-",
  "steward-record-visited-",
  "vp-ai-rejected-",
  "vp-nudge-",
] as const;

function clearDemoSessionStorage(): void {
  try {
    for (const key of EXACT_SESSION_KEYS) {
      sessionStorage.removeItem(key);
    }
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (SESSION_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

let didReset = false;

/** Run once at app bootstrap — browser refresh restores all persona demo workflow state. */
export function resetDemoWorkflowOnPageLoad(): void {
  if (didReset) return;
  didReset = true;
  clearDemoSessionStorage();
  resetHighValueApprovalCache();
  clearVpResolvedMarks();
}
