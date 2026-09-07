import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection";
import { RunResult, RunStatus } from "../types";

function toRunResult(row: Record<string, unknown>): RunResult {
  return {
    id: row.id as string,
    action_id: row.action_id as string,
    content: row.content as string,
    status: row.status as RunStatus,
    error: (row.error as string) ?? null,
    created_at: row.created_at as string,
  };
}

@Injectable()
export class RunResultRepository {
  insert(actionId: string, content: string, status: RunStatus, error: string | null): RunResult {
    const result: RunResult = {
      id: randomUUID(),
      action_id: actionId,
      content,
      status,
      error,
      created_at: new Date().toISOString(),
    };
    getDb()
      .prepare(`INSERT INTO run_result (id, action_id, content, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(result.id, result.action_id, result.content, result.status, result.error, result.created_at);
    return result;
  }

  getLatestByActionId(actionId: string): RunResult | undefined {
    const row = getDb()
      .prepare("SELECT * FROM run_result WHERE action_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(actionId);
    return row ? toRunResult(row as Record<string, unknown>) : undefined;
  }
}
