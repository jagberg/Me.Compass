# Phase 0 Research: Personal Action Manager

## Decision: Action extraction happens at sync time, via the same Claude CLI call as due-date/priority inference

**Rationale**: FR-001 requires raw source content (emails, meeting-note docs, chat messages)
become "unified action records" with no manual re-entry — something must decide which raw items
are actually actionable. Per Principle II, that decision must go through the local Claude CLI,
not a bespoke NLP heuristic. Folding extraction and inference into one call (per raw item: is
this actionable? if so, title/description/suggested_next_step/due_date/priority) avoids a
second AI pass and keeps the sync pipeline single-shot per item.

**Alternatives considered**: keyword/heuristic filtering before AI (rejected — reinvents what
Claude already does well, and risks false negatives silently dropping real asks); a separate
"classify" then "infer" call per item (rejected — doubles subprocess calls for no accuracy gain
the constitution or spec asks for).

## Decision: Claude CLI invoked non-interactively via `claude -p --output-format json`

**Rationale**: The CLI's print mode (`-p`/`--print`) with `--output-format json` gives a single
structured stdout payload suitable for parsing, no TTY/session state. Backend spawns it via
Node's `child_process.execFile` (not `exec`, to avoid shell interpolation of item content),
passing source content via stdin rather than an argv string, with a hard timeout (e.g. 30s) so a
hang surfaces as a failed Run/sync rather than an indefinite spinner (per Edge Case: "Run but the
local Claude CLI is not available or fails mid-run").

**Alternatives considered**: Anthropic SDK direct API call (rejected — violates Principle II,
separate billing); interactive PTY session reuse across calls (rejected — no requirement for
conversational state between actions, adds process-lifecycle complexity for no benefit).

## Decision: `node:sqlite` on Node 24, plain `.sql` files run idempotently at boot

**Rationale**: `node:sqlite` (`DatabaseSync`) is available flag-free from Node ~22.13+; pinning
the Docker base image to Node 24 avoids chasing the exact minor version where the flag was
dropped. Migrations are simply `CREATE TABLE IF NOT EXISTS ...` statements executed once at
process start — no migration framework, no ORM, per Principle V.

**Alternatives considered**: Prisma/TypeORM (rejected — explicitly excluded by Principle V);
`better-sqlite3` (rejected — a dependency doing what a Node built-in now does).

## Decision: One Docker container, NestJS serves the built React app as static files

**Rationale**: Principle I favors the fewest moving parts for a single-user local tool. NestJS's
Fastify adapter can serve a `dist/` static build directly, so one container/process handles both
API and UI — no nginx, no second service, no CORS configuration needed since same-origin.

**Alternatives considered**: separate frontend/backend containers behind a reverse proxy
(rejected — adds infra for a single local user with no scaling need).

## Decision: Google API auth — installed-app OAuth flow, one-time per source, tokens on local disk

**Rationale**: Gmail, Drive, and Chat all support the standard OAuth "installed application"
flow (loopback redirect) for a personal Google account; exact scopes are
`gmail.readonly`, `drive.readonly` (or a doc/comments scope sufficient to read a Gemini
meeting-notes doc's "Next steps" section), and `chat.messages.readonly`. Tokens are persisted
to a local file (mounted volume), refreshed via the standard refresh-token flow — no interactive
re-auth needed after first connect. Per the spec's Key Entities section, exact connect-flow UX
is explicitly deferred; this decision only fixes the underlying auth mechanism enough to build
against.

**Alternatives considered**: service account / domain-wide delegation (rejected — requires
Workspace admin rights not guaranteed to be available, and is overkill for one personal user
authorizing their own data).

**Open risk carried forward (not blocking)**: Google Chat API access for a non-bot, personal-use
case may require the account to be on Google Workspace (not consumer Gmail) — flagged in the
brief's Open Questions already; if it turns out to be unavailable, Chat becomes a stubbed/absent
`SourceConnection` (status = unavailable) rather than a blocker for the other two sources.

## Decision: Sync is user-triggered (manual refresh), bounded lookback window

**Rationale**: Matches the spec's stated Assumption (no real-time push requirement). Each sync
fetches items since the last successful sync per source (stored as a `last_synced_at` on
`SourceConnection`), falling back to a fixed lookback (e.g. 7 days) on first connect — bounds
API quota usage and Claude CLI call volume per sync.

**Alternatives considered**: webhook/push-based sync (rejected — not required, adds infra:
public callback endpoint contradicts local-first).

## Decision: Test runners — Jest (backend), Vitest (frontend), no e2e browser framework

**Rationale**: Both are the default scaffold for their respective toolchains (NestJS CLI ships
Jest; Vite ships Vitest) — zero new dependency decisions. No Playwright/Cypress: single-user
local tool, manual quickstart validation (see quickstart.md) covers the UI flow without adding a
browser-automation dependency the spec doesn't ask for.
