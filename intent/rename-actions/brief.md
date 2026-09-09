# Brief: Rename actions
Status: approved

## Summary
Let the user edit an action's title inline on the board, and treat that edit
as authoritative so a later sync never overwrites it. Titles today are
AI-generated at extraction and cannot be changed, so a misread or awkward
title stays wrong.

## Problem / Context (JTBD)
When I'm scanning my action board, I want the title of each item to read the
way I'd say it, so I can trust the list at a glance and act without
re-reading the source. Today the title is whatever the extraction produced.
Sometimes it misreads the ask; sometimes it's accurate but wordier than I'd
write it. There is no way to fix either, so the board carries titles I don't
fully trust or wouldn't have chosen.

User: the single user of this local tool (no customer segment applies - this
is the internal action manager, not the Compare Club funnel).

## Goals & Success Metrics
Primary (qualitative, by the user's choice - no Mixpanel event, this is the
local tool): I can rename any action's title on the board, the new title
saves and displays immediately, and a title I've renamed is never replaced by
a later sync of the same source.

There is deliberately no quantitative target. Acceptance is functional: the
requirements below either pass or fail on a manual try.

Incrementality guardrail: not applicable (no customer-facing channel, no risk
to the phone-led channel).

## Scope

### In scope
- Editing an action's **title** inline on the board.
- Persisting the edit so reconciliation/merge and future syncs do not
  overwrite a user-renamed title.

### Out of scope
- Editing description, next-step, or requester (title only for now).
- Bulk rename, rename history/undo beyond normal editing.
- Any change to how titles are first generated at extraction.

## Requirements & Acceptance Criteria

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|---------------------|----------|
| FR-1 | Edit an action's title inline on the board | Given an action on the board, when I edit its title and save, then the new title persists and is shown in its place immediately | Must |
| FR-2 | A rename wins over re-extraction | Given I have renamed an action, when a later sync re-reads the same source, then my title is kept and not overwritten by a freshly extracted title | Must |
| FR-3 | A rename survives a merge | Given a renamed action, when another candidate is merged into it, then the surviving action keeps my title | Should |
| FR-4 | A title cannot be blanked | Given I clear the title, when I try to save, then the empty title is rejected and the previous title is kept | Should |

## Open Questions / Risks
- Exact edit affordance: click the title inline to edit, or an "edit" option
  in the ... menu. To be decided at plan/design.
- Whether the original AI-extracted title is retained anywhere (e.g. history
  or on hover) or fully replaced. Leaning fully replaced for simplicity.
- Whether a split-off from a renamed action should inherit the user's title
  or revert to its own extracted title.
- Risk: the "rename wins" flag adds another user-pinned field the reconcile
  step must respect (alongside category_pinned); missing it anywhere would
  silently clobber a rename on sync.
