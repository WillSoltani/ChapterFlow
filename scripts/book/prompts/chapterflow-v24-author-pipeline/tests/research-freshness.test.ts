/**
 * A2 — research freshness (the restore hole).
 *
 * The research phase's handoff contract (index exists + book-status=write) was gamed
 * by a session that RESTORED an archived research run byte-identical from
 * state/_regen-backups/ instead of doing live research. These tests pin the
 * deterministic post-pass check (researchFreshnessViolation) and its doResearch
 * wiring. All fs work happens in mkdtemp dirs via the injectable roots — the
 * repo's real .chapterflow/runs and state/ are never touched.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { researchFreshnessViolation } from "../src/orchestrator/researchFreshness.js";
import { runAutopilot, type AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { BookStatus } from "../src/lifecycle/bookStatus.js";

const BOOK = "zz-fresh-book";

function mkRoots(): { runsRoot: string; backupsRoot: string } {
  const base = mkdtempSync(join(tmpdir(), "cf-research-fresh-"));
  const runsRoot = join(base, ".chapterflow", "runs");
  const backupsRoot = join(base, "state", "_regen-backups");
  mkdirSync(runsRoot, { recursive: true });
  // backupsRoot deliberately NOT created here — tests that need backups create it.
  return { runsRoot, backupsRoot };
}

function writeRun(runsRoot: string, bookId: string, runName: string, sidecars: Record<string, string>): void {
  const dir = join(runsRoot, bookId, runName, "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(sidecars)) writeFileSync(join(dir, name), content);
}

function writeBackup(backupsRoot: string, entry: string, bookId: string, runName: string, sidecars: Record<string, string>): void {
  const dir = join(backupsRoot, entry, ".chapterflow", "runs", bookId, runName, "sidecars", "source");
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(sidecars)) writeFileSync(join(dir, name), content);
}

const SIDECARS = {
  "ch01.source.json": JSON.stringify({ schemaVersion: "source-v2", chapterNumber: 1 }),
  "ch02.source.json": JSON.stringify({ schemaVersion: "source-v2", chapterNumber: 2 }),
};

// ── the pure check ───────────────────────────────────────────────────────────

test("A2 freshness: a fresh run written during the task passes (no backups dir present)", () => {
  const { runsRoot, backupsRoot } = mkRoots();
  const taskStartedAtMs = Date.now() - 60_000; // the task started a minute ago; files are newer
  writeRun(runsRoot, BOOK, "20260702-120000", SIDECARS);
  assert.equal(researchFreshnessViolation(BOOK, taskStartedAtMs, { runsRoot, backupsRoot }), null);
});

test("A2 freshness: a missing run dir is a violation", () => {
  const { runsRoot, backupsRoot } = mkRoots();
  const v = researchFreshnessViolation(BOOK, Date.now() - 60_000, { runsRoot, backupsRoot });
  assert.ok(v, "no run dir must be flagged");
  assert.match(v ?? "", /no research run dir/);
});

test("A2 freshness: a run with no source sidecars is a violation", () => {
  const { runsRoot, backupsRoot } = mkRoots();
  mkdirSync(join(runsRoot, BOOK, "20260702-120000", "sidecars", "source"), { recursive: true });
  const v = researchFreshnessViolation(BOOK, Date.now() - 60_000, { runsRoot, backupsRoot });
  assert.ok(v, "a sidecar-less run must be flagged");
  assert.match(v ?? "", /no sidecars\/source/);
});

test("A2 freshness: stale mtimes (nothing written during the task) are a violation", () => {
  const { runsRoot, backupsRoot } = mkRoots();
  writeRun(runsRoot, BOOK, "20260702-120000", SIDECARS);
  // The task "starts" AFTER every sidecar was written → every mtime <= task start.
  const taskStartedAtMs = Date.now() + 60_000;
  const v = researchFreshnessViolation(BOOK, taskStartedAtMs, { runsRoot, backupsRoot });
  assert.ok(v, "a run whose sidecars all predate the task must be flagged");
  assert.match(v ?? "", /was written during the research task/);
});

test("A2 freshness: a byte-identical restore of an archived run is a violation even with fresh mtimes", () => {
  const { runsRoot, backupsRoot } = mkRoots();
  const runName = "20260601-090000";
  writeBackup(backupsRoot, `${BOOK}-regen-1`, BOOK, runName, SIDECARS);
  // The "restore": same run name, same bytes, copied during the task (fresh mtimes),
  // so only the backup content comparison can catch it.
  writeRun(runsRoot, BOOK, runName, SIDECARS);
  const v = researchFreshnessViolation(BOOK, Date.now() - 60_000, { runsRoot, backupsRoot });
  assert.ok(v, "a byte-identical restore must be flagged");
  assert.match(v ?? "", /byte-identical restore/);
});

test("A2 freshness: a same-named run with DIFFERENT sidecar content is NOT flagged as a restore", () => {
  const { runsRoot, backupsRoot } = mkRoots();
  const runName = "20260601-090000";
  writeBackup(backupsRoot, `${BOOK}-regen-1`, BOOK, runName, SIDECARS);
  writeRun(runsRoot, BOOK, runName, {
    ...SIDECARS,
    "ch02.source.json": JSON.stringify({ schemaVersion: "source-v2", chapterNumber: 2, testableFacts: ["fresh live research"] }),
  });
  assert.equal(researchFreshnessViolation(BOOK, Date.now() - 60_000, { runsRoot, backupsRoot }), null, "different content means live work happened — not a restore");
});

test("A2 freshness: a fresh run passes when backups exist but only for OTHER run names", () => {
  const { runsRoot, backupsRoot } = mkRoots();
  writeBackup(backupsRoot, `${BOOK}-regen-1`, BOOK, "20260101-000000", SIDECARS);
  writeRun(runsRoot, BOOK, "20260702-120000", SIDECARS);
  assert.equal(researchFreshnessViolation(BOOK, Date.now() - 60_000, { runsRoot, backupsRoot }), null, "same bytes under a DIFFERENT run name in backups is not a same-named restore");
});

// ── doResearch wiring (stubbed deps; no real codex / fs) ────────────────────

function researchStatus(): BookStatus {
  return {
    bookId: BOOK, stage: "research-bibliography", phase: "", expectedChapters: null,
    writtenChapters: 0, gatedChapters: 0, qcdChapters: 0, bookGatePass: null,
    bookGateBlockers: 0, deterministicClean: true, packaged: false, publishable: false, guardrails: false,
    variety: null, nextCommand: "", nextLabel: "", chapters: [],
  };
}

function wiringDeps(freshness: (bookId: string, taskStartedAtMs: number) => string | null, statuses: BookStatus[]): {
  deps: Partial<AutopilotDeps>;
  spawns: { sessionId: string; task: string }[];
  logs: string[];
  freshnessCalls: number[];
} {
  const spawns: { sessionId: string; task: string }[] = [];
  const logs: string[] = [];
  const freshnessCalls: number[] = [];
  let si = 0;
  let n = 0;
  const deps: Partial<AutopilotDeps> = {
    statusOf: () => statuses[Math.min(si++, statuses.length - 1)],
    runVerb: async () => ({ code: 0, stdout: "phase: research-bibliography", stderr: "" }),
    spawn: (async (o: { sessionId: string; task: string }) => {
      spawns.push({ sessionId: o.sessionId, task: o.task });
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "done", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    // The handoff contract LOOKS satisfied after every pass (the gamed scenario) —
    // only the freshness check can tell a restore from live research.
    expectedChapterNumbers: () => [1, 2],
    readTask: () => "RESEARCH PROMPT",
    mkSessionId: (label: string) => `${label}#${++n}`,
    sweepConfirmed: () => true,
    logSession: () => {},
    acquireLock: () => ({ ok: true, release: () => {} }),
    researchFreshness: (bookId, taskStartedAtMs) => {
      freshnessCalls.push(taskStartedAtMs);
      return freshness(bookId, taskStartedAtMs);
    },
    log: (m) => logs.push(m),
  };
  return { deps, spawns, logs, freshnessCalls };
}

test("A2 wiring: a freshness violation fails the pass, feeds the retry prompt, and exhausted passes halt content with the restore diagnosis", async () => {
  const { deps, spawns, logs } = wiringDeps(() => "newest research run r1 is a byte-identical restore of the archived backup at /b — restoring an archived run is not research", [researchStatus()]);
  const outcome = await runAutopilot({ architecture: "legacy", bookId: BOOK, deps });
  assert.equal(outcome.status, "halt");
  if (outcome.status === "halt") {
    assert.equal(outcome.phase, "research");
    assert.equal(outcome.category, "content", "a restore is a CONTENT failure (the work was faked), not infra/progress");
    assert.match(outcome.reason, /research restored an archived run instead of researching — remove backups from reach or re-dispatch research/);
    assert.match(outcome.reason, /byte-identical restore/);
  }
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("research")).length, 2, "the violated pass is retried once (bounded by RESEARCH_MAX_PASSES)");
  assert.match(spawns[1].task, /FAILED THE FRESHNESS CHECK/);
  assert.match(spawns[1].task, /byte-identical restore/);
  assert.match(spawns[1].task, /Restoring or copying ANY archived\/backup research run/);
  assert.ok(logs.some((l) => /FAILED the freshness check/.test(l)), "the violation is logged");
});

test("A2 wiring: violation then a genuinely fresh retry proceeds past research (freshness re-checked per pass)", async () => {
  let calls = 0;
  const shipped: BookStatus = { ...researchStatus(), packaged: true };
  const { deps, spawns, freshnessCalls } = wiringDeps(() => (++calls === 1 ? "no source sidecar in run r1 was written during the research task" : null), [researchStatus(), shipped]);
  const outcome = await runAutopilot({ architecture: "legacy", bookId: BOOK, deps });
  assert.equal(outcome.status, "shipped", "after a fresh retry the conductor moves on (next phase here: already shipped)");
  assert.equal(spawns.filter((s) => s.sessionId.startsWith("research")).length, 2, "one retry after the violated pass, none after the fresh one");
  assert.equal(freshnessCalls.length, 2, "the freshness check runs after EVERY pass that satisfies the handoff contract");
});
