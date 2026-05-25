import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "../lib/utils";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_RX_DEA, TOOLTIP_RX_DUPLICATE, TOOLTIP_RX_NPI_SCORE, TOOLTIP_RX_SPECIALTY } from "../lib/tooltipContent";

type RxSummary = Awaited<ReturnType<typeof api.getRxSummary>>;
type TabId = "overview" | "doctors" | "prescriptions" | "specialty" | "duplicates";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "doctors", label: "Doctor Quality" },
  { id: "prescriptions", label: "Prescription Integrity" },
  { id: "specialty", label: "Specialty Mismatches" },
  { id: "duplicates", label: "Duplicate Doctors" },
];

export default function RxIntegrity() {
  const isDark = document.documentElement.classList.contains("dark");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [summary, setSummary] = useState<RxSummary | null>(null);
  const [duplicates, setDuplicates] = useState<{ clusters: unknown[] } | null>(null);
  const [mismatches, setMismatches] = useState<{ specialty_mismatches: unknown[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [doctorsData, setDoctorsData] = useState<{ doctors: unknown[]; total: number; page: number; size: number } | null>(null);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsPage, setDoctorsPage] = useState(1);
  const doctorsPageSize = 10;

  const [prescriptionsData, setPrescriptionsData] = useState<{ prescriptions: unknown[]; total: number; page: number; size: number } | null>(null);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [prescriptionsPage, setPrescriptionsPage] = useState(1);
  const prescriptionsPageSize = 10;

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getRxSummary()
      .then(setSummary)
      .catch((e) => setError(e?.message || "Failed to load RxIntegrity"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "duplicates") {
      api.getRxDuplicateDoctors().then(setDuplicates).catch(() => setDuplicates({ clusters: [] }));
    }
    if (activeTab === "specialty") {
      api.getRxSpecialtyMismatches().then(setMismatches).catch(() => setMismatches({ specialty_mismatches: [] }));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "doctors") {
      setDoctorsLoading(true);
      api
        .getRxDoctors({ page: doctorsPage, size: doctorsPageSize })
        .then(setDoctorsData)
        .catch(() => setDoctorsData({ doctors: [], total: 0, page: 1, size: doctorsPageSize }))
        .finally(() => setDoctorsLoading(false));
    }
  }, [activeTab, doctorsPage, doctorsPageSize]);

  useEffect(() => {
    if (activeTab === "prescriptions") {
      setPrescriptionsLoading(true);
      api
        .getRxPrescriptions({ page: prescriptionsPage, size: prescriptionsPageSize })
        .then(setPrescriptionsData)
        .catch(() => setPrescriptionsData({ prescriptions: [], total: 0, page: 1, size: prescriptionsPageSize }))
        .finally(() => setPrescriptionsLoading(false));
    }
  }, [activeTab, prescriptionsPage, prescriptionsPageSize]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400">
        {error || "Failed to load RxIntegrity summary."}
      </div>
    );
  }

  const trustColor = summary.rx_trust_level === "TRUSTED" ? "text-emerald-600" : summary.rx_trust_level === "AT_RISK" ? "text-amber-600" : "text-red-600";
  const bySpecialtyData = summary.by_specialty
    ? Object.entries(summary.by_specialty).map(([name, counts]) => ({
        name,
        count: Object.values(counts).reduce((a, b) => a + b, 0),
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div
        className={cn(
          "rounded-xl p-6 text-white bg-gradient-to-br from-[#00897B] to-[#00695C]",
          "dark:from-[#00897B] dark:to-[#004D40]"
        )}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span aria-hidden>💊</span> LUMINOS RxIntegrity
        </h1>
        <p className="text-white/90 mt-1">When Data Errors Become Patient Safety Events</p>
        <div className="flex flex-wrap gap-4 mt-4">
          <StatCard value={summary.critical_violations} label="Total Violations" />
          <StatCard value={summary.specialty_mismatches} label="Specialty Mismatch" tooltip={TOOLTIP_RX_SPECIALTY} />
          <StatCard value={summary.dea_violations} label="DEA Violations" tooltip={TOOLTIP_RX_DEA} />
          <StatCard value={summary.license_violations} label="License Issues" />
          <StatCard value={summary.ghost_doctors} label="Ghost Doctors" />
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-white/90">RxIntegrity Trust Score:</span>
          <div className="flex-1 max-w-xs h-4 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${Math.min(100, summary.rx_trust_score)}%` }}
            />
          </div>
          <span className={cn("font-semibold", trustColor)}>
            {summary.rx_trust_score}/100 {summary.rx_trust_level} <InfoTooltip content={TOOLTIP_RX_NPI_SCORE} />
          </span>
        </div>
        {summary.misrouted_prescriptions > 0 && (
          <div className="mt-3 px-3 py-2 bg-red-500/30 rounded border border-red-400/50 animate-pulse">
            ⚠️ {summary.misrouted_prescriptions} prescriptions were likely routed to the WRONG doctor due to duplicate name conflicts — PATIENT SAFETY RISK
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "px-4 py-2 rounded-t-lg font-medium transition-colors",
              activeTab === id
                ? "bg-[#00897B] text-white dark:bg-[#00897B]"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ViolationCard title="Specialty Mismatches" count={summary.specialty_mismatches} severity="critical" tooltip={TOOLTIP_RX_SPECIALTY} />
            <ViolationCard title="DEA Violations" count={summary.dea_violations} severity="critical" tooltip={TOOLTIP_RX_DEA} />
            <ViolationCard title="License Issues" count={summary.license_violations} severity="high" />
            <ViolationCard title="Duplicate Doctors" count={summary.duplicate_doctor_clusters} severity="high" tooltip={TOOLTIP_RX_DUPLICATE} />
          </div>
          {bySpecialtyData.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold mb-4">RxIntegrity by Specialty</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bySpecialtyData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <XAxis type="number" tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fill: isDark ? "#94a3b8" : "#475569" }} />
                  <Tooltip contentStyle={{ backgroundColor: isDark ? "#1e293b" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#f1f5f9" : "#0f172a" }} />
                  <Bar dataKey="count" fill="#00897B" name="Violations" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold mb-2">🤖 AI Safety Narrative</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The {summary.misrouted_prescriptions} specialty mismatch prescriptions originating from duplicate doctor conflicts represent a systemic data governance failure — not individual doctor error. When name-based lookup selects the wrong record, a Cardiologist can appear to prescribe opioids for knee surgery. In a real system, this triggers DEA scrutiny, license review, and patient safety alerts — all caused by a data entry duplicate that was never detected.
            </p>
          </div>
        </div>
      )}

      {activeTab === "doctors" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">Doctor Data Quality</h3>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {doctorsData ? `${doctorsData.total} total · Page ${doctorsData.page}` : ""}
            </span>
          </div>
          {doctorsLoading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading doctors…</div>
          ) : doctorsData && doctorsData.doctors.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="text-left p-2">Doctor</th>
                      <th className="text-left p-2">Specialty</th>
                      <th className="text-left p-2">License</th>
                      <th className="text-left p-2">NPI</th>
                      <th className="text-left p-2">DEA</th>
                      <th className="text-right p-2">Rx Count</th>
                      <th className="text-right p-2">Violations</th>
                      <th className="text-left p-2">Linked Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(doctorsData.doctors as { full_name?: string; doctor_id?: string; specialty?: string; license_status?: string; npi_number?: string; dea_number?: string; prescription_count?: number; violation_count?: number }[]).map((d, i) => (
                      <tr key={d.doctor_id || i} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 font-medium">{d.full_name || `${d.doctor_id}`}</td>
                        <td className="p-2">{d.specialty || "—"}</td>
                        <td className="p-2">
                          <span className={d.license_status === "ACTIVE" ? "text-emerald-600 dark:text-emerald-400" : d.license_status === "EXPIRED" || d.license_status === "SUSPENDED" ? "text-red-600 dark:text-red-400" : ""}>
                            {d.license_status || "—"}
                          </span>
                        </td>
                        <td className="p-2">{d.npi_number ? (String(d.npi_number).length === 10 ? "✓" : "Invalid") : "—"}</td>
                        <td className="p-2">{d.dea_number ? "✓" : "—"}</td>
                        <td className="p-2 text-right">{d.prescription_count ?? 0}</td>
                        <td className="p-2 text-right">
                          {(d.violation_count ?? 0) > 0 ? <span className="text-amber-600 dark:text-amber-400 font-medium">{d.violation_count}</span> : "0"}
                        </td>
                        <td className="p-2">
                          {d.doctor_id === "DOC-001" && (
                            <button
                              type="button"
                              onClick={() => navigate("/profiler?dataset=patient_support")}
                              className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                            >
                              3 Patient Cases
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <button
                  type="button"
                  disabled={doctorsData.page <= 1}
                  onClick={() => setDoctorsPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Page {doctorsData.page} of {Math.max(1, Math.ceil(doctorsData.total / doctorsData.size))}
                </span>
                <button
                  type="button"
                  disabled={doctorsData.page >= Math.ceil(doctorsData.total / doctorsData.size)}
                  onClick={() => setDoctorsPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">No doctors to display.</div>
          )}
        </div>
      )}

      {activeTab === "prescriptions" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Prescription Integrity</h3>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {prescriptionsData ? `${prescriptionsData.total} total · Page ${prescriptionsData.page}` : ""}
            </span>
          </div>
          {prescriptionsLoading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading prescriptions…</div>
          ) : prescriptionsData && prescriptionsData.prescriptions.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="text-left p-2">Rx ID</th>
                      <th className="text-left p-2">Doctor</th>
                      <th className="text-left p-2">Specialty</th>
                      <th className="text-left p-2">Drug</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-left p-2">Schedule</th>
                      <th className="text-right p-2">Patient Age</th>
                      <th className="text-center p-2">Flagged</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(prescriptionsData.prescriptions as { prescription_id?: string; doctor_name_at_time?: string; doctor_specialty_at_time?: string; drug_name?: string; drug_category?: string; drug_schedule?: string; patient_age?: string; prescription_status?: string; has_violation?: boolean }[]).map((p, i) => (
                      <tr key={p.prescription_id || i} className={cn("border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50", p.has_violation && "bg-red-50/30 dark:bg-red-900/10")}>
                        <td className="p-2 font-medium">{p.prescription_id}</td>
                        <td className="p-2">{p.doctor_name_at_time || "—"}</td>
                        <td className="p-2">{p.doctor_specialty_at_time || "—"}</td>
                        <td className="p-2">{p.drug_name || "—"}</td>
                        <td className="p-2">{p.drug_category || "—"}</td>
                        <td className="p-2">{p.drug_schedule || "—"}</td>
                        <td className="p-2 text-right">{p.patient_age ?? "—"}</td>
                        <td className="p-2 text-center">
                          {p.has_violation ? <span className="text-red-600 dark:text-red-400 font-medium">Yes</span> : "No"}
                        </td>
                        <td className="p-2">{p.prescription_status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <button
                  type="button"
                  disabled={prescriptionsData.page <= 1}
                  onClick={() => setPrescriptionsPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Page {prescriptionsData.page} of {Math.max(1, Math.ceil(prescriptionsData.total / prescriptionsData.size))}
                </span>
                <button
                  type="button"
                  disabled={prescriptionsData.page >= Math.ceil(prescriptionsData.total / prescriptionsData.size)}
                  onClick={() => setPrescriptionsPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">No prescriptions to display.</div>
          )}
        </div>
      )}

      {activeTab === "specialty" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-900/20 p-4 text-sm text-sky-800 dark:text-sky-300">
            Prescriptions flagged where physician specialty does not align with the drug category or schedule — a key risk indicator for BV&apos;s orthobiologic prescription channel.
          </div>
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-4">
            <h3 className="font-semibold text-red-800 dark:text-red-200">🔴 Specialty Mismatch Alert</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {summary.specialty_mismatches} prescriptions have been linked to doctors whose specialty does NOT align with the prescribed medication. This may indicate wrong doctor linked due to duplicate names, unauthorized out-of-scope prescribing, or system data entry errors.
            </p>
          </div>
          {mismatches && Array.isArray(mismatches.specialty_mismatches) && mismatches.specialty_mismatches.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span className="font-medium text-sm">Mismatch records</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="text-left p-2">Rx ID</th>
                    <th className="text-left p-2">Doctor</th>
                    <th className="text-left p-2">Specialty</th>
                    <th className="text-left p-2">Drug</th>
                    <th className="text-left p-2">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {(mismatches.specialty_mismatches as { prescription_id?: string; doctor_name?: string; specialty?: string; drug_name?: string; severity?: string }[])
                    .slice(0, 15)
                    .map((m, i) => (
                      <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="p-2">{m.prescription_id}</td>
                        <td className="p-2">{m.doctor_name}</td>
                        <td className="p-2">{m.specialty}</td>
                        <td className="p-2">{m.drug_name}</td>
                        <td className="p-2">{m.severity}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "duplicates" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Entity Resolution Alert — 3 records match &apos;Dr. James Whitfield&apos; across Orthopedics (DOC-001), Cardiology (DOC-009), and Orthopedics (DOC-015). NPI, license state, and DEA numbers differ across records. Action required: confirm identity and merge or separate records.</p>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            {summary.duplicate_doctor_clusters} Duplicate Name Clusters Detected
          </p>
          {duplicates?.clusters && (duplicates.clusters as { cluster_id?: string; cluster_name?: string; records?: unknown[]; misrouted_prescriptions?: number; specialty_conflict?: boolean }[]).map((cluster, i) => (
            <div
              key={cluster.cluster_id || i}
              className={cn(
                "rounded-xl border p-4",
                cluster.specialty_conflict ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" : "border-slate-200 dark:border-slate-700"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">DUPLICATE CLUSTER: &quot;{cluster.cluster_name}&quot;</h3>
                {cluster.specialty_conflict && <span className="text-red-600 dark:text-red-400 font-medium">🔴 CRITICAL</span>}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {(cluster.records as unknown[])?.length || 0} records share the same doctor name but have different specialties or licenses. {cluster.misrouted_prescriptions ?? 0} prescriptions were linked to the wrong record (misrouted). Cluster ID: {cluster.cluster_id}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {(cluster.records as { doctor_id?: string; specialty?: string; npi?: string; prescription_count?: number; is_golden_record?: boolean }[])?.map((rec, j) => (
                  <div key={j} className="rounded-lg bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 flex-wrap">
                      {rec.is_golden_record && <span className="text-amber-500" title="Recommended primary record">⭐</span>}
                      <span className="font-semibold text-base">
                        {cluster.cluster_name}
                        {rec.specialty ? ` — ${rec.specialty}` : ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" title="Internal system identifier for support and IT">
                      System ID: {rec.doctor_id}
                    </p>
                    <p className="text-sm mt-2">NPI: {rec.npi || "—"}</p>
                    <p className="text-sm">Prescription count: {rec.prescription_count ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, tooltip }: { value: number; label: string; tooltip?: Parameters<typeof InfoTooltip>[0]["content"] }) {
  return (
    <div className="relative bg-white/15 rounded-lg px-4 py-2 min-w-[100px]">
      {tooltip ? <span className="absolute right-1 top-1"><InfoTooltip content={tooltip} /></span> : null}
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-white/80 text-sm">{label}</div>
    </div>
  );
}

function ViolationCard({ title, count, severity, tooltip }: { title: string; count: number; severity: "critical" | "high"; tooltip?: Parameters<typeof InfoTooltip>[0]["content"] }) {
  return (
    <div
      className={cn(
        "relative rounded-xl border p-4",
        severity === "critical" ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10" : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10"
      )}
    >
      {tooltip ? <span className="absolute right-2 top-2"><InfoTooltip content={tooltip} /></span> : null}
      <div className={cn("text-2xl font-bold", severity === "critical" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300")}>
        {count}
      </div>
      <div className="text-sm font-medium mt-1">{title}</div>
      <a href="#specialty" className="text-sm text-primary dark:text-primary-light mt-2 inline-block">Investigate →</a>
    </div>
  );
}
