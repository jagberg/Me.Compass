Type: prototype
Status: resolved
Blocked by: 03

## Question

What should the dashboard show and how should it behave for surfacing owed actions and overdue nudges? (User: "need to work through some options" — this is the how-should-it-look/behave ticket.)

## Answer

Chosen after five prototype rounds (v1–v5): **[dashboard-final.html](../assets/dashboard-final.html)** — v5-A and v5-D as two views of the same page, toggled in the top bar (`v` key), Linear list↔board style.

Page structure:
1. **Today's next steps** (from v4-A, Motion-agenda style): numbered rows at the top; each row = the AI next step as the headline, title + source + importance underneath, due chip, **▶ Run** button. Keys 1–6 run a step. Selection = open items that are overdue, due today, or high importance, ordered by importance then due; capped at ~5–6.
2. **Body grouped by source** (from v1-C): Email / Chat / Meetings / Manual, in that order, each header colour-coded with a count and an "N overdue" badge.
   - **List view** (v5-A): stacked full-width sections.
   - **Panels view** (v5-D): 2×2 grid, one card per source containing its rows.
3. **Row anatomy** (from v4-C): `● importance dot · title → next step (inline, ellipsised) · due chip · ▶ Run`; hover reveals Done / Snooze / Not an action.

Conventions carried through: due chip colours grey → amber (≤2d) → blue (today) → red (overdue, "Nd overdue"); AI-guessed dates are dashed with an `≈` prefix; importance is a coloured dot (red/amber/grey); Run has an idle → running → "✓ Review" lifecycle. App shell: dark left sidebar with the action module active and reserved slots for future modules, top bar with quick-add.

Rejected along the way: kanban/board-by-urgency (empty lanes at 10–15 items), dense Linear-style tables (too list-like for this volume), side-peek detail panes (next step must be on the row, not behind a click), source tabs (hides the cross-source picture), importance sub-bands inside sources (too much structure for ~3 items per source).

Research behind it is below. Note for the spec: no surveyed app puts an AI next step on the row face or offers a per-item Run — that's the product's differentiator; keep it front and centre.

## Assets

- [v1 — 3 variants](../assets/dashboard-prototype.html): triage list / kanban by urgency / source-grouped + hero. Feedback: too loose, want concise + grouped by importance.
- [v2 — 5 variants](../assets/dashboard-prototype-v2.html): tiers / split inbox / timeline / focus stack / table. Feedback: "look crap", narrow column, want full-width shell with a sidebar reserved for future modules, and real research.
- [v3 — 4 archetypes, full-width shell](../assets/dashboard-prototype-v3.html): A sectioned list + side peek (Todoist/Notion) · B dense table + group-by (Linear) · C Today focus + AI rail (Things/Akiflow/Sunsama) · D board by importance (Asana). Shared shell: dark left sidebar with "Future modules" slots, top bar with quick-add + key hints. Feedback: too list-like; want cards with title + due + next step visible, only 10–15 items so favour beauty, a "today's next steps" summary on top with a per-item trigger.
- [v4 — 4 card layouts, today's-steps summary, Run trigger](../assets/dashboard-prototype-v4.html): A Motion-style numbered plan + Notion/monday coloured importance bands of cards · B Sunsama strip + TickTick time columns · C Reclaim "Up next" hero + Akiflow grouped list · D 3 today tiles + Notion gallery masonry with Trello half-cover strip. Card face = source · title · due chip / next step (visual focus) / Run + hover Done·Snooze·Not-an-action. Run simulated (idle → running → done-review) and keyed 1–6. Feedback: anchors chosen — v4-A "Today's next steps" plan on top; v1-C grouping by source; v4-C inline next step per row.
- [v5 — 5 variants on the chosen anchors](../assets/dashboard-prototype-v5.html): all keep plan-on-top + source grouping + inline-next-step rows; differ in source-group layout — A stacked source sections · B four source columns · C segmented source tabs over one list · D 2×2 source panels · E source sections sub-banded by importance. Source headers carry counts + an overdue badge. Awaiting pick.

## Research round 2 (feeds v4) — cards, groups, today strips, AI triggers

Verified against Trello, Todoist Board, TickTick Kanban, Notion Board/Gallery, monday (feature pages + snippets; help centre 403), ClickUp (same), Asana Board, Height (snippets), Sunsama, Motion AI Agenda, Reclaim Planner, Akiflow Today, MS To Do My Day, Any.do My Day/Board, Superlist Today, Todoist Assist, Notion AI Autofill, Linear Triage / Priority Inbox, Morgen AI Planner, Structured. Rise shut down Mar 2025.

- Card faces: title + colour labels + due badge (Trello colours grey→yellow <24h→red overdue→green done) + avatars + counts. Cover strip = Trello half-cover / Notion card preview. Card size S/M/L (Notion, ClickUp), compact mode (Asana, Any.do).
- Grouping: columns dominate (Trello, Todoist, TickTick, Asana, Any.do, ClickUp). Coloured group bands only in Notion (coloured columns) and monday (table groups). Sunsama alone uses days as the column axis. Columns leave empty lanes at 10–15 items — bands don't.
- Today strips: Motion generates a document-style agenda each morning; Reclaim has an explicit "Up Next" section; Akiflow puts overdue first; To Do / Any.do use a lightbulb Suggestions panel; Morgen previews proposed blocks and confirms with one "Schedule all".
- AI triggers as they exist: property-header menu (Notion Autofill), lightbulb panel (To Do, Any.do), slash command (Motion), keyed row actions Accept/Duplicate/Decline/Snooze = 1/2/3/H (Linear Triage), approve-a-preview (Morgen). **Nobody puts a generated next-step sentence on the card face or ships a per-card Run button** — that's our differentiator; Linear's keyed row and Morgen's preview are the nearest precedents.

Researcher's recommendation: v4-A (numbered plan + bands) — bands scale to 10–15 without empty columns, summary→body reads linearly, numbered rows map to keyboard Run.

Surfaced for the model/spec: `priority` (again), `run_state` or equivalent for the Run lifecycle (idle / running / done-review), snooze as first-class.

Sources (round 2): support.atlassian.com/trello/docs (adding-labels, card-cover, adding-dates, adding-attachments) · todoist.com/help (board layout AiAVsyEI; Todoist Assist KgPP22q5O) · help.ticktick.com/articles/7055782353376903168 (snippet), blog.ticktick.com/2019/05/15/kanban · notion.com/help (boards, galleries, autofill), notion.com/product/ai · support.monday.com kanban 360000661379 (snippet), monday.com/features/kanban · help.clickup.com 35342044832279 (snippet), clickup.com/features/kanban-board · help.asana.com/s/article/asana-kanban-boards, forum.asana.com/t/boards-compact-view-for-cards/10140 · help.height.app 3860578 (snippet) · help.sunsama.com/docs (daily-planning, today-view), sunsama.com · usemotion.com/help/time-management/ai-agenda, usemotion.com/blog/agenda-view · help.reclaim.ai 6206998 · product.akiflow.com/help (0741055 today, 0805246 rituals) · support.microsoft.com My Day & Suggestions · support.any.do (8610743 smart suggestions, 8635279 board views) · help.superlist.com 78868 today view · linear.app/docs/triage, linear.app/changelog/2026-09-03-priority-inbox · morgen.so/guides/plan-your-day-using-the-ai-planner, morgen.so/ai-planner · structured.app · screensdesign.com/showcase/amie-todos-calendar · routine.co.

## Research (feeds v3)

Verified against product docs (Sept 2026) for Todoist, Things 3, TickTick, Linear, Height (snippets only), Superlist, Notion, Asana My Tasks, MS To Do, Any.do, Amie, Sunsama, Akiflow, Motion. Patterns that held across nearly all of them:

- Persistent left nav; main list uses full width; detail is on demand (Notion side peek, Linear peek, TickTick right pane) — never inflated rows.
- Priority as 3–5 levels rendered as a colour/glyph on the leading checkbox (Todoist P1–P4 flags, Linear bar icons, TickTick colours). Todoist, Linear, TickTick, Notion, Height, Asana all support **group-by priority as sections**, not just sort.
- Overdue pinned at the top of Today (Todoist collapsible Overdue + bulk Reschedule; Akiflow overdue-first; Any.do folds overdue into Today).
- Row anatomy ≈ 32–40px: checkbox · title · date chip · project/source label; everything else on hover or in the pane.
- Single-key triage everywhere: E/C complete, T/P schedule, J/K move, `!`/1–4 priority, Q/A quick-add, ⌘K command bar.
- Nobody has a "guessed vs real" date distinction — that's ours (dashed chip + ≈ prefix in v3).

Researcher's recommendation: A as default, B as a ⌘B-style toggle, both sharing the reserved sidebar.

Surfaced for the data model (ticket 03): `priority` (high/medium/low) is required for any of these and isn't in the settled model yet. Also implied: `snooze`/reschedule as a first-class action, and an "Ask Claude / Do it" hook on the suggested step.

Sources: todoist.com/help (priorities, sort-or-group, keyboard shortcuts, today view, upcoming view) · culturedcode.com/things/support (4001304, 2785159, 2803579, 1100684) · ticktick.com/about/features, help.ticktick.com (7056594711640801280, 7055780449171275776) · linear.app/docs (priority, display-options, my-issues, inbox, peek), linear.app/now/how-we-redesigned-the-linear-ui · help.superlist.com (10050, 10059, 22657), superlist.com/updates/priorities-for-tasks · notion.com/help/views-filters-and-sorts · asana.com/resources/asana-tips-my-tasks, asana.com/inside-asana/customize-my-tasks · support.microsoft.com (My Day & Suggestions; To Do shortcuts) · support.any.do (8637130, 8636803, 8610754, 8636569) · amie.so, amie.so/changelog · help.sunsama.com (workspace-navigation, keyboard-shortcuts) · product.akiflow.com/help (7262522, 6483573, 0741055, 0006630) · usemotion.com/help (task, views), usemotion.com/features/ai-task-manager.
