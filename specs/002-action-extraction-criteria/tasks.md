---
description: "Task list for Action Extraction Criteria"
---

# Tasks: Action Extraction Criteria

**Input**: Design documents from `/specs/002-action-extraction-criteria/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not included - no test framework exists in `backend/` today (see plan.md Technical
Context: Testing). Verification is manual, via quickstart.md scenarios, matching existing
project convention.

**Organization**: Tasks are grouped by user story so each can be validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Existing web application layout (`backend/` + `frontend/`, per plan.md Project Structure).
This feature touches one file: `backend/src/claude/claude-cli.service.ts`.

---

## Phase 1: Setup

**Purpose**: Confirm the existing baseline still runs before changing it.

- [X] T001 Confirm the backend builds and runs today, per `specs/002-action-extraction-criteria/quickstart.md` Prerequisites (`cd backend && npm run build && npm run start`) - no code change (ran `npm install` first, no `node_modules` existed in this clone; `npm run build` passed clean)

---

## Phase 2: Foundational

No new foundational infrastructure is required. The existing `ClaudeCliService`
(`backend/src/claude/claude-cli.service.ts`), the `Action` entity
(`backend/src/actions/actions.repository.ts`), and the sync orchestration
(`backend/src/sources/sources.service.ts`) are reused unchanged, per plan.md's Constitution
Check (Principle III, V). Proceed directly to User Story 1.

---

## Phase 3: User Story 1 - Never miss a real commitment (Priority: P1) 🎯 MVP

**Goal**: Every explicit ask of the user, and every commitment the user made themselves -
including ambiguous ones - ends up as an extracted action.

**Independent Test**: Sync a batch of real sources containing known asks/commitments
involving the user, then verify each one appears as an extracted action (quickstart.md
scenarios 1, 2, 4).

### Implementation for User Story 1

- [X] T002 [US1] Rewrite the extraction prompt in `extractActions()`
      (`backend/src/claude/claude-cli.service.ts`) to classify a raw item as actionable when
      it contains an explicit ask directed at the user (FR-001), or when the user states
      their own commitment (FR-002)
- [X] T003 [US1] In the same prompt, add the recall-first instruction: when a possible
      commitment involving the user is ambiguous or vague, classify it as actionable rather
      than excluding it (FR-004)
- [X] T004 [US1] Confirm the rewritten prompt in `backend/src/claude/claude-cli.service.ts`
      applies identically regardless of `sourceLabel` - no per-source branching introduced
      (FR-006) (verified: `sources.service.ts` has a single `extractActions` call site, prompt
      uses `${sourceLabel}` generically)
- [ ] T005 [US1] Manually validate quickstart.md scenarios 1, 2, and 4 against real synced
      data (trigger `POST /sources/:type/sync` for each of email, chat, drive; confirm
      expected actions appear) - **not run**: requires a live Google OAuth connection and
      real inbox/chat/drive data, unavailable in this session

**Checkpoint**: User Story 1 is independently functional - real commitments involving the
user are captured, including ambiguous ones.

---

## Phase 4: User Story 2 - Keep the list free of noise not involving me (Priority: P2)

**Goal**: Items assigned solely to someone other than the user are excluded, so the
recall-first bias from User Story 1 doesn't flood the list with unrelated chatter.

**Independent Test**: Sync a batch of sources containing items assigned solely to other
people, then verify none of them appear as extracted actions (quickstart.md scenario 3).

**Depends on**: T002-T004 (same prompt, same file - sequential, not parallel)

### Implementation for User Story 2

- [X] T006 [US2] Add the exclusion rule to the same prompt in `extractActions()`
      (`backend/src/claude/claude-cli.service.ts`): do not classify a raw item as actionable
      when the action is assigned solely to someone other than the user, with no involvement
      from the user (FR-003)
- [ ] T007 [US2] Manually validate quickstart.md scenario 3 against real synced data (confirm
      an item assigned solely to another named person produces no action) - **not run**: same
      live-data requirement as T005

**Checkpoint**: User Stories 1 and 2 both hold - real commitments are captured, noise is not.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T008 Run the full quickstart.md validation (all 5 scenarios) end-to-end against a
      sample batch of real synced data, and record the actual capture rate against SC-001
      (≥90% of known commitments) and SC-002 (0% of others'-only items) - **not run**: same
      live-data requirement as T005/T007
- [X] T009 [P] Add a CHANGELOG.md entry recording this change, matching the existing
      Decision/Reasoning/Trade-off/Alternatives/Supersedes format used throughout the file

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: None - nothing new to build
- **User Story 1 (Phase 3)**: Can start after Setup; delivers the MVP alone
- **User Story 2 (Phase 4)**: Edits the same prompt written in Phase 3 - sequential, not
  parallel, despite being independently testable once both are in place
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- T002-T004 (US1) all edit the same prompt in the same file - sequential
- T006 (US2) extends that same prompt after US1's edits land

### Parallel Opportunities

- T009 (CHANGELOG entry) can run in parallel with T008 (validation) - different files
- No other tasks are parallelizable - this feature is a single-file, single-prompt change

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1 (recall-first capture)
3. **STOP and VALIDATE**: Run quickstart.md scenarios 1, 2, 4 against real data
4. This alone is a meaningful improvement over today's undefined criteria

### Incremental Delivery

1. Setup → confirm baseline
2. Add User Story 1 → validate → this is already useful (captures more than today, at the
   cost of some noise)
3. Add User Story 2 → validate → noise from unrelated items is removed
4. Polish → full validation pass, record actual metrics, update CHANGELOG.md
