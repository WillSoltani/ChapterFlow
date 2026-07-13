import assert from "node:assert/strict";

import { test } from "./harness.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import {
  FORWARD_LOCAL_RETAINED_CHAPTER_RESULT_V2_SCHEMA,
  forwardActiveV2EvidenceProblems,
  forwardLocalConductorAcceptanceProblems,
  forwardLocalRetainedChapterResultProblems,
} from "../src/orchestrator/forwardLocalAutopilot.js";
import type { ForwardChapterConductorResultV1 } from "../src/orchestrator/forwardChapterConductor.js";
import type { ResolvedForwardLocalRuntimeV1 } from "../src/orchestrator/forwardAuthorRuntime.js";

const sha = (character: string): string => character.repeat(64);

function activeV2Runtime(): Extract<ResolvedForwardLocalRuntimeV1, { mode: "FORWARD_ACTIVE" }> {
  const roleAssignment = {
    readerPrimary: { profileId: "reader-primary", model: "gpt-5.4", effort: "high" },
    readerBackup: { profileId: "reader-backup", model: "gpt-5.4", effort: "xhigh" },
    sourcePrimary: { profileId: "source-primary", model: "gpt-5.4", effort: "high" },
    sourceAdjudicator: { profileId: "source-adjudicator", model: "gpt-5.4", effort: "xhigh" },
    quizAdjudicator: { profileId: "quiz-adjudicator", model: "gpt-5.4", effort: "high" },
  };
  const reviewConfig = {
    reviewProtocolVersion: "imp24-review-v2",
    roleAssignment,
    roleAssignmentSha256: hashCanonical(roleAssignment),
    instrumentManifestSha256: sha("b"),
    panelPolicySha256: sha("c"),
  };
  return {
    schema: "forward-local-author-runtime-v1",
    mode: "FORWARD_ACTIVE",
    reason: "ACTIVE_POLICY_VALIDATED",
    policy: { status: "ACTIVE" },
    binding: {
      schema: "imp24-forward-local-author-runtime-binding-v2",
      reviewConfig,
      reviewConfigSha256: hashCanonical(reviewConfig),
      roleAssignmentFreezeSha256: sha("d"),
      executionProfileHash: "imp24-local-acceptance-test-profile",
      routePolicyVersion: "imp24-local-acceptance-test-route",
      bindingSha256: sha("e"),
    },
    runtimeSha256: sha("f"),
    externalCapabilities: { publish: false, promotion: false, deployment: false, upload: false, apiFallback: false },
  } as unknown as Extract<ResolvedForwardLocalRuntimeV1, { mode: "FORWARD_ACTIVE" }>;
}

function currentV2Result(
  runtime = activeV2Runtime(),
  contentSha256 = sha("1"),
): ForwardChapterConductorResultV1 {
  const readerEnvelopeSha256 = sha("2");
  const sourceEnvelopeSha256s = [sha("3"), sha("4")];
  const quizEnvelopeSha256 = sha("5");
  const reader = { chapterContentSha256: contentSha256, evidenceEnvelopeSha256: readerEnvelopeSha256 };
  const source = {
    chapterContentSha256: contentSha256,
    evidenceEnvelopeSha256s: sourceEnvelopeSha256s,
    evidenceEnvelopeSha256: hashCanonical(sourceEnvelopeSha256s),
  };
  const quiz = { chapterContentSha256: contentSha256, evidenceEnvelopeSha256: quizEnvelopeSha256 };
  const envelopeSetSha256 = hashCanonical({
    protocolVersion: "imp24-review-v2",
    readerEnvelopeSha256,
    sourceEnvelopeSha256s,
    quizEnvelopeSha256,
  });
  const authoritativeV2 = {
    protocolVersion: "imp24-review-v2",
    readerEnvelopeSha256,
    reader,
    readerAudit: null,
    sourceEnvelopeSha256s,
    source,
    sourceAdjudication: null,
    quizEnvelopeSha256,
    quiz,
    envelopeSetSha256,
  };
  const makeExecution = (
    lane: "reader" | "source" | "quiz",
    panelRole: "readerPrimary" | "sourcePrimary" | "quizSemanticAdjudicator",
    reviewOperationKey: string,
    evidenceEnvelopeSha256: string,
    ordinal: number,
  ) => {
    const judge = panelRole === "readerPrimary"
      ? runtime.binding.reviewConfig.roleAssignment.readerPrimary
      : panelRole === "sourcePrimary"
        ? runtime.binding.reviewConfig.roleAssignment.sourcePrimary
        : runtime.binding.reviewConfig.roleAssignment.quizAdjudicator;
    const expected = {
      lane,
      reviewOperationKey,
      reviewProtocol: "review-evidence-envelope-v1",
      evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: sha(String(ordinal + 5)),
      roleAssignmentSha256: runtime.binding.reviewConfig.roleAssignmentSha256,
      instrumentManifestSha256: runtime.binding.reviewConfig.instrumentManifestSha256,
      executionProfileHash: runtime.binding.executionProfileHash,
      routePolicyVersion: runtime.binding.routePolicyVersion,
    };
    return {
      lane,
      panelRole,
      reviewOperationKey,
      roleProfileSha256: hashCanonical({
        judge,
        executionProfileHash: runtime.binding.executionProfileHash,
        routePolicyVersion: runtime.binding.routePolicyVersion,
      }),
      expected,
      status: "VERIFIED",
      received: { ...expected, executionId: `imp24-local-acceptance-${ordinal}` },
    };
  };
  const envelope = {
    candidateContentSha256: contentSha256,
    disposition: "COMMITTED",
    finalStatus: "PASS",
    reviewProtocolVersion: "imp24-review-v2",
    frozenReviewConfigSha256: runtime.binding.reviewConfigSha256,
    roleAssignmentSha256: runtime.binding.reviewConfig.roleAssignmentSha256,
    instrumentManifestSha256: runtime.binding.reviewConfig.instrumentManifestSha256,
    panelPolicySha256: runtime.binding.reviewConfig.panelPolicySha256,
    readerEvidenceEnvelopeSha256: readerEnvelopeSha256,
    sourceEvidenceEnvelopeSha256s: sourceEnvelopeSha256s,
    quizEvidenceEnvelopeSha256: quizEnvelopeSha256,
    evidenceEnvelopeSetSha256: envelopeSetSha256,
    readerV2ResultSha256: hashCanonical(reader),
    readerAuditV2ResultSha256: null,
    sourceV2ResultSha256: hashCanonical(source),
    sourceAdjudicatorV2ResultSha256: null,
    quizV2ResultSha256: hashCanonical(quiz),
    readerAuditSelected: false,
    sourceAdjudicationTriggered: false,
    executions: [
      makeExecution("reader", "readerPrimary", "reader", readerEnvelopeSha256, 1),
      makeExecution("source", "sourcePrimary", "source-unit-1", sourceEnvelopeSha256s[0]!, 2),
      makeExecution("source", "sourcePrimary", "source-unit-2", sourceEnvelopeSha256s[1]!, 3),
      makeExecution("quiz", "quizSemanticAdjudicator", "quiz", quizEnvelopeSha256, 4),
    ],
  };
  return {
    authoritativeV2,
    executionEnvelope: envelope,
    executionEnvelopeSha256: hashCanonical(envelope),
  } as unknown as ForwardChapterConductorResultV1;
}

test("IMP-24 ACTIVE V2 rejects a legacy V1-only retained PASS even when content is unchanged", () => {
  const contentSha256 = sha("1");
  const envelope = {
    candidateContentSha256: contentSha256,
    disposition: "COMMITTED",
    finalStatus: "PASS",
    executions: [],
  };
  const result = {
    disposition: "COMMITTED",
    finalStatus: "PASS",
    executionEnvelope: envelope,
    executionEnvelopeSha256: hashCanonical(envelope),
    commitResult: { ok: true, committed: true },
    reader: null,
    source: null,
    quiz: null,
    aggregate: null,
  } as unknown as ForwardChapterConductorResultV1;

  const problems = forwardLocalConductorAcceptanceProblems(
    result,
    contentSha256,
    result.executionEnvelopeSha256,
    activeV2Runtime(),
  );
  assert.ok(problems.some((problem) => /authoritative V2/i.test(problem)), problems.join("; "));
});

test("IMP-24 ACTIVE V2 accepts exact current envelope/result identities and rejects hash drift", () => {
  const runtime = activeV2Runtime();
  const result = currentV2Result(runtime);
  assert.deepEqual(forwardActiveV2EvidenceProblems(result, sha("1"), runtime), []);

  const stale = structuredClone(result) as unknown as {
    executionEnvelope: Record<string, unknown>;
    executionEnvelopeSha256: string;
  };
  stale.executionEnvelope.readerV2ResultSha256 = sha("9");
  stale.executionEnvelopeSha256 = hashCanonical(stale.executionEnvelope);
  assert.ok(
    forwardActiveV2EvidenceProblems(stale as unknown as ForwardChapterConductorResultV1, sha("1"), runtime)
      .includes("authoritative V2 result hash drift"),
  );
});

test("IMP-24 ACTIVE V2 rejects missing VERIFIED receipts and incomplete source partition order", () => {
  const runtime = activeV2Runtime();
  const missingReceipt = structuredClone(currentV2Result(runtime));
  missingReceipt.executionEnvelope.executions[1]!.received = null;
  const receiptProblems = forwardActiveV2EvidenceProblems(missingReceipt, sha("1"), runtime);
  assert.ok(receiptProblems.some((problem) => /VERIFIED V2 execution receipt is missing/.test(problem)), receiptProblems.join("; "));

  const missingPartition = structuredClone(currentV2Result(runtime));
  missingPartition.executionEnvelope.executions.splice(2, 1);
  const partitionProblems = forwardActiveV2EvidenceProblems(missingPartition, sha("1"), runtime);
  assert.ok(partitionProblems.some((problem) => /exactly 2 sourcePrimary executions/.test(problem)), partitionProblems.join("; "));
});

test("IMP-24 retained V2 wrapper binds the exact current runtime, config, and role freeze", () => {
  const runtime = activeV2Runtime();
  const result = currentV2Result(runtime);
  const draft = {
    schema: FORWARD_LOCAL_RETAINED_CHAPTER_RESULT_V2_SCHEMA,
    runtimeSha256: runtime.runtimeSha256,
    runtimeBindingSha256: runtime.binding.bindingSha256,
    reviewConfigSha256: runtime.binding.reviewConfigSha256,
    roleAssignmentFreezeSha256: runtime.binding.roleAssignmentFreezeSha256,
    result,
    resultSha256: hashCanonical(result),
  };
  const record = { ...draft, recordSha256: hashCanonical(draft) };
  assert.deepEqual(forwardLocalRetainedChapterResultProblems(record, runtime, record.recordSha256), []);

  const staleDraft = { ...draft, roleAssignmentFreezeSha256: sha("0") };
  const stale = { ...staleDraft, recordSha256: hashCanonical(staleDraft) };
  assert.ok(
    forwardLocalRetainedChapterResultProblems(stale, runtime, stale.recordSha256)
      .includes("retained V2 result belongs to another role freeze"),
  );
});
