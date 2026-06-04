import { useEffect, useState } from "react";
import { UserRound, X } from "lucide-react";
import { VP_TEAM_MEMBERS, type VPTeamMember } from "../../config/vpTeamOwners";
import { api } from "../../services/api";

type Props = {
  open: boolean;
  issueId: string;
  recordLabel: string;
  currentOwnerId: string;
  currentOwnerName: string;
  onClose: () => void;
  onConfirm: (member: VPTeamMember) => Promise<void>;
};

export default function VPReassignModal({
  open,
  issueId,
  recordLabel,
  currentOwnerId,
  currentOwnerName,
  onClose,
  onConfirm,
}: Props) {
  const [members, setMembers] = useState<VPTeamMember[]>(VP_TEAM_MEMBERS);
  const [selectedId, setSelectedId] = useState(currentOwnerId);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void api.getVPTeamMembers().then(setMembers).catch(() => setMembers(VP_TEAM_MEMBERS));
  }, [open]);

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

  const selected = members.find((m) => m.id === selectedId);

  const handleConfirm = async () => {
    if (!selected || selected.id === currentOwnerId) return;
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
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reassign Issue</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-sm">
            <p className="text-slate-500 dark:text-slate-400">Issue</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {issueId} · {recordLabel}
            </p>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Current owner</p>
            <p className="text-slate-800 dark:text-slate-200">
              {currentOwnerName} ({currentOwnerId})
            </p>
          </div>
          <div className="space-y-2">
            {members.map((member) => {
              const isCurrent = member.id === currentOwnerId;
              const isSelected = member.id === selectedId;
              return (
                <label
                  key={member.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                    isSelected ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="vp-reassign-owner"
                    checked={isSelected}
                    disabled={isCurrent}
                    onChange={() => setSelectedId(member.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-slate-500">
                      {member.id} · {member.team}
                      {isCurrent ? " · current owner" : ""}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Handoff note (optional)…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !selected || selected.id === currentOwnerId}
            onClick={() => void handleConfirm()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? "Reassigning…" : "Confirm Reassignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
