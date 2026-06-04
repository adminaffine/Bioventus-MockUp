export type PricingTeamOwner = {
  owner_id: string;
  owner_name: string;
  title: string;
};

export const PRICING_TEAM_OWNERS: PricingTeamOwner[] = [
  { owner_id: "REP-05", owner_name: "Marcus Johnson", title: "Pricing Analyst" },
  { owner_id: "REP-03", owner_name: "Jennifer Mills", title: "Senior Pricing Analyst" },
  { owner_id: "REP-04", owner_name: "Daniel Ortiz", title: "GPO Contract Specialist" },
];
