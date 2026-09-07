# ADR 0003: Local-first, single-user, no auth for v1 — productization deferred

- Status: accepted
- Date: 2026-09-07

## Context

The user's stated long-term ambition is to eventually publish this as a
hosted product. The immediate, concrete need is a personal tool for
themselves, right now, to stop dropping actions owed to them. Those two facts
pull in different architectural directions if not explicitly reconciled.

## Decision

v1 runs entirely locally, in a single Docker container (see ADR 0001), for a
single user, with no authentication layer and no multi-tenancy. Productizing
this — auth, multi-tenant data model, hosting — is treated as a distinct
future effort, explicitly out of scope for the current codebase's design, not
something this build leaves half-built.

## Alternatives considered

- Building auth/multi-tenancy in from day one, since the eventual goal is
  known — rejected as premature. Per the project's own simplicity principle
  (Principle V, `.specify/memory/constitution.md`), the seam is left open
  (no hardcoded single-user assumption buried deep in the data layer — see
  `specs/001-personal-action-manager/data-model.md`) without building the
  system for a user that doesn't exist yet.

## Consequences

Revisiting productization later means adding a real auth layer and likely a
multi-tenant retrofit of the data model — a genuine, deliberately accepted
future cost, taken on in exchange for not carrying that infrastructure's
weight through a build that has exactly one user today.

Full reasoning trail: `.scratch/personal-action-manager/map.md` (Notes
section, and the "Not yet specified" fog item "Productization path"), and
`specs/001-personal-action-manager/plan.md` Constitution Check (Principle I:
"Single Docker container, no cloud backend, no auth layer planned — PASS").
