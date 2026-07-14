/**
 * IMP-24F deterministic threshold-to-corpus coverage proof.
 *
 * Applicability is derived from frozen case semantics, never from candidate
 * output. The live planner uses the structural assertion as a zero-call
 * barrier. The versioned model-free certification supplies the observation
 * keys emitted by the real fixture evaluator and requires exact set equality.
 */

import { hashCanonical } from "../../contracts/contractUtil.js";
import {
  IMP24_CORPUS_EXPECTED_COUNTS,
  deriveImp24SourceSemantics,
  type Imp24CorpusBundle,
  type Imp24ReviewRole,
} from "./imp24Corpus.js";
import type { RecoveryRoleThresholdsV1 } from "./reviewLaneTypes.js";

export const IMP24F_THRESHOLD_COVERAGE_SCHEMA = "imp24f-threshold-coverage-proof-v1" as const;
export const IMP24F_SOURCE_MISSING_EVIDENCE_PROBE_ID =
  "SOURCE-MODEL-FREE-PROBE-missing-required-evidence" as const;

export const IMP24F_SOURCE_CONTRADICTION_CASE_IDS = Object.freeze([
  "SOURCE-V3-HOLDOUT-attribution-ch01-fact-2-defect",
  "SOURCE-V3-HOLDOUT-attribution-ch01-fact-4-defect",
] as const);

const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
const CONDUCTOR_METRICS = ["schemaValidity", "evidenceSpanValidity", "requiredCasesResolved"] as const;

const EXPECTED_ZERO_MISS: Readonly<Record<Imp24ReviewRole, Readonly<Record<string, boolean>>>> = Object.freeze({
  reader: Object.freeze({
    schemaValidity: true,
    hardBlockerSensitivity: true,
    hardBlockerFalsePositiveFree: true,
    cleanControlPassRate: false,
    craftCalibrationAccuracy: false,
    evidenceSpanValidity: true,
    requiredCasesResolved: true,
  }),
  source: Object.freeze({
    schemaValidity: true,
    fabricationSensitivity: true,
    causalOverreachSensitivity: true,
    sourceContradictionSensitivity: true,
    highSeverityFalsePositiveFree: true,
    cleanCasePassRate: false,
    supportStatusAccuracy: false,
    visibleRegisterAccuracy: false,
    evidenceSpanValidity: true,
    missingEvidenceInconclusive: true,
    requiredCasesResolved: true,
  }),
  quiz: Object.freeze({
    schemaValidity: true,
    wrongKeyDetection: true,
    cleanUniquePassRate: false,
    ambiguityDetection: false,
    mechanismAccuracy: false,
    evidenceSpanValidity: true,
    requiredCasesResolved: true,
  }),
});

export type Imp24fObservationOrigin =
  | "conductor-owned-holdout"
  | "model-free-evaluator"
  | "certified-model-free-probe";

export type Imp24fObservedCaseIdsByRole = Record<
  Imp24ReviewRole,
  Record<string, readonly string[]>
>;

export type Imp24fThresholdMetricCoverage = {
  metricId: string;
  applicabilityReason: string;
  observationOrigin: Imp24fObservationOrigin;
  expectedDenominator: number;
  minimumDenominator: number;
  zeroMiss: boolean;
  contributingCaseIds: string[];
  actualObservationDenominator: number;
  actualObservationCaseIds: string[];
  missingObservationCaseIds: string[];
  unexpectedObservationCaseIds: string[];
  status: "PASS" | "FAIL";
};

export type Imp24fThresholdCoverageProof = {
  schema: typeof IMP24F_THRESHOLD_COVERAGE_SCHEMA;
  status: "PASS" | "FAIL";
  corpusBundleSha256: string;
  thresholdsSha256: string;
  roles: Record<Imp24ReviewRole, {
    status: "PASS" | "FAIL";
    holdoutCaseCount: number;
    metrics: Imp24fThresholdMetricCoverage[];
    unexpectedActualMetrics: string[];
  }>;
  sourceContradiction: {
    expectedDenominator: 2;
    caseIds: string[];
    baseFactIds: string[];
    categoryReason: string;
    status: "PASS" | "FAIL";
  };
  issues: string[];
  modelCalls: 0;
  apiCalls: 0;
  coverageSha256: string;
};

type ExpectedCoverage = {
  caseIdsByRoleMetric: Record<Imp24ReviewRole, Record<string, string[]>>;
  reasonsByRoleMetric: Record<Imp24ReviewRole, Record<string, string>>;
  originsByRoleMetric: Record<Imp24ReviewRole, Record<string, Imp24fObservationOrigin>>;
  sourceContradictionCaseIds: string[];
  sourceContradictionBaseFactIds: string[];
  issues: string[];
};

export class Imp24fThresholdCoverageError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(`${message}: ${issues.join("; ")}`);
    this.name = "Imp24fThresholdCoverageError";
    this.issues = issues;
  }
}

function canonicalSet(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = canonicalSet(left);
  const b = canonicalSet(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function setDifference(left: readonly string[], right: readonly string[]): string[] {
  const excluded = new Set(right);
  return canonicalSet(left).filter((value) => !excluded.has(value));
}

function emptyMetricMap(): Record<Imp24ReviewRole, Record<string, string[]>> {
  return { reader: {}, source: {}, quiz: {} };
}

function emptyReasonMap(): Record<Imp24ReviewRole, Record<string, string>> {
  return { reader: {}, source: {}, quiz: {} };
}

function emptyOriginMap(): Record<Imp24ReviewRole, Record<string, Imp24fObservationOrigin>> {
  return { reader: {}, source: {}, quiz: {} };
}

function deriveExpectedCoverage(bundle: Imp24CorpusBundle): ExpectedCoverage {
  const caseIdsByRoleMetric = emptyMetricMap();
  const reasonsByRoleMetric = emptyReasonMap();
  const originsByRoleMetric = emptyOriginMap();
  const issues: string[] = [];

  for (const role of ROLES) {
    const allHoldoutIds = canonicalSet(bundle[role].holdout.cases.map((item) => item.caseId));
    for (const metricId of CONDUCTOR_METRICS) {
      caseIdsByRoleMetric[role][metricId] = allHoldoutIds;
      reasonsByRoleMetric[role][metricId] =
        "Every frozen holdout attempt contributes one conductor-owned protocol observation.";
      originsByRoleMetric[role][metricId] = "conductor-owned-holdout";
    }
  }

  const readerRules = {
    hardBlockerSensitivity: {
      kind: "reader-visible-hard-blocker",
      reason: "Reader hard-blocker cases test detection of the owner-authored reader-visible blocking category.",
    },
    hardBlockerFalsePositiveFree: {
      kind: "clean",
      reason: "Reader clean controls test absence of reader hard-blocking findings.",
    },
    cleanControlPassRate: {
      kind: "clean",
      reason: "Reader clean controls test the PASS decision at the frozen score threshold.",
    },
    craftCalibrationAccuracy: {
      kind: "craft-nonblocker",
      reason: "Reader craft-nonblocker cases test REVISE without a hard blocker.",
    },
  } as const;
  for (const [metricId, rule] of Object.entries(readerRules)) {
    caseIdsByRoleMetric.reader[metricId] = canonicalSet(bundle.reader.holdout.cases
      .filter((item) => item.kind === rule.kind)
      .map((item) => item.caseId));
    reasonsByRoleMetric.reader[metricId] = rule.reason;
    originsByRoleMetric.reader[metricId] = "model-free-evaluator";
  }

  const sourceMetricCases: Record<string, string[]> = {
    supportStatusAccuracy: [],
    visibleRegisterAccuracy: [],
    fabricationSensitivity: [],
    causalOverreachSensitivity: [],
    sourceContradictionSensitivity: [],
    highSeverityFalsePositiveFree: [],
    cleanCasePassRate: [],
    missingEvidenceInconclusive: [IMP24F_SOURCE_MISSING_EVIDENCE_PROBE_ID],
  };
  const sourceContradictionBaseFactIds: string[] = [];
  for (const item of bundle.source.holdout.cases) {
    const derived = deriveImp24SourceSemantics(item);
    sourceMetricCases.supportStatusAccuracy.push(item.caseId);
    sourceMetricCases.visibleRegisterAccuracy.push(item.caseId);
    if (derived.primaryCategory === "invented_detail") sourceMetricCases.fabricationSensitivity.push(item.caseId);
    if (derived.primaryCategory === "claim_strength_overreach") sourceMetricCases.causalOverreachSensitivity.push(item.caseId);
    if (derived.primaryCategory === "source_contradiction") {
      sourceMetricCases.sourceContradictionSensitivity.push(item.caseId);
      sourceContradictionBaseFactIds.push(item.provenance.baseFactId);
    }
    if (derived.primaryCategory === null) {
      sourceMetricCases.highSeverityFalsePositiveFree.push(item.caseId);
      sourceMetricCases.cleanCasePassRate.push(item.caseId);
    }
    if (item.expected.expectedPrimaryCategory !== derived.primaryCategory) {
      issues.push(`${item.caseId}: stored category ${String(item.expected.expectedPrimaryCategory)} does not match independently derived ${String(derived.primaryCategory)}`);
    }
  }
  const sourceReasons: Record<string, string> = {
    supportStatusAccuracy: "Every source holdout case has independently derived support status.",
    visibleRegisterAccuracy: "Every source holdout case has independently derived visible-register semantics.",
    fabricationSensitivity: "Only independently derived invented_detail defect cases contribute.",
    causalOverreachSensitivity: "Only independently derived claim_strength_overreach defect cases contribute.",
    sourceContradictionSensitivity: "Only source-bound fact cases whose reader-facing chapter unit asserts the frozen fact's commonError derive source_contradiction.",
    highSeverityFalsePositiveFree: "Only independently derived clean source cases contribute to blocker false-positive measurement.",
    cleanCasePassRate: "Only independently derived clean source cases contribute to PASS-rate measurement.",
    missingEvidenceInconclusive: "One deterministic no-sidecar model-free probe contributes outside the live 40-case holdout.",
  };
  for (const [metricId, ids] of Object.entries(sourceMetricCases)) {
    caseIdsByRoleMetric.source[metricId] = canonicalSet(ids);
    reasonsByRoleMetric.source[metricId] = sourceReasons[metricId]!;
    originsByRoleMetric.source[metricId] = metricId === "missingEvidenceInconclusive"
      ? "certified-model-free-probe"
      : "model-free-evaluator";
  }

  const quizRules = {
    wrongKeyDetection: {
      kind: "key-mismatch",
      reason: "Quiz key-mismatch cases test deterministic wrong-key detection.",
    },
    cleanUniquePassRate: {
      kind: "uniquely-correct-clean",
      reason: "Quiz uniquely-correct clean cases test PASS with one defensible answer.",
    },
    ambiguityDetection: {
      kind: "genuine-ambiguity",
      reason: "Quiz ambiguity cases carry an adversarial two-defensible-answer proof.",
    },
    mechanismAccuracy: {
      kind: "mechanism-causal-key",
      reason: "Quiz mechanism cases test the frozen support/causal-overreach distinction.",
    },
  } as const;
  for (const [metricId, rule] of Object.entries(quizRules)) {
    caseIdsByRoleMetric.quiz[metricId] = canonicalSet(bundle.quiz.holdout.cases
      .filter((item) => item.kind === rule.kind)
      .map((item) => item.caseId));
    reasonsByRoleMetric.quiz[metricId] = rule.reason;
    originsByRoleMetric.quiz[metricId] = "model-free-evaluator";
  }

  return {
    caseIdsByRoleMetric,
    reasonsByRoleMetric,
    originsByRoleMetric,
    sourceContradictionCaseIds: canonicalSet(sourceMetricCases.sourceContradictionSensitivity),
    sourceContradictionBaseFactIds: canonicalSet(sourceContradictionBaseFactIds),
    issues,
  };
}

function structuralIssues(bundle: Imp24CorpusBundle, thresholds: RecoveryRoleThresholdsV1): string[] {
  const expected = deriveExpectedCoverage(bundle);
  const issues = [...expected.issues];
  for (const role of ROLES) {
    if (bundle[role].holdout.cases.length !== IMP24_CORPUS_EXPECTED_COUNTS[role].holdout) {
      issues.push(`${role}: frozen holdout count ${bundle[role].holdout.cases.length} differs from ${IMP24_CORPUS_EXPECTED_COUNTS[role].holdout}`);
    }
    const thresholdMetricIds = Object.keys(thresholds[role]).sort();
    const applicableMetricIds = Object.keys(expected.caseIdsByRoleMetric[role]).sort();
    for (const metricId of setDifference(thresholdMetricIds, applicableMetricIds)) {
      issues.push(`${role}/${metricId}: threshold has no independently derived applicability rule`);
    }
    for (const metricId of setDifference(applicableMetricIds, thresholdMetricIds)) {
      issues.push(`${role}/${metricId}: applicability exists but the threshold is missing`);
    }
    for (const metricId of thresholdMetricIds) {
      const threshold = thresholds[role][metricId];
      const ids = expected.caseIdsByRoleMetric[role][metricId] ?? [];
      if (ids.length === 0) issues.push(`${role}/${metricId}: impossible denominator; zero contributors`);
      if (threshold && ids.length < threshold.minDenominator) {
        issues.push(`${role}/${metricId}: impossible denominator ${ids.length} is below minimum ${threshold.minDenominator}`);
      }
      if (threshold && EXPECTED_ZERO_MISS[role][metricId] !== threshold.zeroMiss) {
        issues.push(`${role}/${metricId}: zeroMiss=${threshold.zeroMiss} differs from the frozen semantic expectation ${String(EXPECTED_ZERO_MISS[role][metricId])}`);
      }
    }
  }
  if (!sameSet(expected.sourceContradictionCaseIds, IMP24F_SOURCE_CONTRADICTION_CASE_IDS)) {
    issues.push(`source/sourceContradictionSensitivity: frozen case set drift; expected ${IMP24F_SOURCE_CONTRADICTION_CASE_IDS.join(",")}, got ${expected.sourceContradictionCaseIds.join(",")}`);
  }
  if (!sameSet(expected.sourceContradictionBaseFactIds, ["ch01.fact.2", "ch01.fact.4"])) {
    issues.push(`source/sourceContradictionSensitivity: frozen base-fact set drift; got ${expected.sourceContradictionBaseFactIds.join(",")}`);
  }
  return canonicalSet(issues);
}

/** Fast zero-call preflight used by the active planner before a schedule can be returned. */
export function assertImp24ThresholdCoverageStructure(
  bundle: Imp24CorpusBundle,
  thresholds: RecoveryRoleThresholdsV1,
): void {
  const issues = structuralIssues(bundle, thresholds);
  if (issues.length > 0) throw new Imp24fThresholdCoverageError("IMP-24F structural coverage barrier failed", issues);
}

export function buildImp24fThresholdCoverageProof(args: {
  corpusBundle: Imp24CorpusBundle;
  thresholds: RecoveryRoleThresholdsV1;
  actualObservationCaseIdsByRole: Imp24fObservedCaseIdsByRole;
}): Imp24fThresholdCoverageProof {
  const expected = deriveExpectedCoverage(args.corpusBundle);
  const issues = structuralIssues(args.corpusBundle, args.thresholds);
  const roles = {} as Imp24fThresholdCoverageProof["roles"];

  for (const role of ROLES) {
    const expectedMetricIds = Object.keys(expected.caseIdsByRoleMetric[role]).sort();
    const actualMetricIds = Object.keys(args.actualObservationCaseIdsByRole[role] ?? {}).sort();
    const unexpectedActualMetrics = setDifference(actualMetricIds, expectedMetricIds);
    for (const metricId of unexpectedActualMetrics) {
      issues.push(`${role}/${metricId}: model-free probe emitted an unknown threshold observation`);
    }
    const metrics = expectedMetricIds.map((metricId): Imp24fThresholdMetricCoverage => {
      const threshold = args.thresholds[role][metricId];
      const contributingCaseIds = canonicalSet(expected.caseIdsByRoleMetric[role][metricId] ?? []);
      const actualObservationCaseIds = canonicalSet(args.actualObservationCaseIdsByRole[role]?.[metricId] ?? []);
      const missingObservationCaseIds = setDifference(contributingCaseIds, actualObservationCaseIds);
      const unexpectedObservationCaseIds = setDifference(actualObservationCaseIds, contributingCaseIds);
      if (!threshold) issues.push(`${role}/${metricId}: threshold is absent`);
      if (missingObservationCaseIds.length > 0) {
        issues.push(`${role}/${metricId}: evaluator/scorer omitted observations for ${missingObservationCaseIds.join(",")}`);
      }
      if (unexpectedObservationCaseIds.length > 0) {
        issues.push(`${role}/${metricId}: evaluator/scorer emitted unexpected observations for ${unexpectedObservationCaseIds.join(",")}`);
      }
      const metricPass = threshold !== undefined
        && contributingCaseIds.length > 0
        && contributingCaseIds.length >= threshold.minDenominator
        && missingObservationCaseIds.length === 0
        && unexpectedObservationCaseIds.length === 0
        && EXPECTED_ZERO_MISS[role][metricId] === threshold.zeroMiss;
      return {
        metricId,
        applicabilityReason: expected.reasonsByRoleMetric[role][metricId]!,
        observationOrigin: expected.originsByRoleMetric[role][metricId]!,
        expectedDenominator: contributingCaseIds.length,
        minimumDenominator: threshold?.minDenominator ?? 0,
        zeroMiss: threshold?.zeroMiss ?? false,
        contributingCaseIds,
        actualObservationDenominator: actualObservationCaseIds.length,
        actualObservationCaseIds,
        missingObservationCaseIds,
        unexpectedObservationCaseIds,
        status: metricPass ? "PASS" : "FAIL",
      };
    });
    roles[role] = {
      status: metrics.every((metric) => metric.status === "PASS") && unexpectedActualMetrics.length === 0 ? "PASS" : "FAIL",
      holdoutCaseCount: args.corpusBundle[role].holdout.cases.length,
      metrics,
      unexpectedActualMetrics,
    };
  }

  const sourceContradictionStatus = sameSet(
    expected.sourceContradictionCaseIds,
    IMP24F_SOURCE_CONTRADICTION_CASE_IDS,
  ) && expected.sourceContradictionCaseIds.length === 2
    && sameSet(expected.sourceContradictionBaseFactIds, ["ch01.fact.2", "ch01.fact.4"])
    ? "PASS" : "FAIL";
  const uniqueIssues = canonicalSet(issues);
  const core: Omit<Imp24fThresholdCoverageProof, "coverageSha256"> = {
    schema: IMP24F_THRESHOLD_COVERAGE_SCHEMA,
    status: uniqueIssues.length === 0 && ROLES.every((role) => roles[role].status === "PASS")
      && sourceContradictionStatus === "PASS" ? "PASS" : "FAIL",
    corpusBundleSha256: args.corpusBundle.substantiveBundleSha256,
    thresholdsSha256: hashCanonical(args.thresholds),
    roles,
    sourceContradiction: {
      expectedDenominator: 2,
      caseIds: expected.sourceContradictionCaseIds,
      baseFactIds: expected.sourceContradictionBaseFactIds,
      categoryReason: "A source-bound fact's frozen commonError is asserted in the reader-facing chapter unit, so independent source semantics derive source_contradiction.",
      status: sourceContradictionStatus,
    },
    issues: uniqueIssues,
    modelCalls: 0,
    apiCalls: 0,
  };
  return { ...core, coverageSha256: hashCanonical(core) };
}

export function assertImp24fThresholdCoverageProof(
  proof: Imp24fThresholdCoverageProof,
): asserts proof is Imp24fThresholdCoverageProof & { status: "PASS" } {
  const { coverageSha256, ...core } = proof;
  const issues = [...proof.issues];
  if (hashCanonical(core) !== coverageSha256) issues.push("coverage self hash mismatch");
  if (proof.status !== "PASS") issues.push("coverage status is not PASS");
  if (proof.modelCalls !== 0 || proof.apiCalls !== 0) issues.push("coverage certification must be model/API free");
  if (issues.length > 0) throw new Imp24fThresholdCoverageError("IMP-24F certified coverage proof failed", canonicalSet(issues));
}
