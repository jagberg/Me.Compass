# API Contract: Personal Action Manager

Internal REST API between `frontend/` and `backend/` (same-origin, no auth per Principle I).
JSON request/response bodies. Shapes match `data-model.md`.

## `GET /api/actions`

Query params: `status` (default `open`), `group_by=source` (optional — returns actions grouped
under `email`/`chat`/`meeting`/`manual` keys instead of a flat array).

Response: `Action[]` (flat) or `Record<SourceType, Action[]>` (grouped).

## `GET /api/actions/today`

Returns the "Today's next steps" list (FR-006): open actions that are overdue, due today, or
high-priority, ranked in that order, capped at 6.

Response: `Action[]`.

## `POST /api/actions`

Manual entry (FR-002). Body: `{ title, description, due_date?, priority? }`.
Server sets `source_type = manual`, `source_url = null`, `status = open`, `created_at = now`.
If `due_date` omitted, routes through the Claude inference call before insert (FR-005).

Response: `Action` (201).

## `PATCH /api/actions/:id`

Edit user-correctable fields: `due_date`, `priority`, `status`. Setting `status` to `dismissed`
or `done` sets `resolved_at` server-side (FR-010). Editing `due_date` clears
`due_date_inferred` (FR-005 — "user can edit the value afterward").

Response: `Action` (200).

## `POST /api/actions/:id/run`

Triggers a Run (FR-009). Invokes the Claude CLI subprocess against `suggested_next_step` +
action context, writes a `RunResult`, and returns it — never sends/executes anything (FR-013).

Response: `RunResult` (200 on `succeeded`, 502 with `RunResult{status: failed, error}` if the CLI
is unavailable or times out — Edge Case: "Run but the local Claude CLI ... fails mid-run").

## `GET /api/sources`

Response: `SourceConnection[]` — one row per `gmail`/`drive`/`chat`, current `status` and
`last_synced_at`/`last_error`.

## `POST /api/sources/:type/sync`

Triggers a manual sync (per research.md — user-triggered, bounded lookback). Fetches new items
since `last_synced_at`, runs each through the Claude extraction+inference call, inserts any
resulting `Action` rows, updates `SourceConnection.last_synced_at`/`status`/`last_error`.

Response: `{ source: SourceConnection, actions_created: number }` (200), or
`SourceConnection{status: error}` (502) if the source is unreachable — already-stored actions
from that source remain untouched (Edge Case: source unreachable during sync).
