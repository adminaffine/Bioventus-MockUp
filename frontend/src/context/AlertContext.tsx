import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../services/api";

export type AlertWorkflowState = "open" | "acknowledged" | "routed" | "resolved" | "overridden";

type AlertContextType = {
  alertCount: number;
  acknowledgeAlert: (id: string) => Promise<void>;
  transitionAlert: (id: string, toState: AlertWorkflowState, reason?: string) => Promise<boolean>;
  acknowledgedIds: Set<string>;
  workflowStates: Record<string, AlertWorkflowState>;
  refreshAlerts: () => Promise<void>;
};

const AlertContext = createContext<AlertContextType | null>(null);

export function AlertProvider({ children, totalAlerts = 18 }: { children: ReactNode; totalAlerts?: number }) {
  const [workflowStates, setWorkflowStates] = useState<Record<string, AlertWorkflowState>>({});
  const [totalKnownAlerts, setTotalKnownAlerts] = useState(totalAlerts);
  const acknowledgedIds = useMemo(
    () =>
      new Set(
        Object.entries(workflowStates)
          .filter(([, state]) => state !== "open")
          .map(([id]) => id)
      ),
    [workflowStates]
  );
  const openAlerts = Object.values(workflowStates).filter((s) => s === "open").length;
  const alertCount = Object.keys(workflowStates).length > 0 ? openAlerts : Math.max(0, totalKnownAlerts);

  const refreshAlerts = useCallback(async () => {
    const payload = await api.getAlerts();
    setTotalKnownAlerts(payload.total_alerts);
    const next: Record<string, AlertWorkflowState> = {};
    for (const alert of payload.alerts) {
      const state = (alert.workflow_state ?? "open") as AlertWorkflowState;
      next[alert.alert_id] = state;
    }
    setWorkflowStates(next);
  }, []);

  useEffect(() => {
    refreshAlerts().catch(() => undefined);
  }, []);

  const transitionAlert = useCallback(async (id: string, toState: AlertWorkflowState, reason?: string) => {
    try {
      const response = await api.transitionAlertWorkflow({
        alert_id: id,
        to_state: toState,
        actor_role: "system_user",
        reason,
      });
      if (!response.ok) return false;
      setWorkflowStates((prev) => ({ ...prev, [id]: toState }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const acknowledgeAlert = useCallback(async (id: string) => {
    await transitionAlert(id, "acknowledged");
  }, [transitionAlert]);

  const value = useMemo(
    () => ({ alertCount, acknowledgeAlert, acknowledgedIds, workflowStates, transitionAlert, refreshAlerts }),
    [alertCount, acknowledgeAlert, acknowledgedIds, refreshAlerts, transitionAlert, workflowStates]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be inside AlertProvider");
  return ctx;
}
