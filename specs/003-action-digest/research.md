# Phase 0 Research: Action Digest

Resolves the technical unknowns the exploration map surfaced. No `[NEEDS CLARIFICATION]`
markers remained in the spec; these are the "how" decisions the plan depends on.

## Decision: Add a `schema_migrations` ledger before altering `action`

**Rationale**: `backend/src/db/migrate.ts` re-executes every `migrations/*.sql` on every boot,
so all SQL must be idempotent. `CREATE TABLE IF NOT EXISTS` is fine, but SQLite `ALTER TABLE ADD
COLUMN` is **not** idempotent and throws "duplicate column" on the second startup. Since this
feature must add `requested_by`, `category_id`, and a dedup key to `action`, a run-once tracking
ledger is the minimum safe mechanism.

**Approach**: `migrate.ts` creates a `schema_migrations(version TEXT PK, applied_at)` table, and
before exec'ing each `.sql` checks/records its filename. Existing `001_init.sql` is recorded as
already-applied on first upgrade (its content is idempotent, so re-running once is harmless).

**Alternatives considered**:
- Guard each `ALTER` with a PRAGMA column-existence check - works but spreads fragile
  conditionals through every future migration; rejected for long-term simplicity.
- Recreate the `action` table with the new columns via a guarded copy - heavier and riskier for
  an existing table with data; rejected.

## Decision: Post-fetch reconcile pass + a stable dedup key

**Rationale**: Today `SourcesService.sync()` inserts each extracted action inline, per raw item,
and runs per-source. Cross-source de-duplication (FR-002) is structurally impossible there.

**Approach**:
- Add a **sync-all** entrypoint that runs each source's fetch+extract, collecting candidate
  actions in memory rather than inserting immediately.
- A **reconcile** step then matches candidates against each other and against existing open
  actions, using a **dedup signature** derived by the extractor (a normalised subject/intent
  key, e.g. "approve CM-389" or "approve payroll TE0001 Aug16-31"). Candidates sharing a
  NON-NULL signature collapse to one action; a NULL signature never matches (the item stays
  distinct) so a best-effort/missing key cannot silently swallow unrelated tasks. The surviving
  action stores a content SNAPSHOT of each absorbed candidate in `merged_from` so a wrong merge
  can be split back into real actions (FR-013) without re-fetching.
- **Cross-sync staleness**: when a source is re-synced and an existing open action's `dedup_key`
  is not among that source's new candidates, reconcile flags the action `stale_review`
  (possibly-resolved) for the user to confirm - never auto-closed (FR-014, Principle IV).
- Per-source sync is kept for convenience but routed through the same reconcile step.

**Alternatives considered**:
- Read-time grouping only (compute merges on GET) - leaves duplicate rows in the DB, breaks
  `/today` and counts, and can't persist user merge corrections; rejected.
- A content hash of the raw text - too brittle (restatements differ textually); a model-derived
  intent signature matches the way duplicates actually vary. Chosen.

## Decision: Requester attribution during extraction

**Rationale**: The extractor prompt already reasons about who-asks-whom but discards it. Gmail
gives a human `From` header; Chat currently discards the sender (a `users/...` resource id).

**Approach**:
- Add `requested_by` to the extractor's returned shape and prompt.
- Email: use the parsed `From` display name.
- Chat: pass sender/space context into extraction; where only a role/space is knowable, emit a
  role. A chat sender display-name lookup (via the members API) is a possible later refinement;
  role-level attribution satisfies SC-002 now.
- Manual actions: no requester (allowed).

**Alternatives considered**: A separate post-extraction requester-resolution service - more moving
parts for no present benefit; folded into extraction instead.

## Decision: Category taxonomy - a table with model-assisted filing rules

**Rationale**: FR-005/006/007 need user-owned categories with rules, an Uncategorised bucket, and
re-filing.

**Approach**:
- A `category` table: id, name, an ordering/urgency is computed (not stored), and a `rule`
  (free-text description of what belongs, used to file actions during processing via the local
  Claude CLI - consistent with how extraction already works).
- `action.category_id` nullable; NULL renders as Uncategorised.
- Filing runs in the reconcile step (after dedup) and sets `category_id` ONLY when it is
  currently NULL, so an action the user has already re-filed is never re-categorised on a later
  sync (FR-007, SC-005).
- Re-filing = a `PATCH` that sets `category_id` and persists. This requires widening not just the
  `Pick` whitelist type but the actual `UPDATE action SET ...` statement in the repository, the
  service `Pick`, and the controller body type - otherwise the PATCH returns 200 without writing.

**Alternatives considered**:
- Hard-coded keyword rules - brittle and not user-maintainable; rejected in favour of a rule the
  model applies (mirrors the extraction approach and constitution Principle II).

## Decision: Stale-state weighting and conflict detection ride the extractor

**Rationale**: Both are judgement calls about the content of a thread/space, which the extractor
already reads whole (FR-003, FR-012).

**Approach**:
- Stale-state: the (already thread-aware) prompt is instructed to emit the *current* open item
  and drop asks resolved later in the same conversation.
- Conflict: when two candidates target the same subject with opposite asks, the reconcile step
  flags a conflict rather than merging; the board surfaces it for a decision.

**Alternatives considered**: A separate diffing/conflict engine - overkill for a single-user
tool; the model-in-the-loop approach is sufficient and simpler.

## Decision: Board is a frontend change over new grouping data

**Rationale**: The chosen design (priority-first category board, no gaps between groups, source
icons, title + next step, circular play, view switch) is a display concern.

**Approach**: extend `GET /api/actions` with `group_by=category`; the board replaces the
source-grouped body in `Dashboard.tsx`, `CategoryColumn` derives from `SourceGroup`, `ActionCard`
gains requester + a re-file control, and the view switch toggles two-column / single / manage.
No server-side rendering change beyond the grouping branch and category endpoints.
