# ADR 0002: AI calls shell out to the local Claude Code CLI — no Anthropic API key

- Status: accepted
- Date: 2026-09-07

## Context

The app needs AI for three things: deciding whether a raw source item (email,
meeting-notes doc, chat message) is actually actionable and extracting it,
inferring a due date/priority when a source gives none, and drafting a
suggested next step on request (Run). The user explicitly wanted this to ride
their existing Claude Code subscription rather than open a second, separate
billing relationship.

## Decision

Every AI call in this app shells out to the local `claude` CLI as a
subprocess: `claude -p --output-format json`, invoked via Node's
`child_process.execFile` (not `exec`, to avoid shell interpolation of source
content), content passed via stdin, with a hard timeout (~30s) so a hang
surfaces as a failed Run/sync rather than an indefinite spinner. No
`ANTHROPIC_API_KEY` is configured anywhere in this app.

## Alternatives considered

- Anthropic API directly (SDK + API key) — rejected: opens a second billing
  surface the user explicitly didn't want; the entire point of this decision
  was reusing the subscription that already exists.
- The CLI's `--bare` flag — rejected: `--bare` skips OAuth/keychain
  credentials and requires `ANTHROPIC_API_KEY` anyway, which defeats the
  purpose as thoroughly as calling the API directly.
- A separate "classify" call before a separate "infer" call — rejected:
  doubles subprocess calls per item for no accuracy gain anything in the spec
  or constitution asks for (see
  `specs/001-personal-action-manager/research.md`).

## Consequences

Every environment that runs this backend needs the `claude` binary present
and authenticated — a real operational constraint once this runs inside
Docker or moves off the developer's own machine, not yet fully resolved (see
research.md's "Open risk carried forward"). Anthropic's terms of service for
frequent automated subprocess calls under subscription auth, once this is
ever redistributed as a product rather than run personally, is explicitly
unchecked — flagged in
`.scratch/personal-action-manager/issues/01-claude-cli-invocation-research.md`,
not blocking v1, but a real gap a future session should close before
productizing (see ADR 0003).

This decision is also encoded as Principle II of the project constitution —
`.specify/memory/constitution.md` — so any future change here must also
amend that document, not just this ADR.
