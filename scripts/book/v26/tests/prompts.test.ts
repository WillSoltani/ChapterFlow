import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  PROMPT_DIR,
  allTiersText,
  chapterHeader,
  knownTrapsSection,
  loadPrompt,
  newReaderText,
  questionsBlock,
  readerText,
  renderTemplate,
} from "../src/prompts";
import type { Chapter } from "../src/types";

function fixture(): Chapter {
  return {
    title: "Chapter One",
    hook: "A hook about habits.",
    counterintuition: "Plans do not make habits.",
    keyTakeaway: "Small cues beat big plans.",
    tryThisNow: "Pick one cue.",
    breakdown: { fastRead: "Fast summary.", deepRead: "Deep telling.\n\nSecond paragraph.", fullRead: "Full telling." },
    examples: [
      { exampleId: "ex01", title: "The Bus", tags: ["a"], scenario: "Ana misses her bus.", whatToDo: "Leave early.", whyItMatters: "Time." },
      { exampleId: "ex02", title: "Lunch", tags: ["b"], scenario: "Ben skips lunch.", whatToDo: "Pack food.", whyItMatters: "Energy." },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q1", prompt: "Which cue works?", choices: ["Big", "Tiny", "None", "Loud"], correctIndex: 1, explanation: "Tiny is easy.", bloomsLevel: "apply" },
        { questionId: "q2", prompt: "What repeats?", choices: ["A", "B", "C", "D"], correctIndex: 0, explanation: "A repeats.", bloomsLevel: "remember" },
      ],
    },
    reviewCards: [
      { cardId: "rc1", front: "What beats a plan?", back: "A small cue.", difficulty: "easy" },
      { cardId: "rc2", front: "Why tiny?", back: "It repeats.", difficulty: "medium" },
    ],
    implementationPlan: {
      coreSkill: "Use a tiny cue.",
      ifThenPlans: [
        { context: "After coffee", plan: "write one line" },
        { context: "At the door", plan: "put on shoes" },
      ],
      twentyFourHourChallenge: "Do it once today.",
      weeklyPractice: "Do it daily.",
    },
    memorableLines: [{ text: "Start small." }, { text: "Cues carry the habit." }],
  };
}

// ---------------------------------------------------------------- templates and files

test("PROMPT_DIR is the absolute prompts folder next to src", () => {
  assert.ok(path.isAbsolute(PROMPT_DIR));
  assert.ok(PROMPT_DIR.endsWith(path.join("scripts", "book", "v26", "prompts")), PROMPT_DIR);
});

test("renderTemplate fills every placeholder, including repeats, and leaves other text alone", () => {
  const out = renderTemplate("A @@ONE@@ b @@TWO_2@@ c @@ONE@@. $& @ @@", { ONE: "1", TWO_2: "two" });
  assert.equal(out, "A 1 b two c 1. $& @ @@");
});

test("renderTemplate inserts a value literally (no $ patterns)", () => {
  assert.equal(renderTemplate("x @@A@@ y", { A: "$& and $1 and $$" }), "x $& and $1 and $$ y");
});

test("renderTemplate throws TEMPLATE_UNFILLED naming the missing key", () => {
  assert.throws(() => renderTemplate("a @@MISSING@@ b", {}), /TEMPLATE_UNFILLED: MISSING/);
  assert.throws(() => renderTemplate("a @@X@@ @@Y@@", { X: "1" }), /TEMPLATE_UNFILLED: Y/);
});

test("renderTemplate fills in one pass, so a placeholder that a value brings in is reported, not filled", () => {
  assert.throws(() => renderTemplate("a @@A@@", { A: "see @@LEFT_OVER@@" }), /TEMPLATE_UNFILLED: LEFT_OVER/);
  assert.throws(() => renderTemplate("@@A@@ @@B@@", { A: "@@B@@", B: "b" }), /TEMPLATE_UNFILLED: B/);
});

/** Runs fn, which must throw, and returns the error so a test can read its path. */
function thrownBy(fn: () => unknown): NodeJS.ErrnoException {
  try {
    fn();
  } catch (err) {
    return err as NodeJS.ErrnoException;
  }
  assert.fail("expected the call to throw");
}

test("loadPrompt reads <name>.md from V26_PROMPT_DIR when set, with no fallback to PROMPT_DIR", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-prompts-"));
  fs.writeFileSync(path.join(dir, "demo.md"), "FIRST LINE\nhello @@NAME@@\n");
  const saved = process.env.V26_PROMPT_DIR;
  try {
    process.env.V26_PROMPT_DIR = dir;
    assert.equal(loadPrompt("demo"), "FIRST LINE\nhello @@NAME@@\n");
    // A name that is missing from the override folder fails in that folder, not in PROMPT_DIR.
    const err = thrownBy(() => loadPrompt("nope"));
    assert.equal(err.code, "ENOENT");
    assert.equal(err.path, path.join(dir, "nope.md"));
  } finally {
    if (saved === undefined) delete process.env.V26_PROMPT_DIR;
    else process.env.V26_PROMPT_DIR = saved;
  }
});

test("loadPrompt reads from PROMPT_DIR when V26_PROMPT_DIR is not set", () => {
  const saved = process.env.V26_PROMPT_DIR;
  try {
    delete process.env.V26_PROMPT_DIR;
    // A missing name is looked up in PROMPT_DIR and nowhere else.
    const err = thrownBy(() => loadPrompt("demo-that-does-not-exist-anywhere"));
    assert.equal(err.code, "ENOENT");
    assert.equal(err.path, path.join(PROMPT_DIR, "demo-that-does-not-exist-anywhere.md"));
    // A prompt that is really in PROMPT_DIR comes back byte for byte.
    const shipped = fs.readdirSync(PROMPT_DIR).filter((f) => f.endsWith(".md"));
    assert.ok(shipped.length > 0, `no prompts found in ${PROMPT_DIR}`);
    for (const f of shipped) {
      assert.equal(loadPrompt(f.slice(0, -3)), fs.readFileSync(path.join(PROMPT_DIR, f), "utf8"));
    }
    // An empty value counts as not set.
    process.env.V26_PROMPT_DIR = "";
    assert.equal(loadPrompt(shipped[0].slice(0, -3)), fs.readFileSync(path.join(PROMPT_DIR, shipped[0]), "utf8"));
  } finally {
    if (saved === undefined) delete process.env.V26_PROMPT_DIR;
    else process.env.V26_PROMPT_DIR = saved;
  }
});

// ---------------------------------------------------------------- reader text

test("readerText has the exact labelled layout", () => {
  const expected = [
    "[title] Chapter One",
    "[hook] A hook about habits.",
    "[counterintuition] Plans do not make habits.",
    "[keyTakeaway] Small cues beat big plans.",
    "[tryThisNow] Pick one cue.",
    "[breakdown.fastRead]\nFast summary.",
    "[breakdown.deepRead]\nDeep telling.\n\nSecond paragraph.",
    "[breakdown.fullRead]\nFull telling.",
    "[examples.ex01] The Bus\nScenario: Ana misses her bus.\nWhat to do: Leave early.\nWhy it matters: Time.",
    "[examples.ex02] Lunch\nScenario: Ben skips lunch.\nWhat to do: Pack food.\nWhy it matters: Energy.",
    "[quiz.q1] Which cue works?\n  0. Big\n  1. Tiny\n  2. None\n  3. Loud\n  KEY: 1\n  Explanation: Tiny is easy.",
    "[quiz.q2] What repeats?\n  0. A\n  1. B\n  2. C\n  3. D\n  KEY: 0\n  Explanation: A repeats.",
    "[reviewCards.rc1] Front: What beats a plan? | Back: A small cue.",
    "[reviewCards.rc2] Front: Why tiny? | Back: It repeats.",
    [
      "[implementationPlan.coreSkill] Use a tiny cue.",
      "[implementationPlan.ifThenPlans.0] If: After coffee | Then: write one line",
      "[implementationPlan.ifThenPlans.1] If: At the door | Then: put on shoes",
      "[implementationPlan.twentyFourHourChallenge] Do it once today.",
      "[implementationPlan.weeklyPractice] Do it daily.",
    ].join("\n"),
    "[memorableLines.0] Start small.",
    "[memorableLines.1] Cues carry the habit.",
  ].join("\n\n");
  assert.equal(readerText(fixture()), expected);
});

test("readerText skips an empty top-level text field", () => {
  const c = fixture();
  c.hook = "";
  const out = readerText(c);
  assert.ok(!out.includes("[hook]"));
  assert.ok(out.startsWith("[title] Chapter One\n\n[counterintuition]"));
});

test("newReaderText is what a new reader saw before the quiz", () => {
  const expected = [
    "Hook: A hook about habits.",
    "Counterintuition: Plans do not make habits.",
    "Summary:\nFast summary.",
    'Lines worth keeping:\n- "Start small."\n- "Cues carry the habit."',
    "Try this now: Pick one cue.",
    "Example: The Bus\nAna misses her bus.\nWhat to do: Leave early.\nWhy it matters: Time.",
  ].join("\n\n");
  assert.equal(newReaderText(fixture()), expected);
});

test("newReaderText leaves out the lines and example blocks when there are none", () => {
  const c = fixture();
  c.memorableLines = [];
  c.examples = [];
  const out = newReaderText(c);
  assert.ok(!out.includes("Lines worth keeping"));
  assert.ok(!out.includes("Example:"));
  assert.ok(out.endsWith("Try this now: Pick one cue."));
});

test("allTiersText adds the middle and full tellings after the new-reader text", () => {
  const c = fixture();
  assert.equal(allTiersText(c), `${newReaderText(c)}\n\nMiddle-depth telling:\nDeep telling.\n\nSecond paragraph.\n\nFull telling:\nFull telling.`);
});

test("questionsBlock lists id, prompt and numbered choices, no key, blank line between", () => {
  const qs = fixture().quiz.questions;
  assert.equal(questionsBlock(qs), "[q1] Which cue works?\n  0. Big\n  1. Tiny\n  2. None\n  3. Loud\n\n[q2] What repeats?\n  0. A\n  1. B\n  2. C\n  3. D");
  assert.equal(questionsBlock([]), "");
});

// ---------------------------------------------------------------- header and traps

const TITLES: Record<number, string> = { 1: "First", 2: "Second", 3: "Third" };

test("chapterHeader for the first chapter", () => {
  assert.equal(
    chapterHeader(1, TITLES, []),
    'CHAPTER 1 of 3: "First". This is the first chapter of the book. The next chapter is "Second". Write only this chapter.',
  );
});

test("chapterHeader for a middle chapter", () => {
  assert.equal(
    chapterHeader(2, TITLES, []),
    'CHAPTER 2 of 3: "Second". The previous chapter is "First". The next chapter is "Third". Write only this chapter.',
  );
});

test("chapterHeader for the last chapter", () => {
  assert.equal(
    chapterHeader(3, TITLES, []),
    'CHAPTER 3 of 3: "Third". The previous chapter is "Second". This is the last chapter of the book. Write only this chapter.',
  );
});

test("chapterHeader lists earlier lessons when there are any", () => {
  assert.equal(
    chapterHeader(3, TITLES, ["Cues beat plans.", "Rest is work."]),
    'CHAPTER 3 of 3: "Third". The previous chapter is "Second". This is the last chapter of the book. Write only this chapter.' +
      "\nLessons already taught in earlier chapters (teach none of these again):\n- Cues beat plans.\n- Rest is work.",
  );
});

test("chapterHeader refuses a chapter that has no title", () => {
  assert.throws(() => chapterHeader(9, TITLES, []), /NO_SUCH_CHAPTER: 9/);
});

test("knownTrapsSection is empty for no entries, else a heading and dash bullets", () => {
  assert.equal(knownTrapsSection([]), "");
  const out = knownTrapsSection(["He was 17, not 16.", "The ship was the Mary."]);
  const lines = out.split("\n");
  assert.ok(lines[0].startsWith("FACTS THIS BOOK HAS BEEN WRONG ABOUT BEFORE."));
  assert.deepEqual(lines.slice(1), ["- He was 17, not 16.", "- The ship was the Mary."]);
});
