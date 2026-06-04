export type TaxTeamOwner = {
  owner_id: string;
  owner_name: string;
  title: string;
};

/** Tax team members available for issue reassignment */
export const TAX_TEAM_OWNERS: TaxTeamOwner[] = [
  { owner_id: "TAX-03", owner_name: "Jennifer Mills", title: "Senior Tax Analyst" },
  { owner_id: "TAX-04", owner_name: "Emily Carter", title: "Tax Compliance Specialist" },
  { owner_id: "TAX-05", owner_name: "Robert Chan", title: "Jurisdiction Review Lead" },
];
