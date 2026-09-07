CREATE TABLE IF NOT EXISTS action (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  due_date TEXT,
  due_date_inferred INTEGER NOT NULL DEFAULT 0,
  priority TEXT,
  suggested_next_step TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_action_status_due_date ON action (status, due_date);

CREATE TABLE IF NOT EXISTS source_connection (
  source_type TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'not_connected',
  last_synced_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS run_result (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES action(id),
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO source_connection (source_type, status) VALUES ('gmail', 'not_connected');
INSERT OR IGNORE INTO source_connection (source_type, status) VALUES ('drive', 'not_connected');
INSERT OR IGNORE INTO source_connection (source_type, status) VALUES ('chat', 'not_connected');
