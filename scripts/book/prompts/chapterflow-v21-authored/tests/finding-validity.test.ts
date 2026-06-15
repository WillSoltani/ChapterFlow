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

test("allFindingsFabricated is true only when EVERY finding is invented", () => {
  const real = { unitId: "chapter:2:example[1]", quote: "q", problem: "scenario lacks a setting", expectedFix: "add one" };
  assert.equal(allFindingsFabricated([fabricated]), true);
  assert.equal(allFindingsFabricated([fabricated, real]), false, "one real finding makes the sweep actionable");
  assert.equal(allFindingsFabricated([]), false, "no findings is not a fabrication");
});
