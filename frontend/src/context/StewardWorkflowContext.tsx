import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type StewardClosure, type StewardDashboard } from "../services/api";
import { normalizeStewardDashboard } from "../utils/stewardOwnerNormalize";
import { clearStewardAiRejected } from "../utils/stewardWorkflowStorage";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type StewardWorkflowContextValue = {
  dashboard: StewardDashboard | null;
  dashboardRevision: number;
  loading: boolean;
  aiActionPendingId: string | null;
  refreshDashboard: (options?: { silent?: boolean }) => Promise<void>;
  applyAiAction: (issueId: string, action: "approve" | "reject") => Promise<void>;
  resolveIssue: (issueId: string) => Promise<StewardClosure>;
  approveAndResolve: (issueId: string) => Promise<StewardClosure>;
  stewardBannerStats: string | null;
};

const StewardWorkflowContext = createContext<StewardWorkflowContextValue | null>(null);

export function StewardWorkflowProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<StewardDashboard | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiActionPendingId, setAiActionPendingId] = useState<string | null>(null);

  const applyDashboard = useCallback((data: StewardDashboard) => {
    setDashboard(normalizeStewardDashboard(data));
    setDashboardRevision((n) => n + 1);
  }, []);

  const refreshDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const data = await api.getStewardDashboard();
      applyDashboard(data);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [applyDashboard]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const applyAiAction = useCallback(
    async (issueId: string, action: "approve" | "reject") => {
      setAiActionPendingId(issueId);
      try {
        const result = await api.stewardAiAction(issueId, action);
        if (result.dashboard) {
          applyDashboard(result.dashboard);
          setLoading(false);
        } else {
          await refreshDashboard({ silent: true });
        }
      } finally {
        setAiActionPendingId(null);
      }
    },
    [applyDashboard, refreshDashboard],
  );

  const resolveIssue = useCallback(
    async (issueId: string) => {
      const result = await api.stewardResolve(issueId);
      applyDashboard(result.dashboard);
      setLoading(false);
      return result.closure;
    },
    [applyDashboard],
  );

  const approveAndResolve = useCallback(
    async (issueId: string) => {
      clearStewardAiRejected(issueId);
      await applyAiAction(issueId, "approve");
      return resolveIssue(issueId);
    },
    [applyAiAction, resolveIssue],
  );

  const stewardBannerStats = useMemo(() => {
    if (!dashboard) return null;
    const h = dashboard.headline;
    return (
      `${formatMoney(h.total_exposure)} at risk · ` +
      `${h.hierarchy_mismatches} hierarchy issues · ` +
      `${h.orphan_records} orphan records`
    );
  }, [dashboard]);

  return (
    <StewardWorkflowContext.Provider
      value={{
        dashboard,
        dashboardRevision,
        loading,
        aiActionPendingId,
        refreshDashboard,
        applyAiAction,
        resolveIssue,
        approveAndResolve,
        stewardBannerStats,
      }}
    >
      {children}
    </StewardWorkflowContext.Provider>
  );
}

export function useStewardWorkflow() {
  const ctx = useContext(StewardWorkflowContext);
  if (!ctx) throw new Error("useStewardWorkflow must be used within StewardWorkflowProvider");
  return ctx;
}
