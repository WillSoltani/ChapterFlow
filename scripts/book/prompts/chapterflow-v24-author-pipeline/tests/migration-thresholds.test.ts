/**
 * IMP-11 — the frozen migration thresholds + decision script: the twelve §16
 * groups, observed-gate vs statistical-claim honesty, inconclusive-over-
 * overstated, no forced winner, and the exact decision line.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  buildDecisionFile,
  DEFAULT_MIGRATION_THRESHOLDS,
  evaluateProfile,
  validateThresholds,
  type ProfileThresholdInputsV1,
} from "../src/bakeoff/migration/thresholds.js";

function goodInputs(over?: Partial<ProfileThresholdInputsV1> & { cellId?: string; effort?: "high" | "xhigh" }): ProfileThresholdInputsV1 {
  return {
    cellId: over?.cellId ?? "56S-H",
    model: "gpt-5.6-sol",
    effort: over?.effort ?? "high",
    p0StateFailures: 0,
    upheldHighSeverity: {
      sourcedFabrication: 0,
      sourceFramingAmbiguity: 0,
      quizKeyOrMechanism: 0,
      causalOverreach: 0,
      exactLeakageOrClone: 0,
    },
    pooledAcceptancePct: 85,
    acceptanceCiLowerPct: 79,
    baselineAcceptancePct: 88,
    materialRates: {
      sourceFramingPct: { observed: 1, baseline: 1 },
      quizAmbiguityPct: { observed: 1, baseline: 2 },
      causalPct: { observed: 0, baseline: 1 },
    },
    reviewerReliability: { rawAgreement: 0.9, chanceCorrected: 0.7, materialDisagreementPct: 5, highSeverityHumanReviewComplete: true },
    repairDemand: { projectedPerChapter: 0.3, baselinePerChapter: 0.3 },
    economics: { costPerAcceptedChapterUsd: null, latencyP95Ms: 60_000 },
    precisionSupported: { "source-framing": true, "quiz-defect": true, "sourced-fabrication": true },
    qualityCompositeMean: 88,
    ...over,
  };
}

test("the default thresholds validate and encode the §16 operational defaults", () => {
  assert.deepEqual(validateThresholds(JSON.stringify(DEFAULT_MIGRATION_THRESHOLDS)), []);
  assert.equal(DEFAULT_MIGRATION_THRESHOLDS.nonInferiority.minPooledAcceptancePct, 75);
  assert.equal(DEFAULT_MIGRATION_THRESHOLDS.nonInferiority.maxPointsBelowBaselinePct, 10);
  assert.ok(validateThresholds("not json").length > 0);
  assert.ok(validateThresholds(JSON.stringify({ schema: "wrong" })).length > 0);
});

test("a clean profile passes all twelve groups; every zero-gate failure blocks", () => {
  const clean = evaluateProfile(goodInputs(), DEFAULT_MIGRATION_THRESHOLDS);
  assert.equal(clean.qualifies, true, `blocked by ${clean.blockedBy.join(",")} / inconclusive on ${clean.inconclusiveOn.join(",")}`);
  assert.equal(clean.verdicts.length, 13, "T1..T10 with the two-part framing/quiz/causal rows");

  const fab = evaluateProfile(goodInputs({ upheldHighSeverity: { ...goodInputs().upheldHighSeverity, sourcedFabrication: 1 } }), DEFAULT_MIGRATION_THRESHOLDS);
  assert.equal(fab.qualifies, false);
  assert.ok(fab.blockedBy.includes("T2-severe-factual"));

  const clone = evaluateProfile(goodInputs({ upheldHighSeverity: { ...goodInputs().upheldHighSeverity, exactLeakageOrClone: 2 } }), DEFAULT_MIGRATION_THRESHOLDS);
  assert.ok(clone.blockedBy.includes("T7-repetition"));
});

test("non-inferiority: below-floor fails; point-clears-but-interval-misses is INCONCLUSIVE, never a pass (inst. 16)", () => {
  const fail = evaluateProfile(goodInputs({ pooledAcceptancePct: 70 }), DEFAULT_MIGRATION_THRESHOLDS);
  assert.ok(fail.blockedBy.includes("T3-non-inferiority"));
  const imprecise = evaluateProfile(goodInputs({ acceptanceCiLowerPct: 60 }), DEFAULT_MIGRATION_THRESHOLDS);
  assert.equal(imprecise.qualifies, false);
  assert.ok(imprecise.inconclusiveOn.includes("T3-non-inferiority"), "insufficient precision is inconclusive, not pass/fail");
});

test("missing evidence is INCONCLUSIVE (fail-closed toward no-claim), and unsupported precision is marked on the verdict", () => {
  const noHuman = evaluateProfile(goodInputs({
    upheldHighSeverity: { sourcedFabrication: null, sourceFramingAmbiguity: null, quizKeyOrMechanism: null, causalOverreach: null, exactLeakageOrClone: 0 },
    reviewerReliability: { rawAgreement: null, chanceCorrected: null, materialDisagreementPct: null, highSeverityHumanReviewComplete: null },
  }), DEFAULT_MIGRATION_THRESHOLDS);
  assert.equal(noHuman.qualifies, false);
  assert.ok(noHuman.blockedBy.length === 0, "nothing FAILED — the evidence simply is not there yet");
  assert.ok(noHuman.inconclusiveOn.includes("T2-severe-factual"));
  assert.ok(noHuman.inconclusiveOn.includes("T8-reviewer-reliability"));

  const unsupported = evaluateProfile(goodInputs({ precisionSupported: {} }), DEFAULT_MIGRATION_THRESHOLDS);
  const t2 = unsupported.verdicts.find((v) => v.id === "T2-severe-factual")!;
  assert.equal(t2.verdict, "pass", "the observed gate still evaluates");
  assert.equal(t2.statisticallySupported, false, "…but it is marked an observed gate, not a population claim");
});

test("reviewer reliability fails without completed high-severity human review; repair demand fails beyond the frozen margins", () => {
  const humanIncomplete = evaluateProfile(goodInputs({
    reviewerReliability: { rawAgreement: 0.9, chanceCorrected: 0.7, materialDisagreementPct: 5, highSeverityHumanReviewComplete: false },
  }), DEFAULT_MIGRATION_THRESHOLDS);
  assert.ok(humanIncomplete.blockedBy.includes("T8-reviewer-reliability"));

  const repairHeavy = evaluateProfile(goodInputs({ repairDemand: { projectedPerChapter: 0.9, baselinePerChapter: 0.3 } }), DEFAULT_MIGRATION_THRESHOLDS);
  assert.ok(repairHeavy.blockedBy.includes("T9-repair-demand"));
});

test("decision file: qualified/no-profile/inconclusive lines are exact; xhigh needs the frozen quality gain; nothing activates", () => {
  const base = { experimentId: "exp-t", specSha256: "a".repeat(64), thresholdsSha256: "b".repeat(64), metricTablesSha256: "c".repeat(64), thresholds: DEFAULT_MIGRATION_THRESHOLDS };

  const high = evaluateProfile(goodInputs({ cellId: "56S-H", effort: "high", qualityCompositeMean: 86 }), DEFAULT_MIGRATION_THRESHOLDS);
  const xhigh = evaluateProfile(goodInputs({ cellId: "56S-XH", effort: "xhigh", qualityCompositeMean: 89 }), DEFAULT_MIGRATION_THRESHOLDS);
  const both = buildDecisionFile({ ...base, profiles: [high, xhigh], qualityCompositeByCell: { "56S-H": 86, "56S-XH": 89 } });
  assert.equal(both.result, "QUALIFIED");
  assert.ok(both.line.startsWith("SOL BAKEOFF RESULT: QUALIFIED "));
  assert.ok(both.qualifiedProfiles.some((p) => p.effort === "xhigh" && (p.taskClasses ?? []).includes("author-first-write")), "3pt ≥ 2pt bar → xhigh earns task-scoped classes");
  assert.ok(both.activation.includes("IMP-13"));

  const smallGain = buildDecisionFile({ ...base, profiles: [high, xhigh], qualityCompositeByCell: { "56S-H": 88, "56S-XH": 89 } });
  assert.deepEqual(smallGain.qualifiedProfiles, [{ model: "gpt-5.6-sol", effort: "high" }], "1pt < 2pt bar → prefer high (§16 threshold 11)");

  const blockedHigh = evaluateProfile(goodInputs({ cellId: "56S-H", pooledAcceptancePct: 40, acceptanceCiLowerPct: 30 }), DEFAULT_MIGRATION_THRESHOLDS);
  const blockedXhigh = evaluateProfile(goodInputs({ cellId: "56S-XH", effort: "xhigh", pooledAcceptancePct: 40, acceptanceCiLowerPct: 30 }), DEFAULT_MIGRATION_THRESHOLDS);
  const none = buildDecisionFile({ ...base, profiles: [blockedHigh, blockedXhigh], qualityCompositeByCell: {} });
  assert.equal(none.result, "NO_SOL_PROFILE_QUALIFIED");
  assert.equal(none.line, "SOL BAKEOFF RESULT: NO SOL PROFILE QUALIFIED");
  assert.deepEqual(none.qualifiedProfiles, [], "no forced winner — neither profile may qualify");

  const inconclusive = evaluateProfile(goodInputs({ cellId: "56S-H", acceptanceCiLowerPct: 60 }), DEFAULT_MIGRATION_THRESHOLDS);
  const mixed = buildDecisionFile({ ...base, profiles: [inconclusive, blockedXhigh], qualityCompositeByCell: {} });
  assert.equal(mixed.result, "INCONCLUSIVE");
  assert.equal(mixed.line, "SOL BAKEOFF RESULT: INCONCLUSIVE");
});

// Owner-frozen C4 repair-demand rule (§16 correction 2026-07-11): below the
// baseline floor the relative comparison is informational and cannot
// independently fail a configuration; at or above the floor both comparisons
// block. The four cases below are the owner's mandated coverage, verbatim.
test("repair demand (owner C4 rule): relative comparison blocks only when the baseline is at or above the frozen floor", () => {
  const ownerT = {
    ...DEFAULT_MIGRATION_THRESHOLDS,
    repairDemand: { maxRelativeIncrease: 0.2, maxAbsoluteIncreasePerChapter: 0.05, relativeRuleAppliesWhenBaselineAtLeast: 0.1 },
  };
  const t9 = (baseline: number, candidate: number) =>
    evaluateProfile(goodInputs({ repairDemand: { projectedPerChapter: candidate, baselinePerChapter: baseline } }), ownerT)
      .verdicts.find((x) => x.id === "T9-repair-demand")!;

  // baseline 5%, candidate 9%: absolute passes; relative (×1.8 > ×1.2) must NOT cause failure
  const lowBaselinePass = t9(0.05, 0.09);
  assert.equal(lowBaselinePass.verdict, "pass", "below-floor baseline: the relative rule is informational and cannot independently fail");
  assert.ok(lowBaselinePass.note!.includes("informational"), "the informational relative comparison is disclosed on the verdict");

  // baseline 5%, candidate 11%: absolute rule fails
  assert.equal(t9(0.05, 0.11).verdict, "fail", "the absolute +5pp margin remains blocking below the floor");

  // baseline 20%, candidate 23%: absolute and relative rules pass
  assert.equal(t9(0.2, 0.23).verdict, "pass");

  // baseline 20%, candidate 25%: relative fails even though the absolute difference is exactly 5 points
  const relFail = t9(0.2, 0.25);
  assert.equal(relFail.verdict, "fail", "at/above the floor the relative rule blocks even when the absolute margin is met");
});

test("repair demand: without the floor the pre-correction behavior is preserved (relative always blocking)", () => {
  const legacyT = {
    ...DEFAULT_MIGRATION_THRESHOLDS,
    repairDemand: { maxRelativeIncrease: 0.2, maxAbsoluteIncreasePerChapter: 0.05 },
  };
  const r = evaluateProfile(goodInputs({ repairDemand: { projectedPerChapter: 0.09, baselinePerChapter: 0.05 } }), legacyT);
  assert.ok(r.blockedBy.includes("T9-repair-demand"), "no configured floor ⇒ the relative rule still blocks (existing configs unchanged)");
});

test("thresholds validator: the relative-rule floor must be a finite number ≥ 0 when present", () => {
  const mk = (floor: unknown) => JSON.stringify({
    ...DEFAULT_MIGRATION_THRESHOLDS,
    repairDemand: { maxRelativeIncrease: 0.2, maxAbsoluteIncreasePerChapter: 0.05, relativeRuleAppliesWhenBaselineAtLeast: floor },
  });
  assert.deepEqual(validateThresholds(mk(0.1)), [], "a valid floor is accepted");
  assert.deepEqual(validateThresholds(JSON.stringify(DEFAULT_MIGRATION_THRESHOLDS)), [], "an absent floor stays valid");
  assert.ok(validateThresholds(mk(-1)).some((p) => p.includes("relativeRuleAppliesWhenBaselineAtLeast")), "a negative floor is rejected");
  assert.ok(validateThresholds(mk("0.1")).some((p) => p.includes("relativeRuleAppliesWhenBaselineAtLeast")), "a non-number floor is rejected");
});
