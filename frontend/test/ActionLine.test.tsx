import { render, screen, fireEvent } from "@testing-library/react";
import { test, expect, vi, beforeEach } from "vitest";

vi.mock("../src/api/actions", () => ({
  updateAction: vi.fn((_id: string, fields: Record<string, unknown>) => Promise.resolve({ ...baseAction, ...fields })),
  runAction: vi.fn(),
  splitAction: vi.fn(),
}));

import { updateAction } from "../src/api/actions";
import { ActionLine } from "../src/components/ActionLine";
import type { Action } from "../src/api/types";

const baseAction: Action = {
  id: "a1",
  title: "Original title",
  description: "desc",
  source_type: "chat",
  source_url: "https://chat.example/msg",
  status: "open",
  due_date: null,
  due_date_inferred: false,
  priority: null,
  suggested_next_step: null,
  created_at: "2026-09-01T00:00:00Z",
  resolved_at: null,
  requested_by: null,
  category_id: null,
  category_pinned: false,
  dedup_key: null,
  merged_from: null,
  conflict: false,
  stale_review: false,
  title_pinned: false,
};

function renderLine() {
  return render(<ActionLine action={baseAction} categories={[]} onChange={() => {}} onSplit={() => {}} />);
}

beforeEach(() => vi.clearAllMocks());

test("clicking the title, typing, and pressing Enter renames via updateAction", () => {
  renderLine();
  fireEvent.click(screen.getByText("Original title")); // enter edit mode
  const input = screen.getByLabelText("Edit title") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Renamed by me" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(updateAction).toHaveBeenCalledWith("a1", { title: "Renamed by me" });
});

test("a blank title does not call updateAction", () => {
  renderLine();
  fireEvent.click(screen.getByText("Original title"));
  const input = screen.getByLabelText("Edit title") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(updateAction).not.toHaveBeenCalled();
});

test("Escape cancels without calling updateAction", () => {
  renderLine();
  fireEvent.click(screen.getByText("Original title"));
  const input = screen.getByLabelText("Edit title") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "changed" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(updateAction).not.toHaveBeenCalled();
  expect(screen.getByText("Original title")).toBeInTheDocument();
});
