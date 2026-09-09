-- Action digest: categories, merge exceptions, and new action columns.
-- Runs once via the schema_migrations ledger, so the non-idempotent ALTER TABLE calls are safe.

CREATE TABLE IF NOT EXISTS category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rule TEXT NOT NULL,
  icon TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merge_exception (
  key_a TEXT NOT NULL,
  key_b TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (key_a, key_b)
);

ALTER TABLE action ADD COLUMN requested_by TEXT;
ALTER TABLE action ADD COLUMN category_id TEXT;
ALTER TABLE action ADD COLUMN dedup_key TEXT;
ALTER TABLE action ADD COLUMN merged_from TEXT;
ALTER TABLE action ADD COLUMN conflict INTEGER;
ALTER TABLE action ADD COLUMN stale_review INTEGER;
ALTER TABLE action ADD COLUMN category_pinned INTEGER;

CREATE INDEX IF NOT EXISTS idx_action_dedup_key ON action (dedup_key);

-- Starter taxonomy (the user maintains this over time). Fixed ids so re-seeds are no-ops.
INSERT OR IGNORE INTO category (id, name, rule, icon, created_at) VALUES
  ('cat-renewals',   'Software Renewals',     'vendor renewals, licences, subscriptions',        '$',  '2026-09-08T00:00:00.000Z'),
  ('cat-timesheets', 'Timesheets',            'payroll and timesheet approvals',                 NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-change',     'Change Requests',       'CM- tickets, IT change approvals, CR process',    NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-recruitment','Recruitment',           'offers, candidates, backfills',                   NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-events',     'Company Events',        'All Hands, R U OK Day, socials',                  NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-showcase',   'Showcase & Demos',      'showcase prep, release content, agendas',         NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-health',     'Health Product',        'Health app and PDF features',                     NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-security',   'Security & Compliance', 'ISMS, controls, audits',                          NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-migrations', 'Migrations',            'Salesforce / SFMC, platform moves',               NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-team',       'Team Management',       'feedback, training, resourcing',                  NULL, '2026-09-08T00:00:00.000Z'),
  ('cat-content',    'Content & Brand',       'content updates, brand assets',                   NULL, '2026-09-08T00:00:00.000Z');
