# Implementation Plan: Action Digest

**Branch**: `003-action-digest` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-action-digest/spec.md`; integration surface
from [exploration-map.md](./exploration-map.md); design decisions from
`docs/design/action-views-prototypes.md`.

## Summary

Turn the raw, duplicated action stream into a trustworthy digest. Five moving parts, one
feature: (1) chat extraction reads a whole thread/space (not per message); (2) a post-fetch
reconcile pass de-duplicates within and across sources; (3) a `requested_by` field records who
is asking; (4) a user-maintained category taxonomy files actions, with an Uncategorised bucket;
(5) a priority-first category board replaces the source-grouped dashboard body. Plus stale-state
weighting on long threads and content-conflict surfacing. The exploration flagged two pieces of
prerequisite groundwork: a **migrations ledger** (the runner re-execs every `.sql` on boot, so
`ALTER TABLE ADD COLUMN` is not safe), and a **sync-all + reconcile seam** (today inserts happen
inline per item and `sync()` runs per-source, so cross-source merge has nowhere to live).

## Technical Context

**Language/Version**: TypeScript 5.5, Node.js (commonjs), NestJS 10 (backend); React 18 + Vite
(frontend).

**Primary Dependencies**: `@nestjs/common`/`core`, `googleapis`; React. No new runtime dependency
anticipated - merge/dedup and requester attribution ride the existing local Claude CLI call.

**Storage**: SQLite via `node:sqlite`, no ORM. New: a `schema_migrations` ledger, a `category`
table, and new columns on `action` (`requested_by`, `category_id`, a dedup/merge key).

**Testing**: N/A - no test framework present in the repo; verification is manual via
`quickstart.md`, consistent with features 001/002 and the constitution's simplicity principle.

**Target Platform**: Local single-user machine (Docker), per constitution Principle I.

**Project Type**: Web application (`backend/` + `frontend/`); this feature touches both.

**Performance Goals**: N/A beyond existing sync volumes; the reconcile pass runs over a single
sync's actions plus existing open actions, not at scale.

**Constraints**: Keep manual-sync trigger and the local Claude CLI subprocess (Principles I, II);
Run drafts only, never sends (Principle IV); no ORM / no speculative abstraction (Principle V).

**Scale/Scope**: Single user; tens of actions per sync; a handful of categories.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Local-First | PASS | No cloud dependency; all new state in local SQLite |
| II. No Separate AI Billing | PASS | Merge, requester, categorisation reuse the local Claude CLI; no API key |
| III. Modular by Construction, Not by Scaffolding | PASS (watch) | A new `categories` module and a reconcile step are concrete present needs, not speculative scaffolding. No generic plugin framework is built. The reconcile seam is the one place to keep minimal - see Complexity Tracking |
| IV. Review Before Action | PASS | Run still drafts for review (FR-010); merges and categorisation are user-correctable (FR-007, FR-013), never silently authoritative |
| V. Simplicity Over Speculative Infrastructure | PASS (watch) | The migrations ledger and dedup key are the minimum needed to add columns safely and anchor merges - justified below, not speculative |

No unjustified violations. See Complexity Tracking for the two "watch" items.

## Project Structure

### Documentation (this feature)

```text
specs/003-action-digest/
├── plan.md                 # This file
├── exploration-map.md      # Integration-surface investigation (Phase -1 input)
├── research.md             # Phase 0 output
├── data-model.md           # Phase 1 output
├── quickstart.md           # Phase 1 output
├── contracts/
│   └── api.md              # Phase 1 output - new/changed endpoints
└── tasks.md                # Phase 2 (/speckit-tasks, not this command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   ├── migrate.ts               # add a schema_migrations ledger (prerequisite)
│   │   └── migrations/
│   │       └── 002_action_digest.sql  # category table + action columns (idempotent via ledger)
│   ├── actions/
│   │   ├── actions.repository.ts    # add fields to insert/mapper/update whitelist
│   │   ├── actions.service.ts       # group_by=category; re-file; split-merge
│   │   └── actions.controller.ts    # group_by=category branch; category PATCH
│   ├── categories/                  # NEW module: taxonomy CRUD + filing rules
│   │   ├── categories.controller.ts
│   │   ├── categories.service.ts
│   │   └── categories.repository.ts
│   ├── sources/
│   │   ├── chat.client.ts           # thread/space-aware transcript assembly
│   │   └── sources.service.ts       # sync-all entrypoint + post-fetch reconcile seam
│   └── claude/
│       └── claude-cli.service.ts    # requested_by in ExtractedAction + prompt; conflict flag
└── (no test dir - see Technical Context)

frontend/
└── src/
    ├── pages/Dashboard.tsx          # board replaces the source-grouped body
    ├── components/                  # CategoryColumn (from SourceGroup); board line; play button; view switch
    └── api/                         # category endpoints; requested_by/category on types
```

**Structure Decision**: Existing web-app layout reused. One new backend module (`categories/`)
and a set of edits threaded through the existing sync → extract → persist → display path. No new
top-level projects.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| `schema_migrations` ledger in `migrate.ts` | The runner re-execs every `.sql` on each boot; a plain `ALTER TABLE ADD COLUMN` throws "duplicate column" on the second start. A ledger (run-once tracking) is the minimum safe way to add the needed columns | Guarding each ALTER with a column-existence check works but spreads fragile conditionals through every future migration; a one-time ledger is simpler over the feature's life |
| Post-fetch reconcile seam + a dedup key on actions | Cross-source merge is impossible inline (inserts happen per item; `sync()` runs per source). A collect-then-reconcile step and a stable key to match candidates are the minimum structure that makes FR-002 achievable | Merging purely at read time (compute groups on GET) was considered but leaves the DB full of duplicate rows, breaks `today`/counts, and can't persist a user's merge corrections (FR-013) |

Both are concrete, present needs created by this feature's requirements - not speculative
infrastructure - and are kept to the minimum shape that satisfies the spec.
