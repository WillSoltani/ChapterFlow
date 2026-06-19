import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
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
  mapWithConcurrency,
  extractSubmissionJson,
  parseRoundTokens,
  brokerCardTarget,
  brokerReviewer,
  spawnReviewers,
  sliceBarPackToChapter,
  roleFromCard,
  resolveDeps,
  type AutopilotDeps,
  type BrokerResult,
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
    logBroker: () => {},
    reviewerSkeleton: () => null,
    reviewerWorkspace: () => ({ cwd: "/tmp/cf-blind-test", inputs: [], cleanup: () => {} }),
    // A valid review packet: the broker parses per-role tokens from here, and the
    // conductor's token preflight refuses to spawn a wave whose role has no token.
    readReviewPacket: () => ["sweep", "keyA", "keyB", "bar", "confirm", "major"]
      .map((role) => `npx tsx src/cli.ts qc-submit zz --round r --role ${role} --token tok-${role} --file <x>`)
      .join("\n"),
    writeTempSubmission: () => "/tmp/cf-broker-test.json",
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

test("acquireBookLock release is token-checked — never deletes a SUCCESSOR's lock", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-lock-owner-"));
  const path = join(dir, "zz.lock");
  const a = acquireBookLock(dir, "zz");
  assert.equal(a.ok, true);
  // Simulate a successor that legitimately took over (different owner token) — e.g.
  // after a's lock went stale and another run stole it.
  writeFileSync(path, JSON.stringify({ pid: 4242, host: "other-host", at: new Date().toISOString(), owner: "successor-token" }));
  a.release(); // a no longer owns the file
  assert.equal(existsSync(path), true, "release must NOT delete a lock owned by someone else");
});

test("acquireBookLock time-steals a CROSS-host stale lock atomically but respects a fresh one", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-lock-stale-"));
  const path = join(dir, "zz.lock");
  // Cross-host (can't probe liveness) + heartbeat 60s silent + 1s window → stale → stolen.
  writeFileSync(path, JSON.stringify({ pid: 4242, host: "other-host", at: new Date(Date.now() - 60_000).toISOString(), owner: "ghost" }));
  const stolen = acquireBookLock(dir, "zz", 1_000);
  assert.equal(stolen.ok, true, "a cross-host lock older than the stale window is taken over");
  assert.notEqual(JSON.parse(readFileSync(path, "utf8")).owner, "ghost", "the lock now carries OUR owner token");
  stolen.release();
  // Cross-host but recent heartbeat → respected.
  writeFileSync(path, JSON.stringify({ pid: 4242, host: "other-host", at: new Date().toISOString(), owner: "live" }));
  assert.equal(acquireBookLock(dir, "zz", 1_000).ok, false, "a fresh cross-host lock is respected");
});

test("acquireBookLock never time-steals a SAME-host LIVE owner (liveness is authoritative — no double-ownership race)", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-lock-livehost-"));
  const path = join(dir, "zz.lock");
  // Same host, OUR (alive) pid, heartbeat silent for an hour, tiny window: still NOT stale —
  // a live owner blocked in a long phase must never be stolen out from under itself.
  writeFileSync(path, JSON.stringify({ pid: process.pid, host: hostname(), at: new Date(Date.now() - 3_600_000).toISOString(), owner: "busy-but-alive" }));
  assert.equal(acquireBookLock(dir, "zz", 1).ok, false, "a same-host live owner is never time-stolen, however stale its heartbeat");
});

test("acquireBookLock steals a same-host DEAD-pid lock via liveness, even when recent", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-lock-deadpid-"));
  const path = join(dir, "zz.lock");
  // Recent heartbeat but a pid that cannot exist on this host → owner is gone.
  writeFileSync(path, JSON.stringify({ pid: 2_000_000_000, host: hostname(), at: new Date().toISOString(), owner: "dead" }));
  const stolen = acquireBookLock(dir, "zz");
  assert.equal(stolen.ok, true, "a same-host dead-pid lock is stale regardless of age");
  stolen.release();
});

test("acquireBookLock refresh() detects a lost lock (stolen by a successor) and refuses to clobber it", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-lock-lost-"));
  const path = join(dir, "zz.lock");
  const a = acquireBookLock(dir, "zz");
  assert.equal(a.ok, true);
  // A successor legitimately took over (different owner token).
  writeFileSync(path, JSON.stringify({ pid: 4242, host: "other-host", at: new Date().toISOString(), owner: "successor" }));
  assert.equal(a.refresh?.(), false, "refresh detects we no longer own the lock");
  assert.equal(JSON.parse(readFileSync(path, "utf8")).owner, "successor", "refresh must NOT overwrite the successor's lock");
  a.release();
  assert.equal(JSON.parse(readFileSync(path, "utf8")).owner, "successor", "release must NOT delete the successor's lock either");
});

test("acquireBookLock refresh() heartbeat keeps the SAME owner and advances the timestamp", () => {
  const dir = mkdtempSync(join(tmpdir(), "cf-lock-hb-"));
  const path = join(dir, "zz.lock");
  const a = acquireBookLock(dir, "zz");
  assert.equal(a.ok, true);
  const before = JSON.parse(readFileSync(path, "utf8"));
  a.refresh?.();
  const after = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(after.owner, before.owner, "heartbeat must keep the same owner token (else release breaks)");
  assert.ok(Date.parse(after.at) >= Date.parse(before.at), "heartbeat advances `at`");
  a.release();
  assert.equal(existsSync(path), false, "release unlinks OUR own lock");
});

test("acquireBookLock refresh() FAILS CLOSED when it cannot persist the heartbeat", () => {
  // root bypasses dir perms, so a chmod-based write-failure can't be simulated as root.
  if (typeof process.getuid === "function" && process.getuid() === 0) return; // skip under root
  const dir = mkdtempSync(join(tmpdir(), "cf-lock-hbfail-"));
  const path = join(dir, "zz.lock");
  const a = acquireBookLock(dir, "zz");
  assert.equal(a.ok, true);
  // Make the lock DIR read-only: the existing lock file stays readable (so ownsCurrent()
  // is still true → we isolate the WRITE-failure branch, not ownership-loss), but creating
  // the `.hb-<owner>` temp file throws EACCES.
  chmodSync(dir, 0o500);
  try {
    assert.equal(a.refresh?.(), false, "a heartbeat we cannot write must report unhealthy (fail-closed), not true");
  } finally {
    chmodSync(dir, 0o700); // restore so cleanup works
  }
});

test("autopilot HALTs (infra) when another run holds the lock", async () => {
  const { deps } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    acquireLock: () => ({ ok: false, release: () => {}, heldBy: "pid 999@host since 2026-06-19T00:00:00.000Z" }),
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /could not acquire the run lock/); }
});

test("autopilot HALTs (infra) if it LOSES the run lock mid-run (heartbeat detects a steal)", async () => {
  let refreshCalls = 0;
  const { deps } = happyDeps([
    makeStatus({ writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" }), // iter 1
    makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" }),             // iter 2 (never reached)
  ], {
    acquireLock: () => ({ ok: true, release: () => {}, refresh: () => { refreshCalls++; return refreshCalls < 2; } }),
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /lost the run lock/); }
  assert.ok(refreshCalls >= 2, "heartbeat ran on each loop iteration until it reported the loss");
});

test("autopilot normalizes a codex spawn rejection into an infra halt (no unhandled rejection)", async () => {
  const { deps } = happyDeps([makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })], {
    spawn: (async () => { throw new Error("codex exec timed out after 1800000ms"); }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /unexpected failure/i); }
});

test("a codex spawn rejection is RECORDED in the durable log before it propagates", async () => {
  // Without spawnAndLog's log-then-rethrow, a timed-out/ENOENT session threw before
  // logSession ran → it left NO trace in the walk-away forensics log.
  const logged: { ok: boolean; stderr: string; sessionId: string }[] = [];
  const { deps } = happyDeps([makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })], {
    spawn: (async () => { throw new Error("codex exec timed out after 1800000ms"); }) as unknown as AutopilotDeps["spawn"],
    logSession: (_b: string, _label: string, r: { ok: boolean; stderr: string; sessionId: string }) => logged.push(r),
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt"); // still halts (rethrow preserved)
  assert.ok(logged.some((r) => r.ok === false && /timed out/.test(r.stderr)), "the rejected spawn was logged with ok:false + the error");
});

test("parallel writer fan-out WAITS for all siblings to settle before the infra halt (no orphan outlives the lock)", async () => {
  let settled = 0;
  const { deps } = happyDeps([makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })], {
    spawn: (async (o: { sessionId: string }) => {
      if (o.sessionId.startsWith("write-ch1")) throw new Error("codex spawn ENOENT"); // one sibling rejects FAST
      await new Promise((r) => setTimeout(r, 30)); // the surviving sibling resolves LATER
      settled++;
      return { ok: true, exitCode: 0, finalMessage: "", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") assert.equal(outcome.category, "infra");
  // Promise.all would have abandoned the in-flight sibling the instant write-ch1 rejected
  // (settled === 0) → the run lock would release while a workspace-write child kept going.
  assert.equal(settled, 1, "the surviving writer fully settled BEFORE the failure propagated");
});

test("mapWithConcurrency early-stops claiming new work after the first failure (but still drains in-flight)", async () => {
  // limit=1 forces serial claiming so ordering is deterministic: the single worker
  // fails item 0, then must NOT claim items 1-4.
  const started: number[] = [];
  await assert.rejects(
    mapWithConcurrency([0, 1, 2, 3, 4], 1, async (item) => {
      started.push(item);
      if (item === 0) { await new Promise((r) => setTimeout(r, 5)); throw new Error("boom"); }
      return item;
    }),
    /boom/,
  );
  assert.deepEqual(started, [0], "items 1-4 are never claimed once item 0 has failed");
});

test("mapWithConcurrency drains an already-started sibling but starts no NEW work after a failure", async () => {
  // limit=2: items 0 and 1 are both claimed on the first pass (before any failure).
  // Item 0 fails fast; the in-flight item 1 must still complete; items 2-4 never start.
  const started: number[] = [];
  let oneCompleted = false;
  await assert.rejects(
    mapWithConcurrency([0, 1, 2, 3, 4], 2, async (item) => {
      started.push(item);
      if (item === 0) { await new Promise((r) => setTimeout(r, 2)); throw new Error("boom"); }
      await new Promise((r) => setTimeout(r, 20));
      if (item === 1) oneCompleted = true;
      return item;
    }),
    /boom/,
  );
  assert.ok(started.includes(0) && started.includes(1), "the two initial workers both started");
  assert.ok(!started.includes(2) && !started.includes(3) && !started.includes(4), "no NEW work started after the failure");
  assert.ok(oneCompleted, "the in-flight sibling fully settled (drain-then-throw preserved)");
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

// ── PR2 D/C2: shared driver + submission broker ───────────────────────────────

test("broker helpers: extract submission JSON, parse round tokens, resolve card target", () => {
  assert.equal(extractSubmissionJson('analysis…\n```json\n{"verdict":"PASS"}\n```\ntrailing'), '{"verdict":"PASS"}');
  assert.equal(extractSubmissionJson("no json here at all"), null);
  assert.equal(extractSubmissionJson('prefix {"a":1} suffix'), '{"a":1}');
  const packet = [
    "CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-submit zz --round r1 --role sweep --token SWEEPTOK --file <sweep.json>",
    "CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-submit zz --round r1 --role bar --token BARTOK --file <bar.json>",
    "CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-submit zz --round r1 --role confirm --token CONFTOK --file <confirm.json>",
  ].join("\n");
  const toks = parseRoundTokens(packet);
  assert.equal(toks.sweep, "SWEEPTOK");
  assert.equal(toks.bar, "BARTOK");
  assert.equal(toks.confirm, "CONFTOK");
  assert.deepEqual(brokerCardTarget("/t/bar/ch03.md"), { role: "bar" });
  assert.deepEqual(brokerCardTarget("/t/bar-tiebreak/ch03-t2.md"), { role: "bar", variant: "t2" });
  assert.deepEqual(brokerCardTarget("/t/confirm/ch01.md"), { role: "confirm" });
  assert.deepEqual(brokerCardTarget("/t/00-sweep.md"), { role: "sweep" });
});

test("broker records a read-only reviewer's JSON via qc-submit under the REVIEWER's own session id", async () => {
  const submits: Array<{ args: string[]; env?: Record<string, string> }> = [];
  let spawnSandbox = "";
  const deps = resolveDeps({
    mkSessionId: (label) => `${label}#1`,
    readTask: () => "review this card",
    logSession: () => {},
    log: () => {},
    writeTempSubmission: () => "/tmp/sub.json",
    spawn: (async (o: { sessionId: string; sandbox?: string }) => {
      spawnSandbox = o.sandbox ?? "";
      return { ok: true, exitCode: 0, finalMessage: '```json\n{"role":"bar","verdict":"GREEN"}\n```', stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    runVerb: async (args, env) => { if (args[0] === "qc-submit") submits.push({ args, env }); return { code: 0, stdout: "", stderr: "" }; },
  });
  await brokerReviewer("zz", "r1", "/t/bar/ch03.md", { bar: "BARTOK" }, deps);

  assert.equal(spawnSandbox, "read-only", "reviewer runs in a read-only sandbox (cannot edit chapters or write submissions)");
  assert.equal(submits.length, 1, "the brokered submission is recorded exactly once");
  const s = submits[0];
  assert.ok(s.args.includes("--role") && s.args.includes("bar"));
  assert.ok(s.args.includes("--token") && s.args.includes("BARTOK"));
  assert.ok(s.args.includes("--file") && s.args.includes("/tmp/sub.json"));
  assert.equal(s.env?.CHAPTERFLOW_SESSION_ID, "qc-bar-ch03#1", "qc-submit runs under the REVIEWER's distinct session id (independence preserved), not the conductor's");
});

test("broker skips qc-submit when the reviewer emits no parseable JSON (no forged submission)", async () => {
  const submits: string[][] = [];
  const deps = resolveDeps({
    mkSessionId: (label) => `${label}#1`,
    readTask: () => "card", logSession: () => {}, log: () => {},
    spawn: (async (o: { sessionId: string }) => ({ ok: true, exitCode: 0, finalMessage: "I could not complete the review.", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId })) as unknown as AutopilotDeps["spawn"],
    runVerb: async (args) => { if (args[0] === "qc-submit") submits.push(args); return { code: 0, stdout: "", stderr: "" }; },
  });
  await brokerReviewer("zz", "r1", "/t/bar/ch03.md", { bar: "BARTOK" }, deps);
  assert.equal(submits.length, 0, "no JSON ⇒ no submission recorded (the round surfaces this as INCOMPLETE)");
});

test("broker extracts a MULTILINE fenced submission through the REAL spawnCodexAgent (regression: finalMessage is only the last line)", async () => {
  // The representative path: route deps.spawn through the ACTUAL spawnCodexAgent (with an
  // injected runner) so its lastNonEmptyLine transform runs. A normal fenced ```json block
  // is multiline ⇒ finalMessage is just the closing ``` ⇒ `finalMessage || stdout` would
  // extract nothing. The fix extracts from FULL stdout first. (The older broker tests stub
  // deps.spawn and bypass this transform — that's exactly why the bug slipped through.)
  const multiline = 'Here is my review of the chapter.\n```json\n{\n  "role": "bar",\n  "verdict": "GREEN",\n  "axes": []\n}\n```\n';
  const submits: Array<{ args: string[]; env?: Record<string, string> }> = [];
  const deps = resolveDeps({
    mkSessionId: (label) => `${label}#1`,
    readTask: () => "review this card", logSession: () => {}, log: () => {},
    writeTempSubmission: () => "/tmp/sub.json",
    spawn: ((o: Parameters<AutopilotDeps["spawn"]>[0]) =>
      spawnCodexAgent({ ...o, runner: async () => ({ stdout: multiline, stderr: "", code: 0 }) })) as AutopilotDeps["spawn"],
    runVerb: async (args, env) => { if (args[0] === "qc-submit") submits.push({ args, env }); return { code: 0, stdout: "", stderr: "" }; },
  });
  const res = await brokerReviewer("zz", "r1", "/t/bar/ch03.md", { bar: "BARTOK" }, deps);
  assert.equal(res.agentOk, true);
  assert.equal(res.extractionOk, true, "the multiline fenced JSON was extracted from full stdout, not the closing-fence finalMessage");
  assert.equal(res.submissionOk, true, "and recorded via qc-submit");
  assert.equal(submits.length, 1, "exactly one brokered submission");
  assert.equal(submits[0].env?.CHAPTERFLOW_SESSION_ID, res.sessionId, "recorded under the reviewer's distinct session id");
});

test("broker records a MAJOR triage under the reviewer's session id and NEVER runs major-disposition (no silent waiver)", async () => {
  // M1: with the major token now in the review packet, the major reviewer can be brokered.
  // Safety: a brokered triage records FINDINGS only — a waiver (status waived_*) can never
  // take effect from a submission; only the authorized `major-disposition` command writes one.
  const verbs: string[][] = [];
  const deps = resolveDeps({
    mkSessionId: (label) => `${label}#1`,
    readTask: () => "triage majors", logSession: () => {}, log: () => {},
    writeTempSubmission: () => "/tmp/major.json",
    spawn: (async (o: { sessionId: string }) => ({ ok: true, exitCode: 0, finalMessage: "```", stdout: 'Triage.\n```json\n{\n  "role": "major",\n  "findings": [],\n  "dispositions": [{ "findingId": "qcf-1", "status": "waived_false_positive", "reason": "looks like a gold-book false positive here" }]\n}\n```\n', stderr: "", durationMs: 1, sessionId: o.sessionId })) as unknown as AutopilotDeps["spawn"],
    runVerb: async (args) => { verbs.push(args); return { code: 0, stdout: "", stderr: "" }; },
  });
  const res = await brokerReviewer("zz", "r1", "/t/majors.md", { major: "MAJTOK" }, deps);
  assert.equal(res.role, "major");
  assert.equal(res.submissionOk, true, "the major triage is recorded via qc-submit");
  const submit = verbs.find((v) => v[0] === "qc-submit");
  assert.ok(submit && submit.includes("--role") && submit.includes("major") && submit.includes("MAJTOK"), "qc-submit --role major --token MAJTOK");
  assert.ok(!verbs.some((v) => v[0] === "major-disposition"), "the broker NEVER invokes major-disposition — a reviewer can't waive a major");
});

// ── Q4: self-contained reviewer prompts ───────────────────────────────────────
function captureTaskDeps(over: Partial<AutopilotDeps>): { deps: AutopilotDeps; taskOf: () => string } {
  let task = "";
  const deps = resolveDeps({
    mkSessionId: (l) => `${l}#1`,
    readTask: () => "CARD-TEXT",
    logSession: () => {}, log: () => {},
    reviewerSkeleton: () => '{"schemaVersion":"qc-bar-read-v2","reviewer":"codex-qc:r1:bar:ch03"}',
    reviewerWorkspace: () => ({ cwd: "/tmp/cf-blind/zz", inputs: ["bar-pack.json"], cleanup: () => {} }),
    writeTempSubmission: () => "/tmp/sub.json",
    spawn: (async (o: { sessionId: string; task: string }) => { task = o.task; return { ok: true, exitCode: 0, finalMessage: "```", stdout: '```json\n{"role":"bar"}\n```', stderr: "", durationMs: 1, sessionId: o.sessionId }; }) as unknown as AutopilotDeps["spawn"],
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    ...over,
  });
  return { deps, taskOf: () => task };
}

test("broker prompt is SELF-CONTAINED: card text + role JSON Schema + prefilled skeleton + blind-input list", async () => {
  const { deps, taskOf } = captureTaskDeps({});
  await brokerReviewer("zz", "r1", "/t/bar/ch03.md", { bar: "BARTOK" }, deps);
  const task = taskOf();
  assert.match(task, /CARD-TEXT/, "keeps the task-card text");
  assert.match(task, /qc-bar-read-v2/, "injects the bar role's JSON Schema (schemaVersion), so the reviewer needs no packet archaeology");
  assert.match(task, /codex-qc:r1:bar:ch03/, "injects the prefilled submission skeleton");
  assert.match(task, /bar-pack\.json/, "names the blind-workspace inputs and tells the reviewer to read ONLY them");
  assert.match(task, /READ-ONLY sandbox/);
});

test("broker injects the CORRECT role schema per card (confirm / keyA / sweep / major)", async () => {
  for (const [card, tokenRole, schemaVersion] of [
    ["/t/confirm/ch02.md", "confirm", "qc-confirm-read-v1"],
    ["/t/01-keyA.md", "keyA", "qc-key-derive-v2"],
    ["/t/00-sweep.md", "sweep", "qc-sweep-submission-v1"],
    ["/t/majors.md", "major", "qc-major-triage-v1"],
  ] as const) {
    const { deps, taskOf } = captureTaskDeps({ reviewerSkeleton: () => null });
    await brokerReviewer("zz", "r1", card, { [tokenRole]: "TOK" }, deps);
    assert.match(taskOf(), new RegExp(schemaVersion), `${card} → ${schemaVersion}`);
  }
});

// ── Q5: blind reviewer workspaces ─────────────────────────────────────────────
test("broker runs the reviewer in its BLIND-workspace cwd and tears it down after (every path)", async () => {
  let spawnCwd = "";
  let cleaned = 0;
  const { deps } = captureTaskDeps({
    reviewerWorkspace: () => ({ cwd: "/tmp/cf-blind/zz/r1/sess", inputs: ["bar-pack.json"], cleanup: () => { cleaned++; } }),
    spawn: (async (o: { sessionId: string; cwd: string }) => { spawnCwd = o.cwd; return { ok: true, exitCode: 0, finalMessage: "```", stdout: '```json\n{"role":"bar"}\n```', stderr: "", durationMs: 1, sessionId: o.sessionId }; }) as unknown as AutopilotDeps["spawn"],
  });
  await brokerReviewer("zz", "r1", "/t/bar/ch03.md", { bar: "BARTOK" }, deps);
  assert.equal(spawnCwd, "/tmp/cf-blind/zz/r1/sess", "reviewer spawned in its blind workspace cwd, NOT PIPELINE_DIR");
  assert.equal(cleaned, 1, "the blind workspace is torn down after the reviewer finishes");
});

test("sliceBarPackToChapter keeps ONLY the reviewed chapter (a blind bar workspace can't leak siblings)", () => {
  const pack = JSON.stringify({
    schemaVersion: "qc-bar-pack-v1",
    rubric: "…",
    chapters: [
      { chapterNumber: 1, contentHash: "h1", chapter: { title: "one", body: "secret1" } },
      { chapterNumber: 2, contentHash: "h2", chapter: { title: "two", body: "secret2" } },
      { chapterNumber: 3, contentHash: "h3", chapter: { title: "three", body: "secret3" } },
    ],
  });
  const sliced = JSON.parse(sliceBarPackToChapter(pack, 2));
  assert.equal(sliced.chapters.length, 1, "exactly one chapter survives");
  assert.equal(sliced.chapters[0].chapterNumber, 2, "and it's the reviewed one");
  assert.equal(sliced.schemaVersion, "qc-bar-pack-v1", "non-chapter fields (rubric/meta) preserved");
  assert.ok(!sliceBarPackToChapter(pack, 2).includes("secret1") && !sliceBarPackToChapter(pack, 2).includes("secret3"), "sibling chapter CONTENT is gone");
  assert.deepEqual(JSON.parse(sliceBarPackToChapter(pack, 99)).chapters, [], "an unknown chapter slices to empty (caller falls open)");
});

test("default blind workspace falls OPEN to the pipeline dir when a role's packs are absent (never starves a reviewer)", async () => {
  let spawnCwd = "";
  // reviewerWorkspace NOT stubbed → the real default runs; with no packs on disk for this
  // book it must fall open to PIPELINE_DIR rather than hand the reviewer an empty cwd.
  const deps = resolveDeps({
    mkSessionId: (l) => `${l}#1`, readTask: () => "card", logSession: () => {}, log: () => {},
    reviewerSkeleton: () => null,
    writeTempSubmission: () => "/tmp/sub.json",
    spawn: (async (o: { sessionId: string; cwd: string }) => { spawnCwd = o.cwd; return { ok: true, exitCode: 0, finalMessage: "```", stdout: '```json\n{"role":"sweep"}\n```', stderr: "", durationMs: 1, sessionId: o.sessionId }; }) as unknown as AutopilotDeps["spawn"],
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
  });
  await brokerReviewer("zz-no-such-book", "r1", "/t/00-sweep.md", { sweep: "SW" }, deps);
  assert.ok(spawnCwd.endsWith("chapterflow-v21-authored"), "no packs on disk → cwd falls open to the pipeline dir");
});

// ── Q6b: durable broker logging ───────────────────────────────────────────────
test("a brokered wave durably logs each outcome (codex exit-0 but qc-submit REJECTED → submissionOk:false)", async () => {
  const brokerLog: BrokerResult[] = [];
  const deps = resolveDeps({
    mkSessionId: (l) => `${l}#1`, readTask: () => "card", logSession: () => {}, log: () => {},
    reviewerSkeleton: () => null,
    reviewerWorkspace: () => ({ cwd: "/tmp/cf-blind", inputs: [], cleanup: () => {} }),
    writeTempSubmission: () => "/tmp/sub.json",
    logBroker: (_b, r) => brokerLog.push(r),
    readReviewPacket: () => "npx tsx src/cli.ts qc-submit zz --round r1 --role bar --token BARTOK --file <x>",
    spawn: (async (o: { sessionId: string }) => ({ ok: true, exitCode: 0, finalMessage: "```", stdout: '```json\n{"role":"bar"}\n```', stderr: "", durationMs: 1, sessionId: o.sessionId })) as unknown as AutopilotDeps["spawn"],
    runVerb: async (args) => (args[0] === "qc-submit" ? { code: 1, stdout: "", stderr: "rejected: axis <0.6 needs a cited hit" } : { code: 0, stdout: "", stderr: "" }),
  });
  await spawnReviewers("zz", "r1", ["/t/bar/ch03.md"], 2, deps);
  assert.equal(brokerLog.length, 1, "the broker outcome was durably logged");
  assert.equal(brokerLog[0].agentOk, true, "the codex session itself succeeded");
  assert.equal(brokerLog[0].submissionOk, false, "but qc-submit REJECTED it — recorded as submissionOk:false (sessions.jsonl would look healthy)");
  assert.match(brokerLog[0].error ?? "", /rejected/);
});

test("a throwing logBroker does NOT change the wave outcome (best-effort)", async () => {
  const { deps } = captureTaskDeps({
    logBroker: () => { throw new Error("disk full"); },
    readReviewPacket: () => "npx tsx src/cli.ts qc-submit zz --round r1 --role bar --token BARTOK --file <x>",
  });
  const results = await spawnReviewers("zz", "r1", ["/t/bar/ch03.md"], 2, deps);
  assert.equal(results.length, 1, "the wave still returns its results despite a logBroker failure");
});

test("roleFromCard is variant-aware: bar-tiebreak maps to bar+variant (NOT 'unknown'), primary bar has no variant", () => {
  // D1a load-bearing: the OLD roleFromCard matched only '/bar/' so a '/bar-tiebreak/' card
  // fell through to 'unknown' → its submission was reported missing forever → the dynamic
  // loop could never converge. It must map to bar + the t2/t3 variant.
  assert.deepEqual(roleFromCard("/s/qc/zz/r1/task-cards/bar-tiebreak/ch03-t2.md"), { role: "bar", chapter: 3, variant: "t2" });
  assert.deepEqual(roleFromCard("/s/qc/zz/r1/task-cards/bar-tiebreak/ch03-t3.md"), { role: "bar", chapter: 3, variant: "t3" });
  const primary = roleFromCard("/s/qc/zz/r1/task-cards/bar/ch03.md");
  assert.equal(primary.role, "bar");
  assert.equal(primary.chapter, 3);
  assert.equal(primary.variant, undefined, "the PRIMARY bar read has no variant (so its presence check ≠ a t2 card's)");
  assert.equal(roleFromCard("/s/qc/zz/r1/task-cards/confirm/ch01.md").role, "confirm");
});
