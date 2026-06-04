import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type CCOClosure, type CCODashboard } from "../services/api";
import { fmtCCOCompact } from "../utils/ccoClosureFormat";
import { filterOpenCCODashboard } from "../utils/ccoDashboard";
import {
  clearCcoResolvedMarks,
  markCcoIssueResolved,
  resetCcoReviewQueue,
} from "../utils/ccoWorkflowStorage";
import {
  markHighValueRecordApproved,
  subscribeHighValueApproved,
} from "../utils/highValueRecordSync";

export type { CCOClosure } from "../services/api";

function applyDashboard(dashboard: CCODashboard): CCODashboard {
  return filterOpenCCODashboard(dashboard);
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type CCOWorkflowContextValue = {
  dashboard: CCODashboard | null;
  loading: boolean;
  error: string | null;
  ccoBannerStats: string | null;
  dashboardRevision: number;
  refreshDashboard: () => Promise<void>;
  approveAlert: (issueId: string) => Promise<CCOClosure>;
  reassignAlert: (issueId: string, ownerId: string, ownerName: string) => Promise<void>;
  activeIssueId: string | null;
  setActiveIssueId: (id: string | null) => void;
};

const CCOWorkflowContext = createContext<CCOWorkflowContextValue | null>(null);

export function CCOWorkflowProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<CCODashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCCODashboard();
      resetCcoReviewQueue();
      clearCcoResolvedMarks();
      setDashboard(applyDashboard(data));
      setDashboardRevision((r) => r + 1);
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : "Failed to load CCO dashboard");
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

  const approveAlert = useCallback(async (issueId: string) => {
    markHighValueRecordApproved(issueId);
    markCcoIssueResolved(issueId);
    setDashboard((prev) => (prev ? applyDashboard(prev) : prev));
    setDashboardRevision((r) => r + 1);
    const result = await api.ccoApprove(issueId);
    setDashboard(applyDashboard(result.dashboard));
    setDashboardRevision((r) => r + 1);
    return result.closure;
  }, []);

  const reassignAlert = useCallback(async (issueId: string, ownerId: string, ownerName: string) => {
    const updated = await api.ccoReassign(issueId, ownerId, ownerName);
    setDashboard(applyDashboard(updated));
    setDashboardRevision((r) => r + 1);
  }, []);

  const ccoBannerStats = useMemo(() => {
    if (!dashboard) return null;
    const h = dashboard.headline;
    return `${h.display_exposure ?? formatMoney(h.total_compliance_exposure)} compliance exposure · ${h.open_issues} open issues · ${h.pre_invoice} pre-invoice · ${h.display_annualized ?? fmtCCOCompact(h.annualized_regulatory_risk)} annualized regulatory risk`;
  }, [dashboard]);

  const value = useMemo(
    () => ({
      dashboard,
      loading,
      error,
      ccoBannerStats,
      dashboardRevision,
      refreshDashboard,
      approveAlert,
      reassignAlert,
      activeIssueId,
      setActiveIssueId,
    }),
    [
      dashboard,
      loading,
      error,
      ccoBannerStats,
      dashboardRevision,
      refreshDashboard,
      approveAlert,
      reassignAlert,
      activeIssueId,
    ],
  );

  return <CCOWorkflowContext.Provider value={value}>{children}</CCOWorkflowContext.Provider>;
}

export function useCCOWorkflow(): CCOWorkflowContextValue {
  const ctx = useContext(CCOWorkflowContext);
  if (!ctx) throw new Error("useCCOWorkflow must be used within CCOWorkflowProvider");
  return ctx;
}

export function useCCOWorkflowOptional(): CCOWorkflowContextValue | null {
  return useContext(CCOWorkflowContext);
}
