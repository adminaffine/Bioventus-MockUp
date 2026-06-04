import { markCfoAlertResolved } from "./cfoWorkflowStorage";
import { markCcoIssueResolved } from "./ccoWorkflowStorage";
import { HIGH_VALUE_LINKED_GROUPS, isExecutiveHighValueRecord } from "./executiveApprovalRecord";

export const HIGH_VALUE_APPROVED_EVENT = "lumina-high-value-approved";
const STORAGE_KEY = "lumina-high-value-approved-ids";

function loadApprovedIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      for (const id of JSON.parse(raw) as string[]) {
        ids.add(id);
      }
    }
  } catch {
    /* ignore */
  }
  return ids;
}

function persistApprovedIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

const approvedHighValueIds = loadApprovedIds();

/** All record IDs in the same executive group (includes the given id). */
export function getLinkedHighValueRecordIds(recordId: string): string[] {
  const group = HIGH_VALUE_LINKED_GROUPS.find((g) => g.includes(recordId));
  return group ? [...group] : [recordId];
}

export function isHighValueRecordApproved(recordId: string): boolean {
  if (approvedHighValueIds.has(recordId)) return true;
  return getLinkedHighValueRecordIds(recordId).some((id) => approvedHighValueIds.has(id));
}

/** True when CFO/CCO executive approval already removed linked records from persona KPIs. */
export function isExecutiveClosureKpiPatchNeeded(issueId: string): boolean {
  return getLinkedHighValueRecordIds(issueId).some((id) => isHighValueRecordApproved(id));
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
  persistApprovedIds(approvedHighValueIds);

  window.dispatchEvent(
    new CustomEvent(HIGH_VALUE_APPROVED_EVENT, { detail: { recordId, approvedIds: [...ids] } }),
  );
}

export function subscribeHighValueApproved(onApproved: () => void): () => void {
  window.addEventListener(HIGH_VALUE_APPROVED_EVENT, onApproved);
  return () => window.removeEventListener(HIGH_VALUE_APPROVED_EVENT, onApproved);
}
