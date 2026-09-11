# Feature Specification: Chat action resolution detection

**Feature Branch**: `005-chat-action-resolution`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Chat action resolution detection - when a chat action is created, capture a dedicated resolution-ask field (distinct from title/description, so a later user rename doesn't affect judgement). On each chat sync, for an open chat action whose thread produced new messages in this sync's delta, judge those delta messages against the captured ask via the local claude CLI, returning one of three verdicts: resolved (close the action, status done + resolved_at set), unsure (set stale_review, existing mechanism), still-open (no change). Resolution counts regardless of who resolved it (reader or someone else). A delta with a different/new ask updates the action or creates a new one via the existing dedup_key-based reconcile/merge logic - no new matching mechanism. Chat-only for this version; email/meeting-notes (Drive) unchanged. Never full-thread re-fetch - only ever judge the incremental delta already fetched by existing sync."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A handled chat ask closes itself (Priority: P1)

Justin captures an action from a chat thread (e.g. "Confirm team's demand for
dev service"). He later replies in that same thread with an answer that
satisfies the ask. On his next sync, the action disappears from his open
board without him touching it.

**Why this priority**: This is the entire point of the feature - the specific
problem that motivated it (an action lingering after it was already handled
in the thread).

**Independent Test**: Create a chat action with a captured ask; simulate a
sync whose delta for that thread contains a message that clearly answers the
ask; verify the action's status becomes done and resolved_at is set.

**Acceptance Scenarios**:

1. **Given** an open chat action with a captured resolution ask, **When** a
   sync's delta for that action's thread contains a message that clearly
   satisfies the ask, **Then** the action's status becomes `done` and
   `resolved_at` is set.
2. **Given** the same setup, **When** the message satisfying the ask was sent
   by someone other than Justin (not just Justin himself), **Then** the
   action still closes - resolution is judged by content, not by who sent it.

---

### User Story 2 - An ambiguous delta gets flagged, not guessed (Priority: P1)

A thread gets new activity that might mean the ask is done, but it's not
clear-cut (e.g. a vague acknowledgement, a partial answer, a change of
subject). Justin does not want the action silently closed on a guess - he
wants to be nudged to look at it himself.

**Why this priority**: This is the safety mechanism that makes automatic
closing acceptable at all - without it, a wrong auto-close silently removes
real work from view (Constitution IV: Review Before Action).

**Independent Test**: Simulate a sync whose delta is ambiguous with respect
to the captured ask; verify the action remains open but is marked for review,
and is not closed.

**Acceptance Scenarios**:

1. **Given** an open chat action with a captured resolution ask, **When** a
   sync's delta for that thread does not clearly indicate whether the ask is
   satisfied, **Then** the action is marked for review (`stale_review`) and
   its status remains open.
2. **Given** an action already marked for review, **When** a later sync's
   delta for the same thread does clearly resolve it, **Then** the action
   closes normally (review status does not block a later clear resolution).

---

### User Story 3 - A thread's new message is a different ask, not an answer (Priority: P2)

A chat thread that already has an open action receives a new message that is
not an answer to the existing ask at all, but a distinct new request (or a
materially changed version of the original one). Justin expects his board to
reflect the new/changed ask, not to lose it or wrongly treat it as resolving
the old one.

**Why this priority**: Without this, resolution detection could misfire on
ordinary conversation continuation and either wrongly close a real action or
silently drop a new one - a correctness requirement, but secondary to the
core close/flag behavior above.

**Independent Test**: Simulate a sync whose delta contains a new/different
ask on the same thread as an existing open action; verify the existing
mechanism (dedup_key-based reconcile/merge, already used for extraction)
determines whether the action is updated in place or a new action is
created, and that the original action is not incorrectly closed.

**Acceptance Scenarios**:

1. **Given** an open chat action, **When** a sync's delta for its thread
   contains a new ask that reconcile determines is the same underlying task
   (matching or equivalent dedup_key), **Then** the existing action is
   updated, not closed and not duplicated.
2. **Given** the same setup, **When** reconcile determines the new ask is a
   different task, **Then** a new action is created and the original,
   unrelated action is left exactly as it was (not closed by this feature).

---

### Edge Cases

- What happens when a chat sync's delta for a thread contains no messages at
  all (no new activity since last sync)? No resolution judgement is made for
  that action; it is left unchanged (this already follows from only judging
  actions whose thread had delta activity).
- What happens when the reconcile pass runs on a source other than chat
  (email, meeting notes)? Resolution judgement never applies - unchanged
  from current behavior.
- What happens when a chat action has no captured resolution ask (e.g. it
  predates this feature)? It is not eligible for resolution judgement and
  behaves as it does today (only the existing dedup_key-disappearance
  stale-flagging can apply to it).
- What happens when the resolution-ask judgement call itself fails (e.g. the
  local claude CLI errors or times out) for one action mid-sync? That
  action's resolution judgement is treated as inconclusive for this sync (no
  status change), and the failure does not fail the whole sync - consistent
  with today's per-item failure handling in extraction.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST capture a resolution-ask value on a chat
  action at the time it is created, distinct from the action's title and
  description, so that a later rename of the title does not change what
  later judgement is evaluated against.
- **FR-002**: On each chat sync, for every open chat action whose thread
  produced new messages in that sync's delta, the system MUST judge those
  delta messages against the action's captured resolution ask and produce
  exactly one of three verdicts: resolved, unsure, or still-open.
- **FR-003**: When the verdict is resolved, the system MUST set the action's
  status to done and set its resolved-at timestamp.
- **FR-004**: When the verdict is unsure, the system MUST mark the action for
  review (the existing stale-review mechanism) and MUST NOT change its
  status.
- **FR-005**: When the verdict is still-open, the system MUST leave the
  action's status, review flag, and captured resolution ask unchanged.
- **FR-006**: A resolved verdict MUST be reached the same way regardless of
  whether the satisfying message was sent by the reader (Justin) or by
  another participant in the thread.
- **FR-007**: When a sync's delta for a thread contains an ask that is a new
  or materially different task from an existing open chat action's captured
  ask, the system MUST route it through the existing dedup-key-based
  reconcile/merge logic (the same mechanism already used for extraction) to
  decide whether it updates the existing action or creates a new one, rather
  than introducing a separate matching mechanism.
- **FR-008**: Resolution judgement MUST operate only on the delta messages
  already retrieved by the existing incremental chat sync for a thread. The
  system MUST NOT perform an additional full re-fetch of a thread's history
  to make this judgement.
- **FR-009**: This feature applies only to chat-sourced actions. Actions
  sourced from email or meeting notes (Drive) MUST behave exactly as they do
  today - no resolution judgement is applied to them in this phase.
- **FR-010**: A failure while judging one action's resolution (e.g. the
  underlying judgement call errors) MUST NOT change that action's status and
  MUST NOT prevent the rest of that sync (other actions, other sources) from
  completing.

### Key Entities

- **Action (chat-sourced)**: Gains a new resolution-ask attribute, captured
  once at creation and read (never overwritten by resolution judgement
  itself) on each later sync that has delta activity for its thread. Its
  existing status, resolved-at, and stale-review attributes are the ones
  this feature changes as an outcome of judgement.
- **Sync delta**: The set of new chat messages fetched for a thread since the
  last successful sync of that source - already produced by the existing
  incremental sync; this feature reads it but does not change how it is
  fetched.
- **Resolution verdict**: One of resolved / unsure / still-open, produced
  per open chat action per sync where its thread had delta activity. Not
  persisted as its own record - it is consumed immediately to decide the
  action's status/review-flag change (or lack of one).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A chat action whose thread is clearly answered in a later
  message is closed automatically on the next sync that reads that message,
  with no manual action required.
- **SC-002**: No chat action is closed automatically unless its captured ask
  was clearly satisfied by delta content - an ambiguous case never results
  in an automatic close (it is flagged for review instead).
- **SC-003**: A new or materially different ask appearing in a thread that
  already has an open action never causes that unrelated original action to
  be closed by this feature; it either updates the existing action or
  results in a separate one.
- **SC-004**: Every chat action created after this feature ships has a
  non-empty captured resolution ask recorded at creation time.
- **SC-005**: Introducing this feature causes no observable change in
  behavior for email- or meeting-notes-sourced actions.

## Assumptions

- "Resolved" is judged purely from message content in the delta, regardless
  of sender identity (per the brief's decision that anyone can resolve it,
  not only the reader).
- The three-verdict judgement is performed via the same local `claude` CLI
  subprocess mechanism already used for extraction (Constitution II: No
  Separate AI Billing) - this spec does not prescribe the exact prompt, only
  the required inputs (captured ask + delta) and outputs (one of the three
  verdicts).
- No new concurrency/rate limiting is introduced beyond what already governs
  per-item extraction calls during a sync; the volume of open chat actions
  needing judgement in one sync is assumed to be small enough that this is
  acceptable for this phase (per the brief, sizing this is left to planning
  if needed, not resolved here).
- No UI change is required to distinguish an action closed by resolution
  detection from one the user closed manually - this is out of scope per the
  brief and may be revisited later.
- What happens when a user manually reopens an action and a later sync's
  delta is again judged resolved is not addressed by this feature; it is
  expected to behave however existing status-transition logic already
  handles a status change compared to a manual one, with no new precedence
  rule introduced here.
