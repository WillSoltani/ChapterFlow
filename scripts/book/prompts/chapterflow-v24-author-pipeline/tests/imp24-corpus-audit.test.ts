import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  applyMutationOps,
  assertProtectedContentUnchanged,
  hashValue,
} from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  IMP24_CORPUS_EXPECTED_COUNTS,
  IMP24_FROZEN_V2_INPUTS,
  IMP24_ROLE_QUALIFICATION_ID,
  Imp24CorpusError,
  auditImp24CorpusPassA,
  auditImp24CorpusPassB,
  auditImp24CorpusRetainedArtifactPassB,
  buildImp24CorpusProvenanceArtifact,
  buildImp24CorpusBundle,
  buildImp24RolePartitionArtifact,
  certifyImp24Corpora,
  imp24CorpusAuditArtifactIdentity,
  imp24CorpusPartitionArtifactIdentities,
  imp24CorpusProvenanceArtifactIdentity,
  loadImp24FrozenV2Inputs,
  serializeImp24CorpusAuditArtifact,
  serializeImp24CorpusBundle,
  serializeImp24CorpusProvenanceArtifact,
  serializeImp24RolePartitionArtifact,
  type Imp24CorpusBundle,
} from "../src/bakeoff/migration/imp24Corpus.js";

const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");

function build(): Imp24CorpusBundle {
  return buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rehashRelabeledSourceBundle(bundle: Imp24CorpusBundle, caseId: string): void {
  const item = bundle.source.holdout.cases.find((candidate) => candidate.caseId === caseId);
  assert.ok(item, caseId);
  const casePayload = deepClone(item) as unknown as Record<string, unknown>;
  delete casePayload.substantiveCaseSha256;
  item.substantiveCaseSha256 = hashValue(casePayload);

  const partitionPayload = deepClone(bundle.source.holdout) as unknown as Record<string, unknown>;
  delete partitionPayload.substantivePartitionSha256;
  bundle.source.holdout.substantivePartitionSha256 = hashValue(partitionPayload);

  const corpusPayload = deepClone(bundle.source) as unknown as Record<string, unknown>;
  delete corpusPayload.substantiveCorpusSha256;
  bundle.source.substantiveCorpusSha256 = hashValue(corpusPayload);

  const bundlePayload = deepClone(bundle) as unknown as Record<string, unknown>;
  delete bundlePayload.substantiveBundleSha256;
  bundle.substantiveBundleSha256 = hashValue(bundlePayload);
}

function rehashRolePartition(
  bundle: Imp24CorpusBundle,
  role: "reader" | "source" | "quiz",
  partitionName: "canary" | "holdout",
): void {
  const corpus = bundle[role] as unknown as {
    canary: { cases: Array<Record<string, unknown>>; substantivePartitionSha256: string };
    holdout: { cases: Array<Record<string, unknown>>; substantivePartitionSha256: string };
    substantiveCorpusSha256: string;
  };
  const partition = corpus[partitionName];
  for (const item of partition.cases) {
    const payload = deepClone(item);
    delete payload.substantiveCaseSha256;
    item.substantiveCaseSha256 = hashValue(payload);
  }
  const partitionPayload = deepClone(partition) as unknown as Record<string, unknown>;
  delete partitionPayload.substantivePartitionSha256;
  partition.substantivePartitionSha256 = hashValue(partitionPayload);

  const corpusPayload = deepClone(corpus) as Record<string, unknown>;
  delete corpusPayload.substantiveCorpusSha256;
  corpus.substantiveCorpusSha256 = hashValue(corpusPayload);

  const bundlePayload = deepClone(bundle) as unknown as Record<string, unknown>;
  delete bundlePayload.substantiveBundleSha256;
  bundle.substantiveBundleSha256 = hashValue(bundlePayload);
}

test("IMP-24 corpus audit derives exact separate canaries and frozen 30/40/40 holdouts", () => {
  const bundle = build();
  assert.equal(bundle.experimentId, IMP24_ROLE_QUALIFICATION_ID);
  for (const role of ["reader", "source", "quiz"] as const) {
    assert.equal(bundle[role].canary.cases.length, IMP24_CORPUS_EXPECTED_COUNTS[role].canary);
    assert.equal(bundle[role].holdout.cases.length, IMP24_CORPUS_EXPECTED_COUNTS[role].holdout);
    assert.ok(bundle[role].canary.cases.every((item) => item.partition === "canary"));
    assert.ok(bundle[role].holdout.cases.every((item) => item.partition === "holdout"));
    assert.ok(bundle[role].canary.cases.every((item) => item.imp24.canaryExcludedFromMetrics));
    assert.ok(bundle[role].holdout.cases.every((item) => !item.imp24.canaryExcludedFromMetrics));
    const canaryIds = new Set(bundle[role].canary.cases.map((item) => item.caseId));
    assert.ok(bundle[role].holdout.cases.every((item) => !canaryIds.has(item.caseId)), `${role} canary cannot enter holdout`);
  }
  assert.match(bundle.substantiveBundleSha256, /^sha256:[a-f0-9]{64}$/);
});

test("IMP-24 source redesign confines real facts to source-bound cases and uses one isolated family defect", () => {
  const bundle = build();
  const cases = bundle.source.holdout.cases;
  assert.equal(cases.length, 40);

  const constructed = cases.filter((item) => item.provenance.basisKind === "constructed-application");
  const generic = cases.filter((item) => item.provenance.basisKind === "generic-operational");
  const sourceBound = cases.filter((item) => item.provenance.basisKind === "source-bound-fact");
  assert.equal(constructed.length, 8);
  assert.equal(generic.length, 8);
  assert.equal(sourceBound.length, 24);

  for (const item of constructed) {
    assert.doesNotMatch(item.evidence.chapterUnit, /\b(?:2007|2019|2021|iPhone|Facebook|Northstar Systems)\b/i);
    const visiblyFramed = /\b(?:hypothetical|fictional|imagine|suppose)\b/i.test(item.evidence.chapterUnit);
    assert.equal(visiblyFramed, item.pairSide === "clean", item.caseId);
    if (item.pairSide === "defect") {
      assert.equal(item.expected.expectedPrimaryCategory, "missing_visible_framing");
      assert.deepEqual(item.imp24.controlledMutation?.declaredPaths, ["evidence.chapterUnit"]);
      assert.equal(item.imp24.controlledMutation?.operationCount, 1);
    }
  }

  const specificityKinds = new Set<string>();
  for (const item of generic) {
    assert.doesNotMatch(item.evidence.chapterUnit, /\b(?:2007|iPhone|Facebook)\b/i, "the invalid sourced generic basis is excluded");
    if (item.pairSide === "clean") {
      assert.doesNotMatch(item.evidence.chapterUnit, /\bNorthstar Systems\b|\b(?:19|20)\d{2}\b|[“”"]|\bexactly\s+\d+\b/i);
      assert.equal(item.expected.expectedNamedSpecificityAllowed, true);
    } else {
      assert.equal(item.expected.expectedPrimaryCategory, "generic_specificity_leak");
      assert.equal(item.imp24.controlledMutation?.operationCount, 1);
      assert.deepEqual(item.imp24.controlledMutation?.declaredPaths, ["evidence.chapterUnit"]);
      assert.ok(item.imp24.controlledMutation?.specificityKind);
      specificityKinds.add(item.imp24.controlledMutation!.specificityKind!);
    }
  }
  assert.deepEqual([...specificityKinds].sort(), ["date", "exact_metric", "named_organization", "quotation"]);

  const pairs = new Map<string, typeof cases>();
  for (const item of cases) {
    const pair = pairs.get(item.provenance.pairKey) ?? [];
    pair.push(item);
    pairs.set(item.provenance.pairKey, pair);
  }
  assert.equal(pairs.size, 20);
  for (const [pairKey, pair] of pairs) {
    assert.equal(pair.length, 2, pairKey);
    const clean = pair.find((item) => item.pairSide === "clean")!;
    const defect = pair.find((item) => item.pairSide === "defect")!;
    assert.notEqual(clean.evidence.chapterUnit, defect.evidence.chapterUnit);
    assert.equal(clean.mutation.protectedProjectionSha256, defect.mutation.protectedProjectionSha256);
    assert.deepEqual(defect.mutation.declaredMutationPaths, ["evidence.chapterUnit"]);
    if (defect.expected.expectedPrimaryCategory === "source_contradiction") {
      assert.deepEqual(defect.expected.expectedSecondaryCategories, ["unsupported_attribution"]);
    }
  }
});

test("IMP-24 reader and quiz audits preserve authority, deterministic identity, and exact controlled gold", () => {
  const bundle = build();
  for (const item of [...bundle.reader.canary.cases, ...bundle.reader.holdout.cases]) {
    assert.equal(item.sourceSemanticsStatus, "MISSING");
    assert.ok(!Object.keys(item.expected).some((key) => /sourceTruth|sourceContradiction|fabricat/i.test(key)));
    if (item.kind === "reader-visible-hard-blocker") {
      assert.equal(item.expected.expectedRecommendation, "BLOCK");
      assert.equal(item.imp24.controlledMutation?.operationCount, 1);
    }
    if (item.kind === "craft-nonblocker") {
      assert.equal(item.expected.expectedRecommendation, "REVISE");
      assert.equal(item.expected.prohibitBlockingFindings, true);
    }
  }

  for (const item of [...bundle.quiz.canary.cases, ...bundle.quiz.holdout.cases]) {
    const question = item.chapter.quiz.questions[0];
    assert.equal(item.chapter.quiz.questions.length, 1);
    const defensible = item.expected.defensibleAnswerIndices as number[];
    assert.ok(defensible.every((index) => index >= 0 && index < question.choices.length));
    if (item.kind === "uniquely-correct-clean") {
      assert.deepEqual(defensible, [question.correctIndex]);
      assert.equal(item.expected.goldResult, "PASS");
    }
    if (item.kind === "key-mismatch") {
      assert.notEqual(defensible[0], question.correctIndex);
      assert.equal(item.expected.goldResult, "BLOCK");
    }
    if (item.kind === "genuine-ambiguity") {
      assert.equal(defensible.length, 2);
      assert.equal(question.choices[defensible[0]], question.choices[defensible[1]]);
    }
  }
});

test("IMP-24 independent object and serialize/reparse audit passes agree and fail closed on drift", () => {
  const bundle = build();
  const passA = auditImp24CorpusPassA(bundle);
  const bytes = serializeImp24CorpusBundle(bundle);
  const passB = auditImp24CorpusPassB(bytes);
  assert.equal(passA.status, "PASS");
  assert.equal(passB.status, "PASS");
  assert.equal(passA.agreementProjectionSha256, passB.agreementProjectionSha256);
  assert.equal(certifyImp24Corpora(bundle).agreementSha256, passA.agreementProjectionSha256);
  assert.equal(serializeImp24CorpusBundle(build()), bytes, "identical frozen inputs must reproduce byte-for-byte");

  const tampered = deepClone(bundle);
  tampered.source.holdout.cases.find((item) => item.provenance.basisKind === "generic-operational" && item.pairSide === "clean")!
    .evidence.chapterUnit = "The 2007 iPhone launch is a clean generic case.";
  const failed = auditImp24CorpusPassA(tampered);
  assert.equal(failed.status, "FAIL");
  assert.ok(failed.issues.some((issue) => /former invalid sourced generic basis|prohibited specificity|hash drift/i.test(issue)));
});

test("IMP-24 pass A and pass B independently reject a rehashed source-bound relabel", () => {
  const relabeled = deepClone(build());
  const defect = relabeled.source.holdout.cases.find((item) =>
    item.provenance.basisKind === "source-bound-fact"
      && item.pairSide === "defect"
      && item.expected.expectedPrimaryCategory === "source_contradiction");
  assert.ok(defect, "expected a source-bound contradiction fixture");
  defect.expected.expectedCategory = "invented_detail";
  defect.expected.expectedPrimaryCategory = "invented_detail";
  defect.expected.expectedSecondaryCategories = [];
  rehashRelabeledSourceBundle(relabeled, defect.caseId);

  const passA = auditImp24CorpusPassA(relabeled);
  const passB = auditImp24CorpusPassB(serializeImp24CorpusBundle(relabeled));
  assert.equal(passA.status, "FAIL");
  assert.equal(passB.status, "FAIL");
  assert.ok(passA.issues.some((issue) => /pass A independently derived (?:category|primary category) source_contradiction/.test(issue)));
  assert.ok(passB.issues.some((issue) => /pass B independently derived (?:category|primary category) source_contradiction/.test(issue)));
  assert.ok(!passA.issues.some((issue) => /substantive case hash drift/.test(issue)), "pass A must reject semantics after case rehashing");
  assert.ok(!passB.issues.some((issue) => /substantive case hash drift/.test(issue)), "pass B must reject semantics after case rehashing");
});

test("IMP-24 reader audits independently reject self-rehashed unsafe dispatch, relabeling, and a second hard mutation", () => {
  const unsafeClean = deepClone(build());
  const clean = unsafeClean.reader.holdout.cases.find((item) => item.caseId.includes("clean-checklist-ch01"));
  assert.ok(clean, "expected clean checklist reader control");
  clean.chapter.tryThisNow = "Send the message now without review or confirmation.";
  const changedCleanSha = hashValue(clean.chapter);
  clean.provenance.baseContentSha256 = changedCleanSha;
  clean.provenance.variantContentSha256 = changedCleanSha;
  clean.provenance.protectedContentSha256 = changedCleanSha;
  rehashRolePartition(unsafeClean, "reader", "holdout");

  const unsafeA = auditImp24CorpusPassA(unsafeClean);
  const unsafeB = auditImp24CorpusPassB(serializeImp24CorpusBundle(unsafeClean));
  assert.equal(unsafeA.status, "FAIL");
  assert.equal(unsafeB.status, "FAIL");
  assert.ok(unsafeA.issues.some((issue) => /clean control contains deterministic blocker\(s\): unsafe/.test(issue)));
  assert.ok(unsafeB.issues.some((issue) => /clean control contains deterministic blocker\(s\): unsafe/.test(issue)));
  assert.ok(!unsafeA.issues.some((issue) => /substantive case hash drift/.test(issue)));
  assert.ok(!unsafeB.issues.some((issue) => /substantive case hash drift/.test(issue)));

  const relabeled = deepClone(build());
  const relabeledHard = relabeled.reader.holdout.cases.find((item) => item.caseId.includes("reader-visible-hard-blocker-checklist-ch01"));
  assert.ok(relabeledHard, "expected unsafe hard reader fixture");
  relabeledHard.expected.expectedRecommendation = "SHIP";
  relabeledHard.expected.expectedBlockingCategory = "internal_contradiction";
  rehashRolePartition(relabeled, "reader", "holdout");
  const relabelA = auditImp24CorpusPassA(relabeled);
  const relabelB = auditImp24CorpusPassB(serializeImp24CorpusBundle(relabeled));
  assert.equal(relabelA.status, "FAIL");
  assert.equal(relabelB.status, "FAIL");
  assert.ok(relabelA.issues.some((issue) => /pass A independently derived (?:BLOCK|blocker unsafe)/.test(issue)));
  assert.ok(relabelB.issues.some((issue) => /pass B independently derived (?:BLOCK|blocker unsafe)/.test(issue)));

  const doubled = deepClone(build());
  const doubledHard = doubled.reader.holdout.cases.find((item) => item.caseId.includes("reader-visible-hard-blocker-checklist-ch01"));
  const doubledBase = doubled.reader.holdout.cases.find((item) => item.caseId.includes("clean-checklist-ch01"));
  assert.ok(doubledHard && doubledBase, "expected reader hard/control pair");
  const secondOp = {
    path: "/keyTakeaway",
    op: "replace" as const,
    value: "The chapter's exact opposite rule is always correct.",
  };
  doubledHard.provenance.mutationOps.push(secondOp);
  doubledHard.chapter.keyTakeaway = secondOp.value;
  doubledHard.provenance.mutationOpsSha256 = hashValue(doubledHard.provenance.mutationOps);
  doubledHard.provenance.variantContentSha256 = hashValue(doubledHard.chapter);
  doubledHard.provenance.protectedContentSha256 = assertProtectedContentUnchanged(
    doubledBase.chapter,
    doubledHard.chapter,
    doubledHard.provenance.mutationOps,
    doubledHard.caseId,
  );
  assert.ok(doubledHard.imp24.controlledMutation);
  doubledHard.imp24.controlledMutation.operationCount = 2;
  doubledHard.imp24.controlledMutation.declaredPaths = doubledHard.provenance.mutationOps.map((op) => op.path);
  doubledHard.imp24.controlledMutation.protectedProjectionSha256 = doubledHard.provenance.protectedContentSha256;
  rehashRolePartition(doubled, "reader", "holdout");
  const doubledA = auditImp24CorpusPassA(doubled);
  const doubledB = auditImp24CorpusPassB(serializeImp24CorpusBundle(doubled));
  assert.equal(doubledA.status, "FAIL");
  assert.equal(doubledB.status, "FAIL");
  assert.ok(doubledA.issues.some((issue) => /does not contain exactly one controlled mutation/.test(issue)));
  assert.ok(doubledB.issues.some((issue) => /not exactly one controlled mutation/.test(issue)));
});

test("IMP-24 quiz audits independently reject self-rehashed proof-path and support-hash substitution", () => {
  const wrongPath = deepClone(build());
  const clean = wrongPath.quiz.holdout.cases.find((item) => item.kind === "uniquely-correct-clean");
  assert.ok(clean, "expected clean quiz fixture");
  const siblings = wrongPath.quiz.holdout.cases.filter((item) =>
    item.baseBookId === clean.baseBookId
      && item.baseChapter === clean.baseChapter
      && item.sourceQuestionIndex1 === clean.sourceQuestionIndex1);
  assert.equal(siblings.length, 4);
  for (const sibling of siblings) {
    const proof = sibling.cleanItemProof as typeof sibling.cleanItemProof & { evidencePath: string };
    proof.evidencePath = "/breakdown/fullRead";
    proof.evidenceSha256 = hashValue(clean.chapter.breakdown.fullRead);
  }
  rehashRolePartition(wrongPath, "quiz", "holdout");
  const pathA = auditImp24CorpusPassA(wrongPath);
  const pathB = auditImp24CorpusPassB(serializeImp24CorpusBundle(wrongPath));
  assert.equal(pathA.status, "FAIL");
  assert.equal(pathB.status, "FAIL");
  assert.ok(pathA.issues.some((issue) => /clean-item proof does not bind the exact key explanation path/.test(issue)));
  assert.ok(pathB.issues.some((issue) => /clean proof path is not the exact explanation path/.test(issue)));
  assert.ok(!pathA.issues.some((issue) => /substantive case hash drift/.test(issue)));
  assert.ok(!pathB.issues.some((issue) => /substantive case hash drift/.test(issue)));

  const staleSupport = deepClone(build());
  const mechanism = staleSupport.quiz.holdout.cases.find((item) => item.kind === "mechanism-causal-key");
  assert.ok(mechanism?.mechanismProof, "expected mechanism quiz fixture");
  mechanism.mechanismProof.supportTextSha256 = hashValue("A syntactically valid but stale support fragment.");
  rehashRolePartition(staleSupport, "quiz", "holdout");
  const supportA = auditImp24CorpusPassA(staleSupport);
  const supportB = auditImp24CorpusPassB(serializeImp24CorpusBundle(staleSupport));
  assert.equal(supportA.status, "FAIL");
  assert.equal(supportB.status, "FAIL");
  assert.ok(supportA.issues.some((issue) => /mechanism support hash does not match exact support fragment/.test(issue)));
  assert.ok(supportB.issues.some((issue) => /mechanism support hash differs from exact final paragraph/.test(issue)));
  assert.ok(!supportA.issues.some((issue) => /substantive case hash drift/.test(issue)));
  assert.ok(!supportB.issues.some((issue) => /substantive case hash drift/.test(issue)));
});

test("IMP-24 retained-artifact pass B reads canonical bundle and frozen V2 bytes from disk", () => {
  const directory = mkdtempSync(join(tmpdir(), "imp24-retained-corpus-"));
  const corpusBundlePath = join(directory, "corpus-bundle.json");
  try {
    const bytes = serializeImp24CorpusBundle(build());
    writeFileSync(corpusBundlePath, bytes, "utf8");
    const pass = auditImp24CorpusRetainedArtifactPassB({ corpusBundlePath, contractsDir: CONTRACTS_DIR });
    assert.equal(pass.status, "PASS", pass.issues.join("\n"));
    assert.equal(pass.artifactBytesSha256, sha256Hex(bytes));

    writeFileSync(corpusBundlePath, `${bytes} `, "utf8");
    const noncanonical = auditImp24CorpusRetainedArtifactPassB({ corpusBundlePath, contractsDir: CONTRACTS_DIR });
    assert.equal(noncanonical.status, "FAIL");
    assert.ok(noncanonical.issues.some((issue) => /not the exact canonical serialization/.test(issue)));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("IMP-24 audits recompute case, partition, role, bundle, and frozen-input hashes", () => {
  const tampered = deepClone(build());
  tampered.reader.holdout.cases[0].substantiveCaseSha256 = `sha256:${"1".repeat(64)}`;
  tampered.source.holdout.substantivePartitionSha256 = `sha256:${"2".repeat(64)}`;
  tampered.quiz.substantiveCorpusSha256 = `sha256:${"3".repeat(64)}`;
  tampered.substantiveBundleSha256 = `sha256:${"4".repeat(64)}`;
  tampered.source.sourceV2RawSha256 = "5".repeat(64);

  const passA = auditImp24CorpusPassA(tampered);
  const passB = auditImp24CorpusPassB(serializeImp24CorpusBundle(tampered));
  for (const pass of [passA, passB]) {
    assert.equal(pass.status, "FAIL");
    assert.ok(pass.issues.some((issue) => /substantive case hash drift/.test(issue)));
    assert.ok(pass.issues.some((issue) => /substantive partition hash drift/.test(issue)));
    assert.ok(pass.issues.some((issue) => /substantive (?:role corpus|role) hash drift/.test(issue)));
    assert.ok(pass.issues.some((issue) => /substantive bundle hash drift/.test(issue)));
    assert.ok(pass.issues.some((issue) => /(?:frozen V2 raw hash metadata|source raw hash) drift/.test(issue)));
  }
});

test("IMP-24 audits reject rehashed cross-partition membership", () => {
  const moved = deepClone(build());
  const item = moved.reader.holdout.cases[0];
  item.partition = "canary";
  item.imp24.canaryExcludedFromMetrics = true;
  rehashRolePartition(moved, "reader", "holdout");

  const passA = auditImp24CorpusPassA(moved);
  const passB = auditImp24CorpusPassB(serializeImp24CorpusBundle(moved));
  assert.equal(passA.status, "FAIL");
  assert.equal(passB.status, "FAIL");
  assert.ok(passA.issues.some((issue) => /item partition canary is not containing partition holdout/.test(issue)));
  assert.ok(passB.issues.some((issue) => /partition membership drift/.test(issue)));
  assert.ok(!passA.issues.some((issue) => /substantive case hash drift/.test(issue)));
  assert.ok(!passB.issues.some((issue) => /substantive case hash drift/.test(issue)));
});

test("IMP-24 reader audits include quiz prompt and choices in the instructional safety surface", () => {
  const unsafeQuizPrompt = deepClone(build());
  const clean = unsafeQuizPrompt.reader.holdout.cases.find((item) => item.caseId.includes("clean-checklist-ch01"));
  assert.ok(clean, "expected clean checklist reader control");
  clean.chapter.quiz.questions[0].prompt = "Send the message now without review or confirmation.";
  const changedSha256 = hashValue(clean.chapter);
  clean.provenance.baseContentSha256 = changedSha256;
  clean.provenance.variantContentSha256 = changedSha256;
  clean.provenance.protectedContentSha256 = changedSha256;
  rehashRolePartition(unsafeQuizPrompt, "reader", "holdout");

  const passA = auditImp24CorpusPassA(unsafeQuizPrompt);
  const passB = auditImp24CorpusPassB(serializeImp24CorpusBundle(unsafeQuizPrompt));
  assert.equal(passA.status, "FAIL");
  assert.equal(passB.status, "FAIL");
  assert.ok(passA.issues.some((issue) => /clean control contains deterministic blocker\(s\): unsafe/.test(issue)));
  assert.ok(passB.issues.some((issue) => /clean control contains deterministic blocker\(s\): unsafe/.test(issue)));
  assert.ok(!passA.issues.some((issue) => /substantive case hash drift/.test(issue)));
  assert.ok(!passB.issues.some((issue) => /substantive case hash drift/.test(issue)));
});

test("IMP-24 quiz audits reject a coherent self-rehashed contradictory explanation", () => {
  const contradictory = deepClone(build());
  const clean = contradictory.quiz.holdout.cases.find((item) =>
    item.kind === "uniquely-correct-clean"
      && item.baseBookId === "the-checklist-manifesto"
      && item.baseChapter === 1);
  assert.ok(clean, "expected clean checklist quiz control");
  const siblings = contradictory.quiz.holdout.cases.filter((item) =>
    item.baseBookId === clean.baseBookId
      && item.baseChapter === clean.baseChapter
      && item.sourceQuestionIndex1 === clean.sourceQuestionIndex1);
  assert.equal(siblings.length, 4);
  const explanation = "Choice A is the only defensible answer; choice B is incorrect.";
  const rewrittenBase = deepClone(clean.chapter);
  rewrittenBase.quiz.questions[0].explanation = explanation;
  const baseSha256 = hashValue(rewrittenBase);
  for (const sibling of siblings) {
    const rebuilt = deepClone(rewrittenBase);
    applyMutationOps(rebuilt, sibling.provenance.mutationOps);
    sibling.chapter = rebuilt;
    sibling.cleanItemProof.evidenceSha256 = hashValue(explanation);
    sibling.provenance.isolatedBaseContentSha256 = baseSha256;
    sibling.provenance.variantContentSha256 = hashValue(rebuilt);
    sibling.provenance.protectedContentSha256 = assertProtectedContentUnchanged(
      rewrittenBase,
      rebuilt,
      sibling.provenance.mutationOps,
      sibling.caseId,
    );
  }
  rehashRolePartition(contradictory, "quiz", "holdout");

  const passA = auditImp24CorpusPassA(contradictory);
  const passB = auditImp24CorpusPassB(serializeImp24CorpusBundle(contradictory));
  assert.equal(passA.status, "FAIL");
  assert.equal(passB.status, "FAIL");
  assert.ok(passA.issues.some((issue) => /clean explanation differs from independent semantic proof/.test(issue)));
  assert.ok(passB.issues.some((issue) => /lacks its independent semantic digest/.test(issue)));
  assert.ok(!passA.issues.some((issue) => /substantive case hash drift/.test(issue)));
  assert.ok(!passB.issues.some((issue) => /substantive case hash drift/.test(issue)));
});

test("IMP-24 source audits recompute protected projections after self-rehashing", () => {
  const tampered = deepClone(build());
  const clean = tampered.source.holdout.cases.find((item) =>
    item.provenance.basisKind === "generic-operational" && item.pairSide === "clean");
  assert.ok(clean, "expected clean generic source case");
  const pair = tampered.source.holdout.cases.filter((item) => item.provenance.pairKey === clean.provenance.pairKey);
  assert.equal(pair.length, 2);
  const bogus = `sha256:${"9".repeat(64)}`;
  for (const item of pair) item.mutation.protectedProjectionSha256 = bogus;
  const defect = pair.find((item) => item.pairSide === "defect");
  assert.ok(defect?.imp24.controlledMutation);
  defect.imp24.controlledMutation.protectedProjectionSha256 = bogus;
  rehashRolePartition(tampered, "source", "holdout");

  const passA = auditImp24CorpusPassA(tampered);
  const passB = auditImp24CorpusPassB(serializeImp24CorpusBundle(tampered));
  assert.equal(passA.status, "FAIL");
  assert.equal(passB.status, "FAIL");
  assert.ok(passA.issues.some((issue) => /stored source mutation protection hash is not the recomputed projection/.test(issue)));
  assert.ok(passB.issues.some((issue) => /stored source mutation protection hash drift/.test(issue)));
  assert.ok(!passA.issues.some((issue) => /substantive case hash drift/.test(issue)));
  assert.ok(!passB.issues.some((issue) => /substantive case hash drift/.test(issue)));
});

test("IMP-24 exposes deterministic identities for six corpus artifacts, provenance, and both audits", () => {
  const bundle = build();
  const identities = imp24CorpusPartitionArtifactIdentities(bundle);
  assert.equal(identities.length, 6);
  assert.equal(new Set(identities.map((identity) => identity.fileName)).size, 6);
  assert.equal(new Set(identities.map((identity) => identity.bytesSha256)).size, 6);
  const expectedCounts: Record<string, number> = {
    "reader:canary": 2,
    "reader:holdout": 30,
    "source:canary": 2,
    "source:holdout": 40,
    "quiz:canary": 2,
    "quiz:holdout": 40,
  };
  for (const identity of identities) {
    const artifact = buildImp24RolePartitionArtifact(bundle, identity.role, identity.partition);
    const bytes = serializeImp24RolePartitionArtifact(bundle, identity.role, identity.partition);
    const core = deepClone(artifact) as unknown as Record<string, unknown>;
    delete core.artifactSha256;
    assert.equal(identity.caseCount, expectedCounts[`${identity.role}:${identity.partition}`]);
    assert.equal(identity.artifactSha256, hashValue(core));
    assert.equal(identity.bytesSha256, sha256Hex(bytes));
    assert.equal(artifact.retainedPartition.partition, identity.partition);
  }

  const provenance = buildImp24CorpusProvenanceArtifact(bundle);
  const provenanceBytes = serializeImp24CorpusProvenanceArtifact(bundle);
  const provenanceIdentity = imp24CorpusProvenanceArtifactIdentity(bundle);
  const provenanceCore = deepClone(provenance) as unknown as Record<string, unknown>;
  delete provenanceCore.provenanceSha256;
  assert.equal(provenance.provenanceSha256, hashValue(provenanceCore));
  assert.deepEqual(provenance.partitionArtifacts, identities);
  assert.equal(provenanceIdentity.artifactSha256, provenance.provenanceSha256);
  assert.equal(provenanceIdentity.bytesSha256, sha256Hex(provenanceBytes));

  const passA = auditImp24CorpusPassA(bundle);
  const passB = auditImp24CorpusPassB(serializeImp24CorpusBundle(bundle));
  const auditIdentities = [passA, passB].map(imp24CorpusAuditArtifactIdentity);
  assert.deepEqual(auditIdentities.map((identity) => identity.fileName), [
    "corpus-audit-pass-a.json",
    "corpus-audit-pass-b.json",
  ]);
  for (const [index, pass] of [passA, passB].entries()) {
    assert.equal(auditIdentities[index].artifactSha256, hashValue(pass));
    assert.equal(auditIdentities[index].bytesSha256, sha256Hex(serializeImp24CorpusAuditArtifact(pass)));
    assert.equal(auditIdentities[index].agreementProjectionSha256, pass.agreementProjectionSha256);
  }
});

test("IMP-24 builder accepts only byte-exact frozen V2 corpora", () => {
  const inputs = loadImp24FrozenV2Inputs(CONTRACTS_DIR);
  assert.equal(inputs.reader.fileName, IMP24_FROZEN_V2_INPUTS.reader.fileName);
  inputs.reader.bytes = Buffer.from(inputs.reader.bytes);
  inputs.reader.bytes[10] ^= 1;
  assert.throws(
    () => buildImp24CorpusBundle(inputs),
    (error: unknown) => error instanceof Imp24CorpusError && /bytes drifted/.test(error.message),
  );
});
