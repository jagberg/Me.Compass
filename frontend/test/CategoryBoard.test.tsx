import { render, screen } from "@testing-library/react";
import { test, expect } from "vitest";
import { CategoryBoard } from "../src/components/CategoryBoard";
import { localTodayIso } from "../src/util/date";
import type { Action, Category, CategoryGroup } from "../src/api/types";

const yesterday = (() => {
  const d = new Date(localTodayIso() + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

const cat: Category = { id: "c1", name: "Software Renewals", rule: "", icon: null, created_at: "" };

const action = (over: Partial<Action>): Action => ({
  id: "a1",
  title: "Renew the cert",
  description: "d",
  source_type: "email",
  source_url: "https://mail/x",
  status: "open",
  due_date: null,
  due_date_inferred: false,
  priority: null,
  suggested_next_step: null,
  created_at: "2026-09-01T00:00:00Z",
  resolved_at: null,
  requested_by: null,
  category_id: "c1",
  category_pinned: false,
  dedup_key: null,
  merged_from: null,
  conflict: false,
  stale_review: false,
  title_pinned: false,
  ...over,
});

test("renders the category name, an overdue badge, and the line contents", () => {
  const groups: CategoryGroup[] = [
    { category: cat, actions: [action({ due_date: yesterday, suggested_next_step: "Email the vendor" })] },
  ];
  render(<CategoryBoard groups={groups} categories={[cat]} twoColumn={false} onChange={() => {}} onSplit={() => {}} />);

  expect(screen.getByText("Software Renewals")).toBeInTheDocument();
  expect(screen.getByText("1 overdue")).toBeInTheDocument();
  expect(screen.getByText("Renew the cert")).toBeInTheDocument();
  expect(screen.getByText("Email the vendor")).toBeInTheDocument();
  expect(screen.getByText("overdue")).toBeInTheDocument(); // due pill
});

test("Uncategorised group renders under its label", () => {
  const groups: CategoryGroup[] = [
    { category: null, actions: [action({ id: "a2", title: "Loose end", category_id: null })] },
  ];
  render(<CategoryBoard groups={groups} categories={[cat]} twoColumn={false} onChange={() => {}} onSplit={() => {}} />);
  expect(screen.getByText("Uncategorised")).toBeInTheDocument();
  expect(screen.getByText("Loose end")).toBeInTheDocument();
});
