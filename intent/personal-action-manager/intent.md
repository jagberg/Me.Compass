# Intent: Personal Action Manager
Author: Justin Goldberg. Status: draft.

## Problem
Not effective at managing priorities and keeping track of actions owed. These come from email that needs a reply/action, meeting action items, and things personally assigned — verbally, over chat, or sometimes by email. Nothing surfaces what's overdue, and there's no help figuring out what to actually do next.

## Proposed outcome
A personal, local tool that pulls actions together from Gmail, Google Meet/Gemini meeting notes, and Google Chat (plus manual entry for anything verbal), nudges on what's overdue, and can suggest — or trigger — the actual next step using AI via the local Claude Code CLI (rides the existing Code subscription, no separate API key). Sources stay grouped and visible; a short daily list highlights what needs doing today with a one-click "Run" per item. Structured so this action-management piece is the first of possibly several pluggable tools later, without building a generic plugin system yet.

## Affected users and systems
- Just the user — single-user, no auth for now.
- Systems touched: Gmail, Google Drive (Gemini meeting-notes docs), Google Chat, local Claude Code CLI.

## Constraints
- Runs locally in Docker; no cloud backend for v1.
- No Anthropic API key/billing — AI calls go through the local Claude Code CLI subprocess.
- Keep the core simple; don't build the plugin system until a second module actually shows up.

## Open questions
- Productization path (auth, multi-tenancy, hosting) if this ever becomes a shared product.
- Exact Gmail OAuth/connect-flow UX.
