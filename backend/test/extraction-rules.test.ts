import { test } from "node:test";
import assert from "node:assert/strict";
import { ClaudeCliService } from "../src/claude/claude-cli.service";

// The ownership rules (directed-at-other, general-group) live in the extraction prompt and are a
// model judgement, so they can't be asserted deterministically here. What we CAN pin is the
// plumbing around the model: JSON extraction (fences / insight banners) and the parse helpers.

const EXTRACTED =
  '[{"title":"X","description":"d","due_date":null,"due_date_inferred":false,"priority":null,"suggested_next_step":null,"requested_by":"Ana","dedup_key":"do:x"}]';

test("extractActions strips a ```json fence and parses the array", async () => {
  const c = new ClaudeCliService();
  (c as { run: () => Promise<string> }).run = async () => "```json\n" + EXTRACTED + "\n```";
  const r = await c.extractActions("raw", "email");
  assert.equal(r.length, 1);
  assert.equal(r[0].title, "X");
  assert.equal(r[0].requested_by, "Ana");
});

test("extractActions strips a leading insight banner before the JSON", async () => {
  const c = new ClaudeCliService();
  (c as { run: () => Promise<string> }).run = async () =>
    "★ Insight ───\nsome explanatory prose\n\n" + EXTRACTED;
  const r = await c.extractActions("raw", "chat message");
  assert.equal(r.length, 1);
  assert.equal(r[0].dedup_key, "do:x");
});

test("extractActions returns [] when the model finds nothing owed", async () => {
  const c = new ClaudeCliService();
  (c as { run: () => Promise<string> }).run = async () => "[]";
  assert.deepEqual(await c.extractActions("raw", "email"), []);
});

test("areSameTask parses a yes/no answer", async () => {
  const c = new ClaudeCliService();
  (c as { run: () => Promise<string> }).run = async () => "Yes, same underlying task.";
  assert.equal(await c.areSameTask("a", "b"), true);
  (c as { run: () => Promise<string> }).run = async () => "No — different.";
  assert.equal(await c.areSameTask("a", "b"), false);
});

test("deriveIdentity parses the identity JSON", async () => {
  const c = new ClaudeCliService();
  (c as { run: () => Promise<string> }).run = async () => '{"dedup_key":"approve:cm-1","requested_by":"Ana"}';
  const r = await c.deriveIdentity("Approve CM-1", "desc");
  assert.equal(r.dedup_key, "approve:cm-1");
  assert.equal(r.requested_by, "Ana");
});
