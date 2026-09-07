# Personal Action Manager

## Destination

Architecture decision + build-ready direction (not a full spec) for a local, Dockerized, single-user personal action-management app: aggregates actions owed by the user, surfaces them plus overdue nudges, and can hand off "what's next" to a detached component. Map is done when nothing's left to decide before `/speckit-specify` takes over.

## Notes

Standing decisions from initial grilling (not tickets — no ticket to link, recorded here as constraints every session should respect):

- Runs locally in Docker. Long-term goal: publish as a hosted product — build single-user, no auth, now; leave a seam, not a system (YAGNI).
- Plugin architecture: keep core simple; structure so action-management is a cleanly separable first module. Don't build a generic plugin system until a second module actually shows up.
- "Next action" inference/auto-start is a detached component that shells out to the local Claude Code CLI as a subprocess (rides the existing Code subscription) — no separate Anthropic API key/billing.
- v1 email source: Gmail via a connect flow. Exact OAuth/setup UX deferred.
- Research surveyed existing SaaS/OSS (Motion, Reclaim, Akiflow, Sunsama, Amie, Superhuman, Shortwave, SaneBox, Lindy, Obsidian/Logseq GTD plugins): none cover cross-source aggregation + overdue nudging + AI-inferred next-step in a local, pluggable package — confirmed as a build, not adopt.

Skills each session should consult: grilling + domain-modeling by default; research skill for research tickets; prototype skill for the dashboard ticket.

## Decisions so far

- [Claude CLI invocation research](issues/01-claude-cli-invocation-research.md): plain `claude -p` (no `--bare`) reuses subscription auth, no API key; `--output-format json --json-schema` gives a parseable next-action object; unattended runs need `--permission-mode auto --permission-prompts none`. ToS check for productized use flagged, not blocking v1.
- [v1 action sources](issues/02-v1-action-sources.md): Gmail (email), Google Drive/Gemini meeting notes (structured `Next steps` bullets, no transcript parsing), Google Chat (personally-assigned, same LLM-inference as email), manual entry (verbal fallback baseline).
- [Action data model](issues/03-action-data-model.md): id/title/description/source_type/source_url/status(open,done,dismissed)/due_date/due_date_inferred/suggested_next_step/created_at/resolved_at. Undated actions get a Claude-inferred due date (editable) instead of a fixed age-based fallback. Addendum from the dashboard work: `priority` (high/medium/low) added; Run lifecycle state and snooze implied, confirm in spec.
- [Dashboard prototype](issues/04-dashboard-prototype.md): numbered "Today's next steps" with per-row Run on top; body grouped by source (Email/Chat/Meetings/Manual) with rows `● title → next step · due · Run`; two toggleable views, stacked list and 2×2 panels. Artifact: `assets/dashboard-final.html`. Five rounds of research + prototypes recorded on the ticket.
- [Tech stack](issues/05-tech-stack.md): NestJS (Fastify adapter) + React, TypeScript end-to-end — Nest's module/DI system matches the plugin-seam requirement directly. `node:sqlite` for storage, no ORM. Python considered and dropped (no offsetting benefit, splits the stack).

## Not yet specified

- Productization path (auth, multi-tenancy, hosting) — likely its own future effort, not this map.
- Gmail connect-flow specifics (OAuth scopes, setup UX) — deferred per user, revisit if it turns out to block the spec.

(Plugin seam's concrete shape — graduated without a ticket: the NestJS module system chosen in ticket 05 *is* the seam. Action-management becomes its own Nest module; a future module plugs in the same way. No further design needed before spec.)

## Out of scope
