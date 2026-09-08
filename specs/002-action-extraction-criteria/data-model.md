# Phase 1 Data Model: Action Extraction Criteria

No schema changes. This feature changes classification criteria inside an existing prompt;
it does not add, remove, or modify any persisted entity or field.

## Candidate item (conceptual, not persisted)

Represents one raw piece of text evaluated by the extraction step before it becomes (or
doesn't become) an `Action`. Not a database entity - exists only as an in-memory value
during a sync run.

| Field | Description |
|---|---|
| `rawText` | The source text (email body/snippet, chat message, or meeting-notes excerpt) |
| `sourceLabel` | Which source type produced it (email / chat / meeting) |

**Classification outcome** (per this feature's criteria):
- Included → produces one or more `Action` rows (existing entity, unchanged shape)
- Excluded → produces nothing; the candidate is discarded

## Action (existing entity - referenced, not changed)

See `specs/001-personal-action-manager/data-model.md` for the full existing definition.
This feature does not alter the `Action` entity's fields, relationships, or persistence
(`backend/src/actions/actions.repository.ts`, SQLite via `node:sqlite`). Only which
candidate items produce an `Action` row changes.
