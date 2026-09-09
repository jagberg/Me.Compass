# API Contract: Rename actions

## PATCH /api/actions/:id

Widen the existing update endpoint to accept `title`.

### Request body (all fields optional; existing fields unchanged)

```json
{ "title": "My renamed title" }
```

- `title` (string): the new title. Trimmed. Must be non-empty after trimming.

### Behaviour

- If `title` is present and non-blank: persist it and set `title_pinned = true`.
- If `title` is present but blank/whitespace-only: reject with `400` and do not
  change the stored title.
- If `title` is absent: behaves exactly as today (other fields update as before).

### Responses

| Status | When | Body |
|--------|------|------|
| 200 | Updated | the updated action (includes `title`, `title_pinned`, `action_url`, `action_target`) |
| 400 | Blank title | error message |
| 404 | No such action | error message |

### Response shape (unchanged except new field)

The `Action` object gains `title_pinned: boolean`. `action_url` / `action_target`
(derived) remain present as today.

## GET /api/actions?group_by=category

No request change. Each returned action now includes `title_pinned`. The board
uses `title` for display as before; `title_pinned` is informational (e.g. the
client need not send it).

## Reconcile (internal, no HTTP surface)

The reconcile/merge step MUST NOT overwrite `title` for an action whose
`title_pinned` is true, on any current or future code path that would set a
title from freshly extracted content.
