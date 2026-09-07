# Phase 1 Data Model: Personal Action Manager

Storage: `node:sqlite`, one file, plain SQL, no ORM. All timestamps are ISO-8601 strings (SQLite
has no native datetime type).

## Action

The core entity — a single owed item, from any source.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT (uuid), PK | |
| `title` | TEXT, NOT NULL | |
| `description` | TEXT, NOT NULL | |
| `source_type` | TEXT, NOT NULL | one of `email`, `chat`, `meeting`, `manual` (FR-001, FR-002) |
| `source_url` | TEXT, NULL | NULL only when `source_type = manual` (FR-002) |
| `status` | TEXT, NOT NULL, default `open` | one of `open`, `done`, `dismissed` (FR-010) |
| `due_date` | TEXT, NULL | ISO date; NULL means still undated |
| `due_date_inferred` | INTEGER (bool), NOT NULL, default 0 | true when Claude set it, not the source/user (FR-005) |
| `priority` | TEXT, NULL | one of `high`, `medium`, `low` |
| `suggested_next_step` | TEXT, NULL | drives the per-item Run control (FR-006, FR-009) |
| `created_at` | TEXT, NOT NULL | set on insert |
| `resolved_at` | TEXT, NULL | set when status moves to `done` or `dismissed` |

**Validation rules**:
- `source_type = manual` ⟺ `source_url IS NULL` (enforced in the repository layer, not a SQLite
  CHECK, to keep migrations plain per Principle V).
- `status` transitions: `open → done`, `open → dismissed` only; both set `resolved_at`.
  Dismissed/done records are never deleted (FR-010).
- Overdue = `status = 'open' AND due_date IS NOT NULL AND due_date < today` — a derived/query
  property, not a stored column (FR-004).

**Indexes**: `(status, due_date)` — supports both the overdue query and the "Today's next steps"
ranking (FR-006) without a full scan.

## Source Connection

The user's link to one external system.

| Field | Type | Notes |
|---|---|---|
| `source_type` | TEXT, PK | one of `gmail`, `drive`, `chat` (manual has no connection) |
| `status` | TEXT, NOT NULL | one of `not_connected`, `connected`, `error` |
| `last_synced_at` | TEXT, NULL | drives the bounded-lookback sync window (see research.md) |
| `last_error` | TEXT, NULL | surfaced to the user when a sync fails (Edge Case: source unreachable) |

Exact OAuth token storage is an implementation detail of the `sources` module (local file per
research.md), not modeled as a queryable field — only connection status is user-visible.

## Run Result

Output of invoking Claude on one action's `suggested_next_step`. Never sent/executed (FR-013).

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT (uuid), PK | |
| `action_id` | TEXT, NOT NULL, FK → `action.id` | |
| `content` | TEXT, NOT NULL | the drafted/produced result, for display |
| `status` | TEXT, NOT NULL | one of `succeeded`, `failed` (CLI unavailable/timeout — Edge Case) |
| `error` | TEXT, NULL | populated when `status = failed` |
| `created_at` | TEXT, NOT NULL | |

An action can have multiple `RunResult` rows over time (re-running after editing context); the
dashboard shows the latest one per action.
