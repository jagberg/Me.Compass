import { apiFetch } from "./client";
import { SourceConnection } from "./types";

export function getSources(): Promise<SourceConnection[]> {
  return apiFetch(`/sources`);
}

export function triggerSync(type: string): Promise<{ source: SourceConnection; actions_created: number }> {
  return apiFetch(`/sources/${type}/sync`, { method: "POST" });
}
