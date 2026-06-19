import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  decidePhase,
  parseRoundId,
  chapterNumberFromCard,
  noProgress,
  findingSignatures,
  runAutopilot,
  type AutopilotDeps,
} from "../src/orchestrator/autopilot.js";
import type { BookStatus, ChapterStatus } from "../src/lifecycle/bookStatus.js";

// ── fixtures ─────────────────────────────────────────────────────────────────
function makeStatus(o: Partial<BookStatus>): BookStatus {
  return {
    bookId: "zz", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [],
    ...o,
  };
}
function chap(n: number, written = true, gate = true, qc: ChapterStatus["qcVerdict"] = "NONE", fresh = false): ChapterStatus {
  return { number: n, chapterId: `zz-ch0${n}`, written, shipGatePass: gate, shipBlockers: gate ? 0 : 1, qcVerdict: qc, qcFresh: fresh };
}

/** Happy stub deps: research→write→qc→ready all pass; records spawns + verbs. */
function happyDeps(statuses: BookStatus[], over?: Partial<AutopilotDeps>): { deps: Partial<AutopilotDeps>; spawns: { sessionId: string }[]; verbs: string[][] } {
  const spawns: { sessionId: string }[] = [];
  const verbs: string[][] = [];
  let si = 0;
  let n = 0;
  const deps: Partial<AutopilotDeps> = {
    statusOf: () => statuses[Math.min(si++, statuses.length - 1)],
    runVerb: async (args) => {
      verbs.push(args);
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
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
    log: () => {},
    ...over,
  };
  return { deps, spawns, verbs };
}

// ── pure helpers ─────────────────────────────────────────────────────────────
test("decidePhase maps bookStatus to the right conductor phase", () => {
  assert.equal(decidePhase(makeStatus({ writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" })), "research");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })), "write");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 1, expectedChapters: 2 })), "write");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 1, bookGatePass: false, chapters: [chap(1), chap(2, true, false)] })), "gate");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 1 })), "qc");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2 })), "ready");
  assert.equal(decidePhase(makeStatus({ packaged: true })), "shipped");
});

test("parseRoundId / chapterNumberFromCard / stuck-detect helpers", () => {
  assert.equal(parseRoundId("note\nround: r20260619051436-4e337d\n"), "r20260619051436-4e337d");
  assert.equal(parseRoundId("nothing here"), null);
  assert.equal(chapterNumberFromCard("/repo/chapterflow-v21-authored/state/.../bar/ch03.md"), 3, "the parent 'chapterflow' must not mislead it");
  assert.equal(chapterNumberFromCard("/t/00-sweep.md"), null);
  assert.equal(noProgress(new Set(["a", "b"]), new Set(["a", "b", "c"])), true, "nothing resolved → no progress");
  assert.equal(noProgress(new Set(["a", "b"]), new Set(["b"])), false, "a resolved → progress");
  assert.equal(noProgress(new Set(), new Set(["x"])), false, "empty before is never 'stuck'");
  assert.ok(findingSignatures("ch01: REVISE; authorCheck=FAIL\nch02: shipGate=FAIL").has("ch01:REVISE; authorCheck=FAIL"));
});

// ── conductor (stubbed; no real codex / fs) ──────────────────────────────────
test("autopilot drives research→write→qc→ready, halts at ready WITHOUT publishing, distinct session ids", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" }),
    makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, spawns, verbs } = happyDeps(statuses);
  const outcome = await runAutopilot({ bookId: "zz", deps });

  assert.equal(outcome.status, "ready");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("research")), "research session spawned");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("write-ch")).length, 2, "one writer per chapter");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("qc-")), "QC reviewer sessions spawned");
  const ids = spawns.map((s) => s.sessionId);
  assert.equal(new Set(ids).size, ids.length, "every spawn gets a DISTINCT session id (independence by construction)");
  assert.ok(!verbs.some((v) => v[0] === "publish-after-qc"), "must NOT publish — halts at ready by default");
});

test("autopilot --plan takes NO action (zero spawns, zero verbs)", async () => {
  const { deps, spawns, verbs } = happyDeps([makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })]);
  const outcome = await runAutopilot({ bookId: "zz", plan: true, deps });
  assert.equal(spawns.length, 0);
  assert.equal(verbs.length, 0);
  assert.equal(outcome.status, "ready"); // plan returns a ready/no-op outcome
});

test("autopilot QC repair loop is bounded — HALTs after maxRepair REVISE rounds", async () => {
  let diag = 0;
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) return { code: 1, stdout: "REVISE", stderr: "" }; // always REVISE
      if (args[0] === "qc-diagnose") return { code: 0, stdout: `ch01: finding-${diag++}`, stderr: "" }; // DIFFERENT each time → progress, so the BOUND (not stuck) trips
      if (args[0] === "qc-converge") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const outcome = await runAutopilot({ bookId: "zz", maxRepairRounds: 2, deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") assert.match(outcome.reason, /repair rounds/);
});

test("autopilot HALTs on no-progress (same QC findings survive a repair)", async () => {
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) return { code: 1, stdout: "REVISE", stderr: "" };
      if (args[0] === "qc-diagnose") return { code: 0, stdout: "ch01: same-finding-every-time", stderr: "" }; // unchanged → stuck
      if (args[0] === "qc-converge") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const outcome = await runAutopilot({ bookId: "zz", maxRepairRounds: 3, deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") assert.match(outcome.reason, /NO progress/i);
});

test("autopilot HALTs (never auto-waives) when a major needs disposition", async () => {
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) return { code: 1, stdout: "REVISE", stderr: "" };
      if (args[0] === "qc-diagnose") return { code: 0, stdout: "majors:\n  npx tsx src/cli.ts major-disposition zz --finding f1 ...", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") assert.match(outcome.reason, /MAJOR/);
});

test("autopilot --auto-publish ships on a clean QC pass", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, verbs } = happyDeps(statuses);
  const outcome = await runAutopilot({ bookId: "zz", autoPublish: true, deps });
  assert.equal(outcome.status, "published");
  assert.ok(verbs.some((v) => v[0] === "publish-after-qc"), "auto-publish runs publish-after-qc");
});
