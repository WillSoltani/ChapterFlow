import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planTiming, TRIGGER_CLASSES } from "../src/librarian/timingPlan.js";

test("timing plan spreads triggers under the 50% cap and uses only valid trigger ids", () => {
  const ids = new Set(TRIGGER_CLASSES.map((t) => t.id));
  for (const N of [12, 13, 20]) {
    const plan = planTiming("zz-fixture-timing", 1, N);
    const max = Math.max(...Object.values(plan.diagnostics.triggerCounts));
    assert.ok(max / N < 0.5, `max trigger ${max}/${N} must stay < 0.50`);
    for (let n = 1; n <= N; n++) assert.ok(ids.has(plan.allocation[n].triggerId), `ch${n} valid trigger`);
  }
});

test("timing plan is deterministic and a single-chapter redo matches the full deal", () => {
  const full = planTiming("zz-fixture-timing", 1, 13);
  const again = planTiming("zz-fixture-timing", 1, 13);
  assert.deepEqual(full.allocation, again.allocation, "pure function of inputs");
  const redo = planTiming("zz-fixture-timing", 5, 5);
  assert.deepEqual(redo.allocation[5], full.allocation[5], "redo of ch5 matches the full-book trigger");
});
