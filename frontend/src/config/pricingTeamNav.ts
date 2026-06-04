import type { ComponentType } from "react";
import { DollarSign, Search, Route, CircleCheck } from "lucide-react";
import type { RoleId } from "../context/RoleContext";

export const PRICING_DEMO = {
  issueId: "PRK-ISS-001",
  orderId: "ORD-010",
  closureIssueId: "PRK-ISS-001",
} as const;

export type PricingTeamNavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  allowedRoles: RoleId[];
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

export const PRICING_TEAM_SECTION = "PRICING TEAM USER";

export const pricingTeamNavItems: PricingTeamNavItem[] = [
  {
    path: "/pricing-dashboard",
    label: "Pricing Dashboard",
    icon: DollarSign,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname === "/pricing-dashboard",
  },
  {
    path: `/pricing/issue/${PRICING_DEMO.issueId}`,
    label: "Issue Intelligence",
    icon: Search,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname.startsWith("/pricing/issue/"),
  },
  {
    path: `/pricing/transaction/${PRICING_DEMO.orderId}`,
    label: "Transaction Lineage",
    icon: Route,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname.startsWith("/pricing/transaction/"),
  },
  {
    path: `/pricing/closure/${PRICING_DEMO.closureIssueId}`,
    label: "Pricing Closure",
    icon: CircleCheck,
    allowedRoles: ["pricing_analyst"],
    isActive: ({ pathname }) => pathname.startsWith("/pricing/closure/"),
  },
];

export function canAccessPricingTeamNav(roleId: RoleId): boolean {
  return roleId === "pricing_analyst" || roleId === "admin";
}
