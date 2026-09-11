# Implementation Plan: Chat action resolution detection

**Branch**: `005-chat-action-resolution` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-chat-action-resolution/spec.md`

## Summary

Add a `resolution_ask` column on `action`, captured (as a snapshot of the extraction's `description`, not a new AI call) whenever a chat action is created or its identity re-merges. Extend `sources.service.ts`'s per-source `collect()` to also return a `chatDelta: Map<sourceUrl, rawText>` for chat items. Extend `reconcile()` with a new step, `resolveChatActions()`, that runs before `flagStale()`: for every open chat action whose thread appears in `chatDelta` this sync but whose `dedup_key` was NOT already handled by the create/merge loop, send `(resolution_ask, deltaText)` to a new `ClaudeCliService.judgeChatResolution()` method and act on its verdict (resolved -> close; unsure -> `stale_review`; still-open/unparseable/error -> no-op). `flagStale()` is given the set of action ids `resolveChatActions()` already decided about, so the two mechanisms never fight over the same action in one sync.

## Technical Context

**Language/Version**: TypeScript 5.5, Node.js v24.20.0 (backend), NestJS 10 (Fastify)

**Primary Dependencies**: `googleapis` (already used by `ChatClient`), local `claude` CLI subprocess (via `ClaudeCliService`) - no new dependency

**Storage**: SQLite via `node:sqlite` (`DatabaseSync`), no ORM - new column via a plain `ALTER TABLE` migration, consistent with 001-005

**Testing**: `node --import tsx --test` (backend), fake `claude` client per `backend/test/helpers.ts` (`fakeClaude()`) - extended with a fake `judgeChatResolution`

**Target Platform**: Local single-user desktop (Windows), Docker-packaged - unchanged

**Project Type**: Web application (NestJS backend + React frontend); this feature is backend-only, no frontend change

**Performance Goals**: N/A (single-user, low volume; bounded by the existing `EXTRACT_CONCURRENCY = 4` pattern - no new concurrency control introduced, per brief's explicit scope cut)

**Constraints**: No full-thread re-fetch (judgement only ever sees the delta `ChatClient.fetchSince()` already retrieved); no new AI billing path (routes through the existing local `claude` CLI); chat-only, email/meeting-notes (Drive) untouched

**Scale/Scope**: Single user's own chat spaces; observed volumes this session were low tens of open chat actions at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Local-First | No cloud backend added; runs in the existing Docker/local process | PASS |
| II. No Separate AI Billing | Judgement reuses the existing `claude` CLI subprocess mechanism (`ClaudeCliService`); ask-capture uses no AI call at all (see research.md) | PASS |
| III. Modular by Construction | Extends the existing `ReconcileService`/`ChatClient`/`ClaudeCliService` seam; no new module or plugin framework | PASS |
| IV. Review Before Action | An "unsure" verdict never auto-closes - it falls back to the existing `stale_review` human-review mechanism; only a clearly "resolved" verdict closes, and that verdict itself came from an explicit judgement step, not a silent side effect | PASS |
| V. Simplicity Over Speculative Infrastructure | `resolution_ask` is a plain column, no new table; judgement reuses the dedup_key merge logic for new asks (FR-007) instead of a second matching mechanism | PASS |

No violations; Complexity Tracking section is not needed.

**Post-design re-check** (after Phase 1): unchanged - the data model and contracts below introduce one column and one new internal method signature, nothing that revisits this table.

## Project Structure

### Documentation (this feature)

```text
specs/005-chat-action-resolution/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks - not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/migrations/
│   │   └── 006_resolution_ask.sql          # NEW - adds action.resolution_ask
│   ├── actions/
│   │   ├── actions.repository.ts            # MODIFY - setDigestFields/update widen for resolution_ask, and for status+resolved_at via setDigestFields (new)
│   │   └── ...                              # (actions.service.ts, controller unchanged - no API surface change)
│   ├── sources/
│   │   ├── chat.client.ts                   # unchanged (already emits delta rawText + room/ URL)
│   │   ├── sources.service.ts                # MODIFY - collect() also returns chatDelta map; sync()/syncAll() pass it through
│   │   └── reconcile.service.ts              # MODIFY - capture resolution_ask on insert/merge; new resolveChatActions() step; flagStale() takes a handled-ids exclusion set
│   └── claude/
│       └── claude-cli.service.ts             # MODIFY - new judgeChatResolution(resolutionAsk, deltaText) method
└── test/
    ├── helpers.ts                            # MODIFY - fakeClaude() gains a default judgeChatResolution
    └── resolution.test.ts                    # NEW - resolved / unsure / still-open / new-ask-in-delta / non-chat-unaffected cases

frontend/
└── (no changes - out of scope per brief)
```

**Structure Decision**: Single existing NestJS backend project (`backend/src/...`), matching every prior feature (001-004). No frontend change - this feature has no UI surface (per brief: no audit-trail distinction in v1). All new logic lives in the existing `sources`/`actions`/`claude` modules; no new NestJS module is introduced (Constitution III).

## Complexity Tracking

*No constitution violations - this section is not applicable.*
