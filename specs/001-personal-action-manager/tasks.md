---

description: "Task list template for feature implementation"
---

# Tasks: Personal Action Manager

**Input**: Design documents from `/specs/001-personal-action-manager/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Not explicitly requested in spec.md — no test tasks generated. Validation is via
`quickstart.md` (final Polish task).

**Organization**: Tasks are grouped by user story (US1/US2/US3, per spec.md priorities) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths follow plan.md's Project Structure: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [X] T001 Create project skeleton per plan.md: `backend/src/{actions,sources,claude,db}`,
      `backend/test/{unit,e2e}`, `frontend/src/{components,pages,api}`, `frontend/test`
- [X] T002 Initialize backend NestJS project (Fastify adapter) in `backend/`: `package.json`,
      `tsconfig.json`, dependencies `@nestjs/platform-fastify`, `googleapis`, `uuid`
- [X] T003 [P] Initialize frontend Vite + React 18 project in `frontend/`: `package.json`,
      `tsconfig.json`
- [X] T004 [P] Configure ESLint + Prettier for `backend/` and `frontend/`
- [X] T005 Create `Dockerfile` (multi-stage: build frontend, copy into backend, run) and
      `docker-compose.yml` (single `app` service, SQLite volume mount) at repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Implement `node:sqlite` connection singleton in `backend/src/db/connection.ts`
- [X] T007 Write idempotent migration SQL (`action`, `source_connection`, `run_result` tables per
      data-model.md, including the `(status, due_date)` index) in
      `backend/src/db/migrations/001_init.sql`, plus a migration runner executed at boot
- [X] T008 [P] Define shared TypeScript interfaces (`Action`, `SourceConnection`, `RunResult`,
      `SourceType`, `Priority`, `Status`) in `backend/src/types/index.ts`
- [X] T009 [P] Implement `ClaudeCliService`: `execFile` wrapper for
      `claude -p --output-format json`, content passed via stdin (not argv), 30s hard timeout,
      JSON response parsing, in `backend/src/claude/claude-cli.service.ts` + `ClaudeModule`
- [X] T010 Wire NestJS bootstrap (Fastify adapter, static frontend serving, migration run on
      startup) in `backend/src/main.ts` and `backend/src/app.module.ts`
- [X] T011 [P] Implement frontend typed fetch client base (base URL, error handling) in
      `frontend/src/api/client.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - See everything owed, in one place, with overdue flagged (Priority: P1) 🎯 MVP

**Goal**: Aggregate actions from Gmail, Drive/Gemini, and Chat into one dashboard, grouped by
source, with overdue actions visually flagged.

**Independent Test**: Connect the three sources, sync, confirm actions from all three appear as
unified records grouped by source, with overdue actions visually distinct.

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement `ActionsRepository` (insert, list by status/source_type, get by id,
      update) via `node:sqlite` in `backend/src/actions/actions.repository.ts`
- [X] T013 [P] [US1] Implement `SourceConnectionRepository` (get all, upsert
      status/last_synced_at/last_error) in `backend/src/sources/source-connection.repository.ts`
- [X] T014 [US1] Implement `ActionsService.list` / `listGroupedBySource` (depends on T012) in
      `backend/src/actions/actions.service.ts`
- [X] T015 [US1] Implement `ActionsController`: `GET /api/actions` (`status`, `group_by` query
      params) (depends on T014) in `backend/src/actions/actions.controller.ts`
- [X] T016 [US1] Register `ActionsModule` and wire into `AppModule` in
      `backend/src/actions/actions.module.ts`
- [X] T017 [P] [US1] Implement Google OAuth installed-app connect flow (loopback redirect, tokens
      persisted to local file on the mounted volume, refresh-token reuse), shared across
      Gmail/Drive/Chat, in `backend/src/sources/google-auth.service.ts`
- [X] T018 [P] [US1] Implement Gmail client: fetch messages since `last_synced_at`
      (`gmail.readonly` scope) in `backend/src/sources/gmail.client.ts`
- [X] T019 [P] [US1] Implement Drive/Gemini meeting-notes client: fetch "Next steps" content from
      docs since `last_synced_at` in `backend/src/sources/drive.client.ts`
- [X] T020 [P] [US1] Implement Chat client: fetch messages since `last_synced_at`
      (`chat.messages.readonly` scope) in `backend/src/sources/chat.client.ts`
- [X] T021 [US1] Implement `SourcesService.sync(type)`: fetch raw items (T017-T020), call
      `ClaudeCliService` to extract actionable items, insert `Action` rows via
      `ActionsRepository`, update `SourceConnection` (depends on T009, T012, T013, T017-T020) in
      `backend/src/sources/sources.service.ts`
- [X] T022 [US1] Implement `SourcesController`: `GET /api/sources`,
      `POST /api/sources/:type/sync` (depends on T021) in
      `backend/src/sources/sources.controller.ts`
- [X] T023 [US1] Register `SourcesModule` and wire into `AppModule` in
      `backend/src/sources/sources.module.ts`
- [X] T024 [P] [US1] Implement frontend actions/sources API methods (`getActions`,
      `getActionsGrouped`, `getSources`, `triggerSync`) in `frontend/src/api/actions.ts`,
      `frontend/src/api/sources.ts`
- [X] T025 [P] [US1] Build `ActionCard` component (title/description/source/status; overdue
      flagged visually distinct from due-today/due-later/undated) in
      `frontend/src/components/ActionCard.tsx`
- [X] T026 [P] [US1] Build `SourceGroup` component (renders `ActionCard`s grouped under
      Email/Chat/Meetings/Manual headers) in `frontend/src/components/SourceGroup.tsx`
- [X] T027 [P] [US1] Build `ViewToggle` component (stacked-list vs 2x2-panel, FR-008) in
      `frontend/src/components/ViewToggle.tsx`
- [X] T028 [US1] Build `Dashboard` page: load grouped actions, render source-grouped body with
      view toggle (depends on T024, T025, T026, T027) in `frontend/src/pages/Dashboard.tsx`

**Checkpoint**: User Story 1 fully functional and testable independently

---

## Phase 4: User Story 2 - Get help deciding, and doing, what's next (Priority: P2)

**Goal**: Infer due date/priority for undated actions, rank a "Today's next steps" list, and let
the user Run a suggested next step for review.

**Independent Test**: Create an undated action, confirm Claude infers due date/priority with
`due_date_inferred = true`, editable afterward; click Run and confirm a reviewable result
surfaces before anything is sent.

### Implementation for User Story 2

- [X] T029 [US2] Extend `ClaudeCliService` prompt/response schema to infer `due_date` + `priority`
      for actionable items without an explicit date (depends on T009) in
      `backend/src/claude/claude-cli.service.ts`
- [X] T030 [US2] Wire inference into `SourcesService.sync` for items lacking an explicit
      `due_date`, setting `due_date_inferred = true` (depends on T021, T029) in
      `backend/src/sources/sources.service.ts`
- [X] T031 [US2] Implement `POST /api/actions` manual-entry inference path: when `due_date` is
      omitted, call Claude inference before insert (depends on T029) in
      `backend/src/actions/actions.service.ts` + `backend/src/actions/actions.controller.ts`
- [X] T032 [US2] Implement `PATCH /api/actions/:id`: edit `due_date`/`priority`/`status`, clear
      `due_date_inferred` on `due_date` edit, set `resolved_at` on `done`/`dismissed` (depends on
      T012) in `backend/src/actions/actions.controller.ts` +
      `backend/src/actions/actions.service.ts`
- [X] T033 [US2] Implement `GET /api/actions/today`: overdue → due-today → high-priority ranking,
      capped at 6 (depends on T014) in `backend/src/actions/actions.service.ts` +
      `backend/src/actions/actions.controller.ts`
- [X] T034 [P] [US2] Implement `RunResultRepository` (insert, get latest by `action_id`) in
      `backend/src/actions/run-result.repository.ts`
- [X] T035 [US2] Implement `POST /api/actions/:id/run`: invoke `ClaudeCliService` on
      `suggested_next_step` + action context, persist `RunResult`, return 200/502 (depends on
      T009, T034) in `backend/src/actions/actions.controller.ts` +
      `backend/src/actions/actions.service.ts`
- [X] T036 [P] [US2] Build `NextStepsList` component (numbered ranked list, per-item Run control)
      in `frontend/src/components/NextStepsList.tsx`
- [X] T037 [P] [US2] Add Run button + drafted-result review UI (no send/execute action) to
      `ActionCard` in `frontend/src/components/ActionCard.tsx`
- [X] T038 [P] [US2] Add inline edit controls for `due_date`/`priority` to `ActionCard` (calls
      `PATCH`) in `frontend/src/components/ActionCard.tsx`
- [X] T039 [US2] Wire `Dashboard` to load "Today's next steps" via `GET /api/actions/today` above
      the source-grouped body (depends on T036, T028) in `frontend/src/pages/Dashboard.tsx`

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Capture verbal asks and correct bad inferences (Priority: P3)

**Goal**: Manual entry for verbal asks, and dismiss (not delete) for bad inferences.

**Independent Test**: Add a manual action, confirm `source_type = manual`,
`source_url = null`; dismiss an inferred action, confirm status becomes `dismissed` and the
record is kept.

### Implementation for User Story 3

- [X] T040 [US3] Ensure `POST /api/actions` supports manual entry with just
      title/description, defaulting `source_type = manual`, `source_url = null`,
      `status = open` (depends on T031) in `backend/src/actions/actions.service.ts`
- [X] T041 [P] [US3] Build "Add action" manual-entry form component (title, description,
      optional due_date/priority) in `frontend/src/components/AddActionForm.tsx`
- [X] T042 [US3] Wire dismiss control on `ActionCard` (`PATCH` `status=dismissed`), removed from
      default open-list view while remaining queryable (depends on T032, T037) in
      `frontend/src/components/ActionCard.tsx`, `frontend/src/pages/Dashboard.tsx`
- [X] T043 [US3] Wire `AddActionForm` into `Dashboard` page (depends on T041, T028) in
      `frontend/src/pages/Dashboard.tsx`

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T044 [P] Surface `SourceConnection` sync errors (`last_error`, `status=error`) in dashboard
      UI; confirm previously stored actions from that source remain visible on sync failure
      (Edge Case) in `frontend/src/pages/Dashboard.tsx`
- [X] T045 [P] Add `.env.example` documenting Google OAuth client id/secret + volume paths at
      repo root
- [X] T046 [P] Verify Docker Compose SQLite volume persists across container restarts
- [ ] T047 Run full `quickstart.md` validation (all three user stories + edge cases) end to end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; extends US1's Claude extraction (T021) and
  Actions read path (T014) — build after US1 for a working sync pipeline, though its own
  endpoints are additive, not a rewrite of US1's
- **User Story 3 (Phase 5)**: Depends on Foundational; reuses US1's `ActionsRepository` (T012)
  and US2's `PATCH` endpoint (T032) — build after both
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Each User Story

- Repositories before services before controllers before frontend wiring
- Module registration after its controller/service exist
- Frontend API methods before the components/pages that call them

### Parallel Opportunities

- Setup: T003, T004 in parallel with T002
- Foundational: T008, T009, T011 in parallel (T006/T007 sequential — same file family)
- US1: T012, T013 in parallel; T017-T020 in parallel (different client files); T024-T027 in
  parallel (different frontend files)
- US2: T034 in parallel with T029-T033; T036-T038 in parallel (different/shared files, no
  ordering dependency between them)
- US3: T041 in parallel with T040
- Polish: T044, T045, T046 in parallel

---

## Parallel Example: User Story 1

```bash
# Repositories (different files):
Task: "Implement ActionsRepository in backend/src/actions/actions.repository.ts"
Task: "Implement SourceConnectionRepository in backend/src/sources/source-connection.repository.ts"

# Source clients (different files, same shape):
Task: "Implement Gmail client in backend/src/sources/gmail.client.ts"
Task: "Implement Drive/Gemini client in backend/src/sources/drive.client.ts"
Task: "Implement Chat client in backend/src/sources/chat.client.ts"

# Frontend (different files):
Task: "Build ActionCard component in frontend/src/components/ActionCard.tsx"
Task: "Build SourceGroup component in frontend/src/components/SourceGroup.tsx"
Task: "Build ViewToggle component in frontend/src/components/ViewToggle.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (blocks everything)
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md's "Validate User Story 1" section independently
5. Demo if ready — this alone delivers SC-001/SC-002

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate independently → demo (MVP)
3. US2 → validate independently → demo (inference + Run)
4. US3 → validate independently → demo (manual entry + dismiss)
5. Polish → full quickstart.md pass

## Notes

- [P] tasks = different files, no dependencies
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- No test tasks: not requested by spec.md; `quickstart.md` (T047) is the validation mechanism
