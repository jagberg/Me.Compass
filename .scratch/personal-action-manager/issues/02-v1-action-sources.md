Type: grilling
Status: resolved

## Question

Gmail is settled as the v1 email source. Where do meeting actions and personally-assigned actions come from in v1 — manual entry, or a specific integration (and if so, which)?

## Answer

**Meeting actions**: user's meetings run through Google Meet + Gemini's note-taker. Verified by inspecting real Drive files (via the Google Drive connector) rather than asking: each meeting produces a Google Doc titled `"<meeting> - <date/time> - Notes by Gemini"`, and every one seen has a consistent `## Next steps` section with bullets shaped `[Owner Name] Short title: description.` — e.g. `[Justin Goldberg] Contact Agencies: ...`. v1 source: search Drive for these docs, parse the Next steps section, keep bullets whose owner matches the user. No transcript parsing, no manual entry needed for this source.

**Personally-assigned actions**: user gets these three ways — verbal (no digital trace), Google Chat, and email. Email-sourced ones fold into the existing Gmail pipeline (already settled), not a separate source. Google Chat is a real v1 integration (connector already available in this environment) — same shape of problem as email: unstructured messages need an LLM pass to decide "is this assigning me an action," reusing whatever detection logic email already needs rather than inventing Chat-specific rules. Verbal has no capturable source by definition — the only path is a manual "add action" entry point in the app, which the app needs as a baseline affordance regardless of source integrations.

**v1 source list, settled**: Gmail (email + verbal-relayed-by-email), Google Drive/Gemini-notes (meetings), Google Chat (personally-assigned), manual entry (verbal fallback, baseline UI).
