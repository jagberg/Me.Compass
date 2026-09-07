# Brief: Personal Action Manager
Status: approved

## Summary

A personal, local tool that aggregates actions owed by the user from email, meeting notes, and chat, nudges on what's overdue, and uses AI (via the local Claude Code CLI) to suggest — and on request, trigger — the actual next step for each one. Now, because the backlog of ad-hoc asks and follow-ups is untracked and easy to drop.

## Problem / Context (JTBD)

**Target segment**: busy leaders who need help managing ad-hoc requests and stakeholders — including following up with their own staff to make sure delegated work actually gets done.

**Job to be done**: when an action lands on this person — an email that needs a reply, a meeting action item, someone asking for something in chat, a verbal ask — they need it captured, tracked, and nudged before it's forgotten, and they need help figuring out (or just doing) the actual next step without re-deriving context each time.

**Current friction**: actions arrive scattered across email, meetings, and chat with no single place that tracks them, no overdue signal, and no help translating "this is assigned to me" into "here's what to actually do." Following up on delegated work (staff/stakeholders not doing what they committed to) is itself just another dropped action in the same pile.

## Goals & Success Metrics

- **Backlog size (primary)**: count of open actions trends down over time to a low, consistent steady-state. Baseline: ~10+ open actions today. Target: not yet fixed to a number — directional ("slowly decreasing to a consistent number"); see Open Questions.
- **Suggestion quality (secondary)**: proportion of AI-suggested next steps the user runs with no or minimal edits (vs. rewritten or ignored) — a proxy for "the tool got it right without me having to fix it."
- **Adoption (secondary)**: the tool is actually opened and used regularly. No instrumentation stack decided for this app (Mixpanel is Compare Club's product stack, not wired into a personal local tool) — measurement approach is an open question.
- **Incrementality guardrail**: N/A. No sales funnel or phone-led channel involved; this is an internal personal tool, not a Compare Club customer-facing feature.

## Scope

**In scope (v1)**
- Sources: Gmail (email), Google Drive/Gemini meeting notes ("Next steps" bullets), Google Chat, manual entry (verbal fallback).
- Action data model: title, description, source_type, source_url, status (open/done/dismissed), due_date, due_date_inferred, priority, suggested_next_step, created_at, resolved_at.
- AI inference (via local Claude Code CLI subprocess, no separate API key): suggested next step, and an inferred due date + priority when a source gives none.
- Dashboard: numbered "Today's next steps" summary on top with a per-item Run trigger; body grouped by source (Email/Chat/Meetings/Manual); list and 2×2-panel views, toggleable.
- Per-item Run: hands the suggested step to Claude for drafting/execution, surfaced for review — not sent/executed silently.
- Stack: NestJS (Fastify adapter) + React, TypeScript end-to-end, `node:sqlite`, runs locally in Docker. Single user, no auth.

**Out of scope (v1)**
- Directly tracking whether staff/stakeholders complete their own delegated work — that surfaces only as the user's own "follow up with X" action, not a separate tracking system.
- Multi-user support, authentication, hosting as a shared product.
- A generic plugin system — the NestJS module boundary keeps action-management separable, but no second module is being built yet.

**Phasing**: this PRD covers v1 (personal, single-user, local). A hosted/multi-user phase is a distinct future effort, not scoped here.

## Requirements & Acceptance Criteria

| ID | Requirement | Acceptance Criteria | Priority |
|----|---|---|---|
| R1 | Aggregate actions from Gmail, Drive/Gemini meeting notes, and Google Chat | Given the three sources are connected, when the app syncs, then owed actions from all three appear as unified action records with no manual re-entry | Must |
| R2 | Manual entry for anything with no digital source (verbal asks) | Given a verbal ask, when the user adds it manually, then it's stored with the same fields as any other action (source_type = manual, source_url = null) | Must |
| R3 | Consistent action data model across sources | Given any action regardless of source, when stored, then it has title, description, source_type, source_url, status, due_date, due_date_inferred, priority, suggested_next_step, created_at, resolved_at | Must |
| R4 | Overdue nudging | Given an open action whose due_date is in the past, when shown on the dashboard, then it's visually flagged as overdue (distinct from upcoming/undated) | Must |
| R5 | AI due-date + priority inference for undated actions | Given a source provides no explicit due date, when the action is created, then Claude infers a plausible due date and priority, flags due_date_inferred = true, and the user can edit it afterward | Must |
| R6 | Dashboard: today's next steps + source-grouped body | Given open actions exist, when the dashboard loads, then a numbered "Today's next steps" list (overdue/today/high-priority, capped ~5–6) appears on top, and the remaining actions are grouped by source below, in either list or 2×2-panel view | Must |
| R7 | Per-item Run, with review before action | Given an action has a suggested_next_step, when the user clicks Run, then the local Claude CLI subprocess drafts/executes the step and the result is surfaced for the user to review — not sent or executed silently | Must |
| R8 | Dismiss false positives | Given an inferred action turns out not to be a real ask (misread email/chat), when the user dismisses it, then status = dismissed (kept, not deleted, so inference quality stays visible over time) | Should |

## Open Questions / Risks

- No fixed target number for the backlog metric yet — only directional ("slowly decreasing to a consistent number"). Needs a number before it's truly measurable.
- No usage/adoption instrumentation decided — this app has no analytics stack; how "regularly used" gets measured is unresolved.
- Gmail OAuth/connect-flow UX specifics deferred (per wayfinder map).
- Claude Code CLI's terms of service for unattended/headless use were flagged during research as worth checking if this ever moves beyond personal use — not blocking v1.
- Trust risk: if AI-inferred due dates/priorities are wrong often, the "guessed vs real" flag on the dashboard is the main mitigation — worth watching in practice.
- Assumption to confirm: Run always surfaces a draft/result for review rather than auto-sending — if that's wrong, R7's acceptance criteria needs to change.
