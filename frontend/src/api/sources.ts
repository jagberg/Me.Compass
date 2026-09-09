import { apiFetch } from "./client";
import { SourceConnection } from "./types";

export function getSources(): Promise<SourceConnection[]> {
  return apiFetch(`/sources`);
}

export function triggerSync(type: string): Promise<{ source: SourceConnection; actions_created: number }> {
  return apiFetch(`/sources/${type}/sync`, { method: "POST" });
}

export function syncAll(): Promise<{
  actions_created: number;
  actions_merged: number;
  actions_suppressed: number;
  stale_flagged: number;
  sources_read_ok: number;
  sources_failed: number;
}> {
  return apiFetch(`/sources/sync-all`, { method: "POST" });
}
