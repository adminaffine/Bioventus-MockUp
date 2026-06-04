type StewardContractView = {
  contractId: string;
  customerId: string;
  customerName: string;
  currentIdn: string;
  correctIdn: string;
  openOrders: string;
};

type StewardCapaLinkage = {
  capa_id: string;
  regulation: string;
  status: string;
  owner: string;
  due_date: string;
};

type Props = {
  contractOpen: boolean;
  complianceOpen: boolean;
  onCloseContract: () => void;
  onCloseCompliance: () => void;
  contract: StewardContractView;
  capaLinkage: StewardCapaLinkage;
};

export function StewardContractModal({ open, onClose, contract }: { open: boolean; onClose: () => void; contract: StewardContractView }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Contract Details</h3>
          <button type="button" onClick={onClose} className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline">
            Close
          </button>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2 text-sm text-slate-600 dark:text-slate-300">
          <div className="space-y-2">
            <p>
              <span className="font-medium text-slate-800 dark:text-slate-200">Contract ID:</span> {contract.contractId || "—"}
            </p>
            <p>
              <span className="font-medium text-slate-800 dark:text-slate-200">Customer:</span> {contract.customerId} · {contract.customerName}
            </p>
            <p>
              <span className="font-medium text-slate-800 dark:text-slate-200">Open Orders:</span> {contract.openOrders || "—"}
            </p>
          </div>
          <div className="space-y-2">
            <p>
              <span className="font-medium text-slate-800 dark:text-slate-200">Current IDN (SAP):</span> {contract.currentIdn || "—"}
            </p>
            <p>
              <span className="font-medium text-slate-800 dark:text-slate-200">Correct IDN (IQVIA):</span> {contract.correctIdn || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StewardComplianceModal({
  open,
  onClose,
  capaLinkage,
}: {
  open: boolean;
  onClose: () => void;
  capaLinkage: StewardCapaLinkage;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Compliance Record</h3>
          <button type="button" onClick={onClose} className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline">
            Close
          </button>
        </div>
        <table className="mt-4 min-w-full text-sm">
          <tbody>
            {Object.entries(capaLinkage).map(([key, value]) => (
              <tr key={key} className="border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                <td className="py-2 pr-4 font-medium capitalize text-slate-700 dark:text-slate-300">
                  {key.replace(/_/g, " ")}
                </td>
                <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StewardViewModals({ contractOpen, complianceOpen, onCloseContract, onCloseCompliance, contract, capaLinkage }: Props) {
  return (
    <>
      <StewardContractModal open={contractOpen} onClose={onCloseContract} contract={contract} />
      <StewardComplianceModal open={complianceOpen} onClose={onCloseCompliance} capaLinkage={capaLinkage} />
    </>
  );
}
