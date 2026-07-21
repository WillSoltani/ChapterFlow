import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { CandidateSnapshot } from "../src/books/candidateTypes.js";
import type { Result } from "../src/contracts/v4Core.js";
import { driveV4FreshQc } from "../src/qc/auto/driver.js";
import type { CanonicalReviewResult } from "../src/review/reviewTypes.js";
import { test } from "./harness.js";

const cliSource = readFileSync(resolve(process.cwd(), "src/cli.ts"), "utf8");

function cli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "1", CHAPTERFLOW_ALLOW_MODEL_GEN: "0" },
  });
}

test("actual CLI loads malformed config only for declared MODEL or WRITE routes", () => {
  const configDir = mkdtempSync(resolve(tmpdir(), "wp19-config-"));
  writeFileSync(resolve(configDir, "broken.json"), "{not-json\n");
  for (const args of [["help"], ["doctor"], ["state-status"]]) {
    const result = cli([...args, "--config-dir", configDir]);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Config schema validation failed/);
  }
  for (const args of [["ping"], ["migrate-state"]]) {
    const result = cli([...args, "--config-dir", configDir]);
    assert.equal(result.status, 2);
    assert.match(`${result.stdout}${result.stderr}`, /Config schema validation failed/);
  }
});

test("actual qc-auto entrypoint rejects missing explicit V25 composition before QC writes", () => {
  const packagesDir = resolve(process.cwd(), "book-packages");
  const fixture = resolve(packagesDir, "wp19-cli-fixture.v21.json");
  mkdirSync(packagesDir, { recursive: true });
  writeFileSync(fixture, "{}\n");
  try {
    const result = cli(["qc-auto", "wp19-cli-fixture", "--pass"]);
    assert.equal(result.status, 2);
    assert.match(`${result.stdout}${result.stderr}`, /V25_COMPOSITION_REQUIRED/);
  } finally {
    rmSync(fixture, { force: true });
  }
});

test("qc-auto source orders canonical review before dry evaluation and one V4 fresh-QC call", () => {
  const body = cliSource.slice(cliSource.indexOf("async function runQcAuto"), cliSource.indexOf("async function runPublishAfterQc"));
  const reviewAt = body.indexOf("reviewCliV25Candidate");
  const dryAt = body.indexOf("dryRun: true");
  const freshAt = body.indexOf("driveV4FreshQc");
  assert.ok(reviewAt > 0 && dryAt > reviewAt && freshAt > dryAt);
  assert.equal((body.match(/driveV4FreshQc\(/g) ?? []).length, 1);
  assert.match(body, /reviewed\.value\.outcome/);
  assert.match(body, /fresh\.outcome === "FAIL"/);
});

test("qc-auto canonical FAIL commits legacy finalization once then blocks legacy PASS output", () => {
  const body = cliSource.slice(cliSource.indexOf("async function runQcAuto"), cliSource.indexOf("async function runPublishAfterQc"));
  const start = body.indexOf('if (fresh.outcome === "FAIL")');
  const end = body.indexOf('if (result.outcome === "INCOMPLETE"', start);
  const failBranch = body.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.equal((failBranch.match(/orch\.finalizeQcRound\(/g) ?? []).length, 1);
  assert.match(failBranch, /V25_QC_FAIL/);
  assert.match(failBranch, /return 3/);
  assert.doesNotMatch(failBranch, /QC AUTO PASS|publish-after-qc/);
});

test("qc-auto subset and stale diagnostics return before canonical V4 fresh QC", () => {
  const body = cliSource.slice(cliSource.indexOf("async function runQcAuto"), cliSource.indexOf("async function runPublishAfterQc"));
  const branchAt = body.indexOf("if (isSubset || staleDiagnosticsOnly)");
  const evaluationAt = body.indexOf("const evaluationOutcome", branchAt);
  const freshAt = body.indexOf("const fresh = await driveV4FreshQc", branchAt);
  const branch = body.slice(branchAt, evaluationAt);
  assert.ok(branchAt > 0 && evaluationAt > branchAt && freshAt > evaluationAt);
  assert.match(branch, /orch\.finalizeQcRound\(bookId, roundId, \{ chapters, attest \}\)/);
  assert.match(branch, /result\.outcome === "PASS_SUBSET" && reviewed\.value\.outcome === "PASS"/);
  assert.match(branch, /QC AUTO PASS \(SUBSET\)/);
  assert.match(branch, /status: STALE_ROUND/);
  assert.doesNotMatch(branch, /driveV4FreshQc|qcService\.runFresh|publish-after-qc/);
  assert.equal((branch.match(/return [013];/g) ?? []).length >= 4, true);
  assert.doesNotMatch(body.slice(evaluationAt), /result\.outcome === "PASS_SUBSET"\s*\? "PASS"/);
});

test("gate-chapter binds canonical attempt state and atomic persistence explicitly", () => {
  const body = cliSource.slice(cliSource.indexOf("async function runGateChapter"), cliSource.indexOf("function escapeRegex"));
  assert.match(body, /\.\.\/state\/gate-attempts\.json/);
  assert.match(body, /runChapterGateComposite\(chapter, chapterFile, chapterFile, \{/);
  assert.match(body, /gateAttemptState,/);
  assert.match(body, /persistGateAttemptState: \(state\) => writeFileAtomic/);
});

test("quiz-judge injects existing runner through one run and unique chapter attempts", () => {
  const body = cliSource.slice(cliSource.indexOf("async function runQuizJudge"), cliSource.indexOf("async function runQcStats"));
  assert.match(body, /createCliV25Composition\(bookId, flags\)/);
  assert.equal((body.match(/\.runStore\.createRun\(/g) ?? []).length, 1);
  assert.match(body, /runner: v25\.value\.runner/);
  assert.match(body, /const modelCallCount = chapters\.reduce/);
  assert.match(body, /run: modelCallCount/);
  assert.match(body, /chapter\.quiz\?\.questions\?\.length \?\? 0/);
  assert.match(body, /const callId = String\(\+\+modelCall\)\.padStart\(3, "0"\)/);
  assert.match(body, /attemptId: `\$\{runId\}-\$\{stageId\}-q\$\{callId\}`/);
  assert.match(body, /operationId: `\$\{stageId\}-q\$\{callId\}`/);
  assert.match(body, /makeLiveAskModel\(\{\s*execution:/);
  assert.doesNotMatch(body, /makeLiveAskModel\(\)/);
  assert.match(body, /status: "COMPLETED"/);
  assert.match(body, /status: "FAILED"/);
});

test("canonical review reruns keep stable candidate-bound round identity", () => {
  const body = cliSource.slice(cliSource.indexOf("async function reviewCliV25Candidate"), cliSource.indexOf("function printHelp"));
  assert.match(body, /const runId = composition\.ids\.nextRunId\(\)/);
  assert.match(body, /const reviewId = `qc-\$\{roundId\}`/);
  assert.match(body, /reviewCanonical\(\{\s*reviewId,/);
  assert.doesNotMatch(body, /ids\.reviewId\(runId\)/);
});

test("book-autopilot keeps conductor ownership and existing author route", () => {
  const body = cliSource.slice(cliSource.indexOf("async function runBookAutopilot"), cliSource.indexOf("async function runCompileSourcePackets"));
  assert.match(body, /new Proxy\(compilerPort/);
  assert.equal((body.match(/compilerPort\.run\(request\)/g) ?? []).length, 1);
  assert.doesNotMatch(body, /compiler\.port\.run\(/);
  assert.ok(body.indexOf("const outcome = await runAutopilot") < body.indexOf("return runQcAuto"));
  assert.ok(body.indexOf("return runQcAuto") < body.indexOf("console.log(formatOutcome(outcome))"));
  assert.match(body, /outcome\.status === "ready"/);
  assert.match(body, /authorWriteOneChapter: forwardControl\.writeOneChapter/);
  assert.match(body, /forwardAutopilotControl: forwardControl/);
  assert.doesNotMatch(body, /V25 command route requires compiler architecture/);
});

const candidate: CandidateSnapshot = {
  manifest: {
    schemaVersion: "1", bookId: "cli-book", candidateId: "candidate-1", createdByRunId: "run-1",
    entries: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown", byteLength: 10 }],
    manifestDigest: "digest-1", createdAt: "2026-07-21T00:00:00.000Z",
  },
  files: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown", byteLength: 10, bytes: Buffer.from("# Chapter\n") }],
};
const review: CanonicalReviewResult = {
  schemaVersion: "1", reviewId: "review-1", candidate: { candidateId: "candidate-1", manifestDigest: "digest-1" },
  outcome: "PASS", issues: [], completedAt: "2026-07-21T00:00:01.000Z",
};

function freshSteps(outcome: "PASS" | "FAIL" | "ERROR", calls: { qc: number; finalize: number; verify: number }) {
  return {
    qcService: {
      readStatus: async () => ({ ok: false as const, error: { code: "unused", message: "unused" } }),
      runFresh: async () => {
        calls.qc += 1;
        return { ok: true as const, value: { schemaVersion: "1" as const, roundId: "round-1", candidate: review.candidate, reviewId: review.reviewId, outcome, issues: [], completedAt: "2026-07-21T00:00:02.000Z" } };
      },
      getRound: async () => ({ ok: false as const, error: { code: "unused", message: "unused" } }),
      diagnose: async () => ({ ok: false as const, error: { code: "unused", message: "unused" } }),
      repairLedger: async () => ({ ok: false as const, error: { code: "unused", message: "unused" } }),
    },
    writeLock: { run: async <T>(_bookId: string, operation: () => Promise<Result<T>>) => operation() },
    cohort: { bookId: "cli-book", legacyWriterEnabled: false, v4WriterEnabled: true, cutoverComplete: true, v4WriteObserved: false },
    roundId: "round-1", candidate, canonicalReview: review,
    finalization: { bookId: "cli-book", roundId: "round-1", candidate: review.candidate, reviewId: "review-1", publishable: true },
    evaluateCompletedChecks: () => ({ deterministic: { outcome, issues: [] }, model: { outcome: "PASS" as const, issues: [] } }),
    commitFinalization: async () => { calls.finalize += 1; return { ok: true as const, value: null }; },
    verifyFullBook: async () => { calls.verify += 1; return true; },
  };
}

test("fresh CLI decision seam calls QC and finalization exactly once on PASS", async () => {
  const calls = { qc: 0, finalize: 0, verify: 0 };
  assert.deepEqual(await driveV4FreshQc(freshSteps("PASS", calls)), { outcome: "PASS" });
  assert.deepEqual(calls, { qc: 1, finalize: 1, verify: 1 });
});

test("fresh CLI decision seam calls QC once and blocks finalization on ERROR", async () => {
  const calls = { qc: 0, finalize: 0, verify: 0 };
  assert.deepEqual(await driveV4FreshQc(freshSteps("ERROR", calls)), { outcome: "ERROR" });
  assert.deepEqual(calls, { qc: 1, finalize: 0, verify: 0 });
});

test("fresh CLI decision seam returns FAIL without canonical finalization", async () => {
  const calls = { qc: 0, finalize: 0, verify: 0 };
  assert.deepEqual(await driveV4FreshQc(freshSteps("FAIL", calls)), { outcome: "FAIL" });
  assert.deepEqual(calls, { qc: 1, finalize: 0, verify: 0 });
});
