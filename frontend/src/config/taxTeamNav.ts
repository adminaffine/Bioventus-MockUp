import type { ComponentType } from "react";
import { Receipt, Search, Route, CircleCheck } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

/** Demo deep-link IDs for sidebar navigation when no issue/order is in context */
export const TAX_DEMO = {
  issueId: "TAX-ISS-001",
  orderId: "ORD-022",
  closureIssueId: "TAX-ISS-001",
} as const;

export type TaxTeamNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const TAX_TEAM_SECTION = "TAX TEAM USER";

export const taxTeamNavItems: TaxTeamNavItem[] = [
  {
    path: "/tax-dashboard",
    label: "Tax Exposure Dashboard",
    icon: Receipt,
    allowedRoles: ["tax_compliance"],
    isActive: ({ pathname }) => pathname === "/tax-dashboard",
  },
  {
    path: `/tax/issue/${TAX_DEMO.issueId}`,
    label: "Issue Intelligence",
    icon: Search,
    allowedRoles: ["tax_compliance"],
    isActive: ({ pathname }) => pathname.startsWith("/tax/issue/"),
  },
  {
    path: `/tax/transaction/${TAX_DEMO.orderId}`,
    label: "Transaction Lineage",
    icon: Route,
    allowedRoles: ["tax_compliance"],
    isActive: ({ pathname }) => pathname.startsWith("/tax/transaction/"),
  },
  {
    path: `/tax/closure/${TAX_DEMO.closureIssueId}`,
    label: "Tax Closure",
    icon: CircleCheck,
    allowedRoles: ["tax_compliance"],
    isActive: ({ pathname }) => pathname.startsWith("/tax/closure/"),
  },
];

export function canAccessTaxTeamNav(roleId: RoleId): boolean {
  return roleId === "tax_compliance" || roleId === "admin";
}
