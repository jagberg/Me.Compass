import { Injectable, Logger } from "@nestjs/common";
import { getAppConfig } from "../config";

/**
 * Local-first JIRA access: reads a personal API token from the root .env (JIRA_EMAIL /
 * JIRA_API_TOKEN / JIRA_ACCOUNT_ID / JIRA_BASE_URL) via getAppConfig and calls the Cloud REST API
 * with Basic auth. No token, no calls - every consumer treats "not configured" as "do nothing",
 * so the app runs fine without it.
 */
export interface JiraApprovalState {
  key: string;
  status: string | null;
  /** Ticket is closed/resolved (statusCategory "done" or a resolution is set). */
  resolved: boolean;
  /** The ticket has an approval process at all (a Change Request with an Approvals field). */
  hasApprovals: boolean;
  /** The configured user appears in the approver list of any approval round. */
  isApprover: boolean;
  /** The configured user's decision, if they have made one ("approved" | "declined" | null). */
  userDecision: string | null;
  /** At least one approval round is still awaiting decisions. */
  approvalOpen: boolean;
}

// JSM Change-Management approval object lives on this custom field on the CM project.
const APPROVALS_FIELD = "customfield_10116";

@Injectable()
export class JiraClient {
  private readonly logger = new Logger(JiraClient.name);

  isConfigured(): boolean {
    return !!getAppConfig().jira;
  }

  /** Fetches a ticket's approval state, or null when not configured / not found. Throws on real errors. */
  async getApprovalState(key: string): Promise<JiraApprovalState | null> {
    const c = getAppConfig().jira;
    if (!c) return null;
    const url = `${c.baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}?fields=status,resolution,${APPROVALS_FIELD}`;
    const auth = Buffer.from(`${c.email}:${c.apiToken}`).toString("base64");
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`JIRA ${key}: HTTP ${res.status}`);
    const data = (await res.json()) as { fields: Record<string, unknown> };
    const f = data.fields ?? {};
    const status = f.status as { name?: string; statusCategory?: { key?: string } } | undefined;
    const resolved = status?.statusCategory?.key === "done" || f.resolution != null;

    const approvals = (f[APPROVALS_FIELD] as ApprovalRound[] | null) ?? [];
    let isApprover = false;
    let userDecision: string | null = null;
    let approvalOpen = false;
    for (const round of approvals) {
      for (const a of round.approvers ?? []) {
        if (a.approver?.accountId === c.accountId) {
          isApprover = true;
          if (a.approverDecision && a.approverDecision !== "pending") userDecision = a.approverDecision;
        }
      }
      if (round.finalDecision === "pending") approvalOpen = true;
    }
    return { key, status: status?.name ?? null, resolved, hasApprovals: approvals.length > 0, isApprover, userDecision, approvalOpen };
  }
}

interface ApprovalRound {
  finalDecision?: string;
  approvers?: { approver?: { accountId?: string }; approverDecision?: string }[];
}
