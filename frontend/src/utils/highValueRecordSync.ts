import { markCfoAlertResolved } from "./cfoWorkflowStorage";
import { markCcoIssueResolved } from "./ccoWorkflowStorage";
import { HIGH_VALUE_LINKED_GROUPS, isExecutiveHighValueRecord } from "./executiveApprovalRecord";

export const HIGH_VALUE_APPROVED_EVENT = "lumina-high-value-approved";
// Intentionally in-memory only: resets to baseline on full browser refresh.
const approvedHighValueIds = new Set<string>();

/** All record IDs in the same executive group (includes the given id). */
export function getLinkedHighValueRecordIds(recordId: string): string[] {
  const group = HIGH_VALUE_LINKED_GROUPS.find((g) => g.includes(recordId));
  return group ? [...group] : [recordId];
}

export function isHighValueRecordApproved(recordId: string): boolean {
  if (approvedHighValueIds.has(recordId)) return true;
  return getLinkedHighValueRecordIds(recordId).some((id) => approvedHighValueIds.has(id));
}

/** Mark executive high-value record(s) approved — syncs KPIs across CFO/CCO/Pricing/Tax. */
export function markHighValueRecordApproved(recordId: string): void {
  if (!isExecutiveHighValueRecord(recordId)) return;

  const ids = getLinkedHighValueRecordIds(recordId);
  for (const id of ids) {
    approvedHighValueIds.add(id);
    if (id.startsWith("CFO-")) markCfoAlertResolved(id);
    if (id.startsWith("CCO-")) markCcoIssueResolved(id);
  }

  window.dispatchEvent(
    new CustomEvent(HIGH_VALUE_APPROVED_EVENT, { detail: { recordId, approvedIds: [...ids] } }),
  );
}

export function subscribeHighValueApproved(onApproved: () => void): () => void {
  window.addEventListener(HIGH_VALUE_APPROVED_EVENT, onApproved);
  return () => window.removeEventListener(HIGH_VALUE_APPROVED_EVENT, onApproved);
}
