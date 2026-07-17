/**
 * WP-E71 red-team — ATTACK 7: attempt erasure / retry choreography.
 *
 * A failed rating attempt must never be deleted, and exhausting the attempt budget
 * must record a TERMINAL instrument-fail rather than silently vanish. Two retry
 * subsystems are exercised:
 *
 *   A. chapterDiagnosticRun — retry-once per role (cap = MAX_ATTEMPTS_PER_ROLE).
 *      A role that fails every attempt is terminal `instrument-fail`; both attempt
 *      dirs survive on disk and a self-labeled INSTRUMENT_FAIL summary is persisted.
 *   B. createD7CodexWorkerDispatch — attempt-NNN dirs accumulate across dispatches
 *      (a prior FAILED attempt is never deleted); a completed attempt is RE-INGESTED
 *      on resume (ledger sessionKind "reingest") with NO new spawn — so a resume can
 *      neither erase evidence nor double-spend.
 *
 * Hermetic: injected session/ledger doubles + fake receipt harness; every write is
 * under a fresh tmp state/pipeline dir.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  MAX_ATTEMPTS_PER_ROLE,
  runChapterDiagnostic,
  type ChapterDiagnosticRunInput,
  type DiagnosticHarness,
  type UltraSessionRunner,
} from "../src/evaluation/chapterDiagnosticRun.js";
import {
  createD7CodexWorkerDispatch,
  d7CodexSessionBaseDir,
} from "../src/bakeoff/d7WorkerDispatch.js";
import { D7JudgeError, normalizeD7WorkerReturn, type D7WorkerRequest } from "../src/bakeoff/d7Judge.js";
import type { UltraSessionRequestV1, UltraSessionResultV1, UltraSessionDepsV1 } from "../src/exec/ultraSession.js";
import type { appendCallLedgerEntry } from "../src/telemetry/runCallLedger.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";

// ══════════════════════════════════════════════════════════════════════════════
// PART A — chapterDiagnosticRun cap → instrument-fail, attempts preserved
// ══════════════════════════════════════════════════════════════════════════════

function fakeProcess(script: string) {
  return { script, command: [script], cwd: "", exitCode: 0, signal: null, stdout: "", stderr: "" };
}

/** A receipt harness that only needs inspect + issue (a capping primary never
 *  reaches the seal). */
function fakeHarness(): DiagnosticHarness {
  return {
    inspectPackage: (packagePath: string) => ({
      process: fakeProcess("inspect_package.py"),
      artifact: {
        package_path: packagePath, source_hash: "a".repeat(64),
        inspection: {
          package_id: "pkg", book_id: "blind", title: "Fixture Chapter", subtitle: null,
          package_format: "chapterflow-v21-authored", schema_version_detected: "chapterflow-v21-authored",
          chapter_count: 1, word_count_estimate: 3000, component_inventory: {},
          chapter_inventory: [{ chapter_index: 1, chapter_id: null, number: 1, title: "Fixture Chapter", word_count_estimate: 3000, fields: [] }],
          inventory_complete: true, inventory_errors: [], warnings: [],
        },
        diagnostics: {},
      },
    }),
    issueWorkerReceipts: (args) => {
      mkdirSync(args.outputDir, { recursive: true });
      const mk = (role: "primary" | "verification", jobId: string, taskId: string, sessionId: string) => ({
        schema_version: "1.0.0" as const, artifact_type: "chapterflow_worker_dispatch_receipt" as const,
        issuer: "chapterflow_evaluation_orchestrator" as const, pair_id: args.pairId, issued_at_utc: "2026-07-17T00:00:00Z",
        run_id: args.runId, book_id: args.bookId, source_hash: "a".repeat(64), inventory_sha256: "b".repeat(64),
        role, job_id: jobId, worker_task_id: taskId, worker_session_id: sessionId, binding_sha256: "c".repeat(64),
      });
      const primaryDispatch = mk("primary", args.primaryJobId, args.primaryTaskId, args.primarySessionId);
      const verificationDispatch = mk("verification", args.verificationJobId, args.verificationTaskId, args.verificationSessionId);
      const primaryDispatchPath = join(args.outputDir, "primary.dispatch.json");
      const verificationDispatchPath = join(args.outputDir, "verification.dispatch.json");
      writeFileSync(primaryDispatchPath, JSON.stringify(primaryDispatch, null, 2));
      writeFileSync(verificationDispatchPath, JSON.stringify(verificationDispatch, null, 2));
      return {
        process: fakeProcess("issue_worker_receipts.py"),
        hashes: { primary_sha256: "d".repeat(64), verification_sha256: "e".repeat(64) },
        primaryDispatch, verificationDispatch, primaryDispatchPath, verificationDispatchPath,
      };
    },
    sealBlindPairReceipt: () => { throw new Error("seal must not be reached when the primary caps"); },
  };
}

/** A session runner that ALWAYS fails — the primary role exhausts its budget. */
const alwaysFail: UltraSessionRunner = async () => ({
  ok: false, model: "codex-default", effort: "ultra", sessionId: "s", manifestPath: "", manifestSha256: "0".repeat(64),
  replyPath: null, latencyMs: 1, outcome: "error", failure: "injected session failure",
});

function fixtureChapter(): ChapterV21 {
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: "nudge-ch03", number: 3, title: "Following the Herd", readingTimeMinutes: 8,
    hook: "A short arresting hook line about a group-decision moment worth reading.",
    counterintuition: "The obvious reading of the crowd is usually the wrong one.",
    tryThisNow: "List every reason behind your next group decision and mark the independent ones.",
    keyTakeaway: "Count independent reasons before you trust a unanimous show of hands.",
    breakdown: {
      fastRead: "Fast read paragraph with enough words to look like real prose content for testing here.",
      deepRead: "Deep read paragraph explaining the two-channel mechanism in a bit more depth for the reader.",
      fullRead: "Full read paragraph going into the mechanism, its limits, and a second worked case for depth.",
    },
    examples: [
      { exampleId: "ex01", title: "Example One", tags: ["case"], scenario: "Scenario text describing a concrete situation for testing with enough detail here.", whatToDo: "What-to-do guidance sentence for the reader to act on in this scenario right now.", whyItMatters: "Why-it-matters sentence explaining the stakes of the scenario for the reader clearly." },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q01", prompt: "Which answer is correct for this test question about the concept here?", choices: ["Wrong one", "Correct answer", "Wrong two"], correctIndex: 1, explanation: "Explanation describing why the correct choice is correct for this test question here.", bloomsLevel: "understand" },
      ],
    },
    reviewCards: [{ cardId: "c01", front: "Card front question text about the concept?", back: "Card back answer text explaining the concept for retrieval.", difficulty: "medium" }],
    implementationPlan: {
      coreSkill: "Core skill description spanning a couple of sentences for test realism here.",
      ifThenPlans: [{ context: "A triggering situation arises for the reader.", plan: "If the context happens, then take the specified action next." }],
      twentyFourHourChallenge: "Within 24 hours, perform the challenge action once and note the result.",
      weeklyPractice: "For one week, repeat the practice daily and record what changes over time.",
    },
    memorableLines: [{ text: "Count reasons, not hands, before you trust the crowd." }],
  } as unknown as ChapterV21;
}

function baseInput(over: Partial<ChapterDiagnosticRunInput> = {}): ChapterDiagnosticRunInput {
  return {
    label: "A", runHash: "rt7fixture", blockCode: "nudge-ch03", slot: "w1", runId: "20260717T140020Z",
    chapter: fixtureChapter(), book: { title: "Nudge", categories: ["Behavioral Economics"], tags: ["choice-architecture"] },
    stateRoot: mkdtempSync(join(tmpdir(), "cf-rt7-state-")),
    now: () => new Date("2026-07-17T14:00:20.000Z"),
    harness: fakeHarness(), sessionRunner: alwaysFail,
    ...over,
  };
}

test("attack7A: a role that fails its whole budget is terminal instrument-fail, with every attempt preserved on disk", async () => {
  const result = await runChapterDiagnostic(baseInput());

  assert.equal(result.roles.primary.terminalState, "instrument-fail");
  assert.equal(result.roles.primary.attempts.length, MAX_ATTEMPTS_PER_ROLE, "the cap is exactly MAX_ATTEMPTS_PER_ROLE");
  assert.ok(result.roles.primary.attempts.every((a) => !a.ok), "every attempt is a recorded failure");
  assert.equal(result.roles.adjudicator, null, "no adjudication once a rater caps");

  // The diagnostic is a RECORDED terminal, not an erased/absent one.
  assert.equal(result.diagnostic.terminalState, "instrument-fail");
  assert.equal(result.diagnostic.chapterDiagnostic, null);
  assert.ok((result.diagnostic.ineligibleReason ?? "").startsWith("INSTRUMENT_FAIL:"), "the terminal is recorded as INSTRUMENT_FAIL");

  // BOTH failed attempt dirs survive (never deleted → they stay in the denominator).
  for (let n = 1; n <= MAX_ATTEMPTS_PER_ROLE; n++) {
    assert.ok(existsSync(join(result.runRoot, `primary/attempt-${n}/prompt.md`)), `primary/attempt-${n} must survive`);
  }
  // The terminal is persisted + self-labeled.
  const wrapper = JSON.parse(readFileSync(join(result.runRoot, "diagnostic.summary.json"), "utf8"));
  assert.equal(wrapper.not_a_book_score, true);
  assert.ok(wrapper.summary_line.includes("INSTRUMENT_FAIL"));
});

// ══════════════════════════════════════════════════════════════════════════════
// PART B — d7 codex dispatch: attempt dirs accumulate; resume re-ingests (no spend)
// ══════════════════════════════════════════════════════════════════════════════

type LedgerCall = Parameters<typeof appendCallLedgerEntry>[0];

function d7Req(): D7WorkerRequest {
  return { auditId: "aud1", bookId: "zz-rt7-book", label: "A", unit: "zz-rt7-book-ch01", role: "primary", kind: "candidate", task: "Rate this chapter." };
}

test("attack7B: prior FAILED attempt dirs survive across retries; a resume re-ingests (no new spawn, no double-spend)", async () => {
  const pipelineDir = mkdtempSync(join(tmpdir(), "cf-rt7-pipe-"));
  const ledger: LedgerCall[] = [];
  const appendLedger = ((args: LedgerCall) => { ledger.push(args); return {} as never; }) as typeof appendCallLedgerEntry;

  let spawnCount = 0;
  const runUltra = async (req: UltraSessionRequestV1, _deps?: UltraSessionDepsV1): Promise<UltraSessionResultV1> => {
    void _deps;
    spawnCount += 1;
    if (spawnCount < 3) {
      // attempts 1 & 2 fail (session returns not-ok — never a throw).
      return { ok: false, model: "gpt-5.6-sol", effort: "ultra", sessionId: `s${spawnCount}`, manifestPath: "", manifestSha256: "0".repeat(64), replyPath: null, latencyMs: 5, outcome: "infrastructure_failure", failure: "injected fail" };
    }
    // attempt 3 succeeds: write a JSON reply the dispatch will persist.
    const replyPath = join(req.cwd, "reply.txt");
    writeFileSync(replyPath, 'noise before {"chapter_diagnostic_score": 88} noise after');
    return { ok: true, model: "gpt-5.6-sol", effort: "ultra", sessionId: "s3", manifestPath: "/tmp/m", manifestSha256: "a".repeat(64), replyPath, latencyMs: 9, outcome: "content_completed" };
  };

  const dispatch = createD7CodexWorkerDispatch({ runUltra, pipelineDir, appendLedger, clock: () => new Date("2026-07-17T00:00:00.000Z") });
  const req = d7Req();
  const baseDir = d7CodexSessionBaseDir(pipelineDir, req);

  // Dispatch 1 & 2 fail → each throws INELIGIBLE, but leaves its attempt dir behind.
  await assert.rejects(() => dispatch(req), D7JudgeError);
  await assert.rejects(() => dispatch(req), D7JudgeError);
  assert.ok(existsSync(join(baseDir, "attempt-001", "task.md")), "attempt-001 survives");
  assert.ok(existsSync(join(baseDir, "attempt-002", "task.md")), "attempt-002 survives (the earlier failure was NOT erased)");

  // Dispatch 3 succeeds → attempt-003 persists a completion marker + record.
  // WP-E23 route proof (rt FINDING A leg 1): the dispatch now hands back the record
  // WITH its observed metadata envelope — normalize to compare the record bytes and
  // assert the real family model/effort + envelope-manifest sha ride alongside.
  const dispatch3 = normalizeD7WorkerReturn(await dispatch(req));
  const record3 = dispatch3.record;
  assert.equal(record3, '{"chapter_diagnostic_score": 88}', "the transport-trimmed record is returned");
  assert.equal(dispatch3.dispatchMeta?.model, "gpt-5.6-sol", "the record carries the REAL observed model, never null");
  assert.equal(dispatch3.dispatchMeta?.effort, "ultra");
  assert.equal(dispatch3.dispatchMeta?.sessionKind, "session");
  assert.equal(dispatch3.dispatchMeta?.attemptIndex, 3);
  assert.equal(dispatch3.dispatchMeta?.manifestSha256, "a".repeat(64), "the ultra-session manifest sha rides for the adjudicator custody sidecar");
  assert.ok(existsSync(join(baseDir, "attempt-003", "record.json")));
  assert.ok(existsSync(join(baseDir, "attempt-003", "dispatch-result.json")));
  // The two prior failed attempts are STILL on disk.
  assert.ok(existsSync(join(baseDir, "attempt-001", "task.md")) && existsSync(join(baseDir, "attempt-002", "task.md")));
  assert.equal(spawnCount, 3, "three real spawns so far");

  // Dispatch 4 (resume) → re-ingests attempt-003's exact bytes; NO fourth spawn.
  const dispatch4 = normalizeD7WorkerReturn(await dispatch(req));
  assert.equal(dispatch4.record, record3, "resume returns the SAME persisted bytes");
  assert.equal(dispatch4.dispatchMeta?.sessionKind, "reingest", "the resume envelope is a reingest, never a live session");
  assert.equal(dispatch4.dispatchMeta?.attemptIndex, 3);
  assert.equal(spawnCount, 3, "resume did NOT spawn a new session (no double-spend)");

  // Ledger provenance: 3 real 'session' entries + 1 'reingest' entry.
  const kinds = ledger.map((l) => l.sessionKind);
  assert.equal(kinds.filter((k) => k === "session").length, 3, "exactly three live sessions ledgered");
  assert.equal(kinds.filter((k) => k === "reingest").length, 1, "the resume is ledgered as a reingest, not a session");
  const reingest = ledger.find((l) => l.sessionKind === "reingest")!;
  assert.equal(reingest.outcome, "content_completed");
  assert.equal(reingest.latencyMs, null, "a reingest has no live latency");
  assert.equal(reingest.attemptIndex, 3, "the reingest points at the completed attempt");
});
