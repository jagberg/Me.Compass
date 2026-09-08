# Intent: Action extraction criteria
Author: Justin Goldberg. Status: draft.

## Problem
The system already scans email, chat, and meeting notes to pull out actionable items, but no
one ever decided what "actionable" actually means. It was built before this was thought through.

## Proposed outcome
Actions get judged case-by-case rather than matched against fixed rules, favouring catching
everything actionable over staying quiet - better to surface a borderline item than miss a real
commitment. Extraction stays limited to things involving the user directly: asks made of them,
or commitments they made themselves - not team-wide chatter.

## Affected users and systems
The action extraction step used across all three sources (email, chat, meeting notes).

## Constraints
Must keep working the same way it does today, without introducing new paid API usage.

## Open questions
- Exact criteria for what makes something "involving the user" - not decided yet, needs a brief
- Whether a confidence score per item should be stored/shown, or extraction stays binary include/exclude
- Whether recall-first will need a review/triage step later so false positives don't clutter the actions list
