export type StewardTeamOwner = {
  owner_id: string;
  owner_name: string;
  title: string;
};

export const STEWARD_TEAM_OWNERS: StewardTeamOwner[] = [
  { owner_id: "DS-02", owner_name: "Jordan Lee", title: "Data Steward" },
  { owner_id: "DS-01", owner_name: "Rachel Torres", title: "Master Data Steward" },
  { owner_id: "DS-03", owner_name: "Ethan Park", title: "Data Quality Steward" },
];
