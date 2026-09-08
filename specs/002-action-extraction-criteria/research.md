# Phase 0 Research: Action Extraction Criteria

No `[NEEDS CLARIFICATION]` markers remained in `spec.md` - the approved PRD
(`intent/action-extraction-criteria/brief.md`) had already resolved the open design
questions before this spec was drafted. This file records those resolutions as research
decisions for traceability.

## Decision: Judgment-based classification, not a fixed rule engine

**Rationale**: The existing extraction step already shells out to a local LLM (`claude` CLI)
per raw item. Reusing that call to also judge actionability keeps the mechanism unchanged
(constitution Principle II) and lets the classification handle natural-language ambiguity
that a keyword/regex rule set would miss.

**Alternatives considered**:
- A fixed rule engine (regex/keyword matching, e.g. "next steps" heading, explicit dates) -
  rejected as the sole mechanism because it would miss implicit commitments and asks phrased
  without trigger words; the existing Drive "next steps" regex already shows this brittleness
  for one source, and extending it to all three sources would compound the problem.

## Decision: Bias toward recall over precision

**Rationale**: Per the brief, missing a real commitment is worse than a bit of noise the
user has to dismiss. There is no triage/review UI yet (out of scope), so a missed item is
currently unrecoverable except by re-reading the source manually - the exact problem this
feature exists to solve.

**Alternatives considered**:
- Precision-first (only high-confidence items surface) - rejected per the brief's explicit
  choice; would reduce noise but reintroduce the "have to re-read everything" problem.
- Confidence-scored triage queue - deferred; requires new storage/UI, explicitly out of
  scope for this feature.

## Decision: Scope to items involving the user directly

**Rationale**: Matches the product's framing as a *personal* action manager (not team-wide
visibility). Also keeps the recall-first bias from flooding the list with commitments
belonging to other people.

**Alternatives considered**:
- Surface anything actionable in-scope regardless of owner - rejected; broadens the list to
  team-wide chatter, which the brief explicitly did not want.

## Decision: No mechanism change

**Rationale**: Constitution Principle II requires all AI calls to route through the local
`claude` CLI subprocess. This feature only changes the *content* of the prompt used by
`ClaudeCliService.extractActions()`, not how it's invoked.

**Alternatives considered**: None - this is a hard constraint (constitution + PRD), not an
open design choice.
