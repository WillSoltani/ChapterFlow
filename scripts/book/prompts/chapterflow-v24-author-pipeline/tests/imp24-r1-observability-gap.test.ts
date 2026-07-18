import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { test } from "./harness.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const R1_ROOT = resolve(
  PIPELINE_DIR,
  "state/migration-experiments/s16-forward-role-qualification-v3-envelope-r1",
);
const REPORT_JSON_PATH = resolve(REPOSITORY_ROOT, "docs/v25/reports/IMP-24C_R1_OBSERVABILITY_GAP.json");
const REPORT_MARKDOWN_PATH = resolve(REPOSITORY_ROOT, "docs/v25/reports/IMP-24C_R1_OBSERVABILITY_GAP.md");
const ATTEMPT_FILES = [
  "evaluation.json",
  "evidence-envelope.json",
  "execution-evidence.json",
  "receipt.json",
  "request.json",
  "retention.json",
] as const;

type ArtifactBinding = {
  path: string;
  bytes: number;
  bytesSha256: string;
};

type AttemptReport = {
  attemptId: string;
  scheduleId: string;
  caseId: string;
  partition: string;
  family: string;
  role: string;
  profileId: string;
  model: string;
  effort: string;
  attemptNumber: number;
  replayOfAttemptId: string | null;
  status: string;
  requestedAt: string;
  completedAt: string;
  processBoundaryCrossed: boolean;
  invocation: string;
  responseProduced: boolean;
  requestSha256: string;
  requestBytesSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  receiptSha256: string;
  receiptBytesSha256: string;
  executionEvidenceSha256: string;
  evaluationArtifactSha256: string;
  retentionSha256: string;
  failureDetail: string;
  result: {
    ok: boolean;
    exitCode: number;
    durationMs: number;
    stdoutBytes: number;
    stdoutSha256: string;
    stderrBytes: number;
    stderrSha256: string;
    finalMessageSource: string;
    finalMessageBytes: number;
    structuredParsedOk: boolean;
    structuredParseError: string;
  };
  route: {
    executionRoute: string;
    authMode: string;
    apiKeyPresent: boolean;
    apiFallbackAllowed: boolean;
    outcome: string;
  };
  sidecars: Record<string, ArtifactBinding>;
};

type ClosureReport = {
  schema: string;
  promptId: string;
  continuationPromptId: string;
  protocolId: string;
  executionId: string;
  disposition: string;
  branch: string;
  startingHead: string;
  draftPullRequest: number;
  ciProvenance: {
    retainedR1Gate: Record<string, unknown>;
    ownerCheckpoint: Record<string, unknown>;
    interpretation: string;
  };
  stateRoot: string;
  semanticBindings: Record<string, string>;
  closure: {
    mayResume: boolean;
    mayQualifyProfiles: boolean;
    attemptsImmutable: boolean;
    stderrMayBeFabricated: boolean;
  };
  counters: Record<string, number>;
  attempts: AttemptReport[];
  observabilityGap: {
    processDiagnosticsArtifactPresent: boolean;
    stdoutTextRetained: boolean;
    stderrTextRetained: boolean;
    stdoutHashAndByteCountRetained: boolean;
    stderrHashAndByteCountRetained: boolean;
    rootCauseDetermined: boolean;
    missingEvidence: string[];
    permittedInterpretation: string;
    forbiddenActions: string[];
  };
  artifactInventory: {
    hashAlgorithm: string;
    fileCount: number;
    recoveryACommittedFileCount: number;
    postRecoveryARetainedFileCount: number;
    totalBytes: number;
    files: ArtifactBinding[];
  };
  successor: Record<string, unknown>;
  stopBoundary: Record<string, boolean>;
};

const EXPECTED_INVENTORY: ArtifactBinding[] = [
  { path: "candidate-availability.json", bytes: 3574, bytesSha256: "607ea9d04a589cf49e00f54d6b7d4da01c4413190faeae450db9c78534114984" },
  { path: "execution-spec.json", bytes: 2803, bytesSha256: "1396924c5f18134531ec8999365dab44258cc340a799497086f3f89f9772ff76" },
  { path: "implementation-ci-gate.json", bytes: 2204, bytesSha256: "813c0b4cda214d75d1cc44111bd7eb35c8281a519f90da23092a979d8ba0668f" },
  { path: "live/attempts/v3-reader-p1-canary-c01-a1/evaluation.json", bytes: 864, bytesSha256: "c206d6d39f5db026a6fe0de8861719143b70472d5a89546c9eda5ce4c481258e" },
  { path: "live/attempts/v3-reader-p1-canary-c01-a1/evidence-envelope.json", bytes: 19688, bytesSha256: "5aa369d97e8923a03ab1fbc20e92752eec144fcbe65f850130d193febbbd57c4" },
  { path: "live/attempts/v3-reader-p1-canary-c01-a1/execution-evidence.json", bytes: 2057, bytesSha256: "18f5ef285daefc8e2f21de5f9deb372b0ba4162350d1a232109c1e8f7cd7f5f7" },
  { path: "live/attempts/v3-reader-p1-canary-c01-a1/receipt.json", bytes: 21365, bytesSha256: "29003c698e6ee1bcd30e3fd6f7bb76d917576c9f517951828d1a219715da4cba" },
  { path: "live/attempts/v3-reader-p1-canary-c01-a1/request.json", bytes: 42851, bytesSha256: "23e0ec441d099828bef1db5424d42b22d500c587e1f81b0b781211d95ca16982" },
  { path: "live/attempts/v3-reader-p1-canary-c01-a1/retention.json", bytes: 64964, bytesSha256: "fe0c498d484437c61b672de934c80bdec70e35858ced66fc9b9be8ca8a02cb41" },
  { path: "live/attempts/v3-reader-p1-canary-c02-a1/evaluation.json", bytes: 864, bytesSha256: "681b08be003aac031c65537518be6bc4c9fd351a0635f4818ade9315b93235ed" },
  { path: "live/attempts/v3-reader-p1-canary-c02-a1/evidence-envelope.json", bytes: 19776, bytesSha256: "7d854a5a43ae445fe99823300df42499aa12188e0afad8ff652f617e31bb10ab" },
  { path: "live/attempts/v3-reader-p1-canary-c02-a1/execution-evidence.json", bytes: 2057, bytesSha256: "2e0a215c94a8da9a7242a04f5eb6f1cac8a8f2cfc795b8fa8cd57a6e5c2ac0c9" },
  { path: "live/attempts/v3-reader-p1-canary-c02-a1/receipt.json", bytes: 21453, bytesSha256: "fea8f144dd798845b149c5c2f13ecab048218972e36a3e2bbea2dec206fc73b4" },
  { path: "live/attempts/v3-reader-p1-canary-c02-a1/request.json", bytes: 43071, bytesSha256: "8f34aba11bfa512b717acb2eb1c1b5909ed025700d3b415a2302b0478c91d442" },
  { path: "live/attempts/v3-reader-p1-canary-c02-a1/retention.json", bytes: 65272, bytesSha256: "a37375af4bff66d409e327664d07f999db349e40469515a4f3002e6591fa401b" },
  { path: "live/call-ledger.json", bytes: 2300, bytesSha256: "43d3047ca38b1e86344a249368ae97ced5a2b8aeff216d7106f66881b9734332" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-766ecae23d292d028c66345bf80ff8d550b1fda69539cd9a61694ce464592c61.manifest.json", bytes: 2973, bytesSha256: "0f1badf7d7c61853fe6249ef924b2bc0301e44684c4bd4f7ab701c86fcf4d82f" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-766ecae23d292d028c66345bf80ff8d550b1fda69539cd9a61694ce464592c61.result.json", bytes: 574, bytesSha256: "e9534eef113666c8f60df0b638ddb2f5676a5ace255ce4179a359c11e77992b5" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-766ecae23d292d028c66345bf80ff8d550b1fda69539cd9a61694ce464592c61.route.json", bytes: 646, bytesSha256: "7fcef34a2d0627e46943fade96c38f656d44b4e5ad10dff4cf8432a035b61d44" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-766ecae23d292d028c66345bf80ff8d550b1fda69539cd9a61694ce464592c61.structured.json", bytes: 634, bytesSha256: "58c10867564af4a33a5c11c3f321ffdb578bd180f5f1e065f8d9001633efb244" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-dcda96f095733252b1b57004abaf95d6d11ac07ad8c56e80196b32aaf618f311.manifest.json", bytes: 2995, bytesSha256: "4c1c00ee97e72d8f37e38ae9b7a773144bd8e5f5504de7f290b8792d1f266fdd" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-dcda96f095733252b1b57004abaf95d6d11ac07ad8c56e80196b32aaf618f311.result.json", bytes: 574, bytesSha256: "ab325e89bfb008a338f3ecabfd73fdf542c827bc11a368672cbfea2457f0d780" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-dcda96f095733252b1b57004abaf95d6d11ac07ad8c56e80196b32aaf618f311.route.json", bytes: 646, bytesSha256: "7fcef34a2d0627e46943fade96c38f656d44b4e5ad10dff4cf8432a035b61d44" },
  { path: "live/exec/logs/2026-07-14-063537-imp24-v3-dcda96f095733252b1b57004abaf95d6d11ac07ad8c56e80196b32aaf618f311.structured.json", bytes: 634, bytesSha256: "4396f8e27ddd9ea987926705cf23b7ef91cadf2e239539164c11e801ff51fc4e" },
  { path: "live/preflight.json", bytes: 1255, bytesSha256: "a1b4ce3dac130cf691399e16186d4dc669105c5be42f4c556584954d9264feab" },
  { path: "live/qualification-freeze.json", bytes: 1857, bytesSha256: "b9fbe5f9dd8857b37d05da6ee552d7573f00ea9d8a599ff411baebabfa80e38e" },
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walkFiles(root: string, current = root): string[] {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(current, entry.name);
    return entry.isDirectory() ? walkFiles(root, absolutePath) : [relative(root, absolutePath)];
  }).sort();
}

function actualInventory(): ArtifactBinding[] {
  return walkFiles(R1_ROOT).map((path) => {
    const absolutePath = resolve(R1_ROOT, path);
    return { path, bytes: statSync(absolutePath).size, bytesSha256: sha256(absolutePath) };
  });
}

test("IMP-24D preserves the exact 25 post-A r1 artifacts plus the committed execution spec", () => {
  assert.equal(EXPECTED_INVENTORY.length, 26);
  assert.equal(EXPECTED_INVENTORY.filter((entry) => entry.path !== "execution-spec.json").length, 25);
  assert.deepEqual(actualInventory(), EXPECTED_INVENTORY);
  assert.equal(EXPECTED_INVENTORY.reduce((total, entry) => total + entry.bytes, 0), 327951);
  assert.ok(EXPECTED_INVENTORY.every((entry) => !entry.path.endsWith("process-diagnostics.json")));

  const attemptsRoot = resolve(R1_ROOT, "live/attempts");
  const attemptIds = readdirSync(attemptsRoot).sort();
  assert.deepEqual(attemptIds, ["v3-reader-p1-canary-c01-a1", "v3-reader-p1-canary-c02-a1"]);
  for (const attemptId of attemptIds) {
    assert.deepEqual(readdirSync(resolve(attemptsRoot, attemptId)).sort(), [...ATTEMPT_FILES].sort());
  }
});

test("IMP-24D r1 self-hashes, process sidecars, and counters retain the exact failed canaries", () => {
  const executionSpec = readJson<Record<string, unknown>>(resolve(R1_ROOT, "execution-spec.json"));
  const availability = readJson<Record<string, unknown>>(resolve(R1_ROOT, "candidate-availability.json"));
  const gate = readJson<Record<string, unknown>>(resolve(R1_ROOT, "implementation-ci-gate.json"));
  const preflight = readJson<Record<string, unknown>>(resolve(R1_ROOT, "live/preflight.json"));
  const freeze = readJson<Record<string, unknown>>(resolve(R1_ROOT, "live/qualification-freeze.json"));
  assert.equal(executionSpec.executionSpecSha256, "dece02d64395514a743f2897821bb9879375d0f6939dc2f1766a620681a2acd1");
  assert.equal(availability.availabilitySha256, "7b6d2f9317a4c9f4f914e980ad4cc8265384db82c1762f69d3a958b5e8e0cd52");
  assert.equal(gate.gateSha256, "4089e433733692dff6855e9760b5856e98b1e38b70f0737ac9d4d727f4ce1b07");
  assert.equal(preflight.preflightSha256, "54a53fd8f19ae9b1570ada9550db8b81c997b6c63f37037f33e261617be59828");
  assert.equal(freeze.freezeSha256, "74bd0cbad4724fab436b726324d1400e2bb2aad820a5f6f4b8cfe0ba3b606446");

  const ledger = readJson<{
    entries: Array<Record<string, unknown>>;
    brokerRequests: number;
    codexExecInvocations: number;
    cachedReceipts: number;
    infrastructureReplays: number;
    maxPlanCapacityEvents: number;
    apiCallsMade: number;
  }>(resolve(R1_ROOT, "live/call-ledger.json"));
  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.brokerRequests, 2);
  assert.equal(ledger.codexExecInvocations, 2);
  assert.equal(ledger.cachedReceipts, 0);
  assert.equal(ledger.infrastructureReplays, 0);
  assert.equal(ledger.maxPlanCapacityEvents, 0);
  assert.equal(ledger.apiCallsMade, 0);
  assert.ok(ledger.entries.every((entry) => entry.status === "integrity_failure"));

  for (const expected of readJson<ClosureReport>(REPORT_JSON_PATH).attempts) {
    const attemptRoot = resolve(R1_ROOT, "live/attempts", expected.attemptId);
    const request = readJson<Record<string, unknown>>(resolve(attemptRoot, "request.json"));
    const receipt = readJson<Record<string, unknown>>(resolve(attemptRoot, "receipt.json"));
    const executionEvidence = readJson<Record<string, unknown>>(resolve(attemptRoot, "execution-evidence.json"));
    const evaluation = readJson<Record<string, unknown>>(resolve(attemptRoot, "evaluation.json"));
    const retention = readJson<Record<string, unknown>>(resolve(attemptRoot, "retention.json"));

    assert.equal(request.partition, "canary");
    assert.equal(request.attemptNumber, 1);
    assert.equal(request.replayOfAttemptId, null);
    assert.equal(request.requestSha256, expected.requestSha256);
    assert.equal(request.evidenceEnvelopeSha256, expected.evidenceEnvelopeSha256);
    assert.equal(request.evidenceEnvelopeBytesSha256, expected.evidenceEnvelopeBytesSha256);
    assert.equal(receipt.status, "integrity_failure");
    assert.equal(receipt.receiptSha256, expected.receiptSha256);
    assert.equal(receipt.failureDetail, expected.failureDetail);
    assert.equal(executionEvidence.executionEvidenceSha256, expected.executionEvidenceSha256);
    assert.equal(executionEvidence.invocation, "RUNNER_RETURNED");
    assert.equal(executionEvidence.responseProduced, true);
    assert.equal(evaluation.evaluationArtifactSha256, expected.evaluationArtifactSha256);
    assert.equal(evaluation.evaluation, null);
    assert.equal(retention.retentionSha256, expected.retentionSha256);

    for (const sidecar of Object.values(expected.sidecars)) {
      assert.equal(statSync(resolve(R1_ROOT, sidecar.path)).size, sidecar.bytes);
      assert.equal(sha256(resolve(R1_ROOT, sidecar.path)), sidecar.bytesSha256);
    }
    const result = readJson<Record<string, unknown>>(resolve(R1_ROOT, expected.sidecars.result.path));
    const route = readJson<Record<string, unknown>>(resolve(R1_ROOT, expected.sidecars.route.path));
    const structured = readJson<Record<string, unknown>>(resolve(R1_ROOT, expected.sidecars.structuredOutput.path));
    assert.equal(result.exitCode, expected.result.exitCode);
    assert.equal(result.stdoutBytes, expected.result.stdoutBytes);
    assert.equal(result.stdoutSha256, expected.result.stdoutSha256);
    assert.equal(result.stderrBytes, expected.result.stderrBytes);
    assert.equal(result.stderrSha256, expected.result.stderrSha256);
    assert.equal(route.executionRoute, "codex_exec_chatgpt_subscription");
    assert.equal(route.authMode, "chatgpt");
    assert.equal(route.apiKeyPresent, false);
    assert.equal(route.apiFallbackAllowed, false);
    assert.equal(structured.parsedOk, false);
    assert.equal(structured.parseError, "Unexpected end of JSON input");
  }
});

test("IMP-24D r1 closure reports match retained evidence and distinguish both exact-head CI runs", () => {
  const reportBytes = readFileSync(REPORT_JSON_PATH, "utf8");
  const report = JSON.parse(reportBytes) as ClosureReport;
  assert.equal(reportBytes, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.schema, "imp-24c-r1-observability-gap-v1");
  assert.equal(report.promptId, "IMP-24");
  assert.equal(report.continuationPromptId, "IMP-24D");
  assert.equal(report.executionId, "s16-forward-role-qualification-v3-envelope-r1");
  assert.equal(report.disposition, "BLOCKED_OBSERVABILITY_INCOMPLETE");
  assert.equal(report.startingHead, "3b060fb0a7f6e64e04386b84ff6b5a10e42868ec");
  assert.equal(report.closure.mayResume, false);
  assert.equal(report.closure.mayQualifyProfiles, false);
  assert.equal(report.closure.attemptsImmutable, true);
  assert.equal(report.closure.stderrMayBeFabricated, false);
  assert.deepEqual(report.counters, {
    canaryCallsAttempted: 2,
    holdoutCalls: 0,
    brokerRequests: 2,
    codexExecInvocations: 2,
    cachedReceipts: 0,
    infrastructureReplays: 0,
    maxPlanCapacityEvents: 0,
    apiCalls: 0,
    rolesQualified: 0,
    successfulStructuredResponses: 0,
  });
  assert.equal(report.ciProvenance.retainedR1Gate.runId, 29311237347);
  assert.equal(report.ciProvenance.ownerCheckpoint.runId, 29311241491);
  assert.equal(report.ciProvenance.ownerCheckpoint.retainedGateRewritten, false);
  assert.deepEqual(report.artifactInventory.files, EXPECTED_INVENTORY);
  assert.equal(report.artifactInventory.fileCount, 26);
  assert.equal(report.artifactInventory.recoveryACommittedFileCount, 1);
  assert.equal(report.artifactInventory.postRecoveryARetainedFileCount, 25);
  assert.equal(report.artifactInventory.totalBytes, 327951);
  assert.equal(report.observabilityGap.processDiagnosticsArtifactPresent, false);
  assert.equal(report.observabilityGap.stderrTextRetained, false);
  assert.equal(report.observabilityGap.stderrHashAndByteCountRetained, true);
  assert.equal(report.observabilityGap.rootCauseDetermined, false);
  assert.equal(report.successor.qualificationExecutionId, "s16-forward-role-qualification-v3-envelope-r2");
  assert.ok(Object.values(report.stopBoundary).every((value) => value === false));

  const retainedGate = readJson<Record<string, unknown>>(resolve(R1_ROOT, "implementation-ci-gate.json"));
  const retainedWorkflow = retainedGate.workflow as Record<string, unknown>;
  assert.equal(retainedWorkflow.runId, report.ciProvenance.retainedR1Gate.runId);
  assert.equal(retainedGate.headSha, report.startingHead);
  assert.equal(report.ciProvenance.ownerCheckpoint.headSha, report.startingHead);

  const markdown = readFileSync(REPORT_MARKDOWN_PATH, "utf8");
  assert.ok(markdown.endsWith("\n"));
  assert.match(markdown, /Status: `BLOCKED_OBSERVABILITY_INCOMPLETE`/);
  assert.match(markdown, /Retained r1 implementation gate \| `29311237347` \| `SUCCESS`/);
  assert.match(markdown, /Independently verified owner checkpoint \| `29311241491` \| `SUCCESS`/);
  assert.match(markdown, /No `process-diagnostics\.json` is added to either r1 attempt/);
  assert.match(markdown, /exactly `26` files totaling `327951` bytes/);
  assert.match(markdown, /added exactly `25` retained files/);
  for (const attempt of report.attempts) {
    assert.ok(markdown.includes(attempt.attemptId));
    assert.ok(markdown.includes(attempt.requestSha256));
    assert.ok(markdown.includes(attempt.result.stderrSha256));
  }
});
