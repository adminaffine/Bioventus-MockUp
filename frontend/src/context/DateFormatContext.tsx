import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_DATE_DISPLAY_FORMAT,
  DISPLAY_DATE_FORMAT_STORAGE_KEY,
  type DateDisplayFormatId,
  formatDisplayDate,
  normalizeDateDisplayFormatId,
} from "../lib/displayDate";

type DateFormatContextValue = {
  formatId: DateDisplayFormatId;
  setFormatId: (id: DateDisplayFormatId) => void;
  /** Presentation only — pass API date strings or ISO datetimes (date prefix used when possible). */
  formatDate: (value: string | null | undefined, fallback?: string) => string;
};

const DateFormatContext = createContext<DateFormatContextValue | null>(null);

function readStoredFormat(): DateDisplayFormatId {
  try {
    return normalizeDateDisplayFormatId(localStorage.getItem(DISPLAY_DATE_FORMAT_STORAGE_KEY));
  } catch {
    return DEFAULT_DATE_DISPLAY_FORMAT;
  }
}

export function DateFormatProvider({ children }: { children: ReactNode }) {
  const [formatId, setFormatIdState] = useState<DateDisplayFormatId>(() => readStoredFormat());

  const setFormatId = useCallback((id: DateDisplayFormatId) => {
    setFormatIdState(id);
    try {
      localStorage.setItem(DISPLAY_DATE_FORMAT_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const formatDate = useCallback(
    (value: string | null | undefined, fallback = "—") => formatDisplayDate(value, formatId, fallback),
    [formatId]
  );

  const value = useMemo(
    () => ({
      formatId,
      setFormatId,
      formatDate,
    }),
    [formatId, setFormatId, formatDate]
  );

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

export function useDateFormat(): DateFormatContextValue {
  const ctx = useContext(DateFormatContext);
  if (!ctx) {
    throw new Error("useDateFormat must be used within DateFormatProvider");
  }
  return ctx;
}
