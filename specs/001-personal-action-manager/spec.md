# Feature Specification: Personal Action Manager

**Feature Branch**: `[001-personal-action-manager]`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Personal, local tool that aggregates actions owed by the user from Gmail, Google Drive/Gemini meeting notes, and Google Chat, plus manual entry; nudges on overdue actions; uses AI (via local Claude Code CLI) to infer due date/priority for undated actions and to suggest — and on request, run — the next step. Dashboard shows a numbered 'Today's next steps' list on top and a source-grouped body below, in list or 2x2-panel view. Single-user, no auth, runs locally in Docker."

## Clarifications

### Session 2026-09-07

- Q: Once the user reviews a Run result, does the system send/execute it, or does the system's involvement end at surfacing the draft? → A: Draft/surface-only for this spec — Run never sends or executes anything; the user sends/executes manually outside the app. A future phase may add a separate "Approve & Send" step (potentially per-source, not uniform), but that is out of scope here.
- Q: What backlog size counts as the "low, steady-state" target in SC-005? → A: Under 10 open actions at any time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See everything owed, in one place, with overdue flagged (Priority: P1)

The user opens the dashboard each morning and sees every action they owe — pulled from Gmail, meeting notes, and Google Chat — as one consistent list, with anything overdue visually called out.

**Why this priority**: This is the core value proposition (untracked, scattered actions become one tracked list) and the smallest slice that is useful on its own, even before any AI suggestion or Run capability exists.

**Independent Test**: Connect the three sources, let the app sync, and confirm actions from all three appear as unified records grouped by source, with any action whose due date has passed shown as overdue and distinct from upcoming/undated actions.

**Acceptance Scenarios**:

1. **Given** Gmail, Drive/Gemini meeting notes, and Google Chat are connected and each has at least one owed action, **When** the app syncs, **Then** all three appear as action records with title, description, source, and status, with no manual re-entry required.
2. **Given** an open action whose due date is in the past, **When** the dashboard loads, **Then** it is visually flagged as overdue, distinct from actions due today, due later, or with no due date.
3. **Given** open actions from multiple sources, **When** the dashboard loads, **Then** actions are grouped by source (Email, Chat, Meetings, Manual) in the body of the dashboard.

---

### User Story 2 - Get help deciding, and doing, what's next (Priority: P2)

For any action that has no explicit due date, the user wants the app to infer a reasonable due date and priority so it doesn't just sit un-prioritized. For any action, the user wants a suggested next step, and a one-click way to have Claude draft or perform that step for review rather than having to start from scratch themselves.

**Why this priority**: This is what turns a tracking list into something that reduces effort, not just visibility — but it depends on User Story 1 existing first (there must be actions to infer against and run).

**Independent Test**: Create an action from a source that provides no due date, confirm Claude assigns a plausible due date and priority with `due_date_inferred = true` and that the user can edit the value afterward. Separately, click Run on an action with a suggested next step and confirm a result is surfaced for review before anything is sent.

**Acceptance Scenarios**:

1. **Given** a source provides no explicit due date for an action, **When** the action is created, **Then** Claude infers a due date and priority, the action is flagged as inferred, and the user can edit either value afterward.
2. **Given** an action has a `suggested_next_step`, **When** the user clicks Run, **Then** the local Claude CLI subprocess produces a result for that step and surfaces it to the user for review before anything is sent or finalized.
3. **Given** the numbered "Today's next steps" list on the dashboard, **When** it is generated, **Then** it contains overdue, due-today, and high-priority actions, capped at roughly 5–6 items, each with its own Run control.

---

### User Story 3 - Capture verbal asks and correct bad inferences (Priority: P3)

The user wants to manually add an action that arrived verbally (no digital trace), and to dismiss an action the app inferred incorrectly (e.g., a misread email that wasn't really a request), without losing the record of that mistake.

**Why this priority**: Completes coverage of all four intake paths and keeps inference-quality visible over time, but the app is useful without it — it's a refinement on top of Stories 1 and 2.

**Independent Test**: Add a manual action and confirm it is stored with the same fields as any sourced action (`source_type = manual`, `source_url = null`). Separately, dismiss an inferred action and confirm its status becomes `dismissed` rather than being deleted.

**Acceptance Scenarios**:

1. **Given** a verbal ask with no digital source, **When** the user adds it manually, **Then** it is stored with the same fields as any other action, with `source_type = manual` and `source_url = null`.
2. **Given** an inferred action that turns out not to be a real ask, **When** the user dismisses it, **Then** its status becomes `dismissed` and the record is kept (not deleted).

---

### Edge Cases

- What happens when a source (Gmail, Drive, or Chat) is unreachable during a sync — do already-stored actions from that source remain visible, and is the failure surfaced to the user?
- What happens when Claude's inferred due date or priority is clearly wrong (e.g., inferred due date in the past for a brand-new action) — the user must be able to correct it, but does the dashboard flag it as "guessed" until they do?
- What happens when the user clicks Run but the local Claude CLI is not available or fails mid-run — the action must not silently appear as done.
- How does the system handle an action that no longer has a clear "next step" once its source content is edited or deleted upstream (e.g., the source email is later deleted in Gmail)?
- What happens when the same real-world ask appears in more than one source (e.g., a meeting action item that is then also emailed) — is each occurrence a separate action record?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST aggregate owed actions from Gmail, Google Drive/Gemini meeting notes, and Google Chat into unified action records with no manual re-entry.
- **FR-002**: System MUST allow the user to manually add an action for asks with no digital source, using the same data model as sourced actions (`source_type = manual`, `source_url = null`).
- **FR-003**: Every action record, regardless of source, MUST have: title, description, source type, source URL (nullable), status (open/done/dismissed), due date, an inferred-vs-explicit due date flag, priority, suggested next step, created-at timestamp, and resolved-at timestamp.
- **FR-004**: System MUST visually flag, on the dashboard, any open action whose due date is in the past as overdue, distinct from actions due today, due later, or with no due date.
- **FR-005**: When a source provides no explicit due date, system MUST have Claude infer a plausible due date and priority, mark the action as inferred, and allow the user to edit either value afterward.
- **FR-006**: Dashboard MUST show a numbered "Today's next steps" list on load, containing overdue, due-today, and high-priority open actions capped at roughly 5–6 items, each with its own Run control.
- **FR-007**: Dashboard MUST show remaining open actions grouped by source (Email, Chat, Meetings, Manual) below the "Today's next steps" list.
- **FR-008**: Dashboard MUST offer both a stacked-list view and a 2×2-panel view of the source-grouped body, toggleable by the user.
- **FR-009**: When the user clicks Run on an action with a suggested next step, system MUST invoke the local Claude Code CLI subprocess to draft/perform that step and surface the result to the user for review — the system MUST NOT send or execute the step silently.
- **FR-010**: System MUST allow the user to dismiss an inferred action that is not a real ask; dismissing MUST set its status to `dismissed` and MUST NOT delete the record.
- **FR-011**: System MUST run entirely locally (Docker), single-user, with no authentication layer.
- **FR-012**: System MUST route all AI inference and Run behavior through the local Claude Code CLI subprocess, without a separate Anthropic API key or billing path.
- **FR-013**: Run is draft/surface-only: the system's involvement ends once the drafted/produced result is surfaced for review. The system MUST NOT send or execute the result on the user's behalf, in this or any future step of this spec — the user sends/executes it themselves outside the app.

### Key Entities *(include if feature involves data)*

- **Action**: A single owed item, regardless of where it came from. Attributes: title, description, source type (email, chat, meeting, manual), source URL (nullable — null for manual), status (open, done, dismissed), due date, due-date-inferred flag, priority (high/medium/low), suggested next step, created-at, resolved-at.
- **Source Connection**: Represents the user's link to an external system (Gmail, Google Drive, Google Chat) that actions are aggregated from. Attributes: source type, connection status. Exact connect-flow mechanics (e.g., Gmail OAuth scopes) are deferred and out of scope for this spec.
- **Run Result**: The output of invoking Claude on an action's suggested next step — a draft tied to a specific Action, surfaced for user review. Never sent or executed by the system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can see every action they currently owe, across all connected sources, in one dashboard view without checking Gmail, Drive, or Chat separately.
- **SC-002**: An overdue action is visually distinguishable from a non-overdue one within a single glance at the dashboard (no click-through required to determine overdue status).
- **SC-003**: For an action with no explicit due date, the user is not required to manually set a due date and priority before it appears correctly prioritized on the dashboard.
- **SC-004**: A user can go from "action needs doing" to "reviewing a drafted next step" in a single click (Run), without re-typing context already captured in the action.
- **SC-005**: The count of open actions trends downward over time toward a steady-state backlog of under 10 open actions at any time.
- **SC-006**: A majority of AI-suggested next steps are run by the user with no or only minor edits, indicating the suggestion was usable as-is.

## Assumptions

- Sync between the app and Gmail/Drive/Chat is user-triggered (e.g., a refresh action) for v1; there is no requirement for real-time push updates, since none was specified.
- No cross-source deduplication is required for v1: if the same real-world ask appears in two sources (e.g., a meeting item later emailed), each occurrence is stored as its own action record. Manual dismissal (FR-010) is the mechanism for cleaning up duplicates the user notices.
- Adoption/usage is judged subjectively by the user (is the dashboard actually opened and used) rather than through any automated analytics/instrumentation, since no analytics stack is available or in scope for this personal tool.
- Gmail's exact OAuth/connect-flow UX is deferred; this spec assumes some form of one-time "connect" action per source, consistent with the wayfinder map, and does not define its steps.
- Productization (multi-user, authentication, hosting) is out of scope entirely for this spec, consistent with the PRD's phasing.
- "Priority" (high/medium/low) is either supplied by inference (FR-005) or set manually by the user; no separate approval workflow for priority values is required.
