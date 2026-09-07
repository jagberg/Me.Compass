# ADR 0001: NestJS + React + node:sqlite, TypeScript end-to-end

- Status: accepted
- Date: 2026-09-07

## Context

Personal Action Manager is a single-user, local-first app (see ADR 0003) with a
stated forward-looking requirement: keep the core simple, but structure it so
action-management is a cleanly separable first module, with more modules
plugged in later (not built yet — no generic plugin framework exists today).
A backend, a frontend, and a storage layer had to be chosen for a project with
roughly 4 REST endpoints of complexity today.

## Decision

Backend: NestJS on the Fastify adapter (`@nestjs/platform-fastify`). Frontend:
React + Vite. Language: TypeScript end-to-end. Storage: `node:sqlite`
(Node's built-in `DatabaseSync`, stable flag-free from Node ~22.13+; the
Docker image pins Node 24), one file, plain `.sql` migrations run with
`CREATE TABLE IF NOT EXISTS` at boot — no ORM.

## Alternatives considered

- Bare Node/Fastify — less ceremony for today's ~4 endpoints, but no
  built-in module/DI boundary; the "cleanly separable module" requirement
  would mean hand-rolling that boundary from scratch once a second module
  actually shows up.
- Python (FastAPI or similar) — no Python framework has Nest's DI/module
  conventions built in either, so it buys nothing over bare Fastify on the
  one requirement that mattered, while splitting a solo-maintained project
  into two languages for no offsetting benefit.
- Prisma / TypeORM — rejected in favor of raw `node:sqlite` queries; the
  schema (Action, SourceConnection, RunResult — see
  `specs/001-personal-action-manager/data-model.md`) is simple enough that an
  ORM is a dependency doing what a Node built-in already does.
- `better-sqlite3` — rejected for the same reason: a dependency replacing a
  built-in that now exists.

## Consequences

More files/boilerplate than a 4-endpoint app strictly needs today (Nest's
module/controller/service/repository layering). In exchange, each future
pluggable module maps directly onto a Nest module — the plugin seam this
project explicitly wants exists for free, rather than needing to be invented
later under time pressure.

Full reasoning trail: `.scratch/personal-action-manager/issues/05-tech-stack.md`
(the wayfinder ticket that resolved this), and the environment check (Node
26.7.0, Docker 29.7.2 already installed; system Python 3.9.6, would need
`uv`-managed replacement) that informed it.
