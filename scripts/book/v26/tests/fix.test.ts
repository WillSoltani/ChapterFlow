import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFix } from "../src/fix";
import type { Chapter } from "../src/types";

function makeChapter(): Chapter {
  return {
    title: "Chapter One",
    hook: "A hook about habits.",
    counterintuition: "Counter.",
    keyTakeaway: "Small cues beat big plans.",
    tryThisNow: "Try this.",
    breakdown: { fastRead: "fast", deepRead: "deep", fullRead: "First para. The cue is the key. The cue is repeated." },
    examples: [
      { exampleId: "ex01", title: "One", tags: ["a"], scenario: "Ana misses her bus.", whatToDo: "Leave early.", whyItMatters: "Time." },
      { exampleId: "ex02", title: "Two", tags: ["b"], scenario: "Ben skips lunch.", whatToDo: "Pack food.", whyItMatters: "Energy." },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q1", prompt: "P1?", choices: ["a", "b", "c", "d"], correctIndex: 0, explanation: "E1", bloomsLevel: "remember" },
        {
          questionId: "q3",
          prompt: "Which cue works best?",
          choices: ["A big cue", "A big plan", "A tiny cue", "No cue"],
          correctIndex: 2,
          explanation: "A tiny cue is easy to repeat.",
          bloomsLevel: "apply",
        },
      ],
    },
    reviewCards: [
      { cardId: "rc1", front: "F1", back: "B1", difficulty: "easy" },
      { cardId: "rc2", front: "What is a cue?", back: "A trigger for the habit.", difficulty: "medium" },
    ],
    implementationPlan: {
      coreSkill: "Notice the cue.",
      ifThenPlans: [
        { context: "c0", plan: "p0" },
        { context: "c1", plan: "Stand up when the timer rings." },
      ],
      twentyFourHourChallenge: "Do it once.",
      weeklyPractice: "Do it daily.",
    },
    memorableLines: [{ text: "Line zero." }, { text: "Line one is memorable." }],
  };
}

test("edit in breakdown.fullRead replaces the first occurrence only", () => {
  const out = applyFix(makeChapter(), { edits: [{ field: "breakdown.fullRead", find: "The cue", replace: "The trigger" }] });
  assert.equal(out.applied, 1);
  assert.deepEqual(out.errors, []);
  assert.equal(out.chapter.breakdown.fullRead, "First para. The trigger is the key. The cue is repeated.");
});

test("top-level and implementationPlan fields resolve", () => {
  const out = applyFix(makeChapter(), {
    edits: [
      { field: "hook", find: "habits", replace: "routines" },
      { field: "keyTakeaway", find: "big plans", replace: "grand plans" },
      { field: "implementationPlan.coreSkill", find: "Notice", replace: "Spot" },
      { field: "implementationPlan.ifThenPlans.1.plan", find: "timer rings", replace: "alarm sounds" },
    ],
  });
  assert.equal(out.applied, 4);
  assert.deepEqual(out.errors, []);
  assert.equal(out.chapter.hook, "A hook about routines.");
  assert.equal(out.chapter.keyTakeaway, "Small cues beat grand plans.");
  assert.equal(out.chapter.implementationPlan.coreSkill, "Spot the cue.");
  assert.equal(out.chapter.implementationPlan.ifThenPlans[1].plan, "Stand up when the alarm sounds.");
});

test("edit by example id and by card id", () => {
  const out = applyFix(makeChapter(), {
    edits: [
      { field: "examples.ex02.scenario", find: "skips lunch", replace: "forgets lunch" },
      { field: "reviewCards.rc2.back", find: "trigger", replace: "prompt" },
      { field: "quiz.q3.explanation", find: "tiny", replace: "small" },
      { field: "quiz.q3.prompt", find: "best", replace: "most" },
    ],
  });
  assert.equal(out.applied, 4);
  assert.deepEqual(out.errors, []);
  assert.equal(out.chapter.examples[1].scenario, "Ben forgets lunch.");
  assert.equal(out.chapter.examples[0].scenario, "Ana misses her bus.");
  assert.equal(out.chapter.reviewCards[1].back, "A prompt for the habit.");
  assert.equal(out.chapter.quiz.questions[1].explanation, "A small cue is easy to repeat.");
  assert.equal(out.chapter.quiz.questions[1].prompt, "Which cue works most?");
});

test("quiz.q3.choices.1 edits that one choice only", () => {
  const out = applyFix(makeChapter(), { edits: [{ field: "quiz.q3.choices.1", find: "big", replace: "huge" }] });
  assert.equal(out.applied, 1);
  assert.deepEqual(out.chapter.quiz.questions[1].choices, ["A big cue", "A huge plan", "A tiny cue", "No cue"]);
});

test("quiz.q3.choices finds the text in choice 2 and leaves the others alone", () => {
  const out = applyFix(makeChapter(), { edits: [{ field: "quiz.q3.choices", find: "tiny", replace: "small" }] });
  assert.equal(out.applied, 1);
  assert.deepEqual(out.chapter.quiz.questions[1].choices, ["A big cue", "A big plan", "A small cue", "No cue"]);
});

test("quiz.q3.choices edit goes to the first choice that contains the text", () => {
  const out = applyFix(makeChapter(), { edits: [{ field: "quiz.q3.choices", find: "big", replace: "huge" }] });
  assert.deepEqual(out.chapter.quiz.questions[1].choices, ["A huge cue", "A big plan", "A tiny cue", "No cue"]);
});

test("memorableLines.1 and memorableLines.1.text both address the text leaf", () => {
  const a = applyFix(makeChapter(), { edits: [{ field: "memorableLines.1", find: "memorable", replace: "quotable" }] });
  assert.equal(a.applied, 1);
  assert.deepEqual(a.chapter.memorableLines, [{ text: "Line zero." }, { text: "Line one is quotable." }]);
  const b = applyFix(makeChapter(), { edits: [{ field: "memorableLines.1.text", find: "Line one", replace: "Line 1" }] });
  assert.equal(b.applied, 1);
  assert.equal(b.chapter.memorableLines[1].text, "Line 1 is memorable.");
});

test("missing find records an error and the remaining edits are still applied", () => {
  const out = applyFix(makeChapter(), {
    edits: [
      { field: "hook", find: "not in the hook", replace: "x" },
      { field: "keyTakeaway", find: "Small", replace: "Tiny" },
    ],
  });
  assert.equal(out.applied, 1);
  assert.deepEqual(out.errors, [{ field: "hook", find: "not in the hook", error: "find text not present in that field" }]);
  assert.equal(out.chapter.hook, "A hook about habits.");
  assert.equal(out.chapter.keyTakeaway, "Tiny cues beat big plans.");
});

test("a field that does not resolve falls back to its parent once", () => {
  const out = applyFix(makeChapter(), {
    edits: [
      { field: "quiz.q3.nonsense", find: "easy to repeat", replace: "simple to repeat" },
      { field: "nonsense.deeper.still", find: "Small cues", replace: "x" },
    ],
  });
  assert.equal(out.applied, 1);
  assert.equal(out.chapter.quiz.questions[1].explanation, "A tiny cue is simple to repeat.");
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].field, "nonsense.deeper.still");
  assert.equal(out.errors[0].error, "find text not present in that field");
});

test("the parent fallback happens once: a grandparent that resolves is not reached", () => {
  // "quiz.q3.bad" does not resolve, so the single fallback fails too; a second fallback would reach quiz.q3 and apply the edit.
  const out = applyFix(makeChapter(), { edits: [{ field: "quiz.q3.bad.worse", find: "easy to repeat", replace: "x" }] });
  assert.equal(out.applied, 0);
  assert.deepEqual(out.errors, [{ field: "quiz.q3.bad.worse", find: "easy to repeat", error: "find text not present in that field" }]);
  assert.equal(out.chapter.quiz.questions[1].explanation, "A tiny cue is easy to repeat.");
});

test("an object field searches all string leaves below it, first match wins", () => {
  // "i" is in ex01's scenario ("misses") and in its whyItMatters ("Time."), not in the earlier leaves.
  const out = applyFix(makeChapter(), { edits: [{ field: "examples.ex01", find: "i", replace: "I" }] });
  assert.equal(out.applied, 1);
  assert.equal(out.chapter.examples[0].scenario, "Ana mIsses her bus.");
  assert.equal(out.chapter.examples[0].whyItMatters, "Time.");
});

test("replacement text is literal (no $ pattern expansion) and empty find is rejected", () => {
  const out = applyFix(makeChapter(), {
    edits: [
      { field: "hook", find: "habits", replace: "cost $& and $1" },
      { field: "keyTakeaway", find: "", replace: "oops" },
    ],
  });
  assert.equal(out.applied, 1);
  assert.equal(out.chapter.hook, "A hook about cost $& and $1.");
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].field, "keyTakeaway");
  assert.equal(out.chapter.keyTakeaway, "Small cues beat big plans.");
});

test("key change accepted when the index is in range and the text matches", () => {
  const out = applyFix(makeChapter(), { keyChanges: [{ questionId: "q3", newIndex: 0, keyedChoiceText: "A big cue" }] });
  assert.equal(out.applied, 1);
  assert.deepEqual(out.errors, []);
  assert.equal(out.chapter.quiz.questions[1].correctIndex, 0);
  assert.equal(out.chapter.quiz.questions[0].correctIndex, 0);
});

test("key change is checked against the choices after edits in the same fix", () => {
  const out = applyFix(makeChapter(), {
    edits: [{ field: "quiz.q3.choices.3", find: "No cue", replace: "Only a tiny cue" }],
    keyChanges: [{ questionId: "q3", newIndex: 3, keyedChoiceText: "Only a tiny cue" }],
  });
  assert.equal(out.applied, 2);
  assert.deepEqual(out.errors, []);
  assert.equal(out.chapter.quiz.questions[1].correctIndex, 3);
});

test("key change rejected when keyedChoiceText differs from the choice", () => {
  const kc = { questionId: "q3", newIndex: 0, keyedChoiceText: "A big cue!" };
  const out = applyFix(makeChapter(), { keyChanges: [kc] });
  assert.equal(out.applied, 0);
  assert.equal(out.errors.length, 1);
  assert.deepEqual(out.errors[0].keyChange, kc);
  assert.match(out.errors[0].error, /keyedChoiceText/);
  assert.equal(out.chapter.quiz.questions[1].correctIndex, 2);
});

test("key change rejected when out of range, non-integer, or the question is unknown", () => {
  const bad = [
    { questionId: "q3", newIndex: 4, keyedChoiceText: "x" },
    { questionId: "q3", newIndex: -1, keyedChoiceText: "x" },
    { questionId: "q3", newIndex: 1.5, keyedChoiceText: "x" },
    { questionId: "q9", newIndex: 0, keyedChoiceText: "x" },
  ];
  const out = applyFix(makeChapter(), { keyChanges: bad });
  assert.equal(out.applied, 0);
  assert.equal(out.errors.length, 4);
  assert.match(out.errors[0].error, /range/);
  assert.match(out.errors[1].error, /range/);
  assert.match(out.errors[2].error, /integer/);
  assert.match(out.errors[3].error, /question/);
  assert.equal(out.chapter.quiz.questions[1].correctIndex, 2);
});

test("applyFix does not mutate the input chapter", () => {
  const input = makeChapter();
  const copy = structuredClone(input);
  const out = applyFix(input, {
    edits: [
      { field: "hook", find: "habits", replace: "routines" },
      { field: "quiz.q3.choices", find: "tiny", replace: "small" },
    ],
    keyChanges: [{ questionId: "q3", newIndex: 0, keyedChoiceText: "A big cue" }],
  });
  assert.equal(out.applied, 3);
  assert.deepEqual(input, copy);
  assert.notEqual(out.chapter, input);
});

test("an empty fix applies nothing and declined issues are ignored", () => {
  const out = applyFix(makeChapter(), { declined: [{ issue: 2, reason: "not a real problem" }] });
  assert.equal(out.applied, 0);
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.chapter, makeChapter());
});
