import { Injectable, Logger } from "@nestjs/common";
import { getDb } from "../db/connection";
import { ActionsRepository } from "../actions/actions.repository";
import { MergeExceptionRepository } from "./merge-exception.repository";
import { CategoriesRepository } from "../categories/categories.repository";
import { ClaudeCliService, ExtractedAction } from "../claude/claude-cli.service";
import { MergedFromEntry, SourceType } from "../types";

export interface Candidate {
  extracted: ExtractedAction;
  source_type: SourceType;
  source_url: string | null;
}

export interface ReconcileResult {
  actions_created: number;
  actions_merged: number;
  actions_suppressed: number;
  stale_flagged: number;
}

/**
 * Turns a sync's candidate actions into persisted actions: de-duplicates by task identity,
 * suppresses previously-resolved asks, files unpinned actions into categories, records merge
 * snapshots, and (for successfully-read conversations only) flags open actions whose source
 * dropped them. See specs/003-action-digest/research.md.
 */
@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    private readonly actionsRepo: ActionsRepository,
    private readonly mergeExceptions: MergeExceptionRepository,
    private readonly categoriesRepo: CategoriesRepository,
    private readonly claude: ClaudeCliService,
  ) {}

  private snapshot(c: Candidate): MergedFromEntry {
    return {
      title: c.extracted.title,
      description: c.extracted.description,
      due_date: c.extracted.due_date,
      due_date_inferred: c.extracted.due_date_inferred,
      priority: c.extracted.priority,
      suggested_next_step: c.extracted.suggested_next_step,
      requested_by: c.extracted.requested_by,
      source_type: c.source_type,
      source_url: c.source_url,
      dedup_key: c.extracted.dedup_key,
    };
  }

  async reconcile(candidates: Candidate[], processedConversations: Set<string>): Promise<ReconcileResult> {
    const categories = this.categoriesRepo.list().map((c) => ({ id: c.id, name: c.name, rule: c.rule }));
    let created = 0;
    let merged = 0;
    let suppressed = 0;

    // Group by non-null identity; null keys stay distinct (never collapse).
    const byKey = new Map<string, Candidate[]>();
    const distinct: Candidate[] = [];
    for (const c of candidates) {
      const k = c.extracted.dedup_key;
      if (k) {
        const g = byKey.get(k);
        if (g) g.push(c);
        else byKey.set(k, [c]);
      } else {
        distinct.push(c);
      }
    }

    const groups: { primary: Candidate; absorbed: Candidate[] }[] = [];
    for (const group of byKey.values()) {
      groups.push({ primary: group[0], absorbed: group.slice(1) });
    }
    for (const c of distinct) groups.push({ primary: c, absorbed: [] });

    for (const { primary, absorbed } of groups) {
      const key = primary.extracted.dedup_key;
      const existingOpen = key ? this.actionsRepo.findOpenByDedupKey(key) : undefined;
      const snapshots = absorbed.map((a) => this.snapshot(a));

      // Resolved-task suppression: identity already done/dismissed AND no open survivor -> do not
      // recreate. Checking the open survivor first is essential: backfill consolidates duplicate
      // open rows by dismissing all but one while KEEPING the shared dedup_key, so a bare
      // hasResolved() check would suppress every future candidate for a task that is still open.
      if (!existingOpen && key && this.actionsRepo.hasResolvedByDedupKey(key)) {
        suppressed++;
        continue;
      }

      if (existingOpen && !this.mergeExceptions.forbids(key ?? "", existingOpen.dedup_key ?? "")) {
        // Fold into the existing open action; keep its manual edits and category pin.
        // Flag (do not silently drop) a content conflict: the source now gives a different
        // due date or priority than the open action holds. We keep the existing values so a
        // user edit is never clobbered; the divergent value is preserved in merged_from (FR-012).
        const conflict = existingOpen.conflict || this.divergesFromOpen(existingOpen, [primary, ...absorbed]);
        const mf = [...(existingOpen.merged_from ?? []), this.snapshot(primary), ...snapshots];
        this.actionsRepo.setDigestFields(existingOpen.id, {
          requested_by: existingOpen.requested_by ?? primary.extracted.requested_by,
          dedup_key: key,
          merged_from: mf.length ? mf : null,
          category_id: existingOpen.category_id,
          category_pinned: existingOpen.category_pinned,
          conflict,
          stale_review: false, // it reappeared this sync, so not stale
          // A user rename is authoritative: keep the existing title and its pinned flag. The merge
          // never writes `title`, so a pinned title is preserved either way (FR-004, FR-005).
          title_pinned: existingOpen.title_pinned,
        });
        merged += 1 + absorbed.length;
        continue;
      }

      // New action.
      const category_id = await this.classify(primary, categories);
      this.actionsRepo.insert({
        title: primary.extracted.title,
        description: primary.extracted.description,
        source_type: primary.source_type,
        source_url: primary.source_url,
        due_date: primary.extracted.due_date,
        due_date_inferred: primary.extracted.due_date_inferred,
        priority: primary.extracted.priority,
        suggested_next_step: primary.extracted.suggested_next_step,
        requested_by: primary.extracted.requested_by,
        dedup_key: key,
        merged_from: snapshots.length ? snapshots : null,
        category_id,
      });
      created++;
      merged += absorbed.length;
    }

    const stale_flagged = this.flagStale(candidates, processedConversations);

    return { actions_created: created, actions_merged: merged, actions_suppressed: suppressed, stale_flagged };
  }

  /**
   * FR-019: one-time backfill of the pre-feature backlog. Derives dedup_key + requester for
   * existing actions with none, then consolidates open duplicates, preserving each survivor's
   * manual edits and status. Guarded via a marker in schema_migrations so it runs once.
   */
  async backfillOnce(): Promise<void> {
    const db = getDb();
    const marker = "backfill:003-action-digest";
    if (db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(marker)) return;

    const all = [...this.actionsRepo.listByStatus("open"), ...this.actionsRepo.listByStatus("done"), ...this.actionsRepo.listByStatus("dismissed")];
    let allDerived = true;
    for (const a of all) {
      if (a.dedup_key) continue;
      try {
        const { dedup_key, requested_by } = await this.claude.deriveIdentity(a.title, a.description);
        this.actionsRepo.setDigestFields(a.id, { dedup_key, requested_by: a.requested_by ?? requested_by });
      } catch (e) {
        allDerived = false; // leave the marker unwritten so the next sync retries this row
        this.logger.warn(`backfill identity failed for ${a.id}: ${(e as Error).message}`);
      }
    }

    // Consolidate open duplicates by derived key, keeping the survivor's manual edits/status.
    const openByKey = new Map<string, string[]>();
    for (const a of this.actionsRepo.listByStatus("open")) {
      if (!a.dedup_key) continue;
      const g = openByKey.get(a.dedup_key);
      if (g) g.push(a.id);
      else openByKey.set(a.dedup_key, [a.id]);
    }
    for (const ids of openByKey.values()) {
      if (ids.length < 2) continue;
      const survivor = this.actionsRepo.getById(ids[0]);
      if (!survivor) continue;
      const snapshots: MergedFromEntry[] = [];
      for (const dupId of ids.slice(1)) {
        const dup = this.actionsRepo.getById(dupId);
        if (!dup) continue;
        snapshots.push({
          title: dup.title,
          description: dup.description,
          due_date: dup.due_date,
          due_date_inferred: dup.due_date_inferred,
          priority: dup.priority,
          suggested_next_step: dup.suggested_next_step,
          requested_by: dup.requested_by,
          source_type: dup.source_type,
          source_url: dup.source_url,
          dedup_key: dup.dedup_key,
          category_id: dup.category_id,
        });
        this.actionsRepo.update(dupId, { status: "dismissed", resolved_at: new Date().toISOString() } as never);
      }
      this.actionsRepo.setDigestFields(survivor.id, {
        merged_from: [...(survivor.merged_from ?? []), ...snapshots],
      });
    }

    // File the existing backlog into categories: pre-feature actions were never run through the
    // reconcile classifier, so they all sit in Uncategorised. Classify each open, unpinned,
    // still-unfiled action once here. Failures are non-fatal (unmatched stays Uncategorised, which
    // is valid) and do not block the marker.
    const categories = this.categoriesRepo.list().map((c) => ({ id: c.id, name: c.name, rule: c.rule }));
    if (categories.length) {
      for (const a of this.actionsRepo.listByStatus("open")) {
        if (a.category_id || a.category_pinned) continue;
        try {
          const category_id = await this.claude.classifyCategory(a.title, a.description, categories);
          if (category_id) this.actionsRepo.setDigestFields(a.id, { category_id });
        } catch (e) {
          this.logger.warn(`backfill classify failed for ${a.id}: ${(e as Error).message}`);
        }
      }
    }

    // Only mark the one-shot backfill done when every row got an identity; otherwise a row that
    // timed out or returned bad output would keep a null key forever (later syncs skip backfill).
    if (allDerived) {
      db.prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        marker,
        new Date().toISOString(),
      );
    }
  }

  /** FR-012: a merge conflicts when incoming evidence gives a different non-null due date or priority. */
  private divergesFromOpen(existing: { due_date: string | null; priority: string | null }, incoming: Candidate[]): boolean {
    return incoming.some((c) => {
      const d = c.extracted.due_date;
      const p = c.extracted.priority;
      return (
        (!!d && !!existing.due_date && d !== existing.due_date) ||
        (!!p && !!existing.priority && p !== existing.priority)
      );
    });
  }

  private async classify(
    primary: Candidate,
    categories: { id: string; name: string; rule: string }[],
  ): Promise<string | null> {
    try {
      return await this.claude.classifyCategory(primary.extracted.title, primary.extracted.description, categories);
    } catch (e) {
      this.logger.warn(`category classify failed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * FR-014/FR-018: for open actions whose source conversation was read successfully this sync
   * but whose identity is absent from the new candidates, flag possibly-resolved. Never auto-close,
   * never flag from a conversation that was not successfully read.
   */
  private flagStale(candidates: Candidate[], processedConversations: Set<string>): number {
    const seenKeys = new Set(candidates.map((c) => c.extracted.dedup_key).filter(Boolean) as string[]);
    let flagged = 0;
    for (const action of this.actionsRepo.listByStatus("open")) {
      if (!action.dedup_key || action.stale_review) continue;
      const conv = action.source_url ?? "";
      if (!processedConversations.has(conv)) continue; // its source was not (fully) read this sync
      if (seenKeys.has(action.dedup_key)) continue; // still present
      this.actionsRepo.setDigestFields(action.id, { stale_review: true });
      flagged++;
    }
    return flagged;
  }
}
