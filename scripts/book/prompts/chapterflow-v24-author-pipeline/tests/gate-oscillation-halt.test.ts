import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  runAutopilot,
  recordGateQcSignature,
  newGateQcFlipTracker,
  type AutopilotDeps,
} from "../src/orchestrator/autopilot.js";
import type { BookStatus, ChapterStatus } from "../src/lifecycle/bookStatus.js";

const PIPELINE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type TestFileSnapshot = {
  path: string;
  existed: boolean;
  bytes: Buffer | null;
  atime: Date | null;
  mtime: Date | null;
};

function snapshotTestFile(path: string): TestFileSnapshot {
  if (!existsSync(path)) return { path, existed: false, bytes: null, atime: null, mtime: null };
  const stat = statSync(path);
  return { path, existed: true, bytes: readFileSync(path), atime: stat.atime, mtime: stat.mtime };
}

function restoreTestFile(snapshot: TestFileSnapshot): void {
  if (!snapshot.existed) {
    rmSync(snapshot.path, { force: true });
    return;
  }
  mkdirSync(dirname(snapshot.path), { recursive: true });
  writeFileSync(snapshot.path, snapshot.bytes!);
  utimesSync(snapshot.path, snapshot.atime!, snapshot.mtime!);
}

async function runLegacyAutopilotWithoutFixtureLeaks(
  options: Parameters<typeof runAutopilot>[0],
): ReturnType<typeof runAutopilot> {
  const telemetryDir = resolve(PIPELINE_DIR, "state", "autopilot-logs", "zz");
  const provenanceDir = resolve(PIPELINE_DIR, "state", "provenance");
  const preflightDir = resolve(PIPELINE_DIR, "state", "qc-preflight", "zz");
  const preflightExisted = existsSync(preflightDir);
  const preflightEntries = new Set(preflightExisted ? readdirSync(preflightDir) : []);
  const parentDirs = [
    telemetryDir,
    dirname(telemetryDir),
    provenanceDir,
    preflightDir,
    dirname(preflightDir),
  ].map((path) => ({ path, existed: existsSync(path) }));
  const snapshots = [
    resolve(telemetryDir, "cost-report.json"),
    resolve(telemetryDir, "run-manifest.json"),
    resolve(provenanceDir, "zz-ch01.json"),
  ].map(snapshotTestFile);
  try {
    return await runAutopilot(options);
  } finally {
    for (const snapshot of snapshots) restoreTestFile(snapshot);
    if (existsSync(preflightDir)) {
      for (const entry of readdirSync(preflightDir)) {
        if (!preflightEntries.has(entry) && entry.endsWith(".scout-read.json")) rmSync(join(preflightDir, entry), { force: true });
      }
    }
    for (const parent of parentDirs) {
      if (!parent.existed && existsSync(parent.path) && readdirSync(parent.path).length === 0) rmSync(parent.path, { recursive: true, force: true });
    }
  }
}

// ── fixtures (mirrors tests/autopilot.test.ts's happyDeps pattern) ──────────────
function makeStatus(o: Partial<BookStatus>): BookStatus {
  return {
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [],
    ...o,
  };
}
function chap(n: number, written = true, gate = true, qc: ChapterStatus["qcVerdict"] = "NONE", fresh = false): ChapterStatus {
  return { number: n, chapterId: `zz-ch0${n}`, written, shipGatePass: gate, shipBlockers: gate ? 0 : 1, qcVerdict: qc, qcFresh: fresh };
}

function happyDeps(statuses: BookStatus[], over?: Partial<AutopilotDeps>): { deps: Partial<AutopilotDeps>; spawns: { sessionId: string }[] } {
  const spawns: { sessionId: string }[] = [];
  let si = 0;
  let n = 0;
  const deps: Partial<AutopilotDeps> = {
    statusOf: () => statuses[Math.min(si++, statuses.length - 1)],
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o);
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    listTaskCards: (_b, _r, sub) =>
      sub === "confirm" ? ["/t/confirm/ch01.md"] : ["/t/00-sweep.md", "/t/01-keyA.md", "/t/02-keyB.md", "/t/bar/ch01.md", "/t/bar/ch02.md"],
    listWriteCards: () => ["/w/ch01.md", "/w/ch02.md"],
    latestRoundId: () => "r20260101000000-abcdef",
    expectedChapterNumbers: () => [1, 2],
    readTask: () => "TASK",
    mkSessionId: (label: string) => `${label}#${++n}`,
    chapterHashes: () => ({}),
    submissionPresent: () => true,
    sweepConfirmed: () => true,
    logSession: () => {},
    logBroker: () => {},
    reviewerSkeleton: () => null,
    reviewerWorkspace: () => ({ cwd: "/tmp/cf-blind-test", inputs: [], cleanup: () => {} }),
    readReviewPacket: () => ["sweep", "keyA", "keyB", "bar", "confirm", "major"]
      .map((role) => `npx tsx src/cli.ts qc-submit zz --round r --role ${role} --token tok-${role} --file <x>`)
      .join("\n"),
    writeTempSubmission: () => "/tmp/cf-broker-test.json",
    acquireLock: () => ({ ok: true, release: () => {} }),
    log: () => {},
    ...over,
  };
  return { deps, spawns };
}

// ── recordGateQcSignature (pure) ────────────────────────────────────────────────
test("recordGateQcSignature: a blank signature is never tracked (never 'stuck')", () => {
  const tracker = newGateQcFlipTracker();
  assert.equal(recordGateQcSignature(tracker, "gate", ""), null);
  assert.equal(tracker.history.length, 0);
});

test("recordGateQcSignature: same-phase repeats (no intervening OTHER phase) never flag a flip", () => {
  const tracker = newGateQcFlipTracker();
  assert.equal(recordGateQcSignature(tracker, "gate", "S"), null);
  assert.equal(recordGateQcSignature(tracker, "gate", "S"), null, "two consecutive gate visits with the same sig is normal within-phase repetition, not a flip");
});

test("recordGateQcSignature: gate(S) -> qc(anything) -> gate(S) IS a flip", () => {
  const tracker = newGateQcFlipTracker();
  assert.equal(recordGateQcSignature(tracker, "gate", "S"), null);
  assert.equal(recordGateQcSignature(tracker, "qc", "T"), null);
  assert.equal(recordGateQcSignature(tracker, "gate", "S"), "S", "the SAME gate signature recurring with a qc visit in between is a flip");
});

test("recordGateQcSignature: gate(S) -> qc(anything) -> gate(DIFFERENT) is progress, not a flip", () => {
  const tracker = newGateQcFlipTracker();
  assert.equal(recordGateQcSignature(tracker, "gate", "S"), null);
  assert.equal(recordGateQcSignature(tracker, "qc", "T"), null);
  assert.equal(recordGateQcSignature(tracker, "gate", "S2"), null, "a different signature means the gate is making progress on a new finding");
});

// ── doGate: variety/alignment scout oscillation (A -> B -> A) ──────────────────
test("doGate HALTS with a specific oscillation message when the variety and alignment scouts keep re-triggering each other", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
  ];
  // P08: the variety scout speaks the sweep's language (a qc-sweep-submission-v1). A scout that
  // BLOCKS on every pass now FAILS CLOSED on its own budget (content halt) before alignment runs.
  // The variety/alignment OSCILLATION (A→B→A) is the DIFFERENT failure this test pins: variety's
  // edit CLEARS the templating (a clean sweep read → variety converges → alignment runs), but the
  // alignment edit reliably REINTRODUCES a templating finding on the next variety scout, and so on.
  // Variety therefore alternates REVISE→PASS so it never exhausts its own budget, and the shared
  // combined-scout budget catches the flip.
  const CF = '"scene_skeleton","persona_drift","repeated_unit","location_stamping"';
  const varietyBlock = `\`\`\`json\n{"schemaVersion":"qc-sweep-submission-v1","verdict":"REVISE","checkedFamilies":[${CF}],"findings":[{"family":"scene_skeleton","chapters":[1,2],"unitId":"examples[0].scenario","quote":"loses her voice and a substitute takes the marker under deadline","problem":"reintroduced by the alignment edit","expectedFix":"restage ch1","severity":"blocker","moveChapter":1,"instruction":"differentiate ch1"}]}\n\`\`\``;
  const varietyClean = `\`\`\`json\n{"schemaVersion":"qc-sweep-submission-v1","verdict":"PASS","checkedFamilies":[${CF}],"findings":[]}\n\`\`\``;
  let varietyCall = 0;
  const { deps, spawns } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args[0] === "qc-converge") return { code: 0, stdout: "DETERMINISTIC-CLEAN", stderr: "" }; // blockers clean from the start
      return { code: 0, stdout: "", stderr: "" };
    },
    blockingMajors: () => [],
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o);
      // Variety BLOCKS then CLEARS then BLOCKS… (its edit fixes templating; alignment's edit
      // reintroduces it). Alignment ALWAYS flags ch1. Together they oscillate A→B→A.
      if (o.sessionId.includes("pre-qc-variety-scout")) {
        const stdout = (varietyCall++ % 2 === 0) ? varietyBlock : varietyClean;
        return { ok: true, exitCode: 0, finalMessage: "done", stdout, stderr: "", durationMs: 1, sessionId: o.sessionId };
      }
      if (o.sessionId.includes("pre-qc-readiness-scout")) {
        return { ok: true, exitCode: 0, finalMessage: "done", stdout: '```json\n{"clean":false,"repairs":[{"chapter":1,"problem":"reintroduced by variety edit","instruction":"fix it"}]}\n```', stderr: "", durationMs: 1, sessionId: o.sessionId };
      }
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runLegacyAutopilotWithoutFixtureLeaks({ architecture: "legacy", bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") {
    assert.equal(outcome.phase, "gate");
    assert.equal(outcome.category, "progress");
    assert.match(outcome.reason, /pre-QC variety\/alignment oscillation/, "the halt names the SPECIFIC oscillation, not the generic loop-iteration-cap message");
  }
  // Bounded: the dedicated combined-scout budget (PREQC_MAX_VARIETY_PASSES + PREQC_MAX_ALIGNMENT_PASSES = 4)
  // catches this well before the doGate loop's own maxGateIterations budget (maxRepair(4) + 2 + 2 + 4 = 12).
  // A convergence iteration now runs BOTH scouts (variety clean → alignment), so allow up to 8.
  const scoutSpawns = spawns.filter((s) => s.sessionId.startsWith("pre-qc-variety-scout") || s.sessionId.startsWith("pre-qc-readiness-scout"));
  assert.ok(scoutSpawns.length <= 8, `expected the oscillation halt well before the generic 12-iteration cap; saw ${scoutSpawns.length} scout passes`);
});

// ── gate <-> QC finding-signature flip (deterministic blocker reintroduced by a QC repair) ──
test("autopilot HALTS with a specific gate/QC flip message when a QC repair reintroduces the SAME deterministic blocker a prior gate visit already fixed", async () => {
  const BLOCKER_STDOUT = "ch01: AS5.chapter_quiz_prompt_matches_prior — dup finding";
  const statuses = [
    // 1) gate: deterministic blocker present.
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    // 2) qc: gate "fixed" the blocker and advanced (deterministicClean defaults true).
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    // 3) gate again: the QC repair reintroduced the identical blocker.
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
  ];
  let convergeCalls = 0;
  let finalizeCalls = 0;
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) return finalizeCalls++ === 0 ? { code: 1, stdout: "REVISE", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" };
      if (args[0] === "qc-diagnose") return { code: 0, stdout: "ch02: some-other-qc-finding", stderr: "" };
      if (args[0] === "qc-converge") {
        convergeCalls++;
        // Call 1 (gate visit 1, first attempt) and call 4 (gate visit 2, first attempt) surface
        // the IDENTICAL deterministic blocker; the repair converge in between reports CLEAN.
        if (convergeCalls === 1 || convergeCalls === 4) return { code: 1, stdout: BLOCKER_STDOUT, stderr: "" };
        return { code: 0, stdout: "DETERMINISTIC-CLEAN", stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    },
    blockingMajors: () => [],
    majorFindingKeys: () => new Set(),
  });
  const outcome = await runAutopilot({ architecture: "compiler", bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") {
    assert.equal(outcome.phase, "gate");
    assert.equal(outcome.category, "progress");
    assert.match(outcome.reason, /gate\/QC flip on/, "the halt names the SPECIFIC gate/QC flip, not the generic 40-iteration backstop");
    assert.match(outcome.reason, /AS5\.chapter_quiz_prompt_matches_prior/, "the halt names the recurring finding signature");
  }
});
