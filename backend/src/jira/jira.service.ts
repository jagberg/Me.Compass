import { Injectable, Logger } from "@nestjs/common";
import { ActionsRepository } from "../actions/actions.repository";
import { JiraClient } from "./jira.client";

export interface JiraReconcileResult {
  configured: boolean;
  checked: number;
  closed: number;
  suppressed: number;
}

// A ticket key like CM-391, ISMS64, SEC-12.
const KEY_RE = /\b([A-Z]{2,}-?\d+)\b/;

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);

  constructor(
    private readonly client: JiraClient,
    private readonly actionsRepo: ActionsRepository,
  ) {}

  /**
   * Reconcile approval-gated actions against JIRA. For each open action that asks the user to
   * approve a ticket:
   *   - ticket resolved, or the user already approved  -> mark done
   *   - the ticket has approvers and the user is NOT one -> dismiss (not their queue)
   *   - the user is a pending approver                   -> leave it open
   * Errors and "not found" are non-fatal and never suppress (fail safe: keep the action).
   */
  async reconcileApprovals(): Promise<JiraReconcileResult> {
    if (!this.client.isConfigured()) return { configured: false, checked: 0, closed: 0, suppressed: 0 };
    let checked = 0;
    let closed = 0;
    let suppressed = 0;
    for (const a of this.actionsRepo.listByStatus("open")) {
      const text = `${a.title} ${a.description}`;
      if (!/approv/i.test(text)) continue; // only approval-gated actions
      const m = text.match(KEY_RE);
      if (!m) continue;
      let state;
      try {
        state = await this.client.getApprovalState(m[1]);
      } catch (e) {
        this.logger.warn(`JIRA lookup failed for ${m[1]}: ${(e as Error).message}`);
        continue;
      }
      if (!state) continue;
      checked++;
      const now = new Date().toISOString();
      if (state.resolved || state.userDecision === "approved") {
        this.actionsRepo.update(a.id, { status: "done", resolved_at: now });
        closed++;
      } else if (state.hasApprovals && !state.isApprover) {
        this.actionsRepo.update(a.id, { status: "dismissed", resolved_at: now });
        suppressed++;
      }
      // else: the user is a pending approver -> the ask is genuinely theirs, keep it.
    }
    this.logger.log(`JIRA approval reconcile: checked ${checked}, closed ${closed}, suppressed ${suppressed}`);
    return { configured: true, checked, closed, suppressed };
  }
}
