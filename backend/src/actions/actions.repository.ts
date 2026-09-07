import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection";
import { Action, SourceType, Status } from "../types";

type NewAction = Omit<Action, "id" | "created_at" | "resolved_at" | "status"> & {
  status?: Status;
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
  };
}

@Injectable()
export class ActionsRepository {
  insert(input: NewAction): Action {
    const db = getDb();
    const action: Action = {
      id: randomUUID(),
      status: input.status ?? "open",
      created_at: new Date().toISOString(),
      resolved_at: null,
      ...input,
    };
    db.prepare(
      `INSERT INTO action
        (id, title, description, source_type, source_url, status, due_date, due_date_inferred, priority, suggested_next_step, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  update(id: string, fields: Partial<Pick<Action, "due_date" | "priority" | "status" | "due_date_inferred" | "resolved_at">>): Action | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...fields };
    const db = getDb();
    db.prepare(
      `UPDATE action SET due_date = ?, priority = ?, status = ?, due_date_inferred = ?, resolved_at = ? WHERE id = ?`,
    ).run(merged.due_date, merged.priority, merged.status, merged.due_date_inferred ? 1 : 0, merged.resolved_at, id);
    return this.getById(id);
  }
}
