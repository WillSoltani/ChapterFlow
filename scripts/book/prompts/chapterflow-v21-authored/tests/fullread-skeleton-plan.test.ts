import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planFullReadSkeletons, FULLREAD_BOUNDARY_BEATS } from "../src/librarian/fullReadSkeletonPlan.js";

test("fullread-skeleton plan keeps every boundary beat under the 0.34 density cap and uses valid ids", () => {
  const ids = new Set(FULLREAD_BOUNDARY_BEATS.map((b) => b.id));
  for (const N of [12, 13, 20, 32]) {
    const plan = planFullReadSkeletons("zz-fixture-fullread", 1, N);
    const max = Math.max(...Object.values(plan.diagnostics.beatCounts));
    assert.ok(max / N < 0.34, `max beat ${max}/${N} must stay < 0.34`);
    for (let n = 1; n <= N; n++) assert.ok(ids.has(plan.allocation[n].beatId), `ch${n} valid beat`);
  }
});

test("fullread-skeleton plan is deterministic and a single-chapter redo matches the full deal", () => {
  const full = planFullReadSkeletons("zz-fixture-fullread", 1, 13);
  const again = planFullReadSkeletons("zz-fixture-fullread", 1, 13);
  assert.deepEqual(full.allocation, again.allocation, "pure function of inputs");
  const redo = planFullReadSkeletons("zz-fixture-fullread", 11, 11);
  assert.deepEqual(redo.allocation[11], full.allocation[11], "redo of ch11 matches the full-book beat");
});
