import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  qualificationRequestSha256,
  type QualificationExecutionRequestV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_ROLE_QUALIFICATION_ID,
} from "../src/bakeoff/migration/imp24Corpus.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { syntheticQualification } from "../src/exec/cliQualification.js";
import {
  createReviewEvidenceEnvelope,
  serializeReviewEvidenceEnvelope,
} from "../src/review/reviewEvidenceEnvelope.js";
import {
  ForwardRoleQualificationLiveV3Error,
  IMP24_V2_REVIEWER_SCHEMA_MAP,
  createLiveQualificationExecutorV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import {
  IMP24_REQUIRED_BRANCH,
  IMP24_REQUIRED_DRAFT_PR,
  IMP24_REQUIRED_WORKFLOW_FILE,
  IMP24_REQUIRED_WORKFLOW_JOB,
  IMP24_REQUIRED_WORKFLOW_NAME,
  buildImp24ImplementationCiGateFromEvidence,
  imp24ImplementationCiGateSha256,
  runImp24RoleQualificationCampaignV3,
  type Imp24ImplementationCiGateV1,
  type RunImp24RoleQualificationCampaignV3Args,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import type {
  CodexAgentResult,
  SpawnCodexAgentOptions,
} from "../src/orchestrator/codexAgent.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const FREEZE = "a".repeat(64);
const CERTIFICATION = "b".repeat(64);
const SEAL = "c".repeat(64);
const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const GATED_HEAD = "1".repeat(40);

function request(overrides: Partial<Omit<QualificationExecutionRequestV3, "requestSha256">> = {}): QualificationExecutionRequestV3 {
  const candidate = IMP24_ROLE_CANDIDATE_ORDER.reader[0];
  const envelope = createReviewEvidenceEnvelope({
    lane: "reader",
    envelopeId: "LIVE-V3-TEST-ENVELOPE",
    caseId: "LIVE-V3-TEST-CASE",
    instrumentVersion: "reader-experience-v2-envelope",
    segments: [{ refId: "R1", kind: "chapter", text: "A complete inline reader-visible test chapter." }],
  });
  const evidenceEnvelopeBytes = serializeReviewEvidenceEnvelope(envelope);
  const core: Omit<QualificationExecutionRequestV3, "requestSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    scheduleId: "v3-reader-p1-canary-c01",
    attemptId: "v3-reader-p1-canary-c01-a1",
    replayOfAttemptId: null,
    attemptNumber: 1,
    role: "reader",
    partition: "canary",
    caseId: envelope.caseId,
    family: "clean",
    profileId: candidate.profileId,
    model: candidate.model,
    effort: candidate.effort,
    schemaSha256: sha256Hex(readFileSync(IMP24_V2_REVIEWER_SCHEMA_MAP.reader)),
    promptSourceSha256: "d".repeat(64),
    goldSha256: "e".repeat(64),
    sourceCaseSha256: "f".repeat(64),
    freezeSha256: FREEZE,
    certificationSha256: CERTIFICATION,
    productionInstrumentSealSha256: SEAL,
    reviewProtocol: "review-evidence-envelope-v1",
    evidenceEnvelopeSha256: envelope.envelopeSha256,
    evidenceEnvelopeBytesSha256: sha256Hex(evidenceEnvelopeBytes),
    evidenceEnvelopeBytes,
    task: [
      "All evidence required for this review is included below.",
      "Do not use filesystem, shell, network, or external tools.",
      "Judge only the inline evidence envelope.",
      evidenceEnvelopeBytes,
    ].join("\n\n"),
    ...overrides,
  };
  return { ...core, requestSha256: qualificationRequestSha256(core) };
}

function ok(options: SpawnCodexAgentOptions, output = "{}"): CodexAgentResult {
  return {
    ok: true,
    exitCode: 0,
    finalMessage: output,
    stdout: output,
    stderr: "",
    durationMs: 1,
    sessionId: options.sessionId,
    finalMessageSource: "output-file",
  };
}

test("IMP-24 live V3 defaults to the strict V2 schemas and retains exact envelope bytes before one injected spawn", async () => {
  assert.deepEqual(Object.fromEntries(Object.entries(IMP24_V2_REVIEWER_SCHEMA_MAP)
    .map(([role, path]) => [role, basename(path)])), {
    reader: "reader-experience-model-output-v2.schema.json",
    source: "source-integrity-model-output-v2.schema.json",
    quiz: "quiz-integrity-model-output-v2.schema.json",
  });

  const roots = mkTestRoots("imp24-live-v3");
  let verifierCalls = 0;
  let spawnCalls = 0;
  let observedSchema = "";
  try {
    const req = request();
    const live = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: (actual) => {
        verifierCalls += 1;
        assert.equal(actual.requestSha256, req.requestSha256);
      },
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => {
        spawnCalls += 1;
        observedSchema = options.outputSchemaPath ?? "";
        assert.equal(options.sandbox, "read-only");
        assert.deepEqual(options.writableRoots, []);
        return ok(options);
      },
      clock: () => new Date("2026-07-13T12:00:00.000Z"),
    });
    const first = await live.executor(req);
    assert.equal(first.status, "completed");
    assert.equal(first.evidenceEnvelopeBytes, req.evidenceEnvelopeBytes);
    assert.equal(spawnCalls, 1);
    assert.equal(verifierCalls, 1);
    assert.equal(live.ledger.brokerRequests, 1);
    assert.equal(live.ledger.codexExecInvocations, 1);
    assert.equal(live.ledger.apiCallsMade, 0);
    assert.equal(observedSchema, IMP24_V2_REVIEWER_SCHEMA_MAP.reader);

    const attemptDir = resolve(roots.base, "phase", "attempts", req.attemptId);
    assert.equal(readFileSync(resolve(attemptDir, "evidence-envelope.json"), "utf8"), req.evidenceEnvelopeBytes,
      "retention must not append a newline or rewrite canonical envelope bytes");
    assert.deepEqual(JSON.parse(readFileSync(resolve(attemptDir, "request.json"), "utf8")), req);
    const retained = JSON.parse(readFileSync(resolve(attemptDir, "retention.json"), "utf8")) as {
      requestSha256: string;
      receiptSha256: string;
      evidenceEnvelopeBytesSha256: string;
    };
    assert.equal(retained.requestSha256, req.requestSha256);
    assert.equal(retained.receiptSha256, first.receiptSha256);
    assert.equal(retained.evidenceEnvelopeBytesSha256, req.evidenceEnvelopeBytesSha256);

    const cached = await live.executor(req);
    assert.deepEqual(cached, first);
    assert.equal(spawnCalls, 1, "a complete, exact retained judgment must not be replayed");
    assert.equal(verifierCalls, 1, "no mutable-route check is needed when no new spawn occurs");
    assert.equal(live.ledger.cachedReceipts, 1);
    assert.equal(live.ledger.codexExecInvocations, 1);

    const retentionPath = resolve(attemptDir, "retention.json");
    const tampered = JSON.parse(readFileSync(retentionPath, "utf8")) as Record<string, unknown>;
    tampered.retentionSha256 = "0".repeat(64);
    writeFileSync(retentionPath, `${JSON.stringify(tampered, null, 2)}\n`);
    await assert.rejects(live.executor(req), /retention self hash mismatch on resume/);
    assert.equal(spawnCalls, 1, "tampered resume state must fail closed without a new judgment");
  } finally {
    roots.dispose();
  }
});

test("IMP-24 live V3 revalidates immediately before each spawn and counts only an actual codex-exec invocation", async () => {
  const deniedRoots = mkTestRoots("imp24-live-v3-denied");
  let deniedSpawn = 0;
  try {
    const req = request();
    const live = createLiveQualificationExecutorV3({
      phaseDir: resolve(deniedRoots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => { throw new ForwardRoleQualificationLiveV3Error("seal drift at spawn boundary"); },
      workspaceBaseDir: deniedRoots.workspacesRoot,
      spawn: async (options) => { deniedSpawn += 1; return ok(options); },
    });
    const denied = await live.executor(req);
    assert.equal(denied.status, "policy_failure");
    assert.match(denied.failureDetail ?? "", /seal drift at spawn boundary/);
    assert.equal(deniedSpawn, 0);
    assert.equal(live.ledger.brokerRequests, 1);
    assert.equal(live.ledger.codexExecInvocations, 0);
    assert.equal(live.ledger.apiCallsMade, 0);
  } finally {
    deniedRoots.dispose();
  }

  const schemaRoots = mkTestRoots("imp24-live-v3-schema");
  let verifierCalls = 0;
  let schemaSpawn = 0;
  try {
    const req = request({
      attemptId: "v3-reader-p1-canary-c01-schema-drift-a1",
      schemaSha256: "9".repeat(64),
    });
    const live = createLiveQualificationExecutorV3({
      phaseDir: resolve(schemaRoots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => { verifierCalls += 1; },
      workspaceBaseDir: schemaRoots.workspacesRoot,
      spawn: async (options) => { schemaSpawn += 1; return ok(options); },
    });
    const failed = await live.executor(req);
    assert.equal(failed.status, "policy_failure");
    assert.match(failed.failureDetail ?? "", /pre-spawn schema hash drift/);
    assert.equal(verifierCalls, 0, "schema failure occurs before the mutable route reaches its spawn seam");
    assert.equal(schemaSpawn, 0);
    assert.equal(live.ledger.codexExecInvocations, 0);
  } finally {
    schemaRoots.dispose();
  }
});

test("IMP-24 live V3 rejects partial attempts and cannot be constructed without a per-call trust recheck", async () => {
  const roots = mkTestRoots("imp24-live-v3-partial");
  const req = request();
  try {
    assert.throws(() => createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "untrusted"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
    }), /requires per-call production-seal\/auth verification inputs/);

    const phaseDir = resolve(roots.base, "partial");
    const attemptDir = resolve(phaseDir, "attempts", req.attemptId);
    mkdirSync(attemptDir, { recursive: true });
    writeFileSync(resolve(attemptDir, "request.json"), `${JSON.stringify(req, null, 2)}\n`);
    let spawns = 0;
    const live = createLiveQualificationExecutorV3({
      phaseDir,
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => { spawns += 1; return ok(options); },
    });
    await assert.rejects(live.executor(req), /attempt .* is partial; refuse replay/);
    assert.equal(spawns, 0);
    assert.equal(live.ledger.codexExecInvocations, 0);
  } finally {
    roots.dispose();
  }
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function implementationGate(headSha = GATED_HEAD): Imp24ImplementationCiGateV1 {
  const core: Omit<Imp24ImplementationCiGateV1, "gateSha256"> = {
    schema: "imp24-implementation-ci-gate-v2",
    branch: IMP24_REQUIRED_BRANCH,
    headSha,
    workflow: {
      name: IMP24_REQUIRED_WORKFLOW_NAME,
      file: IMP24_REQUIRED_WORKFLOW_FILE,
      job: IMP24_REQUIRED_WORKFLOW_JOB,
      runId: 2401,
      headSha,
      conclusion: "PASS",
    },
    pullRequest: {
      number: IMP24_REQUIRED_DRAFT_PR,
      state: "OPEN",
      isDraft: true,
      merged: false,
      mergedAt: null,
      mergeCommitSha: null,
      headBranch: IMP24_REQUIRED_BRANCH,
      headSha,
    },
    trustedEvidence: {
      method: "git-and-gh-cli-live-query-v1",
      checkoutSha256: "9".repeat(64),
      workflowRunSha256: "a".repeat(64),
      pullRequestSha256: "b".repeat(64),
    },
    verifiedAt: "2026-07-13T12:00:00.000Z",
    modelCalls: 0,
    apiCalls: 0,
  };
  return { ...core, gateSha256: imp24ImplementationCiGateSha256(core) };
}

test("IMP-24 official campaign rejects an artifact-producing synthetic executor boundary", async () => {
  const roots = mkTestRoots("imp24-live-v3-campaign");
  const experimentDir = resolve(roots.base, "state", "migration-experiments", IMP24_ROLE_QUALIFICATION_ID);
  let checkoutCalls = 0;
  let spawnCalls = 0;
  let verifierCalls = 0;
  try {
    const args = {
      executeLive: true,
      expectedHeadSha: GATED_HEAD,
      workflowRunId: 2401,
      repositoryRoot: REPOSITORY_ROOT,
      experimentDir,
      checkoutIdentity: () => { checkoutCalls += 1; },
      executor: {
        preCallVerifier: () => { verifierCalls += 1; },
        spawn: async () => { spawnCalls += 1; throw new Error("synthetic spawn must not run"); },
      },
    } as unknown as RunImp24RoleQualificationCampaignV3Args;

    await assert.rejects(runImp24RoleQualificationCampaignV3(args),
      /official V3 campaign rejects synthetic\/test seams/);
    assert.equal(checkoutCalls, 0);
    assert.equal(spawnCalls, 0);
    assert.equal(verifierCalls, 0);
    assert.equal(existsSync(experimentDir), false,
      "a rejected synthetic official campaign must not create qualification artifacts");
  } finally {
    roots.dispose();
  }
});

test("IMP-24 official campaign rejects synthetic crash/replay seams before state or calls", async () => {
  const roots = mkTestRoots("imp24-live-v3-campaign-crash-resume");
  const experimentDir = resolve(roots.base, "state", "migration-experiments", IMP24_ROLE_QUALIFICATION_ID);
  let checkoutCalls = 0;
  let spawnCalls = 0;
  let verifierCalls = 0;

  try {
    const args = {
      executeLive: true,
      expectedHeadSha: GATED_HEAD,
      workflowRunId: 2401,
      repositoryRoot: REPOSITORY_ROOT,
      experimentDir,
      checkoutIdentity: () => { checkoutCalls += 1; },
      preflight: {
        cliQualifier: async () => { verifierCalls += 1; return syntheticQualification(); },
      },
      spawn: async () => { spawnCalls += 1; },
      preCallVerifier: () => { verifierCalls += 1; },
    } as unknown as RunImp24RoleQualificationCampaignV3Args;

    await assert.rejects(runImp24RoleQualificationCampaignV3(args),
      /official V3 campaign rejects synthetic\/test seams/);
    assert.equal(checkoutCalls, 0);
    assert.equal(spawnCalls, 0);
    assert.equal(verifierCalls, 0);
    assert.equal(existsSync(experimentDir), false,
      "a rejected synthetic official campaign must not create qualification artifacts");
  } finally {
    roots.dispose();
  }
});

test("IMP-24 campaign dry mode is first and official live mode rejects caller-supplied trust seams", async () => {
  let checkoutCalls = 0;
  const dry = await runImp24RoleQualificationCampaignV3({
    executeLive: false,
    checkoutIdentity: () => { checkoutCalls += 1; throw new Error("dry mode reached checkout"); },
  } as unknown as RunImp24RoleQualificationCampaignV3Args);
  assert.equal(dry.executed, false);
  assert.equal(dry.modelCalls, 0);
  assert.equal(dry.apiCalls, 0);
  assert.equal(checkoutCalls, 0);

  const invalid = clone(implementationGate()) as unknown as Record<string, unknown>;
  (invalid.workflow as Record<string, unknown>).conclusion = "FAIL";
  const { gateSha256: _old, ...invalidCore } = invalid;
  invalid.gateSha256 = imp24ImplementationCiGateSha256(invalidCore as Omit<Imp24ImplementationCiGateV1, "gateSha256">);
  await assert.rejects(
    runImp24RoleQualificationCampaignV3({
      executeLive: true,
      expectedHeadSha: GATED_HEAD,
      implementationCiGate: invalid as unknown as Imp24ImplementationCiGateV1,
      repositoryRoot: REPOSITORY_ROOT,
      checkoutIdentity: () => { checkoutCalls += 1; return { branch: IMP24_REQUIRED_BRANCH, headSha: GATED_HEAD, implementationClean: true }; },
    } as unknown as RunImp24RoleQualificationCampaignV3Args),
    /official V3 campaign rejects synthetic\/test seams/,
  );
  assert.equal(checkoutCalls, 0);

  await assert.rejects(
    runImp24RoleQualificationCampaignV3({
      executeLive: true,
      expectedHeadSha: GATED_HEAD,
      implementationCiGate: implementationGate(),
      repositoryRoot: REPOSITORY_ROOT,
      checkoutIdentity: () => ({ branch: IMP24_REQUIRED_BRANCH, headSha: "2".repeat(40), implementationClean: true }),
    } as unknown as RunImp24RoleQualificationCampaignV3Args),
    /official V3 campaign rejects synthetic\/test seams/,
  );
});

test("IMP-24 implementation gate binds independently supplied checkout, workflow, job, and draft-PR evidence", () => {
  const checkout = { branch: IMP24_REQUIRED_BRANCH, headSha: GATED_HEAD, implementationClean: true };
  const workflowRun = {
    databaseId: 2401,
    workflowName: IMP24_REQUIRED_WORKFLOW_NAME,
    headBranch: IMP24_REQUIRED_BRANCH,
    headSha: GATED_HEAD,
    status: "completed",
    conclusion: "success",
    jobs: [{ name: IMP24_REQUIRED_WORKFLOW_JOB, status: "completed", conclusion: "success" }],
  };
  const pullRequest = {
    number: IMP24_REQUIRED_DRAFT_PR,
    state: "OPEN",
    isDraft: true,
    mergedAt: null,
    mergeCommit: null,
    headRefName: IMP24_REQUIRED_BRANCH,
    headRefOid: GATED_HEAD,
  };
  const gate = buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: GATED_HEAD,
    workflowRunId: 2401,
    checkout,
    workflowRun,
    pullRequest,
    verifiedAt: "2026-07-13T12:00:00.000Z",
  });
  assert.equal(gate.schema, "imp24-implementation-ci-gate-v2");
  assert.equal(gate.workflow.conclusion, "PASS");
  assert.equal(gate.pullRequest.isDraft, true);
  assert.equal(gate.trustedEvidence.checkoutSha256, hashCanonical(checkout));
  assert.equal(gate.trustedEvidence.workflowRunSha256, hashCanonical(workflowRun));
  assert.equal(gate.trustedEvidence.pullRequestSha256, hashCanonical(pullRequest));
  assert.throws(() => buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: GATED_HEAD,
    workflowRunId: 2401,
    checkout,
    workflowRun: { ...workflowRun, conclusion: "failure" },
    pullRequest,
    verifiedAt: "2026-07-13T12:00:00.000Z",
  }), /does not show the dedicated V25 workflow PASS/);
});
