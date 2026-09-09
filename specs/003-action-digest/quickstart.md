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

### 6. Re-file / explicit Uncategorised persists (FR-007, FR-020, SC-006)
- `PATCH /api/actions/:id` with `{ category_id: "…" }` (and separately, one with
  `{ category_id: null }` as an explicit Uncategorised choice). Confirm both set `category_pinned`.
- Run `sync-all` again.
- **Expected**: the re-filed action stays in the chosen category, AND the explicitly-Uncategorised
  action stays Uncategorised (not auto-refiled) across the re-sync.

### 7. Priority-first board with comparator (FR-008, FR-009, FR-011, FR-021)
- Open the dashboard.
- **Expected**: categories ordered by the comparator (overdue -> due-today -> future -> undated;
  then due asc, priority, created asc), so the category holding the soonest overdue / highest
  priority action is first; **Uncategorised is always last even if it holds the single most-urgent
  action**; each line shows a source icon, work title, next step, due status; the view switch
  toggles two-column (default) / single rail / manage.

### 8. Run drafts only (FR-010, Principle IV)
- Click the circular play button on an action.
- **Expected**: a draft next step is returned for review; confirm no external message/email was
  sent.

### 9. Conflict surfaced, not merged (FR-012)
- Use two chat messages requesting opposite actions on the same subject (e.g. swap A→B vs B→A).
- Run `sync-all`.
- **Expected**: both are kept with `conflict: true` and surfaced on the board for a decision, not
  silently collapsed. Resolving via `PATCH` clears the conflict.

### 10. Split survives repeated sync (FR-013, FR-017, SC-006)
- Find an action that merged two genuinely different tasks. `POST /api/actions/:id/split`.
- **Expected**: the tasks are separate again AND a `merge_exception` is recorded. Re-run
  `sync-all` twice - they stay separate (not re-merged), proving the separation persists.

### 11. Stale flagged only on a successful full read (FR-014, FR-018, SC-007)
- Sync a source so an open action is created. Resolve that conversation at the source. Re-run
  `sync-all` with that source reading successfully.
- **Expected**: the action is flagged `stale_review: true` for you to confirm; not auto-closed.

### 12. Identity: paraphrase merges, new instance does not (FR-015, FR-016, SC-002)
- Sync content where the same task is paraphrased two ways (e.g. "Approve CM-389" and "click
  approve on the Okta change") -> **Expected**: one action.
- Then introduce a NEW instance of a recurring task whose prior instance is already `done` (e.g.
  next fortnight's payroll after last fortnight's was completed) -> **Expected**: the completed one
  is NOT recreated (FR-016), and the new period appears as its own new action (distinct identity).

### 13. Errored source is not stale-flagged (FR-018, edge case)
- With an open action from an inaccessible/errored source (e.g. a chat space returning
  Insufficient Permission), run `sync-all`.
- **Expected**: that source is in error and read no candidates; its open actions are NOT
  stale-flagged (absence from a failed read is not treated as resolution).

### 14. Backfill consolidates the existing backlog once (FR-019, SC-008)
- Starting from a database with pre-feature duplicate actions (and some with manual edits/status),
  run the first upgraded boot + `sync-all`.
- **Expected**: the existing duplicates consolidate to one each, keeping manual due-date/priority/
  category edits and status; the backfill does not run again on the next boot.

## Measuring success

Use a **labelled sample**: hand-label a batch of raw source items with the true set of distinct
tasks and each one's correct requester and category, then run `sync-all` and compare.

- **SC-001**: < 5% of displayed actions are duplicates of another displayed action.
- **SC-002 (no loss / recall)**: >= 95% of the labelled true distinct tasks appear exactly once,
  and 0 true tasks are lost by over-merging (a merge that drops a real task fails this even if it
  lowers the duplicate count - preserves feature 002's recall intent).
- **SC-003**: every action has a requester (or is manual).
- **SC-004**: every action is reachable (categorised or in Uncategorised).
- **SC-005**: the first user category (excluding Uncategorised) holds the most-urgent action;
  Uncategorised is last.
- **SC-006**: re-file, explicit Uncategorised, and split each survive a subsequent `sync-all`; a
  completed ask is not recreated while a new recurring instance is.
- **SC-007**: a resolved-after-sync action is flagged only on a successful full re-read; an
  errored source's actions are not flagged.
- **SC-008**: the existing backlog consolidates once on upgrade, keeping manual edits and status.
