# Brief: Action digest
Status: approved

## Summary
Turn the raw, duplicated stream of extracted actions into a single trustworthy digest:
de-duplicate across sources, attribute each action to who's asking, file it into a
user-maintained category, and present it as a priority-first board. Now, because chat
extraction is message-level and duplicates heavily (one Okta request became 5 actions), and
the flat list mixes 62 raw items with no grouping or attribution.

## Problem / Context (JTBD)
When Justin syncs Gmail, Google Chat, and Gemini meeting notes, he needs one reliable list of
what he actually owes - deduped, attributed, and grouped the way he thinks about his work - so
he can triage his day without re-reading threads or mentally merging duplicates. Today the
list has ~60% duplication, no sense of who's waiting on him, and no grouping he controls.
(Internal single-user tool - customer segment and phone-channel incrementality N/A.)

## Goals & Success Metrics
**Primary metric:** duplication rate in the displayed list.
- **Definition:** of raw extracted actions in a sync, the % that survive as duplicates in the
  displayed list (same real task shown more than once).
- **Baseline:** ~60% (62 raw to ~24 real on the reference dataset).
- **Target:** <5% duplicates after merge + chat thread-awareness.
- **Measurement:** compare raw extracted count vs. displayed action count on a sample sync,
  manually confirming which displayed items are genuine duplicates.

**Secondary:** every displayed action carries a requester and a category (0 uncategorised
actions left unreviewable - they surface in an Uncategorised bucket for filing).

## Scope
Delivered as one feature (no phasing).

**In scope**
- Chat thread/space-aware extraction (read a space/thread as a unit, not per message).
- Cross-source action de-duplication / merge (collapse the same real task, incl. across
  email + chat).
- A `requested_by` field - who is asking (real name where the source gives it; role otherwise).
- A user-maintained category taxonomy: named categories, filing rules, an Uncategorised bucket.
- The priority-first category board UI: categories ordered by urgency, no gaps between groups,
  source icon per line (email/chat/meeting), work title + next step per line, circular play
  button (drafts the next step), switch between two-column / single-rail / manage-taxonomy.
- Stale-state weighting on long threads (favour the current open item over an early ask).
- Content-conflict detection (surface opposite requests instead of silently merging).

**Out of scope**
- Changing the manual-sync trigger model, or the local Claude CLI extraction mechanism.
- Multi-user, sharing, or any hosted/cloud component.
- Auto-executing next steps (Run still drafts for review only, per constitution Principle IV).

## Requirements & Acceptance Criteria

| ID | Requirement | Acceptance Criteria | Priority |
|----|---|---|---|
| R1 | Chat extraction is thread/space-aware | Given a chat space with one request restated across messages, when synced, then one action is produced, not one per message | Must |
| R2 | Cross-source de-duplication | Given the same real task appears in email and chat, when synced, then it appears once in the displayed list | Must |
| R3 | Requester on every action | Given an extracted action, when displayed, then it shows who requested it (name where known, role otherwise) | Must |
| R4 | User-maintained category taxonomy | Given a category with a filing rule, when a new action matches, then it's filed there; unmatched actions land in Uncategorised | Must |
| R5 | Priority-first category board | Given displayed actions, when the board renders, then categories are ordered by their most-urgent item, columns have no gaps between groups, and each line shows source icon, title, next step, due, and a circular play button | Must |
| R6 | View switch | Given the board, when the user flips the switch, then it changes between two-column (default), single-rail, and manage-taxonomy | Must |
| R7 | Stale-state weighting | Given a long thread whose early ask was resolved later, when extracted, then the action reflects the current open item, not the stale one | Should |
| R8 | Conflict detection | Given two messages requesting opposite actions, when merged, then the conflict is surfaced for a decision, not silently collapsed | Should |
| R9 | Run drafts only | Given the play button, when pressed, then a draft next step is produced for review with no external send | Must |

## Open Questions / Risks
- Google Chat space access may be restricted on some Workspace configs (worked here, but a risk).
- Merge/dedup and category-filing are model-judgement calls; needs a review/correction path so
  a wrong merge or mis-file is recoverable (mechanism TBD).
- Taxonomy editing UX (creating categories, writing filing rules) is designed but its
  persistence model isn't specified yet.
- `requested_by` for chat is role-only until a way to resolve chat sender identity is defined.
