import { test } from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../src/util/concurrency";

test("returns results in input order regardless of completion order", async () => {
  const out = await mapWithConcurrency([30, 10, 20, 0], 2, async (ms, i) => {
    await new Promise((r) => setTimeout(r, ms));
    return `${i}:${ms}`;
  });
  assert.deepEqual(out, ["0:30", "1:10", "2:20", "3:0"]);
});

test("never runs more than `limit` at once", async () => {
  let inFlight = 0;
  let peak = 0;
  await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
  });
  assert.equal(peak, 3);
});

test("a rejection propagates (first error wins)", async () => {
  await assert.rejects(
    mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    }),
    /boom/,
  );
});

test("empty input yields an empty result and never calls fn", async () => {
  let calls = 0;
  const out = await mapWithConcurrency([], 4, async () => {
    calls++;
    return 1;
  });
  assert.deepEqual(out, []);
  assert.equal(calls, 0);
});
