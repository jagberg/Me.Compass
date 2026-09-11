# Brief: Chat action resolution detection
Status: approved

## Summary
Today, an action captured from a chat thread stays open forever unless the
user manually ticks it off - even after the ask has plainly been handled in
the thread itself. This feature makes chat sync judge each incremental batch
of new messages ("the delta") against the ask that was captured when the
action was created, and automatically close the action when the delta shows
it's been resolved - falling back to the existing "flag for review" behaviour
whenever it can't tell.

## Problem / Context (JTBD)
**User:** Justin, the sole user of this local action manager.
**Job:** When he deals with something in a chat thread (replies, gets an
answer, or watches someone else resolve it), he wants his action board to
reflect that without he himself having to remember to go close it out.
**Current friction:** Chat sync only ever *adds or updates* actions from new
message activity; it has no notion of an ask being *answered*. The existing
`stale_review` flag only fires when a matched `dedup_key` disappears from a
re-extraction - not the same thing as "the ask was actually satisfied" - so a
handled thread's action lingers, undistinguished from a genuinely still-open
one, until manually dismissed.

This is a personal single-user tool (Constitution I: Local-First); there is no
customer segment, Mixpanel instrumentation, or phone-channel incrementality
concern here - those Compare-Club-specific sections of the standard PRD
template are not applicable and are omitted.

## Goals & Success Criteria
Since there's no analytics pipeline on this tool, success is defined
behaviourally and is meant to be checked by hand against real synced chat
data (per the project's existing testing convention: automated unit tests for
logic, manual verification via a quickstart for the end-to-end behaviour):

- G1: An action whose thread-delta clearly answers the captured ask is closed
  automatically on the sync that reads that delta - no manual tick required.
- G2: An action is never wrongly auto-closed when it's ambiguous - ambiguous
  cases are flagged for review (`stale_review`), never guessed shut.
- G3: A delta that raises a materially different or additional ask updates the
  action (or creates a new one) rather than being silently ignored or
  incorrectly treated as resolving the original ask.
- G4: This must not regress today's non-chat behaviour (email, meeting notes)
  or the existing `stale_review` mechanism for those sources.

## Scope

### In scope
- Chat-sourced actions only.
- Capturing a dedicated "resolution ask" statement on the action at creation
  time (a new field, distinct from `title`/`description`, so a later user
  rename of the title doesn't change what gets judged).
- On each chat sync, for an existing open action whose thread produced new
  message activity in this sync's delta: send the captured ask + the new
  delta messages to the local `claude` CLI and get one of three verdicts -
  **resolved**, **still open**, **unsure** - and act accordingly:
  - resolved -> close the action (`status: done`, resolved_at set)
  - unsure -> set `stale_review` (existing mechanism, existing UI)
  - still open -> no change
- "Resolved" counts regardless of who resolved it (the reader or someone
  else in the thread) - not gated to only the reader's own messages.
- A delta that surfaces a different/new ask on the same thread: update the
  existing action's ask/description, or create a new action, following the
  same dedup_key-based merge logic already used for extraction (reconcile
  service) - not a new mechanism.
- Automated tests (backend `node:test`, fake `claude`) covering: resolved,
  unsure, still-open, and a new-ask-in-delta case.

### Out of scope (this phase)
- Email and meeting-notes (Drive) threads - unchanged, still only
  `stale_review`-flaggable via the existing re-extraction match.
- Any UI distinction between "closed by resolution detection" and "closed by
  the user's own tick" (no audit trail requirement yet - open question below).
- Any change to the once-daily/on-demand sync trigger model.
- A full-thread re-fetch mechanism - explicitly avoided by this design (the
  ask is captured once at creation; only the incremental delta is judged
  afterward, matching the sync model already in place).

## Requirements & Acceptance Criteria

| ID | Requirement | Acceptance Criteria | Priority |
|----|---|---|---|
| R1 | A chat action stores a captured resolution ask at creation time | Given a new chat action is created during extraction, when it's persisted, then it has a non-null resolution-ask value distinct from its title/description | P1 |
| R2 | Each chat sync judges the delta against open chat actions' asks | Given an open chat action whose thread has new messages in this sync's delta, when the sync runs, then exactly one claude judgement call is made for that action using only the delta messages | P1 |
| R3 | A resolved verdict closes the action | Given the judgement returns "resolved", when reconcile runs, then the action's status becomes done and resolved_at is set | P1 |
| R4 | An unsure verdict flags for review, never auto-closes | Given the judgement returns "unsure", when reconcile runs, then the action is marked stale_review and remains open | P1 |
| R5 | A still-open verdict makes no change | Given the judgement returns "still open", when reconcile runs, then the action's status, stale_review, and resolution ask are all unchanged | P1 |
| R6 | A new/different ask in the delta updates or creates an action | Given the delta contains an ask that does not match the existing captured ask, when reconcile runs, then the existing dedup_key-based merge/creation logic determines whether it updates the action or creates a new one (no new matching mechanism) | P2 |
| R7 | Non-chat sources are unaffected | Given an email or meeting-notes action, when any sync runs, then its behaviour (stale-flagging, closing) is identical to pre-feature behaviour | P1 |
| R8 | Resolution judgement only ever fires on the delta, never a full re-fetch | Given a chat thread with an open action, when its sync-time message fetch runs, then only messages newer than the source's stored sync cursor are fetched (no additional full-thread read is introduced) | P1 |

## Open Questions / Risks
- **Audit trail:** should a resolution-closed action look different in the UI
  from a manually-ticked one (e.g. a badge or a note in description)? Not
  required for v1; flagged for a later decision.
- **Reopen conflict:** if the user manually reopens an action but a later
  delta is judged "resolved" again (e.g. against a stale captured ask), what
  should win? Not addressed in this phase - default behaviour will be
  whatever the existing status-transition code already does when both a
  manual reopen and a sync-driven update could apply; needs explicit design
  attention in `ignite:plan` if it isn't already handled.
- **Judgement cost:** an extra `claude` call per open chat action per sync
  (on top of per-item extraction) adds latency/cost proportional to open chat
  action count. Not bounded in this brief; flagged for `ignite:plan` to size
  and decide whether it needs its own concurrency limit (similar to the
  existing extraction concurrency cap).
- **Ask capture quality:** the resolution ask is generated once, by the same
  kind of model call that already does extraction; if it's captured poorly
  (too vague, too narrow) it degrades every future delta judgement for that
  action. No re-capture/repair mechanism is proposed here.
