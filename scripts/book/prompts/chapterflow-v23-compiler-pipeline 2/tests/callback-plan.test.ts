import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planCallbacks, RECALL_FRAMES } from "../src/librarian/callbackPlan.js";

test("callback plan keeps every recall frame under the BP28 density cap (0.40)", () => {
  for (const N of [13, 20, 32]) {
    const plan = planCallbacks("zz-fixture-callback", 1, N);
    const dealt = Object.keys(plan.allocation).length; // chapters 2..N
    const maxFrame = Math.max(...Object.values(plan.diagnostics.frameCounts));
    assert.ok(maxFrame / dealt < 0.4, `max recall frame ${maxFrame}/${dealt} must stay < 0.40 (BP28)`);
  }
});

test("callback plan: ch1 has no callback; every later chapter gets a PRIOR target + a valid frame", () => {
  const plan = planCallbacks("zz-fixture-callback", 1, 13);
  assert.equal(plan.allocation[1], undefined, "chapter 1 has no earlier chapter to call back to");
  const frameIds = new Set(RECALL_FRAMES.map((f) => f.id));
  for (let n = 2; n <= 13; n++) {
    const a = plan.allocation[n];
    assert.ok(a, `ch${n} dealt`);
    assert.ok(a.callbackChapter >= 1 && a.callbackChapter < n, `ch${n} target ${a.callbackChapter} must be a prior chapter`);
    assert.ok(frameIds.has(a.frameId), `ch${n} frame ${a.frameId} is valid`);
  }
});

test("callback plan SPREADS targets — no single prior chapter dominates (BP28 concept-collapse fix)", () => {
  // The OLD allocator added a `(n-1)*2` stride that is always ≡0 (mod span=n-1),
  // so it vanished and the target degenerated to `1 + (offset mod (n-1))`, piling
  // most chapters onto ONE early target (fooled-by-randomness: 7/13 → ch2, so 8
  // review-card callbacks resurfaced one concept → BP28; 50/114 catalog books were
  // at risk). The golden-ratio allocator must keep every callback TARGET under the
  // same 0.40 density cap the planner now asserts. Non-vacuous: the OLD formula
  // (and a degenerate redo) trips the planner's >=0.40 throw / this assert.
  for (const bookId of ["zz-fixture-callback", "fooled-by-randomness", "thinking-fast-and-slow", "the-prince"]) {
    for (const N of [14, 20, 32]) {
      const plan = planCallbacks(bookId, 1, N); // throws if a target lands >= 0.40 at N>=12
      const dealt = Object.keys(plan.allocation).length;
      const maxTarget = Math.max(...Object.values(plan.diagnostics.targetCounts));
      assert.ok(maxTarget / dealt < 0.4, `${bookId} N=${N}: max callback target ${maxTarget}/${dealt} must stay < 0.40 (BP28)`);
    }
  }
});

test("callback plan is deterministic and a single-chapter redo matches the full-book deal", () => {
  const full = planCallbacks("zz-fixture-callback", 1, 13);
  const again = planCallbacks("zz-fixture-callback", 1, 13);
  assert.deepEqual(full.allocation, again.allocation, "pure function of inputs");
  const redo = planCallbacks("zz-fixture-callback", 7, 7);
  assert.deepEqual(redo.allocation[7], full.allocation[7], "redo of ch7 matches the full-book assignment (absolute n-1 keying)");
});
