import { apiFetch } from "./client";
import { Category } from "./types";

export function getCategories(): Promise<Category[]> {
  return apiFetch(`/categories`);
}

export function createCategory(input: { name: string; rule: string; icon?: string | null }): Promise<Category> {
  return apiFetch(`/categories`, { method: "POST", body: JSON.stringify(input) });
}

export function updateCategory(
  id: string,
  fields: { name?: string; rule?: string; icon?: string | null },
): Promise<Category> {
  return apiFetch(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(fields) });
}

export function deleteCategory(id: string): Promise<void> {
  return apiFetch(`/categories/${id}`, { method: "DELETE" });
}
