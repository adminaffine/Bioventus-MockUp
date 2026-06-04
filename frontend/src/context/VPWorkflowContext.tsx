import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type VPClosure, type VPDashboard } from "../services/api";
import { filterOpenVPDashboard, patchDashboardAfterVpClosedAction } from "../utils/vpDashboard";
import { getVpClosedIssueIds, markVpIssueResolved, resetVpDemoWorkflow } from "../utils/vpWorkflowStorage";

type VPWorkflowContextValue = {
  dashboard: VPDashboard | null;
  dashboardRevision: number;
  loading: boolean;
  error: string | null;
  aiActionPendingId: string | null;
  refreshDashboard: (options?: { silent?: boolean }) => Promise<void>;
  resetDemo: () => Promise<void>;
  applyAiAction: (issueId: string, action: "approve" | "reject") => Promise<void>;
  approveIssue: (issueId: string) => Promise<VPClosure>;
  vpReassign: (issueId: string, memberId: string, memberName: string) => Promise<VPClosure>;
  escalateIssue: (issueId: string) => Promise<VPClosure>;
  vpBannerStats: string | null;
};

const VPWorkflowContext = createContext<VPWorkflowContextValue | null>(null);

export function VPWorkflowProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<VPDashboard | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiActionPendingId, setAiActionPendingId] = useState<string | null>(null);
  const refreshGenerationRef = useRef(0);

  const applyFilteredDashboard = useCallback((data: VPDashboard) => {
    setDashboard(filterOpenVPDashboard(data, getVpClosedIssueIds()));
    setDashboardRevision((n) => n + 1);
  }, []);

  const invalidateInFlightRefresh = useCallback(() => {
    refreshGenerationRef.current += 1;
  }, []);

  const registerClosedIssue = useCallback(
    (issueId: string) => {
      invalidateInFlightRefresh();
      setDashboard((prev) => {
        if (!prev) return prev;
        const team = [...prev.all_open_issues, ...prev.top_alerts, ...prev.ai_queue].find(
          (r) => r.issue_id === issueId,
        )?.team;
        markVpIssueResolved(issueId, team);
        return filterOpenVPDashboard(patchDashboardAfterVpClosedAction(prev, issueId), getVpClosedIssueIds());
      });
      setDashboardRevision((n) => n + 1);
    },
    [invalidateInFlightRefresh],
  );

  const refreshDashboard = useCallback(
    async (options?: { silent?: boolean }) => {
      const generation = refreshGenerationRef.current;
      if (!options?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.getVPDashboard();
        if (generation !== refreshGenerationRef.current) return;
        applyFilteredDashboard(data);
      } catch (err) {
        if (generation !== refreshGenerationRef.current) return;
        setDashboard(null);
        setError(err instanceof Error ? err.message : "Failed to load VP dashboard");
      } finally {
        if (generation === refreshGenerationRef.current && !options?.silent) setLoading(false);
      }
    },
    [applyFilteredDashboard],
  );

  const resetDemo = useCallback(async () => {
    invalidateInFlightRefresh();
    resetVpDemoWorkflow();
    setLoading(true);
    setError(null);
    try {
      const result = await api.vpResetDemo();
      setDashboard(filterOpenVPDashboard(result.dashboard, getVpClosedIssueIds()));
      setDashboardRevision((n) => n + 1);
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : "Failed to reset VP demo");
    } finally {
      setLoading(false);
    }
  }, [invalidateInFlightRefresh]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const applyAiAction = useCallback(
    async (issueId: string, action: "approve" | "reject") => {
      setAiActionPendingId(issueId);
      if (action === "approve") {
        registerClosedIssue(issueId);
      }
      try {
        const result = await api.vpAiAction(issueId, action);
        if (action === "approve") {
          markVpIssueResolved(issueId);
        }
        applyFilteredDashboard(result.dashboard);
      } catch (err) {
        await refreshDashboard({ silent: true });
        throw err;
      } finally {
        setAiActionPendingId(null);
      }
    },
    [applyFilteredDashboard, refreshDashboard, registerClosedIssue],
  );

  const approveIssue = useCallback(
    async (issueId: string) => {
      setAiActionPendingId(issueId);
      registerClosedIssue(issueId);
      try {
        const result = await api.vpApprove(issueId);
        markVpIssueResolved(issueId);
        applyFilteredDashboard(result.dashboard);
        return result.closure;
      } catch (err) {
        await refreshDashboard({ silent: true });
        throw err;
      } finally {
        setAiActionPendingId(null);
      }
    },
    [applyFilteredDashboard, refreshDashboard, registerClosedIssue],
  );

  const vpReassign = useCallback(
    async (issueId: string, memberId: string, memberName: string) => {
      setAiActionPendingId(issueId);
      registerClosedIssue(issueId);
      try {
        const result = await api.vpReassign(issueId, memberId, memberName);
        markVpIssueResolved(issueId);
        applyFilteredDashboard(result.dashboard);
        return result.closure;
      } catch (err) {
        await refreshDashboard({ silent: true });
        throw err;
      } finally {
        setAiActionPendingId(null);
      }
    },
    [applyFilteredDashboard, refreshDashboard, registerClosedIssue],
  );

  const escalateIssue = useCallback(
    async (issueId: string) => {
      setAiActionPendingId(issueId);
      registerClosedIssue(issueId);
      try {
        const result = await api.vpEscalate(issueId);
        markVpIssueResolved(issueId);
        applyFilteredDashboard(result.dashboard);
        return result.closure;
      } catch (err) {
        await refreshDashboard({ silent: true });
        throw err;
      } finally {
        setAiActionPendingId(null);
      }
    },
    [applyFilteredDashboard, refreshDashboard, registerClosedIssue],
  );

  const vpBannerStats = useMemo(() => {
    if (!dashboard) return null;
    const h = dashboard.headline;
    return (
      `${h.total_open_issues} open issues · ` +
      `${h.sla_breach_risk} SLA breach risk · ` +
      `${h.escalation_queue} in priority queue · ` +
      `${h.team_resolution_rate}% team resolution rate`
    );
  }, [dashboard]);

  return (
    <VPWorkflowContext.Provider
      value={{
        dashboard,
        dashboardRevision,
        loading,
        error,
        aiActionPendingId,
        refreshDashboard,
        resetDemo,
        applyAiAction,
        approveIssue,
        vpReassign,
        escalateIssue,
        vpBannerStats,
      }}
    >
      {children}
    </VPWorkflowContext.Provider>
  );
}

export function useVPWorkflow() {
  const ctx = useContext(VPWorkflowContext);
  if (!ctx) throw new Error("useVPWorkflow must be used within VPWorkflowProvider");
  return ctx;
}

export function useVPWorkflowOptional() {
  return useContext(VPWorkflowContext);
}
