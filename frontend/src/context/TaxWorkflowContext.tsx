import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type TaxClosure, type TaxDashboard } from "../services/api";
import { EXECUTIVE_APPROVAL_TAX_ISSUE_ID } from "../utils/executiveApprovalRecord";
import {
  markHighValueRecordApproved,
  subscribeHighValueApproved,
} from "../utils/highValueRecordSync";
import { patchDashboardAfterAiAction } from "../utils/taxDashboardPatch";
import { syncTaxDashboardKpis } from "../utils/taxDashboardSync";
import { clearTaxAiRejected } from "../utils/taxWorkflowStorage";

function normalizeTaxDashboard(dashboard: TaxDashboard): TaxDashboard {
  return syncTaxDashboardKpis(dashboard);
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type TaxWorkflowContextValue = {
  dashboard: TaxDashboard | null;
  loading: boolean;
  aiActionPendingId: string | null;
  refreshDashboard: () => Promise<void>;
  applyAiAction: (issueId: string, action: "approve" | "reject") => Promise<void>;
  issueAction: (
    issueId: string,
    action: "acknowledge" | "reassign" | "update_address",
    options?: { owner_id?: string; owner_name?: string },
  ) => Promise<{ message: string }>;
  resolveIssue: (issueId: string) => Promise<TaxClosure>;
  /** Approve AI recommendation, resolve issue, return closure (same KPI impact as Request Jurisdiction). */
  approveAndResolve: (issueId: string) => Promise<TaxClosure>;
  taxBannerStats: string | null;
};

const TaxWorkflowContext = createContext<TaxWorkflowContextValue | null>(null);

export function TaxWorkflowProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<TaxDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiActionPendingId, setAiActionPendingId] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTaxDashboard();
      setDashboard(normalizeTaxDashboard(data));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    return subscribeHighValueApproved(() => {
      setDashboard((prev) => (prev ? normalizeTaxDashboard(prev) : prev));
    });
  }, []);

  const applyAiAction = useCallback(
    async (issueId: string, action: "approve" | "reject") => {
      if (action === "approve" && issueId === EXECUTIVE_APPROVAL_TAX_ISSUE_ID) {
        markHighValueRecordApproved(issueId);
        setDashboard((prev) => (prev ? normalizeTaxDashboard(prev) : prev));
      }
      setAiActionPendingId(issueId);
      setDashboard((prev) =>
        prev ? normalizeTaxDashboard(patchDashboardAfterAiAction(prev, issueId, action)) : prev,
      );
      try {
        const result = await api.postTaxAiAction({ issue_id: issueId, action });
        setDashboard(normalizeTaxDashboard(result.dashboard));
      } catch (err) {
        await refreshDashboard();
        throw err;
      } finally {
        setAiActionPendingId(null);
      }
    },
    [refreshDashboard],
  );

  const resolveIssue = useCallback(async (issueId: string) => {
    if (issueId === EXECUTIVE_APPROVAL_TAX_ISSUE_ID) {
      markHighValueRecordApproved(issueId);
      setDashboard((prev) => (prev ? normalizeTaxDashboard(prev) : prev));
    }
    const result = await api.postTaxResolve({ issue_id: issueId });
    setDashboard(normalizeTaxDashboard(result.dashboard));
    return result.closure;
  }, []);

  const approveAndResolve = useCallback(
    async (issueId: string) => {
      clearTaxAiRejected(issueId);
      markHighValueRecordApproved(issueId);
      setDashboard((prev) => (prev ? normalizeTaxDashboard(prev) : prev));
      await applyAiAction(issueId, "approve");
      return resolveIssue(issueId);
    },
    [applyAiAction, resolveIssue],
  );

  const issueAction = useCallback(
    async (
      issueId: string,
      action: "acknowledge" | "reassign" | "update_address",
      options?: { owner_id?: string; owner_name?: string },
    ) => {
      const result = await api.postTaxIssueAction({
        issue_id: issueId,
        action,
        owner_id: options?.owner_id,
        owner_name: options?.owner_name,
      });
      setDashboard(normalizeTaxDashboard(result.dashboard));
      return { message: result.message };
    },
    [],
  );

  const taxBannerStats = useMemo(() => {
    if (!dashboard) return null;
    const h = dashboard.headline;
    const days = h.next_invoice_days ?? 0;
    const complianceCard = dashboard.kpi_cards.find((c) => c.name === "Compliance Exposure");
    const exposure = complianceCard?.value ?? h.total_exposure;
    const kpi5Card =
      dashboard.kpi_cards.find((c) => c.name === "Tax Underpayments") ?? dashboard.kpi_cards[4];
    const kpi5Text = kpi5Card
      ? `${kpi5Card.name}: ${
          kpi5Card.unit === "dollars" ? formatMoney(Number(kpi5Card.value)) : `${kpi5Card.value} ${kpi5Card.unit}`
        }`
      : null;
    return (
      `${formatMoney(Number(exposure))} at risk · ` +
      `${h.active_mismatches} jurisdiction mismatches · ` +
      `${h.pre_invoice_alerts} pre-invoice alerts · ` +
      `${days} day${days === 1 ? "" : "s"} to next invoice` +
      (kpi5Text ? ` · ${kpi5Text}` : "")
    );
  }, [dashboard]);

  return (
    <TaxWorkflowContext.Provider
      value={{
        dashboard,
        loading,
        aiActionPendingId,
        refreshDashboard,
        applyAiAction,
        issueAction,
        resolveIssue,
        approveAndResolve,
        taxBannerStats,
      }}
    >
      {children}
    </TaxWorkflowContext.Provider>
  );
}

export function useTaxWorkflow() {
  const ctx = useContext(TaxWorkflowContext);
  if (!ctx) throw new Error("useTaxWorkflow must be used within TaxWorkflowProvider");
  return ctx;
}

export function useTaxWorkflowOptional() {
  return useContext(TaxWorkflowContext);
}
