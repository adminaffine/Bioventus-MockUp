import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type GovernanceAuditReport, type TrustScores, type GovernanceSteward, type GovernancePolicy, type GovernanceIssue, type IntegrityScanResult } from "../services/api";
import { cn } from "../lib/utils";
import { Scale, AlertTriangle, CheckCircle, MinusCircle, ClipboardList, Users, FileCheck, Award, History, ChevronRight } from "lucide-react";
import { scoreTextClass } from "../lib/datasetHelpers";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_GOV_POLICY_VIOLATED, TOOLTIP_GOV_TRUST } from "../lib/tooltipContent";
import DetailModal from "../components/DetailModal";

type TabId = "integrity" | "policies" | "stewards" | "trust" | "audit";

export default function DataGovernance() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("integrity");
  const [audit, setAudit] = useState<GovernanceAuditReport | null>(null);
  const [trustScores, setTrustScores] = useState<TrustScores | null>(null);
  const [stewards, setStewards] = useState<GovernanceSteward[]>([]);
  const [policies, setPolicies] = useState<GovernancePolicy[]>([]);
  const [issues, setIssues] = useState<GovernanceIssue[]>([]);
  const [integrityScan, setIntegrityScan] = useState<IntegrityScanResult | null>(null);
  const [auditTrail, setAuditTrail] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getGovernanceAudit().then(setAudit).catch(() => setAudit(null)),
      api.getGovernanceTrustScores().then(setTrustScores).catch(() => setTrustScores(null)),
      api.getGovernanceStewards().then((r) => setStewards(r.stewards || [])).catch(() => setStewards([])),
      api.getGovernancePolicies().then((r) => setPolicies(r.policies || [])).catch(() => setPolicies([])),
      api.getGovernanceIssues().then((r) => setIssues(r.issues || [])).catch(() => setIssues([])),
      api.getIntegritySummary().then(setIntegrityScan).catch(() => setIntegrityScan(null)),
      api.getGovernanceAuditTrail(50).then((r) => setAuditTrail(r.events || [])).catch(() => setAuditTrail([])),
    ]).finally(() => setLoading(false));
  }, []);

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "integrity", label: "Integrity Monitor", icon: AlertTriangle },
    { id: "policies", label: "Policy Registry", icon: FileCheck },
    { id: "stewards", label: "Stewardship Board", icon: Users },
    { id: "trust", label: "Trust Scores", icon: Award },
    { id: "audit", label: "Audit Trail", icon: History },
  ];

  const totalViolations = integrityScan?.total_violations ?? 0;
  const hasUncontrollableState = totalViolations > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Scale className="w-8 h-8 text-primary dark:text-primary-light" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Data Integrity & Governance Command Center</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">System self-audit, integrity engine, policies, stewards, and trust scores</p>
        </div>
      </div>

      {/* System Self-Audit panel */}
      {audit && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> System Self-Audit (Gap Report)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Data Integrity</h3>
              <ul className="space-y-1 text-sm max-h-48 overflow-y-auto">
                {(audit.data_integrity || []).map((row, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {row.status === "[OK]" && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                    {row.status === "[!!]" && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                    {row.status === "[--]" && <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className="text-slate-700 dark:text-slate-300 truncate">{row.item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Governance</h3>
              <ul className="space-y-1 text-sm max-h-48 overflow-y-auto">
                {(audit.governance || []).map((row, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {row.status === "[OK]" && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                    {row.status === "[!!]" && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                    {row.status === "[--]" && <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className="text-slate-700 dark:text-slate-300 truncate">{row.item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              activeTab === id
                ? "bg-primary text-white dark:bg-primary-light"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Integrity Monitor */}
      {activeTab === "integrity" && (
        <div className="space-y-6">
          {hasUncontrollableState && (
            <div className="rounded-xl border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">Integrity violations detected</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {totalViolations} total violations across referential, entity, domain, temporal, and consistency checks. Review categories below and assign remediation.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "referential", label: "Referential", count: integrityScan?.summary?.referential_violations ?? 0, severity: "CRITICAL", data: integrityScan?.referential },
              { key: "entity", label: "Entity", count: integrityScan?.summary?.entity_duplicates ?? 0, severity: "HIGH", data: integrityScan?.entity },
              { key: "domain", label: "Domain", count: integrityScan?.summary?.domain_violations ?? 0, severity: "MEDIUM", data: integrityScan?.domain },
              { key: "temporal", label: "Temporal", count: integrityScan?.summary?.temporal_violations ?? 0, severity: "HIGH", data: integrityScan?.temporal },
              { key: "consistency", label: "Consistency", count: integrityScan?.summary?.consistency_conflicts ?? 0, severity: "HIGH", data: integrityScan?.consistency },
              { key: "schema", label: "Schema", count: 0, severity: "MEDIUM", data: null },
            ].map(({ key, label, count, severity, data: _data }) => (
              <div
                key={key}
                className={cn(
                  "rounded-xl border p-4 cursor-pointer transition-colors",
                  count > 0 ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
                )}
                onClick={() => setExpandedCategory(key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{label}</span>
                  </div>
                  <span className={cn("font-mono text-lg", count > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>{count}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Severity: {severity}</p>
              </div>
            ))}
          </div>

          {issues.length > 0 && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Governance issues (from integrity scan)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-2">ID</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-left py-2">Rule</th>
                      <th className="text-left py-2">Dataset</th>
                      <th className="text-left py-2">Severity</th>
                      <th className="text-left py-2">Violations</th>
                      <th className="text-left py-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.slice(0, 15).map((i) => (
                      <tr key={i.issue_id} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="py-2 font-mono text-xs">{i.issue_id}</td>
                        <td>{i.category}</td>
                        <td>{i.rule_name}</td>
                        <td>{i.dataset}</td>
                        <td><span className={cn(i.severity === "CRITICAL" && "text-red-600 dark:text-red-400", i.severity === "HIGH" && "text-amber-600 dark:text-amber-400")}>{i.severity}</span></td>
                        <td>{i.violations}</td>
                        <td>{i.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Policy Registry */}
      {activeTab === "policies" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700/50">
              <tr>
                <th className="text-left p-3">Policy ID</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Applies to</th>
                <th className="text-left p-3">Severity</th>
                <th className="text-left p-3">Violations today</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(policies || []).map((p) => (
                <tr key={p.policy_id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-3 font-mono">{p.policy_id}</td>
                  <td className="p-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md truncate">{p.description}</div>
                  </td>
                  <td className="p-3">{p.applies_to?.join(", ")}</td>
                  <td className="p-3">{p.severity_on_violation}</td>
                  <td className="p-3">{p.violations_today > 0 ? <span className="text-amber-600 dark:text-amber-400 font-medium">{p.violations_today}</span> : p.violations_today}</td>
                  <td className="p-3">{p.status}{p.status === "VIOLATED" ? <InfoTooltip content={TOOLTIP_GOV_POLICY_VIOLATED} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stewardship Board */}
      {activeTab === "stewards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(stewards || []).map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <div className="font-semibold text-slate-800 dark:text-slate-200">{s.name}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">{s.role}</div>
              <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Domain: {s.domain}</div>
              <div className="mt-3 flex gap-4 text-sm">
                <span>Open issues: <strong>{s.open_issues}</strong></span>
                <span>SLA breaches: <strong className={s.sla_breaches > 0 ? "text-red-600 dark:text-red-400" : ""}>{s.sla_breaches}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trust Scores */}
      {activeTab === "trust" && trustScores && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <ScoreCard label="Customer Master" value={trustScores.customer_master} onView={() => navigate("/profiler?dataset=customer_master")} />
            <ScoreCard label="Sales Orders" value={trustScores.sales_orders} onView={() => navigate("/profiler?dataset=sales_orders")} />
            <ScoreCard label="Patient Support" value={trustScores.patient_support} onView={() => navigate("/profiler?dataset=patient_support")} />
            <ScoreCard label="Product Catalog" value={trustScores.product_catalog} onView={() => navigate("/profiler?dataset=product_catalog")} />
            <ScoreCard label="Enterprise" value={trustScores.enterprise_score} accent />
          </div>
          {trustScores.by_dimension && Object.keys(trustScores.by_dimension).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">By dimension</h3>
              <div className="flex flex-wrap gap-4">
                {Object.entries(trustScores.by_dimension).map(([dim, score]) => (
                  <div key={dim} className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700">
                    <span className="capitalize">{dim}</span>: <strong>{score.toFixed(1)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Trail */}
      {activeTab === "audit" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Audit trail</h3>
          {auditTrail.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No governance events recorded yet. Events will appear when issues are updated or remediations are applied.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {auditTrail.map((e: unknown, i: number) => (
                <li key={i} className="text-slate-600 dark:text-slate-400">{JSON.stringify(e)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <DetailModal
        open={Boolean(expandedCategory)}
        onClose={() => setExpandedCategory(null)}
        title={`Integrity Category Detail${expandedCategory ? ` — ${expandedCategory}` : ""}`}
      >
        {(() => {
          const entry = [
            { key: "referential", data: integrityScan?.referential },
            { key: "entity", data: integrityScan?.entity },
            { key: "domain", data: integrityScan?.domain },
            { key: "temporal", data: integrityScan?.temporal },
            { key: "consistency", data: integrityScan?.consistency },
            { key: "schema", data: null },
          ].find((x) => x.key === expandedCategory);
          const data = entry?.data;
          if (!data) return <p className="text-sm text-slate-500">No detail records available.</p>;
          if (Array.isArray(data)) {
            return (
              <div className="text-sm space-y-2 max-h-[60vh] overflow-y-auto">
                {data.slice(0, 25).map((r: Record<string, unknown>, i: number) => (
                  <div key={i}>
                    {r.rule_name != null ? <span className="font-medium">{String(r.rule_name)}</span> : null}
                    {r.violations != null ? <span className="ml-2 text-amber-600">({Number(r.violations)} violations)</span> : null}
                    {Array.isArray(r.sample_ids) && r.sample_ids.length > 0 ? (
                      <p className="text-xs text-slate-500 truncate">Sample: {(r.sample_ids as string[]).slice(0, 5).join(", ")}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          }
          if (typeof data === "object" && data !== null && "total_conflicts" in data) {
            return <p className="text-sm">Total conflicts: {(data as { total_conflicts?: number }).total_conflicts ?? 0}</p>;
          }
          return <pre className="text-xs overflow-x-auto">{JSON.stringify(data, null, 2).slice(0, 1200)}</pre>;
        })()}
      </DetailModal>
    </div>
  );
}

function ScoreCard({ label, value, accent, onView }: { label: string; value: number; accent?: boolean; onView?: () => void }) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      accent ? "border-primary dark:border-primary-light bg-primary/10 dark:bg-primary/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
    )}>
      <span className="float-right"><InfoTooltip content={TOOLTIP_GOV_TRUST} /></span>
      <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
      <div className={cn(
        "text-2xl font-bold mt-1",
        scoreTextClass(value),
        accent && "text-primary dark:text-primary-light"
      )}>
        {value.toFixed(1)}
      </div>
      <div className="text-xs text-slate-500 mt-1">/ 100</div>
      {onView && (
        <button type="button" onClick={onView} className="mt-2 text-xs text-indigo-600 dark:text-indigo-300 underline underline-offset-2">
          View Issues in Profiler →
        </button>
      )}
    </div>
  );
}
