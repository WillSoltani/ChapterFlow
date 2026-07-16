/**
 * WP-402 — deterministic-floor threshold reconciliation (tellRate vs lengthTell).
 *
 * The `tellRate` metric (fraction of quiz questions whose KEY is the uniquely-
 * LONGEST choice) was DEMOTED from a BLOCKING gate to WARN-ONLY advisory per
 * ledger L-14 D-9(a). This file pins the reconciled semantics + the zero-false-
 * positive calibration:
 *
 *   (1) SEMANTICS — a chapter whose keys are the uniquely-LONGEST choice at any
 *       rate (up to 9/9) is NOT `fail`: tellRate only ever WARNS now. The genuine
 *       key-length defect is the SHORTEST side, which the symmetric `lengthTell`
 *       gate STILL BLOCKS at shortestMax=4 — a >4/9 uniquely-shortest chapter IS
 *       `fail`. (safety preserved.)
 *
 *   (2) CALIBRATION — over a deterministic 10-package sample of the owner corpus
 *       (book-packages/*.v21.json), ZERO chapters have `tellRate` in the failing
 *       set (no false-positive blockers), the warn tier fires exactly on the
 *       chapters the old 0.20 gate would have blocked, the-power-of-moments v24
 *       still FAILS the shortest-side length-tell, and a book that used to fail
 *       ONLY on tellRate (how-to-talk-to-anyone) now clears the blocking gates.
 *
 * The full 140-package sweep (1,718/1,903 would-be blockers → 0; 2 books flip
 * fail→warn) is documented in docs/v24/w2-card-preflight-calibration.md §(d); the
 * 10-package sample here reproduces every invariant fast enough for the suite.
 * When the corpus is absent (a fresh checkout without book-packages/) the
 * calibration SKIPS with a reason rather than silently passing.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { skip, test } from "./harness.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";
import { computeChapterRubricMetrics, computeBookRubricMetrics } from "../src/metrics/bookRubricMetrics.js";
import { loadRubricThresholds, type RubricThresholds } from "../src/metrics/rubricThresholds.js";

// Isolate the two signals under test: SHIPPED tellRateMax (0.2) + SHIPPED
// cardQuality length-tell caps (shortest 4, longest 9); everything else wide so
// only tellRate / lengthTell can move the verdict.
const ISO: RubricThresholds = {
  schemaVersion: "rubric-thresholds-v1",
  fleschEase: { min: -1000, max: 1000, warnTolerance: 0 },
  fkGrade: { min: -1000, max: 1000, warnTolerance: 0 },
  tellRateMax: 0.2,
  transferMin: 0,
  memorableCleanMin: 0,
  houseTicDensityWarnMax: 100,
  nominalizationRateWarnMax: 100,
  cardQuality: { echoKeyThreshold: 999, echoDistractorCeiling: 998, lengthTellShortestMax: 4, lengthTellLongestMax: 9 },
};

const LONGEST_KEY = ["No.", "Maybe not, in a sense.", "This is by far the single longest and most detailed keyed answer choice of them all here."];
const SHORTEST_KEY = ["Yes.", "A considerably longer distractor choice that runs much wider than the key.", "Another distinctly long distractor choice that also runs much wider than the key."];
const NEUTRAL = ["aaaaaaaa", "bbbbbbbb", "cccccccc"]; // equal length → no unique extreme

/** Build a chapter whose 9 quiz questions have the key uniquely-LONGEST or
 *  uniquely-SHORTEST in exactly `count` of them (the rest are length-neutral).
 *  Every non-quiz field is set so ONLY tellRate / lengthTell can move the verdict
 *  (practice floor satisfied, ≥0 memorable lines, etc.). */
function chapterWithKeyExtreme(bookId: string, kind: "longest" | "shortest", count: number): ChapterV21 {
  const questions: NonNullable<ChapterV21["quiz"]>["questions"] = [];
  for (let i = 0; i < 9; i++) {
    const extreme = i < count;
    const choices = extreme ? (kind === "longest" ? LONGEST_KEY : SHORTEST_KEY) : NEUTRAL;
    const correctIndex = extreme ? (kind === "longest" ? 2 : 0) : 0;
    questions.push({
      questionId: `q${String(i + 1).padStart(2, "0")}`,
      prompt: `Question ${i + 1}: what is the move here?`,
      choices,
      correctIndex,
      explanation: "The keyed answer is set to control the length-tell signal for this question.",
      bloomsLevel: "remember",
      depthLevel: "simple",
    });
  }
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: `${bookId}-ch01`,
    number: 1,
    title: "Key-length fixture",
    readingTimeMinutes: 7,
    hook: "A short hook goes here.",
    keyTakeaway: "A short takeaway sentence that carries the single idea forward for the reader today.",
    breakdown: { fastRead: "The check is small. You do it first.", deepRead: "The check is small. You do it first. It saves a day.", fullRead: "The check is small. You do it first. It saves a day. Start with the last entry." },
    examples: [
      {
        exampleId: "ex01",
        title: "An example",
        tags: ["practice"],
        planSpec: { domain: "work", audience: "a reader", stakes: "time", format: "vignette", requiredBeat: "the skip" },
        scenario: "A manager reviewed the record and noticed the totals disagreed with the prior note before continuing.",
        whatToDo: "Pause and re-check the entry against yesterday before adding anything new to the log today.",
        whyItMatters: "Small drift becomes expensive rework later when nobody compares the totals in time.",
      },
    ],
    quiz: { passingScorePercent: 70, questions },
    reviewCards: [{ cardId: "card01", front: "What is the first move?", back: "Compare the entry against the prior day first.", difficulty: "easy" }],
    implementationPlan: {
      title: "Catch drift early",
      coreSkill: "Noticing drift while it is still one record wide, every time, without negotiating with yourself.",
      ifThenPlans: [{ context: "starting a shift", plan: "If I open the log, then I compare the last entry with the prior day." }],
      twentyFourHourChallenge: "Once today, write down which record you expect to be wrong and check that one first.",
      weeklyPractice: "Each week, audit three days of entries against their source notes.",
    },
    memorableLines: [
      { text: "The early check is the only cheap one you will ever get.", location: "keyTakeaway", why: "It compresses the cost asymmetry." },
      { text: "Drift is quiet until it is expensive.", location: "breakdown", why: "It names the stakes." },
    ],
  };
}

// ── (1) SEMANTICS ────────────────────────────────────────────────────────────

test("WP-402 semantics: a 9/9 uniquely-LONGEST-key chapter is NOT fail (tellRate warns, lengthTell longest ≤ 9)", () => {
  const r = computeChapterRubricMetrics(chapterWithKeyExtreme("zz-longest", "longest", 9), ISO);
  // tellRate value is still measured (9/9 → 1.0) but it can only WARN now.
  assert.equal(r.metrics.tellRate.value, 1, "9/9 uniquely-longest keys → tell rate 1.0 (still measured)");
  assert.equal(r.metrics.tellRate.verdict, "warn", "tellRate 1.0 > 0.2 → WARN, never fail (WP-402)");
  assert.ok(!r.failing.includes("tellRate"), `tellRate must not be in the failing set (failing=${r.failing.join(",")})`);
  // The symmetric longest-side length-tell cap is 9, so 9/9 does NOT trip it either.
  assert.ok(!r.failing.includes("lengthTell"), `9/9 uniquely-longest must not trip the longest cap of 9 (failing=${r.failing.join(",")})`);
  // Net: the chapter is warn (from tellRate), NEVER fail.
  assert.notEqual(r.verdict, "fail", `a uniquely-longest-key chapter must not fail (verdict=${r.verdict}, failing=${r.failing.join(",")})`);
  assert.equal(r.verdict, "warn", "the only non-pass signal is the tellRate advisory → chapter verdict is warn");
});

test("WP-402 safety preserved: a >4/9 uniquely-SHORTEST-key chapter IS fail (shortest lengthTell still BLOCKS)", () => {
  const r = computeChapterRubricMetrics(chapterWithKeyExtreme("zz-shortest", "shortest", 5), ISO);
  // Shortest keys are not longest, so the (advisory) tellRate is a clean pass.
  assert.equal(r.metrics.tellRate.value, 0, "0 uniquely-longest keys → tell rate 0");
  assert.equal(r.metrics.tellRate.verdict, "pass", "tellRate 0 ≤ 0.2 → pass");
  // The shortest-side length-tell gate BLOCKS (5 > shortestMax 4).
  assert.ok(r.failing.includes("lengthTell"), `5/9 uniquely-shortest must fail lengthTell (failing=${r.failing.join(",")})`);
  assert.equal(r.metrics.lengthTell.verdict, "fail", "shortest-side length-tell is a hard fail (safety gate unchanged)");
  assert.equal(r.verdict, "fail", "the shortest-side defect drives the chapter to fail (safety preserved)");
});

test("WP-402 boundary: 4/9 uniquely-shortest PASSES (cap=4), 9/9 uniquely-longest PASSES the longest cap (=9)", () => {
  const atShortestCap = computeChapterRubricMetrics(chapterWithKeyExtreme("zz-short4", "shortest", 4), ISO);
  assert.ok(!atShortestCap.failing.includes("lengthTell"), "4/9 uniquely-shortest is AT the cap → pass (not fail)");
  const atLongestCap = computeChapterRubricMetrics(chapterWithKeyExtreme("zz-long9", "longest", 9), ISO);
  assert.ok(!atLongestCap.failing.includes("lengthTell"), "9/9 uniquely-longest is AT the cap → pass");
});

// ── (2) CALIBRATION over the owner corpus (deterministic 10-package sample) ────

const HERE = dirname(fileURLToPath(import.meta.url));
// pipeline dir is scripts/book/prompts/chapterflow-v24-author-pipeline; the
// calibration corpus lives at repo-root/book-packages.
const REPO_ROOT = resolve(HERE, "../../../../..");
const PKG_DIR = resolve(REPO_ROOT, "book-packages");

// Deterministic 10-package sample (ledger L-14 / orchestrator: INCLUDES
// difficult-conversations). Covers: the top-5 owner exemplars that run the
// uniquely-longest house norm; the-power-of-moments v24 (the SHORTEST-side
// negative control); made-to-stick + nudge (D7 bakeoff corpus, high key-longest);
// and how-to-talk-to-anyone (a book that used to fail ONLY on tellRate).
const SAMPLE = [
  "atomic-habits", "crucial-conversations", "games-people-play", "thinking-in-bets",
  "the-happiness-hypothesis", "difficult-conversations", "the-power-of-moments",
  "made-to-stick", "nudge", "how-to-talk-to-anyone",
];
const POM = "the-power-of-moments";
const FLIP = "how-to-talk-to-anyone"; // OLD verdict fail (tellRate only) → NEW verdict warn

function pkgPath(id: string): string {
  return resolve(PKG_DIR, `${id}.v21.json`);
}
function loadChapters(id: string): ChapterV21[] {
  const raw = JSON.parse(readFileSync(pkgPath(id), "utf8")) as { chapters?: unknown[] };
  return (Array.isArray(raw.chapters) ? raw.chapters : []) as unknown as ChapterV21[];
}
function corpusPresent(ids: string[]): boolean {
  return ids.every((id) => existsSync(pkgPath(id)));
}

if (!corpusPresent(SAMPLE)) {
  skip("WP-402 calibration: owner corpus zero-FP + POM shortest-side fail", `book-packages/ missing for the sample (${SAMPLE.join(", ")})`);
} else {
  test("WP-402 calibration: ZERO false-positive tellRate blockers across the 10-package owner sample, warn-tier fires on every would-be-old-blocker", () => {
    const thresholds = loadRubricThresholds();
    const tellMax = thresholds.tellRateMax;
    let tellInFailing = 0;
    let tellWarns = 0;
    let tellWouldBlockOld = 0; // chapters where tellRate value > max (the OLD blocking condition)
    let scannedChapters = 0;
    for (const id of SAMPLE) {
      for (const ch of loadChapters(id)) {
        const m = computeChapterRubricMetrics(ch, thresholds);
        scannedChapters += 1;
        if (m.failing.includes("tellRate")) tellInFailing += 1;
        if (m.metrics.tellRate.verdict === "warn") tellWarns += 1;
        if (Number.isFinite(m.metrics.tellRate.value) && m.metrics.tellRate.value > tellMax) tellWouldBlockOld += 1;
      }
    }
    // PRIMARY ACCEPTANCE: no owner chapter fails on tellRate.
    assert.equal(tellInFailing, 0, `tellRate must be a false-positive-free advisory across the owner sample (got ${tellInFailing} tellRate fails over ${scannedChapters} chapters)`);
    // The demotion converts EVERY would-be old blocker into a warn (nothing lost,
    // nothing newly blocked) — the warn tier fires exactly where expected.
    assert.equal(tellWarns, tellWouldBlockOld, `every chapter the old 0.20 gate would have blocked now WARNS (warns=${tellWarns}, would-block=${tellWouldBlockOld})`);
    assert.ok(tellWouldBlockOld > 0, "sanity: the owner sample DOES exhibit the uniquely-longest house norm the old gate false-flagged");
  });

  test("WP-402 calibration: the-power-of-moments v24 STILL FAILS the shortest-side length-tell (safety gate intact)", () => {
    const thresholds = loadRubricThresholds();
    const report = computeBookRubricMetrics(POM, { chapters: loadChapters(POM), thresholds });
    assert.equal(report.verdict, "fail", "POM v24 must still fail the book-level rubric gate");
    const blockedByLength = report.chapters.filter((c) => c.failing.includes("lengthTell"));
    assert.ok(blockedByLength.length > 0, `POM must still have chapters blocked on the shortest-side lengthTell, got ${blockedByLength.length}`);
    // POM's keys are the SHORTEST, not longest — so the (now advisory) tellRate
    // never even warns for it: the change is orthogonal to POM's real defect.
    assert.ok(report.chapters.every((c) => c.metrics.tellRate.verdict !== "warn"), "POM's shortest-key defect produces no tellRate warn — the two signals are distinct");
    assert.ok(report.chapters.every((c) => !c.failing.includes("tellRate")), "tellRate never blocks POM either");
  });

  test("WP-402 calibration: a book that used to fail ONLY on tellRate now clears the blocking gates (how-to-talk-to-anyone)", () => {
    const thresholds = loadRubricThresholds();
    const report = computeBookRubricMetrics(FLIP, { chapters: loadChapters(FLIP), thresholds });
    // Under the OLD blocking tellRate this book was `fail`; demoting tellRate leaves
    // no blocking gate tripped, so it is no longer fail (its chapters warn on the
    // uniquely-longest house norm instead).
    assert.notEqual(report.verdict, "fail", `${FLIP} must no longer fail once tellRate is advisory (verdict=${report.verdict})`);
    assert.ok(report.chapters.some((c) => c.metrics.tellRate.verdict === "warn"), "its uniquely-longest keys now surface as a tellRate warn");
    assert.ok(report.chapters.every((c) => c.failing.length === 0), "no chapter trips a blocking gate anymore");
  });

  test("WP-402 calibration: difficult-conversations exhibits the house norm as warns, never as tellRate fails", () => {
    const thresholds = loadRubricThresholds();
    let warns = 0;
    let fails = 0;
    for (const ch of loadChapters("difficult-conversations")) {
      const m = computeChapterRubricMetrics(ch, thresholds);
      if (m.metrics.tellRate.verdict === "warn") warns += 1;
      if (m.failing.includes("tellRate")) fails += 1;
    }
    assert.equal(fails, 0, "difficult-conversations: zero tellRate fails");
    assert.ok(warns > 0, "difficult-conversations: the uniquely-longest house norm surfaces as tellRate warns");
  });
}
