import { Link } from "react-router-dom";
import type { PricingDiscrepancy } from "../../services/api";

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

export function PricingDiscrepancyTable({
  rows,
  contractHighlight,
}: {
  rows: PricingDiscrepancy[];
  contractHighlight: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 pr-4">Contract</th>
            <th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Product</th>
            <th className="py-2 pr-4">Tier</th>
            <th className="py-2 pr-4">Contract $</th>
            <th className="py-2 pr-4">Charged $</th>
            <th className="py-2 pr-4">Variance</th>
            <th className="py-2 pr-4">Severity</th>
            <th className="py-2 pr-4">Owner</th>
            <th className="py-2 pr-4">Action</th>
            <th className="py-2 pr-4">Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ring = Boolean(contractHighlight && contractHighlight === row.id);
            return (
              <tr
                key={row.id}
                id={`highlight-${row.id}`}
                className={`border-b border-slate-100 dark:border-slate-700/60 ${ring ? "ring-2 ring-rose-500 ring-inset bg-rose-50/40 dark:bg-rose-900/15" : ""}`}
              >
                <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{row.id}</td>
                <td className="py-2 pr-4">{row.customer_id}</td>
                <td className="py-2 pr-4">{row.product_name}</td>
                <td className="py-2 pr-4">{row.tier ?? "—"}</td>
                <td className="py-2 pr-4">{formatMoney(row.contracted_price)}</td>
                <td className="py-2 pr-4">{formatMoney(row.charged_price)}</td>
                <td className="py-2 pr-4 text-rose-600 dark:text-rose-300">{formatMoney(row.price_variance)}</td>
                <td className="py-2 pr-4">{row.severity}</td>
                <td className="py-2 pr-4">{row.owner}</td>
                <td className="py-2 pr-4 max-w-xs text-xs text-slate-600 dark:text-slate-300">{row.action_required}</td>
                <td className="py-2 pr-4">
                  {row.linked_order_id ? (
                    <Link
                      to={`/profiler?dataset=sales_orders`}
                      className="text-indigo-600 dark:text-indigo-300 text-xs whitespace-nowrap"
                      title={`Linked order ${row.linked_order_id} — open sales_orders in Profiler`}
                    >
                      {row.linked_order_id} →
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
