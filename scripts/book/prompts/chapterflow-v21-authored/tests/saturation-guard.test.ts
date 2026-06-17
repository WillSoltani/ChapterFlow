/**
 * saturationGuard — the reusable deal-time cap any single-value variety allocator
 * calls so a concentrated deal (the cause of the un-gateable scene_skeleton/
 * repeated_unit families) is impossible to PRODUCE. Tests the share math, the
 * universal cap throw, the stricter flagged-subset cap, and the empty-deal no-op.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { assertMaxShare, maxShare, shareCounts } from "../src/librarian/saturationGuard.js";

test("shareCounts and maxShare report the dominant value's share", () => {
  const v = ["a", "a", "a", "b", "c"];
  assert.equal(shareCounts(v).get("a"), 3);
  const m = maxShare(v);
  assert.equal(m.value, "a");
  assert.equal(m.count, 3);
  assert.ok(Math.abs(m.fraction - 0.6) < 1e-9);
});

test("assertMaxShare throws when a value exceeds the universal cap, passes when under", () => {
  assert.throws(() => assertMaxShare(["a", "a", "a", "a", "b"], 0.6, "test"), /value "a".*80%.*60% cap/);
  assert.doesNotThrow(() => assertMaxShare(["a", "a", "b", "c", "d"], 0.6, "test")); // a = 0.40
});

test("assertMaxShare applies a STRICTER cap to a flagged subset (scene-prone shapes)", () => {
  const v = ["om", "om", "x", "y", "z"]; // om = 0.40
  assert.throws(
    () => assertMaxShare(v, 0.6, "hook", { ids: new Set(["om"]), cap: 0.3, note: "scene-prone" }),
    /scene-prone/,
  );
  assert.doesNotThrow(() => assertMaxShare(v, 0.6, "hook", { ids: new Set(["om"]), cap: 0.5 }));
});

test("assertMaxShare is a no-op on an empty deal", () => {
  assert.doesNotThrow(() => assertMaxShare([], 0.6, "test"));
});
