import { useEffect, useState } from "react";
import { UserRound, X } from "lucide-react";
import { TAX_TEAM_OWNERS, type TaxTeamOwner } from "../../config/taxTeamOwners";

type Props = {
  open: boolean;
  issueId: string;
  orderId: string;
  currentOwnerId: string;
  currentOwnerName: string;
  onClose: () => void;
  onConfirm: (owner: TaxTeamOwner) => Promise<void>;
};

export default function TaxReassignModal({
  open,
  issueId,
  orderId,
  currentOwnerId,
  currentOwnerName,
  onClose,
  onConfirm,
}: Props) {
  const [selectedId, setSelectedId] = useState(currentOwnerId);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentOwnerId);
    setNote("");
    setSaving(false);
  }, [open, currentOwnerId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const selected = TAX_TEAM_OWNERS.find((o) => o.owner_id === selectedId);

  const handleConfirm = async () => {
    if (!selected || selected.owner_id === currentOwnerId) return;
    setSaving(true);
    try {
      await onConfirm(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1350] flex items-center justify-center bg-black/50 px-4" onClick={() => !saving && onClose()}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reassign Issue</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-sm">
            <p className="text-slate-500 dark:text-slate-400">Issue</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {issueId} · {orderId}
            </p>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Current owner</p>
            <p className="text-slate-800 dark:text-slate-200">
              {currentOwnerName} ({currentOwnerId})
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Assign to</p>
            <div className="space-y-2">
              {TAX_TEAM_OWNERS.map((owner) => {
                const isCurrent = owner.owner_id === currentOwnerId;
                const isSelected = owner.owner_id === selectedId;
                return (
                  <label
                    key={owner.owner_id}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    } ${isCurrent ? "opacity-70" : ""}`}
                  >
                    <input
                      type="radio"
                      name="reassign-owner"
                      value={owner.owner_id}
                      checked={isSelected}
                      disabled={isCurrent}
                      onChange={() => setSelectedId(owner.owner_id)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{owner.owner_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {owner.owner_id} · {owner.title}
                        {isCurrent ? " · current owner" : ""}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="reassign-note" className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Handoff note (optional)
            </label>
            <textarea
              id="reassign-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for reassignment or context for the new owner…"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-800 dark:text-emerald-200 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !selected || selected.owner_id === currentOwnerId}
            onClick={() => void handleConfirm()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50 shadow-sm"
          >
            {saving ? "Reassigning…" : "Confirm Reassignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
