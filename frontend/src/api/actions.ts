import { apiFetch } from "./client";
import { Action, CategoryGroup, SourceType } from "./types";

export function getActions(status = "open"): Promise<Action[]> {
  return apiFetch(`/actions?status=${status}`);
}

export function getActionsGrouped(status = "open"): Promise<Record<SourceType, Action[]>> {
  return apiFetch(`/actions?status=${status}&group_by=source`);
}

export function getActionsByCategory(status = "open"): Promise<CategoryGroup[]> {
  return apiFetch(`/actions?status=${status}&group_by=category`);
}

export function splitAction(id: string): Promise<Action[]> {
  return apiFetch(`/actions/${id}/split`, { method: "POST" });
}

export function getTodayActions(): Promise<Action[]> {
  return apiFetch(`/actions/today`);
}

export function createAction(input: {
  title: string;
  description: string;
  due_date?: string;
  priority?: string;
}): Promise<Action> {
  return apiFetch(`/actions`, { method: "POST", body: JSON.stringify(input) });
}

export function updateAction(
  id: string,
  fields: Partial<Pick<Action, "title" | "due_date" | "priority" | "status" | "category_id" | "conflict" | "stale_review">>,
): Promise<Action> {
  return apiFetch(`/actions/${id}`, { method: "PATCH", body: JSON.stringify(fields) });
}

export function runAction(id: string) {
  return apiFetch(`/actions/${id}/run`, { method: "POST" });
}
