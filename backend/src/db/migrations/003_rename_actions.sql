-- Rename actions (feature 004): a user-set title is authoritative and must not be
-- overwritten by extraction/reconciliation. Mirrors category_pinned.
ALTER TABLE action ADD COLUMN title_pinned INTEGER NOT NULL DEFAULT 0;
