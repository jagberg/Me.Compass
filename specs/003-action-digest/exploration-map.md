# Exploration map: Action digest

Wayfinder-style investigation feeding `/speckit.specify`. Grounds the brief's open questions
in the actual codebase. Not a governing document - input to the spec only.

## Integration surface

### 1. Action data model & persistence
- `action` table (`backend/src/db/migrations/001_init.sql:1-16`): `id`(TEXT PK), `title`,
  `description`, `source_type`, `source_url`, `status`(default open), `due_date`,
  `due_date_inferred`, `priority`, `suggested_next_step`, `created_at`, `resolved_at`. One
  index on `(status, due_date)`.
- IDs: `randomUUID()` at insert (`actions.repository.ts:32`).
- **No** dedup / grouping / category / requester concept exists. Grouping today is in-memory
  by `source_type` at read time only.
- Adding a field is a triple that must move together: INSERT column list
  (`actions.repository.ts:38-55`), `toAction` mapper (`:10-25`), `Action` interface
  (`types/index.ts:8-21`); widen `NewAction` omit-type (`:6-8`) and the `update` whitelist
  (`:73`) if user-correctable.

### 2. Sync & extraction flow
- `SourcesService.sync()` (`sources.service.ts:34-69`) is the one orchestration point: per raw
  item → `extractActions()` → per extracted action, insert inline. No cross-item/cross-source
  pass. `sync()` runs per-`type` (`sources.controller.ts:18-26`).
- Chat (`chat.client.ts:11-33`): `spaces.list` → per-space `messages.list`, **one
  RawSourceItem per message**; `msg.thread` is fetched then discarded. This is the per-message
  duplication cause.
- Gmail (`gmail.client.ts:35-71`) is the template: assembles a whole thread into one
  transcript (`From/Date/body` joined by `---`, capped 8000 chars). Extractor prompt is
  already multi-message aware (`claude-cli.service.ts:81-84`).
- `ExtractedAction` (`claude-cli.service.ts:7-14`): no `requested_by`; prompt already reasons
  about who-asks-whom (`:73-77`) but discards the requester.

### 3. API surface
- Endpoints: `GET /api/actions?status=&group_by=source`, `GET /api/actions/today` (cap 6),
  `POST /api/actions`, `PATCH /api/actions/:id` (whitelist: due_date/priority/status),
  `POST /api/actions/:id/run`, `GET /api/sources`, `POST /api/sources/:type/sync`.
- **No** category/taxonomy/requester/merge endpoints.
- `group_by` dispatch (`actions.controller.ts:10-14`) is the natural switch point for a
  `group_by=category` branch mirroring `listGroupedBySource` (`actions.service.ts:38-44`).

### 4. Frontend
- Single page `Dashboard.tsx`; body maps fixed `SOURCE_ORDER` into `SourceGroup` sections.
- The priority-first category board replaces the `dashboard__body` block
  (`Dashboard.tsx:129-133`) + `SOURCE_ORDER` (`:10`); calls a new `group_by=category` fetch.
- `SourceGroup` is a near-template for a `CategoryColumn` (swap `LABELS`, header). `ActionCard`
  reusable; add requester near subtitle, category re-file control in the edit row.
- Taxonomy management UI is greenfield (Sidebar "Settings" is a static label).

### 5. Migrations mechanism
- `migrate.ts:5-12`: reads `migrations/*.sql`, lexical sort, `db.exec()` each **on every
  startup**. **No applied-migrations tracking table** - all SQL must be idempotent.
- **Biggest gotcha**: SQLite `ALTER TABLE ADD COLUMN` is NOT idempotent - re-running throws
  "duplicate column". Since migrations re-run every boot, adding `category_id`/`requested_by`
  to `action` will fail on the second start. The spec must first add a `schema_migrations`
  ledger to `migrate.ts`, OR use a guarded recreate pattern.

## Difficulty read on the brief's open questions
| Open question | Difficulty | Why |
|---|---|---|
| Chat thread-awareness (R1) | Easiest | Gmail's transcript assembler is a drop-in template; prompt already multi-message aware |
| Review/correction path | Easier | `PATCH /:id` + `ActionCard` inline edit already give the pattern; just widen the whitelist |
| Requester resolution (R3) | Mixed | Prompt extension easy; Gmail `From` is a human name, but Chat sender is a `users/...` id needing a display-name lookup; manual actions have none |
| Taxonomy persistence (R4) | Harder | New table + migration, but the runner can't do plain `ALTER TABLE ADD COLUMN` idempotently - needs a migrations ledger first |
| Cross-source merge/dedup (R2) | Hardest | No post-fetch seam (inserts inline per item); `sync()` runs per-source, so cross-source merge needs a new "sync-all + reconcile" entrypoint and a dedup key |

## Implications for the spec
- Add a **migrations ledger** to `migrate.ts` as prerequisite groundwork before any
  `ALTER TABLE`, or recreate `action` via a guarded pattern.
- Introduce a **post-fetch reconcile seam** and a **sync-all entrypoint** so cross-source merge
  is possible (today `sync()` is per-source and inserts inline).
- Needs a **dedup key / content signature** on actions to anchor merge matches.
- New **category** table + **categories API/module**; extend `group_by` with `category`.
- Extend `ExtractedAction` + prompt with `requested_by`; plan a Chat display-name lookup.
- Reuse the existing **inline-edit + PATCH whitelist** pattern for the review/correction path
  (re-file category, confirm/split a merge).
