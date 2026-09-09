import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection";
import { Category } from "../types";

function toCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    name: row.name as string,
    rule: row.rule as string,
    icon: (row.icon as string) ?? null,
    created_at: row.created_at as string,
  };
}

@Injectable()
export class CategoriesRepository {
  list(): Category[] {
    const db = getDb();
    return db
      .prepare("SELECT * FROM category ORDER BY name ASC")
      .all()
      .map((r) => toCategory(r as Record<string, unknown>));
  }

  create(input: { name: string; rule: string; icon?: string | null }): Category {
    const db = getDb();
    const category: Category = {
      id: randomUUID(),
      name: input.name,
      rule: input.rule,
      icon: input.icon ?? null,
      created_at: new Date().toISOString(),
    };
    db.prepare("INSERT INTO category (id, name, rule, icon, created_at) VALUES (?, ?, ?, ?, ?)").run(
      category.id,
      category.name,
      category.rule,
      category.icon,
      category.created_at,
    );
    return category;
  }

  update(id: string, fields: Partial<Pick<Category, "name" | "rule" | "icon">>): Category | undefined {
    const db = getDb();
    const existing = db.prepare("SELECT * FROM category WHERE id = ?").get(id);
    if (!existing) return undefined;
    const merged = { ...toCategory(existing as Record<string, unknown>), ...fields };
    db.prepare("UPDATE category SET name = ?, rule = ?, icon = ? WHERE id = ?").run(
      merged.name,
      merged.rule,
      merged.icon,
      id,
    );
    return merged;
  }

  /** Deletes a category and returns its actions to Uncategorised (never deletes actions). */
  delete(id: string): void {
    const db = getDb();
    db.prepare("UPDATE action SET category_id = NULL WHERE category_id = ?").run(id);
    db.prepare("DELETE FROM category WHERE id = ?").run(id);
  }
}
