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

- [ ] T001 Confirm backend + frontend build and run on the current baseline (`cd backend && npm run build && npm run start`; frontend build) before changing anything

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Prerequisite groundwork - must complete before any user story. Two hard blockers from the
exploration map: the migration runner re-execs every `.sql` on boot, and there is no
post-fetch seam for cross-source work.**

- [ ] T002 Add a `schema_migrations` ledger to `backend/src/db/migrate.ts`: create
      `schema_migrations(version TEXT PK, applied_at)`, record `001_init.sql` as applied on first
      upgrade, and skip any `.sql` whose filename is already recorded (research.md decision 1)
- [ ] T003 Add `backend/src/db/migrations/002_action_digest.sql`: `CREATE TABLE IF NOT EXISTS
      category(id, name, rule, icon, created_at)`; `ALTER TABLE action ADD COLUMN` for
      `requested_by`, `category_id`, `dedup_key`, `merged_from`, `conflict`, `stale_review` (now
      safe via the ledger); optional `INSERT OR IGNORE` seed of a starter category set
      (data-model.md)
- [ ] T004 Extend the `Action` model plumbing in `backend/src/actions/actions.repository.ts`,
      `backend/src/actions/actions.service.ts`, `backend/src/actions/actions.controller.ts`, and
      `backend/src/types/index.ts`: add the six new fields (`requested_by`, `category_id`,
      `dedup_key`, `merged_from`, `conflict`, `stale_review`) to the INSERT column list, the
      `toAction` mapper (coercing `conflict`/`stale_review` via `Boolean()`, like
      `due_date_inferred`), and the `Action` interface together. Widen the update path for
      `category_id`/`conflict`/`stale_review` in ALL of: the `Pick` whitelist type, the actual
      `UPDATE action SET ...` statement in the repository, the service `Pick`, and the controller
      body type - a PATCH that misses the UPDATE SQL returns 200 but never persists
- [ ] T005 Add a post-fetch **reconcile seam** to `backend/src/sources/sources.service.ts`:
      refactor `sync(type)` so fetch+extract collects candidate actions in memory and hands them
      to a `reconcile()` step before insert, instead of inserting inline in the loop
      (research.md decision 2) - no behaviour change yet, just the seam

**Checkpoint**: schema supports the new fields; a reconcile step exists to hang dedup/requester/
filing/conflict logic on. User stories can now proceed.

---

## Phase 3: User Story 1 - One action per real task (Priority: P1) 🎯 MVP

**Goal**: Chat reads whole threads; duplicates within and across sources collapse to one action;
stale early asks are dropped.

**Independent Test**: quickstart.md scenarios 1, 2, 3.

- [ ] T006 [US1] Make chat extraction thread/space-aware in `backend/src/sources/chat.client.ts`:
      group a space's messages by `msg.thread?.name` (fall back to space for flat spaces) and
      assemble one chronological transcript per thread (mirror the Gmail assembler in
      `gmail.client.ts`), emitting one `RawSourceItem` per thread. The transcript MUST include a
      per-message sender line (e.g. `From: <sender>`) - not just message text - so the requester
      extraction in T011 has a name/role to attribute (FR-001; unblocks SC-002 for chat)
- [ ] T007 [US1] Have the extractor emit a `dedup_key` (normalised subject/intent signature) on
      `ExtractedAction` in `backend/src/claude/claude-cli.service.ts`, and reinforce the
      stale-state instruction in the prompt (emit the current open item, drop asks resolved later
      in the same conversation) (FR-003, research.md decision 5)
- [ ] T008 [US1] Implement de-duplication in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`): collapse candidates sharing a NON-NULL
      `dedup_key` (NULL keys never match - each stays distinct), and match against existing open
      actions, into one surviving action whose `merged_from` stores a content snapshot of each
      absorbed candidate (title/description/due/priority/next-step/requester/source), so a split
      can rebuild them (FR-002, supports FR-013)
- [ ] T009 [US1] Add `POST /api/sources/sync-all` (`backend/src/sources/sources.controller.ts` +
      service) that runs every source's fetch+extract through one reconcile pass; route the
      existing per-type sync through the same reconcile step (contracts/api.md)
- [ ] T010 [US1] Manually validate quickstart.md scenarios 1, 2, 3 against real synced data
      (chat restated ask → 1; email+chat same task → 1; long resolved thread → current item);
      confirm duplicate rate < 5% (SC-001)

**Checkpoint**: the list is deduped - the MVP. Trustworthy even before requester/categories land.

---

## Phase 4: User Story 2 - See who is asking (Priority: P1)

**Goal**: Every synced action shows a requester (name or role).

**Independent Test**: quickstart.md scenario 4.

- [ ] T011 [US2] Add `requested_by` to `ExtractedAction` and the extraction prompt in
      `backend/src/claude/claude-cli.service.ts`; use the email `From` display name, and pass
      chat sender/space context so a role is emitted where a name is unavailable (FR-004,
      research.md decision 3)
- [ ] T012 [US2] Thread `requested_by` through the reconcile step and insert in
      `backend/src/sources/sources.service.ts` (a merged action keeps the clearest requester)
- [ ] T013 [US2] Manually validate quickstart.md scenario 4: every non-manual action has a
      requester; manual actions may be null (SC-002)

**Checkpoint**: actions are attributed.

---

## Phase 5: User Story 3 - Group into my own categories (Priority: P1)

**Goal**: User-maintained categories with filing rules; Uncategorised bucket; re-filing persists.

**Independent Test**: quickstart.md scenarios 5, 6.

- [ ] T014 [P] [US3] Create the categories module
      `backend/src/categories/{categories.repository.ts, categories.service.ts,
      categories.controller.ts}` with GET/POST/PATCH/DELETE over the `category` table; DELETE sets
      the category's actions' `category_id` to null (FR-005, contracts/api.md)
- [ ] T015 [US3] Register the categories module in `backend/src/app.module.ts`
- [ ] T016 [US3] Implement category filing in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`): apply each category's `rule` via the local
      Claude CLI to set `category_id`, but ONLY for actions whose `category_id` is currently NULL,
      so a user re-file is never overwritten on a later sync; unmatched stay null (Uncategorised)
      (FR-006, FR-007, SC-005, research.md decision 4)
- [ ] T017 [US3] Add a `group_by=category` branch to `GET /api/actions`
      (`backend/src/actions/actions.controller.ts` + `actions.service.ts`) returning categories
      ordered by their most-urgent item with an Uncategorised group last; ensure
      `PATCH /api/actions/:id` accepts `category_id` for re-filing (FR-007, FR-008,
      contracts/api.md)
- [ ] T018 [US3] Manually validate quickstart.md scenarios 5, 6: rule-based filing, Uncategorised
      bucket, and re-file persisting across a re-sync (SC-003, SC-005)

**Checkpoint**: actions are grouped the user's way; data for the board is ready.

---

## Phase 6: User Story 4 - Read the board by priority (Priority: P2)

**Goal**: The priority-first category board with the view switch and per-line controls.

**Independent Test**: quickstart.md scenarios 7, 8.

- [ ] T019 [P] [US4] Add `requested_by`, `category_id`, `conflict` to the frontend `Action` type
      and add category API calls in `frontend/src/api/{types.ts, actions.ts, categories.ts}`
- [ ] T020 [US4] Build a `CategoryColumn` component (from `SourceGroup`) and a condensed board
      line in `frontend/src/components/` - source icon, work title, next step, due, circular play
      button, requester (FR-009)
- [ ] T021 [US4] Replace the source-grouped body in `frontend/src/pages/Dashboard.tsx` with the
      priority-first category board (categories ordered by urgency, no gaps between groups within
      a column), fed by `group_by=category` (FR-008)
- [ ] T022 [US4] Add the view switch (two-column default / single rail / manage-taxonomy) in
      `frontend/src/pages/Dashboard.tsx`, and a manage screen that lists/edits categories and
      files Uncategorised items (FR-011)
- [ ] T023 [US4] Add a category re-file control to the board line / `ActionCard`
      (`frontend/src/components/`) wired to `PATCH /api/actions/:id` (FR-007)
- [ ] T024 [US4] Manually validate quickstart.md scenarios 7, 8: board ordering, per-line
      contents, view switch, and Run drafting only (SC-004, FR-010)

**Checkpoint**: the full board is usable end to end.

---

## Phase 7: Conflict handling & merge correction (cross-cutting, spec P-level Must/Should)

- [ ] T025 Flag content conflicts in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`): when two candidates target the same subject with
      opposite asks, keep both and set `conflict` rather than merging (FR-012)
- [ ] T026 Surface conflicts on the board and allow resolution via `PATCH /api/actions/:id`
      clearing `conflict` (`frontend/src/components/`, `frontend/src/pages/Dashboard.tsx`) (FR-012)
- [ ] T027 Add `POST /api/actions/:id/split` (`backend/src/actions/actions.controller.ts` +
      service) to undo a wrong merge by re-inserting actions from the `merged_from` content
      snapshots (no re-fetch), and a split control on the board (FR-013)
- [ ] T027a Implement cross-sync stale flagging in the `reconcile()` step
      (`backend/src/sources/sources.service.ts`): when a re-synced source drops an existing open
      action's `dedup_key` from its new candidates, set `stale_review` (never auto-close); surface
      it on the board with confirm-done / dismiss, clearing the flag via `PATCH` (FR-014, SC-006,
      Principle IV)
- [ ] T028 Manually validate quickstart.md scenarios 9, 10, 11: conflict surfaced not merged;
      split restores separate tasks from snapshots and survives re-sync; a resolved-after-sync
      action is flagged for review, not auto-closed (SC-005, SC-006)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T029 Run the full quickstart.md validation (all 10 scenarios) against real synced data and
      record the actual duplicate rate against SC-001
- [ ] T030 [P] Add a CHANGELOG.md entry recording the feature, matching the existing
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
