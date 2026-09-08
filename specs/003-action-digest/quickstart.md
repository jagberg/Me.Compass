# Quickstart: Validate Action Digest

Runnable validation of the feature end-to-end. Manual verification (no test framework), matching
features 001/002. References [contracts/api.md](./contracts/api.md) and
[data-model.md](./data-model.md) rather than repeating them.

## Prerequisites

- Backend + frontend built and running, with a valid Google connection (Gmail + Chat + Drive)
  and the local `claude` CLI authenticated (see `specs/001-personal-action-manager/quickstart.md`).
- The ledgered migration has run once (the `schema_migrations`, `category`, and new `action`
  columns exist).

## Setup

```bash
cd backend && npm run build && npm run start   # runs the migration ledger on boot
# frontend served from backend/public, or `cd frontend && npm run dev`
```

## Validation scenarios

### 1. Chat is thread-aware - one action per real task (FR-001, SC-001)
- Pick a chat space where one request (e.g. a change-request approval) was restated across
  several messages.
- `POST /api/sources/sync-all` (or `/api/sources/chat/sync`).
- **Expected**: one action for that request, not one per message.

### 2. Cross-source de-duplication (FR-002, SC-001)
- Ensure a task exists in both an email thread and a chat message (e.g. the SFTP/CM-396 change).
- Run `sync-all`.
- **Expected**: it appears once; its source indicator reflects both, and `merged_from` records
  the folded items. Overall duplicate rate on the batch < 5% (SC-001).

### 3. Stale-state weighting (FR-003)
- Use a long thread whose early ask was resolved later (e.g. a renewal confirmed mid-thread that
  moved on to a follow-up).
- Run `sync-all`.
- **Expected**: the action reflects the current open item, not the resolved early ask.

### 4. Requester on every action (FR-004, SC-002)
- After a sync, `GET /api/actions`.
- **Expected**: every non-manual action has `requested_by` (a name for emailed asks, a role for
  chat); manual actions may be null.

### 5. Category filing + Uncategorised (FR-005, FR-006, SC-003)
- `POST /api/categories` with `{ name: "Timesheets", rule: "payroll & timesheet approvals" }`.
- Run `sync-all`.
- **Expected**: a payroll approval action is filed under Timesheets; an action matching no
  category appears with `category_id: null` (Uncategorised). `GET /api/actions?group_by=category`
  shows the Uncategorised group last.

### 6. Re-file and it persists (FR-007, SC-005)
- `PATCH /api/actions/:id` with `{ category_id: "…" }`.
- Run `sync-all` again.
- **Expected**: the action stays in the chosen category across the re-sync.

### 7. Priority-first board (FR-008, FR-009, FR-011)
- Open the dashboard.
- **Expected**: categories ordered by their most-urgent item (the category holding the soonest
  overdue/highest-priority action is first); each line shows a source icon, work title, next
  step, and due status; the view switch toggles two-column (default) / single rail / manage.

### 8. Run drafts only (FR-010, Principle IV)
- Click the circular play button on an action.
- **Expected**: a draft next step is returned for review; confirm no external message/email was
  sent.

### 9. Conflict surfaced, not merged (FR-012)
- Use two chat messages requesting opposite actions on the same subject (e.g. swap A→B vs B→A).
- Run `sync-all`.
- **Expected**: both are kept with `conflict: true` and surfaced on the board for a decision, not
  silently collapsed. Resolving via `PATCH` clears the conflict.

### 10. Split a wrong merge (FR-013, SC-005)
- Find an action that merged two genuinely different tasks.
- `POST /api/actions/:id/split`.
- **Expected**: the tasks are represented separately again; the split survives the next sync.

### 11. Stale action flagged, not auto-closed (FR-014, SC-006)
- Sync a source so an open action is created from a thread. Resolve/close that thread at the
  source. Re-run `sync-all`.
- **Expected**: the action is flagged possibly-resolved (`stale_review: true`) and surfaced for
  you to confirm done/dismiss; it is neither left silently open nor auto-closed. Confirming
  clears the flag.

## Measuring success

- **SC-001**: on a sample `sync-all`, compare raw extracted count vs displayed count and confirm
  < 5% of displayed actions are duplicates.
- **SC-002 / SC-003**: inspect `GET /api/actions` - every action has a requester (or is manual)
  and is either categorised or in Uncategorised.
- **SC-004**: confirm the first board category contains the single most-urgent action.
- **SC-005**: re-file and split both survive a subsequent `sync-all`.
