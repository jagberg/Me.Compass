# Quickstart: Personal Action Manager

## Prerequisites

- Docker + Docker Compose.
- Local Claude Code CLI installed and authenticated on the host (`claude` on `PATH`,
  `claude -p "hello" --output-format json` returns a result) — Principle II depends on this.
- A Google Cloud OAuth client (installed-app type) with Gmail/Drive/Chat scopes enabled, per
  research.md's auth decision. Client ID/secret supplied via `.env` (mounted into the container,
  not committed).

## Run it

```bash
docker compose up --build
```

Opens the dashboard at `http://localhost:3000` (NestJS serving the built React app).

## Validate User Story 1 — see everything owed, overdue flagged

1. From the dashboard, connect Gmail, Drive, and Google Chat (`POST /api/sources/:type/sync`
   after the one-time OAuth connect — see `contracts/api.md`).
2. Confirm each source has at least one action land in the source-grouped body
   (`GET /api/actions?group_by=source`), with title/description/source/status populated.
3. Manually backdate one action's `due_date` via `PATCH /api/actions/:id` and reload — confirm it
   renders visually distinct as overdue (spec Acceptance Scenario 1.2).

## Validate User Story 2 — inference + Run

1. Sync a source item with no explicit due date; confirm the resulting `Action` has
   `due_date_inferred = true` and a non-null `priority` (`GET /api/actions`).
2. Edit that `due_date` via `PATCH` — confirm `due_date_inferred` flips to `false`.
3. Click Run (`POST /api/actions/:id/run`) on any action with a `suggested_next_step` — confirm a
   `RunResult` is returned/displayed for review, and no external send/API call happens as a side
   effect (manually inspect: no outbound email/message was sent).
4. Load `GET /api/actions/today` — confirm ≤6 items, ordered overdue → due-today → high-priority.

## Validate User Story 3 — manual entry + dismiss

1. `POST /api/actions` with just `title`/`description` (no `due_date`) — confirm it stores with
   `source_type = manual`, `source_url = null`.
2. `PATCH` an inferred action's `status` to `dismissed` — confirm it disappears from the open
   list but still exists (query without the `status=open` filter).

## Edge cases to spot-check

- Stop network access to one source mid-sync — confirm previously stored actions from that
  source remain visible and `SourceConnection.status = error` with `last_error` populated.
- Rename/remove the `claude` binary from `PATH` temporarily and click Run — confirm a failed
  `RunResult` is surfaced, not a silent success.
