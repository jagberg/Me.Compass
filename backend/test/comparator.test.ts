import { setupDb, clearActions, fakeClaude } from "./helpers"; // MUST be first (sets DATA_DIR)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ActionsService } from "../src/actions/actions.service";
import { ActionsRepository } from "../src/actions/actions.repository";
import { RunResultRepository } from "../src/actions/run-result.repository";
import { CategoriesRepository } from "../src/categories/categories.repository";
import { MergeExceptionRepository } from "../src/sources/merge-exception.repository";
import { localTodayIso } from "../src/util/date";

setupDb();
const repo = new ActionsRepository();
const cats = new CategoriesRepository();
const svc = new ActionsService(repo, new RunResultRepository(), cats, new MergeExceptionRepository(), fakeClaude() as never);

const iso = (deltaDays: number) => {
  const d = new Date(localTodayIso() + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};
const [c1, c2] = cats.list().map((c) => c.id);

function ins(over: Record<string, unknown>) {
  return repo.insert({
    title: "t",
    description: "d",
    source_type: "manual",
    source_url: null,
    due_date: null,
    due_date_inferred: false,
    priority: null,
    suggested_next_step: null,
    ...over,
  } as never);
}

beforeEach(() => clearActions());

test("within a category: overdue -> due-today -> future -> undated", () => {
  ins({ title: "undated", category_id: c1 });
  ins({ title: "future", category_id: c1, due_date: iso(3) });
  ins({ title: "today", category_id: c1, due_date: iso(0) });
  ins({ title: "overdue", category_id: c1, due_date: iso(-2) });
  const group = svc.listGroupedByCategory("open").find((g) => g.category?.id === c1)!;
  assert.deepEqual(group.actions.map((a) => a.title), ["overdue", "today", "future", "undated"]);
});

test("categories rank by their most-urgent action", () => {
  ins({ title: "c2-overdue", category_id: c2, due_date: iso(-1) });
  ins({ title: "c1-future", category_id: c1, due_date: iso(5) });
  const groups = svc.listGroupedByCategory("open").filter((g) => g.category);
  assert.equal(groups[0].category?.id, c2); // overdue category first
});

test("Uncategorised is always last, even holding the most-urgent item", () => {
  ins({ title: "uncat-overdue", category_id: null, due_date: iso(-5) });
  ins({ title: "cat-future", category_id: c1, due_date: iso(5) });
  const groups = svc.listGroupedByCategory("open");
  assert.equal(groups[groups.length - 1].category, null);
});
