import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export type RoleId =
  | "admin"
  | "cdo"
  | "cco"
  | "vp_quality"
  | "pricing_analyst"
  | "tax_compliance"
  | "commercial_ops"
  | "cfo"
  | "credit_ar"
  | "market_access"
  | "sales_leadership"
  | "revenue_assurance";

export const EXECUTIVE_ROLE_IDS: RoleId[] = ["admin", "cdo", "cco", "cfo"];

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
    id: "cdo",
    label: "CDO — Chief Data Officer",
    shortLabel: "CDO",
    personaName: "Marcus Johnson",
    badgeColor: "bg-violet-600",
    badgeTextColor: "text-white",
    defaultRoute: "/",
    contextBannerByRoute: {
      "/": "CDO View — 3 QMSR gaps · 4 MDR violations · CAPA-001 overdue 47+ days",
      "/profiler": "CDO View — patient_support: use issue=mdr or issue=hipaa deep links from the dashboard to jump to field-level gaps.",
      "/governance": "CDO View — You own product_catalog dataset. 5 open issues assigned to you.",
    },
  },
  {
    id: "cco",
    label: "CCO — Chief Compliance Officer",
    shortLabel: "CCO",
    personaName: "Chief Compliance Officer",
    badgeColor: "bg-rose-600",
    badgeTextColor: "text-white",
    defaultRoute: "/compliance",
    contextBannerByRoute: {
      "/compliance": "CCO View — FDA QMSR effective Feb 2 2026 · 3 open gaps · HIPAA consent violations active",
      "/profiler": "CCO View — Profiler shows patient_support MDR and consent columns tied to FDA MDR / HIPAA scoring.",
      "/capa": "CCO View — 2 CAPAs overdue. CAPA-001 MDR gap is highest regulatory risk.",
      "/pii-shield": "CCO View — Consent narrative: ?view=consent_gaps&dataset=patient_support&highlight=CASE-xxxx filters preview + audit; leaf actions link to Profiler, Compliance, CAPA.",
    },
  },
  {
    id: "vp_quality",
    label: "VP Quality & Regulatory Affairs",
    shortLabel: "VP Quality",
    personaName: "Dr. Sarah Kim",
    badgeColor: "bg-orange-500",
    badgeTextColor: "text-white",
    defaultRoute: "/capa",
    contextBannerByRoute: {
      "/capa": "VP Quality View — Dr. Sarah Kim · CAPA-001 overdue · 4 adverse events need MDR filing today",
      "/profiler": "VP Quality View — patient_support Profiler rows; SLA deep links highlight the MDR or consent issue line.",
      "/rx-integrity": "VP Quality View — 2 suspended/expired physician licenses. Prescriptions filled without flag.",
      "/": "VP Quality View — EXOGEN 4.0 recalled. 4 adverse events. MDR window elapsed.",
    },
  },
  {
    id: "pricing_analyst",
    label: "Pricing Analyst",
    shortLabel: "Pricing",
    personaName: "Pricing Analyst",
    badgeColor: "bg-emerald-600",
    badgeTextColor: "text-white",
    defaultRoute: "/revenue?tab=pricing",
    defaultRevenueTab: "pricing",
    contextBannerByRoute: {
      "/revenue": "Pricing Team View — 5 GPO conflicts · $4,620 current period · $3.88M annualized chargeback risk",
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
    label: "Tax & Compliance",
    shortLabel: "Tax",
    personaName: "Tax & Compliance Analyst",
    badgeColor: "bg-yellow-500",
    badgeTextColor: "text-slate-900",
    defaultRoute: "/revenue",
    defaultRevenueTab: "tax",
    contextBannerByRoute: {
      "/revenue": "Tax & Compliance View — 25 jurisdiction mismatches · $6,510 exposure · 4 expired exemption certs",
      "/alerts": "Tax & Compliance View — showing jurisdiction mismatch and certificate alerts",
      "/tax-certificate-monitoring": "Tax & Compliance View — monitor expiring certificates and exemption suspension risk",
    },
  },
  {
    id: "commercial_ops",
    label: "Commercial Operations",
    shortLabel: "Comm. Ops",
    personaName: "Linda Torres",
    badgeColor: "bg-sky-600",
    badgeTextColor: "text-white",
    defaultRoute: "/hierarchy",
    contextBannerByRoute: {
      "/hierarchy": "Commercial Ops View — Linda Torres · 1 orphaned clinic with active order · IQVIA delta requires re-mapping",
      "/commercial": "Commercial Ops View — $37,200 unmapped revenue (5 orphan customers + ghost rep orders)",
      "/alerts": "Commercial Ops View — showing orphaned clinic, ghost rep, and hierarchy alerts",
      "/duplicate-resolution-workbench": "Commercial Ops View — prioritize duplicate merges to protect hierarchy, pricing, and downstream fulfillment",
    },
  },
  {
    id: "cfo",
    label: "CFO — Chief Financial Officer",
    shortLabel: "CFO",
    personaName: "Chief Financial Officer",
    badgeColor: "bg-indigo-700",
    badgeTextColor: "text-white",
    defaultRoute: "/csuite",
    contextBannerByRoute: {
      "/csuite": "CFO View — $15,626 margin at risk · $2.39M annualized · 7 SLA breaches · $88,780 financial impact",
      "/commercial": "CFO View — $59,110 at-risk revenue · $1.63M COPQ · $2.39M margin leakage projected annually",
      "/revenue": "CFO View — Revenue quality: $4,620 GPO overcharges + $29,100 DSO collection risk",
    },
  },
  {
    id: "credit_ar",
    label: "Credit & AR",
    shortLabel: "Credit & AR",
    personaName: "Finance Team",
    badgeColor: "bg-teal-600",
    badgeTextColor: "text-white",
    defaultRoute: "/hierarchy",
    contextBannerByRoute: {
      "/hierarchy": "Credit & AR View — IDN-003 MedStar at 28.1% utilization ($56,280 of $200,000 limit) · SLA-005 breached 48 hours",
      "/csuite": "Credit & AR View — 6 high-DSO orders totalling $29,100 tied to data quality errors",
      "/alerts": "Credit & AR View — showing Credit & AR alerts requiring your action",
      "/credit-exposure-queue": "Credit & AR View — review IDN-level utilization and prioritize hold/release decisions",
    },
  },
  {
    id: "market_access",
    label: "Market Access & Contracting",
    shortLabel: "Market Access",
    personaName: "Market Access Team",
    badgeColor: "bg-cyan-600",
    badgeTextColor: "text-white",
    defaultRoute: "/revenue",
    defaultRevenueTab: "market-access",
    contextBannerByRoute: {
      "/revenue": "Market Access View — 2 contracts expiring 28 days · CHB-003/004 dispute deadline 12 days · 7 distributors off-contract",
      "/revenue?tab=agreement-expiry":
        "Market Access View — renewal queue on Revenue & Risk; coordinate with Pricing when contract_id ties to an open GPO variance.",
      "/alerts": "Market Access View — showing contract expiry, chargeback, and distributor alerts",
      "/csuite": "Market Access View — $610,000 onboarding pipeline · 7 stalled applications blocking sales",
    },
  },
  {
    id: "sales_leadership",
    label: "Sales Leadership (Sales Ops) & Territory Management",
    shortLabel: "Sales Lead",
    personaName: "Sales Leadership Team",
    badgeColor: "bg-fuchsia-600",
    badgeTextColor: "text-white",
    defaultRoute: "/territory-integrity",
    contextBannerByRoute: {
      "/territory-integrity":
        "Sales Ops View — territory exceptions ranked by commission impact with direct remediation ownership",
      "/alerts": "Sales Leadership View — showing misalignment and revenue impact alerts requiring assignment today",
    },
  },
  {
    id: "revenue_assurance",
    label: "Revenue Assurance & Pricing Integrity",
    shortLabel: "Rev Assurance",
    personaName: "Revenue Assurance Team",
    badgeColor: "bg-lime-600",
    badgeTextColor: "text-slate-900",
    defaultRoute: "/revenue?tab=pricing",
    defaultRevenueTab: "pricing",
    contextBannerByRoute: {
      "/revenue?tab=pricing":
        "Revenue Assurance View — contract variance queue (same rows as GPO conflicts) plus Agreement expiry tab for renewal risk.",
      "/revenue?tab=agreement-expiry":
        "Revenue Assurance View — expiring agreements; cross-check contract_id against the pricing queue before renewals go live.",
      "/alerts": "Revenue Assurance View — showing pricing integrity and dispute alerts pending triage",
      "/duplicate-resolution-workbench": "Revenue Assurance View — duplicate entities can distort contract eligibility and revenue leakage metrics",
    },
  },
];

interface RoleContextType {
  currentRole: Role;
  setRole: (roleId: RoleId) => void;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role>(ROLES[0]);
  const navigate = useNavigate();

  const setRole = (roleId: RoleId) => {
    const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
    setCurrentRole(role);
    navigate(role.defaultRoute);
  };

  return <RoleContext.Provider value={{ currentRole, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
