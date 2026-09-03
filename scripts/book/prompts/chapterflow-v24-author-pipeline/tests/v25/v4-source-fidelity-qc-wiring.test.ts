/**
 * SOURCE FIDELITY ON THE LIVE QC SEAM - the wiring proof.
 *
 * `v4-source-fidelity-judge.test.ts` proves the critic family in isolation.
 * This file proves the thing that actually ships: that
 * `CandidateQcEvaluator.run` resolves each chapter's source binding from the
 * CANDIDATE'S OWN BYTES, runs the judge inside the fresh-qc run with a distinct
 * attempt per chunk, turns its verdicts into round issues at the right severity,
 * fails CLOSED when the judge cannot run, and refuses a candidate whose sidecar
 * claims a grounding the candidate does not carry.
 *
 * Every model call is a scripted `ModelTaskRunner`; the fake enforces run-state's
 * attempt-uniqueness invariant, so a reused attempt id fails these tests the way
 * the real gateway would.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { CandidateQcEvaluator, countSourceFidelityCalls, panelFlaggedQuestionIds, quizJudgeSourceContext } from "../../src/app/candidateQcEvaluator.js";
import { freshQcRunDefinition, countQuizQuestions } from "../../src/app/bookRunApplicationService.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { compileSourcePacketFromSidecar } from "../../src/compiler/sourcePacket.js";
import { compileSourceUsePlan } from "../../src/compiler/sourceUsePlanCompiler.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import {
  SOURCE_FIDELITY_CONTRADICTED_CODE,
  isSourceFidelityCode,
} from "../../src/critics/semantic/sourceFidelityJudge.js";
import { PANEL_QUIZ_DERIVATION_SPLIT_CODE } from "../../src/review/panelQuizAdjudication.js";
import type { CanonicalReviewResult } from "../../src/review/reviewTypes.js";
import {
  CANDIDATE_CHAPTER_MAP_LOGICAL_PATH,
  CANDIDATE_SOURCE_TEXT_LOGICAL_PATH,
} from "../../src/source/candidateSourceContext.js";
import { CHAPTER_MAP_SCHEMA_VERSION } from "../../src/source/chapterMap.js";
import type { SourceSidecarV2 } from "../../src/source/sidecarSchema.js";
import { FRANKLIN_PROPRIETARIES_SLICE_PATH, makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "fidelity-wiring-book";
const CANDIDATE = "fidelity-wiring-1";
const DIGEST = "fidelity-wiring-digest";
const CREATED = "2026-07-21T12:00:00.000Z";

const SLICE = readFileSync(FRANKLIN_PROPRIETARIES_SLICE_PATH, "utf8");
const SOURCE_LINE = "it was concluded that I should give them the heads of our complaints in writing";
const REV6_ERROR = "The brothers will not meet him.";

function jsonFile(logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

function sidecar(extra: Partial<SourceSidecarV2> = {}): SourceSidecarV2 {
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
    ...extra,
  };
}

/** The frozen-text pair the research intake copies into a source-text candidate. */
function sourceTextFiles(text: string, spans: readonly unknown[]): CandidateInputFile[] {
  return [
    {
      kind: "PROVENANCE",
      logicalPath: CANDIDATE_SOURCE_TEXT_LOGICAL_PATH,
      mediaType: "text/plain",
      bytes: Buffer.from(text, "utf8"),
    },
    {
      ...jsonFile(CANDIDATE_CHAPTER_MAP_LOGICAL_PATH, {
        schemaVersion: CHAPTER_MAP_SCHEMA_VERSION,
        bookId: BOOK,
        sourceTextSha256: createHash("sha256").update(text, "utf8").digest("hex"),
        sourceTextLength: text.length,
        coverageFraction: 1,
        spans,
      }),
      kind: "PROVENANCE",
    },
  ];
}

function wholeSlicePan(text: string): readonly unknown[] {
  return [{
    chapterNumber: 1,
    chapterTitle: "Candidate Chapter",
    startOffset: 0,
    endOffset: text.length,
    startAnchor: text.slice(0, 60),
    endAnchor: text.slice(-60),
  }];
}

type BuildOptions = {
  readonly withSourceText?: boolean;
  readonly spans?: readonly unknown[];
  readonly sidecarExtra?: Partial<SourceSidecarV2>;
};

function buildCandidate(context: TestContext, options: BuildOptions = {}): CandidateSnapshot {
  const chapter = JSON.parse(
    JSON.stringify(makeGateCleanChapter(BOOK, 1)).replace(/the book/gi, "the source"),
  ) as ReturnType<typeof makeGateCleanChapter>;
  // The exact false sentence the shipped revision-6 chapter 4 carried, placed on
  // a reader-facing surface so the judge's quote can be verified against it.
  chapter.examples[0].whyItMatters = `${REV6_ERROR} ${chapter.examples[0].whyItMatters}`;
  const spec = { chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: "Candidate Chapter" };
  const sourcePath = "inputs/source/ch01.source.json";
  const packetPath = "compiler/ch01/source-packet.json";
  const side = sidecar(options.sidecarExtra);
  const packet = compileSourcePacketFromSidecar({ bookId: BOOK, chapter: spec, sidecar: side, sidecarPath: sourcePath, sourceHash: "source-hash" });
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
  const files: CandidateInputFile[] = [
    jsonFile("content/chapters/fidelity-wiring-book-ch01.v21-native.chapter.json", chapter, "CHAPTER"),
    jsonFile(sourcePath, side),
    jsonFile(packetPath, packet),
    jsonFile("compiler/ch01/blueprint.json", blueprint),
    jsonFile("compiler/ch01/source-use-plan.json", plan),
    jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({ bookId: BOOK, chapters: [chapter], requirePlanArtifacts: false, checkSourceAlignment: false })),
  ];
  if (options.withSourceText === true) {
    files.push(...sourceTextFiles(SLICE, options.spans ?? wholeSlicePan(SLICE)));
  }
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: CANDIDATE,
      createdByRunId: "run-fidelity-wiring",
      entries: files.map(({ bytes, ...entry }) => ({ ...entry, byteLength: bytes.byteLength })),
      manifestDigest: DIGEST,
      createdAt: CREATED,
    },
    files: files.map((file) => ({ ...file, byteLength: file.bytes.byteLength })),
  };
}

function review(issues: CanonicalReviewResult["issues"] = []): CanonicalReviewResult {
  return {
    schemaVersion: "1",
    reviewId: "review-fidelity-wiring",
    candidate: { candidateId: CANDIDATE, manifestDigest: DIGEST },
    outcome: "PASS",
    issues,
    completedAt: CREATED,
  };
}

function judgeContext(signal = new AbortController().signal): ModelTaskContext {
  return {
    bookId: BOOK,
    runId: "run-fidelity-wiring",
    attemptId: "qc-base",
    stageId: "fresh-qc",
    operationId: "fresh-qc",
    workDir: "/tmp/fidelity-wiring-workdir",
    signal,
  };
}

type Recorded = { readonly attemptIds: string[]; readonly fidelityPrompts: string[]; readonly profileIds: string[] };

/** A runner that answers the answer-key judge with an agreeing verdict and the
 *  source-fidelity judge with `fidelity`, and enforces run-state's
 *  attempt-uniqueness invariant exactly as the real gateway does. */
function runner(
  fidelity: (userPrompt: string) => ModelResult | { findings: unknown[] },
  recorded: Recorded,
): ModelTaskRunner {
  const seen = new Set<string>();
  return {
    async run(request): Promise<ModelResult> {
      const key = `${request.context.runId} ${request.context.attemptId}`;
      if (seen.has(key)) {
        return { attemptId: request.context.attemptId, outcome: "UNKNOWN", error: { code: "MODEL_ATTEMPT_EXISTS", message: "attempt is already admitted and cannot spawn again" } };
      }
      seen.add(key);
      recorded.attemptIds.push(request.context.attemptId);
      recorded.profileIds.push(request.profileId);
      const userPrompt = Buffer.from(request.prompt.inputs[1].bytes).toString("utf8");
      if (request.context.operationId.startsWith("source-fidelity-judge-")) {
        recorded.fidelityPrompts.push(userPrompt);
        const answer = fidelity(userPrompt);
        if ("outcome" in answer) return answer;
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: answer };
      }
      // The answer-key judge always agrees, so nothing in this file's outcomes
      // comes from the key judge.
      const match = /CHOICES:\n\[0\] ([\s\S]*?)\n/.exec(userPrompt);
      return {
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        output: { index: 0, confidence: "low", correctText: match?.[1] ?? "", reason: "scripted agreement" },
      };
    },
  };
}

function emptyRecorded(): Recorded {
  return { attemptIds: [], fidelityPrompts: [], profileIds: [] };
}

requiredTest("fresh QC blocks a chapter the frozen source contradicts, carrying the source line", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    {
      runner: runner(() => ({
        findings: [{
          surface: "example[0]/whyItMatters",
          quote: REV6_ERROR,
          claim: "The Penn brothers refused to meet Franklin.",
          verdict: "contradicted",
          sourceQuote: SOURCE_LINE,
          checkableKind: "sequence",
          note: "the source records the meeting and its written outcome",
        }],
      }), recorded),
    },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-fidelity-block", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  assert.equal(evaluated.value.outcome, "FAIL");
  const blocker = evaluated.value.issues.find((entry) => entry.code === SOURCE_FIDELITY_CONTRADICTED_CODE);
  assert.ok(blocker, JSON.stringify(evaluated.value.issues.filter((entry) => isSourceFidelityCode(entry.code)), null, 2));
  assert.equal(blocker.severity, "BLOCKER");
  assert.ok(blocker.message.includes(SOURCE_LINE), "the round carries the source line the judge cited");
  assert.equal(blocker.location, "ch01/example[0]/whyItMatters");
  // The judge saw the frozen bytes, not a paraphrase of them.
  assert.equal(recorded.fidelityPrompts.length, 1);
  assert.ok(recorded.fidelityPrompts[0].includes("heads\nof our complaints in writing"));
  // Its attempt id names the candidate's manifest digest and its own chunk.
  assert.ok(
    recorded.attemptIds.some((id) => id.startsWith("qc-base-fidelity-") && id.includes("-ch01-c01-a1")),
    JSON.stringify(recorded.attemptIds),
  );
  // A card carrying the book's own bytes runs on the long-timeout pipeline-root
  // route, not on the 300s short-probe profile the original 2 KB judge card was
  // sized for. Both judges carry the span here, so both move.
  assert.ok(
    recorded.profileIds.every((id) => id === "pipeline-read-json-long-v1"),
    JSON.stringify(recorded.profileIds),
  );
});

requiredTest("a model-memory answer-key judge keeps the short route it always had", async (context) => {
  // The long route exists for a card carrying the book's own bytes. A
  // model-memory context is the sidecar's recalled claims — a few hundred
  // characters — so this judge's route must not move at all.
  const candidate = buildCandidate(context);
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: runner(() => ({ findings: [] }), recorded) },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-memory-profile", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  const keyJudgeProfiles = recorded.profileIds.filter((_id, index) => index > 0);
  assert.ok(keyJudgeProfiles.length > 0);
  assert.ok(
    keyJudgeProfiles.every((id) => id === "pipeline-read-json-v1"),
    JSON.stringify(recorded.profileIds),
  );
});

requiredTest("a candidate with no frozen text warns under model-memory and never blocks", async (context) => {
  const candidate = buildCandidate(context);
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    {
      runner: runner(() => ({
        findings: [{
          surface: "example[0]/whyItMatters",
          quote: REV6_ERROR,
          claim: "The Penn brothers refused to meet Franklin in 1758.",
          verdict: "contradicted",
          sourceQuote: null,
          checkableKind: "date",
          note: "I recall a meeting taking place",
        }],
      }), recorded),
    },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-fidelity-memory", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  const fidelity = evaluated.value.issues.filter((entry) => isSourceFidelityCode(entry.code));
  assert.equal(fidelity.length, 1, JSON.stringify(fidelity, null, 2));
  assert.equal(fidelity[0].severity, "WARN", "recall is not evidence and may never gate");
  assert.ok(fidelity[0].message.includes("model-memory"), fidelity[0].message);
  // The judge was told it was reading recall, not the book.
  assert.equal(recorded.fidelityPrompts.length, 1);
  assert.ok(recorded.fidelityPrompts[0].includes("RECALLED CLAIMS"), recorded.fidelityPrompts[0].slice(0, 400));
});

requiredTest("a fidelity judge that cannot run is an evaluation ERROR, never a round", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    {
      runner: runner((): ModelResult => ({
        attemptId: "unused",
        outcome: "FAILED",
        error: { code: "FIDELITY_MODEL_DOWN", message: "injected fidelity failure" },
      }), recorded),
    },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-fidelity-error", taskContext: judgeContext() });
  assert.equal(evaluated.ok, false, "an unrunnable judge must never produce a committable round");
  if (!evaluated.ok) {
    assert.equal(evaluated.error.code, "CANDIDATE_QC_JUDGE_UNAVAILABLE");
    assert.match(evaluated.error.message, /source-fidelity judge could not complete ch01/);
    assert.match(evaluated.error.message, /FIDELITY_MODEL_DOWN/);
  }
  // Bounded: exactly SOURCE_FIDELITY_MAX_ATTEMPTS distinct attempts, then stop.
  assert.equal(recorded.attemptIds.length, 2, JSON.stringify(recorded.attemptIds));
  assert.equal(new Set(recorded.attemptIds).size, 2, "each retry mints a fresh attempt id");
});

requiredTest("an aborted signal cancels the fidelity judge without spawning a call", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const aborted = new AbortController();
  aborted.abort();
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: runner(() => ({ findings: [] }), recorded) },
  );
  const evaluated = await evaluator.run({
    candidate,
    canonicalReview: review(),
    roundId: "round-fidelity-cancel",
    taskContext: judgeContext(aborted.signal),
  });
  assert.equal(evaluated.ok, false);
  if (!evaluated.ok) assert.equal(evaluated.error.code, "CANDIDATE_QC_JUDGE_CANCELLED");
  assert.equal(recorded.attemptIds.length, 0, "no model call is spawned against an already-aborted signal");
});

requiredTest("a sidecar claiming source grounding the candidate cannot carry is a BLOCKER, not a downgrade", async (context) => {
  const candidate = buildCandidate(context, { sidecarExtra: { sourceProvenance: "source-text" } });
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: runner(() => ({ findings: [] }), recorded) },
  );
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-fidelity-missing-text", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  assert.equal(evaluated.value.outcome, "FAIL");
  const blocker = evaluated.value.issues.find((entry) => entry.code === "CANDIDATE_QC_SOURCE_CONTEXT_INVALID");
  assert.ok(blocker, JSON.stringify(evaluated.value.issues, null, 2));
  assert.equal(blocker.severity, "BLOCKER");
  assert.equal(recorded.fidelityPrompts.length, 0, "a chapter with no resolvable source binding is never judged");
});

requiredTest("a chapter map bound to different bytes is a BLOCKER", async (context) => {
  const candidate = buildCandidate(context, {
    withSourceText: true,
    spans: wholeSlicePan(SLICE),
  });
  // Rewrite the map's digest so it no longer names the candidate's own text.
  const tampered: CandidateSnapshot = {
    ...candidate,
    files: candidate.files.map((file) => file.logicalPath !== CANDIDATE_CHAPTER_MAP_LOGICAL_PATH ? file : {
      ...file,
      bytes: Buffer.from(JSON.stringify({
        ...JSON.parse(Buffer.from(file.bytes).toString("utf8")) as Record<string, unknown>,
        sourceTextSha256: "0".repeat(64),
      })),
    }),
  };
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: tampered }; } },
    { runner: runner(() => ({ findings: [] }), recorded) },
  );
  const evaluated = await evaluator.run({ candidate: tampered, canonicalReview: review(), roundId: "round-fidelity-map-drift", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  assert.ok(
    evaluated.value.issues.some((entry) => entry.code === "CANDIDATE_QC_SOURCE_CONTEXT_INVALID" && entry.severity === "BLOCKER"),
    JSON.stringify(evaluated.value.issues, null, 2),
  );
  assert.equal(recorded.fidelityPrompts.length, 0);
});

requiredTest("reader escalations reach the fidelity judge as claim hints", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const recorded = emptyRecorded();
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: runner(() => ({ findings: [] }), recorded) },
  );
  const evaluated = await evaluator.run({
    candidate,
    canonicalReview: review([
      { code: "READER.ESCALATION.origin_ambiguous_to_reader", severity: "WARN", message: "the Penn negotiation reads as history and I cannot check it", location: "ch01/seat-skeptic/example[0]" },
      { code: "READER.ESCALATION.possible_real_world_claim", severity: "WARN", message: "belongs to another chapter", location: "ch02/seat-skeptic/hook" },
    ]),
    roundId: "round-fidelity-hints",
    taskContext: judgeContext(),
  });
  assert.ok(evaluated.ok);
  assert.equal(recorded.fidelityPrompts.length, 1);
  const prompt = recorded.fidelityPrompts[0];
  assert.ok(prompt.includes("READER ESCALATIONS"), "escalations are a named section of the judge prompt");
  assert.ok(prompt.includes("the Penn negotiation reads as history and I cannot check it"));
  assert.equal(prompt.includes("belongs to another chapter"), false, "another chapter's escalation is not this chapter's hint");
  // The escalation is still on the round: consuming it must not delete it.
  assert.ok(evaluated.value.issues.some((entry) => entry.code === "REVIEW.READER.ESCALATION.origin_ambiguous_to_reader"));
});

requiredTest("the answer-key judge receives the chapter's own frozen span, labelled as ground truth", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const recorded = emptyRecorded();
  const prompts: string[] = [];
  const base = runner(() => ({ findings: [] }), recorded);
  const capture: ModelTaskRunner = {
    async run(request) {
      if (!request.context.operationId.startsWith("source-fidelity-judge-")) {
        prompts.push(Buffer.from(request.prompt.inputs[1].bytes).toString("utf8"));
      }
      return base.run(request);
    },
  };
  const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } }, { runner: capture });
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-key-source", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  assert.ok(prompts.length > 0, "the answer-key judge still runs");
  assert.ok(prompts[0].includes("SOURCE TEXT (ground truth"), prompts[0].slice(0, 600));
  assert.ok(prompts[0].includes("heads\nof our complaints in writing"));
  assert.ok(prompts[0].includes("unsupportedExplanationClaims"), "the explanation audit is asked for (R-078)");
});

requiredTest("a model-memory answer-key judge is never told its context is ground truth", async (context) => {
  const candidate = buildCandidate(context);
  const recorded = emptyRecorded();
  const prompts: string[] = [];
  const base = runner(() => ({ findings: [] }), recorded);
  const capture: ModelTaskRunner = {
    async run(request) {
      if (!request.context.operationId.startsWith("source-fidelity-judge-")) {
        prompts.push(Buffer.from(request.prompt.inputs[1].bytes).toString("utf8"));
      }
      return base.run(request);
    },
  };
  const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } }, { runner: capture });
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-key-memory", taskContext: judgeContext() });
  assert.ok(evaluated.ok);
  assert.ok(prompts.length > 0);
  assert.equal(prompts[0].includes("SOURCE TEXT (ground truth"), false, prompts[0].slice(0, 600));
  assert.ok(prompts[0].includes("RECALLED SOURCE NOTES"));
  assert.ok(prompts[0].includes("NOT the book, and not ground truth"), "the header says what the context is NOT");
});

requiredTest("panel derivation splits reach the QC lane as flagged question ids", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const chapter = JSON.parse(
    Buffer.from(candidate.files.find((file) => file.kind === "CHAPTER")!.bytes).toString("utf8"),
  ) as ReturnType<typeof makeGateCleanChapter>;
  const flaggedId = chapter.quiz.questions[0].questionId;
  const issues: CanonicalReviewResult["issues"] = [
    { code: `REVIEW.${PANEL_QUIZ_DERIVATION_SPLIT_CODE}`, severity: "WARN", message: "seats split", location: `ch01/quiz/${flaggedId}` },
  ];
  assert.deepEqual([...panelFlaggedQuestionIds(issues, 1)], [flaggedId]);
  assert.deepEqual([...panelFlaggedQuestionIds(issues, 2)], []);

  // And the judge blocks a MEDIUM-confidence disagreement on exactly that
  // question, where an unflagged question would only have been reviewed.
  const recorded = emptyRecorded();
  const runnerWithMediumDisagreement: ModelTaskRunner = {
    async run(request) {
      if (request.context.operationId.startsWith("source-fidelity-judge-")) {
        recorded.attemptIds.push(request.context.attemptId);
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { findings: [] } };
      }
      recorded.attemptIds.push(request.context.attemptId);
      // Always derive index 0 at medium confidence. correctIndex cycles, so the
      // non-zero-keyed questions are all medium-confidence disagreements.
      return {
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        output: { index: 0, confidence: "medium", correctText: "scripted", reason: "scripted medium" },
      };
    },
  };
  const evaluator = new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: runnerWithMediumDisagreement },
  );
  const flaggedFirst = chapter.quiz.questions.find((question) => question.correctIndex !== 0);
  assert.ok(flaggedFirst, "the fixture needs at least one non-zero key");
  const evaluated = await evaluator.run({
    candidate,
    canonicalReview: review([
      { code: `REVIEW.${PANEL_QUIZ_DERIVATION_SPLIT_CODE}`, severity: "WARN", message: "seats split", location: `ch01/quiz/${flaggedFirst.questionId}` },
    ]),
    roundId: "round-panel-flagged",
    taskContext: judgeContext(),
  });
  assert.ok(evaluated.ok);
  const wrongKey = evaluated.value.issues.filter((entry) => entry.code === "QC1.wrong_quiz_key");
  assert.equal(wrongKey.length, 1, JSON.stringify(wrongKey, null, 2));
  assert.ok(wrongKey[0].location?.endsWith(flaggedFirst.questionId));
  assert.equal(wrongKey[0].severity, "BLOCKER");
});

requiredTest("the fresh-qc run is sized for both judges", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  assert.equal(countSourceFidelityCalls(candidate), 1, "one chapter, one chunk");
  const definition = freshQcRunDefinition({
    bookId: BOOK,
    runId: "run-capacity",
    sourceGitSha: "0".repeat(40),
    candidate,
    createdAt: CREATED,
    questionCount: countQuizQuestions(candidate),
  });
  const expected = (countQuizQuestions(candidate) * 2) + (1 * 2);
  assert.equal(definition.attemptLimits.run, expected);
  assert.equal(definition.attemptLimits.byStage?.["fresh-qc"], expected);
});

requiredTest("the answer-key judge source context follows the candidate's provenance", async (context) => {
  const grounded = buildCandidate(context, { withSourceText: true });
  const recalled = buildCandidate(context);
  const evaluatorProbe = async (candidate: CandidateSnapshot): Promise<string | undefined> => {
    const recorded = emptyRecorded();
    const prompts: string[] = [];
    const base = runner(() => ({ findings: [] }), recorded);
    const capture: ModelTaskRunner = {
      async run(request) {
        if (!request.context.operationId.startsWith("source-fidelity-judge-")) {
          prompts.push(Buffer.from(request.prompt.inputs[1].bytes).toString("utf8"));
        }
        return base.run(request);
      },
    };
    const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } }, { runner: capture });
    const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: `round-probe-${candidate.files.length}`, taskContext: judgeContext() });
    assert.ok(evaluated.ok);
    return prompts[0];
  };
  assert.ok((await evaluatorProbe(grounded))?.includes("SOURCE TEXT (ground truth"));
  assert.ok((await evaluatorProbe(recalled))?.includes("RECALLED SOURCE NOTES"));
  // And the pure helper says the same thing about the same inputs.
  assert.equal(
    quizJudgeSourceContext({ context: { provenance: "model-memory", recalledClaims: [] }, span: null, sourceTextSha256: null }),
    undefined,
  );
  assert.equal(
    quizJudgeSourceContext({ context: { provenance: "model-memory", recalledClaims: ["one recalled claim"] }, span: null, sourceTextSha256: null }),
    "[R1] one recalled claim",
  );
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
