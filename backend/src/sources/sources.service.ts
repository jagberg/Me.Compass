import { Injectable, Logger } from "@nestjs/common";
import { ClaudeCliService } from "../claude/claude-cli.service";
import { ActionsRepository } from "../actions/actions.repository";
import { SourceConnectionRepository } from "./source-connection.repository";
import { GmailClient } from "./gmail.client";
import { DriveClient } from "./drive.client";
import { ChatClient } from "./chat.client";
import { ReconcileService, Candidate, ReconcileResult } from "./reconcile.service";
import { JiraService } from "../jira/jira.service";
import { mapWithConcurrency } from "../util/concurrency";
import { ConnectionSourceType, SourceType } from "../types";

// How many per-item `claude` extraction calls to run at once. Each is a heavy subprocess, so keep
// this modest - enough to cut wall-clock on a backlog, not so many it thrashes the machine.
const EXTRACT_CONCURRENCY = 4;

const SOURCE_LABEL: Record<ConnectionSourceType, string> = {
  gmail: "email",
  drive: "meeting notes",
  chat: "chat message",
};
const ACTION_SOURCE_TYPE: Record<ConnectionSourceType, SourceType> = {
  gmail: "email",
  drive: "meeting",
  chat: "chat",
};
const ALL_SOURCES: ConnectionSourceType[] = ["gmail", "drive", "chat"];

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    private readonly claude: ClaudeCliService,
    private readonly actionsRepo: ActionsRepository,
    private readonly connectionsRepo: SourceConnectionRepository,
    private readonly gmail: GmailClient,
    private readonly drive: DriveClient,
    private readonly chatClient: ChatClient,
    private readonly reconcile: ReconcileService,
    private readonly jira: JiraService,
  ) {}

  private clientFor(type: ConnectionSourceType) {
    return { gmail: this.gmail, drive: this.drive, chat: this.chatClient }[type];
  }

  /**
   * Fetches + extracts one source into candidates, reporting which conversations were read in full
   * (non-truncated) for stale gating, plus a `syncedAt` cursor the caller advances only AFTER
   * reconciliation has persisted. On error, marks the connection and returns no candidates - and no
   * fully-read URLs, so a mid-extraction failure can never stale-flag that source's actions.
   */
  private async collect(
    type: ConnectionSourceType,
  ): Promise<{ candidates: Candidate[]; ok: boolean; fullyRead: string[]; syncedAt: string }> {
    const connection = this.connectionsRepo.getOne(type);
    const syncedAt = new Date().toISOString();
    try {
      const rawItems = await this.clientFor(type).fetchSince(connection?.last_synced_at ?? null);
      // Extract items with bounded concurrency (results stay in input order). A single failing
      // item still rejects the batch, so the source flips to error and its cursor holds - the same
      // all-or-nothing guarantee the prior sequential loop gave.
      const extractedPerItem = await mapWithConcurrency(rawItems, EXTRACT_CONCURRENCY, (item) =>
        this.claude.extractActions(item.rawText, SOURCE_LABEL[type]),
      );
      const candidates: Candidate[] = [];
      const fullyRead: string[] = [];
      rawItems.forEach((item, i) => {
        // Only a fully-read conversation is eligible for stale gating (FR-018).
        if (!item.truncated) fullyRead.push(item.sourceUrl);
        for (const action of extractedPerItem[i]) {
          candidates.push({
            extracted: action,
            source_type: ACTION_SOURCE_TYPE[type],
            source_url: item.sourceUrl,
          });
        }
      });
      // Mark connected but do NOT advance the cursor yet; that happens once reconcile persists.
      this.connectionsRepo.upsert(type, { status: "connected", last_error: null });
      return { candidates, ok: true, fullyRead, syncedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync failed for ${type}: ${message}`);
      this.connectionsRepo.upsert(type, { status: "error", last_error: message });
      return { candidates: [], ok: false, fullyRead: [], syncedAt };
    }
  }

  /** Sync one source through the reconcile pass. */
  async sync(type: ConnectionSourceType): Promise<ReconcileResult> {
    await this.reconcile.backfillOnce();
    const { candidates, ok, fullyRead, syncedAt } = await this.collect(type);
    if (!ok && candidates.length === 0) {
      // Preserve prior behaviour of surfacing the error to the caller.
      const conn = this.connectionsRepo.getOne(type);
      throw new Error(conn?.last_error ?? `Sync failed for ${type}`);
    }
    const result = await this.reconcile.reconcile(candidates, new Set(fullyRead));
    // Reconcile persisted, so it is now safe to advance the cursor (never before).
    if (ok) this.connectionsRepo.upsert(type, { last_synced_at: syncedAt });
    await this.jira.reconcileApprovals(); // close/suppress approvals already handled in JIRA
    return result;
  }

  /** Sync every source, then reconcile once so duplicates collapse across sources (FR-002). */
  async syncAll(): Promise<ReconcileResult & { sources_read_ok: number; sources_failed: number }> {
    await this.reconcile.backfillOnce();
    const processed = new Set<string>();
    const all: Candidate[] = [];
    const succeeded: { type: ConnectionSourceType; syncedAt: string }[] = [];
    let ok = 0;
    let failed = 0;
    for (const type of ALL_SOURCES) {
      const res = await this.collect(type);
      all.push(...res.candidates);
      res.fullyRead.forEach((u) => processed.add(u));
      if (res.ok) {
        ok++;
        succeeded.push({ type, syncedAt: res.syncedAt });
      } else {
        failed++;
      }
    }
    const result = await this.reconcile.reconcile(all, processed);
    // Advance cursors only after reconcile persisted, and only for sources that read cleanly.
    for (const s of succeeded) this.connectionsRepo.upsert(s.type, { last_synced_at: s.syncedAt });
    await this.jira.reconcileApprovals(); // close/suppress approvals already handled in JIRA
    return { ...result, sources_read_ok: ok, sources_failed: failed };
  }
}
