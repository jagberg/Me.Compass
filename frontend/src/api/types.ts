export type SourceType = "email" | "chat" | "meeting" | "manual";
export type Status = "open" | "done" | "dismissed";
export type Priority = "high" | "medium" | "low";
export type ConnectionSourceType = "gmail" | "drive" | "chat";
export type ConnectionStatus = "not_connected" | "connected" | "error";

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
  requested_by: string | null;
  category_id: string | null;
  category_pinned: boolean;
  conflict: boolean;
  stale_review: boolean;
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

export interface CategoryGroup {
  category: Category | null;
  actions: Action[];
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
  status: "succeeded" | "failed";
  error: string | null;
  created_at: string;
}
