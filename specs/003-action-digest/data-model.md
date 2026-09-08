# Phase 1 Data Model: Action Digest

New and changed persisted entities. SQLite via `node:sqlite`. All migration SQL runs through the
new `schema_migrations` ledger (see research.md) so column additions are applied once.

## New: `schema_migrations` (infrastructure)

Run-once tracking so `ALTER TABLE` and seed SQL don't re-execute every boot.

| Column | Type | Notes |
|---|---|---|
| version | TEXT | PK - the migration filename (e.g. `002_action_digest.sql`) |
| applied_at | TEXT | ISO timestamp |

`001_init.sql` is recorded as applied on first upgrade.

## New: `category`

A user-maintained grouping. Ordering on the board is computed from its actions' urgency, not
stored.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | PK (`randomUUID()` at insert, matching the action id strategy) |
| name | TEXT | Display name (e.g. "Software Renewals") |
| rule | TEXT | Free-text description of what belongs; applied by the local Claude CLI during filing |
| icon | TEXT NULL | Optional display glyph/colour hint |
| created_at | TEXT | ISO timestamp |

- "Uncategorised" is **not** a row here - it is the rendering of actions with `category_id IS
  NULL`.
- Deleting a category sets its actions' `category_id` to NULL (they return to Uncategorised),
  never deletes actions.
- A small starter set may be seeded via `INSERT OR IGNORE` in the migration.

## Changed: `action` (existing table, new columns)

Added via the ledgered migration. Existing columns unchanged (see
`specs/001-personal-action-manager/data-model.md`).

| New column | Type | Notes |
|---|---|---|
| requested_by | TEXT NULL | Who is asking - a person's name or a role. NULL for manual actions (FR-004) |
| category_id | TEXT NULL | FK → `category.id`; NULL = Uncategorised (FR-006). ON DELETE SET NULL semantics enforced in app code |
| dedup_key | TEXT NULL | Normalised subject/intent signature emitted by the extractor; anchors merge matching (FR-002). A NULL key NEVER matches another candidate - reconcile treats NULL as "no signature", so two NULL-key items stay distinct and are never collapsed |
| merged_from | TEXT NULL | JSON array of content SNAPSHOTS of each absorbed candidate - each entry holds `{title, description, due_date, priority, suggested_next_step, requested_by, source_type, source_url}`, not just an id - so `split` (FR-013) can re-insert a folded task from its snapshot without re-fetching |
| conflict | INTEGER NULL | 0/1 (SQLite has no boolean). Set (1) when this action holds an unresolved content conflict to decide (FR-012). Coerced on read (`Boolean(row.conflict)`) and on write (`false -> 0/NULL`), the same way `due_date_inferred` is already handled |
| stale_review | INTEGER NULL | 0/1. Set (1) by reconcile when a re-synced source no longer yields a matching candidate for this open action, flagging it as possibly-resolved for the user to confirm - never auto-closed (FR-014, Principle IV) |

Field-add checklist (per exploration map): the INSERT column list, the `toAction` mapper (with
`Boolean()` coercion for `conflict`/`stale_review`), and the `Action` interface must all gain
these fields together. Re-filing and conflict/stale resolution ALSO require widening the actual
`UPDATE action SET ...` statement in `actions.repository.ts` (not only the `Pick` whitelist
type), the `Pick` in `actions.service.ts`, and the controller body type - miss any one and a
`PATCH` returns 200 but never persists.

## Conceptual (not persisted separately)

- **Requester**: carried on `action.requested_by`; no own table.
- **Merge relationship**: carried on `action.dedup_key` + `action.merged_from`; no join table -
  a merged action is one row that remembers (as content snapshots) what it absorbed.

## Validation rules (from requirements)

- Every synced (non-manual) action must have `requested_by` set to a name or role (SC-002).
- Every action is reachable: either `category_id` points to a live category, or it renders in
  Uncategorised (SC-003).
- A non-NULL `dedup_key` collision among candidates collapses to one surviving action unless a
  conflict is detected, in which case both are kept and `conflict` is set (FR-002, FR-012). NULL
  keys never collide.
- Auto-filing sets `category_id` ONLY when it is currently NULL; an action whose `category_id`
  is already set (by auto-filing or a user re-file) is not re-filed on later syncs, so a user
  re-file survives (FR-007, SC-005).

## State transitions

- Action `status` unchanged (open -> done/dismissed) from feature 001.
- `category_id`: NULL (Uncategorised) -> set once by filing OR user re-file -> only changes again
  on a user re-file; survives subsequent syncs (SC-005).
- `conflict`: set during reconcile -> cleared by the user resolving it (a `PATCH`).
- `stale_review`: set during reconcile when a re-synced source drops this action's candidate ->
  cleared when the user confirms done/dismissed (never auto-closed) (FR-014).
