# Internal Contract: Chat action resolution detection

No HTTP endpoint is added or changed by this feature - `GET /api/actions...` responses gain one
extra field (`resolution_ask`, informational, same treatment as `title_pinned` in feature 004's
contract). Everything below is an internal method contract between existing backend services.

## `GET /api/actions?...` (no request change)

Each returned chat action now includes `resolution_ask: string | null`. Clients do not need to read
or send it - it exists purely so the reconcile pass has something to judge deltas against.

## `ClaudeCliService.judgeChatResolution(resolutionAsk: string, deltaText: string): Promise<"resolved" | "unsure" | "still-open">`

New method, same shape/conventions as the existing `areSameTask()` (single-word-style answer,
parsed defensively).

- **Input**: `resolutionAsk` - the action's captured ask. `deltaText` - the new chat messages for
  that thread from this sync only (never the full thread history).
- **Output contract**: exactly one of the three literal strings above.
- **Failure handling is the CALLER's responsibility, not this method's**: this method may throw (CLI
  error, timeout, unparseable JSON/text). It does not itself catch and downgrade to `"still-open"` -
  `ReconcileService.resolveChatActions()` is the one place that catches and treats any thrown error,
  or any output that fails to cleanly parse as one of the three literals, as `"still-open"` (a no-op).
  This keeps the method's contract simple (it succeeds with a real verdict, or it throws) and keeps
  the "never wrongly change state on failure" policy (FR-010) in exactly one place.

## `SourcesService.collect(type)` - return shape change

Adds one field to the existing return object:

```ts
{
  candidates: Candidate[];
  ok: boolean;
  fullyRead: string[];
  syncedAt: string;
  chatDelta: Map<string, string>; // NEW - populated only when type === "chat"; empty Map otherwise
}
```

`chatDelta` keys are `source_url` strings (the same stable per-thread key `chat.client.ts` already
produces via `chatDeepLink()`), values are that item's raw delta text as fetched this sync (never a
full-thread re-fetch - this is literally the text `ChatClient.fetchSince()` already returned).

## `ReconcileService.reconcile(candidates, processedConversations, chatDelta?)` - new optional parameter

```ts
reconcile(
  candidates: Candidate[],
  processedConversations: Set<string>,
  chatDelta: Map<string, string> = new Map(),
): Promise<ReconcileResult>
```

`ReconcileResult` gains one field: `actions_resolved: number` (count of chat actions auto-closed by
this sync's judgement pass - purely observational, same spirit as the existing `stale_flagged` count).

### Behavior added inside `reconcile()`

1. The existing create/merge loop runs unchanged, except: when creating or merging a chat-sourced
   candidate, `resolution_ask` is set/refreshed from `primary.extracted.description` (research.md #1, #2).
2. A new step, `resolveChatActions(candidates, chatDelta)`, runs after the create/merge loop and
   before `flagStale()`. For every action where `status === "open"`, `source_type === "chat"`,
   `resolution_ask` is non-null, and `chatDelta.has(action.source_url)`:
   - Skip if the action's `dedup_key` is already present among this sync's candidates (FR-007 - the
     existing merge logic already handled it).
   - Otherwise call `judgeChatResolution(action.resolution_ask, chatDelta.get(action.source_url))`.
     - `"resolved"` -> `setDigestFields(id, { status: "done", resolved_at: <now ISO> })`.
     - `"unsure"` -> `setDigestFields(id, { stale_review: true })`.
     - `"still-open"`, or the call throws / returns unparseable output -> no write.
   - The action's id is added to a `handledIds: Set<string>` regardless of verdict (including the
     no-op case - it was still considered this sync).
3. `flagStale(candidates, processedConversations, handledIds)` - unchanged logic, plus one new guard:
   skip any action whose id is in `handledIds`.

### Non-chat / no-resolution_ask behavior (must be unchanged - FR-009)

Any action with `source_type !== "chat"`, or a chat action with `resolution_ask === null` (created
before this feature), is never selected by `resolveChatActions()`, so `handledIds` never contains its
id, so `flagStale()` runs for it exactly as before this feature existed.

## `ActionsRepository.setDigestFields()` - widened field list

```ts
setDigestFields(
  id: string,
  fields: Partial<
    Pick<Action,
      "requested_by" | "category_id" | "category_pinned" | "dedup_key" | "merged_from" |
      "conflict" | "stale_review" | "title_pinned" |
      "resolution_ask" | "status" | "resolved_at" // NEW
    >
  >,
): void
```

Same pattern as the `title_pinned` addition in feature 004: read the existing row, merge in the
provided fields, write the full widened column list back. `title` is still never written by this
method (unchanged guarantee from feature 004's contract).
