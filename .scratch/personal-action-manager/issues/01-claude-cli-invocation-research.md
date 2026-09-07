Type: research
Status: resolved

## Question

How can the Claude Code CLI be invoked headlessly/programmatically — flags, auth (riding the existing Code subscription, no API key), input/context injection, and output parsing — so the app's detached "what's next" component can shell out to it as a subprocess and get a usable answer back?

## Answer

Source: [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) (code.claude.com, official Claude Code docs).

**Invocation**: `claude -p "<prompt>"` runs non-interactively; exits 0 on success, non-zero on failure, so the parent process can branch on exit status.

**Auth — confirms the no-API-key path**: plain `-p` (without `--bare`) uses the same OAuth/subscription login as an interactive session — nothing to configure. `--bare` is the *opposite* choice: it skips reading OAuth/keychain credentials entirely and requires `ANTHROPIC_API_KEY` instead. So: don't pass `--bare`, and the subprocess rides the existing Code subscription exactly as wanted. Trade-off: without `--bare`, the call also loads the full project context (CLAUDE.md, hooks, MCP servers, skills, plugins) from the working directory, which is likely desirable here (personal context) but means the app's working directory for this call matters.

**Context injection**: pipe data via stdin (`cat context.txt | claude -p '...'`, capped at 10MB — write to a file and reference the path for anything bigger), or `--append-system-prompt`/`--append-system-prompt-file` for standing instructions, or just interpolate into the prompt string. `--add-dir` loads extra directories' skills.

**Output parsing**: `--output-format json` returns `{result, session_id, total_cost_usd, ...}` — pipe to `jq -r '.result'`. `--output-format json --json-schema '<schema>'` forces the answer into a `structured_output` field matching a JSON Schema — the clean way to get a machine-parseable "next action" object (e.g. `{action, source, due, confidence}`) instead of parsing prose. `stream-json` exists for token-level streaming if needed later.

**Multi-turn**: `--continue` / `--resume <session_id>` (from the JSON output) lets a later call continue the same reasoning session — useful if "figure out the next action" benefits from prior turns' context.

**Constraints worth noting for repeated/programmatic use**: piped stdin capped at 10MB; background Bash tasks the CLI itself starts are killed ~5s after the result unless they're subagents/workflows (capped wait 10 min); permission prompts default to blocking unless `--permission-mode` / `--permission-prompts none` is set — for a fully unattended subprocess, pass `--permission-mode auto --permission-prompts none` (or `--allowedTools` for a narrow allowlist) so it never hangs waiting for a human.

Not checked: whether Anthropic's terms treat frequent automated subprocess calls against subscription auth differently once this app is redistributed as a product (vs. personal local use) — worth a quick pass before productizing, not before v1.
