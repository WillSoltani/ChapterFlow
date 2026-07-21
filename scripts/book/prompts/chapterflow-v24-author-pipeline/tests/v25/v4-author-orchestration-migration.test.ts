import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { LegacyAuthorStateAdapter } from "../../src/contracts/legacyAuthorStateAdapter.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import type { Result } from "../../src/contracts/v4Core.js";
import { sha256Hex } from "../../src/contracts/contractUtil.js";
import { doAuthorReview, resolveAuthorReviewIo } from "../../src/orchestrator/authorReview.js";
import type { AuthorRepairShadowOutcome } from "../../src/orchestrator/authorRepair.js";
import type { AutopilotDeps, AutopilotOutcome } from "../../src/orchestrator/autopilot.js";
import {
  projectAuthorV4Shadow,
  type AuthorV4OperationKind,
  type AuthorV4ShadowBinding,
} from "../../src/orchestrator/chapterTransaction.js";
import { LEGACY_NO_PLAN_HASH, patchValueHash } from "../../src/orchestrator/repairPatch.js";
import type { RunDefinition } from "../../src/run-state/runTypes.js";
import type { ChapterV21 } from "../../src/types.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const T0 = "2026-07-20T12:00:00.000Z";
const T1 = "2026-07-20T12:00:01.000Z";
const T2 = "2026-07-20T12:01:00.000Z";
const SOURCE_SHA = "a".repeat(64);

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function tree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let names: string[];
    try { names = readdirSync(dir).sort(); } catch { return; }
    for (const name of names) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else out.push(`${relative(root, path)}\0${readFileSync(path).toString("base64")}`);
    }
  };
  walk(root);
  return out;
}

function definition(bookId: string, runId: string, stageId: string, inventory: readonly PlannedArtifact[]): RunDefinition {
  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId: "author-shadow",
    sourceGitSha: SOURCE_SHA,
    requiredStages: [stageId],
    requiredInventory: inventory,
    attemptLimits: { run: 2, byStage: { [stageId]: 2 } },
    createdAt: T0,
  };
}

function jsonBinding<T>(input: {
  adapter: LegacyAuthorStateAdapter;
  bookId: string;
  id: string;
  kind: AuthorV4OperationKind;
  legacyFile: (legacy: T) => unknown;
  normalizeLegacy: (legacy: T) => unknown;
  parentCandidateId?: string;
  report?: AuthorV4ShadowBinding<T>["report"];
}): AuthorV4ShadowBinding<T> {
  const logicalPath = "content/outcome.json";
  const inventory = [{ kind: "SIDECAR", mediaType: "application/json", logicalPath }] as const;
  const candidateId = `${input.id}-candidate`;
  return {
    context: {
      adapter: input.adapter,
      definition: definition(input.bookId, `${input.id}-run`, `${input.id}-stage`, inventory),
      bookId: input.bookId,
      runId: `${input.id}-run`,
      stageId: `${input.id}-stage`,
      attemptId: `${input.id}-attempt`,
      operationId: input.kind === "REVIEW" ? "opaque-repair-looking-token" : `opaque-${input.id}`,
      operationKind: input.kind,
      candidateId,
      selector: { kind: "CANDIDATE", candidateId },
      admittedAt: T0,
      staleAt: T2,
      completedAt: T1,
      observedAt: T1,
      expectedInventory: inventory,
      ...(input.parentCandidateId ? { parentCandidateId: input.parentCandidateId } : {}),
    },
    files: (legacy) => [{ ...inventory[0], bytes: new TextEncoder().encode(JSON.stringify(input.legacyFile(legacy))) }],
    normalizeLegacy: input.normalizeLegacy,
    normalizeCandidate: (candidate) => JSON.parse(Buffer.from(candidate.files[0].bytes).toString("utf8")),
    ...(input.report ? { report: input.report } : {}),
  };
}

function repairChapter(): ChapterV21 {
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: "shadow-book-ch01",
    number: 1,
    title: "Repair Fixture",
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q01", prompt: "First?", choices: ["A", "B", "C"], correctIndex: 0, explanation: "One grounded explanation." },
        { questionId: "q02", prompt: "Second?", choices: ["A", "B", "C"], correctIndex: 1, explanation: "Another grounded explanation." },
      ],
    },
  } as unknown as ChapterV21;
}

function chapterReviewReply(chapter: ChapterV21, pass: boolean): string {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((factor) => [factor, pass ? 90 : 83]));
  return "```json\n" + JSON.stringify({
    quizDerivation: {
      answers: chapter.quiz.questions.map((question) => "abc"[question.correctIndex]),
      keyDisagreements: [],
      tells: [],
    },
    scores,
    ship84: pass,
    quotes: [{ quote: chapter.title, why: "fixture title is exact" }],
    complaints: pass ? [] : [{ unit: "quiz Q2", problem: "answer prompt is unclear", mustFix: true }],
    oneParagraphVerdict: pass ? "repair is clear" : "one scoped quiz defect remains",
  }) + "\n```";
}

function bookReviewReply(chapter: ChapterV21): string {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((factor) => [factor, 90]));
  return "```json\n" + JSON.stringify({
    gate_verdict: "PASS",
    book3_churn: "LOW",
    quizDerivation: {
      "1": { answers: chapter.quiz.questions.map((question) => "abc"[question.correctIndex]), keyDisagreements: [] },
    },
    scores,
    quotes: [{ quote: chapter.title, why: "fixture title is exact" }],
    oneParagraphVerdict: "repaired fixture reads consistently",
  }) + "\n```";
}

requiredTest("author orchestration migration retains review repair resume cancellation and containment assertions", async () => {
  const temp = mkdtempSync(join(tmpdir(), "cf-v4-author-orchestration-r2-"));
  const originalCwd = process.cwd();
  const forensicReviewRoot = resolve(originalCwd, "state", "reviews");
  const forensicReviewRootStat = statSync(forensicReviewRoot);
  const adapter = new LegacyAuthorStateAdapter({ legacyRoot: resolve(temp, "legacy"), shadowRoot: resolve(temp, "shadow"), disposable: true });

  let spawnCalls = 0;
  const logs: string[] = [];
  const deps = {
    spawn: async () => { spawnCalls++; throw new Error("spawn tripwire"); },
    log: (message: string) => { logs.push(message); },
  } as unknown as AutopilotDeps;
  const baseline = await doAuthorReview("shadow-book", deps, { maxParallel: 1, io: { loadChapters: () => [] } });
  let reviewReportResolve!: () => void;
  const reviewReported = new Promise<void>((resolveReported) => { reviewReportResolve = resolveReported; });
  const reviewBinding = jsonBinding<AutopilotOutcome | null>({
    adapter,
    bookId: "shadow-book",
    id: "real-review",
    kind: "REVIEW",
    legacyFile: (outcome) => ({ transition: outcome?.status ?? "CONTINUE", phase: outcome?.status === "halt" ? outcome.phase : null }),
    normalizeLegacy: (outcome) => ({ transition: outcome?.status ?? "CONTINUE", phase: outcome?.status === "halt" ? outcome.phase : null }),
    report: () => { reviewReportResolve(); },
  });
  const shadowed = await doAuthorReview("shadow-book", deps, { maxParallel: 1, io: { loadChapters: () => [] }, v4Shadow: reviewBinding });
  assert.deepEqual(shadowed, baseline, "real doAuthorReview visible transition stays byte-for-byte authoritative");
  await reviewReported;
  assert.equal(spawnCalls, 0, "review halt and its shadow execute no spawn");
  const shadowSource = readFileSync(resolve(originalCwd, "src/orchestrator/chapterTransaction.ts"), "utf8");
  assert.doesNotMatch(shadowSource, /child_process|modelGateway|processSupervisor|\.spawn\s*\(/, "shadow projector has zero process/gateway/spawn route");
  console.log("PASS 1/7 real doAuthorReview normalized transition parity; source + injected spawn tripwire prove zero shadow executor route");

  const restartBinding = jsonBinding<{ transition: string }>({
    adapter,
    bookId: "shadow-book",
    id: "restart",
    kind: "ORCHESTRATE",
    legacyFile: (value) => value,
    normalizeLegacy: (value) => value,
  });
  const first = await projectAuthorV4Shadow({ transition: "READY" }, restartBinding);
  assert.equal(first.ok, true);
  const afterFirst = tree(resolve(temp, "shadow"));
  const restart = await projectAuthorV4Shadow({ transition: "READY" }, restartBinding);
  assert.equal(restart.ok, true);
  assert.equal(restart.reused, true);
  assert.deepEqual(tree(resolve(temp, "shadow")), afterFirst, "completed stage performs no duplicate mutation");
  console.log("PASS 2/7 completed resume suppresses duplicate admission/work and reopens immutable candidate");

  const consumed = jsonBinding<{ transition: string }>({ adapter, bookId: "shadow-book", id: "consumed", kind: "ORCHESTRATE", legacyFile: (v) => v, normalizeLegacy: (v) => v });
  assert.equal((await adapter.createShadowRun(consumed.context.definition)).ok, true);
  assert.equal((await adapter.startShadowAttempt({
    bookId: consumed.context.bookId, runId: consumed.context.runId, attemptId: consumed.context.attemptId,
    stageId: consumed.context.stageId, operationId: consumed.context.operationId, admittedAt: T0, staleAt: T1,
  })).ok, true);
  assert.equal((await adapter.finishShadowAttempt({ bookId: consumed.context.bookId, runId: consumed.context.runId, attemptId: consumed.context.attemptId, outcome: "UNKNOWN", finishedAt: T1 })).ok, true);
  const consumedReport = await projectAuthorV4Shadow({ transition: "READY" }, consumed);
  assert.equal(consumedReport.ok, false);
  assert.match(consumedReport.steps.at(-1)?.message ?? "", /no automatic replay/);
  assert.equal((await adapter.openShadowCandidate({ bookId: consumed.context.bookId, selector: consumed.context.selector })).ok, false);
  console.log("PASS 3/7 uncertain attempt remains consumed and creates no candidate");

  const cancelled = jsonBinding<{ transition: string }>({ adapter, bookId: "shadow-book", id: "cancelled", kind: "ORCHESTRATE", legacyFile: (v) => v, normalizeLegacy: (v) => v });
  assert.equal((await adapter.createShadowRun(cancelled.context.definition)).ok, true);
  assert.equal((await adapter.requestShadowCancel({ bookId: cancelled.context.bookId, runId: cancelled.context.runId, reason: "fixture cancel", requestedAt: T1 })).ok, true);
  const cancelReport = await projectAuthorV4Shadow({ transition: "READY" }, cancelled);
  assert.equal(cancelReport.ok, false);
  assert.equal(cancelReport.steps.at(-1)?.code, "CANCELLED");
  assert.equal((await adapter.openShadowCandidate({ bookId: cancelled.context.bookId, selector: cancelled.context.selector })).ok, false);
  console.log("PASS 4/7 durable cancellation blocks admission and every later candidate boundary");

  const original = repairChapter();
  let canonicalBytes = JSON.stringify(original, null, 2) + "\n";
  const predecessor = jsonBinding<{ chapter: ChapterV21 }>({
    adapter, bookId: "shadow-book", id: "repair-predecessor", kind: "ORCHESTRATE",
    legacyFile: ({ chapter }) => chapter, normalizeLegacy: ({ chapter }) => chapter,
  });
  assert.equal((await projectAuthorV4Shadow({ chapter: original }, predecessor)).ok, true);
  const predecessorBefore = expectOk(await adapter.openShadowCandidate({ bookId: "shadow-book", selector: predecessor.context.selector }));
  const predecessorHex = Buffer.from(predecessorBefore.files[0].bytes).toString("hex");

  const replacement = "Second question sharpened?";
  const patch = {
    schema: "chapter-patch-v1",
    chapterId: original.chapterId,
    expectedBaseHash: sha256Hex(canonicalBytes),
    sourcePlanHash: LEGACY_NO_PLAN_HASH,
    findingIds: ["review.must-fix#0"],
    operations: [{
      path: "quiz.questions[1].prompt",
      expectedOldValueHash: patchValueHash(original.quiz.questions[1].prompt).slice(0, 16),
      replacement,
      dependencyUnitIds: [],
    }],
  };
  const repairBinding = jsonBinding<AuthorRepairShadowOutcome>({
    adapter,
    bookId: "shadow-book",
    id: "repair-successor",
    kind: "REPAIR",
    parentCandidateId: predecessor.context.candidateId,
    legacyFile: (outcome) => JSON.parse(outcome.changedChapterBytes ?? "null"),
    normalizeLegacy: (outcome) => JSON.parse(outcome.changedChapterBytes ?? "null"),
  });
  const repairReported = new Promise<void>((resolveReported) => {
    (repairBinding as { report?: AuthorV4ShadowBinding<AuthorRepairShadowOutcome>["report"] }).report = () => resolveReported();
  });
  const attemptsRoot = resolve(temp, "attempts");
  let reviewSpawnCalls = 0;
  let repairSpawnCalls = 0;
  let repairFactoryCalls = 0;
  let repairConsumed = 0;
  let loadCalls = 0;
  const repairDeps = {
    spawn: async (options: { cwd?: string; sessionId: string }) => {
      const current = JSON.parse(canonicalBytes) as ChapterV21;
      let finalMessage = "unparseable advisory adjudication";
      if (options.sessionId.includes("auto-author-repair")) {
        repairSpawnCalls++;
        if (options.cwd) writeFileSync(join(options.cwd, "patch.json"), JSON.stringify(patch, null, 2) + "\n");
        finalMessage = "done";
      } else if (options.sessionId.includes("author-review-ch")) {
        reviewSpawnCalls++;
        finalMessage = chapterReviewReply(current, options.sessionId.includes("-repair"));
      } else if (options.sessionId.includes("author-book-reader")) {
        reviewSpawnCalls++;
        finalMessage = bookReviewReply(current);
      }
      return { ok: true, exitCode: 0, finalMessage, stdout: finalMessage, stderr: "", durationMs: 1, sessionId: options.sessionId };
    },
    mkSessionId: (label: string) => `${label}-${reviewSpawnCalls + repairSpawnCalls + 1}`,
    expectedChapterNumbers: () => [],
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    logSession: () => {},
    log: (message: string) => { logs.push(message); },
  } as unknown as AutopilotDeps;
  const acceptanceReads: unknown[] = [];
  const repairIo = resolveAuthorReviewIo({
    chapterExists: () => true,
    readChapterFile: () => canonicalBytes,
    writeChapterFile: (_bookId, _chapterNumber, bytes) => { canonicalBytes = bytes; },
    removeChapterFile: () => {},
    readBriefMd: () => "# fixture\n",
    readBrief: () => null,
    readPacket: () => null,
    readSourcePlan: () => null,
    loadChapters: () => {
      loadCalls++;
      return loadCalls === 2 ? [] : [JSON.parse(canonicalBytes) as ChapterV21];
    },
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readProvenance: () => null,
    restoreProvenance: () => {},
    readLeadOverride: () => null,
    writeLeadOverride: () => {},
    removeLeadOverride: () => {},
    attemptsRoot: () => attemptsRoot,
    gateCandidate: async () => ({ code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }),
    rubricWithCandidate: async () => ({ code: 0, stdout: "ch01: PASS", stderr: "" }),
    writeReviewDoc: (_bookId, fileName, text) => {
      const path = resolve(temp, "review-docs", fileName);
      mkdirSync(resolve(temp, "review-docs"), { recursive: true });
      writeFileSync(path, text);
      return { absPath: path, relPath: path };
    },
    persistReview: () => resolve(temp, "review.json"),
    persistAcceptance: (_bookId, record) => { acceptanceReads.push(record); return resolve(temp, `acceptance-${acceptanceReads.length}.json`); },
    listAcceptanceReads: () => acceptanceReads as never[],
    acceptance: {
      openRound: () => ({ roundId: "r20260720120000-abcdef", tokens: {} }),
      writeBar: () => resolve(temp, "bar.json"),
      writeConfirm: () => resolve(temp, "confirm.json"),
      writeAttestation: () => resolve(temp, "attestation.json"),
    },
    evidence: {
      runKeyJudge: async () => ({ ok: true as const }),
      runSweep: async () => ({ ok: true as const }),
    },
    resolveBeatShipped: async () => ({ ok: true as const, composite: null, source: "none" as const }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => {},
    migrateRegenLedger: () => {},
    repairConsumedFor: () => repairConsumed,
    recordRepairConsumed: () => { repairConsumed++; },
    appendReopenNote: () => {},
    contentDeviceRepair: async () => ({ fired: false, targets: [], preserved: [], outcomes: [], preservedViolations: [], overCapDevices: [], residualOverCap: [] }),
  });
  const reviewResult = await doAuthorReview("shadow-book", repairDeps, {
    maxParallel: 1,
    io: repairIo,
    v4ShadowForRepair: () => {
      repairFactoryCalls++;
      return repairBinding;
    },
  });
  assert.equal(reviewResult, null, "real review path repairs, confirms, and completes");
  assert.equal(repairFactoryCalls, 1, "real doAuthorReview reached v4ShadowForRepair composition");
  assert.equal(repairSpawnCalls, 1, "one real legacy repair spawn");
  await repairReported;
  const predecessorAfter = expectOk(await adapter.openShadowCandidate({ bookId: "shadow-book", selector: predecessor.context.selector }));
  assert.equal(Buffer.from(predecessorAfter.files[0].bytes).toString("hex"), predecessorHex);
  const successor = expectOk(await adapter.openShadowCandidate({ bookId: "shadow-book", selector: repairBinding.context.selector }));
  assert.equal(successor.manifest.parentCandidateId, predecessor.context.candidateId);
  assert.equal(JSON.parse(Buffer.from(successor.files[0].bytes).toString("utf8")).quiz.questions[1].prompt, replacement);
  assert.ok(reviewSpawnCalls > 0, "real reader/confirm entrypoints executed with injected no-live seams");
  canonicalBytes = JSON.stringify(original, null, 2) + "\n";
  loadCalls = 0;
  repairConsumed = 0;
  acceptanceReads.length = 0;
  let throwingFactoryCalls = 0;
  const containedFactoryResult = await doAuthorReview("shadow-book", repairDeps, {
    maxParallel: 1,
    io: repairIo,
    v4ShadowForRepair: () => {
      throwingFactoryCalls++;
      throw new Error("binding factory tripwire");
    },
  });
  assert.equal(containedFactoryResult, null, "binding factory failure cannot change legacy review/repair outcome");
  assert.equal(throwingFactoryCalls, 1);
  assert.equal((JSON.parse(canonicalBytes) as ChapterV21).quiz.questions[1].prompt, replacement);
  assert.ok(logs.some((line) => /binding factory tripwire/.test(line)));
  assert.equal(repairSpawnCalls, 2, "each review run performs one legacy repair; shadows add none");
  console.log("PASS 5/7 real doAuthorReview -> doRepairOneChapter creates successor; predecessor immutable; binding failure contained; zero shadow executor");

  const overwrite = await adapter.stageCompleteCandidate({
    bookId: "shadow-book",
    candidateId: repairBinding.context.candidateId,
    parentCandidateId: predecessor.context.candidateId,
    createdByRunId: "different-run",
    expectedInventory: repairBinding.context.expectedInventory,
    files: [{ ...repairBinding.context.expectedInventory[0], bytes: new TextEncoder().encode("{}") }],
    createdAt: T2,
  });
  assert.equal(overwrite.ok, false);
  console.log("PASS 6/7 successor candidate is create-only; overwrite cannot alter staged repair bytes");

  let containedReportResolve!: () => void;
  const containedReported = new Promise<void>((resolveReported) => { containedReportResolve = resolveReported; });
  const opaqueReview = jsonBinding<{ status: string }>({
    adapter, bookId: "shadow-book", id: "opaque-kind", kind: "REVIEW",
    legacyFile: () => ({ status: "shadow" }), normalizeLegacy: (value) => value,
    report: () => { containedReportResolve(); throw new Error("report callback failure"); },
  });
  const visible = { status: "legacy" };
  const returned = await doAuthorReview("shadow-book", deps, {
    maxParallel: 1,
    io: { loadChapters: () => [] },
    v4Shadow: opaqueReview as unknown as AuthorV4ShadowBinding<AutopilotOutcome | null>,
  });
  assert.deepEqual(returned, baseline);
  await containedReported;
  assert.ok(logs.some((line) => /report exception/.test(line)));
  assert.equal(opaqueReview.context.operationKind, "REVIEW");
  assert.match(opaqueReview.context.operationId, /repair/, "opaque id deliberately resembles repair");
  assert.deepEqual(visible, { status: "legacy" });
  console.log("PASS 7/7 explicit operationKind wins over opaque operationId; mismatch/report failure cannot change legacy outcome");

  // Legacy internals still own two best-effort forensic paths without IO-root
  // seams. This unique fixture removes only bytes it created.
  rmSync(resolve(forensicReviewRoot, "shadow-book"), { recursive: true, force: true });
  utimesSync(
    forensicReviewRoot,
    forensicReviewRootStat.atimeMs / 1_000,
    forensicReviewRootStat.mtimeMs / 1_000,
  );
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
