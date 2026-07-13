/** IMP-22 pilot/gold live-call budget and crash-safe ledger tests. */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
  FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
  type ForwardReviewExecutionRequestV1,
} from "../src/orchestrator/forwardChapterConductor.js";
import {
  ForwardReviewerExecutorError,
} from "../src/orchestrator/forwardReviewerExecutor.js";
import {
  FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
  FORWARD_DISAGREEMENT_POLICY_SCHEMA,
  FORWARD_ESCALATION_POLICY_SCHEMA,
  buildForwardPanelReviewPolicy,
} from "../src/orchestrator/forwardReviewPolicy.js";
import {
  buildForwardLivePhaseBudget,
  createForwardLiveCallLedger,
  createLedgeredForwardReviewerExecutor,
  runLedgeredForwardModelOperation,
} from "../src/orchestrator/forwardLiveCallLedger.js";
import {
  FORWARD_CHAPTER_STRATA,
  buildGoldManifest,
  buildPilotManifest,
  type ForwardBookSelectionCandidateV1,
  type ForwardChapterStratum,
  type ForwardSourceCoordinateV1,
} from "../src/orchestrator/forwardValidationCampaign.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const SHA = "a".repeat(64);

function coordinate(bookId: string, chapterNumber: number, stratum: ForwardChapterStratum): ForwardSourceCoordinateV1 {
  return {
    bookId,
    chapterNumber,
    chapterId: `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
    stratum,
    sourceComplete: true,
    evidenceFresh: true,
    sourceUsePlanSha256: sha256Hex(`plan-${bookId}-${chapterNumber}`),
    sourcePacketSha256: sha256Hex(`packet-${bookId}-${chapterNumber}`),
    sidecarSha256: sha256Hex(`sidecar-${bookId}-${chapterNumber}`),
    anchorCatalogSha256: sha256Hex(`anchors-${bookId}-${chapterNumber}`),
    sourceArchiveId: `archive-${bookId}`,
    riskSignals: [],
  };
}

function book(bookId: string, count: number): ForwardBookSelectionCandidateV1 {
  return {
    bookId,
    sourceComplete: true,
    representativeTags: ["fixture"],
    chapters: Array.from({ length: count }, (_, index) => coordinate(
      bookId,
      index + 1,
      FORWARD_CHAPTER_STRATA[index % FORWARD_CHAPTER_STRATA.length],
    )),
  };
}

const COMMON = {
  frozenAtIso: "2026-07-12T12:00:00.000Z",
  roleAssignmentSha256: "b".repeat(64),
  instrumentManifestSha256: "c".repeat(64),
  thresholdsSha256: "d".repeat(64),
  inputMaterializationSha256: "e".repeat(64),
  productionInstrumentSealSha256: "f".repeat(64),
  goldEvaluatorInstrumentSha256: "9".repeat(64),
  qualificationBookIds: ["qualification-only"],
};

function panelPolicy() {
  return buildForwardPanelReviewPolicy({
    auditSubset: {
      schema: FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
      policyVersion: "fixture-audit-v1",
      strategy: "sha256-chapter-coordinate-bucket-v1",
      salt: "fixture-audit-salt",
      modulus: 4,
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
      policyVersion: "fixture-disagreement-v1",
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
  });
}

function pilotManifest() {
  return buildPilotManifest({ ...COMMON, books: [book("pilot-a", 4), book("pilot-b", 4)] });
}

function request(): ForwardReviewExecutionRequestV1 {
  const content = "candidate reader document\n";
  return {
    schema: FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
    lane: "reader",
    reviewOperationKey: "reader",
    workspaceRole: "direct-reader",
    profileId: "gpt-5.6-sol@high",
    model: "gpt-5.6-sol",
    effort: "high",
    schemaSha256: SHA,
    instrumentVersion: "reader-experience-review-v1",
    roleAssignmentSha256: "b".repeat(64),
    instrumentManifestSha256: "c".repeat(64),
    executionProfileHash: "e".repeat(64),
    routePolicyVersion: "route-policy-v1.0",
    task: "Review the reader document.",
    artifacts: [{ kind: "phase1-doc", relPath: "candidate.md", content, sha256: sha256Hex(content) }],
  };
}

test("live phase budgets freeze clean-pass expectations and conservative non-target maxima", () => {
  const pilot = pilotManifest();
  const pilotBudget = buildForwardLivePhaseBudget({ manifest: pilot, panelPolicy: panelPolicy() });
  assert.equal(pilotBudget.targetCount, 8);
  assert.equal(pilotBudget.expectedCalls["pilot-author-first-write"], 8);
  assert.equal(pilotBudget.expectedCalls["pilot-reader-primary"], 8);
  assert.equal(pilotBudget.expectedCalls["pilot-source-primary"], 8);
  assert.equal(pilotBudget.expectedCalls["pilot-source-adjudicator"], 0);
  assert.equal(pilotBudget.maximumCallsBeforeInfrastructureReplays["pilot-author-repair"], 8);
  assert.equal(pilotBudget.maximumCallsBeforeInfrastructureReplays["pilot-source-adjudicator"], 24);
  assert.equal(pilotBudget.hardMaximumCalls, pilotBudget.maximumTotalCallsBeforeInfrastructureReplays * 2);
  assert.equal(pilotBudget.maximumIsNotATarget, true);
  assert.equal(pilotBudget.apiCallsAllowed, 0);

  const partitionCounts = Object.fromEntries(pilot.manifest.targets.map((target) => [
    `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`,
    target.bookId === "pilot-a" && target.chapterNumber === 1
      ? 2
      : target.bookId === "pilot-b" && target.chapterNumber === 2
        ? 3
        : 1,
  ]));
  const partitionedBudget = buildForwardLivePhaseBudget({
    manifest: pilot,
    panelPolicy: panelPolicy(),
    sourcePartitionCountByChapter: partitionCounts,
  });
  assert.equal(partitionedBudget.sourcePartitionCountTotal, 11);
  assert.deepEqual(partitionedBudget.sourcePartitionCountByChapter, partitionCounts);
  assert.equal(partitionedBudget.expectedCalls["pilot-source-primary"], 11);
  assert.equal(partitionedBudget.maximumCallsBeforeInfrastructureReplays["pilot-source-primary"], 33);
  assert.equal(partitionedBudget.maximumCallsBeforeInfrastructureReplays["pilot-source-adjudicator"], 33);
  assert.throws(() => buildForwardLivePhaseBudget({
    manifest: pilot,
    panelPolicy: panelPolicy(),
    sourcePartitionCountByChapter: { ...partitionCounts, "pilot-a/ch01": 0 },
  }), /positive integer/);
  const incompleteCounts = { ...partitionCounts };
  delete incompleteCounts["pilot-a/ch01"];
  assert.throws(() => buildForwardLivePhaseBudget({
    manifest: pilot,
    panelPolicy: panelPolicy(),
    sourcePartitionCountByChapter: incompleteCounts,
  }), /coordinates differ/);

  const gold = buildGoldManifest({
    ...COMMON,
    books: [book("gold-book", 10)],
    pilotBookIds: ["pilot-a", "pilot-b"],
    pilotAccepted: true,
    pilotManifestSha256: pilot.manifestSha256,
    pilotResultSha256: hashCanonical({ accepted: true }),
  });
  assert.throws(() => buildForwardLivePhaseBudget({ manifest: gold, panelPolicy: panelPolicy() }), /evaluator calls/);
  const goldBudget = buildForwardLivePhaseBudget({
    manifest: gold,
    panelPolicy: panelPolicy(),
    goldBookEvaluatorExpectedCalls: 4,
    goldBookEvaluatorMaximumCallsBeforeReplay: 4,
  });
  assert.equal(goldBudget.expectedCalls["gold-book-evaluator"], 4);
  assert.equal(goldBudget.maximumInfrastructureReplays["gold-book-evaluator"], 4);
});

test("reviewer ledger retains exact inline task and evidence-envelope bytes", async () => {
  const roots = mkTestRoots("forward-live-exact-review-request");
  try {
    const phaseDir = join(roots.base, "phase");
    const controller = createForwardLiveCallLedger({
      budget: buildForwardLivePhaseBudget({ manifest: pilotManifest(), panelPolicy: panelPolicy() }),
      phaseDir,
    });
    const envelopeBytes = "{\"schema\":\"review-evidence-envelope-v1\",\"marker\":\"exact-byte-proof\"}\n";
    const task = `All evidence is inline.\n${envelopeBytes}`;
    const req: ForwardReviewExecutionRequestV1 = {
      ...request(),
      reviewOperationKey: "U1",
      reviewProtocol: "review-evidence-envelope-v1",
      evidenceEnvelopeSha256: sha256Hex("semantic-envelope"),
      evidenceEnvelopeBytesSha256: sha256Hex(envelopeBytes),
      task,
      artifacts: [{
        kind: "evidence-envelope",
        relPath: "review-envelope-source-U1.json",
        content: envelopeBytes,
        sha256: sha256Hex(envelopeBytes),
      }],
    };
    const logicalOperationId = "pilot-a/ch01/first-write/sourcePrimary/U1";
    const wrapped = createLedgeredForwardReviewerExecutor({
      controller,
      phaseDir,
      contextFor: () => ({
        bookId: "pilot-a",
        chapterNumber: 1,
        stage: "first-write",
        logicalOperationId,
      }),
      categoryFor: () => "pilot-source-primary",
      executor: async (input) => ({
        schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
        executionId: "source-U1-exec",
        lane: input.lane,
        reviewOperationKey: input.reviewOperationKey,
        workspaceRole: input.workspaceRole,
        profileId: input.profileId,
        model: input.model,
        effort: input.effort,
        schemaSha256: input.schemaSha256,
        instrumentVersion: input.instrumentVersion,
        reviewProtocol: input.reviewProtocol,
        evidenceEnvelopeSha256: input.evidenceEnvelopeSha256,
        evidenceEnvelopeBytesSha256: input.evidenceEnvelopeBytesSha256,
        roleAssignmentSha256: input.roleAssignmentSha256,
        instrumentManifestSha256: input.instrumentManifestSha256,
        executionProfileHash: input.executionProfileHash,
        routePolicyVersion: input.routePolicyVersion,
        output: "{}",
      }),
    });
    await wrapped(req);
    const requestPath = join(
      phaseDir,
      "model-calls",
      sha256Hex(logicalOperationId),
      "attempt-1",
      "request.json",
    );
    const retained = JSON.parse(readFileSync(requestPath, "utf8"));
    assert.equal(retained.request.task.content, task);
    assert.equal(retained.request.task.sha256, sha256Hex(task));
    assert.equal(retained.request.artifacts[0].content, envelopeBytes);
    assert.equal(retained.request.artifacts[0].sha256, sha256Hex(envelopeBytes));
    assert.equal(retained.requestProjectionSha256, hashCanonical(retained.request));

    retained.request.artifacts[0].content = "tampered\n";
    retained.requestProjectionSha256 = hashCanonical(retained.request);
    writeFileSync(requestPath, `${JSON.stringify(retained)}\n`);
    await assert.rejects(() => wrapped(req), /exact reviewer request differs/);
  } finally {
    roots.dispose();
  }
});

test("ledger preserves capacity failure, permits exactly one infra replay, and exact resume spends zero calls", async () => {
  const roots = mkTestRoots("forward-live-ledger");
  try {
    const frozen = pilotManifest();
    const budget = buildForwardLivePhaseBudget({ manifest: frozen, panelPolicy: panelPolicy() });
    const phaseDir = join(roots.base, "phase");
    const controller = createForwardLiveCallLedger({ budget, phaseDir });
    let calls = 0;
    const wrapped = createLedgeredForwardReviewerExecutor({
      controller,
      phaseDir,
      executor: async (input) => {
        calls += 1;
        if (calls === 1) throw new ForwardReviewerExecutorError("Max-plan capacity", "provider_capacity");
        return {
          schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
          executionId: `reader-${calls}`,
          lane: input.lane,
          reviewOperationKey: input.reviewOperationKey,
          workspaceRole: input.workspaceRole,
          profileId: input.profileId,
          model: input.model,
          effort: input.effort,
          schemaSha256: input.schemaSha256,
          instrumentVersion: input.instrumentVersion,
          roleAssignmentSha256: input.roleAssignmentSha256,
          instrumentManifestSha256: input.instrumentManifestSha256,
          executionProfileHash: input.executionProfileHash,
          routePolicyVersion: input.routePolicyVersion,
          output: "{}",
        };
      },
      contextFor: () => ({
        bookId: "pilot-a",
        chapterNumber: 1,
        stage: "first-write",
        logicalOperationId: "pilot-a/ch01/first-write/reader-primary",
      }),
      categoryFor: () => "pilot-reader-primary",
    });
    const first = await wrapped(request());
    assert.equal(first.executionId, "reader-2");
    assert.equal(calls, 2);
    assert.deepEqual(controller.ledger.entries.map((entry) => entry.status), ["provider_capacity", "completed"]);
    assert.equal(controller.ledger.infrastructureReplays, 1);
    assert.equal(controller.ledger.maxPlanCapacityEvents, 1);
    assert.equal(controller.ledger.codexExecInvocations, 2);

    const resumed = await wrapped(request());
    assert.equal(resumed.executionId, "reader-2");
    assert.equal(calls, 2);
    assert.equal(controller.ledger.cachedReceipts, 2);
    assert.equal(controller.ledger.codexExecInvocations, 2);
    const persisted = JSON.parse(readFileSync(controller.ledgerPath, "utf8"));
    assert.equal(persisted.apiCallsMade, 0);
    assert.equal(persisted.apiFallbackAllowed, false);
  } finally {
    roots.dispose();
  }
});

test("judgment-independent refusal never replays and a changed resume request is rejected", async () => {
  const roots = mkTestRoots("forward-live-no-replay");
  try {
    const budget = buildForwardLivePhaseBudget({ manifest: pilotManifest(), panelPolicy: panelPolicy() });
    const phaseDir = join(roots.base, "phase");
    const controller = createForwardLiveCallLedger({ budget, phaseDir });
    let calls = 0;
    const wrapped = createLedgeredForwardReviewerExecutor({
      controller,
      phaseDir,
      executor: async () => {
        calls += 1;
        throw new ForwardReviewerExecutorError("provider refusal", "refusal");
      },
      contextFor: () => ({
        bookId: "pilot-a",
        chapterNumber: 2,
        stage: "first-write",
        logicalOperationId: "pilot-a/ch02/first-write/reader-primary",
      }),
      categoryFor: () => "pilot-reader-primary",
    });
    await assert.rejects(() => wrapped(request()), (error: unknown) => {
      assert.equal((error as ForwardReviewerExecutorError).code, "refusal");
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(controller.ledger.infrastructureReplays, 0);
    assert.equal(controller.ledger.safeguardsOrRefusals, 1);
    const changed = { ...request(), task: "Changed after the receipt existed." };
    await assert.rejects(() => wrapped(changed), /request changed on resume/);
    assert.equal(calls, 1);
  } finally {
    roots.dispose();
  }
});

test("reviewer freshness hook stops input or production-seal drift between lanes before a cached or fresh call", async () => {
  const roots = mkTestRoots("forward-live-reviewer-freshness");
  try {
    const phaseDir = join(roots.base, "phase");
    const controller = createForwardLiveCallLedger({
      budget: buildForwardLivePhaseBudget({ manifest: pilotManifest(), panelPolicy: panelPolicy() }),
      phaseDir,
    });
    let fresh = true;
    let calls = 0;
    const wrapped = createLedgeredForwardReviewerExecutor({
      controller,
      phaseDir,
      beforeCall: () => {
        if (!fresh) throw new Error("production instrument or input materialization drifted between reviewer lanes");
      },
      executor: async (input) => {
        calls += 1;
        return {
          schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
          executionId: `lane-${calls}`,
          lane: input.lane,
          reviewOperationKey: input.reviewOperationKey,
          workspaceRole: input.workspaceRole,
          profileId: input.profileId,
          model: input.model,
          effort: input.effort,
          schemaSha256: input.schemaSha256,
          instrumentVersion: input.instrumentVersion,
          roleAssignmentSha256: input.roleAssignmentSha256,
          instrumentManifestSha256: input.instrumentManifestSha256,
          executionProfileHash: input.executionProfileHash,
          routePolicyVersion: input.routePolicyVersion,
          output: "{}",
        };
      },
      contextFor: (input) => ({
        bookId: "pilot-a",
        chapterNumber: 1,
        stage: "first-write",
        logicalOperationId: `pilot-a/ch01/first-write/${input.lane}`,
      }),
      categoryFor: (input) => input.lane === "reader" ? "pilot-reader-primary" : "pilot-source-primary",
    });
    await wrapped(request());
    fresh = false;
    const sourceRequest = { ...request(), lane: "source" as const, workspaceRole: "source-verifier" as const };
    await assert.rejects(() => wrapped(sourceRequest), /drifted between reviewer lanes/);
    assert.equal(calls, 1, "drift must stop the second lane before model execution");
    assert.equal(controller.ledger.entries.length, 1, "drift must stop before reserving a second lane call");
  } finally {
    roots.dispose();
  }
});

test("single ledger authorization seam rechecks every fresh model operation but never replays a valid cached judgment", async () => {
  const roots = mkTestRoots("forward-live-ledger-authorization-seam");
  try {
    const phaseDir = join(roots.base, "phase");
    let authorized = true;
    let verifierCalls = 0;
    let executions = 0;
    const controller = createForwardLiveCallLedger({
      budget: buildForwardLivePhaseBudget({ manifest: pilotManifest(), panelPolicy: panelPolicy() }),
      phaseDir,
      beforeModelCall: () => {
        verifierCalls += 1;
        if (!authorized) throw new Error("V3 qualification result/certificate/freeze/seal drift");
      },
    });
    const run = (logicalOperationId: string) => runLedgeredForwardModelOperation({
      controller,
      phaseDir,
      context: {
        category: "pilot-author-first-write" as const,
        bookId: "pilot-a",
        chapterNumber: 1,
        stage: "first-write" as const,
        logicalOperationId,
      },
      request: { taskSha256: sha256Hex(logicalOperationId) },
      execute: async () => {
        executions += 1;
        return { executionId: `exec-${executions}`, result: { ok: true } };
      },
    });

    await run("pilot-a/ch01/first-write/v3-author-1");
    assert.equal(verifierCalls, 1);
    assert.equal(executions, 1);
    await run("pilot-a/ch01/first-write/v3-author-1");
    assert.equal(verifierCalls, 1, "cached receipt makes no model call and needs no new spawn authorization");
    assert.equal(executions, 1);

    authorized = false;
    await assert.rejects(() => run("pilot-a/ch01/first-write/v3-author-2"),
      /qualification result\/certificate\/freeze\/seal drift/);
    assert.equal(verifierCalls, 2);
    assert.equal(executions, 1, "freshness denial must happen before the injected model execution");
    assert.equal(controller.ledger.codexExecInvocations, 1,
      "denied authorization must not consume or record a codex-exec invocation");
    assert.equal(controller.ledger.entries.length, 1);
  } finally {
    roots.dispose();
  }
});

test("generic author/evaluator operations persist REQUESTED before execution and resume exact receipts", async () => {
  const roots = mkTestRoots("forward-live-generic-operation");
  try {
    const controller = createForwardLiveCallLedger({
      budget: buildForwardLivePhaseBudget({ manifest: pilotManifest(), panelPolicy: panelPolicy() }),
      phaseDir: join(roots.base, "phase"),
    });
    let calls = 0;
    const context = {
      category: "pilot-author-first-write" as const,
      bookId: "pilot-a",
      chapterNumber: 1,
      stage: "first-write" as const,
      logicalOperationId: "pilot-a/ch01/first-write/author",
    };
    const run = () => runLedgeredForwardModelOperation({
      controller,
      phaseDir: join(roots.base, "phase"),
      context,
      request: { taskSha256: sha256Hex("author card"), model: "gpt-5.6-sol", effort: "high" },
      execute: async () => {
        calls += 1;
        assert.equal(controller.ledger.entries.at(-1)?.status, "REQUESTED");
        return { executionId: "author-exec-1", result: { candidate: "fresh chapter bytes" } };
      },
    });
    assert.deepEqual(await run(), { candidate: "fresh chapter bytes" });
    assert.equal(calls, 1);
    assert.equal(controller.ledger.codexExecInvocations, 1);
    assert.deepEqual(await run(), { candidate: "fresh chapter bytes" });
    assert.equal(calls, 1);
    assert.equal(controller.ledger.cachedReceipts, 1);
  } finally {
    roots.dispose();
  }
});

test("generic cached receipt tampering cannot change author/evaluator result bytes", async () => {
  const roots = mkTestRoots("forward-live-generic-tamper");
  try {
    const phaseDir = join(roots.base, "phase");
    const controller = createForwardLiveCallLedger({
      budget: buildForwardLivePhaseBudget({ manifest: pilotManifest(), panelPolicy: panelPolicy() }),
      phaseDir,
    });
    const logicalOperationId = "pilot-a/ch01/first-write/author-tamper";
    const opts = {
      controller,
      phaseDir,
      context: {
        category: "pilot-author-first-write" as const,
        bookId: "pilot-a",
        chapterNumber: 1,
        stage: "first-write" as const,
        logicalOperationId,
      },
      request: { taskSha256: sha256Hex("author tamper card") },
      execute: async () => ({ executionId: "author-tamper-exec", result: { candidate: "original bytes" } }),
    };
    assert.deepEqual(await runLedgeredForwardModelOperation(opts), { candidate: "original bytes" });
    const receiptPath = join(phaseDir, "model-calls", sha256Hex(logicalOperationId), "attempt-1", "receipt.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    receipt.result = { candidate: "edited bytes" };
    writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
    await assert.rejects(() => runLedgeredForwardModelOperation(opts), /receipt drift/);
  } finally {
    roots.dispose();
  }
});
