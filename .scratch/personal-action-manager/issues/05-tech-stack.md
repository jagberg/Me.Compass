Type: grilling
Status: resolved

## Question

What language/framework/stack for the Dockerized app (backend + dashboard UI), given: local-first, single-user now, future hosted product, and a subprocess call out to the Claude Code CLI?

## Answer

**Backend**: NestJS (TypeScript), running on the Fastify adapter (Nest's own perf-oriented HTTP adapter, so no ceremony-vs-speed trade-off vs raw Fastify). Chosen over bare Node/Fastify and over Python specifically because Nest's module + DI system directly encodes the plugin seam from the map's Notes (action-management as the first pluggable module, more later) — bare Fastify or Python (FastAPI etc.) would mean hand-rolling that same module boundary later with nothing gained. Python was considered and dropped: no Python framework has Nest's DI/module conventions built in, and splitting backend/frontend into two languages is pure maintenance cost for a solo-maintained personal tool when Node's `googleapis` package and `claude -p` subprocess spawning are equally capable.

**Frontend**: React, rebuilding the chosen dashboard design (`assets/dashboard-final.html` — numbered "Today's next steps" plan + source-grouped body, list/panels toggle). Same language as the backend (TypeScript throughout).

**Storage**: `node:sqlite` (Node 26+ stdlib, confirmed installed) — zero extra dependency, single file, matches single-user scope. No ORM for v1; the schema (one `actions` table per ticket 03/04) is simple enough for raw queries. Revisit only if the future hosted-product phase needs concurrent multi-user writes.

**Environment check** (informed the call, not guessed): Node v26.7.0 + npm 11.19.0 already installed and current; Docker 29.7.2 installed (matches the local-Docker decision); no Bun/pnpm/.NET/Go; system Python is old (3.9.6) and would need `uv`-managed replacement if used — one more reason not to add it without a concrete driver.
