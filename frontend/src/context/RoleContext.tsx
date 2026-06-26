import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { formatVpDashboardContextBanner } from "../config/vpDemoBaseline";
import { USER_PERSONA_STORAGE_KEY } from "../config/auth";
import { useAuth } from "./AuthContext";

export type RoleId = "admin" | "pricing_analyst" | "tax_compliance" | "data_steward" | "cfo" | "cco" | "vp_director";

/** Personas shown in the “Viewing as” dropdown */
export const VIEWING_AS_ROLE_IDS: RoleId[] = [
  "admin",
  "cfo",
  "cco",
  "vp_director",
  "pricing_analyst",
  "tax_compliance",
  "data_steward",
];

export const EXECUTIVE_ROLE_IDS: RoleId[] = ["admin"];

export interface Role {
  id: RoleId;
  label: string;
  shortLabel: string;
  personaName: string;
  badgeColor: string;
  badgeTextColor: string;
  defaultRoute: string;
  defaultRevenueTab?: string;
  contextBannerByRoute: Record<string, string>;
}

export const ROLES: Role[] = [
  {
    id: "admin",
    label: "Admin — All Views",
    shortLabel: "Admin",
    personaName: "Platform Administrator",
    badgeColor: "bg-slate-600",
    badgeTextColor: "text-white",
    defaultRoute: "/",
    contextBannerByRoute: {},
  },
  {
    id: "cfo",
    label: "CFO — Chief Financial Officer",
    shortLabel: "CFO",
    personaName: "Chief Financial Officer",
    badgeColor: "bg-indigo-700",
    badgeTextColor: "text-white",
    defaultRoute: "/cfo-dashboard",
    contextBannerByRoute: {
      "/cfo-dashboard": "",
      "/csuite": "CFO View — $15,626 margin at risk · $2.39M annualized · 7 SLA breaches · $88,780 financial impact",
      "/commercial": "CFO View — $59,110 at-risk revenue · $1.63M COPQ · $2.39M margin leakage projected annually",
      "/revenue": "CFO View — Revenue quality: $4,620 GPO overcharges + $29,100 DSO collection risk",
    },
  },
  {
    id: "cco",
    label: "CCO — Chief Compliance Officer",
    shortLabel: "CCO",
    personaName: "Chief Compliance Officer",
    badgeColor: "bg-rose-700",
    badgeTextColor: "text-white",
    defaultRoute: "/cco-dashboard",
    contextBannerByRoute: {
      "/cco-dashboard": "",
    },
  },
  {
    id: "vp_director",
    label: "VP / Director — Operations",
    shortLabel: "VP / Director",
    personaName: "VP / Director",
    badgeColor: "bg-indigo-700",
    badgeTextColor: "text-white",
    defaultRoute: "/vp-dashboard",
    contextBannerByRoute: {
      "/vp-dashboard": formatVpDashboardContextBanner(),
      "/vp/issue/:issueId":
        "Operations View — cross-team issue oversight · approve AI fixes · nudge owners · escalate to C-Suite",
      "/vp/closure/:issueId":
        "Operations View — resolution confirmed · team scorecard updated · SLA performance logged",
    },
  },
  {
    id: "pricing_analyst",
    label: "Pricing Team",
    shortLabel: "Pricing",
    personaName: "Pricing Team",
    badgeColor: "bg-emerald-600",
    badgeTextColor: "text-white",
    defaultRoute: "/pricing-dashboard",
    defaultRevenueTab: "pricing",
    contextBannerByRoute: {
      "/pricing-dashboard": "Pricing Team View — $61,370 at risk · 7 GPO conflicts · 4 contracts expiring",
      "/pricing/issue/:issueId": "Pricing Team View — Issue Intelligence · Review GPO conflict · Approve AI fix or follow prescribed actions",
      "/pricing/transaction/:orderId": "Pricing Team View — Transaction Lineage · Order-level pricing breakdown · Issue credit memo",
      "/pricing/closure/:issueId": "Pricing Team View — Resolution confirmed · Exposure recovered · Dashboard KPIs updated",
      "/revenue": "Pricing Team View — 5 GPO conflicts · $4,620 current period chargeback risk",
      "/revenue?tab=pricing":
        "Pricing Team View — variance queue: triage contract vs charged price, credit memos, and SAP master updates from GPO intelligence.",
      "/revenue?tab=agreement-expiry":
        "Pricing Team View — renewal window contracts; pair with pricing queue when the same contract_id shows open variance.",
      "/commercial": "Pricing Team View — $3.88M GPO exposure. Click the KPI to open Revenue → Pricing work queue.",
      "/alerts": "Pricing Team View — showing GPO and contract alerts requiring your action today",
    },
  },
  {
    id: "tax_compliance",
    label: "Tax & Compliance Team",
    shortLabel: "Tax",
    personaName: "Tax & Compliance Team",
    badgeColor: "bg-yellow-500",
    badgeTextColor: "text-slate-900",
    defaultRoute: "/tax-dashboard",
    defaultRevenueTab: "tax",
    contextBannerByRoute: {
      "/tax-dashboard": "",
      "/tax/issue/:issueId": "",
      "/tax/transaction/:orderId": "",
      "/tax/closure/:issueId": "",
      "/revenue": "Tax & Compliance View — jurisdiction mismatches and exemption certificate monitoring",
      "/alerts": "Tax & Compliance View — showing jurisdiction mismatch and certificate alerts",
      "/tax-certificate-monitoring": "Tax & Compliance View — monitor expiring certificates and exemption suspension risk",
    },
  },
  {
    id: "data_steward",
    label: "Data Steward",
    shortLabel: "Steward",
    personaName: "Jordan Lee",
    badgeColor: "bg-indigo-600",
    badgeTextColor: "text-white",
    defaultRoute: "/steward-dashboard",
    contextBannerByRoute: {
      "/steward-dashboard": "",
      "/steward/issue/:issueId": "Data Governance Dashboard — $89,240 at risk · 5 hierarchy mismatches · 3 orphan records · 6 tax jurisdiction gaps · $2.1M annualized exposure",
      "/steward/record/:customerId": "Data Governance Dashboard — $89,240 at risk · 5 hierarchy mismatches · 3 orphan records · 6 tax jurisdiction gaps · $2.1M annualized exposure",
      "/steward/closure/:issueId": "Data Governance Dashboard — $89,240 at risk · 5 hierarchy mismatches · 3 orphan records · 6 tax jurisdiction gaps · $2.1M annualized exposure",
    },
  },
];

export const VIEWING_AS_ROLES = ROLES.filter((r) => VIEWING_AS_ROLE_IDS.includes(r.id));

interface RoleContextType {
  currentRole: Role;
  setRole: (roleId: RoleId) => void;
  accountType: "admin" | "user" | null;
}

function resolveRoleForAccount(accountType: "admin" | "user" | null): Role {
  if (accountType === "admin") {
    return ROLES.find((r) => r.id === "admin") ?? ROLES[0];
  }
  if (accountType === "user") {
    try {
      const saved = sessionStorage.getItem(USER_PERSONA_STORAGE_KEY) as RoleId | null;
      if (saved && saved !== "admin" && ROLES.some((r) => r.id === saved)) {
        return ROLES.find((r) => r.id === saved)!;
      }
    } catch {
      /* ignore */
    }
    return ROLES.find((r) => r.id === "admin") ?? ROLES[0];
  }
  return ROLES[0];
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { accountType } = useAuth();
  const navigate = useNavigate();

  const [currentRole, setCurrentRole] = useState<Role>(() => resolveRoleForAccount(accountType));

  useEffect(() => {
    setCurrentRole(resolveRoleForAccount(accountType));
  }, [accountType]);

  const setRole = (roleId: RoleId) => {
    const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
    setCurrentRole(role);
    if (accountType === "user") {
      try {
        sessionStorage.setItem(USER_PERSONA_STORAGE_KEY, roleId);
      } catch {
        /* ignore */
      }
    }
    navigate(role.defaultRoute);
  };

  return <RoleContext.Provider value={{ currentRole, setRole, accountType }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
