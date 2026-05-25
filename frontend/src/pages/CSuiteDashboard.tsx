import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart2, Clock, CreditCard, Info, TrendingDown, Users } from "lucide-react";
import { api } from "../services/api";
import { RoleContextBanner } from "../components/RoleContextBanner";
import ActionPanel from "../components/ActionPanel";
import InfoTooltip from "../components/InfoTooltip";
import DetailModal from "../components/DetailModal";
import { TOOLTIP_CSUITE_COMMISSION, TOOLTIP_CSUITE_DSO, TOOLTIP_CSUITE_MARGIN_ANNUAL, TOOLTIP_CSUITE_MARGIN_CURRENT, TOOLTIP_CSUITE_MARGIN_RATE, TOOLTIP_CSUITE_PIPELINE, TOOLTIP_CSUITE_SLA_COUNT, TOOLTIP_CSUITE_SLA_IMPACT } from "../lib/tooltipContent";

type Summary = Awaited<ReturnType<typeof api.getCommercialSummary>>;
type SLA = Awaited<ReturnType<typeof api.getSLATickets>>;
type Territory = Awaited<ReturnType<typeof api.getTerritoryAlignment>>;
type TerritoryExceptions = Awaited<ReturnType<typeof api.getTerritoryExceptions>>;
type Onboarding = Awaited<ReturnType<typeof api.getOnboarding>>;
type DSO = Awaited<ReturnType<typeof api.getDSOAnalysis>>;
type Chargebacks = Awaited<ReturnType<typeof api.getChargebacks>>;
type Copq = Awaited<ReturnType<typeof api.getCopqDrilldown>>;

const TOP_ACCOUNTS = [
  { rank: 1, account: "Unknown (Orphan)", customerId: "CUST-9902", revenueAtRisk: 12000, marginAtRisk: 4080, issueType: "Orphan customer" as const, action: "/profiler?dataset=sales_orders&filter=orphan" },
  { rank: 2, account: "Unknown (Orphan)", customerId: "CUST-9904", revenueAtRisk: 12000, marginAtRisk: 4080, issueType: "Orphan customer" as const, action: "/profiler?dataset=sales_orders&filter=orphan" },
  { rank: 3, account: "Triad Specialists", customerId: "CUST-1027", revenueAtRisk: 8400, marginAtRisk: 2856, issueType: "Recalled product" as const, action: "/hierarchy?customer=CUST-1027" },
  { rank: 4, account: "Capital Institute", customerId: "CUST-1026", revenueAtRisk: 4200, marginAtRisk: 1428, issueType: "Recalled product" as const, action: "/hierarchy?customer=CUST-1026" },
  { rank: 5, account: "East Center", customerId: "CUST-1028", revenueAtRisk: 4200, marginAtRisk: 1428, issueType: "Recalled product" as const, action: "/hierarchy?customer=CUST-1028" },
];

function fmt(value: number): string {
  return `$${value.toLocaleString()}`;
}

function fmtCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return fmt(value);
}

export default function CSuiteDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sla, setSla] = useState<SLA | null>(null);
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [dso, setDso] = useState<DSO | null>(null);
  const [chargebacks, setChargebacks] = useState<Chargebacks | null>(null);
  const [territoryExceptions, setTerritoryExceptions] = useState<TerritoryExceptions | null>(null);
  const [copq, setCopq] = useState<Copq | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [expandedSla, setExpandedSla] = useState<string | null>(null);
  const [expandedOnb, setExpandedOnb] = useState<string | null>(null);
  const [expandedDso, setExpandedDso] = useState<string | null>(null);
  const [selectedAccountModal, setSelectedAccountModal] = useState<(typeof TOP_ACCOUNTS)[number] | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [pingedIds, setPingedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const slaRef = useRef<HTMLDivElement | null>(null);
  const onbRef = useRef<HTMLDivElement | null>(null);
  const dsoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [summaryRes, slaRes, territoryRes, onboardingRes, dsoRes, chargebacksRes, territoryExceptionsRes, copqRes] = await Promise.all([
          api.getCommercialSummary(),
          api.getSLATickets(),
          api.getTerritoryAlignment(),
          api.getOnboarding(),
          api.getDSOAnalysis(),
          api.getChargebacks(),
          api.getTerritoryExceptions(),
          api.getCopqDrilldown(),
        ]);
        setSummary(summaryRes);
        setSla(slaRes);
        setTerritory(territoryRes);
        setOnboarding(onboardingRes);
        setDso(dsoRes);
        setChargebacks(chargebacksRes);
        setTerritoryExceptions(territoryExceptionsRes);
        setCopq(copqRes);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load C-Suite dashboard");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const slaRows = useMemo(() => {
    const rows = [...(sla?.records ?? [])];
    const rank = (status: string): number => {
      if (status === "BREACHED") return 1;
      if (status === "AT RISK") return 2;
      return 3;
    };
    rows.sort((a, b) => rank(a.sla_status) - rank(b.sla_status));
    return selectedDept ? rows.filter((r) => r.department === selectedDept) : rows;
  }, [sla, selectedDept]);

  useEffect(() => {
    const h = searchParams.get("highlight");
    if (!h) return;
    const el = document.getElementById(`highlight-${h}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchParams, slaRows, onboarding, dso]);

  if (loading) return <div className="h-60 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />;
  if (error || !summary || !sla || !territory || !onboarding || !dso || !chargebacks || !territoryExceptions || !copq) {
    return <div className="text-rose-600 dark:text-rose-300">{error ?? "Data unavailable"}</div>;
  }

  const currentMarginAtRisk = Math.round(copq.total_value * 0.34);
  const projectedAnnualMarginRisk = currentMarginAtRisk * 153;
  const currentCopqSignalCount = copq.rows.reduce((sum, row) => sum + row.orders, 0);

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-6 z-50 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm">{toast}</div>}
      <RoleContextBanner route="/csuite" />

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">C-Suite Executive Dashboard</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Financial risk · SLA performance · Operational pipeline — Bioventus LLC</p>
          </div>
          <div className="text-xs rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 max-w-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-1">
              <span>📊 34% standard medical device gross margin applied for margin calculations <InfoTooltip content={TOOLTIP_CSUITE_MARGIN_RATE} /></span>
              <span title="Margin calculated as revenue × 34% standard gross margin rate for medical device industry. Actual margin requires ERP cost data integration. Formula: total_amount × 0.34">
                <Info className="w-3.5 h-3.5 inline" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Tile
          label="Margin at Risk — Current Period"
          value={fmt(currentMarginAtRisk)}
          subtitle={`34% simulated margin · ${currentCopqSignalCount} issue signals`}
          icon={<TrendingDown className="w-5 h-5 text-rose-600" />}
          onClick={() => navigate("/revenue?tab=copq")}
          tooltip={TOOLTIP_CSUITE_MARGIN_CURRENT}
        />
        <Tile
          label="Projected Annual Margin Risk"
          value={fmtCompact(projectedAnnualMarginRisk)}
          subtitle="×153 annualization · same 34% margin"
          icon={<BarChart2 className="w-5 h-5 text-rose-600" />}
          onClick={() => navigate("/revenue?tab=copq")}
          tooltip={TOOLTIP_CSUITE_MARGIN_ANNUAL}
        />
        <Tile label="SLA Breaches" value={String(sla.breached_count)} subtitle="VP Quality 3 · Comm. Ops 2 · Credit & AR 1 · CCO 1" icon={<Clock className="w-5 h-5 text-rose-600 animate-pulse" />} onClick={() => slaRef.current?.scrollIntoView({ behavior: "smooth" })} badge="$88,780 total impact" tooltip={TOOLTIP_CSUITE_SLA_COUNT} />
        <Tile label="Stalled Onboarding Pipeline" value="$555,000" subtitle="7 of 8 applications stalled · longest 192 hrs" icon={<Users className="w-5 h-5 text-amber-600" />} onClick={() => onbRef.current?.scrollIntoView({ behavior: "smooth" })} amber tooltip={TOOLTIP_CSUITE_PIPELINE} />
        <Tile label="DSO Collection at Risk" value="$29,100" subtitle="6 orders · orphan + inactive accounts" icon={<CreditCard className="w-5 h-5 text-amber-600" />} onClick={() => dsoRef.current?.scrollIntoView({ behavior: "smooth" })} amber tooltip={TOOLTIP_CSUITE_DSO} />
        <Tile
          label="Misattributed Commission"
          value="$992"
          subtitle={`${territoryExceptions.commission_hold_count} commission holds · ${territoryExceptions.open_count} open exceptions`}
          icon={<BarChart2 className="w-5 h-5 text-amber-600" />}
          onClick={() => navigate("/territory-integrity")}
          amber
          tooltip={TOOLTIP_CSUITE_COMMISSION}
        />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="font-semibold">Top Accounts by Margin at Risk</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Click any account to drill into the specific issue</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr><th className="text-left py-2">Rank</th><th className="text-left py-2">Account</th><th className="text-left py-2">Customer ID</th><th className="text-left py-2">Revenue at Risk</th><th className="text-left py-2">Margin at Risk</th><th className="text-left py-2">Issue Type</th><th className="text-left py-2">Action</th></tr>
          </thead>
          <tbody>
            {TOP_ACCOUNTS.map((row) => {
              const border = row.issueType === "Orphan customer" ? "border-l-4 border-amber-400" : "border-l-4 border-rose-400";
              return (
                <>
                  <tr key={row.customerId} className={`border-t border-slate-100 dark:border-slate-700 ${border} cursor-pointer`} onClick={() => setExpandedAccount(row.customerId)}>
                    <td className="py-2">{row.rank}</td>
                    <td className="py-2">{row.account}</td>
                    <td className="py-2">{row.customerId}</td>
                    <td className="py-2">{fmt(row.revenueAtRisk)}</td>
                    <td className="py-2">{fmt(row.marginAtRisk)}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${row.issueType === "Orphan customer" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{row.issueType}</span>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-indigo-600 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedAccountModal(row);
                        }}
                      >
                        → View
                      </button>
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div ref={slaRef} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="font-semibold">SLA Performance by Department</h3>
        <div className="flex flex-wrap gap-2 mt-2 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">7 Breached</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">1 At Risk</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">2 On Track</span>
        </div>
        <div className="space-y-2 mb-4">
          {Object.entries(sla.departments_with_breach).map(([dept, count]) => (
            <button key={dept} type="button" onClick={() => setSelectedDept(selectedDept === dept ? null : dept)} className="w-full text-left text-sm">
              <div className="flex justify-between"><span>{dept}</span><span>{count}</span></div>
              <div className="h-2 rounded bg-slate-200 dark:bg-slate-700">
                <div className="h-2 rounded bg-rose-500" style={{ width: `${Math.min(Number(count) * 28, 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr><th className="text-left py-2">SLA ID</th><th className="text-left py-2">Linked Record</th><th className="text-left py-2">Department</th><th className="text-left py-2">SLA Target</th><th className="text-left py-2">Elapsed</th><th className="text-left py-2">Status</th><th className="text-left py-2">Impact</th><th className="text-left py-2">Action</th></tr>
          </thead>
          <tbody>
            {slaRows.map((row) => {
              const over = row.actual_elapsed > row.sla_target_value;
              const leftClass = row.sla_status === "BREACHED" ? "border-l-4 border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : row.sla_status === "AT RISK" ? "border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-900/10" : "border-l-4 border-emerald-500";
              const navMap: Record<string, string> = {
                "SLA-001": "/profiler?dataset=patient_support&highlight=CASE-5011",
                "SLA-002": "/profiler?dataset=patient_support&highlight=CASE-5012",
                "SLA-003": "/hierarchy?customer=CUST-1009",
                "SLA-004": "/capa?highlight=CAPA-001",
                "SLA-005": "/hierarchy?idn=IDN-003",
                "SLA-006": "/pii-shield?dataset=patient_support&view=consent_gaps&highlight=CASE-5015",
                "SLA-007": "/revenue?tab=market-access&highlight=GPC-011",
                "SLA-008": "/revenue?tab=market-access&highlight=GPC-012",
                "SLA-009": "/revenue?tab=market-access&highlight=CHB-003",
                "SLA-010": "/profiler?dataset=sales_orders&filter=ghost_rep",
              };
              return (
                <>
                  <tr id={`highlight-${row.sla_id}`} key={row.sla_id} className={`border-t border-slate-100 dark:border-slate-700 ${leftClass} cursor-pointer`} onClick={() => setExpandedSla(row.sla_id)}>
                    <td className="py-2">{row.sla_id}</td>
                    <td className="py-2">{row.linked_record_id}</td>
                    <td className="py-2">{row.department}</td>
                    <td className="py-2">{row.sla_target_value} {row.sla_target_unit}</td>
                    <td className={`py-2 ${over ? "text-rose-600" : "text-emerald-600"}`}>{row.actual_elapsed} {row.elapsed_unit}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${row.sla_status === "BREACHED" ? "bg-rose-100 text-rose-700" : row.sla_status === "AT RISK" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{row.sla_status}</span></td>
                    <td className="py-2">{fmt(row.financial_impact)} <InfoTooltip content={TOOLTIP_CSUITE_SLA_IMPACT} /></td>
                    <td className="py-2"><button type="button" className="text-indigo-600 text-xs" onClick={() => navigate(navMap[row.sla_id] ?? "/alerts")}>→ Open</button></td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div ref={onbRef} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="font-semibold">Onboarding Pipeline — Stalled Applications</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">$555,000 first-year pipeline blocked · 7 of 8 applications stalled</p>
        <div className="flex flex-wrap gap-2 my-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">7 Stalled</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">$555K Pipeline</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Longest: 192 hrs — Pinecrest Spine</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr><th className="text-left py-2">App ID</th><th className="text-left py-2">Applicant</th><th className="text-left py-2">Segment</th><th className="text-left py-2">Hours Stalled</th><th className="text-left py-2">Blocking Dept</th><th className="text-left py-2">Pipeline Value</th><th className="text-left py-2">Action</th></tr>
          </thead>
          <tbody>
            {[...onboarding.records].sort((a, b) => (b.stalled_flag - a.stalled_flag) || (b.submitted_hours_ago - a.submitted_hours_ago)).map((row) => {
              const critical = row.submitted_hours_ago > 96 && row.stalled_flag === 1;
              const leftClass = row.stalled_flag === 0 ? "border-l-4 border-emerald-500" : critical ? "border-l-4 border-rose-500" : "border-l-4 border-amber-500";
              const pinged = pingedIds.has(row.onboarding_id);
              return (
                <>
                  <tr id={`highlight-${row.onboarding_id}`} key={row.onboarding_id} className={`border-t border-slate-100 dark:border-slate-700 ${leftClass} cursor-pointer`} onClick={() => setExpandedOnb(row.onboarding_id)}>
                    <td className="py-2">{row.onboarding_id}</td>
                    <td className="py-2">{row.applicant_name}</td>
                    <td className="py-2">{row.customer_segment}</td>
                    <td className="py-2">{row.submitted_hours_ago} {critical && <span className="ml-1 text-[10px] px-1 rounded bg-rose-100 text-rose-700">CRITICAL</span>}</td>
                    <td className="py-2">{row.blocking_department ?? "—"}</td>
                    <td className="py-2">{fmt(row.pipeline_value_estimate)}</td>
                    <td className="py-2">
                      {row.stalled_flag === 1 ? (
                        <button
                          type="button"
                          disabled={pinged}
                          onClick={() => {
                            setPingedIds((prev) => new Set(prev).add(row.onboarding_id));
                            setToast(`${row.blocking_department ?? "Department"} pinged — automated escalation notification sent for ${row.applicant_name}`);
                          }}
                          className={`text-xs px-2 py-1 rounded ${pinged ? "bg-emerald-100 text-emerald-700" : "bg-indigo-600 text-white"}`}
                        >
                          {pinged ? "✓ Pinged" : "Send Dept Ping"}
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div ref={dsoRef} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h3 className="font-semibold">DSO Collection Risk — Data Quality Linked</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">$29,100 collection at risk · Avg DSO variance +10.3 days over benchmark</p>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-3">
          <div className="xl:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-sm">Orphan customer DSO risk: <span className="text-amber-600 font-semibold">$25,700 (88.3%)</span></p>
            <p className="text-sm mt-1">Inactive account DSO risk: <span className="text-rose-600 font-semibold">$3,400 (11.7%)</span></p>
            <p className="text-lg font-bold mt-3">$29,100 at risk</p>
            <p className="text-xs text-slate-500">30-day target</p>
          </div>
          <div className="xl:col-span-3">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr><th className="text-left py-2">Order</th><th className="text-left py-2">Customer</th><th className="text-left py-2">Product</th><th className="text-left py-2">Method</th><th className="text-left py-2">DSO</th><th className="text-left py-2">Benchmark</th><th className="text-left py-2">Variance</th><th className="text-left py-2">Amount</th><th className="text-left py-2">Action</th></tr>
              </thead>
              <tbody>
                {[...dso.records].sort((a, b) => b.collection_at_risk - a.collection_at_risk).map((row) => {
                  const high = row.dso_variance > 10;
                  return (
                    <>
                      <tr key={row.dso_id} className={`border-t border-slate-100 dark:border-slate-700 ${high ? "border-l-4 border-rose-500 bg-rose-50/40 dark:bg-rose-900/10" : "border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-900/10"} cursor-pointer`} onClick={() => setExpandedDso(row.dso_id)}>
                        <td className="py-2">{row.order_id}</td><td className="py-2">{row.customer_id}</td><td className="py-2">{row.product_name}</td><td className="py-2">{row.payment_method}</td>
                        <td className="py-2">{row.simulated_dso_days}</td><td className="py-2">{row.dso_benchmark}</td><td className="py-2 text-rose-600">+{row.dso_variance} days</td><td className="py-2">{fmt(row.collection_at_risk)}</td>
                        <td className="py-2"><button type="button" className="text-indigo-600 text-xs" onClick={() => navigate(high ? "/profiler?dataset=sales_orders&filter=orphan" : "/profiler?dataset=customer_master")}>→ Open</button></td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <DetailModal
        open={Boolean(selectedAccountModal)}
        onClose={() => setSelectedAccountModal(null)}
        title={selectedAccountModal ? `Account Detail — ${selectedAccountModal.customerId}` : "Account Detail"}
      >
        {selectedAccountModal && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              {selectedAccountModal.account} · Revenue at risk {fmt(selectedAccountModal.revenueAtRisk)} · Margin at risk {fmt(selectedAccountModal.marginAtRisk)}
            </p>
            {selectedAccountModal.issueType === "Orphan customer" ? (
              <ActionPanel
                severity="high"
                primaryPersona="Commercial Ops"
                ownerName="Linda Torres"
                actions={[
                  { step: 1, description: `Search legacy CRM for ${selectedAccountModal.customerId} — order currently unattributed to any IDN.` },
                  { step: 2, description: "Create customer master record to unblock invoicing and revenue recognition." },
                  { step: 3, description: "Once record exists, convert blocked revenue and margin to attributable pipeline." },
                ]}
                secondaryPersonaNote="Also involves: Credit & AR (collection blocked until record exists)"
                ctaButtons={[
                  { label: "View Orphan Orders", navigateTo: "/profiler?dataset=sales_orders&filter=orphan", variant: "primary" },
                  { label: "View Alerts", navigateTo: "/alerts", variant: "secondary" },
                ]}
              />
            ) : (
              <ActionPanel
                severity="critical"
                primaryPersona="VP Quality"
                ownerName="Dr. Sarah Kim"
                actions={[
                  { step: 1, description: `Review recalled-product exposure for ${selectedAccountModal.customerId} and initiate retrieval workflow.` },
                  { step: 2, description: "File required regulatory updates and reverse exposed revenue where applicable." },
                  { step: 3, description: "Close linked CAPA and alert actions before releasing additional shipments." },
                ]}
                secondaryPersonaNote="Also involves: Finance (revenue reversal and margin impact controls)"
                ctaButtons={[
                  { label: "Open CAPA", navigateTo: "/capa", variant: "primary" },
                  { label: "View Alert Queue", navigateTo: "/alerts", variant: "secondary" },
                ]}
              />
            )}
          </>
        )}
      </DetailModal>
      <DetailModal
        open={Boolean(expandedAccount)}
        onClose={() => setExpandedAccount(null)}
        title={`Top Account Detail${expandedAccount ? ` — ${expandedAccount}` : ""}`}
      >
        {expandedAccount === "CUST-9902" || expandedAccount === "CUST-9904" ? (
          <ActionPanel
            severity="high"
            primaryPersona="Commercial Ops"
            ownerName="Linda Torres"
            actions={[
              { step: 1, description: "Search legacy CRM for CUST-9902 and CUST-9904 — both have $12,000 StimRouter orders unattributed to any IDN" },
              { step: 2, description: "Create customer master records to unblock invoicing and revenue recognition" },
              { step: 3, description: "Once records created, $24,000 revenue and $8,160 margin become attributable and collectible" },
            ]}
            secondaryPersonaNote="Also involves: Credit & AR (collection blocked until records exist)"
            ctaButtons={[
              { label: "View in Profiler", navigateTo: "/profiler?dataset=sales_orders&filter=orphan", variant: "primary" },
              { label: "View Alert ALT-017", navigateTo: "/alerts", variant: "secondary" },
            ]}
          />
        ) : expandedAccount === "CUST-1027" ? (
          <ActionPanel
            severity="critical"
            primaryPersona="VP Quality"
            ownerName="Dr. Sarah Kim"
            actions={[
              { step: 1, description: "Initiate EXOGEN 4.0 retrieval from Triad Specialists. ORD-013 and ORD-016 both post-recall." },
              { step: 2, description: "File FDA 806 correction report. Reverse revenue recognition for $8,400." },
              { step: 3, description: "File retroactive MDR for CASE-5012 (adverse event at CUST-1027)." },
            ]}
            secondaryPersonaNote="Also involves: Finance (reverse $8,400 revenue, $2,856 margin impact)"
            ctaButtons={[
              { label: "View CAPA-004", navigateTo: "/capa", variant: "primary" },
              { label: "View Hierarchy", navigateTo: "/hierarchy?customer=CUST-1027", variant: "secondary" },
            ]}
          />
        ) : expandedAccount === "CUST-1026" ? (
          <ActionPanel
            severity="critical"
            primaryPersona="VP Quality"
            ownerName="Dr. Sarah Kim"
            actions={[
              { step: 1, description: "Initiate EXOGEN 4.0 retrieval from Capital Institute (ORD-015) and place the account on quality hold." },
              { step: 2, description: "Coordinate MDR closure tasks for linked adverse-event cases before releasing new shipments." },
              { step: 3, description: "Reverse recalled-order revenue impact and confirm remediation completion in CAPA workflow." },
            ]}
            secondaryPersonaNote="Also involves: Finance (recalled-order reversal and margin impact tracking)"
            ctaButtons={[
              { label: "Open CAPA-001", navigateTo: "/capa?highlight=CAPA-001", variant: "primary" },
              { label: "View Hierarchy", navigateTo: "/hierarchy?customer=CUST-1026", variant: "secondary" },
            ]}
          />
        ) : expandedAccount === "CUST-1028" ? (
          <ActionPanel
            severity="critical"
            primaryPersona="VP Quality"
            ownerName="Dr. Sarah Kim"
            actions={[
              { step: 1, description: "Prioritize remediation for East Center recalled EXOGEN exposure and align with credit-risk hold status." },
              { step: 2, description: "Reconcile open quality and commercial actions so the account can return to compliant ordering status." },
              { step: 3, description: "Confirm revenue reversal closure after evidence upload and owner sign-off." },
            ]}
            secondaryPersonaNote="Also involves: Credit & AR (account is at sub-limit and under exposure review)"
            ctaButtons={[
              { label: "View Hierarchy", navigateTo: "/hierarchy?customer=CUST-1028", variant: "primary" },
              { label: "View Alert Queue", navigateTo: "/alerts", variant: "secondary" },
            ]}
          />
        ) : null}
      </DetailModal>
      <DetailModal
        open={Boolean(expandedSla)}
        onClose={() => setExpandedSla(null)}
        title={`SLA Detail${expandedSla ? ` — ${expandedSla}` : ""}`}
      >
        {(() => {
          const row = slaRows.find((r) => r.sla_id === expandedSla);
          if (!row) return null;
          return (
            <>
              <p className="text-sm font-medium">{row.sla_description}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{row.prescribed_action}</p>
              {row.sla_id === "SLA-004" && (
                <ActionPanel
                  severity="critical"
                  primaryPersona="VP Quality"
                  ownerName="Dr. Sarah Kim"
                  actions={[
                    { step: 1, description: "CAPA-001 is 2 days past 45-day closure SLA. File MDR immediately to progress toward CAPA resolution.", regulation: "21 CFR Part 803" },
                    { step: 2, description: "Contact CUST-1026/1027/1028 for EXOGEN retrieval — retrieval completion unblocks CAPA closure." },
                    { step: 3, description: "Update CAPA-001 status to In Progress once MDR filed. Target closure: 7 days." },
                  ]}
                  secondaryPersonaNote="Also involves: Finance ($16,800 revenue at risk pending retrieval completion)"
                  ctaButtons={[{ label: "Open CAPA-001", navigateTo: "/capa", variant: "primary" }]}
                />
              )}
              {row.sla_id === "SLA-005" && (
                <ActionPanel
                  severity="high"
                  primaryPersona="Credit & AR"
                  ownerName="Finance Team"
                  actions={[
                    { step: 1, description: "IDN-003 MedStar credit review SLA was 24 hours. Now 72 hours elapsed — 48 hours overdue." },
                    { step: 2, description: "Review CUST-1028 East Center: $30,500 outstanding vs $30,000 sub-limit. Place credit hold immediately." },
                    { step: 3, description: "Route credit extension request to Finance Leadership for CUST-1028." },
                  ]}
                  ctaButtons={[{ label: "View IDN-003 Hierarchy", navigateTo: "/hierarchy?idn=IDN-003", variant: "primary" }]}
                />
              )}
            </>
          );
        })()}
      </DetailModal>
      <DetailModal
        open={Boolean(expandedOnb)}
        onClose={() => setExpandedOnb(null)}
        title={`Onboarding Detail${expandedOnb ? ` — ${expandedOnb}` : ""}`}
      >
        {(() => {
          const row = onboarding.records.find((r) => r.onboarding_id === expandedOnb);
          if (!row) return null;
          return (
            <>
              <p className="text-sm text-slate-700 dark:text-slate-300">{row.blocking_reason}</p>
              {row.onboarding_id === "ONB-007" && (
                <ActionPanel
                  severity="high"
                  primaryPersona="MDM Lead"
                  ownerName="Marcus Johnson"
                  actions={[
                    { step: 1, description: "Compare ONB-007 Pinecrest Spine Institute with CUST-1028 East Center — same segment, Cary/Wilmington NC area, possible duplicate submission." },
                    { step: 2, description: "Run NPI crosswalk for applying physician to confirm unique identity before activating." },
                    { step: 3, description: "If duplicate: merge records and contact sales rep REP-08. If unique: activate account and assign territory." },
                  ]}
                  secondaryPersonaNote="Also involves: Commercial Ops (territory assignment if unique)"
                  ctaButtons={[{ label: "View Hierarchy for CUST-1028", navigateTo: "/hierarchy?customer=CUST-1028", variant: "primary" }]}
                />
              )}
              {row.onboarding_id === "ONB-005" && (
                <ActionPanel
                  severity="medium"
                  primaryPersona="Market Access"
                  ownerName="Market Access Team"
                  actions={[
                    { step: 1, description: "Verify HealthTrust Tier1 membership for Garner Medical Distribution via GPO external roster portal." },
                    { step: 2, description: "If verified: activate account with HealthTrust Tier1 pricing. Estimated $120,000 first-year pipeline." },
                    { step: 3, description: "If not verified: activate with list price and revisit GPO enrollment after account activation." },
                  ]}
                  ctaButtons={[{ label: "View GPO Contracts", navigateTo: "/revenue?tab=market-access", variant: "primary" }]}
                />
              )}
            </>
          );
        })()}
      </DetailModal>
      <DetailModal
        open={Boolean(expandedDso)}
        onClose={() => setExpandedDso(null)}
        title={`DSO Detail${expandedDso ? ` — ${expandedDso}` : ""}`}
      >
        {expandedDso === "DSO-002" ? (
          <ActionPanel
            severity="high"
            primaryPersona="Credit & AR"
            ownerName="Finance Team"
            actions={[
              { step: 1, description: "Cannot invoice CUST-9902 — no customer master record exists. Invoice blocked until record created." },
              { step: 2, description: "Coordinate with Commercial Ops to create customer master record for CUST-9902 from legacy CRM data." },
              { step: 3, description: "Once record created: send invoice immediately. $12,000 collection unblocked." },
            ]}
            secondaryPersonaNote="Also involves: Commercial Ops (customer record creation for CUST-9902)"
            ctaButtons={[
              { label: "View Orphan Orders", navigateTo: "/profiler?dataset=sales_orders&filter=orphan", variant: "primary" },
              { label: "View in Hierarchy", navigateTo: "/hierarchy?filter=orphan", variant: "secondary" },
            ]}
          />
        ) : null}
      </DetailModal>
    </div>
  );
}

function Tile({
  label,
  value,
  subtitle,
  icon,
  onClick,
  badge,
  amber,
  tooltip,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
  badge?: string;
  amber?: boolean;
  tooltip?: Parameters<typeof InfoTooltip>[0]["content"];
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${amber ? "border-amber-200 bg-amber-50/60 dark:bg-amber-900/10" : "border-rose-200 bg-rose-50/60 dark:bg-rose-900/10"}`}>
      {tooltip ? <span className="float-right"><InfoTooltip content={tooltip} /></span> : null}
      <div className="flex justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${amber ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"}`}>{value}</p>
          <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">{subtitle}</p>
          {badge ? <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{badge}</span> : null}
        </div>
        {icon}
      </div>
    </button>
  );
}
