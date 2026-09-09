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
| stale_review | INTEGER NULL | 0/1. Set (1) by reconcile when a SUCCESSFULLY and fully read source no longer yields a matching candidate for this open action, flagging it possibly-resolved for the user to confirm - never auto-closed, and never set from a failed/truncated read (FR-014, FR-018, Principle IV) |
| category_pinned | INTEGER NULL | 0/1. Set (1) when the user explicitly assigns a category - INCLUDING explicitly choosing Uncategorised (pinned with `category_id` NULL). Auto-filing only touches actions where this is not set, so an explicit choice survives later syncs (FR-020) |

Field-add checklist (per exploration map): the INSERT column list, the `toAction` mapper (with
`Boolean()` coercion for `conflict`/`stale_review`/`category_pinned`), and the `Action` interface must all gain
these fields together. Re-filing and conflict/stale resolution ALSO require widening the actual
`UPDATE action SET ...` statement in `actions.repository.ts` (not only the `Pick` whitelist
type), the `Pick` in `actions.service.ts`, and the controller body type - miss any one and a
`PATCH` returns 200 but never persists.

## New: `merge_exception`

Remembers a user's separation decision so a wrongly-merged pair is not re-merged (FR-017).

| Column | Type | Notes |
|---|---|---|
| key_a | TEXT | One task identity (`dedup_key`) of the separated pair |
| key_b | TEXT | The other task identity |
| created_at | TEXT | ISO timestamp |

- Stored as an unordered pair (normalise so `key_a <= key_b`); PK on `(key_a, key_b)`.
- Reconcile MUST NOT merge two candidates whose identities form a listed exception, even when
  their `dedup_key`s match (a legitimate case: the extractor mints the same key for two genuinely
  different tasks - see identity rules below).
- Populated by `POST /api/actions/:id/split`.

## Task identity (`dedup_key`) rules

The extractor emits `dedup_key` in a canonical, deterministic form so paraphrases converge and
distinct recurring instances diverge (FR-015). Format: lowercase, `verb:subject[:instance]`, with
an **instance qualifier** whenever the task recurs by period or ticket, so different occurrences
get different keys.

| Case | Two items get | Example |
|---|---|---|
| Paraphrase of the same instance | the SAME key | "Approve CM-389" / "Click approve on the Okta change" -> `approve:cm-389` |
| Different tickets/instances | DIFFERENT keys | `approve:cm-389` vs `approve:cm-391` |
| Same recurring task, different period | DIFFERENT keys | `approve:payroll:te0001:2026-08b` vs `…:2026-09a` |
| Repeat sync of the same instance | the SAME key (idempotent) | re-syncing yields `approve:payroll:te0001:2026-08b` again |

Because model-minted keys can still drift, reconcile treats an exact normalised-key match as
"same"; for candidates that do NOT key-match but look close, a model equivalence check
(same-task? yes/no) decides, and a confirmed match adopts one canonical key. A NULL key never
matches (data-model rule above). This is the identity anchor for merge (FR-002), resolved-task
suppression (FR-016), and separation exceptions (FR-017).

## Reconcile-time concepts (not persisted separately)

- **Processed-conversation set**: within a sync, reconcile records which source conversations were
  read successfully and in full. Stale flagging (FR-014/FR-018) only fires for an open action
  whose source conversation IS in that set but whose identity is absent from the new candidates.
  Failed / truncated / skipped conversations are excluded.
- **Resolved-task suppression**: reconcile matches new candidate identities against `done`/
  `dismissed` actions (within a lookback window), not only `open` ones. A candidate whose identity
  matches a resolved action is suppressed rather than recreated (FR-016); a distinct recurring
  instance (different key per the identity rules) is created normally.
- **Backfill (one-time)**: on first upgrade, reconcile derives `dedup_key` and `requested_by` for
  existing actions (best-effort from their stored title/description/source) and consolidates the
  existing duplicate backlog once, keeping each surviving action's manual edits (due date,
  priority, `category_id`/`category_pinned`) and `status` (FR-019). Guarded to run once via the
  migrations ledger / a marker.

## Conceptual (not persisted separately)

- **Requester**: carried on `action.requested_by`; no own table.
- **Merge relationship**: carried on `action.dedup_key` + `action.merged_from`; plus
  `merge_exception` for separations - a merged action is one row that remembers (as content
  snapshots) what it absorbed, and split decisions are remembered so they do not recur.

## Validation rules (from requirements)

- Every synced (non-manual) action must have `requested_by` set to a name or role (SC-003).
- Every action is reachable: either `category_id` points to a live category, or it renders in
  Uncategorised (SC-004).
- A non-NULL `dedup_key` collision among candidates collapses to one surviving action unless a
  conflict is detected (both kept, `conflict` set) or a `merge_exception` forbids it (both kept).
  NULL keys never collide (FR-002, FR-012, FR-017).
- Auto-filing sets `category_id` ONLY when `category_pinned` is not set; once the user explicitly
  assigns a category (including Uncategorised), `category_pinned=1` and later syncs never re-file
  it (FR-007, FR-020, SC-006).
- A candidate whose identity matches a `done`/`dismissed` action (within the lookback) is
  suppressed, not recreated; a distinct recurring instance is created (FR-016).

## State transitions

- Action `status` unchanged (open -> done/dismissed) from feature 001.
- `category_id` / `category_pinned`: NULL + unpinned (Uncategorised, auto-eligible) -> auto-filing
  may set `category_id` -> a user assignment sets `category_pinned=1` (with any `category_id`,
  including NULL for explicit Uncategorised) -> pinned actions are never auto-re-filed; only the
  user changes them (FR-020, SC-006).
- `conflict`: set during reconcile -> cleared by the user resolving it (a `PATCH`).
- `stale_review`: set during reconcile when a re-synced source drops this action's candidate ->
  cleared when the user confirms done/dismissed (never auto-closed) (FR-014).
