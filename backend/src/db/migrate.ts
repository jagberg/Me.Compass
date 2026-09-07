import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./connection";

export function runMigrations(): void {
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const db = getDb();
  for (const file of files) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
}
