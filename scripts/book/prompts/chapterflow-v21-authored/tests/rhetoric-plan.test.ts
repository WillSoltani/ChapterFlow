import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planRhetoric, COUNTER_SHAPES, HOOK_OPENER_CLASSES } from "../src/librarian/rhetoricPlan.js";

test("rhetoric plan keeps the negation shell and every hook class under their book-gate caps", () => {
  for (const N of [13, 20, 32]) {
    const plan = planRhetoric("zz-fixture-rhetoric", 1, N);
    const negation = plan.diagnostics.counterShapeCounts["negation_correction"] ?? 0;
    assert.ok(negation / N < 0.4, `negation_correction ${negation}/${N} must stay < 0.40 (B11/B14)`);
    const maxHook = Math.max(...Object.values(plan.diagnostics.hookClassCounts));
    assert.ok(maxHook / N < 0.5, `max hook class ${maxHook}/${N} must stay < 0.50 (B13)`);
  }
});

test("rhetoric plan is deterministic, adjacent chapters differ, and shapes are valid", () => {
  const a = planRhetoric("zz-fixture-rhetoric", 1, 13);
  const b = planRhetoric("zz-fixture-rhetoric", 1, 13);
  assert.deepEqual(a.allocation, b.allocation, "pure function of inputs");
  const counterIds = new Set(COUNTER_SHAPES.map((s) => s.id));
  const hookIds = new Set(HOOK_OPENER_CLASSES.map((s) => s.id));
  for (let n = 1; n <= 13; n++) {
    assert.ok(counterIds.has(a.allocation[n].counterShape), `valid counterShape ch${n}`);
    assert.ok(hookIds.has(a.allocation[n].hookOpenerClass), `valid hookOpenerClass ch${n}`);
    if (n > 1) {
      assert.notEqual(a.allocation[n].counterShape, a.allocation[n - 1].counterShape, `ch${n} counter differs from ch${n - 1}`);
      assert.notEqual(a.allocation[n].hookOpenerClass, a.allocation[n - 1].hookOpenerClass, `ch${n} hook class differs from ch${n - 1}`);
    }
  }
});
