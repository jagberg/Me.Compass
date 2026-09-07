# Implementation Plan: Personal Action Manager

**Branch**: `001-personal-action-manager` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-personal-action-manager/spec.md`

## Summary

Local, single-user dashboard that pulls owed actions from Gmail, Google Drive/Gemini meeting
notes, and Google Chat (plus manual entry) into one SQLite-backed list, flags overdue items,
uses the local Claude Code CLI to extract actions and infer missing due date/priority during
sync, and lets the user Run (draft/perform, review-only) a suggested next step per action.
Backend: NestJS (Fastify adapter) serving both a REST API and the built React frontend from one
Docker container. Storage: `node:sqlite`, no ORM. No separate AI billing — every AI call shells
out to the `claude` CLI as a subprocess.

## Technical Context

**Language/Version**: TypeScript 5.x end-to-end, Node.js 24 (LTS) — `node:sqlite` is stable
flag-free from Node ~22.13+; pinning to 24 avoids version-drift edge cases.

**Primary Dependencies**: NestJS (`@nestjs/platform-fastify`), React 18 + Vite, `googleapis`
(Gmail, Drive, Chat clients), `node:sqlite` (built-in, no ORM).

**Storage**: SQLite via `node:sqlite`, single file under a Docker volume, plain `.sql` migration
files run with `CREATE TABLE IF NOT EXISTS` at startup — no ORM, no migration framework.

**Testing**: Jest + Supertest (NestJS default, backend unit + e2e), Vitest + React Testing
Library (Vite default, frontend).

**Target Platform**: Single Docker container (Linux), accessed via `localhost` in a browser.

**Project Type**: Web application (backend + frontend), one deployable container.

**Performance Goals**: N/A beyond a responsive local UI (<200ms for local reads); single user,
low request volume — not a target-setting concern for this feature.

**Constraints**: Offline-tolerant to external API hiccups (stored actions must stay visible if a
source sync fails); Claude CLI subprocess calls MUST run with a timeout so a hang never appears
as a silent success; Run MUST NOT send/execute anything, only surface a result.

**Scale/Scope**: Single user, expected backlog in the tens of open actions (steady-state target
<10, see SC-005), three source integrations, one dashboard.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Local-First | Single Docker container, no cloud backend, no auth layer planned | PASS |
| II. No Separate AI Billing | All inference/extraction/Run calls shell out to local `claude` CLI subprocess; no Anthropic API key introduced | PASS |
| III. Modular by Construction | Action-management is one NestJS module (`ActionsModule`); no plugin framework scaffolded | PASS |
| IV. Review Before Action | Run only ever writes a `RunResult` for review; nothing is sent/executed by the system (FR-013) | PASS |
| V. Simplicity Over Speculative Infrastructure | `node:sqlite`, no ORM, plain SQL migrations | PASS |

No violations — Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-personal-action-manager/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── actions/            # ActionsModule: controller, service, repository (raw node:sqlite)
│   ├── sources/             # SourceConnection module: Gmail/Drive/Chat clients + sync orchestration
│   ├── claude/               # ClaudeCliService: subprocess wrapper (extract/infer/run), shared by actions + sources
│   ├── db/                   # node:sqlite connection + .sql migration runner
│   └── main.ts                # Nest bootstrap (Fastify adapter), serves built frontend as static assets
└── test/
    ├── unit/
    └── e2e/

frontend/
├── src/
│   ├── components/            # NextStepsList, SourceGroup, ActionCard, ViewToggle (list/2x2)
│   ├── pages/                  # Dashboard
│   └── api/                     # typed fetch client against backend/contracts/api.md
└── test/

docker-compose.yml               # single `app` service, builds backend+frontend, mounts SQLite volume
Dockerfile                        # multi-stage: build frontend -> copy into backend -> run
```

**Structure Decision**: Web application split (Option 2), `backend/` (NestJS) + `frontend/`
(React/Vite), built into one Docker image/container — no second container or reverse proxy,
consistent with Principle I (local-first, minimal moving parts).

## Complexity Tracking

*No violations — table intentionally empty.*
