import { apiFetch } from "./client";
import { SourceConnection } from "./types";

export function getSources(): Promise<SourceConnection[]> {
  return apiFetch(`/sources`);
}

export function triggerSync(type: string): Promise<{ source: SourceConnection; actions_created: number }> {
  return apiFetch(`/sources/${type}/sync`, { method: "POST" });
}

// Ceiling for a single sync-all before the UI stops waiting (the backend keeps going). Generous so a
// normal backlog completes; short enough that a genuine wedge eventually releases the button.
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;

export function syncAll(): Promise<{
  actions_created: number;
  actions_merged: number;
  actions_suppressed: number;
  stale_flagged: number;
  sources_read_ok: number;
  sources_failed: number;
}> {
  return apiFetch(`/sources/sync-all`, { method: "POST" }, SYNC_TIMEOUT_MS);
}
