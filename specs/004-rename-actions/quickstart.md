# Quickstart: Rename actions

This is the manual smoke pass. Automated tests now cover most of it:

```bash
cd backend && npm test     # node:test via tsx — rename, reconcile, comparator, destination
cd frontend && npm test    # Vitest + Testing Library — ActionLine rename, board render
```

The scenarios below (S1–S6) are the manual end-to-end confirmation on the live
app. Prerequisites: backend built and running, board reachable.

## Setup

```bash
cd backend && npm run build && npm run start
```

Open the board (or the tunnel URL). Have at least one open action visible.

## Scenarios

### S1 — Rename inline (FR-001, FR-002, SC-001)
1. Edit an action's title on the board and save.
2. **Expect**: the new title shows in place immediately.
3. Reload the board.
4. **Expect**: the edited title is still shown (persisted).

### S2 — Blank title rejected (FR-003, SC-003)
1. Edit a title, clear it to empty (or spaces), try to save.
2. **Expect**: save is rejected; the previous title is still shown. `PATCH`
   returns 400.

### S3 — Rename wins over re-sync (FR-004, SC-002)
1. Rename an action whose source can be re-synced.
2. Run a sync that re-reads that source.
3. **Expect**: the action still shows the user's title, not a freshly
   extracted one. `title_pinned` is true.

### S4 — Rename survives a merge (FR-005, SC-002)
1. Rename an open action that has (or will get) a duplicate with the same
   dedup identity.
2. Sync so the duplicate reconciles/merges into it.
3. **Expect**: the surviving action keeps the user's title.

### S5 — Unrenamed titles still update (FR-004)
1. Take an action you have NOT renamed.
2. Re-sync its source such that extraction yields a different title.
3. **Expect**: its title may update normally (only user-set titles are frozen).

### S6 — Only the title changes (FR-006, SC-004)
1. Note an action's due date, priority, category, requester, status.
2. Rename it.
3. **Expect**: all of those are unchanged; only the title differs.

## Pass criteria

All of S1–S6 behave as described. SC-002 requires zero reverted user titles
across S3 and S4.
