import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, relative, resolve } from "path";

import { CHAPTER_REVIEW_SCHEMA_VERSION, type ChapterReviewV1 } from "../../src/artifacts/artifactTypes.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import {
  LEGACY_AUTHOR_STATE_CATEGORIES,
  LegacyAuthorStateAdapter,
  type LegacyAuthorStateCategory,
  type LegacyAuthorShadowProjectionPlan,
  type LegacyAuthorShadowProjectionReport,
} from "../../src/contracts/legacyAuthorStateAdapter.js";
import { writeFileAtomic } from "../../src/lib/atomicWrite.js";
import { CANONICAL_STATE } from "../../src/lib/chapterPaths.js";
import type { AutopilotDeps } from "../../src/orchestrator/autopilot.js";
import { loadNewestAcceptanceRecord } from "../../src/orchestrator/authorAcceptanceState.js";
import { parseJsonReply } from "../../src/orchestrator/authorEvidence.js";
import {
  acceptanceRecordPath,
  type AuthorAcceptanceRecord,
} from "../../src/orchestrator/authorReview.js";
import {
  appendReviewHistory,
  loadReviewHistory,
  reviewClearsPath,
  writeReviewClearsLedger,
} from "../../src/orchestrator/authorReviewLedger.js";
import {
  authorRegenLedgerPath,
  loadAuthorRegenLedger,
  recordRegenConsumed,
} from "../../src/orchestrator/authorRegenLedger.js";
import {
  doAuthorWrite,
  readLeadOverrideFromDisk,
  writeLeadOverrideToDisk,
  type AuthorWriteOneResult,
  type PreparedAuthorCandidate,
} from "../../src/orchestrator/authorRun.js";
import {
  keyEvidenceClearsPath,
  loadKeyEvidenceClears,
  writeKeyEvidenceClearsLedger,
} from "../../src/orchestrator/keyEvidenceLedger.js";
import {
  newRunManifest,
  SessionLedger,
  writeCostReport,
  writeRunManifest,
} from "../../src/orchestrator/sessionLedger.js";
import {
  readSectionSessionRecord,
  sectionSessionSidecarPath,
  writeSectionSessionRecord,
} from "../../src/orchestrator/sectionSessionRecord.js";
import { validateSubmission } from "../../src/qc/orchestrator/schemas.js";
import type { SectionTask } from "../../src/sections/sectionTasks.js";
import type { AttemptAdmission, RunDefinition } from "../../src/run-state/runTypes.js";

function treeBytes(root: string): string[] {
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

function parseObject(bytes: Uint8Array): Record<string, unknown> {
  const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("expected object");
  return parsed as Record<string, unknown>;
}

async function main(): Promise<void> {
  const temp = mkdtempSync(join(tmpdir(), "chapterflow-v4-author-state-repair-"));
  const legacyRoot = join(temp, "legacy");
  const shadowRoot = join(temp, "shadow");
  const productionBefore = treeBytes(CANONICAL_STATE);
  const adapter = new LegacyAuthorStateAdapter({ legacyRoot, shadowRoot, disposable: true });
  const shadowBeforeCategories = treeBytes(shadowRoot);

  const exact = <T>(category: LegacyAuthorStateCategory, path: string, parser: (bytes: Uint8Array) => T): T => {
    const bytes = new Uint8Array(readFileSync(path));
    const read = adapter.readLegacy({ category, relativePath: relative(legacyRoot, path) }, parser);
    if (!read.ok) throw new Error(read.error.message);
    assert.equal(read.ok, true, `${category} adapter read`);
    assert.deepEqual(read.value.bytes, bytes, `${category} exact opaque bytes`);
    return read.value.parsed;
  };

  // LEAD_OVERRIDE — real writer + real schema-filtering reader under injected state root.
  const lead = {
    schemaVersion: "lead-thread-override-v1" as const,
    bookId: "fixture-book",
    chapterNumber: 1,
    failedLead: "Dealt Lead",
    lead: { kind: "invented" as const, name: "Fallback Lead" },
    cast: ["Mira"],
    failedLeads: ["Dealt Lead"],
    reason: "bounded fixture",
    at: "2026-07-20T10:00:00.000Z",
  };
  writeLeadOverrideToDisk(lead.bookId, lead.chapterNumber, lead, legacyRoot);
  const leadPath = resolve(legacyRoot, "books", lead.bookId, "runs", "v23-current", "briefs", "ch01.lead-override.json");
  assert.deepEqual(readLeadOverrideFromDisk(lead.bookId, 1, legacyRoot), lead);
  assert.equal(exact("LEAD_OVERRIDE", leadPath, parseObject).at, lead.at);

  // AUTHOR_ACCEPTANCE — existing path/writer encoding plus real newest timestamp/schema parser.
  const acceptanceBase = {
    schemaVersion: "author-acceptance-v1" as const,
    bookId: "fixture-book",
    bar: 84,
    beatShipped: null,
    accepted: false,
    sampledChapters: [1],
    docSha256: "a".repeat(64),
    verdict: { validCount: 3, medianComposite: 82 },
    readers: [],
  } as unknown as AuthorAcceptanceRecord;
  const older = { ...acceptanceBase, roundLabel: "round1", at: "2026-07-20T10:01:00.000Z" };
  const newer = { ...acceptanceBase, roundLabel: "round2", at: "2026-07-20T10:02:00.000Z", accepted: true };
  const foreign = { ...newer, schemaVersion: "foreign-schema", at: "2026-07-20T10:03:00.000Z" };
  const olderPath = acceptanceRecordPath(older.bookId, older.roundLabel, legacyRoot);
  const newerPath = acceptanceRecordPath(newer.bookId, newer.roundLabel, legacyRoot);
  writeFileAtomic(olderPath, `${JSON.stringify(older, null, 2)}\n`);
  writeFileAtomic(newerPath, `${JSON.stringify(newer, null, 2)}\n`);
  writeFileAtomic(acceptanceRecordPath(newer.bookId, "foreign", legacyRoot), `${JSON.stringify(foreign, null, 2)}\n`);
  assert.deepEqual(loadNewestAcceptanceRecord(newer.bookId, legacyRoot), newer, "newest valid timestamp wins; foreign schema skipped");
  assert.equal(exact("AUTHOR_ACCEPTANCE", newerPath, parseObject).at, newer.at);

  // KEY_JUDGE_EVIDENCE — actual author-evidence fenced parser + current key-derive schema validator.
  const keyRaw = {
    schemaVersion: "qc-key-derive-v2",
    bookId: "fixture-book",
    roundId: "round-fixture",
    role: "keyA",
    reviewer: "codex-qc:keyA",
    chapters: [{
      chapterNumber: 1,
      packHash: "pack-fixture",
      answers: [{
        questionIndex: 0,
        choiceIndex: 1,
        confidence: "high",
        reason: "Derived from the chapter mechanism and cited source fact.",
        sourceFactIds: ["ch01.fact.1"],
      }],
    }],
  };
  const keyReply = `reader preface\n\`\`\`json\n${JSON.stringify(keyRaw)}\n\`\`\`\n`;
  const keyPath = resolve(legacyRoot, "evidence", "keyA.reply.txt");
  writeFileAtomic(keyPath, keyReply);
  const parsedKey = exact("KEY_JUDGE_EVIDENCE", keyPath, (bytes) => {
    const parsed = parseJsonReply(Buffer.from(bytes).toString("utf8"));
    const validated = validateSubmission("fixture-book", "round-fixture", "keyA", parsed);
    if (!validated.ok) throw new Error(validated.errors.join("; "));
    return validated.submission;
  });
  assert.equal(parsedKey.schemaVersion, "qc-key-derive-v2");

  // SWEEP_EVIDENCE — distinct real reply fixture + current sweep schema validator.
  const sweepRaw = {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: "fixture-book",
    roundId: "round-fixture",
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [],
  };
  const sweepPath = resolve(legacyRoot, "evidence", "sweep.reply.txt");
  writeFileAtomic(sweepPath, `\`\`\`json\n${JSON.stringify(sweepRaw, null, 2)}\n\`\`\`\n`);
  const parsedSweep = exact("SWEEP_EVIDENCE", sweepPath, (bytes) => {
    const parsed = parseJsonReply(Buffer.from(bytes).toString("utf8"));
    const validated = validateSubmission("fixture-book", "round-fixture", "sweep", parsed);
    if (!validated.ok) throw new Error(validated.errors.join("; "));
    return validated.submission;
  });
  assert.equal(parsedSweep.schemaVersion, "qc-sweep-submission-v1");

  // REVIEW_HISTORY — actual content-keyed writer and real history schema reader.
  const review = {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: "fixture-book-ch01",
    chapterNumber: 1,
    contentHash: "c0ffee",
    reviewerSessionId: "reviewer-fixture",
    scores: {},
    composite: 80,
    ship84: false,
    pass: false,
    valid: true,
    keyCheck: { matches: 0, of: 0, disagreements: [] },
    quotes: [],
    tells: [],
    complaints: [],
    oneParagraphVerdict: "fixture review",
  } as unknown as ChapterReviewV1;
  const reviewPath = appendReviewHistory("fixture-book", review, legacyRoot);
  assert.deepEqual(loadReviewHistory("fixture-book", legacyRoot), [review]);
  assert.equal(exact("REVIEW_HISTORY", reviewPath, parseObject).schemaVersion, CHAPTER_REVIEW_SCHEMA_VERSION);

  // REVIEW_CLEARS — actual materialized-cache writer preserves schema/timestamp/result bytes.
  const clearsPath = writeReviewClearsLedger("fixture-book", legacyRoot);
  assert.equal(clearsPath, reviewClearsPath("fixture-book", legacyRoot));
  const clears = exact("REVIEW_CLEARS", clearsPath, parseObject);
  assert.equal(clears.schemaVersion, "review-clears-v1");
  assert.equal(Number.isFinite(Date.parse(String(clears.updatedAt))), true);
  assert.deepEqual(clears.clears, []);

  // REGEN_LEDGER — real v1 dual-read, then real v2 count writer on same fixture.
  const regenPath = authorRegenLedgerPath("fixture-book", legacyRoot);
  const regenV1 = {
    schemaVersion: "author-regen-ledger-v1",
    bookId: "fixture-book",
    updatedAt: "2026-07-20T10:03:00.000Z",
    consumed: { "1": 2 },
  };
  writeFileAtomic(regenPath, `${JSON.stringify(regenV1, null, 2)}\n`);
  assert.deepEqual(loadAuthorRegenLedger("fixture-book", legacyRoot).legacyConsumed, { "1": 2 });
  recordRegenConsumed("fixture-book", 1, "lineage-fixture", legacyRoot);
  const regen = loadAuthorRegenLedger("fixture-book", legacyRoot);
  assert.equal(regen.consumed["1@lineage-fixture"], 1);
  assert.deepEqual(regen.legacyConsumed, { "1": 2 });
  assert.equal(exact("REGEN_LEDGER", regenPath, parseObject).schemaVersion, "author-regen-ledger-v2");

  // KEY_EVIDENCE_CLEARS — actual writer + actual fail-soft schema reader.
  const keyClearsPath = writeKeyEvidenceClearsLedger("fixture-book", [], legacyRoot);
  assert.equal(keyClearsPath, keyEvidenceClearsPath("fixture-book", legacyRoot));
  const keyClears = loadKeyEvidenceClears("fixture-book", legacyRoot);
  assert.equal(keyClears?.schemaVersion, "key-evidence-clears-v1");
  assert.deepEqual(keyClears?.clears, []);
  assert.equal(exact("KEY_EVIDENCE_CLEARS", keyClearsPath, parseObject).schemaVersion, "key-evidence-clears-v1");

  // COST_REPORT — actual ledger builder and legacy writer.
  const ledger = new SessionLedger("fixture-book");
  const cost = ledger.build("ready");
  const fixturePipeline = resolve(legacyRoot, "pipeline-fixture");
  const costPath = writeCostReport(fixturePipeline, "fixture-book", cost);
  assert.ok(costPath);
  const parsedCost = exact("COST_REPORT", costPath!, parseObject);
  assert.equal(parsedCost.schemaVersion, "autopilot-cost-report-v1");
  assert.equal(parsedCost.invariantOk, true);

  // RUN_MANIFEST — actual constructor/writer retains current timestamp/schema rules.
  const manifest = newRunManifest({ bookId: "fixture-book", arch: "author", flags: { fixture: true } });
  const manifestPath = writeRunManifest(fixturePipeline, manifest);
  assert.ok(manifestPath);
  const parsedManifest = exact("RUN_MANIFEST", manifestPath!, parseObject);
  assert.equal(parsedManifest.schemaVersion, "autopilot-run-manifest-v1");
  assert.equal(Number.isFinite(Date.parse(String(parsedManifest.startedAt))), true);

  // SECTION_SESSION — actual writer + exported existing fail-soft parser over distinct sidecar.
  const sectionOutput = resolve(legacyRoot, "sections", "summary.json");
  mkdirSync(resolve(legacyRoot, "sections"), { recursive: true });
  writeFileSync(sectionOutput, "{}\n", "utf8");
  const sectionTask: SectionTask = {
    bookId: "fixture-book",
    chapterNumber: 1,
    chapterId: "fixture-book-ch01",
    kind: "summary-pack",
    taskPath: resolve(legacyRoot, "sections", "summary.task.md"),
    outputPath: sectionOutput,
    exists: true,
  };
  writeSectionSessionRecord(sectionTask, "section-session-fixture");
  const sectionRecord = readSectionSessionRecord(sectionTask);
  assert.equal(sectionRecord?.sectionSessionId, "section-session-fixture");
  assert.equal(Number.isFinite(Date.parse(String(sectionRecord?.recordedAt))), true);
  assert.equal(exact("SECTION_SESSION", sectionSessionSidecarPath(sectionTask), parseObject).schemaVersion, "compiler-section-session-v1");

  assert.equal(LEGACY_AUTHOR_STATE_CATEGORIES.length, 11);
  assert.deepEqual(treeBytes(shadowRoot), shadowBeforeCategories, "non-attempt legacy categories emit no shadow run/stage event");
  console.log("PASS 1/6 eleven distinct real legacy writers/parsers preserve exact bytes + current semantics");

  // Generic unsupported/missing/corrupt reads remain typed and pure.
  const legacyBeforeBlockers = treeBytes(legacyRoot);
  const unsupported = adapter.readLegacy({ category: "UNKNOWN", relativePath: "missing" }, parseObject);
  assert.equal(!unsupported.ok && unsupported.error.code, "UNSUPPORTED_CATEGORY");
  const missing = adapter.readLegacy({ category: "RUN_MANIFEST", relativePath: "missing.json" }, parseObject);
  assert.equal(!missing.ok && missing.error.code, "MISSING_RECORD");
  const corruptPath = resolve(legacyRoot, "corrupt.json");
  writeFileAtomic(corruptPath, "{bad json\n");
  const beforeCorruptRead = treeBytes(legacyRoot);
  const corrupt = adapter.readLegacy({ category: "RUN_MANIFEST", relativePath: "corrupt.json" }, parseObject);
  assert.equal(!corrupt.ok && corrupt.error.code, "CORRUPT_RECORD");
  assert.deepEqual(treeBytes(legacyRoot), beforeCorruptRead);
  assert.deepEqual(legacyBeforeBlockers, beforeCorruptRead.filter((entry) => !entry.startsWith("corrupt.json\0")));
  console.log("PASS 2/6 unsupported/missing/corrupt typed blockers; readers mutate zero bytes");

  // Real owned doAuthorWrite entrypoint: legacy callback runs first, then adapter
  // projects attempt/terminal, cancel/resume, stale, comparison, and candidate.
  const order: string[] = [];
  const reports = new Map<number, LegacyAuthorShadowProjectionReport>();
  const plans = new Map<number, LegacyAuthorShadowProjectionPlan>();
  const inventory: readonly PlannedArtifact[] = [{
    kind: "CHAPTER",
    logicalPath: "chapters/ch01.json",
    mediaType: "application/json",
  }];
  const runDefinition = (chapterNumber: number): RunDefinition => ({
    schemaVersion: "1",
    bookId: "v4-shadow-fixture",
    runId: `author-ch${chapterNumber}`,
    commandId: "author-write",
    sourceGitSha: "37f9c798d3cd7c8dddfaf5bf2b11fbb32ea89fe6",
    requiredStages: ["author"],
    requiredInventory: chapterNumber === 1 ? inventory : [],
    attemptLimits: { run: 1, byStage: { author: 1 } },
    createdAt: `2026-07-20T11:0${chapterNumber}:00.000Z`,
  });
  const admissionFor = (chapterNumber: number): AttemptAdmission => ({
    bookId: "v4-shadow-fixture",
    runId: `author-ch${chapterNumber}`,
    attemptId: `attempt-ch${chapterNumber}`,
    stageId: "author",
    operationId: `write-ch${chapterNumber}`,
    admittedAt: `2026-07-20T11:0${chapterNumber}:01.000Z`,
    staleAt: `2026-07-20T11:0${chapterNumber}:02.000Z`,
  });
  const prepared = {
    bookId: "v4-shadow-fixture",
    chapterNumber: 1,
    chapterId: "v4-shadow-fixture-ch01",
    sessionId: "legacy-session-ch01",
    bytes: "{\"chapter\":1}\n",
  } as unknown as PreparedAuthorCandidate;
  const legacyResultFor = (chapterNumber: number): AuthorWriteOneResult => chapterNumber === 1
    ? { ok: true, sessionId: "legacy-session-ch01", committed: false, pending: prepared }
    : { ok: true, sessionId: `legacy-session-ch0${chapterNumber}`, committed: true };
  const logs: string[] = [];
  const deps = {
    runVerb: async () => ({ code: 0, stdout: "PASS", stderr: "" }),
    expectedChapterNumbers: () => [1, 2, 3],
    log: (message: string) => logs.push(message),
  } as unknown as AutopilotDeps;
  const outcome = await doAuthorWrite("v4-shadow-fixture", deps, {
    maxParallel: 1,
    io: {
      chapterExists: () => false,
      loadChapters: () => [],
      nameBankOk: () => true,
      readPacket: () => null,
      readBrief: () => null,
    },
    writeOneChapter: async (_bookId, chapterNumber) => {
      order.push(`legacy-${chapterNumber}`);
      return legacyResultFor(chapterNumber);
    },
    legacyStateShadow: {
      adapter,
      planFor: ({ chapterNumber, legacyResult }) => {
        assert.deepEqual(legacyResult, legacyResultFor(chapterNumber), "legacy result reaches plan unchanged");
        const definition = runDefinition(chapterNumber);
        const admission = admissionFor(chapterNumber);
        const common = {
          definition,
          observedAt: `2026-07-20T11:0${chapterNumber}:03.000Z`,
        };
        const plan: LegacyAuthorShadowProjectionPlan = chapterNumber === 1
          ? {
              ...common,
              attempt: {
                admission,
                terminal: { outcome: "SUCCEEDED", finishedAt: `2026-07-20T11:0${chapterNumber}:02.000Z` },
              },
              candidate: {
                bookId: definition.bookId,
                candidateId: "candidate-ch01",
                createdByRunId: definition.runId,
                expectedInventory: inventory,
                files: [{ ...inventory[0]!, bytes: new Uint8Array(Buffer.from(prepared.bytes)) }],
                createdAt: "2026-07-20T11:01:02.000Z",
              },
              compare: {
                legacy: { status: "LEGACY_PENDING" },
                shadow: (report) => ({ status: report.run?.attempts[0]?.status, candidate: report.candidate?.candidateId }),
              },
            }
          : chapterNumber === 2
            ? {
                ...common,
                cancel: { reason: "fixture cancel", requestedAt: "2026-07-20T11:02:01.000Z" },
              }
            : {
                ...common,
                attempt: { admission },
                candidate: {
                  bookId: definition.bookId,
                  candidateId: "partial-shadow-failure",
                  createdByRunId: definition.runId,
                  expectedInventory: inventory,
                  files: [],
                  createdAt: "2026-07-20T11:03:02.000Z",
                },
              };
        plans.set(chapterNumber, plan);
        return plan;
      },
      report: ({ chapterNumber, report }) => {
        order.push(`shadow-${chapterNumber}`);
        reports.set(chapterNumber, report);
      },
    },
  });
  assert.equal(outcome, null, "shadow mismatch/failure cannot alter successful legacy phase result");
  assert.deepEqual(order, ["legacy-1", "shadow-1", "legacy-2", "shadow-2", "legacy-3", "shadow-3"]);
  assert.equal(reports.get(1)?.matches, false, "semantic mismatch reported");
  assert.equal(reports.get(1)?.authority, "LEGACY");
  assert.equal(reports.get(1)?.candidate?.candidateId, "candidate-ch01");
  assert.equal(reports.get(2)?.run?.status, "CANCEL_REQUESTED");
  assert.ok(reports.get(2)?.steps.some((step) => step.name === "stage.resume.cancelled" && step.ok));
  assert.equal(reports.get(3)?.run?.attempts[0]?.status, "STALE");
  assert.equal(reports.get(3)?.run?.attempts.length, 1, "stale admission consumed with zero replay");
  assert.ok(reports.get(3)?.steps.some((step) => step.name === "candidate.stage" && step.code === "INCOMPLETE_CANDIDATE"));
  assert.ok(logs.some((line) => /legacy result remains authoritative/.test(line)));
  console.log("PASS 3/6 real doAuthorWrite legacy-first wiring covers attempt/terminal/resume/cancel/stale/mismatch");

  // Durable replay/conflict rules remain core-owned and exact.
  const firstPlan = plans.get(1)!;
  const duplicateAdmission = await adapter.startShadowAttempt(firstPlan.attempt!.admission);
  assert.equal(duplicateAdmission.ok, true);
  const duplicateTerminal = await adapter.finishShadowAttempt({
    bookId: firstPlan.definition.bookId,
    runId: firstPlan.definition.runId,
    attemptId: firstPlan.attempt!.admission.attemptId,
    outcome: "SUCCEEDED",
    finishedAt: firstPlan.attempt!.terminal!.finishedAt,
  });
  assert.equal(duplicateTerminal.ok, true);
  const conflict = await adapter.finishShadowAttempt({
    bookId: firstPlan.definition.bookId,
    runId: firstPlan.definition.runId,
    attemptId: firstPlan.attempt!.admission.attemptId,
    outcome: "FAILED",
    finishedAt: "2026-07-20T11:01:03.000Z",
  });
  assert.equal(conflict.ok, false);
  const replayRead = await adapter.readShadowRun(firstPlan.definition.bookId, firstPlan.definition.runId, "2026-07-20T11:01:04.000Z");
  assert.equal(replayRead.ok && replayRead.value.attempts.length, 1);
  console.log("PASS 4/6 duplicate admission/terminal idempotent; conflicting terminal blocked");

  // Complete prepared bytes reached real CandidateStore; partial never visible.
  const opened = await adapter.openShadowCandidate({
    bookId: firstPlan.definition.bookId,
    selector: { kind: "CANDIDATE", candidateId: "candidate-ch01" },
  });
  assert.equal(opened.ok, true);
  if (opened.ok) assert.equal(Buffer.from(opened.value.files[0]!.bytes).toString("utf8"), prepared.bytes);
  const partial = await adapter.stageCompleteCandidate({
    bookId: firstPlan.definition.bookId,
    candidateId: "partial",
    createdByRunId: firstPlan.definition.runId,
    expectedInventory: inventory,
    files: [],
    createdAt: "2026-07-20T11:01:04.000Z",
  });
  assert.equal(!partial.ok && partial.error.code, "INCOMPLETE_CANDIDATE");
  const invisible = await adapter.openShadowCandidate({
    bookId: firstPlan.definition.bookId,
    selector: { kind: "CANDIDATE", candidateId: "partial" },
  });
  assert.equal(invisible.ok, false);
  console.log("PASS 5/6 prepared candidate exact inventory/bytes staged; partial remains invisible");

  // Ports cannot be redirected: adapter constructs every core port from shadowRoot.
  const outside = resolve(temp, "outside-port-probe");
  const maliciousStore = {
    createRun: async () => {
      mkdirSync(outside, { recursive: true });
      return { ok: false, error: { code: "PROBE", message: "outside" } };
    },
  };
  const rootBound = new LegacyAuthorStateAdapter({
    legacyRoot: resolve(temp, "bound-legacy"),
    shadowRoot: resolve(temp, "bound-shadow"),
    disposable: true,
    runStore: maliciousStore,
  } as unknown as ConstructorParameters<typeof LegacyAuthorStateAdapter>[0]);
  assert.equal((await rootBound.createShadowRun({ ...runDefinition(1), runId: "bound-run" })).ok, true);
  assert.deepEqual(treeBytes(outside), [], "outside injected probe never called");
  assert.ok(treeBytes(resolve(temp, "bound-shadow")).some((entry) => /run-state/.test(entry)), "shadow state bound under declared root");
  assert.throws(() => new LegacyAuthorStateAdapter({ legacyRoot: "relative", shadowRoot, disposable: true }), /absolute injected root/);
  assert.throws(() => new LegacyAuthorStateAdapter({ legacyRoot, shadowRoot: legacyRoot, disposable: true }), /must be distinct/);
  assert.deepEqual(treeBytes(CANONICAL_STATE), productionBefore, "production-root byte diff stays zero");
  console.log("PASS 6/6 ports root-bound; invalid roots rejected; production/model/process mutation zero");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
