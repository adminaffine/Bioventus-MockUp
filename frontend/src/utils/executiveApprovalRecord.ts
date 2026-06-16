import type { CCOIssue, CFOAlert } from "../services/api";
import { buildCcoHighValueApprovalQueue } from "./ccoDashboard";
import { buildCfoHighValueApprovalQueue } from "./cfoDashboard";

/** CFO executive approval: Alliance Health / ORD-029 chargeback (Pricing + Finance). */
export const EXECUTIVE_APPROVAL_CFO_ALERT_ID = "CFO-ALERT-002";

/** CCO executive approval: Central Hospital / ORD-028 multi-jurisdiction (Compliance + Tax). */
export const EXECUTIVE_APPROVAL_CCO_ISSUE_ID = "CCO-ISSUE-002";

/** Pricing persona high-value issue (linked to CFO-ALERT-002). */
export const EXECUTIVE_APPROVAL_PRICING_ISSUE_ID = "PRK-ISS-012";

/** Tax persona high-value issue (linked to CCO-ISSUE-002). */
export const EXECUTIVE_APPROVAL_TAX_ISSUE_ID = "TAX-ISS-011";

/** VP persona high-value issues (linked to CFO/CCO executive approvals). */
export const EXECUTIVE_APPROVAL_VP_142K_ISSUE_ID = "VP-ISS-002";
export const EXECUTIVE_APPROVAL_VP_156K_ISSUE_ID = "VP-ISS-003";

/** Linked executive records — approving one updates KPIs across personas. */
export const HIGH_VALUE_LINKED_GROUPS: readonly (readonly string[])[] = [
  [EXECUTIVE_APPROVAL_CFO_ALERT_ID, EXECUTIVE_APPROVAL_PRICING_ISSUE_ID, EXECUTIVE_APPROVAL_VP_142K_ISSUE_ID],
  [EXECUTIVE_APPROVAL_CCO_ISSUE_ID, EXECUTIVE_APPROVAL_TAX_ISSUE_ID, EXECUTIVE_APPROVAL_VP_156K_ISSUE_ID],
];

export function isExecutiveHighValueRecord(recordId: string): boolean {
  return HIGH_VALUE_LINKED_GROUPS.some((group) => group.includes(recordId));
}

export type ExecutiveApprovalRow = {
  id: string;
  issueId: string;
  customerName: string;
  issueType: string;
  exposure: number;
};

export function pickCfoExecutiveApprovalRecord(
  fromApi: CFOAlert[] | undefined,
  openAlerts: CFOAlert[],
): CFOAlert | null {
  return buildCfoHighValueApprovalQueue(fromApi, openAlerts, 1)[0] ?? null;
}

export function pickCcoExecutiveApprovalRecord(
  fromApi: CCOIssue[] | undefined,
  openIssues: CCOIssue[],
): CCOIssue | null {
  return buildCcoHighValueApprovalQueue(fromApi, openIssues, 1)[0] ?? null;
}

export function cfoAlertToApprovalRow(alert: CFOAlert): ExecutiveApprovalRow {
  return {
    id: alert.alert_id,
    issueId: alert.alert_id,
    customerName: alert.customer_name?.trim() || alert.account_name,
    issueType: alert.issue_type,
    exposure: alert.dollar_exposure,
  };
}

export function ccoIssueToApprovalRow(issue: CCOIssue): ExecutiveApprovalRow {
  return {
    id: issue.issue_id,
    issueId: issue.issue_id,
    customerName: issue.account_name,
    issueType: issue.issue_type,
    exposure: issue.penalty_exposure,
  };
}
