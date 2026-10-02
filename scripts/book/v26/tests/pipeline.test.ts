import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BookConfig } from "../src/config";
import { BudgetError, CallFailedError, UsageLimitError } from "../src/call";
import { readLedger } from "../src/ledger";
import {
  checkChapter,
  evalChapter,
  fixChapter,
  makeCtx,
  runBook,
  runChapter,
  statusRows,
  writeChapter,
  type PipelineCtx,
  type RoundResult,
} from "../src/pipeline";
import type { Chapter, Issue, LessonCard } from "../src/types";

// ---------------------------------------------------------------- fixtures

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));

const AUTHOR_TEXT =
  "I grew up in a house where every shilling had a job. My father used to say that a man who spends " +
  "before he counts will soon be counting nothing. I resolved early to keep a little book, and in it " +
  "I set down each fault of the day against the virtue I wanted. Order, I found, was the hardest of " +
  "them. Nothing was so hard as to keep my papers in their places. Yet the little book taught me that " +
  "a fault named is half mended. I was never perfect, but I was a better man for the trying, and happier.";

const KEY = "Name each fault in writing and you have already begun to mend it.";
const KEY2 = "Write each fault down plainly and you can begin to mend it.";

function lessonCard(lesson = KEY): LessonCard {
  return {
    lesson,
    wrongBelief: "You have to be perfect before you can improve.",
    keyPhrase: "a fault named is half mended",
    hookQuestion: "What did the trying look like each day?",
    storyNames: ["Benjamin", "Franklin"],
    evidence: ["I resolved early to keep a little book"],
  };
}

function chapter(key = KEY): Chapter {
  const q = (i: number, prompt: string, choices: string[], correctIndex: number, explanation: string) => ({
    questionId: `q${i}`,
    prompt,
    choices,
    correctIndex,
    explanation,
    bloomsLevel: "apply",
  });
  return {
    title: "The Little Book of Faults",
    hook: 'He wrote, "I was never perfect, but I was a better man for the trying." What did the trying look like each day?',
    counterintuition:
      "You might think a man fixes his faults by hating them. He did the opposite. He wrote each one down, calmly, like a shopkeeper counting coins.",
    keyTakeaway: key,
    tryThisNow: "Write down one small fault from today, and do not explain it or argue with it. Just name it in a single plain sentence.",
    breakdown: {
      fastRead:
        'As a young man he kept a little book, and each night he wrote down the faults he had fallen into that day, without scolding himself or making any promises about tomorrow. He found that "a fault named is half mended." Order was the hardest habit for him to keep, and he was never perfect, but he said that he became a better and happier man for the trying.',
      deepRead:
        "Benjamin kept a small book with a page for each virtue he wanted, and every night he looked back over the day to mark the faults he had slipped into. He did not ask himself to be perfect, because he only asked himself to notice what had happened. The act of writing was the whole method, and it took only a few minutes.\n\n" +
        'Order gave him the most trouble. Papers drifted out of place, and the hour he had planned for work slipped away before he could use it. Still, he kept the book, and he later said that "a fault named is half mended." He also said that the trying made him happier, because the habit was small and honest.',
      fullRead:
        "Benjamin grew up in a house where every shilling had a job, and his father taught him to count his money carefully before he spent a single coin of it. That early lesson shaped the way he looked at his own days, because a day, like a purse, could be counted.\n\n" +
        "So he made a little book, and in it he set a page for each virtue he wanted. Each night he marked the faults he had fallen into, but he did not scold himself or promise to be a new man by morning. He only wrote the fault down and looked at it.\n\n" +
        'Order was the hardest of the virtues for him, since he kept losing his papers and his hours. Yet the book showed him a pattern, and a pattern is easier to fix than a mood. He learned that "a fault named is half mended." He was never perfect, but he was a better man for the trying, and happier.',
    },
    examples: [
      {
        exampleId: "ex1",
        title: "The unread inbox",
        tags: ["work"],
        scenario:
          "Mia opens her email each morning and feels a knot in her stomach, so she never looks at the number of messages. She just closes the laptop and tells herself that she will deal with it later.",
        whatToDo: "Write one line that says you avoid your inbox, and then read it back once, because naming the habit is the first step toward changing it.",
        whyItMatters: "Once the habit has a name, Mia can see it clearly and choose a small fix that she can keep.",
      },
      {
        exampleId: "ex2",
        title: "The late runner",
        tags: ["health"],
        scenario: "Dev skips his morning run again and calls himself lazy, but the word lazy ends the thought, so nothing changes.",
        whatToDo: "Swap the word lazy for a plain note that says he skipped the run because he stayed up much too late the night before, which is a cause he can change.",
        whyItMatters: "A plain note points to a cause that he can actually fix, which a label never does.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        q(1, "Sam keeps missing deadlines and feels ashamed of it. What helps most as a first step?", ["Promise to try harder next week", "Note which deadlines slipped", "Stop thinking about it completely"], 1, "Writing the fault down is the first move."),
        q(2, "Rosa wants to stop snapping at her team during busy afternoons. What fits the idea best?", ["Note each time it happens", "Wait until she feels calm again", "Say sorry to everyone daily"], 0, "A noted fault can be seen and then mended."),
        q(3, "Lee thinks he must be perfect before he starts a plan. What is the better view?", ["Start by naming one fault", "Plan everything first", "Ask others to decide for him"], 0, "Naming a fault begins the mending without waiting for perfect."),
      ],
    },
    reviewCards: [
      { cardId: "rc1", front: "What did the little book record each night?", back: "The faults he had fallen into during the day.", difficulty: "easy" },
      { cardId: "rc2", front: "Why write a fault down instead of just thinking about it?", back: "Naming it plainly begins to mend it.", difficulty: "medium" },
      { cardId: "rc3", front: "What was hardest for him to keep in good order?", back: "Order in his papers and in his hours.", difficulty: "medium" },
    ],
    implementationPlan: {
      coreSkill: "Naming a fault plainly and in writing.",
      ifThenPlans: [
        { context: "When I feel ashamed of a slip", plan: "I write it down in one plain line." },
        { context: "When I want to scold myself", plan: "I name the fault and stop there." },
      ],
      twentyFourHourChallenge: "Write down three small faults tonight.",
      weeklyPractice: "Keep a nightly list and read it on Sunday.",
    },
    memorableLines: [{ text: "Write the fault down and half the work is done." }, { text: "a fault named is half mended" }],
  };
}

/** What the writer returns: the chapter plus its lesson card. */
const draft = (key = KEY): Record<string, unknown> => ({ ...chapter(key), _lesson: lessonCard(key) });

const KEYS = [1, 0, 0];
const FACT_OK = {
  sentencesChecked: 20,
  lesson: { rating: "SUPPORTED", reason: "the author says it", sourceText: "a fault named is half mended" },
  issues: [],
  quizIssues: [],
};
const factWith = (over: Record<string, unknown>) => ({ ...FACT_OK, ...over });
const keysolve = (choices = KEYS, extra: Record<number, Record<string, unknown>> = {}) => ({
  answers: choices.map((choice, i) => ({ questionId: `q${i + 1}`, choice, alsoDefensible: [], reason: "the lesson says so", ...extra[i] })),
});
/** Every answer wrong: the no-chapter solver learns nothing. */
const GUESS_WRONG = { answers: [{ questionId: "q1", choice: 0 }, { questionId: "q2", choice: 1 }, { questionId: "q3", choice: 1 }] };
const GUESS_RIGHT = { answers: [{ questionId: "q1", choice: 1 }, { questionId: "q2", choice: 0 }, { questionId: "q3", choice: 0 }] };
const COLD_OK = { lesson: "Write faults down.", unclear: [] };
const FIX_NONE = { edits: [], keyChanges: [], declined: [] };

const GOOD: Record<string, unknown[]> = {
  "pipe-write": [{ result: draft() }],
  "pipe-factcheck": [{ result: FACT_OK }],
  "pipe-keysolve": [{ result: keysolve() }],
  "pipe-coldreader": [{ result: COLD_OK }],
  "pipe-nochapter": [{ result: GUESS_WRONG }],
  "pipe-fix": [{ result: FIX_NONE }],
  "pipe-review": [{ result: { lesson: KEY, singleLesson: true, items: [] } }],
};

/** Tiny prompt templates: the first line picks the fake claude's scenario. */
const TEMPLATES: Record<string, string> = {
  write: "SCENARIO pipe-write\nBOOK:\n@@BOOK_SECTION@@\nHEADER:\n@@HEADER@@\nRERUN:\n@@RERUN_NOTE@@\nSOURCE:\n@@SOURCE@@\n",
  factcheck: "SCENARIO pipe-factcheck\nTRAPS:\n@@KNOWN_TRAPS@@\nLESSON:\n@@LESSON@@\nSOURCE:\n@@SOURCE@@\nCHAPTER:\n@@CHAPTER@@\n",
  keysolve: "SCENARIO pipe-keysolve\nP1 @@P1IDS@@\n@@NEWREADER@@\n@@P1QUESTIONS@@\nP2 @@P2IDS@@\n@@ALLTIERS@@\n@@P2QUESTIONS@@\n",
  coldreader: "SCENARIO pipe-coldreader\n@@SUMMARY@@\n",
  nochapter: "SCENARIO pipe-nochapter\n@@QUESTIONS@@\n",
  fix: "SCENARIO pipe-fix\nISSUES:\n@@ISSUES@@\nLESSON:\n@@LESSON@@\nCHAPTER:\n@@CHAPTER@@\nSOURCE:\n@@SOURCE@@\n",
  review: "SCENARIO pipe-review\n@@CHAPTER@@\n",
};

// ---------------------------------------------------------------- harness

const roots: string[] = [];
after(() => {
  delete process.env.V26_PROMPT_DIR;
  delete process.env.FAKE_PIPE_DIR;
  for (const d of roots) fs.rmSync(d, { recursive: true, force: true });
});

interface Call {
  scenario: string;
  index: number;
  effort: string;
  prompt: string;
}

interface Harness {
  ctx: PipelineCtx;
  cfg: BookConfig;
  dir: string;
  runDir: string;
  /** Replaces the scripted answers for the named scenarios. */
  script(over: Record<string, unknown[]>): void;
  calls(scenario?: string): Call[];
  file(n: number, name: string): string;
  json<T = any>(n: number, name: string): T;
  ledgerPath: string;
}

function harness(opts: { review?: boolean; budgetUsd?: number; concurrency?: number; realPrompts?: boolean; knownTraps?: boolean; note?: string } = {}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-pipeline-"));
  roots.push(dir);
  const pipeDir = path.join(dir, "pipe");
  const promptDir = path.join(dir, "prompts");
  fs.mkdirSync(pipeDir);
  fs.mkdirSync(promptDir);
  for (const [name, body] of Object.entries(TEMPLATES)) fs.writeFileSync(path.join(promptDir, `${name}.md`), body);
  if (opts.realPrompts) delete process.env.V26_PROMPT_DIR;
  else process.env.V26_PROMPT_DIR = promptDir;
  process.env.FAKE_PIPE_DIR = pipeDir;

  // Three chapters, all with the same author text, so one scripted draft passes the quote check in any of them.
  const parts = ["PREFACE", "ONE", "TWO", "THREE"];
  let text = "";
  const spans = [1, 2, 3].map((n) => {
    text += `${parts[n - 1]}\n\n`;
    const startOffset = text.length;
    text += AUTHOR_TEXT;
    if (n === 1 && opts.note) text += `\n\n${opts.note}`;
    const endOffset = text.length;
    text += "\n\n";
    return { chapterNumber: n, chapterTitle: `Chapter ${["One", "Two", "Three"][n - 1]}`, startOffset, endOffset };
  });
  fs.writeFileSync(path.join(dir, "source.txt"), text);
  fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify({ sourceTextSha256: createHash("sha256").update(text).digest("hex"), spans }));
  fs.writeFileSync(path.join(dir, "brief.md"), "BRIEF: teach one lesson.\n");
  let knownTrapsPath: string | undefined;
  if (opts.knownTraps) {
    knownTrapsPath = path.join(dir, "traps.json");
    fs.writeFileSync(
      knownTrapsPath,
      JSON.stringify({ entries: [{ assignedChapters: [1, 2], text: "FACT PIN: the shilling was copper" }, { assignedChapters: [3], text: "ch3 only trap" }] }),
    );
  }

  const role = (model: string, effort: BookConfig["writer"]["effort"]) => ({ bin: FAKE, model, effort });
  const runDir = path.join(dir, "run");
  const cfg: BookConfig = {
    bookId: "demo-book",
    title: "Demo Book",
    author: "Ada Example",
    bookType: "memoir",
    categories: ["self-development"],
    tags: ["habits", "memoir"],
    source: { textPath: path.join(dir, "source.txt"), chapterMapPath: path.join(dir, "map.json") },
    ...(knownTrapsPath ? { knownTrapsPath } : {}),
    briefPath: path.join(dir, "brief.md"),
    shape: {
      examples: 2,
      quizQuestions: 3,
      choices: 3,
      reviewCards: 3,
      memorableLines: 2,
      ifThenPlans: 2,
      fastRead: [40, 100],
      deepRead: [100, 170],
      fullRead: [150, 320],
    },
    writer: role("claude-opus-5-5", "high"),
    checker: role("claude-opus-5-5", "high"),
    solver: role("claude-sonnet-5", "medium"),
    concurrency: opts.concurrency ?? 1,
    budgetUsd: opts.budgetUsd ?? 100,
    runDir,
    ledgerPath: path.join(dir, "ledger.jsonl"),
  };

  const script = (over: Record<string, unknown[]> = {}): void => {
    fs.writeFileSync(path.join(pipeDir, "script.json"), JSON.stringify({ ...GOOD, ...over }));
  };
  script();
  const h: Harness = {
    ctx: makeCtx(cfg, { review: opts.review }),
    cfg,
    dir,
    runDir,
    ledgerPath: cfg.ledgerPath!,
    script,
    calls: (scenario) =>
      fs
        .readdirSync(pipeDir)
        .filter((f) => f.endsWith(".call.json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(pipeDir, f), "utf8")) as Call)
        .filter((c) => scenario === undefined || c.scenario === scenario)
        .sort((a, b) => (a.scenario === b.scenario ? a.index - b.index : a.scenario < b.scenario ? -1 : 1)),
    file: (n, name) => path.join(runDir, `ch${String(n).padStart(2, "0")}`, name),
    json: (n, name) => JSON.parse(fs.readFileSync(h.file(n, name), "utf8")),
  };
  return h;
}

const counts = (h: Harness): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const c of h.calls()) out[c.scenario.replace("pipe-", "")] = (out[c.scenario.replace("pipe-", "")] ?? 0) + 1;
  return out;
};

const FASTREAD_ORDER = "Order was the hardest habit for him to keep";
const factFlag = (over: Record<string, unknown> = {}) => ({
  kind: "WHY",
  field: "breakdown.fastRead",
  chapterText: FASTREAD_ORDER,
  verdict: "UNSUPPORTED",
  sourceText: "Order, I found, was the hardest of them.",
  fix: "say only what the author says",
  ...over,
});

/** Writes the draft and checks it, without the run loop. */
async function drafted(h: Harness, n = 1): Promise<RoundResult> {
  await writeChapter(h.ctx, n);
  return checkChapter(h.ctx, n, 0);
}

// ---------------------------------------------------------------- makeCtx

test("makeCtx: ledger and cwd defaults, brief text, source and known traps by chapter", () => {
  const h = harness({ knownTraps: true });
  const bare: BookConfig = { ...h.cfg };
  delete bare.ledgerPath;
  const ctx = makeCtx(bare);
  assert.equal(ctx.ledgerPath, path.join(h.runDir, "ledger.jsonl"));
  assert.equal(ctx.cwd, path.join(h.runDir, "cwd"));
  assert.equal(ctx.bookSection, "BRIEF: teach one lesson.\n");
  assert.equal(ctx.review, false);
  assert.equal(ctx.source.title(2), "Chapter Two");
  assert.deepEqual(ctx.knownTraps, { 1: ["FACT PIN: the shilling was copper"], 2: ["FACT PIN: the shilling was copper"], 3: ["ch3 only trap"] });
  assert.equal(makeCtx(h.cfg, { review: true }).review, true);
  assert.equal(h.ctx.ledgerPath, h.cfg.ledgerPath, "a configured ledger path wins");
});

test("makeCtx: a known-traps file without an entries array is refused", () => {
  const h = harness({ knownTraps: true });
  fs.writeFileSync(h.cfg.knownTrapsPath!, JSON.stringify({ items: [] }));
  assert.throws(() => makeCtx(h.cfg), /KNOWN_TRAPS_INVALID/);
});

// ---------------------------------------------------------------- writeChapter

test("writeChapter: saves the lesson card and the chapter without _lesson; the prompt carries brief, header and source", async () => {
  const h = harness();
  await writeChapter(h.ctx, 1);
  assert.deepEqual(h.json(1, "lesson.json"), lessonCard());
  const saved = h.json<Record<string, unknown>>(1, "r0.chapter.json");
  assert.equal("_lesson" in saved, false);
  assert.deepEqual(saved, chapter());
  const p = h.calls("pipe-write")[0]!;
  assert.equal(p.effort, "high");
  assert.match(p.prompt, /BRIEF: teach one lesson\./);
  assert.match(p.prompt, /CHAPTER 1 of 3: "Chapter One"\. This is the first chapter of the book\./);
  assert.match(p.prompt, /every shilling had a job/);
  assert.doesNotMatch(p.prompt, /Lessons already taught/);
  assert.doesNotMatch(p.prompt, /NOTE FROM THE CHECKER/);
});

test("writeChapter: earlier lessons that exist in the run dir go into the header, in chapter order", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY2) }, { result: draft(KEY) }] });
  await writeChapter(h.ctx, 1);
  await writeChapter(h.ctx, 2);
  await writeChapter(h.ctx, 3);
  assert.doesNotMatch(h.calls("pipe-write")[0]!.prompt, /Lessons already taught/);
  const third = h.calls("pipe-write")[2]!.prompt;
  assert.match(third, /Lessons already taught in earlier chapters \(teach none of these again\):\n- Name each fault in writing[^\n]*\n- Write each fault down plainly/);
  const second = h.calls("pipe-write")[1]!.prompt;
  assert.doesNotMatch(second, /Write each fault down plainly/, "chapter 2 only sees chapters before it");
});

test("writeChapter: a rerun note goes into the prompt, and the draft files of the old draft are cleared", async () => {
  const h = harness();
  await drafted(h);
  assert.ok(fs.existsSync(h.file(1, "r0.result.json")));
  await writeChapter(h.ctx, 1, { rerunNote: "the lesson was too wide" });
  assert.match(h.calls("pipe-write")[1]!.prompt, /NOTE FROM THE CHECKER ON YOUR LAST DRAFT: the lesson was too wide/);
  assert.equal(fs.existsSync(h.file(1, "r0.result.json")), false, "a new draft makes the old check stale");
  assert.ok(fs.existsSync(h.file(1, "r0.chapter.json")));
});

test("writeChapter: a missing _lesson, a bad card or non-JSON is WRITER_OUTPUT_INVALID and nothing is saved", async () => {
  const bad: unknown[] = [{ result: chapter() }, { result: { ...chapter(), _lesson: { lesson: "x" } } }, { result: "I could not write it, sorry." }];
  for (const entry of bad) {
    const h = harness();
    h.script({ "pipe-write": [entry] });
    await assert.rejects(writeChapter(h.ctx, 1), (e: Error) => e instanceof CallFailedError && /WRITER_OUTPUT_INVALID/.test(e.message));
    assert.equal(fs.existsSync(h.file(1, "r0.chapter.json")), false);
    assert.ok(fs.existsSync(h.file(1, "write.result.txt")), "the raw answer is kept");
  }
});

// ---------------------------------------------------------------- checkChapter

test("checkChapter: a good draft has nothing blocking or fixable; every step is called with its variables and saved", async () => {
  const h = harness({ knownTraps: true });
  const r = await drafted(h);
  assert.equal(r.round, 0);
  assert.equal(r.lessonRating, "SUPPORTED");
  assert.deepEqual(r.blocking, []);
  assert.deepEqual(r.fixable, []);
  assert.deepEqual(r.report.noChapterScores, [0, 0, 0]);
  assert.equal(r.report.noChapterMedian, 0);
  assert.equal(r.report.coldReaderLesson, "Write faults down.");
  assert.deepEqual(r.report.unverifiedFlags, []);
  assert.deepEqual(counts(h), { write: 1, factcheck: 1, keysolve: 1, coldreader: 1, nochapter: 3 });
  for (const f of ["checks", "factcheck", "keysolve", "coldreader", "nochapter-0", "nochapter-1", "nochapter-2", "result"]) {
    assert.ok(fs.existsSync(h.file(1, `r0.${f}.json`)), `r0.${f}.json`);
  }
  assert.deepEqual(h.json(1, "r0.result.json"), r);

  const fact = h.calls("pipe-factcheck")[0]!;
  assert.equal(fact.effort, "high");
  assert.match(fact.prompt, /TRAPS:\n[^\n]*FACTS THIS BOOK HAS BEEN WRONG ABOUT BEFORE[\s\S]*- FACT PIN: the shilling was copper/);
  assert.match(fact.prompt, /"keyPhrase": "a fault named is half mended"/);
  assert.match(fact.prompt, /SOURCE:\nI grew up in a house/);
  assert.match(fact.prompt, /\[keyTakeaway\] Name each fault/);
  assert.match(fact.prompt, /\[quiz\.q1\] Sam keeps missing deadlines[\s\S]*KEY: 1/);

  const ks = h.calls("pipe-keysolve")[0]!;
  assert.equal(ks.effort, "medium");
  assert.match(ks.prompt, /P1 q1, q2, q3\n/);
  assert.match(ks.prompt, /P2 \(none\)\n/);
  assert.match(ks.prompt, /Hook: He wrote/);
  assert.match(ks.prompt, /Middle-depth telling:/);
  assert.doesNotMatch(ks.prompt, /KEY:/, "the solver never sees the key");

  assert.equal(h.calls("pipe-coldreader")[0]!.effort, "low");
  assert.match(h.calls("pipe-coldreader")[0]!.prompt, /^SCENARIO pipe-coldreader\nSHORT VERSION:\nAs a young man he kept a little book/);
  assert.match(h.calls("pipe-coldreader")[0]!.prompt, /\n\nFULL VERSION:\n/, "the cold reader also reads the full telling, the tier new readers open on");
  assert.equal(h.calls("pipe-nochapter")[0]!.effort, "medium");
  assert.doesNotMatch(h.calls("pipe-nochapter")[0]!.prompt, /KEY:|Hook:/);
  assert.equal(h.calls("pipe-review").length, 0, "the editor review runs only with --review");
});

test("checkChapter: only the known traps of this chapter reach the fact check", async () => {
  const h = harness({ knownTraps: true });
  await drafted(h, 3);
  const prompt = h.calls("pipe-factcheck")[0]!.prompt;
  assert.match(prompt, /- ch3 only trap/);
  assert.doesNotMatch(prompt, /shilling was copper/);
  const h2 = harness({ knownTraps: true });
  h2.script({ "pipe-write": [{ result: draft() }] });
  await writeChapter(h2.ctx, 1);
  await checkChapter(h2.ctx, 1, 0);
  assert.doesNotMatch(h2.calls("pipe-factcheck")[0]!.prompt, /ch3 only trap/);
});

test("checkChapter: a failing code check is blocking and fixable, and a reported one is fixable only", async () => {
  const h = harness();
  const bad = chapter();
  bad.hook = "Studies show that 73% of people never name a fault. What do you do?";
  bad.quiz.questions[0]!.correctIndex = 7;
  h.script({ "pipe-write": [{ result: { ...bad, _lesson: lessonCard() } }] });
  const r = await drafted(h);
  const key = r.blocking.find((i) => i.field === "quiz.questions.0.correctIndex");
  assert.ok(key && key.source === "det" && key.blocking);
  assert.ok(r.fixable.includes(key) || r.fixable.some((i) => i.text === key.text), "a blocking code issue also goes to the fix call");
  const fact = r.fixable.filter((i) => i.field === "hook" && /outside fact/.test(i.text));
  assert.equal(fact.length, 2, "one issue per hit: 73% and Studies show");
  assert.ok(fact.every((i) => !i.blocking));
  assert.ok(r.blocking.every((i) => i.blocking));
  assert.ok(r.blocking.every((i) => !/outside fact/.test(i.text)));
});

test("checkChapter: a broken shape skips the model steps and is not rated", async () => {
  const h = harness();
  const broken = { ...chapter(), quiz: "none", _lesson: lessonCard() };
  h.script({ "pipe-write": [{ result: broken }] });
  const r = await drafted(h);
  assert.ok(r.blocking.some((i) => i.source === "det" && /shape/.test(i.text)));
  assert.equal(r.lessonRating, "UNKNOWN");
  assert.match(String(r.report.skipped), /shape is broken/);
  assert.deepEqual(counts(h), { write: 1 }, "no check call is paid for on an unreadable draft");
});

test("checkChapter: a draft with breakdown null skips every model step (nothing is paid for, nothing is left running)", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ result: { ...chapter(), breakdown: null, _lesson: lessonCard() } }] });
  const r = await drafted(h);
  assert.ok(r.blocking.some((i) => i.source === "det" && /shape: breakdown must be an object/.test(i.text)));
  assert.equal(r.lessonRating, "UNKNOWN");
  assert.match(String(r.report.skipped), /shape is broken/);
  await new Promise((resolve) => setTimeout(resolve, 400)); // a call started by mistake would have been recorded by now
  assert.deepEqual(counts(h), { write: 1 });
});

test("checkChapter: any shape problem skips the model steps, whichever field it is in", async () => {
  const broken: Array<(c: Record<string, any>) => void> = [
    (c) => { c.quiz.questions[1].choices = null; },
    (c) => { c.implementationPlan = null; },
    (c) => { c.memorableLines = [null, { text: "x" }]; },
    (c) => { delete c.examples[0].tags; },
  ];
  for (const [k, damage] of broken.entries()) {
    const h = harness();
    const c = chapter() as unknown as Record<string, any>;
    damage(c);
    h.script({ "pipe-write": [{ result: { ...c, _lesson: lessonCard() } }] });
    const r = await drafted(h);
    assert.ok(r.blocking.some((i) => /^shape:/.test(i.text)), `case ${k}`);
    assert.deepEqual(counts(h), { write: 1 }, `case ${k}`);
  }
});

test("runChapter: a draft with a broken shape is written again once, and the note names the shape problem", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ result: { ...chapter(), breakdown: null, _lesson: lessonCard() } }, { result: draft() }] });
  const st = await runChapter(h.ctx, 1);
  assert.deepEqual([st.stage, st.rerun, st.round], ["clean", true, 0]);
  assert.deepEqual(counts(h), { write: 2, factcheck: 1, keysolve: 1, coldreader: 1, nochapter: 3 }, "the models are paid for the new draft only");
  const note = h.calls("pipe-write")[1]!.prompt;
  assert.match(note, /NOTE FROM THE CHECKER ON YOUR LAST DRAFT: .*breakdown must be an object/);
  assert.doesNotMatch(note, /Pick a different lesson/, "a shape problem is not a lesson problem");
  assert.equal(h.json(1, "r0-pre-rerun.result.json").lessonRating, "UNKNOWN");
});

test("checkChapter: every prompt is built before the first call, so a bad template spends nothing", async () => {
  const h = harness();
  await writeChapter(h.ctx, 1);
  fs.writeFileSync(path.join(h.dir, "prompts", "nochapter.md"), "SCENARIO pipe-nochapter\n@@QUESTIONS@@ @@NOT_A_VARIABLE@@\n");
  await assert.rejects(checkChapter(h.ctx, 1, 0), /TEMPLATE_UNFILLED: NOT_A_VARIABLE/);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.deepEqual(counts(h), { write: 1 }, "no check call was started before the template failed");
});

test("checkChapter: a fact issue whose source passage is in the source is blocking and fixable", async () => {
  const h = harness();
  h.script({ "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }] });
  const r = await drafted(h);
  assert.equal(r.blocking.length, 1);
  const f = r.blocking[0]!;
  assert.deepEqual([f.source, f.blocking, f.field], ["fact", true, "breakdown.fastRead"]);
  assert.match(f.text, /WHY UNSUPPORTED: chapter says "Order was the hardest habit for him to keep"\. Source says: "Order, I found, was the hardest of them\."/);
  assert.match(f.text, /Suggested fix: say only what the author says/);
  assert.equal(r.fixable.filter((i) => i.source === "fact").length, 1);
  assert.deepEqual(r.report.unverifiedFlags, []);
});

test("checkChapter: a fact issue whose source passage is not in the source goes to the owner list, not to the fix", async () => {
  const h = harness();
  const invented = factFlag({ sourceText: "He crossed the Atlantic in a canoe." });
  h.script({ "pipe-factcheck": [{ result: factWith({ issues: [invented] }) }] });
  const r = await drafted(h);
  assert.deepEqual(r.blocking, []);
  assert.deepEqual(r.fixable, []);
  assert.deepEqual(r.report.unverifiedFlags, [invented]);
});

test("checkChapter: the editor's notes count as source when verifying a flag; 'none' stays a real flag", async () => {
  const note = "    [1] The dollar was a Dutch coin worth about a shilling.";
  const h = harness({ note });
  h.script({
    "pipe-factcheck": [
      { result: factWith({ issues: [factFlag({ sourceText: "The dollar was a Dutch coin worth about a shilling." }), factFlag({ field: "hook", sourceText: "none", chapterText: "x" })] }) },
    ],
  });
  const r = await drafted(h);
  assert.deepEqual(r.report.unverifiedFlags, [], "the editor's note passage verifies");
  assert.equal(r.blocking.length, 2);
  assert.match(r.blocking[1]!.text, /The source says nothing on this\./);
  assert.match(h.calls("pipe-factcheck")[0]!.prompt, /EDITOR'S NOTES/);
});

test("checkChapter: a quiz issue from the fact check is blocking, with the question as its field", async () => {
  const h = harness();
  h.script({ "pipe-factcheck": [{ result: factWith({ quizIssues: [{ questionId: "q2", keyedIndex: 0, supportedIndex: 2, problem: "the second choice is the sensible one" }] }) }] });
  const r = await drafted(h);
  assert.equal(r.blocking.length, 1);
  assert.deepEqual([r.blocking[0]!.source, r.blocking[0]!.field], ["quiz", "quiz.q2"]);
  assert.match(r.blocking[0]!.text, /the key is choice 0 but the lesson supports choice 2: the second choice/);
});

test("checkChapter: a lesson that is not SUPPORTED is blocking (source lesson) but is not sent to the fix", async () => {
  for (const rating of ["STRETCHED", "UNSUPPORTED", "MAYBE", undefined]) {
    const h = harness();
    h.script({ "pipe-factcheck": [{ result: factWith({ lesson: { rating, reason: "it claims too much", sourceText: "none" } }) }] });
    const r = await drafted(h);
    assert.equal(r.lessonRating, rating === "STRETCHED" || rating === "UNSUPPORTED" ? rating : "UNKNOWN");
    assert.equal(r.lessonReason, "it claims too much");
    assert.equal(r.blocking.length, 1);
    assert.deepEqual([r.blocking[0]!.source, r.blocking[0]!.blocking, r.blocking[0]!.field], ["lesson", true, "keyTakeaway"]);
    assert.deepEqual(r.fixable, []);
  }
});

test("checkChapter: the fact check not returning JSON fails the check", async () => {
  const h = harness();
  h.script({ "pipe-factcheck": [{ result: "I think it is fine." }] });
  await writeChapter(h.ctx, 1);
  await assert.rejects(checkChapter(h.ctx, 1, 0), (e: Error) => e instanceof CallFailedError && /factcheck of chapter 1/.test(e.message));
  assert.equal(h.calls("pipe-factcheck").length, 2, "asked once more before giving up");
});

test("checkChapter: a wrong pick, a second defensible choice and NOT IN TEXT are blocking for q1-q3", async () => {
  const h = harness();
  h.script({
    "pipe-keysolve": [
      {
        result: keysolve([2, 0, 0], {
          1: { alsoDefensible: [1] },
          2: { reason: "NOT IN TEXT: nothing about this" },
        }),
      },
    ],
  });
  const r = await drafted(h);
  const ks = r.blocking.filter((i) => i.source === "keysolve");
  assert.deepEqual(ks.map((i) => i.field), ["quiz.q1", "quiz.q2", "quiz.q3"]);
  assert.match(ks[0]!.text, /picked choice 2 but the key is 1/);
  assert.match(ks[1]!.text, /choice 1 is also defensible/);
  assert.match(ks[2]!.text, /does not settle the question/);
  assert.equal(r.fixable.filter((i) => i.source === "keysolve").length, 3);
});

test("checkChapter: a correct pick with no doubt raises nothing", async () => {
  const h = harness();
  const r = await drafted(h);
  assert.deepEqual(r.blocking, []);
  assert.equal("keysolveUnanswered" in r.report, false);
});

test("checkChapter: a q1-q5 question the solver gave no answer to is blocking, not a pass", async () => {
  const h = harness();
  h.script({ "pipe-keysolve": [{ result: { answers: keysolve().answers.slice(0, 2) } }] });
  const r = await drafted(h);
  const ks = r.blocking.filter((i) => i.source === "keysolve");
  assert.deepEqual(ks.map((i) => [i.field, i.blocking]), [["quiz.q3", true]]);
  assert.match(ks[0]!.text, /the solver gave no answer for q3/);
  assert.ok(r.fixable.some((i) => i.source === "keysolve" && i.field === "quiz.q3"), "it goes to the fix call, and the next round asks the solver again");
  assert.deepEqual(r.report.keysolveUnanswered, ["q3"]);
});

test("checkChapter: JSON from the solver with no answers blocks every q1-q5 question", async () => {
  const h = harness();
  h.script({ "pipe-keysolve": [{ result: { answers: [] } }] });
  const r = await drafted(h);
  assert.deepEqual(r.blocking.filter((i) => i.source === "keysolve").map((i) => i.field), ["quiz.q1", "quiz.q2", "quiz.q3"]);
});

test("checkChapter: a solver that does not return JSON fails the check, as the fact check does; the chapter is never stamped clean", async () => {
  const h = harness();
  h.script({ "pipe-keysolve": [{ result: "I cannot answer." }] });
  await assert.rejects(runChapter(h.ctx, 1), (e: Error) => e instanceof CallFailedError && /keysolve of chapter 1/.test(e.message));
  assert.equal(h.calls("pipe-keysolve").length, 2, "asked once more before giving up");
  assert.equal(fs.existsSync(h.file(1, "status.json")), false);
});

test("checkChapter: a q6+ question the solver gave no answer to is only reported", async () => {
  const h = harness();
  const long = chapter();
  const q3 = long.quiz.questions[2]!;
  for (const i of [4, 5, 6]) long.quiz.questions.push({ ...q3, questionId: `q${i}`, prompt: `${q3.prompt} (${i})` });
  h.script({
    "pipe-write": [{ result: { ...long, _lesson: lessonCard() } }],
    "pipe-keysolve": [{ result: keysolve([1, 0, 0, 0, 0]) }],
  });
  const r = await drafted(h);
  assert.deepEqual(r.blocking, []);
  assert.deepEqual(r.report.keysolveUnanswered, ["q6"]);
});

test("checkChapter: q6 and later are split into part 2 and a wrong answer there is fixable but not blocking", async () => {
  const h = harness();
  const long = chapter();
  const q3 = long.quiz.questions[2]!;
  for (const i of [4, 5, 6]) long.quiz.questions.push({ ...q3, questionId: `q${i}`, prompt: `${q3.prompt} (${i})` });
  h.script({
    "pipe-write": [{ result: { ...long, _lesson: lessonCard() } }],
    "pipe-keysolve": [{ result: keysolve([1, 0, 0, 0, 0, 2]) }],
  });
  const r = await drafted(h);
  assert.deepEqual(r.blocking, []);
  const ks = r.fixable.filter((i) => i.source === "keysolve");
  assert.deepEqual(ks.map((i) => [i.field, i.blocking]), [["quiz.q6", false]]);
  const p = h.calls("pipe-keysolve")[0]!.prompt;
  assert.match(p, /P1 q1, q2, q3, q4, q5\n/);
  assert.match(p, /P2 q6\n/);
  const nc = h.calls("pipe-nochapter")[0]!.prompt;
  assert.match(nc, /\[q5\]/);
  assert.doesNotMatch(nc, /\[q6\]/, "the no-chapter solver sees q1-q5 only");
});

test("checkChapter: the cold reader's unclear items are fixable summary issues", async () => {
  const h = harness();
  h.script({ "pipe-coldreader": [{ result: { lesson: "Naming faults helps.", unclear: [{ text: "every shilling", why: "an old coin" }, { text: "virtue", why: "abstract, in the full version" }] } }] });
  const r = await drafted(h);
  assert.deepEqual(r.blocking, []);
  const cold = r.fixable.filter((i) => i.source === "coldreader");
  assert.equal(cold.length, 2);
  assert.deepEqual([cold[0]!.field, cold[0]!.blocking], ["breakdown.fastRead", false]);
  assert.match(cold[0]!.text, /"every shilling": an old coin/);
  assert.equal(cold[1]!.field, "breakdown.fullRead", "an item the reader found in the full version points the fix at fullRead");
  assert.equal(r.report.coldReaderLesson, "Naming faults helps.");
});

test("checkChapter: a question the no-chapter solver gets right in 2 of 3 runs is guessable; scores and median are reported", async () => {
  const h = harness();
  h.script({ "pipe-nochapter": [{ result: GUESS_RIGHT }, { result: GUESS_RIGHT }, { result: GUESS_WRONG }] });
  const r = await drafted(h);
  const guess = r.fixable.filter((i) => i.source === "nochapter");
  assert.deepEqual(guess.map((i) => i.field), ["quiz.q1", "quiz.q2", "quiz.q3"]);
  assert.equal(guess[0]!.text, "guessable without the chapter: make the wrong belief a more tempting choice");
  assert.ok(guess.every((i) => !i.blocking));
  assert.deepEqual([...(r.report.noChapterScores as number[])].sort(), [0, 3, 3]);
  assert.equal(r.report.noChapterMedian, 3);
  assert.deepEqual(r.blocking, []);
});

test("checkChapter: right in only 1 of 3 runs is not guessable", async () => {
  const h = harness();
  h.script({ "pipe-nochapter": [{ result: GUESS_RIGHT }, { result: GUESS_WRONG }, { result: GUESS_WRONG }] });
  const r = await drafted(h);
  assert.deepEqual(r.fixable, []);
  assert.equal(r.report.noChapterMedian, 0);
});

test("checkChapter: with review on, failed review items become fixable review issues pointing at their field", async () => {
  const h = harness({ review: true });
  h.script({
    "pipe-review": [
      {
        result: {
          lesson: "Name faults.",
          singleLesson: true,
          items: [
            { id: "OPENER-hook", pass: false, evidence: "plain fact" },
            { id: "OPENER-fullRead", pass: false, evidence: "slow start" },
            { id: "QUIZ-q2", pass: false, evidence: "story recall" },
            { id: "EXFIT-ex1", pass: false, evidence: "general" },
            { id: "SPINE", pass: false, evidence: "drifts" },
            { id: "COUNTER", pass: true, evidence: "ok" },
          ],
        },
      },
    ],
  });
  const r = await drafted(h);
  const rv = r.fixable.filter((i) => i.source === "review");
  assert.deepEqual(rv.map((i) => i.field), ["hook", "breakdown.fullRead", "quiz.q2", "examples.ex1", undefined]);
  assert.ok(rv.every((i) => !i.blocking));
  assert.match(rv[0]!.text, /OPENER-hook failed: plain fact/);
  assert.deepEqual(r.blocking, []);
  assert.equal(r.report.reviewLesson, "Name faults.");
  assert.equal(h.calls("pipe-review").length, 1);
  assert.match(h.calls("pipe-review")[0]!.prompt, /\[hook\] He wrote/);
});

test("checkChapter: with no draft file it says so", async () => {
  const h = harness();
  await assert.rejects(checkChapter(h.ctx, 1, 0), /NO_DRAFT/);
});

test("checkChapter: a DUPLICATE_LESSON from an earlier chapter is fixable, not blocking", async () => {
  const h = harness();
  await drafted(h, 1);
  const r = await drafted(h, 2);
  const dup = r.fixable.find((i) => i.text.startsWith("DUPLICATE_LESSON"));
  assert.ok(dup && dup.source === "lesson" && !dup.blocking);
  assert.deepEqual(r.blocking, []);
});

// ---------------------------------------------------------------- fixChapter

const detIssue = (field: string, blocking = false): Issue => ({ source: "det", blocking, field, text: "fix this" });

async function readyToFix(h: Harness): Promise<void> {
  await writeChapter(h.ctx, 1);
}

test("fixChapter: applies edits and key changes to a new round file and numbers the issues in the prompt", async () => {
  const h = harness();
  await readyToFix(h);
  h.script({
    "pipe-fix": [
      {
        result: {
          edits: [{ field: "breakdown.fastRead", find: FASTREAD_ORDER, replace: "Order was the hardest of the habits he named" }],
          keyChanges: [{ questionId: "q1", newIndex: 0, keyedChoiceText: "Promise to try harder next week" }],
          declined: [{ issue: 2, reason: "the source supports it" }],
        },
      },
    ],
  });
  const issues: Issue[] = [detIssue("breakdown.fastRead", true), { source: "keysolve", blocking: false, field: "quiz.q1", text: "key disputed" }];
  await fixChapter(h.ctx, 1, 0, issues);
  const next = h.json<Chapter>(1, "r1.chapter.json");
  assert.match(next.breakdown.fastRead, /Order was the hardest of the habits he named/);
  assert.equal(next.quiz.questions[0]!.correctIndex, 0);
  assert.equal(h.json<Chapter>(1, "r0.chapter.json").quiz.questions[0]!.correctIndex, 1, "round 0 is left as it was");
  const applied = h.json(1, "r1.fix-applied.json");
  assert.equal(applied.applied, 2);
  assert.deepEqual(applied.errors, []);
  assert.deepEqual(applied.dropped, []);
  assert.deepEqual(applied.declined, [{ issue: 2, reason: "the source supports it" }]);
  const call = h.calls("pipe-fix")[0]!;
  assert.match(call.prompt, /1\. \[DET BLOCKING\] breakdown\.fastRead: fix this\n2\. \[KEYSOLVE REPORTED\] quiz\.q1: key disputed/);
  assert.match(call.prompt, /\[keyTakeaway\] Name each fault[\s\S]*\[chapter JSON\]\n\{/);
  assert.match(call.prompt, /"wrongBelief"/);
  assert.match(call.prompt, /SOURCE:\nI grew up in a house/);
  assert.equal(call.effort, "high");
  assert.ok(fs.existsSync(h.file(1, "r1.fix.json")));
});

test("fixChapter: edits to keyTakeaway and memorableLines.0 are dropped unless an issue allows them", async () => {
  const h = harness();
  await readyToFix(h);
  const edits = [
    { field: "keyTakeaway", find: "Name each fault", replace: "Say each fault" },
    { field: "memorableLines.0", find: "half the work is done", replace: "the job is half done" },
    { field: "memorableLines.0.text", find: "Write the fault", replace: "Put the fault" },
    { field: "hook", find: "He wrote", replace: "She wrote" },
  ];
  h.script({ "pipe-fix": [{ result: { edits } }] });
  await fixChapter(h.ctx, 1, 0, [detIssue("hook")]);
  const next = h.json<Chapter>(1, "r1.chapter.json");
  assert.equal(next.keyTakeaway, KEY);
  assert.equal(next.memorableLines[0]!.text, chapter().memorableLines[0]!.text);
  assert.match(next.hook, /^She wrote/);
  const applied = h.json(1, "r1.fix-applied.json");
  assert.equal(applied.applied, 1);
  assert.deepEqual(applied.dropped.map((e: { field: string }) => e.field), ["keyTakeaway", "memorableLines.0", "memorableLines.0.text"]);
});

test("fixChapter: a fact or lesson issue on keyTakeaway lets an edit change it; a det issue does not", async () => {
  const edit = { field: "keyTakeaway", find: "Name each fault", replace: "Say each fault" };
  for (const [source, allowed] of [["fact", true], ["lesson", true], ["det", false], ["review", false]] as const) {
    const h = harness();
    await readyToFix(h);
    h.script({ "pipe-fix": [{ result: { edits: [edit] } }] });
    await fixChapter(h.ctx, 1, 0, [{ source, blocking: true, field: "keyTakeaway", text: "x" }]);
    assert.equal(h.json<Chapter>(1, "r1.chapter.json").keyTakeaway.startsWith("Say each"), allowed, source);
  }
});

test("fixChapter: an issue naming memorableLines.0 lets an edit change it", async () => {
  const h = harness();
  await readyToFix(h);
  h.script({ "pipe-fix": [{ result: { edits: [{ field: "memorableLines.0", find: "half the work is done", replace: "the job is half done" }] } }] });
  await fixChapter(h.ctx, 1, 0, [detIssue("memorableLines.0")]);
  assert.equal(h.json<Chapter>(1, "r1.chapter.json").memorableLines[0]!.text, "Write the fault down and the job is half done.");
  assert.equal(h.json(1, "r1.fix-applied.json").dropped.length, 0);
});

test("fixChapter: protection follows what an edit changes, not the field it names (parent and sub-field paths)", async () => {
  const h = harness();
  await readyToFix(h);
  const edits = [
    { field: "memorableLines", find: "half the work is done", replace: "and PWNED" },
    { field: "keyTakeaway.text", find: "Name each fault", replace: "Ignore each fault" },
    { field: "memorableLines", find: "half mended", replace: "half done" },
    { field: "hook", find: "He wrote", replace: "She wrote" },
  ];
  h.script({ "pipe-fix": [{ result: { edits } }] });
  await fixChapter(h.ctx, 1, 0, [detIssue("hook")]);
  const next = h.json<Chapter>(1, "r1.chapter.json");
  assert.equal(next.keyTakeaway, KEY);
  assert.equal(next.memorableLines[0]!.text, chapter().memorableLines[0]!.text, "line 0 is as the writer left it");
  assert.equal(next.memorableLines[1]!.text, "a fault named is half done", "a parent-path edit that lands on another line is fine");
  assert.match(next.hook, /^She wrote/);
  const applied = h.json(1, "r1.fix-applied.json");
  assert.equal(applied.applied, 2);
  assert.deepEqual(applied.errors, []);
  assert.deepEqual(applied.dropped.map((e: { field: string }) => e.field), ["memorableLines", "keyTakeaway.text"]);
});

test("fixChapter: a permitted change still goes through when the edit names the parent path", async () => {
  const h = harness();
  await readyToFix(h);
  h.script({
    "pipe-fix": [
      {
        result: {
          edits: [
            { field: "memorableLines", find: "half the work is done", replace: "the job is half done" },
            { field: "keyTakeaway.text", find: "Name each fault", replace: "Say each fault" },
          ],
        },
      },
    ],
  });
  await fixChapter(h.ctx, 1, 0, [detIssue("memorableLines.0"), { source: "fact", blocking: true, field: "keyTakeaway", text: "x" }]);
  const next = h.json<Chapter>(1, "r1.chapter.json");
  assert.equal(next.memorableLines[0]!.text, "Write the fault down and the job is half done.");
  assert.match(next.keyTakeaway, /^Say each fault/);
  assert.equal(h.json(1, "r1.fix-applied.json").dropped.length, 0);
});

test("fixChapter: a protected edit that finds nothing is an ordinary error, and one dropped edit does not stop the others", async () => {
  const h = harness();
  await readyToFix(h);
  h.script({
    "pipe-fix": [
      { result: { edits: [{ field: "keyTakeaway", find: "Name each fault", replace: "Say it" }, { field: "tryThisNow", find: "Write down one", replace: "Jot down one" }] } },
    ],
  });
  await fixChapter(h.ctx, 1, 0, [detIssue("tryThisNow")]);
  const next = h.json<Chapter>(1, "r1.chapter.json");
  assert.equal(next.keyTakeaway, KEY);
  assert.match(next.tryThisNow, /^Jot down one/);
  assert.equal(h.json(1, "r1.fix-applied.json").dropped.length, 1);
  assert.equal(h.calls("pipe-fix").length, 1, "a dropped edit is not an error, so there is no retry call");
});

test("fixChapter: edits that cannot be applied are sent back once with the errors, and the corrections are applied", async () => {
  const h = harness();
  await readyToFix(h);
  h.script({
    "pipe-fix": [
      { result: { edits: [{ field: "hook", find: "NOT IN THE HOOK", replace: "x" }, { field: "tryThisNow", find: "Write down one", replace: "Jot down one" }] } },
      { result: { edits: [{ field: "hook", find: "He wrote", replace: "She wrote" }] } },
    ],
  });
  await fixChapter(h.ctx, 1, 0, [detIssue("hook"), detIssue("tryThisNow")]);
  assert.equal(h.calls("pipe-fix").length, 2);
  const retry = h.calls("pipe-fix")[1]!.prompt;
  assert.match(retry, /These edits could not be applied: \[\{"field":"hook","find":"NOT IN THE HOOK","error":"find text not present in that field"\}\]/);
  assert.match(retry, /Return corrected edits for them only\./);
  const next = h.json<Chapter>(1, "r1.chapter.json");
  assert.match(next.hook, /^She wrote/);
  assert.match(next.tryThisNow, /^Jot down one/);
  const applied = h.json(1, "r1.fix-applied.json");
  assert.equal(applied.applied, 2);
  assert.equal(applied.firstErrors.length, 1);
  assert.deepEqual(applied.errors, []);
});

test("fixChapter: a correction that still cannot be applied is recorded, with no third call", async () => {
  const h = harness();
  await readyToFix(h);
  h.script({ "pipe-fix": [{ result: { edits: [{ field: "hook", find: "ZZZ", replace: "x" }] } }, { result: { edits: [{ field: "hook", find: "YYY", replace: "x" }] } }] });
  await fixChapter(h.ctx, 1, 0, [detIssue("hook")]);
  assert.equal(h.calls("pipe-fix").length, 2);
  assert.equal(h.json(1, "r1.fix-applied.json").errors.length, 1);
  assert.deepEqual(h.json(1, "r1.chapter.json"), chapter());
});

test("fixChapter: output that is not JSON fails", async () => {
  const h = harness();
  await readyToFix(h);
  h.script({ "pipe-fix": [{ result: "sorry" }] });
  await assert.rejects(fixChapter(h.ctx, 1, 0, [detIssue("hook")]), (e: Error) => e instanceof CallFailedError && /fix of chapter 1/.test(e.message));
});

// ---------------------------------------------------------------- runChapter

test("runChapter: a clean first draft ends clean in round 0 with every file in place", async () => {
  const h = harness();
  const st = await runChapter(h.ctx, 1);
  assert.deepEqual(
    { stage: st.stage, round: st.round, rerun: st.rerun, lessonRating: st.lessonRating, open: st.open, lesson: st.lesson, chapter: st.chapter },
    { stage: "clean", round: 0, rerun: false, lessonRating: "SUPPORTED", open: [], lesson: KEY, chapter: 1 },
  );
  assert.deepEqual(counts(h), { write: 1, factcheck: 1, keysolve: 1, coldreader: 1, nochapter: 3 });
  assert.deepEqual(h.json(1, "final.json"), chapter(), "final.json is the chapter without _lesson");
  assert.deepEqual(h.json(1, "status.json"), st);
  for (const f of ["lesson.json", "r0.chapter.json", "r0.checks.json", "r0.result.json"]) assert.ok(fs.existsSync(h.file(1, f)), f);
  assert.equal(st.spend, 1.75, "7 calls at $0.25");
  const rows = readLedger(h.ledgerPath);
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.chapter === "demo-book/ch01"));
  assert.deepEqual(new Set(rows.map((r) => r.step)), new Set(["write", "factcheck", "keysolve", "coldreader", "nochapter"]));
});

test("runChapter: a fact flag goes to one fix call and the chapter is clean in round 1", async () => {
  const h = harness();
  h.script({
    "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }, { result: FACT_OK }],
    "pipe-fix": [{ result: { edits: [{ field: "breakdown.fastRead", find: FASTREAD_ORDER, replace: "Order was the hardest of the habits he named" }] } }],
  });
  const st = await runChapter(h.ctx, 1);
  assert.deepEqual([st.stage, st.round, st.rerun, st.open], ["clean", 1, false, []]);
  assert.deepEqual(counts(h), { write: 1, factcheck: 2, keysolve: 2, coldreader: 2, nochapter: 6, fix: 1 });
  assert.match(h.json<Chapter>(1, "final.json").breakdown.fastRead, /the hardest of the habits he named/);
  assert.deepEqual(h.json<Chapter>(1, "final.json"), h.json<Chapter>(1, "r1.chapter.json"));
  assert.match(h.calls("pipe-fix")[0]!.prompt, /1\. \[FACT BLOCKING\] breakdown\.fastRead:/);
  assert.equal(h.json<RoundResult>(1, "r0.result.json").blocking.length, 1);
  assert.equal(h.json<RoundResult>(1, "r1.result.json").blocking.length, 0);
});

test("runChapter: fixes stop after 2 rounds and what is still wrong is open; stage is open-issues when it blocks", async () => {
  const h = harness();
  h.script({
    "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }],
    "pipe-fix": [{ result: FIX_NONE }],
  });
  const st = await runChapter(h.ctx, 1);
  assert.equal(st.stage, "open-issues");
  assert.equal(st.round, 2);
  assert.equal(h.calls("pipe-fix").length, 2);
  assert.equal(h.calls("pipe-factcheck").length, 3);
  assert.equal(st.open.length, 1);
  assert.equal(st.open[0]!.source, "fact");
  assert.ok(fs.existsSync(h.file(1, "final.json")), "the last round's chapter is still saved");
});

test("runChapter: non-blocking leftovers are listed as open (marked) but the chapter is clean", async () => {
  const h = harness();
  h.script({ "pipe-coldreader": [{ result: { lesson: "x", unclear: [{ text: "virtue", why: "abstract" }] } }], "pipe-fix": [{ result: FIX_NONE }] });
  const st = await runChapter(h.ctx, 1);
  assert.equal(st.stage, "clean");
  assert.equal(st.round, 2);
  assert.equal(st.open.length, 1);
  assert.deepEqual([st.open[0]!.source, st.open[0]!.blocking, st.open[0]!.leftover], ["coldreader", false, true]);
});

/** The numbered issue lines that reached a fix call (what sits between ISSUES: and LESSON: in the test template). */
const fixIssues = (h: Harness, index: number): string => /ISSUES:\n([\s\S]*?)\nLESSON:/.exec(h.calls("pipe-fix")[index]!.prompt)![1]!;

const UNCLEAR_A = "the ledger of small wins";
const UNCLEAR_B = "a daily friction budget";
const COLD_TWO = { lesson: "x", unclear: [{ text: UNCLEAR_A, why: "abstract" }, { text: UNCLEAR_B, why: "jargon" }] };

test("runChapter: the first fix round sends blocking and reported issues together", async () => {
  const h = harness();
  h.script({
    "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }],
    "pipe-coldreader": [{ result: COLD_TWO }],
    "pipe-fix": [{ result: FIX_NONE }],
  });
  await runChapter(h.ctx, 1);
  assert.equal(h.calls("pipe-fix").length, 2);
  const first = fixIssues(h, 0);
  assert.match(first, /1\. \[FACT BLOCKING\] breakdown\.fastRead:/);
  assert.ok(first.includes(UNCLEAR_A) && first.includes(UNCLEAR_B), "both reported issues go to the first fix");
  assert.equal(first.split("\n").length, 3, "one blocking and two reported lines");
});

test("runChapter: the last fix round sends only the blocking issues; reported ones stay open as leftovers", async () => {
  const h = harness();
  h.script({
    "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }],
    "pipe-coldreader": [{ result: COLD_TWO }],
    "pipe-fix": [{ result: FIX_NONE }],
  });
  const st = await runChapter(h.ctx, 1);
  assert.equal(h.calls("pipe-fix").length, 2);
  const last = fixIssues(h, 1);
  assert.match(last, /^1\. \[FACT BLOCKING\] breakdown\.fastRead:/);
  assert.equal(last.split("\n").length, 1, "only the blocking issue");
  assert.ok(!last.includes(UNCLEAR_A) && !last.includes(UNCLEAR_B), "no reported issue in the last fix");
  assert.doesNotMatch(last, /REPORTED/);
  // The reported issues were not sent, but status.json still lists them next to the blocking one.
  assert.equal(st.stage, "open-issues");
  assert.deepEqual(st.open.map((i) => [i.source, i.blocking, i.leftover ?? false]), [["fact", true, false], ["coldreader", false, true], ["coldreader", false, true]]);
  assert.ok(st.open[1]!.text.includes(UNCLEAR_A) && st.open[2]!.text.includes(UNCLEAR_B));
});

test("runChapter: the last fix round sends the reported issues when nothing blocking is left", async () => {
  const h = harness();
  h.script({
    "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }, { result: FACT_OK }],
    "pipe-coldreader": [{ result: COLD_TWO }],
    "pipe-fix": [{ result: FIX_NONE }],
  });
  const st = await runChapter(h.ctx, 1);
  assert.equal(h.calls("pipe-fix").length, 2);
  assert.match(fixIssues(h, 0), /\[FACT BLOCKING\]/);
  const last = fixIssues(h, 1);
  assert.doesNotMatch(last, /BLOCKING/);
  assert.ok(last.includes(UNCLEAR_A) && last.includes(UNCLEAR_B), "both reported issues go to the last fix");
  assert.equal(last.split("\n").length, 2);
  assert.equal(st.stage, "clean");
  assert.deepEqual(st.open.map((i) => i.leftover), [true, true]);
});

test("runChapter: a lesson issue never counts as the blocking issue that narrows the last fix round", async () => {
  const h = harness();
  h.script({
    "pipe-factcheck": [{ result: factWith({ lesson: { rating: "STRETCHED", reason: "not quite", sourceText: "none" } }) }],
    "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY2) }],
    "pipe-coldreader": [{ result: COLD_TWO }],
    "pipe-fix": [{ result: FIX_NONE }],
  });
  await runChapter(h.ctx, 1);
  assert.equal(h.calls("pipe-fix").length, 2);
  for (const i of [0, 1]) {
    const sent = fixIssues(h, i);
    assert.ok(sent.includes(UNCLEAR_A) && sent.includes(UNCLEAR_B), `fix ${i + 1} still gets the reported issues`);
    assert.doesNotMatch(sent, /LESSON/);
  }
});

test("runChapter: a STRETCHED lesson reruns the writer once with the reason, then continues", async () => {
  const h = harness();
  h.script({
    "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY2) }],
    "pipe-factcheck": [{ result: factWith({ lesson: { rating: "STRETCHED", reason: "the author never says it is half mended for everyone", sourceText: "none" } }) }, { result: FACT_OK }],
  });
  const st = await runChapter(h.ctx, 1);
  assert.deepEqual([st.stage, st.round, st.rerun, st.lessonRating, st.lesson], ["clean", 0, true, "SUPPORTED", KEY2]);
  assert.equal(h.calls("pipe-write").length, 2);
  const note = h.calls("pipe-write")[1]!.prompt;
  assert.match(note, /NOTE FROM THE CHECKER ON YOUR LAST DRAFT: Your last draft taught "Name each fault in writing/);
  assert.match(note, /rated STRETCHED\. the author never says it is half mended for everyone/);
  assert.doesNotMatch(h.calls("pipe-write")[0]!.prompt, /NOTE FROM THE CHECKER/);
  for (const f of ["chapter", "result", "lesson", "checks"]) assert.ok(fs.existsSync(h.file(1, `r0-pre-rerun.${f}.json`)), `r0-pre-rerun.${f}.json`);
  assert.equal(h.json(1, "r0-pre-rerun.lesson.json").lesson, KEY);
  assert.equal(h.json(1, "r0-pre-rerun.result.json").lessonRating, "STRETCHED");
  assert.equal(h.json(1, "lesson.json").lesson, KEY2);
  assert.equal(h.json<Chapter>(1, "final.json").keyTakeaway, KEY2);
  assert.equal(h.calls("pipe-factcheck").length, 2, "the new draft is checked once, no fix round needed");
});

test("runChapter: the rerun happens once; a lesson still not SUPPORTED leaves the chapter open", async () => {
  const h = harness();
  h.script({
    "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY2) }],
    "pipe-factcheck": [{ result: factWith({ lesson: { rating: "UNSUPPORTED", reason: "not in the source", sourceText: "none" } }) }],
  });
  const st = await runChapter(h.ctx, 1);
  assert.deepEqual([st.stage, st.rerun, st.lessonRating], ["open-issues", true, "UNSUPPORTED"]);
  assert.equal(h.calls("pipe-write").length, 2, "never a third draft");
  assert.equal(h.calls("pipe-fix").length, 0, "a lesson issue alone does not start a fix call");
  assert.equal(st.open.length, 1);
  assert.equal(st.open[0]!.source, "lesson");
});

test("runChapter: a lesson that repeats an earlier chapter's reruns the writer with the duplicate named", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY) }, { result: draft(KEY2) }] });
  const one = await runChapter(h.ctx, 1);
  assert.equal(one.rerun, false);
  const two = await runChapter(h.ctx, 2);
  assert.deepEqual([two.stage, two.rerun, two.lesson], ["clean", true, KEY2]);
  const note = h.calls("pipe-write")[2]!.prompt;
  assert.match(note, /NOTE FROM THE CHECKER/);
  assert.match(note, /DUPLICATE_LESSON/);
});

test("runChapter: a duplicate lesson that survives the rerun is left open without a fix call (a fix cannot change the lesson)", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ result: draft(KEY) }] });
  await runChapter(h.ctx, 1);
  const two = await runChapter(h.ctx, 2);
  assert.equal(two.rerun, true);
  assert.equal(h.calls("pipe-write").length, 3);
  assert.equal(h.calls("pipe-fix").length, 0);
  assert.equal(two.stage, "clean", "a duplicate is reported, not blocking");
  assert.equal(two.open.length, 1);
  assert.match(two.open[0]!.text, /^DUPLICATE_LESSON/);
  assert.equal(two.open[0]!.leftover, true);
});

test("runChapter: a finished chapter is skipped, a stopped one resumes from its files, and force starts over", async () => {
  const h = harness();
  const first = await runChapter(h.ctx, 1);
  const total = h.calls().length;
  assert.deepEqual(await runChapter(h.ctx, 1), first, "clean: skipped, no calls");
  assert.equal(h.calls().length, total);
  fs.writeFileSync(h.file(1, "status.json"), JSON.stringify({ ...first, lesson: "as stored" }));
  assert.equal((await runChapter(h.ctx, 1)).lesson, "as stored", "the stored status is returned as it is, not rebuilt");
  fs.writeFileSync(h.file(1, "status.json"), JSON.stringify(first));

  // Lose the end files: every step is already on disk, so nothing is called again.
  fs.rmSync(h.file(1, "status.json"));
  fs.rmSync(h.file(1, "final.json"));
  const again = await runChapter(h.ctx, 1);
  assert.equal(h.calls().length, total, "resumed from files, no calls");
  assert.deepEqual(again, first);
  assert.ok(fs.existsSync(h.file(1, "final.json")));

  // Lose the checks of round 0: only the checks are redone, not the draft.
  for (const f of fs.readdirSync(path.dirname(h.file(1, "x")))) if (/^r0\.(result|checks)/.test(f) || f === "status.json") fs.rmSync(h.file(1, f));
  await runChapter(h.ctx, 1);
  assert.equal(h.calls("pipe-write").length, 1);
  assert.equal(h.calls("pipe-factcheck").length, 2);

  // Force: the old run is kept aside and everything is done again.
  const forced = await runChapter(h.ctx, 1, { force: true });
  assert.equal(forced.stage, "clean");
  assert.equal(h.calls("pipe-write").length, 2);
  const kept = fs.readdirSync(h.runDir).filter((f) => f.startsWith("ch01.prev-"));
  assert.equal(kept.length, 1);
  assert.ok(fs.existsSync(path.join(h.runDir, kept[0]!, "final.json")));
});

test("runChapter: an open-issues chapter is also skipped unless forced", async () => {
  const h = harness();
  h.script({ "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }] });
  const st = await runChapter(h.ctx, 1);
  assert.equal(st.stage, "open-issues");
  const before = h.calls().length;
  assert.deepEqual(await runChapter(h.ctx, 1), st);
  assert.equal(h.calls().length, before);
});

test("runChapter: a fix interrupted after the fix call resumes without paying for it again", async () => {
  const h = harness();
  h.script({
    "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }, { result: FACT_OK }],
    "pipe-fix": [{ result: { edits: [{ field: "breakdown.fastRead", find: FASTREAD_ORDER, replace: "Order was the hardest of the habits he named" }] } }],
  });
  await runChapter(h.ctx, 1);
  for (const f of ["status.json", "final.json", "r1.result.json"]) fs.rmSync(h.file(1, f));
  const st = await runChapter(h.ctx, 1);
  assert.equal(st.stage, "clean");
  assert.equal(h.calls("pipe-fix").length, 1, "the fix is not redone");
  assert.equal(h.calls("pipe-factcheck").length, 3, "only the round 1 check is redone");
});

test("runChapter: a rerun cut off after the old draft was moved aside resumes the rerun with its note", async () => {
  const h = harness();
  h.script({
    "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY2) }],
    "pipe-factcheck": [{ result: factWith({ lesson: { rating: "STRETCHED", reason: "too wide", sourceText: "none" } }) }, { result: FACT_OK }],
  });
  await runChapter(h.ctx, 1);
  // Put the folder back to the moment after the old draft was moved aside and before the new one was saved.
  for (const f of ["r0.chapter.json", "r0.checks.json", "r0.result.json", "status.json", "final.json"]) fs.rmSync(h.file(1, f));
  const st = await runChapter(h.ctx, 1);
  assert.equal(st.stage, "clean");
  assert.equal(h.calls("pipe-write").length, 3);
  assert.match(h.calls("pipe-write")[2]!.prompt, /NOTE FROM THE CHECKER ON YOUR LAST DRAFT: Your last draft taught "Name each fault in writing[^"]*"\. The lesson was rated STRETCHED\. too wide/);
});

// ---------------------------------------------------------------- runBook

test("runBook: runs every chapter with the configured concurrency and returns statuses in the order asked", async () => {
  const h = harness({ concurrency: 2 });
  // Whichever chapter asks first gets the first draft; the two lessons differ, so neither repeats the other.
  h.script({ "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY2) }] });
  const out = await runBook(h.ctx, [2, 1]);
  assert.deepEqual(out.map((s) => [s.chapter, s.stage]), [[2, "clean"], [1, "clean"]]);
  assert.deepEqual(out.map((s) => s.spend), [1.75, 1.75], "each chapter counts only its own calls");
  assert.deepEqual(statusRows(h.ctx).map((r) => [r.chapter, r.stage]), [[1, "clean"], [2, "clean"], [3, "not-started"]]);
});

test("runBook: a usage limit stops the whole run and is rethrown; chapters not yet started are never started", async () => {
  const h = harness({ concurrency: 1 });
  h.script({ "pipe-write": [{ usage: true }] });
  await assert.rejects(runBook(h.ctx, [1, 2, 3]), UsageLimitError);
  assert.equal(h.calls("pipe-write").length, 1, "chapters 2 and 3 never started");
  assert.equal(fs.existsSync(h.file(2, "r0.chapter.json")), false);
});

test("runBook: with two chapters in flight a usage limit still rejects with UsageLimitError, and the next run can use the same ctx", async () => {
  const h = harness({ concurrency: 2 });
  h.script({ "pipe-write": [{ usage: true }] });
  await assert.rejects(runBook(h.ctx, [1, 2, 3]), UsageLimitError);
  h.script({ "pipe-write": [{ result: draft(KEY) }] });
  const out = await runBook(h.ctx, [1]);
  assert.equal(out[0]!.stage, "clean", "the stop flag does not outlive the run");
});

test("runBook: a usage limit in one chapter stops the other chapter at its next model call", async () => {
  const h = harness({ concurrency: 2 });
  // One chapter gets the usage limit at once; the other's draft arrives 400 ms later, after the stop.
  h.script({ "pipe-write": [{ usage: true }, { result: draft(), delay: 400 }] });
  await assert.rejects(runBook(h.ctx, [1, 2]), UsageLimitError);
  assert.equal(h.calls("pipe-write").length, 2);
  assert.deepEqual(counts(h), { write: 2 }, "no check call was made once the run had stopped");
});

test("runBook: a limit found inside a check round stops the other chapter before it starts any call, without waiting for the slow sibling calls", async () => {
  const h = harness({ concurrency: 2 });
  // One chapter's draft is at once; the other's arrives 1 s later. The first chapter's fact check hits the limit
  // while its key solver is still running (2 s), so the limit is known long before the second draft arrives.
  h.script({
    "pipe-write": [{ result: draft(KEY) }, { result: draft(KEY2), delay: 1000 }],
    "pipe-factcheck": [{ usage: true }],
    "pipe-keysolve": [{ result: keysolve(), delay: 2000 }],
  });
  await assert.rejects(runBook(h.ctx, [1, 2]), UsageLimitError);
  assert.deepEqual(counts(h), { write: 2, factcheck: 1, keysolve: 1, coldreader: 1, nochapter: 3 }, "only the six calls that were already running; nothing started after the limit");
});

test("runBook: a limit also stops a retry of a call that is already running", async () => {
  const h = harness({ concurrency: 1 });
  // The fact check's first answer is not JSON and arrives after the key solver has hit the limit: no second ask.
  h.script({
    "pipe-factcheck": [{ result: "not json yet", delay: 800 }, { result: FACT_OK }],
    "pipe-keysolve": [{ usage: true }],
  });
  await assert.rejects(runBook(h.ctx, [1]), UsageLimitError);
  assert.equal(h.calls("pipe-factcheck").length, 1, "the retry was never made");
});

test("a usage limit outside runBook does not leave the ctx stopped", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ usage: true }] });
  await assert.rejects(writeChapter(h.ctx, 1), UsageLimitError);
  h.script({ "pipe-write": [{ result: draft() }] });
  await writeChapter(h.ctx, 1);
  assert.ok(fs.existsSync(h.file(1, "r0.chapter.json")));
});

test("runBook: the budget stops the run with BudgetError before the next call is made", async () => {
  const h = harness({ budgetUsd: 3.5 });
  h.script({ "pipe-write": [{ result: draft(), cost: 3 }] });
  await assert.rejects(runBook(h.ctx, [1, 2]), BudgetError);
  assert.deepEqual(counts(h), { write: 1 }, "$3 spent + $1 reserve is over $3.50: no check call");
  assert.equal(readLedger(h.ledgerPath).length, 1);
  // The draft is on disk, so a later run with budget left continues from it.
  h.ctx.config.budgetUsd = 100;
  const out = await runBook(h.ctx, [1]);
  assert.equal(out[0]!.stage, "clean");
  assert.equal(h.calls("pipe-write").length, 1, "the saved draft is reused");
});

test("runBook: a chapter whose writer returns bad output is reported failed and the others still run", async () => {
  const h = harness({ concurrency: 1 });
  h.script({ "pipe-write": [{ result: "no json here" }, { result: draft() }] });
  const out = await runBook(h.ctx, [1, 2]);
  assert.equal(out[0]!.stage, "failed");
  assert.match(out[0]!.error!, /WRITER_OUTPUT_INVALID/);
  assert.equal(out[0]!.open[0]!.blocking, true);
  assert.equal(out[1]!.stage, "clean");
  assert.equal(fs.existsSync(h.file(1, "status.json")), false, "a failed chapter has no status file, so a rerun tries it again");
});

test("runBook: an empty chapter list is an empty result", async () => {
  const h = harness();
  assert.deepEqual(await runBook(h.ctx, []), []);
});

// ---------------------------------------------------------------- statusRows

test("statusRows: one row per chapter of the book, with stage, open count, spend and lesson", async () => {
  const h = harness();
  assert.deepEqual(statusRows(h.ctx), [1, 2, 3].map((chapter) => ({ chapter, stage: "not-started", open: 0, spend: 0, lesson: "" })));
  await writeChapter(h.ctx, 2);
  h.script({ "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }] });
  await runChapter(h.ctx, 1);
  const rows = statusRows(h.ctx);
  assert.deepEqual(rows[0], { chapter: 1, stage: "open-issues", open: 1, spend: 5.25, lesson: KEY });
  assert.deepEqual(rows[1], { chapter: 2, stage: "in-progress", open: 0, spend: 0.25, lesson: KEY });
  assert.deepEqual(rows[2], { chapter: 3, stage: "not-started", open: 0, spend: 0, lesson: "" });
});

// ---------------------------------------------------------------- evalChapter

function idsFor(c: Chapter): string[] {
  const ids = ["OPENER-hook", "PLAIN-summary", "PLAIN-rest", "COUNTER", "TRY", "LINES-1", "PRACTICE", "SPINE"];
  for (const t of ["fastRead", "deepRead", "fullRead"]) ids.push(`OPENER-${t}`, `ARC-${t}`, `END-${t}`);
  for (const e of c.examples) ids.push(`EX-${e.exampleId}`, `EXFIT-${e.exampleId}`);
  for (const q of c.quiz.questions) ids.push(`QUIZ-${q.questionId}`);
  for (const r of c.reviewCards) ids.push(`CARD-${r.cardId}`);
  return ids;
}
const judgeItems = (ids: string[], failing: string[]) => ids.map((id) => ({ id, pass: !failing.includes(id), evidence: `evidence for ${id}` }));

test("evalChapter: judge items, aggregates, no-chapter scores and code metrics; a judge answer with ids missing is retried once", async () => {
  const h = harness();
  const ids = idsFor(chapter());
  assert.equal(ids.length, 8 + 9 + 4 + 3 + 3);
  const chapterPath = path.join(h.dir, "chapter.json");
  fs.writeFileSync(chapterPath, JSON.stringify({ ...chapter(), _lesson: lessonCard() }));
  const out = path.join(h.dir, "evalout");
  h.script({
    "pipe-review": [
      { result: { lesson: "first", singleLesson: true, items: judgeItems(ids.slice(0, 10), []) } },
      { result: { lesson: "Name each fault in writing.", singleLesson: true, items: judgeItems(ids, ["QUIZ-q3", "EXFIT-ex2"]) } },
    ],
    "pipe-nochapter": [{ result: GUESS_RIGHT }, { result: GUESS_WRONG }, { result: GUESS_WRONG }],
  });
  const r = await evalChapter(h.ctx, chapterPath, 1, "T1", out);
  assert.equal(h.calls("pipe-review").length, 2);
  assert.equal(h.calls("pipe-review")[0]!.effort, "high");
  assert.doesNotMatch(h.calls("pipe-review")[0]!.prompt, /_lesson|wrongBelief/, "the judge never sees the lesson card");
  assert.equal(r.lesson, "Name each fault in writing.");
  assert.equal(r.singleLesson, true);
  assert.deepEqual(r.missingIds, []);
  assert.equal(r.total, ids.length);
  assert.equal(r.passCount, ids.length - 2);
  assert.deepEqual(r.aggregates, { "AGG-EX": true, "AGG-EXFIT": false, "AGG-QUIZ": false, "AGG-CARDS": true });
  assert.equal(r.fractions["AGG-QUIZ"], 2 / 3);
  assert.deepEqual([...r.noChapterScores].sort(), [0, 0, 3]);
  const det = r.det as Record<string, any>;
  assert.equal(det.tierWords.fastRead, chapter().breakdown.fastRead.split(" ").length);
  assert.equal(typeof det.fk.fastRead, "number");
  assert.equal(typeof det.fkRest, "number");
  assert.equal(det.keyTakeawayWords, 13);
  assert.deepEqual(det.exampleWords, chapter().examples.map((e) => e.scenario.split(/\s+/).length));
  assert.deepEqual(det.repeatFields, []);
  assert.ok(fs.existsSync(path.join(out, "T1.judge.json")));
  assert.ok(fs.existsSync(path.join(out, "T1.judge.incomplete.json")));
  assert.ok(fs.existsSync(path.join(out, "T1.nochapter-2.json")));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, "T1.eval.json"), "utf8")), r);
  const rows = readLedger(h.ledgerPath);
  assert.ok(rows.every((x) => x.chapter === "demo-book/ch01/eval:T1"), "eval spend is not counted in the chapter's own spend");
  assert.deepEqual(new Set(rows.map((x) => x.step)), new Set(["eval:judge", "eval:judge-retry", "nochapter"]));
});

test("evalChapter: ids still missing after the retry are reported", async () => {
  const h = harness();
  const ids = idsFor(chapter());
  const chapterPath = path.join(h.dir, "chapter.json");
  fs.writeFileSync(chapterPath, JSON.stringify(chapter()));
  h.script({ "pipe-review": [{ result: { lesson: "x", singleLesson: false, items: judgeItems(ids.slice(2), []) } }] });
  const r = await evalChapter(h.ctx, chapterPath, 1, "T2", path.join(h.dir, "o"));
  assert.equal(h.calls("pipe-review").length, 2, "retried exactly once");
  assert.deepEqual(r.missingIds, ids.slice(0, 2));
  assert.equal(r.singleLesson, false);
});

test("evalChapter: det metrics report keyTakeaway repeats", async () => {
  const h = harness();
  const c = chapter();
  c.hook = KEY;
  c.counterintuition = KEY;
  c.tryThisNow = KEY;
  const chapterPath = path.join(h.dir, "chapter.json");
  fs.writeFileSync(chapterPath, JSON.stringify(c));
  h.script({ "pipe-review": [{ result: { lesson: "x", singleLesson: true, items: judgeItems(idsFor(c), []) } }] });
  const r = await evalChapter(h.ctx, chapterPath, 1, "T3", path.join(h.dir, "o"));
  assert.deepEqual((r.det.repeatFields as Array<{ field: string }>).map((x) => x.field), ["hook", "counterintuition", "tryThisNow"]);
});

// ---------------------------------------------------------------- the real prompt templates

test("the real prompt templates in prompts/ take the variables the pipeline gives them (a full run, with a fix round)", { skip: !fs.existsSync(fileURLToPath(new URL("../prompts/write.md", import.meta.url))) }, async () => {
  const h = harness({ realPrompts: true, review: true, knownTraps: true });
  h.script({
    "pipe-factcheck": [{ result: factWith({ issues: [factFlag()] }) }, { result: FACT_OK }],
    "pipe-fix": [{ result: { edits: [{ field: "breakdown.fastRead", find: FASTREAD_ORDER, replace: "Order was the hardest of the habits he named" }] } }],
    "pipe-review": [{ result: { lesson: KEY, singleLesson: true, items: [] } }],
  });
  const st = await runChapter(h.ctx, 1);
  assert.equal(st.stage, "clean");
  assert.deepEqual(counts(h), { write: 1, factcheck: 2, keysolve: 2, coldreader: 2, nochapter: 6, fix: 1, review: 2 });
  assert.doesNotMatch(h.calls("pipe-write")[0]!.prompt, /@@[A-Z0-9_]+@@/);
  const evalPath = path.join(h.dir, "c.json");
  fs.writeFileSync(evalPath, JSON.stringify(chapter()));
  await evalChapter(h.ctx, evalPath, 1, "R", path.join(h.dir, "o"));
});
