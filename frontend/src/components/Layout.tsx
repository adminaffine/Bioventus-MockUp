import { memo, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  GitBranch,
  Shield,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  Sun,
  Moon,
  Scale,
  Pill,
  ClipboardList,
  PackageSearch,
  BookOpen,
  ChevronDown,
  Check,
  Bell,
  Network,
  DollarSign,
  Zap,
  Building2,
  Target,
  BriefcaseBusiness,
  FileClock,
  ReceiptText,
  BadgeDollarSign,
  CopyCheck,
  Calendar,
  LogOut,
} from "lucide-react";
import { cn } from "../lib/utils";
import { DATE_DISPLAY_FORMAT_OPTIONS, type DateDisplayFormatId } from "../lib/displayDate";
import { useDateFormat } from "../context/DateFormatContext";
import { EXECUTIVE_ROLE_IDS, type RoleId, VIEWING_AS_ROLES, useRole } from "../context/RoleContext";
import { useAuth } from "../context/AuthContext";
import { useAlerts } from "../context/AlertContext";
import { RoleContextBanner } from "./RoleContextBanner";
import { api, type AlertItem } from "../services/api";
import {
  TAX_TEAM_SECTION,
  canAccessTaxTeamNav,
  taxTeamNavItems,
} from "../config/taxTeamNav";
import {
  PRICING_TEAM_SECTION,
  canAccessPricingTeamNav,
  pricingTeamNavItems,
} from "../config/pricingTeamNav";
import {
  canAccessStewardNav,
  stewardNavItems,
  STEWARD_TEAM_SECTION,
} from "../config/stewardTeamNav";
import { canAccessCFOTeamNav, cfoTeamNavItems, CFO_TEAM_SECTION } from "../config/cfoTeamNav";
import { canAccessCCOTeamNav, ccoTeamNavItems, CCO_TEAM_SECTION } from "../config/ccoTeamNav";
import { canAccessVPTeamNav, vpTeamNavItems, VP_TEAM_SECTION } from "../config/vpTeamNav";

type NavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: boolean;
  allowedRoles?: RoleId[];
  /** When set, overrides default pathname / full-path matching for active styles */
  isActive?: (loc: { pathname: string; search: string }) => boolean;
};

function navItemIsActive(item: NavItem, pathname: string, search: string): boolean {
  if (item.isActive) return item.isActive({ pathname, search });
  const full = `${pathname}${search}`;
  if (item.path.includes("?")) return full === item.path;
  return pathname === item.path;
}

const nav: NavItem[] = [
  { path: "/", label: "Executive Dashboard", icon: LayoutDashboard },
  { path: "/profiler", label: "Data Quality Profiler", icon: Database },
  { path: "/products", label: "Product Intelligence", icon: PackageSearch },
  { path: "/integration", label: "Data Integration & Lineage", icon: GitBranch },
  { path: "/trend", label: "Data Quality Trend Simulation", icon: TrendingUp },
  { path: "/compliance", label: "Regulatory Compliance", icon: Shield },
  { path: "/governance", label: "Data Integrity & Governance Command Center", icon: Scale },
  { path: "/rx-integrity", label: "Rx Integrity", icon: Pill },
  { path: "/pii-shield", label: "PII Shield", icon: ShieldCheck, badge: true },
  { path: "/upload", label: "Upload & Analyze", icon: UploadCloud },
  { path: "/capa", label: "CAPA Tracker", icon: ClipboardList },
  { path: "/csuite", label: "C-Suite Dashboard", icon: Building2 },
  { path: "/commercial", label: "Commercial Dashboard", icon: TrendingUp },
  { path: "/hierarchy", label: "Customer Hierarchy", icon: Network },
  {
    path: "/revenue",
    label: "Revenue & Risk",
    icon: DollarSign,
    isActive: ({ pathname, search }) => {
      if (pathname !== "/revenue") return false;
      const t = new URLSearchParams(search).get("tab");
      if (t === "pricing" || t === "agreement-expiry") return false;
      return true;
    },
  },
  {
    path: "/revenue?tab=pricing",
    label: "Pricing Work Queue",
    icon: BriefcaseBusiness,
    allowedRoles: ["pricing_analyst"],
  },
  {
    path: "/revenue?tab=agreement-expiry",
    label: "Agreement Expiry",
    icon: FileClock,
    allowedRoles: ["pricing_analyst"],
  },
  {
    path: "/tax-certificate-monitoring",
    label: "Tax Certificate Monitoring",
    icon: ReceiptText,
    allowedRoles: ["tax_compliance", "cfo"],
  },
  {
    path: "/credit-exposure-queue",
    label: "Credit Exposure Queue",
    icon: BadgeDollarSign,
    allowedRoles: ["cfo"],
  },
  {
    path: "/duplicate-resolution-workbench",
    label: "Duplicate Workbench",
    icon: CopyCheck,
    allowedRoles: ["data_steward"],
  },
  {
    path: "/territory-integrity",
    label: "Sales Ops - Territory Integrity",
    icon: Target,
    allowedRoles: ["admin"],
  },
  { path: "/alerts", label: "Alert-to-Action", icon: Zap },
];

const applicationGuideItem = { path: "/application-guide", label: "Application Guide", icon: BookOpen };

const DEFAULT_SECTION_OPEN: Record<string, boolean> = {
  "EXECUTIVE & COMMAND": true,
  "CORE PLATFORM": true,
  "REVENUE PROTECTION": true,
  "RISK & CONTROLS": true,
  [TAX_TEAM_SECTION]: true,
  [PRICING_TEAM_SECTION]: true,
  [VP_TEAM_SECTION]: true,
  [STEWARD_TEAM_SECTION]: true,
  "DATA STEWARDSHIP": true,
  TOOLS: true,
};

function DateFormatControl({ darkMode }: { darkMode: boolean }) {
  const { formatId, setFormatId } = useDateFormat();
  return (
    <label className="flex items-center gap-2 shrink-0">
      <Calendar className="w-4 h-4 text-slate-500 shrink-0" aria-hidden />
      <span className="sr-only">Date display format</span>
      <select
        value={formatId}
        onChange={(e) => setFormatId(e.target.value as DateDisplayFormatId)}
        className={cn(
          "text-xs rounded-lg border px-2 py-1.5 max-w-[9.5rem]",
          darkMode ? "border-slate-600 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800"
        )}
        title="Date display format (this browser only)"
      >
        {DATE_DISPLAY_FORMAT_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const TOP_5_ALERT_STUBS: Array<{ id: string; severity: string; title: string; impact: number; owner: string }> = [
  { id: "ALT-013", severity: "Critical", title: "EXOGEN 4.0 Recalled — ORD-013 ($4,200)", impact: 4200, owner: "VP Quality" },
  { id: "ALT-014", severity: "Critical", title: "EXOGEN 4.0 Recalled — ORD-014 ($4,200)", impact: 4200, owner: "VP Quality" },
  { id: "ALT-009", severity: "High", title: "Credit Breach IDN-003 MedStar ($56,280)", impact: 56280, owner: "Credit & AR" },
  { id: "ALT-004", severity: "High", title: "GPO Conflict StimRouter CUST-1005 ($1,200)", impact: 1200, owner: "Pricing Analyst" },
  { id: "ALT-006", severity: "High", title: "GPO Conflict neXus CUST-1003 ($1,700)", impact: 1700, owner: "Pricing Analyst" },
];

function Layout({
  children,
  darkMode,
  setDarkMode,
}: {
  children: React.ReactNode;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}) {
  const ApplicationGuideIcon = applicationGuideItem.icon;
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, setRole } = useRole();
  const { logout } = useAuth();
  const viewingRoles = VIEWING_AS_ROLES;
  const { alertCount, acknowledgedIds } = useAlerts();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [topAlerts, setTopAlerts] = useState(TOP_5_ALERT_STUBS);
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(DEFAULT_SECTION_OPEN);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("layout.sidebar.width"));
      if (Number.isFinite(stored) && stored >= 220 && stored <= 420) return stored;
    } catch {}
    return 260;
  });
  const sidebarOpen = true;
  const isPricingPersona = currentRole.id === "pricing_analyst";
  const isTaxPersona = currentRole.id === "tax_compliance";
  const isStewardPersona = currentRole.id === "data_steward";
  const isCfoPersona = currentRole.id === "cfo";
  const isCcoPersona = currentRole.id === "cco";
  const isVpPersona = currentRole.id === "vp_director";
  const hasGlobalVisibility = EXECUTIVE_ROLE_IDS.includes(currentRole.id);
  const canAccessNavItem = (item: NavItem) => hasGlobalVisibility || !item.allowedRoles || item.allowedRoles.includes(currentRole.id);

  useEffect(() => {
    try {
      localStorage.setItem("layout.sidebar.width", String(sidebarWidth));
    } catch {}
  }, [sidebarWidth]);

  /** Tax team persona: collapse all sidebar groups except the four tax workflow pages */
  useEffect(() => {
    if (
      currentRole.id === "tax_compliance" ||
      currentRole.id === "pricing_analyst" ||
      currentRole.id === "data_steward" ||
      currentRole.id === "cfo" ||
      currentRole.id === "cco" ||
      currentRole.id === "vp_director"
    ) {
      setSectionOpen({
        "EXECUTIVE & COMMAND": false,
        "CORE PLATFORM": false,
        "REVENUE PROTECTION": false,
        "RISK & CONTROLS": false,
        "DATA STEWARDSHIP": false,
        TOOLS: false,
        [TAX_TEAM_SECTION]: currentRole.id === "tax_compliance",
        [PRICING_TEAM_SECTION]: currentRole.id === "pricing_analyst",
        [STEWARD_TEAM_SECTION]: currentRole.id === "data_steward",
        [CFO_TEAM_SECTION]: currentRole.id === "cfo",
        [CCO_TEAM_SECTION]: currentRole.id === "cco",
        [VP_TEAM_SECTION]: currentRole.id === "vp_director",
      });
    } else {
      setSectionOpen(DEFAULT_SECTION_OPEN);
    }
  }, [currentRole.id]);

  const startSidebarResize = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const minWidth = 220;
    const maxWidth = 420;

    const onMouseMove = (event: MouseEvent) => {
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth + (event.clientX - startX)));
      setSidebarWidth(next);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    api
      .getAlerts()
      .then((data) => {
        setTopAlerts(
          [...data.alerts]
            .sort((a: AlertItem, b: AlertItem) => b.dollar_impact - a.dollar_impact)
            .slice(0, 5)
            .map((a) => ({
              id: a.alert_id,
              severity: a.severity,
              title: a.title.length > 55 ? `${a.title.slice(0, 55)}…` : a.title,
              impact: a.dollar_impact,
              owner: a.primary_persona,
            }))
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(".role-switcher-container")) setDropdownOpen(false);
      if (!target.closest(".alert-bell-container")) setBellDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={cn("min-h-screen flex", darkMode ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900")}>
      <aside
        className={cn(
          "border-r flex flex-col relative",
          sidebarOpen ? "" : "w-16",
          darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
        )}
        style={sidebarOpen ? { width: `${sidebarWidth}px` } : undefined}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          {sidebarOpen && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-primary dark:text-primary-light truncate">Command Center</span>
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 truncate">Core Platform</span>
            </div>
          )}
        </div>
        <nav className="p-2 flex-1 overflow-y-auto">
          {!isPricingPersona && !isTaxPersona && !isStewardPersona && !isCfoPersona && !isCcoPersona && !isVpPersona && [
            { section: "", paths: ["/"] },
            { section: "EXECUTIVE & COMMAND", paths: ["/csuite", "/alerts"] },
            {
              section: "CORE PLATFORM",
              paths: ["/profiler", "/integration", "/compliance", "/governance", "/rx-integrity", "/trend", "/pii-shield", "/upload"],
            },
            {
              section: "REVENUE PROTECTION",
              paths: ["/commercial", "/revenue", "/revenue?tab=pricing", "/revenue?tab=agreement-expiry"],
            },
            { section: "RISK & CONTROLS", paths: ["/tax-certificate-monitoring", "/credit-exposure-queue", "/territory-integrity"] },
            { section: "DATA STEWARDSHIP", paths: ["/hierarchy", "/duplicate-resolution-workbench"] },
            { section: "TOOLS", paths: ["/capa", "/products"] },
          ].map((group) => (
            <div key={group.section || "top"}>
              {group.section && (
                <>
                  <hr className="border-slate-200 dark:border-slate-700 my-1" />
                  <button
                    type="button"
                    onClick={() => setSectionOpen((prev) => ({ ...prev, [group.section]: !prev[group.section] }))}
                    className="w-full flex items-center justify-between text-xs text-slate-400 px-3 mt-2 mb-1"
                  >
                    <span>{group.section}</span>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform",
                        sectionOpen[group.section] ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>
                </>
              )}
              {((group.section === "" &&
                currentRole.id !== "tax_compliance" &&
                currentRole.id !== "cfo" &&
                currentRole.id !== "cco") ||
                (group.section !== "" && sectionOpen[group.section])) &&
                nav
                  .filter((n) => group.paths.includes(n.path))
                  .filter(canAccessNavItem)
                  .map((item) => {
                    const { path, label, icon: Icon, badge } = item;
                    return (
            <Link
              key={path}
              to={path}
              title={path === "/pii-shield" ? "PII instances protected" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors relative",
                navItemIsActive(item, location.pathname, location.search)
                  ? "bg-primary text-white dark:bg-primary-light border-l-2 border-white"
                  : darkMode
                    ? "hover:bg-slate-700 text-slate-300"
                    : "hover:bg-slate-100 text-slate-600"
              )}
            >
              <Icon className="shrink-0 w-5 h-5" />
              {sidebarOpen && <span className="truncate">{label}</span>}
              {badge && path === "/pii-shield" && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" title="PII Shield — protected" />
              )}
            </Link>
                    );
                  })}
            </div>
          ))}
          {canAccessTaxTeamNav(currentRole.id) && (
            <div>
              <hr className="border-slate-200 dark:border-slate-700 my-1" />
              <button
                type="button"
                onClick={() => setSectionOpen((prev) => ({ ...prev, [TAX_TEAM_SECTION]: !prev[TAX_TEAM_SECTION] }))}
                className="w-full flex items-center justify-between text-xs text-slate-400 px-3 mt-2 mb-1 uppercase tracking-wide"
              >
                <span>{TAX_TEAM_SECTION}</span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    sectionOpen[TAX_TEAM_SECTION] ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
              {sectionOpen[TAX_TEAM_SECTION] &&
                taxTeamNavItems.map((item) => {
                  const { path, label, icon: Icon } = item;
                  const active = item.isActive
                    ? item.isActive({ pathname: location.pathname, search: location.search })
                    : location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={cn(
                        "flex items-center gap-3 pl-5 pr-3 py-2 rounded-lg mb-1 transition-colors text-sm border-l-2 border-transparent",
                        active
                          ? "bg-primary text-white dark:bg-primary-light border-l-white"
                          : darkMode
                            ? "hover:bg-slate-700 text-slate-300"
                            : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="shrink-0 w-4 h-4" />
                      {sidebarOpen && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
            </div>
          )}
          {canAccessPricingTeamNav(currentRole.id) && (
            <div>
              <hr className="border-slate-200 dark:border-slate-700 my-1" />
              <button
                type="button"
                onClick={() => setSectionOpen((prev) => ({ ...prev, [PRICING_TEAM_SECTION]: !prev[PRICING_TEAM_SECTION] }))}
                className="w-full flex items-center justify-between text-xs text-slate-400 px-3 mt-2 mb-1 uppercase tracking-wide"
              >
                <span>{PRICING_TEAM_SECTION}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOpen[PRICING_TEAM_SECTION] ? "rotate-0" : "-rotate-90")} />
              </button>
              {sectionOpen[PRICING_TEAM_SECTION] &&
                pricingTeamNavItems.map((item) => {
                  const { path, label, icon: Icon } = item;
                  const active = item.isActive
                    ? item.isActive({ pathname: location.pathname, search: location.search })
                    : location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={cn(
                        "flex items-center gap-3 pl-5 pr-3 py-2 rounded-lg mb-1 transition-colors text-sm border-l-2 border-transparent",
                        active
                          ? "bg-primary text-white dark:bg-primary-light border-l-white"
                          : darkMode
                            ? "hover:bg-slate-700 text-slate-300"
                            : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="shrink-0 w-4 h-4" />
                      {sidebarOpen && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
            </div>
          )}
          {canAccessVPTeamNav(currentRole.id) && (
            <div>
              <hr className="border-slate-200 dark:border-slate-700 my-1" />
              <button
                type="button"
                onClick={() => setSectionOpen((prev) => ({ ...prev, [VP_TEAM_SECTION]: !prev[VP_TEAM_SECTION] }))}
                className="w-full flex items-center justify-between text-xs text-slate-400 px-3 mt-2 mb-1 uppercase tracking-wide"
              >
                <span>{VP_TEAM_SECTION}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOpen[VP_TEAM_SECTION] ? "rotate-0" : "-rotate-90")} />
              </button>
              {sectionOpen[VP_TEAM_SECTION] &&
                vpTeamNavItems.map((item) => {
                  const { path, label, icon: Icon } = item;
                  const active = item.isActive
                    ? item.isActive({ pathname: location.pathname, search: location.search })
                    : location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={cn(
                        "flex items-center gap-3 pl-5 pr-3 py-2 rounded-lg mb-1 transition-colors text-sm border-l-2 border-transparent",
                        active
                          ? "bg-primary text-white dark:bg-primary-light border-l-white"
                          : darkMode
                            ? "hover:bg-slate-700 text-slate-300"
                            : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="shrink-0 w-4 h-4" />
                      {sidebarOpen && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
            </div>
          )}
          {canAccessStewardNav(currentRole.id) && (
            <div>
              <hr className="border-slate-200 dark:border-slate-700 my-1" />
              <button
                type="button"
                onClick={() => setSectionOpen((prev) => ({ ...prev, [STEWARD_TEAM_SECTION]: !prev[STEWARD_TEAM_SECTION] }))}
                className="w-full flex items-center justify-between text-xs text-slate-400 px-3 mt-2 mb-1 uppercase tracking-wide"
              >
                <span>{STEWARD_TEAM_SECTION}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOpen[STEWARD_TEAM_SECTION] ? "rotate-0" : "-rotate-90")} />
              </button>
              {sectionOpen[STEWARD_TEAM_SECTION] &&
                stewardNavItems.map((item) => {
                  const { path, label, icon: Icon } = item;
                  const active = item.isActive
                    ? item.isActive({ pathname: location.pathname, search: location.search })
                    : location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={cn(
                        "flex items-center gap-3 pl-5 pr-3 py-2 rounded-lg mb-1 transition-colors text-sm border-l-2 border-transparent",
                        active
                          ? "bg-primary text-white dark:bg-primary-light border-l-white"
                          : darkMode
                            ? "hover:bg-slate-700 text-slate-300"
                            : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="shrink-0 w-4 h-4" />
                      {sidebarOpen && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
            </div>
          )}
          {canAccessCFOTeamNav(currentRole.id) && (
            <div>
              <hr className="border-slate-200 dark:border-slate-700 my-1" />
              <button
                type="button"
                onClick={() => setSectionOpen((prev) => ({ ...prev, [CFO_TEAM_SECTION]: !prev[CFO_TEAM_SECTION] }))}
                className="w-full flex items-center justify-between text-xs text-slate-400 px-3 mt-2 mb-1 uppercase tracking-wide"
              >
                <span>{CFO_TEAM_SECTION}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOpen[CFO_TEAM_SECTION] ? "rotate-0" : "-rotate-90")} />
              </button>
              {sectionOpen[CFO_TEAM_SECTION] &&
                cfoTeamNavItems.map((item) => {
                  const { path, label, icon: Icon } = item;
                  const active = item.isActive
                    ? item.isActive({ pathname: location.pathname, search: location.search })
                    : location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={cn(
                        "flex items-center gap-3 pl-5 pr-3 py-2 rounded-lg mb-1 transition-colors text-sm border-l-2 border-transparent",
                        active
                          ? "bg-primary text-white dark:bg-primary-light border-l-white"
                          : darkMode
                            ? "hover:bg-slate-700 text-slate-300"
                            : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="shrink-0 w-4 h-4" />
                      {sidebarOpen && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
            </div>
          )}
          {canAccessCCOTeamNav(currentRole.id) && (
            <div>
              <hr className="border-slate-200 dark:border-slate-700 my-1" />
              <button
                type="button"
                onClick={() => setSectionOpen((prev) => ({ ...prev, [CCO_TEAM_SECTION]: !prev[CCO_TEAM_SECTION] }))}
                className="w-full flex items-center justify-between text-xs text-slate-400 px-3 mt-2 mb-1 uppercase tracking-wide"
              >
                <span>{CCO_TEAM_SECTION}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sectionOpen[CCO_TEAM_SECTION] ? "rotate-0" : "-rotate-90")} />
              </button>
              {sectionOpen[CCO_TEAM_SECTION] &&
                ccoTeamNavItems.map((item) => {
                  const { path, label, icon: Icon } = item;
                  const active = item.isActive
                    ? item.isActive({ pathname: location.pathname, search: location.search })
                    : location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={cn(
                        "flex items-center gap-3 pl-5 pr-3 py-2 rounded-lg mb-1 transition-colors text-sm border-l-2 border-transparent",
                        active
                          ? "bg-primary text-white dark:bg-primary-light border-l-white"
                          : darkMode
                            ? "hover:bg-slate-700 text-slate-300"
                            : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <Icon className="shrink-0 w-4 h-4" />
                      {sidebarOpen && <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
            </div>
          )}
          {!isPricingPersona && !isTaxPersona && !isStewardPersona && !isCfoPersona && !isCcoPersona && !isVpPersona && (
            <Link
              to={applicationGuideItem.path}
              className={cn(
                "mt-3 flex items-center gap-3 px-3 py-2 rounded-lg transition-colors italic",
                location.pathname === applicationGuideItem.path
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border-l-2 border-indigo-500"
                  : "text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              )}
            >
              <ApplicationGuideIcon className="shrink-0 w-5 h-5" />
              {sidebarOpen && <span className="truncate">{applicationGuideItem.label}</span>}
            </Link>
          )}
        </nav>
        <span className="text-xs text-slate-400 px-3 pb-2 block">v2.0 · BV Application</span>
        <button
          type="button"
          aria-label="Resize sidebar"
          onMouseDown={startSidebarResize}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-indigo-300/60 dark:hover:bg-indigo-500/60 transition-colors"
          title="Drag to resize menu"
        />
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header
          className={cn(
            "px-6 py-3 border-b flex items-center justify-between shrink-0",
            darkMode ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800"
          )}
        >
          <span className="font-medium">BV · Live Application Environment · Synthetic Data Only</span>
          <div className="flex items-center gap-2">
            <div className="alert-bell-container relative">
              <button
                type="button"
                onClick={() => setBellDropdownOpen((p) => !p)}
                className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Alerts"
              >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {alertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </button>
              {bellDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Active Alerts ({alertCount})</span>
                    <span className="text-xs text-slate-500">$134,810 total exposure</span>
                  </div>
                  {topAlerts.filter((a) => !acknowledgedIds.has(a.id)).slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                      onClick={() => {
                        navigate("/alerts");
                        setBellDropdownOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-semibold shrink-0 mt-0.5 ${
                            String(alert.severity).toUpperCase() === "CRITICAL"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">{alert.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            ${alert.impact.toLocaleString()} · {alert.owner}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/alerts");
                        setBellDropdownOpen(false);
                      }}
                      className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                    >
                      View All {alertCount} Alerts →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <DateFormatControl darkMode={darkMode} />

            <div className="role-switcher-container relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((p) => !p)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                <span className={`${currentRole.badgeColor} ${currentRole.badgeTextColor} text-xs px-2 py-0.5 rounded-full font-semibold`}>{currentRole.shortLabel}</span>
                <span className="text-slate-700 dark:text-slate-200">Viewing as: {currentRole.label}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 py-1">
                  {viewingRoles.map((role) => (
                    <button
                      type="button"
                      key={role.id}
                      onClick={() => {
                        setRole(role.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                        currentRole.id === role.id ? "bg-indigo-50 dark:bg-indigo-900/20" : ""
                      }`}
                    >
                      <span
                        className={`${role.badgeColor} ${role.badgeTextColor} text-xs px-2 py-0.5 rounded-full font-semibold text-center leading-tight`}
                      >
                        {role.shortLabel}
                      </span>
                      <div className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                        {role.label}
                      </div>
                      {currentRole.id === role.id ? (
                        <Check className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden />
                      ) : (
                        <span className="w-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600",
                darkMode ? "hover:bg-slate-700 text-slate-200" : "hover:bg-slate-100 text-slate-700",
              )}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign out</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600",
                darkMode ? "hover:bg-slate-700 text-slate-200" : "hover:bg-slate-100 text-slate-700"
              )}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="text-sm">{darkMode ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <RoleContextBanner
            route={location.pathname === "/revenue" ? `/revenue${location.search}` : location.pathname}
          />
          {children}
        </div>
      </main>
    </div>
  );
}

export default memo(Layout);
