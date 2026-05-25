import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { cn } from "../lib/utils";
import { formatDatasetName, scoreBgClass } from "../lib/datasetHelpers";
import InfoTooltip from "../components/InfoTooltip";
import {
  TOOLTIP_COMP_FDA_MDR,
  TOOLTIP_COMP_HEATMAP_CELL,
  TOOLTIP_COMP_HIPAA,
  TOOLTIP_COMP_QMSR,
  TOOLTIP_COMP_SOX,
  TOOLTIP_COMP_THRESHOLDS,
} from "../lib/tooltipContent";

const REG_SLUGS: Record<string, string> = {
  "FDA 21 CFR Part 11": "fda-21-cfr",
  "FDA QMSR (21 CFR Part 820 / ISO 13485:2016)": "qmsr",
  "FDA MDR (Medical Device Reporting)": "fda-mdr",
  "HIPAA Privacy Rule": "hipaa",
  "SOX Section 302/404": "sox",
  "GDPR/Privacy": "gdpr",
  "PCI-DSS": "pci-dss",
};

export default function Compliance() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [heatmap, setHeatmap] = useState<Awaited<ReturnType<typeof api.getComplianceHeatmap>> | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getComplianceDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const requestedRegulation = searchParams.get("reg");
  const requestedDataset = searchParams.get("dataset");
  const [selectedRegulationSlug, setSelectedRegulationSlug] = useState<string | null>(requestedRegulation);

  useEffect(() => {
    api.getComplianceHeatmap().then(setHeatmap).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!heatmap || !requestedRegulation) return;
    const slug = requestedRegulation.trim().toLowerCase();
    if (!slug) return;
    setSelectedRegulationSlug(slug);
    setDetailLoading(true);
    api.getComplianceDetail(slug).then(setDetail).finally(() => setDetailLoading(false));
  }, [heatmap, requestedRegulation]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!heatmap) return <div>Failed to load compliance heatmap.</div>;

  const regulations = heatmap.regulations || [];
  const datasets = heatmap.datasets || [];
  const matrix = heatmap.matrix || {};

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-primary dark:text-primary-light">
        Regulatory Compliance
      </h1>
      {requestedDataset && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Focused dataset context: <span className="font-medium">{formatDatasetName(requestedDataset)}</span>
        </div>
      )}

      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex flex-wrap gap-4">
        <span className="font-semibold text-red-800 dark:text-red-200">Critical alerts:</span>
        <span>MDR non-submissions (adverse events without MDR) and HIPAA consent gaps require immediate action.</span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <h2 className="text-lg font-semibold p-6">Compliance Score % (Regulation × Dataset) <InfoTooltip content={TOOLTIP_COMP_HEATMAP_CELL} /></h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left p-4 font-medium">Regulation</th>
                {datasets.map((d) => (
                  <th key={d} className="text-right p-4 font-medium">
                    <button type="button" onClick={() => navigate(`/profiler?dataset=${d}`)} className="underline-offset-2 hover:underline">
                      {formatDatasetName(d)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regulations.map((reg) => (
                <tr
                  key={reg}
                  className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                  onClick={() => {
                    const slug = REG_SLUGS[reg] || reg.toLowerCase().replace(/\s+/g, "-");
                    setSelectedRegulationSlug(slug);
                    setDetailLoading(true);
                    api.getComplianceDetail(slug).then(setDetail).finally(() => setDetailLoading(false));
                  }}
                >
                  <td className="p-4 font-medium">
                    {reg}
                    {reg.includes("MDR") ? <InfoTooltip content={TOOLTIP_COMP_FDA_MDR} /> : null}
                    {reg.includes("QMSR") ? <InfoTooltip content={TOOLTIP_COMP_QMSR} /> : null}
                    {reg.includes("HIPAA") ? <InfoTooltip content={TOOLTIP_COMP_HIPAA} /> : null}
                    {reg.includes("SOX") ? <InfoTooltip content={TOOLTIP_COMP_SOX} /> : null}
                    {reg.includes("QMSR") && (
                      <span className="ml-2 text-xs bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                        NEW · Feb 2026
                      </span>
                    )}
                  </td>
                  {datasets.map((d) => {
                    const score = matrix[reg]?.[d] ?? 0;
                    return (
                      <td key={d} className="text-right p-4">
                        <span
                          className={cn(
                            "inline-block w-12 text-center rounded font-medium",
                            scoreBgClass(score)
                          )}
                        >
                          {score}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-slate-500">Legend thresholds <InfoTooltip content={TOOLTIP_COMP_THRESHOLDS} /></div>

      {(detailLoading || detail) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          {detailLoading ? (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin inline-block" />
              Loading compliance details...
            </div>
          ) : detail ? (
            <>
              <h2 className="text-lg font-semibold">{detail.regulation}</h2>
              <p className="text-slate-600 dark:text-slate-400 mt-2">{detail.description}</p>
              <h3 className="font-medium mt-6 mb-2">Gaps & Remediation</h3>
              <ul className="space-y-2">
                {(detail.gaps || []).slice(0, 10).map((g, i) => (
                  <li key={i} className="text-sm border-l-2 border-accent pl-3 py-1 flex items-center justify-between gap-2">
                    <span>
                      {g.remediation}
                      {g.case_id && ` (Case: ${g.case_id})`}
                      {g.order_id && ` (Order: ${g.order_id})`}
                      {g.product_id && ` (Product: ${g.product_id})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams();
                        params.set("source", "compliance");
                        if (selectedRegulationSlug) params.set("reg", selectedRegulationSlug);
                        if (requestedDataset) params.set("dataset", requestedDataset);
                        const record = g.case_id || g.order_id || g.product_id;
                        if (record) params.set("record", record);
                        navigate(`/capa?${params.toString()}`);
                      }}
                      className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 cursor-pointer"
                    >
                      + Open CAPA
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
