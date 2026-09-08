# Feature Specification: Action Extraction Criteria

**Feature Branch**: `002-action-extraction-criteria`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Use the approved PRD at intent/action-extraction-criteria/brief.md (and intent/action-extraction-criteria/intent.md for extra context) as the source for this feature spec. Feature: Action extraction criteria - define judgment-based criteria for what counts as an actionable item when extracting from email, chat, and meeting notes, scoped to items involving the user directly, biased toward recall over precision, implemented via the existing local Claude CLI extraction prompt with no change to the extraction mechanism."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Never miss a real commitment (Priority: P1)

As the user, when I sync my email, chat, and meeting notes, I want every real ask made of me
or commitment I made myself to end up in my actions list, so I don't have to re-read every
thread to find what I owe people.

**Why this priority**: This is the core value of the feature. Without reliable capture, the
whole action-manager tool is untrustworthy and the user has to keep manually checking sources
anyway.

**Independent Test**: Sync a batch of real sources containing a set of known asks/commitments,
then verify each one appears as an extracted action.

**Acceptance Scenarios**:

1. **Given** an email/chat message/meeting note where someone explicitly asks the user to do
   something, **When** the source is synced, **Then** an action is created for it.
2. **Given** an email/chat message/meeting note where the user states they will do something,
   **When** the source is synced, **Then** an action is created for it.
3. **Given** a raw item with a vague or ambiguous possible commitment involving the user,
   **When** the source is synced, **Then** an action is still created for it rather than
   silently dropped.

---

### User Story 2 - Keep the list free of noise not involving me (Priority: P2)

As the user, I want the actions list to exclude things assigned to other people that don't
involve me, so the list stays about what I actually owe rather than everything happening
around me.

**Why this priority**: Without this, the recall-first bias in User Story 1 would flood the
list with team-wide chatter and make it unusable, even though missing a real commitment is
worse than a bit of extra noise.

**Independent Test**: Sync a batch of sources containing items assigned solely to other people,
then verify none of them appear as extracted actions.

**Acceptance Scenarios**:

1. **Given** a raw item where an action is assigned to someone else with no involvement from
   the user, **When** the source is synced, **Then** no action is created for it.

---

### Edge Cases

- What happens when a thread contains both an ask directed at the user and an unrelated ask
  directed at someone else in the same message? Only the part involving the user should
  produce an action.
- What happens when the user is only cc'd/mentioned in passing with no ask or commitment
  attached to them? No action should be created.
- What happens when a commitment the user made earlier in a thread is later resolved
  ("done", "sent it") later in the same thread? Out of scope for this feature - thread-level
  resolution tracking is not addressed here (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extraction criteria MUST classify a raw item as actionable when it contains
  an explicit ask directed at the user.
- **FR-002**: The extraction criteria MUST classify a raw item as actionable when the user
  states an intention or commitment to do something themselves.
- **FR-003**: The extraction criteria MUST NOT classify a raw item as actionable when the
  action is assigned solely to someone other than the user, with no involvement from the user.
- **FR-004**: When a raw item contains an ambiguous or vague possible commitment involving the
  user, the extraction criteria MUST classify it as actionable rather than excluding it
  (recall-first bias).
- **FR-005**: Extraction MUST continue to run through the existing local extraction mechanism
  with no new authentication, API key, or billing requirement introduced.
- **FR-006**: The extraction criteria MUST apply uniformly across all three source types
  (email, chat, meeting notes) rather than differing rules per source.

### Key Entities

- **Candidate item**: A raw piece of text from a source (email, chat message, or meeting note)
  evaluated against the extraction criteria to decide whether it becomes an action.
- **Action**: An existing entity representing something the user owes; this feature changes
  only the criteria used to decide whether a candidate item becomes an Action, not the
  Action entity itself.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Of a sample batch of real synced items containing known commitments involving
  the user, at least 90% appear as extracted actions.
- **SC-002**: Of a sample batch of real synced items containing items assigned solely to other
  people, none appear as extracted actions.
- **SC-003**: A person reviewing a sample batch of extracted actions can, without additional
  context, understand why each item was included (it names an ask of, or a commitment by, the
  user).

## Assumptions

- The existing three sources (email, chat, meeting notes) all feed into the same shared
  extraction step and will share one set of criteria, not per-source rules.
- Confidence scoring per item, and any review/triage step for false positives, are out of
  scope for this feature - the extraction result remains a binary include/exclude decision.
- Thread-level resolution (recognising that an earlier commitment was later completed within
  the same thread) is out of scope for this feature.
- The existing extraction mechanism (a local, non-billed subprocess call) is reused unchanged;
  only the criteria it applies are being defined.
- Success is measured by manual review of sample batches; no new automated instrumentation is
  introduced by this feature.
