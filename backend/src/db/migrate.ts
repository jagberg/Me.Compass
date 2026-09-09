import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./connection";

/**
 * Runs each migrations/*.sql exactly once, tracked in a schema_migrations ledger.
 * The ledger is required because SQLite `ALTER TABLE ADD COLUMN` is not idempotent, so
 * re-running a migration on every boot (the old behaviour) would throw "duplicate column".
 */
export function runMigrations(): void {
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const db = getDb();

  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const isApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const record = db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");

  for (const file of files) {
    if (isApplied.get(file)) continue;
    db.exec(readFileSync(join(dir, file), "utf8"));
    record.run(file, new Date().toISOString());
  }
}
