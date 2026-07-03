import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planWeeklyPractices, WEEKLY_PRACTICE_FORMS } from "../src/librarian/weeklyPracticePlan.js";

test("weekly-practice plan keeps every form under the 0.34 density cap and uses valid ids", () => {
  const ids = new Set(WEEKLY_PRACTICE_FORMS.map((f) => f.id));
  for (const N of [12, 13, 20, 32]) {
    const plan = planWeeklyPractices("zz-fixture-weekly", 1, N);
    const max = Math.max(...Object.values(plan.diagnostics.formCounts));
    assert.ok(max / N < 0.34, `max form ${max}/${N} must stay < 0.34`);
    for (let n = 1; n <= N; n++) assert.ok(ids.has(plan.allocation[n].formId), `ch${n} valid form`);
  }
});

test("weekly-practice plan is deterministic and a single-chapter redo matches the full deal", () => {
  const full = planWeeklyPractices("zz-fixture-weekly", 1, 13);
  const again = planWeeklyPractices("zz-fixture-weekly", 1, 13);
  assert.deepEqual(full.allocation, again.allocation, "pure function of inputs");
  const redo = planWeeklyPractices("zz-fixture-weekly", 9, 9);
  assert.deepEqual(redo.allocation[9], full.allocation[9], "redo of ch9 matches the full-book form");
});
