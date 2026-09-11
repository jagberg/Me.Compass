# Tasks: Chat action resolution detection

**Input**: Design documents from `specs/005-chat-action-resolution/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reconcile-and-claude.md, quickstart.md

**Tests**: Requested explicitly - `node --import tsx --test` with a fake `claude` client (`backend/test/helpers.ts`), following the pattern established in feature 004.

**Organization**: Tasks are grouped by user story (from spec.md: US1/US2 are P1, US3 is P2) to enable independent testing of each story, on top of one shared Foundational phase that implements the judgement mechanism all three stories exercise.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repo root.

## Phase 1: Setup

- [X] T001 Create migration `backend/src/db/migrations/006_resolution_ask.sql`: `ALTER TABLE action ADD COLUMN resolution_ask TEXT;` (see data-model.md)
- [X] T002 [P] Add `resolution_ask: string | null` to the `Action` interface in `backend/src/types/index.ts`, grouped near `title_pinned` with a comment noting it's null for non-chat/pre-feature actions

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The judgement mechanism itself - without this, no user story's verdict (resolved/unsure/still-open) can be produced or tested.

- [X] T003 [P] Add `judgeChatResolution(resolutionAsk: string, deltaText: string): Promise<"resolved" | "unsure" | "still-open">` to `backend/src/claude/claude-cli.service.ts`. Prompt for exactly one of the three words (style of the existing `areSameTask()`); parse defensively. Per contracts/reconcile-and-claude.md, this method itself may throw or return unparseable output - it does NOT catch/downgrade internally, that's the caller's job (T007).
- [X] T004 In `backend/src/actions/actions.repository.ts`: widen `NewAction` + the `insert()` SQL to accept `resolution_ask`; widen `setDigestFields()`'s `Pick<Action, ...>` type + its `UPDATE` SQL to also accept `resolution_ask`, `status`, `resolved_at` (mirrors how `title_pinned` was added in feature 004). Update `toAction()` if needed for the new column.
- [X] T005 [P] In `backend/src/sources/sources.service.ts`: add `chatDelta: Map<string, string>` to `collect()`'s return type, populated only when `type === "chat"` (key = `item.sourceUrl`, value = `item.rawText`, from the existing `rawItems` loop - no new fetch). Thread `chatDelta` through `sync()` and `syncAll()` into their `reconcile.reconcile(...)` calls (new 3rd argument, default `new Map()` for other sources).
- [X] T006 In `backend/src/sources/reconcile.service.ts`: on new chat-action `insert()` and on merge into `existingOpen` for a chat action, set/refresh `resolution_ask` from `primary.extracted.description` (research.md #1, #2). Non-chat candidates are unaffected (field stays unset/null).
- [X] T007 In `backend/src/sources/reconcile.service.ts`: add `resolveChatActions(candidates, chatDelta)`. For every `status === "open"`, `source_type === "chat"` action with non-null `resolution_ask` whose `source_url` is a key in `chatDelta`: skip if its `dedup_key` is already present among this sync's candidates (FR-007); otherwise call `judgeChatResolution(action.resolution_ask, chatDelta.get(action.source_url))` wrapped in try/catch - `"resolved"` closes it (`setDigestFields(id, { status: "done", resolved_at: new Date().toISOString() })`), `"unsure"` sets `stale_review: true`, anything else (including a caught error or unparseable output) is a no-op. Return a `Set<string>` of every action id considered (regardless of verdict). Call this from `reconcile()` right after the create/merge loop, before `flagStale()`.
- [X] T008 In `backend/src/sources/reconcile.service.ts`: give `flagStale()` a new `handledIds: Set<string>` parameter; skip any action whose id is in it. Add `actions_resolved: number` to `ReconcileResult` (count of chat actions `resolveChatActions()` closed) and return it from `reconcile()`.
- [X] T009 [P] Extend `fakeClaude()` in `backend/test/helpers.ts` with a default `judgeChatResolution` stub (returning `"still-open"` unless a test overrides it) so every existing test using `fakeClaude()` keeps compiling and passing unmodified.
- [X] T010 Run `npm run build` in `backend/` to confirm the foundational wiring compiles clean before writing story tests.

**Checkpoint**: The judgement mechanism exists end-to-end; each user story below is now just test coverage of one branch of `resolveChatActions()`.

---

## Phase 3: User Story 1 - A handled chat ask closes itself (Priority: P1) 🎯 MVP

**Goal**: A clearly-answered chat action closes itself on the next sync, regardless of who answered it.

**Independent Test**: Seed an open chat action with a `resolution_ask`; run `reconcile()` with a `chatDelta` entry for its thread whose fake-`claude` verdict is `"resolved"`; assert `status === "done"` and `resolved_at` is set.

### Tests for User Story 1

- [X] T011 [P] [US1] In `backend/test/resolution.test.ts`: a delta the fake `claude` judges `"resolved"` closes the action (`status: "done"`, `resolved_at` set) (spec Acceptance Scenario 1)
- [X] T012 [P] [US1] In `backend/test/resolution.test.ts`: the same close happens when the fake `claude`'s resolved verdict is driven by a delta message attributed to someone other than the reader (spec Acceptance Scenario 2 - resolution is content-based, not sender-based)

### Verification for User Story 1

- [X] T013 [US1] Run `npm test` in `backend/`; confirm both T011/T012 cases pass (depends on T011, T012)

**Checkpoint**: User Story 1 is independently verified - the core "resolved closes it" path works.

---

## Phase 4: User Story 2 - An ambiguous delta gets flagged, not guessed (Priority: P1)

**Goal**: An ambiguous delta never auto-closes the action; it flags for review, and a later clear delta can still resolve it.

**Independent Test**: Seed an open chat action; run `reconcile()` with a fake-`claude` verdict of `"unsure"`; assert `status` stays `"open"` and `stale_review === true`. Then run again with a `"resolved"` verdict; assert it now closes despite the prior flag.

### Tests for User Story 2

- [X] T014 [P] [US2] In `backend/test/resolution.test.ts`: a delta the fake `claude` judges `"unsure"` sets `stale_review: true` and leaves `status: "open"` (spec Acceptance Scenario 1)
- [X] T015 [P] [US2] In `backend/test/resolution.test.ts`: an action already `stale_review: true` from a prior sync is still eligible for judgement, and a later delta judged `"resolved"` closes it normally (spec Acceptance Scenario 2 - `resolveChatActions()` must not skip `stale_review` actions the way `flagStale()` does)

### Verification for User Story 2

- [X] T016 [US2] Run `npm test` in `backend/`; confirm both T014/T015 cases pass (depends on T014, T015)

**Checkpoint**: User Stories 1 and 2 both work independently - resolved and unsure are both handled correctly, including the flag-then-resolve sequence.

---

## Phase 5: User Story 3 - A new/different ask doesn't close the original (Priority: P2)

**Goal**: A new or materially different ask appearing in a thread that already has an open action never causes that original action to be closed by this feature; it's handled by the existing dedup-key merge/create logic instead.

**Independent Test**: Seed an open chat action; run `reconcile()` with a candidate on the same thread whose `dedup_key` matches (or differs from) the existing action; assert the original action is never closed by `resolveChatActions()`, and the pre-existing merge/create behavior determines the outcome.

### Tests for User Story 3

- [X] T017 [P] [US3] In `backend/test/resolution.test.ts`: a candidate in this sync's delta with a `dedup_key` matching an existing open chat action updates that action (via the existing merge path, `resolution_ask` refreshed per T006) - `resolveChatActions()` must skip it (already handled), not judge it (spec Acceptance Scenario 1)
- [X] T018 [P] [US3] In `backend/test/resolution.test.ts`: a candidate with a genuinely different `dedup_key` on the same thread creates a new action, and the original, unrelated open action is left completely untouched - not closed, not flagged (spec Acceptance Scenario 2)

### Verification for User Story 3

- [X] T019 [US3] Run `npm test` in `backend/`; confirm both T017/T018 cases pass (depends on T017, T018)

**Checkpoint**: All three user stories are independently functional and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Invariants that span all stories (FR-005, FR-009, FR-010) rather than belonging to one.

- [X] T020 [P] In `backend/test/resolution.test.ts`: a `"still-open"` verdict is a no-op - `status`, `stale_review`, and `resolution_ask` are all unchanged (FR-005)
- [X] T021 [P] In `backend/test/resolution.test.ts`: `judgeChatResolution` throwing, and `judgeChatResolution` returning unparseable output, are both treated as a no-op and do not fail the rest of the sync (FR-010, research.md #3)
- [X] T022 [P] In `backend/test/resolution.test.ts`: an email- or meeting-notes-sourced open action is unaffected by this feature - `flagStale()` behavior for it is byte-for-byte the same as before (FR-009)
- [X] T023 Run `npm test` and `npm run build` in `backend/` once more to confirm the full suite (existing 27+ tests plus all new resolution tests) is green together
- [ ] T024 [P] Manually run `specs/005-chat-action-resolution/quickstart.md` scenarios S1-S5 against a live Google Chat sync. **Cannot be executed in this environment** (needs a live chat reply and the real `claude` CLI in the loop) - mark as pending manual verification.

## Dependencies & Execution Order

- **Setup (T001-T002)**: No dependencies - can start immediately, both parallel.
- **Foundational (T003-T010)**: Depends on Setup. T003, T004, T005 touch different files and can run in parallel; T006 depends on T004 (needs the widened repository) and T005 (needs `chatDelta` to exist as a concept, though it's consumed later in T007); T007 depends on T003 (judgement method), T004, T006; T008 depends on T007 (needs `handledIds`); T009 is independent, parallel with T003-T008; T010 (build) depends on all of T003-T009. **This phase blocks all user stories.**
- **User Story 1 (T011-T013)**: Depends on Foundational completion only. No dependency on US2/US3.
- **User Story 2 (T014-T016)**: Depends on Foundational completion only. Independently testable of US1/US3 (though it shares the same `resolution.test.ts` file, so its own test-writing tasks should land after US1's are committed to avoid clobbering, even though both are conceptually parallel-safe).
- **User Story 3 (T017-T019)**: Depends on Foundational completion only.
- **Polish (T020-T024)**: Depends on all three user stories being complete (exercises invariants across all of them).

## Parallel Example: Foundational phase

```text
Task: "Add judgeChatResolution to backend/src/claude/claude-cli.service.ts" (T003)
Task: "Widen actions.repository.ts for resolution_ask/status/resolved_at" (T004)
Task: "Add chatDelta plumbing to sources.service.ts" (T005)
Task: "Extend fakeClaude() in backend/test/helpers.ts" (T009)
```

## Implementation Strategy

### MVP First (User Story 1 only)
1. Complete Phase 1 (Setup) + Phase 2 (Foundational) - the judgement mechanism must exist before anything is testable.
2. Complete Phase 3 (US1) - the core "resolved closes it" behavior, the entire point of this feature per the brief.
3. **STOP and VALIDATE**: `npm test` green for US1's cases; this alone already delivers the user-visible fix.

### Incremental Delivery
1. Setup + Foundational -> mechanism ready, nothing user-visible changes yet (no story tests exist).
2. Add US1 -> the primary "it just closes" behavior is live and tested (MVP).
3. Add US2 -> the safety net (never wrongly auto-close) is verified.
4. Add US3 -> the "new ask" correctness guarantee is verified.
5. Polish -> cross-cutting invariants (FR-005/009/010) plus the full-suite regression check and the manual live-sync quickstart.

## Notes

- All tasks operate on the backend only - no frontend changes (per brief/plan, out of scope for v1).
- `resolution.test.ts` is written incrementally across US1/US2/US3/Polish; since they share one file, land each story's test-writing tasks as its own commit/step even where marked `[P]` for conceptual independence, to avoid merge noise within the same file.
- T024 (manual quickstart) is explicitly called out as not executable by an agent in this environment, consistent with how features 001-004 handled their live-sync-dependent manual scenarios.
