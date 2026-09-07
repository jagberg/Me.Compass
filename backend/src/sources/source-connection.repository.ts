import { Injectable } from "@nestjs/common";
import { getDb } from "../db/connection";
import { ConnectionSourceType, ConnectionStatus, SourceConnection } from "../types";

function toConnection(row: Record<string, unknown>): SourceConnection {
  return {
    source_type: row.source_type as ConnectionSourceType,
    status: row.status as ConnectionStatus,
    last_synced_at: (row.last_synced_at as string) ?? null,
    last_error: (row.last_error as string) ?? null,
  };
}

@Injectable()
export class SourceConnectionRepository {
  getAll(): SourceConnection[] {
    const rows = getDb().prepare("SELECT * FROM source_connection").all();
    return rows.map((r) => toConnection(r as Record<string, unknown>));
  }

  getOne(sourceType: ConnectionSourceType): SourceConnection | undefined {
    const row = getDb().prepare("SELECT * FROM source_connection WHERE source_type = ?").get(sourceType);
    return row ? toConnection(row as Record<string, unknown>) : undefined;
  }

  upsert(sourceType: ConnectionSourceType, fields: Partial<Omit<SourceConnection, "source_type">>): void {
    const current = this.getOne(sourceType) ?? {
      source_type: sourceType,
      status: "not_connected" as ConnectionStatus,
      last_synced_at: null,
      last_error: null,
    };
    const merged = { ...current, ...fields };
    getDb()
      .prepare(
        `INSERT INTO source_connection (source_type, status, last_synced_at, last_error)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(source_type) DO UPDATE SET status = excluded.status, last_synced_at = excluded.last_synced_at, last_error = excluded.last_error`,
      )
      .run(sourceType, merged.status, merged.last_synced_at, merged.last_error);
  }
}
