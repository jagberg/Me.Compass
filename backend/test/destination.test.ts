// Set config env before requiring the modules that read it (getAppConfig caches lazily).
process.env.ESS_URL = "https://ess.example/#/";
process.env.JIRA_BASE_URL = "https://jira.example";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Action } from "../src/types";
// require (not import) so it resolves after the env is set above.
const { resolveDestination } = require("../src/actions/destination");

function action(over: Partial<Action>): Action {
  return {
    title: "",
    description: "",
    source_type: "chat",
    source_url: null,
    ...over,
  } as Action;
}

test("a JIRA key routes to the ticket", () => {
  const d = resolveDestination(action({ title: "Approve CM-391 (WAF block)" }));
  assert.deepEqual(d, { action_url: "https://jira.example/browse/CM-391", action_target: "JIRA" });
});

test("a leave action routes to ESS when configured", () => {
  const d = resolveDestination(action({ title: "Approve leave application", source_url: "https://chat/x" }));
  assert.deepEqual(d, { action_url: "https://ess.example/#/", action_target: "ESS" });
});

test("otherwise it opens the source, labelled by source type", () => {
  const d = resolveDestination(action({ title: "Reply to Ben", source_type: "email", source_url: "https://mail/x" }));
  assert.deepEqual(d, { action_url: "https://mail/x", action_target: "Email" });
});

test("no destination when there is nothing to open", () => {
  const d = resolveDestination(action({ title: "Think about strategy", source_type: "manual", source_url: null }));
  assert.equal(d, null);
});
