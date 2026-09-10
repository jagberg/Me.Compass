export type SourceType = "email" | "chat" | "meeting" | "manual";
export type Status = "open" | "done" | "dismissed";
export type Priority = "high" | "medium" | "low";
export type ConnectionSourceType = "gmail" | "drive" | "chat";
export type ConnectionStatus = "not_connected" | "connected" | "error";
export type RunStatus = "succeeded" | "failed";

/** A content snapshot of a candidate folded into a merged action, enough to rebuild it on split. */
export interface MergedFromEntry {
  title: string;
  description: string;
  due_date: string | null;
  due_date_inferred?: boolean;
  priority: Priority | null;
  suggested_next_step: string | null;
  requested_by: string | null;
  source_type: SourceType;
  source_url: string | null;
  dedup_key: string | null;
  category_id?: string | null;
}

export interface Action {
  id: string;
  title: string;
  description: string;
  source_type: SourceType;
  source_url: string | null;
  status: Status;
  due_date: string | null;
  due_date_inferred: boolean;
  priority: Priority | null;
  suggested_next_step: string | null;
  created_at: string;
  resolved_at: string | null;
  // Action-digest fields (feature 003)
  requested_by: string | null;
  category_id: string | null;
  category_pinned: boolean;
  dedup_key: string | null;
  merged_from: MergedFromEntry[] | null;
  conflict: boolean;
  stale_review: boolean;
  // True once the user has edited the title; protects it from extraction/reconcile overwrite (feature 004).
  title_pinned: boolean;
  // Derived at read time (not stored): where to go to action this item, for the play button.
  action_url?: string;
  action_target?: string;
}

export interface Category {
  id: string;
  name: string;
  rule: string;
  icon: string | null;
  created_at: string;
}

export interface SourceConnection {
  source_type: ConnectionSourceType;
  status: ConnectionStatus;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface RunResult {
  id: string;
  action_id: string;
  content: string;
  status: RunStatus;
  error: string | null;
  created_at: string;
}
