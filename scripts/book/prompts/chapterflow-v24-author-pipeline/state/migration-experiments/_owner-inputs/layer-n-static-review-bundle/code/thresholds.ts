/**
 * IMP-11 — the frozen migration thresholds + the mechanical decision script
 * (§16 "Prespecified migration thresholds" 1-12; prompt inst. 16, 20).
 *
 * Every value here is an OBSERVED OPERATIONAL GATE, not a statistically
 * established population rate: `evaluateThresholds` reports, per row, whether
 * the frozen precision plan also SUPPORTS a population claim, and a numeric
 * rare-rate claim without the planned effective sample is emitted as
 * `statisticallySupported: false` (inst. 15/16 — never overstated).
 *
 * The evaluator can qualify NO profile, ONE profile, or MULTIPLE task-scoped
 * profiles. It never activates anything: the decision file carries an explicit
 * activation refusal — activation is IMP-13's separately-authorized package.
 */

import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import {
  SOL_BAKEOFF_DECISION_SCHEMA,
  type QualifiedProfileV1,
} from "./experimentTypes.js";

export const MIGRATION_THRESHOLDS_SCHEMA = "migration-thresholds-v1" as const;

export type ThresholdsV1 = {
  schema: typeof MIGRATION_THRESHOLDS_SCHEMA;
  version: string;
  nonInferiority: {
    minPooledAcceptancePct: number;
    maxPointsBelowBaselinePct: number;
    /** The frozen interval rule: the acceptance CI lower bound must clear
     *  (baseline − maxPointsBelowBaselinePct). */
    intervalRule: "ci-lower-above-floor";
  };
  margins: {
    sourceFramingPct: number;
    quizAmbiguityPct: number;
    causalMaterialPct: number;
  };
  reviewerReliability: {
    minRawAgreement: number;
    minChanceCorrected: number;
    maxMaterialDisagreementPct: number;
  };
  repairDemand: {
    maxRelativeIncrease: number;
    maxAbsoluteIncreasePerChapter: number;
    /** Owner-frozen C4 rule (§16 correction 2026-07-11): when the BASELINE
     *  (55-XH) projected repair demand is BELOW this floor, the relative
     *  comparison is informational only — the absolute margin is the sole
     *  blocking comparison. At or above the floor, both block. Absent ⇒ the
     *  pre-correction behavior (relative always blocking) is preserved for
     *  existing configurations. */
    relativeRuleAppliesWhenBaselineAtLeast?: number;
  };
  economics: {
    maxCostPerAcceptedChapterUsd: number | null;
    maxLatencyP95Ms: number | null;
  };
  highVsXhigh: { minQualityGainPts: number };
};

/** §16 operational defaults — the product owner freezes (or strictly tightens)
 *  these BEFORE execution; the sealed copy is the run's law (inst. 17). */
export const DEFAULT_MIGRATION_THRESHOLDS: ThresholdsV1 = {
  schema: MIGRATION_THRESHOLDS_SCHEMA,
  version: "defaults-2026-07-10",
  nonInferiority: { minPooledAcceptancePct: 75, maxPointsBelowBaselinePct: 10, intervalRule: "ci-lower-above-floor" },
  margins: { sourceFramingPct: 2, quizAmbiguityPct: 2, causalMaterialPct: 2 },
  reviewerReliability: { minRawAgreement: 0.75, minChanceCorrected: 0.5, maxMaterialDisagreementPct: 10 },
  repairDemand: { maxRelativeIncrease: 0.25, maxAbsoluteIncreasePerChapter: 0.5 },
  economics: { maxCostPerAcceptedChapterUsd: null, maxLatencyP95Ms: null },
  highVsXhigh: { minQualityGainPts: 2 },
};

export function validateThresholds(bytes: string): string[] {
  const problems: string[] = [];
  let t: ThresholdsV1;
  try {
    t = JSON.parse(bytes) as ThresholdsV1;
  } catch (err) {
    return [`thresholds are not valid JSON: ${(err as Error).message}`];
  }
  if (t.schema !== MIGRATION_THRESHOLDS_SCHEMA) problems.push(`schema must be ${MIGRATION_THRESHOLDS_SCHEMA}`);
  if (!t.version) problems.push("version is required");
  if (!(t.nonInferiority?.minPooledAcceptancePct >= 0)) problems.push("nonInferiority.minPooledAcceptancePct required");
  if (!(t.nonInferiority?.maxPointsBelowBaselinePct >= 0)) problems.push("nonInferiority.maxPointsBelowBaselinePct required");
  if (t.nonInferiority?.intervalRule !== "ci-lower-above-floor") problems.push("intervalRule must be ci-lower-above-floor");
  for (const k of ["sourceFramingPct", "quizAmbiguityPct", "causalMaterialPct"] as const) {
    if (!(t.margins?.[k] >= 0)) problems.push(`margins.${k} required`);
  }
  if (!(t.reviewerReliability?.minRawAgreement > 0)) problems.push("reviewerReliability.minRawAgreement required");
  if (!(t.repairDemand?.maxRelativeIncrease >= 0)) problems.push("repairDemand.maxRelativeIncrease required");
  const relFloor = t.repairDemand?.relativeRuleAppliesWhenBaselineAtLeast;
  if (relFloor !== undefined && !(typeof relFloor === "number" && Number.isFinite(relFloor) && relFloor >= 0)) {
    problems.push("repairDemand.relativeRuleAppliesWhenBaselineAtLeast must be a finite number ≥ 0 when present");
  }
  if (!(t.highVsXhigh?.minQualityGainPts >= 0)) problems.push("highVsXhigh.minQualityGainPts required");
  return problems;
}

// ── Evaluation inputs ─────────────────────────────────────────────────────────

/** Everything threshold group N needs, per SOL profile. `null` = the §16 run
 *  has not produced that evidence — the group evaluates INCONCLUSIVE, never a
 *  silent pass (fail-closed toward "no claim"). */
export type ProfileThresholdInputsV1 = {
  cellId: string;
  model: string;
  effort: EffortLevelV1;
  p0StateFailures: number | null;
  upheldHighSeverity: {
    sourcedFabrication: number | null;
    sourceFramingAmbiguity: number | null;
    quizKeyOrMechanism: number | null;
    causalOverreach: number | null;
    exactLeakageOrClone: number | null;
  };
  pooledAcceptancePct: number | null;
  acceptanceCiLowerPct: number | null;
  baselineAcceptancePct: number | null;
  materialRates: {
    sourceFramingPct: { observed: number | null; baseline: number | null };
    quizAmbiguityPct: { observed: number | null; baseline: number | null };
    causalPct: { observed: number | null; baseline: number | null };
  };
  reviewerReliability: {
    rawAgreement: number | null;
    chanceCorrected: number | null;
    materialDisagreementPct: number | null;
    highSeverityHumanReviewComplete: boolean | null;
  };
  repairDemand: { projectedPerChapter: number | null; baselinePerChapter: number | null };
  economics: { costPerAcceptedChapterUsd: number | null; latencyP95Ms: number | null };
  /** Per primary-endpoint id: does the effective sample support the claimed
   *  precision (stats.assessPrecision)? Missing id ⇒ unsupported. */
  precisionSupported: Record<string, boolean>;
  /** Blinded quality composite (for the high-vs-xhigh recommendation only). */
  qualityCompositeMean: number | null;
};

export type ThresholdVerdictV1 = {
  id: string;
  title: string;
  observed: string;
  rule: string;
  verdict: "pass" | "fail" | "inconclusive";
  statisticallySupported: boolean;
  note?: string;
};

export type ProfileEvaluationV1 = {
  cellId: string;
  model: string;
  effort: EffortLevelV1;
  verdicts: ThresholdVerdictV1[];
  qualifies: boolean;
  blockedBy: string[];
  inconclusiveOn: string[];
};

function v(id: string, title: string, observed: string, rule: string, verdict: ThresholdVerdictV1["verdict"], statisticallySupported: boolean, note?: string): ThresholdVerdictV1 {
  return { id, title, observed, rule, verdict, statisticallySupported, ...(note ? { note } : {}) };
}

function zeroGate(id: string, title: string, count: number | null, supported: boolean): ThresholdVerdictV1 {
  if (count === null) return v(id, title, "unavailable", "zero upheld", "inconclusive", false, "evidence not produced yet");
  return v(id, title, String(count), "zero upheld", count === 0 ? "pass" : "fail", supported);
}

function marginGate(id: string, title: string, pair: { observed: number | null; baseline: number | null }, marginPct: number, supported: boolean): ThresholdVerdictV1 {
  if (pair.observed === null || pair.baseline === null) {
    return v(id, title, "unavailable", `≤ baseline + ${marginPct}pp`, "inconclusive", false);
  }
  const ok = pair.observed <= pair.baseline + marginPct;
  return v(id, title, `${pair.observed.toFixed(2)}% vs baseline ${pair.baseline.toFixed(2)}%`, `≤ baseline + ${marginPct}pp`, ok ? "pass" : "fail", supported);
}

export function evaluateProfile(inputs: ProfileThresholdInputsV1, t: ThresholdsV1): ProfileEvaluationV1 {
  const supportedFraming = inputs.precisionSupported["source-framing"] === true;
  const supportedQuiz = inputs.precisionSupported["quiz-defect"] === true;
  const supportedFab = inputs.precisionSupported["sourced-fabrication"] === true;
  const verdicts: ThresholdVerdictV1[] = [];

  verdicts.push(zeroGate("T1-state-safety", "State and execution safety", inputs.p0StateFailures, true));
  verdicts.push(zeroGate("T2-severe-factual", "Observed severe factual safety", inputs.upheldHighSeverity.sourcedFabrication, supportedFab));

  if (inputs.pooledAcceptancePct === null || inputs.baselineAcceptancePct === null || inputs.acceptanceCiLowerPct === null) {
    verdicts.push(v("T3-non-inferiority", "First-write non-inferiority", "unavailable", `≥${t.nonInferiority.minPooledAcceptancePct}% and ≥ baseline − ${t.nonInferiority.maxPointsBelowBaselinePct}pp (CI rule)`, "inconclusive", false));
  } else {
    const floor = inputs.baselineAcceptancePct - t.nonInferiority.maxPointsBelowBaselinePct;
    const pointOk = inputs.pooledAcceptancePct >= t.nonInferiority.minPooledAcceptancePct && inputs.pooledAcceptancePct >= floor;
    const intervalOk = inputs.acceptanceCiLowerPct >= floor;
    verdicts.push(v(
      "T3-non-inferiority",
      "First-write non-inferiority",
      `pooled ${inputs.pooledAcceptancePct.toFixed(1)}% (CI lower ${inputs.acceptanceCiLowerPct.toFixed(1)}%), baseline ${inputs.baselineAcceptancePct.toFixed(1)}%`,
      `≥${t.nonInferiority.minPooledAcceptancePct}% pooled, point ≥ baseline − ${t.nonInferiority.maxPointsBelowBaselinePct}pp, CI lower above the floor`,
      pointOk && intervalOk ? "pass" : pointOk && !intervalOk ? "inconclusive" : "fail",
      true,
      pointOk && !intervalOk ? "point estimate clears; interval precision insufficient (inst. 16: inconclusive, not pass)" : undefined,
    ));
  }

  const framingZero = zeroGate("T4a-framing-severe", "Source framing (upheld high-severity)", inputs.upheldHighSeverity.sourceFramingAmbiguity, supportedFraming);
  verdicts.push(framingZero);
  verdicts.push(marginGate("T4b-framing-material", "Source framing (material rate)", inputs.materialRates.sourceFramingPct, t.margins.sourceFramingPct, supportedFraming));
  verdicts.push(zeroGate("T5a-quiz-severe", "Quiz key/mechanism (upheld high-severity among accepted)", inputs.upheldHighSeverity.quizKeyOrMechanism, supportedQuiz));
  verdicts.push(marginGate("T5b-quiz-ambiguity", "Quiz ambiguity (material rate)", inputs.materialRates.quizAmbiguityPct, t.margins.quizAmbiguityPct, supportedQuiz));
  verdicts.push(zeroGate("T6a-causal-severe", "Causal overreach (upheld high-severity)", inputs.upheldHighSeverity.causalOverreach, true));
  verdicts.push(marginGate("T6b-causal-material", "Causal (material rate)", inputs.materialRates.causalPct, t.margins.causalMaterialPct, true));
  verdicts.push(zeroGate("T7-repetition", "Repetition (exact prohibited leakage / adjudicated clone)", inputs.upheldHighSeverity.exactLeakageOrClone, true));

  const rr = inputs.reviewerReliability;
  if (rr.rawAgreement === null || rr.materialDisagreementPct === null || rr.highSeverityHumanReviewComplete === null) {
    verdicts.push(v("T8-reviewer-reliability", "Reviewer reliability", "unavailable", `raw ≥ ${t.reviewerReliability.minRawAgreement}, chance-corrected ≥ ${t.reviewerReliability.minChanceCorrected}, material disagreement ≤ ${t.reviewerReliability.maxMaterialDisagreementPct}%, human review complete`, "inconclusive", false));
  } else {
    const chanceOk = rr.chanceCorrected === null ? false : rr.chanceCorrected >= t.reviewerReliability.minChanceCorrected;
    const ok = rr.rawAgreement >= t.reviewerReliability.minRawAgreement && chanceOk
      && rr.materialDisagreementPct <= t.reviewerReliability.maxMaterialDisagreementPct
      && rr.highSeverityHumanReviewComplete === true;
    verdicts.push(v("T8-reviewer-reliability", "Reviewer reliability", `raw ${rr.rawAgreement.toFixed(2)}, chance-corrected ${rr.chanceCorrected === null ? "unavailable" : rr.chanceCorrected.toFixed(2)}, disagreement ${rr.materialDisagreementPct.toFixed(1)}%, human review ${rr.highSeverityHumanReviewComplete ? "complete" : "INCOMPLETE"}`, "frozen minimums", ok ? "pass" : "fail", true));
  }

  const rd = inputs.repairDemand;
  const rdRelFloor = t.repairDemand.relativeRuleAppliesWhenBaselineAtLeast;
  const rdRuleText = rdRelFloor === undefined
    ? `≤ baseline × ${1 + t.repairDemand.maxRelativeIncrease} and ≤ baseline + ${t.repairDemand.maxAbsoluteIncreasePerChapter}/chapter`
    : `≤ baseline + ${t.repairDemand.maxAbsoluteIncreasePerChapter}/chapter (blocking); relative ≤ ×${1 + t.repairDemand.maxRelativeIncrease} blocking only when baseline ≥ ${rdRelFloor} (owner-frozen C4 rule)`;
  if (rd.projectedPerChapter === null || rd.baselinePerChapter === null) {
    verdicts.push(v("T9-repair-demand", "Repair demand", "unavailable", rdRuleText, "inconclusive", false));
  } else {
    // Owner-frozen C4 rule (correction 2026-07-11): the relative comparison
    // blocks ONLY when the baseline is at or above the frozen floor; below it,
    // the absolute margin is the sole blocking comparison and the relative
    // value is reported informationally. No floor configured ⇒ pre-correction
    // behavior (both always blocking).
    const relBlocking = rdRelFloor === undefined || rd.baselinePerChapter >= rdRelFloor;
    const absOk = rd.projectedPerChapter <= rd.baselinePerChapter + t.repairDemand.maxAbsoluteIncreasePerChapter;
    const relOk = rd.projectedPerChapter <= rd.baselinePerChapter * (1 + t.repairDemand.maxRelativeIncrease);
    const ok = absOk && (!relBlocking || relOk);
    const note = relBlocking
      ? "projection, not an observed production rate"
      : `projection, not an observed production rate; relative comparison informational (baseline ${rd.baselinePerChapter.toFixed(2)} < ${rdRelFloor} floor) — relative ${relOk ? "clears" : "exceeds"} ×${(1 + t.repairDemand.maxRelativeIncrease).toFixed(2)} and cannot independently fail this configuration`;
    verdicts.push(v("T9-repair-demand", "Repair demand", `${rd.projectedPerChapter.toFixed(2)} vs baseline ${rd.baselinePerChapter.toFixed(2)} sessions/chapter (projection)`, rdRuleText, ok ? "pass" : "fail", false, note));
  }

  const ec = inputs.economics;
  const costRuleActive = t.economics.maxCostPerAcceptedChapterUsd !== null;
  const latRuleActive = t.economics.maxLatencyP95Ms !== null;
  if (!costRuleActive && !latRuleActive) {
    verdicts.push(v("T10-economics", "Economics and latency", ec.latencyP95Ms === null ? "latency unavailable" : `p95 ${Math.round(ec.latencyP95Ms / 1000)}s`, "no frozen bound declared", "pass", true, "owner declared no economic bound; latency reported informationally"));
  } else {
    const costOk = !costRuleActive || (ec.costPerAcceptedChapterUsd !== null && ec.costPerAcceptedChapterUsd <= t.economics.maxCostPerAcceptedChapterUsd!);
    const latOk = !latRuleActive || (ec.latencyP95Ms !== null && ec.latencyP95Ms <= t.economics.maxLatencyP95Ms!);
    const anyUnavailable = (costRuleActive && ec.costPerAcceptedChapterUsd === null) || (latRuleActive && ec.latencyP95Ms === null);
    verdicts.push(v("T10-economics", "Economics and latency", `cost ${ec.costPerAcceptedChapterUsd ?? "unavailable"}, p95 ${ec.latencyP95Ms ?? "unavailable"}`, "within frozen bounds", anyUnavailable ? "inconclusive" : costOk && latOk ? "pass" : "fail", true));
  }

  const blockedBy = verdicts.filter((x) => x.verdict === "fail").map((x) => x.id);
  const inconclusiveOn = verdicts.filter((x) => x.verdict === "inconclusive").map((x) => x.id);
  return {
    cellId: inputs.cellId,
    model: inputs.model,
    effort: inputs.effort,
    verdicts,
    qualifies: blockedBy.length === 0 && inconclusiveOn.length === 0,
    blockedBy,
    inconclusiveOn,
  };
}

// ── The decision file ─────────────────────────────────────────────────────────

export type DecisionFileV1 = {
  schema: typeof SOL_BAKEOFF_DECISION_SCHEMA;
  experimentId: string;
  specSha256: string;
  thresholdsSha256: string;
  metricTablesSha256: string;
  decidedAt: string;
  profiles: ProfileEvaluationV1[];
  result: "QUALIFIED" | "NO_SOL_PROFILE_QUALIFIED" | "INCONCLUSIVE";
  qualifiedProfiles: QualifiedProfileV1[];
  /** §16 threshold 11: high preferred unless the frozen quality gain justifies
   *  xhigh — surfaced as a routing RECOMMENDATION, never an activation. */
  effortRecommendation: string;
  line: string;
  activation: "NOT AUTHORIZED HERE — activation is IMP-13's separately authorized package";
};

export function buildDecisionFile(args: {
  experimentId: string;
  specSha256: string;
  thresholdsSha256: string;
  metricTablesSha256: string;
  profiles: ProfileEvaluationV1[];
  thresholds: ThresholdsV1;
  qualityCompositeByCell: Record<string, number | null>;
}): DecisionFileV1 {
  const qualified = args.profiles.filter((p) => p.qualifies);
  const anyFailAll = args.profiles.length > 0 && args.profiles.every((p) => p.blockedBy.length > 0);
  const result: DecisionFileV1["result"] = qualified.length > 0 ? "QUALIFIED" : anyFailAll ? "NO_SOL_PROFILE_QUALIFIED" : "INCONCLUSIVE";

  let effortRecommendation = "no SOL profile qualified — no effort recommendation";
  let qualifiedProfiles: QualifiedProfileV1[] = qualified.map((p) => ({ model: p.model, effort: p.effort }));
  if (qualified.length > 1) {
    const high = qualified.find((p) => p.effort === "high");
    const xhigh = qualified.find((p) => p.effort === "xhigh");
    if (high && xhigh) {
      const gain = (args.qualityCompositeByCell[xhigh.cellId] ?? 0) - (args.qualityCompositeByCell[high.cellId] ?? 0);
      if (gain >= args.thresholds.highVsXhigh.minQualityGainPts) {
        effortRecommendation = `both qualify; xhigh's blinded composite gain (${gain.toFixed(1)}pts ≥ ${args.thresholds.highVsXhigh.minQualityGainPts}) justifies xhigh for quality-critical task classes; high elsewhere`;
        qualifiedProfiles = [
          { model: high.model, effort: high.effort },
          { model: xhigh.model, effort: xhigh.effort, taskClasses: ["author-first-write", "author-regeneration", "source-sensitive-repair"] },
        ];
      } else {
        effortRecommendation = `both qualify; xhigh's gain (${gain.toFixed(1)}pts) does not meet the frozen ${args.thresholds.highVsXhigh.minQualityGainPts}pt bar — prefer high (§16 threshold 11)`;
        qualifiedProfiles = [{ model: high.model, effort: high.effort }];
      }
    }
  } else if (qualified.length === 1) {
    effortRecommendation = `only ${qualified[0].cellId} qualifies`;
  }

  const line = result === "QUALIFIED"
    ? `SOL BAKEOFF RESULT: QUALIFIED ${qualifiedProfiles.map((p) => `${p.model}@${p.effort}${p.taskClasses ? ` (${p.taskClasses.join(",")})` : ""}`).join("; ")}`
    : result === "NO_SOL_PROFILE_QUALIFIED"
      ? "SOL BAKEOFF RESULT: NO SOL PROFILE QUALIFIED"
      : "SOL BAKEOFF RESULT: INCONCLUSIVE";

  return {
    schema: SOL_BAKEOFF_DECISION_SCHEMA,
    experimentId: args.experimentId,
    specSha256: args.specSha256,
    thresholdsSha256: args.thresholdsSha256,
    metricTablesSha256: args.metricTablesSha256,
    decidedAt: new Date().toISOString(),
    profiles: args.profiles,
    result,
    qualifiedProfiles,
    effortRecommendation,
    line,
    activation: "NOT AUTHORIZED HERE — activation is IMP-13's separately authorized package",
  };
}
