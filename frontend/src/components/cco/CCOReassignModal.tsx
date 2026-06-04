import { useEffect, useState } from "react";
import { UserRound, X } from "lucide-react";
import { CCO_TEAM_MEMBERS, type CCOTeamOwner } from "../../config/ccoTeamOwners";

type Props = {
  open: boolean;
  issueId: string;
  orderId: string;
  currentAssignee: string;
  onClose: () => void;
  onConfirm: (owner: CCOTeamOwner) => Promise<void>;
};

export default function CCOReassignModal({
  open,
  issueId,
  orderId,
  currentAssignee,
  onClose,
  onConfirm,
}: Props) {
  const [selectedId, setSelectedId] = useState(currentAssignee);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(currentAssignee);
    setSaving(false);
  }, [open, currentAssignee]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  const selected = CCO_TEAM_MEMBERS.find((o) => o.id === selectedId);

  const handleConfirm = async () => {
    if (!selected || selected.id === currentAssignee) return;
    setSaving(true);
    try {
      await onConfirm(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1350] flex items-center justify-center bg-black/50 px-4"
      onClick={() => !saving && onClose()}
    >
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
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-800 dark:text-slate-100">{issueId}</span> · {orderId}
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {CCO_TEAM_MEMBERS.map((owner) => (
              <label
                key={owner.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                  selectedId === owner.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-slate-200 dark:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="cco-owner"
                  checked={selectedId === owner.id}
                  onChange={() => setSelectedId(owner.id)}
                  className="text-indigo-600"
                />
                <span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{owner.name}</span>
                  <span className="text-slate-500 dark:text-slate-400"> · {owner.team}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving || !selected || selected.id === currentAssignee}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}
