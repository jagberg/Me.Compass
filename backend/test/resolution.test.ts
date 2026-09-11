import { setupDb, clearActions, fakeClaude } from "./helpers"; // MUST be first (sets DATA_DIR)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ActionsRepository } from "../src/actions/actions.repository";
import { CategoriesRepository } from "../src/categories/categories.repository";
import { MergeExceptionRepository } from "../src/sources/merge-exception.repository";
import { ReconcileService, Candidate } from "../src/sources/reconcile.service";

setupDb();
const repo = new ActionsRepository();

beforeEach(() => clearActions());

function cand(over: Record<string, unknown> = {}): Candidate {
  return {
    extracted: {
      title: "t",
      description: "d",
      due_date: null,
      due_date_inferred: false,
      priority: null,
      suggested_next_step: null,
      requested_by: null,
      dedup_key: "do:a",
      ...over,
    },
    source_type: "chat",
    source_url: "conv1",
  } as Candidate;
}

function chatAction(over: Record<string, unknown> = {}) {
  return repo.insert({
    title: "t",
    description: "d",
    source_type: "chat",
    source_url: "conv1",
    due_date: null,
    due_date_inferred: false,
    priority: null,
    suggested_next_step: null,
    dedup_key: "do:a",
    resolution_ask: "please review the doc",
    ...over,
  } as never);
}

function reconcileWith(verdict: "resolved" | "unsure" | "still-open") {
  return new ReconcileService(
    repo,
    new MergeExceptionRepository(),
    new CategoriesRepository(),
    fakeClaude({ judgeChatResolution: async () => verdict }) as never,
  );
}

// --- User Story 1: a handled chat ask closes itself ---------------------------------------------

test("US1: a delta judged resolved closes the action (status done, resolved_at set)", async () => {
  const a = chatAction();
  const reconcile = reconcileWith("resolved");
  const r = await reconcile.reconcile([], new Set(), new Map([["conv1", "done, sent it over"]]));
  const updated = repo.getById(a.id);
  assert.equal(updated?.status, "done");
  assert.ok(updated?.resolved_at);
  assert.equal(r.actions_resolved, 1);
});

test("US1: resolution is judged from delta content, regardless of who sent it (FR-006)", async () => {
  const a = chatAction();
  const reconcile = reconcileWith("resolved"); // the verdict is what the model returns for the delta's content, never gated on sender
  await reconcile.reconcile([], new Set(), new Map([["conv1", "From: Someone Else\ndone, handled it"]]));
  assert.equal(repo.getById(a.id)?.status, "done");
});

// --- User Story 2: an ambiguous delta gets flagged, not guessed ----------------------------------

test("US2: a delta judged unsure sets stale_review and leaves status open", async () => {
  const a = chatAction();
  const reconcile = reconcileWith("unsure");
  await reconcile.reconcile([], new Set(), new Map([["conv1", "maybe? not sure"]]));
  const updated = repo.getById(a.id);
  assert.equal(updated?.status, "open");
  assert.equal(updated?.stale_review, true);
});

test("US2: an action already flagged stale_review is still eligible, and a later resolved verdict closes it", async () => {
  const a = chatAction({ stale_review: true });
  const reconcile = reconcileWith("resolved");
  await reconcile.reconcile([], new Set(), new Map([["conv1", "all done now"]]));
  assert.equal(repo.getById(a.id)?.status, "done");
});

// --- User Story 3: a new/different ask does not close the original ------------------------------

test("US3: a candidate matching the existing dedup_key merges (not closed) - judgement is skipped, not just outvoted", async () => {
  const a = chatAction({ dedup_key: "do:x" });
  // A judge that would say "resolved" if it were ever called - proves resolveChatActions skipped
  // this action because its dedup_key reappeared in this sync's candidates (FR-007), rather than
  // merely happening to agree with the merge outcome.
  const reconcile = reconcileWith("resolved");
  const r = await reconcile.reconcile(
    [cand({ dedup_key: "do:x", description: "restated ask" })],
    new Set(),
    new Map([["conv1", "some unrelated new message"]]),
  );
  const updated = repo.getById(a.id);
  assert.equal(updated?.status, "open");
  assert.equal(r.actions_merged, 1);
  assert.equal(updated?.resolution_ask, "restated ask"); // refreshed via the merge path
});

test("US3: a genuinely different ask on the same thread creates a new action and leaves the original untouched", async () => {
  const a = chatAction({ dedup_key: "do:a" });
  // Judge returns still-open for the untouched original - the delta is about a different task, not
  // a resolution of A's ask.
  const reconcile = reconcileWith("still-open");
  const r = await reconcile.reconcile(
    [cand({ dedup_key: "do:b", title: "A different task" })],
    new Set(),
    new Map([["conv1", "a brand new unrelated ask"]]),
  );
  assert.equal(r.actions_created, 1);
  const original = repo.getById(a.id);
  assert.equal(original?.status, "open");
  assert.equal(original?.stale_review, false);
});

// --- Polish: cross-cutting invariants ------------------------------------------------------------

test("still-open verdict is a no-op: status, stale_review, and resolution_ask all unchanged (FR-005)", async () => {
  const a = chatAction();
  const reconcile = reconcileWith("still-open");
  await reconcile.reconcile([], new Set(), new Map([["conv1", "unrelated chatter"]]));
  const updated = repo.getById(a.id);
  assert.equal(updated?.status, "open");
  assert.equal(updated?.stale_review, false);
  assert.equal(updated?.resolution_ask, "please review the doc");
});

test("a thrown judgement error is a no-op and does not fail the sync (FR-010)", async () => {
  const a = chatAction();
  const reconcile = new ReconcileService(
    repo,
    new MergeExceptionRepository(),
    new CategoriesRepository(),
    fakeClaude({
      judgeChatResolution: async () => {
        throw new Error("claude CLI exploded");
      },
    }) as never,
  );
  const r = await reconcile.reconcile([], new Set(), new Map([["conv1", "some delta"]]));
  const updated = repo.getById(a.id);
  assert.equal(updated?.status, "open");
  assert.equal(updated?.stale_review, false);
  assert.equal(r.actions_resolved, 0); // did not throw out of reconcile()
});

test("an email-sourced action is unaffected - flagStale behavior is unchanged (FR-009)", async () => {
  const a = repo.insert({
    title: "owed",
    description: "d",
    source_type: "email",
    source_url: "mail1",
    due_date: null,
    due_date_inferred: false,
    priority: null,
    suggested_next_step: null,
    dedup_key: "do:e",
  } as never);
  const reconcile = reconcileWith("resolved"); // would close it if (incorrectly) considered eligible
  // mail1 read this sync, but no candidate carries do:e -> the pre-existing stale-flag path fires,
  // exactly as it did before this feature (reconcile.test.ts's equivalent case).
  await reconcile.reconcile([], new Set(["mail1"]));
  const updated = repo.getById(a.id);
  assert.equal(updated?.status, "open");
  assert.equal(updated?.stale_review, true);
});

test("ClaudeCliService.judgeChatResolution falls back to still-open on unparseable output", async () => {
  const { ClaudeCliService } = require("../src/claude/claude-cli.service");
  const svc = new ClaudeCliService();
  (svc as unknown as { run: () => Promise<string> }).run = async () => "banana, who knows";
  const verdict = await svc.judgeChatResolution("some ask", "some delta");
  assert.equal(verdict, "still-open");
});
