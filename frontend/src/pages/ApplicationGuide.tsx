import { useEffect, useState } from "react";
import { api } from "../services/api";

type Act = {
  id: number;
  title: string;
  time: string;
  screen: string;
  keyMessages: string[];
  clicks: string[];
  talking: string;
};

function buildActs(metrics: {
  overallScore: number;
  qmsrGaps: number;
  mdrGaps: number;
  currentScore: number;
  projectedScore: number;
  capaCount: number;
  overdueDays: number;
  postRecallOrders: number;
  timelineWeeks: number;
  commercialAtRisk: number;
  commercialGpoAnnualized: number;
  commercialAlerts: number;
}): Act[] {
  return [
    {
      id: 1,
      title: "THE PROBLEM",
      time: "3 minutes",
      screen: "Executive Dashboard (/)",
      keyMessages: [
        `BV overall DQ score is ${metrics.overallScore}% — monitor closely for a Class III device company`,
        `FDA QMSR became effective February 2, 2026 — ${metrics.qmsrGaps} open gaps detected`,
        "EXOGEN 4.0 traffic light is RED — click it to drill in",
      ],
      clicks: [
        "Point to the QMSR red alert banner — read it aloud",
        `Point to the KPI tiles: ${metrics.mdrGaps} adverse events without MDR submission`,
        "Click the red EXOGEN traffic light card → /profiler?dataset=patient_support",
      ],
      talking:
        "Every medical device company has data quality issues hiding in plain sight. What BV's CDO needs is a single command center that shows where the risks are, how severe they are, and who owns fixing them. Let's look at the most critical one — EXOGEN.",
    },
    {
      id: 2,
      title: "THE CRISIS",
      time: "4 minutes",
      screen: "Compliance (/compliance) → CAPA (/capa)",
      keyMessages: [
        `${metrics.mdrGaps} adverse event cases on EXOGEN 4.0 — product was recalled, MDR not filed`,
        "This is a 21 CFR Part 803 violation — FDA can issue a warning letter",
        `CAPA-001 is OVERDUE — ${metrics.overdueDays}+ days open, due date passed`,
      ],
      clicks: [
        "Show FDA MDR row red in heatmap for patient_support",
        "Open detail panel and click Open CAPA",
        "On CAPA-001 show root cause and actions, then Mark Resolved simulation",
      ],
      talking:
        "The platform doesn't just detect the gap — it creates an actionable CAPA with root cause, corrective action, preventive action, and owner. For VP Quality this replaces spreadsheet workflow.",
    },
    {
      id: 3,
      title: "THE DATA BEHIND THE CRISIS",
      time: "4 minutes",
      screen: "Profiler (/profiler?dataset=patient_support) → PII Shield",
      keyMessages: [
        "The MDR wasn't filed because the data was incomplete",
        `${metrics.mdrGaps} cases closed without resolution date — MDR field was never triggered`,
        "Those same cases contain unmasked PHI — HIPAA exposure on top of MDR gap",
      ],
      clicks: [
        "Show problematic columns in profiler completeness",
        "Point to critical issue rows",
        "Open PII Shield and show HIPAA consent alert",
      ],
      talking:
        "One data quality problem became two regulatory violations. Incomplete records blocked MDR trigger and also exposed PHI consent gaps.",
    },
    {
      id: 4,
      title: "THE CHAIN",
      time: "2 minutes",
      screen: "Integration & Lineage (/integration)",
      keyMessages: [
        "Problem spans Product Catalog → Sales Orders → Patient Support",
        `EXOGEN recalled → ${metrics.postRecallOrders} post-recall orders → ${metrics.mdrGaps} adverse events → 0 MDRs`,
        "Orphan records break audit trails for SOX and FDA",
      ],
      clicks: [
        "Show recalled product chain callout",
        "Point to match-rate bars under 80%",
        "Highlight lineage edges with orphan counts",
      ],
      talking:
        "Data quality is never one-system only. Recall status existed but did not propagate across systems, breaking the chain of control.",
    },
    {
      id: 5,
      title: "THE FIX",
      time: "2 minutes",
      screen: "Trend Simulation (/trend)",
      keyMessages: [
        `Resolving ${metrics.capaCount} CAPAs improves DQ score from ${metrics.currentScore}% to ${metrics.projectedScore}%`,
        `QMSR gaps close from ${metrics.qmsrGaps} to 0`,
        `${metrics.timelineWeeks}-week remediation roadmap is visible`,
      ],
      clicks: [
        "Show CAPA narrative card above chart",
        `Point to before/after score ${metrics.currentScore}% → ${metrics.projectedScore}%`,
        "Review week timeline through post-CAPA",
      ],
      talking:
        "This quantifies remediation value. Not just issue detection, but projected business impact and audit readiness improvement.",
    },
    {
      id: 6,
      title: "GOVERNANCE",
      time: "2 minutes",
      screen: "Data Governance (/governance)",
      keyMessages: [
        "Each dataset has named owner accountability",
        "QMSR adverse event policy is currently violated",
        "Trust scores show which systems CDO can rely on",
      ],
      clicks: [
        "Show stewards: Sarah Kim, Marcus Johnson, Linda Torres, Robert Patel",
        "Point to QMSR policy violation row",
        "Show trust score cards by dataset",
      ],
      talking:
        "When owner, policy, and score are in one place, data quality moves from IT issue to governed business process.",
    },
    {
      id: 7,
      title: "THE COMMERCIAL RISK",
      time: "3 minutes",
      screen: "Commercial Dashboard (/commercial)",
      keyMessages: [
        "NOTE: Additional personas in role switcher — CFO (/csuite), Credit & AR (/hierarchy), Market Access (/revenue?tab=market-access)",
        "Recalled product exposure is $16,800 and orphan orders add major unattributed risk",
        `Total at-risk revenue is $${metrics.commercialAtRisk.toLocaleString()} this period`,
        `GPO chargeback exposure annualized is $${metrics.commercialGpoAnnualized.toLocaleString()}`,
        `${metrics.commercialAlerts} alerts are active in the commercial queue`,
      ],
      clicks: [
        "Switch role to Admin — All Views in the header",
        "Open Commercial Dashboard in the sidebar",
        "Click Fracture Care (RECALLED) bar to open ORD-013 to ORD-016 popover",
        "Click COPQ orphan slice to show the 5 orphan orders and action panel",
        "Click IDN-003 row in Top Accounts and expand subsidiaries",
      ],
      talking:
        "The EXOGEN recall is not only compliance risk, it is immediate commercial exposure. Orphan records and pricing conflicts transform data quality debt into measurable revenue and margin risk.",
    },
    {
      id: 8,
      title: "THE HIDDEN RELATIONSHIPS",
      time: "3 minutes",
      screen: "Customer Hierarchy (/hierarchy)",
      keyMessages: [
        "Hierarchy confidence is 87% with orphan, conflict, and pending mapping drag",
        "Cape Institute is orphaned and overpaying due to missing GPO enrollment",
        "Capital Institute is a triple risk: recalled order, MDR gap, missing cert",
        "IQVIA delta shows Dr. Whitfield affiliation changed to another IDN",
      ],
      clicks: [
        "Switch role to Commercial Ops and open /hierarchy",
        "Click CUST-1009 and review orphan remediation action panel",
        "Click CUST-1026 and review critical VP Quality action panel",
        "Switch to IQVIA tab and acknowledge Dr. Whitfield delta",
      ],
      talking:
        "Hierarchy integrity is where commercial, quality, and MDM operations converge. One stale affiliation change can affect GPO tiering, territory ownership, and commission calculations.",
    },
    {
      id: 9,
      title: "THE REVENUE STORY",
      time: "3 minutes",
      screen: "Revenue & Risk (/revenue)",
      keyMessages: [
        "5 GPO conflicts represent $4,620 current exposure and multi-million annualized risk",
        "neXus overcharge is verified and credit action can begin immediately",
        "StimRouter conflicts require membership validation before financial correction",
        "COPQ slider translates data defects into annualized dollars at business volume",
        "Tax tab surfaces top-value jurisdiction mismatches first",
      ],
      clicks: [
        "Switch role to Pricing Analyst and open /revenue",
        "Expand GPC-005 then GPC-003 to compare clear-cut vs conditional resolution",
        "Open COPQ tab and move slider from 153 to 300",
        "Switch role to Tax & Compliance and review priority tax alert card",
        "Expand CERT-012 to show highest-risk customer narrative and actions",
      ],
      talking:
        "Revenue & Risk converts issue lists into decision queues. Teams can prioritize by value, execute prescribed action steps, and show how remediation changes annual financial outlook.",
    },
    {
      id: 10,
      title: "THE ACTION QUEUE",
      time: "2 minutes",
      screen: "Alert-to-Action (/alerts)",
      keyMessages: [
        `All ${metrics.commercialAlerts} alerts are sorted by dollar impact with named owner accountability`,
        "Each alert carries prescribed actions and deep links to source context",
        "Acknowledgements decrement bell count to demonstrate live operational workflow",
        "Critical recalled-product alerts route directly into CAPA action path",
      ],
      clicks: [
        "Open /alerts and apply Critical filter",
        "Expand ALT-013 and review regulation-tagged action steps",
        "Acknowledge ALT-013 and observe bell count decrement",
        "Route ALT-009 to owner and navigate ALT-006 back to Revenue tab",
        "Filter owner to Pricing Analyst and review focused queue",
      ],
      talking:
        "This is the operational handoff layer. Data quality and compliance findings become owner-routed, trackable actions instead of static dashboard observations.",
    },
    {
      id: 11,
      title: "CFO PERSONA",
      time: "2 minutes",
      screen: "C-Suite Dashboard (/csuite)",
      keyMessages: [
        "Switch role to CFO to open /csuite",
        "Margin at risk this period: $15,626 · annualized projection: $2.39M",
        "7 SLA breaches across 4 departments with $88,780 total financial impact",
        "7 onboarding applications stalled, blocking $555,000 pipeline",
      ],
      clicks: [
        "Switch role to CFO — auto navigates to /csuite",
        "Hover the (i) icon on margin tile to show formula tooltip",
        "Click CUST-9902 row, then SLA-004 row, then ONB-007 and DSO-002 rows to show persona ActionPanels",
      ],
      talking:
        "This view translates data quality failures into executive finance language. The same data defects seen in profiler and CAPA now appear as margin leakage and blocked pipeline.",
    },
    {
      id: 12,
      title: "MARKET ACCESS PERSONA",
      time: "2 minutes",
      screen: "Revenue & Risk Tab 4 (/revenue?tab=market-access)",
      keyMessages: [
        "Switch role to Market Access to open Tab 4 by default",
        "CHB-003 and CHB-004 expire in 12 days with $2,400 at risk and unverified membership",
        "Distributor off-contract volume totals $11,170 and includes ghost-rep/inactive anomalies",
        "2 Premier contracts require renewal action within 28 days",
      ],
      clicks: [
        "Switch role to Market Access and open the priority alert panel",
        "Expand CHB-003/CHB-002 and file one dispute to show simulated queue action",
        "Review ORD-033 in off-contract section and trigger renewal buttons for GPC-011/GPC-012",
      ],
      talking:
        "Market Access gets a daily queue sorted by financial risk and time to expiry. The workflow is action-first: verify membership, file disputes, and prevent contract leakage.",
    },
    {
      id: 13,
      title: "VP OPERATIONS COMMAND",
      time: "4 minutes",
      screen: "Operations Dashboard (/vp-dashboard)",
      keyMessages: [
        "Switch to VP / Director — Operations for cross-team issue oversight",
        "Baseline: 47 open issues · 9 SLA breach risks · 4 in priority queue · 71% team resolution rate",
        "Top Alerts shows 8 most urgent issues — VP-ISS-001 Northeast Medical is first (1 day to SLA breach)",
        "AI Recommendation Queue: 3 high-confidence fixes awaiting VP approval",
        "Approve → Closure → Return to Dashboard removes the issue for this demo session",
        "Reset demo data restores the full baseline for the next walk-through",
      ],
      clicks: [
        "Switch role to VP / Director — Operations",
        "Open Operations Dashboard — note Operations View banner with live KPIs",
        "Click blinking View Issue → on VP-ISS-001 (Northeast Medical / ORD-031)",
        "Approve AI recommendation → Closure → Return to Dashboard",
        "Click Reset demo data to restore 47 open issues and all 8 Top Alerts",
      ],
      talking:
        "The VP persona is the operational command layer across Tax, Pricing, Compliance, and Finance. The dashboard prioritizes by SLA urgency, surfaces AI recommendations for executive approval, and tracks team scorecard performance — without leaving a single operations view.",
    },
  ];
}

export default function ApplicationGuide() {
  const [openAct, setOpenAct] = useState<number>(1);
  const [metrics, setMetrics] = useState({
    overallScore: 0,
    qmsrGaps: 0,
    mdrGaps: 0,
    currentScore: 0,
    projectedScore: 0,
    capaCount: 0,
    overdueDays: 47,
    postRecallOrders: 0,
    timelineWeeks: 5,
    commercialAtRisk: 59110,
    commercialGpoAnnualized: 3880800,
    commercialAlerts: 18,
  });

  useEffect(() => {
    Promise.all([
      api.getDashboardSummary(),
      api.getTrendSimulation(),
      api.getCAPASummary(),
      api.getQuality("patient_support"),
      api.getCommercialSummary(),
      api.getAlerts(),
    ])
      .then(([dashboard, trend, capa, patientSupport, commercial, alerts]) => {
        const capa001 = capa.capas.find((c) => c.capa_id === "CAPA-001");
        const capa004 = capa.capas.find((c) => c.capa_id === "CAPA-004");
        setMetrics({
          overallScore: dashboard.overall_data_quality_score,
          qmsrGaps: dashboard.qmsr_alert?.gaps_detected ?? 0,
          mdrGaps: patientSupport.mdr_gap_count ?? 0,
          currentScore: trend.current_quality_score,
          projectedScore: trend.projected_quality_score,
          capaCount: capa.total_capas,
          overdueDays: capa001?.days_open ?? 47,
          postRecallOrders: capa004?.affected_records?.length ?? 0,
          timelineWeeks: trend.timeline?.length ?? 5,
          commercialAtRisk: commercial.total_at_risk_revenue,
          commercialGpoAnnualized: commercial.gpo_annualized,
          commercialAlerts: alerts.total_alerts,
        });
      })
      .catch(() => undefined);
  }, []);

  const acts = buildActs(metrics);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary dark:text-primary-light">BV Application Guide</h1>
          <p className="text-slate-600 dark:text-slate-400">15–20 Minute Walk-Through · CDO / CCO / VP Quality Audience</p>
        </div>
        <button type="button" onClick={() => window.print()} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm">
          Print Guide
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="lg:sticky lg:top-4 h-fit print:hidden">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <p className="text-sm font-semibold mb-2">Acts</p>
            <ul className="space-y-1 text-sm">
              {acts.map((a) => (
                <li key={a.id}>
                  <button type="button" className="hover:underline underline-offset-2" onClick={() => setOpenAct(a.id)}>
                    Act {a.id} · {a.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="lg:col-span-2 space-y-4">
          {acts.map((act) => {
            const open = openAct === act.id;
            return (
              <article key={act.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 print:break-after-page">
                <button type="button" className="w-full text-left flex items-center justify-between gap-2" onClick={() => setOpenAct(open ? 0 : act.id)}>
                  <div>
                    <p className="font-semibold">ACT {act.id} · {act.title}</p>
                    <p className="text-xs text-slate-500">{act.time} · <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">{act.screen}</span></p>
                  </div>
                  <span>{open ? "▲" : "▼"}</span>
                </button>
                <div className={`${open ? "block" : "hidden"} mt-4 space-y-4 print:block`}>
                  <div>
                    <p className="font-medium">KEY MESSAGES</p>
                    <ul className="list-disc pl-5 mt-1 text-emerald-700 dark:text-emerald-300">
                      {act.keyMessages.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">WHAT TO CLICK</p>
                    <ol className="list-decimal pl-5 mt-1 text-slate-700 dark:text-slate-300 marker:text-indigo-600 dark:marker:text-indigo-400">
                      {act.clicks.map((c) => <li key={c}>{c}</li>)}
                    </ol>
                  </div>
                  <blockquote className="bg-slate-50 dark:bg-slate-800 rounded p-3 italic text-slate-600 dark:text-slate-300">
                    {act.talking}
                  </blockquote>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
