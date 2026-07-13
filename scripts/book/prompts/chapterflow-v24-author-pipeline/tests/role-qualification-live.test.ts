/** IMP-22 live qualification adapter: zero-provider injected coverage. */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { sha256Hex } from "../src/contracts/contractUtil.js";
import { qualificationCachePathFor } from "../src/exec/cliQualification.js";
import { defaultManifestSink } from "../src/exec/executionEnvelope.js";
import type { CodexAgentResult, SpawnCodexAgentOptions } from "../src/orchestrator/codexAgent.js";
import {
  DEFAULT_IMP22_ROLE_CANDIDATE_ORDER,
  ROLE_QUALIFICATION_REQUEST_SCHEMA,
  type RoleQualificationExecutionRequestV1,
} from "../src/bakeoff/migration/roleQualificationRunner.js";
import {
  discoverRoleQualificationCandidateAvailability,
  LiveRoleQualificationError,
  attestLiveRoleCalibration,
  createLiveQualificationExecutor,
  loadAndPreflightLiveQualification,
  runLiveRoleCalibration,
  runLiveRoleQualificationHoldout,
  type CandidateAvailabilityPolicyV1,
} from "../src/orchestrator/forwardRoleQualificationLive.js";
import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

function okResult(options: SpawnCodexAgentOptions): CodexAgentResult {
  return {
    ok: true,
    exitCode: 0,
    finalMessage: "{}",
    stdout: "{}",
    stderr: "",
    durationMs: 1,
    sessionId: options.sessionId,
    finalMessageSource: "output-file",
  };
}

function qualificationRequest(): RoleQualificationExecutionRequestV1 {
  const content = "# Reader-visible qualification chapter\n";
  const schemaPath = resolve(
    PIPELINE_DIR,
    "state/migration-experiments/contracts/schemas/reader-experience-review.schema.json",
  );
  return {
    schema: ROLE_QUALIFICATION_REQUEST_SCHEMA,
    scheduleId: "qual-00001",
    attemptId: "qual-00001-a1",
    replayOfAttemptId: null,
    attemptNumber: 1,
    role: "reader",
    partition: "calibration",
    caseId: "reader-calibration-1",
    family: "clean",
    profileId: "gpt-5.6-sol@high",
    model: "gpt-5.6-sol",
    effort: "high",
    schemaSha256: sha256Hex(readFileSync(schemaPath)),
    promptSha256: sha256Hex("Read the phase-1 document and return JSON."),
    freezeSha256: "a".repeat(64),
    task: "Read the phase-1 document and return JSON.",
    artifacts: [{
      kind: "phase1-doc",
      relPath: "reader/calibration.phase1.md",
      content,
      sha256: sha256Hex(content),
    }],
  };
}

const AVAILABILITY_POLICY: CandidateAvailabilityPolicyV1 = {
  schema: "imp22-candidate-availability-policy-v1",
  source: "codex-local-models-cache",
  sourceFile: "models_cache.json",
  maximumCacheAgeSeconds: 86_400,
  maximumFutureSkewSeconds: 300,
  requiredVisibility: "list",
  requireExactModelSlug: true,
  requireReasoningEffortSupport: true,
  requireAtLeastOneAvailablePerRole: true,
  skipUnavailableWithoutReordering: true,
  candidateReorderingAllowed: false,
  networkCalls: 0,
  modelCalls: 0,
  apiCalls: 0,
};

test("candidate availability discovery deterministically skips unavailable profiles and blocks only an exhausted role", () => {
  const root = mkdtempSync(join(tmpdir(), "cf-imp22-candidate-availability-"));
  const cachePath = join(root, "models_cache.json");
  try {
    const writeCache = (models: unknown[]) => writeFileSync(cachePath, `${JSON.stringify({
      fetched_at: "2026-07-12T12:00:00.000Z",
      models,
    }, null, 2)}\n`);
    writeCache([
      { slug: "gpt-5.6-sol", visibility: "list", supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }] },
      { slug: "gpt-5.5", visibility: "list", supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }] },
    ]);
    const first = discoverRoleQualificationCandidateAvailability({
      candidateOrder: DEFAULT_IMP22_ROLE_CANDIDATE_ORDER,
      policy: AVAILABILITY_POLICY,
      policyBytesSha256: "c".repeat(64),
      modelsCachePath: cachePath,
      verifiedAt: "2026-07-12T13:00:00.000Z",
    });
    const second = discoverRoleQualificationCandidateAvailability({
      candidateOrder: DEFAULT_IMP22_ROLE_CANDIDATE_ORDER,
      policy: AVAILABILITY_POLICY,
      policyBytesSha256: "c".repeat(64),
      modelsCachePath: cachePath,
      verifiedAt: "2026-07-12T13:00:00.000Z",
    });
    assert.deepEqual(second, first);
    assert.equal(first.calibrationCandidatesAvailable, true);
    assert.equal(first.entries.filter((entry) => entry.requiredForCalibration).length, 3);

    writeCache([
      { slug: "gpt-5.5", visibility: "list", supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }] },
    ]);
    const fallback = discoverRoleQualificationCandidateAvailability({
      candidateOrder: DEFAULT_IMP22_ROLE_CANDIDATE_ORDER,
      policy: AVAILABILITY_POLICY,
      policyBytesSha256: "c".repeat(64),
      modelsCachePath: cachePath,
      verifiedAt: "2026-07-12T13:00:00.000Z",
    });
    assert.deepEqual(
      fallback.entries.filter((entry) => entry.requiredForCalibration).map((entry) => [entry.role, entry.profileId]),
      [["reader", "gpt-5.5@high"], ["source", "gpt-5.5@xhigh"], ["quiz", "gpt-5.5@xhigh"]],
    );
    assert.equal(fallback.entries.filter((entry) => entry.model === "gpt-5.6-sol").every((entry) => entry.status === "UNAVAILABLE"), true);

    writeCache([]);
    assert.throws(() => discoverRoleQualificationCandidateAvailability({
      candidateOrder: DEFAULT_IMP22_ROLE_CANDIDATE_ORDER,
      policy: AVAILABILITY_POLICY,
      policyBytesSha256: "c".repeat(64),
      modelsCachePath: cachePath,
      verifiedAt: "2026-07-12T13:00:00.000Z",
    }), /no advertised profile remains/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("archived V1/V2 live preflight and broker are replay-only first barriers", async () => {
  let spawnCalls = 0;
  assert.throws(() => createLiveQualificationExecutor({
    phase: "calibration",
    specBytesSha256: "b".repeat(64),
    phaseDir: "/must-not-be-created",
    spawn: async (options) => {
      spawnCalls += 1;
      return okResult(options);
    },
  }), /v1=INVALID_INSTRUMENT_DO_NOT_ATTEST.*v2=BLOCKED_CALIBRATION_INVALID/);
  await assert.rejects(
    loadAndPreflightLiveQualification({ verifiedAt: "2026-07-12T00:00:00.000Z" }),
    /v1=INVALID_INSTRUMENT_DO_NOT_ATTEST.*v2=BLOCKED_CALIBRATION_INVALID/,
  );
  await assert.rejects(runLiveRoleCalibration({ experimentDir: "/must-not-be-created" }),
    /v1=INVALID_INSTRUMENT_DO_NOT_ATTEST.*v2=BLOCKED_CALIBRATION_INVALID/);
  await assert.rejects(runLiveRoleQualificationHoldout({ experimentDir: "/must-not-be-created" }),
    /v1=INVALID_INSTRUMENT_DO_NOT_ATTEST.*v2=BLOCKED_CALIBRATION_INVALID/);
  assert.throws(() => attestLiveRoleCalibration({
    experimentDir: "/must-not-be-created",
    confirmedCalibrationSha256: "a".repeat(64),
    inspectedBy: "must-not-run",
    approveHoldout: true,
  }), /v1=INVALID_INSTRUMENT_DO_NOT_ATTEST.*v2=BLOCKED_CALIBRATION_INVALID/);
  assert.equal(spawnCalls, 0);
});
