/**
 * IMP-22 Phase 2 — additive reader/quiz corpus readiness.
 *
 * These tests exercise only the no-model, pure corpus builders. They pin the
 * separate calibration/holdout inventories, controlled mutation proofs,
 * candidate and known-defect exclusions, exact composition, and byte/hash
 * reproducibility without changing the preserved IMP-20 fixtures.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test, xenv } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  CorpusBuildError,
  IMP22_RESERVED_CANDIDATE_BOOK_IDS,
  hashValue,
} from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  buildReaderCorpusV2,
  type ReaderCorpusSpecV2,
} from "../src/bakeoff/migration/readerCorpusBuilder.js";
import {
  buildQuizCorpusV2,
  type QuizCorpusSpecV2,
} from "../src/bakeoff/migration/quizCorpusBuilder.js";
import { admitChapter } from "../src/bakeoff/migration/nativeReviewQualification.js";
import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";
import type { SplitLaneCorpusConfigV1 } from "../src/bakeoff/migration/reviewLaneTypes.js";

const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const BOOK_PACKAGES_DIR = resolve(PIPELINE_DIR, "..", "..", "..", "..", "book-packages");
const LEDGER_PATH = resolve(CONTRACTS_DIR, "clean-base-score-ledger.v1.json");
const READER_SPEC_PATH = resolve(CONTRACTS_DIR, "reader-corpus-spec.imp22-v2.json");
const QUIZ_SPEC_PATH = resolve(CONTRACTS_DIR, "quiz-corpus-spec.imp22-v2.json");
const FROZEN_CANDIDATES = [...IMP22_RESERVED_CANDIDATE_BOOK_IDS];

function config(role: "reader" | "quiz", mutationSpecPath: string, extraExclusions: string[] = []): SplitLaneCorpusConfigV1 {
  return {
    schema: "split-lane-corpus-builder-config-v1",
    role,
    sourceRoots: { bookPackagesDir: BOOK_PACKAGES_DIR },
    mutationSpecPath,
    cleanBaseScoreLedgerPath: LEDGER_PATH,
    excludedCandidateBookIds: [...FROZEN_CANDIDATES, ...extraExclusions],
    minRenderBytes: 8000,
  };
}

function inputsPresent(): boolean {
  return [
    LEDGER_PATH,
    READER_SPEC_PATH,
    QUIZ_SPEC_PATH,
    ...[
      "the-willpower-instinct",
      "the-checklist-manifesto",
      "behave",
      "make-it-stick",
      "difficult-conversations",
      "the-power-of-moments",
      "decisive",
      "peak",
    ].map((bookId) => resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`)),
  ].every(existsSync);
}

function tempSpec(name: string, value: unknown): string {
  const dir = mkdtempSync(resolve(tmpdir(), "cf-imp22-corpus-"));
  const path = resolve(dir, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

xenv(
  "IMP-22 reader v2 materializes 10/10/10 holdout plus 2/2/2 calibration with schema-valid controlled cases",
  "requires the committed IMP-22 specs, score ledger, and eight real book packages",
  inputsPresent,
  () => {
    const result = buildReaderCorpusV2(config("reader", READER_SPEC_PATH));
    assert.deepEqual(result.corpus.partitions.holdout.generatedComposition, {
      clean: 10,
      "reader-visible-hard-blocker": 10,
      "craft-nonblocker": 10,
      total: 30,
    });
    assert.deepEqual(result.corpus.partitions.calibration.generatedComposition, {
      clean: 2,
      "reader-visible-hard-blocker": 2,
      "craft-nonblocker": 2,
      total: 6,
    });
    assert.deepEqual(result.corpus.partitions.holdout.generatedComposition, result.corpus.partitions.holdout.expectedComposition);
    assert.deepEqual(result.corpus.partitions.calibration.generatedComposition, result.corpus.partitions.calibration.expectedComposition);
    assert.equal(result.corpus.partitions.holdout.cases.length, 30);
    assert.equal(result.corpus.partitions.calibration.cases.length, 6);
    assert.deepEqual(result.corpus.excludedCandidateBookIds, [...FROZEN_CANDIDATES].sort());
    assert.ok(!new Set<string>(result.corpus.excludedCandidateBookIds).has("digital-minimalism"), "obsolete candidate must not enter the frozen set");
    assert.equal(result.corpus.ownerApprovedForDevelopmentBakeoff, true);
    assert.equal(result.corpus.independentHumanRater, false);

    const calibrationCoordinates = new Set(result.corpus.partitions.calibration.cases.map((c) => `${c.baseBookId}#${c.baseChapter}`));
    const holdoutCoordinates = new Set(result.corpus.partitions.holdout.cases.map((c) => `${c.baseBookId}#${c.baseChapter}`));
    for (const coordinate of calibrationCoordinates) assert.ok(!holdoutCoordinates.has(coordinate), `${coordinate} cannot cross calibration/holdout`);

    const forbiddenReaderChapters = new Set(["the-power-of-moments#1", "peak#1", "decisive#1"]);
    for (const c of [...result.corpus.partitions.calibration.cases, ...result.corpus.partitions.holdout.cases]) {
      assert.ok(!forbiddenReaderChapters.has(`${c.baseBookId}#${c.baseChapter}`), `${c.caseId} must not use a chapter with a known quiz defect`);
      assert.equal(c.sourceSemanticsStatus, "MISSING", "reader gold does not infer hidden source semantics");
      assert.equal(c.curation.labelProvenance, "curator-authored-development-fixture");
      assert.equal(c.curation.independentHumanRater, false);
      assert.equal(c.baseCleanControlAudit.independentHumanRater, false);
      assert.deepEqual(c.baseCleanControlAudit.knownDefects, []);
      assert.match(c.provenance.baseContentSha256, /^sha256:/);
      assert.match(c.provenance.variantContentSha256, /^sha256:/);
      assert.match(c.provenance.protectedContentSha256, /^sha256:/);
      const admission = admitChapter(c.chapter);
      assert.equal(admission.schemaOk, true, `${c.caseId} must remain ChapterV21-schema-valid`);
      assert.equal(admission.renderOk, true, `${c.caseId} must remain renderable`);
      assert.equal(admission.complete, true, `${c.caseId} must remain a complete reader chapter`);
      if (c.kind === "clean") {
        if (c.calibrationCorrection) {
          assert.equal(c.partition, "calibration");
          assert.equal(c.calibrationCorrection.invalidatedExperimentId, "s16-forward-role-qualification-v1");
          assert.equal(c.calibrationCorrection.correctedExperimentId, "s16-forward-role-qualification-v2");
          assert.equal(c.calibrationCorrection.correctionOrdinal, 1);
          assert.ok(c.provenance.mutationOps.length > 0);
          assert.notEqual(c.provenance.variantContentSha256, c.provenance.baseContentSha256);
        } else {
          assert.deepEqual(c.provenance.mutationOps, []);
          assert.equal(c.provenance.variantContentSha256, c.provenance.baseContentSha256);
        }
      } else {
        assert.ok(c.provenance.mutationOps.length > 0, `${c.caseId} requires explicit controlled mutation ops`);
        assert.notEqual(c.provenance.variantContentSha256, c.provenance.baseContentSha256);
      }
    }

    const repairedCoordinate = result.corpus.partitions.calibration.cases
      .filter((c) => c.baseBookId === "behave" && c.baseChapter === 2);
    assert.equal(repairedCoordinate.length, 3, "the same Behave calibration coordinate remains in all three families");
    for (const c of repairedCoordinate) {
      assert.equal(
        c.chapter.tryThisNow,
        "Before your next tense exchange, take a two-minute walk. Return to the unsent draft, name the cue and brake, then choose the first sentence before you touch Send.",
      );
      assert.ok(!c.chapter.tryThisNow.includes("Return, touch Send"), "the invalidated dispatch-risk phrase cannot survive the corrected experiment");
      assert.equal(c.calibrationCorrection?.defectId, "reader-clean-control-send-activation-risk");
    }
    assert.ok(result.corpus.partitions.holdout.cases.every((c) => c.calibrationCorrection === undefined), "the calibration repair must not alter holdout");
  },
);

xenv(
  "IMP-22 quiz v2 materializes 40 holdout plus 8 calibration single-question items with deterministic proof fields",
  "requires the committed IMP-22 specs, score ledger, and eight real book packages",
  inputsPresent,
  () => {
    const result = buildQuizCorpusV2(config("quiz", QUIZ_SPEC_PATH));
    assert.deepEqual(result.corpus.partitions.holdout.generatedComposition, {
      "uniquely-correct-clean": 10,
      "key-mismatch": 10,
      "genuine-ambiguity": 10,
      "mechanism-causal-key": 10,
      total: 40,
    });
    assert.deepEqual(result.corpus.partitions.calibration.generatedComposition, {
      "uniquely-correct-clean": 2,
      "key-mismatch": 2,
      "genuine-ambiguity": 2,
      "mechanism-causal-key": 2,
      total: 8,
    });
    assert.deepEqual(result.corpus.partitions.holdout.generatedComposition, result.corpus.partitions.holdout.expectedComposition);
    assert.deepEqual(result.corpus.partitions.calibration.generatedComposition, result.corpus.partitions.calibration.expectedComposition);
    assert.equal(result.corpus.partitions.holdout.cases.length, 40);
    assert.equal(result.corpus.partitions.calibration.cases.length, 8);
    assert.deepEqual(result.corpus.excludedCandidateBookIds, [...FROZEN_CANDIDATES].sort());

    const badItems = new Set(["the-power-of-moments#1#3", "peak#1#1", "peak#1#6", "decisive#1#4"]);
    const allCases = [...result.corpus.partitions.calibration.cases, ...result.corpus.partitions.holdout.cases];
    const cleanCoordinates = new Set<string>();
    for (const c of allCases) {
      assert.equal(c.chapter.quiz.questions.length, 1, `${c.caseId} must be one isolated question`);
      assert.equal(c.questionIndex1, 1);
      assert.equal(c.sourceSemanticsStatus, "MISSING");
      assert.equal(c.requiresPhase2, true);
      assert.equal(c.curation.independentHumanRater, false);
      assert.equal(c.cleanItemProof.independentHumanRater, false);
      assert.equal(c.cleanItemProof.keyedAnswerIndex, c.cleanItemProof.defensibleAnswerIndices[0]);
      assert.match(c.cleanItemProof.evidenceSha256, /^sha256:/);
      assert.ok(!badItems.has(`${c.baseBookId}#${c.baseChapter}#${c.sourceQuestionIndex1}`), `${c.caseId} must not derive from a known defective item`);
      const admission = admitChapter(c.chapter);
      assert.equal(admission.schemaOk, true, `${c.caseId} must stay ChapterV21-schema-valid`);
      assert.equal(admission.renderOk, true, `${c.caseId} must render`);
      assert.deepEqual(admission.completenessProblems, ["quiz has 1 questions (<4)"], "single-question isolation is the only intentional completeness exception");

      if (c.kind === "uniquely-correct-clean") {
        cleanCoordinates.add(`${c.partition}#${c.baseBookId}#${c.baseChapter}#${c.sourceQuestionIndex1}`);
        assert.equal(c.chapter.quiz.questions[0].correctIndex, c.cleanItemProof.keyedAnswerIndex);
        assert.equal(c.expected.keyCorrect, "correct");
        assert.equal(c.expected.keyedMechanismSupported, true);
      } else if (c.kind === "key-mismatch") {
        assert.equal(c.expected.keyCorrect, "wrong");
        assert.equal(c.expected.uniqueAnswer, true);
        assert.notEqual(c.expected.originalCorrectIndex, c.expected.mutatedCorrectIndex, "key mismatch must actually rotate the key");
      } else if (c.kind === "genuine-ambiguity") {
        assert.equal(c.expected.keyCorrect, "ambiguous");
        assert.equal(c.expected.uniqueAnswer, false);
        const proof = c.adversarialAmbiguityProof;
        assert.ok(proof, "ambiguity item must carry deterministic adversarial proof");
        assert.equal(proof.singleBestAnswerAttempt, "FAILED_TWO_TEXT_IDENTICAL_DEFENSIBLE_CHOICES");
        const [a, b] = proof.defensibleAnswerIndices;
        assert.equal(c.chapter.quiz.questions[0].choices[a], c.chapter.quiz.questions[0].choices[b], "two defensible choices are byte-identical");
        assert.equal(proof.independentHumanRater, false);
      } else {
        assert.ok(c.mechanismProof, "mechanism item must carry explicit support proof");
        assert.equal(c.mechanismProof.supportPath, "/breakdown/fullRead");
        assert.match(c.mechanismProof.supportTextSha256, /^sha256:/);
        assert.equal(c.mechanismProof.keyedMechanismSupported, c.expected.keyedMechanismSupported);
        assert.equal(c.expected.keyCorrect, c.mechanismProof.mode === "supported" ? "correct" : "wrong");
        assert.equal(c.chapter.quiz.questions[0].prompt, "Which mechanism is supported by the IMP-22 fixture evidence?");
        if (c.mechanismProof.mode === "causal-overreach") {
          assert.equal(c.chapter.quiz.questions[0].correctIndex, 0, "causal-overreach fixture intentionally keys the unsupported guarantee");
          assert.deepEqual(c.mechanismProof.defensibleAnswerIndices, [1], "the bounded mechanism remains the unique defensible answer");
        } else {
          assert.equal(c.chapter.quiz.questions[0].correctIndex, 0);
          assert.deepEqual(c.mechanismProof.defensibleAnswerIndices, [0]);
        }
      }
    }
    assert.equal(cleanCoordinates.size, 12, "each base coordinate contributes exactly one clean item");
    const holdoutMechanisms = result.corpus.partitions.holdout.cases.filter((c) => c.kind === "mechanism-causal-key");
    assert.equal(holdoutMechanisms.filter((c) => c.mechanismProof?.mode === "supported").length, 5);
    assert.equal(holdoutMechanisms.filter((c) => c.mechanismProof?.mode === "causal-overreach").length, 5);
    const calibrationMechanisms = result.corpus.partitions.calibration.cases.filter((c) => c.kind === "mechanism-causal-key");
    assert.equal(calibrationMechanisms.filter((c) => c.mechanismProof?.mode === "supported").length, 1);
    assert.equal(calibrationMechanisms.filter((c) => c.mechanismProof?.mode === "causal-overreach").length, 1);
  },
);

xenv(
  "IMP-22 reader/quiz outputs are byte-reproducible and every case/partition/corpus substantive hash verifies",
  "requires the committed IMP-22 specs, score ledger, and eight real book packages",
  inputsPresent,
  () => {
    const readerA = buildReaderCorpusV2(config("reader", READER_SPEC_PATH));
    const readerB = buildReaderCorpusV2(config("reader", READER_SPEC_PATH));
    const quizA = buildQuizCorpusV2(config("quiz", QUIZ_SPEC_PATH));
    const quizB = buildQuizCorpusV2(config("quiz", QUIZ_SPEC_PATH));
    assert.equal(readerA.corpusBytes, readerB.corpusBytes);
    assert.deepEqual(readerA.provenanceManifest, readerB.provenanceManifest);
    assert.equal(quizA.corpusBytes, quizB.corpusBytes);
    assert.deepEqual(quizA.provenanceManifest, quizB.provenanceManifest);

    for (const result of [readerA, quizA]) {
      assert.equal(result.provenanceManifest.corpusBytesSha256, `sha256:${sha256Hex(result.corpusBytes)}`);
      const { substantiveCorpusSha256, ...corpusPayload } = result.corpus;
      assert.equal(substantiveCorpusSha256, hashValue(corpusPayload), "corpus substantive hash verifies");
      for (const partition of ["calibration", "holdout"] as const) {
        const { substantivePartitionSha256, ...partitionPayload } = result.corpus.partitions[partition];
        assert.equal(substantivePartitionSha256, hashValue(partitionPayload), `${partition} substantive hash verifies`);
        for (const c of partitionPayload.cases) {
          const { substantiveCaseSha256, ...casePayload } = c;
          assert.equal(substantiveCaseSha256, hashValue(casePayload), `${casePayload.caseId} substantive hash verifies`);
          assert.equal(result.provenanceManifest.caseSha256[casePayload.caseId], substantiveCaseSha256);
        }
      }
    }
  },
);

xenv(
  "IMP-22 v2 builders fail closed on exact-composition drift, candidate drift, and known-defect reuse",
  "requires the committed IMP-22 specs, score ledger, and eight real book packages",
  inputsPresent,
  () => {
    const readerSpec = JSON.parse(readFileSync(READER_SPEC_PATH, "utf8")) as ReaderCorpusSpecV2;
    readerSpec.expectedCompositionByPartition.holdout.clean = 9;
    const badCompositionPath = tempSpec("reader-bad-composition.json", readerSpec);
    assert.throws(
      () => buildReaderCorpusV2(config("reader", badCompositionPath)),
      (error: unknown) => error instanceof CorpusBuildError && /composition must match exactly/i.test(error.message),
      "extra output is as invalid as a silent shrink",
    );

    const readerCandidateSpec = JSON.parse(readFileSync(READER_SPEC_PATH, "utf8")) as ReaderCorpusSpecV2;
    readerCandidateSpec.baseCases[0].baseBookId = "start-with-why";
    const candidatePath = tempSpec("reader-candidate-overlap.json", readerCandidateSpec);
    assert.throws(
      () => buildReaderCorpusV2(config("reader", candidatePath)),
      (error: unknown) => error instanceof CorpusBuildError && /overlaps reserved candidate book/i.test(error.message),
    );

    assert.throws(
      () => buildQuizCorpusV2(config("quiz", QUIZ_SPEC_PATH, ["digital-minimalism"])),
      (error: unknown) => error instanceof CorpusBuildError && /candidate exclusions must match/i.test(error.message),
      "the frozen candidate set cannot silently gain an obsolete fourth book",
    );

    const quizDefectSpec = JSON.parse(readFileSync(QUIZ_SPEC_PATH, "utf8")) as QuizCorpusSpecV2;
    quizDefectSpec.baseItems[0].baseBookId = "the-power-of-moments";
    quizDefectSpec.baseItems[0].baseChapter = 1;
    quizDefectSpec.baseItems[0].targetQuestionIndex1 = 3;
    const defectPath = tempSpec("quiz-known-defect.json", quizDefectSpec);
    assert.throws(
      () => buildQuizCorpusV2(config("quiz", defectPath)),
      (error: unknown) => error instanceof CorpusBuildError && /known defective item/i.test(error.message),
    );
  },
);

xenv(
  "IMP-22 CLI selects the additive reader/quiz v2 specs and remains dry by default",
  "requires the committed IMP-22 specs, score ledger, and eight real book packages",
  inputsPresent,
  async () => {
    for (const role of ["reader", "quiz"] as const) {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const originalLog = console.log;
      const originalError = console.error;
      console.log = (...args: unknown[]) => { stdout.push(args.map(String).join(" ")); };
      console.error = (...args: unknown[]) => { stderr.push(args.map(String).join(" ")); };
      let code: number;
      try {
        code = await runMigrationBakeoffCli([`build-${role}-corpus-v2`], { json: true });
      } finally {
        console.log = originalLog;
        console.error = originalError;
      }
      assert.equal(code!, 0, stderr.join("\n"));
      assert.equal(stderr.length, 0);
      assert.equal(stdout.length, 1);
      const output = JSON.parse(stdout[0]) as {
        role: string;
        version: number;
        built: boolean;
        written: boolean;
        corpusPath: string | null;
        provenancePath: string | null;
      };
      assert.equal(output.role, role);
      assert.equal(output.version, 2);
      assert.equal(output.built, true);
      assert.equal(output.written, false);
      assert.equal(output.corpusPath, null);
      assert.equal(output.provenancePath, null);
    }
  },
);

test("IMP-22 v2 contract files remain additive and do not overwrite the preserved IMP-20 specs", () => {
  assert.ok(existsSync(resolve(CONTRACTS_DIR, "reader-corpus-spec.json")));
  assert.ok(existsSync(resolve(CONTRACTS_DIR, "quiz-corpus-spec.json")));
  assert.ok(existsSync(READER_SPEC_PATH));
  assert.ok(existsSync(QUIZ_SPEC_PATH));
  assert.notEqual(READER_SPEC_PATH, resolve(CONTRACTS_DIR, "reader-corpus-spec.json"));
  assert.notEqual(QUIZ_SPEC_PATH, resolve(CONTRACTS_DIR, "quiz-corpus-spec.json"));
});
