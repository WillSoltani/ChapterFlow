import assert from "node:assert/strict";

import { test } from "./harness.js";
import { AXIS_WEIGHTS } from "../src/critics/semantic/publishableBar.js";
import { validateSubmission } from "../src/qc/orchestrator/schemas.js";

const BOOK = "zz-fixture-schema";
const ROUND = "r-schema";

function greenAxes(): any[] {
  return Object.keys(AXIS_WEIGHTS).map((axis) => ({ axis, score: 0.9, tier: "PUBLISHABLE", hits: [] }));
}

test("qc-bar-read-v1 requires every publishableBar axis", () => {
  const axes = greenAxes().filter((a) => a.axis !== "factual_accuracy");
  const result = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:schema-test",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    axes,
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /missing axis factual_accuracy/);
});

test("qc-key-derive-v2 requires confidence, source facts, and reason length", () => {
  const result = validateSubmission(BOOK, ROUND, "keyA", {
    schemaVersion: "qc-key-derive-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "keyA",
    chapters: [{
      chapterNumber: 1,
      packHash: "pack",
      answers: [{
        questionIndex: 0,
        choiceIndex: 1,
        confidence: "high",
        reason: "short",
        sourceFactIds: [],
      }],
    }],
  });
  assert.equal(result.ok, false);
  const errors = (result as any).errors.join("\n");
  assert.match(errors, /reason must be at least 40/);
  assert.match(errors, /sourceFactIds/);
});

test("qc-sweep-submission-v1 PASS requires all checked families", () => {
  const result = validateSubmission(BOOK, ROUND, "sweep", {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift"],
    findings: [],
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /location_stamping/);
});
