import { Injectable, Logger } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Local-first JIRA access: reads a personal API token from data/jira-credentials.json (gitignored,
 * same place as google-tokens.json) and calls the Cloud REST API with Basic auth. No token, no
 * calls - every consumer treats "not configured" as "do nothing", so the app runs fine without it.
 *
 * data/jira-credentials.json:
 * {
 *   "base_url": "https://compareclub.atlassian.net",
 *   "email": "justin.goldberg@compareclub.com.au",
 *   "api_token": "<Atlassian API token>",
 *   "account_id": "712020:1a402f1c-fb75-4d29-8b3e-cc1ced54cf51"
 * }
 */
export interface JiraCredentials {
  base_url: string;
  email: string;
  api_token: string;
  account_id: string;
}

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

const CREDS_PATH = process.env.DATA_DIR
  ? `${process.env.DATA_DIR}/jira-credentials.json`
  : "./data/jira-credentials.json";

// JSM Change-Management approval object lives on this custom field on the CM project.
const APPROVALS_FIELD = "customfield_10116";

@Injectable()
export class JiraClient {
  private readonly logger = new Logger(JiraClient.name);
  private cached: JiraCredentials | null | undefined;

  private creds(): JiraCredentials | null {
    if (this.cached !== undefined) return this.cached;
    try {
      const path = join(process.cwd(), CREDS_PATH);
      this.cached = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as JiraCredentials) : null;
    } catch (e) {
      this.logger.warn(`could not read JIRA credentials: ${(e as Error).message}`);
      this.cached = null;
    }
    return this.cached;
  }

  isConfigured(): boolean {
    const c = this.creds();
    return !!(c && c.base_url && c.email && c.api_token && c.account_id);
  }

  /** Fetches a ticket's approval state, or null when not configured / not found. Throws on real errors. */
  async getApprovalState(key: string): Promise<JiraApprovalState | null> {
    const c = this.creds();
    if (!c || !this.isConfigured()) return null;
    const url = `${c.base_url}/rest/api/3/issue/${encodeURIComponent(key)}?fields=status,resolution,${APPROVALS_FIELD}`;
    const auth = Buffer.from(`${c.email}:${c.api_token}`).toString("base64");
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
        if (a.approver?.accountId === c.account_id) {
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
