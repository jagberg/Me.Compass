# Data Model: Chat action resolution detection

## `action` table - new column

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `resolution_ask` | TEXT | yes | `NULL` | Snapshot of `description` at creation/merge time, chat actions only. `NULL` for non-chat actions and for pre-feature chat actions that predate this migration (they remain ineligible for resolution judgement - existing `flagStale` behavior applies to them unchanged, per spec Edge Cases). |

Migration: `backend/src/db/migrations/006_resolution_ask.sql`

```sql
ALTER TABLE action ADD COLUMN resolution_ask TEXT;
```

No backfill of existing rows - `NULL` is the correct value for "not eligible" (see Assumptions in
spec.md and research.md #1). No index needed - this column is never queried by, only read after
already selecting the row.

## `Action` interface (`backend/src/types/index.ts`)

Add one field, grouped with the other feature-005 additions:

```ts
export interface Action {
  // ...existing fields unchanged...
  title_pinned: boolean;
  // Snapshot of the ask this chat action captured at creation/merge time (feature 005).
  // null for non-chat actions and for chat actions created before this feature shipped.
  resolution_ask: string | null;
  // ...action_url/action_target unchanged...
}
```

`toAction()` in `actions.repository.ts` reads it the same way as other nullable string columns
(`(row.resolution_ask as string) ?? null`).

## Repository surface changes

`ActionsRepository.insert()`'s `NewAction` type gains `resolution_ask?: string | null` (parallel to
how `dedup_key`/`requested_by` are already optional on insert), written into the `INSERT` column list.

`ActionsRepository.setDigestFields()` is widened to also accept `resolution_ask`, `status`, and
`resolved_at` (the latter two so `resolveChatActions()` can close an action without going through
`ActionsService.update()`'s HTTP-oriented validation, which is not relevant to a server-side
reconcile decision). This mirrors how `title_pinned` was added to this same method's `Pick<...>` list
in feature 004.

No new repository methods are needed for reads: `resolveChatActions()` uses the existing
`listByStatus("open")`, filtering in-memory for `source_type === "chat"` and non-null `resolution_ask`.

## State transitions (feature-005-relevant slice)

```
open (chat, resolution_ask set)
  --[delta judged "resolved"]--> done (resolved_at set)
  --[delta judged "unsure"]-----> open (stale_review = true)
  --[delta judged "still-open"]-> open (no change)
  --[dedup_key reappears in this sync's candidates]--> handled by existing merge logic (unaffected by this feature - resolution_ask is refreshed as a side effect, see research.md #2)
```

An action already `done`/`dismissed` is never selected for judgement (`listByStatus("open")` only).
An action with `stale_review = true` remains eligible for judgement on a later sync (spec User
Story 2, Acceptance Scenario 2) - `resolveChatActions()` does not skip `stale_review` actions the way
`flagStale()` skips them (see reconcile.service.ts's existing `if (!action.dedup_key || action.stale_review) continue`
in `flagStale` - that early-skip is specific to the old mechanism and is not carried into the new one).

## No new entities

No new table, no new repository, no new NestJS module. This is a column addition plus new logic in
two existing services (`ReconcileService`, `ClaudeCliService`) and one existing data-flow addition in
`SourcesService`.
