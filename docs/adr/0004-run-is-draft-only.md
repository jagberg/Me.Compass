# ADR 0004: Run drafts a result for human review — never sends or executes

- Status: accepted
- Date: 2026-09-07

## Context

The per-action "Run" control hands a suggested next step to Claude and shows
the result. Whether that result should just be a draft the user reads, or
whether approving it should make the app actually perform the action (send
the drafted email, post the drafted chat reply), was an open question
`/speckit-specify` surfaced explicitly as a `NEEDS CLARIFICATION` marker
before the spec could be considered complete.

## Decision

For this spec, Run is strictly draft/surface-only. It shells out to the
Claude CLI (ADR 0002), writes the output as a `RunResult` linked to the
action, and returns it for the user to read and act on themselves, outside
the app. The app has no send/execute scope of any kind in v1 — no Gmail send
scope, no Chat post scope, nothing that acts on the user's behalf without
them doing the final step manually. This is FR-013 in
`specs/001-personal-action-manager/spec.md`.

## Alternatives considered

- A second "Approve & Send" step that performs the action directly after
  review — not rejected outright, explicitly named by the user as a
  direction to add "later on when I'm confident on what its doing", and
  possibly ending up mixed per source (some source types auto-executable,
  others always draft-only) rather than uniform across all four sources.
  Deferred to a future spec revision, gated on the "suggestion quality"
  metric in `intent/personal-action-manager/brief.md` actually being trusted
  in practice.

## Consequences

Safer default for v1 — no risk of an AI-drafted email or chat reply actually
being sent without a human reading it first — at the direct cost of manual
copy/paste work for the user every time they use Run. This is also encoded as
Principle IV of the project constitution
(`.specify/memory/constitution.md`) and verified live during the build (see
`specs/001-personal-action-manager/quickstart.md` and the build verification
notes in the 2026-09-07 changelog entries below).

If a future session adds "Approve & Send", it supersedes this ADR — do not
silently reinterpret FR-013 or this record to match; open a new ADR that
names this one as superseded.
