import { STEWARD_TEAM_OWNERS } from "../config/stewardTeamOwners";
import type { StewardDashboard, StewardIssueRow } from "../services/api";

const VALID_OWNER_IDS = new Set(STEWARD_TEAM_OWNERS.map((o) => o.owner_id));

function isUnassigned(value: string | undefined): boolean {
  const text = (value ?? "").trim().toLowerCase();
  return !text || text === "unassigned" || text === "none" || text === "null";
}

export function resolveStewardOwner(row: {
  issue_id?: string;
  owner_id?: string;
  owner_name?: string;
}): { owner_id: string; owner_name: string } {
  const ownerId = (row.owner_id ?? "").trim();
  const ownerName = (row.owner_name ?? "").trim();
  if (VALID_OWNER_IDS.has(ownerId) && !isUnassigned(ownerId) && !isUnassigned(ownerName)) {
    const match = STEWARD_TEAM_OWNERS.find((o) => o.owner_id === ownerId)!;
    return { owner_id: match.owner_id, owner_name: match.owner_name };
  }
  const idx =
    [...(row.issue_id ?? "")].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % STEWARD_TEAM_OWNERS.length;
  const owner = STEWARD_TEAM_OWNERS[idx];
  return { owner_id: owner.owner_id, owner_name: owner.owner_name };
}

function patchIssueRow(row: StewardIssueRow): StewardIssueRow {
  const owner = resolveStewardOwner(row);
  return { ...row, owner_id: owner.owner_id, owner_name: owner.owner_name };
}

/** Ensure dashboard lists never surface Unassigned owners in the UI. */
export function normalizeStewardDashboard(dashboard: StewardDashboard): StewardDashboard {
  return {
    ...dashboard,
    all_open_issues: dashboard.all_open_issues.map(patchIssueRow),
    top_alerts: dashboard.top_alerts.map(patchIssueRow),
    ai_queue: dashboard.ai_queue.map(patchIssueRow),
    my_action_queue: dashboard.my_action_queue.map(patchIssueRow),
  };
}
