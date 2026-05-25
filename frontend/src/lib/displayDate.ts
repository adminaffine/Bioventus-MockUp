/** Per-browser display only — APIs stay ISO / canonical. */

export type DateDisplayFormatId = "mdy-dash" | "dmy-dash" | "ymd-slash" | "mdy-slash" | "ymd-dash" | "dmy-slash";

export const DISPLAY_DATE_FORMAT_STORAGE_KEY = "luminos_display_date_format";

export const DEFAULT_DATE_DISPLAY_FORMAT: DateDisplayFormatId = "mdy-dash";

export const DATE_DISPLAY_FORMAT_OPTIONS: { id: DateDisplayFormatId; label: string }[] = [
  { id: "mdy-dash", label: "MM-DD-YYYY" },
  { id: "mdy-slash", label: "MM/DD/YYYY" },
  { id: "dmy-dash", label: "DD-MM-YYYY" },
  { id: "dmy-slash", label: "DD/MM/YYYY" },
  { id: "ymd-slash", label: "YYYY/MM/DD" },
  { id: "ymd-dash", label: "YYYY-MM-DD" },
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function parseCalendarPartsFromUnknown(value: string | null | undefined): { y: number; m: number; d: number } | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const dt = new Date(t);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

export function formatCalendarParts(parts: { y: number; m: number; d: number }, formatId: DateDisplayFormatId): string {
  const { y, m, d } = parts;
  const MM = pad2(m);
  const DD = pad2(d);
  const YYYY = String(y);
  switch (formatId) {
    case "mdy-dash":
      return `${MM}-${DD}-${YYYY}`;
    case "mdy-slash":
      return `${MM}/${DD}/${YYYY}`;
    case "dmy-dash":
      return `${DD}-${MM}-${YYYY}`;
    case "dmy-slash":
      return `${DD}/${MM}/${YYYY}`;
    case "ymd-slash":
      return `${YYYY}/${MM}/${DD}`;
    case "ymd-dash":
      return `${YYYY}-${MM}-${DD}`;
    default:
      return `${MM}-${DD}-${YYYY}`;
  }
}

/** Format a single date for UI; returns fallback if not parseable. */
export function formatDisplayDate(value: string | null | undefined, formatId: DateDisplayFormatId, fallback = "—"): string {
  if (value == null || String(value).trim() === "") return fallback;
  const parts = parseCalendarPartsFromUnknown(value);
  if (!parts) return String(value);
  return formatCalendarParts(parts, formatId);
}

export function normalizeDateDisplayFormatId(raw: string | null): DateDisplayFormatId {
  if (!raw) return DEFAULT_DATE_DISPLAY_FORMAT;
  const ok = DATE_DISPLAY_FORMAT_OPTIONS.some((o) => o.id === raw);
  return ok ? (raw as DateDisplayFormatId) : DEFAULT_DATE_DISPLAY_FORMAT;
}
