import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  decidePhase,
  parseRoundId,
  chapterNumberFromCard,
  noProgress,
  findingSignatures,
  runAutopilot,
  conductorVerbEnv,
  acquireBookLock,
  type AutopilotDeps,
} from "../src/orchestrator/autopilot.js";
import { spawnCodexAgent } from "../src/orchestrator/codexAgent.js";
import { STRICT_ENV_VAR_NAMES } from "../src/lib/strictEnv.js";
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
    // New side-effect boundaries (PR1 hardening) — stubbed inert so the happy path
    // neither touches disk nor trips the fence/retry. Individual tests override them.
    chapterHashes: () => ({}),
    submissionPresent: () => true,
    logSession: () => {},
    acquireLock: () => ({ ok: true, release: () => {} }),
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

// ── PR1 hardening ─────────────────────────────────────────────────────────────

test("conductorVerbEnv force-sets every strict invariant (fail-closed; SESSION_ID passes through)", () => {
  // Even if a caller (or the shell) tries to DISABLE an invariant, it comes out =1 —
  // the enforcement it gates (finalize collision check, source-verify) is absence-safe.
  const env = conductorVerbEnv({
    CHAPTERFLOW_REQUIRE_SOURCE_VERIFY: "0",
    CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE: "0",
    CHAPTERFLOW_SESSION_ID: "codex-qc:reviewer-7",
  });
  for (const name of STRICT_ENV_VAR_NAMES) assert.equal(env[name], "1", `${name} must be force-set to 1 even when a caller tries to disable it`);
  assert.equal(env.CHAPTERFLOW_SESSION_ID, "codex-qc:reviewer-7", "a per-call session id (not a strict var) passes through — the PR2 broker needs this");
});

test("acquireBookLock blocks a second concurrent acquire and frees on release", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-autopilot-lock-"));
  const a = acquireBookLock(dir, "zz");
  assert.equal(a.ok, true, "first acquire succeeds");
  const b = acquireBookLock(dir, "zz");
  assert.equal(b.ok, false, "second acquire is blocked while held");
  assert.match(b.heldBy ?? "", /pid/);
  a.release();
  const c = acquireBookLock(dir, "zz");
  assert.equal(c.ok, true, "acquire succeeds again after release");
  c.release();
});

test("autopilot HALTs (infra) when another run holds the lock", async () => {
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    acquireLock: () => ({ ok: false, release: () => {}, heldBy: "pid 999@host since 2026-06-19T00:00:00.000Z" }),
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /could not acquire the run lock/); }
});

test("autopilot normalizes a codex spawn rejection into an infra halt (no unhandled rejection)", async () => {
  const { deps } = happyDeps([makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })], {
    spawn: (async () => { throw new Error("codex exec timed out after 1800000ms"); }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /unexpected failure/i); }
});

test("autopilot HALTs (infra) when --create exits nonzero (created-with-errors) — no reviewers spawned", async () => {
  const reviewerSpawns: string[] = [];
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 1, stdout: "round: r20260101000000-abcdef\nqc-orchestrate: created-with-errors", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (o: { sessionId: string }) => { if (o.sessionId.startsWith("qc-")) reviewerSpawns.push(o.sessionId); return { ok: true, exitCode: 0, finalMessage: "", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId }; }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /created-with-errors|exited 1/); }
  assert.equal(reviewerSpawns.length, 0, "must NOT spend reviewer sessions on a created-with-errors round");
});

test("autopilot HALTs (infra) when qc-converge errors (exit ≥2) — never instructs a content edit", async () => {
  let repairSpawns = 0;
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 1, bookGatePass: false, qcdChapters: 0, chapters: [chap(1), chap(2, true, false)] })], {
    runVerb: async (args) => {
      if (args[0] === "qc-converge") return { code: 2, stdout: "", stderr: "qc-converge: no chapters on disk for zz" };
      return { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (o: { sessionId: string }) => { if (o.sessionId.includes("gate-repair")) repairSpawns++; return { ok: true, exitCode: 0, finalMessage: "", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId }; }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /errored/); }
  assert.equal(repairSpawns, 0, "exit ≥2 is an infra error, not dirty content — no repair agent");
});

test("autopilot HALTs (integrity) when a reviewer mutates chapter content during a round", async () => {
  let h = 0;
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    // The fence snapshots hashes before/after the first reviewer wave; ch02 changes.
    chapterHashes: () => (h++ === 0 ? { "1": "hashA", "2": "hashB" } : { "1": "hashA", "2": "MUTATED" }),
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "integrity"); assert.match(outcome.reason, /MUTATED|read-only/); }
});

test("autopilot NARROW-retries only the missing reviewer card on INCOMPLETE, then PASSes", async () => {
  let finalizeCalls = 0;
  const reviewerSpawns: string[] = [];
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) { finalizeCalls++; return { code: finalizeCalls === 1 ? 3 : 0, stdout: "", stderr: "" }; }
      return { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (o: { sessionId: string }) => { if (o.sessionId.startsWith("qc-")) reviewerSpawns.push(o.sessionId); return { ok: true, exitCode: 0, finalMessage: "", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId }; }) as unknown as AutopilotDeps["spawn"],
    submissionPresent: (_b, _r, card) => !card.includes("ch02"), // only the bar/ch02 card is missing
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "ready", "narrow retry recovers the round → PASS → ready");
  assert.equal(finalizeCalls, 2, "finalize ran twice: initial INCOMPLETE, then after the narrow retry");
  assert.ok(reviewerSpawns.filter((s) => s.includes("bar-ch02")).length >= 2, "the ONE missing ch02 bar reviewer was re-spawned");
});

test("spawnCodexAgent force-sets strict env fail-closed (opts.env cannot disable an invariant)", async () => {
  // The codex WORKER spawn must be fail-closed too — not just the conductor's CLI
  // runner. opts.env (e.g. the PR2 broker's per-reviewer env) must never disable a
  // strict invariant; the distinct per-spawn session id is still applied last.
  let capturedEnv: Record<string, string | undefined> = {};
  await spawnCodexAgent({
    task: "review",
    sessionId: "codex-qc:reviewer-3",
    cwd: ".",
    env: { CHAPTERFLOW_NO_API_CODEX_QC: "0", CHAPTERFLOW_REQUIRE_SOURCE_VERIFY: "0", CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE: "0" },
    runner: async (a) => { capturedEnv = a.env as Record<string, string | undefined>; return { stdout: "done", stderr: "", code: 0 }; },
  });
  for (const name of STRICT_ENV_VAR_NAMES) assert.equal(capturedEnv[name], "1", `${name} must stay "1" even when opts.env tries to disable it`);
  assert.equal(capturedEnv.CHAPTERFLOW_SESSION_ID, "codex-qc:reviewer-3", "distinct per-spawn session id is applied last");
});

test("acquireBookLock fails closed (ok:false, never throws) when the lock dir can't be created", () => {
  const base = mkdtempSync(join(tmpdir(), "cf-lock-bad-"));
  const asFile = join(base, "lockdir-is-actually-a-file");
  writeFileSync(asFile, "x"); // pass a FILE path as the lockDir → mkdir/write must fail
  const r = acquireBookLock(asFile, "zz");
  assert.equal(r.ok, false, "a filesystem failure returns ok:false rather than throwing (so the conductor's finally stays reliable)");
  assert.match(r.heldBy ?? "", /write failed|lock/i);
});

test("every agent spawn is recorded via logSession (durable per-agent log wiring)", async () => {
  const logged: string[] = [];
  const statuses = [
    makeStatus({ writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" }),
    makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, spawns } = happyDeps(statuses, { logSession: (_b, label) => { logged.push(label); } });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "ready");
  assert.ok(spawns.length > 0, "the happy path spawns agents");
  assert.equal(logged.length, spawns.length, "logSession is invoked exactly once per spawn");
});
