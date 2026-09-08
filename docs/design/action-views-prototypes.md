# Action views — prototype exploration and decisions

A record of the UI exploration for how extracted actions are grouped, merged, and
displayed. Each round was published as a standalone HTML artifact built against **real
extracted data** (not lorem), and Justin's feedback on each drove the next round. The
chosen design is at the bottom.

This is design history, not a spec. The implementation intent (chat thread-awareness,
cross-source merge, requester + category extraction, this board UI) still needs an
`ignite:intent` / brief before it is built.

## Context

These prototypes were built after two extraction improvements landed:
- **Thread-aware email extraction** — email now reads a whole Gmail thread and collapses it
  to the action(s) still owed, instead of one action per message (see
  `specs/002-action-extraction-criteria/` and the CHANGELOG).
- **Chat sync** — Google Chat was connected (needed the `chat.spaces.readonly` scope added
  and the Chat API enabled). Chat extraction is still **message-level**, not space/thread
  aware, so it duplicates heavily — the single biggest driver of the "merge" theme below.

Data at the time: **62 raw extracted actions** across Gmail (5), Google Chat (41), and Drive
meeting notes (16). Meeting actions come from Gemini "Notes by Gemini" docs — the *Next
steps* section — not raw transcripts.

## Rounds

### Round 1 — Grouping related actions
Five ways to cluster related actions across sources.

| Option | Idea |
|---|---|
| 01 Topic threads | Collapsible subject clusters crossing sources |
| 02 Smart merge | Clusters with near-duplicates struck through → fewer real actions |
| 03 People & entities | Group by who/what each action concerns |
| 04 Project lanes | 2×2 board by project |
| 05 Urgency-first clusters | Clusters reordered so the most urgent floats up |

**Feedback:** Liked **05 urgency clustering**; liked **04 but only the two columns**; loved
the **03 left-side grouping** ("we can work on a better grouping"); **02 smart merge is
critical**. Merging needed to be stronger — payroll had 2 items but should be 1, All Hands
should be one action with only what is required of Justin. Line items should show **who is
requesting** the action.

### Round 2 — Merged views with a requester
Five views on the merged set (62 → 24), each line carrying a requester.

| Option | Idea |
|---|---|
| 01 Urgency clusters + requester | Round-1's 05, merged + requester per line |
| 02 Two-column clusters | Merged clusters in two columns |
| 03 By requester | Grouped by who is asking (left-rail label + rows) |
| 04 Merge receipt | N raw → 1, showing what folded in; surfaces conflicts |
| 05 Priority inbox | Flat urgency-ranked list |

**Feedback:** Use the **04 merge-receipt** treatment for the others. Liked the **03 grouping
UX**. Liked the **02 two columns**. Change the "Run" button to a **circular play button**.
Add a **source icon** (chat / email / meeting) per line. Asked whether meeting actions come
from Gemini transcripts (answer: from the *Next steps* section of Gemini notes docs, not
transcripts).

### Round 3 — Digest views
Five digest layouts with inline merge receipts, requester grouping, source icons, and the
circular play button.

| Option | Idea |
|---|---|
| 01 Requester digest | Grouped by requester, receipt on tap |
| 02 Two-column topics | Merged clusters in two columns |
| 03 Two-column requesters | Requester grouping across two columns |
| 04 External vs self lanes | "Others waiting on you" vs "you set yourself" |
| 05 Inbox + receipt detail | List left, full merge receipt right |

**Feedback:** Liked the requester-card grouping style (avatar + name + role + "N asks"). Drop
the "merged N" chips. Each line item should show **the title of the work** and, as a separate
part, **the next step**.

### Round 4 — Requester cards, title + next step
Five layouts on the requester cards, no merge chips, each line split into work title and next
step.

| Option | Idea |
|---|---|
| 01 Stacked | Title over next step, one column |
| 02 Two columns | Same, two columns |
| 03 Split columns | Work left, next step right of a divider |
| 04 Run preview | Next step framed as "Run will: …" tied to the play button |
| 05 Accordion | Requester headers collapse; expand to see asks |

**Feedback:** Referencing Round-2 option 03 (grouping in its own column) — liked that style,
but group by **category, not person** (e.g. "Sheer · GitHub" → **Software Renewals**, "People
& Culture" → **Timesheets**). The category list should be a **curated taxonomy Justin
maintains over time**. Use the **full width** of the page.

### Round 5 — Curated category taxonomy
Five full-width views grouping by a curated, editable category taxonomy.

| Option | Idea |
|---|---|
| 01 Category rail | Curated category label left, actions right (full width) |
| 02 Two rails wide | Category rails across two columns |
| 03 Category board | Four category columns across the page |
| 04 Priority within category | Categories ordered by their most-urgent item |
| 05 Manage taxonomy | Editable categories, filing rules, Uncategorised bucket |

**Feedback:** Options 01 and 02 should be a **flip of a switch** to change the view; include
**05 Manage taxonomy** in that switch too. Make **02 (two columns) the default**. **Condense**
the layout — smaller headings, smaller text. Give five prototypes for the default option only.
The **category cards should be prioritised**.

### Round 6 — Condensed two-column default, five style takes
One board (switch: two-column default / single rail / manage), five style variations of the
condensed, priority-ordered two-column view.

| Option | Style |
|---|---|
| 01 Clean | Condensed baseline |
| 02 Accent stripe | Coloured spine per card |
| 03 Tag header | Category as an uppercase label, lightest chrome |
| 04 Priority-first | Due date leads each line; header flags "N overdue" |
| 05 Ultra-compact | Title + next step on one line |

**Feedback:** Go with **04 Priority-first**, with one change: **no gaps between groups** (each
column reads as one continuous run). → chosen design.

## Chosen design

**Priority-first category board.**
- Actions filed into a **curated, editable category taxonomy** (Software Renewals, Timesheets,
  Change Requests, Recruitment, Company Events, Showcase & Demos, Health Product, Security &
  Compliance, Migrations, Team Management, Content & Brand, + an Uncategorised bucket).
- Categories **ordered by urgency** (most-urgent item first); Uncategorised last.
- Each column is a **single continuous run — no gaps between groups**, category headers act as
  dividers.
- Each line: **due date leads**, priority dot, **source icon** (✉ email / 💬 chat / ▤ meeting
  notes), the **work title**, the **next step**, and a **circular play button** that drafts the
  next step.
- Cross-source **merge** happens under the hood (62 → 24) but is not shown as a chip.
- A **switch** flips between two columns (default), a single rail, and a **manage-taxonomy**
  screen where category filing rules are edited and Uncategorised items are filed.
- Layout is **condensed** (13px base, ~0.82rem headings).

### Open questions / follow-on work surfaced during prototyping
- **Chat thread/space-aware extraction** — chat is still message-level and duplicates hard
  (one Okta change request became 5 actions). Needs the same fix email got.
- **Cross-action de-duplication** — even one thread can emit near-duplicate actions (payroll
  produced two from one thread). Needs a merge pass.
- **`requested_by` extraction** — a new field for who is asking; real where the source names
  them (People & Culture, Anthony Nguyen, Bryan McMahon), role-only for chat.
- **Category taxonomy** — a user-maintained list with filing rules; new/unknown actions land
  in Uncategorised for manual filing.
- **Stale-state weighting** — on long threads, favour the current open item over an early ask
  (the GitHub renewal thread produced a stale "confirm renewal" action when the live item was
  reducing 12 Advanced Security seats).
- **Content conflict detection** — two chat messages asked for opposite content swaps
  (ecom→academy vs academy→ecom); a real conflict to surface, not silently merge.

### Artifacts (design-time, not part of the build)
- Round 1 — Grouping: https://claude.ai/code/artifact/158b1f3a-63cf-45c8-bc21-0875afd4a00a
- Round 2 — Merged + requester: https://claude.ai/code/artifact/601c2a40-1f54-4e4f-ae9a-0971134bd66b
- Round 3 — Digest: https://claude.ai/code/artifact/28735571-a1f0-42f8-aab8-dcf2bd380603
- Round 4 — Requester cards: https://claude.ai/code/artifact/6ab60afd-28eb-4156-b27e-6fabf2f69525
- Round 5 — Category taxonomy: https://claude.ai/code/artifact/cffc15af-733d-420a-af5c-a06cf852ab22
- Round 6 — Condensed default styles: https://claude.ai/code/artifact/40d5feac-43d4-412e-95e3-cee0b0434605
- **Chosen — Action board:** https://claude.ai/code/artifact/a759e266-7935-44bc-93a7-70b6e938b81f
- Thread-derived action views (real thread data): https://claude.ai/code/artifact/9cdb376c-25c0-4f52-9822-f4a426f65556
