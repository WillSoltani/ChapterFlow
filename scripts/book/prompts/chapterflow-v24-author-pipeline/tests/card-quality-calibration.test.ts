/**
 * W2 CALIBRATION HARNESS (plan §WS5) — reproducible, PINNED expectations for the
 * three card-quality gates against the real book-packages/*.v21.json corpus.
 *
 * This is the committed proof that the gates are calibrated:
 *   (i)  the TOP-5 owner-scored packages pass with zero/near-zero failures, and
 *   (ii) the published the-power-of-moments v24 package flags the 4 KNOWN echo
 *        lifts (ch4 q05, ch5 q09, ch9 q02, ch10 q06) AND fails the shortest-side
 *        length-tell (51% key-uniquely-shortest).
 *
 * SHAPE-AGNOSTIC: packages are the SLIM shape (chapters embedded, no chapter-level
 * schemaVersion); the gates run identically at authoring time on loose
 * state/chapters. The harness casts the slim package chapters to the gate's
 * duck-typed input — the fields the gates read (quiz, breakdown, examples,
 * reviewCards, implementationPlan, tryThisNow, …) are present in both shapes.
 *
 * If any pinned expectation changes, this test FAILS — the gate has drifted and
 * the calibration must be re-derived and re-documented in
 * docs/v24/w2-card-preflight-calibration.md before shipping. When the corpus
 * packages are absent (a fresh checkout without book-packages/) the harness
 * SKIPS with a reason rather than silently passing.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { skip, test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import {
  cardQualityChapter,
  echoTellChapter,
  lengthTellChapter,
  practiceFloorChapter,
} from "../src/metrics/cardQualityGates.js";
import { computeChapterRubricMetrics, computeBookRubricMetrics } from "../src/metrics/bookRubricMetrics.js";
import { DEFAULT_CARD_QUALITY_THRESHOLDS, loadRubricThresholds } from "../src/metrics/rubricThresholds.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// pipeline dir is scripts/book/prompts/chapterflow-v24-author-pipeline; the
// calibration corpus lives at repo-root/book-packages.
const REPO_ROOT = resolve(HERE, "../../../../..");
const PKG_DIR = resolve(REPO_ROOT, "book-packages");

const OPTS = {
  keyThreshold: DEFAULT_CARD_QUALITY_THRESHOLDS.echoKeyThreshold,
  distractorCeiling: DEFAULT_CARD_QUALITY_THRESHOLDS.echoDistractorCeiling,
  shortestMax: DEFAULT_CARD_QUALITY_THRESHOLDS.lengthTellShortestMax,
  longestMax: DEFAULT_CARD_QUALITY_THRESHOLDS.lengthTellLongestMax,
};

const TOP5 = ["atomic-habits", "crucial-conversations", "games-people-play", "thinking-in-bets", "the-happiness-hypothesis"];
const POM = "the-power-of-moments";

type SlimPackage = { chapters?: unknown[] };

function pkgPath(id: string): string {
  return resolve(PKG_DIR, `${id}.v21.json`);
}

/** Load a slim package's chapters as gate inputs (duck-typed). */
function loadChapters(id: string): ChapterV21[] {
  const raw = JSON.parse(readFileSync(pkgPath(id), "utf8")) as SlimPackage;
  const chapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  return chapters as unknown as ChapterV21[];
}

function corpusPresent(ids: string[]): boolean {
  return ids.every((id) => existsSync(pkgPath(id)));
}

/** Book-level roll-up of the per-chapter gate results, for pinned assertions. */
function calibrate(id: string) {
  const chapters = loadChapters(id);
  let echoFlags = 0;
  let shortestFailChapters = 0;
  let longestFailChapters = 0;
  let practiceFailChapters = 0;
  let anyGateFailChapters = 0;
  let totalShortest = 0;
  let totalLongest = 0;
  let totalQuestions = 0;
  const echoDetail: string[] = [];
  const practiceFailNumbers: number[] = [];

  for (const ch of chapters) {
    const echo = echoTellChapter(ch, OPTS);
    const len = lengthTellChapter(ch, OPTS);
    const practice = practiceFloorChapter(ch);
    const combined = cardQualityChapter(ch, OPTS);

    echoFlags += echo.flagged.length;
    for (const qid of echo.flagged) echoDetail.push(`ch${ch.number}:${qid}(n=${echo.questions.find((q) => q.questionId === qid)?.keyNgram})`);
    if (len.shortestFail) shortestFailChapters += 1;
    if (len.longestFail) longestFailChapters += 1;
    if (practice.fail) { practiceFailChapters += 1; practiceFailNumbers.push(ch.number); }
    if (combined.fail) anyGateFailChapters += 1;
    totalShortest += len.uniquelyShortest;
    totalLongest += len.uniquelyLongest;
    totalQuestions += len.questionCount;
  }

  return {
    chapters: chapters.length,
    echoFlags,
    echoDetail: echoDetail.sort(),
    shortestFailChapters,
    longestFailChapters,
    practiceFailChapters,
    practiceFailNumbers: practiceFailNumbers.sort((a, b) => a - b),
    anyGateFailChapters,
    shortestPct: totalQuestions ? Math.round((1000 * totalShortest) / totalQuestions) / 10 : NaN,
    longestPct: totalQuestions ? Math.round((1000 * totalLongest) / totalQuestions) / 10 : NaN,
  };
}

// ── (i) TOP-5 owner-scored books pass the BLOCKING gates ───────────────────────

/** The BLOCKING per-chapter verdict for a book: how many chapters would the
 *  bookRubricMetrics gate drive to `fail` PURELY via the two BLOCKING W2 gates
 *  (lengthTell shortest/longest + practiceFloor). echoTell is advisory (warn) and
 *  MUST NOT appear here. Uses the real thresholds + real compute path. */
function blockingCardQualityFailChapters(id: string): { total: number; byGate: Record<string, number[]> } {
  const thresholds = loadRubricThresholds();
  const chapters = loadChapters(id);
  const byGate: Record<string, number[]> = { lengthTell: [], practiceFloor: [], echoTell: [] };
  let total = 0;
  for (const ch of chapters) {
    const m = computeChapterRubricMetrics(ch, thresholds);
    const cqFailing = m.failing.filter((k) => k === "lengthTell" || k === "practiceFloor" || k === "echoTell");
    for (const k of cqFailing) byGate[k].push(ch.number);
    if (cqFailing.length > 0) total += 1;
    // echoTell must NEVER be in the failing set (it is advisory/warn).
    assert.ok(!m.failing.includes("echoTell"), `${id} ch${ch.number}: echoTell must be advisory, never in the failing set`);
  }
  return { total, byGate };
}

if (!corpusPresent(TOP5)) {
  skip("calibration: TOP-5 owner books clear the W2 gates", `book-packages/ missing for ${TOP5.join(", ")}`);
} else {
  test("calibration: echo-tell is ADVISORY — the top-5 carry ≥5-token key echoes at the SAME rate as POM (so it cannot block)", () => {
    // The forensics claim "near-zero FP" was measured only on POM. The full corpus
    // shows ≥5-token key echoes are a NORMAL feature of 85.3 owner books, from the
    // same fields (review cards, breakdown, plans, examples) and coverage (up to
    // 1.0) as POM's flagged 4. This test PINS that reality so nobody re-promotes
    // echo to a hard gate: the top-5 collectively carry a non-trivial echo count.
    const counts = Object.fromEntries(TOP5.map((id) => [id, calibrate(id).echoFlags]));
    const totalTop5 = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.ok(totalTop5 >= 10, `top-5 echo flags should be substantial (~14), got ${totalTop5}: ${JSON.stringify(counts)}`);
    // Concretely: atomic-habits (85.3) itself carries 4 — the SAME as POM (74.7).
    assert.equal(counts["atomic-habits"], 4, `atomic-habits echo flags drifted: ${counts["atomic-habits"]}`);
  });

  test("calibration: TOP-5 owner books clear the BLOCKING length-tell, both sides", () => {
    for (const id of TOP5) {
      const c = calibrate(id);
      // SHORTEST length-tell: no chapter exceeds the 4/9 cap (the-happiness-hypothesis peaks AT 4/9 → pass).
      assert.equal(c.shortestFailChapters, 0, `${id}: expected 0 shortest-tell chapters, got ${c.shortestFailChapters} (book shortest%=${c.shortestPct})`);
      // LONGEST length-tell: the historical house norm (keys are the longest choice)
      // must NOT gate at the calibrated cap of 9 — else the top-5 would fail.
      assert.equal(c.longestFailChapters, 0, `${id}: longest cap must pass the top-5 norm (book longest%=${c.longestPct})`);
    }
  });

  test("calibration: TOP-5 practice-floor hits are the two DOCUMENTED near-zero cases (games-people-play ch8, thinking-in-bets ch6)", () => {
    // The practice floor requires (number|timebox) AND imperative. Two top-5
    // chapters carry legitimate imperative practice ("write the strongest
    // objection", "write the sentence") that lack any digit/number-word/timebox.
    // That is 2 of 60 chapters (3.3%) — "near-zero" per the spec — and is
    // documented in docs/v24/w2-card-preflight-calibration.md. Pinning the EXACT
    // set makes a regression (new FPs) fail loudly.
    const expected: Record<string, number[]> = {
      "atomic-habits": [],
      "crucial-conversations": [],
      "games-people-play": [8],
      "thinking-in-bets": [6],
      "the-happiness-hypothesis": [],
    };
    for (const id of TOP5) {
      const c = calibrate(id);
      assert.deepEqual(c.practiceFailNumbers, expected[id], `${id}: practice-floor FP set drifted (got ${c.practiceFailNumbers.join(",")})`);
    }
  });

  test("calibration: TOP-5 BLOCKING card-quality fails = only the 2 documented practice hits (via the real compute path)", () => {
    // Through bookRubricMetrics' real gate: the ONLY blocking card-quality
    // failures across all 60 top-5 chapters are games-people-play ch8 and
    // thinking-in-bets ch6 (practice floor). Nothing blocks on length-tell; echo
    // never blocks. 2/60 = 3.3% = "near-zero" per the spec.
    let totalBlocking = 0;
    for (const id of TOP5) {
      const b = blockingCardQualityFailChapters(id);
      assert.deepEqual(b.byGate.lengthTell, [], `${id}: length-tell must not block any top-5 chapter`);
      assert.deepEqual(b.byGate.echoTell, [], `${id}: echo-tell must never block (advisory)`);
      totalBlocking += b.total;
    }
    assert.equal(totalBlocking, 2, `exactly 2 documented blocking hits across the top-5, got ${totalBlocking}`);
  });
}

// ── (ii) the-power-of-moments v24 fails as the forensics measured ──────────────

if (!corpusPresent([POM])) {
  skip("calibration: the-power-of-moments v24 flags the known lifts and the shortest tell", `book-packages/${POM}.v21.json missing`);
} else {
  test("calibration: POM v24 echo-tell flags EXACTLY the 4 known verbatim key lifts", () => {
    const c = calibrate(POM);
    // ch10 q06 (n=7, example whatToDo), ch4 q05 (n=6, review card), ch9 q02 (n≥5,
    // scenario), ch5 q09 (n≥5, fullRead) — the four manually-verified sentence lifts.
    assert.equal(c.echoFlags, 4, `expected exactly 4 echo flags, got ${c.echoFlags} (${c.echoDetail.join(", ")})`);
    const flaggedQuestions = new Set(c.echoDetail.map((d) => d.split("(")[0]));
    for (const known of ["ch4:q05", "ch5:q09", "ch9:q02", "ch10:q06"]) {
      assert.ok(flaggedQuestions.has(known), `known lift ${known} must be flagged (flagged: ${[...flaggedQuestions].join(", ")})`);
    }
  });

  test("calibration: POM v24 FAILS the shortest-side length-tell (51% key-uniquely-shortest)", () => {
    const c = calibrate(POM);
    // The v24 rewrite overcorrected the classic longest-key tell (42%→4%) into a
    // shortest-key tell (21%→51%). The shortest side MUST gate; the longest side
    // must not (it is now clean at ~4%).
    assert.ok(c.shortestPct >= 45, `POM shortest% should be ~51, got ${c.shortestPct}`);
    assert.ok(c.shortestFailChapters > 0, `POM must have chapters failing the shortest-tell cap, got ${c.shortestFailChapters}`);
    assert.equal(c.longestFailChapters, 0, `POM's longest% is now ~4 — longest side must NOT gate (got ${c.longestFailChapters} fails, longest%=${c.longestPct})`);
  });

  test("calibration: POM v24 is BLOCKED by the real gate via the shortest length-tell (not echo)", () => {
    const thresholds = loadRubricThresholds();
    const report = computeBookRubricMetrics(POM, { chapters: loadChapters(POM), thresholds });
    // The book verdict is fail, driven by lengthTell on the shortest side.
    assert.equal(report.verdict, "fail", "POM v24 must fail the book-level rubric gate");
    const blockedByLength = report.chapters.filter((c) => c.failing.includes("lengthTell"));
    assert.ok(blockedByLength.length > 0, `POM must have chapters blocked on lengthTell, got ${blockedByLength.length}`);
    // echo remains advisory even here — it must not be in any failing set.
    assert.ok(report.chapters.every((c) => !c.failing.includes("echoTell")), "echoTell stays advisory on POM too");
  });
}
