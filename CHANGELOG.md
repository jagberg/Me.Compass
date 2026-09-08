# Changelog

Dated, append-only record of decisions for Me.Compass. See `docs/adr/` for
the decisions substantial enough to warrant a full ADR (hard to reverse,
surprising without context, real trade-off).

## 2026-09-07 - Personal Action Manager confirmed as a build, not a buy

**Decision:** Build a custom personal action-management app rather than
adopting an existing SaaS/OSS tool.
**Reasoning:** A research pass across Motion, Reclaim, Akiflow, Sunsama,
Amie, Superhuman, Shortwave, SaneBox, Lindy, and Obsidian/Logseq GTD plugins
found none that cover cross-source action aggregation, overdue nudging, and
AI-inferred next-step suggestion together in a local, pluggable package.
**Trade-off accepted:** Building and maintaining a custom app instead of
paying for/adopting an existing one.
**Alternatives rejected:** each surveyed product covers at most two of the
three requirements; see `.scratch/personal-action-manager/map.md` Notes for
the full list with specifics.
**Supersedes:** n/a

## 2026-09-07 - v1 action sources: Gmail, Google Drive/Gemini meeting notes, Google Chat, manual entry

**Decision:** These four sources, specifically. Meeting actions come from
Gemini's "Notes by Gemini" Google Docs (a consistently structured `Next
steps` section, verified against real Drive files rather than assumed), not
raw transcript parsing.
**Reasoning:** Matches how the user actually receives actions today; the
structured Gemini notes format removes the need to build transcript
extraction.
**Trade-off accepted:** No coverage yet for other meeting tools or
task-assignment systems if the user's toolset changes.
**Alternatives rejected:** manual entry for meetings too (rejected once the
structured Gemini format was found — strictly worse when a real integration
was available for the same or less effort).
**Supersedes:** n/a
**Detail:** `.scratch/personal-action-manager/issues/02-v1-action-sources.md`

## 2026-09-07 - Action data model finalized, with a priority field added late

**Decision:** Core fields: `id/title/description/source_type/source_url/
status(open,done,dismissed)/due_date/due_date_inferred/suggested_next_step/
created_at/resolved_at`. `priority` (high/medium/low) added afterward, once
the dashboard design work showed the app needed it and it wasn't there yet.
**Reasoning:** Undated actions need a due date to be usable at all; Claude
infers one (and priority) rather than falling back to an age-based heuristic,
since the user preferred an editable AI guess over a blunt fixed rule.
**Trade-off accepted:** Every undated/unprioritized action needs a Claude
inference call rather than a free heuristic.
**Alternatives rejected:** age-based overdue fallback with no priority field
— rejected once the dashboard round showed grouping by importance was a hard
requirement, which a due-date-only model can't support.
**Supersedes:** n/a
**Detail:** `.scratch/personal-action-manager/issues/03-action-data-model.md`

## 2026-09-07 - Dashboard design chosen after five prototype rounds

**Decision:** Numbered "Today's next steps" plan on top (with a per-row Run
trigger), body grouped by source (Email/Chat/Meetings/Manual), each row
`● title → next step · due · Run`. Two toggleable views: stacked list and
2×2 panels.
**Reasoning:** User feedback converged on this combination across v1
(too loose) → v2 (too narrow, wanted grouping by importance) → v3 (full-width
shell, real research into Todoist/Linear/Things/etc.) → v4 (cards + a "run
this now" summary, more research into card/today-plan patterns) → v5 (five
variants on the chosen anchors) → final pick of v5-A and v5-D as a single
toggle.
**Trade-off accepted:** No app surveyed puts an AI-generated next step
directly on a row or offers a per-row Run button — this design has no direct
precedent to borrow further refinements from.
**Alternatives rejected:** kanban/board-by-urgency (empty lanes at only
10-15 items); dense Linear-style tables (too list-like for this volume);
side-peek detail panes (next step needed to be on the row, not behind a
click); source tabs (hides the cross-source picture).
**Supersedes:** n/a
**Detail:** `.scratch/personal-action-manager/issues/04-dashboard-prototype.md`.
The prototype HTMLs (including the final chosen `dashboard-final.html`) are
git-ignored, not shipped — their sample data was drawn from real Google Drive
meeting-notes content read during this project's research, not fictional
placeholders, so they stay local-only rather than get scrubbed and committed.

## 2026-09-07 - Tech stack, AI mechanism, local-first scope, and Run behavior

See ADR 0001 (NestJS + React + node:sqlite), ADR 0002 (Claude CLI subprocess,
no API key), ADR 0003 (local-first, single-user v1), ADR 0004 (Run is
draft-only) in `docs/adr/`.

## 2026-09-07 - Backlog steady-state target set at under 10 open actions

**Decision:** Success metric SC-005 fixed to "under 10 open actions at any
time," beating the user's stated baseline of ~10+ today.
**Reasoning:** `/speckit-specify` flagged the metric as directional-only
("slowly decreasing to a consistent number") with no hard number, which
isn't independently measurable; the user picked "under 10" over a tighter
"under 5" when asked directly.
**Trade-off accepted:** none — this is a target number, not a scope change.
**Alternatives rejected:** "under 5" (tighter bar); "no fixed number, judge
trend only" (kept SC-005 directional, harder to call done).
**Supersedes:** the brief's original open question on this metric
(`intent/personal-action-manager/brief.md` Open Questions).

## 2026-09-07 - Build complete: 46/47 tasks implemented and independently verified

**Decision:** Ran `/speckit-implement` against `tasks.md` (47 tasks across
Setup/Foundational/US1-3/Polish); 46 completed. T047 (full quickstart) not
run — needs live Google OAuth consent and Docker registry access, both
unavailable in the sandbox that built this.
**Reasoning:** Design review gate was explicitly confirmed by the user before
running the implement step, per the project's own build-gate process
(`ignite:build`).
**Trade-off accepted:** Gmail/Drive/Chat client code compiles against the
`googleapis` SDK shapes but is unexercised against real API responses; a
containerized boot has not been verified (only a direct `node dist/main.js`
boot was).
**Verification performed independently** (not just trusting the implementing
session's own report): both `tsc --noEmit` builds clean; backend boots with
all routes matching `contracts/api.md`; a manual action with no due date
correctly triggers Claude inference (`due_date_inferred: true`); editing
`due_date` correctly flips that flag back to `false`; Run returns a genuine
Claude-drafted result and performs no send/execute action (FR-013); dismiss
keeps the record queryable while excluding it from the open list (FR-010).
One real bug found and fixed during the build: `apiFetch` set
`Content-Type: application/json` even on bodyless POSTs (e.g. `/run`), which
Fastify rejected as malformed — now conditional on a body being present.
**Alternatives rejected:** n/a
**Supersedes:** n/a

## 2026-09-07 - Action extraction criteria defined: recall-first, scoped to the user

**Decision:** `ClaudeCliService.extractActions()`'s prompt now defines explicit
criteria: include an item when it's an explicit ask of the user or a
commitment the user made themselves; exclude items assigned solely to
someone else; when ambiguous, include rather than drop. Same criteria apply
uniformly across email, chat, and meeting notes - no per-source rules.
**Reasoning:** The extraction step was built (see "v1 action sources" entry
above) before anyone decided what "actionable" meant. Recall was chosen over
precision because there's no triage/review UI yet, so a missed item is
currently unrecoverable except by re-reading the source manually - the exact
problem this feature exists to solve.
**Trade-off accepted:** No confidence scoring or triage queue; a recall-first
bias means more noise may reach the actions list than a precision-first
approach would produce. Verification (`specs/002-action-extraction-criteria/
quickstart.md` scenarios and the SC-001/SC-002 sample-batch review) requires
live-synced real data and human judgment, and was not run as part of this
change - it's a follow-up for whoever has an active Google OAuth connection.
**Alternatives rejected:** a fixed keyword/regex rule engine (rejected -
would miss implicit commitments the way the existing Drive "next steps"
regex already does for meeting notes); precision-first classification
(rejected per the approved brief - recall was explicitly preferred);
confidence-scored triage queue (deferred - needs new storage/UI, out of
scope for this feature).
**Supersedes:** the open questions in
`intent/action-extraction-criteria/intent.md` and
`specs/002-action-extraction-criteria/spec.md`.
