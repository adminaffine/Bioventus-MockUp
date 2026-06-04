import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { api, type HierarchyNode, type RosterDeltaRecord } from "../services/api";
import HierarchyTree from "../components/HierarchyTree";
import ActionPanel from "../components/ActionPanel";
import { KPICardSkeleton } from "../components/skeletons/KPICardSkeleton";
import { RoleContextBanner } from "../components/RoleContextBanner";
import { useRole } from "../context/RoleContext";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_HIER_CONFIDENCE, TOOLTIP_HIER_CREDIT, TOOLTIP_HIER_IDN_REVENUE, TOOLTIP_HIER_IQVIA } from "../lib/tooltipContent";

type HierarchyPayload = Awaited<ReturnType<typeof api.getHierarchy>>;

type TabId = "tree" | "orphans" | "iqvia";

const ONBOARDING_STALL_IDS = ["CUST-1021", "CUST-1022", "CUST-1023", "CUST-1024", "CUST-1025"];

function orphanCustomerKey(n: HierarchyNode): string | null {
  if (n.linked_customer_id) return n.linked_customer_id;
  const blob = `${n.node_id} ${n.node_name}`;
  const m = blob.match(/CUST-\d+/);
  return m ? m[0] : null;
}

function clinicActionModel(customerId: string) {
  if (customerId === "CUST-1009") {
    return {
      severity: "high" as const,
      primaryPersona: "Commercial Ops",
      ownerName: "Linda Torres",
      actions: [
        { step: 1, description: "Map Cape Institute to IDN-002 Carolina Medical Group — nearest geographic match (Fayetteville, NC)" },
        { step: 2, description: "Enroll CUST-1009 in Vizient GPO and assign Tier3 pricing ($585/unit SUPARTZ FX)" },
        { step: 3, description: "Issue credit memo for $65 list-price overpayment on ORD-020" },
      ],
      secondaryPersonaNote: "Also involves: Pricing Analyst (GPO enrollment and pricing update)",
      ctaButtons: [
        { label: "View Alert ALT-003", navigateTo: "/alerts", variant: "primary" as const },
        { label: "View Order ORD-020", navigateTo: "/profiler?dataset=sales_orders", variant: "secondary" as const },
      ],
    };
  }
  if (customerId === "CUST-1026") {
    return {
      severity: "critical" as const,
      primaryPersona: "VP Quality",
      ownerName: "Dr. Sarah Kim",
      actions: [
        { step: 1, description: "Stop all EXOGEN 4.0 shipments to Capital Institute immediately", regulation: "21 CFR Part 806" },
        {
          step: 2,
          description: "File retroactive MDR for CASE-5011 and CASE-5014 via FDA MedWatch",
          regulation: "21 CFR Part 803",
          deadline: "Immediate — 30-day window elapsed",
        },
        { step: 3, description: "Initiate EXOGEN 4.0 product retrieval from CUST-1026 and file FDA 806 correction report" },
      ],
      secondaryPersonaNote: "Also involves: Tax & Compliance (missing exemption cert CERT-011 — $5,900 at risk)",
      ctaButtons: [
        { label: "Open CAPA-001", navigateTo: "/capa", variant: "primary" as const },
        { label: "View Compliance", navigateTo: "/compliance", variant: "secondary" as const },
      ],
    };
  }
  if (customerId === "CUST-1012") {
    return {
      severity: "high" as const,
      primaryPersona: "MDM Lead",
      ownerName: "Marcus Johnson",
      actions: [
        { step: 1, description: "Run NPI/tax ID crosswalk to confirm true identity of CUST-1012" },
        { step: 2, description: "Assign single correct parent HCO and IDN, sunset the duplicate record" },
        { step: 3, description: "Update GPO eligibility and pricing tier once parent is confirmed" },
      ],
      secondaryPersonaNote: "Also involves: Pricing Analyst (GPO tier ambiguous — ORD-023 pricing may need correction)",
      ctaButtons: [{ label: "View GPO Contracts", navigateTo: "/revenue?tab=gpo", variant: "primary" as const }],
    };
  }
  return {
    severity: "medium" as const,
    primaryPersona: "Commercial Ops",
    ownerName: "Linda Torres",
    actions: [
      { step: 1, description: "Validate hierarchy mapping and associated order lineage for this clinic account" },
      { step: 2, description: "Confirm parent HCO and IDN assignment in customer hierarchy master" },
      { step: 3, description: "Review pricing/GPO eligibility impact and sync related records" },
    ],
    ctaButtons: [{ label: "View Alerts", navigateTo: "/alerts", variant: "secondary" as const }],
  };
}

function formatUsd0(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function HierarchyStatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-900/50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default function HierarchyIntelligence() {
  const navigate = useNavigate();
  const { currentRole } = useRole();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("tree");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyPayload | null>(null);
  const [rosterDeltas, setRosterDeltas] = useState<RosterDeltaRecord[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<HierarchyNode | null>(null);
  const [selectedIdn, setSelectedIdn] = useState<string | null>(null);
  const [acknowledgedDeltas, setAcknowledgedDeltas] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const queryIdn = searchParams.get("idn");
  const queryCustomer = searchParams.get("customer");
  const queryTab = searchParams.get("tab");
  const queryFilter = searchParams.get("filter");

  useEffect(() => {
    if (queryTab === "iqvia") setActiveTab("iqvia");
    if (queryFilter === "orphan") setActiveTab("orphans");
  }, [queryFilter, queryTab]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await api.getHierarchy();
        const roster = await api.getRosterDeltas();
        setHierarchy(data);
        setRosterDeltas(roster.records);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load hierarchy.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!hierarchy || !queryCustomer) return;
    const node = hierarchy.nodes.find((n) => n.linked_customer_id === queryCustomer);
    if (node) {
      setSelectedClinic(node);
      setActiveTab(node.node_type === "ORPHAN" ? "orphans" : activeTab);
    }
  }, [hierarchy, queryCustomer, activeTab]);

  useEffect(() => {
    if (!queryIdn) return;
    setSelectedIdn(queryIdn);
  }, [queryIdn]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const isDark = document.documentElement.classList.contains("dark");

  const hcpNodes = useMemo(() => hierarchy?.nodes.filter((n) => n.node_type === "HCP") ?? [], [hierarchy]);
  const orphanNodes = useMemo(
    () => hierarchy?.nodes.filter((n) => (n.node_type || "").toUpperCase() === "ORPHAN") ?? [],
    [hierarchy]
  );
  const conflictNodes = useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.nodes.filter((n) => {
      const u = (n.hierarchy_status || "").toUpperCase();
      if (!u) return false;
      if (/\b(NO|NON)[_-]?\s*CONFLICT\b/.test(u)) return false;
      return /(^|[^A-Z0-9])CONFLICT([^A-Z0-9]|$)/.test(u);
    });
  }, [hierarchy]);
  const pendingMappingNodes = useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.nodes.filter((n) => {
      if ((n.node_type || "").toUpperCase() === "PENDING") return true;
      const s = (n.hierarchy_status || "").trim().toUpperCase();
      if (!s) return false;
      if (/\b(NOT|NO)[_-]?\s*PENDING\b/.test(s)) return false;
      return s === "PENDING" || s.startsWith("PENDING ");
    });
  }, [hierarchy]);
  const iqviaDriverCount = useMemo(
    () => hierarchy?.confidence_drivers?.find((d) => d.name === "IQVIA Deltas Pending")?.count ?? rosterDeltas.length,
    [hierarchy?.confidence_drivers, rosterDeltas.length]
  );
  const issuesTabCount = (hierarchy?.orphan_count ?? 0) + (hierarchy?.conflict_count ?? 0) + (hierarchy?.pending_count ?? 0);
  const orphanAttributedTotal = useMemo(() => {
    if (hierarchy?.orphan_attributed_revenue_total != null) return hierarchy.orphan_attributed_revenue_total;
    return orphanNodes.reduce((sum, n) => sum + (n.attributed_revenue ?? 0), 0);
  }, [hierarchy?.orphan_attributed_revenue_total, orphanNodes]);
  /** Legacy API used orphan weight 4.5 — if you see 0% confidence with huge IQVIA counts, the backend is not this repo's build. */
  const staleHierarchyApi = useMemo(() => {
    const v = hierarchy?.metrics_schema_version;
    if (v === 2) return false;
    const first = hierarchy?.confidence_drivers?.[0];
    if (first?.name === "Orphaned Entities" && first.weight >= 3) return true;
    return v != null && v < 2;
  }, [hierarchy?.confidence_drivers, hierarchy?.metrics_schema_version]);
  const selectedClinicAction = selectedClinic?.linked_customer_id ? clinicActionModel(selectedClinic.linked_customer_id) : null;

  const confidencePieData = useMemo(() => {
    const score = hierarchy?.confidence_score ?? 0;
    const s = Math.max(0, Math.min(100, score));
    return [
      { name: "Confidence", value: s, fill: "#f59e0b" },
      { name: "Exposure drag", value: Math.max(0, 100 - s), fill: isDark ? "#334155" : "#e2e8f0" },
    ];
  }, [hierarchy?.confidence_score, isDark]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !hierarchy) {
    return <div className="p-4 text-rose-600 dark:text-rose-400">{error ?? "No hierarchy data available."}</div>;
  }

  return (
    <div className="space-y-6">
      <RoleContextBanner route="/hierarchy" />
      {staleHierarchyApi && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold">Hierarchy metrics API looks out of date</p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
            This response still uses the old driver weights (e.g. orphan ×4.5) or is missing{" "}
            <span className="font-mono">metrics_schema_version: 2</span>. The UI in this repo expects the process that serves{" "}
            <span className="font-mono">/api/commercial/hierarchy</span> from the current <span className="font-mono">backend/routers/commercial.py</span>{" "}
            (response header <span className="font-mono">X-Luminos-Hierarchy-Metrics: v2</span>). Restart or redeploy the API on port 18005 from this workspace, then hard-refresh.
          </p>
        </div>
      )}
      {toast && (
        <div className="fixed top-20 right-6 z-50 rounded-lg px-4 py-2 text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 shadow-lg">
          {toast}
        </div>
      )}

      {currentRole.id === "cfo" && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/10 p-4 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Credit & AR Overview — MedStar Alliance (IDN-003)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">IDN-003 Utilization</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">$56,280 / $200,000</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">28.1%</p>
            </div>
            <div className="rounded-lg border border-rose-300 dark:border-rose-700 p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">CUST-1028 Sub-limit</p>
              <p className="text-lg font-bold text-rose-700 dark:text-rose-300">$30,500 / $30,000</p>
              <p className="text-xs text-rose-700 dark:text-rose-300">AT LIMIT</p>
            </div>
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">DSO Risk</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">$29,100</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">6 orders</p>
            </div>
          </div>
          <ActionPanel
            severity="high"
            primaryPersona="Credit & AR"
            ownerName="Finance Team"
            actions={[
              { step: 1, description: "Review CUST-1028 East Center: $30,500 revenue vs $30,000 sub-limit under IDN-003 MedStar Alliance" },
              { step: 2, description: "Place credit hold on CUST-1028 new orders until IDN-003 aggregate exposure reviewed" },
              { step: 3, description: "Route credit extension request to Finance Leadership — include recalled EXOGEN order context (ORD-014 $4,200 to be reversed)" },
            ]}
            secondaryPersonaNote="Also involves: VP Quality (CUST-1028 has recalled EXOGEN 4.0 order ORD-014 — once reversed, net exposure drops to $26,300)"
            ctaButtons={[
              { label: "View IDN-003 in Tree", navigateTo: "/hierarchy?idn=IDN-003", variant: "primary" },
              { label: "View DSO Analysis", navigateTo: "/csuite", variant: "secondary" },
            ]}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Customer Hierarchy Intelligence</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              IDN → Hospital → Clinic → HCP relationship mapping · BV account ecosystem
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HierarchyStatChip label="Mapped (tree)" value={hierarchy.mapped_count} />
            <HierarchyStatChip label="Orphans" value={hierarchy.orphan_count} />
            <HierarchyStatChip label="Conflicts" value={hierarchy.conflict_count} />
            <HierarchyStatChip label="Pending map" value={hierarchy.pending_count} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Counts match the confidence model and the Issues / IQVIA tabs below. Open issues total:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{issuesTabCount}</span> entities
            {iqviaDriverCount > 0 ? (
              <>
                {" "}
                · IQVIA roster signals (penalty driver):{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{iqviaDriverCount}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Hierarchy Confidence <InfoTooltip content={TOOLTIP_HIER_CONFIDENCE} /></p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Score = 100 minus weighted orphan, conflict, pending mapping, and IQVIA / stewardship signals from{" "}
            <span className="font-mono">/api/commercial/hierarchy</span> — same IQVIA signal filter as{" "}
            <span className="font-mono">/api/commercial/roster-deltas</span> (excludes explicit NO / clean; YES on HCP with NPI or PENDING stewardship rows).
          </p>
          <div className="h-40 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={confidencePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={68}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {confidencePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number, name: string) => [`${value}%`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-2xl font-bold text-center text-amber-600 dark:text-amber-300">{hierarchy.confidence_score}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hierarchy.orphan_count} orphans · {hierarchy.conflict_count} conflict · {hierarchy.pending_count} pending mapping ·{" "}
            {iqviaDriverCount} IQVIA signals
          </p>
          {hierarchy.confidence_drivers && hierarchy.confidence_drivers.length > 0 && (
            <div className="mt-2 space-y-1">
              {hierarchy.confidence_drivers.map((driver) => (
                <p key={driver.name} className="text-[11px] text-slate-500 dark:text-slate-400">
                  {driver.name}: {driver.count} × {driver.weight.toFixed(1)} impact
                </p>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-snug">
            Storyline: the headline counts match the{" "}
            <button type="button" className="text-indigo-600 dark:text-indigo-300 underline" onClick={() => setActiveTab("orphans")}>
              Issues
            </button>{" "}
            tab (orphan + conflict + pending nodes) and each{" "}
            <button type="button" className="text-indigo-600 dark:text-indigo-300 underline" onClick={() => setActiveTab("iqvia")}>
              IQVIA
            </button>{" "}
            card. When IQVIA dominates the penalty, clearing roster deltas first is the fastest path back to green confidence.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex flex-wrap gap-2">
        <TabButton active={activeTab === "tree"} onClick={() => setActiveTab("tree")} label={`🌳 Hierarchy Tree (${hierarchy.mapped_count} mapped)`} />
        <TabButton
          active={activeTab === "orphans"}
          onClick={() => setActiveTab("orphans")}
          label={`⚠ Issues (${issuesTabCount}) — ${hierarchy?.orphan_count ?? 0} orphans + ${hierarchy?.conflict_count ?? 0} conflict + ${hierarchy?.pending_count ?? 0} pending`}
        />
        <TabButton active={activeTab === "iqvia"} onClick={() => setActiveTab("iqvia")} label={`📡 IQVIA roster signals (${rosterDeltas.length})`} />
      </div>

      {activeTab === "tree" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <HierarchyTree
            nodes={hierarchy.nodes}
            selectedCustomerId={selectedClinic?.linked_customer_id ?? null}
            highlightIdn={queryIdn ?? selectedIdn}
            onSelectClinic={(node) => setSelectedClinic(node)}
            onSelectIdn={(idnId) => {
              setSelectedIdn(idnId);
              if (idnId === "IDN-003") {
                setSelectedClinic(null);
              }
            }}
          />

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
            {selectedIdn === "IDN-003" && !selectedClinic && (
              <>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">IDN-003 MedStar Alliance</h3>
                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <p>Revenue: $56,280 across 4 subsidiaries <InfoTooltip content={TOOLTIP_HIER_IDN_REVENUE} /></p>
                  <p>Credit limit: $200,000 (IDN level)</p>
                  <p>CUST-1028 East Center: $30,500 vs $30,000 sub-limit — AT LIMIT <InfoTooltip content={TOOLTIP_HIER_CREDIT} /></p>
                  <p>Recalled orders: ORD-013, ORD-014, ORD-016</p>
                </div>
                <ActionPanel
                  severity="high"
                  primaryPersona="Credit & AR"
                  ownerName="Finance Team"
                  actions={[
                    { step: 1, description: "Review aggregated IDN-003 credit exposure across 4 subsidiaries" },
                    { step: 2, description: "Place credit hold on CUST-1028 East Center — at its limit with recalled product orders" },
                    { step: 3, description: "Route credit extension request or reduce exposure by resolving recalled orders first" },
                  ]}
                  secondaryPersonaNote="Also involves: VP Quality (3 recalled EXOGEN orders under IDN-003)"
                  ctaButtons={[
                    { label: "View Alert ALT-009", navigateTo: "/alerts", variant: "primary" },
                    { label: "View Commercial Dashboard", navigateTo: "/commercial", variant: "secondary" },
                  ]}
                />
              </>
            )}

            {selectedClinic && (
              <>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{selectedClinic.node_name}</h3>
                <div className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 w-fit">
                  {selectedClinic.linked_customer_id ?? selectedClinic.node_id}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <p>Status: {selectedClinic.hierarchy_status}</p>
                  <p>IDN: {selectedClinic.idn_name ?? "None"}</p>
                  <p>HCO: {selectedClinic.hco_name ?? "None"}</p>
                  <p>GPO: {selectedClinic.gpo_membership ?? "None"} {selectedClinic.gpo_tier ?? ""}</p>
                  <p>Credit Limit: {selectedClinic.credit_limit ? `$${selectedClinic.credit_limit.toLocaleString()}` : "N/A"}</p>
                  {selectedClinic.linked_customer_id === "CUST-1009" && (
                    <>
                      <p>Order: ORD-020 · SUPARTZ FX 2.5mL · $1,300 · REP-03</p>
                      <p>Savings lost: $65/unit vs Vizient Tier3 $585</p>
                    </>
                  )}
                  {selectedClinic.linked_customer_id === "CUST-1026" && (
                    <>
                      <p>Orders: ORD-006 DUROLANE $1,700 | ORD-015 EXOGEN 4.0 $4,200 🔴 RECALLED</p>
                      <p>Patient Cases: CASE-5011 · CASE-5014 (MDR gaps)</p>
                      <p>Cert Status: MISSING (CERT-011)</p>
                    </>
                  )}
                  {selectedClinic.linked_customer_id === "CUST-1012" && (
                    <>
                      <p>Record 1: Carolina Logistics · Orthopedic Practice · IDN-002 Vizient</p>
                      <p>Record 2: Pine MedSupply · Spine Center · IDN-003 HealthTrust</p>
                      <p>Order: ORD-023 · DUROLANE $850 — GPO ambiguous</p>
                    </>
                  )}
                  {hcpNodes.filter((hcp) => hcp.parent_id === selectedClinic.parent_id).length > 0 && (
                    <p>
                      Linked HCPs:{" "}
                      {hcpNodes
                        .filter((hcp) => hcp.parent_id === selectedClinic.parent_id)
                        .map((hcp) => hcp.node_name)
                        .join(", ")}
                    </p>
                  )}
                </div>
                {selectedClinicAction && <ActionPanel {...selectedClinicAction} />}
              </>
            )}

            {!selectedClinic && selectedIdn !== "IDN-003" && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Click a clinic node to open detail panel.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "orphans" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Total orphan attributed revenue: {formatUsd0(orphanAttributedTotal)}
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
              Sum of <span className="font-mono">sales_orders.total_amount</span> for each orphan&apos;s resolved customer id (same mapping as the table column). Conflict and pending rows are listed below; their revenue is not included in this orphan-only total.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold mb-3">Orphan nodes ({orphanNodes.length}) — same count as confidence driver</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Rows from <span className="font-mono">customer_hierarchy</span> where <span className="font-mono">node_type = ORPHAN</span>. The Issues tab total ({issuesTabCount}) adds conflict + pending nodes in separate sections.
            </p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left py-2">Node ID</th>
                  <th className="text-left py-2">Customer</th>
                  <th className="text-left py-2">Name</th>
                  <th className="text-right py-2">Attributed revenue</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {orphanNodes.map((n) => {
                  const cid = orphanCustomerKey(n) ?? "";
                  const rev = n.attributed_revenue ?? 0;
                  return (
                    <tr key={n.node_id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-2 font-mono text-xs">{n.node_id}</td>
                      <td className="py-2">{cid || "—"}</td>
                      <td className="py-2">{n.node_name}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">{formatUsd0(rev)}</td>
                      <td className="py-2">{n.hierarchy_status}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => navigate(cid ? `/alerts` : "/hierarchy")}
                          className="text-indigo-600 dark:text-indigo-400 text-xs"
                        >
                          {cid ? "Triage →" : "Open tree →"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-600 font-semibold text-slate-900 dark:text-slate-100">
                  <td colSpan={3} className="py-2 text-right text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Orphan rows total
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatUsd0(orphanAttributedTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {conflictNodes.length > 0 && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-800 p-4">
              <h3 className="font-semibold mb-3 text-rose-800 dark:text-rose-200">Hierarchy conflicts ({conflictNodes.length})</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left py-2">Node ID</th>
                    <th className="text-left py-2">Customer</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conflictNodes.map((n) => (
                    <tr key={n.node_id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-2 font-mono text-xs">{n.node_id}</td>
                      <td className="py-2">{n.linked_customer_id ?? "—"}</td>
                      <td className="py-2">{n.node_name}</td>
                      <td className="py-2">{n.hierarchy_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold mb-3">Duplicate Records — CUST-1012</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left py-2">Field</th>
                  <th className="text-left py-2">Record 1 (Carolina Logistics)</th>
                  <th className="text-left py-2">Record 2 (Pine MedSupply)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Name", "Carolina Logistics", "Pine MedSupply"],
                  ["Segment", "Orthopedic Practice", "Spine Center"],
                  ["City", "Raleigh", "Charlotte"],
                  ["Parent", "IDN-002 (Vizient Tier2)", "IDN-003 (HealthTrust Tier1)"],
                  ["GPO", "Vizient", "HealthTrust — CONFLICT"],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="py-2">{row[0]}</td>
                    <td className="py-2">{row[1]}</td>
                    <td className="py-2">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ActionPanel
              severity="high"
              primaryPersona="MDM Lead"
              ownerName="Marcus Johnson"
              actions={[
                { step: 1, description: "Run NPI/tax ID crosswalk to confirm true identity of CUST-1012" },
                { step: 2, description: "Assign single correct parent HCO and IDN, sunset the duplicate record" },
                { step: 3, description: "Update GPO eligibility and pricing tier once parent is confirmed" },
              ]}
              secondaryPersonaNote="Also involves: Pricing Analyst (GPO tier ambiguous — ORD-023 pricing may need correction)"
              ctaButtons={[
                { label: "View GPO Contracts", navigateTo: "/revenue?tab=gpo", variant: "primary" },
                { label: "Open Duplicate Workbench", navigateTo: "/duplicate-resolution-workbench", variant: "secondary" },
              ]}
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold mb-3">Pending hierarchy mapping ({pendingMappingNodes.length})</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Same definition as the confidence driver: <span className="font-mono">hierarchy_status</span> contains PENDING (stewardship / remap queue — not onboarding workflow).
            </p>
            {pendingMappingNodes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No pending mapping rows.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="text-left py-2">Node ID</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingMappingNodes.map((n) => (
                    <tr key={n.node_id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-2 font-mono text-xs">{n.node_id}</td>
                      <td className="py-2">{n.node_name}</td>
                      <td className="py-2">{n.node_type}</td>
                      <td className="py-2 text-xs text-slate-600 dark:text-slate-300">{n.iqvia_delta_detail ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold mb-3">Stalled onboarding (separate from hierarchy pending)</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              {ONBOARDING_STALL_IDS.length} customer applications in the onboarding queue without IDN assignment — linked to revenue protection SLAs, not the single pending-mapping node above.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ONBOARDING_STALL_IDS.map((row) => (
                <span key={row} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {row}
                </span>
              ))}
            </div>
            <button type="button" onClick={() => navigate("/revenue?tab=market-access")} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg">
              View onboarding / pipeline context
            </button>
          </div>
        </div>
      )}

      {activeTab === "iqvia" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">IQVIA External Roster Synchronization</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {rosterDeltas.length} card{rosterDeltas.length === 1 ? "" : "s"} below — same filter as the IQVIA line in Hierarchy Confidence (
              <span className="font-mono">/api/commercial/roster-deltas</span>, driver count {iqviaDriverCount} from{" "}
              <span className="font-mono">/api/commercial/hierarchy</span>
              {rosterDeltas.length === iqviaDriverCount ? ")." : ") — counts should match; refresh the API if they differ (stale cache was fixed server-side)."}
            </p>
            <span className="inline-block mt-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded px-2 py-1">
              🔄 Simulated IQVIA Integration — Application Environment <InfoTooltip content={TOOLTIP_HIER_IQVIA} />
            </span>
          </div>

          {rosterDeltas.map((delta) => {
            const acknowledged = acknowledgedDeltas.has(delta.delta_id);
            const severity = delta.risk_tier.toLowerCase() === "high" ? "high" : "medium";
            const lines: [string, string, string][] = [
              ["Affiliation", delta.internal_affiliation, delta.external_affiliation],
              ["Delta Type", delta.delta_type, delta.delta_detail ?? "No detail available"],
              ["NPI", delta.npi, delta.npi],
            ];
            return (
              <div key={delta.delta_id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">📡 IQVIA ROSTER DELTA DETECTED</p>
                <p className="text-sm mt-1">{delta.doctor} · NPI: {delta.npi}</p>
                <table className="w-full text-sm mt-3">
                  <thead className="text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="text-left py-2">Field</th>
                      <th className="text-left py-2">BV Internal</th>
                      <th className="text-left py-2">IQVIA External</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line[0]} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-2">{line[0]}</td>
                        <td className="py-2">{line[1]}</td>
                        <td className="py-2">{line[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  <p className="font-semibold mb-1">Business Impact:</p>
                  <p>• {delta.recommended_action}</p>
                  <p>• Delta Type: {delta.delta_type}</p>
                </div>

                <ActionPanel
                  severity={severity}
                  primaryPersona="MDM Lead"
                  ownerName="Marcus Johnson"
                  actions={[
                    { step: 1, description: "Validate IQVIA delta against current internal hierarchy mapping" },
                    { step: 2, description: "Update parent affiliation and downstream pricing eligibility if delta is confirmed" },
                    { step: 3, description: "Route territory/commission review when affiliation changes impact ownership" },
                  ]}
                  secondaryPersonaNote="Also involves: Revenue Assurance and Sales Leadership for downstream policy impact."
                  ctaButtons={[
                    { label: "Open Duplicate Workbench", navigateTo: "/duplicate-resolution-workbench", variant: "primary" },
                    { label: "View Alerts", navigateTo: "/alerts", variant: "secondary" },
                  ]}
                />

                <button
                  type="button"
                  disabled={acknowledged}
                  onClick={async () => {
                    const result = await api.decideRosterDelta({
                      delta_id: delta.delta_id,
                      decision: "acknowledged",
                      actor_role: currentRole.id,
                      actor_name: currentRole.personaName,
                      reason: "Reviewed and queued for hierarchy reconciliation",
                    });
                    if (!result.ok) return;
                    setAcknowledgedDeltas((prev) => new Set(prev).add(delta.delta_id));
                    setToast("IQVIA delta acknowledged — assigned to MDM Lead for action");
                  }}
                  className={`mt-3 px-3 py-1.5 text-sm rounded-lg ${
                    acknowledged
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {acknowledged ? "✓ Acknowledged" : "✓ Acknowledge Delta"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm ${
        active
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
