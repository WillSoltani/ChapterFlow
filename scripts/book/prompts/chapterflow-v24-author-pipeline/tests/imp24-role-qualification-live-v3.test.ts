import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  qualificationRequestSha256,
  type CaseEvaluationV3,
  type QualificationAttemptV3,
  type QualificationExecutionRequestV3,
  type QualificationExecutionReceiptV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
} from "../src/bakeoff/migration/imp24Corpus.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { syntheticQualification } from "../src/exec/cliQualification.js";
import { describeCodexTransportOutputSchema } from "../src/exec/codexTransportConfig.js";
import { resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import { STRICT_PIPELINE_ENV } from "../src/lib/strictEnv.js";
import {
  createReviewEvidenceEnvelope,
  serializeReviewEvidenceEnvelope,
} from "../src/review/reviewEvidenceEnvelope.js";
import {
  ForwardRoleQualificationLiveV3Error,
  IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24_V2_REVIEWER_SCHEMA_MAP,
  buildAttemptEvaluationArtifact,
  createLiveQualificationExecutorV3,
  liveQualificationExecutionSessionIdV3,
  replayReceiptChronologyViolationsV3,
  type LiveCallLedgerEntryV3,
  type LiveQualificationExecutionRequestV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import {
  IMP24_IMPLEMENTATION_CI_GATE_SCHEMA,
  IMP24_REQUIRED_BRANCH,
  IMP24_REQUIRED_DRAFT_PR,
  IMP24_REQUIRED_REPOSITORY,
  IMP24_REQUIRED_REPOSITORY_URL,
  IMP24_REQUIRED_WORKFLOW_FILE,
  IMP24_REQUIRED_WORKFLOW_JOB,
  IMP24_REQUIRED_WORKFLOW_NAME,
  IMP24_WORKFLOW_RUN_QUERY_FIELDS,
  assertImp24BlockedRoleAssignmentArtifactsAbsent,
  buildImp24ImplementationCiGateFromEvidence,
  imp24ImplementationCiGateSha256,
  mapImp24GithubWorkflowRunQuery,
  runImp24RoleQualificationCampaignV3,
  validateImp24ImplementationCiGate,
  type Imp24GithubWorkflowRunQueryV1,
  type Imp24ImplementationCiGateV1,
  type Imp24TrustedPullRequestEvidenceV1,
  type RunImp24RoleQualificationCampaignV3Args,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import { resolveRoute, routeDriftFingerprint } from "../src/orchestrator/modelPolicy.js";
import {
  CodexRunnerProcessError,
  type CodexAgentResult,
  type SpawnCodexAgentOptions,
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
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
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

function writePrettyJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

test("IMP-24D smoke control identity uses distinct request, ledger, root, and session identities without retaining r2", async () => {
  const roots = mkTestRoots("imp24d-smoke-control-identity");
  try {
    assert.throws(() => createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "unauthorized-control-identity"),
      executionId: "s16-forward-role-qualification-v3-envelope-arbitrary-control" as never,
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
    }), /not an authorized qualification or transport-smoke identity/);
    assert.equal(existsSync(resolve(roots.base, "unauthorized-control-identity")), false);

    const qualificationRequest = request();
    const {
      requestSha256: _requestSha256,
      experimentId: _experimentId,
      scheduleId: _scheduleId,
      attemptId: _attemptId,
      ...unchanged
    } = qualificationRequest;
    const smokeCore: Omit<LiveQualificationExecutionRequestV3, "requestSha256"> = {
      ...unchanged,
      experimentId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
      scheduleId: `${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}-reader-canary`,
      attemptId: `${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}-reader-canary-a1`,
    };
    const smokeRequest: LiveQualificationExecutionRequestV3 = {
      ...smokeCore,
      requestSha256: hashCanonical(smokeCore),
    };
    const phaseDir = resolve(roots.base, IMP24D_TRANSPORT_SMOKE_EXECUTION_ID, "live");
    const live = createLiveQualificationExecutorV3({
      phaseDir,
      executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => {},
      spawn: async (options) => ok(options, "{}", "canonical"),
      workspaceBaseDir: resolve(roots.base, "workspaces"),
    });
    const receipt = await live.controlExecutor(smokeRequest);
    assert.equal(receipt.status, "completed");
    assert.equal(live.ledger.experimentId, IMP24D_TRANSPORT_SMOKE_EXECUTION_ID);
    assert.equal(live.ledger.brokerRequests, 1);
    assert.equal(live.ledger.codexExecInvocations, 1);
    assert.equal(receipt.executionId, liveQualificationExecutionSessionIdV3(smokeRequest));
    assert.notEqual(receipt.executionId, liveQualificationExecutionSessionIdV3(qualificationRequest));

    const projectedLegacy = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "closed-cycle-one-projected"),
      executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => {},
      spawn: async (options) => ok(options),
      workspaceBaseDir: resolve(roots.base, "closed-cycle-one-projected-workspaces"),
    });
    await assert.rejects(projectedLegacy.controlExecutor(smokeRequest),
      /effective-context manifest semantic binding drift/,
      "closed cycle-one evidence must retain its historical canonical argv path");

    const assertNoR2 = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = resolve(dir, name);
        if (statSync(path).isDirectory()) assertNoR2(path);
        else assert.equal(readFileSync(path).includes(IMP24_ROLE_QUALIFICATION_EXECUTION_ID), false,
          `smoke artifact retained r2 identity: ${path}`);
      }
    };
    assertNoR2(resolve(roots.base, IMP24D_TRANSPORT_SMOKE_EXECUTION_ID));

    const qualificationOnly = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "qualification-default"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => {},
      spawn: async (options) => ok(options),
    });
    await assert.rejects(qualificationOnly.controlExecutor(smokeRequest), /wrong request schema\/identity/);
    assert.equal(qualificationOnly.ledger.brokerRequests, 0);
  } finally {
    roots.dispose();
  }
});

function ok(
  options: SpawnCodexAgentOptions,
  output = "{}",
  schemaArgv: "projected" | "canonical" = "projected",
): CodexAgentResult {
  assert.equal(options.role, "chapter-reviewer");
  assert.equal(options.sandbox, "read-only");
  assert.ok(options.manifestSink);
  assert.ok(options.execBaseDir);
  assert.ok(options.outputSchemaPath);
  assert.ok(options.workspaceManifest);
  const { profile, profileHash } = resolveExecutionProfile("chapter-reviewer");
  const route = resolveRoute({
    role: "chapter-reviewer",
    requestedModel: options.model,
    requestedEffort: options.reasoningEffort,
  });
  const cliVersion = "codex-cli 0.144.1";
  const sessionDir = resolve(options.execBaseDir, `cf-exec-session-${options.sessionId.slice(-12)}`);
  const codexHomeDir = resolve(sessionDir, "codex-home");
  const lastMessagePath = resolve(sessionDir, "last-message.txt");
  const schemaPath = resolve(options.outputSchemaPath);
  const transportSchemaPath = schemaArgv === "canonical"
    ? schemaPath
    : describeCodexTransportOutputSchema({
      outputSchemaPath: schemaPath,
      lastMessagePath,
    }).transportPath;
  const schemaSha256 = sha256Hex(readFileSync(schemaPath));
  const manifestPath = resolve(options.manifestSink, `20260713-120000-${options.sessionId}.manifest.json`);
  mkdirSync(dirname(manifestPath), { recursive: true });
  const envKeys = [
    "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE",
    "CHAPTERFLOW_NO_API_CODEX_QC",
    "CHAPTERFLOW_SESSION_ID",
    "CODEX_HOME",
  ];
  writePrettyJson(manifestPath, {
    schema: "effective-context-manifest-v1",
    manifestVersion: 1,
    sessionId: options.sessionId,
    role: "chapter-reviewer",
    profileHash,
    bin: { path: "codex", version: cliVersion },
    argv: [
      "exec", "--sandbox", "read-only", "--skip-git-repo-check",
      "--ignore-user-config", "--ignore-rules", "-c", "project_doc_max_bytes=0",
      "-c", `model=${options.model}`, "-c", `model_reasoning_effort=${options.reasoningEffort}`,
      "--output-schema", transportSchemaPath, "--output-last-message", lastMessagePath,
      `<task-sha256:${sha256Hex(options.task)}>`,
    ],
    cwd: options.cwd,
    cwdPolicy: "isolated-workspace",
    envKeys,
    callerEnvKeys: [],
    strictEnv: STRICT_PIPELINE_ENV,
    codexHome: {
      dir: codexHomeDir,
      authMaterial: "auth.json",
      authSourcePath: resolve(dirname(options.execBaseDir), "fixture-auth-source", "auth.json"),
    },
    instructionSources: [],
    workspace: {
      dir: options.workspaceManifest.dir,
      files: options.workspaceManifest.files.map((file) => ({ ...file })),
    },
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    sandbox: "read-only",
    timeoutMs: options.timeoutMs,
    taskSha256: sha256Hex(options.task),
    taskBytes: Buffer.byteLength(options.task),
    qualification: {
      cliVersion,
      flagsRequired: [...profile.requiredCliFlags],
      synthetic: false,
    },
    createdAtIso: "2026-07-13T12:00:00.000Z",
  });
  writePrettyJson(manifestPath.replace(/\.manifest\.json$/, ".route.json"), {
    schema: "route-result-v1",
    taskClass: route.taskClass,
    profileName: route.profileName,
    routePolicyVersion: route.routePolicyVersion,
    requestedModel: route.model,
    requestedEffort: route.effort,
    aliasOrSnapshot: route.model,
    executionProfileHash: profileHash,
    cliVersion,
    outcome: "content_completed",
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    driftFingerprint: routeDriftFingerprint({
      model: route.model,
      effort: route.effort,
      taskClass: route.taskClass,
      routePolicyVersion: route.routePolicyVersion,
      executionProfileHash: profileHash,
      cliVersion,
    }),
  });
  writePrettyJson(manifestPath.replace(/\.manifest\.json$/, ".structured.json"), {
    schema: "structured-output-sidecar-v1",
    sessionId: options.sessionId,
    outputSchemaPath: schemaPath,
    outputSchemaSha256: schemaSha256,
    rawFinalMessageSha256: sha256Hex(output),
    rawFinalMessageBytes: Buffer.byteLength(output),
    parsedOk: true,
  });
  writePrettyJson(manifestPath.replace(/\.manifest\.json$/, ".result.json"), {
    schema: "exec-result-v1",
    sessionId: options.sessionId,
    exitCode: 0,
    ok: true,
    durationMs: 1,
    stdoutSha256: sha256Hex(output),
    stdoutBytes: Buffer.byteLength(output),
    stderrSha256: sha256Hex(""),
    stderrBytes: 0,
    finalMessageSource: "output-file",
    finalMessageSha256: sha256Hex(output),
    endedAtIso: "2026-07-13T12:00:00.001Z",
  });
  options.onRunnerBoundary?.({
    sessionId: options.sessionId,
    manifestPath,
    schemaBound: true,
    outputSchemaPath: schemaPath,
    outputSchemaSha256: schemaSha256,
  });
  return {
    ok: true,
    exitCode: 0,
    finalMessage: output,
    stdout: output,
    stderr: "",
    durationMs: 1,
    sessionId: options.sessionId,
    finalMessageSource: "output-file",
    manifestPath,
  };
}

const RETAINED_EVALUATION: CaseEvaluationV3 = {
  schemaValid: true,
  envelopeBound: true,
  evidenceReferenceValid: true,
  authorityCompliant: true,
  complete: true,
  fileAccessFailure: false,
  prohibitedConductorEcho: false,
  resolved: true,
  semanticCorrect: true,
  semanticSummary: "synthetic retained reader judgment",
  metricObservations: { schemaValidity: true, evidenceSpanValidity: true },
  parsedOutput: {
    schema: "reader-experience-model-output-v2",
    evidenceRefIds: ["R1"],
  },
  parseError: null,
  assembledReview: {
    schema: "reader-experience-review-v2",
    evidenceRefIds: ["R1"],
    evidenceSpans: ["A complete inline reader-visible test chapter."],
  },
  assemblyError: null,
  evidenceReferenceResolution: {
    status: "RESOLVED",
    bindings: [{
      path: "$.evidenceRefIds",
      refIds: ["R1"],
      evidenceSpans: ["A complete inline reader-visible test chapter."],
    }],
    unresolvedTargetRefs: [],
    unresolvedQuestionRefs: [],
    error: null,
  },
};

function attemptFor(
  req: QualificationExecutionRequestV3,
  receipt: QualificationExecutionReceiptV3,
  evaluation: CaseEvaluationV3 | null,
): QualificationAttemptV3 {
  const completed = receipt.status === "completed";
  return {
    schema: IMP24_ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
    scheduleOrdinal: 0,
    request: req,
    receipt,
    routeValid: true,
    replayEligible: ["timeout", "provider_capacity", "transient_execution_failure"].includes(receipt.status),
    evaluation,
    protocolValid: completed && evaluation !== null,
    semanticCorrect: evaluation?.semanticCorrect ?? null,
    rawOutputSha256: typeof receipt.rawOutput === "string" ? sha256Hex(receipt.rawOutput) : null,
    retainedEnvelopeBytes: req.evidenceEnvelopeBytes,
    retainedEnvelopeBytesSha256: req.evidenceEnvelopeBytesSha256,
    terminalReason: completed
      ? evaluation === null ? "completed with invalid output" : "completed"
      : `${receipt.status}: ${receipt.failureDetail ?? ""}`.trim(),
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
    assert.equal(live.ledger.maxPlanCapacityEvents, 0);
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
      processDiagnosticsSha256: string;
    };
    assert.equal(retained.requestSha256, req.requestSha256);
    assert.equal(retained.receiptSha256, first.receiptSha256);
    assert.equal(retained.evidenceEnvelopeBytesSha256, req.evidenceEnvelopeBytesSha256);

    const crashedResume = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => { spawnCalls += 1; return ok(options); },
    });
    await assert.rejects(crashedResume.executor(req), /exact seven-file evidence is required/,
      "a crash after the six call files but before evaluation retention must never reuse the old partial");
    assert.equal(spawnCalls, 1, "six-file crash state must fail closed without a second judgment");

    const attempt = attemptFor(req, first, RETAINED_EVALUATION);
    live.retainAttemptEvaluation(attempt);
    assert.deepEqual(readdirSync(attemptDir).sort(), [
      "evaluation.json",
      "evidence-envelope.json",
      "execution-evidence.json",
      "process-diagnostics.json",
      "receipt.json",
      "request.json",
      "retention.json",
    ]);
    const processDiagnosticsPath = resolve(attemptDir, "process-diagnostics.json");
    const processDiagnosticsBytes = readFileSync(processDiagnosticsPath, "utf8");
    const processDiagnostics = JSON.parse(processDiagnosticsBytes) as {
      schema: string;
      invocation: string;
      classification: string;
      stdoutSha256: string;
      stderrSha256: string;
      diagnosticsSha256: string;
    };
    assert.equal(processDiagnostics.schema, "codex-process-diagnostics-v1");
    assert.equal(processDiagnostics.invocation, "RUNNER_RETURNED");
    assert.equal(processDiagnostics.classification, "completed");
    assert.equal(retained.processDiagnosticsSha256, processDiagnostics.diagnosticsSha256);
    assert.equal(live.ledger.entries[0]!.processDiagnosticsSha256, processDiagnostics.diagnosticsSha256);

    rmSync(processDiagnosticsPath);
    const missingDiagnosticsResume = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => { spawnCalls += 1; return ok(options); },
    });
    await assert.rejects(missingDiagnosticsResume.executor(req), /exact seven-file evidence is required/);
    writeFileSync(processDiagnosticsPath, processDiagnosticsBytes);

    const modifiedDiagnostics = { ...processDiagnostics, stderrSha256: "f".repeat(64) };
    writeFileSync(processDiagnosticsPath, `${JSON.stringify(modifiedDiagnostics, null, 2)}\n`);
    const modifiedDiagnosticsResume = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => { spawnCalls += 1; return ok(options); },
    });
    await assert.rejects(modifiedDiagnosticsResume.executor(req), /process diagnostics self hash drift/);
    writeFileSync(processDiagnosticsPath, processDiagnosticsBytes);
    assert.equal(spawnCalls, 1, "missing or modified diagnostics must never trigger a fresh judgment");
    const evaluationPath = resolve(attemptDir, "evaluation.json");
    const evaluationArtifact = JSON.parse(readFileSync(evaluationPath, "utf8")) as ReturnType<typeof buildAttemptEvaluationArtifact>;
    assert.deepEqual(evaluationArtifact, buildAttemptEvaluationArtifact(
      attempt,
      live.ledger.entries[0]!.executionEvidenceSha256!,
    ));
    assert.deepEqual(evaluationArtifact.evaluation?.parsedOutput, RETAINED_EVALUATION.parsedOutput);
    assert.deepEqual(evaluationArtifact.evaluation?.assembledReview, RETAINED_EVALUATION.assembledReview);
    assert.ok((evaluationArtifact.evaluation?.evidenceReferenceResolution.bindings.length ?? 0) > 0,
      "resolved evidence must retain explicit nonempty ref/span bindings");

    const unexpectedPath = resolve(attemptDir, "unexpected.json");
    writeFileSync(unexpectedPath, "{}\n");
    const extraFileResume = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => { spawnCalls += 1; return ok(options); },
    });
    await assert.rejects(extraFileResume.executor(req), /exact seven-file evidence is required/);
    assert.equal(spawnCalls, 1, "extra retained evidence must stop cached reuse without a new judgment");
    rmSync(unexpectedPath);

    const symlinkTarget = resolve(roots.base, "retained-evaluation-target.json");
    writeFileSync(symlinkTarget, readFileSync(evaluationPath));
    rmSync(evaluationPath);
    symlinkSync(symlinkTarget, evaluationPath);
    const symlinkResume = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => { spawnCalls += 1; return ok(options); },
    });
    await assert.rejects(symlinkResume.executor(req), /evaluation\.json must be a regular non-symlink file/);
    assert.equal(spawnCalls, 1, "symlinked retained evidence must stop cached reuse without a new judgment");
    rmSync(evaluationPath);
    writeFileSync(evaluationPath, readFileSync(symlinkTarget));
    rmSync(symlinkTarget);

    const cached = await live.executor(req);
    assert.deepEqual(cached, first);
    assert.equal(spawnCalls, 1, "a complete, exact retained judgment must not be replayed");
    assert.equal(verifierCalls, 1, "no mutable-route check is needed when no new spawn occurs");
    assert.equal(live.ledger.cachedReceipts, 1);
    assert.equal(live.ledger.codexExecInvocations, 1);
    live.retainAttemptEvaluation(attempt);

    const ledgerPath = resolve(roots.base, "phase", "call-ledger.json");
    const exactLedgerBytes = readFileSync(ledgerPath, "utf8");
    for (const tamperedEvaluationHash of [null, "0".repeat(64)] as const) {
      const ledgerTamper = JSON.parse(exactLedgerBytes) as {
        entries: Array<{ evaluationArtifactSha256: string | null }>;
      };
      ledgerTamper.entries[0].evaluationArtifactSha256 = tamperedEvaluationHash;
      writeFileSync(ledgerPath, `${JSON.stringify(ledgerTamper, null, 2)}\n`);
      const ledgerTamperResume = createLiveQualificationExecutorV3({
        phaseDir: resolve(roots.base, "phase"),
        freezeSha256: FREEZE,
        certificationSha256: CERTIFICATION,
        productionInstrumentSealSha256: SEAL,
        preCallVerifier: () => undefined,
        workspaceBaseDir: roots.workspacesRoot,
        spawn: async (options) => { spawnCalls += 1; return ok(options); },
      });
      await assert.rejects(ledgerTamperResume.executor(req),
        /call ledger evaluation hash differs from retained evaluation/,
        "five files with a missing or conflicting ledger commit marker must stop cached reuse");
      assert.equal(spawnCalls, 1);
      writeFileSync(ledgerPath, exactLedgerBytes);
    }

    const exactEvaluationHash = live.ledger.entries[0].evaluationArtifactSha256;
    live.ledger.entries[0].evaluationArtifactSha256 = "0".repeat(64);
    assert.throws(() => live.retainAttemptEvaluation(attempt),
      /call-ledger evaluation hash conflicts with retained evaluation/,
      "evaluation retention must reject, not silently repair, a conflicting ledger hash");
    live.ledger.entries[0].evaluationArtifactSha256 = exactEvaluationHash;

    const evaluationTamper = JSON.parse(readFileSync(evaluationPath, "utf8")) as ReturnType<typeof buildAttemptEvaluationArtifact>;
    evaluationTamper.evaluation = {
      ...evaluationTamper.evaluation!,
      parsedOutput: { schema: "tampered-reader-output", evidenceRefIds: ["R1"] },
    };
    evaluationTamper.parsedOutputSha256 = hashCanonical(evaluationTamper.evaluation.parsedOutput);
    evaluationTamper.evaluationSha256 = hashCanonical(evaluationTamper.evaluation);
    const { evaluationArtifactSha256: _oldArtifactHash, ...evaluationTamperCore } = evaluationTamper;
    evaluationTamper.evaluationArtifactSha256 = hashCanonical(evaluationTamperCore);
    writeFileSync(evaluationPath, `${JSON.stringify(evaluationTamper, null, 2)}\n`);
    assert.throws(() => live.retainAttemptEvaluation(attempt), /retained evaluation differs on resume/,
      "even a self-consistent parsed-output rewrite must not replace the frozen evaluation");
    writeFileSync(evaluationPath, `${JSON.stringify(evaluationArtifact, null, 2)}\n`);

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

test("IMP-24D live evidence accepts only the deterministic projected schema argv path", async () => {
  const variants = [
    {
      name: "canonical",
      replace: (actual: string, options: SpawnCodexAgentOptions) => resolve(options.outputSchemaPath!),
    },
    {
      name: "tampered-hash",
      replace: (actual: string) => actual.replace(/[a-f0-9]{64}(?=\.json$)/, "0".repeat(64)),
    },
    {
      name: "wrong-session",
      replace: (actual: string) => resolve(dirname(dirname(actual)), "other-session", basename(actual)),
    },
  ] as const;

  for (const variant of variants) {
    const roots = mkTestRoots(`imp24-live-v3-projected-schema-${variant.name}`);
    try {
      const req = request({
        scheduleId: `v3-reader-p1-canary-${variant.name}`,
        attemptId: `v3-reader-p1-canary-${variant.name}-a1`,
      });
      const live = createLiveQualificationExecutorV3({
        phaseDir: resolve(roots.base, "phase"),
        freezeSha256: FREEZE,
        certificationSha256: CERTIFICATION,
        productionInstrumentSealSha256: SEAL,
        preCallVerifier: () => undefined,
        workspaceBaseDir: roots.workspacesRoot,
        spawn: async (options) => {
          const result = ok(options);
          const manifest = JSON.parse(readFileSync(result.manifestPath!, "utf8")) as { argv: string[] };
          const schemaIndex = manifest.argv.indexOf("--output-schema") + 1;
          const actual = manifest.argv[schemaIndex]!;
          manifest.argv[schemaIndex] = variant.replace(actual, options);
          writePrettyJson(result.manifestPath!, manifest);
          return result;
        },
      });
      await assert.rejects(live.executor(req), /effective-context manifest semantic binding drift/,
        `${variant.name} schema argv must fail retained provenance verification`);
      assert.equal(live.ledger.codexExecInvocations, 1);
      assert.equal(live.ledger.apiCallsMade, 0);
    } finally {
      roots.dispose();
    }
  }
});

test("IMP-24 live V3 retains partial stdout and stderr from the typed timeout process path", async () => {
  const roots = mkTestRoots("imp24-live-v3-timeout-diagnostics");
  const partialStdout = "transport started\nrequest accepted\n";
  const partialStderr = "stream opened\ntransport stalled before completion\n";
  try {
    const req = request({
      scheduleId: "v3-reader-p1-canary-c02",
      attemptId: "v3-reader-p1-canary-c02-a1",
    });
    const live = createLiveQualificationExecutorV3({
      phaseDir: resolve(roots.base, "phase"),
      freezeSha256: FREEZE,
      certificationSha256: CERTIFICATION,
      productionInstrumentSealSha256: SEAL,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => {
        const returned = ok(options);
        assert.ok(returned.manifestPath);
        const routePath = returned.manifestPath.replace(/\.manifest\.json$/, ".route.json");
        const route = JSON.parse(readFileSync(routePath, "utf8")) as Record<string, unknown>;
        route.outcome = "timeout";
        writePrettyJson(routePath, route);
        rmSync(returned.manifestPath.replace(/\.manifest\.json$/, ".structured.json"));
        rmSync(returned.manifestPath.replace(/\.manifest\.json$/, ".result.json"));
        throw new CodexRunnerProcessError({
          failureKind: "timeout",
          errorName: "TimeoutError",
          errorMessage: "codex exec timed out after 1000ms",
          timedOut: true,
          exitCode: null,
          stdout: partialStdout,
          stderr: partialStderr,
        });
      },
      clock: () => new Date("2026-07-13T12:00:00.000Z"),
    });

    const receipt = await live.executor(req);
    assert.equal(receipt.status, "timeout");
    assert.equal(receipt.rawOutput, null);
    assert.equal(live.ledger.codexExecInvocations, 1);
    assert.equal(live.ledger.infrastructureReplays, 0);
    assert.equal(live.ledger.apiCallsMade, 0);

    const attemptDir = resolve(roots.base, "phase", "attempts", req.attemptId);
    const diagnostics = JSON.parse(
      readFileSync(resolve(attemptDir, "process-diagnostics.json"), "utf8"),
    ) as {
      invocation: string;
      classification: string;
      failureKind: string;
      errorName: string;
      errorMessage: string;
      timedOut: boolean;
      exitCode: number | null;
      stdoutBytes: number;
      stderrBytes: number;
      stdoutSha256: string;
      stderrSha256: string;
      stdoutRetained: string;
      stderrRetained: string;
      diagnosticsSha256: string;
    };
    assert.equal(diagnostics.invocation, "RUNNER_THROWN");
    assert.equal(diagnostics.classification, "timeout");
    assert.equal(diagnostics.failureKind, "timeout");
    assert.equal(diagnostics.errorName, "TimeoutError");
    assert.equal(diagnostics.errorMessage, "codex exec timed out after 1000ms");
    assert.equal(diagnostics.timedOut, true);
    assert.equal(diagnostics.exitCode, null);
    assert.equal(diagnostics.stdoutBytes, Buffer.byteLength(partialStdout));
    assert.equal(diagnostics.stderrBytes, Buffer.byteLength(partialStderr));
    assert.equal(diagnostics.stdoutSha256, sha256Hex(partialStdout));
    assert.equal(diagnostics.stderrSha256, sha256Hex(partialStderr));
    assert.equal(diagnostics.stdoutRetained, partialStdout);
    assert.equal(diagnostics.stderrRetained, partialStderr);
    assert.equal(live.ledger.entries[0]?.processDiagnosticsSha256, diagnostics.diagnosticsSha256);

    const executionEvidence = JSON.parse(
      readFileSync(resolve(attemptDir, "execution-evidence.json"), "utf8"),
    ) as { invocation: string; responseProduced: boolean; processDiagnosticsSha256: string };
    assert.equal(executionEvidence.invocation, "RUNNER_THREW");
    assert.equal(executionEvidence.responseProduced, false);
    assert.equal(executionEvidence.processDiagnosticsSha256, diagnostics.diagnosticsSha256);
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
    const attempt = attemptFor(req, denied, null);
    live.retainAttemptEvaluation(attempt);
    const evaluationPath = resolve(deniedRoots.base, "phase", "attempts", req.attemptId, "evaluation.json");
    const artifact = JSON.parse(readFileSync(evaluationPath, "utf8")) as ReturnType<typeof buildAttemptEvaluationArtifact>;
    assert.deepEqual(artifact, buildAttemptEvaluationArtifact(
      attempt,
      live.ledger.entries[0]!.executionEvidenceSha256!,
    ));
    assert.equal(artifact.evaluation, null);
    assert.equal(artifact.parsedOutputSha256, null);
    assert.equal(artifact.assembledReviewSha256, null);
    assert.match(artifact.terminalReason, /^policy_failure:/);
    assert.equal(live.ledger.entries[0]?.evaluationArtifactSha256, artifact.evaluationArtifactSha256,
      "a noncompleted attempt must still bind one deterministic evaluation artifact into the call ledger");
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
    await assert.rejects(live.executor(req), /attempt .* is partial; exact seven-file evidence is required/);
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
  return buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: headSha,
    workflowRunId: 2401,
    checkout: { branch: IMP24_REQUIRED_BRANCH, headSha, implementationClean: true },
    workflowRun: {
      databaseId: 2401,
      displayName: IMP24_REQUIRED_WORKFLOW_NAME,
      workflowFile: IMP24_REQUIRED_WORKFLOW_FILE,
      headBranch: IMP24_REQUIRED_BRANCH,
      headSha,
      status: "completed",
      conclusion: "success",
      jobs: [{ name: IMP24_REQUIRED_WORKFLOW_JOB, status: "completed", conclusion: "success" }],
    },
    pullRequest: {
      number: IMP24_REQUIRED_DRAFT_PR,
      state: "OPEN",
      isDraft: true,
      mergedAt: null,
      mergeCommit: null,
      headRefName: IMP24_REQUIRED_BRANCH,
      headRefOid: headSha,
    },
    repository: {
      nameWithOwner: IMP24_REQUIRED_REPOSITORY,
      url: IMP24_REQUIRED_REPOSITORY_URL,
    },
    verifiedAt: "2026-07-13T12:00:00.000Z",
  });
}

test("IMP-24 official campaign rejects an artifact-producing synthetic executor boundary", async () => {
  const roots = mkTestRoots("imp24-live-v3-campaign");
  const experimentDir = resolve(roots.base, "state", "migration-experiments", IMP24_ROLE_QUALIFICATION_EXECUTION_ID);
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
  const experimentDir = resolve(roots.base, "state", "migration-experiments", IMP24_ROLE_QUALIFICATION_EXECUTION_ID);
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

const IMPLEMENTATION_GATE_CHECKOUT = {
  branch: IMP24_REQUIRED_BRANCH,
  headSha: GATED_HEAD,
  implementationClean: true,
};

const IMPLEMENTATION_GATE_REPOSITORY = {
  nameWithOwner: IMP24_REQUIRED_REPOSITORY,
  url: IMP24_REQUIRED_REPOSITORY_URL,
};

const IMPLEMENTATION_GATE_PR: Imp24TrustedPullRequestEvidenceV1 = {
  number: IMP24_REQUIRED_DRAFT_PR,
  state: "OPEN",
  isDraft: true,
  mergedAt: null,
  mergeCommit: null,
  headRefName: IMP24_REQUIRED_BRANCH,
  headRefOid: GATED_HEAD,
};

function workflowRunQuery(
  overrides: Partial<Imp24GithubWorkflowRunQueryV1> = {},
): Imp24GithubWorkflowRunQueryV1 {
  return {
    databaseId: 2401,
    name: IMP24_REQUIRED_WORKFLOW_NAME,
    workflowName: IMP24_REQUIRED_WORKFLOW_FILE,
    headBranch: IMP24_REQUIRED_BRANCH,
    headSha: GATED_HEAD,
    status: "completed",
    conclusion: "success",
    jobs: [{ name: IMP24_REQUIRED_WORKFLOW_JOB, status: "completed", conclusion: "success" }],
    ...overrides,
  };
}

function buildImplementationGateFixture(overrides: {
  workflowRunQuery?: Imp24GithubWorkflowRunQueryV1;
  pullRequest?: Imp24TrustedPullRequestEvidenceV1;
  repository?: { nameWithOwner: string; url: string };
  verifiedAt?: string;
} = {}): Imp24ImplementationCiGateV1 {
  return buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: GATED_HEAD,
    workflowRunId: 2401,
    checkout: IMPLEMENTATION_GATE_CHECKOUT,
    workflowRun: mapImp24GithubWorkflowRunQuery(overrides.workflowRunQuery ?? workflowRunQuery()),
    pullRequest: overrides.pullRequest ?? IMPLEMENTATION_GATE_PR,
    repository: overrides.repository ?? IMPLEMENTATION_GATE_REPOSITORY,
    verifiedAt: overrides.verifiedAt ?? "2026-07-13T12:00:00.000Z",
  });
}

function rehashImplementationGate(gate: Imp24ImplementationCiGateV1): void {
  const { gateSha256: _oldGateSha256, ...core } = gate;
  gate.gateSha256 = imp24ImplementationCiGateSha256(core);
}

test("IMP-24 implementation collector maps the actual GitHub CLI workflow shape and binds distinct trusted identities", () => {
  assert.deepEqual(IMP24_WORKFLOW_RUN_QUERY_FIELDS, [
    "databaseId",
    "name",
    "workflowName",
    "headBranch",
    "headSha",
    "status",
    "conclusion",
    "jobs",
  ]);
  const actualObservedQuery = workflowRunQuery({
    name: "ChapterFlow V25 Pipeline",
    workflowName: ".github/workflows/chapterflow-v25-pipeline.yml",
  });
  const trustedWorkflowRun = mapImp24GithubWorkflowRunQuery(actualObservedQuery);
  assert.equal(trustedWorkflowRun.displayName, IMP24_REQUIRED_WORKFLOW_NAME);
  assert.equal(trustedWorkflowRun.workflowFile, IMP24_REQUIRED_WORKFLOW_FILE);

  const gate = buildImplementationGateFixture({ workflowRunQuery: actualObservedQuery });
  assert.equal(gate.schema, IMP24_IMPLEMENTATION_CI_GATE_SCHEMA);
  assert.equal(gate.repository.nameWithOwner, IMP24_REQUIRED_REPOSITORY);
  assert.equal(gate.repository.url, IMP24_REQUIRED_REPOSITORY_URL);
  assert.equal(gate.workflow.displayName, IMP24_REQUIRED_WORKFLOW_NAME);
  assert.equal(gate.workflow.workflowFile, IMP24_REQUIRED_WORKFLOW_FILE);
  assert.equal(gate.workflow.status, "completed");
  assert.equal(gate.workflow.conclusion, "success");
  assert.deepEqual(gate.workflow.requiredJob, {
    name: IMP24_REQUIRED_WORKFLOW_JOB,
    status: "completed",
    conclusion: "success",
  });
  assert.equal(gate.pullRequest.isDraft, true);
  assert.equal(gate.trustedEvidence.checkoutSha256, hashCanonical(IMPLEMENTATION_GATE_CHECKOUT));
  assert.equal(gate.trustedEvidence.repositorySha256, hashCanonical(IMPLEMENTATION_GATE_REPOSITORY));
  assert.equal(gate.trustedEvidence.workflowRunSha256, hashCanonical(trustedWorkflowRun));
  assert.equal(gate.trustedEvidence.pullRequestSha256, hashCanonical(IMPLEMENTATION_GATE_PR));
  assert.deepEqual(gate.trustedEvidence.raw, {
    checkout: IMPLEMENTATION_GATE_CHECKOUT,
    repository: IMPLEMENTATION_GATE_REPOSITORY,
    workflowRun: trustedWorkflowRun,
    pullRequest: IMPLEMENTATION_GATE_PR,
  });
  const { gateSha256, ...gateCore } = gate;
  assert.equal(gateSha256, imp24ImplementationCiGateSha256(gateCore));

  const harmlessPathSyntax = buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({ workflowName: ".\\.github\\workflows\\chapterflow-v25-pipeline.yml" }),
  });
  assert.equal(harmlessPathSyntax.workflow.workflowFile, IMP24_REQUIRED_WORKFLOW_FILE);
});

test("IMP-24 implementation gate recomputes and semantically validates every retained trusted-evidence preimage", () => {
  const validate = (gate: Imp24ImplementationCiGateV1): void => validateImp24ImplementationCiGate({
    gate,
    expectedHeadSha: GATED_HEAD,
    checkout: IMPLEMENTATION_GATE_CHECKOUT,
  });
  validate(buildImplementationGateFixture());

  const missingRaw = clone(buildImplementationGateFixture()) as Imp24ImplementationCiGateV1;
  delete (missingRaw.trustedEvidence as unknown as { raw?: unknown }).raw;
  rehashImplementationGate(missingRaw);
  assert.throws(() => validate(missingRaw), /missing or unexpected fields/);

  const rawHashMismatch = clone(buildImplementationGateFixture());
  rawHashMismatch.trustedEvidence.raw.workflowRun.status = "failure";
  rehashImplementationGate(rawHashMismatch);
  assert.throws(() => validate(rawHashMismatch), /trusted evidence hash does not match its retained preimage/);

  const invalidWorkflow = clone(buildImplementationGateFixture());
  invalidWorkflow.trustedEvidence.raw.workflowRun.status = "failure";
  invalidWorkflow.trustedEvidence.workflowRunSha256 = hashCanonical(invalidWorkflow.trustedEvidence.raw.workflowRun);
  rehashImplementationGate(invalidWorkflow);
  assert.throws(() => validate(invalidWorkflow), /workflow status is not completed/);

  const invalidRepository = clone(buildImplementationGateFixture());
  invalidRepository.trustedEvidence.raw.repository.nameWithOwner = "SomeoneElse/ChapterFlow";
  invalidRepository.trustedEvidence.repositorySha256 = hashCanonical(invalidRepository.trustedEvidence.raw.repository);
  rehashImplementationGate(invalidRepository);
  assert.throws(() => validate(invalidRepository), /repository identity must be exactly/);

  const invalidPullRequest = clone(buildImplementationGateFixture());
  invalidPullRequest.trustedEvidence.raw.pullRequest.state = "CLOSED";
  invalidPullRequest.trustedEvidence.pullRequestSha256 = hashCanonical(invalidPullRequest.trustedEvidence.raw.pullRequest);
  rehashImplementationGate(invalidPullRequest);
  assert.throws(() => validate(invalidPullRequest), /not the open, unmerged draft PR #401/);

  const divergentCheckout = clone(buildImplementationGateFixture());
  (divergentCheckout.trustedEvidence.raw.checkout as Imp24ImplementationCiGateV1["trustedEvidence"]["raw"]["checkout"] & {
    collectorNonce: string;
  }).collectorNonce = "untrusted-extra-preimage-field";
  divergentCheckout.trustedEvidence.checkoutSha256 = hashCanonical(divergentCheckout.trustedEvidence.raw.checkout);
  rehashImplementationGate(divergentCheckout);
  assert.throws(() => validate(divergentCheckout), /trusted checkout evidence has missing or unexpected fields/);

  const unexpectedTopLevel = clone(buildImplementationGateFixture()) as Imp24ImplementationCiGateV1 & {
    apiCallsMade: number;
  };
  unexpectedTopLevel.apiCallsMade = 0;
  rehashImplementationGate(unexpectedTopLevel);
  assert.throws(() => validate(unexpectedTopLevel), /implementation CI gate has missing or unexpected fields/);

  const unexpectedRawRepository = clone(buildImplementationGateFixture());
  (unexpectedRawRepository.trustedEvidence.raw.repository as typeof unexpectedRawRepository.trustedEvidence.raw.repository & {
    host: string;
  }).host = "github.com";
  unexpectedRawRepository.trustedEvidence.repositorySha256 = hashCanonical(
    unexpectedRawRepository.trustedEvidence.raw.repository,
  );
  rehashImplementationGate(unexpectedRawRepository);
  assert.throws(() => validate(unexpectedRawRepository), /trusted repository evidence has missing or unexpected fields/);
});

test("IMP-24 implementation gate rejects a correct display name paired with the wrong workflow file", () => {
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({ workflowName: ".github/workflows/ci.yml" }),
  }), /workflow file must be exactly/);
});

test("IMP-24 implementation gate rejects a correct workflow file paired with the wrong display name", () => {
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({ name: "CI" }),
  }), /workflow display name must be exactly/);
});

test("IMP-24 implementation gate cannot accept the root CI workflow", () => {
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({
      name: "CI",
      workflowName: ".github/workflows/ci.yml",
    }),
  }), /workflow display name must be exactly/);
});

test("IMP-24 implementation gate rejects the correct workflow at the wrong head SHA", () => {
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({ headSha: "2".repeat(40) }),
  }), /workflow head SHA differs from the exact implementation HEAD/);
});

test("IMP-24 implementation gate rejects a failed workflow conclusion", () => {
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({ conclusion: "failure" }),
  }), /workflow conclusion is not success/);
});

test("IMP-24 implementation gate rejects an incomplete workflow or failed required job", () => {
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({ status: "in_progress" }),
  }), /workflow status is not completed/);
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({
      jobs: [{ name: IMP24_REQUIRED_WORKFLOW_JOB, status: "completed", conclusion: "failure" }],
    }),
  }), /does not show a completed successful V25 Pipeline Typecheck, Contracts, and Tests job/);
});

test("IMP-24 implementation gate rejects duplicate required jobs", () => {
  const requiredJob = { name: IMP24_REQUIRED_WORKFLOW_JOB, status: "completed", conclusion: "success" };
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({ jobs: [requiredJob, { ...requiredJob }] }),
  }), /must contain exactly one V25 Pipeline Typecheck, Contracts, and Tests job/);
});

test("IMP-24 implementation gate rejects a missing required job", () => {
  assert.throws(() => buildImplementationGateFixture({
    workflowRunQuery: workflowRunQuery({
      jobs: [{ name: "Unrelated Job", status: "completed", conclusion: "success" }],
    }),
  }), /must contain exactly one V25 Pipeline Typecheck, Contracts, and Tests job/);
});

test("IMP-24 implementation gate rejects a PR head that differs from the gated head", () => {
  assert.throws(() => buildImplementationGateFixture({
    pullRequest: { ...IMPLEMENTATION_GATE_PR, headRefOid: "2".repeat(40) },
  }), /not the open, unmerged draft PR #401 at the exact implementation HEAD/);
});

test("IMP-24 implementation gate rejects a closed or merged draft PR", () => {
  assert.throws(() => buildImplementationGateFixture({
    pullRequest: { ...IMPLEMENTATION_GATE_PR, state: "CLOSED" },
  }), /not the open, unmerged draft PR #401 at the exact implementation HEAD/);
  assert.throws(() => buildImplementationGateFixture({
    pullRequest: {
      ...IMPLEMENTATION_GATE_PR,
      mergedAt: "2026-07-13T12:00:00.000Z",
      mergeCommit: { oid: "2".repeat(40) },
    },
  }), /not the open, unmerged draft PR #401 at the exact implementation HEAD/);
});

test("IMP-24 implementation gate binds the exact repository and query timestamp", () => {
  assert.throws(() => buildImplementationGateFixture({
    repository: {
      nameWithOwner: "WillSoltani/Other",
      url: IMP24_REQUIRED_REPOSITORY_URL,
    },
  }), /repository identity must be exactly/);
  assert.throws(() => buildImplementationGateFixture({
    repository: {
      nameWithOwner: IMP24_REQUIRED_REPOSITORY,
      url: "https://evil.example/WillSoltani/ChapterFlow",
    },
  }), /repository identity must be exactly/);
  assert.throws(() => buildImplementationGateFixture({ verifiedAt: "not-a-time" }),
    /trusted implementation verification time must be an exact canonical ISO timestamp/);
  assert.throws(() => buildImplementationGateFixture({ verifiedAt: "2026-07-13T12:00:00Z" }),
    /trusted implementation verification time must be an exact canonical ISO timestamp/);
  assert.throws(() => buildImplementationGateFixture({ verifiedAt: 0 as unknown as string }),
    /trusted implementation verification time must be an exact canonical ISO timestamp/);
});

test("IMP-24 blocked terminal state rejects stale role-assignment JSON and markdown artifacts", () => {
  const roots = mkTestRoots("imp24-v3-blocked-stale-role-assignment");
  try {
    const paths = {
      roleAssignmentFreeze: resolve(roots.base, "state", "role-assignment-freeze.json"),
      roleAssignmentFreezeDocsJson: resolve(roots.base, "docs", "ROLE_ASSIGNMENT_FREEZE_V3_R1.json"),
      roleAssignmentFreezeMarkdown: resolve(roots.base, "docs", "ROLE_ASSIGNMENT_FREEZE_V3_R1.md"),
    };
    assert.doesNotThrow(() => assertImp24BlockedRoleAssignmentArtifactsAbsent(paths));
    mkdirSync(dirname(paths.roleAssignmentFreezeMarkdown), { recursive: true });
    writeFileSync(paths.roleAssignmentFreezeMarkdown, "# Status: FROZEN\n");
    assert.throws(() => assertImp24BlockedRoleAssignmentArtifactsAbsent(paths),
      /role assignment freeze markdown report exists although the current V3 role set is not ready/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24 infrastructure replay chronology requires predecessor order and completion", () => {
  const entry = (
    attemptId: string,
    requestedAt: string,
    completedAt: string,
  ): LiveCallLedgerEntryV3 => ({
    attemptId,
    scheduleId: "v3-reader-p1-canary-c01",
    requestSha256: "a".repeat(64),
    evidenceEnvelopeSha256: "b".repeat(64),
    evidenceEnvelopeBytesSha256: "c".repeat(64),
    receiptSha256: "d".repeat(64),
    processDiagnosticsSha256: "9".repeat(64),
    executionEvidenceSha256: "e".repeat(64),
    evaluationArtifactSha256: "f".repeat(64),
    status: attemptId.endsWith("-a1") ? "timeout" : "completed",
    cached: false,
    requestedAt,
    completedAt,
  });
  const a1 = entry(
    "v3-reader-p1-canary-c01-a1",
    "2026-07-13T12:00:00.000Z",
    "2026-07-13T12:00:00.100Z",
  );
  const a2 = entry(
    "v3-reader-p1-canary-c01-a2",
    "2026-07-13T12:00:00.100Z",
    "2026-07-13T12:00:00.200Z",
  );
  assert.deepEqual(replayReceiptChronologyViolationsV3({ entries: [a1, a2] }), []);
  assert.deepEqual(replayReceiptChronologyViolationsV3({ entries: [a2, a1] }), [
    "v3-reader-p1-canary-c01-a2:predecessor-order",
  ]);
  assert.deepEqual(replayReceiptChronologyViolationsV3({
    entries: [a1, { ...a2, requestedAt: "2026-07-13T12:00:00.099Z" }],
  }), ["v3-reader-p1-canary-c01-a2:requested-before-predecessor-completed"]);
});
