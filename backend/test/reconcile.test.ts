import { setupDb, clearActions, fakeClaude } from "./helpers"; // MUST be first (sets DATA_DIR)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ActionsRepository } from "../src/actions/actions.repository";
import { CategoriesRepository } from "../src/categories/categories.repository";
import { MergeExceptionRepository } from "../src/sources/merge-exception.repository";
import { ReconcileService, Candidate } from "../src/sources/reconcile.service";

setupDb();
const repo = new ActionsRepository();
const reconcile = new ReconcileService(repo, new MergeExceptionRepository(), new CategoriesRepository(), fakeClaude() as never);

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

test("candidates sharing a non-null dedup_key collapse to one action", async () => {
  const r = await reconcile.reconcile([cand({ title: "Pay run" }), cand({ title: "approve payroll" })], new Set());
  assert.equal(r.actions_created, 1);
  assert.equal(repo.listByStatus("open").length, 1);
});

test("null dedup_key candidates stay distinct", async () => {
  const r = await reconcile.reconcile([cand({ dedup_key: null }), cand({ dedup_key: null })], new Set());
  assert.equal(r.actions_created, 2);
  assert.equal(repo.listByStatus("open").length, 2);
});

test("the survivor records a content snapshot of each absorbed candidate", async () => {
  await reconcile.reconcile([cand({ title: "Primary" }), cand({ title: "Absorbed" })], new Set());
  const survivor = repo.listByStatus("open")[0];
  assert.equal(survivor.merged_from?.length, 1);
  assert.equal(survivor.merged_from?.[0].title, "Absorbed");
});

test("a resolved identity with no open survivor is suppressed, not recreated", async () => {
  repo.insert({
    title: "already done",
    description: "d",
    source_type: "chat",
    source_url: "conv1",
    due_date: null,
    due_date_inferred: false,
    priority: null,
    suggested_next_step: null,
    status: "dismissed",
    dedup_key: "do:z",
  } as never);
  const r = await reconcile.reconcile([cand({ dedup_key: "do:z" })], new Set());
  assert.equal(r.actions_suppressed, 1);
  assert.equal(r.actions_created, 0);
  assert.equal(repo.listByStatus("open").length, 0);
});

test("stale flagging fires only for a fully-read conversation", async () => {
  const a = repo.insert({
    title: "owed",
    description: "d",
    source_type: "chat",
    source_url: "conv1",
    due_date: null,
    due_date_inferred: false,
    priority: null,
    suggested_next_step: null,
    dedup_key: "do:s",
  } as never);
  // conv1 read this sync, but no candidate carries do:s -> flag stale
  await reconcile.reconcile([], new Set(["conv1"]));
  assert.equal(repo.getById(a.id)?.stale_review, true);
});

test("stale flagging does NOT fire when the conversation was not read", async () => {
  const a = repo.insert({
    title: "owed",
    description: "d",
    source_type: "chat",
    source_url: "conv9",
    due_date: null,
    due_date_inferred: false,
    priority: null,
    suggested_next_step: null,
    dedup_key: "do:s",
  } as never);
  await reconcile.reconcile([], new Set()); // nothing read
  assert.equal(repo.getById(a.id)?.stale_review, false);
});
