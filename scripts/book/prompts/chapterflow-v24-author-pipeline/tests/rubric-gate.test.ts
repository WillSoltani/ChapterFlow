/**
 * P04 — deterministic rubric pre-flight over assembled chapters.
 *
 * Covers: reader-visible field extraction (sentinel coverage), per-metric
 * verdicts flipping with thresholds, the CLI --gate exit-code contract, and the
 * shadow-vs-enforce compilerRun wiring (via a stubbed runVerb). New blocking
 * checks ship shadow-first, so the wiring tests pin that shadow NEVER halts.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";
import { readerVisibleText } from "../src/metrics/chapterText.js";
import {
  computeChapterRubricMetrics,
  computeBookRubricMetrics,
} from "../src/metrics/bookRubricMetrics.js";
import type { RubricThresholds } from "../src/metrics/rubricThresholds.js";
import { loadRubricThresholds, validateRubricThresholds } from "../src/metrics/rubricThresholds.js";
import { runRubricPreflight, rubricGateMode } from "../src/orchestrator/compilerRun.js";
import { rubricMetricsWithCandidate } from "../src/orchestrator/chapterTransaction.js";
import type { AutopilotDeps, AutopilotOutcome, VerbResult } from "../src/orchestrator/autopilot.js";

const STRICT: RubricThresholds = {
  schemaVersion: "rubric-thresholds-v1",
  fleschEase: { min: 72, max: 84, warnTolerance: 4 },
  fkGrade: { min: 7, max: 8, warnTolerance: 1 },
  tellRateMax: 0.2,
  transferMin: 0.7,
  memorableCleanMin: 2,
  houseTicDensityWarnMax: 1,
  nominalizationRateWarnMax: 8,
  cardQuality: { echoKeyThreshold: 5, echoDistractorCeiling: 4, lengthTellShortestMax: 4, lengthTellLongestMax: 9 },
};

const LOOSE: RubricThresholds = {
  schemaVersion: "rubric-thresholds-v1",
  // Wide enough to accept even negative Flesch (dense prose scores below zero).
  fleschEase: { min: -1000, max: 1000, warnTolerance: 0 },
  fkGrade: { min: -1000, max: 1000, warnTolerance: 0 },
  tellRateMax: 1,
  transferMin: 0,
  memorableCleanMin: 0,
  houseTicDensityWarnMax: 100,
  nominalizationRateWarnMax: 100,
  // Wide enough that the W2 card-quality gates never trip under LOOSE.
  cardQuality: { echoKeyThreshold: 999, echoDistractorCeiling: 998, lengthTellShortestMax: 9, lengthTellLongestMax: 9 },
};

const DENSE =
  "The organizational implementation necessitated comprehensive documentation regarding administrative " +
  "accountability throughout the departmental reconfiguration initiative, whereupon subsequent authorization " +
  "requirements substantially complicated interdepartmental communication effectiveness and organizational productivity.";

/** A chapter engineered to FAIL every gate metric under STRICT and PASS under LOOSE:
 *  dense low-Flesch breakdown, keyed answer is the uniquely longest choice (tell=1.0),
 *  no transfer cue + remember bloom (transfer=0), only one clean memorable line (<2). */
function denseChapter(bookId: string, n = 1): ChapterV21 {
  const chapterId = `${bookId}-ch${String(n).padStart(2, "0")}`;
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId,
    number: n,
    title: "Dense chapter",
    readingTimeMinutes: 7,
    hook: "A short hook goes here.",
    keyTakeaway: "A short takeaway sentence that carries the single idea forward for the reader today.",
    breakdown: { fastRead: DENSE, deepRead: `${DENSE} ${DENSE}`, fullRead: `${DENSE} ${DENSE} ${DENSE}` },
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
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          questionId: "q01",
          prompt: "What is the mechanism at work in this chapter?",
          choices: ["No.", "Maybe not.", "This is by far the single longest and most detailed keyed answer choice of them all here."],
          correctIndex: 2,
          explanation: "The keyed answer is deliberately the longest so the distractor-tell metric fires on this question.",
          bloomsLevel: "remember",
          depthLevel: "simple",
        },
      ],
    },
    reviewCards: [{ cardId: "card01", front: "What is the first move?", back: "Compare the entry against the prior day first.", difficulty: "easy" }],
    implementationPlan: {
      title: "Catch drift early",
      coreSkill: "Noticing drift while it is still one record wide, every time, without negotiating with yourself.",
      ifThenPlans: [{ context: "starting a shift", plan: "If I open the log, then I compare the last entry with the prior day." }],
      twentyFourHourChallenge: "Once today, write down which record you expect to be wrong and check that one first.",
      weeklyPractice: "Each week, audit three days of entries against their source notes.",
    },
    memorableLines: [{ text: "The early check is the only cheap one you will ever get.", location: "keyTakeaway", why: "It compresses the cost asymmetry." }],
  };
}

// ── 1. threshold config loads + validates ───────────────────────────────────
test("rubric-thresholds: shipped config loads, validates, and defaults are shadow-safe", () => {
  const t = loadRubricThresholds();
  assert.equal(t.schemaVersion, "rubric-thresholds-v1");
  assert.deepEqual({ min: t.fleschEase.min, max: t.fleschEase.max }, { min: 72, max: 84 });
  assert.equal(t.tellRateMax, 0.2);
  assert.equal(t.transferMin, 0.7);
  assert.equal(t.memorableCleanMin, 2);
  // fraction-range + shape validation throws on drift
  assert.throws(() => validateRubricThresholds({ ...t, tellRateMax: 20 }), /fraction in \[0,1\]/);
  assert.throws(() => validateRubricThresholds({ ...t, schemaVersion: "nope" }), /schemaVersion/);
  assert.throws(() => validateRubricThresholds({ ...t, fleschEase: { min: 84, max: 72, warnTolerance: 4 } }), /min .* must be <=/);
  // W2 cardQuality block: shipped config carries the calibrated caps.
  assert.deepEqual(t.cardQuality, { echoKeyThreshold: 5, echoDistractorCeiling: 4, lengthTellShortestMax: 4, lengthTellLongestMax: 9 });
});

test("rubric-thresholds: cardQuality defaults-when-absent (fail-closed) and validates on drift", () => {
  const t = loadRubricThresholds();
  // A legacy config with NO cardQuality block → calibrated defaults (gates stay ON).
  const legacy = { ...t } as Record<string, unknown>;
  delete legacy.cardQuality;
  const filled = validateRubricThresholds(legacy);
  assert.deepEqual(filled.cardQuality, { echoKeyThreshold: 5, echoDistractorCeiling: 4, lengthTellShortestMax: 4, lengthTellLongestMax: 9 }, "absent block → calibrated defaults, not disabled");
  // Wrong shape / negative / non-integer throws.
  assert.throws(() => validateRubricThresholds({ ...t, cardQuality: { echoKeyThreshold: 5, echoDistractorCeiling: 4, lengthTellShortestMax: -1, lengthTellLongestMax: 9 } }), /non-negative integer/);
  assert.throws(() => validateRubricThresholds({ ...t, cardQuality: { echoKeyThreshold: 5, echoDistractorCeiling: 4, lengthTellShortestMax: 1.5, lengthTellLongestMax: 9 } }), /non-negative integer/);
  // The echo distractor ceiling must stay strictly below the key threshold.
  assert.throws(() => validateRubricThresholds({ ...t, cardQuality: { echoKeyThreshold: 5, echoDistractorCeiling: 5, lengthTellShortestMax: 4, lengthTellLongestMax: 9 } }), /must be < echoKeyThreshold/);
});

// ── 2. extraction covers every enumerated reader-visible field ───────────────
test("readerVisibleText: a sentinel in each enumerated field surfaces in `all`", () => {
  const base = denseChapter("zz-extract");
  const sentinels: Record<string, string> = {};
  let k = 0;
  const s = () => `ZZSENT${String(k++).padStart(3, "0")}`;
  const chapter: ChapterV21 = {
    ...base,
    hook: (sentinels.hook = s()),
    keyTakeaway: (sentinels.keyTakeaway = s()),
    tryThisNow: (sentinels.tryThisNow = s()),
    breakdown: {
      fastRead: (sentinels["breakdown.fastRead"] = s()),
      deepRead: (sentinels["breakdown.deepRead"] = s()),
      fullRead: (sentinels["breakdown.fullRead"] = s()),
    },
    examples: [
      {
        ...base.examples[0],
        title: (sentinels["examples[0].title"] = s()),
        scenario: (sentinels["examples[0].scenario"] = s()),
        whatToDo: (sentinels["examples[0].whatToDo"] = s()),
        whyItMatters: (sentinels["examples[0].whyItMatters"] = s()),
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          ...base.quiz.questions[0],
          prompt: (sentinels["quiz.questions[0].prompt"] = s()),
          choices: [(sentinels["quiz.questions[0].choices[0]"] = s()), (sentinels["quiz.questions[0].choices[1]"] = s()), (sentinels["quiz.questions[0].choices[2]"] = s())],
          explanation: (sentinels["quiz.questions[0].explanation"] = s()),
        },
      ],
    },
    reviewCards: [{ ...base.reviewCards[0], front: (sentinels["reviewCards[0].front"] = s()), back: (sentinels["reviewCards[0].back"] = s()) }],
    implementationPlan: {
      ...base.implementationPlan,
      title: (sentinels["implementationPlan.title"] = s()),
      coreSkill: (sentinels["implementationPlan.coreSkill"] = s()),
      ifThenPlans: [{ context: (sentinels["implementationPlan.ifThenPlans[0].context"] = s()), plan: (sentinels["implementationPlan.ifThenPlans[0].plan"] = s()) }],
      twentyFourHourChallenge: (sentinels["implementationPlan.twentyFourHourChallenge"] = s()),
      weeklyPractice: (sentinels["implementationPlan.weeklyPractice"] = s()),
    },
    memorableLines: [{ ...(base.memorableLines ?? [])[0]!, text: (sentinels["memorableLines[0].text"] = s()) }],
  };

  const { all, byField } = readerVisibleText(chapter);
  for (const [key, value] of Object.entries(sentinels)) {
    assert.ok(byField[key] === value, `byField[${key}] should be the exact sentinel (got ${JSON.stringify(byField[key])})`);
    assert.ok(all.includes(value), `all should contain the sentinel for ${key}`);
  }
  // Every produced key must be one we planted — no untested field silently in the measured surface.
  for (const key of Object.keys(byField)) assert.ok(key in sentinels, `unexpected extracted field ${key} — add it to the coverage set`);
});

// ── 3. per-metric verdicts flip with thresholds ──────────────────────────────
test("computeChapterRubricMetrics: gate metrics fail under STRICT, pass under LOOSE", () => {
  const ch = denseChapter("zz-flip");
  const strict = computeChapterRubricMetrics(ch, STRICT);
  assert.equal(strict.verdict, "fail");
  for (const key of ["fleschEase", "tellRate", "transferRatio", "memorableClean"]) {
    assert.ok(strict.failing.includes(key), `expected ${key} to fail under STRICT (failing=${strict.failing.join(",")})`);
  }
  // whole-chapter readability is reported (advisory) and does not add to `failing`.
  assert.ok(Number.isFinite(strict.metrics.fleschEaseWhole.value), "whole-chapter ease is reported");
  // tell rate is a FRACTION, not a percentage.
  assert.equal(strict.metrics.tellRate.value, 1, "single uniquely-longest keyed answer → tell rate 1.0");

  const loose = computeChapterRubricMetrics(ch, LOOSE);
  assert.equal(loose.verdict, "pass", `LOOSE thresholds should pass everything (failing=${loose.failing.join(",")})`);
  assert.equal(loose.failing.length, 0);
});

test("computeChapterRubricMetrics: house-tic + nominalization are warn-only (never fail)", () => {
  const ch = denseChapter("zz-warn");
  // Plant house tics; force the warn ceilings to 0 so both diagnostics trip.
  ch.breakdown.fastRead = "The point is that the truth is simple. " + ch.breakdown.fastRead;
  const t: RubricThresholds = { ...LOOSE, houseTicDensityWarnMax: 0, nominalizationRateWarnMax: 0 };
  const r = computeChapterRubricMetrics(ch, t);
  assert.equal(r.metrics.houseTicDensity.verdict, "warn");
  assert.equal(r.metrics.nominalizationRate.verdict, "warn");
  assert.equal(r.verdict, "warn", "warn-only diagnostics can raise to warn but never fail");
  assert.equal(r.failing.length, 0);
});

test("computeChapterRubricMetrics: fkGrade is warn-only — easier-than-band prose never fails (atomic-habits scenario)", () => {
  // Review calibration on the real catalog: the BEST books read easier than the
  // FK band (atomic-habits breakdown FK ≈ 4.2), so an FK-min GATE would fail
  // 20/20 of its chapters. fkGrade must therefore be advisory: outside-band FK
  // warns, and only the EASE band can fail readability.
  const ch = denseChapter("zz-easyfk");
  const easy = "The check is small. You do it first. It costs a minute. It saves a day. Start with the last entry. Read it twice. Then add the new one.";
  ch.breakdown = { fastRead: easy, deepRead: `${easy} ${easy}`, fullRead: `${easy} ${easy} ${easy}` };
  // Everything loose except the shipped fkGrade band — the only pressure is FK.
  const t: RubricThresholds = { ...LOOSE, fkGrade: { min: 7, max: 8, warnTolerance: 1 } };
  const r = computeChapterRubricMetrics(ch, t);
  assert.ok(r.metrics.fkGrade.value < 6, `fixture must read easier than the warn zone (fk=${r.metrics.fkGrade.value})`);
  assert.equal(r.metrics.fkGrade.verdict, "warn", "easier-than-band FK is advisory, not a failure");
  assert.ok(!r.failing.includes("fkGrade"), "fkGrade must never appear in the failing set");
  assert.equal(r.verdict, "warn", "FK alone can raise to warn but never fail");
  // The dense chapter's far-above-band FK is ALSO only a warn (never fail).
  const dense = computeChapterRubricMetrics(denseChapter("zz-hardfk"), t);
  assert.equal(dense.metrics.fkGrade.verdict, "warn");
  assert.ok(!dense.failing.includes("fkGrade"));
});

test("computeBookRubricMetrics: aggregates chapter verdicts + records findings on empty", () => {
  const report = computeBookRubricMetrics("zz-agg", { chapters: [denseChapter("zz-agg", 1), denseChapter("zz-agg", 2)], thresholds: STRICT });
  assert.equal(report.chapters.length, 2);
  assert.equal(report.summary.fail, 2);
  assert.equal(report.verdict, "fail");

  const empty = computeBookRubricMetrics("zz-empty", { chapters: [], thresholds: STRICT });
  assert.equal(empty.verdict, "pass");
  assert.ok(empty.findings.some((f) => /no assembled chapters/.test(f)));
});

// ── 4. Candidate adapter uses explicit chapters, never ambient canonical state ────
test("candidate rubric adapter substitutes the explicit chapter into explicit siblings", async () => {
  const bookId = "zz-rubric-gate-fixture";
  const candidate = denseChapter(bookId, 1);
  const staleSameNumber = { ...denseChapter(bookId, 1), breakdown: { fastRead: "Easy.", deepRead: "Easy.", fullRead: "Easy." } };
  const sibling = denseChapter(bookId, 2);
  let loads = 0;

  const result = await rubricMetricsWithCandidate(bookId, 1, candidate, (requestedBookId) => {
    loads += 1;
    assert.equal(requestedBookId, bookId);
    return [staleSameNumber, sibling];
  }, STRICT);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(loads, 1);
  assert.match(result.stdout, /rubric-metrics: FAIL/);
  assert.match(result.stdout, /ch01: FAIL/);
  assert.match(result.stdout, /ch02: FAIL/);
  assert.doesNotMatch(result.stdout, /ch01:[\s\S]*ch01:/, "same-number ambient chapter must be replaced, not duplicated");
});

// ── 5. shadow-vs-enforce compilerRun wiring (stubbed runVerb) ────────────────
function stubDeps(result: VerbResult): { deps: AutopilotDeps; calls: string[][]; logs: string[] } {
  const calls: string[][] = [];
  const logs: string[] = [];
  const deps = {
    runVerb: async (args: string[]) => {
      calls.push(args);
      return result;
    },
    log: (m: string) => logs.push(m),
  } as unknown as AutopilotDeps;
  return { deps, calls, logs };
}

test("rubricGateMode: defaults to shadow; only literal 'enforce' enables enforce", () => {
  assert.equal(rubricGateMode({} as unknown as NodeJS.ProcessEnv), "shadow");
  assert.equal(rubricGateMode({ CHAPTERFLOW_RUBRIC_GATE: "shadow" } as unknown as NodeJS.ProcessEnv), "shadow");
  assert.equal(rubricGateMode({ CHAPTERFLOW_RUBRIC_GATE: "1" } as unknown as NodeJS.ProcessEnv), "shadow");
  assert.equal(rubricGateMode({ CHAPTERFLOW_RUBRIC_GATE: "enforce" } as unknown as NodeJS.ProcessEnv), "enforce");
});

test("runRubricPreflight: shadow NEVER halts (even on gate-fail verb exit) and omits --gate", async () => {
  const { deps, calls, logs } = stubDeps({ code: 1, stdout: "rubric-metrics: FAIL (pass 0 · warn 0 · fail 2)", stderr: "" });
  const out = await runRubricPreflight("zz-book", deps, {}, "shadow");
  assert.equal(out, null, "shadow mode must continue");
  assert.deepEqual(calls[0], ["rubric-metrics", "zz-book"], "shadow must NOT pass --gate");
  assert.ok(logs.some((l) => l.includes("(shadow)")));
});

test("runRubricPreflight: enforce halts 'content' on gate fail and passes --gate", async () => {
  const { deps, calls } = stubDeps({ code: 1, stdout: "rubric-metrics: FAIL\n  ch01: FAIL — FAIL: fleschEase", stderr: "" });
  const out = (await runRubricPreflight("zz-book", deps, {}, "enforce")) as AutopilotOutcome;
  assert.deepEqual(calls[0], ["rubric-metrics", "zz-book", "--gate"], "enforce must pass --gate");
  assert.equal(out.status, "halt");
  assert.equal(out.category, "content");
  assert.match(out.reason, /fleschEase/);
});

test("runRubricPreflight: enforce halts 'infra' on exit>=2, continues on exit 0", async () => {
  const infra = (await runRubricPreflight("zz-book", stubDeps({ code: 2, stdout: "", stderr: "boom" }).deps, {}, "enforce")) as AutopilotOutcome;
  assert.equal(infra.status, "halt");
  assert.equal(infra.category, "infra");

  const ok = await runRubricPreflight("zz-book", stubDeps({ code: 0, stdout: "rubric-metrics: PASS (pass 2 · warn 0 · fail 0)", stderr: "" }).deps, {}, "enforce");
  assert.equal(ok, null, "enforce with a clean gate continues");
});
