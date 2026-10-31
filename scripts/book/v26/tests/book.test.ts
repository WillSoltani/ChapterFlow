import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main } from "../cli";
import { loadBookConfig } from "../src/config";
import { makeCtx, type PipelineCtx } from "../src/pipeline";
import { copyAndVarietyIssues, extractNames, formText, loadExemplar, readVariety, runBookChapters, usedText, writeBookChapter } from "../src/book";
import { readLedger } from "../src/ledger";
import type { Chapter } from "../src/types";

// ---------------------------------------------------------------- fixtures

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const LESSON1 = "Name the fault in writing before you try to mend it.";
const LESSON2 = "Ask one question before you give advice, so the advice fits.";

const para = (tag: string, k: number, n = 70): string => Array.from({ length: n }, (_, w) => `w${tag}${k}${w}`).join(" ");
/** The same sentence with the chapter's tag every five words, so two chapters never share an eight-word run. */
const vary = (tag: string, text: string): string => text.split(" ").map((w, i) => (i > 0 && i % 5 === 0 ? `${tag} ${w}` : w)).join(" ");
const q = (id: number, prompt: string, key: number) => ({ questionId: `q${id}`, prompt, choices: ["Scold yourself", "Write it down", "Ignore it"], correctIndex: key, explanation: "Naming the fault starts the mending.", bloomsLevel: "apply" });

/** A chapter in the exemplar's shape. `tag` keeps its filler words apart from another chapter's. */
function chapter(tag: string, over: Partial<Chapter> & { names?: [string, string, string] } = {}): Chapter {
  const [n1, n2, n3] = over.names ?? ["Maya", "Priya", "Marcus"];
  const tiers = (k: number): string => Array.from({ length: k }, (_, i) => para(tag, i + 1)).join("\n\n");
  const { names: _n, ...rest } = over;
  void _n;
  return {
    title: `A ${tag} title`,
    hook: vary(tag, `${n1} has just landed the biggest client the team has ever had. What does ${n1} tell the meeting?`),
    counterintuition: vary(tag, "Many people think good work speaks for itself. Actually it pays off when it makes the boss look good."),
    keyTakeaway: LESSON1,
    tryThisNow: vary(tag, "Write one line today that names how your boss helped with the win."),
    memorableLines: [{ text: vary(tag, "Tell your wins so the person above you looks smart for backing you.") }],
    breakdown: { fastRead: tiers(2), deepRead: tiers(4), fullRead: tiers(8) },
    examples: ["work", "school", "personal"].map((t, i) => ({ exampleId: `ex0${i + 1}`, title: `Example ${tag}${i}`, tags: [t], scenario: `At ${t}, ${[n1, n2, n3][i]} faces a choice (${tag}).`, whatToDo: `Thank the ${tag} manager first.`, whyItMatters: `The manager looks smart for backing you (${tag}).` })),
    quiz: { passingScorePercent: 70, questions: [0, 1, 2, 0, 1, 2, 0].map((k, i) => q(i + 1, `Question ${tag}${i}: what do you do?`, k)) },
    reviewCards: [1, 2, 3, 4, 5].map((i) => ({ cardId: `rc${i}`, front: `Front ${tag}${i}`, back: `Back ${tag}${i}`, difficulty: "easy" })),
    implementationPlan: { coreSkill: `Share credit upward (${tag}).`, ifThenPlans: [{ context: `When I finish a ${tag} task`, plan: "then I name the help" }, { context: "When someone praises me", plan: `then I credit my ${tag} boss` }], twentyFourHourChallenge: `Send one ${tag} note of credit.`, weeklyPractice: `Review your ${tag} credits on Sunday.` },
    ...rest,
  };
}

const lesson = (text: string, k: number) => ({ lesson: text, wrongBelief: "Good work is enough.", keyPhrase: `move ${k}`, hookQuestion: "Why?", storyNames: ["Galileo"], evidence: ["the moons"], whyThisOne: "why" });
const LESSONS2 = { lessons: [LESSON2, "L2b", "L2c", "L2d", "L2e"].map((l, i) => lesson(l, i)) };
const written = (over: Record<string, unknown> = {}) => ({ ...chapter("B", { keyTakeaway: LESSON2, names: ["Jonah", "Lena", "Omar"] }), _used: { names: ["Jonah", "Lena", "Omar"], settings: ["a bakery"], analogies: ["a flashlight"] }, ...over });
const SOLVER_OK = { answers: [0, 1, 2, 0, 1, 2, 0].map((k, i) => ({ questionId: `q${i + 1}`, choice: k, alsoDefensible: [], reason: "the lesson says so" })) };
const FACT_OK = { sentencesChecked: 30, issues: [] };

const GOOD: Record<string, unknown[]> = {
  "pipe-vlessons": [{ result: LESSONS2, cost: 0.1 }],
  "pipe-bwrite": [{ result: written(), cost: 0.6 }],
  "pipe-vfactcheck": [{ result: FACT_OK, cost: 0.15 }],
  "pipe-keysolve": [{ result: SOLVER_OK, cost: 0.05 }],
  "pipe-fix": [{ result: { edits: [], keyChanges: [], declined: [] }, cost: 0.3 }],
};

// ---------------------------------------------------------------- harness

const roots: string[] = [];
after(() => {
  delete process.env.V26_PROMPT_DIR;
  delete process.env.FAKE_PIPE_DIR;
  for (const d of roots) fs.rmSync(d, { recursive: true, force: true });
});

interface Harness {
  ctx: PipelineCtx;
  configPath: string;
  runDir: string;
  script(over: Record<string, unknown[]>): void;
  calls(scenario?: string): Array<{ scenario: string; index: number; effort: string; prompt: string }>;
}

/** A knowledge-mode book with three chapters whose ch01 is an approved exemplar (final.json + exemplars/ch01.json). */
function harness(opts: { concurrency?: number } = {}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-book-"));
  roots.push(dir);
  const pipeDir = path.join(dir, "pipe");
  fs.mkdirSync(pipeDir);
  delete process.env.V26_PROMPT_DIR;
  process.env.FAKE_PIPE_DIR = pipeDir;
  fs.writeFileSync(path.join(dir, "brief.md"), "THE BOOK: a test argument book.\n");
  const runDir = path.join(dir, "run");
  const configPath = path.join(dir, "book.json");
  const role = (model: string) => ({ bin: FAKE, model, effort: "high" });
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      bookId: "demo", title: "Demo Book", author: "A. Author", bookType: "argument", categories: ["Productivity"], tags: ["demo"],
      chapters: [{ number: 1, title: "Law One" }, { number: 2, title: "Law Two" }, { number: 3, title: "Law Three" }],
      briefPath: "brief.md",
      shape: { examples: 3, quizQuestions: 7, choices: 3, reviewCards: 5, memorableLines: 1, ifThenPlans: 2, fastRead: [100, 220], deepRead: [250, 500], fullRead: [500, 1100] },
      writer: role("claude-opus-5-5"), checker: role("claude-opus-5-5"), solver: role("claude-sonnet-5-5"),
      concurrency: opts.concurrency ?? 2, budgetUsd: 100, runDir, ledgerPath: path.join(dir, "ledger.jsonl"),
    }),
  );
  // The approved exemplar.
  const ex = chapter("A");
  fs.mkdirSync(path.join(runDir, "ch01"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "ch01", "final.json"), JSON.stringify(ex));
  fs.writeFileSync(path.join(runDir, "ch01", "lesson.json"), JSON.stringify({ lesson: LESSON1, wrongBelief: "w", keyPhrase: "k", hookQuestion: "h", storyNames: ["Galileo"], evidence: ["e"] }));
  fs.writeFileSync(path.join(runDir, "ch01", "status.json"), JSON.stringify({ chapter: 1, stage: "clean", round: 0, rerun: false, lessonRating: "UNKNOWN", open: [], spend: 2, lesson: LESSON1, assembled: true }));
  fs.mkdirSync(path.join(runDir, "exemplars"), { recursive: true });
  fs.writeFileSync(
    path.join(runDir, "exemplars", "ch01.json"),
    JSON.stringify({
      bookId: "demo", chapter: 1, lesson: { lesson: LESSON1, storyNames: ["Galileo"] },
      picks: { summary: { label: "A", approach: "problem scene" }, examples: { label: "A", approach: "one decision moment" }, quiz: { label: "E", approach: "one of each" }, cards: { label: "E", approach: "mixed" }, practice: { label: "B", approach: "specific cues" } },
      notes: { summary: "A: excellent", general: "keep it plain" },
    }),
  );
  const h: Harness = {
    ctx: makeCtx(loadBookConfig(configPath)),
    configPath,
    runDir,
    script: (over) => fs.writeFileSync(path.join(pipeDir, "script.json"), JSON.stringify({ ...GOOD, ...over })),
    calls: (scenario) => fs.readdirSync(pipeDir).filter((f) => f.endsWith(".call.json") && (scenario === undefined || f.startsWith(`${scenario}.`))).map((f) => JSON.parse(fs.readFileSync(path.join(pipeDir, f), "utf8"))),
  };
  h.script({});
  return h;
}

// ---------------------------------------------------------------- 0-call helpers

test("extractNames finds the exemplar's first names and leaves story names, weekdays and sentence openers out", () => {
  const names = extractNames(chapter("A"), ["Galileo", "Jupiter"]);
  assert.deepEqual(names, ["Marcus", "Maya", "Priya"]);
  assert.deepEqual(extractNames(chapter("A", { breakdown: { fastRead: "Fouquet threw a party for Louis. Fouquet was arrested.", deepRead: "x", fullRead: "y" } }), ["Galileo"], "all"), ["Fouquet", "Louis", "Marcus", "Maya", "Priya"]);
  assert.deepEqual(extractNames(chapter("A", { breakdown: { fastRead: "Fouquet threw a party for Louis. Fouquet was arrested.", deepRead: "x", fullRead: "y" } }), ["Galileo"], "invented"), ["Marcus", "Maya", "Priya"]);
});

test("loadExemplar reads the picks, notes, chapter and names; formText carries the picked rules and the measurements", () => {
  const h = harness();
  const ex = loadExemplar(h.ctx);
  assert.equal(ex.chapter, 1);
  assert.deepEqual(ex.names, ["Marcus", "Maya", "Priya"]);
  assert.equal(ex.picks.quiz.label, "E");
  const form = formText(ex);
  assert.match(form, /summary .*: A, "problem scene": open on a modern everyday moment/);
  assert.match(form, /fastRead 140 words in 2 paragraphs; deepRead 280 words in 4 paragraphs; fullRead 560 words in 8 paragraphs/);
  assert.match(form, /quiz: 7 questions with 3 choices each; E, "one of each"/);
  assert.match(form, /practice plan: 2 if-then plans; B, "specific cues"/);
  assert.throws(() => loadExemplar(h.ctx, 7), /NO_EXEMPLAR/);
});

test("copyAndVarietyIssues blocks an exemplar name or an eight-word run, and reports a name from another chapter", () => {
  const h = harness();
  const ex = loadExemplar(h.ctx);
  const clean = chapter("B", { names: ["Jonah", "Lena", "Omar"] });
  assert.deepEqual(copyAndVarietyIssues(clean, ex, { chapters: {} }, 2), { blocking: [], reported: [] });
  const copied = chapter("B", { names: ["Maya", "Lena", "Omar"], tryThisNow: chapter("A").hook });
  const r = copyAndVarietyIssues(copied, ex, { chapters: { ch03: { names: ["Omar"], settings: [], analogies: [] } } }, 2);
  assert.ok(r.blocking.some((i) => i.field === "hook" && /"Maya" is a name from the approved chapter/.test(i.text)));
  assert.ok(r.blocking.some((i) => i.field === "tryThisNow" && /also appear in the approved chapter/.test(i.text)));
  assert.ok(r.reported.some((i) => /"Omar" is already used in another chapter/.test(i.text)));
  const scene = { ...ex, sceneNames: ["Fouquet"] };
  const r2 = copyAndVarietyIssues(chapter("B", { names: ["Jonah", "Lena", "Omar"], hook: vary("B", "Fouquet threw a party and the boss did not smile at all.") }), scene, { chapters: {} }, 2);
  assert.equal(r2.blocking.length, 0);
  assert.ok(r2.reported.some((i) => /exemplar scene: "Fouquet"/.test(i.text)));
  assert.match(usedText({ chapters: { ch03: { names: ["Omar"], settings: ["a bakery"], analogies: [] } } }, ex, 2), /names: Marcus, Maya, Omar, Priya\nsettings: a bakery\nanalogies: \(none yet\)/);
});

// ---------------------------------------------------------------- writeBookChapter

test("writeBookChapter: lessons, write, fact check and key solver; the prompt carries the exemplar, the form, the notes and the ledger; files land", async () => {
  const h = harness();
  const ex = loadExemplar(h.ctx);
  const st = await writeBookChapter(h.ctx, 2, ex);
  assert.equal(st.stage, "clean", JSON.stringify(st.open));
  assert.equal(st.fixed, false);
  assert.equal(st.lesson, LESSON2);
  assert.deepEqual(h.calls().map((c) => c.scenario).sort(), ["pipe-bwrite", "pipe-keysolve", "pipe-vfactcheck", "pipe-vlessons"]);

  const lp = h.calls("pipe-vlessons")[0].prompt;
  assert.match(lp, /Lessons already taught in earlier chapters \(teach none of these again\):\n- Name the fault in writing/);
  const wp = h.calls("pipe-bwrite")[0].prompt;
  assert.doesNotMatch(wp, /@@[A-Z_]+@@/);
  assert.match(wp, /THERE IS NO SOURCE TEXT/);
  assert.match(wp, /The owner's notes on the exemplar: summary: A: excellent \| general: keep it plain/);
  assert.match(wp, /A, "problem scene": open on a modern everyday moment/);
  assert.match(wp, /names: Marcus, Maya, Priya/);
  assert.match(wp, /<exemplar>\n\{\n "title": "A A title"/);
  assert.match(wp, /Lessons already taught by other chapters of this book/);
  assert.match(wp, /"_used": \{"names"/);
  const fp = h.calls("pipe-vfactcheck")[0].prompt;
  assert.match(fp, /\[fastRead\]\n/);
  const kp = h.calls("pipe-keysolve")[0].prompt;
  assert.match(kp, /PART 1: questions q1, q2, q3, q4, q5/);
  assert.match(kp, /PART 2: questions q6, q7/);

  for (const f of ["final.json", "status.json", "lesson.json"]) assert.ok(fs.existsSync(path.join(h.runDir, "ch02", f)), f);
  assert.ok(fs.existsSync(path.join(h.runDir, "reading", "ch02.html")));
  const ledger = readVariety(h.ctx);
  assert.deepEqual(ledger.chapters.ch02.settings, ["a bakery"]);
  assert.deepEqual(ledger.chapters.ch02.names, ["Jonah", "Lena", "Omar"]);
  assert.deepEqual([...new Set(readLedger(h.ctx.ledgerPath).map((r) => r.step))].sort(), ["book-factcheck", "book-keysolve", "book-lessons", "book-write"]);
  const final = JSON.parse(fs.readFileSync(path.join(h.runDir, "ch02", "final.json"), "utf8"));
  assert.equal("_used" in final, false);
});

test("writeBookChapter: a wrong key and a fact flag start one fix round, then the checks run again; leftovers stay open", async () => {
  const h = harness();
  const ex = loadExemplar(h.ctx);
  // The solver reads q2 as choice 0; the fix moves the key to 0, and the solver then agrees with the new key.
  const solverSaysZero = { answers: SOLVER_OK.answers.map((a, i) => (i === 1 ? { ...a, choice: 0 } : a)) };
  h.script({
    "pipe-keysolve": [{ result: solverSaysZero }, { result: solverSaysZero }],
    "pipe-vfactcheck": [{ result: { sentencesChecked: 3, issues: [{ variant: "fullRead", kind: "WHO", field: "summary", chapterText: "wB80", verdict: "CONTRADICTED", sourceText: "none", fix: "name the father" }] } }, { result: FACT_OK }],
    "pipe-fix": [{ result: { edits: [{ field: "breakdown.fullRead", find: "wB80", replace: "the father" }], keyChanges: [{ questionId: "q2", newIndex: 0, keyedChoiceText: "Scold yourself" }], declined: [] } }],
  });
  const st = await writeBookChapter(h.ctx, 2, ex);
  assert.equal(st.fixed, true);
  assert.equal(st.round, 1);
  assert.equal(st.stage, "clean", JSON.stringify(st.open));
  const fixPrompt = h.calls("pipe-fix")[0].prompt;
  assert.match(fixPrompt, /^You wrote the ChapterFlow chapter below for a published book whose text is not available here/);
  assert.match(fixPrompt, /1\. \[breakdown\.fullRead\] WHO \(CONTRADICTED\)/);
  assert.match(fixPrompt, /\[quiz\.q2\] the solver picked choice 0, the key is 1/);
  assert.equal(h.calls("pipe-keysolve").length, 2);
  assert.equal(h.calls("pipe-vfactcheck").length, 2);
  const final = JSON.parse(fs.readFileSync(path.join(h.runDir, "ch02", "final.json"), "utf8"));
  assert.equal(final.quiz.questions[1].correctIndex, 0);
  assert.match(final.breakdown.fullRead, /the father/);

  // A flag the fix did not clear stays open.
  const h2 = harness();
  h2.script({ "pipe-vfactcheck": [{ result: { sentencesChecked: 3, issues: [{ variant: "deepRead", kind: "WHY", field: "summary", chapterText: "wB20", verdict: "UNSUPPORTED", sourceText: "none", fix: "cut it" }] } }] });
  const st2 = await writeBookChapter(h2.ctx, 2, loadExemplar(h2.ctx));
  assert.equal(st2.stage, "open-issues");
  assert.ok(st2.open.some((i) => i.source === "fact" && i.field === "breakdown.deepRead"));
});

test("writeBookChapter blocks an exemplar copy and resumes from status.json; the exemplar itself is never rewritten", async () => {
  const h = harness();
  const ex = loadExemplar(h.ctx);
  h.script({ "pipe-bwrite": [{ result: written({ hook: chapter("A").hook }) }] });
  const st = await writeBookChapter(h.ctx, 2, ex);
  assert.equal(st.stage, "open-issues");
  assert.ok(st.open.some((i) => /exemplar copy: "Maya"/.test(i.text)));
  assert.equal(h.calls("pipe-fix").length, 1, "a copy is sent to the fix round");
  const again = await writeBookChapter(h.ctx, 2, ex);
  assert.equal(again.stage, "open-issues");
  assert.equal(h.calls("pipe-bwrite").length, 1, "resumed from status.json, not rewritten");
  await assert.rejects(writeBookChapter(h.ctx, 1, ex), /EXEMPLAR_CHAPTER/);
});

test("runBookChapters skips the exemplar, runs the rest, and the second chapter's prompts carry the first chapter's lesson and names", async () => {
  const h = harness({ concurrency: 1 });
  h.script({ "pipe-bwrite": [{ result: written() }, { result: written({ keyTakeaway: "L2b", _used: { names: ["Zara"], settings: ["a gym"], analogies: [] } }) }], "pipe-vlessons": [{ result: LESSONS2 }, { result: { lessons: [lesson("L2b", 0), ...LESSONS2.lessons.slice(1)] } }] });
  const statuses = await runBookChapters(h.ctx, [1, 2, 3]);
  assert.deepEqual(statuses.map((s) => s.chapter), [2, 3]);
  const third = h.calls("pipe-bwrite")[1].prompt;
  assert.match(third, /names: Jonah, Lena, Marcus, Maya, Omar, Priya/);
  assert.match(third, /settings: a bakery/);
  const thirdLessons = h.calls("pipe-vlessons")[1].prompt;
  assert.match(thirdLessons, /- Name the fault in writing/);
  assert.match(thirdLessons, /- Ask one question before you give advice/);
});

// ---------------------------------------------------------------- cli

test("cli: book prints the exemplar, each chapter and the duplicate-name report; pack renders chosen chapters into one page", async () => {
  const h = harness({ concurrency: 1 });
  const io = { out: "", err: "" };
  const sink = { out: (s: string) => void (io.out += s), err: (s: string) => void (io.err += s) };
  assert.equal(await main(["book", "--book", h.configPath, "--chapters", "2"], sink), 0, io.err);
  assert.match(io.out, /exemplar: ch01 \(summary A, examples A, quiz E, cards E, practice B\); 3 names off limits/);
  assert.match(io.out, /ch02  clean, spend \$0\.90: Ask one question/);
  assert.match(io.out, /1 of 1 chapters clean/);

  const pk = { out: "", err: "" };
  const out = path.join(h.runDir, "reading", "pilot.html");
  assert.equal(await main(["pack", "--book", h.configPath, "--chapters", "1,2", "--out", out], { out: (s) => void (pk.out += s), err: (s) => void (pk.err += s) }), 0, pk.err);
  const html = fs.readFileSync(out, "utf8");
  assert.match(html, /id="v1"/);
  assert.match(html, /id="v2"/);
  assert.match(html, /A A title/);
  assert.match(html, /A B title/);

  const bad = { out: "", err: "" };
  const badSink = { out: (s: string) => void (bad.out += s), err: (s: string) => void (bad.err += s) };
  assert.equal(await main(["variants", "--book", h.configPath, "--exemplar", "1"], badSink), 1);
  assert.match(bad.err, /--exemplar only goes with the book command/);
  assert.equal(await main(["book", "--book", h.configPath, "--chapters", "3", "--exemplar", "x"], badSink), 1);
  assert.match(bad.err, /--exemplar must be a chapter number/);
});
