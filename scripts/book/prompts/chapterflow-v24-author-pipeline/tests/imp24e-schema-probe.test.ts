import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { PROBED_FLAGS, type CodexCliQualificationV1 } from "../src/exec/cliQualification.js";
import { resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import {
  IMP24_REQUIRED_BRANCH,
  IMP24_REQUIRED_DRAFT_PR,
  IMP24_REQUIRED_REPOSITORY,
  IMP24_REQUIRED_REPOSITORY_URL,
  IMP24_REQUIRED_WORKFLOW_FILE,
  IMP24_REQUIRED_WORKFLOW_JOB,
  IMP24_REQUIRED_WORKFLOW_NAME,
  buildImp24ImplementationCiGateFromEvidence,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import {
  IMP24E_SCHEMA_PROBE_EXECUTION_ID,
  IMP24E_SCHEMA_PROBE_PREFLIGHT_SCHEMA,
  IMP24E_SCHEMA_PROBE_R2_EXECUTION_ID,
  buildImp24ESchemaProbeRequest,
  imp24ESchemaProbeMinimumOutput,
  imp24ESchemaProbePaths,
  runImp24ESchemaProbes,
  validateImp24ESchemaProbeRequest,
} from "../src/orchestrator/imp24eSchemaProbe.js";
import { ROUTE_POLICY_VERSION } from "../src/orchestrator/modelPolicy.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const HEAD_1 = "1".repeat(40);
const HEAD_2 = "2".repeat(40);
const NOW = "2026-07-14T15:00:00.000Z";

function implementationGate(headSha: string, workflowRunId: number) {
  return buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: headSha,
    workflowRunId,
    checkout: { branch: IMP24_REQUIRED_BRANCH, headSha, implementationClean: true },
    workflowRun: {
      databaseId: workflowRunId,
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
    repository: { nameWithOwner: IMP24_REQUIRED_REPOSITORY, url: IMP24_REQUIRED_REPOSITORY_URL },
    verifiedAt: NOW,
  });
}

const qualification: CodexCliQualificationV1 = {
  schema: "codex-cli-qualification-v1",
  binPath: "/fixture/codex",
  binSize: 1,
  binMtimeMs: 1,
  version: "codex-cli fixture",
  flags: Object.fromEntries(PROBED_FLAGS.map((flag) => [flag, true])),
  probedAtIso: NOW,
  synthetic: false,
};

function probeDeps(retainedArtifactRoot: string) {
  return {
    retainedArtifactRoot,
    clock: () => new Date(NOW),
    collectImplementationCiGate: (args: { expectedHeadSha: string; workflowRunId: number }) =>
      implementationGate(args.expectedHeadSha, args.workflowRunId),
    preflight: async (args: {
      cycle: 1 | 2;
      executionId: typeof IMP24E_SCHEMA_PROBE_EXECUTION_ID | typeof IMP24E_SCHEMA_PROBE_R2_EXECUTION_ID;
      implementationCiGate: ReturnType<typeof implementationGate>;
      verifiedAt: string;
    }) => {
      const core = {
        schema: IMP24E_SCHEMA_PROBE_PREFLIGHT_SCHEMA,
        cycle: args.cycle,
        executionId: args.executionId,
        verifiedAt: args.verifiedAt,
        implementationCiGateSha256: args.implementationCiGate.gateSha256,
        cliVersion: qualification.version,
        cliBinary: qualification.binPath,
        cliSynthetic: false as const,
        executionProfileHash: resolveExecutionProfile("chapter-reviewer").profileHash,
        routePolicyVersion: ROUTE_POLICY_VERSION as "route-policy-v1.0",
        executionRoute: "codex_exec_chatgpt_subscription" as const,
        authMode: "chatgpt" as const,
        apiKeyPresent: false as const,
        apiFallbackAllowed: false as const,
        directHttpOrSdkAllowed: false as const,
        forbiddenProviderEnvKeysPresent: [] as [],
        sandbox: "read-only" as const,
        maximumCalls: 3 as const,
        maximumCycles: 2 as const,
        qualificationMetricsIncluded: false as const,
        apiCalls: 0 as const,
      };
      return {
        artifact: { ...core, preflightSha256: hashCanonical(core) },
        qualification,
        bin: qualification.binPath,
      };
    },
    // The injected process crosses the exact broker boundary and fails once.
    // It emits no sidecars, so the retained probe must fail closed without a
    // retry while still preserving complete stdout/stderr/exit diagnostics.
    spawn: async (options: Parameters<typeof import("../src/orchestrator/codexAgent.js").spawnCodexAgent>[0]) => {
      options.onRunnerBoundary?.({
        sessionId: options.sessionId,
        manifestPath: resolve(options.manifestSink as string, `${options.sessionId}.manifest.json`),
        schemaBound: true,
        outputSchemaPath: options.outputSchemaPath ?? null,
        outputSchemaSha256: sha256Hex(readFileSync(options.outputSchemaPath!)),
      });
      return {
        ok: false,
        exitCode: 1,
        finalMessage: "",
        stdout: "probe stdout",
        stderr: "invalid_json_schema fixture",
        durationMs: 1,
        sessionId: options.sessionId,
        finalMessageSource: "stdout-fallback" as const,
      };
    },
  };
}

test("IMP-24E schema-probe plan is exactly reader/source/quiz with tiny valid synthetic outputs", () => {
  const roles = ["reader", "source", "quiz"] as const;
  const requests = roles.map((role) => buildImp24ESchemaProbeRequest({
    cycle: 1,
    role,
    repositoryRoot: REPOSITORY_ROOT,
  }));
  assert.deepEqual(requests.map((request) => request.role), roles);
  assert.equal(requests.every((request) => request.executionId === IMP24E_SCHEMA_PROBE_EXECUTION_ID), true);
  assert.equal(requests.every((request) => request.qualificationMetricsIncluded === false), true);
  assert.equal(requests.every((request) => request.apiCalls === 0), true);
  assert.equal(new Set(requests.map((request) => request.attemptId)).size, 3);
  for (const request of requests) {
    validateImp24ESchemaProbeRequest(request, REPOSITORY_ROOT);
    assert.match(request.task, /synthetic and must not be treated as a review or qualification judgment/);
    assert.equal(hashCanonical(imp24ESchemaProbeMinimumOutput(request.role)), request.expectedMinimumOutputSha256);
  }
});

test("IMP-24E probe lifecycle makes three calls once, retains diagnostics, and revalidates without replay", async () => {
  const roots = mkTestRoots("imp24e-schema-probe");
  try {
    const deps = probeDeps(roots.base);
    const first = await runImp24ESchemaProbes({
      executeLive: true,
      cycle: 1,
      expectedHeadSha: HEAD_1,
      workflowRunId: 24001,
      repositoryRoot: REPOSITORY_ROOT,
    }, deps);
    assert.equal(first.executed, true);
    assert.equal(first.code, 1);
    assert.equal(first.cycleResult?.status, "FAIL");
    assert.equal(first.cycleResult?.brokerRequests, 3);
    assert.equal(first.cycleResult?.codexExecInvocations, 3);
    assert.deepEqual(first.cycleResult?.results.map((result) => result.role), ["reader", "source", "quiz"]);
    assert.equal(first.cycleResult?.results.every((result) =>
      result.processDiagnosticsSha256.length === 64
        && result.qualificationMetricsIncluded === false
        && result.apiCalls === 0), true);
    const paths = imp24ESchemaProbePaths(roots.base, 1);
    for (const result of first.cycleResult!.results) {
      assert.equal(existsSync(resolve(paths.attemptsDir, result.attemptId, "process-diagnostics.json")), true);
    }

    const retained = await runImp24ESchemaProbes({
      executeLive: true,
      cycle: 1,
      expectedHeadSha: HEAD_1,
      workflowRunId: 24001,
      repositoryRoot: REPOSITORY_ROOT,
    }, deps);
    assert.equal(retained.executed, false);
    assert.equal(retained.modelCalls, 0);

    await assert.rejects(() => runImp24ESchemaProbes({
      executeLive: true,
      cycle: 2,
      expectedHeadSha: HEAD_1,
      workflowRunId: 24002,
      repositoryRoot: REPOSITORY_ROOT,
    }, deps), /different exact-CI implementation commit/);

    const second = await runImp24ESchemaProbes({
      executeLive: true,
      cycle: 2,
      expectedHeadSha: HEAD_2,
      workflowRunId: 24002,
      repositoryRoot: REPOSITORY_ROOT,
    }, deps);
    assert.equal(second.executed, true);
    assert.equal(second.report?.cycles.length, 2);
    assert.equal(second.report?.totalBrokerRequests, 6);
    assert.equal(second.report?.maximumCallsAuthorized, 6);
    assert.equal(second.report?.apiCalls, 0);
  } finally {
    roots.dispose();
  }
});

test("IMP-24E schema-probe CLI dry barrier and fixed flags precede the injected campaign", async () => {
  let touched = 0;
  const deps = {
    imp24ESchemaProbes: {
      runCampaign: async () => {
        touched += 1;
        throw new Error("must not run");
      },
    },
  };
  const originalError = console.error;
  console.error = () => undefined;
  try {
    assert.equal(await runMigrationBakeoffCli(["imp24e-schema-probes"], {
      "head-sha": HEAD_1,
      "workflow-run-id": "24001",
    }, deps), 2);
    assert.equal(await runMigrationBakeoffCli(["imp24e-schema-probes"], {
      "execute-live": true,
      "head-sha": HEAD_1,
      "workflow-run-id": "24001",
      "models-cache": "/forbidden",
    }, deps), 2);
  } finally {
    console.error = originalError;
  }
  assert.equal(touched, 0);
});

test("IMP-24D supersession record is concise, exact, and byte-binds preserved evidence", () => {
  const path = resolve(REPOSITORY_ROOT, "docs/v25/reports/IMP-24D_TRANSPORT_FAILURE_SUPERSEDED.json");
  const supersession = JSON.parse(readFileSync(path, "utf8")) as {
    facts: Record<string, unknown>;
    retainedEvidence: { reportJson: string; reportJsonBytesSha256: string };
    controls: Record<string, unknown>;
  };
  assert.deepEqual(supersession.facts, {
    initialSmokeCalls: 2,
    initialModelProcessExits: 2,
    initialRootCause: "unsupported uniqueItems keyword",
    correctedSmokeCalls: 0,
    correctedSmokeRootCause: "volatile cache provenance in semantic projection",
    apiCalls: 0,
    qualificationCalls: 0,
    rolesFrozen: 0,
  });
  assert.equal(sha256Hex(readFileSync(resolve(REPOSITORY_ROOT, supersession.retainedEvidence.reportJson))),
    supersession.retainedEvidence.reportJsonBytesSha256);
  assert.equal(supersession.controls.priorAttemptsMayRerun, false);
  assert.equal(supersession.controls.priorAttemptsMayBeReinterpreted, false);
  assert.equal(supersession.controls.qualificationMetricsIncluded, false);
});
