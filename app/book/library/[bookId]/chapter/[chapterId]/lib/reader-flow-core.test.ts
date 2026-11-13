import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildChapterNeighbours,
  buildNextChapterRoute,
  buildReauthReturnTo,
  chapterDoneOnServer,
  computeProgressPercent,
  decidePhaseTransition,
  initialReaderDepth,
  learningModeTapIsNoop,
  mapLearningStyleToDepth,
  modeToDepth,
  quizStepProgress,
  requiredScenarioInteractions,
} from "./reader-flow-core";
import { getPhaseThresholds } from "../hooks/usePhaseCompletion";

type ThresholdResolver = typeof getPhaseThresholds;

function assertReadinessThresholds(resolve: ThresholdResolver) {
  const expected = [
    ["guided", "summary", { minScroll: 0.80, minTime: 20 }],
    ["standard", "summary", { minScroll: 0.90, minTime: 30 }],
    ["challenge", "summary", { minScroll: 0.90, minTime: 30 }],
    ["guided", "examples", { minScroll: 0.80, minTime: 10 }],
    ["standard", "examples", { minScroll: 0.90, minTime: 10 }],
    ["challenge", "examples", { minScroll: 0.90, minTime: 10 }],
    ["guided", "quiz", { minScroll: 0, minTime: 0 }],
    ["standard", "quiz", { minScroll: 0, minTime: 0 }],
    ["challenge", "quiz", { minScroll: 0, minTime: 0 }],
  ] as const;

  for (const [mode, phase, threshold] of expected) {
    assert.deepEqual(
      resolve(mode, phase),
      threshold,
      `${mode} ${phase} readiness threshold drifted`,
    );
  }
}

test("reader depth mappings preserve the fast/default and learning-mode contracts", () => {
  assert.equal(mapLearningStyleToDepth("concise"), "simple");
  assert.equal(mapLearningStyleToDepth("deep"), "deeper");
  assert.equal(mapLearningStyleToDepth("balanced"), "standard");
  assert.equal(modeToDepth("guided"), "simple");
  assert.equal(modeToDepth("standard"), "standard");
  assert.equal(modeToDepth("challenge"), "deeper");
});

test("phase readiness retains the literal mode-specific scroll and time thresholds", () => {
  assertReadinessThresholds(getPhaseThresholds);

  const regressedGuidedSummary: ThresholdResolver = (mode, phase) => {
    const threshold = getPhaseThresholds(mode, phase);
    return mode === "guided" && phase === "summary"
      ? { ...threshold, minTime: 30 }
      : threshold;
  };
  assert.throws(
    () => assertReadinessThresholds(regressedGuidedSummary),
    /guided summary readiness threshold drifted/,
  );
});

test("chapter progress keeps the existing phase weights and halfway display", () => {
  assert.equal(computeProgressPercent("summary", new Set()), 17);
  assert.equal(computeProgressPercent("summary", new Set(["summary"])), 33);
  assert.equal(computeProgressPercent("examples", new Set(["summary"])), 50);
  assert.equal(computeProgressPercent("quiz", new Set(["summary", "examples"])), 83);
  assert.equal(computeProgressPercent("quiz", new Set(["summary", "examples", "quiz"])), 100);
});

test("phase transitions preserve forward completion/interstitial and accessible backward navigation", () => {
  assert.deepEqual(
    decidePhaseTransition({
      current: "summary",
      target: "examples",
      targetAccessible: true,
      skipInterstitial: false,
    }),
    { kind: "forward-interstitial", completeCurrent: true },
  );
  assert.deepEqual(
    decidePhaseTransition({
      current: "examples",
      target: "quiz",
      targetAccessible: true,
      skipInterstitial: true,
    }),
    { kind: "direct", completeCurrent: true },
  );
  assert.deepEqual(
    decidePhaseTransition({
      current: "quiz",
      target: "summary",
      targetAccessible: true,
      skipInterstitial: false,
    }),
    { kind: "direct", completeCurrent: false },
  );
  assert.deepEqual(
    decidePhaseTransition({
      current: "quiz",
      target: "examples",
      targetAccessible: false,
      skipInterstitial: false,
    }),
    { kind: "blocked", completeCurrent: false },
  );
});

test("only Challenge mode requires every default-visible scenario interaction", () => {
  assert.equal(requiredScenarioInteractions("guided", 2), 0);
  assert.equal(requiredScenarioInteractions("standard", 2), 0);
  assert.equal(requiredScenarioInteractions("challenge", 0), 0);
  assert.equal(requiredScenarioInteractions("challenge", 2), 2);
});

test("reader routes preserve encoding, session propagation, and relative reauth returnTo", () => {
  assert.equal(
    buildNextChapterRoute("book / id", "chapter / id", false),
    "/book/library/book%20%2F%20id/chapter/chapter%20%2F%20id",
  );
  assert.equal(
    buildNextChapterRoute("book / id", "chapter / id", true),
    "/book/library/book%20%2F%20id/chapter/chapter%20%2F%20id?session=1",
  );
  assert.equal(
    buildReauthReturnTo("/book/library/a/chapter/b", "session=1&from=dashboard"),
    "/book/library/a/chapter/b?session=1&from=dashboard",
  );
  assert.equal(buildReauthReturnTo("/book/library/a/chapter/b", ""), "/book/library/a/chapter/b");
});

const NAV_CHAPTERS = [
  { id: "c1", order: 1, title: "One" },
  { id: "c2", order: 2, title: "Two" },
  { id: "c3", order: 3, title: "Three" },
];

test("chapter neighbours link the previous and next chapter with the completion modal's route", () => {
  const middle = buildChapterNeighbours({
    bookId: "b",
    chapters: NAV_CHAPTERS,
    chapterId: "c2",
    sessionMode: false,
    getChapterState: () => "unlocked",
  });
  assert.deepEqual(middle, {
    prev: { order: 1, title: "One", href: "/book/library/b/chapter/c1", locked: false },
    next: { order: 3, title: "Three", href: "/book/library/b/chapter/c3", locked: false },
  });

  const first = buildChapterNeighbours({
    bookId: "b",
    chapters: NAV_CHAPTERS,
    chapterId: "c1",
    sessionMode: true,
    getChapterState: (id) => (id === "c2" ? "locked" : "unlocked"),
  });
  assert.equal(first.prev, null);
  assert.deepEqual(first.next, {
    order: 2,
    title: "Two",
    href: "/book/library/b/chapter/c2?session=1",
    locked: true,
  });

  const last = buildChapterNeighbours({
    bookId: "b",
    chapters: NAV_CHAPTERS,
    chapterId: "c3",
    sessionMode: false,
    getChapterState: () => "locked",
  });
  assert.equal(last.next, null);
  // A previous chapter is never shown as locked.
  assert.equal(last.prev?.locked, false);

  const unknown = buildChapterNeighbours({
    bookId: "b",
    chapters: NAV_CHAPTERS,
    chapterId: "missing",
    sessionMode: false,
    getChapterState: () => "unlocked",
  });
  assert.deepEqual(unknown, { prev: null, next: null });
});

test("quiz step progress is answered over total on the quiz, full once graded, null elsewhere", () => {
  const session = {
    questions: [{ questionId: "q1" }, { questionId: "q2" }, { questionId: "q3" }, { questionId: "q4" }],
    result: null,
  };
  assert.equal(quizStepProgress("summary", session, { q1: "a" }), null);
  assert.equal(quizStepProgress("quiz", null, {}), null);
  assert.equal(quizStepProgress("quiz", session, {}), 0);
  assert.equal(quizStepProgress("quiz", session, { q1: "a", q3: "b" }), 0.5);
  // Answers for questions outside this attempt do not count.
  assert.equal(quizStepProgress("quiz", session, { q1: "a", stale: "b" }), 0.25);
  assert.equal(quizStepProgress("quiz", { ...session, result: { passed: false } }, {}), 1);
  assert.equal(quizStepProgress("quiz", { questions: [], result: null }, {}), 0);
});

test("initialReaderDepth: a reader who never customized their profile gets Lite", () => {
  assert.equal(initialReaderDepth(null), "simple");
  assert.equal(initialReaderDepth(undefined), "simple");
  assert.equal(initialReaderDepth({}), "simple");
  assert.equal(initialReaderDepth({ learningMode: "challenge" }), "simple");
  assert.equal(
    initialReaderDepth({ extended: { learningMode: "challenge", profileCustomized: false } }),
    "simple",
  );
});

test("initialReaderDepth: a customized reader gets the depth of their mode", () => {
  assert.equal(
    initialReaderDepth({ learningMode: "challenge", extended: { profileCustomized: true } }),
    "deeper",
  );
  assert.equal(
    initialReaderDepth({ extended: { learningMode: "guided", profileCustomized: true } }),
    "simple",
  );
  assert.equal(initialReaderDepth({ extended: { profileCustomized: true } }), "standard");
  // The canonical top-level mode wins over the legacy extended copy.
  assert.equal(
    initialReaderDepth({
      learningMode: "standard",
      extended: { learningMode: "challenge", profileCustomized: true },
    }),
    "standard",
  );
});

test("learningModeTapIsNoop: on the fast path a tap on the shown mode still saves", () => {
  // Not customized yet: the reader gets Lite whatever learningMode says, so a
  // tap (even on the stored mode) must write profileCustomized.
  assert.equal(learningModeTapIsNoop("standard", "standard", true), false);
  assert.equal(learningModeTapIsNoop("guided", "standard", true), false);
  // Customized: re-tapping the current mode changes nothing.
  assert.equal(learningModeTapIsNoop("standard", "standard", false), true);
  assert.equal(learningModeTapIsNoop("challenge", "standard", false), false);
});

test("READER-09: a chapter finished on any device opens every phase", () => {
  assert.equal(chapterDoneOnServer("completed", false), true);
  assert.equal(chapterDoneOnServer("current", true), true);
  assert.equal(chapterDoneOnServer("completed", true), true);
  assert.equal(chapterDoneOnServer("current", false), false);
  assert.equal(chapterDoneOnServer("locked", false), false);
});
