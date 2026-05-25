import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  api,
  type AgreementExpiryRecord,
  type CopqDrilldownRecord,
  type CopqDrilldownRow,
  type GPOContract,
  type PricingDiscrepancy,
  type TaxCert,
} from "../services/api";
import { useRole } from "../context/RoleContext";
import { useDateFormat } from "../context/DateFormatContext";
import { AgreementExpiryTable } from "../components/revenue/AgreementExpiryTable";
import { PricingDiscrepancyTable } from "../components/revenue/PricingDiscrepancyTable";
import ActionPanel from "../components/ActionPanel";
import InfoTooltip from "../components/InfoTooltip";
import DetailModal from "../components/DetailModal";
import { TOOLTIP_REV_COPQ_CURRENT, TOOLTIP_REV_COPQ_SLIDER, TOOLTIP_REV_DISPUTE_TOTAL, TOOLTIP_REV_DSO, TOOLTIP_REV_GPO_ANNUAL, TOOLTIP_REV_GPO_VARIANCE, TOOLTIP_REV_MARGIN, TOOLTIP_REV_TAX } from "../lib/tooltipContent";

type Tab = "gpo" | "pricing" | "agreement-expiry" | "copq" | "tax" | "market-access";
const VALID_TABS: Tab[] = ["gpo", "pricing", "agreement-expiry", "copq", "tax", "market-access"];

function fmtCurrency(value: number | null | undefined): string {
  const amount = value ?? 0;
  return amount.toLocaleString();
}

export default function RevenueRisk() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentRole } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.getCommercialSummary>> | null>(null);
  const [gpoData, setGpoData] = useState<Awaited<ReturnType<typeof api.getGPOContracts>> | null>(null);
  const [taxData, setTaxData] = useState<Awaited<ReturnType<typeof api.getTaxCerts>> | null>(null);
  const [taxMismatchData, setTaxMismatchData] = useState<Awaited<ReturnType<typeof api.getTaxJurisdictionMismatches>> | null>(null);
  const [chargebackData, setChargebackData] = useState<Awaited<ReturnType<typeof api.getChargebacks>> | null>(null);
  const [onboardingData, setOnboardingData] = useState<Awaited<ReturnType<typeof api.getOnboarding>> | null>(null);
  const [territoryData, setTerritoryData] = useState<Awaited<ReturnType<typeof api.getTerritoryAlignment>> | null>(null);
  const [copqData, setCopqData] = useState<{ rows: CopqDrilldownRow[]; records: CopqDrilldownRecord[]; total_value: number } | null>(null);
  const [pricingData, setPricingData] = useState<{
    total_open: number;
    total_exposure: number;
    records: PricingDiscrepancy[];
  } | null>(null);
  const [agreementExpiryData, setAgreementExpiryData] = useState<{
    expiring_count: number;
    expired_count: number;
    records: AgreementExpiryRecord[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("gpo");
  const [annualizationFactor, setAnnualizationFactor] = useState(153);
  const [sentRenewals, setSentRenewals] = useState<Set<string>>(new Set());
  const [filedIds, setFiledIds] = useState<Set<string>>(new Set());
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [showExpiringContractsModal, setShowExpiringContractsModal] = useState(false);
  const [contractModalId, setContractModalId] = useState<string | null>(null);
  const [copqModalFilter, setCopqModalFilter] = useState<string | null>(null);
  const [taxOrderModalId, setTaxOrderModalId] = useState<string | null>(null);
  const [chargebackModalId, setChargebackModalId] = useState<string | null>(null);
  const [distributorModalOrderId, setDistributorModalOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const jumpToChargebacks = () => {
    selectTab("market-access");
    // Wait one tick so the market-access panel is mounted before scroll.
    window.setTimeout(() => {
      const el = document.getElementById("chargeback-queue");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  };

  const tabParamRaw = searchParams.get("tab");
  const tabParam: Tab | null = tabParamRaw && VALID_TABS.includes(tabParamRaw as Tab) ? (tabParamRaw as Tab) : null;
  const filter = searchParams.get("filter");
  const highlight = searchParams.get("highlight");
  const contractFocus = searchParams.get("contract");
  const defaultTab = currentRole.id === "tax_compliance" ? "tax" : ((currentRole.defaultRevenueTab as Tab | undefined) ?? "gpo");

  useEffect(() => {
    setActiveTab(tabParam ?? defaultTab);
  }, [defaultTab, tabParam]);

  const selectTab = (t: Tab) => {
    setActiveTab(t);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", t);
        if (t !== "pricing") p.delete("contract");
        return p;
      },
      { replace: true }
    );
  };

  const openPricingForContract = (contractId: string) => {
    setActiveTab("pricing");
    setSearchParams({ tab: "pricing", contract: contractId }, { replace: true });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, g, t, taxM, chb, onb, terr, copq, pricing, agreements] = await Promise.all([
        api.getCommercialSummary(),
        api.getGPOContracts(),
        api.getTaxCerts(),
        api.getTaxJurisdictionMismatches(),
        api.getChargebacks(),
        api.getOnboarding(),
        api.getTerritoryAlignment(),
        api.getCopqDrilldown(),
        api.getPricingDiscrepancies(),
        api.getAgreementExpiry(),
      ]);
      setSummary(s);
      setGpoData(g);
      setTaxData(t);
      setTaxMismatchData(taxM);
      setChargebackData(chb);
      setOnboardingData(onb);
      setTerritoryData(terr);
      setCopqData(copq);
      setPricingData(pricing);
      setAgreementExpiryData(agreements);
    } catch {
      setError("Unable to load Revenue & Risk data. Verify backend API is running on port 8005 and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const scrollId = activeTab === "pricing" && contractFocus ? contractFocus : highlight;
    if (!scrollId) return;
    const el = document.getElementById(`highlight-${scrollId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeTab, contractFocus, highlight, gpoData, taxData, taxMismatchData, pricingData, agreementExpiryData]);

  useEffect(() => {
    if (activeTab !== "copq") return;
    if (!filter) return;
    setCopqModalFilter(filter);
  }, [activeTab, filter]);

  const gpoRows = useMemo(() => {
    if (!gpoData) return [];
    let rows = gpoData.contracts;
    if (filter === "pns") rows = rows.filter((r) => r.product_name.includes("Stim") || r.product_name.includes("Talis"));
    if (filter === "unverified") rows = rows.filter((r) => !r.membership_verified);
    return rows;
  }, [filter, gpoData]);

  const currentPeriodCopq = copqData?.total_value ?? 0;
  const annualCopq = currentPeriodCopq * annualizationFactor;
  const taxMismatchModalRow =
    taxOrderModalId && taxMismatchData
      ? taxMismatchData.rows.find((x) => x.order_id === taxOrderModalId)
      : undefined;
  const sortedChargebacks = [...(chargebackData?.records ?? [])].sort((a, b) => {
    const rank = (s: string) => {
      if (s === "Expiring Soon") return 1;
      if (s === "Under Review") return 2;
      if (s === "Submitted") return 3;
      return 4;
    };
    const byStatus = rank(a.dispute_status) - rank(b.dispute_status);
    if (byStatus !== 0) return byStatus;
    return (a.days_to_expiry ?? 999) - (b.days_to_expiry ?? 999);
  });
  const distributorOrders = [
    { order: "ORD-021", customer: "CUST-1010 Sandhills Center", product: "GELSYN-3 6mL", qty: 1, amount: 720, rep: "REP-02", flag: "No GPO" },
    { order: "ORD-026", customer: "CUST-1015 Bluewater Distrib", product: "DUROLANE 3mL", qty: 2, amount: 1700, rep: "GHOST-REP-99", flag: "Ghost Rep" },
    { order: "ORD-031", customer: "CUST-1010 Sandhills Center", product: "GELSYN-3 6mL", qty: 2, amount: 1440, rep: "REP-02", flag: "No GPO" },
    { order: "ORD-032", customer: "CUST-1015 Bluewater Distrib", product: "DUROLANE 3mL", qty: 3, amount: 2550, rep: "REP-06", flag: "No GPO" },
    { order: "ORD-033", customer: "CUST-1020 Inactive Five", product: "SUPARTZ FX 2.5mL", qty: 4, amount: 2600, rep: "REP-08", flag: "Inactive Account" },
    { order: "ORD-034", customer: "CUST-1025 Garner Medical", product: "GELSYN-3 6mL", qty: 3, amount: 2160, rep: "REP-02", flag: "Pending Onboarding" },
  ];

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-300">Revenue & Risk data unavailable</h2>
        <p className="text-sm text-rose-700/90 dark:text-rose-200">{error}</p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !summary || !gpoData || !taxData || !taxMismatchData || !chargebackData || !onboardingData || !territoryData || !copqData || !pricingData || !agreementExpiryData) {
    return <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />;
  }

  const pricingOpen = pricingData.total_open;
  const agreementRows = agreementExpiryData.records;

  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">{toast}</div>}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h1 className="text-2xl font-bold">Revenue & Risk Intelligence</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          GPO pricing compliance · Cost of poor data quality · Tax jurisdiction validation
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            Need Chargebacks?
          </span>
          <button
            type="button"
            onClick={jumpToChargebacks}
            className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Jump to Chargeback Queue
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex gap-2 flex-wrap">
        <TabBtn active={activeTab === "gpo"} onClick={() => selectTab("gpo")} label={`📋 GPO Pricing Intelligence · ${gpoData.conflict_count} conflicts`} />
        <TabBtn active={activeTab === "pricing"} onClick={() => selectTab("pricing")} label={`💼 Pricing work queue · ${pricingOpen} open`} />
        <TabBtn active={activeTab === "agreement-expiry"} onClick={() => selectTab("agreement-expiry")} label={`📅 Agreement expiry · ${agreementRows.length} renewals`} />
        <TabBtn
          active={activeTab === "copq"}
          onClick={() => selectTab("copq")}
          label={`📊 COPQ Calculator · $${fmtCurrency(copqData.total_value)} current period`}
        />
        <TabBtn active={activeTab === "tax"} onClick={() => selectTab("tax")} label="🏛 Tax Jurisdiction · 25 mismatches" />
        <TabBtn
          active={activeTab === "market-access"}
          onClick={() => selectTab("market-access")}
          label="🤝 Market Access & Chargebacks · 2 expiring · 5 disputes · 6 off-contract"
        />
      </div>

      {activeTab === "gpo" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Pill cls="bg-rose-100 text-rose-700">5 Pricing Conflicts</Pill>
            <Pill cls="bg-rose-100 text-rose-700">${fmtCurrency(summary.gpo_conflict_current)} current exposure</Pill>
            <Pill cls="bg-rose-100 text-rose-700">${fmtCurrency(summary.gpo_annualized)} annualized <InfoTooltip content={TOOLTIP_REV_GPO_ANNUAL} /></Pill>
            <Pill cls="bg-amber-100 text-amber-700">2 Expiring</Pill>
            <Pill cls="bg-amber-100 text-amber-700">2 Unverified</Pill>
          </div>
          <div className="rounded-xl p-4 border border-amber-300 bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-900/10 dark:to-rose-900/10">
            <p className="text-sm font-medium">
              ⚠ 2 contracts expiring within 28 days — TalisMann & StimTrial (Premier Tier1). Combined at-risk revenue: $27,500 per period
            </p>
            <button type="button" onClick={() => setShowExpiringContractsModal(true)} className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
              View Expiring Contracts →
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  {["Contract", "Customer", "Product", "GPO", "Tier", "Contract $", "Charged $", "Variance", "Status", "Action"].map((h) => (
                    <th key={h} className="text-left py-2 px-3">{h}{h === "Variance" ? <InfoTooltip content={TOOLTIP_REV_GPO_VARIANCE} /> : null}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gpoRows.map((row) => {
                  const isConflict = row.conflict_flag && row.contract_status !== "RECALLED";
                  const isExpiring = row.contract_status === "EXPIRING";
                  const isRecalled = row.contract_status === "RECALLED";
                  const isNoGpo = row.contract_status === "NO_GPO";
                  const isHighlighted = highlight === row.contract_id;
                  return (
                    <Fragment key={row.contract_id}>
                      <tr
                        id={`highlight-${row.contract_id}`}
                        className={`border-t border-slate-100 dark:border-slate-700 ${isConflict ? "bg-rose-50/50 dark:bg-rose-900/10 border-l-2 border-l-rose-500" : ""} ${isExpiring ? "bg-amber-50/50 dark:bg-amber-900/10 border-l-2 border-l-amber-500" : ""} ${isRecalled ? "bg-rose-100/50 dark:bg-rose-900/20 border-l-2 border-l-rose-700 opacity-75" : ""} ${isNoGpo ? "bg-slate-50 dark:bg-slate-700/30" : ""} ${isHighlighted ? "ring-2 ring-rose-500" : ""}`}
                        onClick={() => setContractModalId(row.contract_id)}
                      >
                        <td className="py-2 px-3">{row.contract_id}</td>
                        <td className="py-2 px-3">{row.customer_id}</td>
                        <td className="py-2 px-3">{row.product_name}</td>
                        <td className="py-2 px-3">{row.gpo_name ?? "—"} {!row.membership_verified && !isRecalled && <span className="text-xs px-1 rounded bg-amber-100 text-amber-700">⚠ Unverified</span>}</td>
                        <td className="py-2 px-3">{row.tier ?? "—"}</td>
                        <td className="py-2 px-3">{row.contracted_price != null ? `$${fmtCurrency(row.contracted_price)}` : "—"}</td>
                        <td className="py-2 px-3">${fmtCurrency(row.charged_price)}</td>
                        <td className={`py-2 px-3 ${(row.price_variance ?? 0) > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                          {(row.price_variance ?? 0) > 0 ? `↑ $${(row.price_variance ?? 0).toLocaleString()}` : (row.price_variance ?? 0) === 0 ? "$0" : "—"}
                        </td>
                        <td className="py-2 px-3">{statusBadge(row.contract_status)}</td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1 items-start">
                            <button type="button" onClick={() => setContractModalId(row.contract_id)} className="text-indigo-600 dark:text-indigo-400 text-xs">
                              View
                            </button>
                            {isConflict ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/revenue?tab=pricing&contract=${encodeURIComponent(row.contract_id)}`)}
                                className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                              >
                                Triage in queue
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "pricing" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Pricing Analyst — variance captured from GPO master vs charged price</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Conflicts surfaced on the GPO tab are the same contracts listed here for triage, credit, and SAP master updates. Open exposure{" "}
              <strong>${pricingData.total_exposure.toLocaleString()}</strong> across <strong>{pricingOpen}</strong> open line{pricingOpen === 1 ? "" : "s"}.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Next: renew or re-tier before fulfillment risk — use the Agreement expiry tab for contracts inside the renewal window.
            </p>
          </div>
          <ActionPanel
            severity="high"
            primaryPersona="Pricing Analyst"
            ownerName="Pricing Analyst"
            actions={[
              { step: 1, description: "Work highest severity first; validate GPO roster tier against charged price for each contract." },
              { step: 2, description: "Issue credit memos where variance is confirmed; update SAP pricing master and pre-shipment rules." },
              { step: 3, description: "Route membership disputes to Market Access; link disputes and alerts from the queue row actions." },
            ]}
            secondaryPersonaNote="Revenue Assurance: use this queue for ownership, SLA, and duplicate-customer checks that affect eligibility."
            ctaButtons={[
              { label: "Back to GPO context", navigateTo: "/revenue?tab=gpo", variant: "secondary" },
              { label: "Agreement renewals", navigateTo: "/revenue?tab=agreement-expiry", variant: "primary" },
              { label: "Alerts", navigateTo: "/alerts", variant: "secondary" },
            ]}
          />
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Open discrepancies</h4>
            {pricingData.records.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No pricing discrepancies in queue.</p>
            ) : (
              <PricingDiscrepancyTable rows={pricingData.records} contractHighlight={contractFocus} />
            )}
          </div>
        </div>
      )}

      {activeTab === "agreement-expiry" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Agreement expiry — renewal before pricing lapses</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {agreementRows.length} contract{agreementRows.length === 1 ? "" : "s"} inside the renewal window (same commercial contract store as GPO intelligence). Expired:{" "}
              <strong>{agreementExpiryData.expired_count}</strong>.
            </p>
            <button type="button" onClick={() => selectTab("gpo")} className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
              ← Back to GPO pricing context
            </button>
          </div>
          <ActionPanel
            severity="medium"
            primaryPersona="Market Access"
            ownerName="Market Access Team"
            actions={[
              { step: 1, description: "Confirm eligibility and roster tier before auto-renewal pricing applies." },
              { step: 2, description: "Pair renewals with any open pricing variance on the same contract_id." },
              { step: 3, description: "Escalate blockers to Revenue Assurance when membership blocks shipment." },
            ]}
            secondaryPersonaNote="Pricing Analyst: use triage queue when renewal exposes tier or list-price mismatches."
            ctaButtons={[
              { label: "Pricing queue", navigateTo: "/revenue?tab=pricing", variant: "primary" },
              { label: "Market Access hub", navigateTo: "/revenue?tab=market-access", variant: "secondary" },
            ]}
          />
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            {agreementRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No agreements in the expiry window.</p>
            ) : (
              <AgreementExpiryTable rows={agreementRows} highlightId={highlight} onTriagePricing={openPricingForContract} />
            )}
          </div>
        </div>
      )}

      {activeTab === "copq" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold">Cost of Poor Data Quality — Current Period Analysis</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Table totals and the Commercial dashboard &quot;Total At-Risk Revenue&quot; tile both use the same COPQ bucket engine:{" "}
              <span className="font-mono">/api/commercial/copq-drilldown</span> and <span className="font-mono">/api/commercial/summary.total_at_risk_revenue</span>{" "}
              stay in sync (orphan, recalled, negative, missing revenue recognition, ghost rep — orders can appear in more than one category).
            </p>
            <table className="w-full text-sm mt-3">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr><th className="text-left py-2">Category</th><th className="text-left py-2">Orders</th><th className="text-left py-2">Value</th><th className="text-left py-2">% of Total</th></tr>
              </thead>
              <tbody>
                {copqData.rows.map((row) => {
                  const highlighted = filter === row.filter;
                  return (
                    <Fragment key={row.category}>
                      <tr key={row.category} className={`border-t border-slate-100 dark:border-slate-700 cursor-pointer ${highlighted ? "ring-2 ring-rose-500" : ""}`} onClick={() => {
                        setCopqModalFilter(row.filter);
                      }}>
                        <td className="py-2">{row.category}</td>
                        <td className="py-2">{row.orders}</td>
                        <td className="py-2">${row.value.toLocaleString()}</td>
                        <td className="py-2">{row.pct}%</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
            <p className="font-semibold text-sm">COST OF POOR DATA QUALITY — FINANCIAL PROJECTION</p>
            <p className="text-sm">Current-Period COPQ Base: ${fmtCurrency(currentPeriodCopq)}</p>
            <p className="text-sm">Rework Cost Rate: 18%</p>
            <p className="text-sm">Current Period COPQ: ${fmtCurrency(currentPeriodCopq)} <InfoTooltip content={TOOLTIP_REV_COPQ_CURRENT} /></p>
            <input type="range" min={50} max={500} step={1} value={annualizationFactor} onChange={(e) => setAnnualizationFactor(Number(e.target.value))} className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-slate-500"><span>50×</span><span>500×</span></div>
            <p className="text-sm">Annualization Factor: <strong>{annualizationFactor}×</strong> <InfoTooltip content={TOOLTIP_REV_COPQ_SLIDER} /></p>
            <p className="text-xl font-bold">ANNUAL COPQ ESTIMATE: ${annualCopq.toLocaleString()}</p>
            <p className="text-sm">Margin at Risk (34% of current COPQ): <strong>${Math.round(currentPeriodCopq * 0.34).toLocaleString()}</strong> <InfoTooltip content={TOOLTIP_REV_MARGIN} /></p>
            <p className="text-xs italic text-slate-500">
              {annualizationFactor < 100
                ? "Note: Using conservative estimate. BV actual volume may be higher."
                : annualizationFactor === 153
                  ? "Current estimate based on 30-day sample × annual volume assumption."
                  : annualizationFactor >= 400
                    ? "🔴 At this scale, annual COPQ exceeds $4M — strategic priority warranted."
                    : annualizationFactor > 250
                      ? "⚠ At this volume, data quality issues represent significant annual risk."
                      : "Adjust this slider to reflect BV annual order volume."}
            </p>
          </div>
          <ActionPanel
            severity="high"
            primaryPersona="CDO"
            ownerName="Marcus Johnson"
            actions={[
              { step: 1, description: "Prioritize CAPA resolution by dollar impact: orphan records first, then recalled orders" },
              { step: 2, description: "Enforce referential integrity between sales_orders.customer_id and customer_master.customer_id" },
              { step: 3, description: "Resolving all 6 open CAPAs is projected to reduce COPQ by $47,200 within 5 weeks" },
            ]}
            secondaryPersonaNote="Also involves: Commercial Ops (orphan restoration), VP Quality (recalled order resolution)"
            ctaButtons={[
              { label: "View All CAPAs", navigateTo: "/capa", variant: "primary" },
              { label: "View Trend Simulation", navigateTo: "/trend", variant: "secondary" },
            ]}
          />
        </div>
      )}

      {activeTab === "tax" && (
        <div className="space-y-4">
          <div className={`bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-400 rounded-xl p-5 ${highlight === "ORD-005" ? "ring-2 ring-rose-500" : ""}`}>
            <h3 className="font-semibold text-rose-700 dark:text-rose-300">🚨 PRIORITY TAX ALERT — $34,000 in neXus System Orders</h3>
            <p className="text-sm mt-2">ORD-005 NC→AZ $17,000 ($1,105 risk) · ORD-008 NC→CO $17,000 ($1,105 risk). Combined exposure: $2,210.</p>
            <ActionPanel
              severity="critical"
              primaryPersona="Tax & Compliance"
              ownerName="Tax & Compliance Analyst"
              actions={[
                { step: 1, description: "Validate physical delivery addresses for ORD-005 and ORD-008 — confirm shipped to NC" },
                { step: 2, description: "If NC confirmed, issue corrected invoices with NC jurisdiction code" },
                { step: 3, description: "Amend AZ and CO tax filings if remitted incorrectly" },
              ]}
              ctaButtons={[
                { label: "View Alert ALT-007", navigateTo: "/alerts", variant: "primary" },
                { label: "View Alert ALT-008", navigateTo: "/alerts", variant: "secondary" },
              ]}
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold">Tax Exemption Certificates — 12 Customers</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">DSO simulation reference <InfoTooltip content={TOOLTIP_REV_DSO} /></p>
            <CertSection
              title="✅ Valid Certificates (4) — No action required"
              defaultOpen={false}
              certs={taxData.certs.filter((c) => c.cert_status === "VALID")}
              onRenew={() => undefined}
              sentRenewals={sentRenewals}
              navigate={navigate}
              setToast={setToast}
            />
            <CertSection
              title="⚠ Expired Certificates (4) — Immediate action required"
              defaultOpen
              showExpiredDate
              certs={taxData.certs.filter((c) => c.cert_status === "EXPIRED")}
              onRenew={(id) => {
                setSentRenewals((prev) => new Set(prev).add(id));
                setToast(`Certificate renewal request sent for ${id}`);
              }}
              sentRenewals={sentRenewals}
              navigate={navigate}
              setToast={setToast}
            />
            <CertSection
              title="🔴 Missing Certificates (4) — Critical risk"
              defaultOpen
              certs={taxData.certs.filter((c) => c.cert_status === "MISSING")}
              onRenew={() => undefined}
              sentRenewals={sentRenewals}
              navigate={navigate}
              setToast={setToast}
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold">Ship-to / Bill-to Jurisdiction Mismatches — Top 10 by Dollar Value</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {taxMismatchData.total_mismatch_count} total mismatches · ${fmtCurrency(taxMismatchData.total_order_value)} order value · Est. $
              {fmtCurrency(taxMismatchData.estimated_tax_exposure)} tax exposure
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sold-to uses <span className="font-mono">customer_master.state</span> when present. Original ship/bill mirrors sold-to (intended filing jurisdiction). Ship/bill-to parses the trailing{" "}
              <span className="font-mono">ST ZIP</span> from <span className="font-mono">sales_orders.billing_address</span>. Orphan customers without a master row use{" "}
              <span className="font-mono">demo_fallback</span> sold-to <span className="font-mono">NC</span> for this demo.
            </p>
            <table className="w-full text-sm mt-2">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left py-2">Order</th>
                  <th className="text-left py-2">Customer</th>
                  <th className="text-left py-2">Sold</th>
                  <th className="text-left py-2">Original Ship/Bill-to</th>
                  <th className="text-left py-2">Ship/Bill-to</th>
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Tax Risk <InfoTooltip content={TOOLTIP_REV_TAX} /></th>
                </tr>
              </thead>
              <tbody>
                {taxMismatchData.rows.map((r) => (
                  <Fragment key={r.order_id}>
                    <tr
                      id={`highlight-${r.order_id}`}
                      className={`border-t border-slate-100 dark:border-slate-700 cursor-pointer ${highlight === r.order_id ? "ring-2 ring-rose-500" : ""}`}
                      onClick={() => setTaxOrderModalId(r.order_id)}
                    >
                      <td className="py-2">
                        {r.order_id}{" "}
                        {r.tag ? <span className="text-[10px] px-1 rounded bg-rose-100 text-rose-700">{r.tag}</span> : null}
                      </td>
                      <td className="py-2">{r.customer_id}</td>
                      <td className="py-2">
                        {r.sold_to_state}
                        {r.sold_to_source === "demo_fallback" ? <span className="ml-1 text-[10px] text-slate-400">(demo)</span> : null}
                      </td>
                      <td className="py-2">{r.original_ship_bill_to}</td>
                      <td className="py-2">{r.mismatch_ship_bill_to}</td>
                      <td className="py-2">{r.product_name}</td>
                      <td className="py-2">${r.total_amount.toLocaleString()}</td>
                      <td className="py-2">${r.tax_risk.toLocaleString()}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "market-access" && (
        <div className="space-y-4">
          {chargebackData.expiring_soon_count > 0 && (
            <div className="rounded-xl border-2 border-rose-400 bg-rose-50 dark:bg-rose-900/20 p-4">
            <p className="font-semibold text-rose-700 dark:text-rose-300">🚨 2 disputes expire in 12 days — CHB-003 ($1,200) and CHB-004 ($1,200)</p>
              <p className="text-sm mt-1">HealthTrust membership UNVERIFIED — must confirm before filing. Total at risk of expiry: $2,400.</p>
              <ActionPanel
                severity="critical"
                primaryPersona="Market Access"
                ownerName="Market Access Team"
                actions={[
                  { step: 1, description: "Verify HealthTrust Tier1 membership for CUST-1005 and CUST-1007 via external GPO roster portal TODAY" },
                  { step: 2, description: "If membership confirmed: file CHB-003 and CHB-004 before 12-day expiry window closes" },
                  { step: 3, description: "If membership not confirmed: downgrade customers to list price tier — $2,400 dispute cannot be filed" },
                ]}
                ctaButtons={[{ label: "View Alert ALT-018", navigateTo: "/alerts", variant: "primary" }]}
              />
            </div>
          )}

          <div id="chargeback-queue" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 overflow-x-auto">
            <h3 className="font-semibold">Chargeback Disputes Queue</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Sorted by financial risk × days to expiry — your daily work queue</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr><th className="text-left py-2">Dispute ID</th><th className="text-left py-2">Customer</th><th className="text-left py-2">Product</th><th className="text-left py-2">GPO</th><th className="text-left py-2">Dispute $ <InfoTooltip content={TOOLTIP_REV_DISPUTE_TOTAL} /></th><th className="text-left py-2">Status</th><th className="text-left py-2">Days to Expiry</th><th className="text-left py-2">Membership</th><th className="text-left py-2">Action</th></tr>
              </thead>
              <tbody>
                {sortedChargebacks.map((row) => {
                  const urgent = (row.days_to_expiry ?? 99) <= 12 && row.dispute_status === "Expiring Soon";
                  const rowClass = row.dispute_status === "Expiring Soon" ? "border-l-4 border-rose-500 bg-rose-50/40 dark:bg-rose-900/10" : row.dispute_status === "Under Review" ? "border-l-4 border-amber-500" : row.dispute_status === "Submitted" ? "border-l-4 border-sky-500" : "opacity-80";
                  const filed = filedIds.has(row.chargeback_id);
                  return (
                    <Fragment key={row.chargeback_id}>
                      <tr id={`highlight-${row.chargeback_id}`} className={`border-t border-slate-100 dark:border-slate-700 ${rowClass} cursor-pointer ${highlight === row.chargeback_id ? "ring-2 ring-rose-500" : ""}`} onClick={() => setChargebackModalId(row.chargeback_id)}>
                        <td className="py-2">{row.chargeback_id} {row.distributor_flag === 1 && <span className="ml-1 text-[10px] px-1 rounded bg-purple-100 text-purple-700">Distributor</span>}</td>
                        <td className="py-2">{row.customer_name}</td>
                        <td className="py-2">{row.product_name}</td>
                        <td className="py-2">{row.gpo_name ?? "—"}</td>
                        <td className="py-2">${row.total_dispute_amount.toLocaleString()}</td>
                        <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${row.dispute_status === "Expiring Soon" ? "bg-rose-500 text-white animate-pulse" : row.dispute_status === "Under Review" ? "bg-amber-100 text-amber-700" : row.dispute_status === "Submitted" ? "bg-sky-100 text-sky-700" : row.dispute_status === "Blocked" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>{row.dispute_status}</span></td>
                        <td className="py-2">{row.days_to_expiry == null ? "—" : urgent ? `🚨 ${row.days_to_expiry} days` : row.days_to_expiry <= 30 ? `⚠ ${row.days_to_expiry} days` : `${row.days_to_expiry} days`}</td>
                        <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${row.membership_verified === "FALSE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{row.membership_verified === "FALSE" ? "⚠ Unverified" : "✓ Verified"}</span></td>
                        <td className="py-2">
                          {row.dispute_status === "Submitted" ? (
                            <button type="button" className="text-xs text-indigo-600" onClick={() => navigate("/alerts")}>Track Status</button>
                          ) : row.dispute_status === "Resolved" || row.dispute_status === "Settled" ? (
                            <button type="button" className="text-xs text-indigo-600" onClick={() => setChargebackModalId(row.chargeback_id)}>View Resolution</button>
                          ) : (
                            <button type="button" disabled={filed} onClick={() => { setFiledIds((prev) => new Set(prev).add(row.chargeback_id)); setToast(`Dispute ${row.chargeback_id} submitted — workflow initiated in CRM`); }} className={`text-xs px-2 py-1 rounded ${filed ? "bg-emerald-100 text-emerald-700" : "bg-indigo-600 text-white"}`}>{filed ? "✓ Filed" : "File Dispute"}</button>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 overflow-x-auto">
            <h3 className="font-semibold">Distributor Off-Contract Volume</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Orders from distributors without active GPO contracts — compliance review required</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Pill cls="bg-slate-100 text-slate-700">6 Off-Contract Orders</Pill>
              <Pill cls="bg-amber-100 text-amber-700">$11,170 Off-Contract Revenue</Pill>
              <Pill cls="bg-rose-100 text-rose-700">Triggers formal compliance review</Pill>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr><th className="text-left py-2">Order</th><th className="text-left py-2">Customer</th><th className="text-left py-2">Product</th><th className="text-left py-2">Qty</th><th className="text-left py-2">Amount</th><th className="text-left py-2">GPO Status</th><th className="text-left py-2">Rep</th><th className="text-left py-2">Issue Flags</th><th className="text-left py-2">Action</th></tr>
              </thead>
              <tbody>
                {distributorOrders.map((row) => {
                  const enrolled = enrolledIds.has(row.order);
                  return (
                    <Fragment key={row.order}>
                      <tr className="border-t border-slate-100 dark:border-slate-700 cursor-pointer" onClick={() => setDistributorModalOrderId(row.order)}>
                        <td className="py-2">{row.order}</td><td className="py-2">{row.customer}</td><td className="py-2">{row.product}</td><td className="py-2">{row.qty}</td><td className="py-2">${row.amount.toLocaleString()}</td>
                        <td className="py-2">No GPO</td><td className="py-2">{row.rep}</td>
                        <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${row.flag === "Inactive Account" ? "bg-rose-100 text-rose-700" : row.flag === "Pending Onboarding" || row.flag === "Ghost Rep" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{row.flag}</span></td>
                        <td className="py-2 flex gap-2">
                          <button type="button" disabled={enrolled} onClick={() => { setEnrolledIds((prev) => new Set(prev).add(row.order)); setToast(`GPO enrollment request submitted for ${row.customer}`); }} className={`text-xs px-2 py-1 rounded ${enrolled ? "bg-emerald-100 text-emerald-700" : "bg-indigo-600 text-white"}`}>{enrolled ? "✓ Enrolled" : "Enroll in GPO"}</button>
                          {(row.flag === "Inactive Account" || row.flag === "Ghost Rep") && <button type="button" className="text-xs text-indigo-600" onClick={() => navigate("/alerts")}>Flag for Review</button>}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold">Contracts Requiring Renewal Action</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Linked from GPO Pricing Intelligence — action required within 28 days</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-3">
                <p className="font-medium">GPC-011 TalisMann Premier Tier1</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Customer: CUST-1027 Triad Specialists</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Expiry: 28 days · Current contracted: $12,000 → List price if lapsed: $14,000</p>
                <p className="text-xs text-emerald-600 mt-1">SLA status: ON TRACK (SLA-007)</p>
                <button type="button" onClick={() => setToast("Premier renewal request initiated for GPC-011")} className="mt-2 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">Initiate Renewal</button>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-3">
                <p className="font-medium">GPC-012 StimTrial Premier Tier1</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Customer: CUST-1028 East Center</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Expiry: 28 days · Current contracted: $11,500 → List price if lapsed: $13,500</p>
                <p className="text-xs text-emerald-600 mt-1">SLA status: ON TRACK (SLA-008)</p>
                <button type="button" onClick={() => setToast("Premier renewal request initiated for GPC-012")} className="mt-2 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">Initiate Renewal</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <DetailModal open={showExpiringContractsModal} onClose={() => setShowExpiringContractsModal(false)} title="Contracts Requiring Renewal Action">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Linked from GPO Pricing Intelligence — action required within 28 days.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-3">
            <p className="font-medium">GPC-011 TalisMann Premier Tier1</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Customer: CUST-1027 Triad Specialists</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Expiry: 28 days · Current contracted: $12,000 → List price if lapsed: $14,000</p>
            <p className="text-xs text-emerald-600 mt-1">SLA status: ON TRACK (SLA-007)</p>
            <button type="button" onClick={() => setToast("Premier renewal request initiated for GPC-011")} className="mt-2 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">Initiate Renewal</button>
          </div>
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-3">
            <p className="font-medium">GPC-012 StimTrial Premier Tier1</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Customer: CUST-1028 East Center</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Expiry: 28 days · Current contracted: $11,500 → List price if lapsed: $13,500</p>
            <p className="text-xs text-emerald-600 mt-1">SLA status: ON TRACK (SLA-008)</p>
            <button type="button" onClick={() => setToast("Premier renewal request initiated for GPC-012")} className="mt-2 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">Initiate Renewal</button>
          </div>
        </div>
      </DetailModal>
      <DetailModal
        open={Boolean(contractModalId)}
        onClose={() => setContractModalId(null)}
        title={`Contract Detail${contractModalId ? ` — ${contractModalId}` : ""}`}
      >
        {contractModalId && (() => {
          const row = gpoRows.find((r) => r.contract_id === contractModalId);
          if (!row) return <p className="text-sm text-slate-500">No details found.</p>;
          return (
            <div className="space-y-3">
              <p className="text-sm">Charged: ${fmtCurrency(row.charged_price)} · Contracted: {row.contracted_price != null ? `$${fmtCurrency(row.contracted_price)}` : "N/A"}</p>
              {(row.price_variance ?? 0) > 0 && <p className="text-sm">Overcharge: ${row.price_variance?.toLocaleString()}/unit</p>}
              <p className="text-sm">Linked Order: {row.linked_order_id ?? "N/A"} · {row.customer_id} · {row.product_name}</p>
              {row.contract_id === "GPC-003" && <p className="text-sm text-amber-700 dark:text-amber-300">ORD-010 references CUST-9902 (orphan) while conflict is on CUST-1005.</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setToast("Dispute workflow initiated — ticket created in CRM")} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Initiate Dispute</button>
                <button type="button" onClick={() => setToast("Contract eligibility update initiated")} className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 text-sm">Update Contract Eligibility</button>
                <button type="button" onClick={() => navigate("/profiler?dataset=sales_orders")} className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 text-sm">View Order</button>
              </div>
              {contractPanel(row)}
            </div>
          );
        })()}
      </DetailModal>
      <DetailModal
        open={Boolean(copqModalFilter)}
        onClose={() => setCopqModalFilter(null)}
        title="COPQ Category Detail"
      >
        {copqModalFilter && (() => {
          const row = copqData.rows.find((r) => r.filter === copqModalFilter);
          const records = copqData.records.filter((r) => r.filter === copqModalFilter);
          if (!row) return <p className="text-sm text-slate-500">No details found.</p>;
          return (
            <div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                Orders | Value | % of Total: <strong>{row.orders}</strong> | <strong>${row.value.toLocaleString()}</strong> | <strong>{row.pct}%</strong>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-1 pr-3">order_id</th>
                      <th className="py-1 pr-3">customer_id</th>
                      <th className="py-1 pr-3">product_name</th>
                      <th className="py-1 pr-3">total_amount</th>
                      <th className="py-1 pr-3">issue_category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => (
                      <tr key={`${rec.filter}-${rec.order_id}`} className="border-b border-slate-100 dark:border-slate-700/60">
                        <td className="py-1 pr-3 font-mono">{rec.order_id}</td>
                        <td className="py-1 pr-3">{rec.customer_id}</td>
                        <td className="py-1 pr-3">{rec.product_name}</td>
                        <td className="py-1 pr-3">${rec.total_amount.toLocaleString()}</td>
                        <td className="py-1 pr-3">{rec.issue_category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </DetailModal>
      <DetailModal
        open={Boolean(taxOrderModalId)}
        onClose={() => setTaxOrderModalId(null)}
        title={`Tax Mismatch Detail${taxOrderModalId ? ` — ${taxOrderModalId}` : ""}`}
      >
        {taxOrderModalId && taxMismatchData ? (
          taxMismatchModalRow ? (
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Sold-to <span className="font-mono">{taxMismatchModalRow.sold_to_state}</span> ({taxMismatchModalRow.sold_to_source}) vs billing-address jurisdiction{" "}
                <span className="font-mono">{taxMismatchModalRow.mismatch_ship_bill_to}</span>. Intended filing jurisdiction (original ship/bill):{" "}
                <span className="font-mono">{taxMismatchModalRow.original_ship_bill_to}</span>.
              </p>
              <p>
                Order amount <strong>${taxMismatchModalRow.total_amount.toLocaleString()}</strong> · modeled tax risk <strong>${taxMismatchModalRow.tax_risk.toLocaleString()}</strong>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">Open this order from the mismatch table above.</p>
          )
        ) : null}
      </DetailModal>
      <DetailModal
        open={Boolean(chargebackModalId)}
        onClose={() => setChargebackModalId(null)}
        title={`Chargeback Detail${chargebackModalId ? ` — ${chargebackModalId}` : ""}`}
      >
        {chargebackModalId && (() => {
          const row = sortedChargebacks.find((r) => r.chargeback_id === chargebackModalId);
          if (!row) return <p className="text-sm text-slate-500">No details found.</p>;
          return (
            <div className="space-y-3">
              <p className="text-sm">{row.financial_impact}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{row.action_required}</p>
              {row.chargeback_id === "CHB-002" && (
                <ActionPanel
                  severity="high"
                  primaryPersona="Market Access"
                  ownerName="Market Access Team"
                  actions={[
                    { step: 1, description: "File credit memo for $260 overcharge on DUROLANE to CUST-1026 (2 units × $130 Premier Tier2 variance)" },
                    { step: 2, description: "Note: CUST-1026 Capital Institute also has recalled EXOGEN 4.0 order (ORD-015) — coordinate resolution sequence with VP Quality" },
                    { step: 3, description: "Update Premier contract GPC-002 pricing master to prevent recurrence" },
                  ]}
                  secondaryPersonaNote="Also involves: VP Quality (CUST-1026 has recalled product order + MDR gap — higher priority than this dispute)"
                  ctaButtons={[{ label: "View CUST-1026 Hierarchy", navigateTo: "/hierarchy?customer=CUST-1026", variant: "primary" }]}
                />
              )}
              {row.chargeback_id === "CHB-010" && (
                <ActionPanel
                  severity="medium"
                  primaryPersona="Market Access"
                  ownerName="Market Access Team"
                  actions={[
                    { step: 1, description: "Sandhills Center (CUST-1010) placed ORD-031 for GELSYN-3 without active GPO contract. $1,440 off-contract." },
                    { step: 2, description: "Enroll CUST-1010 in Vizient GPO (IDN-003 HealthTrust account — should qualify for HealthTrust tier)." },
                    { step: 3, description: "Issue list-price invoice for ORD-031 ($1,440) until GPO enrollment confirmed." },
                  ]}
                  ctaButtons={[{ label: "View Hierarchy CUST-1010", navigateTo: "/hierarchy?customer=CUST-1010", variant: "primary" }]}
                />
              )}
            </div>
          );
        })()}
      </DetailModal>
      <DetailModal
        open={distributorModalOrderId === "ORD-033"}
        onClose={() => setDistributorModalOrderId(null)}
        title="Distributor Detail — ORD-033"
      >
        <ActionPanel
          severity="high"
          primaryPersona="Commercial Ops"
          ownerName="Linda Torres"
          actions={[
            { step: 1, description: "CUST-1020 Inactive Five placed ORD-033 ($2,600) but account status is Inactive. Revenue recognition blocked." },
            { step: 2, description: "Confirm whether account should be reactivated or if this was an unauthorized order." },
            { step: 3, description: "If unauthorized: cancel order and notify REP-08. If reactivation needed: route to Finance for credit review first." },
          ]}
          secondaryPersonaNote="Also involves: Credit & AR (revenue recognition cannot proceed on inactive account)"
          ctaButtons={[{ label: "View Customer in Hierarchy", navigateTo: "/hierarchy?filter=orphan", variant: "primary" }]}
        />
      </DetailModal>
    </div>
  );
}

function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm ${active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>{label}</button>;
}
function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`text-sm px-3 py-1 rounded-full ${cls}`}>{children}</span>;
}
function statusBadge(status: string) {
  if (status === "ACTIVE") return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">ACTIVE</span>;
  if (status === "EXPIRING") return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Expiring 28d</span>;
  if (status === "RECALLED") return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Contract Void</span>;
  if (status === "CONFLICT") return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Conflict</span>;
  if (status === "NO_GPO") return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">No GPO</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{status}</span>;
}

function contractPanel(row: GPOContract) {
  if (row.contract_id === "GPC-003") {
    return (
      <ActionPanel
        severity="high"
        primaryPersona="Pricing Analyst"
        ownerName="Pricing Analyst"
        actions={[
          { step: 1, description: "Validate HealthTrust Tier1 membership for CUST-1005 via external GPO roster" },
          { step: 2, description: "If confirmed, issue $1,200 credit memo and update SAP pricing master" },
          { step: 3, description: "If not confirmed, downgrade to list price and initiate dispute" },
        ]}
        secondaryPersonaNote="Also involves: Market Access (GPO membership verification for HealthTrust)"
        ctaButtons={[
          { label: "View Alert ALT-004", navigateTo: "/alerts", variant: "primary" },
          { label: "View Hierarchy CUST-1005", navigateTo: "/hierarchy?customer=CUST-1005", variant: "secondary" },
        ]}
      />
    );
  }
  if (row.contract_id === "GPC-005") {
    return (
      <ActionPanel
        severity="high"
        primaryPersona="Pricing Analyst"
        ownerName="Pricing Analyst"
        actions={[
          { step: 1, description: "Issue credit memo for $1,700 to CUST-1003 Raleigh Clinic for ORD-005" },
          { step: 2, description: "Update neXus pricing in SAP for Vizient Tier2 accounts to $7,650" },
          { step: 3, description: "Add pre-shipment rule to block list pricing for Vizient Tier2 accounts" },
        ]}
        ctaButtons={[{ label: "View Alert ALT-006", navigateTo: "/alerts", variant: "primary" }]}
      />
    );
  }
  if (row.contract_id === "GPC-011") {
    return (
      <ActionPanel
        severity="medium"
        primaryPersona="Market Access"
        ownerName="Market Access Team"
        actions={[
          { step: 1, description: "Initiate TalisMann Tier1 renewal with Premier (expires 2026-05-26)" },
          { step: 2, description: "Notify REP-10 of expiry risk and $2,000/order increase if lapsed" },
          { step: 3, description: "Block Tier1 pricing if renewal confirmation is not received" },
        ]}
        ctaButtons={[{ label: "View Alert ALT-011", navigateTo: "/alerts", variant: "primary" }]}
      />
    );
  }
  if (row.contract_id === "GPC-016" || row.contract_id === "GPC-017") {
    return (
      <ActionPanel
        severity="critical"
        primaryPersona="VP Quality"
        ownerName="Dr. Sarah Kim"
        actions={[
          { step: 1, description: "Contract is void because EXOGEN 4.0 was recalled on 2025-09-15" },
          { step: 2, description: "Initiate product retrieval from impacted customers immediately" },
          { step: 3, description: "File FDA 806 correction report and reverse revenue recognition" },
        ]}
        secondaryPersonaNote="Also involves: Finance (revenue reversal for ORD-013, ORD-015)"
        ctaButtons={[{ label: "View CAPA-004", navigateTo: "/capa", variant: "primary" }]}
      />
    );
  }
  return null;
}

function CertSection({
  title,
  defaultOpen,
  showExpiredDate = false,
  certs,
  onRenew,
  sentRenewals,
  navigate,
  setToast,
}: {
  title: string;
  defaultOpen: boolean;
  showExpiredDate?: boolean;
  certs: TaxCert[];
  onRenew: (id: string) => void;
  sentRenewals: Set<string>;
  navigate: (path: string) => void;
  setToast: (msg: string) => void;
}) {
  const { formatDate } = useDateFormat();
  const [open, setOpen] = useState(defaultOpen);
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button type="button" className="text-sm font-medium" onClick={() => setOpen((p) => !p)}>{open ? "▼" : "▶"} {title}</button>
      {open && (
        <table className="w-full text-sm mt-2">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left py-2">Customer</th>
              <th className="text-left py-2">Cert #</th>
              {showExpiredDate && <th className="text-left py-2">Expired Date</th>}
              <th className="text-left py-2">Orders</th>
              <th className="text-left py-2">Revenue at Risk</th>
              <th className="text-left py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <Fragment key={c.cert_id}>
                <tr key={c.cert_id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-2">{c.customer_id} {c.customer_name}</td>
                  <td className="py-2">{c.cert_number ?? "—"}</td>
                  {showExpiredDate && <td className="py-2">{c.expiry_date ? formatDate(c.expiry_date) : "—"}</td>}
                  <td className="py-2">{c.orders_affected ?? "None"}</td>
                  <td className="py-2">${fmtCurrency(c.revenue_at_risk)}</td>
                  <td className="py-2">
                    {c.cert_status === "EXPIRED" ? (
                      <button type="button" disabled={sentRenewals.has(c.cert_id)} onClick={() => onRenew(c.cert_id)} className={`text-xs px-2 py-1 rounded ${sentRenewals.has(c.cert_id) ? "bg-emerald-100 text-emerald-700" : "bg-indigo-600 text-white"}`}>
                        {sentRenewals.has(c.cert_id) ? "✓ Renewal Sent" : "Send Renewal"}
                      </button>
                    ) : c.cert_id === "CERT-011" || c.cert_id === "CERT-012" ? (
                      <button type="button" onClick={() => setSelectedCertId(c.cert_id)} className="text-xs text-indigo-600 dark:text-indigo-400">View Details</button>
                    ) : (
                      <button type="button" onClick={() => setToast("Obtain before first order")} className="text-xs text-indigo-600 dark:text-indigo-400">Obtain Before First Order</button>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      <DetailModal
        open={Boolean(selectedCertId)}
        onClose={() => setSelectedCertId(null)}
        title={`Certificate Detail${selectedCertId ? ` — ${selectedCertId}` : ""}`}
      >
        {selectedCertId ? (
          <>
            <p className="text-sm">{selectedCertId === "CERT-011" ? "Capital Institute has $5,900 in orders without valid cert, including recalled ORD-015. Coordinated action required." : "East Center has $30,500 in orders without cert, including ORD-008 jurisdiction mismatch and recalled ORD-014."}</p>
            <ActionPanel
              severity="critical"
              primaryPersona="Tax & Compliance"
              ownerName="Tax & Compliance Analyst"
              actions={selectedCertId === "CERT-011" ? [
                { step: 1, description: "Obtain NC tax exemption certificate from Capital Institute immediately" },
                { step: 2, description: "Suspend tax-exempt status for CUST-1026 until certificate is on file" },
                { step: 3, description: "Coordinate ORD-015 recalled product action with VP Quality" },
              ] : [
                { step: 1, description: "Obtain NC exemption certificate from East Center (highest revenue at risk)" },
                { step: 2, description: "Correct ORD-008 jurisdiction mismatch and tax filing" },
                { step: 3, description: "Suspend tax-exempt status for CUST-1028 until certificate is confirmed" },
              ]}
              secondaryPersonaNote={selectedCertId === "CERT-011" ? "Also involves: VP Quality (ORD-015 recalled EXOGEN — CAPA-004)" : "Also involves: VP Quality (ORD-014 recalled), Credit & AR (CUST-1028 at credit limit)"}
              ctaButtons={selectedCertId === "CERT-011" ? [
                { label: "View CUST-1026 in Hierarchy", navigateTo: "/hierarchy?customer=CUST-1026", variant: "primary" },
                { label: "View CAPA-004", navigateTo: "/capa", variant: "secondary" },
              ] : [
                { label: "View Hierarchy CUST-1028", navigateTo: "/hierarchy?customer=CUST-1028", variant: "primary" },
                { label: "View Priority Alert", navigateTo: "/alerts", variant: "secondary" },
              ]}
            />
            <button type="button" onClick={() => navigate(selectedCertId === "CERT-011" ? "/hierarchy?customer=CUST-1026" : "/hierarchy?customer=CUST-1028")} className="hidden">go</button>
          </>
        ) : null}
      </DetailModal>
    </div>
  );
}
