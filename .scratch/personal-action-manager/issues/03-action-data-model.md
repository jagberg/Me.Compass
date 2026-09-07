Type: grilling
Status: resolved
Blocked by: 02

## Question

What's the core data model for an "action" that works across all v1 sources — fields, status lifecycle, and what "overdue" means per source?

## Answer

Fields, every action regardless of source:

- `id`
- `title`
- `description` — raw excerpt from the source
- `source_type` — `gmail` / `drive_meeting` / `chat` / `manual`
- `source_url` — link back to the original thread/doc/message; null for manual
- `status` — `open` / `done` / `dismissed` (dismissed = reject a wrongly-flagged inference, e.g. an email or chat message the LLM misread as an ask — kept, not deleted, so inference quality is visible over time)
- `due_date` — nullable
- `due_date_inferred` — bool; true when the app guessed it (no explicit date on the source), false when the source gave one. Lets the dashboard flag a due date as a guess vs a real deadline. User can edit `due_date` afterward regardless.
- `suggested_next_step` — nullable text; the detached Claude-CLI inference component's output on what to actually do about this action
- `created_at`
- `resolved_at`

Due-date inference: when a source gives no explicit date (routine for Gemini next-steps and manual entries), the detached Claude CLI component infers a plausible one alongside `suggested_next_step` — one call covers both, rather than a separate inference pass just for dates. Editable afterward.

Kept simple per Q4: no per-source structured fields beyond the above — `source_url` + `description` is the whole story for "jump back to context." Add source-specific fields later only if something concrete needs them.

### Addendum (from ticket 04, dashboard)

The chosen dashboard depends on fields this ticket didn't have:

- `priority` — `high` / `medium` / `low`. Drives the importance dot, the ordering inside each source group, and which items make the "Today's next steps" list. Set by the same Claude inference pass that produces `suggested_next_step` and the inferred due date; user-editable.
- Run lifecycle for the next step — something like `run_state`: idle / running / done-for-review (the "▶ Run → Running… → ✓ Review" button). Exact shape is a spec decision, not a map one.
- Snooze appears as a hover action in the chosen design; whether it's v1 (and whether it's just editing `due_date`) is for the spec.
