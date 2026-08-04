/**
 * IMP-22 forward-only chapter conductor regressions.
 *
 * Every reviewer executor below is injected and returns canned schema-valid JSON.
 * No live model/provider route is reachable from this suite.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { fxAttemptIdentity, fxChapter, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import type { SourceIntegrityReviewUnitV1 } from "../src/contracts/sourceIntegrityReview.js";
import { sourceUsePlanHash, type SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import type { ChapterV21 } from "../src/types.js";
import { finalizeAttempt, type ChapterAttempt } from "../src/orchestrator/chapterTransaction.js";
import type { PreparedAuthorCandidate } from "../src/orchestrator/authorRun.js";
import {
  FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
  FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
  runForwardChapterConductor,
  type ForwardChapterConductorInputV1,
  type ForwardFrozenReviewConfigV1,
  type ForwardReviewExecutionRequestV1,
  type ForwardReviewExecutionResultV1,
  type ForwardReviewerExecutor,
} from "../src/orchestrator/forwardChapterConductor.js";
import { QUIZ_INTEGRITY_ADJUDICATION_SCHEMA } from "../src/review/quizIntegrityReview.js";
import { READER_EXPERIENCE_RUBRIC_VERSION } from "../src/review/readerExperienceReview.js";
import { SOURCE_INTEGRITY_RUBRIC_VERSION } from "../src/review/sourceIntegrityReview.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  type FixedRoleAssignmentV1,
  type SplitLaneInstrumentManifestV1,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import {
  FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
  FORWARD_DISAGREEMENT_POLICY_SCHEMA,
  FORWARD_ESCALATION_POLICY_SCHEMA,
  buildForwardPanelReviewPolicy,
  type ForwardRoleFreezePoliciesV1,
} from "../src/orchestrator/forwardReviewPolicy.js";

type FixtureCounters = {
  canonicalWrites: number;
  leadWrites: number;
  provenanceWrites: number;
};

type Fixture = {
  input: ForwardChapterConductorInputV1;
  counters: FixtureCounters;
  replaceAuthoritativePlan: (plan: SourceUsePlanV1) => void;
  replaceAuthoritativePacket: (packet: SourcePacketV1) => void;
  canonicalBytes: () => string | null;
  provenancePresent: () => boolean;
  root: string;
  outcome: () => { outcome: string; detail: string } | null;
  cleanup: () => void;
};

function chapter() {
  return fxChapter({
    chapterId: "zz-fixture-book-ch01",
    number: 1,
    title: "Defaults and friction",
    hook: "Friction hides in the defaults nobody questions.",
    breakdown: {
      fastRead: "A team shortened a form and completion rose.",
      deepRead: "Removing a field reduced the work required to continue.",
      fullRead: "The same mechanism applies when a default path carries avoidable steps.",
    },
    keyTakeaway: "Change the default path, not the person.",
    tryThisNow: "Remove one field from a form you own.",
    examples: [{
      title: "The shorter form",
      scenario: "A support team removed one optional field from an intake form.",
      whatToDo: "Cut one field.",
      whyItMatters: "Completion improved.",
    }],
    quiz: {
      passingScorePercent: 70,
      questions: [{
        questionId: "q1",
        prompt: "Why did completion rise?",
        choices: ["The team advertised", "A field was removed", "Users were paid"],
        correctIndex: 1,
        explanation: "Removing the field lowered friction.",
      }],
    },
    reviewCards: [{ front: "What moved behavior?", back: "The default." }],
    implementationPlan: {
      title: "Reduce friction",
      coreSkill: "Spot the default",
      ifThenPlans: [{ context: "designing a form", plan: "cut one field" }],
      twentyFourHourChallenge: "Remove one field.",
      weeklyPractice: "Audit one default a week.",
    },
    memorableLines: [{ text: "Defaults decide.", why: "Compact." }],
  } as Partial<ChapterV21>);
}

function roleAssignment(): FixedRoleAssignmentV1 {
  return {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: { profileId: "reader-model@high", model: "reader-model", effort: "high" },
    readerBackup: { profileId: "reader-backup@high", model: "reader-backup", effort: "high" },
    sourcePrimary: { profileId: "source-model@xhigh", model: "source-model", effort: "xhigh" },
    sourceAdjudicator: { profileId: "source-adjudicator@high", model: "source-adjudicator", effort: "high" },
    quizChecker: { deterministic: true, checkerVersion: "quiz-answer-tell-checker-v1" },
    quizAdjudicator: { profileId: "quiz-model@high", model: "quiz-model", effort: "high" },
  };
}

function frozenConfig(): ForwardFrozenReviewConfigV1 {
  const assignment = roleAssignment();
  const roleAssignmentSha256 = hashCanonical(assignment);
  const manifest: SplitLaneInstrumentManifestV1 = {
    schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    readerRubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    sourceRubricVersion: SOURCE_INTEGRITY_RUBRIC_VERSION,
    readerSchemaSha256: "r".repeat(64),
    sourceSchemaSha256: "s".repeat(64),
    quizAdjudicationSchemaSha256: "q".repeat(64),
    quizPhase2Version: QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
    aggregationVersion: "aggregated-chapter-review-v1",
    roleAssignmentPolicyVersion: "forward-fixed-role-policy-v1",
    fixedRoleAssignmentSha256: roleAssignmentSha256,
    executionProfileHash: "e".repeat(64),
    routePolicyVersion: "subscription-only-v1",
    thresholdsSha256: "t".repeat(64),
    readerCorpusSha256: "a".repeat(64),
    sourceCorpusSha256: "b".repeat(64),
    quizCorpusSha256: "c".repeat(64),
  };
  return {
    schema: FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
    roleAssignment: assignment,
    roleAssignmentSha256,
    instrumentManifest: manifest,
    instrumentManifestSha256: hashCanonical(manifest),
    readerBar: 80,
  };
}

function panelPolicies(): ForwardRoleFreezePoliciesV1 {
  return {
    auditSubset: {
      schema: FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
      policyVersion: "test-all-candidate-reader-audit-v1",
      strategy: "sha256-chapter-coordinate-bucket-v1",
      salt: "forward-conductor-panel-test",
      modulus: 1,
      includedBuckets: [0],
      coordinateFields: ["bookId", "chapterNumber"],
      frozenBeforeCandidateOutput: true,
      outputIndependent: true,
    },
    escalation: {
      schema: FORWARD_ESCALATION_POLICY_SCHEMA,
      sourceHighSeverityRequiresAdjudicator: true,
      quizAmbiguityRequiresAdjudicator: true,
      readerEscalationAdvisoryOnly: true,
      adjudicatorOperationalFailure: "INCONCLUSIVE",
      outputInformedJudgeRotationAllowed: false,
    },
    disagreement: {
      schema: FORWARD_DISAGREEMENT_POLICY_SCHEMA,
      policyVersion: "test-fail-closed-panel-disagreement-v1",
      readerPrimaryAuditDisagreement: "REVISE",
      sourceHighSeverityUnresolvedDisagreement: "INCONCLUSIVE",
      quizDeterministicBlockerPrevails: true,
      quizUnresolvedSemanticDisagreement: "INCONCLUSIVE",
      outputInformedResamplingAllowed: false,
      independenceLimitations: {
        readerAudit: { allowSameExactProfile: false, reason: null, mitigation: null },
        sourceAdjudicator: { allowSameExactProfile: false, reason: null, mitigation: null },
      },
    },
  };
}

function panelFrozenConfig(): ForwardFrozenReviewConfigV1 {
  const base = frozenConfig();
  const panelPolicy = buildForwardPanelReviewPolicy(panelPolicies());
  return { ...base, panelPolicy, panelPolicySha256: hashCanonical(panelPolicy) };
}

function makeFixture(frozen: ForwardFrozenReviewConfigV1 = frozenConfig()): Fixture {
  const root = mkdtempSync(join(tmpdir(), "forward-conductor-test-"));
  const attemptDir = join(root, "attempt");
  const workspaceDir = join(attemptDir, "workspace");
  mkdirSync(workspaceDir, { recursive: true });
  const candidate = chapter();
  const packet: SourcePacketV1 = fxPacket({
    bookId: "zz-fixture-book",
    chapterId: candidate.chapterId,
    chapterNumber: 1,
  });
  const plan: SourceUsePlanV1 = fxPlan({
    bookId: "zz-fixture-book",
    chapterNumber: 1,
    sourcePacketSha256: sourcePacketHash(packet),
    units: [fxPlanUnit({
      unitId: "unit.fact.ch01.fact.1",
      origin: "source_bound",
      form: "explanation",
      claimStrength: "descriptive",
      anchorIds: ["ch01.fact.1"],
    })],
  });
  const planSha = sourceUsePlanHash(plan);
  const packetSha = sourcePacketHash(packet);
  let authoritativePlan = structuredClone(plan);
  let authoritativePacket = structuredClone(packet);
  const bytes = JSON.stringify(candidate, null, 2) + "\n";
  const counters: FixtureCounters = { canonicalWrites: 0, leadWrites: 0, provenanceWrites: 0 };
  let canonicalBytes: string | null = "old canonical bytes";
  let provenance: ReturnType<PreparedAuthorCandidate["io"]["readProvenance"]> = null;
  const attempt: ChapterAttempt = {
    identity: fxAttemptIdentity({
      attemptId: `zz-fixture-book-ch01-author-initial-${Date.now()}`,
      bookId: "zz-fixture-book",
      chapterNumber: 1,
      sourcePlanHash: planSha,
      inputHashes: { sourceUsePlan: planSha, sourcePacket: packetSha },
      expectedBaseSha256: sha256Hex("old canonical bytes"),
    }),
    attemptDir,
    workspaceDir,
    candidateFileName: "zz-fixture-book-ch01.v21-native.chapter.json",
    candidatePath: join(workspaceDir, "zz-fixture-book-ch01.v21-native.chapter.json"),
    evidenceRoot: null,
  };
  const prepared: PreparedAuthorCandidate = {
    bookId: "zz-fixture-book",
    chapterNumber: 1,
    chapterId: candidate.chapterId,
    sessionId: "author-session-1",
    attempt,
    bytes,
    chapter: candidate,
    plan,
    pendingLeadOverride: null,
    io: {
      readPacket: () => authoritativePacket,
      readSourcePlan: () => authoritativePlan,
      readChapterFile: () => canonicalBytes,
      writeChapterFile: (_bookId: string, _chapterNumber: number, nextBytes: string) => { counters.canonicalWrites += 1; canonicalBytes = nextBytes; },
      removeChapterFile: () => { canonicalBytes = null; },
      writeLeadOverride: () => { counters.leadWrites += 1; },
      readLeadOverride: () => null,
      removeLeadOverride: () => undefined,
      recordProvenance: (chapterId: string, sessionId: string, contentHash?: string) => {
        counters.provenanceWrites += 1;
        provenance = { schemaVersion: "author-provenance-v2", chapterId, authorSessionId: sessionId, stampedAt: "2026-01-01T00:00:00.000Z", contentHash };
      },
      readProvenance: () => provenance,
      restoreProvenance: (_chapterId: string, previous: ReturnType<PreparedAuthorCandidate["io"]["readProvenance"]>) => { provenance = previous; },
    } as unknown as PreparedAuthorCandidate["io"],
  };
  let authoritativeSourceSidecar: unknown = { schemaVersion: "source-v1", namedExamples: [] };
  let authoritativeAnchorCatalog = packet.allowedAnchors;
  return {
    input: {
      prepared,
      sourcePacket: packet,
      sourceSidecar: authoritativeSourceSidecar,
      anchorCatalog: packet.allowedAnchors,
      rereadAuthoritativeSourceEvidence: () => ({
        sourceSidecar: authoritativeSourceSidecar,
        anchorCatalog: authoritativeAnchorCatalog,
      }),
      frozen,
    },
    counters,
    replaceAuthoritativePlan: (next) => { authoritativePlan = structuredClone(next); },
    replaceAuthoritativePacket: (next) => { authoritativePacket = structuredClone(next); },
    canonicalBytes: () => canonicalBytes,
    provenancePresent: () => provenance !== null,
    root,
    outcome: () => {
      try { return JSON.parse(readFileSync(join(attemptDir, "outcome.json"), "utf8")) as { outcome: string; detail: string }; }
      catch { return null; }
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function readerOutput(score = 90, advisory = false): string {
  return JSON.stringify({
    schema: "reader-experience-review-v1",
    scores: {
      retention: score, quizzes: score, transfer: score, practical: score, summaries: score,
      tone: score, limits: score, insight: score, density: score, beginner: score,
    },
    quizDerivation: {
      answers: ["b"], mechanisms: ["The prose says a field was removed."],
      confidence: ["high"], ambiguities: [""], tells: [],
    },
    recommendation: advisory ? "REVISE" : "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: advisory
      ? [{ category: "pacing", unit: "deep read", problem: "The middle drags.", evidenceSpans: ["The same mechanism applies"] }]
      : [],
    strongestEvidence: ["Change the default path, not the person."],
    weakestEvidence: [],
    oneParagraphVerdict: "The chapter is usable and clear.",
  });
}

function sourceUnit(over: Partial<SourceIntegrityReviewUnitV1> = {}): SourceIntegrityReviewUnitV1 {
  return {
    unitId: "unit.fact.ch01.fact.1",
    expectedOrigin: "source_bound",
    expectedForm: "explanation",
    claimStrengthExpected: "descriptive",
    visibleRegister: "clearly_sourced",
    supportStatus: "SUPPORTED",
    framingAdequate: null,
    claimStrengthFit: true,
    namedSpecificityAllowed: true,
    chapterEvidenceSpans: ["A team shortened a form and completion rose."],
    sourceEvidenceSpans: ["Synthetic claim ch01.fact.1"],
    findings: [],
    ...over,
  };
}

function sourceOutput(result: "PASS" | "BLOCK" | "INCONCLUSIVE" = "PASS"): string {
  const unit = result === "BLOCK"
    ? sourceUnit({
        supportStatus: "UNSUPPORTED",
        findings: [{ category: "invented_detail", severity: "blocker", explanation: "The claim exceeds the source." }],
      })
    : result === "INCONCLUSIVE"
      ? sourceUnit({
          supportStatus: "INCONCLUSIVE",
          sourceEvidenceSpans: [],
          findings: [{ category: "missing_required_evidence", severity: "major", explanation: "Evidence is missing." }],
        })
      : sourceUnit();
  return JSON.stringify({
    schema: "source-integrity-review-v1",
    units: [unit],
    result,
    blockingFindingIds: result === "BLOCK" ? ["model-source-block"] : [],
    rationale: `source ${result}`,
  });
}

function quizOutput(): string {
  return JSON.stringify({
    schema: QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
    items: [{
      itemId: "q1",
      keyedAnswerIndex: 1,
      derivedAnswerIndex: 1,
      agreement: true,
      keyCorrect: "correct",
      rationale: "Only the removed-field choice is supported.",
      defensibleAnswerIndices: [1],
      keyedMechanismSupported: true,
    }],
  });
}

function echoResult(
  request: ForwardReviewExecutionRequestV1,
  output: string,
  sequence: number,
): ForwardReviewExecutionResultV1 {
  return {
    schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
    executionId: `${request.lane}-execution-${sequence}`,
    lane: request.lane,
    workspaceRole: request.workspaceRole,
    profileId: request.profileId,
    model: request.model,
    effort: request.effort,
    schemaSha256: request.schemaSha256,
    instrumentVersion: request.instrumentVersion,
    roleAssignmentSha256: request.roleAssignmentSha256,
    instrumentManifestSha256: request.instrumentManifestSha256,
    executionProfileHash: request.executionProfileHash,
    routePolicyVersion: request.routePolicyVersion,
    output,
  };
}

function executorFor(opts: {
  events?: string[];
  reader?: string;
  source?: string;
  quiz?: string;
  alter?: (request: ForwardReviewExecutionRequestV1, result: ForwardReviewExecutionResultV1) => ForwardReviewExecutionResultV1;
  after?: (request: ForwardReviewExecutionRequestV1) => void;
} = {}): ForwardReviewerExecutor {
  let sequence = 0;
  return async (request) => {
    sequence += 1;
    opts.events?.push(request.lane);
    const output = request.lane === "reader"
      ? (opts.reader ?? readerOutput())
      : request.lane === "source"
        ? (opts.source ?? sourceOutput())
        : (opts.quiz ?? quizOutput());
    let result = echoResult(request, output, sequence);
    if (opts.alter) result = opts.alter(request, result);
    opts.after?.(request);
    return result;
  };
}

test("fresh PASS keeps the candidate noncanonical through all lanes and commits exactly once at the end", async () => {
  const fixture = makeFixture();
  const events: string[] = [];
  let commitCalls = 0;
  try {
    const result = await runForwardChapterConductor(fixture.input, {
      executor: executorFor({ events }),
      commitPreparedCandidate: (prepared) => {
        events.push("commit");
        commitCalls += 1;
        assert.deepEqual(events, ["reader", "source", "quiz", "commit"], "commit is unreachable before every lane finishes");
        assert.equal(fixture.counters.canonicalWrites, 0, "the conductor has not exposed the candidate canonically");
        fixture.counters.canonicalWrites += 1;
        finalizeAttempt(prepared.attempt, "committed");
        return { ok: true, sessionId: prepared.sessionId, committed: true };
      },
    });

    assert.equal(result.disposition, "COMMITTED");
    assert.equal(result.finalStatus, "PASS");
    assert.equal(commitCalls, 1);
    assert.deepEqual(result.executionEnvelope.executions.map((entry) => `${entry.lane}:${entry.status}`), [
      "reader:VERIFIED", "source:VERIFIED", "quiz:VERIFIED",
    ]);
    assert.ok(result.committedDerivation?.sha256, "quiz derivation is committed before adjudication");
    assert.equal(result.executionEnvelope.derivationSha256, result.committedDerivation?.sha256);
    assert.equal(result.executionEnvelopeSha256, hashCanonical(result.executionEnvelope));
    assert.ok(Object.isFrozen(result.executionEnvelope) && Object.isFrozen(result.executionEnvelope.executions));
    assert.equal(fixture.outcome()?.outcome, "committed");
  } finally {
    fixture.cleanup();
  }
});

test("required retained-result failure CAS-rolls back canonical bytes and provenance", async () => {
  const fixture = makeFixture();
  try {
    const before = fixture.canonicalBytes();
    const result = await runForwardChapterConductor(fixture.input, {
      executor: executorFor(),
      persistCommittedResult: () => { throw new Error("simulated retained-result write/read-back failure"); },
    });
    assert.equal(result.disposition, "COMMIT_FAILED");
    assert.equal(result.finalStatus, "INCONCLUSIVE");
    assert.match(result.reason, /forward review-result persistence failed/i);
    assert.equal(fixture.canonicalBytes(), before, "canonical bytes are restored, not left as an evidence-less PASS");
    assert.equal(fixture.provenancePresent(), false, "provenance companion is rolled back with canonical bytes");
    assert.match(fixture.outcome()?.detail ?? "", /required commit evidence did not persist/i);
  } finally {
    fixture.cleanup();
  }
});

test("REVISE, BLOCK, and INCONCLUSIVE all supersede the attempt without canonical/lead/provenance writes", async () => {
  const cases: Array<{
    name: string;
    executor: ForwardReviewerExecutor;
    expected: "REVISE" | "BLOCK" | "INCONCLUSIVE";
  }> = [
    { name: "revise", executor: executorFor({ reader: readerOutput(70, true) }), expected: "REVISE" },
    { name: "block", executor: executorFor({ source: sourceOutput("BLOCK") }), expected: "BLOCK" },
    { name: "inconclusive", executor: executorFor({ quiz: "not-json" }), expected: "INCONCLUSIVE" },
  ];

  for (const c of cases) {
    const fixture = makeFixture();
    let commitCalls = 0;
    try {
      const result = await runForwardChapterConductor(fixture.input, {
        executor: c.executor,
        commitPreparedCandidate: () => {
          commitCalls += 1;
          throw new Error("non-PASS must never reach commit");
        },
      });
      assert.equal(result.finalStatus, c.expected, c.name);
      assert.equal(result.disposition, "SUPERSEDED", c.name);
      assert.equal(commitCalls, 0, c.name);
      assert.deepEqual(fixture.counters, { canonicalWrites: 0, leadWrites: 0, provenanceWrites: 0 }, c.name);
      assert.equal(fixture.outcome()?.outcome, "superseded", c.name);
    } finally {
      fixture.cleanup();
    }
  }
});

test("a wrong reviewer role/route receipt fails closed and records the rejected execution", async () => {
  const fixture = makeFixture();
  let commitCalls = 0;
  try {
    const result = await runForwardChapterConductor(fixture.input, {
      executor: executorFor({
        alter: (request, result) => request.lane === "source" ? { ...result, model: "wrong-model" } : result,
      }),
      commitPreparedCandidate: () => { commitCalls += 1; throw new Error("must not commit"); },
    });

    assert.equal(result.finalStatus, "INCONCLUSIVE");
    assert.equal(result.disposition, "SUPERSEDED");
    assert.equal(commitCalls, 0);
    assert.match(result.reason, /wrong frozen role\/route.*model/i);
    assert.deepEqual(result.executionEnvelope.executions.map((entry) => entry.status), ["VERIFIED", "REJECTED"]);
    assert.equal(result.executionEnvelope.executions[1].received?.model, "wrong-model");
    assert.equal(fixture.outcome()?.outcome, "superseded");
  } finally {
    fixture.cleanup();
  }
});

test("mutating a frozen assignment/instrument between executions stales the run before the next reviewer call", async () => {
  const fixture = makeFixture();
  const calls: string[] = [];
  try {
    const executor = executorFor({
      events: calls,
      after: (request) => {
        if (request.lane === "reader") fixture.input.frozen.instrumentManifest.routePolicyVersion = "tampered-after-reader";
      },
    });
    const result = await runForwardChapterConductor(fixture.input, {
      executor,
      commitPreparedCandidate: () => { throw new Error("must not commit"); },
    });

    assert.equal(result.finalStatus, "INCONCLUSIVE");
    assert.equal(result.disposition, "SUPERSEDED");
    assert.deepEqual(calls, ["reader"], "source execution is refused before the injected executor is called");
    assert.match(result.reason, /stale frozenReviewConfigSha256|stale\/tampered instrument-manifest hash/i);
    assert.equal(fixture.outcome()?.outcome, "superseded");
  } finally {
    fixture.cleanup();
  }
});

test("candidate mutation after adjudication makes a previously clean aggregate ineligible to commit", async () => {
  const fixture = makeFixture();
  let commitCalls = 0;
  try {
    const executor = executorFor({
      after: (request) => {
        if (request.lane === "quiz") fixture.input.prepared.chapter.keyTakeaway = "mutated after review";
      },
    });
    const result = await runForwardChapterConductor(fixture.input, {
      executor,
      commitPreparedCandidate: () => { commitCalls += 1; throw new Error("must not commit"); },
    });

    assert.equal(result.finalStatus, "INCONCLUSIVE");
    assert.equal(result.disposition, "SUPERSEDED");
    assert.equal(commitCalls, 0);
    assert.match(result.reason, /prepared bytes do not match the reviewed candidate object|stale candidate/i);
    assert.equal(fixture.outcome()?.outcome, "superseded");
  } finally {
    fixture.cleanup();
  }
});

test("authoritative sidecar or anchor archive changes during review refuse the commit even when in-memory inputs are unchanged", async () => {
  for (const kind of ["sidecar", "anchors"] as const) {
    const fixture = makeFixture();
    let commitCalls = 0;
    try {
      const executor = executorFor({
        after: (request) => {
          if (request.lane !== "quiz") return;
          const originalSidecar = fixture.input.sourceSidecar;
          const originalAnchors = fixture.input.anchorCatalog;
          fixture.input.rereadAuthoritativeSourceEvidence = () => kind === "sidecar"
            ? { sourceSidecar: { ...(originalSidecar as Record<string, unknown>), archiveRevision: 2 }, anchorCatalog: originalAnchors }
            : { sourceSidecar: originalSidecar, anchorCatalog: originalAnchors.map((anchor, i) => i === 0 ? { ...anchor, label: `${anchor.label}-changed` } : anchor) };
        },
      });
      const result = await runForwardChapterConductor(fixture.input, {
        executor,
        commitPreparedCandidate: () => { commitCalls += 1; throw new Error("stale archive evidence must not commit"); },
      });
      assert.equal(result.disposition, "SUPERSEDED", kind);
      assert.equal(result.finalStatus, "INCONCLUSIVE", kind);
      assert.equal(commitCalls, 0, kind);
      assert.match(result.reason, new RegExp(`authoritative ${kind === "sidecar" ? "source sidecar" : "anchor catalog"} changed`, "i"), kind);
    } finally {
      fixture.cleanup();
    }
  }
});

test("compiler-owned source-use plan drift after review cannot cross the commit boundary", async () => {
  const fixture = makeFixture();
  let commitCalls = 0;
  try {
    const executor = executorFor({
      after: (request) => {
        if (request.lane !== "quiz") return;
        fixture.replaceAuthoritativePlan({
          ...structuredClone(fixture.input.prepared.plan!),
          compilerVersion: "plan-recompiled-after-review",
        });
      },
    });
    const result = await runForwardChapterConductor(fixture.input, {
      executor,
      commitPreparedCandidate: () => { commitCalls += 1; throw new Error("stale compiler plan must never commit"); },
    });
    assert.equal(result.disposition, "SUPERSEDED");
    assert.equal(result.finalStatus, "INCONCLUSIVE");
    assert.equal(commitCalls, 0);
    assert.equal(fixture.counters.canonicalWrites, 0);
    assert.match(result.reason, /authoritative compiler input changed.*source-use plan hash differs/i);
  } finally {
    fixture.cleanup();
  }
});

test("stale plan, packet, or anchor hashes fail closed before any reviewer executes", async () => {
  const mutations: Array<[string, (input: ForwardChapterConductorInputV1) => void, RegExp]> = [
    ["plan", (input) => { input.prepared.plan!.compilerVersion = "mutated-plan"; }, /not bound to the current source-use plan/i],
    ["packet", (input) => { input.sourcePacket.chapterTitle = "mutated packet"; }, /source-packet input hash is stale/i],
    ["anchors", (input) => { input.anchorCatalog = input.anchorCatalog.map((anchor, i) => i === 0 ? { ...anchor, label: "mutated anchor" } : anchor); }, /anchor catalog is stale/i],
  ];

  for (const [name, mutate, expectedReason] of mutations) {
    const fixture = makeFixture();
    let executorCalls = 0;
    try {
      mutate(fixture.input);
      const result = await runForwardChapterConductor(fixture.input, {
        executor: async () => { executorCalls += 1; throw new Error("stale preflight must refuse"); },
        commitPreparedCandidate: () => { throw new Error("must not commit"); },
      });
      assert.equal(result.finalStatus, "INCONCLUSIVE", name);
      assert.equal(result.disposition, "SUPERSEDED", name);
      assert.equal(executorCalls, 0, name);
      assert.match(result.reason, expectedReason, name);
      assert.equal(fixture.outcome()?.outcome, "superseded", name);
    } finally {
      fixture.cleanup();
    }
  }
});

test("plan, packet, sidecar, and anchor catalog are mandatory preflight inputs", async () => {
  const mutations: Array<[string, (input: ForwardChapterConductorInputV1) => void]> = [
    ["plan", (input) => { input.prepared.plan = null; }],
    ["packet", (input) => { input.sourcePacket = null as unknown as SourcePacketV1; }],
    ["sidecar", (input) => { input.sourceSidecar = null; }],
    ["anchors", (input) => { input.anchorCatalog = null as unknown as typeof input.anchorCatalog; }],
  ];

  for (const [name, mutate] of mutations) {
    const fixture = makeFixture();
    let executorCalls = 0;
    try {
      mutate(fixture.input);
      const result = await runForwardChapterConductor(fixture.input, {
        executor: async (_request) => { executorCalls += 1; throw new Error("preflight must refuse"); },
        commitPreparedCandidate: () => { throw new Error("must not commit"); },
      });
      assert.equal(result.finalStatus, "INCONCLUSIVE", name);
      assert.equal(result.disposition, "SUPERSEDED", name);
      assert.equal(executorCalls, 0, name);
      assert.match(result.reason, new RegExp(`${name === "packet" ? "source packet" : name === "sidecar" ? "source sidecar" : name === "anchors" ? "anchor catalog" : "source-use plan"} is required`, "i"));
      assert.equal(fixture.outcome()?.outcome, "superseded", name);
    } finally {
      fixture.cleanup();
    }
  }
});

test("frozen reader audit executes the fixed backup in a distinct session and categorical disagreement prevents commit", async () => {
  const fixture = makeFixture(panelFrozenConfig());
  const requests: ForwardReviewExecutionRequestV1[] = [];
  let sequence = 0;
  let commitCalls = 0;
  try {
    const result = await runForwardChapterConductor(fixture.input, {
      executor: async (request) => {
        requests.push(request);
        sequence += 1;
        const output = request.lane === "reader"
          ? request.profileId === fixture.input.frozen.roleAssignment.readerBackup.profileId
            ? readerOutput(70, true)
            : readerOutput()
          : request.lane === "source"
            ? sourceOutput("PASS")
            : quizOutput();
        return echoResult(request, output, sequence);
      },
      commitPreparedCandidate: () => {
        commitCalls += 1;
        throw new Error("reader panel disagreement must not commit");
      },
    });

    assert.equal(result.finalStatus, "REVISE");
    assert.equal(result.disposition, "SUPERSEDED");
    assert.equal(commitCalls, 0);
    assert.equal(result.executionEnvelope.readerAuditSelected, true);
    assert.equal(result.executionEnvelope.readerPrimaryCategory, "PASS");
    assert.equal(result.executionEnvelope.readerAuditCategory, "REVISE");
    assert.equal(result.executionEnvelope.readerAuditDisagreement, true);
    assert.ok(result.executionEnvelope.readerAuditResultSha256);
    assert.equal(result.executionEnvelope.readerAuditProfileId, fixture.input.frozen.roleAssignment.readerBackup.profileId);
    assert.deepEqual(result.executionEnvelope.executions.map((entry) => entry.panelRole), [
      "readerPrimary", "readerAudit", "sourcePrimary", "sourceAdjudicator", "quizSemanticAdjudicator",
    ]);
    const readerRequests = requests.filter((request) => request.lane === "reader");
    assert.equal(readerRequests.length, 2);
    assert.deepEqual(readerRequests.map((request) => request.profileId), [
      fixture.input.frozen.roleAssignment.readerPrimary.profileId,
      fixture.input.frozen.roleAssignment.readerBackup.profileId,
    ]);
    assert.ok(
      result.executionEnvelope.executions
        .filter((entry) => entry.panelRole === "readerAudit")
        .every((entry) => entry.artifactHashes.every((artifact) => artifact.kind === "phase1-doc")),
      "reader audit sees reader-facing prose only and cannot acquire source authority",
    );
    assert.notEqual(
      result.executionEnvelope.executions[0].received?.executionId,
      result.executionEnvelope.executions[1].received?.executionId,
      "primary and audit must be distinct sessions",
    );
  } finally {
    fixture.cleanup();
  }
});

test("source non-PASS executes the fixed adjudicator; agreement preserves and disagreement fails INCONCLUSIVE", async () => {
  const cases: Array<{ name: string; adjudicatorOutput: string; expected: "BLOCK" | "INCONCLUSIVE" }> = [
    { name: "agreement", adjudicatorOutput: sourceOutput("BLOCK"), expected: "BLOCK" },
    { name: "structural disagreement", adjudicatorOutput: sourceOutput("PASS"), expected: "INCONCLUSIVE" },
  ];
  for (const c of cases) {
    const fixture = makeFixture(panelFrozenConfig());
    const sourceProfiles: string[] = [];
    let sequence = 0;
    let commitCalls = 0;
    try {
      const result = await runForwardChapterConductor(fixture.input, {
        executor: async (request) => {
          sequence += 1;
          let output: string;
          if (request.lane === "reader") output = readerOutput();
          else if (request.lane === "quiz") output = quizOutput();
          else {
            sourceProfiles.push(request.profileId);
            output = request.profileId === fixture.input.frozen.roleAssignment.sourceAdjudicator.profileId
              ? c.adjudicatorOutput
              : sourceOutput("BLOCK");
          }
          return echoResult(request, output, sequence);
        },
        commitPreparedCandidate: () => { commitCalls += 1; throw new Error("non-PASS panel must not commit"); },
      });

      assert.equal(result.finalStatus, c.expected, c.name);
      assert.equal(result.disposition, "SUPERSEDED", c.name);
      assert.equal(commitCalls, 0, c.name);
      assert.equal(result.executionEnvelope.sourceAdjudicationTriggered, true, c.name);
      assert.equal(result.executionEnvelope.sourceAdjudicationAgreement, c.expected === "BLOCK", c.name);
      assert.ok(result.executionEnvelope.sourceAdjudicatorResultSha256, c.name);
      assert.equal(result.executionEnvelope.sourceAdjudicatorProfileId, fixture.input.frozen.roleAssignment.sourceAdjudicator.profileId, c.name);
      assert.deepEqual(sourceProfiles, [
        fixture.input.frozen.roleAssignment.sourcePrimary.profileId,
        fixture.input.frozen.roleAssignment.sourceAdjudicator.profileId,
      ], `${c.name}: profiles are fixed and never rotate`);
      assert.deepEqual(
        result.executionEnvelope.executions.filter((entry) => entry.lane === "source").map((entry) => entry.panelRole),
        ["sourcePrimary", "sourceAdjudicator"],
        c.name,
      );
    } finally {
      fixture.cleanup();
    }
  }
});

test("source adjudicator operational failure is retained and forces INCONCLUSIVE", async () => {
  const fixture = makeFixture(panelFrozenConfig());
  let sequence = 0;
  let commitCalls = 0;
  try {
    const result = await runForwardChapterConductor(fixture.input, {
      executor: async (request) => {
        sequence += 1;
        if (request.profileId === fixture.input.frozen.roleAssignment.sourceAdjudicator.profileId) {
          throw new Error("simulated adjudicator capacity failure");
        }
        return echoResult(
          request,
          request.lane === "reader" ? readerOutput() : request.lane === "source" ? sourceOutput("BLOCK") : quizOutput(),
          sequence,
        );
      },
      commitPreparedCandidate: () => { commitCalls += 1; throw new Error("operationally inconclusive panel must not commit"); },
    });

    assert.equal(result.finalStatus, "INCONCLUSIVE");
    assert.equal(result.disposition, "SUPERSEDED");
    assert.equal(commitCalls, 0);
    assert.equal(result.executionEnvelope.sourceAdjudicationTriggered, true);
    assert.equal(result.executionEnvelope.sourceAdjudicationAgreement, null);
    assert.equal(result.executionEnvelope.sourceAdjudicatorResultSha256, null);
    assert.match(result.executionEnvelope.panelAdjustmentReasons?.join("\n") ?? "", /operational failure requires INCONCLUSIVE/);
    const adjudication = result.executionEnvelope.executions.find((entry) => entry.panelRole === "sourceAdjudicator");
    assert.equal(adjudication?.status, "REJECTED");
    assert.match(adjudication?.failureReason ?? "", /capacity failure/);
  } finally {
    fixture.cleanup();
  }
});

test("deterministic source blocker remains authoritative while the fixed source adjudicator still executes", async () => {
  const fixture = makeFixture(panelFrozenConfig());
  (fixture.input.prepared.chapter as unknown as Record<string, unknown>).sourceOrigin = "generic";
  fixture.input.prepared.bytes = JSON.stringify(fixture.input.prepared.chapter, null, 2) + "\n";
  const sourceProfiles: string[] = [];
  let sequence = 0;
  try {
    const result = await runForwardChapterConductor(fixture.input, {
      executor: async (request) => {
        sequence += 1;
        if (request.lane === "source") sourceProfiles.push(request.profileId);
        return echoResult(
          request,
          request.lane === "reader" ? readerOutput() : request.lane === "source" ? sourceOutput("PASS") : quizOutput(),
          sequence,
        );
      },
      commitPreparedCandidate: () => { throw new Error("deterministic source blocker must not commit"); },
    });
    assert.equal(result.finalStatus, "BLOCK");
    assert.equal(result.disposition, "SUPERSEDED");
    assert.equal(result.executionEnvelope.sourceAdjudicationTriggered, true);
    assert.equal(result.executionEnvelope.sourceAdjudicationAgreement, true);
    assert.deepEqual(sourceProfiles, [fixture.input.frozen.roleAssignment.sourceAdjudicator.profileId]);
    assert.deepEqual(
      result.executionEnvelope.executions.filter((entry) => entry.lane === "source").map((entry) => entry.panelRole),
      ["sourceAdjudicator"],
      "the deterministic primary result is not re-voted, but the frozen adjudicator session is retained",
    );
  } finally {
    fixture.cleanup();
  }
});

test("stale panel-policy hashes fail before any reviewer spawn", async () => {
  const config = panelFrozenConfig();
  config.panelPolicy!.auditSubset.salt = "tampered-after-freeze";
  const fixture = makeFixture(config);
  let executorCalls = 0;
  try {
    const result = await runForwardChapterConductor(fixture.input, {
      executor: async () => { executorCalls += 1; throw new Error("stale policy must never spawn"); },
      commitPreparedCandidate: () => { throw new Error("stale policy must never commit"); },
    });
    assert.equal(executorCalls, 0);
    assert.equal(result.finalStatus, "INCONCLUSIVE");
    assert.equal(result.disposition, "SUPERSEDED");
    assert.match(result.reason, /panel policy.*hash drift|stale\/tampered panel-policy hash/i);
    assert.equal(result.executionEnvelope.executions.length, 0);
  } finally {
    fixture.cleanup();
  }
});
