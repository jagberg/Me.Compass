# Feature Specification: Rename actions

**Feature Branch**: `004-rename-actions`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Rename actions — inline editing of an action's title on the board (title only), persisted so it is treated as authoritative: reconciliation/merge and any future sync must never overwrite a user-renamed title. A blank title is rejected. Out of scope: editing description/next-step/requester, bulk rename, rename history/undo, changing how titles are first generated."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix a title on the board (Priority: P1) 🎯 MVP

As the user scanning my action board, I can edit the title of any action in
place and save it, so the list reads the way I would say it and I can trust
it at a glance.

**Why this priority**: This is the whole point of the feature - being able to
correct a misread or reword an awkward AI-generated title. It delivers value
on its own even before persistence guarantees.

**Independent Test**: Edit an action's title on the board, save, and confirm
the new title displays in its place and remains after reloading the board.

**Acceptance Scenarios**:

1. **Given** an action with an awkward title, **When** I edit its title and
   save, **Then** the new title replaces the old one and is shown immediately.
2. **Given** I have edited a title, **When** I reload the board, **Then** the
   edited title is still shown (it was saved, not just displayed).
3. **Given** I am editing a title, **When** I clear it to empty and try to
   save, **Then** the save is rejected and the previous title is kept.

---

### User Story 2 - My rename is never overwritten (Priority: P1)

As the user, once I rename an action, I expect that title to stay mine - a
later sync of the same source, or another item merging into it, must not
replace my wording with a freshly generated one.

**Why this priority**: Without this, a rename silently reverts on the next
sync, making the feature untrustworthy. It is as important as the edit itself.

**Independent Test**: Rename an action, trigger a sync that re-reads the same
source (and a merge of a duplicate into it), and confirm the title is still
the user's chosen one.

**Acceptance Scenarios**:

1. **Given** a renamed action, **When** a later sync re-reads the same source
   and produces a fresh title for that item, **Then** the user's title is kept
   and the fresh title is discarded.
2. **Given** a renamed action, **When** a duplicate item is merged into it,
   **Then** the surviving action keeps the user's title.
3. **Given** an action whose title I have NOT changed, **When** a later sync
   produces a better title, **Then** it may update normally (only user-set
   titles are protected).

---

### Edge Cases

- Blank or whitespace-only title on save → rejected, previous title retained.
- Rename, then the same source is re-synced → user title wins (US2 #1).
- Rename, then a duplicate merges in → user title wins (US2 #2).
- Rename an action, then split it back into its merged parts → the split-off
  items revert to their own extracted titles; the kept action retains the
  user's title (see Assumptions).
- Renaming does not change the action's dedup identity, category, due date,
  priority, status, or requester.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to edit an action's title directly on the
  board and save the change.
- **FR-002**: The system MUST persist a saved title and display it in place of
  the previous title immediately and on subsequent loads.
- **FR-003**: The system MUST reject a blank or whitespace-only title and keep
  the previous title.
- **FR-004**: The system MUST record that a title was set by the user, and
  MUST NOT overwrite a user-set title during any later extraction or
  reconciliation of the same item (a user rename is authoritative, mirroring
  how an explicit category choice is protected).
- **FR-005**: When items are merged, the surviving action MUST keep a user-set
  title if one exists.
- **FR-006**: Only the title is editable; description, suggested next step,
  requester, category, due date, priority and status are unaffected by a
  rename.

### Key Entities *(include if feature involves data)*

- **Action**: gains a state indicating its title was set by the user
  ("user-renamed"). This state is what protects the title from being
  overwritten by extraction/reconciliation, and is set whenever the user saves
  a title edit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can rename an action's title in at most two interactions
  (open the edit, type, save) without leaving the board.
- **SC-002**: 100% of user-renamed titles survive a subsequent sync of the same
  source and a merge of a duplicate into them (zero titles reverted).
- **SC-003**: A blank/whitespace title is never persisted (0 occurrences).
- **SC-004**: Renaming changes no field other than the title (verified: dedup
  identity, category, due date, priority, status, requester unchanged).

## Assumptions

- Title-only editing for v1; other fields remain read-only on the line.
- Single-user local tool; no permissions or concurrent-edit concerns.
- Exact edit affordance (inline click on the title vs an option in the row's
  "…" menu) is a design detail to be settled at plan time; either satisfies
  FR-001.
- The original AI-extracted title is not retained or shown separately once
  replaced (full replacement), for simplicity.
- On a split, split-off items revert to their own extracted titles while the
  kept action retains the user's title; the user can rename the split-offs
  afterward if needed.
- Reuses the existing action update path and the existing reconcile/merge step;
  no new data source or external service.
