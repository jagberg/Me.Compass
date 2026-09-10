import { setupDb, clearActions, fakeClaude } from "./helpers"; // MUST be first (sets DATA_DIR)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ActionsService } from "../src/actions/actions.service";
import { ActionsRepository } from "../src/actions/actions.repository";
import { RunResultRepository } from "../src/actions/run-result.repository";
import { CategoriesRepository } from "../src/categories/categories.repository";
import { MergeExceptionRepository } from "../src/sources/merge-exception.repository";
import { ReconcileService, Candidate } from "../src/sources/reconcile.service";

setupDb();
const repo = new ActionsRepository();
const svc = new ActionsService(
  repo,
  new RunResultRepository(),
  new CategoriesRepository(),
  new MergeExceptionRepository(),
  fakeClaude() as never,
);
const reconcile = new ReconcileService(repo, new MergeExceptionRepository(), new CategoriesRepository(), fakeClaude() as never);

beforeEach(() => clearActions());

function openAction(over: Record<string, unknown> = {}) {
  return repo.insert({
    title: "Original",
    description: "d",
    source_type: "chat",
    source_url: "https://chat.example/msg",
    due_date: null,
    due_date_inferred: false,
    priority: null,
    suggested_next_step: null,
    ...over,
  } as never);
}

// US1

test("rename sets the new title + title_pinned and persists (FR-001, FR-002, FR-004)", () => {
  const a = openAction();
  const upd = svc.update(a.id, { title: "  Renamed clearly  " });
  assert.equal(upd?.title, "Renamed clearly"); // trimmed
  assert.equal(upd?.title_pinned, true);
  const reloaded = repo.getById(a.id)!;
  assert.equal(reloaded.title, "Renamed clearly");
  assert.equal(reloaded.title_pinned, true);
});

test("a blank/whitespace title is rejected and the old title is kept (FR-003)", () => {
  const a = openAction({ title: "Keep me" });
  assert.throws(() => svc.update(a.id, { title: "   " }));
  const reloaded = repo.getById(a.id)!;
  assert.equal(reloaded.title, "Keep me");
  assert.equal(reloaded.title_pinned, false);
});

test("renaming changes no other field (FR-006)", () => {
  const a = openAction({
    title: "T",
    due_date: "2026-09-10",
    due_date_inferred: true,
    priority: "high",
    suggested_next_step: "next",
    requested_by: "Bob",
  });
  svc.update(a.id, { title: "T renamed" });
  const g = repo.getById(a.id)!;
  assert.equal(g.due_date, "2026-09-10");
  assert.equal(g.priority, "high");
  assert.equal(g.suggested_next_step, "next");
  assert.equal(g.requested_by, "Bob");
  assert.equal(g.status, "open");
  assert.equal(g.due_date_inferred, true);
});

// US2

function candidate(over: Record<string, unknown> = {}): Candidate {
  return {
    extracted: {
      title: "AI title",
      description: "d2",
      due_date: null,
      due_date_inferred: false,
      priority: null,
      suggested_next_step: null,
      requested_by: null,
      dedup_key: "do:x",
      ...over,
    },
    source_type: "chat",
    source_url: "https://chat.example/msg",
  } as Candidate;
}

test("a renamed title survives a re-sync/merge of the same identity (FR-004, FR-005)", async () => {
  const a = openAction({ title: "My words", dedup_key: "do:x" });
  svc.update(a.id, { title: "My words" }); // pins the title
  assert.equal(repo.getById(a.id)!.title_pinned, true);

  await reconcile.reconcile([candidate({ title: "Fresh AI title" })], new Set());

  const g = repo.getById(a.id)!;
  assert.equal(g.title, "My words"); // not overwritten
  assert.equal(g.title_pinned, true); // flag preserved through the merge
});

test("an unrenamed action's title is not clobbered either, but its flag stays false", async () => {
  const a = openAction({ title: "Extracted", dedup_key: "do:x" });
  assert.equal(repo.getById(a.id)!.title_pinned, false);
  await reconcile.reconcile([candidate({ title: "Newer extraction" })], new Set());
  const g = repo.getById(a.id)!;
  assert.equal(g.title_pinned, false); // never pinned by a merge
});
