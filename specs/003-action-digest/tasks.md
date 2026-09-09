---
description: "Task list for Action Digest"
---

# Tasks: Action Digest

**Input**: Design documents from `/specs/003-action-digest/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md,
exploration-map.md

**Tests**: Not included - no test framework in the repo (see plan.md Technical Context).
Verification is manual via quickstart.md, per project convention (features 001/002).

**Organization**: Tasks grouped by user story (spec.md priorities) so each is independently
verifiable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 (from spec.md)

## Path Conventions

Web app: `backend/src/…`, `frontend/src/…`. New backend module: `backend/src/categories/`.

---

## Phase 1: Setup

- [X] T001 Confirm backend + frontend build and run on the current baseline (`cd backend && npm run build && npm run start`; frontend build) before changing anything

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Prerequisite groundwork - must complete before any user story. Two hard blockers from the
exploration map: the migration runner re-execs every `.sql` on boot, and there is no
post-fetch seam for cross-source work.**

- [X] T002 Add a `schema_migrations` ledger to `backend/src/db/migrate.ts`: create
      `schema_migrations(version TEXT PK, applied_at)`, record `001_init.sql` as applied on first
      upgrade, and skip any `.sql` whose filename is already recorded (research.md decision 1)
- [X] T003 Add `backend/src/db/migrations/002_action_digest.sql`: `CREATE TABLE IF NOT EXISTS
      category(id, name, rule, icon, created_at)`; `CREATE TABLE IF NOT EXISTS
      merge_exception(key_a, key_b, created_at, PRIMARY KEY(key_a, key_b))`; `ALTER TABLE action
      ADD COLUMN` for `requested_by`, `category_id`, `dedup_key`, `merged_from`, `conflict`,
      `stale_review`, `category_pinned` (now safe via the ledger); optional `INSERT OR IGNORE`
      seed of a starter category set (data-model.md)
- [X] T004 Extend the `Action` model plumbing in `backend/src/actions/actions.repository.ts`,
      `backend/src/actions/actions.service.ts`, `backend/src/actions/actions.controller.ts`, and
      `backend/src/types/index.ts`: add the seven new fields (`requested_by`, `category_id`,
      `dedup_key`, `merged_from`, `conflict`, `stale_review`, `category_pinned`) to the INSERT
      column list, the `toAction` mapper (coercing `conflict`/`stale_review`/`category_pinned` via
      `Boolean()`, like `due_date_inferred`), and the `Action` interface together. Widen the update
      path for `category_id`/`category_pinned`/`conflict`/`stale_review` in ALL of: the `Pick`
      whitelist type, the actual
      `UPDATE action SET ...` statement in the repository, the service `Pick`, and the controller
      body type - a PATCH that misses the UPDATE SQL returns 200 but never persists
- [X] T005 Add a post-fetch **reconcile seam** to `backend/src/sources/sources.service.ts`:
      refactor `sync(type)` so fetch+extract collects candidate actions in memory and hands them
      to a `reconcile()` step before insert, instead of inserting inline in the loop
      (research.md decision 2) - no behaviour change yet, just the seam
- [X] T005a One-time backfill of the existing action backlog in
      `backend/src/sources/sources.service.ts` (or a `backfill()` invoked once, guarded via the
      migrations ledger / a marker): derive `dedup_key` + `requested_by` for existing actions from
      their stored title/description/source, then run the reconcile/merge over the backlog once,
      preserving each surviving action's manual edits (due date, priority, `category_id`/
      `category_pinned`) and `status`; must never re-run (FR-019, SC-008)

**Checkpoint**: schema supports the new fields; a reconcile step exists to hang dedup/requester/
filing/conflict logic on; the existing backlog is consolidated once. User stories can now proceed.

---

## Phase 3: User Story 1 - One action per real task (Priority: P1) 🎯 MVP

**Goal**: Chat reads whole threads; duplicates within and across sources collapse to one action;
stale early asks are dropped.

**Independent Test**: quickstart.md scenarios 1, 2, 3.

- [X] T006 [US1] Make chat extraction thread/space-aware in `backend/src/sources/chat.client.ts`:
      group a space's messages by `msg.thread?.name` (fall back to space for flat spaces) and
      assemble one chronological transcript per thread (mirror the Gmail assembler in
      `gmail.client.ts`), emitting one `RawSourceItem` per thread. The transcript MUST include a
      per-message sender line (e.g. `From: <sender>`) - not just message text - so the requester
      extraction in T011 has a name/role to attribute (FR-001; unblocks SC-002 for chat)
- [X] T007 [US1] Have the extractor emit a canonical `dedup_key` on `ExtractedAction` in
      `backend/src/claude/claude-cli.service.ts`: `verb:subject[:instance]`, lowercase, with an
      instance qualifier (ticket id, pay period, date bucket) so paraphrases of one instance share
      a key and distinct recurring instances differ (data-model "Task identity" rules). Reinforce
      the stale-state instruction (emit the current open item; drop asks resolved later in the same
      conversation) (FR-003, FR-015)
- [X] T008 [US1] Implement de-duplication in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`): collapse candidates sharing a NON-NULL
      `dedup_key`; for close-but-not-equal keys, confirm via a model equivalence check before
      merging (paraphrase drift); NEVER merge a pair listed in `merge_exception`; NULL keys never
      match. Match against existing OPEN actions too. The surviving action's `merged_from` stores a
      content snapshot of each absorbed candidate (title/description/due/priority/next-step/
      requester/source) so a split can rebuild them (FR-002, FR-015, FR-017, supports FR-013)
- [X] T008a [US1] Suppress previously-resolved asks in `reconcile()`
      (`backend/src/sources/sources.service.ts`): match candidate identities against `done`/
      `dismissed` actions within a lookback window; a match suppresses the candidate (nothing
      created), while a distinct recurring instance (different key) is created normally (FR-016,
      SC-006)
- [X] T009 [US1] Add `POST /api/sources/sync-all` (`backend/src/sources/sources.controller.ts` +
      service) that runs every source's fetch+extract through one reconcile pass; route the
      existing per-type sync through the same reconcile step (contracts/api.md)
- [ ] T010 [US1] Manually validate quickstart.md scenarios 1, 2, 3, 12 against a labelled sample
      (chat restated ask -> 1; email+chat same task -> 1; long resolved thread -> current item;
      paraphrase merges but a different pay period / ticket does NOT); confirm duplicate rate < 5%
      AND no true task lost (SC-001, SC-002)

**Checkpoint**: the list is deduped - the MVP. Trustworthy even before requester/categories land.

---

## Phase 4: User Story 2 - See who is asking (Priority: P1)

**Goal**: Every synced action shows a requester (name or role).

**Independent Test**: quickstart.md scenario 4.

- [X] T011 [US2] Add `requested_by` to `ExtractedAction` and the extraction prompt in
      `backend/src/claude/claude-cli.service.ts`; use the email `From` display name, and pass
      chat sender/space context so a role is emitted where a name is unavailable (FR-004,
      research.md decision 3)
- [X] T012 [US2] Thread `requested_by` through the reconcile step and insert in
      `backend/src/sources/sources.service.ts` (a merged action keeps the clearest requester)
- [ ] T013 [US2] Manually validate quickstart.md scenario 4: every non-manual action has a
      requester; manual actions may be null (SC-002)

**Checkpoint**: actions are attributed.

---

## Phase 5: User Story 3 - Group into my own categories (Priority: P1)

**Goal**: User-maintained categories with filing rules; Uncategorised bucket; re-filing persists.

**Independent Test**: quickstart.md scenarios 5, 6.

- [X] T014 [P] [US3] Create the categories module
      `backend/src/categories/{categories.repository.ts, categories.service.ts,
      categories.controller.ts}` with GET/POST/PATCH/DELETE over the `category` table; DELETE sets
      the category's actions' `category_id` to null (FR-005, contracts/api.md)
- [X] T015 [US3] Register the categories module in `backend/src/app.module.ts`
- [X] T016 [US3] Implement category filing in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`): apply each category's `rule` via the local
      Claude CLI to set `category_id`, but ONLY for actions where `category_pinned` is not set, so
      an explicit user assignment (including explicit Uncategorised) is never overwritten on a
      later sync; unmatched stay null + unpinned (auto-eligible Uncategorised) (FR-006, FR-020,
      SC-006)
- [X] T017 [US3] Add a `group_by=category` branch to `GET /api/actions`
      (`backend/src/actions/actions.controller.ts` + `actions.service.ts`) implementing the FR-021
      comparator (overdue -> due-today -> future -> undated; then due asc, priority, created asc),
      ranking each category by its most-urgent action and pinning Uncategorised LAST regardless;
      ensure `PATCH /api/actions/:id` accepts `category_id` and sets `category_pinned=1` on re-file
      (FR-007, FR-008, FR-020, FR-021,
      contracts/api.md)
- [ ] T018 [US3] Manually validate quickstart.md scenarios 5, 6: rule-based filing, Uncategorised
      bucket, re-file persisting across a re-sync, and an explicit Uncategorised choice persisting
      (not auto-refiled) (SC-004, SC-006)

**Checkpoint**: actions are grouped the user's way; data for the board is ready.

---

## Phase 6: User Story 4 - Read the board by priority (Priority: P2)

**Goal**: The priority-first category board with the view switch and per-line controls.

**Independent Test**: quickstart.md scenarios 7, 8.

- [X] T019 [P] [US4] Add `requested_by`, `category_id`, `category_pinned`, `conflict`,
      `stale_review` to the frontend `Action` type and add category API calls in
      `frontend/src/api/{types.ts, actions.ts, categories.ts}`
- [X] T020 [US4] Build a `CategoryColumn` component (from `SourceGroup`) and a condensed board
      line in `frontend/src/components/` - source icon, work title, next step, due, circular play
      button, requester (FR-009)
- [X] T021 [US4] Replace the source-grouped body in `frontend/src/pages/Dashboard.tsx` with the
      priority-first category board (categories ordered by the FR-021 comparator, Uncategorised
      last, no gaps between groups within a column), fed by `group_by=category` (FR-008, FR-021)
- [X] T022 [US4] Add the view switch (two-column default / single rail / manage-taxonomy) in
      `frontend/src/pages/Dashboard.tsx`, and a manage screen that lists/edits categories and
      files Uncategorised items (FR-011)
- [X] T023 [US4] Add a category re-file control (including an explicit "Uncategorised" choice) to
      the board line / `ActionCard` (`frontend/src/components/`) wired to `PATCH /api/actions/:id`,
      which sets `category_pinned` server-side (FR-007, FR-020)
- [ ] T024 [US4] Manually validate quickstart.md scenarios 7, 8: comparator ordering with
      Uncategorised last, per-line contents, view switch, and Run drafting only (SC-005, FR-010,
      FR-021)

**Checkpoint**: the full board is usable end to end.

---

## Phase 7: Conflict handling & merge correction (cross-cutting, spec P-level Must/Should)

- [ ] T025 Flag content conflicts in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`): when two candidates target the same subject with
      opposite asks, keep both and set `conflict` rather than merging (FR-012)
- [X] T026 Surface conflicts on the board and allow resolution via `PATCH /api/actions/:id`
      clearing `conflict` (`frontend/src/components/`, `frontend/src/pages/Dashboard.tsx`) (FR-012)
- [X] T027 Add `POST /api/actions/:id/split` (`backend/src/actions/actions.controller.ts` +
      service) to undo a wrong merge by re-inserting actions from the `merged_from` content
      snapshots (no re-fetch), and RECORD a `merge_exception(key_a, key_b)` for the separated
      identities so reconcile does not re-merge them; add a split control on the board (FR-013,
      FR-017)
- [X] T027a Implement cross-sync stale flagging in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`), GATED on a successful full read: build the set of
      source conversations read successfully this sync; only for an open action whose conversation
      is in that set AND whose `dedup_key` is absent from the new candidates, set `stale_review`
      (never auto-close, never flag from a failed/truncated/error source); surface on the board
      with confirm-done / dismiss, clearing via `PATCH` (FR-014, FR-018, SC-007, Principle IV)
- [ ] T028 Manually validate quickstart.md scenarios 9-13: conflict surfaced not merged; split
      restores separate tasks from snapshots and the separation survives re-sync; a
      resolved-after-sync action is flagged only when its source read succeeded; a completed ask is
      not recreated while a new recurring instance is; an errored source's actions are not
      stale-flagged (SC-006, SC-007)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T029 Run the full quickstart.md validation (all scenarios) against a LABELLED sample (raw
      items hand-labelled with the true distinct tasks + correct requester/category) and record:
      duplicate rate (SC-001, < 5%), no-loss/recall (SC-002, >= 95% of true tasks present, 0
      over-merged away), requester coverage (SC-003), reachability (SC-004), ordering (SC-005),
      correction survival (SC-006), stale gating (SC-007), and backfill (SC-008)
- [X] T030 [P] Add a CHANGELOG.md entry recording the feature, matching the existing
      Decision/Reasoning/Trade-off/Alternatives/Supersedes format

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → **Foundational (P2)** blocks everything (ledger, migration, model fields,
  reconcile seam).
- **US1 (P3)** is the MVP; depends only on Foundational.
- **US2 (P4)** and **US3 (P5)** depend on Foundational; both extend the reconcile step US1
  builds, so they run after US1 in practice (same file, sequential).
- **US4 (P6)** depends on US3 (needs `group_by=category` data).
- **Conflict/merge (P7)** depends on the reconcile step (US1) and the board (US4).
- **Polish (P8)** last.

### Within/ across stories
- T004, T005, T008, T012, T016, T025 all edit `sources.service.ts` / the reconcile step -
  sequential, not parallel.
- Parallel opportunities: T014 (categories module, new files) ∥ backend extraction work;
  T019 (frontend types) ∥ backend; T030 (CHANGELOG) ∥ T029.

## Implementation status (2026-09-08)

All implementation tasks are done and both builds pass clean (`backend` tsc,
`frontend` tsc + vite). The remaining unchecked tasks are:

- **Pending manual verification (needs live Google-synced data / labelled
  sample):** T010, T013, T018, T024, T028, T029. These cannot be run in this
  environment without OAuth-connected sources and a hand-labelled sample; they
  must be executed against real data before deploy, not faked.
- **T025 (auto content-conflict detection in reconcile):** minimal. `conflict`
  is carried on merged actions and fully surfaced/resolvable on the board
  (T026 done), but reconcile does not yet auto-detect opposite asks on the same
  subject. Left for a follow-on once real conflicting pairs are observed.

## Implementation Strategy

### MVP first (US1 only)
1. Setup + Foundational (ledger, migration, reconcile seam).
2. US1: chat thread-awareness + dedup + sync-all.
3. **STOP and validate** quickstart scenarios 1-3 - the deduped list alone is a major win.

### Incremental delivery
1. Foundational → US1 (deduped list) → validate.
2. US2 (requester) → validate.
3. US3 (categories) → validate.
4. US4 (board) → validate - the feature is now visibly complete.
5. Conflict/merge correction → validate.
6. Polish + CHANGELOG.
