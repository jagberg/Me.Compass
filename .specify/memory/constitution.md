<!--
Sync Impact Report
Version: none → 1.0.0 (initial ratification)
Modified principles: n/a (first adoption)
Added sections: Core Principles (I–V), Governance
Removed sections: none
Templates requiring updates: plan-template.md, spec-template.md, tasks-template.md — not yet
  checked against this constitution; verify on next /speckit-plan run that Constitution Check
  gates reference these five principles by name.
Follow-up TODOs: none
-->

# Personal Action Manager Constitution

## Core Principles

### I. Local-First
The system MUST run entirely on the user's own machine via Docker, with no cloud backend
dependency. It is single-user and requires no authentication for v1. A future hosted or
multi-user phase is a distinct, separate effort and MUST NOT be designed for, scaffolded, or
partially implemented within this phase.

Rationale: The user owns their data and runtime end-to-end; premature multi-tenant or auth
design would add complexity with no current user to justify it.

### II. No Separate AI Billing
All AI calls MUST be routed through the local Claude Code CLI as a subprocess, riding the
user's existing Code subscription. A direct Anthropic API key or billing path MUST NOT be added
without an explicit, separate decision to do so.

Rationale: Avoids duplicate AI spend and keeps the system dependent on infrastructure the user
already pays for and controls.

### III. Modular by Construction, Not by Scaffolding
NestJS's module/DI system MUST be used as the seam for future pluggable tools. Action-management
is the first module. A generic plugin framework MUST NOT be built speculatively before a second
module actually exists.

Rationale: YAGNI — the seam NestJS already provides is sufficient until a real second module
proves what abstraction is actually needed; guessing that shape in advance produces the wrong
abstraction as often as the right one.

### IV. Review Before Action
Any AI-triggered "Run" on a suggested next step MUST surface a draft or result for human review.
The system MUST NOT send or execute silently on the user's behalf.

Rationale: AI suggestions can be wrong or context-blind; a human checkpoint before any
side-effecting action is the only reliable guard against silent, unwanted execution.

### V. Simplicity Over Speculative Infrastructure
Persistence MUST use SQLite via `node:sqlite`, with no ORM and no premature abstractions.
Additional complexity MUST only be introduced when a concrete, present need forces it.

Rationale: `node:sqlite` is sufficient for a single-user, local-first system; an ORM or extra
abstraction layers would trade real, current simplicity for hypothetical future flexibility.

## Governance

This constitution supersedes conflicting practices, templates, or ad-hoc conventions used
elsewhere in the project. Any plan, spec, or task that conflicts with a principle above MUST
either be revised to comply or document an explicit, justified exception before proceeding.

Amendments require: the change to be written into this file, the version bumped per the policy
below, and the Sync Impact Report at the top of this file updated to describe what changed.

Versioning policy (semantic):
- MAJOR: a principle is removed or redefined in a backward-incompatible way.
- MINOR: a new principle or section is added, or existing guidance is materially expanded.
- PATCH: wording, clarification, or typo fixes with no semantic change.

All plans and reviews (`/speckit-plan`, `/speckit-analyze`, `/speckit-implement`) MUST verify
compliance with these five principles. Complexity that appears to violate Principle III or V
must be justified in the plan's Complexity Tracking section before implementation proceeds.

**Version**: 1.0.0 | **Ratified**: 2026-09-07 | **Last Amended**: 2026-09-07
