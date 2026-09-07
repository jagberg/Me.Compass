import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DATA_DIR ? `${process.env.DATA_DIR}/action-manager.db` : "./data/action-manager.db";

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
  }
  return db;
}
