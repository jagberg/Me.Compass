-- Feature 005: chat action resolution detection. Snapshot of the ask a chat action was created
-- for, captured at creation/merge time, judged against later sync deltas. NULL for non-chat actions
-- and for pre-feature chat actions (they remain ineligible for resolution judgement).
ALTER TABLE action ADD COLUMN resolution_ask TEXT;
