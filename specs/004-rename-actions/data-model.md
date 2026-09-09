# Data Model: Rename actions

## Changed entity: Action

One new column on the existing `action` table.

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `title_pinned` | boolean (INTEGER 0/1) | 0 | True once the user has saved a title edit. While true, extraction/reconciliation MUST NOT overwrite `title`. |

No change to `title` itself (existing `TEXT NOT NULL`).

### Migration

`backend/src/db/migrations/003_rename_actions.sql`:

```sql
ALTER TABLE action ADD COLUMN title_pinned INTEGER NOT NULL DEFAULT 0;
```

Applied once via the `schema_migrations` ledger (idempotent by filename).

### Validation rules

- On update, a `title` that is empty or whitespace-only is rejected; the stored
  title is unchanged (FR-003).
- Saving a non-blank `title` sets `title_pinned = 1` (FR-004).

### State transitions

- `title_pinned` moves 0 → 1 when the user saves a title edit.
- It stays 1 thereafter (v1 has no "un-pin" / revert-to-AI-title action).
- A split-off action is inserted fresh with `title_pinned = 0` and its own
  extracted title (spec Assumptions); the kept action retains its `title_pinned`
  state.

### Reconcile interaction

- Merge branch: when folding a candidate into an existing open action, the
  title is left unchanged if `title_pinned = 1`. (Today the merge branch does
  not overwrite `title` at all via `setDigestFields`; this flag additionally
  guards any future title update and documents the intent — see contracts.)
