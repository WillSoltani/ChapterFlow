/**
 * WP-205 — the consolidated deterministic FLOOR pass.
 *
 * Proves the four contract properties the consolidation must hold:
 *   1. BEHAVIOR-PRESERVED — the floor wrappers are a transparent delegation to the
 *      legacy gate functions: identical verdicts + identical findings on known-good
 *      and known-bad chapters/books (the before/after fail-set equivalence).
 *   2. ONCE-PER-UNIT (call counter) — a shared ledger gates each unit at most once
 *      per book run; a second gate of the same bytes is a cache hit (no recompute).
 *   3. NO DUPLICATE RE-RUN across stages — the major-policy scan reuses the ship /
 *      book gate the stage already computed (the promote/publish double-run is gone).
 *   4. FLOOR BEFORE D7 — the floor is a cheap deterministic pass with no dependency
 *      on the D7 close-read gate, and the publish preflight orders the floor checks
 *      before the d7-ship-gate check.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeGateCleanChapter, PIPELINE_DIR } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import { runShipGate } from "../src/critics/finalGate.js";
import { runBookGate } from "../src/critics/bookGate.js";
import { runIntraBookChecks } from "../src/critics/intraBook.js";
import { checkChapterIdentity } from "../src/lib/chapterPaths.js";
import {
  chapterFloorGate,
  bookFloorGate,
  chapterFloorIntra,
  chapterFloorIdentity,
  runChapterFloor,
  createFloorLedger,
  floorStats,
} from "../src/critics/deterministicFloor.js";
import { currentMajorFindings } from "../src/qc/majorDisposition.js";

const BOOK = "zz-floor-fixture";

/** A gate-clean chapter and a deliberately-blocked variant (short quiz → the
 *  A16.quiz_count_floor blocker + an em-dash → the B5 register blocker). */
function goodChapter(n: number): ChapterV21 {
  return makeGateCleanChapter(BOOK, n);
}
function badChapter(n: number): ChapterV21 {
  const ch = makeGateCleanChapter(BOOK, n);
  ch.quiz.questions = ch.quiz.questions.slice(0, 3); // A16.quiz_count_floor (blocker)
  ch.hook = "A hook with an em-dash — which the B5 register gate blocks."; // B5 (blocker)
  return ch;
}

// ── 1. BEHAVIOR-PRESERVED ─────────────────────────────────────────────────────

test("floor: chapterFloorGate is verdict- and finding-identical to runShipGate (good + bad)", () => {
  for (const ch of [goodChapter(1), badChapter(2)]) {
    const legacy = runShipGate(ch);
    const floor = chapterFloorGate(ch);
    assert.deepEqual(floor, legacy, `chapterFloorGate diverged from runShipGate for ch${ch.number}`);
    assert.equal(floor.passed, legacy.passed);
  }
  // The bad chapter really does block (guards against a fixture that silently passes).
  assert.equal(chapterFloorGate(badChapter(2)).passed, false, "bad fixture must fail the floor");
  assert.equal(chapterFloorGate(goodChapter(1)).passed, true, "good fixture must pass the floor");
});

test("floor: bookFloorGate is identical to runBookGate", () => {
  const chapters = [goodChapter(1), goodChapter(2), goodChapter(3)];
  assert.deepEqual(bookFloorGate(BOOK, chapters), runBookGate(BOOK, chapters));
});

test("floor: chapterFloorIntra / chapterFloorIdentity are identical to the legacy critics", () => {
  const chapters = [goodChapter(1), goodChapter(2)];
  assert.deepEqual(
    chapterFloorIntra(chapters[1], [chapters[0]]),
    runIntraBookChecks(chapters[1], [chapters[0]]),
  );
  const path = resolve(PIPELINE_DIR, "state", "chapters", `${BOOK}-ch01.v21-native.chapter.json`);
  assert.deepEqual(
    chapterFloorIdentity(chapters[0], path),
    checkChapterIdentity(chapters[0], path),
  );
});

test("floor: a cache HIT returns the identical verdict a recompute would (behavior-preserving memo)", () => {
  const ledger = createFloorLedger();
  const ch = goodChapter(1);
  const first = chapterFloorGate(ch, { ledger });
  const second = chapterFloorGate(ch, { ledger }); // cache hit
  assert.equal(second, first, "cache hit must return the memoized report");
  assert.deepEqual(second, runShipGate(ch), "the memoized verdict equals a fresh recompute");
});

// ── 2. ONCE-PER-UNIT (call counter) ───────────────────────────────────────────

test("floor: a shared ledger computes each unit at most once per book run", () => {
  const ledger = createFloorLedger();
  const ch = goodChapter(1);
  chapterFloorGate(ch, { ledger });
  chapterFloorGate(ch, { ledger });
  chapterFloorGate(ch, { ledger });
  const s = floorStats(ledger);
  assert.equal(s.chapterGate.calls, 3, "three wrapper invocations");
  assert.equal(s.chapterGate.computed, 1, "but the ship gate ran exactly ONCE on identical bytes");
});

test("floor: changed bytes are a cache MISS (never a stale reuse)", () => {
  const ledger = createFloorLedger();
  const a = goodChapter(1);
  const b = goodChapter(1);
  b.hook = `${b.hook} (edited after a repair)`;
  chapterFloorGate(a, { ledger });
  chapterFloorGate(b, { ledger });
  assert.equal(floorStats(ledger).chapterGate.computed, 2, "distinct content → recompute, no stale reuse");
});

test("floor: runChapterFloor composes ship + intra + identity into one verdict", () => {
  const priors = [goodChapter(1)];
  const ch = goodChapter(2);
  const path = resolve(PIPELINE_DIR, "state", "chapters", `${BOOK}-ch02.v21-native.chapter.json`);
  const res = runChapterFloor(ch, { priors, siblingContextPath: path });
  // Each sub-check delegates to the legacy critic verbatim.
  assert.deepEqual(res.shipGate, runShipGate(ch));
  assert.deepEqual(res.intra, runIntraBookChecks(ch, priors));
  assert.deepEqual(res.identity, checkChapterIdentity(ch, path));
  // The verdict is the union blocker count; passed iff zero blockers anywhere.
  const expectedBlockers =
    res.shipGate.blockers.length +
    res.intra.filter((f) => f.severity === "blocker").length +
    res.identity.filter((f) => f.severity === "blocker").length;
  assert.equal(res.blockers, expectedBlockers);
  assert.equal(res.passed, res.blockers === 0);
});

test("floor: advisory findings never flip the floor verdict — only blockers do", () => {
  // Ship-only floor (no priors/identity) over a gate-clean chapter: it passes even
  // though the ship gate surfaces advisory majors/minors (the D7-subsumed critics).
  const ch = goodChapter(1);
  const res = runChapterFloor(ch);
  assert.equal(res.shipGate.blockers.length, 0, "gate-clean chapter has no blockers");
  assert.equal(res.passed, true, "advisory majors/minors present but the floor still passes");
  assert.deepEqual(res.intra, []);
  assert.deepEqual(res.identity, []);
});

// ── 3. NO DUPLICATE RE-RUN across stages (the promote/publish double-run) ─────

test("floor: the major-policy scan reuses the stage's gate — no second runShipGate/runBookGate", () => {
  const chapters = [goodChapter(1), goodChapter(2), goodChapter(3)];
  const ledger = createFloorLedger();
  // Stage 1 (as promote/publish do): compute the ship gate per chapter + the book gate.
  for (const ch of chapters) chapterFloorGate(ch, { ledger });
  bookFloorGate(BOOK, chapters, { ledger });
  const warm = floorStats(ledger);
  assert.equal(warm.chapterGate.computed, chapters.length);
  assert.equal(warm.bookGate.computed, 1);

  // Stage 2: the majors scan over the SAME bytes + SAME ledger. Pre-WP-205 this
  // re-ran runShipGate per chapter and runBookGate again; now it is all cache hits.
  currentMajorFindings(BOOK, chapters, ledger);
  const after = floorStats(ledger);
  assert.equal(after.chapterGate.computed, warm.chapterGate.computed, "majors scan re-ran the ship gate");
  assert.equal(after.bookGate.computed, warm.bookGate.computed, "majors scan re-ran the book gate");
  assert.ok(after.chapterGate.calls > warm.chapterGate.calls, "the majors scan DID call the floor (as cache hits)");
});

// ── 4. FLOOR BEFORE D7 ────────────────────────────────────────────────────────

test("floor: the deterministic floor has no dependency on the D7 close-read gate", () => {
  const src = readFileSync(resolve(PIPELINE_DIR, "src", "critics", "deterministicFloor.ts"), "utf8");
  assert.ok(!/d7ShipGate|rubricAudit|renderRaterTaskDocument/.test(src),
    "the floor must be a cheap deterministic pass, independent of (and preceding) the D7 gate");
});

test("floor: the publish preflight orders the deterministic floor checks BEFORE the d7-ship-gate", () => {
  const src = readFileSync(resolve(PIPELINE_DIR, "src", "qc", "publishAfterQc.ts"), "utf8");
  const shipIdx = src.indexOf('check: "ship-gate"');
  const bookIdx = src.indexOf('check: "book-gate"');
  const d7Idx = src.indexOf('check: "d7-ship-gate"');
  assert.ok(shipIdx > 0 && bookIdx > 0 && d7Idx > 0, "all three preflight checks present");
  assert.ok(shipIdx < d7Idx, "ship-gate (floor) must precede d7-ship-gate");
  assert.ok(bookIdx < d7Idx, "book-gate (floor) must precede d7-ship-gate");
});

// Guard: the fixtures depend on makeGateCleanChapter passing on this machine.
if (chapterFloorGate(goodChapter(1)).passed !== true) {
  skip("floor: fixture sanity", "makeGateCleanChapter does not pass the gate in this environment");
}
