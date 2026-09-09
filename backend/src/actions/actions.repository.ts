import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection";
import { Action, MergedFromEntry, SourceType, Status } from "../types";

type NewAction = Omit<
  Action,
  | "id"
  | "created_at"
  | "resolved_at"
  | "status"
  | "requested_by"
  | "category_id"
  | "category_pinned"
  | "dedup_key"
  | "merged_from"
  | "conflict"
  | "stale_review"
> & {
  status?: Status;
  requested_by?: string | null;
  category_id?: string | null;
  category_pinned?: boolean;
  dedup_key?: string | null;
  merged_from?: Action["merged_from"];
  conflict?: boolean;
  stale_review?: boolean;
};

function toAction(row: Record<string, unknown>): Action {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    source_type: row.source_type as SourceType,
    source_url: (row.source_url as string) ?? null,
    status: row.status as Status,
    due_date: (row.due_date as string) ?? null,
    due_date_inferred: Boolean(row.due_date_inferred),
    priority: (row.priority as Action["priority"]) ?? null,
    suggested_next_step: (row.suggested_next_step as string) ?? null,
    created_at: row.created_at as string,
    resolved_at: (row.resolved_at as string) ?? null,
    requested_by: (row.requested_by as string) ?? null,
    category_id: (row.category_id as string) ?? null,
    category_pinned: Boolean(row.category_pinned),
    dedup_key: (row.dedup_key as string) ?? null,
    merged_from: row.merged_from ? (JSON.parse(row.merged_from as string) as MergedFromEntry[]) : null,
    conflict: Boolean(row.conflict),
    stale_review: Boolean(row.stale_review),
  };
}

@Injectable()
export class ActionsRepository {
  insert(input: NewAction): Action {
    const db = getDb();
    const action: Action = {
      ...input,
      id: randomUUID(),
      status: input.status ?? "open",
      created_at: new Date().toISOString(),
      resolved_at: null,
      requested_by: input.requested_by ?? null,
      category_id: input.category_id ?? null,
      category_pinned: input.category_pinned ?? false,
      dedup_key: input.dedup_key ?? null,
      merged_from: input.merged_from ?? null,
      conflict: input.conflict ?? false,
      stale_review: input.stale_review ?? false,
    };
    db.prepare(
      `INSERT INTO action
        (id, title, description, source_type, source_url, status, due_date, due_date_inferred, priority, suggested_next_step, created_at, resolved_at,
         requested_by, category_id, category_pinned, dedup_key, merged_from, conflict, stale_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      action.id,
      action.title,
      action.description,
      action.source_type,
      action.source_url,
      action.status,
      action.due_date,
      action.due_date_inferred ? 1 : 0,
      action.priority,
      action.suggested_next_step,
      action.created_at,
      action.resolved_at,
      action.requested_by,
      action.category_id,
      action.category_pinned ? 1 : 0,
      action.dedup_key,
      action.merged_from ? JSON.stringify(action.merged_from) : null,
      action.conflict ? 1 : 0,
      action.stale_review ? 1 : 0,
    );
    return action;
  }

  list(status?: Status): Action[] {
    const db = getDb();
    const rows = status
      ? db.prepare("SELECT * FROM action WHERE status = ? ORDER BY due_date IS NULL, due_date ASC").all(status)
      : db.prepare("SELECT * FROM action ORDER BY due_date IS NULL, due_date ASC").all();
    return rows.map((r) => toAction(r as Record<string, unknown>));
  }

  getById(id: string): Action | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM action WHERE id = ?").get(id);
    return row ? toAction(row as Record<string, unknown>) : undefined;
  }

  findOpenByDedupKey(key: string): Action | undefined {
    if (!key) return undefined;
    const db = getDb();
    const row = db.prepare("SELECT * FROM action WHERE status = 'open' AND dedup_key = ?").get(key);
    return row ? toAction(row as Record<string, unknown>) : undefined;
  }

  /** True when a done/dismissed action already exists for this identity (resolved-task suppression). */
  hasResolvedByDedupKey(key: string): boolean {
    if (!key) return false;
    const db = getDb();
    return Boolean(
      db.prepare("SELECT 1 FROM action WHERE status IN ('done','dismissed') AND dedup_key = ?").get(key),
    );
  }

  listByStatus(status: Status): Action[] {
    return this.list(status);
  }

  update(
    id: string,
    fields: Partial<
      Pick<
        Action,
        | "due_date"
        | "priority"
        | "status"
        | "due_date_inferred"
        | "resolved_at"
        | "category_id"
        | "category_pinned"
        | "conflict"
        | "stale_review"
      >
    >,
  ): Action | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...fields };
    const db = getDb();
    db.prepare(
      `UPDATE action SET due_date = ?, priority = ?, status = ?, due_date_inferred = ?, resolved_at = ?,
         category_id = ?, category_pinned = ?, conflict = ?, stale_review = ? WHERE id = ?`,
    ).run(
      merged.due_date,
      merged.priority,
      merged.status,
      merged.due_date_inferred ? 1 : 0,
      merged.resolved_at,
      merged.category_id,
      merged.category_pinned ? 1 : 0,
      merged.conflict ? 1 : 0,
      merged.stale_review ? 1 : 0,
      id,
    );
    return this.getById(id);
  }

  /** Persists new digest fields on an action (used by reconcile: dedup_key, requester, category, merged_from). */
  setDigestFields(
    id: string,
    fields: Partial<
      Pick<Action, "requested_by" | "category_id" | "category_pinned" | "dedup_key" | "merged_from" | "conflict" | "stale_review">
    >,
  ): void {
    const existing = this.getById(id);
    if (!existing) return;
    const merged = { ...existing, ...fields };
    const db = getDb();
    db.prepare(
      `UPDATE action SET requested_by = ?, category_id = ?, category_pinned = ?, dedup_key = ?, merged_from = ?, conflict = ?, stale_review = ? WHERE id = ?`,
    ).run(
      merged.requested_by,
      merged.category_id,
      merged.category_pinned ? 1 : 0,
      merged.dedup_key,
      merged.merged_from ? JSON.stringify(merged.merged_from) : null,
      merged.conflict ? 1 : 0,
      merged.stale_review ? 1 : 0,
      id,
    );
  }
}
