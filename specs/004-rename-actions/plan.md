# Implementation Plan: Rename actions

**Branch**: `004-rename-actions` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-rename-actions/spec.md`

## Summary

Let the user edit an action's title inline on the board and have that edit
treated as authoritative. Add a per-action "title was set by the user" flag
(`title_pinned`, mirroring `category_pinned`); the reconcile/merge step must
not overwrite the title of any action whose flag is set. Widen the action
update path to accept a non-blank `title` (setting the flag), and add an inline
title editor to the board line.

## Technical Context

**Language/Version**: TypeScript 5.5, Node 22 (backend), React 18 + Vite (frontend)

**Primary Dependencies**: NestJS 10 (Fastify), `node:sqlite`; React

**Storage**: SQLite via `node:sqlite`, migrations as `*.sql` run once via the
`schema_migrations` ledger

**Testing**: Automated tests are now required (this feature and a backfill of
the risky existing logic). Backend: built-in `node:test` + `node:assert`, run
via `tsx` as the loader (`node --import tsx --test`) because the code uses
NestJS experimental decorators that Node's native TS type-stripping does not
execute. Frontend: Vitest + @testing-library/react + @testing-library/user-event
+ jsdom, high-level component tests with the api module mocked. `quickstart.md`
remains as a manual smoke pass.

**Target Platform**: Local single-user web app (backend serves built frontend)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: N/A (single user, interactive)

**Constraints**: Local-first; no new external service or AI call; a rename must
never be clobbered by a sync

**Scale/Scope**: One new nullable column, one widened update path, one UI editor

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Local-First**: PASS — no cloud, no auth, no multi-user surface added.
- **II. No Separate AI Billing**: PASS — feature makes no AI call at all.
- **III. Modular by Construction**: PASS — extends the existing actions module;
  no speculative framework.
- **IV. Review Before Action**: PASS — renaming is a direct user edit, not an
  AI-triggered side effect; nothing is sent or executed.
- **V. Simplicity**: PASS — one boolean column and a guard in the existing
  reconcile step; no ORM, no new abstraction. The test tooling added here is a
  concrete present need (tests deemed critical), not speculative infrastructure:
  the backend runner is built into Node (`node:test`), with `tsx` as the only
  new backend dev dependency; the frontend reuses its existing Vite via Vitest.

No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/004-rename-actions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md            # created by /speckit-tasks
```

### Source Code (repository root)

```text
backend/src/
├── db/migrations/003_rename_actions.sql   # ADD COLUMN title_pinned
├── types/index.ts                          # Action.title_pinned
├── actions/
│   ├── actions.repository.ts               # persist/update title + title_pinned
│   ├── actions.service.ts                  # update() accepts title, rejects blank, sets flag
│   └── actions.controller.ts               # PATCH body accepts title
└── sources/reconcile.service.ts            # merge branch: keep title if title_pinned

frontend/src/
├── api/types.ts                            # Action.title_pinned
├── api/actions.ts                          # updateAction accepts title
└── components/ActionLine.tsx               # inline title editor

backend/test/                               # node:test (.test.ts), run via tsx
├── rename.test.ts                          # update-path validation + title_pinned
├── reconcile.test.ts                       # dedup / suppress / merge / title guard
├── extraction-rules.test.ts               # directed-at-other + general-group rules (pure helpers where possible)
├── destination.test.ts                     # JIRA / ESS / source resolution
└── comparator.test.ts                      # FR-021 urgency ordering

frontend/test/ (or *.test.tsx next to components)   # Vitest + Testing Library
├── ActionLine.test.tsx                     # rename inline, blank reject, done, open destination
└── CategoryBoard.test.tsx                  # grouping + urgency badge
```

**Structure Decision**: Existing web-app layout (features 001–003). The change
is confined to the actions module (backend), the reconcile merge branch, and
the board line component (frontend). Migration is numbered `003` (next after
`002_action_digest`; migrations use their own sequence, not the feature number).

## Complexity Tracking

No constitution violations; no entries.
