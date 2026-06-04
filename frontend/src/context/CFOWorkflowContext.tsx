import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type CFOClosure, type CFODashboard } from "../services/api";
import { fmtCFOCompact } from "../utils/cfoClosureFormat";
import {
  clearCfoResolvedMarks,
  markCfoAlertResolved,
  resetCfoReviewQueue,
} from "../utils/cfoWorkflowStorage";
import { filterOpenCfoDashboard } from "../utils/cfoDashboard";
import {
  markHighValueRecordApproved,
  subscribeHighValueApproved,
} from "../utils/highValueRecordSync";

function applyDashboard(dashboard: CFODashboard): CFODashboard {
  return filterOpenCfoDashboard(dashboard);
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type CFOWorkflowContextValue = {
  dashboard: CFODashboard | null;
  loading: boolean;
  error: string | null;
  cfoBannerStats: string | null;
  dashboardRevision: number;
  refreshDashboard: () => Promise<void>;
  applyAiAction: (alertId: string, action: "approve" | "reject") => Promise<void>;
  aiActionPendingId: string | null;
  approveAlert: (alertId: string) => Promise<CFOClosure>;
  reassignAlert: (alertId: string, ownerId: string, ownerName: string) => Promise<void>;
  activeAlertId: string | null;
  setActiveAlertId: (id: string | null) => void;
};

const CFOWorkflowContext = createContext<CFOWorkflowContextValue | null>(null);

export function CFOWorkflowProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<CFODashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [aiActionPendingId, setAiActionPendingId] = useState<string | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCFODashboard();
      resetCfoReviewQueue();
      clearCfoResolvedMarks();
      setDashboard(applyDashboard(data));
      setDashboardRevision((r) => r + 1);
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : "Failed to load CFO dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    return subscribeHighValueApproved(() => {
      setDashboard((prev) => (prev ? applyDashboard(prev) : prev));
      setDashboardRevision((r) => r + 1);
    });
  }, []);

  const applyAiAction = useCallback(
    async (alertId: string, action: "approve" | "reject") => {
      setAiActionPendingId(alertId);
      try {
        const result = await api.cfoAiAction(alertId, action);
        setDashboard(applyDashboard(result.dashboard));
        setDashboardRevision((r) => r + 1);
      } catch (err) {
        await refreshDashboard();
        throw err;
      } finally {
        setAiActionPendingId(null);
      }
    },
    [refreshDashboard],
  );

  const approveAlert = useCallback(async (alertId: string) => {
    markHighValueRecordApproved(alertId);
    setDashboard((prev) => (prev ? applyDashboard(prev) : prev));
    setDashboardRevision((r) => r + 1);
    const result = await api.cfoApprove(alertId);
    markCfoAlertResolved(alertId);
    setDashboard(applyDashboard(result.dashboard));
    setDashboardRevision((r) => r + 1);
    return result.closure;
  }, []);

  const reassignAlert = useCallback(
    async (alertId: string, ownerId: string, ownerName: string) => {
      const updated = await api.cfoReassign(alertId, ownerId, ownerName);
      setDashboard(applyDashboard(updated));
      setDashboardRevision((r) => r + 1);
    },
    [],
  );

  const cfoBannerStats = useMemo(() => {
    if (!dashboard) return null;
    const h = dashboard.headline;
    return `${formatMoney(h.total_exposure)} at risk · ${h.open_issues} open issues · ${h.pre_invoice_count} pre-invoice · ${fmtCFOCompact(h.predicted_annual_exposure)} annualized`;
  }, [dashboard]);

  const value = useMemo(
    () => ({
      dashboard,
      loading,
      error,
      cfoBannerStats,
      dashboardRevision,
      refreshDashboard,
      applyAiAction,
      aiActionPendingId,
      approveAlert,
      reassignAlert,
      activeAlertId,
      setActiveAlertId,
    }),
    [
      dashboard,
      loading,
      error,
      cfoBannerStats,
      dashboardRevision,
      refreshDashboard,
      applyAiAction,
      aiActionPendingId,
      approveAlert,
      reassignAlert,
      activeAlertId,
    ],
  );

  return <CFOWorkflowContext.Provider value={value}>{children}</CFOWorkflowContext.Provider>;
}

export function useCFOWorkflow(): CFOWorkflowContextValue {
  const ctx = useContext(CFOWorkflowContext);
  if (!ctx) throw new Error("useCFOWorkflow must be used within CFOWorkflowProvider");
  return ctx;
}

export function useCFOWorkflowOptional(): CFOWorkflowContextValue | null {
  return useContext(CFOWorkflowContext);
}
