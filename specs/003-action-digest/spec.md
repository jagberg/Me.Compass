# Feature Specification: Action Digest

**Feature Branch**: `003-action-digest`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Action digest - chat thread/space-aware extraction, cross-source action de-duplication/merge, a requested_by field, a user-maintained category taxonomy (filing rules + Uncategorised bucket), and the priority-first category board UI, plus stale-state weighting on long threads and content-conflict detection. Source: intent/action-digest/brief.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One action per real task, not per message (Priority: P1)

As the user, when I sync my sources, I want each real task to appear once - even when it was
raised across many chat messages or restated in both an email and a chat - so my list reflects
what I actually owe, not how many times it was mentioned.

**Why this priority**: This is the core value. Today the list is ~60% duplicates (one change
request became five actions), which makes it untrustworthy and forces manual mental merging.
Without de-duplication the rest of the feature sits on a broken list.

**Independent Test**: Sync a chat space where one request is restated across several messages,
and a task that appears in both an email and a chat; verify each produces exactly one action.

**Acceptance Scenarios**:

1. **Given** a chat space where one ask is restated across several messages, **When** the source
   is synced, **Then** one action is created for it, not one per message.
2. **Given** the same real task appears in an email thread and a chat message, **When** both are
   synced, **Then** it appears once in the list.
3. **Given** a long thread whose early ask was resolved later in the thread, **When** it is
   synced, **Then** the resulting action reflects the current open item, not the resolved early
   one.

---

### User Story 2 - See who is asking (Priority: P1)

As the user, I want every action to show who is requesting it of me, so I can tell at a glance
who is waiting on me and prioritise accordingly.

**Why this priority**: Attribution is what turns a flat to-do list into a view of obligations.
It also underpins the category board's usefulness - grouping and urgency both read better when
the asker is visible.

**Independent Test**: Sync sources containing asks from a named person (email) and from a chat
sender; verify each action shows a requester - a person's name where the source provides one,
otherwise a role.

**Acceptance Scenarios**:

1. **Given** an emailed ask from a named sender, **When** it is extracted, **Then** the action
   shows that person as the requester.
2. **Given** a chat ask where only a role or channel context is available, **When** it is
   extracted, **Then** the action shows a role rather than a blank requester.

---

### User Story 3 - Group work into my own categories (Priority: P1)

As the user, I want my actions filed into categories I define and maintain (e.g. Software
Renewals, Timesheets, Change Requests), with anything unrecognised landing in an Uncategorised
bucket, so the board is organised the way I think about my work rather than by source.

**Why this priority**: The chosen design is category-first; without a working, user-owned
taxonomy the board cannot render. The Uncategorised bucket is what keeps the taxonomy honest as
new kinds of work appear.

**Independent Test**: Define a category with a filing rule, sync an action that matches it and
one that matches nothing; verify the first is filed under the category and the second appears in
Uncategorised.

**Acceptance Scenarios**:

1. **Given** a category with a filing rule, **When** a new action matches that rule, **Then** it
   is filed under that category.
2. **Given** a new action that matches no category, **When** it is synced, **Then** it appears
   in the Uncategorised bucket for the user to file.
3. **Given** an action filed in the wrong category, **When** the user re-files it, **Then** it
   moves to the chosen category and stays there.

---

### User Story 4 - Read the board by priority (Priority: P2)

As the user, I want a priority-first board where categories are ordered by their most urgent
item and each line shows the source, the work, and its next step with a one-click way to draft
that next step, so I can triage top-to-bottom without re-reading anything.

**Why this priority**: This is the payoff view the other stories feed. It is P2 only because it
depends on Stories 1-3 producing clean, attributed, categorised data first; on its own it would
render a noisy list.

**Independent Test**: With categorised actions present, open the board; verify categories are
ordered by urgency, each line shows a source indicator, title, next step and a control to draft
the next step, and the view can switch between a two-column layout, a single column, and the
category-management screen.

**Acceptance Scenarios**:

1. **Given** categorised actions, **When** the board renders, **Then** categories are ordered by
   their most-urgent item and each line shows a source indicator, the work title, its next step,
   and the due status.
2. **Given** a line with a next step, **When** the user triggers the draft control, **Then** a
   draft of that next step is produced for review, with nothing sent externally.
3. **Given** the board, **When** the user changes the view control, **Then** it switches between
   two columns (default), a single column, and the manage-categories screen.

---

### Edge Cases

- What happens when two messages request opposite actions (e.g. swap A→B vs swap B→A)? The
  system surfaces the conflict for the user to decide rather than silently merging them into
  one.
- What happens when a merge is wrong (two genuinely different tasks collapsed into one)? The
  user needs a way to split or correct it (correction path).
- What happens to actions created manually, which have no source sender? They carry no requester
  and are filed by the user directly.
- What happens when an already-open action's source thread is resolved after it was synced? On
  the next re-sync of that source, the action is flagged possibly-resolved for the user to
  confirm, not silently left open forever and not auto-closed (FR-014).
- What happens when a category with actions still in it is deleted? Its actions return to
  Uncategorised rather than disappearing.
- What happens when a chat space is inaccessible on the user's account? That source degrades to
  an error state without blocking the others (existing behaviour, preserved).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST read a chat conversation as a unit and produce one action per real
  task, rather than one per message.
- **FR-002**: The system MUST detect when the same real task appears more than once - within a
  conversation, and across email, chat, and meeting notes - and represent it as a single action.
- **FR-003**: When a conversation's earlier ask is resolved or superseded later in the same
  conversation, the resulting action MUST reflect the current open item, not the stale earlier
  one.
- **FR-004**: Each action MUST record who requested it - a person's name where the source
  provides one, otherwise a role. Manually created actions have no requester.
- **FR-005**: The user MUST be able to maintain a set of categories, each with a rule that
  determines which actions are filed into it.
- **FR-006**: Actions that match no category MUST be placed in an Uncategorised bucket, and the
  user MUST be able to file them into a category from there.
- **FR-007**: The user MUST be able to re-file any action into a different category, and the
  change MUST persist.
- **FR-008**: The board MUST order categories by their most-urgent contained item, with
  Uncategorised shown last.
- **FR-009**: Each action line on the board MUST show a source indicator (email / chat / meeting
  notes), the work title, its next step, and its due status.
- **FR-010**: The board MUST offer a draft control per action that produces a draft of the next
  step for review and performs no external send or execution.
- **FR-011**: The board MUST switch between a two-column layout (default), a single-column
  layout, and a category-management screen.
- **FR-012**: When two extracted items request conflicting actions on the same subject, the
  system MUST surface the conflict for the user to resolve rather than merging them silently.
- **FR-013**: The user MUST be able to correct an incorrect merge (separate tasks wrongly
  combined) so the affected tasks are represented separately again.
- **FR-014**: When a re-sync re-reads a source and it no longer yields a matching item for an
  already-open action (the ask was resolved after the last sync), the system MUST flag that
  action as possibly-resolved for the user to confirm, and MUST NOT close it automatically.

### Key Entities *(include if feature involves data)*

- **Action**: An existing entity (a task the user owes). This feature adds a requester, a
  category assignment, and a way to relate duplicates/merges; it does not change what an action
  fundamentally is.
- **Category**: A user-defined grouping with a name and a filing rule that decides which actions
  belong to it. Ordered on the board by the urgency of its actions. "Uncategorised" is a
  reserved bucket, not a user category.
- **Requester**: Who is asking for an action - a person or a role - derived from the source item,
  attached to each action.
- **Merge relationship**: The link that records that several extracted items represent one real
  action (and lets a wrong merge be undone).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a sample sync, fewer than 5% of displayed actions are duplicates of another
  displayed action (baseline ~60%).
- **SC-002**: 100% of displayed actions show a requester (a name or a role); none are blank
  except manually created ones.
- **SC-003**: 100% of displayed actions are either filed under a user category or visible in the
  Uncategorised bucket - none are unreachable.
- **SC-004**: On the board, the category containing the single most-urgent action appears first,
  verifiable by inspection against the actions' due dates and priorities.
- **SC-005**: A wrongly merged pair and a mis-filed action can each be corrected by the user, and
  the correction survives the next sync.
- **SC-006**: An action whose source was resolved after syncing is flagged for review on the next
  re-sync of that source (not left open indefinitely, not auto-closed).

## Assumptions

- Single-user, local tool: no customer segment, no multi-user, no phone-channel incrementality
  (consistent with the project constitution and feature 001/002).
- Sync remains user-triggered; extraction continues to run through the existing local mechanism
  with no new paid API (constitution Principles I, II).
- "Run" continues to draft for review only, never sending or executing (constitution Principle
  IV).
- De-duplication, requester attribution, categorisation, stale-state weighting, and conflict
  detection are judgement calls made during extraction/processing; because they can err, the
  correction path (FR-007, FR-013) is a first-class part of the feature, not an afterthought.
- A starter set of categories may be seeded, but the taxonomy is owned and editable by the user.
- Chat requester attribution may be role-level until a reliable way to resolve a chat sender's
  display name exists; this is acceptable for SC-002.

## Dependencies

- Builds on the thread-aware email extraction and chat access already delivered in this project.
- Meeting-notes actions continue to come from Gemini "Notes by Gemini" documents (the Next steps
  section), not raw transcripts.
