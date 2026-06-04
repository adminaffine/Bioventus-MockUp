import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type PricingClosure, type PricingDashboard } from "../services/api";
import { EXECUTIVE_APPROVAL_PRICING_ISSUE_ID } from "../utils/executiveApprovalRecord";
import {
  markHighValueRecordApproved,
  subscribeHighValueApproved,
} from "../utils/highValueRecordSync";
import { syncPricingDashboardKpis } from "../utils/pricingDashboard";

function normalizePricingDashboard(dashboard: PricingDashboard): PricingDashboard {
  return syncPricingDashboardKpis(dashboard);
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type PricingWorkflowContextValue = {
  dashboard: PricingDashboard | null;
  dashboardRevision: number;
  loading: boolean;
  aiActionPendingId: string | null;
  refreshDashboard: (options?: { silent?: boolean }) => Promise<void>;
  applyAiAction: (issueId: string, action: "approve" | "reject") => Promise<void>;
  resolveIssue: (issueId: string) => Promise<PricingClosure>;
  pricingReassign: (issueId: string, ownerId: string) => Promise<{ owner_name: string }>;
  pricingBannerStats: string | null;
};

const PricingWorkflowContext = createContext<PricingWorkflowContextValue | null>(null);

export function PricingWorkflowProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<PricingDashboard | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiActionPendingId, setAiActionPendingId] = useState<string | null>(null);

  const applyDashboard = useCallback((data: PricingDashboard) => {
    setDashboard(normalizePricingDashboard(data));
    setDashboardRevision((n) => n + 1);
  }, []);

  const refreshDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const data = await api.getPricingDashboard();
      applyDashboard(data);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [applyDashboard]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    return subscribeHighValueApproved(() => {
      setDashboard((prev) => (prev ? normalizePricingDashboard(prev) : prev));
      setDashboardRevision((n) => n + 1);
    });
  }, []);

  const applyAiAction = useCallback(async (issueId: string, action: "approve" | "reject") => {
    setAiActionPendingId(issueId);
    if (action === "approve" && issueId === EXECUTIVE_APPROVAL_PRICING_ISSUE_ID) {
      markHighValueRecordApproved(issueId);
      setDashboard((prev) => (prev ? normalizePricingDashboard(prev) : prev));
      setDashboardRevision((n) => n + 1);
    }
    try {
      await api.pricingAiAction(issueId, action);
      await refreshDashboard({ silent: true });
    } finally {
      setAiActionPendingId(null);
    }
  }, [refreshDashboard]);

  const resolveIssue = useCallback(async (issueId: string) => {
    if (issueId === EXECUTIVE_APPROVAL_PRICING_ISSUE_ID) {
      markHighValueRecordApproved(issueId);
      setDashboard((prev) => (prev ? normalizePricingDashboard(prev) : prev));
      setDashboardRevision((n) => n + 1);
    }
    const result = await api.pricingResolve(issueId);
    applyDashboard(result.dashboard);
    setLoading(false);
    return result.closure;
  }, [applyDashboard]);

  const pricingReassign = useCallback(async (issueId: string, ownerId: string) => {
    const result = await api.pricingReassign(issueId, ownerId);
    await refreshDashboard();
    return { owner_name: result.owner_name };
  }, [refreshDashboard]);

  const pricingBannerStats = useMemo(() => {
    if (!dashboard) return null;
    const h = dashboard.headline;
    return (
      `${formatMoney(h.total_exposure)} at risk · ` +
      `${h.active_conflicts} GPO conflicts · ` +
      `${h.expiring_contracts} contracts expiring`
    );
  }, [dashboard]);

  return (
    <PricingWorkflowContext.Provider
      value={{
        dashboard,
        dashboardRevision,
        loading,
        aiActionPendingId,
        refreshDashboard,
        applyAiAction,
        resolveIssue,
        pricingReassign,
        pricingBannerStats,
      }}
    >
      {children}
    </PricingWorkflowContext.Provider>
  );
}

export function usePricingWorkflow() {
  const ctx = useContext(PricingWorkflowContext);
  if (!ctx) throw new Error("usePricingWorkflow must be used within PricingWorkflowProvider");
  return ctx;
}

export function usePricingWorkflowOptional() {
  return useContext(PricingWorkflowContext);
}
