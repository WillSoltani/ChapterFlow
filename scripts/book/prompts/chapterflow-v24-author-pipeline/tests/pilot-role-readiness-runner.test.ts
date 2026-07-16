/** s16-forward-pilot-role-readiness-v1 (plan v2 P5) — model-free runner
 * proofs against the REAL frozen corpus and candidate instrument. Proves:
 * (1) happy path reaches PILOT_ROLE_SET_READY at exactly 70 base calls
 *     (sequential stop keeps the 84 ceiling a bound, never a target);
 * (2) a canary semantic failure spends zero holdout calls;
 * (3) the block-level budget gate refuses to start an unfundable profile-role
 *     and the campaign terminates BLOCKED without ever exceeding 84;
 * (4) one typed infrastructure replay is honored, refusal is never replayed;
 * (5) policy_failure latches the campaign fatal after evidence retention;
 * (6) the freeze re-assert trips on post-freeze input mutation;
 * (7) the evaluator can never override conductor-owned metrics;
 * (8) threshold tampering fails closed even past the plan self-hash;
 * (9) the campaign boundary refuses without the literal executeLive and
 *     rejects synthetic seams before any read or write. */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { test, xenv } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { canonicalPretty } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  CANDIDATE_INSTRUMENT_CERT_REL_PATH,
  CANDIDATE_INSTRUMENT_SEAL_REL_PATH,
  IMP24_V3_BUNDLE_REL_PATH,
  PILOT_READINESS_BUDGET,
  PILOT_ROLE_READINESS_V4_EXPERIMENT_ID,
  READINESS_CANARY_GOLD_ADJUDICATIONS_V1,
  READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2,
  READINESS_SOURCE_HOLDOUT_GOLD_ADJUDICATIONS_V1,
  buildPilotRoleReadinessCorpusV4,
  buildPilotRoleReadinessPlanV4,
  type PilotRoleReadinessCorpusV4,
} from "../src/bakeoff/migration/pilotRoleReadinessInstrument.js";
import {
  READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES,
  compilePilotReadinessCaseInstrument,
  createPilotRoleReadinessEvaluator,
  everyReadinessCase,
  type CompiledReadinessCaseV1,
} from "../src/bakeoff/migration/pilotRoleReadinessEvaluator.js";
import {
  buildPilotRoleReadinessPlanForExecution,
  preparePilotReadinessCases,
  runPilotRoleReadiness,
  stampReadinessCandidateAvailability,
  type RunPilotRoleReadinessInputV1,
} from "../src/bakeoff/migration/pilotRoleReadinessRunner.js";
import {
  IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  qualificationReceiptSha256,
  type QualificationExecutionRequestV3,
  type QualificationExecutionReceiptV3,
  type QualificationOutputEvaluatorV3,
  type QualificationReceiptStatusV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
  IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
  discoverCandidateAvailabilityV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import { runPilotRoleReadinessCampaign } from "../src/orchestrator/forwardPilotRoleReadinessCampaign.js";
import { deriveImp24SourceSemantics, type Imp24SourceCase, type Imp24QuizCase } from "../src/bakeoff/migration/imp24Corpus.js";
import type { ChapterV21 } from "../src/types.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const INPUTS_PRESENT = existsSync(resolve(REPOSITORY_ROOT, IMP24_V3_BUNDLE_REL_PATH))
  && existsSync(resolve(REPOSITORY_ROOT, CANDIDATE_INSTRUMENT_SEAL_REL_PATH))
  && existsSync(resolve(REPOSITORY_ROOT, CANDIDATE_INSTRUMENT_CERT_REL_PATH));

// ── Shared frozen input (built once; mutation tests deep-clone) ──────────────

type Ctx = {
  input: RunPilotRoleReadinessInputV1;
  corpus: PilotRoleReadinessCorpusV4;
  evaluate: QualificationOutputEvaluatorV3;
  goldOutputs: Map<string, string>;
};

let ctxMemo: Ctx | null = null;

function fabricatedAvailability(): ReturnType<typeof stampReadinessCandidateAvailability> {
  const verifiedAt = "2026-07-15T12:00:00.000Z";
  const dir = mkdtempSync(join(tmpdir(), "cf-test-readiness-cache-"));
  const cachePath = join(dir, "models_cache.json");
  writeFileSync(cachePath, JSON.stringify({
    fetched_at: verifiedAt,
    client_version: "codex-test-0.0.0",
    models: [
      { slug: "gpt-5.6-sol", visibility: "list", supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }] },
      { slug: "gpt-5.5", visibility: "list", supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }] },
    ],
  }));
  return stampReadinessCandidateAvailability(discoverCandidateAvailabilityV3({
    policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
    policyBytesSha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
    modelsCachePath: cachePath,
    verifiedAt,
  }));
}

function goldRawOutput(compiled: CompiledReadinessCaseV1, payload: Record<string, unknown>): string {
  const refIds = compiled.envelope.segments.map((segment) => segment.refId);
  if (compiled.role === "reader") {
    const chapter = compiled.readerChapter as ChapterV21;
    const gold = compiled.gold as Record<string, unknown>;
    const scores = Object.fromEntries([
      "retention", "quizzes", "transfer", "practical", "summaries",
      "tone", "limits", "insight", "density", "beginner",
    ].map((factor) => [factor, 88]));
    const quizDerivation = {
      answers: chapter.quiz.questions.map((question) => (["a", "b", "c"] as const)[question.correctIndex] ?? "a"),
      mechanisms: chapter.quiz.questions.map(() => "The answer follows from the key-free chapter evidence."),
      confidence: chapter.quiz.questions.map(() => "high"),
      ambiguities: [],
      tells: [],
      evidenceRefIds: chapter.quiz.questions.map(() => [...refIds]),
    };
    const hard = compiled.category === "reader-visible-hard-blocker";
    const craft = compiled.category === "craft-nonblocker";
    const craftAccepted = craft
      ? ((gold.acceptedCraftCategories as string[] | undefined)
        ?? READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES[String(gold.expectedWeakness)])
      : null;
    // Emit the LAST accepted category so widened entries (density-for-pacing,
    // the Option B ruling) are what the happy path actually proves.
    const craftCategory = craftAccepted ? craftAccepted[craftAccepted.length - 1] : null;
    // Adjudicated canary: replay the OBSERVED cross-campaign consensus label
    // (internal_contradiction) — the fixture proves R1 makes it pass.
    const accepted = gold.acceptedBlockingCategories as string[] | undefined;
    const hardCategory = accepted?.includes("internal_contradiction")
      ? "internal_contradiction"
      : gold.expectedBlockingCategory;
    return canonicalJson({
      schema: "reader-experience-model-output-v2",
      scores,
      quizDerivation,
      recommendation: hard ? "BLOCK" : craft ? "REVISE" : "SHIP",
      blockingFindings: hard ? [{
        category: hardCategory,
        unit: "chapter",
        problem: "The deterministic fixture exposes the declared reader-visible blocker.",
        evidenceRefIds: [...refIds],
      }] : [],
      escalationSignals: [],
      advisoryFindings: craft ? [{
        category: craftCategory,
        unit: "chapter",
        problem: `The deterministic fixture exposes the declared ${String(gold.expectedWeakness)} craft weakness.`,
        evidenceRefIds: [...refIds],
      }] : [],
      strongestEvidenceRefIds: [...refIds],
      weakestEvidenceRefIds: [...refIds],
      oneParagraphVerdict: `Model-free readiness fixture for ${compiled.caseId}.`,
    });
  }
  if (compiled.role === "source") {
    const item = payload as unknown as Imp24SourceCase;
    // EFFECTIVE gold (adjudication overlay applied for the canary); emit the
    // observed consensus primary (unsupported_attribution) when accepted.
    const gold = compiled.gold as ReturnType<typeof deriveImp24SourceSemantics> & {
      acceptedPrimaryCategories?: string[];
    };
    const emittedPrimary = gold.acceptedPrimaryCategories?.[0] ?? gold.primaryCategory;
    const emittedSupport = (gold as { acceptedSupport?: string[] }).acceptedSupport?.[0] ?? gold.supportStatus;
    const emittedRegister = (gold as { acceptedRegisters?: string[] }).acceptedRegisters?.[0] ?? gold.visibleRegister;
    const chapterRef = compiled.envelope.segments.find((segment) => segment.kind === "chapter")?.refId;
    const sourceRef = compiled.envelope.segments.find((segment) => segment.kind === "source_claim")?.refId;
    const planRef = compiled.envelope.segments.find((segment) => segment.kind === "plan")?.refId;
    const sourceEvidenceRefIds = item.evidence.sourceUsePlanUnit.origin === "source_bound"
      ? sourceRef ? [sourceRef] : []
      : gold.primaryCategory !== null ? [planRef] : [];
    return canonicalJson({
      schema: "source-integrity-model-output-v2",
      assessments: [{
        targetRef: "U1",
        visibleRegister: emittedRegister,
        supportStatus: emittedSupport,
        framingAdequate: gold.framingAdequate,
        claimStrengthFit: gold.claimStrengthFit,
        namedSpecificityAllowed: gold.namedSpecificityAllowed,
        findings: emittedPrimary ? [{
          primaryCategory: emittedPrimary,
          secondaryCategories: gold.secondaryCategories,
          severity: "blocker",
          explanation: `The deterministic fixture exposes ${emittedPrimary}.`,
          chapterEvidenceRefIds: [chapterRef],
          sourceEvidenceRefIds,
        }] : [],
        rationale: `Model-free readiness fixture for ${compiled.caseId}.`,
      }],
    });
  }
  const item = payload as unknown as Imp24QuizCase;
  const mechanismExcluded = (compiled.gold as { keyedMechanismComparison?: unknown }).keyedMechanismComparison
    === "excluded-from-semantic-comparison";
  return canonicalJson({
    schema: "quiz-integrity-model-output-v2",
    items: [{
      questionRef: "Q1",
      keyCorrect: item.expected.keyCorrect,
      defensibleAnswerIndices: [...(item.expected.defensibleAnswerIndices as number[])],
      // R3: on key-mismatch items the field is excluded from comparison; the
      // fixture replays the observed 5/5 consensus value to prove it.
      keyedMechanismSupported: mechanismExcluded ? false : item.expected.keyedMechanismSupported,
      rationale: `Model-free readiness fixture for ${compiled.caseId}.`,
      evidenceRefIds: refIds,
    }],
  });
}

function ctx(): Ctx {
  if (ctxMemo) return ctxMemo;
  const corpus = buildPilotRoleReadinessCorpusV4({ repositoryRoot: REPOSITORY_ROOT });
  const plan = buildPilotRoleReadinessPlanV4({ repositoryRoot: REPOSITORY_ROOT, corpus });
  const sealBytes = readFileSync(resolve(REPOSITORY_ROOT, CANDIDATE_INSTRUMENT_SEAL_REL_PATH));
  const certBytes = readFileSync(resolve(REPOSITORY_ROOT, CANDIDATE_INSTRUMENT_CERT_REL_PATH));
  const prepared = preparePilotReadinessCases({ repositoryRoot: REPOSITORY_ROOT, corpus });
  const input: RunPilotRoleReadinessInputV1 = {
    experimentId: PILOT_ROLE_READINESS_V4_EXPERIMENT_ID,
    corpus,
    plan,
    planBytesSha256: sha256Hex(Buffer.from(canonicalPretty(plan), "utf8")),
    certification: JSON.parse(certBytes.toString("utf8")),
    certificationRawBytesSha256: sha256Hex(certBytes),
    productionInstrumentSeal: JSON.parse(sealBytes.toString("utf8")),
    productionInstrumentSealRawBytesSha256: sha256Hex(sealBytes),
    candidateAvailability: fabricatedAvailability(),
    schemaHashes: prepared.schemaHashes,
    promptSourceHashes: prepared.promptSourceHashes,
    preparedCases: prepared.preparedCases,
  };
  const goldOutputs = new Map<string, string>();
  for (const entry of everyReadinessCase(corpus)) {
    const compiled = compilePilotReadinessCaseInstrument(entry, READINESS_CANARY_GOLD_ADJUDICATIONS_V1, READINESS_CRAFT_WEAKNESS_ACCEPTED_CATEGORIES_V2, READINESS_SOURCE_HOLDOUT_GOLD_ADJUDICATIONS_V1);
    goldOutputs.set(entry.caseId, goldRawOutput(compiled, entry.payload));
  }
  ctxMemo = { input, corpus, evaluate: createPilotRoleReadinessEvaluator(corpus), goldOutputs };
  return ctxMemo;
}

type ExecutorPlanEntry = { status?: QualificationReceiptStatusV3; rawOutput?: string };

/** Fake ChatGPT-route executor returning route-valid receipts. `override`
 * keys match `caseId` (every attempt) or exact `attemptId`. */
function fakeExecutor(
  goldOutputs: Map<string, string>,
  override: Record<string, ExecutorPlanEntry> = {},
): { executor: (request: QualificationExecutionRequestV3) => Promise<QualificationExecutionReceiptV3>; calls: string[] } {
  const calls: string[] = [];
  const executor = async (request: QualificationExecutionRequestV3): Promise<QualificationExecutionReceiptV3> => {
    calls.push(request.attemptId);
    const plan = override[request.attemptId] ?? override[request.caseId] ?? {};
    const status = plan.status ?? "completed";
    const core = {
      schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
      executionId: `test-${request.attemptId}`,
      status,
      requestSha256: request.requestSha256,
      freezeSha256: request.freezeSha256,
      certificationSha256: request.certificationSha256,
      productionInstrumentSealSha256: request.productionInstrumentSealSha256,
      role: request.role,
      profileId: request.profileId,
      model: request.model,
      effort: request.effort,
      schemaSha256: request.schemaSha256,
      reviewProtocol: request.reviewProtocol,
      evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
      evidenceEnvelopeBytes: request.evidenceEnvelopeBytes,
      rawOutput: status === "completed"
        ? plan.rawOutput ?? goldOutputs.get(request.caseId) ?? ""
        : null,
      ...(status === "completed" ? {} : { failureDetail: `synthetic ${status}` }),
    };
    return { ...core, receiptSha256: qualificationReceiptSha256(core as never) } as QualificationExecutionReceiptV3;
  };
  return { executor, calls };
}

// ── 1. Happy path ────────────────────────────────────────────────────────────

xenv(
  "readiness runner reaches PILOT_ROLE_SET_READY at 70 base calls (84 is a bound, not a target)",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  async () => {
    const { input, evaluate, goldOutputs } = ctx();
    const { executor, calls } = fakeExecutor(goldOutputs);
    const result = await runPilotRoleReadiness(input, { executor, evaluateOutput: evaluate });
    assert.equal(result.terminalState, "PILOT_ROLE_SET_READY");
    assert.equal(result.blockedReason, null);
    // Sequential stop: reader first two qualify, source first two, quiz first.
    assert.deepEqual(result.qualifiers.reader, ["gpt-5.6-sol@high", "gpt-5.5@high"]);
    assert.deepEqual(result.qualifiers.source, ["gpt-5.6-sol@xhigh", "gpt-5.5@xhigh"]);
    assert.deepEqual(result.qualifiers.quiz, ["gpt-5.6-sol@xhigh"]);
    assert.equal(result.selected.readerPrimary, "gpt-5.6-sol@high");
    assert.equal(result.selected.quizSemanticAdjudicator, "gpt-5.6-sol@xhigh");
    // (2 canary + 12 holdout) x (2 reader + 2 source + 1 quiz) = 70.
    assert.equal(result.baseCallsAttempted, 70);
    assert.equal(result.totalAttempts, 70);
    assert.equal(result.infrastructureReplays, 0);
    assert.equal(calls.length, 70);
    assert.equal(result.budgetExhausted, false);
    const stopped = result.profileRoleResults.filter((item) => item.status === "NOT_TESTED_SEQUENTIAL_STOP");
    assert.equal(stopped.length, 7); // reader p3,p4 + source p3,p4 + quiz p2,p3,p4
    const ready = result.profileRoleResults.filter((item) => item.status === "READY");
    assert.equal(ready.length, 5);
    for (const item of ready) {
      assert.equal(item.outcome?.failedThresholds.length, 0);
      assert.deepEqual(item.outcome?.counts.canarySemanticCorrectness, { numerator: 2, denominator: 2 });
    }
    const sourceReady = ready.find((item) => item.role === "source");
    assert.deepEqual(sourceReady?.outcome?.counts.missingEvidenceInconclusive, { numerator: 1, denominator: 1 });
    assert.deepEqual(sourceReady?.outcome?.counts.highSeverityDefectSensitivity, { numerator: 10, denominator: 10 });
  },
);

// ── 2. Canary semantic failure spends zero holdout calls ────────────────────

xenv(
  "a reader canary semantic failure yields NOT_QUALIFIED_CANARY with zero holdout calls",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  async () => {
    const { input, corpus, evaluate, goldOutputs } = ctx();
    // First reader profile: fail the acceptable canary semantically. The
    // wrong output must stay protocol-VALID against the acceptable envelope,
    // so start from that case's own gold and add a blocking finding citing
    // its own resolvable evidence refs (BLOCK on an acceptable chapter).
    const acceptableCanaryId = corpus.reader.canary[0].caseId;
    const gold = JSON.parse(goldOutputs.get(acceptableCanaryId)!) as {
      strongestEvidenceRefIds: string[];
    } & Record<string, unknown>;
    const wrongOutput = canonicalJson({
      ...gold,
      recommendation: "BLOCK",
      blockingFindings: [{
        category: "unusable",
        unit: "chapter",
        problem: "Synthetic false blocker on an adjudicated-acceptable chapter.",
        evidenceRefIds: [...gold.strongestEvidenceRefIds],
      }],
    });
    // Only profile 1 (sol@high) sees the failure; later profiles get gold.
    const { executor, calls } = fakeExecutor(goldOutputs, {
      "rdy-reader-p1-canary-c01-a1": { rawOutput: wrongOutput },
    });
    const result = await runPilotRoleReadiness(input, { executor, evaluateOutput: evaluate });
    const p1 = result.profileRoleResults.find((item) => item.role === "reader" && item.candidateOrdinal === 0);
    assert.equal(p1?.status, "NOT_QUALIFIED_CANARY");
    assert.equal(p1?.holdoutStarted, false);
    assert.equal(p1?.attempts, 2);
    // The role still completes with the next two candidates.
    assert.deepEqual(result.qualifiers.reader, ["gpt-5.5@high", "gpt-5.6-sol@xhigh"]);
    assert.equal(result.terminalState, "PILOT_ROLE_SET_READY");
    // 2 wasted canaries + 3 full reader blocks... reader p1 2, p2 14, p3 14 = 30; source 28; quiz 14.
    assert.equal(result.baseCallsAttempted, 72);
    assert.equal(calls.length, 72);
  },
);

// ── 3. Budget gate ───────────────────────────────────────────────────────────

xenv(
  "budget gate: unfundable profile-roles are never started and the ceiling is never exceeded",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  async () => {
    const { input, corpus, evaluate, goldOutputs } = ctx();
    // Quiz-first (C3): quiz p1 qualifies (14). Source: p1 fails via wrong
    // register (14), p2 + p3 qualify (28) -> 56. Reader: every profile fails
    // its craft holdout; p1 + p2 burn 28 -> 84 exactly; p3/p4 are unfundable.
    const override: Record<string, ExecutorPlanEntry> = {};
    for (const entry of corpus.reader.holdout) {
      if (entry.category !== "craft-nonblocker") continue;
      const gold = JSON.parse(goldOutputs.get(entry.caseId)!) as { advisoryFindings: unknown[] };
      override[entry.caseId] = { rawOutput: canonicalJson({ ...gold, advisoryFindings: [] }) };
    }
    for (const entry of corpus.source.holdout) {
      const gold = JSON.parse(goldOutputs.get(entry.caseId)!) as {
        assessments: Array<Record<string, unknown>>;
      };
      const unit = gold.assessments[0];
      const flipped = unit.visibleRegister === "clearly_sourced" ? "presented_as_fact" : "clearly_sourced";
      // Wrong register for source profile 1 only: key by attemptId prefix p1.
      for (const attempt of ["a1"]) {
        override[`rdy-source-p1-holdout-c${String(corpus.source.holdout.indexOf(entry) + 1).padStart(2, "0")}-${attempt}`] = {
          rawOutput: canonicalJson({ ...gold, assessments: [{ ...unit, visibleRegister: flipped }] }),
        };
      }
    }
    const { executor, calls } = fakeExecutor(goldOutputs, override);
    const result = await runPilotRoleReadiness(input, { executor, evaluateOutput: evaluate });
    assert.equal(result.terminalState, "BLOCKED_ROLE_READINESS");
    assert.equal(result.budgetExhausted, true);
    assert.equal(result.baseCallsAttempted, 84);
    assert.ok(result.baseCallsAttempted <= PILOT_READINESS_BUDGET.baseMaximumCalls);
    assert.equal(calls.length, 84);
    // Every reader profile failed on craft detection; no reader qualified.
    assert.deepEqual(result.qualifiers.reader, []);
    const readerStatuses = result.profileRoleResults
      .filter((item) => item.role === "reader")
      .map((item) => item.status);
    assert.deepEqual(readerStatuses, [
      "NOT_QUALIFIED", "NOT_QUALIFIED",
      "NOT_TESTED_BUDGET_EXHAUSTED", "NOT_TESTED_BUDGET_EXHAUSTED",
    ]);
    const readerFails = result.profileRoleResults.filter((item) => item.role === "reader" && item.status === "NOT_QUALIFIED");
    assert.ok(readerFails.every((item) => item.outcome?.failedThresholds.some((id) => id.startsWith("craftCategoryDetected"))));
    const sourceStatuses = result.profileRoleResults
      .filter((item) => item.role === "source")
      .map((item) => item.status);
    assert.deepEqual(sourceStatuses, ["NOT_QUALIFIED", "READY", "READY", "NOT_TESTED_SEQUENTIAL_STOP"]);
    assert.deepEqual(result.qualifiers.quiz, ["gpt-5.6-sol@xhigh"]);
    assert.match(result.blockedReason ?? "", /base budget exhausted/);
  },
);

// ── 4. Replay policy ─────────────────────────────────────────────────────────

xenv(
  "one typed infrastructure replay is honored; refusal is never replayed",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  async () => {
    const { input, evaluate, goldOutputs } = ctx();
    const timeoutAttempt = "rdy-reader-p1-holdout-c01-a1";
    // Refuse only quiz profile 1's first holdout case (keyed by attemptId so
    // later quiz profiles are untouched).
    const refusalAttempt = "rdy-quiz-p1-holdout-c01-a1";
    const { executor, calls } = fakeExecutor(goldOutputs, {
      [timeoutAttempt]: { status: "timeout" },
      [refusalAttempt]: { status: "refusal" },
    });
    const result = await runPilotRoleReadiness(input, { executor, evaluateOutput: evaluate });
    // Timeout: replayed once, then gold; the reader profile still qualifies.
    assert.equal(result.infrastructureReplays, 1);
    assert.ok(calls.includes("rdy-reader-p1-holdout-c01-a2"));
    assert.deepEqual(result.qualifiers.reader, ["gpt-5.6-sol@high", "gpt-5.5@high"]);
    // Refusal: terminal on attempt 1 — never replayed.
    assert.ok(!calls.includes("rdy-quiz-p1-holdout-c01-a2"));
    const refusalAttempts = result.attempts.filter((attempt) => attempt.request.attemptId === refusalAttempt);
    assert.equal(refusalAttempts.length, 1);
    assert.equal(refusalAttempts[0].protocolValid, false);
    assert.equal(refusalAttempts[0].replayEligible, false);
    // Quiz profile 1 fails protocolValidity zero-miss; profile 2 must qualify.
    const quiz1 = result.profileRoleResults.find((item) => item.role === "quiz" && item.candidateOrdinal === 0);
    assert.equal(quiz1?.status, "NOT_QUALIFIED");
    assert.ok(quiz1?.outcome?.failedThresholds.some((id) => id.startsWith("protocolValidity")));
    assert.deepEqual(result.qualifiers.quiz, ["gpt-5.5@xhigh"]);
    assert.equal(result.terminalState, "PILOT_ROLE_SET_READY");
  },
);

// ── 5. Fatal latch ───────────────────────────────────────────────────────────

xenv(
  "policy_failure latches the campaign fatal after evidence retention",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  async () => {
    const { input, evaluate, goldOutputs } = ctx();
    const fatalAttempt = "rdy-quiz-p1-canary-c01-a1";
    const retained: string[] = [];
    const { executor, calls } = fakeExecutor(goldOutputs, {
      [fatalAttempt]: { status: "policy_failure" },
    });
    await assert.rejects(
      runPilotRoleReadiness(input, {
        executor,
        evaluateOutput: evaluate,
        retainAttemptEvaluation: (attempt) => { retained.push(attempt.request.attemptId); },
      }),
      /campaign-fatal policy_failure receipt/,
    );
    // The fatal attempt's evidence was retained before the latch tripped, and
    // the pool drained without pulling meaningfully further work.
    assert.ok(retained.includes(fatalAttempt));
    assert.ok(calls.length <= 2, `fatal latch must stop the pool immediately (saw ${calls.length} calls)`);
  },
);

// ── 6. Freeze re-assert ──────────────────────────────────────────────────────

xenv(
  "post-freeze input mutation trips the per-call freeze re-assert",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  async () => {
    const { input, evaluate, goldOutputs } = ctx();
    const mutable: RunPilotRoleReadinessInputV1 = {
      ...input,
      promptSourceHashes: { ...input.promptSourceHashes },
    };
    let mutated = false;
    const gold = fakeExecutor(goldOutputs);
    const executor = async (request: QualificationExecutionRequestV3): Promise<QualificationExecutionReceiptV3> => {
      if (!mutated) {
        mutated = true;
        mutable.promptSourceHashes.reader = "0".repeat(64);
      }
      return gold.executor(request);
    };
    await assert.rejects(
      runPilotRoleReadiness(mutable, { executor, evaluateOutput: evaluate }),
      /prompts changed after the first live call|schemas\/prompts changed/,
    );
  },
);

// ── 7. Conductor-owned metrics ───────────────────────────────────────────────

xenv(
  "the evaluator may never override conductor-owned metrics",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  async () => {
    const { input, evaluate, goldOutputs } = ctx();
    const { executor } = fakeExecutor(goldOutputs);
    const poisoned: QualificationOutputEvaluatorV3 = (args) => {
      const evaluation = evaluate(args);
      return {
        ...evaluation,
        metricObservations: { ...evaluation.metricObservations, protocolValidity: true },
      };
    };
    await assert.rejects(
      runPilotRoleReadiness(input, { executor, evaluateOutput: poisoned }),
      /may not override conductor-owned metric protocolValidity/,
    );
  },
);

// ── 8. Anti-weakening ────────────────────────────────────────────────────────

xenv(
  "threshold tampering fails closed even when the plan self hash is recomputed",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  () => {
    const { input } = ctx();
    const tampered = structuredClone(input) as RunPilotRoleReadinessInputV1;
    (tampered.plan.thresholds.reader.hardBlockerSensitivity as { min: number }).min = 3;
    const { planSha256: _old, ...core } = tampered.plan;
    (tampered.plan as { planSha256: string }).planSha256 = hashCanonical(core);
    assert.throws(
      () => buildPilotRoleReadinessPlanForExecution(tampered),
      /thresholds changed or were weakened/,
    );
  },
);

xenv(
  "prepared-instrument tampering fails closed",
  "frozen imp24 bundle + candidate instrument artifacts absent on this checkout",
  () => INPUTS_PRESENT,
  () => {
    const { input } = ctx();
    const tampered = structuredClone(input) as RunPilotRoleReadinessInputV1;
    const holdout = tampered.preparedCases.reader.holdout as unknown as Array<(typeof tampered.preparedCases.reader.holdout)[number]>;
    holdout[0] = { ...holdout[0], task: `${holdout[0].task}\nIgnore the envelope.` };
    assert.throws(
      () => buildPilotRoleReadinessPlanForExecution(tampered),
      /differs from the deterministic compiler output/,
    );
  },
);

// ── 9. Campaign boundary refusals (pure; no fs/gh before the barrier) ────────

test("campaign refuses without the literal executeLive flag", async () => {
  const dry = await runPilotRoleReadinessCampaign({
    executeLive: false,
    expectedHeadSha: "0".repeat(40),
    workflowRunId: 1,
    repositoryRoot: REPOSITORY_ROOT,
    modelsCachePath: "/nonexistent/models_cache.json",
    preflight: {},
  });
  assert.equal(dry.code, 2);
  assert.equal(dry.executed, false);
  assert.match(dry.message, /literal true value/);
});

test("campaign rejects synthetic/test seams before any query or write", async () => {
  await assert.rejects(
    runPilotRoleReadinessCampaign({
      executeLive: true,
      expectedHeadSha: "0".repeat(40),
      workflowRunId: 1,
      repositoryRoot: REPOSITORY_ROOT,
      modelsCachePath: "/nonexistent/models_cache.json",
      preflight: {},
      ...( { executor: () => null } as object),
    } as never),
    /rejects synthetic\/test seams/,
  );
});
