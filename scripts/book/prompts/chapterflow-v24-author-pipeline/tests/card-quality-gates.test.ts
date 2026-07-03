/**
 * W2 (plan §WS5) — deterministic card-quality PRE-FLIGHT gates.
 *
 * Pins, per gate: a TRIP case, a PASS case, and the BOUNDARY. Plus the
 * cross-cutting invariants the forensics demanded:
 *   - echo gate ignores DISTRACTOR echoes and <5-token key echoes (no FP tier at 4);
 *   - length-tell is SYMMETRIC (both the shortest and the longest side gate);
 *   - practice floor = imperative AND number/timebox (both required);
 *   - a card-quality FAIL surfaces on the SAME rubric line the author retry card reads.
 *
 * These are unit-level pins on the pure module; the reproducible CALIBRATION over
 * the real corpus (top-5 pass, POM v24 fails) lives in card-quality-calibration.test.ts.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";
import {
  cardQualityChapter,
  contentTokens,
  echoProseSurface,
  echoTellChapter,
  hasNumberOrTimebox,
  isImperativeLed,
  lengthTellChapter,
  longestSharedContentNgram,
  practiceFloorChapter,
} from "../src/metrics/cardQualityGates.js";
import { computeChapterRubricMetrics, formatRubricMetrics, computeBookRubricMetrics } from "../src/metrics/bookRubricMetrics.js";
import { loadRubricThresholds } from "../src/metrics/rubricThresholds.js";

// ── minimal chapter builder (only fields the gates read matter) ────────────────

type Q = { prompt?: string; choices: string[]; correctIndex: number; bloomsLevel?: ChapterV21["quiz"]["questions"][number]["bloomsLevel"] };

const DUMMY_QUESTIONS: Q[] = [{ choices: ["Middle answer here.", "A slightly longer distractor choice.", "Short one."], correctIndex: 0 }];

function mkChapter(over: {
  number?: number;
  proseExtra?: string;
  reviewBack?: string;
  questions?: Q[];
  tryThisNow?: string;
  twentyFourHourChallenge?: string;
}): ChapterV21 {
  const n = over.number ?? 1;
  const questions = over.questions ?? DUMMY_QUESTIONS;
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: `zz-cq-ch${String(n).padStart(2, "0")}`,
    number: n,
    title: "Card quality fixture",
    readingTimeMinutes: 7,
    hook: "A short hook.",
    counterintuition: "The obvious move backfires more often than people expect.",
    tryThisNow: over.tryThisNow ?? "Right now, name one habit and write the single trigger that starts it.",
    keyTakeaway: "The single idea to carry forward is that structure beats willpower for lasting change today.",
    breakdown: {
      fastRead: "A quick scene and a rule. " + (over.proseExtra ?? ""),
      deepRead: "A mechanism and a second scene explaining why the effect holds.",
      fullRead: "Depth, a third angle, and the honest limits of the idea in practice.",
    },
    examples: [
      {
        exampleId: "ex01",
        title: "An example",
        tags: ["practice"],
        planSpec: { domain: "work", audience: "a reader", stakes: "time", format: "vignette", requiredBeat: "the skip" },
        scenario: "A manager compared the totals against the prior note before continuing the review.",
        whatToDo: "Pause and re-check the entry against yesterday before adding anything new.",
        whyItMatters: "Small drift becomes expensive rework when nobody compares totals in time.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: questions.map((q, i) => ({
        questionId: `q${String(i + 1).padStart(2, "0")}`,
        prompt: q.prompt ?? "What is the mechanism at work here?",
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: "The keyed answer follows from the chapter's mechanism.",
        bloomsLevel: q.bloomsLevel ?? "apply",
        depthLevel: "standard",
      })),
    },
    reviewCards: [
      { cardId: "c01", front: "First move?", back: over.reviewBack ?? "Compare the entry against the prior day first.", difficulty: "easy" },
    ],
    implementationPlan: {
      title: "Catch drift early",
      coreSkill: "Notice drift while it is still one record wide, every time.",
      ifThenPlans: [{ context: "starting a shift", plan: "If I open the log, then I compare the last entry with the prior day." }],
      twentyFourHourChallenge: over.twentyFourHourChallenge ?? "In the next 24 hours, write the one record you expect to be wrong and check it first.",
      weeklyPractice: "Each week, audit three days of entries against their source notes.",
    },
    memorableLines: [{ text: "The early check is the only cheap one.", location: "keyTakeaway", why: "Compresses the cost asymmetry." }],
  };
}

// ── tokenizer + prose-surface primitives ───────────────────────────────────────

test("contentTokens: stopword-filtered, single letters dropped, ASCII apostrophe/hyphen continue", () => {
  assert.deepEqual(contentTokens("The quick self-aware fox isn't gone"), ["quick", "self-aware", "fox", "isn't", "gone"]);
  assert.deepEqual(contentTokens("a an the and I of"), [], "pure stopwords + single letter → empty");
});

test("longestSharedContentNgram: finds the longest contiguous shared run, 0 below a bigram", () => {
  const hay = contentTokens("put the house tools and future homeowner stake in view before the task starts");
  const needle = contentTokens("Put the house, tools, and future homeowner stake in view.");
  // content run: put·house·tools·future·homeowner·stake·view = 7 contiguous content tokens.
  assert.equal(longestSharedContentNgram(needle, hay), 7, "the full 7-content-token lift is detected");
  assert.equal(longestSharedContentNgram(contentTokens("wholly separate vocabulary entirely"), hay), 0, "no shared bigram → 0");
});

test("echoProseSurface includes reviewCards + implementationPlan (a real lift came from a card)", () => {
  const ch = mkChapter({ reviewBack: "UNIQUEZEBRAMARKER personally chosen rather than mechanically earned", questions: [{ choices: ["a", "b", "c"], correctIndex: 0 }] });
  assert.match(echoProseSurface(ch), /UNIQUEZEBRAMARKER/, "review-card back is in the echo surface");
  assert.match(echoProseSurface(ch), /In the next 24 hours/, "24-hour challenge is in the echo surface");
});

// ── (a) ECHO-TELL ──────────────────────────────────────────────────────────────

const LIFT = "Put the house, tools, and future homeowner stake in view.";
const LIFT_PROSE = "before the task starts you put the house tools and future homeowner stake in view where everyone can see it.";

test("echo-tell TRIP: key lifts a ≥5-content-token phrase while distractors do not", () => {
  const ch = mkChapter({
    proseExtra: LIFT_PROSE,
    questions: [{ choices: [LIFT, "Hide the materials in storage until later.", "Announce the plan in a meeting."], correctIndex: 0 }],
  });
  const r = echoTellChapter(ch);
  assert.equal(r.fail, true, "the lift trips the gate");
  assert.deepEqual(r.flagged, ["q01"]);
  assert.ok(r.questions[0].keyNgram >= 5, `key n-gram ${r.questions[0].keyNgram} ≥ 5`);
});

test("echo-tell PASS: a paraphrased key (no long verbatim run) does not trip", () => {
  const ch = mkChapter({
    proseExtra: LIFT_PROSE,
    questions: [{ choices: ["Make the goal and the tools visible before work begins.", "Hide the materials until later.", "Announce it in a meeting."], correctIndex: 0 }],
  });
  assert.equal(echoTellChapter(ch).fail, false, "a paraphrase clears the gate");
});

test("echo-tell IGNORES distractor echoes — a lift in a WRONG choice never trips", () => {
  const ch = mkChapter({
    proseExtra: LIFT_PROSE,
    questions: [{ choices: ["Keep the goal abstract and unspoken.", LIFT, "Delay the whole plan."], correctIndex: 0 }],
  });
  const r = echoTellChapter(ch);
  assert.equal(r.fail, false, "only the KEY is gated; a distractor echo is fine (it makes the wrong answer look right, not the key a tell)");
  assert.ok(Math.max(...r.questions[0].distractorNgrams) >= 5, "the distractor DID carry a long echo — proving we ignored it");
});

test("echo-tell BOUNDARY: a 4-content-token key echo does NOT trip (the ≥4 tier is a known FP source)", () => {
  // "tie the symbol real performance" style: exactly 4 content tokens shared.
  const prose = "you should tie the symbol to real performance so the reward means something.";
  const ch = mkChapter({
    proseExtra: prose,
    questions: [{ choices: ["Tie the symbol to real performance.", "Give a token with no meaning behind it.", "Skip recognition entirely this quarter."], correctIndex: 0 }],
  });
  const r = echoTellChapter(ch);
  assert.equal(r.questions[0].keyNgram, 4, "the key shares exactly a 4-token run");
  assert.equal(r.fail, false, "≥4 but <5 must NOT gate — canonical-principle keys live here");
});

test("echo-tell threshold is configurable but distractorCeiling must stay coherent", () => {
  const ch = mkChapter({ proseExtra: LIFT_PROSE, questions: [{ choices: [LIFT, "short one", "short two"], correctIndex: 0 }] });
  // At an absurdly high key threshold the same lift does NOT trip.
  assert.equal(echoTellChapter(ch, { keyThreshold: 99 }).fail, false);
});

// ── (b) SYMMETRIC LENGTH-TELL ──────────────────────────────────────────────────

/** Build 9 questions where the key is uniquely shortest in exactly `shortCount`
 *  and uniquely longest in exactly `longCount` (disjoint). */
function lengthQuiz(shortCount: number, longCount: number): Q[] {
  const qs: Q[] = [];
  for (let i = 0; i < 9; i++) {
    if (i < shortCount) qs.push({ choices: ["Yes.", "A clearly much longer distractor here.", "Another fairly long distractor too."], correctIndex: 0 });
    else if (i < shortCount + longCount) qs.push({ choices: ["This keyed answer is by far the longest choice of the three here now.", "Short.", "Medium one."], correctIndex: 0 });
    else qs.push({ choices: ["Middle length answer here A.", "Short.", "This is a much longer distractor than the middle one."], correctIndex: 0 });
  }
  return qs;
}

test("length-tell SHORTEST side TRIP: key uniquely-shortest in 5/9 > cap 4", () => {
  const ch = mkChapter({ questions: lengthQuiz(5, 0) });
  const r = lengthTellChapter(ch);
  assert.equal(r.uniquelyShortest, 5);
  assert.equal(r.shortestFail, true);
  assert.equal(r.fail, true);
});

test("length-tell SHORTEST BOUNDARY: exactly 4/9 shortest PASSES (top-5 peak at 4/9)", () => {
  const r = lengthTellChapter(mkChapter({ questions: lengthQuiz(4, 0) }));
  assert.equal(r.uniquelyShortest, 4);
  assert.equal(r.shortestFail, false, "4 == cap → pass");
});

test("length-tell LONGEST side is also gated (symmetric) — a tight longest cap trips", () => {
  const ch = mkChapter({ questions: lengthQuiz(0, 6) });
  // Default longest cap (9) passes; a tightened cap must trip the SAME data → symmetric mechanism.
  assert.equal(lengthTellChapter(ch).longestFail, false, "at the calibrated longest cap (9) the top-5 norm passes");
  assert.equal(lengthTellChapter(ch, { longestMax: 4 }).longestFail, true, "tighten the longest cap → the same key-longest pattern trips");
  assert.equal(lengthTellChapter(ch, { longestMax: 4 }).uniquelyLongest, 6);
});

test("length-tell excludes malformed questions from the counts", () => {
  const ch = mkChapter({ questions: [{ choices: [], correctIndex: 0 }, { choices: ["Yes.", "Longer distractor here.", "Longer still one."], correctIndex: 0 }] });
  const r = lengthTellChapter(ch);
  assert.equal(r.questionCount, 1, "the empty-choices question is dropped from the denominator");
  assert.equal(r.uniquelyShortest, 1);
});

// ── (c) PRACTICE FLOOR ─────────────────────────────────────────────────────────

test("practice-floor primitives: number/timebox and imperative are both required", () => {
  assert.equal(hasNumberOrTimebox("write one line today"), true, "'one' + 'today'");
  assert.equal(hasNumberOrTimebox("reflect on your growth"), false, "no number/timebox");
  assert.equal(isImperativeLed("Write the exact sentence you will use."), true, "bare verb lead");
  assert.equal(isImperativeLed("You will notice patterns over time."), false, "subject-pronoun lead is not imperative");
  assert.equal(isImperativeLed("Before your next meeting, write the objection down."), true, "imperative after a trigger clause");
});

test("practice-floor TRIP: both items abstract (no number/timebox or not imperative) → fail", () => {
  const ch = mkChapter({
    tryThisNow: "Awareness of your patterns tends to grow as reflection deepens.",
    twentyFourHourChallenge: "Reflection on the process matters for growth over the long run.",
  });
  assert.equal(practiceFloorChapter(ch).fail, true);
});

test("practice-floor PASS: one concrete imperative item is enough", () => {
  const ch = mkChapter({
    tryThisNow: "Awareness grows over time.", // fails on its own
    twentyFourHourChallenge: "In the next 24 hours, write the exact sentence you will say to open the meeting.",
  });
  const r = practiceFloorChapter(ch);
  assert.equal(r.fail, false);
  assert.deepEqual(r.passingItems, ["twentyFourHourChallenge"]);
});

test("practice-floor BOUNDARY: imperative present but NO number/timebox → still fail", () => {
  const ch = mkChapter({
    tryThisNow: "Write the objection as an agenda item and ask for evidence.", // imperative, but no digit/number-word/timebox
    twentyFourHourChallenge: "Name the strongest counterpoint and put it on the table.", // ditto
  });
  assert.equal(practiceFloorChapter(ch).fail, true, "imperative alone does not clear the floor — concreteness is required");
});

// ── combined + retry-card wiring ───────────────────────────────────────────────

test("cardQualityChapter aggregates the three gates and emits repair reasons", () => {
  const ch = mkChapter({
    proseExtra: LIFT_PROSE,
    questions: [{ choices: [LIFT, "short a", "short b"], correctIndex: 0 }, ...lengthQuiz(5, 0)],
    tryThisNow: "Awareness grows.",
    twentyFourHourChallenge: "Reflection helps over time.",
  });
  const r = cardQualityChapter(ch);
  assert.equal(r.fail, true);
  assert.ok(r.reasons.some((x) => /echo-tell/.test(x)), "echo reason present");
  assert.ok(r.reasons.some((x) => /uniquely-SHORTEST/.test(x)), "shortest length-tell reason present");
  assert.ok(r.reasons.some((x) => /practice-floor/.test(x)), "practice reason present");
});

test("echo-tell is ADVISORY (warn, never in the failing set) — the calibration corpus proved it is not a clean discriminator", () => {
  const thresholds = loadRubricThresholds();
  const ch = mkChapter({
    number: 3,
    proseExtra: LIFT_PROSE,
    questions: [
      { choices: [LIFT, "A middling distractor of moderate length here.", "Another middling distractor here too."], correctIndex: 0 },
      ...lengthQuiz(0, 0),
    ],
  });
  const perCh = computeChapterRubricMetrics(ch, thresholds);
  assert.equal(perCh.metrics.echoTell.verdict, "warn", "an echo lift raises WARN, not FAIL");
  assert.ok(!perCh.failing.includes("echoTell"), `echoTell must NOT be in the failing set (failing=${perCh.failing.join(",")})`);
  assert.ok(perCh.cardQuality.echo.fail, "the raw echo signal is still computed + surfaced");
});

test("a BLOCKING card-quality FAIL (length-tell) surfaces on the SAME chNN rubric line the author retry card reads", () => {
  const thresholds = loadRubricThresholds();
  // A chapter that fails the shortest-side length-tell (a BLOCKING gate). The
  // author retry loop greps the `chNN:` line for 'FAIL' and appends the follow-on
  // 'fix:' lines verbatim.
  const ch = mkChapter({ number: 7, questions: lengthQuiz(5, 0) });
  const perCh = computeChapterRubricMetrics(ch, thresholds);
  assert.ok(perCh.failing.includes("lengthTell"), `lengthTell in the failing set (failing=${perCh.failing.join(",")})`);
  const report = { schemaVersion: "rubric-metrics-v1" as const, bookId: "zz-cq", generatedAt: "", thresholds, chapters: [perCh], summary: { pass: 0, warn: 0, fail: 1 }, verdict: "fail" as const, findings: [] };
  const text = formatRubricMetrics(report);
  const chLine = text.split("\n").find((l) => l.trim().startsWith("ch07:")) ?? "";
  assert.match(chLine, /FAIL: .*lengthTell/, "the chNN: line names lengthTell in FAIL");
  assert.match(text, /ch07 fix: length-tell/, "a concrete repair 'fix:' line rides the same block for the retry card");
});

test("book-level report: a clean chapter passes all three W2 gates end to end", () => {
  const clean = mkChapter({
    questions: [
      { prompt: "You are a manager; imagine the totals disagree. What is the first move?", choices: ["Compare the current entry with the prior day before doing anything else at all.", "Rewrite the whole log from scratch tonight instead.", "Ignore it and hope the totals reconcile later somehow."], correctIndex: 0 },
      ...lengthQuiz(0, 0),
    ],
  });
  const report = computeBookRubricMetrics("zz-cq-clean", { chapters: [clean] });
  const perCh = report.chapters[0];
  assert.ok(!perCh.failing.includes("echoTell"), "echo clean");
  assert.ok(!perCh.failing.includes("lengthTell"), "length clean");
  assert.ok(!perCh.failing.includes("practiceFloor"), "practice clean");
});
