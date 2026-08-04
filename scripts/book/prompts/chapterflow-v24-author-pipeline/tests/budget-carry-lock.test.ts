/**
 * Budget-repair carry-lock (CONVERGENCE-SAFE PASS, 2026-07-05).
 *
 * Proves the fix for budget-repair carry-churn: the book-wide reader-budget round
 * must NEVER full-re-author a chapter holding a durable PASS to satisfy a book-wide
 * budget a sibling's edit shifted (the bug that regressed ch04 85.6→73.4). Three
 * layers:
 *   (1) partitionBudgetBlockers — the pure routing brain (route vs downgrade).
 *   (2) holdsDurablePass — the PASS-lock predicate + fail-direction.
 *   (3) ensureReaderBudgetsClean — integration: a PASS-locked CHB1 blocker is
 *       downgraded (no writer spawned, converged), and the SAME blocker on an
 *       UNLOCKED chapter still engages the repair round.
 *
 * The integration seeds review history under the REAL CANONICAL_STATE (holdsDurablePass
 * reads the default root) with a zz-fixture bookId, fully cleaned up after.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterReviewV1,
  type ReviewFactor,
  type SourcePacketV1,
} from "../src/artifacts/artifactTypes.js";
import { checkReaderBudgets, type BudgetFinding } from "../src/critics/readerBudgets.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { chapterReaderDocHash, REVIEW_DOC_HASH_VERSION } from "../src/review/readerReview.js";
import {
  appendReviewHistory,
  holdsDurablePass,
  loadReopenNotes,
  reviewDir,
} from "../src/orchestrator/authorReviewLedger.js";
import {
  ensureReaderBudgetsClean,
  partitionBudgetBlockers,
  resolveAuthorIo,
  type AuthorIo,
} from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";

const BOOK = "zz-fixture-carry-lock";
const BOOK_RUNS_DIR = join(PIPELINE_DIR, "state", "books", BOOK, "runs");
const BOOK_RUNS_DIR_EXISTED = existsSync(BOOK_RUNS_DIR);

function mkPacket(n: number, caseLabels: string[]): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: `Chapter ${n}`,
    sourceSidecarPath: null,
    sourceHash: null,
    facts: [],
    namedCases: caseLabels.map((label, i) => ({
      id: `ch${n}.case.${i + 1}`,
      label,
      summary: `${label} summary.`,
      realWorld: true,
      hardSpecifics: [],
      allowedUses: [],
      forbiddenUses: [],
      doNotRestamp: [],
    })),
    frameworks: [],
    allowedAnchors: [],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "strong", risks: [] },
  };
}

/** A chapter whose reading surface hammers a packet-anchor token `count` times —
 *  enough (≥ repCap*2 = 12) to make CHB1 a BLOCKER. */
function anchorHammerChapter(n: number, count: number): ChapterV21 {
  const ch = makeChapter(BOOK, n);
  ch.breakdown.deepRead += " The popsicle hotline rang." + " The popsicle stayed cold.".repeat(count - 1);
  return ch;
}

function mkReview(ch: ChapterV21, over: Partial<ChapterReviewV1> = {}): ChapterReviewV1 {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 88])) as Record<ReviewFactor, number>;
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: ch.chapterId,
    chapterNumber: ch.number,
    contentHash: chapterContentHash(ch),
    reviewerSessionId: "indep-reviewer-1",
    scores,
    composite: 88,
    ship84: true,
    pass: true,
    valid: true,
    keyCheck: { derived: [], matches: 9, of: 9, disagreements: [] },
    quotes: [{ quote: ch.title, why: "ok", verified: true }],
    tells: [],
    complaints: [],
    oneParagraphVerdict: "ships",
    bar: 80,
    docHash: chapterReaderDocHash(ch),
    hashVersion: REVIEW_DOC_HASH_VERSION,
    reviewedAt: new Date().toISOString(),
    ...over,
  };
}

// ── (1) partitionBudgetBlockers — the routing brain ──────────────────────────

test("partitionBudgetBlockers: a blocker carried ONLY by PASS-locked chapters is DOWNGRADED; any unlocked carrier keeps it routed", () => {
  const ch1 = anchorHammerChapter(1, 12); // CHB1 blocker, carrier = ch01
  const ch2 = makeChapter(BOOK, 2);
  const chapters = [ch1, ch2];
  const packets = new Map([[1, mkPacket(1, ["Popsicle Hotline"])], [2, mkPacket(2, ["Emerson Electric"])]]);
  const blockers = checkReaderBudgets(chapters, { packets }).filter((f) => f.severity === "blocker" && f.checkId === "CHB1.anchor_repetition");
  assert.equal(blockers.length, 1, "setup: exactly one CHB1 blocker on ch01");

  // ch01 (its only carrier) is PASS-locked → downgraded, deadlock-free.
  const locked = partitionBudgetBlockers(chapters, blockers, (n) => n === 1);
  assert.equal(locked.downgraded.length, 1, "all-locked carrier → downgraded");
  assert.equal(locked.route.length, 0, "nothing routed when the sole carrier is locked");

  // ch01 unlocked → routed for a full repair (unchanged behavior).
  const unlocked = partitionBudgetBlockers(chapters, blockers, () => false);
  assert.equal(unlocked.route.length, 1, "unlocked carrier → routed");
  assert.equal(unlocked.downgraded.length, 0);
});

test("partitionBudgetBlockers: a blocker with NO routable carrier stays in route (so the no-evidence halt still fires)", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  // CHB7 is not a routed family in buildBudgetRepairComplaints → carriers === [].
  const orphan: BudgetFinding = { checkId: "CHB7.some_unrouted", severity: "blocker", chapterNumber: 1, message: "x" };
  const part = partitionBudgetBlockers(chapters, [orphan], () => true /* everything "locked" */);
  assert.equal(part.route.length, 1, "an unattributable blocker is never silently downgraded");
  assert.equal(part.downgraded.length, 0);
});

// ── (2) holdsDurablePass — the PASS-lock predicate + fail-direction ───────────

test("holdsDurablePass: a matching independent PASS at the bar → locked; unknown bar / reviewer==author / no record → NOT locked", () => {
  const ch = anchorHammerChapter(1, 12);
  const root = mkdtempSync(join(tmpdir(), "carry-lock-"));
  try {
    appendReviewHistory(BOOK, mkReview(ch), root);
    assert.equal(holdsDurablePass(BOOK, ch, 80, "the-author", root), true, "matching PASS at bar 80 → locked");
    // Fail-direction: unknown bar → NOT locked (can only protect, never hide).
    assert.equal(holdsDurablePass(BOOK, ch, undefined, "the-author", root), false, "undefined bar → not locked");
    // Independence: the current author was the reviewer → NOT locked.
    assert.equal(holdsDurablePass(BOOK, ch, 80, "indep-reviewer-1", root), false, "reviewer==author → not locked");
    // Different bar → NOT locked.
    assert.equal(holdsDurablePass(BOOK, ch, 84, "the-author", root), false, "bar mismatch → not locked");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("holdsDurablePass: no history for the chapter → NOT locked", () => {
  const ch = makeChapter(BOOK, 3);
  const root = mkdtempSync(join(tmpdir(), "carry-lock-empty-"));
  try {
    assert.equal(holdsDurablePass(BOOK, ch, 80, "the-author", root), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── (3) ensureReaderBudgetsClean — integration ───────────────────────────────

/** Minimal deps that record every writer spawn and never actually author. */
function mkDeps(): { deps: AutopilotDeps; spawns: string[]; logs: string[] } {
  const spawns: string[] = [];
  const logs: string[] = [];
  let n = 0;
  const deps = {
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o.sessionId);
      // Return a non-chapter message → any writer that IS spawned fails its own
      // verification (we only assert on whether the spawn was attempted).
      return { ok: true, exitCode: 0, finalMessage: "not a chapter", stdout: "not a chapter", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    log: (m: string) => { logs.push(m); },
    expectedChapterNumbers: () => [1, 2],
    runVerb: async () => ({ code: 0, stdout: "PASS", stderr: "" }),
  } as unknown as AutopilotDeps;
  return { deps, spawns, logs };
}

function mkIo(chapters: ChapterV21[]): AuthorIo {
  const packets = new Map([[1, mkPacket(1, ["Popsicle Hotline"])], [2, mkPacket(2, ["Emerson Electric"])]]);
  return resolveAuthorIo({
    nameBankOk: () => true,
    loadChapters: () => chapters,
    chapterExists: () => true,
    authorSessionOf: () => "the-author",
    readPacket: (_b, nn) => packets.get(nn) ?? null,
    // A budget matching the ~16.4k-char fixtures (±30%) so CHB2 (length) never
    // fires — isolate CHB1 as the ONLY blocker under test.
    readBrief: () => ({ lengthBudget: { renderedChars: 16400, tolerance: 0.3 } }) as never,
  });
}

test("ensureReaderBudgetsClean: a PASS-locked chapter's CHB1 blocker is DOWNGRADED — no writer spawned, converges, protected-downgrade note recorded", async () => {
  const ch1 = anchorHammerChapter(1, 12); // CHB1 blocker on ch01
  const ch2 = makeChapter(BOOK, 2);
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  try {
    // Seed a durable PASS for ch01 at bar 80 under the REAL state root.
    appendReviewHistory(BOOK, mkReview(ch1));
    const { deps, spawns } = mkDeps();
    const outcome = await ensureReaderBudgetsClean(BOOK, deps, mkIo([ch1, ch2]), {
      maxParallel: 2, heartbeat: () => true, haltPhase: "qc", label: "test budgets", bar: 80,
    });
    assert.equal(outcome, null, "PASS-locked CHB1 blocker downgraded → converges clean");
    assert.equal(spawns.filter((s) => s.startsWith("author-ch")).length, 0, "no writer spawned for a PASS-locked chapter");
    const notes = loadReopenNotes(BOOK);
    assert.ok(notes.some((nt) => nt.chapterNumber === 1 && nt.decision === "protected-downgrade"), "a protected-downgrade forensic note is recorded");
  } finally { rmSync(reviewDir(BOOK), { recursive: true, force: true }); }
});

test("ensureReaderBudgetsClean: the SAME CHB1 blocker on an UNLOCKED chapter still engages the repair round (NOT downgraded)", async () => {
  const ch1 = anchorHammerChapter(1, 12);
  const ch2 = makeChapter(BOOK, 2);
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  try {
    // No review history → ch01 is NOT PASS-locked.
    const { deps, logs } = mkDeps();
    const outcome = await ensureReaderBudgetsClean(BOOK, deps, mkIo([ch1, ch2]), {
      maxParallel: 2, heartbeat: () => true, haltPhase: "qc", label: "test budgets", bar: 80,
    });
    // The round ENGAGES over ch01 (it then fails on missing brief infra → halt),
    // proving the blocker is NOT silently downgraded when the chapter is unlocked.
    assert.ok(logs.some((l) => /budget-repair round over/.test(l) && /ch01/.test(l)), "unlocked CHB1 blocker routes into the repair round (round engaged)");
    assert.ok(!logs.some((l) => /downgraded to advisory/.test(l)), "an unlocked blocker is never downgraded");
    assert.ok(outcome && outcome.status === "halt", "the failed repair round halts (fail-closed) — no false convergence");
  } finally { rmSync(reviewDir(BOOK), { recursive: true, force: true }); }
});

test("ensureReaderBudgetsClean: write-entry (bar omitted) is INERT — a PASS-locked chapter is ignored, behavior unchanged", async () => {
  const ch1 = anchorHammerChapter(1, 12);
  const ch2 = makeChapter(BOOK, 2);
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  try {
    appendReviewHistory(BOOK, mkReview(ch1)); // even with a PASS on disk…
    const { deps, logs } = mkDeps();
    const outcome = await ensureReaderBudgetsClean(BOOK, deps, mkIo([ch1, ch2]), {
      maxParallel: 2, heartbeat: () => true, haltPhase: "write", label: "test budgets",
      // bar OMITTED → no lock computed → the round runs exactly as before the fix.
    });
    assert.ok(!logs.some((l) => /hold a durable PASS/.test(l)), "with no bar, nothing is treated as PASS-locked");
    assert.ok(logs.some((l) => /budget-repair round over/.test(l) && /ch01/.test(l)), "with no bar, the blocker routes (pre-fix behavior)");
    assert.ok(outcome && outcome.status === "halt", "fail-closed unchanged at the write entry");
  } finally { rmSync(reviewDir(BOOK), { recursive: true, force: true }); }
});

test("budget-carry-lock fixtures remove owned run directories", () => {
  if (!BOOK_RUNS_DIR_EXISTED) rmSync(BOOK_RUNS_DIR, { recursive: true, force: true });
});
