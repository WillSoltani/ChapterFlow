/**
 * WS6 T1/T2 — conductor telemetry: session ledger + cost report + run manifest.
 *
 * Covers:
 *  - classifySessionLabel / parseCause over every real mkSessionId label family
 *  - SessionLedger counts per type + the honest-accounting invariant (clean + tripped)
 *  - cost-report.json + run-manifest.json written at a real runAutopilot terminal
 *  - a STATIC regression: every deps.spawn call site in src/orchestrator is paired with a
 *    deps.logSession in the same function, so no spawn can go unlogged (the exact "hidden
 *    session" defect the forensics counter-proved).
 *  - WP-503: the SAME real runAutopilot terminal also flushes the unified per-run call
 *    ledger (codex-exec family) + its rollup + the per-book rollup, reconciled 1:1 against
 *    the pre-existing grandTotalSessions counter (never a second, divergent spawn count).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import {
  SessionLedger,
  classifySessionLabel,
  parseCause,
  newRunManifest,
  formatCostReport,
  writeRunManifest,
} from "../src/orchestrator/sessionLedger.js";
import { runAutopilot } from "../src/orchestrator/autopilot.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { CodexAgentResult } from "../src/orchestrator/codexAgent.js";
import type { BookStatus, ChapterStatus } from "../src/lifecycle/bookStatus.js";
import { callLedgerDir, callLedgerPaths, readCallLedgerEntries } from "../src/telemetry/runCallLedger.js";

function mkResult(sessionId: string, over: Partial<CodexAgentResult> = {}): CodexAgentResult {
  return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 5, sessionId, ...over };
}

// ── classifier ─────────────────────────────────────────────────────────────────
test("classifySessionLabel maps every real mkSessionId label family", () => {
  const cases: Array<[string, string]> = [
    ["research", "research"],
    ["research-retry-2", "research"],
    ["source-repair-1", "source-repair"],
    ["compiler-source-repair-2", "source-repair"],
    ["write-ch03", "writer"],
    ["author-ch07", "writer"],
    ["author-ch07-retry1", "writer"],
    ["section-example-ch04", "writer"],
    ["compiler-assembly-ch02", "writer"],
    ["gate-repair-1", "gate-repair"],
    ["gate-major-repair-1-ch02", "major-repair"],
    ["qc-shadow-review", "shadow-review"],
    ["pre-qc-variety-scout", "variety-scout"],
    ["pre-qc-variety-1-ch2", "variety-scout"],
    ["pre-qc-readiness-scout", "readiness-scout"],
    ["pre-qc-readiness-1-ch2", "readiness-scout"],
    ["qc-converge-fix-1-1", "qc-repair"],
    ["qc-regression-fix-2-ch3", "qc-repair"],
    ["compiler-section-repair-1", "qc-repair"],
    ["qc-bar-ch01", "qc-review"],
    ["qc-confirm-ch01", "qc-review"],
    ["qc-bar-ch01-fix", "qc-review"],
    ["qc-keyA", "key"],
    ["qc-keyB", "key"],
    ["author-key-keyA", "key"],
    ["qc-sweep", "sweep"],
    ["author-sweep", "sweep"],
    ["author-sweep-retry", "sweep"],
    ["author-review-ch05", "author-review"],
    ["author-review-ch05-indep", "author-review"],
    ["author-book-reader-1", "author-book-reader"],
    ["author-book-reader-2-round2", "author-book-reader"],
    ["shipped-control-r1", "shipped-control"],
    ["book-reader-1-round2", "acceptance-reader"],
    ["finalize", "verb"],
    ["publish-finalize", "verb"],
  ];
  for (const [label, expected] of cases) {
    assert.equal(classifySessionLabel(label), expected, `${label} → ${expected}`);
  }
});

test("parseCause buckets retries/attempts/repairs and returns undefined for a first pass", () => {
  assert.equal(parseCause("author-ch07-retry1"), "retry1");
  assert.equal(parseCause("write-ch03"), undefined);
  assert.equal(parseCause("gate-repair-2"), "gate-repair-2");
  assert.equal(parseCause("gate-major-repair-1-ch02"), "gate-major-repair-1");
  assert.equal(parseCause("qc-converge-fix-3-1"), "qc-converge-fix-3");
  assert.equal(parseCause("author-book-reader-2-round2-r2"), "respawn");
});

// ── ledger counts + invariant ───────────────────────────────────────────────────
test("SessionLedger counts per type and reconciles logged spawns", () => {
  const led = new SessionLedger("zz");
  led.setPhase("write");
  // 2 writers, one retried; both logged.
  const w1 = "auto-write-ch01-x-1"; led.mint("write-ch01", w1); led.record(mkResult(w1));
  const w2 = "auto-write-ch02-x-2"; led.mint("write-ch02", w2); led.record(mkResult(w2));
  const w2r = "auto-write-ch02-retry1-x-3"; led.mint("write-ch02-retry1", w2r); led.record(mkResult(w2r, { ok: false, exitCode: 1 }));
  led.setPhase("qc");
  // 2 reviewers + 1 key + 1 sweep, all logged.
  for (const [lbl, id] of [["qc-bar-ch01", "b1"], ["qc-bar-ch02", "b2"], ["qc-keyA", "kA"], ["qc-sweep", "sw"]] as const) {
    led.mint(lbl, id); led.record(mkResult(id));
  }
  // A verb id (finalize) — minted, never logged, NOT a spawn.
  led.mint("finalize", "fin1");

  const rep = led.build("ready");
  assert.equal(rep.grandTotalSessions, 7, "7 spawns (verb id excluded)");
  assert.equal(rep.verbIds, 1);
  assert.equal(rep.mintedIds, 8, "8 minted ids incl. the verb id");
  assert.equal(rep.byType.writer, 3);
  assert.equal(rep.byType["qc-review"], 2);
  assert.equal(rep.byType.key, 1);
  assert.equal(rep.byType.sweep, 1);
  assert.equal(rep.byPhase.write, 3);
  assert.equal(rep.byPhase.qc, 4);
  assert.equal(rep.retriesByCause.retry1, 1, "the one retried writer is bucketed by cause");
  assert.equal(rep.invariantOk, true, "every spawn id logged → invariant clean");
  assert.deepEqual(rep.unloggedSpawnIds, []);
});

test("SessionLedger honest-accounting invariant TRIPS on a minted-but-never-logged SPAWN id", () => {
  const led = new SessionLedger("zz");
  led.setPhase("gate");
  // A gate-repair spawn id is minted (the exact forensics defect: a deterministic
  // gate-repair agent that minted an id) but its outcome is NEVER recorded.
  led.mint("gate-repair-1", "auto-gate-repair-1-x-1");
  // A verb id minted-and-never-logged must NOT trip (it never spawns an agent).
  led.mint("finalize", "fin");

  const rep = led.build("halt:content");
  assert.equal(rep.invariantOk, false, "an unlogged SPAWN id trips the invariant");
  assert.deepEqual(rep.unloggedSpawnIds, ["auto-gate-repair-1-x-1"], "only the spawn id, never the verb id");
  const out = formatCostReport(rep);
  assert.match(out, /invariant TRIPPED/);
  assert.match(out, /auto-gate-repair-1-x-1/);
});

test("SessionLedger carry hits/misses and phase wall-clock accumulate", () => {
  const led = new SessionLedger("zz");
  led.carryHit(); led.carryHit(); led.carryMiss();
  led.setPhase("write");
  const a = "a1"; led.mint("write-ch01", a); led.record(mkResult(a, { durationMs: 100 }));
  led.setPhase("qc");
  const b = "b1"; led.mint("qc-bar-ch01", b); led.record(mkResult(b, { durationMs: 40 }));
  const rep = led.build("ready");
  assert.deepEqual(rep.carry, { hits: 2, misses: 1 });
  assert.equal(rep.wallClockMsByPhase.write, 100);
  assert.equal(rep.wallClockMsByPhase.qc, 40);
  assert.equal(rep.totalWallClockMs, 140);
});

// ── run manifest ────────────────────────────────────────────────────────────────
test("run manifest lifecycle: start fields set, terminal fields filled, round-trips on disk", () => {
  const m = newRunManifest({ bookId: "zz", arch: "author", flags: { autoPublish: false }, bar: null, readerCount: 3 });
  assert.equal(m.bookId, "zz");
  assert.equal(m.arch, "author");
  assert.equal(m.readerCount, 3);
  assert.ok(m.startedAt);
  assert.equal(m.finishedAt, null);
  assert.equal(m.terminal, null);

  m.finishedAt = new Date().toISOString();
  m.terminal = "ready";
  m.beatShipped = { pin: null, composite: 80 };

  const dir = resolve(PIPELINE_DIR, "state", "autopilot-logs", "zz");
  try {
    const path = writeRunManifest(PIPELINE_DIR, m);
    assert.ok(path && existsSync(path));
    const round = JSON.parse(readFileSync(path!, "utf8"));
    assert.equal(round.schemaVersion, "autopilot-run-manifest-v1");
    assert.equal(round.terminal, "ready");
    assert.equal(round.beatShipped.composite, 80);
  } finally {
    rmSync(resolve(dir, "run-manifest.json"), { force: true });
  }
});

// ── static regression: every spawn is paired with a logSession ───────────────────
test("every deps.spawn call site is paired with a deps.logSession in the same function (no unlogged spawn)", () => {
  const dir = resolve(PIPELINE_DIR, "src", "orchestrator");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(resolve(dir, f), "utf8");
    // Split into top-level-ish function bodies by `function ` boundaries is brittle; instead,
    // for every `deps.spawn(` occurrence, require a `deps.logSession(` within a bounded window
    // AFTER it (the choke-point pattern: spawn → log). autopilot's spawnAndLog logs on BOTH the
    // success and the catch path; every other module logs immediately after the await. A 1200-char
    // window comfortably spans the widest spawn→log gap (authorReview's ~110-char options block).
    // IMP-22's forward live repair lane is intentionally accounted by the
    // crash-safe ForwardLiveCallLedger instead of the legacy SessionLedger. It
    // may use the local deps.spawn wrapper only when that wrapper is visibly
    // bound to runLedgeredForwardModelOperation and the returned producer is
    // branded liveLedgerBound. This narrow structural exception prevents a
    // duplicate canonical session log while still failing if the live ledger
    // choke point or brand is removed.
    let idx = 0;
    while ((idx = src.indexOf("deps.spawn(", idx)) !== -1) {
      const window = src.slice(idx, idx + 1200);
      const forwardLiveLedgerBound = f === "forwardLiveValidationDriver.ts"
        && src.slice(0, idx).includes("spawn: async (spawnOptions: SpawnCodexAgentOptions) => {")
        && src.slice(0, idx).includes("runLedgeredForwardModelOperation({")
        && src.slice(idx).includes('Object.defineProperty(producer, "liveLedgerBound"');
      if (!window.includes("deps.logSession(") && !forwardLiveLedgerBound) {
        const lineNo = src.slice(0, idx).split("\n").length;
        offenders.push(`${f}:${lineNo}`);
      }
      idx += "deps.spawn(".length;
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `spawn site(s) with no logSession within reach → an unlogged/hidden spawn (feeds the WS6 honest-accounting invariant):\n${offenders.join("\n")}`,
  );
});

// ── integration: a real runAutopilot terminal writes both artifacts ───────────────
function makeStatus(o: Partial<BookStatus>): BookStatus {
  return {
    bookId: "zz-ledger-int", stage: "write-chapter", phase: "", expectedChapters: 2,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [],
    ...o,
  };
}
function chap(n: number, written = true, gate = true, qc: ChapterStatus["qcVerdict"] = "NONE", fresh = false): ChapterStatus {
  return { number: n, chapterId: `zz-ledger-int-ch0${n}`, written, shipGatePass: gate, shipBlockers: gate ? 0 : 1, qcVerdict: qc, qcFresh: fresh };
}

/** A minimal happy legacy run: write → qc → ready. Records spawns + wraps logSession so the
 *  test can prove the conductor's own telemetry wrapper fed the ledger (not this stub). */
function ledgerRunDeps(statuses: BookStatus[]): { deps: Partial<AutopilotDeps>; spawns: string[]; loggedIds: string[] } {
  const spawns: string[] = [];
  const loggedIds: string[] = [];
  let si = 0, n = 0;
  const deps: Partial<AutopilotDeps> = {
    statusOf: () => statuses[Math.min(si++, statuses.length - 1)],
    runVerb: async (args) => {
      if (args.includes("--create")) return { code: 0, stdout: "round: r20260101000000-abcdef", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o.sessionId);
      return mkResult(o.sessionId);
    }) as unknown as AutopilotDeps["spawn"],
    listTaskCards: (_b, _r, sub) => sub === "confirm" ? ["/t/confirm/ch01.md"] : ["/t/00-sweep.md", "/t/01-keyA.md", "/t/02-keyB.md", "/t/bar/ch01.md", "/t/bar/ch02.md"],
    listWriteCards: () => ["/w/ch01.md", "/w/ch02.md"],
    latestRoundId: () => "r20260101000000-abcdef",
    expectedChapterNumbers: () => [1, 2],
    readTask: () => "TASK",
    mkSessionId: (label: string) => `${label}#${++n}`,
    chapterHashes: () => ({}),
    submissionPresent: () => true,
    sweepConfirmed: () => true,
    logSession: (_b, _l, r) => { loggedIds.push(r.sessionId); },
    logBroker: () => {},
    reviewerSkeleton: () => null,
    reviewerWorkspace: () => ({ cwd: "/tmp/cf-blind-ledger", inputs: [], cleanup: () => {} }),
    readReviewPacket: () => ["sweep", "keyA", "keyB", "bar", "confirm", "major"]
      .map((role) => `npx tsx src/cli.ts qc-submit zz --round r --role ${role} --token tok-${role} --file <x>`)
      .join("\n"),
    writeTempSubmission: () => "/tmp/cf-broker-ledger.json",
    acquireLock: () => ({ ok: true, release: () => {} }),
    researchFreshness: () => null,
    log: () => {},
  };
  return { deps, spawns, loggedIds };
}

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

test("runAutopilot writes cost-report.json + run-manifest.json at a READY terminal, reconciled to the counter", async () => {
  const statuses = [
    makeStatus({ writtenChapters: 0, expectedChapters: 2, stage: "write-chapter" }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 0, chapters: [chap(1), chap(2)] }),
    makeStatus({ writtenChapters: 2, expectedChapters: 2, gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true, chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)] }),
  ];
  const { deps, spawns } = ledgerRunDeps(statuses);
  const logDir = resolve(PIPELINE_DIR, "state", "autopilot-logs", "zz-ledger-int");
  const provenanceSnapshots = [1, 2].map((n) => snapshotFixtureFile(resolve(
    PIPELINE_DIR,
    "state",
    "provenance",
    `zz-ledger-int-ch0${n}.json`,
  )));
  // WP-503: pin a known runId so the test can look the unified call ledger up
  // deterministically afterward (runAutopilot honors CHAPTERFLOW_RUN_ID —
  // the SAME convention cost-tracker.ts/generateChapter.ts/etc. already use).
  const runId = "run-zz-ledger-int-wp503";
  const previousRunId = process.env.CHAPTERFLOW_RUN_ID;
  process.env.CHAPTERFLOW_RUN_ID = runId;
  try {
    const outcome = await runAutopilot({ architecture: "legacy", bookId: "zz-ledger-int", deps });
    assert.equal(outcome.status, "ready", `expected READY, got ${outcome.status} (${(outcome as { reason?: string }).reason ?? ""})`);

    const reportPath = resolve(logDir, "cost-report.json");
    const manifestPath = resolve(logDir, "run-manifest.json");
    assert.ok(existsSync(reportPath), "cost-report.json must be written at the terminal");
    assert.ok(existsSync(manifestPath), "run-manifest.json must be written at the terminal");

    const rep = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.equal(rep.schemaVersion, "autopilot-cost-report-v1");
    assert.equal(rep.terminal, "ready");
    // The conductor's OWN wrapper fed the ledger: grand-total spawns must equal the number
    // of agent spawns the run actually made, and the invariant must be clean (every spawn
    // logged) — the honest-accounting backstop.
    assert.equal(rep.grandTotalSessions, spawns.length, "ledger spawn count === the run's actual spawns");
    assert.equal(rep.invariantOk, true, "no unlogged spawn on a healthy run");
    assert.ok(rep.grandTotalSessions > 0, "a real write+qc run spawns at least one agent");
    // writers appear in the by-type table.
    assert.ok((rep.byType.writer ?? 0) >= 2, "both chapter writers are typed");

    const man = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(man.schemaVersion, "autopilot-run-manifest-v1");
    assert.equal(man.bookId, "zz-ledger-int");
    assert.equal(man.arch, "legacy");
    assert.equal(man.terminal, "ready");
    assert.ok(man.startedAt && man.finishedAt, "manifest start + finish stamped");

    // WP-503 — the SAME real run also produced exactly one unified-ledger line per
    // spawn (no unlogged call), a rollup reconciled to grandTotalSessions, and a
    // per-book rollup — all on a durable (non-gitignored) path.
    const entries = readCallLedgerEntries(PIPELINE_DIR, "zz-ledger-int", runId);
    assert.equal(entries.length, spawns.length, "one unified-ledger line per real spawn — no unlogged call");
    assert.ok(entries.every((e) => e.family === "codex-exec"));
    assert.ok(entries.every((e) => e.outcome === "content_completed"), "every mocked spawn in this fixture succeeds");
    assert.ok(entries.every((e) => typeof e.latencyMs === "number" && e.latencyMs >= 0), "real elapsed time, never a placeholder");
    assert.ok((entries.filter((e) => e.stage === "writer").length) >= 2, "writer stage reused from classifySessionLabel, not reinvented");

    const paths = callLedgerPaths(PIPELINE_DIR, "zz-ledger-int", runId);
    const rollup = JSON.parse(readFileSync(paths.summary, "utf8"));
    assert.equal(rollup.totalCalls, spawns.length);
    assert.equal(rollup.byFamily["codex-exec"], rep.grandTotalSessions, "unified-ledger rollup reconciles 1:1 against the pre-existing grandTotalSessions");
    assert.equal(rollup.cost, "NOT_METERED");
    assert.ok(existsSync(paths.bookRollup), "the per-book rollup is written at run end too");
  } finally {
    if (previousRunId === undefined) delete process.env.CHAPTERFLOW_RUN_ID; else process.env.CHAPTERFLOW_RUN_ID = previousRunId;
    rmSync(logDir, { recursive: true, force: true });
    rmSync(callLedgerDir(PIPELINE_DIR, "zz-ledger-int"), { recursive: true, force: true });
    for (const snapshot of provenanceSnapshots) restoreFixtureFile(snapshot);
  }
});

test("author-arch durable-acceptance carry HIT is recorded once (0 re-review spawns) and manifest names readerCount", async () => {
  // A fully-accepted book RE-ENTERING the conductor over unchanged bytes: deps.authorAccepted
  // → true routes straight to READY with zero spawns. WS6 must record exactly one carry HIT
  // (not one per loop iteration) and stamp the author readerCount in the manifest.
  const ready = makeStatus({
    bookId: "zz-ledger-author", stage: "qc", writtenChapters: 2, expectedChapters: 2,
    gatedChapters: 2, bookGatePass: true, qcdChapters: 2, publishable: true,
    chapters: [chap(1, true, true, "PUBLISHABLE", true), chap(2, true, true, "PUBLISHABLE", true)],
  });
  const { deps, spawns } = ledgerRunDeps([ready]);
  const authorDeps: Partial<AutopilotDeps> = { ...deps, authorAccepted: () => true };
  const logDir = resolve(PIPELINE_DIR, "state", "autopilot-logs", "zz-ledger-author");
  try {
    const outcome = await runAutopilot({ architecture: "author", bookId: "zz-ledger-author", deps: authorDeps });
    assert.equal(outcome.status, "ready", `expected READY carry, got ${outcome.status}`);
    assert.equal(spawns.length, 0, "a durable-acceptance carry re-entry spawns nothing");

    const rep = JSON.parse(readFileSync(resolve(logDir, "cost-report.json"), "utf8"));
    assert.equal(rep.grandTotalSessions, 0, "0 spawns on a pure carry");
    assert.deepEqual(rep.carry, { hits: 1, misses: 0 }, "exactly one carry HIT, recorded once");
    assert.equal(rep.invariantOk, true);

    const man = JSON.parse(readFileSync(resolve(logDir, "run-manifest.json"), "utf8"));
    assert.equal(man.arch, "author");
    assert.equal(man.readerCount, 3, "author arch stamps AUTHOR_BOOK_READERS");
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});
