/**
 * Tier-1 regression — sweepFamilyForRepairClass must not MISROUTE a repeated-unit
 * templating finding into location_stamping via an unanchored substring match.
 *
 * The the-organized-mind round-3 halt: a sweep finding labeled
 * "replace-repeated-rhetorical-unit" (quote "hard edge", a non-distinctive common
 * phrase) was routed by /place/ matching inside "rePLACE" to location_stamping —
 * NOT a distinctiveness-required family — so nondistinctiveRepetitionQuote could not
 * demote it, and the non-distinctive quote GATED ch1,2,3,6,7,8 (8/9 → 3/9), burning
 * the repair budget into a halt. Word-anchoring place/location/setting routes it to
 * repeated_unit, where the existing demotion correctly applies.
 *
 * Crucially this does NOT loosen QC: a >=20-char DISTINCTIVE reuse still gates fully.
 */
import assert from "node:assert/strict";

import { test } from "./harness.js";
import { sweepFamilyForRepairClass } from "../src/qc/sweep.js";
import { nondistinctiveRepetitionQuote } from "../src/qc/orchestrator/findingValidity.js";

test("sweepFamilyForRepairClass: 'replace-repeated-rhetorical-unit' routes to repeated_unit, not location_stamping (the round-3 misroute)", () => {
  assert.equal(sweepFamilyForRepairClass("replace-repeated-rhetorical-unit"), "repeated_unit");
});

test("sweepFamilyForRepairClass: other substring-prone repeated-unit labels no longer misroute (location OR persona)", () => {
  // "allocation"/"resetting" must not match the now-anchored location/setting terms.
  assert.notEqual(sweepFamilyForRepairClass("allocation-reuse-across-chapters"), "location_stamping");
  assert.notEqual(sweepFamilyForRepairClass("resetting-practice-unit-repeat"), "location_stamping");
  // "characteristic"/"characterization" must not match \bcharacter\b → must NOT land in persona_drift
  // (a non-distinctiveness family, where a non-distinctive quote would falsely gate — same bug class).
  assert.equal(sweepFamilyForRepairClass("repeated-characteristic-phrase-reuse"), "repeated_unit");
  assert.notEqual(sweepFamilyForRepairClass("recurring-characterization-template"), "persona_drift");
  // a genuine character/persona reuse STILL routes to persona_drift (avoid "scene" in the label,
  // which legitimately routes to scene_skeleton at the earlier check).
  assert.equal(sweepFamilyForRepairClass("character reused across chapters"), "persona_drift");
});

test("sweepFamilyForRepairClass: legitimate location/place/setting findings STILL route to location_stamping", () => {
  assert.equal(sweepFamilyForRepairClass("venue reuse across chapters"), "location_stamping");
  assert.equal(sweepFamilyForRepairClass("repeated place stamp"), "location_stamping");
  assert.equal(sweepFamilyForRepairClass("location reuse"), "location_stamping");
  assert.equal(sweepFamilyForRepairClass("setting reused identically"), "location_stamping");
  // "stamping" stays routed here (stamp left unanchored on purpose).
  assert.equal(sweepFamilyForRepairClass("repeated date stamping"), "location_stamping");
});

test("sweepFamilyForRepairClass: the OTHER round-3 finding 'vary-scene-entry' still routes to scene_skeleton (no regression)", () => {
  assert.equal(sweepFamilyForRepairClass("vary-scene-entry"), "scene_skeleton");
});

test("end-to-end: a non-distinctive 'hard edge' reuse on the repaired mapping is DEMOTED (does not gate)", () => {
  const family = sweepFamilyForRepairClass("replace-repeated-rhetorical-unit");
  // Post-fix family is repeated_unit (a distinctiveness-required family), so the short
  // common quote is non-distinctive → nondistinctiveRepetitionQuote === true → does not gate.
  assert.equal(nondistinctiveRepetitionQuote({ family: family ?? undefined, quote: "hard edge", chapters: [1, 2, 3] }), true);
});

test("no QC loosening: a DISTINCTIVE (>=20-char) reuse on the SAME mapping still GATES", () => {
  const family = sweepFamilyForRepairClass("replace-repeated-rhetorical-unit");
  // A genuinely discriminating reused segment is NOT non-distinctive → returns false → still gates.
  assert.equal(
    nondistinctiveRepetitionQuote({ family: family ?? undefined, quote: "the externalized household cognition shelf", chapters: [1, 2, 3] }),
    false,
  );
});
