---
description: "Task list for Rename actions"
---

# Tasks: Rename actions

**Input**: Design documents from `/specs/004-rename-actions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: INCLUDED. Backend `node:test` + `node:assert` run via `tsx`
(`node --import tsx --test`); frontend Vitest + Testing Library (jsdom, api mocked).
High-level tests cover code paths and use cases. `quickstart.md` (S1-S6) stays as a
manual smoke pass. Tests are written alongside each story and MUST pass before the
story is considered done.

**Organization**: Tasks grouped by user story so each is independently verifiable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 (from spec.md)

## Path Conventions

Web app: `backend/src/…`, `frontend/src/…`; tests in `backend/test/…`, `frontend` `*.test.tsx`.

---

## Phase 1: Setup (incl. test harness)

- [ ] T001 Confirm backend + frontend build on the current baseline (`cd backend && npm run build`; `cd frontend && npm run build`)
- [ ] T002 Backend test harness: add `tsx` devDependency, add script `"test": "node --import tsx --test \"test/**/*.test.ts\""` to `backend/package.json`, and add `backend/test/helpers.ts` exporting `withTempDb()` (points `DATA_DIR` at a fresh temp dir, runs `runMigrations()`, returns a cleanup) and stub factories `fakeClaude()` / `fakeGoogleClients()` for the external edges
- [ ] T003 [P] Frontend test harness: add devDependencies `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`; add a `test` block to `frontend/vite.config.ts` (`environment: "jsdom"`, `globals: true`, a setup file importing `@testing-library/jest-dom`) and script `"test": "vitest run"`; add `frontend/test/setup.ts`
- [ ] T004 Add a top-level convenience: document `npm test` in both packages (run backend and frontend suites)

**Checkpoint**: `npm test` runs (empty/green) in both packages.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T005 Add `backend/src/db/migrations/003_rename_actions.sql`:
      `ALTER TABLE action ADD COLUMN title_pinned INTEGER NOT NULL DEFAULT 0;`
- [ ] T006 Add `title_pinned: boolean` to the `Action` interface in `backend/src/types/index.ts`
- [ ] T007 Plumb `title_pinned` through `backend/src/actions/actions.repository.ts`:
      coerce in `toAction` via `Boolean(row.title_pinned)`, add to `NewAction` optionals, default `0`
      in `insert()`, include in the INSERT column list
- [ ] T008 [P] Add `title_pinned: boolean` to the frontend `Action` type in `frontend/src/api/types.ts`

**Checkpoint**: schema + model carry `title_pinned`.

---

## Phase 3: User Story 1 - Fix a title on the board (Priority: P1) 🎯 MVP

**Goal**: Edit an action's title inline and save; blank rejected; nothing else changes.

**Independent Test**: quickstart.md S1, S2, S6; automated by T013 / T014.

### Implementation

- [ ] T009 [US1] Widen repository `update()` in `backend/src/actions/actions.repository.ts` to
      persist `title` and `title_pinned` (add both to the `Pick<...>` type AND the `UPDATE action SET …` SQL)
- [ ] T010 [US1] In `backend/src/actions/actions.service.ts` `update()`: accept optional `title`;
      trim it; if present and blank throw a 400-mapped error changing nothing; if present and non-blank
      set `title` and `title_pinned = true`; leave all other fields untouched (FR-001, FR-003, FR-004, FR-006)
- [ ] T011 [US1] Widen the `PATCH /api/actions/:id` body type in `backend/src/actions/actions.controller.ts`
      to accept `title?: string`, mapping the blank-title error to HTTP 400
- [ ] T012 [US1] Add `title` to `updateAction` in `frontend/src/api/actions.ts`; add an inline title editor
      to `frontend/src/components/ActionLine.tsx` (click-to-edit or `…`-menu edit, save on blur/Enter via
      `updateAction({ title })`, ignore blank, reflect the returned action via `onChange`)

### Tests

- [ ] T013 [US1] `backend/test/rename.test.ts` (node:test): rename sets the new title + `title_pinned=true`
      and persists (reload from repo); a blank/whitespace title is rejected and the old title is kept;
      renaming changes no other field (due_date, priority, category_id, status, requested_by)
- [ ] T014 [US1] `frontend/…/ActionLine.test.tsx` (Vitest + Testing Library, `updateAction` mocked):
      editing the title and pressing Enter calls `updateAction` with the new title and shows it; a blank
      value does not call `updateAction`
- [ ] T015 [US1] Manually validate quickstart.md S1, S2, S6

**Checkpoint**: renaming works end to end and is covered.

---

## Phase 4: User Story 2 - My rename is never overwritten (Priority: P1)

**Goal**: A user-set title survives re-sync and merge; unrenamed titles still update.

**Independent Test**: quickstart.md S3, S4, S5; automated by T017.

### Implementation

- [ ] T016 [US2] Guard the title in the reconcile merge branch in `backend/src/sources/reconcile.service.ts`:
      never overwrite an existing open action's `title` when `title_pinned` is set, and carry `title_pinned`
      through the `setDigestFields` update so the flag survives; confirm no reconcile/backfill path writes a
      fresh title over a pinned one (FR-004, FR-005)

### Tests

- [ ] T017 [US2] `backend/test/rename.test.ts` (extend) with a stubbed Claude/Google edge: a renamed
      (`title_pinned`) action keeps its title when the same source reconciles again and when a duplicate
      candidate merges into it; an action that was NOT renamed may have its title updated by a fresh candidate
- [ ] T018 [US2] Manually validate quickstart.md S3, S4, S5

**Checkpoint**: renames are durable and covered.

---

## Phase 5: Coverage backfill for existing high-risk logic

**Purpose**: fold in tests for the feature-003 logic most likely to regress (user asked tests be broad enough
to cover code paths/use cases). All backend `node:test`, external edges stubbed.

- [ ] T019 [P] `backend/test/comparator.test.ts`: the FR-021 urgency ordering (overdue → due-today → future →
      undated; then due asc, priority, created asc) and Uncategorised always last
- [ ] T020 [P] `backend/test/destination.test.ts`: `resolveDestination` returns JIRA browse URL for a `CM-###`
      title, ESS URL for a leave action when configured (else source fallback), and the source URL otherwise
- [ ] T021 [P] `backend/test/reconcile.test.ts`: candidates sharing a non-null dedup_key collapse to one; a
      null key stays distinct; a resolved (done/dismissed) identity with no open survivor is suppressed while
      an open survivor is merged into (not suppressed); `merged_from` snapshots are recorded; stale flagging
      only fires for a fully-read conversation
- [ ] T022 [P] `backend/test/extraction-rules.test.ts`: cover the ownership rules as far as they are unit-
      testable — e.g. `areSameTask`/`deriveIdentity` prompt wiring via a stubbed CLI, and a documented check
      that a directed-at-other or general-group ask yields no action (drive `extractActions` with a fake CLI
      returning a fixed payload to assert the plumbing, since the rule itself lives in the model prompt)
- [ ] T023 [P] `frontend/…/CategoryBoard.test.tsx` (Vitest): renders category groups in order with the overdue
      badge, and a group's lines render title + next step + due pill

---

## Phase 6: Polish & Cross-Cutting

- [ ] T024 Run the full suites (`cd backend && npm test`; `cd frontend && npm test`) and the manual quickstart (S1-S6); all green
- [ ] T025 [P] Add a CHANGELOG.md entry (Decision/Reasoning/Trade-off/Alternatives/Supersedes) recording inline
      rename, the `title_pinned` guard, and the introduction of the test harness

---

## Dependencies & Execution Order

- **Setup (T001-T004)** → **Foundational (T005-T008)** block everything.
- **US1 (T009-T015)** is the MVP; depends only on Foundational. T009 before T010 (both feed the update path).
- **US2 (T016-T018)** depends on Foundational (the flag) and the reconcile step; independent of US1's UI.
- **Coverage backfill (T019-T023)** depends only on the harness (T002-T003) and existing code; can run any
  time after Setup, in parallel with US1/US2.
- **Polish (T024-T025)** last.

### Parallel opportunities
- T003 (frontend harness) ∥ T002 (backend harness).
- T008 (frontend type) ∥ backend T005-T007.
- All of T019-T023 are independent files → parallel.
- T025 (CHANGELOG) ∥ T024.

## Implementation Strategy

### MVP first (US1)
1. Setup + harness + Foundational.
2. US1 implementation + T013/T014 tests → validate S1, S2, S6.

### Then durability + safety net
3. US2 reconcile guard + T017 → validate S3, S4, S5.
4. Coverage backfill (T019-T023) for the 003 logic.
5. Full suite + quickstart + CHANGELOG.
