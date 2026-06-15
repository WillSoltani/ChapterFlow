import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planActionMechanisms, ACTION_MECHANISMS } from "../src/librarian/actionMechanismPlan.js";

test("action-mechanism plan keeps every mechanism under the 0.34 density cap and uses valid ids", () => {
  const ids = new Set(ACTION_MECHANISMS.map((m) => m.id));
  for (const N of [12, 13, 20, 32]) {
    const plan = planActionMechanisms("zz-fixture-action", 1, N);
    const max = Math.max(...Object.values(plan.diagnostics.mechanismCounts));
    assert.ok(max / N < 0.34, `max mechanism ${max}/${N} must stay < 0.34 (BP30 risk)`);
    for (let n = 1; n <= N; n++) assert.ok(ids.has(plan.allocation[n].mechanismId), `ch${n} valid mechanism`);
  }
});

test("action-mechanism plan keeps the timer/calendar container well under the BP30 0.50 gate", () => {
  // The whole point: a compliant deal funnels timer/calendar into at most
  // ceil(N/|palette|) chapters, far below BP30's 0.50 density gate.
  for (const N of [12, 13, 20]) {
    const plan = planActionMechanisms("zz-fixture-action", 1, N);
    const sched = plan.diagnostics.mechanismCounts["timer_or_calendar"] ?? 0;
    assert.ok(sched / N < 0.5, `timer/calendar ${sched}/${N} must stay < 0.50 (deal < BP30 gate)`);
  }
});

test("action-mechanism plan is deterministic and a single-chapter redo matches the full deal", () => {
  const full = planActionMechanisms("zz-fixture-action", 1, 13);
  const again = planActionMechanisms("zz-fixture-action", 1, 13);
  assert.deepEqual(full.allocation, again.allocation, "pure function of inputs");
  const redo = planActionMechanisms("zz-fixture-action", 7, 7);
  assert.deepEqual(redo.allocation[7], full.allocation[7], "redo of ch7 matches the full-book mechanism");
});
