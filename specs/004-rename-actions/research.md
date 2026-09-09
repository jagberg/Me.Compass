# Research: Rename actions

No open unknowns from the spec required investigation; the feature reuses
established patterns from features 002/003. Decisions recorded for the record.

## Decision 1: Protect a user rename with a `title_pinned` flag

- **Decision**: Add a boolean `title_pinned` column on `action`. Set it true
  whenever the user saves a title edit. The reconcile/merge step skips updating
  the title of any action whose `title_pinned` is true.
- **Rationale**: This exactly mirrors the existing `category_pinned` mechanism
  (FR-020 of feature 003), which already protects an explicit user category
  choice from being re-filed on sync. Reusing the same pattern keeps the guard
  consistent and easy to reason about.
- **Alternatives considered**: (a) storing the original extracted title and
  diffing to detect a manual change — more state, ambiguous when extraction
  legitimately changes; (b) a separate `user_title` field layered over the
  extracted title — two title columns to keep in sync for no user benefit,
  since v1 fully replaces the title.

## Decision 2: Reject blank titles at the update path

- **Decision**: The service update path rejects a title that is empty or
  whitespace-only and leaves the previous title unchanged.
- **Rationale**: A blank title would make the board unreadable; validation
  belongs at the write boundary, not the UI alone.
- **Alternatives considered**: UI-only guard — insufficient, the API must not
  accept a blank title regardless of client.

## Decision 3: Migration numbering

- **Decision**: New migration file `003_rename_actions.sql` (next in the
  migrations sequence after `002_action_digest.sql`), applied once via the
  existing `schema_migrations` ledger.
- **Rationale**: `ALTER TABLE ADD COLUMN` is not idempotent; the ledger added
  in feature 003 already handles run-once semantics.

## Decision 4: Automated tests (backend node:test, frontend Vitest)

- **Decision**: Introduce automated tests. Backend: built-in `node:test` +
  `node:assert`, run with `tsx` as the loader (`node --import tsx --test`).
  Frontend: Vitest + @testing-library/react + @testing-library/user-event +
  jsdom, high-level component tests with the `api` module mocked. `quickstart.md`
  stays as a manual smoke pass.
- **Rationale**: Tests were deemed critical. `node:test` is built into Node so
  the backend runner adds no dependency; `tsx` is needed only because the code
  uses NestJS experimental decorators that Node's native `.ts` type-stripping
  does not execute (it strips types but does not run legacy decorators). Vitest
  reuses the frontend's existing Vite toolchain, so it's the lightest way to get
  high-level component tests.
- **Alternatives considered**: (a) native `node --test` with type-stripping and
  no `tsx` — rejected, the NestJS decorators on imported classes fail under
  native stripping; (b) compile-then-test (`tsc` then run `node --test` on
  `dist`) — works but adds a build step and mixes test output into `dist`;
  (c) Jest — heavier, several dependencies and config, and duplicates a runner
  Node already ships; (d) Playwright E2E for the frontend — higher fidelity but
  heavier, and sync-triggering journeys are nondeterministic due to AI calls, so
  deferred.
- **Coverage scope**: this feature (rename update-path validation, `title_pinned`
  guard) plus a backfill of the highest-value existing logic — reconcile
  dedup/suppress/merge, the FR-021 urgency comparator, the destination resolver,
  and the extraction ownership rules where they can be exercised as pure helpers.

## Decision 5: Manual quickstart retained alongside tests

- **Decision**: Keep `quickstart.md` (S1–S6) as a manual end-to-end smoke pass.
- **Rationale**: The automated tests cover units/flows with the AI and Google
  edges stubbed; a quick manual pass against the live app still catches
  integration/UX issues the stubs hide.
