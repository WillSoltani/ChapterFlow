import assert from "node:assert/strict";

import { CandidateQcEvaluator } from "../../src/app/candidateQcEvaluator.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { compileSourcePacketFromSidecar } from "../../src/compiler/sourcePacket.js";
import { compileSourceUsePlan } from "../../src/compiler/sourceUsePlanCompiler.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import type { CanonicalReviewResult } from "../../src/review/reviewTypes.js";
import type { SourceSidecarV2 } from "../../src/source/sidecarSchema.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "candidate-qc-book";
const CANDIDATE = "candidate-qc-1";
const DIGEST = "candidate-qc-digest";
const CREATED = "2026-07-21T12:00:00.000Z";

function jsonFile(logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

function sidecar(): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, index) => ({
    id: `ch01.fact.${index + 1}`,
    claim: `Candidate fact ${index + 1} describes a visible behavior change.`,
    becauseMechanism: `Candidate mechanism ${index + 1} connects action and consequence.`,
    commonError: `Candidate error ${index + 1} mistakes intention for action.`,
    errorIsWhy: `Candidate correction ${index + 1} follows observed behavior.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Candidate Chapter",
    centralConcept: { id: "ch01.concept.candidate", name: "Candidate concept", plainDefinition: "One bounded concept." },
    keyClaims: facts.map((fact) => fact.claim),
    namedExamples: [
      { id: "ch01.case.northstar", label: "Northstar intake review", summary: "Northstar changes one observable intake step.", hardSpecifics: ["Ch. 1 p. 1", "Ch. 1 p. 2"], realWorld: false },
      { id: "ch01.case.harbor", label: "Harbor handoff review", summary: "Harbor tests a second observable handoff step.", hardSpecifics: ["Ch. 1 p. 3", "Ch. 1 p. 4"], realWorld: false },
      { id: "ch01.case.atlas", label: "Atlas record review", summary: "Atlas tests one visible record correction.", hardSpecifics: ["Ch. 1 p. 5", "Ch. 1 p. 6"], realWorld: false },
    ],
    hardEdge: "Do not promise guaranteed outcomes.",
    testableFacts: facts,
  };
}

function bindSourceAnchors(chapter: ReturnType<typeof makeGateCleanChapter>): void {
  const anchor = "ch01.case.northstar";
  const paths = [
    "hook", "counterintuition", "breakdown.fastRead", "breakdown.deepRead", "breakdown.fullRead", "keyTakeaway", "tryThisNow",
    ...chapter.examples.map((_, index) => `examples[${index}]`),
    ...chapter.quiz.questions.map((_, index) => `quiz.questions[${index}]`),
    ...chapter.reviewCards.map((_, index) => `reviewCards[${index}]`),
    "implementationPlan.title", "implementationPlan.coreSkill", "implementationPlan.twentyFourHourChallenge", "implementationPlan.weeklyPractice",
    ...chapter.implementationPlan.ifThenPlans.map((_, index) => `implementationPlan.ifThenPlans[${index}]`),
    ...(chapter.memorableLines ?? []).map((_, index) => `memorableLines[${index}]`),
  ];
  chapter.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "candidate-source-hash",
      observedAnchorIds: [anchor],
      effectiveAnchors: Object.fromEntries(paths.map((path) => [path, [anchor]])),
    },
  };
}

function buildCandidate(context: TestContext, mutate: (files: CandidateInputFile[]) => CandidateInputFile[] = (files) => files): CandidateSnapshot {
  const chapter = JSON.parse(
    JSON.stringify(makeGateCleanChapter(BOOK, 1)).replace(/the book/gi, "the source"),
  ) as ReturnType<typeof makeGateCleanChapter>;
  bindSourceAnchors(chapter);
  const spec = { chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: "Candidate Chapter" };
  const sourcePath = "inputs/source/ch01.source.json";
  const packetPath = "compiler/ch01/source-packet.json";
  const packet = compileSourcePacketFromSidecar({ bookId: BOOK, chapter: spec, sidecar: sidecar(), sidecarPath: sourcePath, sourceHash: "source-hash" });
  const blueprint = compileChapterBlueprint({
    bookId: BOOK,
    chapter: spec,
    packet,
    packetPath,
    totalChapters: 1,
    roots: { stateRoot: context.roots.stateRoot },
    salts: { chapters: {} },
  });
  const plan = compileSourceUsePlan(packet).plan;
  const files = mutate([
    jsonFile("content/chapters/candidate-qc-book-ch01.v21-native.chapter.json", chapter, "CHAPTER"),
    jsonFile(sourcePath, sidecar()),
    jsonFile(packetPath, packet),
    jsonFile("compiler/ch01/blueprint.json", blueprint),
    jsonFile("compiler/ch01/source-use-plan.json", plan),
    jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({ bookId: BOOK, chapters: [chapter], requirePlanArtifacts: false, checkSourceAlignment: false })),
    jsonFile("compiler/private-task-context.json", { ambient: "must-not-enter-qc" }),
  ]);
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: CANDIDATE,
      createdByRunId: "run-candidate-qc",
      entries: files.map(({ bytes, ...entry }) => ({ ...entry, byteLength: bytes.byteLength })),
      manifestDigest: DIGEST,
      createdAt: CREATED,
    },
    files: files.map((file) => ({ ...file, byteLength: file.bytes.byteLength })),
  };
}

function review(outcome: CanonicalReviewResult["outcome"] = "PASS"): CanonicalReviewResult {
  return {
    schemaVersion: "1",
    reviewId: "review-candidate-qc",
    candidate: { candidateId: CANDIDATE, manifestDigest: DIGEST },
    outcome,
    issues: [],
    completedAt: CREATED,
  };
}

requiredTest("candidate QC reads explicit immutable candidate and computes outcome", async (context) => {
  const candidate = buildCandidate(context);
  const selectors: string[] = [];
  const evaluator = new CandidateQcEvaluator({
    async open(input) {
      selectors.push(input.selector.kind);
      return { ok: true, value: candidate };
    },
  });
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-candidate-qc" });
  assert.ok(evaluated.ok);
  assert.deepEqual(evaluated.value.candidate, { candidateId: CANDIDATE, manifestDigest: DIGEST });
  assert.equal(evaluated.value.reviewId, "review-candidate-qc");
  assert.equal(evaluated.value.outcome, "PASS", JSON.stringify(evaluated.value.issues.filter((entry) => entry.severity === "BLOCKER"), null, 2));
  assert.deepEqual(new Set(selectors), new Set(["CANDIDATE"]));
  assert.equal(evaluated.value.issues.some((entry) => entry.message.includes("must-not-enter-qc")), false);
});

requiredTest("candidate QC maps malformed blueprint source-v2 and source-plan inputs to blockers", async (context) => {
  const cases = [
    {
      code: "CANDIDATE_QC_BLUEPRINT_INVALID",
      candidate: buildCandidate(context, (files) => files.map((file) => file.logicalPath === "compiler/ch01/blueprint.json" ? jsonFile(file.logicalPath, { schemaVersion: "chapter-blueprint-v1" }) : file)),
    },
    {
      code: "SV2.named_examples_floor",
      candidate: buildCandidate(context, (files) => files.map((file) => file.logicalPath === "inputs/source/ch01.source.json" ? jsonFile(file.logicalPath, { ...sidecar(), namedExamples: [] }) : file)),
    },
    {
      code: "SOURCE_USE_PLAN_INVALID",
      candidate: buildCandidate(context, (files) => files.map((file) => file.logicalPath === "compiler/ch01/source-use-plan.json" ? jsonFile(file.logicalPath, { schema: "source-use-plan-v1", units: "invalid" }) : file)),
    },
  ];
  for (const { candidate, code } of cases) {
    const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } });
    const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-invalid-input" });
    assert.ok(evaluated.ok);
    assert.equal(evaluated.value.outcome, "FAIL");
    assert.ok(evaluated.value.issues.some((entry) => entry.severity === "BLOCKER" && entry.code === code), JSON.stringify(evaluated.value.issues, null, 2));
  }
});

requiredTest("candidate QC refuses caller authority without exact canonical PASS", async (context) => {
  const candidate = buildCandidate(context);
  let opens = 0;
  const evaluator = new CandidateQcEvaluator({ async open() { opens += 1; return { ok: true, value: candidate }; } });
  const evaluated = await evaluator.run({ candidate, canonicalReview: review("FAIL"), roundId: "round-no-pass" });
  assert.equal(evaluated.ok, false);
  if (!evaluated.ok) assert.equal(evaluated.error.code, "CANDIDATE_QC_CANONICAL_PASS_REQUIRED");
  assert.equal(opens, 0);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
