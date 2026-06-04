export type CCOTeamOwner = { id: string; name: string; team: string };

/** CCO reassign modal — mirrors backend CCO_TEAM_MEMBERS in routers/cco.py */
export const CCO_TEAM_MEMBERS: CCOTeamOwner[] = [
  { id: "CCO-01", name: "Sandra Lee", team: "Compliance Office" },
  { id: "CCO-02", name: "James Torres", team: "Compliance Team" },
  { id: "TAX-03", name: "Jennifer Mills", team: "Tax Team" },
  { id: "TAX-04", name: "Emily Carter", team: "Tax Team" },
  { id: "TAX-05", name: "Robert Chan", team: "Tax Team" },
  { id: "FIN-01", name: "Victoria Hale", team: "Finance Team" },
  { id: "FIN-02", name: "Marcus Webb", team: "Finance Team" },
];

const OWNER_ID_TO_NAME = Object.fromEntries(CCO_TEAM_MEMBERS.map((m) => [m.id, m.name]));

/** Resolve cco_assignee when stored as team member id (e.g. TAX-03). */
export function resolveCcoAssigneeName(assignee: string | undefined | null): string | null {
  const raw = assignee?.trim();
  if (!raw || raw === "Unassigned") return null;
  return OWNER_ID_TO_NAME[raw] ?? raw;
}
