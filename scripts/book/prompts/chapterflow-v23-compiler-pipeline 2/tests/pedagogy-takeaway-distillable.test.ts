/**
 * D3 — keyTakeaway distillability ("one-sentence test"), ADVISORY / minor.
 *
 * The check operationalizes the beginner-friendliness rule "could a tired reader
 * repeat the chapter's one move in a sentence?": a keyTakeaway that is BOTH
 * abstraction-heavy (≥3 distinct nominalized concept-nouns) AND has NO concrete
 * anchor (no second-person, no number, no "X, not Y" contrast) reads at arm's
 * length, so it surfaces a minor nudge. It must NEVER block — word choice is
 * contextual — and it must NOT fire on the everyday, concrete, or not-this/this
 * takeaways the rule actually wants. These tests pin both halves: non-vacuous
 * (a genuinely abstract takeaway fires) and high-precision (the good shapes don't).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { checkTakeawayDistillable } from "../src/critics/pedagogy.js";
import { runShipGate, ENFORCED_MAJOR } from "../src/critics/finalGate.js";
import { makeChapter } from "./helpers.js";

const CHECK = "D3.takeaway_distillable";

test("D3: an abstract takeaway with no concrete anchor fires exactly one minor (non-vacuous)", () => {
  const abstract = "Sustained change depends on the cultivation of motivation and the recognition of cues.";
  const findings = checkTakeawayDistillable(abstract, "keyTakeaway");
  assert.equal(findings.length, 1, "an abstraction-heavy, anchor-free takeaway must surface");
  assert.equal(findings[0].severity, "minor", "distillability is advisory — it never blocks");
  assert.equal(findings[0].checkId, "pedagogy.takeaway_distillable");
});

test("D3: a second-person anchor suppresses the nudge even when nominalizations are present", () => {
  // 2 nominalizations (concentration, motivation) but "you/your" gives the reader
  // a concrete move — not at arm's length.
  const findings = checkTakeawayDistillable("Your concentration and motivation both drop when you switch tasks.", "keyTakeaway");
  assert.deepEqual(findings, [], "a 'you'-anchored takeaway is concrete enough; do not nudge");
});

test("D3: a number anchors the claim — suppressed", () => {
  // representativeness + probability = 2 nominalizations, but the figure grounds it.
  const findings = checkTakeawayDistillable("Snap judgments lean on representativeness over probability about 9 times in 10.", "keyTakeaway");
  assert.deepEqual(findings, [], "a numeric anchor makes the takeaway concrete");
});

test("D3: the 'X, not Y' contrast shape is exempt (it is the distilled form the rule wants)", () => {
  // repetition + recognition + motivation = 3 nominalizations, but the contrast is
  // itself a crisp, repeatable frame — exactly the not-this/this move beginners read fast.
  const findings = checkTakeawayDistillable("Habits are about repetition and recognition, not motivation.", "keyTakeaway");
  assert.deepEqual(findings, [], "a not-this/this contrast is a distilled shape, not arm's-length abstraction");
});

test("D3: one repeated concept-noun is not two — distinct nominalizations required", () => {
  const findings = checkTakeawayDistillable("Motivation fades fast; motivation is fragile.", "keyTakeaway");
  assert.deepEqual(findings, [], "the same noun twice is not abstraction density");
});

test("D3: an imperative opener is the move — it passes even when it carries 3+ abstract nouns (corpus calibration)", () => {
  // "Keep reserves that…" names a directive; it is concrete by construction even
  // though "disruption / capacity / attention" are nominalizations. Pre-calibration
  // this fired (it was 1 of the 410 false positives on the shipped corpus).
  const findings = checkTakeawayDistillable(
    "Keep reserves that let a system absorb disruption, rebound with capacity, or turn pressure into useful attention.",
    "keyTakeaway",
  );
  assert.deepEqual(findings, [], "an imperative opener names the move — do not nudge");
});

test("D3: a directive embedded after a clause break (\"…, so check …\") is still a move — passes", () => {
  // The imperative sits behind a leading conjunction in a later clause; it is still
  // a move the reader can grab.
  const findings = checkTakeawayDistillable(
    "Availability makes examples feel important, so check the base occurrence before judging probability.",
    "keyTakeaway",
  );
  assert.deepEqual(findings, [], "an embedded 'so check …' directive must suppress the nudge");
});

test("D3: a plain, concrete, single-move takeaway passes clean", () => {
  for (const ok of [
    "Give one target the room.",
    "Fear is an alarm, not a scale.",
    "Pick the move, hide the noise, come back when you drift.",
  ]) {
    assert.deepEqual(checkTakeawayDistillable(ok, "keyTakeaway"), [], `must not nudge: "${ok}"`);
  }
});

test("D3: empty / missing takeaway is a no-op", () => {
  assert.deepEqual(checkTakeawayDistillable(undefined, "keyTakeaway"), []);
  assert.deepEqual(checkTakeawayDistillable("   ", "keyTakeaway"), []);
});

test("D3 is wired into runShipGate as advisory: it surfaces as a minor and never gates", () => {
  // The catalog id must be advisory: minor severity and absent from ENFORCED_MAJOR,
  // so it can never flip gate.passed (passed = no blockers && no enforced majors).
  assert.ok(!ENFORCED_MAJOR.has(CHECK), "D3 must not be enforced — it is advisory-only");

  const abstract = makeChapter("zz-fixture-distill", 1, {
    overrides: { keyTakeaway: "Lasting transformation requires the cultivation of motivation and the recognition of conditions." },
  });
  const fired = runShipGate(abstract);
  const hit = fired.minors.find((f) => f.catalogId === CHECK);
  assert.ok(hit, "an abstract keyTakeaway must surface a D3 minor in runShipGate");
  assert.equal(hit?.severity, "minor");
  assert.ok(!fired.blockers.some((f) => f.catalogId === CHECK), "D3 must never appear as a blocker");

  // The same chapter with an anchored, concrete keyTakeaway raises no D3 finding.
  const anchored = makeChapter("zz-fixture-distill", 1, {
    overrides: { keyTakeaway: "Before you react to a scary headline, ask how likely the harm really is." },
  });
  const clean = runShipGate(anchored);
  assert.ok(![...clean.minors, ...clean.majors, ...clean.blockers].some((f) => f.catalogId === CHECK), "a concrete, anchored takeaway raises no D3 finding");
});
