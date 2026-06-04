import type { ComponentType } from "react";
import { Database, Search, FileSearch, CircleCheck } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

export const STEWARD_DEMO = {
  issueId: "DS-ISS-001",
  customerId: "CUST-1887",
  closureIssueId: "DS-ISS-001",
} as const;

export type StewardNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const STEWARD_TEAM_SECTION = "DATA STEWARD";

export const stewardNavItems: StewardNavItem[] = [
  {
    path: "/steward-dashboard",
    label: "Data Governance Dashboard",
    icon: Database,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname === "/steward-dashboard",
  },
  {
    path: `/steward/issue/${STEWARD_DEMO.issueId}`,
    label: "Issue Intelligence",
    icon: Search,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname.startsWith("/steward/issue/"),
  },
  {
    path: `/steward/record/${STEWARD_DEMO.customerId}`,
    label: "Record Deep Dive",
    icon: FileSearch,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname.startsWith("/steward/record/"),
  },
  {
    path: `/steward/closure/${STEWARD_DEMO.closureIssueId}`,
    label: "Closure & Accountability",
    icon: CircleCheck,
    allowedRoles: ["data_steward"],
    isActive: ({ pathname }) => pathname.startsWith("/steward/closure/"),
  },
];

export function canAccessStewardNav(roleId: RoleId): boolean {
  return roleId === "data_steward" || roleId === "admin";
}
