import { Injectable } from "@nestjs/common";
import { getDb } from "../db/connection";

/** Remembers user separation decisions (FR-017) so a split pair is never re-merged. */
@Injectable()
export class MergeExceptionRepository {
  private pair(a: string, b: string): [string, string] {
    return a <= b ? [a, b] : [b, a];
  }

  add(a: string, b: string): void {
    if (!a || !b || a === b) return;
    const [key_a, key_b] = this.pair(a, b);
    getDb()
      .prepare("INSERT OR IGNORE INTO merge_exception (key_a, key_b, created_at) VALUES (?, ?, ?)")
      .run(key_a, key_b, new Date().toISOString());
  }

  /** True when this identity pair must not be merged. */
  forbids(a: string, b: string): boolean {
    if (!a || !b) return false;
    const [key_a, key_b] = this.pair(a, b);
    return Boolean(
      getDb().prepare("SELECT 1 FROM merge_exception WHERE key_a = ? AND key_b = ?").get(key_a, key_b),
    );
  }
}
