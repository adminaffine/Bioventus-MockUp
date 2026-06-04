import type { ComponentType } from "react";
import { LayoutDashboard } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

export type CFOTeamNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const CFO_TEAM_SECTION = "CFO USER";

export const cfoTeamNavItems: CFOTeamNavItem[] = [
  {
    path: "/cfo-dashboard",
    label: "CFO Dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["cfo"],
    isActive: ({ pathname }) => pathname === "/cfo-dashboard",
  },
];

export function canAccessCFOTeamNav(roleId: RoleId): boolean {
  return roleId === "cfo" || roleId === "admin";
}
