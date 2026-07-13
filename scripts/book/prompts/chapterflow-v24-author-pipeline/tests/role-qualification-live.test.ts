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
  createLiveQualificationExecutor,
  loadAndPreflightLiveQualification,
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

test("live qualification persists an exact receipt and a resume spends zero bonus calls", async () => {
  const root = mkdtempSync(join(tmpdir(), "cf-imp22-live-qualification-"));
  let calls = 0;
  try {
    const live = createLiveQualificationExecutor({
      phase: "calibration",
      specBytesSha256: "b".repeat(64),
      phaseDir: root,
      spawn: async (options) => {
        calls += 1;
        return okResult(options);
      },
    });
    const request = qualificationRequest();
    const first = await live.executor(request);
    const resumed = await live.executor(request);
    assert.deepEqual(resumed, first);
    assert.equal(calls, 1, "an exact resume must reuse the persisted receipt");
    assert.equal(live.ledger.codexExecInvocations, 1);
    assert.equal(live.ledger.cachedReceipts, 1);
    assert.equal(live.ledger.apiCallsMade, 0);

    await assert.rejects(
      live.executor({ ...request, task: `${request.task}\nchanged after freeze` }),
      /request hash changed on resume/,
    );
    assert.equal(calls, 1, "a drifted resume must fail before spawning");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("live qualification binds every spawn-owned sink to its phase and leaves canonical exec evidence untouched", async () => {
  const root = mkdtempSync(join(tmpdir(), "cf-imp22-live-qualification-sinks-"));
  const phaseDir = resolve(root, "experiment", "live", "calibration");
  const canonicalSink = defaultManifestSink();
  const canonicalCliCache = qualificationCachePathFor(canonicalSink);
  const canonicalCliCacheBefore = existsSync(canonicalCliCache)
    ? sha256Hex(readFileSync(canonicalCliCache))
    : null;
  const captured: SpawnCodexAgentOptions[] = [];
  try {
    const live = createLiveQualificationExecutor({
      phase: "calibration",
      specBytesSha256: "b".repeat(64),
      phaseDir,
      spawn: async (options) => {
        captured.push(options);
        return okResult(options);
      },
    });

    await live.executor(qualificationRequest());
    assert.equal(captured.length, 1, "the injected no-model spawn must observe exactly one broker call");
    const options = captured[0]!;
    assert.equal(options.manifestSink, resolve(phaseDir, "exec", "logs"));
    assert.equal(options.execBaseDir, resolve(phaseDir, "exec", "sessions"));
    assert.equal(options.qualificationCacheDir, resolve(phaseDir, "exec", "cli-qualification-cache"));
    for (const path of [options.manifestSink, options.execBaseDir, options.qualificationCacheDir]) {
      assert.equal(typeof path, "string");
      assert.equal(resolve(path!).startsWith(`${phaseDir}/`), true, `spawn sink escaped the phase root: ${String(path)}`);
      assert.notEqual(resolve(path!), resolve(canonicalSink));
    }

    const canonicalCliCacheAfter = existsSync(canonicalCliCache)
      ? sha256Hex(readFileSync(canonicalCliCache))
      : null;
    assert.equal(canonicalCliCacheAfter, canonicalCliCacheBefore, "qualification must not mutate the canonical CLI cache");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("live preflight refuses a parent API-key route before any codex execution", async () => {
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-sentinel-never-sent";
  try {
    await assert.rejects(
      loadAndPreflightLiveQualification({ verifiedAt: "2026-07-12T00:00:00.000Z" }),
      (error: unknown) => error instanceof LiveRoleQualificationError
        && /prohibited provider env key\(s\): OPENAI_API_KEY/.test(error.message),
    );
  } finally {
    if (prior === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prior;
  }
});
