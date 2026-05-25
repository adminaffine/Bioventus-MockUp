import type { AgreementExpiryRecord } from "../../services/api";

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

export function AgreementExpiryTable({
  rows,
  highlightId,
  onTriagePricing,
}: {
  rows: AgreementExpiryRecord[];
  highlightId: string | null;
  /** Same contract_id as GPO / pricing queue — jump to variance triage when applicable */
  onTriagePricing: (contractId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 pr-4">Contract</th>
            <th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Product</th>
            <th className="py-2 pr-4">GPO</th>
            <th className="py-2 pr-4">Days</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Value</th>
            <th className="py-2 pr-4">Owner</th>
            <th className="py-2 pr-4">Renewal</th>
            <th className="py-2 pr-4">Drilldown</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ring = Boolean(highlightId && highlightId === row.id);
            return (
              <tr
                key={row.id}
                id={`highlight-${row.id}`}
                className={`border-b border-slate-100 dark:border-slate-700/60 ${ring ? "ring-2 ring-amber-500 ring-inset bg-amber-50/40 dark:bg-amber-900/15" : ""}`}
              >
                <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">{row.id}</td>
                <td className="py-2 pr-4">{row.customer_id}</td>
                <td className="py-2 pr-4">{row.product_name}</td>
                <td className="py-2 pr-4">{row.gpo_name ?? "—"}</td>
                <td className="py-2 pr-4">{row.days_to_expiry}</td>
                <td className="py-2 pr-4">{row.status}</td>
                <td className="py-2 pr-4">{formatMoney(row.estimated_value)}</td>
                <td className="py-2 pr-4">{row.owner}</td>
                <td className="py-2 pr-4 max-w-xs text-xs text-slate-600 dark:text-slate-300">{row.renewal_action}</td>
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => onTriagePricing(row.id)}
                    className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  >
                    Triage pricing →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
