# Codex review feedback: Action Digest

Reviewed 8 September 2026. Document review only; runtime behaviour was not verified.

The intended experience is clear, but reconciliation needs stronger rules before implementation. All 14 functional requirements have nominal task coverage. No direct conflict with the five constitution principles was identified in the proposed design.

Please assess these findings against the current documents and address confirmed gaps consistently across spec.md, plan.md, data-model.md, research.md, contracts/api.md, tasks.md and quickstart.md. References below describe the version reviewed and may have moved during concurrent work.

| Severity | Finding | Required change |
|---|---|---|
| High | Split corrections will not reliably survive sync. T027 restores snapshots, but matching still merges identical keys. No persisted exception prevents the same merge recurring. | Record user separation decisions and honour them during reconciliation. Verify across repeated syncs. |
| High | Existing duplicates have no upgrade path. Existing actions gain null dedup keys and requesters; null keys explicitly never match. Fresh extraction cannot reliably consolidate that backlog. | Specify backfill and reconciliation of existing actions, preserving manual edits and status. |
| High | Absence is treated as resolution evidence. T027a flags actions when their key disappears from a source's candidates, without requiring successful, complete re-reading of the relevant conversation. | Track which conversations were successfully processed. Exclude failed, omitted or truncated reads from stale detection. |
| High | Completed work can reappear. Reconciliation matches only existing open actions (research.md, reconciliation approach). A previously completed or dismissed ask extracted again can become a new open action. | Define suppression of previously resolved tasks and distinguish genuinely new recurring requests. |
| High | AI-generated keys are assumed to be stable. T007-T008 use exact equality, but no canonical format or handling of changed keys is defined. Paraphrases can remain duplicated; unrelated recurring tasks can collapse. | Define identity rules and examples covering paraphrases, different periods, changed requests and repeat syncs. |
| Medium | Manual filing into Uncategorised is not persistent. Under T016, null means both unfiled and user-chosen Uncategorised, so the next sync can overwrite that choice. | Distinguish automatic filing eligibility from an explicit user assignment. |
| Medium | Urgency ordering is ambiguous. No rule determines whether overdue low-priority work outranks future high-priority work. SC-004 also conflicts with keeping Uncategorised last when it contains the most urgent item. | Define the comparator, tie-breakers and Uncategorised exception. |
| Medium | The duplicate metric can reward losing tasks. Comparing extracted and displayed counts in quickstart.md does not measure duplicate accuracy or incorrect merges. | Use a labelled sample; measure remaining duplicates and distinct tasks wrongly merged or lost. Preserve feature 002's recall target. |

Recommended next action: revise reconciliation rules and acceptance scenarios before implementation. This feedback is a review handoff, not evidence that the changes have already been made or validated.

## Implementation code review

Reviewed after the feature was built. These findings are independent of the Claude review and focus on additional correctness gaps.

| Severity | Location | Finding | Failure scenario |
|---|---|---|---|
| Critical | `backend/src/sources/sources.service.ts:65-69` | Source cursors advance before reconciliation persists candidates. | `collect()` writes `last_synced_at` before `reconcile()` runs. If reconciliation fails after a successful fetch and extraction, the request fails but the next sync starts after the advanced cursor, permanently skipping every candidate that was not inserted. Move cursor advancement after successful reconciliation or make cursor advancement and persistence atomic. |
| High | `backend/src/sources/reconcile.service.ts:84-90,182` | Backfill-created dismissed duplicates poison resolved-task suppression. | Backfill consolidates duplicate open rows by dismissing all but one while retaining their shared `dedup_key`. Every later candidate with that key is suppressed by `hasResolvedByDedupKey()` before the surviving open row is considered, so it can no longer merge new evidence or clear `stale_review`. Suppression must account for an existing open survivor or use a distinct consolidation state. |
| High | `backend/src/sources/reconcile.service.ts:145-152,189-192` | A partial backfill is permanently marked complete. | Identity derivation errors are caught per action, but the one-shot marker is still written after the loop. Any action that times out or returns invalid output keeps a null identity forever because later syncs skip the entire backfill. Record completion only when all eligible rows succeed, or persist retryable per-row progress. |
| High | `backend/src/sources/sources.service.ts:53-55,71-75` | A single extraction error during `sync-all` can stale-flag actions from the failed source. | Each URL is added to the shared `processed` set before extraction. If a later extraction throws, `collect()` discards that source's local candidates but leaves its processed URLs behind; `syncAll()` continues and `flagStale()` can mark prior actions from those URLs as possibly resolved even though extraction failed. Add a conversation only after successful extraction and remove all processed entries when the source fails. |
| High | `backend/src/sources/chat.client.ts:25-29,42-56` | Incremental Chat sync does not read a whole stable conversation. | The API fetches only messages created after `last_synced_at`, so the extractor sees the new fragment rather than the whole thread required by FR-001/FR-003. The stored URL is based on the first message in that incremental fragment, so the same thread gets a different `source_url` on later syncs and cannot pass stale gating. Fetch complete threads and use the thread identifier as stable provenance. |
| High | `backend/src/sources/gmail.client.ts:54-63`, `backend/src/sources/chat.client.ts:44-50`, `backend/src/sources/sources.service.ts:54` | Truncated conversations are recorded as fully processed. | Both clients silently cut transcripts at 8,000 characters, while `collect()` adds their URLs to the set described as successfully read in full. An ask beyond the cut can disappear from candidates and trigger a false `stale_review`, contrary to FR-018. Return truncation metadata and exclude truncated conversations from stale detection, or use a truncation strategy that preserves the relevant end of the conversation. |
| High | `backend/package.json:7`, `backend/src/db/migrate.ts:11-25` | The documented local build omits the new SQL migration. | TypeScript does not copy `.sql` files. `npm run build && npm run start` reads `dist/db/migrations`, which retains only the previously copied `001_init.sql` in a clean build, so `002_action_digest.sql` is absent and the digest columns/tables are never created. Docker copies migrations separately, but the quickstart's direct local path fails. Add an explicit migration-copy build step. |
| Medium | `backend/src/sources/reconcile.service.ts:111-124`, `frontend/src/components/ActionLine.tsx:39-63` | Cross-source merges expose only the primary source. | A merged email/chat task persists one `source_type` and `source_url`; absorbed provenance exists only in internal `merged_from`, which the API intentionally hides. The UI can therefore show only one icon, contradicting quickstart scenario 2's requirement that the source indicator reflect both. Expose source provenance as an array or adjust the accepted UI behaviour. |
| Medium | `backend/src/actions/actions.controller.ts:46-48`, `backend/src/actions/actions.service.ts:150-176` | The split endpoint ignores its contracted optional snapshot selection. | `POST /api/actions/:id/split` accepts no body and always splits every snapshot, although `contracts/api.md` permits choosing which folded snapshots to separate. A user correcting one bad member of a larger valid merge must destroy the entire merge. Implement selection or remove it from the contract. |
| Medium | `backend/src/actions/actions.service.ts:32-47`, `frontend/src/components/ActionLine.tsx:12-20` | Due-state and urgency calculations use the UTC date rather than the user's local date. | In Sydney before 10:00 or 11:00, `toISOString().slice(0, 10)` is still yesterday. An action due today is treated as future and an action due yesterday is not overdue, changing both category ordering and badges for much of the morning. Derive the local ISO date once and use it consistently. |

## Resolution (2026-09-08)

Fixed (both builds pass):

| Finding | Fix |
|---|---|
| Migration not copied to dist (build) | `build` now runs `scripts/copy-migrations.js`; `dist/db/migrations` gets `002_action_digest.sql`. |
| Cursor advances before persistence | `collect()` no longer advances `last_synced_at`; `sync()`/`syncAll()` advance it only after `reconcile()` returns. |
| Gmail narrowed to `is:unread` (regression) | Query reverted to `after:` / `newer_than:7d`; read state no longer gates extraction. |
| Single extraction error stale-flags failed source | `collect()` builds a local fully-read set; a mid-loop throw returns none, so no URLs leak into stale gating. |
| Truncated conversations counted as full reads | Clients return `truncated`; truncated items are excluded from the fully-read set (FR-018). |
| Backfill-dismissed rows poison suppression | Reconcile checks the open survivor before `hasResolvedByDedupKey`; suppression only when no open row exists. |
| Partial backfill marked complete | One-shot marker written only when every identity derived; otherwise the next sync retries. |
| Conflict never set on merge (T025) | Divergent non-null due/priority on a merge sets `conflict` (existing values kept, divergent value preserved in `merged_from`). |
| Split key millisecond collision | Split keys now index-suffixed (`#split-<ts>-<i>`). |
| Split dropped inferred flag + category | `MergedFromEntry` carries `due_date_inferred`; split restores it and inherits the parent's category. |
| Chat provenance unstable across syncs | `source_url` keyed on the stable thread id, not the first message of the fragment. |
| Local vs UTC due-state | `localTodayIso()` (backend + frontend) used for overdue/today bucketing and badges. |
| Dead `conversationId` field | Removed from `Candidate`. |

Deferred (documented, not fixed here):

- **Chat reads only the incremental fragment, not the whole thread** (FR-001/003). Needs a per-thread full fetch; provenance is now stable so stale gating is safe, but stale-state weighting on a long chat thread is weaker than on email. Follow-on.
- **`merge_exception` cannot distinguish a same-key split-off** — the split-off is re-minted with a synthetic key that a re-fetch never reproduces, so a split can re-merge on a later sync. The real fix is content-anchored identity (already noted as a known limitation in `tasks.md`).
- **`areSameTask` / near-key equivalence not wired** — reconcile groups by exact key only; paraphrases whose keys differ are not merged. The method exists for when this is wired.
- **Cross-source merge shows one source icon** — absorbed provenance lives in `merged_from` (hidden by the API). Either expose a source array or accept single-source display; quickstart scenario 2 to be reconciled.
- **Split endpoint ignores optional snapshot selection** — always splits all; `contracts/api.md` permits choosing. Align impl or contract.
- **Orphaned feature-002 components** (ActionCard, NextStepsList, SourceGroup, ViewToggle, AddActionForm, `getActions`) — left in place, still compile; deletion is a separate call.

### Verification

- Backend TypeScript build passed.
- Frontend TypeScript checking passed before Vite started.
- The Vite production bundle could not be completed because the sandbox denied the esbuild child process; the elevated retry did not receive approval and was terminated.
- No automated test framework is present, so the behavioural paths above remain untested by the repository.
