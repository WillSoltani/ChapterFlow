/** P6 stage-1 SOL pilot — model-free binding/boundary proofs. Proves:
 * (1) the qualification proof composes from a self-consistent readiness-v6
 *     chain and its freshness re-assert is deterministic;
 * (2) a role-freeze/result disagreement on any selected role fails closed;
 * (3) instrument continuity fails closed on any certification component
 *     drift (thresholds) and on any reviewer schema-hash drift, while the two
 *     seal-dependent fields may differ (additive-src re-mint succession);
 * (4) the create-once snapshot refuses to mint once the imp24f bytes stop
 *     matching the frozen readiness-plan bindings (the window closes);
 * (5) the bound review config recomposes deterministically, carries the
 *     conductor schema literal, activates reader-decision-policy-v3, and
 *     binds the fixed role assignment into the instrument manifest;
 * (6) the stage-1 scope is exactly the first two frozen manifest targets
 *     (one per pilot book) and refuses tampered manifests;
 * (7) the campaign-side ledger guard refuses out-of-scope entries and the
 *     runaway backstop;
 * (8) the engine's stage scope validates membership/order/kind and a partial
 *     scope can never produce an accepted result (staged-out hard failure);
 * (9) the CLI live verb refuses without the literal --execute-live and
 *     refuses operator override flags before any read. */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  type PilotRoleReadinessPlanV1,
} from "../src/bakeoff/migration/pilotRoleReadinessInstrument.js";
import type {
  PilotRoleReadinessFreezeV1,
  PilotRoleReadinessRunnerResultV1,
} from "../src/bakeoff/migration/pilotRoleReadinessRunner.js";
import type { PilotRoleFreezeV1 } from "../src/orchestrator/forwardPilotRoleReadinessCampaign.js";
import { ROUTE_POLICY_VERSION } from "../src/orchestrator/modelPolicy.js";
import {
  SOL_PILOT_STAGE1_STAGE_POLICY_ID,
  assertSolPilotStage1QualificationProofFresh,
  buildSolPilotFixedRoleAssignment,
  buildSolPilotStage1Scope,
  composeSolPilotBoundReviewConfig,
  composeSolPilotInstrumentSnapshot,
  composeSolPilotStage1QualificationProof,
  type SolPilotCertificationRecordV1,
  type SolPilotProductionSealRecordV1,
  type SolPilotReadinessChainV1,
} from "../src/orchestrator/forwardSolPilotStage1Binding.js";
import { assertLedgerWithinStageScope } from "../src/orchestrator/forwardSolPilotStage1Campaign.js";
import {
  buildPilotManifestV2Envelope,
  runForwardValidationCampaign,
  type ForwardBookSelectionCandidateV1,
  type ForwardSourceCoordinateV1,
} from "../src/orchestrator/forwardValidationCampaign.js";
import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";

function fakeSha(seed: string): string {
  return sha256Hex(Buffer.from(seed));
}

const ROLE_HASHES = {
  schemaHashes: { reader: fakeSha("schema-reader"), source: fakeSha("schema-source"), quiz: fakeSha("schema-quiz") },
  promptSourceHashes: { reader: fakeSha("prompt-reader"), source: fakeSha("prompt-source"), quiz: fakeSha("prompt-quiz") },
};

type FixtureOverrides = {
  selectedReaderAuditEqualsPrimary?: boolean;
  tamperRoleFreezeReaderPrimary?: boolean;
  driftCurrentThresholds?: boolean;
  driftCurrentReaderSchemaHash?: boolean;
};

/** A fully self-consistent synthetic readiness-v6 chain: every self-hash and
 * cross-hash the binding validates is computed here the same way the real
 * campaign artifacts were minted. */
function fixtureChain(overrides: FixtureOverrides = {}): SolPilotReadinessChainV1 {
  const sealCore = {
    schema: "forward-production-instrument-seal-v1",
    version: "v2",
    inventoryPolicy: "all-pipeline-src-config-live-schemas-runtime-lock-plus-fixed-gold-assets-v2",
    files: [{ relativePath: "src/example.ts", bytesSha256: fakeSha("seal-file") }],
    capabilities: { publish: false, promote: false, deploy: false, upload: false },
  };
  const sealRecord = { ...sealCore, sealSha256: hashCanonical(sealCore) } as unknown as SolPilotProductionSealRecordV1;
  const certCoreBase = {
    schema: "imp24-instrument-certification-binding-v1",
    experimentId: "imp24f-instrument",
    status: "CERTIFIED",
    promptBundleSha256: fakeSha("prompt-bundle"),
    schemaBundleSha256: fakeSha("schema-bundle"),
    scorerSha256: fakeSha("scorer"),
    envelopeCompilerSha256: fakeSha("envelope-compiler"),
    envelopeContractSha256: fakeSha("envelope-contract"),
    modelOutputContractsSha256: fakeSha("model-output-contracts"),
    thresholdsSha256: fakeSha("thresholds"),
    corpusBundleSha256: `sha256:${fakeSha("corpus-bundle")}`,
    corpusCertificationSha256: fakeSha("corpus-cert"),
    legacyEvidenceClosureSha256: fakeSha("legacy-closure"),
    productionQualificationParitySha256: fakeSha("parity"),
    independentAuditPasses: 2,
    sourceMissingEvidenceInconclusiveCertified: true,
    modelCalls: 0,
    apiCalls: 0,
    productionInstrumentSealSha256: sealRecord.sealSha256,
  };
  const certRecord = {
    ...certCoreBase,
    certificationSha256: hashCanonical(certCoreBase),
  } as unknown as SolPilotCertificationRecordV1;
  const certRawSha256 = sha256Hex(Buffer.from(canonicalJson(certRecord)));
  const sealRawSha256 = sha256Hex(Buffer.from(canonicalJson(sealRecord)));

  const planCore = {
    schema: "pilot-role-readiness-plan-v6",
    experimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    objective: "fixture",
    corpusSha256: fakeSha("readiness-corpus"),
    thresholds: { fixture: true },
    thresholdsSha256: fakeSha("readiness-thresholds"),
    metricSemantics: { fixture: true },
    candidateOrders: { fixture: true },
    candidateOrdersSha256: fakeSha("candidate-orders"),
    stopping: { fixture: true },
    budget: { baseMaximumCalls: 84, hardMaximumCalls: 168 },
    costCandidateProbe: { fixture: true },
    canaryGate: { requiredCorrect: 2, rule: "fixture" },
    bindings: {
      candidateSealRawSha256: sealRawSha256,
      candidateCertificationRawSha256: certRawSha256,
      readerDecisionPolicy: "reader-decision-policy-v3",
      aggregatePolicy: "aggregate-chapter-review-policy-v2",
    },
    terminalStates: ["PILOT_ROLE_SET_READY", "BLOCKED_ROLE_READINESS"],
  };
  const plan = { ...planCore, planSha256: hashCanonical(planCore) } as unknown as PilotRoleReadinessPlanV1;
  const planBytesSha256 = sha256Hex(Buffer.from(`${canonicalJson(plan)}\n`));

  const snapshot = composeSolPilotInstrumentSnapshot({
    plan,
    certificationRecord: certRecord,
    certificationRawSha256: certRawSha256,
    sealRecord,
    sealRawSha256,
    schemaHashes: ROLE_HASHES.schemaHashes,
    promptSourceHashes: ROLE_HASHES.promptSourceHashes,
  });

  const freezeCore = {
    schema: "pilot-role-readiness-freeze-v1",
    experimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    corpusSha256: plan.corpusSha256,
    corpusSnapshotSha256: fakeSha("corpus-snapshot"),
    planSha256: plan.planSha256,
    planSnapshotSha256: fakeSha("plan-snapshot"),
    planBytesSha256,
    thresholdsSha256: plan.thresholdsSha256,
    metricSemanticsSha256: fakeSha("metric-semantics"),
    candidateOrdersSha256: plan.candidateOrdersSha256,
    stoppingSha256: fakeSha("stopping"),
    budgetSha256: fakeSha("budget"),
    candidateAvailabilitySemanticSha256: fakeSha("availability-semantic"),
    candidateAvailabilitySnapshotSha256: fakeSha("availability-snapshot"),
    // The real freeze binds each record's EMBEDDED self-hash, not a hash of
    // the whole record (this exact distinction fail-closed the first launch).
    certificationSha256: certRecord.certificationSha256,
    certificationSnapshotSha256: fakeSha("cert-snapshot"),
    certificationRawBytesSha256: certRawSha256,
    productionInstrumentSealSha256: sealRecord.sealSha256,
    productionInstrumentSealSnapshotSha256: fakeSha("seal-snapshot"),
    productionInstrumentSealRawBytesSha256: sealRawSha256,
    schemaHashesSha256: hashCanonical(ROLE_HASHES.schemaHashes),
    promptSourceHashesSha256: hashCanonical(ROLE_HASHES.promptSourceHashes),
    preparedCasesSha256: fakeSha("prepared-cases"),
    scheduleSha256: fakeSha("schedule"),
    maxParallel: 2,
    baseMaximumCalls: 84,
    hardMaximumCalls: 168,
  };
  const readinessFreeze = {
    ...freezeCore,
    freezeSha256: hashCanonical(freezeCore),
  } as unknown as PilotRoleReadinessFreezeV1;

  const judge = (model: string, effort: string) => ({ profileId: `${model}@${effort}`, model, effort });
  const readerAudit = overrides.selectedReaderAuditEqualsPrimary
    ? judge("gpt-fixture-sol", "high")
    : judge("gpt-fixture-sol", "xhigh");
  const roleRecord = (role: "reader" | "source" | "quiz", profile: { profileId: string; model: string; effort: string }) => ({
    role,
    candidateOrdinal: 0,
    profile,
    availability: "AVAILABLE" as const,
    status: "READY" as const,
    canaryStarted: true,
    canaryProtocolPassed: true,
    canarySemanticCorrectCount: 2,
    holdoutStarted: true,
    holdoutCaseCount: 12,
    attempts: 14,
    outcome: null,
  });
  const selected = {
    readerPrimary: "gpt-fixture-sol@high",
    readerAudit: readerAudit.profileId,
    sourcePrimary: "gpt-fixture-sol@xhigh",
    sourceAdjudicator: "gpt-fixture-alt@xhigh",
    quizSemanticAdjudicator: "gpt-fixture-sol@xhigh",
  };
  const resultCore = {
    schema: "pilot-role-readiness-runner-result-v1",
    experimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    freeze: readinessFreeze,
    schedule: [],
    attempts: [],
    profileRoleResults: [
      roleRecord("reader", judge("gpt-fixture-sol", "high")),
      roleRecord("reader", readerAudit),
      roleRecord("source", judge("gpt-fixture-sol", "xhigh")),
      roleRecord("source", judge("gpt-fixture-alt", "xhigh")),
      roleRecord("quiz", judge("gpt-fixture-sol", "xhigh")),
    ],
    qualifiers: {
      reader: ["gpt-fixture-sol@high", readerAudit.profileId],
      source: ["gpt-fixture-sol@xhigh", "gpt-fixture-alt@xhigh"],
      quiz: ["gpt-fixture-sol@xhigh"],
    },
    selected,
    terminalState: "PILOT_ROLE_SET_READY",
    blockedReason: null,
    budgetExhausted: false,
    baseCallsAttempted: 70,
    infrastructureReplays: 0,
    maxPlanEvents: 0,
    totalAttempts: 70,
    firstLiveRequestSha256: fakeSha("first-live-request"),
  };
  const readinessResult = resultCore as unknown as PilotRoleReadinessRunnerResultV1;

  const callLedger = { schema: "fixture-ledger", entries: [] };
  const callLedgerSha256 = hashCanonical(callLedger);
  const callLedgerBytesSha256 = sha256Hex(Buffer.from(`${canonicalJson(callLedger)}\n`));
  const roleFreezeCore = {
    schema: "pilot-role-freeze-v1",
    experimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    roles: {
      readerPrimary: overrides.tamperRoleFreezeReaderPrimary ? "gpt-fixture-sol@xhigh" : selected.readerPrimary,
      readerAudit: selected.readerAudit,
      sourcePrimary: selected.sourcePrimary,
      sourceAdjudicator: selected.sourceAdjudicator,
      quizSemanticAdjudicator: selected.quizSemanticAdjudicator,
      quizChecker: { deterministic: true, checkerVersion: "quiz-answer-tell-checker-v1" },
    },
    bindings: {
      planSha256: plan.planSha256,
      planBytesSha256,
      freezeSha256: readinessFreeze.freezeSha256,
      resultSha256: hashCanonical(readinessResult),
      candidateSealRawSha256: sealRawSha256,
      candidateCertificationRawSha256: certRawSha256,
      candidateOrdersSha256: plan.candidateOrdersSha256,
      thresholdsSha256: plan.thresholdsSha256,
      readerDecisionPolicy: "reader-decision-policy-v3",
      aggregatePolicy: "aggregate-chapter-review-policy-v2",
      routePolicyVersion: ROUTE_POLICY_VERSION,
      executionRoute: "codex_exec_chatgpt_subscription",
      callLedgerSha256,
      callLedgerBytesSha256,
    },
  };
  const roleFreeze = {
    ...roleFreezeCore,
    freezeSha256: hashCanonical(roleFreezeCore),
  } as unknown as PilotRoleFreezeV1;

  // Current instruments: the seal-dependent fields legitimately differ after
  // an additive-src re-mint; every semantic component stays byte-equal.
  const currentSealRecord = {
    ...sealCore,
    files: [
      ...sealCore.files,
      { relativePath: "src/orchestrator/forwardSolPilotStage1Binding.ts", bytesSha256: fakeSha("new-module") },
    ],
  };
  const currentSeal = {
    ...currentSealRecord,
    sealSha256: hashCanonical(currentSealRecord),
  } as unknown as SolPilotProductionSealRecordV1;
  const currentCertCore = {
    ...certCoreBase,
    productionInstrumentSealSha256: currentSeal.sealSha256,
    ...(overrides.driftCurrentThresholds ? { thresholdsSha256: fakeSha("thresholds-DRIFTED") } : {}),
  };
  const currentCert = {
    ...currentCertCore,
    certificationSha256: hashCanonical(currentCertCore),
  } as unknown as SolPilotCertificationRecordV1;

  return {
    readinessResult,
    readinessFreeze,
    roleFreeze,
    plan,
    planBytesSha256,
    callLedgerSha256,
    callLedgerBytesSha256,
    instrumentSnapshot: snapshot,
    currentCertificationRecord: currentCert,
    currentCertificationRawSha256: sha256Hex(Buffer.from(canonicalJson(currentCert))),
    currentSealRecord: currentSeal,
    currentSealRawSha256: sha256Hex(Buffer.from(canonicalJson(currentSeal))),
    currentSchemaHashes: overrides.driftCurrentReaderSchemaHash
      ? { ...ROLE_HASHES.schemaHashes, reader: fakeSha("schema-reader-DRIFTED") }
      : { ...ROLE_HASHES.schemaHashes },
    currentPromptSourceHashes: { ...ROLE_HASHES.promptSourceHashes },
  };
}

function fixturePilotBooks(): ForwardBookSelectionCandidateV1[] {
  const strata = ["research-heavy", "abstract-conceptual", "example-heavy", "causal-quiz-sensitive"] as const;
  const book = (bookId: string): ForwardBookSelectionCandidateV1 => ({
    bookId,
    sourceComplete: true,
    representativeTags: ["fixture"],
    chapters: strata.map((stratum, index): ForwardSourceCoordinateV1 => ({
      bookId,
      chapterNumber: index + 1,
      chapterId: `${bookId}-ch${String(index + 1).padStart(2, "0")}`,
      stratum,
      sourceComplete: true,
      evidenceFresh: true,
      sourceUsePlanSha256: fakeSha(`${bookId}-plan-${stratum}`),
      sourcePacketSha256: fakeSha(`${bookId}-packet-${stratum}`),
      sidecarSha256: fakeSha(`${bookId}-sidecar-${stratum}`),
      anchorCatalogSha256: fakeSha(`${bookId}-anchors-${stratum}`),
      sourceArchiveId: `${bookId}-archive`,
      riskSignals: [],
    })),
  });
  return [book("radical-candor"), book("start-with-why")];
}

function fixtureManifest() {
  return buildPilotManifestV2Envelope({
    frozenAtIso: "2026-07-12T12:00:00.000Z",
    roleAssignmentSha256: fakeSha("role-assignment"),
    instrumentManifestSha256: fakeSha("instrument-manifest"),
    thresholdsSha256: fakeSha("manifest-thresholds"),
    inputMaterializationSha256: fakeSha("materialization"),
    productionInstrumentSealSha256: fakeSha("seal"),
    qualificationBookIds: ["fixture-qual-book"],
    books: fixturePilotBooks(),
    goldReservedBookIds: ["the-gifts-of-imperfection"],
  });
}

// ── (1) proof composes + freshness re-assert ────────────────────────────────

test("sol-pilot proof composes from a consistent readiness chain and re-asserts fresh", () => {
  const chain = fixtureChain();
  const roleAssignment = buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze);
  assert.equal(roleAssignment.readerPrimary.profileId, "gpt-fixture-sol@high");
  assert.equal(roleAssignment.readerBackup.profileId, "gpt-fixture-sol@xhigh");
  assert.equal(roleAssignment.quizChecker.checkerVersion, "quiz-answer-tell-checker-v1");
  const proof = composeSolPilotStage1QualificationProof({ chain, roleAssignment });
  assert.equal(proof.qualificationExperimentId, PILOT_ROLE_READINESS_V6_EXPERIMENT_ID);
  assert.equal(proof.roleSetReady, true);
  assert.equal(proof.readerDecisionPolicy, "reader-decision-policy-v3");
  assert.equal(proof.pilotRoleFreezeSha256, chain.roleFreeze.freezeSha256);
  assert.equal(proof.apiCalls, 0);
  assertSolPilotStage1QualificationProofFresh({ proof, chain, roleAssignment });
  const again = composeSolPilotStage1QualificationProof({ chain, roleAssignment });
  assert.equal(again.proofSha256, proof.proofSha256);
});

// ── (2) role disagreement fails closed ──────────────────────────────────────

test("sol-pilot role freeze/result disagreement on a selected role fails closed", () => {
  const chain = fixtureChain({ tamperRoleFreezeReaderPrimary: true });
  assert.throws(
    () => buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze),
    /disagree on readerPrimary/,
  );
});

test("sol-pilot identical reader primary/audit profiles fail closed", () => {
  const chain = fixtureChain({ selectedReaderAuditEqualsPrimary: true });
  assert.throws(
    () => buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze),
    /different exact profiles/,
  );
});

// ── (3) instrument continuity ───────────────────────────────────────────────

test("sol-pilot certification component drift (thresholds) fails closed", () => {
  const chain = fixtureChain({ driftCurrentThresholds: true });
  const roleAssignment = buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze);
  assert.throws(
    () => composeSolPilotStage1QualificationProof({ chain, roleAssignment }),
    /certification component drifted since role qualification: thresholdsSha256/,
  );
});

test("sol-pilot reviewer schema-hash drift fails closed", () => {
  const chain = fixtureChain({ driftCurrentReaderSchemaHash: true });
  const roleAssignment = buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze);
  assert.throws(
    () => composeSolPilotStage1QualificationProof({ chain, roleAssignment }),
    /current reviewer output schemas differ/,
  );
});

test("sol-pilot seal-dependent certification fields may differ across the re-mint succession", () => {
  const chain = fixtureChain();
  assert.notEqual(chain.instrumentSnapshot.certificationRecord.certificationSha256,
    chain.currentCertificationRecord.certificationSha256);
  assert.notEqual(chain.instrumentSnapshot.certificationRecord.productionInstrumentSealSha256,
    chain.currentCertificationRecord.productionInstrumentSealSha256);
  const roleAssignment = buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze);
  composeSolPilotStage1QualificationProof({ chain, roleAssignment });
});

// ── (4) snapshot mint window ────────────────────────────────────────────────

test("sol-pilot snapshot refuses to mint after the instrument bytes change", () => {
  const chain = fixtureChain();
  assert.throws(() => composeSolPilotInstrumentSnapshot({
    plan: chain.plan,
    certificationRecord: chain.currentCertificationRecord,
    certificationRawSha256: chain.currentCertificationRawSha256,
    sealRecord: chain.currentSealRecord,
    sealRawSha256: chain.currentSealRawSha256,
    schemaHashes: { ...ROLE_HASHES.schemaHashes },
    promptSourceHashes: { ...ROLE_HASHES.promptSourceHashes },
  }), /snapshot window has closed/);
});

// ── (5) bound review config ─────────────────────────────────────────────────

test("sol-pilot bound review config recomposes deterministically with policy v3 active", () => {
  const chain = fixtureChain();
  const roleAssignment = buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze);
  const bound = composeSolPilotBoundReviewConfig({
    chain,
    roleAssignment,
    executionProfileHash: fakeSha("execution-profile"),
    routePolicyVersion: ROUTE_POLICY_VERSION,
  });
  assert.equal(bound.config.schema, "forward-frozen-review-config-v1");
  assert.equal(bound.config.readerDecisionPolicy, "reader-decision-policy-v3");
  assert.equal(bound.config.reviewProtocolVersion, "imp24-review-v2");
  assert.equal(bound.config.readerBar, 80);
  assert.equal(bound.config.instrumentManifest.fixedRoleAssignmentSha256, hashCanonical(roleAssignment));
  assert.equal(bound.config.instrumentManifest.thresholdsSha256, chain.currentCertificationRecord.thresholdsSha256);
  const again = composeSolPilotBoundReviewConfig({
    chain,
    roleAssignment,
    executionProfileHash: fakeSha("execution-profile"),
    routePolicyVersion: ROUTE_POLICY_VERSION,
  });
  assert.equal(again.configSha256, bound.configSha256);
  assert.throws(() => composeSolPilotBoundReviewConfig({
    chain,
    roleAssignment,
    executionProfileHash: fakeSha("execution-profile"),
    routePolicyVersion: "route-policy-TAMPERED",
  }), /route policy version differs/);
});

// ── (6) stage-1 scope ───────────────────────────────────────────────────────

test("sol-pilot stage-1 scope is the first two frozen targets, one per pilot book", () => {
  const manifest = fixtureManifest();
  const scope = buildSolPilotStage1Scope(manifest);
  assert.equal(scope.policyId, SOL_PILOT_STAGE1_STAGE_POLICY_ID);
  assert.equal(scope.executeChapterKeys.length, 2);
  const books = new Set(scope.executeChapterKeys.map((key) => key.split("/")[0]));
  assert.deepEqual([...books].sort(), ["radical-candor", "start-with-why"]);
  const tampered = { manifest: manifest.manifest, manifestSha256: fakeSha("tampered") };
  assert.throws(() => buildSolPilotStage1Scope(tampered as never), /manifest hash drift/);
});

// ── (7) campaign ledger guard ───────────────────────────────────────────────

test("sol-pilot ledger guard refuses out-of-scope entries and the runaway backstop", () => {
  const dir = mkdtempSync(join(tmpdir(), "sol-pilot-ledger-"));
  const ledgerPath = join(dir, "call-ledger.json");
  const entry = (bookId: string, chapterNumber: number | null) => ({
    category: "author", bookId, chapterNumber, stage: "first-write",
    logicalOperationId: `${bookId}/ch${String(chapterNumber ?? 0).padStart(2, "0")}/first-write`,
    attemptId: fakeSha(`${bookId}-${chapterNumber}`), attemptNumber: 1,
    requestSha256: fakeSha("request"), receiptSha256: null, status: "REQUESTED",
    executionId: null, cached: false, recordedAt: "2026-07-16T00:00:00.000Z",
  });
  const scoped = ["radical-candor/ch01", "start-with-why/ch01"];
  const write = (entries: unknown[]) => writeFileSync(ledgerPath, `${canonicalJson({
    schema: "forward-live-call-ledger-v1", experimentId: "fixture", kind: "pilot",
    manifestSha256: fakeSha("manifest"), budgetSha256: fakeSha("budget"),
    executionRoute: "codex_exec_chatgpt_subscription", authMode: "chatgpt",
    apiKeyPresent: false, apiCallsMade: 0, apiFallbackAllowed: false,
    entries, codexExecInvocations: entries.length, cachedReceipts: 0,
    infrastructureReplays: 0, maxPlanCapacityEvents: 0, safeguardsOrRefusals: 0,
  })}\n`);
  write([entry("radical-candor", 1), entry("start-with-why", 1)]);
  assertLedgerWithinStageScope(ledgerPath, scoped, 50);
  write([entry("radical-candor", 1), entry("radical-candor", 3)]);
  assert.throws(() => assertLedgerWithinStageScope(ledgerPath, scoped, 50), /outside the ratified stage scope/);
  write([entry("radical-candor", null)]);
  assert.throws(() => assertLedgerWithinStageScope(ledgerPath, scoped, 50), /without an exact chapter coordinate/);
  write(Array.from({ length: 3 }, () => entry("radical-candor", 1)));
  assert.throws(() => assertLedgerWithinStageScope(ledgerPath, scoped, 2), /runaway backstop/);
});

// ── (8) engine stage scope ──────────────────────────────────────────────────

test("engine stage scope validates membership/order and a partial scope is never accepted", async () => {
  const manifest = fixtureManifest();
  const keys = manifest.manifest.targets.map((target) =>
    `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`);
  const preserved = new Map<string, unknown>();
  const deps = {
    produceCandidate: () => { throw new Error("model call attempted in a model-free scope test"); },
    buildConductorInput: () => { throw new Error("conductor input requested in a model-free scope test"); },
    routeFirstFailure: () => ({ kind: "stop", classification: "CONTENT_SPECIFIC", reason: "fixture", complaints: [] }),
    classifyFailedRepair: () => "REPAIR_CONTENT_FAILURE",
    preserveAttempt: (record: { chapterKey: string; stage: string }, sha: string) => {
      preserved.set(`${record.chapterKey}:${record.stage}`, record);
      return { schema: "forward-persistence-receipt-v1", kind: "attempt", storageId: `${record.chapterKey}:${record.stage}`, contentSha256: sha };
    },
    freezeFirstWriteMetrics: (_snapshot: unknown, sha: string) =>
      ({ schema: "forward-persistence-receipt-v1", kind: "first-write-snapshot", storageId: "fw", contentSha256: sha }),
    readPersistedEvidence: (receipt: { storageId: string }) => preserved.get(receipt.storageId) ?? preservedSnapshot,
    // Resumes every scoped chapter from preserved evidence so the scope test
    // exercises the loop without any authoring path.
    loadPreservedAttempt: ({ target, stage }: { target: { bookId: string; chapterNumber: number }; stage: string }) => {
      if (stage !== "first-write") return null;
      return {
        schema: "forward-validation-attempt-record-v1",
        chapterKey: `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`,
        stage,
        attemptId: null,
        attemptDir: null,
        pass: false,
        finalStatus: "FAILED",
        failureClassification: "CONTENT_SPECIFIC",
        failureReasons: ["fixture failure"],
        candidateContentSha256: null,
        candidateBytesSha256: null,
        executionEnvelopeSha256: null,
        reader: null, source: null, quiz: null, aggregate: null,
        executionEnvelope: null,
        repairFailureDisposition: null,
      };
    },
  };
  let preservedSnapshot: unknown = null;
  const origFreeze = deps.freezeFirstWriteMetrics;
  deps.freezeFirstWriteMetrics = (snapshot: unknown, sha: string) => {
    preservedSnapshot = snapshot;
    return origFreeze(snapshot, sha);
  };
  await assert.rejects(
    runForwardValidationCampaign(manifest, { ...deps, stageScope: { policyId: "x", executeChapterKeys: [keys[0]] } } as never),
    /canonical policy id/,
  );
  await assert.rejects(
    runForwardValidationCampaign(manifest, { ...deps, stageScope: { policyId: "sol-pilot-stage1-first-two-v1", executeChapterKeys: ["missing-book/ch09"] } } as never),
    /outside the frozen manifest/,
  );
  await assert.rejects(
    runForwardValidationCampaign(manifest, { ...deps, stageScope: { policyId: "sol-pilot-stage1-first-two-v1", executeChapterKeys: [keys[1], keys[0]] } } as never),
    /frozen manifest order/,
  );
  const result = await runForwardValidationCampaign(manifest, {
    ...deps,
    stageScope: { policyId: "sol-pilot-stage1-first-two-v1", executeChapterKeys: [keys[0], keys[1]] },
  } as never);
  assert.equal(result.accepted, false);
  assert.equal(result.stageScope?.policyId, "sol-pilot-stage1-first-two-v1");
  assert.deepEqual(result.stageScope?.executeChapterKeys, [keys[0], keys[1]]);
  assert.equal(result.stageScope?.stagedOutChapterKeys.length, 6);
  assert.ok(result.hardFailures.some((reason) => /staged out \(not attempted\)/.test(reason)));
  assert.deepEqual(Object.keys(result.finalByChapter).sort(), [keys[0], keys[1]].sort());
});

// ── (9) CLI literal barrier ─────────────────────────────────────────────────

test("sol-pilot-stage1 CLI refuses without the literal --execute-live and refuses overrides", async () => {
  assert.equal(await runMigrationBakeoffCli(["sol-pilot-stage1"], {}), 2);
  assert.equal(await runMigrationBakeoffCli(["sol-pilot-stage1"], { "execute-live": "yes" as never }), 2);
  assert.equal(await runMigrationBakeoffCli(["sol-pilot-stage1"], {
    "execute-live": true,
    "head-sha": "not-a-sha",
    "workflow-run-id": "1",
  }), 2);
  assert.equal(await runMigrationBakeoffCli(["sol-pilot-stage1"], {
    "execute-live": true,
    "head-sha": "a".repeat(40),
    "workflow-run-id": "12345",
    "models-cache": "/tmp/x.json",
  }), 2);
});
