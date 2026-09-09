# API Contract: Action Digest

New and changed HTTP endpoints. Builds on the existing contract in
`specs/001-personal-action-manager/contracts/api.md`; only deltas are listed here. Base prefix
`/api`, Fastify/NestJS, JSON.

## Changed: `GET /api/actions`

- **New query value**: `group_by=category` - returns actions grouped by category, ordered by the
  FR-021 comparator (each category ranked by its most-urgent action: overdue -> due-today ->
  future -> undated; then due asc, priority, created asc), with the `uncategorised` group ALWAYS
  last regardless of its contents.
- Existing `group_by=source` and the flat list are unchanged.
- **Response (grouped by category)**: an ordered array so priority order is preserved:

```json
[
  { "category": { "id": "…", "name": "Timesheets", "icon": null }, "actions": [ Action, … ] },
  { "category": null, "actions": [ Action, … ] }   // Uncategorised, always last
]
```

- **Action payload gains**: `requested_by` (string|null), `category_id` (string|null),
  `category_pinned` (boolean), `conflict` (boolean), `stale_review` (boolean). `dedup_key`/
  `merged_from` are internal and need not be exposed. `category_pinned`/`conflict`/`stale_review`
  are stored as 0/1 in SQLite and coerced to boolean on read.

## Changed: `PATCH /api/actions/:id`

- **Whitelist gains**: `category_id` (re-file, FR-007), `conflict` (resolve to `false`/clear,
  FR-012), and `stale_review` (confirm/clear, FR-014). Existing `due_date`/`priority`/`status`
  unchanged. Widening the whitelist means the repository `UPDATE` SQL, the service `Pick`, and the
  controller body type - not only the type alias.
- Setting `category_id` (to a category OR to null for explicit Uncategorised) via PATCH MUST set
  `category_pinned=1` so auto-filing never overrides the choice (FR-020).

## New: `POST /api/actions/:id/split`

- Undo a wrong merge (FR-013). Re-inserts the split-off task(s) as their own action(s) from the
  content snapshots stored in `merged_from` (each snapshot holds title/description/due_date/
  priority/suggested_next_step/requested_by/source_type/source_url), so no re-fetch or
  re-extraction is needed.
- **Body** (optional): which folded snapshot(s) to split off; default splits all.
- **Side effect**: records a `merge_exception` for the separated identities so reconcile does not
  re-merge them on later syncs (FR-017).
- **Response**: the resulting set of actions.

## New: `POST /api/sources/sync-all`

- Runs every connected source's fetch + extract, then a single **reconcile** pass
  (de-duplicate within/across sources using task identity, attribute requester, file unpinned
  actions into categories, suppress previously-resolved asks, flag conflicts, and stale-flag open
  actions only for successfully/fully read conversations) before persisting (FR-001, FR-002,
  FR-003, FR-012, FR-016, FR-018).
- **Response**: `{ actions_created, actions_merged, actions_suppressed, conflicts, stale_flagged,
  sources_read_ok, sources_failed }` summary. `sources_failed` are excluded from stale detection.
- The existing `POST /api/sources/:type/sync` remains, routed through the same reconcile step.

## New: Categories module

- **`GET /api/categories`** - list user categories (id, name, rule, icon).
- **`POST /api/categories`** - create `{ name, rule, icon? }`.
- **`PATCH /api/categories/:id`** - edit `{ name?, rule?, icon? }`.
- **`DELETE /api/categories/:id`** - delete; the category's actions revert to Uncategorised
  (`category_id` → null), never deleted (FR spec edge case).

## Notes

- `Action` type on both backend and frontend gains `requested_by`, `category_id`, `conflict`.
- No endpoint sends or executes anything externally; `POST /:id/run` still returns a draft for
  review (Principle IV, FR-010) - unchanged.
