import assert from "node:assert/strict";

import { test } from "./harness.js";
import { citesNonexistentField, allFindingsFabricated } from "../src/qc/orchestrator/findingValidity.js";

// The exact fabrication that shipped on the-daily-stoic: a sweep finding that
// invented a non-existent `implementationPlan.challenge` field.
const fabricated = {
  unitId: "book-wide-implementationPlan-challenge-24h-duplicate",
  quote: 'CH1 challenge and twentyFourHourChallenge both read: "Use Run the Control Filter once today."',
  problem: "Across all 12 chapters, implementationPlan.challenge is duplicated verbatim into implementationPlan.twentyFourHourChallenge.",
  expectedFix: "Revise either challenge or twentyFourHourChallenge so the two differ.",
};

test("citesNonexistentField catches an invented field on a real container", () => {
  assert.equal(citesNonexistentField(fabricated), "implementationPlan.challenge");
});

test("citesNonexistentField passes real field references and non-field prose", () => {
  assert.equal(citesNonexistentField({ unitId: "chapter:1:breakdown.fastRead", quote: "x", problem: "breakdown.fastRead opens weak", expectedFix: "y" }), null);
  assert.equal(citesNonexistentField({ unitId: "chapter:1:example[0]", quote: "the scenario feels abstract", problem: "implementationPlan.twentyFourHourChallenge is fine; planSpec.venue is set", expectedFix: "z" }), null);
  // An unknown container (not in the map) is never flagged — conservative by design.
  assert.equal(citesNonexistentField({ unitId: "u", quote: "see e.g. the note", problem: "the file.txt and section.two are fine", expectedFix: "" }), null);
});

test("citesNonexistentField does NOT mis-flag a dotted array-element path (the ch4 false-positive)", () => {
  // the-daily-stoic ch04: a REAL confirm REVISE cited `examples.ex01.scenario`. The old
  // 2-level regex matched `examples.ex01`, read `ex01` as a non-existent field, and dropped
  // the finding as fabricated. The fix validates the FINAL field after an array subscript.
  assert.equal(
    citesNonexistentField({
      unitId: "examples.ex01.scenario",
      quote: "Clara marks three plain facts in the city council anteroom before a Roman forum.",
      problem: "examples.ex01.scenario blends a modern anteroom with an ancient forum",
      expectedFix: "Recast the scene as one coherent setting.",
    }),
    null,
    "examples.ex01.scenario is a real array-element field reference, not fabricated",
  );
  // numeric subscript form, and a bare element reference with no field, are also fine.
  assert.equal(citesNonexistentField({ unitId: "examples.0.whatToDo", quote: "q", problem: "examples.0.whatToDo is a proposition", expectedFix: "" }), null);
  assert.equal(citesNonexistentField({ unitId: "examples.ex02", quote: "q", problem: "examples.ex02 is abstract", expectedFix: "" }), null);
  // The genuine 2-level fabrication is still caught even with the new subscript tolerance.
  assert.equal(citesNonexistentField(fabricated), "implementationPlan.challenge");
  // A truly invented field AFTER a real subscript is still caught (we validate the final token).
  assert.equal(citesNonexistentField({ unitId: "examples.ex01.bogusfield", quote: "q", problem: "examples.ex01.bogusfield", expectedFix: "" }), "examples.bogusfield");
});

test("allFindingsFabricated is true only when EVERY finding is invented", () => {
  const real = { unitId: "chapter:2:example[1]", quote: "q", problem: "scenario lacks a setting", expectedFix: "add one" };
  assert.equal(allFindingsFabricated([fabricated]), true);
  assert.equal(allFindingsFabricated([fabricated, real]), false, "one real finding makes the sweep actionable");
  assert.equal(allFindingsFabricated([]), false, "no findings is not a fabrication");
});
