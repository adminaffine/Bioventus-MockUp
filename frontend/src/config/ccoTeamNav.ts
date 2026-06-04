import type { ComponentType } from "react";
import { LayoutDashboard } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

export type CCOTeamNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const CCO_TEAM_SECTION = "CCO USER";

export const ccoTeamNavItems: CCOTeamNavItem[] = [
  {
    path: "/cco-dashboard",
    label: "CCO Dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["cco"],
    isActive: ({ pathname }) => pathname === "/cco-dashboard",
  },
];

export function canAccessCCOTeamNav(roleId: RoleId): boolean {
  return roleId === "cco" || roleId === "admin";
}
