import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { writeFileAtomic } from "../src/lib/atomicWrite.js";
import {
  IMP24D_FINAL_ATTESTATION_PATHS,
  IMP24D_R2_REPORT_PATHS,
  IMP24D_TRANSPORT_SMOKE_REPORT_PATHS,
  buildImp24DFinalAttestationForFixture,
  materializeImp24DFinalAttestationForFixture,
  verifyImp24DFinalAttestationForFixture,
  type BuildImp24DFinalAttestationFixtureOptions,
  type Imp24DFinalEvidence,
  type Imp24DTransportSmokeCycleBinding,
} from "../src/bakeoff/migration/imp24DFinalAttestation.js";
import {
  IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
} from "../src/orchestrator/forwardTransportSmokeEvidenceV3.js";
import {
  IMP24D_OBSERVABILITY_FREEZE_PATHS,
  IMP24D_R1_CLOSURE_PATHS,
} from "../src/bakeoff/migration/imp24ObservabilityFreeze.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
} from "../src/bakeoff/migration/imp24Corpus.js";
import {
  IMP24D_R2_QUALIFICATION_FIXED_PATHS,
  IMP24_PILOT_GOLD_FIXED_PATHS,
  verifyImp24DR2RetainedQualificationForFinalAttestationV3,
  verifyImp24RetainedQualificationForFinalAttestationV3,
} from "../src/bakeoff/migration/imp24PilotGoldWorkflow.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const H = (character: string): string => character.repeat(64);
const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const IMP24D_AUDITED_CORRECTION_COMMIT = "092832c2c5ec1932d235059e48a8ad747e90a0dc";
const EXACT_CORRECTION_SOURCE_FILES = [
  `${PIPELINE_REL}/src/exec/codexTransportConfig.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardRoleQualificationLiveV3.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardTransportSmokeCorrectionV3.ts`,
] as const;
const EXPERIMENTS_REL = `${PIPELINE_REL}/state/migration-experiments`;
const QUALIFICATION_ROOT = `${EXPERIMENTS_REL}/${IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID}`;
const SMOKE_ROOT = `${EXPERIMENTS_REL}/${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}`;
const SMOKE_R2_ROOT = `${EXPERIMENTS_REL}/${IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID}`;
const FORBIDDEN_RUN_ROOTS = [
  `${EXPERIMENTS_REL}/s16-forward-sol-pilot-v2-envelope`,
  `${EXPERIMENTS_REL}/s16-forward-sol-gold-book-v2-envelope`,
  `${EXPERIMENTS_REL}/s16-forward-local-activation-v3-envelope`,
] as const;

test("IMP-24D final attestation is explicitly R2 while active pilot/activation remains FINAL", () => {
  assert.equal(IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    IMP24_ROLE_QUALIFICATION_FINAL_EXECUTION_ID);
  assert.match(IMP24_PILOT_GOLD_FIXED_PATHS.qualificationRoot,
    /s16-forward-role-qualification-v3-envelope-final$/);
  assert.match(IMP24D_R2_QUALIFICATION_FIXED_PATHS.qualificationRoot,
    /s16-forward-role-qualification-v3-envelope-r2$/);
  assert.notEqual(IMP24D_R2_QUALIFICATION_FIXED_PATHS.qualificationRoot,
    IMP24_PILOT_GOLD_FIXED_PATHS.qualificationRoot);
  assert.match(verifyImp24DR2RetainedQualificationForFinalAttestationV3.toString(),
    /verifyHistoricalImp24DR2RetainedRoleQualificationEvidenceV3/);
  assert.match(verifyImp24RetainedQualificationForFinalAttestationV3.toString(),
    /loadExactTerminalQualification/);
  const dSource = readFileSync(resolve(
    PIPELINE_DIR,
    "src/bakeoff/migration/imp24DFinalAttestation.ts",
  ), "utf8");
  const projection = dSource.slice(
    dSource.indexOf("function qualificationSemanticProjectionSha256"),
    dSource.indexOf("function loadQualificationBinding"),
  );
  assert.match(projection, /buildLegacyRoleQualificationPlanV3/);
  assert.doesNotMatch(projection, /buildRoleQualificationPlanV3\(/);
});

function git(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commit(root: string, message: string): string {
  git(root, ["add", "--all"]);
  git(root, ["commit", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

function write(root: string, path: string, bytes: string): string {
  writeFileAtomic(resolve(root, path), bytes);
  return sha256Hex(bytes);
}

function auditedImp24DCorrectionSource(path: string): string {
  return execFileSync("git", ["show", `${IMP24D_AUDITED_CORRECTION_COMMIT}:${path}`], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function prepareFixture(args: {
  corrected?: boolean;
  ready?: boolean;
  failedCycleModelCalls?: 0 | 1 | 2;
} = {}): {
  root: ReturnType<typeof mkTestRoots>;
  options: BuildImp24DFinalAttestationFixtureOptions;
  historicalBytes: Record<string, string>;
} {
  const roots = mkTestRoots("imp24d-final-attestation");
  const root = roots.base;
  git(root, ["init"]);
  git(root, ["config", "user.name", "IMP-24D Fixture"]);
  git(root, ["config", "user.email", "imp24d-fixture@example.invalid"]);
  const historicalPaths = [
    "docs/v25/reports/implementation-report.imp-24.json",
    "docs/v25/reports/implementation-report.imp-24.pre-live.json",
    "docs/v25/reports/IMP-24C_PRE_LIVE_FREEZE.json",
  ];
  for (const path of historicalPaths) write(root, path, `historical:${path}\n`);
  write(root, "fixture-baseline.txt", "baseline\n");
  const baseline = commit(root, "fixture baseline");

  const observabilityBytesSha256 = write(root, IMP24D_OBSERVABILITY_FREEZE_PATHS.json,
    "fixture observability freeze\n");
  const observabilityMarkdownBytesSha256 = write(root, IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown,
    "fixture observability freeze markdown\n");
  const r1JsonBytesSha256 = write(root, IMP24D_R1_CLOSURE_PATHS.json, "fixture r1 closure\n");
  const r1MarkdownBytesSha256 = write(root, IMP24D_R1_CLOSURE_PATHS.markdown, "fixture r1 closure markdown\n");
  write(root, "fixture-observability.txt", "observability implementation\n");
  const observabilityCommit = commit(root, "fixture observability implementation");

  let correctionCommit: string | null = null;
  if (args.corrected === true) {
    write(root, `${SMOKE_ROOT}/cycle-result.json`, "failed smoke cycle retained\n");
    write(root, IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.json, "smoke report\n");
    write(root, IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.markdown, "smoke report markdown\n");
    for (const path of EXACT_CORRECTION_SOURCE_FILES) {
      write(root, path, auditedImp24DCorrectionSource(path));
    }
    write(root, `${PIPELINE_REL}/tests/codex-transport-regression.test.ts`, "bounded regression test\n");
    write(root, `${EXPERIMENTS_REL}/contracts/imp24/forward-production-instrument-seal.json`,
      "reminted production seal\n");
    write(root, `${EXPERIMENTS_REL}/contracts/imp24/instrument-certification-binding.json`,
      "reminted certification\n");
    write(root, `${EXPERIMENTS_REL}/contracts/imp24/production-qualification-parity.json`,
      "reminted parity\n");
    correctionCommit = commit(root, "fixture bounded correction");
  }
  const implementationCommit = correctionCommit ?? observabilityCommit;

  if (!existsSync(resolve(root, `${SMOKE_ROOT}/cycle-result.json`))) {
    write(root, `${SMOKE_ROOT}/cycle-result.json`, "passing smoke cycle retained\n");
  }
  write(root, `${SMOKE_ROOT}/implementation-ci-gate.json`, "smoke implementation gate\n");
  write(root, `${SMOKE_ROOT}/smoke-input-binding.json`, "smoke input binding\n");
  write(root, `${SMOKE_ROOT}/live/preflight.json`, "smoke preflight\n");
  write(root, `${SMOKE_ROOT}/live/call-ledger.json`, "smoke ledger\n");
  for (const role of ["reader", "source"]) {
    const attempt = `${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}-${role}-canary-a1`;
    for (const file of ["evaluation.json", "evidence-envelope.json", "execution-evidence.json",
      "process-diagnostics.json", "receipt.json", "request.json", "retention.json"]) {
      write(root, `${SMOKE_ROOT}/live/attempts/${attempt}/${file}`, `${attempt}:${file}\n`);
    }
  }
  if (correctionCommit !== null) {
    write(root, `${SMOKE_R2_ROOT}/cycle-result.json`, "passing corrected smoke cycle retained\n");
    write(root, `${SMOKE_R2_ROOT}/implementation-ci-gate.json`, "corrected smoke implementation gate\n");
    write(root, `${SMOKE_R2_ROOT}/smoke-input-binding.json`, "corrected smoke input binding\n");
    write(root, `${SMOKE_R2_ROOT}/live/preflight.json`, "corrected smoke preflight\n");
    write(root, `${SMOKE_R2_ROOT}/live/call-ledger.json`, "corrected smoke ledger\n");
    for (const role of ["reader", "source"]) {
      const attempt = `${IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID}-${role}-canary-a1`;
      for (const file of ["evaluation.json", "evidence-envelope.json", "execution-evidence.json",
        "process-diagnostics.json", "receipt.json", "request.json", "retention.json"]) {
        write(root, `${SMOKE_R2_ROOT}/live/attempts/${attempt}/${file}`, `${attempt}:${file}\n`);
      }
    }
  }

  const smokeReportBytesSha256 = write(root, IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.json, "smoke report\n");
  const smokeMarkdownBytesSha256 = write(root, IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.markdown,
    "smoke report markdown\n");
  const terminalReportPath = `${QUALIFICATION_ROOT}/qualification-report.json`;
  const implementationCiGatePath = `${QUALIFICATION_ROOT}/implementation-ci-gate.json`;
  const roleAssignmentPath = `${QUALIFICATION_ROOT}/role-assignment-freeze.json`;
  const terminalReportBytesSha256 = write(root, terminalReportPath, "r2 terminal report\n");
  const implementationCiGateBytesSha256 = write(root, implementationCiGatePath, "r2 implementation gate\n");
  const ready = args.ready !== false;
  const roleAssignmentBytesSha256 = ready ? write(root, roleAssignmentPath, "r2 role assignment\n") : null;
  write(root, `${QUALIFICATION_ROOT}/live/call-ledger.json`, "r2 call ledger\n");
  write(root, `${QUALIFICATION_ROOT}/candidate-availability.json`, "r2 availability\n");
  write(root, `${QUALIFICATION_ROOT}/live/preflight.json`, "r2 preflight\n");
  write(root, `${QUALIFICATION_ROOT}/live/qualification-freeze.json`, "r2 freeze\n");
  write(root, `${QUALIFICATION_ROOT}/live/qualification-result.json`, "r2 result\n");
  write(root, `${QUALIFICATION_ROOT}/live/role-registry.json`, "r2 registry\n");
  const attemptIds = Array.from({ length: 15 }, (_, index) => `a${String(index + 1).padStart(2, "0")}`);
  for (const attempt of attemptIds) {
    for (const file of ["evaluation.json", "evidence-envelope.json", "execution-evidence.json",
      "process-diagnostics.json", "receipt.json", "request.json", "retention.json"]) {
      write(root, `${QUALIFICATION_ROOT}/live/attempts/${attempt}/${file}`, `${attempt}:${file}\n`);
    }
  }
  write(root, IMP24D_R2_REPORT_PATHS.qualificationJson, "r2 docs qualification report\n");
  write(root, IMP24D_R2_REPORT_PATHS.qualificationMarkdown, "r2 docs qualification markdown\n");
  if (ready) {
    write(root, IMP24D_R2_REPORT_PATHS.roleAssignmentJson, "r2 docs role assignment\n");
    write(root, IMP24D_R2_REPORT_PATHS.roleAssignmentMarkdown, "r2 docs role assignment markdown\n");
  }

  const cycle1: Imp24DTransportSmokeCycleBinding = {
    executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
    stateRoot: SMOKE_ROOT,
    implementationCommit: observabilityCommit,
    workflowRunId: 101,
    implementationCiGateSha256: H("1"),
    implementationCiGateBytesSha256: H("2"),
    calls: 2,
    codexExecInvocations: correctionCommit === null ? 2 : (args.failedCycleModelCalls ?? 2),
    processDiagnosticsSetSha256: H("3"),
    qualificationSemanticProjectionSha256: H("7"),
    certificationSha256: H("9"),
    productionInstrumentSealSha256: H("8"),
    productionQualificationParitySha256: H("a"),
    result: correctionCommit === null ? "PASS" : "FAIL",
    implementationCiVerifiedAt: "2026-07-14T00:00:00.000Z",
    startedAt: "2026-07-14T00:01:00.000Z",
    completedAt: "2026-07-14T00:02:00.000Z",
  };
  const cycles: Imp24DTransportSmokeCycleBinding[] = correctionCommit === null ? [cycle1] : [
    cycle1,
    {
      executionId: IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
      stateRoot: SMOKE_R2_ROOT,
      implementationCommit: correctionCommit,
      workflowRunId: 102,
      implementationCiGateSha256: H("4"),
      implementationCiGateBytesSha256: H("5"),
      calls: 2,
      codexExecInvocations: 2,
      processDiagnosticsSetSha256: H("6"),
      qualificationSemanticProjectionSha256: H("7"),
      certificationSha256: H("d"),
      productionInstrumentSealSha256: H("c"),
      productionQualificationParitySha256: H("e"),
      result: "PASS",
      implementationCiVerifiedAt: "2026-07-14T00:03:00.000Z",
      startedAt: "2026-07-14T00:04:00.000Z",
      completedAt: "2026-07-14T00:05:00.000Z",
    },
  ];
  const smokeDiagnosticsSetSha256 = hashCanonical(cycles.map((cycle) => ({
    executionId: cycle.executionId,
    processDiagnosticsSetSha256: cycle.processDiagnosticsSetSha256,
  })));
  const roles = ready ? {
    readerPrimary: "profile-a",
    readerAudit: "profile-b",
    sourcePrimary: "profile-c",
    sourceAdjudicator: "profile-d",
    quizSemanticAdjudicator: "profile-e",
  } : {
    readerPrimary: null,
    readerAudit: null,
    sourcePrimary: null,
    sourceAdjudicator: null,
    quizSemanticAdjudicator: null,
  };
  const evidence: Imp24DFinalEvidence = {
    observabilityFreeze: {
      path: IMP24D_OBSERVABILITY_FREEZE_PATHS.json,
      bytesSha256: observabilityBytesSha256,
      markdownPath: IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown,
      markdownBytesSha256: observabilityMarkdownBytesSha256,
      freezeSha256: H("7"),
      productionSealSha256: H("8"),
      certificationSha256: H("9"),
      productionQualificationParitySha256: H("a"),
      frozenSemanticsSha256: H("b"),
    },
    historicalR1: {
      executionId: "s16-forward-role-qualification-v3-envelope-r1",
      disposition: "BLOCKED_OBSERVABILITY_INCOMPLETE",
      mayResume: false,
      mayQualifyProfiles: false,
      jsonPath: IMP24D_R1_CLOSURE_PATHS.json,
      jsonBytesSha256: r1JsonBytesSha256,
      markdownPath: IMP24D_R1_CLOSURE_PATHS.markdown,
      markdownBytesSha256: r1MarkdownBytesSha256,
    },
    transportSmoke: {
      status: "PASS",
      reportPath: IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.json,
      reportBytesSha256: smokeReportBytesSha256,
      markdownPath: IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.markdown,
      markdownBytesSha256: smokeMarkdownBytesSha256,
      observabilityImplementationCommit: observabilityCommit,
      correctionCommit,
      effectiveImplementationCommit: implementationCommit,
      cycles,
      totalCalls: correctionCommit === null ? 2 : 4,
      processDiagnosticsSetSha256: smokeDiagnosticsSetSha256,
      modelCalls: correctionCommit === null ? 2 : ((args.failedCycleModelCalls ?? 2) + 2) as 2 | 3 | 4,
      apiCalls: 0,
    },
    qualification: {
      status: ready ? "ROLE_SET_READY" : "ROLE_SET_NOT_READY",
      blockedReason: ready ? null : "NO_COMPLETE_ROLE_SET",
      root: QUALIFICATION_ROOT,
      terminalReportPath,
      terminalReportBytesSha256,
      terminalReportSha256: H("c"),
      roleAssignmentPath: ready ? roleAssignmentPath : null,
      roleAssignmentBytesSha256,
      roleAssignmentFreezeSha256: ready ? H("d") : null,
      implementationCiGatePath,
      implementationCiGateSha256: H("e"),
      implementationCiGateBytesSha256,
      qualificationResultSha256: H("f"),
      qualificationFreezeSha256: H("1"),
      callLedgerSha256: H("2"),
      callLedgerBytesSha256: H("3"),
      attemptEvidenceSetSha256: H("4"),
      processDiagnosticsSetSha256: H("5"),
      preflightVerifiedAt: "2026-07-14T00:06:00.000Z",
      earliestRequestAt: "2026-07-14T00:07:00.000Z",
      attemptIds,
      roles,
      qualifiedProfiles: ready ? ["profile-a", "profile-b", "profile-c", "profile-d", "profile-e"] : [],
      certificationSha256: correctionCommit === null ? H("9") : H("d"),
      productionSealSha256: correctionCommit === null ? H("8") : H("c"),
      productionQualificationParitySha256: correctionCommit === null ? H("a") : H("e"),
      qualificationSemanticProjectionSha256: H("7"),
      corpusBundleSha256: `sha256:${H("6")}`,
      thresholdsSha256: H("7"),
      promptSourceHashesSha256: H("8"),
      schemaHashesSha256: H("9"),
      routeBindingSha256: H("a"),
      roleAssignmentPolicySha256: ready ? H("b") : null,
      callCounts: {
        canaryCalls: 10,
        holdoutCalls: 5,
        infrastructureReplays: 0,
        maxPlanEvents: 0,
        totalAttempts: 15,
        codexExecInvocations: 15,
        apiCalls: 0,
      },
    },
    evidenceRoots: [SMOKE_ROOT, ...(correctionCommit === null ? [] : [SMOKE_R2_ROOT]), QUALIFICATION_ROOT],
    evidenceFiles: [
      IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.json,
      IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.markdown,
      IMP24D_R2_REPORT_PATHS.qualificationJson,
      IMP24D_R2_REPORT_PATHS.qualificationMarkdown,
      ...(ready ? [IMP24D_R2_REPORT_PATHS.roleAssignmentJson, IMP24D_R2_REPORT_PATHS.roleAssignmentMarkdown] : []),
    ],
    evidenceInventories: {},
  };
  const evidenceCommit = commit(root, "fixture evidence");
  for (const evidenceRoot of evidence.evidenceRoots) {
    evidence.evidenceInventories[evidenceRoot] = git(root, ["ls-tree", "-r", "--name-only", evidenceCommit, "--", evidenceRoot])
      .split("\n").filter(Boolean).sort();
  }
  const historicalBytes = Object.fromEntries(historicalPaths.map((path) => [path, readFileSync(resolve(root, path), "utf8")]));
  return {
    root: roots,
    options: {
      repositoryRoot: root,
      artifactRoot: root,
      lifecycleBaselineCommit: baseline,
      implementationCommit,
      evidenceCommit,
      evidence,
      forbiddenRunRoots: FORBIDDEN_RUN_ROOTS,
    },
    historicalBytes,
  };
}

test("IMP-24D final attestation is deterministic, writes exactly three new D artifacts, and preserves all historical bytes", () => {
  const fixture = prepareFixture();
  try {
    const first = buildImp24DFinalAttestationForFixture(fixture.options);
    const second = buildImp24DFinalAttestationForFixture(fixture.options);
    assert.deepEqual(first, second);
    assert.equal(first.attestation.finalDecision, "PASS");
    assert.equal(first.attestation.roleSetReady, true);
    assert.equal(first.attestation.mechanicalCorrectionCommit, null);
    assert.equal(first.attestation.transportSmoke.totalCalls, 2);
    assert.equal(first.attestation.qualification.callCounts.canaryCalls, 10);
    assert.equal(first.attestation.qualification.callCounts.holdoutCalls, 5);
    assert.equal(first.attestation.apiCalls, 0);
    assert.equal(first.attestation.stopBoundary.pilotRun, false);
    assert.equal(first.attestation.stopBoundary.goldRun, false);
    assert.equal(first.attestation.stopBoundary.localSolActivation, false);
    assert.equal(Object.hasOwn(first.attestation, "finalAttestationCommit"), false);
    assert.equal(Object.hasOwn(first.attestation, "finalCiRun"), false);

    const materialized = materializeImp24DFinalAttestationForFixture(fixture.options);
    assert.equal(materialized.writes, 3);
    for (const path of Object.values(IMP24D_FINAL_ATTESTATION_PATHS)) {
      assert.equal(existsSync(resolve(fixture.options.repositoryRoot, path)), true, path);
    }
    for (const [path, bytes] of Object.entries(fixture.historicalBytes)) {
      assert.equal(readFileSync(resolve(fixture.options.repositoryRoot, path), "utf8"), bytes,
        `historical lifecycle bytes changed: ${path}`);
    }
    const finalCommit = commit(fixture.options.repositoryRoot, "fixture final attestation");
    assert.deepEqual(
      git(fixture.options.repositoryRoot, ["diff", "--name-only", `${fixture.options.evidenceCommit}..${finalCommit}`])
        .split("\n").filter(Boolean).sort(),
      Object.values(IMP24D_FINAL_ATTESTATION_PATHS).sort(),
    );
    assert.equal(verifyImp24DFinalAttestationForFixture(fixture.options).writes, 0);
  } finally {
    fixture.root.dispose();
  }
});

test("IMP-24D final attestation binds the one permitted correction without mixing smoke calls into qualification metrics", () => {
  const fixture = prepareFixture({ corrected: true });
  try {
    const built = buildImp24DFinalAttestationForFixture(fixture.options);
    assert.equal(built.attestation.observabilityImplementationCommit,
      fixture.options.evidence.transportSmoke.observabilityImplementationCommit);
    assert.equal(built.attestation.mechanicalCorrectionCommit, fixture.options.implementationCommit);
    assert.equal(built.attestation.effectiveImplementationCommit, fixture.options.implementationCommit);
    assert.equal(built.attestation.transportSmoke.totalCalls, 4);
    assert.equal(built.attestation.transportSmoke.cycles.length, 2);
    assert.equal(built.attestation.instrument.original.certificationSha256, H("9"));
    assert.equal(built.attestation.instrument.effective.certificationSha256, H("d"));
    assert.notEqual(built.attestation.instrument.original.productionSealSha256,
      built.attestation.instrument.effective.productionSealSha256);
    assert.notEqual(built.attestation.instrument.original.productionQualificationParitySha256,
      built.attestation.instrument.effective.productionQualificationParitySha256);
    assert.equal(built.attestation.instrument.qualificationSemanticProjectionSha256, H("7"));
    assert.equal(built.attestation.qualification.callCounts.totalAttempts, 15);
    assert.equal(built.attestation.modelCalls, 19);
  } finally {
    fixture.root.dispose();
  }
});

test("IMP-24D correction accounting permits failed cycle one to cross zero or one model boundary", () => {
  for (const failedCycleModelCalls of [0, 1] as const) {
    const fixture = prepareFixture({ corrected: true, failedCycleModelCalls });
    try {
      const built = buildImp24DFinalAttestationForFixture(fixture.options);
      assert.equal(built.attestation.transportSmoke.totalCalls, 4,
        "both fixed broker requests remain retained in each cycle");
      assert.equal(built.attestation.transportSmoke.modelCalls, failedCycleModelCalls + 2);
      assert.equal(built.attestation.modelCalls, failedCycleModelCalls + 17);
      assert.equal(built.attestation.transportSmoke.cycles[0].codexExecInvocations,
        failedCycleModelCalls);
      assert.equal(built.attestation.transportSmoke.cycles[1].codexExecInvocations, 2);
    } finally {
      fixture.root.dispose();
    }
  }
});

test("IMP-24D final attestation truthfully retains a blocked r2 result without partial fixed roles", () => {
  const fixture = prepareFixture({ ready: false });
  try {
    const built = buildImp24DFinalAttestationForFixture(fixture.options);
    assert.equal(built.attestation.finalDecision, "BLOCKED");
    assert.equal(built.attestation.roleSetReady, false);
    assert.deepEqual(built.attestation.roles, {
      readerPrimary: null,
      readerAudit: null,
      sourcePrimary: null,
      sourceAdjudicator: null,
      quizSemanticAdjudicator: null,
    });
    assert.equal(built.attestation.qualification.roleAssignmentPath, null);
    assert.deepEqual(built.attestation.qualifiedProfiles, []);
  } finally {
    fixture.root.dispose();
  }
});

test("IMP-24D final attestation rejects diagnostics aggregate drift and post-evidence diagnostic tampering", () => {
  const aggregateFixture = prepareFixture();
  try {
    aggregateFixture.options.evidence.transportSmoke.processDiagnosticsSetSha256 = H("0");
    assert.throws(() => buildImp24DFinalAttestationForFixture(aggregateFixture.options),
      /aggregate diagnostics hash drift/);
  } finally {
    aggregateFixture.root.dispose();
  }

  const bytesFixture = prepareFixture();
  try {
    write(bytesFixture.options.repositoryRoot,
      `${QUALIFICATION_ROOT}/live/attempts/a01/process-diagnostics.json`,
      "tampered after Evidence Commit\n");
    assert.throws(() => buildImp24DFinalAttestationForFixture(bytesFixture.options),
      /differs from Evidence Commit/);
  } finally {
    bytesFixture.root.dispose();
  }
});

test("IMP-24D final attestation rejects role-freeze byte drift and invalid correction ancestry", () => {
  const roleFixture = prepareFixture();
  try {
    const rolePath = roleFixture.options.evidence.qualification.roleAssignmentPath!;
    write(roleFixture.options.repositoryRoot, rolePath, "tampered role freeze\n");
    assert.throws(() => buildImp24DFinalAttestationForFixture(roleFixture.options),
      /role-assignment freeze bytes hash drift|differs from Evidence Commit/);
  } finally {
    roleFixture.root.dispose();
  }

  const ancestryFixture = prepareFixture({ corrected: true });
  try {
    ancestryFixture.options.evidence.transportSmoke.correctionCommit =
      ancestryFixture.options.lifecycleBaselineCommit;
    ancestryFixture.options.evidence.transportSmoke.effectiveImplementationCommit =
      ancestryFixture.options.lifecycleBaselineCommit;
    ancestryFixture.options.evidence.transportSmoke.cycles[1].implementationCommit =
      ancestryFixture.options.lifecycleBaselineCommit;
    ancestryFixture.options.implementationCommit = ancestryFixture.options.lifecycleBaselineCommit;
    assert.throws(() => buildImp24DFinalAttestationForFixture(ancestryFixture.options),
      /not an ancestor|requires two distinct commits|single-parent direct (?:child|correction commit)/);
  } finally {
    ancestryFixture.root.dispose();
  }
});

test("IMP-24D final attestation rejects chronology drift, unknown evidence, and starting-head evidence mutation", () => {
  const chronologyFixture = prepareFixture();
  try {
    chronologyFixture.options.evidence.transportSmoke.cycles[0].completedAt = "2026-07-14T00:06:30.000Z";
    assert.throws(() => buildImp24DFinalAttestationForFixture(chronologyFixture.options),
      /did not start strictly after final transport-smoke PASS/);
  } finally {
    chronologyFixture.root.dispose();
  }

  const inventoryFixture = prepareFixture();
  try {
    write(inventoryFixture.options.repositoryRoot, `${QUALIFICATION_ROOT}/unknown-artifact.json`, "unknown\n");
    assert.throws(() => buildImp24DFinalAttestationForFixture(inventoryFixture.options),
      /inventory is not exact at the Evidence Commit/);
  } finally {
    inventoryFixture.root.dispose();
  }

  const historyFixture = prepareFixture();
  try {
    write(historyFixture.options.repositoryRoot,
      "docs/v25/reports/IMP-24C_PRE_LIVE_FREEZE.json", "tampered historical lifecycle\n");
    assert.throws(() => buildImp24DFinalAttestationForFixture(historyFixture.options),
      /starting-head lifecycle artifact differs/);
  } finally {
    historyFixture.root.dispose();
  }
});

test("IMP-24D retained verification requires one exact three-output final commit", () => {
  const uncommittedFixture = prepareFixture();
  try {
    materializeImp24DFinalAttestationForFixture(uncommittedFixture.options);
    assert.throws(() => verifyImp24DFinalAttestationForFixture(uncommittedFixture.options),
      /requires a later final commit/);
  } finally {
    uncommittedFixture.root.dispose();
  }

  const extraFixture = prepareFixture();
  try {
    materializeImp24DFinalAttestationForFixture(extraFixture.options);
    write(extraFixture.options.repositoryRoot, "unexpected-final-file.txt", "unexpected\n");
    commit(extraFixture.options.repositoryRoot, "fixture invalid final commit");
    assert.throws(() => verifyImp24DFinalAttestationForFixture(extraFixture.options),
      /diff must be exactly the three IMP-24D outputs/);
  } finally {
    extraFixture.root.dispose();
  }
});

test("IMP-24D fixture entrypoint cannot bypass fixed forbidden roots", () => {
  const fixture = prepareFixture();
  try {
    (fixture.options as unknown as { forbiddenRunRoots: null }).forbiddenRunRoots = null;
    assert.throws(() => buildImp24DFinalAttestationForFixture(fixture.options),
      /must supply all three exact forbidden/);
  } finally {
    fixture.root.dispose();
  }
});

test("IMP-24D final attestation proves pilot, gold, and local activation roots are absent", () => {
  const fixture = prepareFixture();
  try {
    write(fixture.options.repositoryRoot, `${FORBIDDEN_RUN_ROOTS[0]}/input-freeze.json`, "forbidden pilot\n");
    assert.throws(() => buildImp24DFinalAttestationForFixture(fixture.options),
      /stop boundary violated.*forbidden pilot\/gold\/activation root exists/);
  } finally {
    fixture.root.dispose();
  }
});
