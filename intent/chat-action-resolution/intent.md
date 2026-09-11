# Intent: Chat action resolution detection
Author: Justin. Status: draft.

## Problem
When I deal with a chat-sourced action outside the app - e.g. I reply in the
thread and the ask is now handled - the action stays open on my board. The app
only re-reads a thread when I run a sync, and even then it can at most flag the
item "stale"; it never recognises that the ask was actually answered and closes
it. So handled items linger and I have to clear them by hand.

## Proposed outcome
When an action is first captured from a chat thread, the app records what the
ask is. On later syncs it looks only at the new messages in that thread (the
delta) and judges them against the stored ask: if the delta satisfies the ask,
it closes the action; if the delta contains a different or additional ask, it
updates the action or creates a new one; otherwise it leaves the action alone.
When it can't tell whether the ask is satisfied, it flags the action for review
rather than guessing.

## Affected users and systems
Me (single user). Chat sync + extraction pipeline, the reconcile/stale pass,
the local claude CLI (a new judgement call), and the action store (recording the
captured ask on the action, and closing an action). Chat only for the first
version; email/meeting threads unchanged.

## Constraints
- Local-first; the judgement runs through the local claude CLI, no new AI billing.
- Must not close an action it isn't confident about - unsure falls back to the
  existing "flag for review" behaviour (Review Before Action).
- The ask is captured when the action is created, so later checks only need the
  delta (new messages since the last sync) - this matches the incremental sync
  model and avoids re-reading the whole thread.
- Portable: no personal/org specifics baked in (Constitution VI).

## Open questions
- Where/how is the "ask" stored - reuse the action's title/description, or a
  dedicated captured-ask field?
- Strictness of "satisfies": only when the reader themselves acted, or also when
  someone else clearly closed it out?
- A new/changed ask in the delta: when is it an update to the same action versus
  a brand-new action (how does this tie into dedup_key)?
- Audit trail: should a resolution-closed action be visibly distinct from one I
  ticked off manually?
- Reopen conflict: if I reopen an action but the next delta is judged resolved
  again, what wins?
