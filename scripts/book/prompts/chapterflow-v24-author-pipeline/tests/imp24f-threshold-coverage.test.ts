import assert from "node:assert/strict";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  buildImp24CorpusBundle,
  loadImp24FrozenV2Inputs,
  type Imp24CorpusBundle,
  type Imp24ReviewRole,
} from "../src/bakeoff/migration/imp24Corpus.js";
import { prepareImp24QualificationCases } from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24_FROZEN_ROLE_THRESHOLDS,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24F_SOURCE_CONTRADICTION_CASE_IDS,
  Imp24fThresholdCoverageError,
  assertImp24ThresholdCoverageStructure,
  assertImp24fThresholdCoverageProof,
  buildImp24fThresholdCoverageProof,
  type Imp24fObservedCaseIdsByRole,
  type Imp24fThresholdCoverageProof,
} from "../src/bakeoff/migration/imp24ThresholdCoverage.js";
import {
  certifyImp24fThresholdCoverage,
  collectImp24fEvaluatorObservationCaseIds,
} from "../src/bakeoff/migration/imp24fThresholdCoverageCertification.js";
import type { RecoveryRoleThresholdsV1 } from "../src/bakeoff/migration/reviewLaneTypes.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function build(): Imp24CorpusBundle {
  return buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
}

function metric(
  proof: Imp24fThresholdCoverageProof,
  role: Imp24ReviewRole,
  metricId: string,
) {
  const result = proof.roles[role].metrics.find((item) => item.metricId === metricId);
  assert.ok(result, `${role}/${metricId} is absent from the coverage proof`);
  return result;
}

test("IMP-24F model-free coverage certifies every threshold denominator against exact evaluator observations", () => {
  const corpusBundle = build();
  const preparedCases = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle }).preparedCases;
  const certification = certifyImp24fThresholdCoverage({
    corpusBundle,
    preparedCases,
    thresholds: IMP24_FROZEN_ROLE_THRESHOLDS,
  });

  assert.equal(certification.status, "CERTIFIED_MODEL_FREE");
  assert.equal(certification.evaluatorProbeCaseCount, 110);
  assert.equal(certification.modelCalls, 0);
  assert.equal(certification.apiCalls, 0);
  assert.equal(certification.coverageProof.status, "PASS");
  assert.deepEqual(certification.coverageProof.issues, []);
  for (const role of ["reader", "source", "quiz"] as const) {
    assert.equal(certification.coverageProof.roles[role].status, "PASS");
    for (const item of certification.coverageProof.roles[role].metrics) {
      assert.equal(item.status, "PASS", `${role}/${item.metricId}`);
      assert.equal(item.actualObservationDenominator, item.expectedDenominator, `${role}/${item.metricId}`);
      assert.deepEqual(item.actualObservationCaseIds, item.contributingCaseIds, `${role}/${item.metricId}`);
    }
  }

  assert.equal(metric(certification.coverageProof, "reader", "schemaValidity").expectedDenominator, 30);
  assert.equal(metric(certification.coverageProof, "reader", "hardBlockerSensitivity").expectedDenominator, 10);
  assert.equal(metric(certification.coverageProof, "reader", "hardBlockerFalsePositiveFree").expectedDenominator, 10);
  assert.equal(metric(certification.coverageProof, "reader", "craftCalibrationAccuracy").expectedDenominator, 10);
  assert.equal(metric(certification.coverageProof, "source", "schemaValidity").expectedDenominator, 40);
  assert.equal(metric(certification.coverageProof, "source", "fabricationSensitivity").expectedDenominator, 4);
  assert.equal(metric(certification.coverageProof, "source", "causalOverreachSensitivity").expectedDenominator, 4);
  assert.equal(metric(certification.coverageProof, "source", "sourceContradictionSensitivity").expectedDenominator, 2);
  assert.equal(metric(certification.coverageProof, "source", "highSeverityFalsePositiveFree").expectedDenominator, 20);
  assert.equal(metric(certification.coverageProof, "source", "supportStatusAccuracy").expectedDenominator, 40);
  assert.equal(metric(certification.coverageProof, "source", "missingEvidenceInconclusive").expectedDenominator, 1);
  assert.equal(metric(certification.coverageProof, "quiz", "wrongKeyDetection").expectedDenominator, 10);
  assert.equal(metric(certification.coverageProof, "quiz", "cleanUniquePassRate").expectedDenominator, 10);
  assert.equal(metric(certification.coverageProof, "quiz", "ambiguityDetection").expectedDenominator, 10);
  assert.equal(metric(certification.coverageProof, "quiz", "mechanismAccuracy").expectedDenominator, 10);
});

test("IMP-24F source contradiction coverage is exactly the two independently derived frozen fact defects", () => {
  const corpusBundle = build();
  const preparedCases = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle }).preparedCases;
  const proof = certifyImp24fThresholdCoverage({
    corpusBundle,
    preparedCases,
    thresholds: IMP24_FROZEN_ROLE_THRESHOLDS,
  }).coverageProof;

  assert.equal(proof.sourceContradiction.status, "PASS");
  assert.equal(proof.sourceContradiction.expectedDenominator, 2);
  assert.deepEqual(proof.sourceContradiction.caseIds, [...IMP24F_SOURCE_CONTRADICTION_CASE_IDS].sort());
  assert.deepEqual(proof.sourceContradiction.baseFactIds, ["ch01.fact.2", "ch01.fact.4"]);
  assert.match(proof.sourceContradiction.categoryReason, /commonError.*source_contradiction/);
  assert.deepEqual(
    metric(proof, "source", "sourceContradictionSensitivity").contributingCaseIds,
    [...IMP24F_SOURCE_CONTRADICTION_CASE_IDS].sort(),
  );
});

test("IMP-24F structural pre-call barrier fails an impossible threshold denominator", () => {
  const thresholds = clone(IMP24_FROZEN_ROLE_THRESHOLDS) as RecoveryRoleThresholdsV1;
  thresholds.source.sourceContradictionSensitivity.minDenominator = 3;
  assert.throws(
    () => assertImp24ThresholdCoverageStructure(build(), thresholds),
    (error: unknown) => error instanceof Imp24fThresholdCoverageError
      && /source\/sourceContradictionSensitivity: impossible denominator 2 is below minimum 3/.test(error.message),
  );
});

test("IMP-24F coverage fails closed when a source category label disagrees with independent derivation", () => {
  const corpusBundle = clone(build());
  const contradiction = corpusBundle.source.holdout.cases.find(
    (item) => item.caseId === IMP24F_SOURCE_CONTRADICTION_CASE_IDS[0],
  );
  assert.ok(contradiction);
  contradiction.expected.expectedPrimaryCategory = "invented_detail";
  assert.throws(
    () => assertImp24ThresholdCoverageStructure(corpusBundle, IMP24_FROZEN_ROLE_THRESHOLDS),
    /stored category invented_detail does not match independently derived source_contradiction/,
  );
});

test("IMP-24F certified proof exposes an evaluator observation omission instead of treating reachability as coverage", () => {
  const corpusBundle = build();
  const preparedCases = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle }).preparedCases;
  const observed = clone(collectImp24fEvaluatorObservationCaseIds({ corpusBundle, preparedCases })) as Imp24fObservedCaseIdsByRole;
  const omittedCaseId = observed.source.sourceContradictionSensitivity[0]!;
  observed.source.sourceContradictionSensitivity = observed.source.sourceContradictionSensitivity.slice(1);
  const proof = buildImp24fThresholdCoverageProof({
    corpusBundle,
    thresholds: IMP24_FROZEN_ROLE_THRESHOLDS,
    actualObservationCaseIdsByRole: observed,
  });

  assert.equal(proof.status, "FAIL");
  assert.deepEqual(metric(proof, "source", "sourceContradictionSensitivity").missingObservationCaseIds, [omittedCaseId]);
  assert.throws(
    () => assertImp24fThresholdCoverageProof(proof),
    /evaluator\/scorer omitted observations/,
  );
});
