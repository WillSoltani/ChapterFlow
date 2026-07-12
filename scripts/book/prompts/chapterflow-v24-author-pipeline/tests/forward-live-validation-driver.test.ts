/** IMP-22 live campaign preflight and explicit no-live boundary tests. */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";
import {
  FORWARD_INPUT_FREEZE_SCHEMA,
  FORWARD_INPUT_SELECTION_POLICY,
  type ForwardInputFreezeV1,
} from "../src/orchestrator/forwardInputFreeze.js";
import {
  preflightForwardLiveCampaign,
  createForwardCampaignEvidenceStore,
  runForwardLiveCampaignCliBoundary,
  routeExplicitForwardFirstFailure,
  validateForwardInputMaterializationArtifact,
  validateForwardGoldEvaluationArtifacts,
  assertExplicitForwardManifestKind,
  createExplicitExperimentAuthorDestination,
  createLedgeredDeferredAuthorProducer,
  campaignClassificationForModelFailure,
  bindForwardExperimentSpawnOptions,
  frozenForwardExperimentChapterNumbers,
  persistForwardExperimentAuthorSession,
  validateForwardAuthorOperationReceipt,
  buildForwardGoldWorkerDispatchBinding,
  createProductionLedgeredForwardGoldEvaluator,
  runForwardLiveCampaign,
  type ForwardInspectedQualificationProofV1,
  type ForwardNoApiChatgptRouteProofV1,
} from "../src/orchestrator/forwardLiveValidationDriver.js";
import type { ForwardRoleAssignmentFreezeV1 } from "../src/orchestrator/forwardRoleAssignmentFreeze.js";
import {
  FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
  FORWARD_DISAGREEMENT_POLICY_SCHEMA,
  FORWARD_ESCALATION_POLICY_SCHEMA,
  buildForwardPanelReviewPolicy,
} from "../src/orchestrator/forwardReviewPolicy.js";
import {
  FORWARD_CHAPTER_STRATA,
  buildPilotManifest,
  buildGoldManifest,
  classifyAuthorWriteFailure,
  type ForwardBookSelectionCandidateV1,
  type ForwardChapterStratum,
  type ForwardSourceCoordinateV1,
  type ForwardValidationAttemptRecordV1,
} from "../src/orchestrator/forwardValidationCampaign.js";
import {
  buildForwardLivePhaseBudget,
  createForwardLiveCallLedger,
} from "../src/orchestrator/forwardLiveCallLedger.js";
import {
  buildForwardGoldEvaluatorInstrument,
  buildForwardGoldSourceAwareExternalAccuracyProof,
  resolveForwardGoldEvaluatorOutputSchemaPath,
} from "../src/orchestrator/forwardGoldEvaluatorInstrument.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { REQUIRED_SWEEP_FAMILIES } from "../src/qc/sweep.js";
import { semanticSourceHash } from "../src/source/sourceIntegrity.js";
import { CANONICAL_STATE } from "../src/lib/chapterPaths.js";
import { mintChapterAttempt } from "../src/orchestrator/chapterTransaction.js";
import { recordChapterDiversity } from "../src/telemetry/diversityLedger.js";
import { fxChapter, fxPlan } from "./migrationFixtures.js";
import { sourceUsePlanHash } from "../src/contracts/sourceUsePlan.js";
import { makeGateCleanChapter } from "./helpers.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { makeForwardGoldEvaluatorOutput } from "./forwardGoldRuntimeFixtures.js";

const ROLE_SHA = "b".repeat(64);
const INSTRUMENT_SHA = "c".repeat(64);
const PROFILE_SHA = "e".repeat(64);
const ROUTE_VERSION = "route-policy-v1.0";

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

function book(bookId: string): ForwardBookSelectionCandidateV1 {
  return {
    bookId,
    sourceComplete: true,
    representativeTags: ["fixture"],
    chapters: FORWARD_CHAPTER_STRATA.map((stratum, index) => coordinate(bookId, index + 1, stratum)),
  };
}

function fixtures() {
  const manifest = buildPilotManifest({
    frozenAtIso: "2026-07-12T12:00:00.000Z",
    roleAssignmentSha256: ROLE_SHA,
    instrumentManifestSha256: INSTRUMENT_SHA,
    thresholdsSha256: "d".repeat(64),
    inputMaterializationSha256: "9".repeat(64),
    productionInstrumentSealSha256: "8".repeat(64),
    qualificationBookIds: ["qualification-only"],
    books: [book("pilot-a"), book("pilot-b")],
  });
  const pilot = ["pilot-a", "pilot-b"].map((bookId) => ({
    bookId,
    sourceComplete: true,
    representativeTags: ["fixture"],
    chapters: manifest.manifest.targets.filter((target) => target.bookId === bookId),
  }));
  const goldChapter = coordinate("gold-only", 1, "research-heavy");
  const gold = { bookId: "gold-only", sourceComplete: true, representativeTags: ["fixture"], chapters: [goldChapter] };
  const goldAssignment = gold.chapters.map((chapter) => ({
    bookId: chapter.bookId,
    chapterNumber: chapter.chapterNumber,
    chapterId: chapter.chapterId,
    stratum: chapter.stratum,
    sourcePacketSha256: chapter.sourcePacketSha256,
    sourceUsePlanSha256: chapter.sourceUsePlanSha256,
    sidecarSha256: chapter.sidecarSha256,
    anchorCatalogSha256: chapter.anchorCatalogSha256,
  }));
  const inputBase = {
    schema: FORWARD_INPUT_FREEZE_SCHEMA,
    policyVersion: FORWARD_INPUT_SELECTION_POLICY,
    frozenAtIso: "2026-07-12T12:00:00.000Z",
    sets: { qualificationBookIds: ["qualification-only"], pilotBookIds: ["pilot-a", "pilot-b"], goldBookIds: ["gold-only"] },
    pilot,
    pilotInputHashes: { "pilot-a": sha256Hex("pilot-a"), "pilot-b": sha256Hex("pilot-b") },
    gold,
    goldInputHash: sha256Hex("gold-only"),
    goldStratumAssignmentSha256: hashCanonical(goldAssignment),
    goldChapterCount: 1,
    goldCampaignHarnessCompatible: true,
    sourceFiles: [],
  };
  const inputFreeze = { ...inputBase, freezeSha256: hashCanonical(inputBase) } as ForwardInputFreezeV1;
  const qualificationBundleSha256 = "1".repeat(64);
  const roleBase = {
    schema: "imp22-forward-role-assignment-freeze-v1",
    qualificationBundleSha256,
    roleAssignmentSha256: ROLE_SHA,
    roleAssignment: {
      readerPrimary: { profileId: "reader-primary" },
      readerBackup: { profileId: "reader-audit" },
      sourcePrimary: { profileId: "source-primary" },
      sourceAdjudicator: { profileId: "source-adjudicator" },
    },
    reviewConfig: {
      instrumentManifestSha256: INSTRUMENT_SHA,
      instrumentManifest: { thresholdsSha256: manifest.manifest.thresholdsSha256 },
      readerBar: 80,
    },
    productionInstrumentSealSha256: manifest.manifest.productionInstrumentSealSha256,
    instrumentBinding: {
      executionRoute: {
        executionProfileHash: PROFILE_SHA,
        routePolicyVersion: ROUTE_VERSION,
        apiAllowed: false,
        apiFallbackAllowed: false,
        apiCallsMade: 0,
      },
    },
  };
  const roleFreeze = { ...roleBase, freezeSha256: hashCanonical(roleBase) } as unknown as ForwardRoleAssignmentFreezeV1;
  const qualification: ForwardInspectedQualificationProofV1 = {
    roleSetReady: true,
    qualificationResultSha256: "2".repeat(64),
    qualificationBundleSha256,
    calibrationSha256: "3".repeat(64),
    inspectionSha256: "4".repeat(64),
    inspectionDecision: "APPROVED_FOR_HOLDOUT",
  };
  const route: ForwardNoApiChatgptRouteProofV1 = {
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    apiCallsMade: 0,
    forbiddenProviderEnvKeysPresent: [],
    maxParallel: 2,
    executionProfileHash: PROFILE_SHA,
    routePolicyVersion: ROUTE_VERSION,
  };
  return {
    manifest,
    inputFreeze,
    roleFreeze,
    qualification,
    route,
    verifiedInputMaterializationSha256: manifest.manifest.inputMaterializationSha256,
    verifiedProductionInstrumentSealSha256: manifest.manifest.productionInstrumentSealSha256,
  };
}

function panelPolicy() {
  return buildForwardPanelReviewPolicy({
    auditSubset: {
      schema: FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
      policyVersion: "driver-resume-audit-v1",
      strategy: "sha256-chapter-coordinate-bucket-v1",
      salt: "driver-resume",
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
      policyVersion: "driver-resume-disagreement-v1",
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

function materializeDestinationScaffold<T extends ForwardSourceCoordinateV1>(
  phaseDir: string,
  targets: T[],
): T[] {
  const byBook = new Map<string, T[]>();
  for (const target of targets) byBook.set(target.bookId, [...(byBook.get(target.bookId) ?? []), target]);
  const out: T[] = [];
  for (const [bookId, bookTargets] of byBook) {
    const runRoot = join(phaseDir, "inputs", bookId, "books", bookId, "runs", "imp22-inputs-v1");
    const archiveRoot = join(phaseDir, "inputs", bookId, "source-archive", bookId);
    const indexRoot = join(phaseDir, "inputs", bookId, "indexes");
    mkdirSync(runRoot, { recursive: true });
    mkdirSync(archiveRoot, { recursive: true });
    mkdirSync(indexRoot, { recursive: true });
    writeFileSync(join(indexRoot, `${bookId}.json`), `${JSON.stringify(
      bookTargets.map((target) => ({ number: target.chapterNumber, title: `Chapter ${target.chapterNumber}` })),
    )}\n`);
    for (const target of bookTargets) {
      const sidecar = {
        schemaVersion: "source-sidecar-v2",
        chapterId: target.chapterId,
        chapterNumber: target.chapterNumber,
        chapterTitle: `Chapter ${target.chapterNumber}`,
        testableFacts: [],
        namedExamples: [],
      };
      writeFileSync(join(archiveRoot, `ch${String(target.chapterNumber).padStart(2, "0")}.source.json`), `${JSON.stringify(sidecar)}\n`);
      const nn = String(target.chapterNumber).padStart(2, "0");
      const plan = fxPlan({
        bookId,
        chapterNumber: target.chapterNumber,
        sourcePacketSha256: target.sourcePacketSha256,
      });
      mkdirSync(join(runRoot, "source-plans"), { recursive: true });
      mkdirSync(join(runRoot, "briefs"), { recursive: true });
      writeFileSync(join(runRoot, "source-plans", `ch${nn}.plan.json`), `${JSON.stringify(plan)}\n`);
      writeFileSync(join(runRoot, "briefs", `ch${nn}.brief.json`), `${JSON.stringify({
        bookId,
        chapterId: target.chapterId,
        chapterNumber: target.chapterNumber,
        rotationSchemaVersion: "brief-rotation-v1",
        exampleCount: 6,
      })}\n`);
      out.push({
        ...target,
        sidecarSha256: semanticSourceHash(sidecar),
        sourceUsePlanSha256: sourceUsePlanHash(plan),
      });
    }
  }
  return out;
}

function fileSnapshot(path: string): { exists: boolean; sha256: string | null } {
  if (!existsSync(path)) return { exists: false, sha256: null };
  if (!statSync(path).isDirectory()) return { exists: true, sha256: sha256Hex(readFileSync(path)) };
  const entries: Array<{ rel: string; sha256: string }> = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const child = join(dir, name);
      if (statSync(child).isDirectory()) walk(child);
      else entries.push({ rel: child.slice(path.length + 1), sha256: sha256Hex(readFileSync(child)) });
    }
  };
  walk(path);
  return { exists: true, sha256: hashCanonical(entries) };
}

function inputFileInventory(phaseDir: string, bookId: string): Record<string, string> {
  const root = join(phaseDir, "inputs", bookId);
  const entries: Array<[string, string]> = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else entries.push([path.slice(root.length + 1), sha256Hex(readFileSync(path))]);
    }
  };
  walk(root);
  return Object.fromEntries(entries);
}

function writeMaterializationFixture(
  phaseDir: string,
  frozen: ReturnType<typeof fixtures>,
): { artifactPath: string; manifest: typeof frozen.manifest; renderedBriefPath: string; indexPath: string } {
  const entries: Array<Record<string, unknown>> = [];
  let renderedBriefPath = "";
  let indexPath = "";
  for (const bookId of [...new Set(frozen.manifest.manifest.targets.map((target) => target.bookId))].sort()) {
    const inputRoot = join(phaseDir, "inputs", bookId);
    const runRoot = join(inputRoot, "books", bookId, "runs", "imp22-inputs-v1");
    const targets = frozen.manifest.manifest.targets.filter((target) => target.bookId === bookId);
    const writeJsonFixture = (path: string, value: unknown): void => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(value)}\n`);
    };
    indexPath = indexPath || join(inputRoot, "indexes", `${bookId}.json`);
    writeJsonFixture(join(inputRoot, "indexes", `${bookId}.json`), targets.map((target) => ({ number: target.chapterNumber, title: target.chapterId })));
    const manualBrief = { bookId, purpose: "fresh forward validation", audience: "synthetic test reader" };
    writeJsonFixture(join(inputRoot, "briefs", `${bookId}.manual-brief.json`), manualBrief);
    writeJsonFixture(join(inputRoot, "books", bookId, "current-run.json"), { bookId, runId: "imp22-inputs-v1" });
    const chapterBriefSha256: Record<string, string> = {};
    for (const target of targets) {
      const nn = String(target.chapterNumber).padStart(2, "0");
      const brief = { bookId, chapterId: target.chapterId, chapterNumber: target.chapterNumber, title: target.chapterId };
      const briefJsonPath = join(runRoot, "briefs", `ch${nn}.brief.json`);
      const briefMdPath = join(runRoot, "briefs", `ch${nn}.brief.md`);
      writeJsonFixture(briefJsonPath, brief);
      mkdirSync(dirname(briefMdPath), { recursive: true });
      writeFileSync(briefMdPath, `# ${target.chapterId}\n\nFrozen rendered brief.\n`);
      renderedBriefPath = renderedBriefPath || briefMdPath;
      chapterBriefSha256[target.chapterId] = hashCanonical(brief);
      writeJsonFixture(join(runRoot, "source-packets", `ch${nn}.source-packet.json`), { bookId, chapterNumber: target.chapterNumber });
      writeJsonFixture(join(runRoot, "source-plans", `ch${nn}.plan.json`), { bookId, chapterNumber: target.chapterNumber });
      writeJsonFixture(join(inputRoot, "source-archive", bookId, `ch${nn}.source.json`), { bookId, chapterNumber: target.chapterNumber });
      writeJsonFixture(join(inputRoot, "source-archive", bookId, `ch${nn}.anchors.json`), []);
    }
    const bookManifest = {
      schema: "forward-materialized-book-input-v1",
      bookId,
      bookBriefSha256: hashCanonical(manualBrief),
      chapterBriefSha256,
      chapters: targets.map((target) => ({ spec: { chapterId: target.chapterId, chapterNumber: target.chapterNumber } })),
      priorChapterProseUsed: false,
    };
    writeJsonFixture(join(inputRoot, "forward-input-manifest.json"), bookManifest);
    const files: Array<{ relativePath: string; bytesSha256: string }> = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push({ relativePath: path.slice(inputRoot.length + 1), bytesSha256: sha256Hex(readFileSync(path)) });
      }
    };
    walk(inputRoot);
    entries.push({
      bookId,
      stateRootRelPath: `${frozen.manifest.manifest.experimentId}/inputs/${bookId}`,
      inputSha256: hashCanonical(bookManifest),
      bookBriefSha256: hashCanonical(manualBrief),
      chapterBriefSha256,
      files,
    });
  }
  const artifactPath = join(phaseDir, "input-materialization.json");
  const materialization = {
    schema: "imp22-forward-input-materialization-v1",
    inputFreezeSha256: frozen.inputFreeze.freezeSha256,
    pilot: entries,
    gold: entries[0],
    priorChapterProseUsed: false,
    capabilities: { publish: false, promote: false, deploy: false, upload: false },
  };
  writeFileSync(artifactPath, `${JSON.stringify(materialization)}\n`);
  const manifestBody = {
    ...frozen.manifest.manifest,
    inputMaterializationSha256: sha256Hex(readFileSync(artifactPath)),
  };
  const manifest = { manifest: manifestBody, manifestSha256: hashCanonical(manifestBody) } as typeof frozen.manifest;
  return { artifactPath, manifest, renderedBriefPath, indexPath };
}

test("live campaign preflight binds inspected qualification, role assignment, route, and exact input hashes", () => {
  const f = fixtures();
  const proof = preflightForwardLiveCampaign(f);
  assert.equal(proof.kind, "pilot");
  assert.equal(proof.inputFreezeSha256, f.inputFreeze.freezeSha256);
  assert.equal(proof.qualificationBundleSha256, f.qualification.qualificationBundleSha256);
  assert.equal(proof.executionRoute, "codex_exec_chatgpt_subscription");
  assert.equal(proof.apiCallsMade, 0);
  assert.deepEqual(proof.externalCapabilities, { publish: false, promote: false, deploy: false, upload: false });
});

test("live campaign preflight fails closed on API route or frozen input drift", () => {
  const f = fixtures();
  assert.throws(
    () => preflightForwardLiveCampaign({ ...f, route: { ...f.route, apiFallbackAllowed: true } as unknown as ForwardNoApiChatgptRouteProofV1 }),
    /API call/,
  );
  const target = f.manifest.manifest.targets[0];
  const changedManifest = {
    manifest: { ...f.manifest.manifest, targets: [{ ...target, sourcePacketSha256: "f".repeat(64) }, ...f.manifest.manifest.targets.slice(1)] },
    manifestSha256: "0".repeat(64),
  };
  changedManifest.manifestSha256 = hashCanonical(changedManifest.manifest);
  assert.throws(() => preflightForwardLiveCampaign({ ...f, manifest: changedManifest }), /sourcePacketSha256 differs/);
});

test("self-rehashed manifest cannot downgrade risk or drift identity, stratum, route, thresholds, reader bar, or qualification exclusions", () => {
  const resealManifest = (base: ReturnType<typeof fixtures>["manifest"], mutate: (manifest: any) => void) => {
    const manifest = structuredClone(base.manifest) as any;
    mutate(manifest);
    return { manifest, manifestSha256: hashCanonical(manifest) };
  };

  const risk = fixtures();
  const changedFreeze = structuredClone(risk.inputFreeze) as any;
  changedFreeze.pilot[0].chapters[0].riskSignals = ["causal-teaching-claims"];
  const { freezeSha256: _oldFreezeSha256, ...freezeCore } = changedFreeze;
  changedFreeze.freezeSha256 = hashCanonical(freezeCore);
  assert.throws(() => preflightForwardLiveCampaign({ ...risk, inputFreeze: changedFreeze }), /riskSignals differ/);

  const cases: Array<{ name: string; mutate: (manifest: any) => void; error: RegExp }> = [
    {
      name: "chapter identity",
      mutate: (manifest) => { manifest.targets[0].chapterId = "../escaped-chapter"; },
      error: /chapterId is not the canonical coordinate-derived id/,
    },
    {
      name: "stratum",
      mutate: (manifest) => {
        manifest.targets[0].stratum = manifest.targets.find((target: any) => target.stratum !== manifest.targets[0].stratum).stratum;
      },
      error: /pilot requires exactly two|stratum differs/,
    },
    {
      name: "writer route",
      mutate: (manifest) => { manifest.targets[0].writerRoute = { model: "gpt-5.6-sol", effort: "xhigh", reasons: [] }; },
      error: /writer route is not derived/,
    },
    {
      name: "output route",
      mutate: (manifest) => { manifest.targets[0].outputRunId = "self-rehashed-but-wrong"; },
      error: /outputRunId is not the deterministic experiment route/,
    },
    {
      name: "thresholds",
      mutate: (manifest) => { manifest.thresholdsSha256 = "f".repeat(64); },
      error: /thresholds differ/,
    },
    {
      name: "qualification overlap",
      mutate: (manifest) => { manifest.qualificationBookIds = [manifest.targets[0].bookId, ...manifest.qualificationBookIds].sort(); },
      error: /overlaps qualification/,
    },
  ];
  for (const adversary of cases) {
    const f = fixtures();
    assert.throws(() => preflightForwardLiveCampaign({
      ...f,
      manifest: resealManifest(f.manifest, adversary.mutate) as any,
    }), adversary.error, adversary.name);
  }

  const bar = fixtures();
  const roleFreeze = structuredClone(bar.roleFreeze) as any;
  roleFreeze.reviewConfig.readerBar = 0;
  const { freezeSha256: _oldRoleSha256, ...roleCore } = roleFreeze;
  roleFreeze.freezeSha256 = hashCanonical(roleCore);
  assert.throws(() => preflightForwardLiveCampaign({ ...bar, roleFreeze }), /reader bar of 80/);
});

test("input materialization preflight covers exact brief/index inventory and detects byte drift", () => {
  const roots = mkTestRoots("forward-live-input-materialization");
  try {
    const frozen = fixtures();
    const built = writeMaterializationFixture(roots.base, frozen);
    const proof = validateForwardInputMaterializationArtifact({
      phaseDir: roots.base,
      artifactPath: built.artifactPath,
      manifest: built.manifest,
      inputFreeze: frozen.inputFreeze,
    });
    assert.equal(proof.artifactBytesSha256, built.manifest.manifest.inputMaterializationSha256);
    const originalBrief = readFileSync(built.renderedBriefPath, "utf8");
    writeFileSync(built.renderedBriefPath, `${originalBrief}\nTAMPERED`);
    assert.throws(() => validateForwardInputMaterializationArtifact({
      phaseDir: roots.base,
      artifactPath: built.artifactPath,
      manifest: built.manifest,
      inputFreeze: frozen.inputFreeze,
    }), /materialized file bytes drifted/);
    writeFileSync(built.renderedBriefPath, originalBrief);
    const originalIndex = readFileSync(built.indexPath, "utf8");
    writeFileSync(built.indexPath, `${originalIndex.trim()} `);
    assert.throws(() => validateForwardInputMaterializationArtifact({
      phaseDir: roots.base,
      artifactPath: built.artifactPath,
      manifest: built.manifest,
      inputFreeze: frozen.inputFreeze,
    }), /materialized file bytes drifted/);
  } finally {
    roots.dispose();
  }
});

test("materialization drift stops an author stage before destination creation or any model call", async () => {
  const target = fixtures().manifest.manifest.targets[0];
  let modelCalls = 0;
  let destinationCalls = 0;
  const producer = createLedgeredDeferredAuthorProducer({
    baseDeps: { spawn: async () => { modelCalls += 1; throw new Error("unreachable"); } } as any,
    testOnlyAllowInjectedDeps: true,
    controller: {} as any,
    phaseDir: "/unused",
    kind: "pilot",
    productionInstrumentSealSha256: "8".repeat(64),
    assertInputMaterializationFresh: () => { throw new Error("materialization drift before author"); },
    ioFor: () => { destinationCalls += 1; throw new Error("unreachable destination"); },
  });
  await assert.rejects(() => producer({
    manifestSha256: "a".repeat(64),
    target,
    stage: "first-write",
    sequence: 1,
    complaints: [],
    repairScopes: [],
    previous: null,
  }), /materialization drift before author/);
  assert.equal(destinationCalls, 0);
  assert.equal(modelCalls, 0);
});

test("author operation receipt must be valid JSON bound to exact workspace artifact bytes", () => {
  const roots = mkTestRoots("forward-author-operation-receipt");
  try {
    const artifactPath = join(roots.base, "book-ch01.v21-native.chapter.json");
    writeFileSync(artifactPath, "fresh candidate bytes\n");
    const receipt = {
      schema: "forward-author-operation-receipt-v1",
      operation: "author-first-write",
      chapterId: "book-ch01",
      artifactPath: "book-ch01.v21-native.chapter.json",
      artifactSha256: sha256Hex(readFileSync(artifactPath)),
    } as const;
    assert.doesNotThrow(() => validateForwardAuthorOperationReceipt({
      finalMessage: JSON.stringify(receipt),
      expectedSchema: receipt.schema,
      expectedOperation: receipt.operation,
      expectedChapterId: receipt.chapterId,
      expectedArtifactPath: receipt.artifactPath,
      workspaceDir: roots.base,
    }));
    assert.throws(() => validateForwardAuthorOperationReceipt({
      finalMessage: "not json",
      expectedSchema: receipt.schema,
      expectedOperation: receipt.operation,
      expectedChapterId: receipt.chapterId,
      expectedArtifactPath: receipt.artifactPath,
      workspaceDir: roots.base,
    }), /not JSON/);
    assert.throws(() => validateForwardAuthorOperationReceipt({
      finalMessage: JSON.stringify({ ...receipt, artifactSha256: "f".repeat(64) }),
      expectedSchema: receipt.schema,
      expectedOperation: receipt.operation,
      expectedChapterId: receipt.chapterId,
      expectedArtifactPath: receipt.artifactPath,
      workspaceDir: roots.base,
    }), /artifact hash/);
  } finally {
    roots.dispose();
  }
});

test("pilot/gold CLI boundary makes zero calls without explicit execute-live", async () => {
  let calls = 0;
  const dry = await runForwardLiveCampaignCliBoundary({
    phase: "pilot",
    executeLive: false,
    execute: async () => { calls += 1; return { accepted: true }; },
  });
  assert.equal(dry.code, 2);
  assert.equal(dry.executed, false);
  assert.equal(calls, 0);
  const live = await runForwardLiveCampaignCliBoundary({
    phase: "gold",
    executeLive: true,
    execute: async () => { calls += 1; return { accepted: true }; },
  });
  assert.equal(live.code, 0);
  assert.equal(live.executed, true);
  assert.equal(calls, 1);

  const realError = console.error;
  const errors: string[] = [];
  console.error = (...parts: unknown[]) => { errors.push(parts.map(String).join(" ")); };
  try {
    assert.equal(await runMigrationBakeoffCli(["forward-pilot"], {}), 2);
    assert.equal(await runMigrationBakeoffCli(["forward-gold"], { json: true }), 2);
  } finally {
    console.error = realError;
  }
  assert.ok(errors.every((line) => line.includes("--execute-live")));
});

test("campaign evidence is create-once and storage ids cannot escape the phase root", async () => {
  const roots = mkTestRoots("forward-live-evidence-store");
  try {
    const store = createForwardCampaignEvidenceStore(join(roots.base, "phase"));
    await assert.rejects(
      async () => store.readPersistedEvidence({
        schema: "forward-persistence-receipt-v1",
        kind: "attempt",
        storageId: "../escape.json",
        contentSha256: "a".repeat(64),
      }),
      /escapes the campaign root/,
    );
  } finally {
    roots.dispose();
  }
});

test("production resume refuses a preserved PASS whose experiment-local chapter was deleted", async () => {
  const roots = mkTestRoots("forward-live-stale-resume");
  try {
    const store = createForwardCampaignEvidenceStore(join(roots.base, "phase"));
    const target = fixtures().manifest.manifest.targets[0];
    const chapterKey = `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`;
    const record = {
      schema: "forward-validation-attempt-record-v1",
      chapterKey,
      stage: "first-write",
      attemptId: "retained-attempt",
      attemptDir: join(roots.base, "attempt"),
      candidateBytesSha256: "a".repeat(64),
      candidateContentSha256: "b".repeat(64),
      patchSha256: null,
      reader: null,
      source: null,
      quiz: null,
      aggregate: null,
      executionEnvelope: { candidateBytesSha256: "a".repeat(64), candidateContentSha256: "b".repeat(64) },
      executionEnvelopeSha256: "c".repeat(64),
      disposition: "COMMITTED",
      finalStatus: "PASS",
      pass: true,
      failureClassification: null,
      failureReasons: [],
    } as unknown as ForwardValidationAttemptRecordV1;
    await store.preserveAttempt(record, hashCanonical(record));
    await assert.rejects(
      async () => store.loadPreservedAttempt!({ target, stage: "first-write" }),
      /preserved PASS output is missing/,
    );
  } finally {
    roots.dispose();
  }
});

test("reviewer infrastructure/inconclusive failures cannot spend a repair or regeneration author call", () => {
  const base = {
    failureReasons: ["reader reviewer exhausted timeout replay"],
    failureClassification: null,
    finalStatus: "INCONCLUSIVE",
    aggregate: null,
    executionEnvelope: null,
  } as unknown as Parameters<typeof routeExplicitForwardFirstFailure>[0];
  const route = routeExplicitForwardFirstFailure(base);
  assert.equal(route.kind, "stop");
  assert.equal(route.kind === "stop" ? route.classification : null, "REVIEW_INSTRUMENT");
  const stateRoute = routeExplicitForwardFirstFailure({
    ...base,
    failureClassification: "STATE_OR_PROVENANCE",
  });
  assert.equal(stateRoute.kind, "stop");
  assert.equal(campaignClassificationForModelFailure("timeout"), "MODEL_ROUTING");
  assert.equal(campaignClassificationForModelFailure("provider_capacity"), "MODEL_ROUTING");
  assert.equal(campaignClassificationForModelFailure("refusal"), "MODEL_ROUTING");
  assert.equal(campaignClassificationForModelFailure("policy_preflight_failure"), "STATE_OR_PROVENANCE");
  assert.equal(routeExplicitForwardFirstFailure({ ...base, failureClassification: "MODEL_ROUTING" }).kind, "stop");
  assert.equal(classifyAuthorWriteFailure({ ok: false, reason: "unexpected workspace write", failureKind: "STATE_OR_PROVENANCE" }), "STATE_OR_PROVENANCE");
  assert.equal(classifyAuthorWriteFailure({ ok: false, reason: "malformed chapter", failureKind: "PROMPT_OR_CONTRACT" }), "PROMPT_OR_CONTRACT");
});

test("verified scoped content findings use the one typed repair route; diffuse content regenerates", () => {
  const scoped = {
    failureReasons: ["aggregate revised"],
    failureClassification: null,
    finalStatus: "REVISE",
    aggregate: {},
    executionEnvelope: {},
    reader: { blockingFindings: [{ message: "Quiz question 2 has a wrong keyed answer." }] },
    source: null,
  } as unknown as Parameters<typeof routeExplicitForwardFirstFailure>[0];
  const repair = routeExplicitForwardFirstFailure(scoped);
  assert.equal(repair.kind, "repair");
  assert.deepEqual(repair.kind === "repair" ? repair.scopes : [], ["quiz"]);
  const diffuse = routeExplicitForwardFirstFailure({
    ...scoped,
    reader: { blockingFindings: [{ message: "The whole chapter prose is weak and needs a rewrite." }] },
  } as unknown as Parameters<typeof routeExplicitForwardFirstFailure>[0]);
  assert.equal(diffuse.kind, "regeneration");
});

test("gold verdict summaries and hashes cannot pass without actual prose and an independent sweep", () => {
  assert.throws(() => validateForwardGoldEvaluationArtifacts({
    bookId: "gold-book",
    finalChapters: [],
    finalChapterContentHashes: { "1": "a".repeat(64) },
    adjudicatorOutput: { evaluation: { technicalCompleteness: "PASS", contentDesignScore: 100 } },
    sweepOutput: { sweep: { verdict: "PASS" } },
  }), /actual full final ChapterV21 book/);
});

test("staged gold dispatch receipt binds the final task, production seal, and exact blind/adjudication chain artifacts", () => {
  const baseCall = {
    callId: "gold-adjudicator",
    actorId: "gold-adjudicator-actor",
    evaluationRole: "adjudicator" as const,
    instrumentSha256: "a".repeat(64),
    productionInstrumentSealSha256: "8".repeat(64),
    sourceHash: "b".repeat(64),
    expectedChapters: Array.from({ length: 8 }, (_, index) => ({
      chapterIndex: index + 1,
      chapterId: `gold-ch${String(index + 1).padStart(2, "0")}`,
      title: `Gold ${index + 1}`,
      packagePath: `chapters/ch${String(index + 1).padStart(2, "0")}.chapter.json`,
    })),
    sourceAwareExternalAccuracy: { proofSha256: "c".repeat(64) },
    task: "Read the two exact retained blind results and adjudicate only the pinned top-level schema.",
  } as any;
  const baseArtifacts = [{ relativePath: "evaluation-scope.json", bytesSha256: "d".repeat(64) }];
  const blindA = { relativePath: "blind-rater-results.json", bytesSha256: "e".repeat(64) };
  const first = buildForwardGoldWorkerDispatchBinding({ call: baseCall, artifacts: [...baseArtifacts, blindA] });
  const changedBlind = buildForwardGoldWorkerDispatchBinding({
    call: baseCall,
    artifacts: [...baseArtifacts, { ...blindA, bytesSha256: "f".repeat(64) }],
  });
  assert.equal(first.receipt.baseTaskSha256, sha256Hex(baseCall.task));
  assert.equal(first.receipt.productionInstrumentSealSha256, "8".repeat(64));
  assert.notEqual(first.receipt.dispatchReceiptSha256, changedBlind.receipt.dispatchReceiptSha256);
  assert.notEqual(sha256Hex(first.task), sha256Hex(changedBlind.task));
  assert.match(first.task, new RegExp(first.receipt.dispatchReceiptSha256));

  const sweepCall = { ...baseCall, callId: "independent-book-sweep", evaluationRole: "book-sweep" as const };
  const sweepA = buildForwardGoldWorkerDispatchBinding({
    call: sweepCall,
    artifacts: [...baseArtifacts, { relativePath: "adjudicated-result-binding.json", bytesSha256: "1".repeat(64) }],
  });
  const sweepB = buildForwardGoldWorkerDispatchBinding({
    call: sweepCall,
    artifacts: [...baseArtifacts, { relativePath: "adjudicated-result-binding.json", bytesSha256: "2".repeat(64) }],
  });
  assert.notEqual(sweepA.receipt.dispatchReceiptSha256, sweepB.receipt.dispatchReceiptSha256,
    "sweep dispatch must bind the exact validated adjudicator output receipt hash");
});

function cachedGoldBrokerRig(base: string) {
  const instrument = buildForwardGoldEvaluatorInstrument();
  const frozen = buildGoldManifest({
    frozenAtIso: "2026-07-12T12:00:00.000Z",
    roleAssignmentSha256: ROLE_SHA,
    instrumentManifestSha256: INSTRUMENT_SHA,
    thresholdsSha256: "d".repeat(64),
    inputMaterializationSha256: "9".repeat(64),
    productionInstrumentSealSha256: "8".repeat(64),
    qualificationBookIds: ["qualification-only"],
    books: [{
      bookId: "gold-book",
      sourceComplete: true,
      representativeTags: ["fixture"],
      chapters: Array.from({ length: 8 }, (_, index) => coordinate(
        "gold-book",
        index + 1,
        FORWARD_CHAPTER_STRATA[index % FORWARD_CHAPTER_STRATA.length],
      )),
    }],
    pilotBookIds: ["pilot-a", "pilot-b"],
    pilotAccepted: true,
    pilotManifestSha256: "1".repeat(64),
    pilotResultSha256: "2".repeat(64),
    goldEvaluatorInstrumentSha256: instrument.instrumentSha256,
  });
  const phaseDir = resolve(base, "phase");
  const controller = createForwardLiveCallLedger({
    budget: buildForwardLivePhaseBudget({
      manifest: frozen,
      panelPolicy: panelPolicy(),
      goldBookEvaluatorExpectedCalls: 4,
      goldBookEvaluatorMaximumCallsBeforeReplay: 4,
    }),
    phaseDir,
  });
  const sourceHash = "3".repeat(64);
  const expectedChapters = frozen.manifest.targets.map((target) => ({
    chapterIndex: target.chapterNumber,
    chapterId: target.chapterId,
    title: `Gold ${target.chapterNumber}`,
    packagePath: `chapters/ch${String(target.chapterNumber).padStart(2, "0")}.chapter.json`,
  }));
  const sourceEvidence = expectedChapters.map((chapter) => ({
    ...chapter,
    candidateContentSha256: sha256Hex(`content-${chapter.chapterId}`),
    sourceResultSha256: sha256Hex(`source-${chapter.chapterId}`),
    executionEnvelopeSha256: sha256Hex(`envelope-${chapter.chapterId}`),
    sourceStatus: "PASS" as const,
    sourceBlockerCount: 0,
    evidenceFresh: true,
  }));
  const sourceProof = buildForwardGoldSourceAwareExternalAccuracyProof({
    bookId: "gold-book",
    sourceHash,
    chapters: sourceEvidence,
  });
  const calls = instrument.calls.map((fixed, index) => {
    const cwd = resolve(phaseDir, "workspaces", fixed.callId);
    mkdirSync(cwd, { recursive: true });
    return {
      callId: fixed.callId,
      actorId: fixed.actorId,
      evaluationRole: fixed.evaluationRole,
      request: {},
      task: fixed.prompt,
      cwd,
      model: fixed.model,
      effort: fixed.effort,
      outputSchemaPath: resolveForwardGoldEvaluatorOutputSchemaPath(fixed),
      outputSchemaSha256: fixed.outputSchemaSha256,
      artifacts: [],
      instrumentSha256: instrument.instrumentSha256,
      productionInstrumentSealSha256: "8".repeat(64),
      sourceHash,
      dispatchReceiptSha256: String(index + 4).repeat(64),
      expectedChapters,
      blindRaterRole: fixed.evaluationRole === "blind-rater" ? (index === 0 ? "primary" as const : "verification" as const) : null,
      sourceAwareExternalAccuracy: sourceProof,
      expectedSourceLaneEvidence: sourceEvidence,
    };
  });
  return { frozen, phaseDir, controller, calls, expectedChapters, sourceHash };
}

function seedCachedGoldCall(rig: ReturnType<typeof cachedGoldBrokerRig>, callIndex: number, output: unknown): void {
  const call = rig.calls[callIndex];
  const request = {
    actorId: call.actorId,
    evaluationRole: call.evaluationRole,
    taskSha256: sha256Hex(call.task),
    model: call.model,
    effort: call.effort,
    outputSchemaSha256: call.outputSchemaSha256,
    instrumentSha256: call.instrumentSha256,
    productionInstrumentSealSha256: call.productionInstrumentSealSha256,
    sourceHash: call.sourceHash,
    dispatchReceiptSha256: call.dispatchReceiptSha256,
    expectedChaptersSha256: hashCanonical(call.expectedChapters),
    sourceAwareExternalAccuracyProofSha256: call.sourceAwareExternalAccuracy.proofSha256,
    artifacts: [],
  };
  const logicalOperationId = `gold-book/book-evaluation/${call.callId}`;
  const requestSha256 = hashCanonical(request);
  const context = {
    category: "gold-book-evaluator" as const,
    bookId: "gold-book",
    chapterNumber: null,
    stage: "book-evaluation" as const,
    logicalOperationId,
  };
  const attemptId = rig.controller.begin({ context, attemptNumber: 1, requestSha256 });
  const operationDir = resolve(rig.phaseDir, "model-calls", sha256Hex(logicalOperationId), "attempt-1");
  mkdirSync(operationDir, { recursive: true });
  writeFileSync(resolve(operationDir, "request.json"), `${JSON.stringify({ requestSha256, request })}\n`);
  const cachedResult = {
    actorId: call.actorId,
    executionId: `cached-${call.callId}`,
    output,
    outputSha256: hashCanonical(output),
  };
  writeFileSync(resolve(operationDir, "receipt.json"), `${JSON.stringify({
    schema: "forward-live-model-operation-receipt-v1",
    status: "completed",
    executionId: cachedResult.executionId,
    result: cachedResult,
    failureMessage: null,
  })}\n`);
  rig.controller.complete({
    attemptId,
    requestSha256,
    receipt: {
      schema: "forward-live-call-receipt-v1",
      status: "completed",
      executionId: cachedResult.executionId,
      result: null,
      resultSha256: hashCanonical(cachedResult),
      failureMessage: null,
    },
  });
}

test("production gold broker revalidates a cached blind result and makes zero downstream calls", async () => {
  const roots = mkTestRoots("forward-gold-cached-blind");
  try {
    const instrument = buildForwardGoldEvaluatorInstrument();
    const frozen = buildGoldManifest({
      frozenAtIso: "2026-07-12T12:00:00.000Z",
      roleAssignmentSha256: ROLE_SHA,
      instrumentManifestSha256: INSTRUMENT_SHA,
      thresholdsSha256: "d".repeat(64),
      inputMaterializationSha256: "9".repeat(64),
      productionInstrumentSealSha256: "8".repeat(64),
      qualificationBookIds: ["qualification-only"],
      books: [{
        bookId: "gold-book",
        sourceComplete: true,
        representativeTags: ["fixture"],
        chapters: Array.from({ length: 8 }, (_, index) => coordinate(
          "gold-book",
          index + 1,
          FORWARD_CHAPTER_STRATA[index % FORWARD_CHAPTER_STRATA.length],
        )),
      }],
      pilotBookIds: ["pilot-a", "pilot-b"],
      pilotAccepted: true,
      pilotManifestSha256: "1".repeat(64),
      pilotResultSha256: "2".repeat(64),
      goldEvaluatorInstrumentSha256: instrument.instrumentSha256,
    });
    const phaseDir = resolve(roots.base, "phase");
    const controller = createForwardLiveCallLedger({
      budget: buildForwardLivePhaseBudget({
        manifest: frozen,
        panelPolicy: panelPolicy(),
        goldBookEvaluatorExpectedCalls: 4,
        goldBookEvaluatorMaximumCallsBeforeReplay: 4,
      }),
      phaseDir,
    });
    const sourceHash = "3".repeat(64);
    const expectedChapters = frozen.manifest.targets.map((target) => ({
      chapterIndex: target.chapterNumber,
      chapterId: target.chapterId,
      title: `Gold ${target.chapterNumber}`,
      packagePath: `chapters/ch${String(target.chapterNumber).padStart(2, "0")}.chapter.json`,
    }));
    const sourceEvidence = expectedChapters.map((chapter) => ({
      ...chapter,
      candidateContentSha256: sha256Hex(`content-${chapter.chapterId}`),
      sourceResultSha256: sha256Hex(`source-${chapter.chapterId}`),
      executionEnvelopeSha256: sha256Hex(`envelope-${chapter.chapterId}`),
      sourceStatus: "PASS" as const,
      sourceBlockerCount: 0,
      evidenceFresh: true,
    }));
    const sourceProof = buildForwardGoldSourceAwareExternalAccuracyProof({
      bookId: "gold-book",
      sourceHash,
      chapters: sourceEvidence,
    });
    const calls = instrument.calls.map((fixed, index) => {
      const cwd = resolve(phaseDir, "workspaces", fixed.callId);
      mkdirSync(cwd, { recursive: true });
      return {
        callId: fixed.callId,
        actorId: fixed.actorId,
        evaluationRole: fixed.evaluationRole,
        request: {},
        task: fixed.prompt,
        cwd,
        model: fixed.model,
        effort: fixed.effort,
        outputSchemaPath: resolveForwardGoldEvaluatorOutputSchemaPath(fixed),
        outputSchemaSha256: fixed.outputSchemaSha256,
        artifacts: [],
        instrumentSha256: instrument.instrumentSha256,
        productionInstrumentSealSha256: "8".repeat(64),
        sourceHash,
        dispatchReceiptSha256: String(index + 4).repeat(64),
        expectedChapters,
        blindRaterRole: fixed.evaluationRole === "blind-rater" ? (index === 0 ? "primary" as const : "verification" as const) : null,
        sourceAwareExternalAccuracy: sourceProof,
        expectedSourceLaneEvidence: sourceEvidence,
      };
    });
    const first = calls[0];
    const request = {
      actorId: first.actorId,
      evaluationRole: first.evaluationRole,
      taskSha256: sha256Hex(first.task),
      model: first.model,
      effort: first.effort,
      outputSchemaSha256: first.outputSchemaSha256,
      instrumentSha256: first.instrumentSha256,
      productionInstrumentSealSha256: first.productionInstrumentSealSha256,
      sourceHash: first.sourceHash,
      dispatchReceiptSha256: first.dispatchReceiptSha256,
      expectedChaptersSha256: hashCanonical(first.expectedChapters),
      sourceAwareExternalAccuracyProofSha256: first.sourceAwareExternalAccuracy.proofSha256,
      artifacts: [],
    };
    const logicalOperationId = "gold-book/book-evaluation/blind-rater-primary";
    const requestSha256 = hashCanonical(request);
    const context = {
      category: "gold-book-evaluator" as const,
      bookId: "gold-book",
      chapterNumber: null,
      stage: "book-evaluation" as const,
      logicalOperationId,
    };
    const attemptId = controller.begin({ context, attemptNumber: 1, requestSha256 });
    const operationDir = resolve(phaseDir, "model-calls", sha256Hex(logicalOperationId), "attempt-1");
    mkdirSync(operationDir, { recursive: true });
    writeFileSync(resolve(operationDir, "request.json"), `${JSON.stringify({ requestSha256, request })}\n`);
    const cachedResult = {
      actorId: first.actorId,
      executionId: "cached-invalid-blind",
      output: { schema_version: "2.0.0", rater_role: "primary", forged: true },
      outputSha256: "",
    };
    cachedResult.outputSha256 = hashCanonical(cachedResult.output);
    const modelReceipt = {
      schema: "forward-live-model-operation-receipt-v1",
      status: "completed" as const,
      executionId: cachedResult.executionId,
      result: cachedResult,
      failureMessage: null,
    };
    writeFileSync(resolve(operationDir, "receipt.json"), `${JSON.stringify(modelReceipt)}\n`);
    controller.complete({
      attemptId,
      requestSha256,
      receipt: {
        schema: "forward-live-call-receipt-v1",
        status: "completed",
        executionId: cachedResult.executionId,
        result: null,
        resultSha256: hashCanonical(cachedResult),
        failureMessage: null,
      },
    });
    const evaluator = createProductionLedgeredForwardGoldEvaluator({
      controller,
      phaseDir,
      buildCalls: () => calls,
      prepareAdjudicator: () => { throw new Error("adjudicator must not be prepared after an invalid cached blind result"); },
      prepareBookSweep: () => { throw new Error("sweep must not be prepared after an invalid cached blind result"); },
      assemble: () => { throw new Error("assembly must not run after an invalid cached blind result"); },
    });
    await assert.rejects(() => evaluator({ manifest: frozen.manifest, finalByChapter: {} }),
      /violates pinned blind-rater-output-schema|full-book denominator/);
    assert.equal(controller.ledger.entries.length, 1, "no downstream evaluator call may be reserved");
    assert.equal(controller.ledger.codexExecInvocations, 1, "the current resume must make zero new model calls");
    assert.equal(controller.ledger.cachedReceipts, 1);
  } finally {
    roots.dispose();
  }
});

test("production gold broker revalidates cached adjudicator and sweep results before downstream dispatch or assembly", async () => {
  for (const invalidRole of ["adjudicator", "book-sweep"] as const) {
    const roots = mkTestRoots(`forward-gold-cached-${invalidRole}`);
    try {
      const rig = cachedGoldBrokerRig(roots.base);
      const primary = makeForwardGoldEvaluatorOutput({
        role: "primary",
        expectedChapters: rig.expectedChapters,
        sourceHash: rig.sourceHash,
        dispatchReceiptSha256: rig.calls[0].dispatchReceiptSha256,
      });
      const verification = makeForwardGoldEvaluatorOutput({
        role: "verification",
        expectedChapters: rig.expectedChapters,
        sourceHash: rig.sourceHash,
        dispatchReceiptSha256: rig.calls[1].dispatchReceiptSha256,
      });
      seedCachedGoldCall(rig, 0, primary);
      seedCachedGoldCall(rig, 1, verification);
      if (invalidRole === "adjudicator") {
        seedCachedGoldCall(rig, 2, { schema_version: "2.0.0", rater_role: "adjudicated", forged: true });
      } else {
        seedCachedGoldCall(rig, 2, makeForwardGoldEvaluatorOutput({
          role: "adjudicated",
          expectedChapters: rig.expectedChapters,
          sourceHash: rig.sourceHash,
        }));
        seedCachedGoldCall(rig, 3, { source_hash: rig.sourceHash, forged: true });
      }
      let assembled = false;
      const evaluator = createProductionLedgeredForwardGoldEvaluator({
        controller: rig.controller,
        phaseDir: rig.phaseDir,
        buildCalls: () => rig.calls,
        prepareAdjudicator: ({ call }) => call,
        prepareBookSweep: ({ call }) => call,
        assemble: () => {
          assembled = true;
          throw new Error("invalid cached gold result must never reach assembly");
        },
      });
      await assert.rejects(() => evaluator({ manifest: rig.frozen.manifest, finalByChapter: {} }),
        /violates pinned adjudicator-output-schema|violates pinned sweep-output-schema/);
      assert.equal(assembled, false);
      const expectedCallsReached = invalidRole === "adjudicator" ? 3 : 4;
      assert.equal(rig.controller.ledger.entries.length, expectedCallsReached);
      assert.equal(rig.controller.ledger.cachedReceipts, expectedCallsReached);
      assert.equal(rig.controller.ledger.codexExecInvocations, expectedCallsReached,
        "resume validation must add zero live calls beyond the preseeded cached receipts");
    } finally {
      roots.dispose();
    }
  }
});

test("gold validation accepts a fresh retained experiment sweep without canonical QC state and rejects a stale supplied sweep", () => {
  const chapters = Array.from({ length: 8 }, (_, index) => fxChapter({
    chapterId: `gold-book-ch${String(index + 1).padStart(2, "0")}`,
    number: index + 1,
    title: `Gold ${index + 1}`,
  }));
  const hashes = Object.fromEntries(chapters.map((chapter) => [String(chapter.number), chapterContentHash(chapter)]));
  const evaluation = {
    technicalCompleteness: "PASS" as const,
    epistemicInstructionalSafety: "PASS" as const,
    ethicsReaderAutonomy: "PASS" as const,
    purposeAudienceDeclaration: "PASS" as const,
    externalAccuracy: "PASS" as const,
    contentDesignScore: 88,
  };
  const sweep = {
    schemaVersion: "sweep-attest-v1" as const,
    bookId: "gold-book",
    roundId: "imp22-forward-gold-independent-v1",
    verdict: "PASS" as const,
    reviewer: "gold-sweep-actor",
    reviewerSessionId: "gold-sweep-execution-1",
    attestedAt: "2026-07-12T12:00:00.000Z",
    contentHashes: hashes,
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: [],
  };
  assert.doesNotThrow(() => validateForwardGoldEvaluationArtifacts({
    bookId: "gold-book",
    finalChapters: chapters,
    finalChapterContentHashes: hashes,
    adjudicatorOutput: { evaluation },
    sweepOutput: { sweep },
  }));
  assert.throws(() => validateForwardGoldEvaluationArtifacts({
    bookId: "gold-book",
    finalChapters: chapters,
    finalChapterContentHashes: hashes,
    adjudicatorOutput: { evaluation },
    sweepOutput: { sweep: { ...sweep, contentHashes: { ...hashes, "1": "f".repeat(64) } } },
  }), /sweep is stale/);
});

test("CLI phase and explicit manifest kind are bound before any live execution", () => {
  const f = fixtures();
  assert.doesNotThrow(() => assertExplicitForwardManifestKind("pilot", f.manifest));
  assert.throws(() => assertExplicitForwardManifestKind("gold", f.manifest), /manifest kind is pilot/);
});

test("experiment-local gate context mirrors prior committed sibling chapters", async () => {
  const roots = mkTestRoots("forward-live-gate-siblings");
  try {
    const sameBook = materializeDestinationScaffold(
      roots.base,
      fixtures().manifest.manifest.targets.filter((target) => target.bookId === "pilot-a"),
    );
    const firstTarget = sameBook[0];
    const nextTarget = sameBook[1];
    const first = createExplicitExperimentAuthorDestination({
      phaseDir: roots.base,
      target: firstTarget,
      expectedInputFileInventory: inputFileInventory(roots.base, firstTarget.bookId),
    });
    const firstChapter = { chapterId: firstTarget.chapterId, number: firstTarget.chapterNumber } as any;
    first.io.writeChapterFile(firstTarget.bookId, firstTarget.chapterNumber, `${JSON.stringify(firstChapter)}\n`);
    let siblingNames: string[] = [];
    const next = createExplicitExperimentAuthorDestination({
      phaseDir: roots.base,
      target: nextTarget,
      expectedInputFileInventory: inputFileInventory(roots.base, nextTarget.bookId),
      gateCandidateImpl: async (_candidate, siblingContextPath) => {
        siblingNames = readdirSync(dirname(siblingContextPath));
        return { code: 0, stdout: "Gate verdict: PASS", stderr: "" };
      },
    });
    const nextChapter = { chapterId: nextTarget.chapterId, number: nextTarget.chapterNumber } as any;
    await next.io.gateCandidate(nextChapter, "/wrong/logical/manifest/path.json", "test-attempt");
    assert.ok(siblingNames.includes(`${firstTarget.chapterId}.v21-native.chapter.json`));
  } finally {
    roots.dispose();
  }
});

test("live destination keeps gate, evidence, diversity, logs, index, and broker paths inside the output run", async () => {
  const roots = mkTestRoots("forward-live-destination-containment");
  const priorEvidenceEnv = process.env.CHAPTERFLOW_EVIDENCE_ROOT;
  const priorDiversityEnv = process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT;
  try {
    const [target] = materializeDestinationScaffold(roots.base, [fixtures().manifest.manifest.targets[0]]);
    const ambientEvidence = join(roots.base, "ambient-evidence-must-stay-absent");
    const ambientDiversity = join(roots.base, "ambient-diversity-must-stay-absent");
    process.env.CHAPTERFLOW_EVIDENCE_ROOT = ambientEvidence;
    process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT = ambientDiversity;
    const canonicalGate = resolve(CANONICAL_STATE, "gate-attempts.json");
    const canonicalLogs = resolve(CANONICAL_STATE, "autopilot-logs", target.bookId);
    const gateBefore = fileSnapshot(canonicalGate);
    const logsBefore = fileSnapshot(canonicalLogs);
    const destination = createExplicitExperimentAuthorDestination({
      phaseDir: roots.base,
      target,
      expectedInputFileInventory: inputFileInventory(roots.base, target.bookId),
    });
    const chapter = makeGateCleanChapter(target.bookId, target.chapterNumber);

    const gate = await destination.io.gateCandidate(chapter, "/wrong/canonical/path.json", "live-containment-attempt");
    assert.ok(gate.code === 0 || gate.code === 1 || gate.code === 3);
    assert.equal(existsSync(destination.destinationProof.gateAttemptStateAbsPath), true);

    const attempt = mintChapterAttempt({
      bookId: target.bookId,
      chapterNumber: target.chapterNumber,
      chapterId: target.chapterId,
      attemptKind: "author-initial",
      attemptSequence: 1,
      promptSha256: "a".repeat(64),
      io: destination.io,
      attemptsRoot: destination.io.attemptsRoot(),
      evidenceRoot: destination.io.evidenceRoot?.(),
    });
    assert.equal(attempt.evidenceRoot, destination.destinationProof.evidenceRootAbs);
    assert.equal(existsSync(ambientEvidence), false);

    const diversity = recordChapterDiversity({
      root: destination.io.diversityLedgerRoot?.(),
      bookId: target.bookId,
      chapterNumber: target.chapterNumber,
      chapter,
      attemptKind: "author-initial",
      committedGeneration: 1,
    });
    assert.notEqual(diversity, null);
    assert.equal(existsSync(ambientDiversity), false);

    const fakeResult = {
      ok: true,
      exitCode: 0,
      finalMessage: "retained in the experiment only",
      stdout: "stdout",
      stderr: "",
      durationMs: 1,
      sessionId: "experiment-session-1",
    };
    persistForwardExperimentAuthorSession(
      destination.destinationProof.sessionLogRootAbs,
      target.bookId,
      "author-ch01",
      fakeResult,
    );
    assert.equal(fileSnapshot(canonicalLogs).sha256, logsBefore.sha256);
    assert.deepEqual(frozenForwardExperimentChapterNumbers(destination.destinationProof, target.bookId), [target.chapterNumber]);
    const spawn = bindForwardExperimentSpawnOptions(destination.destinationProof, {
      task: "no model call",
      sessionId: "placeholder",
      cwd: attempt.workspaceDir,
    }, "bound-session");
    assert.equal(spawn.manifestSink, destination.destinationProof.executionManifestRootAbs);
    assert.equal(spawn.qualificationCacheDir, destination.destinationProof.qualificationCacheRootAbs);
    assert.equal(spawn.execBaseDir, destination.destinationProof.execSessionRootAbs);
    assert.deepEqual(fileSnapshot(canonicalGate), gateBefore);
  } finally {
    if (priorEvidenceEnv === undefined) delete process.env.CHAPTERFLOW_EVIDENCE_ROOT;
    else process.env.CHAPTERFLOW_EVIDENCE_ROOT = priorEvidenceEnv;
    if (priorDiversityEnv === undefined) delete process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT;
    else process.env.CHAPTERFLOW_DIVERSITY_LEDGER_ROOT = priorDiversityEnv;
    roots.dispose();
  }
});

test("top-level live driver forwards exact attempt checkpoints and spends zero duplicate author calls", async () => {
  const roots = mkTestRoots("forward-live-driver-resume");
  try {
    const f = fixtures();
    const policy = panelPolicy();
    const { freezeSha256: _oldFreeze, ...roleBase } = f.roleFreeze as unknown as Record<string, unknown>;
    const roleFreeze = {
      ...roleBase,
      panelPolicy: policy,
      panelPolicySha256: policy.policySha256,
      freezeSha256: "",
    } as unknown as ForwardRoleAssignmentFreezeV1;
    roleFreeze.freezeSha256 = hashCanonical(Object.fromEntries(
      Object.entries(roleFreeze).filter(([key]) => key !== "freezeSha256"),
    ));
    const retained = new Map<string, ForwardValidationAttemptRecordV1>();
    for (const target of f.manifest.manifest.targets) {
      const key = `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`;
      const attemptDir = join(roots.base, "attempts", key.replace("/", "--"));
      mkdirSync(attemptDir, { recursive: true });
      retained.set(`${key}:first-write`, {
        schema: "forward-validation-attempt-record-v1",
        chapterKey: key,
        stage: "first-write",
        attemptId: `retained-${key}`,
        attemptDir,
        candidateBytesSha256: "a".repeat(64),
        candidateContentSha256: "b".repeat(64),
        patchSha256: null,
        reader: null,
        source: null,
        quiz: null,
        aggregate: null,
        executionEnvelope: null,
        executionEnvelopeSha256: null,
        disposition: "NOT_REVIEWED",
        finalStatus: "INCONCLUSIVE",
        pass: false,
        failureClassification: "REVIEW_INSTRUMENT",
        failureReasons: ["retained infrastructure halt"],
      });
    }
    let authorCalls = 0;
    let checkpointReads = 0;
    const durable = new Map<string, unknown>();
    const result = await runForwardLiveCampaign({
      phaseDir: join(roots.base, "phase"),
      manifest: f.manifest,
      inputFreeze: f.inputFreeze,
      roleFreeze,
      qualification: f.qualification,
      route: f.route,
      verifiedInputMaterializationSha256: f.verifiedInputMaterializationSha256,
      verifiedProductionInstrumentSealSha256: f.verifiedProductionInstrumentSealSha256,
      createAuthorProducer: () => Object.assign(async () => {
        authorCalls += 1;
        return { ok: false as const, reason: "must not execute", failureClassification: "MODEL_ROUTING" as const };
      }, { liveLedgerBound: true as const, executionBoundary: "hermetic-codex-broker" as const }),
      buildConductorInput: () => { throw new Error("review must remain unreachable"); },
      routeFirstFailure: ({ first }) => ({ kind: "stop", classification: first.failureClassification ?? "UNKNOWN", reason: "retained" }),
      classifyFailedRepair: () => "REPAIR_CONTENT_FAILURE",
      preserveAttempt: (record, contentSha256) => {
        const storageId = `attempt/${record.chapterKey}/${record.stage}`;
        durable.set(storageId, JSON.parse(JSON.stringify(record)));
        return { schema: "forward-persistence-receipt-v1", kind: "attempt", storageId, contentSha256 };
      },
      freezeFirstWriteMetrics: (snapshot, contentSha256) => {
        durable.set("snapshot", JSON.parse(JSON.stringify(snapshot)));
        return { schema: "forward-persistence-receipt-v1", kind: "first-write-snapshot", storageId: "snapshot", contentSha256 };
      },
      readPersistedEvidence: (receipt) => durable.get(receipt.storageId),
      loadPreservedAttempt: ({ target, stage }) => {
        checkpointReads += 1;
        return retained.get(`${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}:${stage}`) ?? null;
      },
    });
    assert.equal(checkpointReads, 8);
    assert.equal(authorCalls, 0);
    assert.equal(result.codexExecInvocations, 0);
  } finally {
    roots.dispose();
  }
});
