# Quickstart: Chat action resolution detection

This is the manual smoke pass. Automated tests cover the logic in isolation with a fake `claude`
client:

```bash
cd backend && npm test     # node:test via tsx — resolution.test.ts + full existing suite
```

The scenarios below (S1-S5) are the manual end-to-end confirmation against a real chat sync, since
they need a live Google Chat space and the real local `claude` CLI in the loop. Prerequisites:
backend built, Google Chat connected, at least one chat space you can post a reply into.

## Setup

```bash
cd backend && npm run build && npm run start
```

Trigger one chat sync (`POST /api/sources/chat/sync` or "Sync all" on the board) so any existing
backlog settles onto the new `resolution_ask` column before starting the scenarios (pre-existing
chat actions get `resolution_ask = NULL` and are not eligible for judgement until they're
re-created/merged - see data-model.md).

## Scenarios

### S1 - A clearly answered chat action closes itself (FR-001-003, FR-006, SC-001)
1. Get (or wait for) a fresh chat action extracted from a real thread.
2. Reply in that thread with a message that unambiguously answers the ask (e.g. "done, sent it
   over"). Anyone in the thread may send it, not only you.
3. Run a chat sync.
4. **Expect**: the action's status is now `done`, `resolved_at` is set, and it no longer appears on
   the open board. No manual click was needed.

### S2 - An ambiguous reply gets flagged, not closed (FR-004, SC-002)
1. Get a fresh chat action.
2. Reply with something vague/non-committal with respect to the ask (e.g. change the subject, or a
   partial non-answer).
3. Run a chat sync.
4. **Expect**: the action is still open, but now shows the existing "possibly resolved / stale"
   review indicator. It was NOT auto-closed.

### S3 - A later clear reply still resolves a flagged action (Spec User Story 2, Scenario 2)
1. Continuing from S2's flagged action, reply again in the same thread with a message that clearly
   resolves the original ask.
2. Run another chat sync.
3. **Expect**: the action closes normally (the earlier review flag did not block a later clear
   resolution).

### S4 - A new/different ask on the same thread does not close the original (FR-007, SC-003)
1. Get a fresh chat action from a thread.
2. Before answering it, post an unrelated new ask into the same thread (a different task).
3. Run a chat sync.
4. **Expect**: the original action is untouched (still open, not closed); either a new action
   appears for the new ask, or (if it matches the same identity) the existing action updates - but
   it is never closed by this new/different ask.

### S5 - Email and meeting-notes actions are unaffected (FR-009, SC-005)
1. Note the current behavior of an open email- or meeting-notes-sourced action (status, review
   flag).
2. Run a full sync (`syncAll`).
3. **Expect**: no observable change in how that action is handled versus before this feature -
   still only the pre-existing `stale_review` mechanism can apply to it, never an auto-close.

## Pass criteria

All of S1-S5 behave as described. S2/S3 together demonstrate SC-002 (never a wrong auto-close) and
that a review flag is not a dead end. S4 demonstrates the dedup-based new-ask handling never
misfires as a false resolution.
