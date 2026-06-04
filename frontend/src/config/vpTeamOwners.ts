export type VPTeamMember = {
  id: string;
  name: string;
  team: string;
};

/** Mirrors backend VP_TEAM_MEMBERS — used for reassign modal until API load. */
export const VP_TEAM_MEMBERS: VPTeamMember[] = [
  { id: "TAX-03", name: "Jennifer Mills", team: "Tax Team" },
  { id: "TAX-04", name: "Emily Carter", team: "Tax Team" },
  { id: "TAX-05", name: "Robert Chan", team: "Tax Team" },
  { id: "PRICE-04", name: "David Chen", team: "Pricing Team" },
  { id: "PRICE-05", name: "Sarah Mitchell", team: "Pricing Team" },
  { id: "FIN-01", name: "Victoria Hale", team: "Finance Team" },
  { id: "FIN-02", name: "Marcus Webb", team: "Finance Team" },
  { id: "FIN-03", name: "Rachel Kim", team: "Finance Team" },
  { id: "CCO-01", name: "Sandra Lee", team: "Compliance Team" },
  { id: "CCO-02", name: "James Torres", team: "Compliance Team" },
];
