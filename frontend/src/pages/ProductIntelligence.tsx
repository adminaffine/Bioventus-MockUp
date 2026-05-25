import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { formatDatasetName, scoreTextClass } from "../lib/datasetHelpers";
import InfoTooltip from "../components/InfoTooltip";
import { TOOLTIP_PROD_DQ_FLAGS, TOOLTIP_PROD_ORDERS_AT_RISK } from "../lib/tooltipContent";
import DetailModal from "../components/DetailModal";
import { useDateFormat } from "../context/DateFormatContext";

type Product = Awaited<ReturnType<typeof api.getProductList>>[number];

export default function ProductIntelligence() {
  const { formatDate } = useDateFormat();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [quality, setQuality] = useState<Awaited<ReturnType<typeof api.getQuality>> | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getProductList(), api.getQuality("product_catalog")])
      .then(([p, q]) => {
        setProducts(p);
        setQuality(q);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const missingClass = products.filter((p) => !p.device_class).length;
    const recalled = products.filter((p) => p.recall_status === "RECALLED").length;
    const missingFda = products.filter((p) => !p.fda_clearance_number).length;
    return { total: products.length, missingClass, recalled, missingFda };
  }, [products]);

  if (loading) return <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary dark:text-primary-light">BV Product Intelligence</h1>
        <p className="text-slate-600 dark:text-slate-400">Product catalog DQ status, FDA clearance coverage, and recall risk.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatPill text={`${stats.total} Products`} />
        <StatPill text={`${stats.missingClass} Missing Device Class`} />
        <StatPill text={`${stats.recalled} Recalled`} />
        <StatPill text={`${stats.missingFda} Missing FDA Clearance`} />
        <StatPill text={`DQ Score: ${quality?.overall_score ?? 0}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const critical = p.dq_flags.some((f) => f.includes("RECALLED") || f.includes("Missing Device Classification"));
          const warning = p.dq_flags.length > 0 && !critical;
          const classBadge = p.device_class === "III" ? "bg-rose-100 text-rose-700" : p.device_class === "II" ? "bg-amber-100 text-amber-700" : p.device_class === "I" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500";
          return (
            <div
              key={p.product_id}
              className={`rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${critical ? "border-l-4 border-l-rose-500 bg-rose-50/10 dark:bg-rose-900/10" : warning ? "border-l-4 border-l-amber-500" : ""}`}
              onClick={() => setSelectedProductId(p.product_id)}
            >
              <span className="float-right"><InfoTooltip content={TOOLTIP_PROD_DQ_FLAGS} /></span>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${classBadge}`}>{p.device_class ? `Class ${p.device_class}` : "Unclassified"}</span>
                {p.recall_status === "RECALLED" && <span className="bg-rose-500 text-white rounded px-2 py-0.5 text-xs font-bold">RECALLED</span>}
              </div>
              <h3 className="font-semibold mt-2">{p.product_name}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{p.product_category}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                FDA: {p.fda_clearance_number || "—"} · {p.fda_clearance_date ? formatDate(p.fda_clearance_date) : "—"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">HCPCS: {p.hcpcs_code || "—"}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {p.dq_flags.map((f) => <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">{f}</span>)}
              </div>
              {p.product_id === "PRD-008" && (
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700">3 orders at risk</span>
                  <InfoTooltip content={TOOLTIP_PROD_ORDERS_AT_RISK} />
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700">4 cases at risk</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <DetailModal
        open={Boolean(selectedProductId)}
        onClose={() => setSelectedProductId(null)}
        title={`Product Detail${selectedProductId ? ` — ${selectedProductId}` : ""}`}
      >
        {(() => {
          const p = products.find((x) => x.product_id === selectedProductId);
          if (!p) return <p className="text-sm text-slate-500">No detail available.</p>;
          return (
            <div className="text-sm space-y-1">
              <p><strong>ID:</strong> {p.product_id}</p>
              <p><strong>Manufacturer:</strong> {p.manufacturer}</p>
              <p>
                <strong>Expiry:</strong> {p.expiry_date ? formatDate(p.expiry_date) : "—"}
              </p>
              <p><strong>Dataset:</strong> {formatDatasetName("product_catalog")}</p>
            </div>
          );
        })()}
      </DetailModal>
    </div>
  );
}

function StatPill({ text }: { text: string }) {
  const n = Number((text.match(/\d+/) || [0])[0]);
  return (
    <span className="rounded-full px-4 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <span className={scoreTextClass(text.includes("DQ Score") ? n : 90)}>{text}</span>
    </span>
  );
}
