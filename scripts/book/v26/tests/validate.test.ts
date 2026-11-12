import { test } from "node:test";
import assert from "node:assert/strict";
import type { Chapter } from "../src/types";
import { onePackage, validateChapterWithApp, wordsIn, type BookMeta } from "../src/validate";

const book: BookMeta = {
  bookId: "demo-book",
  title: "Demo Book",
  author: "Ada Example",
  categories: ["productivity"],
  tags: ["focus", "habits"],
};

const prose = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

function fixture(): Chapter {
  const question = (i: number) => ({
    questionId: `q-${i}`,
    prompt: `Question ${i}: what should you do first?`,
    choices: ["Option A", "Option B", "Option C"],
    correctIndex: i % 3,
    explanation: `Because option ${i % 3} follows the chapter's idea.`,
    bloomsLevel: "apply",
  });
  return {
    title: "Start Small",
    hook: "A short story that opens the chapter.",
    counterintuition: "The smallest step beats the biggest plan.",
    keyTakeaway: "Begin with the version you cannot fail.",
    tryThisNow: "Write one sentence of the thing you are avoiding.",
    breakdown: { fastRead: prose(40), deepRead: prose(120), fullRead: prose(300) },
    examples: [1, 2].map((i) => ({
      exampleId: `ex-${i}`,
      title: `Example ${i}`,
      tags: ["work"],
      scenario: `Scenario ${i} describes a person facing a blank page.`,
      whatToDo: `Do the two-minute version of task ${i}.`,
      whyItMatters: `It removes the start-up cost in case ${i}.`,
    })),
    quiz: { passingScorePercent: 70, questions: [1, 2, 3].map(question) },
    reviewCards: [1, 2, 3].map((i) => ({
      cardId: `rc-${i}`,
      front: `Front ${i}`,
      back: `Back ${i}`,
      difficulty: "medium",
    })),
    implementationPlan: {
      coreSkill: "Shrinking a task until starting is easy.",
      ifThenPlans: [
        { context: "When I open my laptop", plan: "I write one line first." },
        { context: "When I feel stuck", plan: "I halve the task." },
      ],
      twentyFourHourChallenge: "Do one two-minute start today.",
      weeklyPractice: "Pick one avoided task each day.",
    },
    memorableLines: [{ text: "Start so small it feels silly." }, { text: "Momentum is a side effect." }],
  };
}

test("wordsIn counts whitespace-separated words", () => {
  assert.equal(wordsIn(""), 0);
  assert.equal(wordsIn("   "), 0);
  assert.equal(wordsIn("one two  three\nfour\tfive"), 5);
});

test("onePackage formats chapterId, number and readingTimeMinutes", () => {
  const ch = fixture();
  ch.breakdown.fullRead = prose(690); // 690 / 230 = 3
  const pkg = onePackage(ch, 3, book) as any;
  assert.equal(pkg.schemaVersion, "chapterflow-v21-authored");
  assert.equal(pkg.packageId, "demo-book-v26-check");
  assert.equal(pkg.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(pkg.contentOwner, "chapterflow");
  assert.deepEqual(pkg.book, {
    bookId: "demo-book",
    title: "Demo Book",
    author: "Ada Example",
    categories: ["productivity"],
    tags: ["focus", "habits"],
  });
  assert.equal(pkg.chapters.length, 1);
  assert.equal(pkg.chapters[0].chapterId, "demo-book-ch03");
  assert.equal(pkg.chapters[0].number, 3);
  assert.equal(pkg.chapters[0].readingTimeMinutes, 3);
  assert.equal(pkg.chapters[0].title, "Start Small");
  assert.equal((onePackage(ch, 12, book) as any).chapters[0].chapterId, "demo-book-ch12");
});

test("onePackage readingTimeMinutes rounds and never drops below 1", () => {
  const short = fixture();
  short.breakdown.fullRead = prose(10);
  assert.equal((onePackage(short, 1, book) as any).chapters[0].readingTimeMinutes, 1);

  const empty = fixture();
  empty.breakdown.fullRead = "";
  assert.equal((onePackage(empty, 1, book) as any).chapters[0].readingTimeMinutes, 1);

  const mid = fixture();
  mid.breakdown.fullRead = prose(1840); // 1840 / 230 = 8
  assert.equal((onePackage(mid, 1, book) as any).chapters[0].readingTimeMinutes, 8);
});

// Exact multiples of 230 cannot tell round from floor or ceil, so test either side of x.5.
test("onePackage readingTimeMinutes uses Math.round, not floor or ceil", () => {
  const minutesFor = (words: number): number => {
    const ch = fixture();
    ch.breakdown.fullRead = prose(words);
    return (onePackage(ch, 1, book) as any).chapters[0].readingTimeMinutes;
  };
  assert.equal(minutesFor(345), 2); // 1.5 rounds up (floor would give 1)
  assert.equal(minutesFor(344), 1); // 1.496 rounds down (ceil would give 2)
  assert.equal(minutesFor(460 + 114), 2); // 2.496 rounds down (ceil would give 3)
  assert.equal(minutesFor(460 + 116), 3); // 2.504 rounds up (floor would give 2)
});

test("a valid chapter passes the app validator", async () => {
  const r = await validateChapterWithApp(fixture(), 1, book);
  assert.equal(r.ok, true, r.message);
  assert.equal(r.message, "APP_VALIDATOR_OK chapters=1");
});

test("an empty fullRead fails the app validator", async () => {
  const ch = fixture();
  ch.breakdown.fullRead = "";
  const r = await validateChapterWithApp(ch, 1, book);
  assert.equal(r.ok, false);
  assert.match(r.message, /hard/);
});

test("a correctIndex out of range for its choices fails the app validator", async () => {
  const ch = fixture();
  ch.quiz.questions[1].correctIndex = 5; // only 3 choices
  const r = await validateChapterWithApp(ch, 1, book);
  assert.equal(r.ok, false);
  assert.match(r.message, /out of range/);
});
