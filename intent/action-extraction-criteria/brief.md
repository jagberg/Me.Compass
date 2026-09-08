# Brief: Action extraction criteria
Status: approved

## Summary
The action-extraction step (email, chat, meeting notes) currently has no defined criteria for
what counts as an actionable item - it was built before this was decided. This PRD defines
judgment-based extraction criteria so the feature reliably captures real commitments without
being decided ad hoc.

## Problem / Context (JTBD)
When Justin is pulled from email, chat, and meeting notes, he needs the system to surface things
he's actually on the hook for - asks made of him, or commitments he made himself - so he doesn't
have to re-read every thread to find what he owes people. Today the extraction prompt has no real
criteria, so it's unclear whether it's catching the right things.

## Goals & Success Metrics
**Primary metric:** % of known commitments captured.
- **Definition:** of the real asks/commitments Justin can independently verify from a batch of
  synced sources, the fraction that appear as extracted actions.
- **Baseline:** unmeasured - feature has not been evaluated since build.
- **Target:** 90%+ captured.
- **Measurement method:** manual review of a sample batch of real sync runs against known
  commitments, no instrumentation change required.

## Scope

**In scope**
- Rewriting the extraction prompt's criteria for what counts as an actionable item
- Scoping extraction to items involving Justin directly (asks made of him, commitments he made)
- Biasing extraction toward recall - ambiguous/borderline items should be included, not excluded
- Keeping extraction on the existing local Claude CLI subprocess approach (no API key change)

**Out of scope**
- Confidence scores per extracted item (storage or display)
- A review/triage queue or any UI changes
- Changes to source fetching (Gmail/Chat/Drive client logic), sync scheduling, or auth

## Requirements & Acceptance Criteria

| ID | Requirement | Acceptance Criteria | Priority |
|----|---|---|---|
| R1 | Extraction prompt defines explicit criteria for "involving Justin" | Given a raw item where Justin is asked to do something or states he will do something, when extracted, then it is included as an action | Must |
| R2 | Extraction excludes team-wide chatter not involving Justin | Given a raw item where an action is assigned to someone else with no involvement from Justin, when extracted, then it is not included | Must |
| R3 | Extraction favours recall over precision on ambiguous items | Given a raw item with an ambiguous or vague possible commitment involving Justin, when extracted, then it is included rather than silently dropped | Must |
| R4 | No change to extraction mechanism | Given the updated prompt, when extraction runs, then it still executes via the local `claude` CLI subprocess with no new API key or billing | Must |

## Open Questions / Risks
- Recall-first may increase false positives / noise; no triage mechanism exists yet to manage that if it becomes a problem (deferred, out of scope for this PRD)
- No automated instrumentation for the success metric - relies on manual spot-checking until/unless that's worth automating
