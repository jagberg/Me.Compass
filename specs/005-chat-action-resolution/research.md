# Research: Chat action resolution detection

No `[NEEDS CLARIFICATION]` markers were left in spec.md, but several implementation-level decisions
were not yet pinned down by the spec (by design - the spec is implementation-agnostic). Each is
resolved here before design.

## 1. How is the "resolution ask" captured - a new AI call, or a snapshot?

**Decision**: Capture is a plain data copy, not a new `claude` CLI call. When a chat action is
created (or re-merged under the same `dedup_key`), `resolution_ask` is set to a snapshot of that
candidate's `extracted.description` - the fullest existing statement of what's being asked, already
produced by extraction. No additional model call is made to "write" the ask.

**Rationale**: `extracted.description` already IS a description of the ask, produced by the same
extraction call that created the action - re-deriving it via a second call would double the
per-action `claude` cost for no better result, and would violate Constitution V (Simplicity - no
speculative infrastructure for something the data already gives). FR-001 only requires the value be
"distinct from title/description" as a *stored field* (i.e. a rename of `title` must not touch it,
and it must survive independently) - a snapshot into its own column satisfies that.

**Alternatives considered**:
- A dedicated `claude` call to write a normalized "resolution ask" statement - rejected: doubles AI
  cost per created/merged chat action for a string that's materially the same information already in
  `description`.
- Reusing `title` as the judged ask - rejected: `title` is user-renameable (feature 004,
  `title_pinned`) and a rename must never change what a later delta is judged against (this is the
  exact reason the spec calls for a separate field).

## 2. When is `resolution_ask` refreshed?

**Decision**: On every merge into an existing open chat action (same `dedup_key` reappearing this
sync), `resolution_ask` is unconditionally overwritten with the new candidate's `extracted.description`.
It is never user-editable, so there is no "pin" concept (unlike `title_pinned`/`category_pinned`).

**Rationale**: Keeping it current means later judgement is always tested against the most recently
restated version of the ask, which is strictly more accurate than freezing the very first phrasing.
Since nothing else depends on this field being stable across merges (it is read only at judgement
time, immediately consumed), there's no correctness reason to preserve an older snapshot.

**Alternatives considered**: Only set once, never touched again on merge - rejected: would leave
judgement testing against a stale, possibly-superseded statement of the ask if the thread's own
extraction refines it over several syncs.

## 3. What does the judgement call return, and how are failures/ambiguous output handled?

**Decision**: `ClaudeCliService.judgeChatResolution(resolutionAsk: string, deltaText: string): Promise<"resolved" | "unsure" | "still-open">`.
The prompt asks for exactly one of the three words. Any output that isn't a clean, recognizable
match for one of them, and any thrown error/timeout from the CLI, is treated as `"still-open"` (a
no-op) - i.e. the reconcile step catches all failures from this call and defaults to no-op, never to
`"unsure"` and never to `"resolved"`.

**Rationale**: FR-010 requires a judgement failure to never change status and never fail the sync.
Collapsing "genuine still-open", "unparseable output", and "call error" into one no-op path is the
simplest rule that satisfies FR-010 without a second failure-handling branch, and it's maximally
conservative - the worst case of a mis-handled failure is "the action stays open one more sync,"
never a wrong auto-close or a wrong review-flag.

**Alternatives considered**: Treat unparseable-but-successful output as `"unsure"` - rejected: adds a
second code path for a case that's operationally identical to "the call didn't give a usable
answer," for no behavioral benefit over folding it into the no-op case.

## 4. How does the new judgement step coexist with the existing `flagStale()` mechanism?

**Decision**: `resolveChatActions()` runs first (after the create/merge loop) and returns the set of
action ids it reached a decision about (closed, flagged-as-unsure, or explicitly judged still-open).
`flagStale()` is given that set and skips any action id already in it. Actions never eligible for
resolution judgement (no `resolution_ask` - i.e. pre-feature/backfilled actions, or non-chat) still
flow through `flagStale()` exactly as today.

**Rationale**: Both mechanisms answer "is this open action's identity still active in this sync's
data?" for the same population (open actions whose source thread was read this sync but whose
`dedup_key` didn't reappear in the new candidates). Without this exclusion, a `"still-open"`
judgement (an explicit "leave it alone" decision) would immediately be overwritten by `flagStale()`
setting `stale_review = true` on the very same action in the same reconcile pass, silently
contradicting FR-005 ("still-open MUST leave status, review flag ... unchanged").

**Alternatives considered**: Delete `flagStale()`'s per-source-type distinction and let resolution
judgement fully replace it for chat - rejected: `flagStale()` remains the correct, cheaper mechanism
for actions with no captured ask (there is nothing to judge against), and FR-009 requires no change
to non-chat behavior at all; a full replacement would risk touching that path.

## 5. Where does the sync's delta text come from, keyed how?

**Decision**: `SourcesService.collect()` gains a `chatDelta: Map<string, string>` in its return value,
populated only when `type === "chat"`, mapping each raw item's `sourceUrl` (the same string already
stored as `action.source_url` - see `chat.client.ts`'s `chatDeepLink()`) to its `rawText`. This map is
threaded through `sync()` and `syncAll()` into `ReconcileService.reconcile()` as a new parameter,
defaulting to an empty map for non-chat calls.

**Rationale**: `source_url` is already the stable per-thread key used everywhere else in reconcile
(`flagStale`'s `processedConversations` Set uses the same key space) - reusing it needs no new
identity scheme. The raw item text is already fetched by the existing incremental `ChatClient.fetchSince()`
call; this only requires *keeping* a reference to it instead of discarding it after extraction, which
is exactly what FR-008 requires (never a second full-thread re-fetch).

**Alternatives considered**: A new `MessageDelta` entity/table - rejected: unnecessary persistence for
data that's only needed for the duration of one sync (Constitution V).
