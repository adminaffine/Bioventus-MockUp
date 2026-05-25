import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  AlertOctagon,
  Bell,
  MapPin,
  Receipt,
  TrendingDown,
  Unlink,
  ChevronDown,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type AlertItem } from "../services/api";
import { KPICardSkeleton } from "../components/skeletons/KPICardSkeleton";
import { ChartSkeleton } from "../components/skeletons/ChartSkeleton";
import ActionPanel from "../components/ActionPanel";
import InfoTooltip from "../components/InfoTooltip";
import DetailModal from "../components/DetailModal";
import { TOOLTIP_COMM_AT_RISK, TOOLTIP_COMM_COPQ, TOOLTIP_COMM_COPQ_DONUT, TOOLTIP_COMM_GPO, TOOLTIP_COMM_REVENUE_CAT, TOOLTIP_CSUITE_COMMISSION } from "../lib/tooltipContent";
import { useDateFormat } from "../context/DateFormatContext";

type CommercialSummary = Awaited<ReturnType<typeof api.getCommercialSummary>>;
type AlertsPayload = Awaited<ReturnType<typeof api.getAlerts>>;
type GPOPayload = Awaited<ReturnType<typeof api.getGPOContracts>>;
type TerritoryPayload = Awaited<ReturnType<typeof api.getTerritoryAlignment>>;
type OnboardingPayload = Awaited<ReturnType<typeof api.getOnboarding>>;
type ChargebackPayload = Awaited<ReturnType<typeof api.getChargebacks>>;

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatCompactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

function categoryColor(category: string): string {
  if (category === "PNS Devices") return "#4f46e5";
  if (category === "Surgical / Ultrasonics") return "#7c3aed";
  if (category === "KOA / Pain Treatments") return "#0ea5e9";
  if (category === "Fracture Care (RECALLED)") return "#e11d48";
  return "#10b981";
}

function copqColor(category: string): string {
  if (category === "Orphan Customer Orders") return "#f59e0b";
  if (category === "Recalled Product Orders") return "#e11d48";
  if (category === "Negative Order Exposure") return "#f97316";
  if (category === "Missing Revenue Recog.") return "#94a3b8";
  if (category === "Ghost Sales Rep Orders") return "#8b5cf6";
  return "#64748b";
}

function alertNavigation(alert: AlertItem): string {
  if (alert.alert_id === "ALT-013") return "/capa";
  if (alert.alert_id === "ALT-014") return "/capa";
  if (alert.alert_id === "ALT-009") return "/credit-exposure-queue";
  if (alert.alert_id === "ALT-004" || alert.alert_id === "ALT-006") return "/revenue?tab=gpo";
  return `${alert.linked_screen}${alert.linked_filter ? `?${alert.linked_filter}` : ""}`;
}

export default function CommercialDashboard() {
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const isDark = document.documentElement.classList.contains("dark");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommercialSummary | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsPayload | null>(null);
  const [gpoData, setGpoData] = useState<GPOPayload | null>(null);
  const [territoryData, setTerritoryData] = useState<TerritoryPayload | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingPayload | null>(null);
  const [chargebackData, setChargebackData] = useState<ChargebackPayload | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [recalledPopoverOpen, setRecalledPopoverOpen] = useState(false);
  const [orphanPopoverOpen, setOrphanPopoverOpen] = useState(false);
  const [accountModalId, setAccountModalId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryRes, alertsRes, gpoRes, territoryRes, onboardingRes, chargebackRes] = await Promise.all([
          api.getCommercialSummary(),
          api.getAlerts(),
          api.getGPOContracts(),
          api.getTerritoryAlignment(),
          api.getOnboarding(),
          api.getChargebacks(),
        ]);
        setSummary(summaryRes);
        setAlertsData(alertsRes);
        setGpoData(gpoRes);
        setTerritoryData(territoryRes);
        setOnboardingData(onboardingRes);
        setChargebackData(chargebackRes);
        setLastRefreshed(new Date().toLocaleString());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load commercial dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <ChartSkeleton height={320} />
          </div>
          <div className="xl:col-span-2">
            <ChartSkeleton height={320} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary || !alertsData || !gpoData || !territoryData || !onboardingData || !chargebackData) {
    return <div className="p-4 text-rose-600 dark:text-rose-400">{error ?? "No commercial data available."}</div>;
  }

  const topAlerts = [...alertsData.alerts].sort((a, b) => b.dollar_impact - a.dollar_impact).slice(0, 5);
  const accounts = summary.top_accounts_by_revenue;

  const orphanSlice = summary.copq_breakdown.find((item) => item.filter === "orphan");
  const recalledSlice = summary.copq_breakdown.find((item) => item.filter === "recalled");

  const handleCategoryClick = (category: string) => {
    if (category === "Fracture Care (RECALLED)") {
      setRecalledPopoverOpen(true);
      return;
    }
    if (category === "PNS Devices") {
      navigate("/revenue?tab=gpo&filter=pns");
      return;
    }
    navigate("/profiler");
  };

  const handleCopqSliceClick = (filter: string) => {
    if (filter === "orphan") {
      setOrphanPopoverOpen(true);
      return;
    }
    if (filter === "recalled") navigate("/capa?highlight=CAPA-004");
    if (filter === "negative") navigate("/profiler?dataset=sales_orders&filter=negative");
    if (filter === "no_rev") navigate("/profiler?dataset=sales_orders&filter=no_rev");
    if (filter === "ghost_rep") navigate("/revenue?tab=copq&filter=ghost_rep");
  };


  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Commercial Intelligence Dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Revenue risk, GPO compliance, and commercial operations overview — BV LLC
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Data period: Current · {alertsData.open_count} active alerts · Last refreshed: {lastRefreshed}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiTile
          label="Total At-Risk Revenue"
          value={formatMoney(summary.total_at_risk_revenue)}
          subtitle="Recalled · Orphan · Negative · Missing rev. · Ghost rep"
          icon={<AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          intent="rose"
          onClick={() => navigate("/revenue?tab=copq")}
          tooltip={TOOLTIP_COMM_AT_RISK}
        />
        <KpiTile
          label="Est. Annual COPQ"
          value={formatCompactMoney(summary.copq_annual_estimate)}
          subtitle="Based on 18% rework rate × 153× volume"
          icon={<TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          intent="rose"
          onClick={() => navigate("/revenue?tab=copq")}
          tooltip={TOOLTIP_COMM_COPQ}
        />
        <KpiTile
          label="GPO Annualized Exposure"
          value={formatCompactMoney(summary.gpo_annualized)}
          subtitle={`${gpoData.conflict_count} pricing conflicts · $${summary.gpo_conflict_current.toLocaleString()} current period`}
          icon={<Receipt className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          intent="rose"
          onClick={() => navigate("/revenue?tab=pricing")}
          tooltip={TOOLTIP_COMM_GPO}
        />
        <KpiTile
          label="Active Alerts"
          value={String(alertsData.total_alerts)}
          subtitle={`$${alertsData.total_dollar_impact.toLocaleString()} total dollar impact`}
          icon={<Bell className={`w-5 h-5 text-amber-600 dark:text-amber-400 ${alertsData.critical > 0 ? "animate-pulse" : ""}`} />}
          intent="amber"
          onClick={() => navigate("/alerts")}
          badges={[
            { label: `${alertsData.critical} Critical`, className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
            { label: `${alertsData.high} High`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
          ]}
        />
        <KpiTile
          label="Unmapped Revenue"
          value={formatMoney(summary.unmapped_revenue)}
          subtitle="5 orphan customers · 4 ghost rep orders"
          icon={<Unlink className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          intent="amber"
          onClick={() => navigate("/hierarchy?filter=orphan")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 relative">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Revenue by Product Category (Current Period) <InfoTooltip content={TOOLTIP_COMM_REVENUE_CAT} /></h3>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart layout="vertical" data={summary.revenue_by_category} margin={{ left: 30, right: 40 }}>
              <XAxis type="number" tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
              <YAxis type="category" dataKey="category" width={200} tick={{ fill: isDark ? "#94a3b8" : "#475569", fontSize: 12 }} />
              <Tooltip
                formatter={(v) => `$${Number(v).toLocaleString()}`}
                contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0" }}
              />
              <Bar
                dataKey="revenue"
                radius={[0, 4, 4, 0]}
                onClick={(data) => handleCategoryClick((data as { category: string }).category)}
                className="cursor-pointer"
              >
                {summary.revenue_by_category.map((entry, i) => (
                  <Cell key={i} fill={categoryColor(entry.category)} />
                ))}
                <LabelList dataKey="revenue" position="right" formatter={(v: number) => `$${v.toLocaleString()}`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {recalledPopoverOpen && (
            <div className="absolute right-4 top-16 z-20 w-96 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 p-3 shadow-lg">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                4 EXOGEN 4.0 orders placed after recall date {formatDate("2025-09-15")}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Orders: ORD-013, ORD-014, ORD-015, ORD-016</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Total: $16,800 · All at CUST-1026/1027/1028</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => navigate("/capa?highlight=CAPA-004")} className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-sm">
                  View CAPA-004 →
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/revenue?tab=copq&filter=recalled")}
                  className="border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-300"
                >
                  View Orders →
                </button>
              </div>
              <button type="button" onClick={() => setRecalledPopoverOpen(false)} className="text-xs text-slate-500 mt-2">
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 relative">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">COPQ Breakdown — {formatMoney(summary.total_at_risk_revenue)} at risk <InfoTooltip content={TOOLTIP_COMM_COPQ_DONUT} /></h3>
          <div className="relative h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary.copq_breakdown}
                  dataKey="amount"
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  onClick={(entry) => handleCopqSliceClick((entry as { filter: string }).filter)}
                  className="cursor-pointer"
                >
                  {summary.copq_breakdown.map((entry, i) => (
                    <Cell key={i} fill={copqColor(entry.category)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center -mt-4">
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatMoney(summary.total_at_risk_revenue)}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">At Risk</span>
            </div>
          </div>
          <div className="space-y-1">
            {summary.copq_breakdown.map((item) => (
              <button
                key={item.category}
                type="button"
                onClick={() => handleCopqSliceClick(item.filter)}
                className="w-full text-left flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-700/40 rounded px-2 py-1"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: copqColor(item.category) }} />
                  {item.category}
                </span>
                <span className="text-slate-500 dark:text-slate-400">${item.amount.toLocaleString()} · {item.pct}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {orphanPopoverOpen && orphanSlice && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            5 orders reference customers not in Customer Master (58%, ${orphanSlice.amount.toLocaleString()})
          </p>
          <div className="text-xs mt-2 text-slate-700 dark:text-slate-300 space-y-1">
            <p>ORD-009 CUST-9901 DUROLANE $850</p>
            <p>ORD-010 CUST-9902 StimRouter $12,000</p>
            <p>ORD-011 CUST-9903 DUROLANE $850</p>
            <p>ORD-012 CUST-9904 StimRouter $12,000</p>
            <p>ORD-024 CUST-1013 neXus System $8,500</p>
            <p>Revenue unattributable to any IDN.</p>
          </div>
          <ActionPanel
            severity="high"
            primaryPersona="Commercial Ops"
            ownerName="Linda Torres"
            actions={[
              { step: 1, description: "Search legacy CRM for CUST-9901 to CUST-9904 and CUST-1013" },
              { step: 2, description: "Restore customer master records or create placeholder records" },
              { step: 3, description: "Enforce FK constraint between sales_orders and customer_master" },
            ]}
            ctaButtons={[
              { label: "View in Profiler", navigateTo: "/profiler?dataset=sales_orders&filter=orphan", variant: "primary" },
              { label: "View Alert ALT-003", navigateTo: "/alerts", variant: "secondary" },
            ]}
          />
        </div>
      )}

      {recalledSlice && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Top Accounts by Revenue</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Click any account to view hierarchy details</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left py-2">Rank</th>
                  <th className="text-left py-2">Account Name</th>
                  <th className="text-left py-2">Revenue</th>
                  <th className="text-left py-2">Risk Flag</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((row, index) => {
                  const accountId = String((row.idn_id ?? row.customer_id ?? `row-${index}`) as string);
                  const isRisk = Boolean(row.at_risk);
                  const isIdn003 = row.idn_id === "IDN-003";
                  const name = String((row.idn_name ?? row.name ?? row.customer_id ?? "Unknown") as string);
                  const navTarget = isIdn003
                    ? "/hierarchy?idn=IDN-003"
                    : row.customer_id
                      ? `/hierarchy?customer=${String(row.customer_id)}`
                      : "/hierarchy";
                  return (
                    <Fragment key={accountId}>
                      <tr
                        key={accountId}
                        className={`border-t border-slate-100 dark:border-slate-700 cursor-pointer ${isRisk ? "bg-amber-50 dark:bg-amber-900/10" : ""}`}
                        onClick={() => {
                          if (isIdn003) {
                            setAccountModalId("IDN-003");
                            return;
                          }
                          navigate(navTarget);
                        }}
                      >
                        <td className="py-2">{index + 1}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            {isIdn003 && <ChevronDown className="w-3 h-3" />}
                            <span>{isIdn003 ? "IDN-003 · 4 subsidiaries" : name}</span>
                          </div>
                        </td>
                        <td className={`py-2 ${isRisk ? "text-rose-600 dark:text-rose-300 font-medium" : ""}`}>${Number(row.revenue).toLocaleString()}</td>
                        <td className="py-2">
                          {isRisk ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">⚠ At Risk</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">✓ Clean</span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(navTarget);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 text-xs"
                          >
                            → View
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Top Alerts by Dollar Impact</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Sorted by financial exposure — click to take action</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left py-2">Alert</th>
                  <th className="text-left py-2">Impact</th>
                  <th className="text-left py-2">Persona</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {topAlerts.map((alert) => (
                  <tr
                    key={alert.alert_id}
                    className="border-t border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    onClick={() => navigate(alertNavigation(alert))}
                  >
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            alert.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="truncate max-w-[220px]">{alert.title}</span>
                      </div>
                    </td>
                    <td className={`py-2 ${["CRITICAL", "HIGH"].includes(alert.severity) ? "text-rose-600 dark:text-rose-300 font-medium" : ""}`}>
                      ${alert.dollar_impact.toLocaleString()}
                    </td>
                    <td className="py-2 text-xs">{alert.primary_persona}</td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Open
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 dark:bg-amber-900/10 dark:border-amber-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            📊 Data quality issues in the current period represent {formatMoney(summary.total_at_risk_revenue)} in at-risk revenue.
            At BV&apos;s annual transaction volume, this equates to an estimated {formatCompactMoney(summary.copq_annual_estimate)} in
            annual data remediation cost (Cost of Poor Data Quality). Resolving the 6 open CAPAs is projected to recover $47,200 of this exposure.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/revenue?tab=copq")}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700"
            >
              View COPQ Detail →
            </button>
            <button
              type="button"
              onClick={() => navigate("/capa")}
              className="border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-300"
            >
              View All CAPAs →
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiTile
          label="Misattributed Commission"
          value={formatMoney(territoryData.total_misaligned_commission)}
          subtitle="7 orders · $33,050 revenue in wrong territory"
          icon={<MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          intent="amber"
          onClick={() => navigate("/territory-integrity")}
          tooltip={TOOLTIP_CSUITE_COMMISSION}
        />
        <KpiTile
          label="Stalled Onboarding Pipeline"
          value="$555K"
          subtitle="7 of 8 applications blocked"
          icon={<Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          intent="amber"
          onClick={() => navigate("/csuite")}
        />
        <KpiTile
          label="Chargebacks Expiring in 12 Days"
          value={formatMoney(chargebackData.expiring_soon_amount)}
          subtitle="CHB-003 + CHB-004 · Membership unverified"
          icon={<AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 animate-pulse" />}
          intent="rose"
          onClick={() => navigate("/revenue?tab=market-access")}
        />
      </div>
      <DetailModal
        open={accountModalId === "IDN-003"}
        onClose={() => setAccountModalId(null)}
        title="IDN-003 MedStar Alliance — 4 Subsidiaries"
      >
        <div className="text-xs text-slate-600 dark:text-slate-300 mt-2 space-y-1">
          <p>Charlotte Medical Center (CUST-1005)    $17,000</p>
          <p>Blue Clinic (CUST-1008)                 $ n/a</p>
          <p>Sandhills Center (CUST-1010)            $ 720</p>
          <p>East Center (CUST-1028)                 $30,500 ⚠ At Risk</p>
        </div>
        <div className="mt-3">
          <ActionPanel
            severity="high"
            primaryPersona="Credit & AR"
            ownerName="Finance Team"
            actions={[
              { step: 1, description: "Review aggregated credit exposure across all 4 IDN-003 subsidiaries" },
              { step: 2, description: "Place credit hold on CUST-1028 East Center — at limit with recalled product orders" },
              { step: 3, description: "Route credit extension request to Finance Leadership for CUST-1028" },
            ]}
            secondaryPersonaNote="Also involves: VP Quality (CUST-1028 has recalled EXOGEN orders)"
            ctaButtons={[
              { label: "View IDN-003 in Hierarchy", navigateTo: "/hierarchy?idn=IDN-003", variant: "primary" },
              { label: "View Alerts", navigateTo: "/alerts", variant: "secondary" },
            ]}
          />
        </div>
      </DetailModal>
    </div>
  );
}

function KpiTile({
  label,
  value,
  subtitle,
  icon,
  onClick,
  intent,
  badges,
  tooltip,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  onClick: () => void;
  intent: "rose" | "amber";
  badges?: Array<{ label: string; className: string }>;
  tooltip?: Parameters<typeof InfoTooltip>[0]["content"];
}) {
  const intentClass =
    intent === "rose"
      ? "border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-900/10"
      : "border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10";
  return (
    <button
      type="button"
      title="Click to see detail"
      onClick={onClick}
      className={`rounded-xl shadow-sm hover:shadow-md transition-all border p-4 text-left ${intentClass}`}
    >
      {tooltip ? <span className="float-right"><InfoTooltip content={tooltip} /></span> : null}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${intent === "rose" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>{value}</p>
          <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">{subtitle}</p>
        </div>
        {icon}
      </div>
      {badges && (
        <div className="flex gap-2 mt-3">
          {badges.map((badge) => (
            <span key={badge.label} className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
