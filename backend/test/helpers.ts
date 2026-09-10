// IMPORTANT: import this module FIRST in every test file (before any ../src import), so DATA_DIR
// is set before src/db/connection.ts computes its DB path. The backend is commonjs, so import order
// equals require order and this runs first.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Priority } from "../src/types";

if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "mecompass-test-"));
}

/** Runs migrations against the temp DB and returns the connection. Call once per test file. */
export function setupDb() {
  const { runMigrations } = require("../src/db/migrate");
  runMigrations();
  const { getDb } = require("../src/db/connection");
  return getDb();
}

/** Wipes action + merge_exception rows between tests (leaves seeded categories in place). */
export function clearActions() {
  const { getDb } = require("../src/db/connection");
  const db = getDb();
  db.exec("DELETE FROM action; DELETE FROM merge_exception;");
}

/** A stub ClaudeCliService: no subprocess. Override any method via `over`. */
export function fakeClaude(over: Record<string, unknown> = {}) {
  return {
    inferDueDateAndPriority: async () => ({ due_date: "2026-09-20", priority: "medium" as Priority }),
    classifyCategory: async () => null,
    areSameTask: async () => false,
    deriveIdentity: async (title: string) => ({ dedup_key: `do:${title.toLowerCase()}`, requested_by: null }),
    extractActions: async () => [],
    run: async () => "",
    ...over,
  };
}
