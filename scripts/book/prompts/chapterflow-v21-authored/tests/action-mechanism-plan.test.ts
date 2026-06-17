import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planActionMechanisms, ACTION_MECHANISMS } from "../src/librarian/actionMechanismPlan.js";
import { loadPedagogyPalettes } from "../src/librarian/pedagogyPlan.js";

// WS-3 — the try-this-now GRAMMAR (sentence shape) and the ACTION MECHANISM (container)
// are dealt by two independent allocators. The `ten-minute-timer` grammar used to
// mandate "the clock is part of the exercise structure" — a timer device — while the
// mechanism reserves the timer/calendar CONTAINER to one chapter and forbids it
// everywhere else, so a non-timer chapter dealt that grammar got contradictory
// instructions (digital-minimalism ch2). The grammar must now defer the container to
// the mechanism, and only `timer_or_calendar` may own a timer/calendar container.
test("a time-box GRAMMAR defers the action container to the MECHANISM (no grammar↔mechanism timer conflict)", () => {
  const ped = loadPedagogyPalettes();
  const timeBox = ped.tryThisNowGrammars.find((g: any) => g.id === "ten-minute-timer");
  assert.ok(timeBox, "ten-minute-timer grammar exists");
  assert.match(timeBox.definition, /ACTION MECHANISM/, "the time-box grammar must explicitly defer the container to the dealt ACTION MECHANISM");
  assert.doesNotMatch(timeBox.definition, /clock is part of the exercise structure/, "the grammar must not mandate a timer device as the container");
  // The reserved timer/calendar mechanism still exists (the one chapter that owns a timer container).
  assert.ok(ACTION_MECHANISMS.some((m) => m.id === "timer_or_calendar" && /timer or calendar/i.test(m.directive)), "timer_or_calendar mechanism owns the timer container");
});

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
