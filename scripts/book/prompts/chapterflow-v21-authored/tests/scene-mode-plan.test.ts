import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  planSceneModes,
  dampenRetrospectiveShapes,
  RETROSPECTIVE_SHAPES,
} from "../src/librarian/sceneModePlan.js";

test("scene-mode plan caps retrospective_review under 30% of the book", () => {
  for (const N of [12, 13, 20, 32]) {
    const plan = planSceneModes("zz-fixture-scene", 1, N);
    const retro = plan.diagnostics.stanceCounts["retrospective_review"] ?? 0;
    assert.ok(retro / N < 0.3, `retrospective ${retro}/${N} must stay < 0.30 (scene_skeleton)`);
  }
});

test("scene-mode plan is deterministic and a single-chapter redo matches the full deal", () => {
  const full = planSceneModes("zz-fixture-scene", 1, 13);
  const again = planSceneModes("zz-fixture-scene", 1, 13);
  assert.deepEqual(full.allocation, again.allocation, "pure function of inputs");
  const redo = planSceneModes("zz-fixture-scene", 9, 9);
  assert.deepEqual(redo.allocation[9], full.allocation[9], "redo of ch9 matches the full-book stance");
});

test("dampenRetrospectiveShapes removes postmortem/audit from non-retrospective chapters only", () => {
  const slots = ["postmortem", "dialogue", "audit", "vignette", "contrast", "reset_moment"];
  const damped = dampenRetrospectiveShapes(slots, "live_unfolding");
  assert.ok(!damped.some((s) => RETROSPECTIVE_SHAPES.has(s)), "no retrospective shapes remain in a live chapter");
  assert.equal(damped.length, slots.length, "slot count preserved");
  assert.equal(new Set(damped).size, damped.length, "slots stay distinct");
  // A chapter dealt the retrospective stance keeps its dealt shapes untouched.
  assert.deepEqual(dampenRetrospectiveShapes(slots, "retrospective_review"), slots);
});
