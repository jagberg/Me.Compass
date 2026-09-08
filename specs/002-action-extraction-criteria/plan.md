# Implementation Plan: Action Extraction Criteria

**Branch**: `002-action-extraction-criteria` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-action-extraction-criteria/spec.md`

## Summary

The extraction step used across all three sources (email, chat, meeting notes) currently
has no real criteria for what counts as an actionable item - the existing prompt only says
"actionable to-dos owed by the reader," which was never deliberately scoped. This feature
rewrites that prompt's criteria so it: (1) captures explicit asks of the user and
commitments the user made themselves, (2) excludes items assigned solely to others, and
(3) is biased toward recall - ambiguous items are included rather than silently dropped.
No change to the extraction mechanism itself (still a local Claude CLI subprocess call, no
new persistence, no new UI).

## Technical Context

**Language/Version**: TypeScript 5.5, Node.js (commonjs), NestJS 10

**Primary Dependencies**: `@nestjs/common`, `@nestjs/core` - no new dependency needed;
this feature is a prompt-content change inside the existing `ClaudeCliService`

**Storage**: SQLite via `node:sqlite` (unchanged - no schema change, `Action` entity as-is)

**Testing**: N/A - no test framework is present in `backend/` today; verification is manual,
per the spec's Success Criteria (sample-batch review), consistent with existing project
convention

**Target Platform**: Local single-user machine (Docker), per constitution Principle I

**Project Type**: Web application (existing `backend/` + `frontend/` split); this feature
touches `backend/` only

**Performance Goals**: N/A - no new performance requirement; extraction already runs
per-item during a manual sync, this feature does not change call volume or timing

**Constraints**: Must continue routing all AI calls through the local `claude` CLI
subprocess (constitution Principle II) - no Anthropic API key or new billing path

**Scale/Scope**: Single user, existing sync volume (≤25 emails / 20 chat messages per space
/ Drive docs with a "next steps" section per sync run) - unchanged by this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Local-First | PASS | No cloud dependency introduced; runs on existing local Docker setup |
| II. No Separate AI Billing | PASS | FR-005 requires the existing local Claude CLI subprocess mechanism stays unchanged |
| III. Modular by Construction, Not by Scaffolding | PASS | Change is scoped to the existing `ClaudeCliService` prompt; no new module or plugin framework introduced |
| IV. Review Before Action | PASS | This feature only affects which items become `Action` rows for the user to see/triage in the app; it does not add any AI-triggered send/execute side effect |
| V. Simplicity Over Speculative Infrastructure | PASS | No schema change, no ORM, no new abstraction - `node:sqlite` and the `Action` entity are reused as-is |

No violations. Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-action-extraction-criteria/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature has no new external interface (no new API endpoint,
no new request/response shape) - it changes the criteria inside an existing internal prompt.

### Source Code (repository root)

```text
backend/
├── src/
│   ├── claude/
│   │   └── claude-cli.service.ts   # extractActions() prompt criteria - the actual change
│   ├── sources/
│   │   └── sources.service.ts      # orchestrator that calls extractActions() - unchanged, referenced only
│   └── actions/
│       └── actions.repository.ts   # Action persistence - unchanged, referenced only
└── (no test directory exists today - see Technical Context: Testing)

frontend/
└── (unaffected by this feature)
```

**Structure Decision**: Existing web application structure (`backend/` + `frontend/`) is
reused unchanged. This feature is entirely within `backend/src/claude/claude-cli.service.ts`;
no new files, directories, or modules are created.

## Complexity Tracking

*Not applicable - no Constitution Check violations.*
