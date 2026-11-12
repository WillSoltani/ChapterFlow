/** The reader bar (2026-11-10): the per-chapter plan, the committed house exemplar, the app form of the practice plan,
 *  and the repeat rule in the publish band. No model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import os from "node:os";
import { bookTerms, extractNames, formText, hookCollisions, keyPositions, loadExemplar } from "../src/book";
import { runChecks } from "../src/checks";
import type { PipelineCtx } from "../src/pipeline";
import { appPlan } from "../src/publish";
import { bandOf, kindOf, weakKinds, type ChapterScore } from "../src/score";
import type { Chapter, LessonCard } from "../src/types";

const HOUSE = fileURLToPath(new URL("../house", import.meta.url));
const SHAPE = { examples: 3, quizQuestions: 7, choices: 3, reviewCards: 5, memorableLines: 3, ifThenPlans: 2, fastRead: [150, 220] as [number, number], deepRead: [350, 500] as [number, number], fullRead: [800, 1100] as [number, number] };
const house = () => loadExemplar({ config: { runDir: HOUSE } } as unknown as PipelineCtx);
const words = (t: string): number => t.trim().split(/\s+/).length;

// ---------------------------------------------------------------- the plan

test("the plan is a function of the chapter number: neighbours differ, the same chapter always gets the same plan", () => {
  const ex = house();
  const plan = (n: number): string => formText(ex, "A", n, SHAPE);
  assert.equal(plan(2), plan(2));
  const line = (n: number, start: string): string => plan(n).split("\n").find((l) => l.startsWith(start)) ?? "";
  for (const start of ["- counterintuition frame", "- examples", "- quiz", "- review cards", "- practice plan"]) {
    assert.notEqual(line(2, start), line(3, start), `${start} differs between chapters 2 and 3`);
  }
  assert.match(plan(2), /fastRead 150 to 220 words in at most 3 paragraphs; deepRead up to 500 words/);
  assert.match(plan(1), /the forms in this order: q1 what do you do; q2 spot the trap; q3 predict what happens; q4 best reply; q5 why does this work; q6 what would you change; q7 what do you do\./);
  assert.match(plan(2), /the forms in this order: q1 spot the trap; q2 predict what happens;/);
  assert.match(plan(1), /Tags and settings for examples 1 to 3, in this order: work \(an office or a sales team\); school \(a teenager at school\); personal \(family/);
  // The first example is the one a reader sees: never the school one.
  for (let n = 1; n <= 12; n++) assert.doesNotMatch(plan(n), /in this order: school /);
  // The settings, the harder situation and the cue kinds move from chapter to chapter; no two of the first six chapters share a work setting.
  const workSetting = (n: number): string => /(?:work) \(([^;.]+?)\)[;.]/.exec(line(n, "- examples"))?.[1] ?? "";
  assert.equal(new Set([1, 2, 3, 4, 5, 6].map(workSetting)).size, 6);
  assert.match(plan(1), /What makes example 3 the harder one: a strong feeling is in the way/);
  assert.match(plan(2), /What makes example 3 the harder one: another person disagrees or pushes back\./);
  assert.match(plan(1), /The kinds of cue for this chapter: a routine moment of the day or the week .*; the moment the reader notices the very slip this lesson is about\./);
  assert.notEqual(line(1, "- practice plan"), line(2, "- practice plan"));
  assert.match(plan(2), /counterintuition frame: "People say \[the belief\]\. It sounds right/);
  assert.match(plan(1), /The hook is built on a moment in progress, .* The try-this line asks the reader to do the smallest version of the move once/);
  assert.match(plan(2), /The hook is built on a blunt claim with a turn in it\. The try-this line asks the reader to move, set out or put away one object\./);
  assert.match(formText(ex, "D", 3, SHAPE), /Path: the claim; the book's evidence that proves it; .*THIS chapter opens as D instead\. Follow the path given here/);
});

test("the plan against sameness: what a reader of the whole book would notice repeating moves from chapter to chapter", () => {
  const ex = house();
  const plan = (n: number): string => formText(ex, "A", n, SHAPE);
  const line = (n: number, start: string): string => plan(n).split("\n").find((l) => l.startsWith(start)) ?? "";
  const eight = [1, 2, 3, 4, 5, 6, 7, 8];
  // The line under the hook: eight frames of eight different builds, so an eight-chapter book never shows one twice.
  const frames = eight.map((n) => line(n, "- counterintuition frame"));
  assert.equal(new Set(frames).size, 8);
  assert.equal(new Set(frames.map((f) => f.replace("- counterintuition frame: ", "").slice(0, 12))).size, 8, "no two frames start alike");
  for (const f of frames) for (const part of ["belief", "correction", "reason"]) assert.match(f, new RegExp(part, "i"), `${f} names the ${part}`);
  assert.equal(line(9, "- counterintuition frame"), line(1, "- counterintuition frame"));
  // The last sentence of the summary and the place where the first example stops: five forms each, neighbours differ.
  const ending = (n: number): string => /The last sentence of each length states the lesson as ([^.]+)\./.exec(plan(n))?.[1] ?? "";
  const stop = (n: number): string => /Example 1's scenario stops ([^.]+)\./.exec(plan(n))?.[1] ?? "";
  assert.equal(new Set([1, 2, 3, 4, 5].map(ending)).size, 5);
  assert.equal(new Set([1, 2, 3, 4].map(stop)).size, 4);
  assert.match(ending(1), /^a plain instruction, verb first/);
  assert.match(stop(1), /^just before the choice/);
  assert.equal(eight.filter((n) => /just before the choice/.test(stop(n))).length, 2, "the person about to act: two chapters in eight, not eight");
  assert.ok(eight.filter((n) => /^an if-then/.test(ending(n))).length <= 2, "the if-then ending is rare: the practice plan below is already one");
  // Every stop is the moment before the move; none asks for a detail that does no work in the scene.
  for (const n of [1, 2, 3, 4]) assert.match(stop(n), /about to act|someone says|waiting for the person's answer|asking themselves/);
  // No two of the first eight chapters share all three of hook kind, ending and example stop.
  const hook = (n: number): string => /The hook is built on ([^.]+)\./.exec(plan(n))?.[1] ?? "";
  for (const a of eight) for (const b of eight) if (a < b) assert.ok(!(hook(a) === hook(b) && ending(a) === ending(b) && stop(a) === stop(b)), `chapters ${a} and ${b}`);
  // A summary that answers its opening question answers it in the plan's form, not in a second closing line.
  assert.match(plan(2), /where the path ends on a question answered, this sentence is the answer, in this form/);
  // The quiz: six forms in seven questions, so every form is there and only the first of the turn comes twice; the
  // question a reader meets first moves from chapter to chapter.
  const forms = (n: number): string[] => (/the forms in this order: ([^.]+)\./.exec(line(n, "- quiz"))?.[1] ?? "").split("; ").map((x) => x.replace(/^q\d+ /, ""));
  for (const n of eight) assert.equal(new Set(forms(n)).size, 6, `chapter ${n}`);
  assert.equal(new Set([1, 2, 3, 4, 5, 6].map((n) => forms(n)[0])).size, 6);
  const all = new Set(eight.flatMap(forms));
  for (const gone of ["which comes first", "who got it right", "what is missing", "where does it apply"]) assert.ok(!all.has(gone), `"${gone}" misfired in the proofs`);
  // One named piece of outside advice a chapter, a different one in each of eight chapters.
  const outside = (n: number): string => /for this chapter it is: ([^.]+)\./.exec(line(n, "- quiz"))?.[1] ?? "";
  assert.equal(new Set(eight.map(outside)).size, 8);
  // The people of the quiz: seven a chapter, and nobody twice in the first six chapters.
  assert.match(line(3, "- quiz"), /If that is part of this chapter's own lesson, or fits no question, use no outside advice\./);
  // No list of people for the quiz: a job on every question, and then on two, read as dropped in.
  assert.doesNotMatch(line(1, "- quiz"), /people|walks of life/);
  // The author is introduced once, in chapter 1.
  assert.match(plan(1), /Where the author is first named, say who they are in a few words\./);
  for (const n of [2, 5, 8]) assert.match(plan(n), /Name the author by full name at first mention, with no job title or credentials .*where the author is a person in this chapter's own story, say who they were/);
  // Two work settings no longer both read as "someone who owns a small shop".
  assert.doesNotMatch(eight.map(plan).join("\n"), /a small business from the owner's side/);
});

test("the writer prompt hands these choices to the plan and names no stock wrong answer or frozen hand itself", () => {
  const prompt = fs.readFileSync(fileURLToPath(new URL("../prompts/write-exemplar.md", import.meta.url)), "utf8");
  assert.match(prompt, /the last sentence takes the form THE PLAN names/);
  assert.match(prompt, /its scenario stops where THE PLAN says/);
  assert.match(prompt, /only the kind THE PLAN names; if that kind is part of this chapter's own lesson or fits no question, use none/);
  assert.match(prompt, /A question names a person's job only when the situation turns on it\./);
  assert.match(prompt, /A form says what a question tests, not how to word it/);
  // Every form the plan can name is glossed in the prompt.
  for (const form of ["what do you do", "spot the trap", "predict what happens", "best reply", "why does this work", "what would you change"]) assert.ok(prompt.includes(form), form);
  assert.doesNotMatch(prompt, /which comes first|who got it right|what is missing|where does it apply/);
  // Naming a tic in a rule is how it gets into every chapter: these lists are gone from the prompt.
  assert.doesNotMatch(prompt, /want it more, be stricter|hovering thumb|pen in the air|ending at the moment of choice|returning to the opening/);
});

test("key positions: every position is the key at least twice, the first five use all three, and question 1 moves", () => {
  const first: number[] = [];
  for (let n = 1; n <= 12; n++) {
    const row = keyPositions(n, 7, 3);
    assert.equal(row.length, 7);
    for (const p of [0, 1, 2]) assert.ok(row.filter((x) => x === p).length >= 2, `chapter ${n}: position ${p}`);
    assert.equal(new Set(row.slice(0, 5)).size, 3, `chapter ${n}: the first five`);
    first.push(row[0]!);
  }
  assert.deepEqual(first.slice(0, 6), [0, 1, 2, 0, 1, 2]);
  assert.deepEqual(keyPositions(2, 4, 4), [1, 2, 3, 0], "other shapes cycle");
});

// ---------------------------------------------------------------- the house exemplar

test("the committed house exemplar loads, keeps the owner's openers and the book's names, and obeys the rules it sets", async () => {
  const ex = house();
  assert.equal(ex.chapter, 1);
  assert.deepEqual(ex.approvedSummary, ["A", "B", "D"]);
  assert.ok(ex.bookNames.includes("Galileo") && ex.bookNames.includes("Nicolas Fouquet"));
  assert.deepEqual(ex.names, ["Leah", "Marcus", "Maya", "Priya"]);
  const c: Chapter = ex.chapterJson;
  assert.ok(words(c.hook) <= 25, `hook is ${words(c.hook)} words`);
  assert.ok(words(c.tryThisNow) <= 25 && c.tryThisNow.split(/(?<=[.!?])\s+/).length === 1, "tryThisNow is one action, no reason sentence");
  const all = JSON.stringify(c);
  assert.doesNotMatch(all, /ease off|stop short of|does not say|follows the mistaken idea/i, "no limit sentence, no aside, no stock explanation");
  for (const t of ["fastRead", "deepRead", "fullRead"] as const) assert.ok(c.breakdown[t].endsWith("the reward comes back to you."), `${t} ends on the lesson`);
  assert.deepEqual(c.examples.map((e) => e.tags), [["work"], ["school"], ["personal"]]);
  assert.deepEqual(c.quiz.questions.map((q) => q.correctIndex), keyPositions(1, 7, 3));
  const len = (q: Chapter["quiz"]["questions"][number]): number[] => q.choices.map(words);
  for (const q of c.quiz.questions) assert.ok(Math.max(...len(q)) - Math.min(...len(q)) <= 3, `${q.questionId}: choices are one length`);
  for (const q of c.quiz.questions) {
    const chars = q.choices.map((x) => x.length);
    const key = chars[q.correctIndex]!;
    assert.ok(key < Math.max(...chars) && key > Math.min(...chars), `${q.questionId}: the right choice is neither the longest nor the shortest`);
  }
  for (const p of c.implementationPlan.ifThenPlans) {
    assert.match(p.context, /^When I /);
    assert.ok(words(p.context) <= 14);
    assert.match(p.plan, /^then I /);
  }
  const lesson = JSON.parse(fs.readFileSync(path.join(HOUSE, "exemplars", "ch01.json"), "utf8")).lesson as LessonCard;
  const r = await runChecks(c, lesson, { n: 1, book: { bookId: "house", title: "T", author: "A", categories: [], tags: [], bookType: "argument" }, authorText: "", shape: SHAPE, earlierLessons: [] });
  assert.deepEqual(r.blocking, []);
  assert.deepEqual(r.reported, []);
  assert.ok(!r.advisory.some((a) => /uniquely (longest|shortest)|FK grade|stem is/.test(a)), r.advisory.join("\n"));
});

// ---------------------------------------------------------------- the app form of the practice plan

test("appPlan: the cue and the action become one sentence, the chip gets a tag, and a plan already in the app's form is left alone", () => {
  assert.deepEqual(appPlan({ context: "When I am about to share good news about my work in a meeting", plan: "then I start with what my boss set up." }), {
    context: "work",
    plan: "When I am about to share good news about my work in a meeting, I start with what my boss set up.",
  });
  assert.deepEqual(appPlan({ context: "When I sit down to do my homework,", plan: "Then I write one line first" }), { context: "school", plan: "When I sit down to do my homework, I write one line first." });
  assert.deepEqual(appPlan({ context: "When I am brushing my teeth at night and think, \"I failed again\"", plan: "then I name the missing piece." }), {
    context: "personal",
    plan: "When I am brushing my teeth at night and think, \"I failed again\", I name the missing piece.",
  });
  const once = appPlan({ context: "When I catch myself working late again", plan: "then I close the laptop." });
  assert.equal(once.context, "personal", "\"working\" is not the word \"work\"");
  assert.deepEqual(appPlan(once), once, "idempotent");
  assert.equal(appPlan({ context: 'When I catch myself thinking, "I just need to try harder."', plan: "then I list three other actions." }).plan, 'When I catch myself thinking, "I just need to try harder", I list three other actions.');
  assert.deepEqual(appPlan({ context: "Work", plan: "If a task slips, then name it." }), { context: "work", plan: "If a task slips, then name it." });
});

// ---------------------------------------------------------------- the repeat rule

const scored = (n: number, score: number, weak: string[] = []): ChapterScore => ({ chapter: n, score, passCount: 0, total: 0, failed: [], stage: "clean", blocking: 0, guessable: false, weak });

test("weak kinds: a family is weak when half its items fail; every other item is its own kind", () => {
  assert.equal(kindOf("TEMPT-q3"), "TEMPT");
  assert.equal(kindOf("EXFIT-ex02"), "EXFIT");
  assert.equal(kindOf("ARC-fastRead"), "ARC-fastRead");
  const items = [
    ...["q1", "q2", "q3", "q4"].map((q, i) => ({ id: `TEMPT-${q}`, pass: i >= 2 })),
    ...["q1", "q2", "q3", "q4"].map((q, i) => ({ id: `QUIZ-${q}`, pass: i >= 1 })),
    { id: "TRY", pass: false },
    { id: "SPINE", pass: true },
  ];
  assert.deepEqual(weakKinds(items), ["TEMPT", "TRY"]);
});

test("bandOf: a kind that is weak in half the chapters holds a high-scoring book for the owner, by name", () => {
  const t = { auto: 80, manual: 70 };
  const clean = [1, 2, 3, 4, 5, 6].map((n) => scored(n, 93));
  assert.equal(bandOf(clean, t).band, "auto");
  const repeated = [1, 2, 3, 4, 5, 6].map((n) => scored(n, 93, n <= 3 ? ["TRY", "TEMPT"] : n === 4 ? ["TEMPT"] : []));
  const r = bandOf(repeated, t);
  assert.equal(r.band, "manual");
  assert.deepEqual(r.reasons, ["TEMPT fails in 4 of 6 chapters", "TRY fails in 3 of 6 chapters"]);
  assert.deepEqual(r.redo, [], "a repeat is the owner's call, not a redo list");
  const once = [1, 2, 3, 4, 5, 6].map((n) => scored(n, 93, n === 1 ? ["TRY"] : []));
  assert.equal(bandOf(once, t).band, "auto", "one weak chapter is not a repeat");
  assert.equal(bandOf([scored(1, 93, ["TRY"]), scored(2, 93, ["TRY"])], t).band, "auto", "the rule needs four chapters");
  assert.equal(bandOf(clean.map((c) => ({ ...c, weak: undefined })), t).band, "auto", "scores saved before the rule have no weak list");
});

// ---------------------------------------------------------------- the book's own terms are not names

test("the book's capitalized terms and a language are never taken for an invented person", () => {
  const ctx = {
    config: {
      title: "Tiny Habits",
      author: "BJ Fogg",
      chapters: [
        { number: 1, title: "Prompts: The Power of After", keys: "Write a recipe. The old routine is the Anchor, and the weakest link of the Ability Chain decides. Story the author tells: none." },
      ],
    },
  } as unknown as PipelineCtx;
  const terms = bookTerms(ctx);
  for (const t of ["Anchor", "Ability", "Chain", "Fogg", "Habits", "Prompts", "Power"]) assert.ok(terms.includes(t), t);
  assert.ok(!terms.includes("Write") && !terms.includes("Story"), "a sentence opener in the keys is not a term");
  const c = house().chapterJson;
  const withTerms: Chapter = { ...c, breakdown: { ...c.breakdown, fastRead: "Kasia ties the new habit to an Anchor, and Kasia's evening Spanish class hears about the Ability Chain." } };
  assert.deepEqual(extractNames(withTerms, ["Galileo", ...terms], "all").filter((x) => !house().bookNames.join(" ").includes(x)).filter((x) => !["Leah", "Marcus", "Maya", "Priya", "Fouquet", "Louis", "Cosimo", "Medici"].includes(x)), ["Kasia"]);
});

// ---------------------------------------------------------------- first screens side by side

test("hookCollisions names two chapters whose hooks open on the same object, and leaves the book's own terms alone", () => {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-hooks-"));
  const base = house().chapterJson;
  const land = (n: number, hook: string): void => {
    fs.mkdirSync(path.join(runDir, `ch0${n}`), { recursive: true });
    fs.writeFileSync(path.join(runDir, `ch0${n}`, "final.json"), JSON.stringify({ ...base, hook }));
  };
  land(1, "It is 10 p.m., and your running shoes sit at the back of the closet.");
  land(2, "The yoga mat you could not wait to unroll now gathers dust. A tiny habit would have survived.");
  land(3, "You promise to try harder, eyeing the dusty yoga mat again. A tiny habit asks less.");
  const ctx = { config: { runDir, title: "Tiny Habits", author: "BJ Fogg", chapters: [] } } as unknown as PipelineCtx;
  assert.deepEqual(hookCollisions(ctx, [1, 2, 3, 4]), [{ words: "yoga mat", chapters: ["ch02", "ch03"] }]);
  fs.rmSync(runDir, { recursive: true, force: true });
});
