import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join, dirname } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { evidenceMatrixPath } from "../src/qc/orchestrator/artifacts.js";
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
  summarizeRoundDrivers,
  WRITER_SELF_VERIFY,
  buildSourcePrewriteRepairTask,
  readyPublishCommand,
  type AutopilotDeps,
  type BrokerResult,
} from "../src/orchestrator/autopilot.js";
import { spawnCodexAgent } from "../src/orchestrator/codexAgent.js";
import { STRICT_ENV_VAR_NAMES } from "../src/lib/strictEnv.js";
import type { BookStatus, ChapterStatus } from "../src/lifecycle/bookStatus.js";
import { callLedgerDir, readCallLedgerEntries } from "../src/telemetry/runCallLedger.js";

type FixtureFileSnapshot = {
  path: string;
  existed: boolean;
  bytes: Buffer | null;
  atime: Date | null;
  mtime: Date | null;
};

function snapshotFixtureFile(path: string): FixtureFileSnapshot {
  if (!existsSync(path)) return { path, existed: false, bytes: null, atime: null, mtime: null };
  const stat = statSync(path);
  return { path, existed: true, bytes: readFileSync(path), atime: stat.atime, mtime: stat.mtime };
}

function restoreFixtureFile(snapshot: FixtureFileSnapshot): void {
  if (!snapshot.existed) {
    rmSync(snapshot.path, { force: true });
    return;
  }
  mkdirSync(dirname(snapshot.path), { recursive: true });
  writeFileSync(snapshot.path, snapshot.bytes!);
  utimesSync(snapshot.path, snapshot.atime!, snapshot.mtime!);
}

type FixtureDirSnapshot = { path: string; existed: boolean; entries: Set<string> };

function snapshotFixtureDir(path: string): FixtureDirSnapshot {
  if (!existsSync(path)) return { path, existed: false, entries: new Set() };
  return { path, existed: true, entries: new Set(readdirSync(path)) };
}

function restoreFixtureDir(snapshot: FixtureDirSnapshot): void {
  if (!existsSync(snapshot.path)) return;
  for (const entry of readdirSync(snapshot.path)) {
    if (!snapshot.entries.has(entry)) rmSync(join(snapshot.path, entry), { recursive: true, force: true });
  }
  if (!snapshot.existed && readdirSync(snapshot.path).length === 0) rmSync(snapshot.path, { recursive: true, force: true });
}

const MODULE_AUTOPILOT_TELEMETRY = [
  join(PIPELINE_DIR, "state", "autopilot-logs", "zz", "cost-report.json"),
  join(PIPELINE_DIR, "state", "autopilot-logs", "zz", "run-manifest.json"),
  join(PIPELINE_DIR, "state", "autopilot-logs", "your-money-or-your-life", "cost-report.json"),
  join(PIPELINE_DIR, "state", "autopilot-logs", "your-money-or-your-life", "run-manifest.json"),
  join(PIPELINE_DIR, "state", "provenance", "zz-ch01.json"),
  join(PIPELINE_DIR, "state", "provenance", "zz-ch02.json"),
  join(PIPELINE_DIR, "state", "autopilot-locks", "zz.compiler-run.lock"),
].map(snapshotFixtureFile);

const MODULE_AUTOPILOT_DIRS = [
  join(PIPELINE_DIR, "state", "qc-preflight", "zz"),
  join(PIPELINE_DIR, "logs", "exec"),
].map(snapshotFixtureDir);

// ── fixtures ─────────────────────────────────────────────────────────────────
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

/** Happy stub deps: research→write→qc→ready all pass; records spawns + verbs. */
function happyDeps(statuses: BookStatus[], over?: Partial<AutopilotDeps>): { deps: Partial<AutopilotDeps>; spawns: { sessionId: string }[]; verbs: string[][]; verbEnvs: Array<Record<string, string> | undefined> } {
  const spawns: { sessionId: string }[] = [];
  const verbs: string[][] = [];
  const verbEnvs: Array<Record<string, string> | undefined> = [];
  let si = 0;
  let n = 0;
  const deps: Partial<AutopilotDeps> = {
    statusOf: () => statuses[Math.min(si++, statuses.length - 1)],
    runVerb: async (args, env) => {
      verbs.push(args);
      verbEnvs.push(env);
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
    // Item B: the happy path treats the sweep as already corroborated (a single PASS converges).
    // The dedicated item-B test below exercises the false→true confirming-round path explicitly.
    sweepConfirmed: () => true,
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
    // A2: the happy path's research is FRESH (no restored-backup violation) — the real
    // fs check would flag the fake bookId as "no run dir". The dedicated freshness
    // tests (research-freshness.test.ts) exercise the violation paths explicitly.
    researchFreshness: () => null,
    log: () => {},
    ...over,
  };
  return { deps, spawns, verbs, verbEnvs };
}

// ── pure helpers ─────────────────────────────────────────────────────────────
test("decidePhase maps bookStatus to the right conductor phase", () => {
  assert.equal(decidePhase(makeStatus({ writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" })), "research");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })), "write");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 1, expectedChapters: 2 })), "write");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 1, bookGatePass: false, chapters: [chap(1), chap(2, true, false)] })), "gate");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 1 })), "qc");
  // H1/#6: ship-gate + book-gate clean but the FULL deterministic battery dirty (source-v2 /
  // intra-book / plan-enforcement) must route to the cheap gate-repair phase, NOT skip to qc
  // (where the round preflight would hard-halt 'infra' or waste a reviewer wave).
  assert.equal(decidePhase(makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] })), "gate");
  assert.equal(decidePhase(makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2 })), "ready");
  assert.equal(decidePhase(makeStatus({ packaged: true })), "shipped");
  // --regen (3rd arg): a published (packaged) book is NOT skipped as "shipped" — it re-runs from the top
  // WITHOUT moving the package aside (so the web registry import never dangles — the concurrent-regen fix).
  assert.notEqual(decidePhase(makeStatus({ packaged: true }), true, true), "shipped");
  assert.equal(decidePhase(makeStatus({ packaged: true, writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" }), true, true), "research");
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


test("source prewrite repair task is scoped to research artifacts and validates --prewrite before fanout", () => {
  const task = buildSourcePrewriteRepairTask(
    "i-will-teach-you-to-be-rich",
    "source-v2-gate: BLOCK (9 chapter(s), 18 blocker(s))\n  [BLOCKER SV2.realness_unsupported_entity] ch01: Real-world named examples lack supported concrete specifics: namedExamples[0] \"FICO scoring model\"",
    1,
    3,
  );
  assert.match(task, /SOURCE REPAIR subagent/);
  assert.match(task, /source-v2-gate i-will-teach-you-to-be-rich --prewrite/);
  assert.match(task, /Do NOT write or edit state\/chapters/);
  assert.match(task, /SV2\.realness_unsupported_entity/);
  assert.match(task, /summary or paraphraseNotes/);
});



test("research prompt is rooted in the current v23 pipeline, not an old v21 folder", () => {
  const prompt = readFileSync("agent-prompts/RESEARCH-CODEX-SESSION.md", "utf8");
  assert.doesNotMatch(prompt, /cd scripts\/book\/prompts\/chapterflow-v21-authored/);
  assert.match(prompt, /already running from the ChapterFlow pipeline root/);
  assert.ok(prompt.includes("state/indexes/<bookId>.json"));
});

test("research phase retries once when codex exits 0 but creates no chapter index, then halts with a bootstrap diagnosis", async () => {
  const statuses = [makeStatus({ writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" })];
  const spawns: { sessionId: string; task: string }[] = [];
  const logs: string[] = [];
  const { deps } = happyDeps(statuses, {
    expectedChapterNumbers: () => [],
    runVerb: async (args) => ({ code: 0, stdout: args[0] === "book-status" ? "phase: research-bibliography" : "=== NEXT TASK: research-bibliography ===", stderr: "" }),
    spawn: (async (o: { sessionId: string; task: string }) => {
      spawns.push(o);
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "done", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    log: (m) => logs.push(m),
  });
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "your-money-or-your-life", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") {
    assert.equal(outcome.phase, "research");
    assert.equal(outcome.category, "progress");
    assert.match(outcome.reason, /did not create the canonical chapter index/);
  }
  assert.equal(spawns.length, 2, "bounded retry: initial research + one stricter retry");
  assert.match(spawns[1].task, /PREVIOUS RESEARCH SESSION EXITED WITHOUT SATISFYING THE HANDOFF CONTRACT/);
  assert.ok(logs.some((l) => /did not create state\/indexes\/your-money-or-your-life\.json/.test(l)));
});

test("research phase advances immediately when the research session creates the chapter index", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 0, expectedChapters: null, stage: "research-bibliography" }),
    makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" }),
  ];
  let indexReady = false;
  const spawns: { sessionId: string }[] = [];
  const { deps } = happyDeps(statuses, {
    expectedChapterNumbers: () => indexReady ? [1, 2] : [],
    runVerb: async (args) => {
      if (args[0] === "source-v2-gate") return { code: 0, stdout: "PASS", stderr: "" };
      if (args[0] === "validate-sections") return { code: 2, stdout: "missing sections in test", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o);
      if (o.sessionId.startsWith("research")) indexReady = true;
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps, architecture: "compiler" });
  assert.ok(spawns.some((s) => s.sessionId.startsWith("research")), "research ran");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("research")).length, 1, "no unnecessary research retry once index exists");
  if (outcome.status === "halt") assert.equal(outcome.phase, "write", "any later halt means research handed off to compiler write");
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });

  assert.equal(outcome.status, "ready");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("research")), "research session spawned");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("write-ch")).length, 2, "one writer per chapter");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("qc-")), "QC reviewer sessions spawned");
  const ids = spawns.map((s) => s.sessionId);
  assert.equal(new Set(ids).size, ids.length, "every spawn gets a DISTINCT session id (independence by construction)");
  assert.ok(!verbs.some((v) => v[0] === "publish-after-qc"), "must NOT publish — halts at ready by default");
});

test("item B: a QC PASS that is not yet sweep-confirmed runs ONE independent confirming round (--no-sweep-carry), then advances to ready", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }), // phase = qc
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }), // phase = ready
  ];
  // sweepConfirmed is FALSE until an INDEPENDENT confirming round has actually run (keyed off the
  // real --no-sweep-carry create), then TRUE — the exact false→true path item B exists for, robust
  // to how many times the conductor consults sweepConfirmed. (happyDeps defaults it to true.)
  const h = happyDeps(statuses);
  h.deps.sweepConfirmed = () => h.verbs.some((v) => v.includes("--no-sweep-carry"));
  const { verbs } = h;
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps: h.deps });

  assert.equal(outcome.status, "ready", "it converges to ready (never halts) once the second read corroborates");
  const creates = verbs.filter((v) => v.includes("--create"));
  assert.equal(creates.length, 2, "exactly two QC rounds opened: the convergence round + ONE confirming round");
  assert.ok(!creates[0].includes("--no-sweep-carry"), "the first (convergence) round sweeps normally");
  assert.ok(creates[1].includes("--no-sweep-carry"), "the confirming round forces a FRESH sweep so the second read is independent, not a carry");
});

test("item B: if an independent sweep NEVER corroborates the PASS, the autopilot HALTS — it does not loop forever or ship", async () => {
  const statuses = [makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })];
  const { deps, verbs } = happyDeps(statuses, { sweepConfirmed: () => false }); // the stochastic sweep keeps disagreeing
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  assert.equal(outcome.status, "halt", "an uncorroboratable stochastic sweep escalates instead of shipping");
  if (outcome.status === "halt") assert.match(outcome.reason, /corroborate|confirming/i);
  assert.ok(!verbs.some((v) => v[0] === "publish-after-qc"), "never publishes on an unconfirmed sweep");
});

test("C1: first QC round is INCREMENTAL when a carryable pass exists (passes accumulate, never re-rolled)", async () => {
  const statuses = (): BookStatus[] => [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  // A carryable pass on disk → round 0 opens INCREMENTAL so the prior pass is BANKED
  // (no fresh stochastic re-roll) — the convergence fix. (attempt===0, so the flag comes
  // ONLY from anyCarryable, not from attempt>0.)
  const carry = happyDeps(statuses(), { anyCarryable: () => true });
  await runAutopilot({ architecture: "legacy", bookId: "zz", deps: carry.deps });
  const carryCreate = carry.verbs.find((v) => v.includes("--create"));
  assert.ok(carryCreate?.includes("--incremental"), "round 0 is incremental when a carryable pass exists");

  // No carryable pass → round 0 is a FULL round (every chapter re-reviewed) — unchanged behavior.
  const full = happyDeps(statuses(), { anyCarryable: () => false });
  await runAutopilot({ architecture: "legacy", bookId: "zz", deps: full.deps });
  const fullCreate = full.verbs.find((v) => v.includes("--create"));
  assert.ok(fullCreate && !fullCreate.includes("--incremental"), "round 0 is a full round when nothing is carryable");
});

test("autopilot --plan takes NO action (zero spawns, zero verbs)", async () => {
  const { deps, spawns, verbs } = happyDeps([makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })]);
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", plan: true, deps });
  assert.equal(spawns.length, 0);
  assert.equal(verbs.length, 0);
  assert.equal(outcome.status, "ready"); // plan returns a ready/no-op outcome
});

test("autopilot --plan cost preview discloses NOT METERED, never a literal $0 — the compiler route drives Codex via codex exec subprocesses that never touch cost-tracker's beginRun(), so a dollar figure here would misreport 'not measured' as 'free'", async () => {
  const logs: string[] = [];
  const { deps } = happyDeps(
    [makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })],
    { log: (m) => logs.push(m) },
  );
  const outcome = await runAutopilot({ architecture: "compiler", bookId: "zz", plan: true, deps });
  assert.equal(outcome.status, "ready");
  const out = logs.join("\n");
  assert.match(out, /cost: not metered \(Codex subscription route\)/, "the plan preview must use the canonical not-metered disclosure");
  assert.doesNotMatch(out, /\$0(\.00)?\b/, "the plan preview must never print a literal $0 figure for the unmetered compiler route");
});

test("type contract: AutopilotOptions.architecture is REQUIRED — omitting it is now a compile error, not a silent fall-back to the legacy writer (regression for the default-flip trap)", async () => {
  const logs: string[] = [];
  const { deps } = happyDeps(
    [makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })],
    { log: (m) => logs.push(m) },
  );
  // @ts-expect-error — `architecture` must be required on AutopilotOptions. If this line ever
  // compiles WITHOUT error again (e.g. someone reintroduces `architecture?:`), the @ts-expect-error
  // directive goes unused and `npm run typecheck` fails — that IS the regression signal. tsx ignores
  // types at runtime, so the call below still executes with `architecture` literally undefined,
  // proving the only thing now preventing a silent legacy route is the compiler, not a runtime default.
  const outcome = await runAutopilot({ bookId: "zz", plan: true, deps });
  assert.equal(outcome.status, "ready");
  assert.match(
    logs.join("\n"),
    /architecture: legacy whole-chapter writer/,
    "with architecture undefined at runtime there is no hidden default routing it to compiler — only the now-required type forces every real caller to choose",
  );
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", maxRepairRounds: 2, deps });
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", maxRepairRounds: 3, deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") assert.match(outcome.reason, /NO progress/i);
});

test("autopilot AUTO-REPAIRS a major instead of governance-halting (full autonomy — never asks for human disposition)", async () => {
  const { deps, spawns } = happyDeps([makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] })], {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) return { code: 1, stdout: "REVISE", stderr: "" };
      if (args[0] === "qc-diagnose") return { code: 0, stdout: "majors:\n  npx tsx src/cli.ts major-disposition zz --finding f1 ...", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  // The autopilot is fully autonomous: a major no longer forces a human-disposition
  // GOVERNANCE halt (the gate phase converges blocking majors before QC, and any that
  // surface at QC are auto-repaired in the round's fan-out). The stub never resolves, so
  // it eventually halts on progress/content — but it must spawn a repair first and never
  // categorize the halt as "governance".
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") assert.notEqual(outcome.category, "governance", "a major must not force a governance (waive-vs-fix) halt — the autopilot repairs it");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("qc-repair")), "autopilot spawns a repair session for the major rather than halting on sight");
});

test("doGate AUTO-CONVERGES a blocking major before QC (fix-before-write→QC handoff, no governance halt)", async () => {
  let majorCalls = 0;
  const statuses = [
    // deterministicClean:false routes to the GATE phase even though bookGatePass (blockers) is true.
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    // After the gate fixes the major, the book is fully gated + QC'd → ready.
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, spawns } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args[0] === "qc-converge") return { code: 0, stdout: "DETERMINISTIC-CLEAN", stderr: "" }; // blockers already clean
      return { code: 0, stdout: "", stderr: "" };
    },
    // One blocking major on the first gate check; cleared after the gate-major-repair spawns.
    blockingMajors: (() => (majorCalls++ === 0
      ? [{ id: "m1", scope: "chapter:1:tryThisNow", checkId: "BP33.tryThisNow_opener_reuse", message: "ch1 & ch2 share the try-now opener", contentHash: "h1", contentHashVersion: "chapter-content-hash-v2", findingHash: "fh1" }]
      : [])) as unknown as AutopilotDeps["blockingMajors"],
  });
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  // The major was fixed at the GATE (before QC) — the run reaches ready, never a governance halt.
  assert.equal(outcome.status, "ready");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("gate-major-repair")), "doGate spawns a gate-major-repair to converge the blocking major before QC");
});

test("doGate shards blocking majors by chapter and reruns qc-converge before rechecking majors", async () => {
  let majorCalls = 0;
  const events: string[] = [];
  const spawns: { sessionId: string; task?: string }[] = [];
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args[0] === "qc-converge") events.push("qc-converge");
      return { code: 0, stdout: args[0] === "qc-converge" ? "DETERMINISTIC-CLEAN" : "", stderr: "" };
    },
    blockingMajors: (() => {
      events.push(`majors-${majorCalls}`);
      return majorCalls++ === 0
        ? [
          { id: "m1", scope: "chapter:1:quiz.q01", checkId: "BP15.quiz_strawman_distractor", message: "ch1 has a strawman quiz distractor", contentHash: "h1", contentHashVersion: "chapter-content-hash-v2", findingHash: "fh1" },
          { id: "m2", scope: "chapter:2:quiz.q02", checkId: "C18.answer_length_telegraphed", message: "ch2 correct answer is telegraphed by length", contentHash: "h2", contentHashVersion: "chapter-content-hash-v2", findingHash: "fh2" },
          { id: "m3", scope: "book", checkId: "BP33.cross_chapter_reuse", message: "ch1 and ch2 share the same functional scene", contentHash: "hb", contentHashVersion: "chapter-content-hash-v2", findingHash: "fh3" },
        ]
        : [];
    }) as unknown as AutopilotDeps["blockingMajors"],
    spawn: (async (o: { sessionId: string; task?: string }) => {
      events.push(`spawn:${o.sessionId}`);
      spawns.push(o);
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps, architecture: "compiler", maxParallel: 6 });

  assert.equal(outcome.status, "ready");
  const majorSessions = spawns.map((s) => s.sessionId).filter((id) => id.startsWith("gate-major-repair-1-"));
  assert.equal(majorSessions.length, 3, "one wave fans out to the two chapter shards plus the book-level shard");
  assert.ok(majorSessions.some((id) => id.startsWith("gate-major-repair-1-ch01")), "ch01 shard spawned");
  assert.ok(majorSessions.some((id) => id.startsWith("gate-major-repair-1-ch02")), "ch02 shard spawned");
  assert.ok(majorSessions.some((id) => id.startsWith("gate-major-repair-1-book")), "book-level shard spawned");
  const secondMajorCheck = events.indexOf("majors-1");
  const lastShardSpawn = events.reduce((last, event, i) => event.startsWith("spawn:gate-major-repair-1-") ? i : last, -1);
  const convergeBeforeSecondMajorCheck = events.lastIndexOf("qc-converge", secondMajorCheck - 1);
  assert.ok(lastShardSpawn >= 0 && secondMajorCheck >= 0, `events: ${events.join(" -> ")}`);
  assert.ok(lastShardSpawn < convergeBeforeSecondMajorCheck, `qc-converge should rerun after the major-repair wave: ${events.join(" -> ")}`);
  assert.ok(convergeBeforeSecondMajorCheck < secondMajorCheck, `blockingMajors should be checked after qc-converge: ${events.join(" -> ")}`);
});

test("doGate counts one sharded blocking-major wave as one maxRepair attempt", async () => {
  let majorCalls = 0;
  const spawns: { sessionId: string }[] = [];
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
  ];
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => ({ code: 0, stdout: args[0] === "qc-converge" ? "DETERMINISTIC-CLEAN" : "", stderr: "" }),
    blockingMajors: (() => {
      majorCalls++;
      return [
        { id: "m1", scope: "chapter:1:quiz.q01", checkId: "BP15.quiz_strawman_distractor", message: "ch1 has a strawman quiz distractor", contentHash: "h1", contentHashVersion: "chapter-content-hash-v2", findingHash: "fh1" },
        { id: "m2", scope: "chapter:2:quiz.q02", checkId: "C18.answer_length_telegraphed", message: "ch2 correct answer is telegraphed by length", contentHash: "h2", contentHashVersion: "chapter-content-hash-v2", findingHash: "fh2" },
      ];
    }) as unknown as AutopilotDeps["blockingMajors"],
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o);
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ bookId: "zz", deps, architecture: "compiler", maxRepairRounds: 1, maxParallel: 4 });

  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") assert.match(outcome.reason, /after 1 content repair round/);
  const majorSessions = spawns.map((s) => s.sessionId).filter((id) => id.startsWith("gate-major-repair"));
  assert.equal(majorSessions.length, 2, "both chapter shards run in the single allowed wave");
  assert.ok(majorSessions.some((id) => id.startsWith("gate-major-repair-1-ch01")));
  assert.ok(majorSessions.some((id) => id.startsWith("gate-major-repair-1-ch02")));
  assert.ok(!majorSessions.some((id) => id.startsWith("gate-major-repair-2-")), "a second wave must not start once maxRepair=1 is spent");
  assert.ok(majorCalls >= 2, "the gate rechecked majors after the wave before halting");
});

// ── pre-QC cross-chapter VARIETY convergence (the first-pass-QC lever) ──────────
/** A gate-phase status (blockers clean, no majors) + a scout-aware spawn stub. The default
 *  happyDeps spawn returns empty stdout → the scout finds no brief → advances (covered by every
 *  other test); these exercise the scout/flag/de-template path explicitly. */
function varietyGateDeps(scoutStdout: (call: number) => { ok?: boolean; stdout: string }) {
  const statuses = [
    // deterministicClean:false routes to the GATE phase; qc-converge reports blockers clean below.
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  let scoutCalls = 0;
  // Our spawn override REPLACES happyDeps's recording stub, so track spawns in OUR OWN array and
  // return it (happyDeps's `spawns` would stay empty — its stub never runs once overridden).
  const spawns: { sessionId: string }[] = [];
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args[0] === "qc-converge") return { code: 0, stdout: "DETERMINISTIC-CLEAN", stderr: "" }; // blockers already clean
      return { code: 0, stdout: "", stderr: "" };
    },
    blockingMajors: () => [], // no majors → reach the variety scout
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o);
      if (o.sessionId.includes("pre-qc-variety-scout")) {
        const res = scoutStdout(scoutCalls++);
        return { ok: res.ok !== false, exitCode: res.ok === false ? 1 : 0, finalMessage: "done", stdout: res.stdout, stderr: "", durationMs: 1, sessionId: o.sessionId };
      }
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  return { deps, spawns };
}

// P08: the scout now emits a `qc-sweep-submission-v1` (the SAME schema/validator the formal
// sweep uses), with per-finding `moveChapter` + `instruction` extras driving the detemplate.
const CF = '"scene_skeleton","persona_drift","repeated_unit","location_stamping"';
const SWEEP_CLEAN = `\`\`\`json\n{"schemaVersion":"qc-sweep-submission-v1","verdict":"PASS","checkedFamilies":[${CF}],"findings":[]}\n\`\`\``;
function sweepFlag(moveChapter: number): string {
  // scene_skeleton over 2 chapters with a DISTINCTIVE (≥20-char) quote → blocks (sweepFindingBlocks).
  return `\`\`\`json\n{"schemaVersion":"qc-sweep-submission-v1","verdict":"REVISE","checkedFamilies":[${CF}],"findings":[{"family":"scene_skeleton","chapters":[1,2],"unitId":"examples[0].scenario","quote":"loses her voice and a substitute takes the marker under deadline","problem":"ch1 & ch2 share a decision-under-deadline frame","expectedFix":"restage the flagged chapter","severity":"blocker","moveChapter":${moveChapter},"instruction":"restage ch${moveChapter} onto its dealt move + a distinct venue"}]}\n\`\`\``;
}

test("doGate converges cross-chapter VARIETY before QC (sweep-unified scout flags → SURGICAL per-chapter de-template, then advance)", async () => {
  // Scout flags ch2 on its first full-book read, then reads CLEAN so the gate advances after one fix.
  const { deps, spawns } = varietyGateDeps((call) => ({ stdout: call === 0 ? sweepFlag(2) : SWEEP_CLEAN }));
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  assert.equal(outcome.status, "ready");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("pre-qc-variety-scout")), "doGate runs a full-book variety scout before QC");
  assert.ok(spawns.some((s) => /^pre-qc-variety-\d+-ch2/.test(s.sessionId)), "the brief drives a SURGICAL per-chapter de-template repair (ch2 = moveChapter)");
  assert.ok(!spawns.some((s) => /^pre-qc-variety-\d+-ch1/.test(s.sessionId)), "the KEPT chapter (ch1) is left untouched — never a multi-chapter rewrite");
});

test("doGate variety scout: a VARIED book (sweep PASS) advances to QC with zero de-template work (no FP-on-gold regression)", async () => {
  const { deps, spawns } = varietyGateDeps(() => ({ stdout: SWEEP_CLEAN }));
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  assert.equal(outcome.status, "ready");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("pre-qc-variety-scout")), "the scout still runs (one cheap full-book read)");
  assert.ok(!spawns.some((s) => /^pre-qc-variety-\d+-ch/.test(s.sessionId)), "a varied book triggers ZERO de-template repairs");
});

test("doGate variety scout FAILS CLOSED (default enforce) — persistent BLOCKING templating HALTs content after the detemplate budget instead of burning a QC round", async () => {
  const prev = process.env.CHAPTERFLOW_PREQC_SCOUT;
  delete process.env.CHAPTERFLOW_PREQC_SCOUT; // default = enforce
  try {
    const { deps, spawns } = varietyGateDeps(() => ({ stdout: sweepFlag(2) }));
    const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
    assert.equal(outcome.status, "halt", "blocking templating that survives the budget must NOT proceed to formal QC");
    if (outcome.status === "halt") {
      assert.equal(outcome.category, "content");
      assert.match(outcome.reason, /BLOCKING cross-chapter templating|sweep would sweep-FAIL|scout/i);
    }
    // PREQC_MAX_VARIETY_PASSES (2) detemplate passes + 1 verifying read that confirms residual → halt.
    assert.equal(spawns.filter((s) => s.sessionId.startsWith("pre-qc-variety-scout")).length, 3, "2 detemplate passes then 1 verifying read → halt");
    assert.equal(spawns.filter((s) => /^pre-qc-variety-\d+-ch/.test(s.sessionId)).length, 2, "exactly PREQC_MAX_VARIETY_PASSES detemplate attempts before the fail-closed halt");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_PREQC_SCOUT; else process.env.CHAPTERFLOW_PREQC_SCOUT = prev;
  }
});

test("doGate variety scout ADVISORY escape hatch (CHAPTERFLOW_PREQC_SCOUT=advisory) restores proceed-to-QC on persistent blocking templating", async () => {
  const prev = process.env.CHAPTERFLOW_PREQC_SCOUT;
  process.env.CHAPTERFLOW_PREQC_SCOUT = "advisory";
  try {
    const { deps, spawns } = varietyGateDeps(() => ({ stdout: sweepFlag(2) }));
    const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
    assert.equal(outcome.status, "ready", "advisory mode advances to QC (the pre-P08 behavior) — QC stays the safety net");
    assert.ok(spawns.filter((s) => s.sessionId.startsWith("pre-qc-variety-scout")).length >= 2, "the scout still runs its bounded passes");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_PREQC_SCOUT; else process.env.CHAPTERFLOW_PREQC_SCOUT = prev;
  }
});

test("doGate variety scout is BEST-EFFORT — a scout that fails to run never blocks the gate (advances to QC), even under enforce", async () => {
  const prev = process.env.CHAPTERFLOW_PREQC_SCOUT;
  delete process.env.CHAPTERFLOW_PREQC_SCOUT;
  try {
    const { deps, spawns } = varietyGateDeps(() => ({ ok: false, stdout: "" }));
    const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
    assert.equal(outcome.status, "ready", "a failed scout advances to QC — a parse/run failure is never a halt (QC stays the safety net)");
    assert.ok(!spawns.some((s) => /^pre-qc-variety-\d+-ch/.test(s.sessionId)), "a failed scout triggers no de-template repairs");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_PREQC_SCOUT; else process.env.CHAPTERFLOW_PREQC_SCOUT = prev;
  }
});



// ── pre-QC semantic/factual readiness convergence (first-pass QC calibration) ──
function alignmentGateDeps(alignmentStdout: (call: number) => { ok?: boolean; stdout: string }) {
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  let alignmentCalls = 0;
  const spawns: { sessionId: string; task?: string }[] = [];
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args[0] === "qc-converge") return { code: 0, stdout: "DETERMINISTIC-CLEAN", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    blockingMajors: () => [],
    spawn: (async (o: { sessionId: string; task?: string }) => {
      spawns.push(o);
      if (o.sessionId.includes("pre-qc-variety-scout")) {
        return { ok: true, exitCode: 0, finalMessage: "done", stdout: '```json\n{"templated":false,"rewrites":[]}\n```', stderr: "", durationMs: 1, sessionId: o.sessionId };
      }
      if (o.sessionId.includes("pre-qc-readiness-scout")) {
        const res = alignmentStdout(alignmentCalls++);
        return { ok: res.ok !== false, exitCode: res.ok === false ? 1 : 0, finalMessage: "done", stdout: res.stdout, stderr: "", durationMs: 1, sessionId: o.sessionId };
      }
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  return { deps, spawns };
}

test("doGate runs pre-QC readiness scout and surgically fixes semantic defects before formal QC", async () => {
  const { deps, spawns } = alignmentGateDeps((call) => ({
    stdout: call === 0
      ? '```json\n{"clean":false,"repairs":[{"chapter":2,"family":"source_local_coherence","unit":"examples[1].whyItMatters","quote":"where the ride leaves and rent money may hit overdraft fees","problem":"Clinic example imports ride/rent imagery from another unit.","instruction":"Replace with clinic-specific discharge consequences; preserve anchors and quiz keys."}]}\n```'
      : '```json\n{"clean":true,"repairs":[]}\n```',
  }));
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  assert.equal(outcome.status, "ready");
  assert.ok(spawns.some((s) => s.sessionId.startsWith("pre-qc-readiness-scout")), "doGate runs a semantic/factual readiness scout before QC");
  assert.ok(spawns.some((s) => /^pre-qc-readiness-1-ch2/.test(s.sessionId)), "a readiness finding drives a surgical per-chapter repair before QC");
  const repairTask = spawns.find((s) => /^pre-qc-readiness-1-ch2/.test(s.sessionId))?.task ?? "";
  assert.match(repairTask, /source-local coherence/i, "repair prompt names the exact QC-alignment failure family");
  assert.match(repairTask, /preserve.*quiz keys/i, "repair prompt prevents broad rewrites that churn QC unnecessarily");
});

test("doGate readiness scout is BOUNDED — persistent semantic findings run at most two pre-QC repair passes", async () => {
  const { deps, spawns } = alignmentGateDeps(() => ({ stdout: '```json\n{"clean":false,"repairs":[{"chapter":1,"family":"behavioral_naturalness","unit":"tryThisNow","quote":"walk one loop","problem":"Symbolic action theater.","instruction":"Replace with a practical action."}]}\n```' }));
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  assert.equal(outcome.status, "ready", "the gate advances to QC after the bounded pre-QC readiness attempts; QC remains the safety net");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("pre-qc-readiness-scout")).length, 2, "readiness scout runs at most PREQC_MAX_ALIGNMENT_PASSES (2)");
  assert.equal(spawns.filter((s) => /^pre-qc-readiness-\d+-ch1/.test(s.sessionId)).length, 2, "persistent findings get at most two surgical pre-QC repairs");
});

// ── Narrow QC-shadow review (risk-lane routing) ─────────────────────────────────
/** A compiler-architecture gate-phase status (blockers + majors clean) + a bookRisk stub,
 *  so these exercise the risk-routed shadow-review branch (options.preQcScouts === false)
 *  directly, without the legacy variety/readiness scouts in the way. The status sequence
 *  goes gate → qc → ready (three distinct statuses, matching the top-level
 *  "research→write→qc→ready" test) so a real formal-QC round actually opens (--create) after
 *  doGate returns, instead of the two-status gate→ready shortcut other doGate tests use (which
 *  skips the qc phase entirely and so can't show shadow-review-before-formal-QC ordering).
 *  `events` records spawn + runVerb calls in order for that ordering assertion. */
function riskGateDeps(
  risk: () => { lane: "low" | "medium" | "high"; chapters: Array<{ chapterNumber: number; score: number; lane: "low" | "medium" | "high"; reasons: string[] }> },
  spawnOverride?: (o: { sessionId: string }) => Promise<Record<string, unknown>>,
) {
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, deterministicClean: false, qcdChapters: 0, chapters: [chap(1), chap(2)] }), // phase = gate
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }), // phase = qc
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }), // phase = ready
  ];
  const events: string[] = [];
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => {
      events.push(`verb:${args[0]}${args.includes("--create") ? ":create" : ""}`);
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args[0] === "qc-converge") return { code: 0, stdout: "DETERMINISTIC-CLEAN", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    blockingMajors: () => [],
    bookRisk: ((_bookId: string) => ({
      schemaVersion: "chapter-risk-score-v1",
      bookId: "zz",
      generatedAt: "2026-01-01T00:00:00.000Z",
      bookWideRisks: [],
      ...risk(),
    })) as unknown as AutopilotDeps["bookRisk"],
    spawn: (async (o: { sessionId: string }) => {
      events.push(`spawn:${o.sessionId}`);
      if (spawnOverride) return spawnOverride(o);
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  });
  return { deps, events };
}

test("doGate runs a narrow QC shadow review before formal QC opens when risk-score flags a HIGH-risk chapter, and a failed shadow review never blocks formal QC", async () => {
  const { deps, events } = riskGateDeps(
    () => ({
      lane: "high",
      chapters: [
        { chapterNumber: 1, score: 8, lane: "high", reasons: ["source packet is thin", "2 real-world named case(s) lack 2+ hardSpecifics"] },
        { chapterNumber: 2, score: 1, lane: "low", reasons: [] },
      ],
    }),
    async (o) => {
      // The shadow session itself FAILS — this must never block or replace formal QC.
      if (o.sessionId.startsWith("qc-shadow-review")) {
        return { ok: false, exitCode: 1, finalMessage: "", stdout: "", stderr: "boom", durationMs: 1, sessionId: o.sessionId };
      }
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    },
  );
  const outcome = await runAutopilot({ bookId: "zz", deps, architecture: "compiler" });
  assert.equal(outcome.status, "ready", "a failed shadow review must never block formal QC — QC remains the sole gate");
  const shadowIdx = events.findIndex((e) => e.startsWith("spawn:qc-shadow-review"));
  const qcOpenIdx = events.findIndex((e) => e.includes(":create"));
  assert.ok(shadowIdx >= 0, `expected a qc-shadow-review session to spawn: ${events.join(" -> ")}`);
  assert.ok(qcOpenIdx >= 0 && shadowIdx < qcOpenIdx, `the shadow review must run BEFORE formal QC opens its round: ${events.join(" -> ")}`);
});

test("doGate skips the QC shadow review when risk-score reports no HIGH-risk chapters (low/medium lane)", async () => {
  const { deps, events } = riskGateDeps(() => ({
    lane: "medium",
    chapters: [
      { chapterNumber: 1, score: 4, lane: "medium", reasons: ["only 5 fact(s) for quiz/learning pack"] },
      { chapterNumber: 2, score: 1, lane: "low", reasons: [] },
    ],
  }));
  const outcome = await runAutopilot({ bookId: "zz", deps, architecture: "compiler" });
  assert.equal(outcome.status, "ready");
  assert.ok(!events.some((e) => e.startsWith("spawn:qc-shadow-review")), "no HIGH-risk chapters → the narrow shadow review must not spawn");
});

test("R3: a repair that introduces a NEW major (invisible to qc-converge) triggers ONE targeted regression-fix", async () => {
  let finalizeCalls = 0;
  let majorCalls = 0;
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, spawns } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) return finalizeCalls++ === 0 ? { code: 1, stdout: "REVISE", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" };
      if (args[0] === "qc-diagnose") return { code: 0, stdout: `ch01: finding-${finalizeCalls}`, stderr: "" };
      if (args[0] === "qc-converge") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    // pre-repair {A}; first post-repair scan {A,B} → new major B → ONE re-dispatch; then back to {A} → stop.
    majorFindingKeys: () => new Set(majorCalls++ === 1 ? ["A", "B"] : ["A"]),
  });
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", maxRepairRounds: 3, deps });
  assert.equal(outcome.status, "ready");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("qc-regression-fix")).length, 1, "exactly one targeted fix for the introduced major");
});

test("R3: a CLEAN repair (no NEW major) spawns NO regression-fix", async () => {
  let finalizeCalls = 0;
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, spawns } = happyDeps(statuses, {
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args.includes("--finalize")) return finalizeCalls++ === 0 ? { code: 1, stdout: "REVISE", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" };
      if (args[0] === "qc-diagnose") return { code: 0, stdout: `ch01: finding-${finalizeCalls}`, stderr: "" };
      if (args[0] === "qc-converge") return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    majorFindingKeys: () => new Set(["A"]), // constant pre/post → no new major
  });
  await runAutopilot({ architecture: "legacy", bookId: "zz", maxRepairRounds: 3, deps });
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("qc-regression-fix")).length, 0, "a clean repair never re-dispatches");
});

test("R4: repair fans out ONE surgical session PER flagged chapter (no single batch session that homogenizes)", async () => {
  const ROUND = "r20260101000000-abcdef";
  const matrixPath = evidenceMatrixPath("zz", ROUND);
  let finalizeCalls = 0;
  try {
    // A matrix marking ch1 + ch2 non-publishable → flagged = {1,2} → two surgical sessions.
    mkdirSync(dirname(matrixPath), { recursive: true });
    writeFileSync(matrixPath, JSON.stringify({
      schemaVersion: "qc-evidence-matrix-v1", bookId: "zz", roundId: ROUND,
      chapters: [
        { chapterNumber: 1, finalVerdict: "REVISE", reason: "x", checks: {}, majorStatus: { book: [], chapter: [] } },
        { chapterNumber: 2, finalVerdict: "REVISE", reason: "x", checks: {}, majorStatus: { book: [], chapter: [] } },
      ],
    }), "utf8");
    const statuses = [
      makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
      makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
    ];
    const { deps, spawns } = happyDeps(statuses, {
      runVerb: async (args) => {
        if (args.includes("--create")) return { code: 0, stdout: `round: ${ROUND}`, stderr: "" };
        if (args.includes("--finalize")) return finalizeCalls++ === 0 ? { code: 1, stdout: "REVISE", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" };
        if (args[0] === "qc-diagnose") return { code: 0, stdout: `ch01: finding-${finalizeCalls}`, stderr: "" };
        if (args[0] === "qc-converge") return { code: 0, stdout: "", stderr: "" };
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    await runAutopilot({ architecture: "legacy", bookId: "zz", maxRepairRounds: 3, deps });
    const perChapter = spawns.filter((s) => /^qc-repair-1-ch[12]#/.test(s.sessionId)).map((s) => s.sessionId.replace(/#.*/, ""));
    assert.deepEqual(new Set(perChapter), new Set(["qc-repair-1-ch1", "qc-repair-1-ch2"]), "one surgical session per flagged chapter");
    assert.equal(spawns.filter((s) => /^qc-repair-1#/.test(s.sessionId)).length, 0, "NO single batch repair session when chapters are flagged");
  } finally {
    rmSync(dirname(matrixPath), { recursive: true, force: true });
  }
});

test("R4: a NEEDS_MORE_QC (re-QC-only) chapter gets NO surgical edit session (only REVISE/CORRUPTION do)", async () => {
  const ROUND = "r20260101000000-abcdef";
  const matrixPath = evidenceMatrixPath("zz", ROUND);
  let finalizeCalls = 0;
  try {
    // ch1 REVISE (editable) + ch2 NEEDS_MORE_QC (re-QC only, no content findings).
    mkdirSync(dirname(matrixPath), { recursive: true });
    writeFileSync(matrixPath, JSON.stringify({
      schemaVersion: "qc-evidence-matrix-v1", bookId: "zz", roundId: ROUND,
      chapters: [
        { chapterNumber: 1, finalVerdict: "REVISE", reason: "x", checks: {}, majorStatus: { book: [], chapter: [] } },
        { chapterNumber: 2, finalVerdict: "NEEDS_MORE_QC", reason: "missing evidence", checks: {}, majorStatus: { book: [], chapter: [] } },
      ],
    }), "utf8");
    const statuses = [
      makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
      makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
    ];
    const { deps, spawns } = happyDeps(statuses, {
      runVerb: async (args) => {
        if (args.includes("--create")) return { code: 0, stdout: `round: ${ROUND}`, stderr: "" };
        if (args.includes("--finalize")) return finalizeCalls++ === 0 ? { code: 1, stdout: "REVISE", stderr: "" } : { code: 0, stdout: "PASS", stderr: "" };
        if (args[0] === "qc-diagnose") return { code: 0, stdout: `ch01: finding-${finalizeCalls}`, stderr: "" };
        if (args[0] === "qc-converge") return { code: 0, stdout: "", stderr: "" };
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    await runAutopilot({ architecture: "legacy", bookId: "zz", maxRepairRounds: 3, deps });
    const edits = spawns.filter((s) => /^qc-repair-1-ch\d+#/.test(s.sessionId)).map((s) => s.sessionId.replace(/#.*/, ""));
    assert.deepEqual(new Set(edits), new Set(["qc-repair-1-ch1"]), "only the REVISE chapter gets an edit session; the NEEDS_MORE_QC chapter does not");
  } finally {
    rmSync(dirname(matrixPath), { recursive: true, force: true });
  }
});

test("auto-publish ships on a clean QC pass — runs the promote gate, then commits + pushes", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, verbs } = happyDeps(statuses);
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", autoPublish: true, deps });
  assert.equal(outcome.status, "published");
  const publish = verbs.find((v) => v[0] === "publish-after-qc");
  assert.ok(publish, "auto-publish runs publish-after-qc");
  assert.ok(publish!.includes("--commit"), "auto-publish commits the package to main");
  assert.ok(publish!.includes("--push"), "auto-publish pushes to main");
});

test("auto-publish passes a finalizer CHAPTERFLOW_SESSION_ID to publish-after-qc (I1) — so the publish subprocess's in-process re-finalize can attest instead of wedging", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, verbs, verbEnvs } = happyDeps(statuses);
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", autoPublish: true, deps });
  assert.equal(outcome.status, "published");
  const i = verbs.findIndex((v) => v[0] === "publish-after-qc");
  assert.ok(i >= 0, "auto-publish runs publish-after-qc");
  // publish-after-qc re-finalizes in-process with attest=true; without a session id finalize SKIPS
  // every attestation and surfaces an error → ok:false → HALT (the I1 wedge). The conductor must pass a
  // distinct finalizer session id (≠ author/reviewer ids) so the re-attest lands.
  assert.ok(verbEnvs[i]?.CHAPTERFLOW_SESSION_ID, "the conductor passes a distinct finalizer session id to publish-after-qc (I1)");
});

test("auto-publish HALTS (never bypasses) when the promote gate fails", async () => {
  // A failing promote-gate check must surface as a HALT, not a publish — auto-publish
  // removes the human go-ahead, never a gate.
  const statuses = [
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const verbs: string[][] = [];
  const { deps } = happyDeps(statuses, {
    runVerb: async (args) => {
      verbs.push(args);
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      if (args[0] === "publish-after-qc") return { code: 1, stdout: "", stderr: "blocker: sweep SC9 distinctness" };
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", autoPublish: true, deps });
  assert.equal(outcome.status, "halt", "a failing promote gate must HALT, not publish");
  assert.ok(verbs.some((v) => v[0] === "publish-after-qc" && v.includes("--commit")), "it ran the promote gate (publish-after-qc --commit) before halting");
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") { assert.equal(outcome.category, "infra"); assert.match(outcome.reason, /lost the run lock/); }
  assert.ok(refreshCalls >= 2, "heartbeat ran on each loop iteration until it reported the loss");
});

test("autopilot normalizes a codex spawn rejection into an infra halt (no unhandled rejection)", async () => {
  const { deps } = happyDeps([makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" })], {
    spawn: (async () => { throw new Error("codex exec timed out after 1800000ms"); }) as unknown as AutopilotDeps["spawn"],
  });
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  const runId = "run-spawn-rejection-wp503";
  const previousRunId = process.env.CHAPTERFLOW_RUN_ID;
  process.env.CHAPTERFLOW_RUN_ID = runId;
  try {
    const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
    assert.equal(outcome.status, "halt"); // still halts (rethrow preserved)
    assert.ok(logged.some((r) => r.ok === false && /timed out/.test(r.stderr)), "the rejected spawn was logged with ok:false + the error");

    // WP-503 — a REJECTED spawn is a real, disjoint outcome too: it is ledgered
    // in the unified call ledger exactly like a completed one, never silently
    // dropped just because the process threw. Real elapsed time is recorded
    // (never a placeholder 0), and the outcome classification is "timeout"
    // (reusing the SAME classifier the success path uses).
    const entries = readCallLedgerEntries(PIPELINE_DIR, "zz", runId);
    assert.ok(entries.length > 0, "the rejected spawn is ledgered, not dropped");
    assert.ok(entries.every((e) => e.family === "codex-exec"));
    assert.ok(entries.every((e) => e.outcome === "timeout"), "classifyProviderOutcome recognizes 'timed out' in the error message");
    assert.ok(entries.every((e) => typeof e.latencyMs === "number" && e.latencyMs >= 0));
  } finally {
    if (previousRunId === undefined) delete process.env.CHAPTERFLOW_RUN_ID; else process.env.CHAPTERFLOW_RUN_ID = previousRunId;
    rmSync(callLedgerDir(PIPELINE_DIR, "zz"), { recursive: true, force: true });
  }
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz", deps });
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
  assert.match(
    spawnCwd.replace(/\\/g, "/"),
    /chapterflow-v(?:21-authored|22-optimized-autonomous|23-compiler-pipeline(?: \d+)?|24-author-pipeline)$/,
    "no packs on disk → cwd falls open to the pipeline dir",
  );
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

test("broker does ONE corrective retry feeding qc-submit's rejection back, and the fix is recorded", async () => {
  // Live-run lesson: a reviewer emitted a sweep finding missing `chapters`; qc-submit
  // rejected it and the old narrow-retry re-ran the identical prompt → same error → halt.
  // Now the broker re-spawns ONCE with the rejection + the rejected JSON fed back.
  let n = 0;
  let submitCalls = 0;
  const tasks: string[] = [];
  const deps = resolveDeps({
    mkSessionId: () => `s${++n}`,
    readTask: () => "SWEEP CARD", logSession: () => {}, log: () => {},
    reviewerSkeleton: () => null,
    reviewerWorkspace: () => ({ cwd: "/tmp/cf-blind", inputs: [], cleanup: () => {} }),
    writeTempSubmission: () => "/tmp/sub.json",
    spawn: (async (o: { sessionId: string; task: string }) => { tasks.push(o.task); return { ok: true, exitCode: 0, finalMessage: "```", stdout: '```json\n{"role":"sweep","verdict":"REVISE","findings":[{"family":"repeated_unit"}]}\n```', stderr: "", durationMs: 1, sessionId: o.sessionId }; }) as unknown as AutopilotDeps["spawn"],
    runVerb: async (args) => {
      if (args[0] === "qc-submit") { submitCalls++; return submitCalls === 1 ? { code: 1, stdout: "", stderr: "sweep.findings[0].chapters must list affected chapters" } : { code: 0, stdout: "", stderr: "" }; }
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const res = await brokerReviewer("zz", "r1", "/t/00-sweep.md", { sweep: "SW" }, deps);
  assert.equal(res.submissionOk, true, "the corrective retry recorded the submission");
  assert.equal(submitCalls, 2, "exactly two qc-submit attempts (original + ONE corrective)");
  assert.equal(tasks.length, 2, "the reviewer was re-spawned exactly once");
  assert.match(tasks[1], /WAS REJECTED/, "the corrective prompt feeds the rejection back");
  assert.match(tasks[1], /chapters must list affected chapters/, "including the exact validation error so the model can self-correct");
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

test("summarizeRoundDrivers: the QC halt names the ACTUAL failed checks per chapter (not a hardcoded source-limit guess)", () => {
  const ROUND = "r20260101000000-fedcba";
  const matrixPath = evidenceMatrixPath("zz-drivers", ROUND);
  try {
    mkdirSync(dirname(matrixPath), { recursive: true });
    writeFileSync(matrixPath, JSON.stringify({
      schemaVersion: "qc-evidence-matrix-v1", bookId: "zz-drivers", roundId: ROUND,
      chapters: [
        { chapterNumber: 1, finalVerdict: "REVISE", reason: "x", checks: { sweep: "FAIL", confirmRead: "REVISE", barRead: "GREEN", sourceV2: "PASS", repairLedger: "NO_OPEN_BLOCKERS", majors: "NOT_APPLICABLE" }, majorStatus: { book: [], chapter: [] } },
        { chapterNumber: 2, finalVerdict: "PUBLISHABLE", reason: "ok", checks: { sweep: "PASS", confirmRead: "PUBLISHABLE", barRead: "GREEN" }, majorStatus: { book: [], chapter: [] } },
        { chapterNumber: 3, finalVerdict: "REVISE", reason: "x", checks: { confirmRead: "REVISE", barRead: "GREEN" }, majorStatus: { book: [], chapter: [] } },
      ],
    }), "utf8");
    const summary = summarizeRoundDrivers("zz-drivers", ROUND);
    // ch01 names its real failures, ch03 names its real failure, ch02 (PUBLISHABLE) is excluded.
    assert.match(summary, /ch01:.*sweep/, "must name ch01's sweep failure");
    assert.match(summary, /ch01:.*confirmRead/, "must name ch01's confirmRead failure");
    assert.match(summary, /ch03:.*confirmRead/, "must name ch03's confirmRead failure");
    assert.ok(!/ch02/.test(summary), "a PUBLISHABLE chapter must not appear in the halt drivers");
    assert.ok(!/barRead/.test(summary), "a GREEN check must not be reported as a driver");
    assert.ok(!/repairLedger/.test(summary), "a clean repair ledger (NO_OPEN_BLOCKERS) must not be reported as a driver");
    assert.ok(!/majors/.test(summary), "an N/A majors check (NOT_APPLICABLE) must not be reported as a driver");
  } finally {
    rmSync(dirname(matrixPath), { recursive: true, force: true });
  }
});

test("summarizeRoundDrivers: a missing/unreadable matrix yields an empty string (fail-safe, never throws)", () => {
  assert.equal(summarizeRoundDrivers("zz-no-such-book", "r20990101000000-000000"), "");
});

test("WRITER_SELF_VERIFY wires the WT-F semantic levers into the autopilot writer (hidden-key + bar self-score, not just the deterministic gate)", () => {
  // Regression guard for the gap a live the-willpower-instinct run exposed: the autopilot
  // writer task ran only author-check/gate-chapter (deterministic), so semantic defects —
  // a wrong quiz key whose explanation contradicted it, performative rituals, abstract
  // scenes — reached QC and forced a repair round. The WT-F levers existed only in the
  // MANUAL STEP-2 path. These assertions pin them into the autopilot writer's self-verify.
  const v = WRITER_SELF_VERIFY;
  // hidden-key protocol — the lever that catches a wrong/contradicted quiz key at write time
  assert.ok(v.includes("quiz-blind"), "writer must run quiz-blind (derive the key blind)");
  assert.ok(v.includes("quiz-verify"), "writer must run quiz-verify (diff against the stored key)");
  // evidence trace — the concrete factual_accuracy self-check (the dominant CORRUPTION after
  // quiz keys on the willpower run: the "Piper move" / invented witness). Added as step 3.
  assert.ok(v.includes("evidence-audit"), "writer must run evidence-audit (trace named actors to the brief)");
  assert.ok(/Piper move/i.test(v), "self-verify should name the Piper move (invented witness in a real study)");
  assert.ok(/all four/i.test(v), "self-verify must require ALL FOUR steps (the evidence trace is the 4th lever)");
  // bar self-score — catches rituals / abstract scenes / contested-as-fact before submit
  assert.ok(v.includes("publishable-rubric"), "writer must self-score the 9-axis publishable bar");
  // still keeps the deterministic check it always had
  assert.ok(/gate-chapter/.test(v) && /author-check/.test(v), "writer must still run the deterministic gate");
  // names the corruption-prone failure modes so the self-score is concrete, not vague
  for (const axis of ["behavioral_naturalness", "example_coherence", "factual_accuracy", "prose_coherence"]) {
    assert.ok(v.includes(axis), `self-verify should call out the ${axis} failure mode`);
  }
  // persona coherence — the James-role-drift class (one first name worn by unrelated roles): a
  // confirmed first-pass-QC REVISE driver the writer CAN self-catch within a chapter (the
  // cross-chapter case is converged by the pre-QC variety scout in doGate).
  assert.ok(v.includes("persona_coherence"), "self-verify should call out persona coherence (one name = one consistent role)");
  // token lever (item 3b): step 4 now LEANS on the expanded deterministic gate — the writer
  // should not re-derive the structural corruption tells the gate proves (EW1/SEAM/NE1/GN1),
  // focusing its judgment budget on the gate-invisible semantic axes.
  assert.ok(/SEAM/.test(v) && /EW1/.test(v) && /NE1/.test(v) && /GN1/.test(v), "self-verify should point the writer at the gate-proven structural tells (EW1/SEAM/NE1/GN1)");
  assert.ok(/cannot see/i.test(v) && /not re-derive/i.test(v), "self-verify should focus judgment on what the deterministic gate cannot see");
});

// ── v24 WS2: handleReady publish wiring (author → publish-final; compiler/legacy → publish-after-qc) ──
test("v24 handleReady wiring: the AUTHOR arch READY command is publish-final; compiler/legacy stay on publish-after-qc/publish", () => {
  // author arch — one-verb publish-final (no round id needed in the command).
  assert.equal(readyPublishCommand("execution", "r20260703000000-abcdef", "author"), 'npx tsx src/cli.ts publish-final "execution"');
  assert.equal(readyPublishCommand("execution", undefined, "author"), 'npx tsx src/cli.ts publish-final "execution"', "author never falls back to publish-after-qc/publish");
  // compiler + legacy — publish-after-qc with the round, or bare publish when no round id.
  assert.equal(readyPublishCommand("zz", "r20260703000000-abcdef", "compiler"), 'npx tsx src/cli.ts publish-after-qc "zz" --round r20260703000000-abcdef --commit --push');
  assert.equal(readyPublishCommand("zz", "r20260703000000-abcdef", "legacy"), 'npx tsx src/cli.ts publish-after-qc "zz" --round r20260703000000-abcdef --commit --push');
  assert.equal(readyPublishCommand("zz", undefined, "legacy"), 'npx tsx src/cli.ts publish "zz"', "no round id → the plain publish verb (unchanged)");
  // the author command must NOT commit sandbox-nested paths (it names no round / no publish-after-qc).
  assert.ok(!readyPublishCommand("execution", "r1", "author").includes("publish-after-qc"), "author must not route through publish-after-qc (the sandbox-nested-commit source)");
});

test("autopilot fixtures restore production telemetry bytes and mtimes", () => {
  for (const snapshot of MODULE_AUTOPILOT_TELEMETRY) restoreFixtureFile(snapshot);
  for (const snapshot of MODULE_AUTOPILOT_DIRS) restoreFixtureDir(snapshot);
});
