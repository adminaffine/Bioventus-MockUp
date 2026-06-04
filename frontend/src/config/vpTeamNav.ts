import type { ComponentType } from "react";
import { LayoutDashboard, Search, CircleCheck } from "lucide-react";
import type { RoleId } from "../context/RoleContext";
import { VP_DEMO_BASELINE } from "./vpDemoBaseline";

export const VP_DEMO = {
  issueId: VP_DEMO_BASELINE.demoIssueId,
  closureIssueId: VP_DEMO_BASELINE.demoIssueId,
  accountName: VP_DEMO_BASELINE.demoAccount,
  orderId: VP_DEMO_BASELINE.demoOrderId,
} as const;

export type VPTeamNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const VP_TEAM_SECTION = "VP / DIRECTOR";

export const vpTeamNavItems: VPTeamNavItem[] = [
  {
    path: "/vp-dashboard",
    label: "Operations Dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["vp_director"],
    isActive: ({ pathname }) => pathname === "/vp-dashboard",
  },
  {
    path: `/vp/issue/${VP_DEMO.issueId}`,
    label: "Issue Detail",
    icon: Search,
    allowedRoles: ["vp_director"],
    isActive: ({ pathname }) => pathname.startsWith("/vp/issue/"),
  },
  {
    path: `/vp/closure/${VP_DEMO.closureIssueId}`,
    label: "Closure",
    icon: CircleCheck,
    allowedRoles: ["vp_director"],
    isActive: ({ pathname }) => pathname.startsWith("/vp/closure/"),
  },
];

export function canAccessVPTeamNav(roleId: RoleId): boolean {
  return roleId === "vp_director" || roleId === "admin";
}
