import assert from "node:assert/strict";

import { CandidateQcEvaluator } from "../../src/app/candidateQcEvaluator.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import { SemanticPanelReviewEvaluator } from "../../src/app/semanticPanelReviewEvaluator.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { compileSourcePacketFromSidecar } from "../../src/compiler/sourcePacket.js";
import { compileSourceUsePlan } from "../../src/compiler/sourceUsePlanCompiler.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import { READER_PANEL_FACTOR_SCORES_CODE } from "../../src/review/readerPanelIssueCodes.js";
import type { CanonicalReviewResult } from "../../src/review/reviewTypes.js";
import type { SourceSidecarV2 } from "../../src/source/sidecarSchema.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "candidate-qc-book";
/** The gate-clean fixture chapter's quiz size — the reader panel's derivation
 *  must cover exactly this many questions (R-133). */
const QUESTION_COUNT = makeGateCleanChapter("question-count-probe", 1).quiz.questions.length;
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

function judgeContext(): ModelTaskContext {
  return {
    bookId: BOOK,
    runId: "run-candidate-qc",
    attemptId: "qc-base",
    stageId: "fresh-qc",
    operationId: "fresh-qc",
    workDir: "/tmp/candidate-qc-workdir",
    signal: new AbortController().signal,
  };
}

/** A runner that answers every quiz-key judge question with a fixed verdict, or
 *  fails, so the fresh-qc judge path is exercisable model-free.
 *
 *  It ALSO enforces run-state's attempt-uniqueness invariant: a second call with
 *  an already-admitted (runId, attemptId) returns the exact MODEL_ATTEMPT_EXISTS
 *  ModelResult the real gateway returns (modelGateway.ts:383). This is the
 *  Task 11b same-trap probe — the quiz-key judge issues ONE model call per quiz
 *  question, so if the evaluator reused one frozen context across a chapter's
 *  questions (or across chapters) the second question would fail closed exactly
 *  as the researcher-chapter retry did. These multi-question / multi-chapter
 *  tests staying green PROVES the live judge path mints a distinct attempt per
 *  question (candidateQcEvaluator.ts threads a fresh judgeCtx per call). */
function judgeRunner(verdict: { index: number; confidence: "high" | "medium" | "low" } | "FAIL"): ModelTaskRunner {
  const seen = new Set<string>();
  return {
    async run(request): Promise<ModelResult> {
      const key = `${request.context.runId} ${request.context.attemptId}`;
      if (seen.has(key)) {
        return { attemptId: request.context.attemptId, outcome: "UNKNOWN", error: { code: "MODEL_ATTEMPT_EXISTS", message: "attempt is already admitted and cannot spawn again" } };
      }
      seen.add(key);
      if (verdict === "FAIL") {
        return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "JUDGE_MODEL_DOWN", message: "injected judge failure" } };
      }
      // Fresh QC now hosts TWO judges on the same run. The source-fidelity judge
      // is answered with an empty finding set so these answer-key cases keep
      // asserting exactly what they asserted before; its own behaviour is proved
      // in v4-source-fidelity-judge.test.ts.
      if (request.context.operationId.startsWith("source-fidelity-judge-")) {
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { findings: [] } };
      }
      return {
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        output: { index: verdict.index, confidence: verdict.confidence, correctText: "scripted choice", reason: "scripted verdict" },
      };
    },
  };
}

requiredTest("fresh QC quiz-key judge blocks on a confident wrong key", async (context) => {
  const candidate = buildCandidate(context);
  // correctIndex is [0,1,2,...]; a judge that confidently derives index 0 for
  // every question disagrees with the non-zero keys → wrong-key blockers.
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: judgeRunner({ index: 0, confidence: "high" }) },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-judge-block", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  assert.equal(evaluated.value.outcome, "FAIL");
  assert.ok(evaluated.value.issues.some((entry) => entry.code === "QC1.wrong_quiz_key" && entry.severity === "BLOCKER"), JSON.stringify(evaluated.value.issues));
});

requiredTest("fresh QC quiz-key judge does not block on a low-confidence disagreement", async (context) => {
  const candidate = buildCandidate(context);
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: judgeRunner({ index: 0, confidence: "low" }) },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-judge-lowconf", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  assert.equal(evaluated.value.outcome, "PASS", JSON.stringify(evaluated.value.issues.filter((entry) => entry.severity === "BLOCKER"), null, 2));
  assert.equal(evaluated.value.issues.some((entry) => entry.code === "QC1.wrong_quiz_key"), false);
});

requiredTest("fresh QC surfaces a medium-confidence disagreement as a non-blocking WARN", async (context) => {
  const candidate = buildCandidate(context);
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: judgeRunner({ index: 0, confidence: "medium" }) },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-judge-medconf", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  // Medium confidence is never auto-blocked, but the human-review escalation must
  // not be silently dropped: it is surfaced as a WARN, never a BLOCKER.
  assert.equal(evaluated.value.outcome, "PASS", JSON.stringify(evaluated.value.issues.filter((entry) => entry.severity === "BLOCKER"), null, 2));
  assert.equal(evaluated.value.issues.some((entry) => entry.code === "QC1.wrong_quiz_key"), false);
  assert.ok(
    evaluated.value.issues.some((entry) => entry.code === "QC1.quiz_key_review" && entry.severity === "WARN"),
    JSON.stringify(evaluated.value.issues, null, 2),
  );
});

requiredTest("a judge that cannot run is an evaluation error, never a manufactured FAIL round", async (context) => {
  // THROWS ARE INFRASTRUCTURE, REPORT VERDICTS ARE CONTENT (live pre-flight,
  // canary night 5): retry-exhausted transients used to be laundered into
  // CANDIDATE_QC_QUIZ_JUDGE_ERROR blockers inside an ok(FAIL) evaluation. The
  // caller committed that round durably; the repair path rightly refuses
  // CANDIDATE_QC_-prefixed blockers as compiler-owned, so a review-passed
  // candidate wedged permanently on a transient. The evaluation errors instead:
  // no round exists, and the caller's successor machinery re-judges on resume.
  const candidate = buildCandidate(context);
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: judgeRunner("FAIL") },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-judge-error", taskContext: judgeContext() });
  assert.equal(evaluated.ok, false, "an unrunnable judge must never produce a committable round");
  if (!evaluated.ok) {
    assert.equal(evaluated.error.code, "CANDIDATE_QC_JUDGE_UNAVAILABLE");
    assert.match(evaluated.error.message, /JUDGE_MODEL_DOWN/, "the underlying cause is preserved for the operator");
  }
});

requiredTest("an aborted signal cancels the judge without burning attempts or minting a verdict", async (context) => {
  const candidate = buildCandidate(context);
  const aborted = new AbortController();
  aborted.abort();
  let calls = 0;
  const runner: ModelTaskRunner = {
    async run(request): Promise<ModelResult> {
      calls += 1;
      return { attemptId: request.context.attemptId, outcome: "CANCELLED", error: { code: "MODEL_RUN_CANCELLED", message: "aborted" } };
    },
  };
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner },
  );
  const evaluated = await evaluator.run({
    candidate,
    canonicalReview: review(),
    roundId: "round-judge-cancelled",
    taskContext: { ...judgeContext(), signal: aborted.signal },
  });
  assert.equal(evaluated.ok, false, "cancellation is an evaluation error, not a content verdict");
  if (!evaluated.ok) assert.equal(evaluated.error.code, "CANDIDATE_QC_JUDGE_CANCELLED");
  // The pre-attempt signal check fires before any model call — an aborted
  // signal fails every future call identically, so spending the per-question
  // retry budget against it is pure waste.
  assert.equal(calls, 0, "no model call is spawned against an already-aborted signal");
});

/**
 * The LIVE-PATH chain that decides whether repair ever sees a reader diagnosis.
 *
 * Repair reads a committed QC ROUND (`CandidateRepairApplicationPort.authorize`
 * → `qc.getRound`). A QC round can only be minted from a PASSING canonical
 * review — `qcService.runFresh` refuses any other outcome with QC_JOIN_MISMATCH
 * and `CandidateQcEvaluator.run` refuses it with CANDIDATE_QC_CANONICAL_PASS_REQUIRED
 * — and the book-run service returns BOOK_RUN_REVIEW_FAILED before repair when
 * the review is not PASS (`bookRunApplicationService.ts`, review phase).
 *
 * So the ONLY review shape that can ever reach repair is a PASS. A panel
 * diagnosis emitted only for chapters the panel BLOCKED is therefore unreachable
 * from repair by construction: blocking the chapter is exactly what makes the
 * review FAIL. This test pins the other end — the diagnosis a PASSING review
 * carries must survive into the QC round repair reads.
 */
requiredTest("the reader panel's per-factor diagnosis survives a PASSING review into the QC round repair reads", async (context) => {
  const candidate = buildCandidate(context);
  // Three clean reader seats, every factor at 88 (well above the chapter bar) →
  // the panel PASSES the chapter and names no defect. This is the live shape.
  const seatScores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) seatScores[factor] = 88;
  seatScores.transfer = 71;
  const readerOutput = {
    scores: seatScores,
    // One derivation per question (R-133): the reader lane rejects a seat whose
    // positional derivation does not cover the chapter's quiz.
    quizDerivation: {
      answers: Array.from({ length: QUESTION_COUNT }, () => "a"),
      mechanisms: Array.from({ length: QUESTION_COUNT }, (_value, index) => `the prose forces choice a in q${index + 1}`),
      confidence: Array.from({ length: QUESTION_COUNT }, () => "high"),
      ambiguities: Array.from({ length: QUESTION_COUNT }, () => ""),
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [{ category: "thin_example", unit: "deep read", problem: "the worked example stops before the decision", evidenceSpans: [] }],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "Usable, but the transfer work is thin.",
  };
  const panel = new SemanticPanelReviewEvaluator({
    baseline: { async evaluate() { return { ok: true, value: { outcome: "PASS" as const, issues: [] } }; } },
    runner: { async run(request) { return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: readerOutput }; } },
  });
  const reviewed = await panel.evaluate({
    candidate,
    taskContext: { ...judgeContext(), stageId: "canonical-review", operationId: "canonical-review" },
  });
  assert.ok(reviewed.ok, JSON.stringify(reviewed));
  assert.equal(reviewed.value.outcome, "PASS", JSON.stringify(reviewed.value.issues));
  // The PASSING review must carry the per-factor medians — this is the channel.
  const reviewFactorLines = reviewed.value.issues.filter((entry) => entry.code === READER_PANEL_FACTOR_SCORES_CODE);
  assert.equal(reviewFactorLines.length, 1, `a PASSING panel review must still carry its per-factor diagnosis: ${JSON.stringify(reviewed.value.issues)}`);
  assert.equal(reviewFactorLines[0].severity, "WARN");
  assert.equal(reviewFactorLines[0].location, "ch01");
  assert.match(reviewFactorLines[0].message, /transfer 71/);

  // …and it must survive the trip into the QC round, where repair reads it.
  const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } });
  const evaluated = await evaluator.run({
    candidate,
    canonicalReview: { ...review(), issues: reviewed.value.issues },
    roundId: "round-panel-diagnosis",
  });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  const roundFactorLines = evaluated.value.issues.filter((entry) => entry.code === `REVIEW.${READER_PANEL_FACTOR_SCORES_CODE}`);
  assert.equal(roundFactorLines.length, 1, `the QC round repair reads must carry the panel diagnosis: ${JSON.stringify(evaluated.value.issues)}`);
  assert.equal(roundFactorLines[0].severity, "WARN");
  assert.equal(roundFactorLines[0].location, "ch01");
  // The chapter's advisories ride the same channel.
  assert.ok(
    evaluated.value.issues.some((entry) => entry.code === "REVIEW.READER.ADVISORY.thin_example" && entry.severity === "WARN"),
    JSON.stringify(evaluated.value.issues),
  );
});

/**
 * R-162 — a canonical review below BLOCKER was flattened to WARN entering the QC
 * round, so the review lane had no way to emit a non-actionable note: an INFO
 * pass attestation ("CONTENT_REVIEWED_NO_INJECTION") arrived at the same
 * severity as a real pacing defect and was handed to repair as a task.
 */
requiredTest("R-162: review severity is preserved into the QC round; an INFO note is not promoted to WARN", async (context) => {
  const candidate = buildCandidate(context);
  const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } });
  const evaluated = await evaluator.run({
    candidate,
    canonicalReview: {
      ...review(),
      issues: [
        { code: "CONTENT_REVIEWED_NO_INJECTION", severity: "INFO", message: "no injection found", location: "ch01" },
        { code: "PACING", severity: "WARN", message: "the deep read stalls before the decision", location: "ch01" },
      ],
    },
    roundId: "round-review-severity",
  });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  const codes = evaluated.value.issues.map((entry) => entry.code);
  assert.equal(
    codes.includes("REVIEW.CONTENT_REVIEWED_NO_INJECTION"),
    false,
    `an INFO review note must not enter the QC round as a WARN: ${JSON.stringify(evaluated.value.issues, null, 2)}`,
  );
  const warn = evaluated.value.issues.find((entry) => entry.code === "REVIEW.PACING");
  assert.ok(warn, "a WARN review issue must still reach the round");
  assert.equal(warn.severity, "WARN");
});

/**
 * R-163 — a chapter whose compiler inputs fail was silently excluded from the
 * chapter-gate composite: the round spent an ordinal and returned a finding set
 * that described only the chapters that happened to compile, with nothing saying
 * the others were never gated.
 */
requiredTest("R-163: a chapter whose compiler inputs fail is reported as ungated, not silently skipped", async (context) => {
  const candidate = buildCandidate(context, (files) => files.map((file) => file.logicalPath === "compiler/ch01/blueprint.json"
    ? jsonFile(file.logicalPath, { schemaVersion: "chapter-blueprint-v1" })
    : file));
  const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } });
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-ungated-chapter" });
  assert.ok(evaluated.ok);
  assert.equal(evaluated.value.outcome, "FAIL");
  const ungated = evaluated.value.issues.filter((entry) => entry.code === "CANDIDATE_QC_CHAPTER_NOT_GATED");
  assert.equal(ungated.length, 1, `the excluded chapter must be named: ${JSON.stringify(evaluated.value.issues, null, 2)}`);
  assert.equal(ungated[0].severity, "BLOCKER");
  assert.match(ungated[0].message, /ch01/);

  // A candidate whose inputs are all valid says nothing of the kind.
  const clean = buildCandidate(context);
  const cleanEvaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: clean }; } });
  const cleanRound = await cleanEvaluator.run({ candidate: clean, canonicalReview: review(), roundId: "round-all-gated" });
  assert.ok(cleanRound.ok);
  assert.equal(cleanRound.value.issues.some((entry) => entry.code === "CANDIDATE_QC_CHAPTER_NOT_GATED"), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
