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

import {
  CandidateQcEvaluator,
  SOURCE_FIDELITY_NOT_RUN_CODE,
  countSourceFidelityCalls,
  panelFlaggedQuestionIds,
  quizJudgeSourceContext,
} from "../../src/app/candidateQcEvaluator.js";
import { freshQcRunDefinition, countQuizQuestions } from "../../src/app/bookRunApplicationService.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { QcEvaluation } from "../../src/qc/qcTypes.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { compileSourcePacketFromSidecar } from "../../src/compiler/sourcePacket.js";
import { compileSourceUsePlan } from "../../src/compiler/sourceUsePlanCompiler.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import {
  SOURCE_FIDELITY_CONTRADICTED_CODE,
  SOURCE_FIDELITY_EXPLANATION_CODE,
  detectCheckableKinds,
  isSourceFidelityCode,
} from "../../src/critics/semantic/sourceFidelityJudge.js";
import { PANEL_QUIZ_DERIVATION_SPLIT_CODE } from "../../src/review/panelQuizAdjudication.js";
import type { CanonicalReviewResult } from "../../src/review/reviewTypes.js";
import {
  CANDIDATE_CHAPTER_MAP_LOGICAL_PATH,
  CANDIDATE_SOURCE_TEXT_LOGICAL_PATH,
} from "../../src/source/candidateSourceContext.js";
import { CHAPTER_MAP_SCHEMA_VERSION, MAX_SPAN_PROMPT_CHARS, spanExcerptForPrompt } from "../../src/source/chapterMap.js";
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
  /** The frozen text the candidate carries. Defaults to the 20 KB Franklin
   *  slice; a longer one exercises the EXCERPTED prompt path. */
  readonly sourceText?: string;
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
    const text = options.sourceText ?? SLICE;
    files.push(...sourceTextFiles(text, options.spans ?? wholeSlicePan(text)));
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
  assert.deepEqual(
    quizJudgeSourceContext({ context: { provenance: "model-memory", recalledClaims: ["one recalled claim"] }, span: null, sourceTextSha256: null }),
    { text: "[R1] one recalled claim", provenance: "model-memory", excerpted: false, omittedChars: 0 },
  );
  // A span inside the prompt bound is passed WHOLE, and says so.
  assert.deepEqual(
    quizJudgeSourceContext({ context: { provenance: "source-text", spanText: SLICE }, span: null, sourceTextSha256: null }),
    { text: SLICE, provenance: "source-text", excerpted: false, omittedChars: 0 },
  );
});

// ── ROUND 2, MAJOR 1 ────────────────────────────────────────────────────────
// SF4 minted from the ANSWER-KEY judge used to be enforced on a rule of its own
// ("the clause is non-empty and occurs somewhere in the explanation"), while the
// comment above it and `sourceFidelityJudge`'s own severity table both promise
// the fidelity judge's rule. A judge returning `unsupportedExplanationClaims:
// ["the"]` on a source-text candidate therefore minted a ship-blocking QC issue,
// and repair would act on it by deleting a true explanation clause.

/** The first quiz explanation of the candidate's only chapter, verbatim. */
function firstExplanation(candidate: CandidateSnapshot): string {
  const file = candidate.files.find((entry) => entry.kind === "CHAPTER");
  assert.ok(file, "the candidate carries a chapter");
  const chapter = JSON.parse(Buffer.from(file.bytes).toString("utf8")) as {
    quiz?: { questions?: ReadonlyArray<{ explanation?: string }> };
  };
  const explanation = chapter.quiz?.questions?.[0]?.explanation;
  assert.equal(typeof explanation, "string");
  return explanation as string;
}

/** Run fresh QC with a scripted answer-key judge that AGREES with every key and
 *  reports `claims` as unsupported clauses of the ONE question whose explanation
 *  is `explanation` (R-078/SF4). */
async function evaluateWithExplanationClaims(
  candidate: CandidateSnapshot,
  args: Readonly<{ explanation: string; claims: readonly string[]; roundId: string }>,
): Promise<QcEvaluation> {
  const recorded = emptyRecorded();
  const base = runner(() => ({ findings: [] }), recorded);
  const capture: ModelTaskRunner = {
    async run(request) {
      const result = await base.run(request);
      if (request.context.operationId.startsWith("source-fidelity-judge-")) return result;
      if (result.outcome !== "SUCCEEDED") return result;
      const userPrompt = Buffer.from(request.prompt.inputs[1].bytes).toString("utf8");
      if (!userPrompt.includes(args.explanation)) return result;
      return { ...result, output: { ...(result.output as Record<string, unknown>), unsupportedExplanationClaims: [...args.claims] } };
    },
  };
  const evaluator = new CandidateQcEvaluator({ async open() { return { ok: true, value: candidate }; } }, { runner: capture });
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: args.roundId, taskContext: judgeContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  return evaluated.value;
}

const sf4Issues = (round: QcEvaluation) =>
  round.issues.filter((entry) => entry.code === SOURCE_FIDELITY_EXPLANATION_CODE);

/** The fixture chapter carries its own deterministic SC11 blockers, so a round
 *  outcome says nothing about the judges. What a source-fidelity BLOCKER costs
 *  is what these tests measure. */
const fidelityBlockers = (round: QcEvaluation) =>
  round.issues.filter((entry) => isSourceFidelityCode(entry.code) && entry.severity === "BLOCKER");

requiredTest("SF4 from the answer-key judge is enforced on the fidelity judge's own cite-or-it-didn't-happen rule", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const explanation = firstExplanation(candidate);
  // Both clauses are VERBATIM in the explanation. They differ only in what the
  // fidelity judge's rule asks about them, and the detector says which is which
  // so this test does not depend on the fixture's nouns.
  const checkable = explanation.slice(0, explanation.indexOf(" while "));
  const generality = explanation.slice(explanation.indexOf("catches "));
  assert.ok(checkable.length > 0 && generality.length > 0, explanation);
  assert.ok(detectCheckableKinds(checkable).length > 0, `${checkable} should name something checkable`);
  assert.equal(detectCheckableKinds(generality).length, 0, `${generality} should be a bare generality`);

  // 1. A clause under MIN_CHAPTER_QUOTE_CHARS is not a citation. It is reported,
  //    never enforced — the fidelity judge's `contains` floor, applied here too.
  const tiny = await evaluateWithExplanationClaims(candidate, { explanation, claims: ["the"], roundId: "round-sf4-tiny" });
  assert.equal(sf4Issues(tiny).length, 1, JSON.stringify(sf4Issues(tiny), null, 2));
  assert.equal(sf4Issues(tiny)[0].severity, "WARN", sf4Issues(tiny)[0].message);
  assert.ok(sf4Issues(tiny)[0].message.includes("NOT ENFORCED"), sf4Issues(tiny)[0].message);
  assert.deepEqual(fidelityBlockers(tiny), [], "a one-word clause can block nothing");

  // 2. A quoted clause that names no date, number, sequence, name, document or
  //    quotation is a bare generality: the source cannot settle it, so it WARNs
  //    exactly as SF2 does (sourceFidelityJudge's severity table).
  const bare = await evaluateWithExplanationClaims(candidate, { explanation, claims: [generality], roundId: "round-sf4-generality" });
  assert.equal(sf4Issues(bare).length, 1);
  assert.equal(sf4Issues(bare)[0].severity, "WARN", sf4Issues(bare)[0].message);
  assert.ok(
    sf4Issues(bare)[0].message.includes("names no date, number, sequence, name, document or quotation"),
    sf4Issues(bare)[0].message,
  );
  assert.deepEqual(fidelityBlockers(bare), [], "a bare generality can block nothing");

  // 3. NOT A WEAKENING: a checkable clause, quoted verbatim, still BLOCKS.
  const blocking = await evaluateWithExplanationClaims(candidate, { explanation, claims: [checkable], roundId: "round-sf4-checkable" });
  assert.equal(blocking.outcome, "FAIL");
  assert.equal(fidelityBlockers(blocking).length, 1, "the enforced SF4 is a source-fidelity blocker on the round");
  const enforced = sf4Issues(blocking);
  assert.equal(enforced.length, 1, JSON.stringify(enforced, null, 2));
  assert.equal(enforced[0].severity, "BLOCKER", enforced[0].message);
  assert.equal(enforced[0].message.includes("NOT ENFORCED"), false, enforced[0].message);
  assert.ok(enforced[0].location?.startsWith("ch01/quiz/"), enforced[0].location);
});


// ── ROUND 2, MAJOR 2 ────────────────────────────────────────────────────────
// The answer-key judge's source header said "this chapter's own span of the
// book, verbatim" whatever it was handed. Over MAX_SPAN_PROMPT_CHARS the block
// is SPAN_EXCERPT_WINDOWS (8) sampled windows joined by omission markers - and
// the four Franklin v25 spans are 114,687 characters each, of which this judge
// sees 60,424 and never sees 54,687, so the flagship case is exactly that one.
// A judge told an excerpt is the whole span reads absence from the excerpt as
// absence from the book, and an SF4 blocker minted that way cites nothing.

/** A frozen text whose single span is over the prompt bound. */
const OVERLONG_SOURCE = SLICE.repeat(4);

requiredTest("an over-long span is never called verbatim: the judge is told what was omitted", async (context) => {
  assert.ok(OVERLONG_SOURCE.length > MAX_SPAN_PROMPT_CHARS, `${OVERLONG_SOURCE.length} characters must exceed the prompt bound`);
  const excerpt = spanExcerptForPrompt(OVERLONG_SOURCE);
  assert.equal(excerpt.excerpted, true);
  assert.ok(excerpt.omittedChars > 0);

  const candidate = buildCandidate(context, { withSourceText: true, sourceText: OVERLONG_SOURCE });
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
  const evaluated = await evaluator.run({ candidate, canonicalReview: review(), roundId: "round-excerpt-header", taskContext: judgeContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.ok(prompts.length > 0, "the answer-key judge still runs");
  const prompt = prompts[0];
  assert.equal(
    prompt.includes("SOURCE TEXT (ground truth — this chapter's own span of the book, verbatim)"),
    false,
    "an excerpted span must not be described as the verbatim whole span",
  );
  assert.ok(prompt.includes(`${excerpt.omittedChars} characters`), prompt.slice(0, 400));
  assert.ok(
    prompt.includes("not evidence that the book does not contain it"),
    "the judge must be told absence from the excerpt is not absence from the book",
  );

  // The pure helper reports the same excerpting the prompt states.
  const resolved = quizJudgeSourceContext({
    context: { provenance: "source-text", spanText: OVERLONG_SOURCE },
    span: null,
    sourceTextSha256: null,
  });
  assert.ok(resolved);
  assert.equal(resolved.excerpted, true);
  assert.equal(resolved.omittedChars, excerpt.omittedChars);
});

requiredTest("an SF4 blocker cannot be minted from absence inside an excerpted span", async (context) => {
  const whole = buildCandidate(context, { withSourceText: true });
  const excerpted = buildCandidate(context, { withSourceText: true, sourceText: OVERLONG_SOURCE });
  const explanation = firstExplanation(whole);
  // A clause that DOES block when the judge read the whole span (the control).
  const claim = explanation.slice(0, explanation.indexOf(" while "));
  assert.ok(detectCheckableKinds(claim).length > 0);

  const control = await evaluateWithExplanationClaims(whole, { explanation, claims: [claim], roundId: "round-excerpt-control" });
  assert.equal(sf4Issues(control)[0]?.severity, "BLOCKER", JSON.stringify(sf4Issues(control), null, 2));

  const round = await evaluateWithExplanationClaims(excerpted, { explanation, claims: [claim], roundId: "round-excerpt-sf4" });
  const issues = sf4Issues(round);
  assert.equal(issues.length, 1, JSON.stringify(issues, null, 2));
  assert.equal(issues[0].severity, "WARN", issues[0].message);
  assert.ok(issues[0].message.includes("NOT ENFORCED"), issues[0].message);
  assert.ok(issues[0].message.includes("characters of it"), issues[0].message);
  assert.deepEqual(
    fidelityBlockers(round),
    [],
    "absence inside an excerpt cites nothing, so it can mint no source-fidelity blocker",
  );
});


requiredTest("SF4 cannot block when no source context reached the judge at all", async (context) => {
  // The hardest case in the same family: a span that resolves but renders to
  // nothing hands the answer-key judge NO source block, so "the source does not
  // support it" is absence with nothing to have been absent from.
  const blank = `${" ".repeat(200)}\n\n${" ".repeat(200)}`;
  const candidate = buildCandidate(context, { withSourceText: true, sourceText: blank });
  const explanation = firstExplanation(candidate);
  const claim = explanation.slice(0, explanation.indexOf(" while "));
  assert.ok(detectCheckableKinds(claim).length > 0);
  const round = await evaluateWithExplanationClaims(candidate, { explanation, claims: [claim], roundId: "round-sf4-empty-span" });
  const issues = sf4Issues(round);
  assert.equal(issues.length, 1, JSON.stringify(issues, null, 2));
  assert.equal(issues[0].severity, "WARN", issues[0].message);
  assert.ok(issues[0].message.includes("rendered empty"), issues[0].message);
  assert.deepEqual(fidelityBlockers(round), []);
});

requiredTest("an excerpted span does NOT weaken the pre-existing wrong-key gate", async (context) => {
  // The deliberate other half of MAJOR 2. An SF4 finding is a finding of
  // ABSENCE and its only evidence is that the judge did not find support, so an
  // excerpt cannot carry it. A wrong-key verdict is not: the judge derives the
  // answer from the question, the choices and the explanation, and before this
  // package it had NO source context at all — an excerpt is strictly more than
  // it ever had. Downgrading QC1.wrong_quiz_key for every large-span book would
  // weaken the gate that caught 21 of 72 wrong keys in `hooked`. The excerpt's
  // honesty lives in the PROMPT (the header above), not in a softer severity.
  const candidate = buildCandidate(context, { withSourceText: true, sourceText: OVERLONG_SOURCE });
  const confident: ModelTaskRunner = {
    async run(request) {
      if (request.context.operationId.startsWith("source-fidelity-judge-")) {
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { findings: [] } };
      }
      return {
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        output: { index: 1, confidence: "high", correctText: "the judge's own choice", reason: "the question settles it" },
      };
    },
  };
  const evaluated = await new CandidateQcEvaluator(
    { async open() { return { ok: true, value: candidate }; } },
    { runner: confident },
  ).run({ candidate, canonicalReview: review(), roundId: "round-excerpt-wrong-key", taskContext: judgeContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  const wrongKey = evaluated.value.issues.filter((entry) => entry.code === "QC1.wrong_quiz_key");
  assert.ok(wrongKey.length > 0, "a confident key disagreement still blocks under an excerpted span");
  assert.ok(wrongKey.every((entry) => entry.severity === "BLOCKER"), JSON.stringify(wrongKey, null, 2));
});

// ── ROUND 2, MINOR 3 ────────────────────────────────────────────────────────
// A deterministic-only composition can still commit a PASS round, and nothing on
// that round said no chapter had been checked against the book. publishableBar
// already models this (`ran: false` => "DID NOT RUN - not a pass"); the QC round
// now carries the same fact, so "every chapter is checked against the book
// before it can ship" is provable from the RECORD and not from how the evaluator
// happened to be composed.

requiredTest("a round whose judges did not run says so on the record", async (context) => {
  const candidate = buildCandidate(context, { withSourceText: true });
  const reader = { async open() { return { ok: true as const, value: candidate }; } };

  // No runner at all — the deterministic gates stand alone.
  const noRunner = await new CandidateQcEvaluator(reader).run({
    candidate,
    canonicalReview: review(),
    roundId: "round-no-runner",
    taskContext: judgeContext(),
  });
  assert.ok(noRunner.ok, JSON.stringify(noRunner));
  const marker = noRunner.value.issues.filter((entry) => entry.code === SOURCE_FIDELITY_NOT_RUN_CODE);
  assert.equal(marker.length, 1, JSON.stringify(noRunner.value.issues.map((entry) => entry.code)));
  assert.equal(marker[0].severity, "WARN", "the deterministic lane is a legitimate composition; the marker changes no verdict");
  assert.ok(marker[0].message.includes("did NOT RUN"), marker[0].message);
  assert.ok(marker[0].message.includes("no model runner was composed"), marker[0].message);
  assert.ok(
    marker[0].message.includes("not evidence that any chapter was checked against the book"),
    marker[0].message,
  );

  // A runner with no task context is the same absence, named differently.
  const noContext = await new CandidateQcEvaluator(reader, { runner: runner(() => ({ findings: [] }), emptyRecorded()) }).run({
    candidate,
    canonicalReview: review(),
    roundId: "round-no-context",
  });
  assert.ok(noContext.ok);
  const contextMarker = noContext.value.issues.filter((entry) => entry.code === SOURCE_FIDELITY_NOT_RUN_CODE);
  assert.equal(contextMarker.length, 1);
  assert.ok(contextMarker[0].message.includes("no model task context was supplied"), contextMarker[0].message);

  // And a round whose judges DID run carries no marker at all.
  const ran = await new CandidateQcEvaluator(reader, { runner: runner(() => ({ findings: [] }), emptyRecorded()) }).run({
    candidate,
    canonicalReview: review(),
    roundId: "round-judges-ran",
    taskContext: judgeContext(),
  });
  assert.ok(ran.ok);
  assert.equal(ran.value.issues.some((entry) => entry.code === SOURCE_FIDELITY_NOT_RUN_CODE), false);
});


finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
