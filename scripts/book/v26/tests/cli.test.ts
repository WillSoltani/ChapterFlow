import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isCanonicalCategory } from "../../../../lib/category-taxonomy";
import { main } from "../cli";
import { loadBookConfig } from "../src/config";
import { readLedger } from "../src/ledger";

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));
const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const BOOKS = fileURLToPath(new URL("../books/", import.meta.url));

// ---------------------------------------------------------------- fixtures

const KEY = "Name each fault in writing and you have already begun to mend it.";

/** A small chapter: enough for the eval's code metrics and the renderer. The checks are not run on it. */
const CH = {
  title: "The Little Book of Faults",
  hook: "What did the trying look like each day?",
  counterintuition: "You might think a man fixes his faults by hating them. He wrote them down, calmly.",
  keyTakeaway: KEY,
  tryThisNow: "Write down one small fault from today in a single plain sentence.",
  breakdown: {
    fastRead: "He kept a little book and wrote each fault down. He found that naming it began the mending.",
    deepRead: "He kept a small book with a page for each virtue.\n\nEach night he marked the faults he had fallen into.",
    fullRead: "He grew up in a house where every shilling had a job.\n\nSo he made a little book.\n\nHe was never perfect, but he was happier for the trying.",
  },
  examples: [
    { exampleId: "ex1", title: "The unread inbox", tags: ["work"], scenario: "Mia never looks at the number of messages.", whatToDo: "Write one line that says you avoid it.", whyItMatters: "A named habit can be seen." },
    { exampleId: "ex2", title: "The late runner", tags: ["health"], scenario: "Dev skips his run and calls himself lazy.", whatToDo: "Note that he stayed up too late.", whyItMatters: "A cause can be fixed." },
  ],
  quiz: {
    passingScorePercent: 70,
    questions: [
      { questionId: "q1", prompt: "Sam keeps missing deadlines. What helps first?", choices: ["Try harder", "Note which ones slipped", "Ignore it"], correctIndex: 1, explanation: "Naming comes first.", bloomsLevel: "apply" },
      { questionId: "q2", prompt: "Rosa snaps at her team. What fits?", choices: ["Note each time", "Wait", "Apologise daily"], correctIndex: 0, explanation: "A noted fault can be mended.", bloomsLevel: "apply" },
      { questionId: "q3", prompt: "Lee wants to be perfect first. What is better?", choices: ["Name one fault", "Plan everything", "Ask others"], correctIndex: 0, explanation: "Start without waiting.", bloomsLevel: "apply" },
    ],
  },
  reviewCards: [
    { cardId: "rc1", front: "What did the book record?", back: "The faults of the day.", difficulty: "easy" },
    { cardId: "rc2", front: "Why write a fault down?", back: "Naming it begins to mend it.", difficulty: "medium" },
  ],
  implementationPlan: {
    coreSkill: "Naming a fault plainly.",
    ifThenPlans: [{ context: "When I feel ashamed", plan: "I write one plain line." }],
    twentyFourHourChallenge: "Write three small faults tonight.",
    weeklyPractice: "Read the list on Sunday.",
  },
  memorableLines: [{ text: "Write the fault down and half the work is done." }],
};

/** Every id the eval judge has to answer for CH. */
const JUDGE_IDS = [
  "OPENER-hook", "PLAIN-summary", "PLAIN-rest", "COUNTER", "TRY", "LINES-1", "PRACTICE", "SPINE",
  ...["fastRead", "deepRead", "fullRead"].flatMap((t) => [`OPENER-${t}`, `ARC-${t}`, `END-${t}`]),
  "EX-ex1", "EX-ex2", "EXFIT-ex1", "EXFIT-ex2",
  "QUIZ-q1", "QUIZ-q2", "QUIZ-q3",
  "CARD-rc1", "CARD-rc2",
];
const judge = (failing: string[] = []) => ({
  lesson: KEY,
  singleLesson: true,
  items: JUDGE_IDS.map((id) => ({ id, pass: !failing.includes(id), evidence: "ok" })),
});
const GUESS_WRONG = { answers: [{ questionId: "q1", choice: 0 }, { questionId: "q2", choice: 1 }, { questionId: "q3", choice: 1 }] };

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

interface Harness {
  dir: string;
  runDir: string;
  configPath: string;
  ledgerPath: string;
  /** Runs the CLI in this process. */
  cli(...args: string[]): Promise<{ code: number; out: string; err: string }>;
  script(s: Record<string, unknown[]>): void;
  calls(scenario?: string): Array<{ scenario: string; effort: string; prompt: string }>;
  file(n: number, name: string): string;
  put(n: number, name: string, value: unknown): void;
}

function harness(opts: { budgetUsd?: number } = {}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-cli-"));
  roots.push(dir);
  const pipeDir = path.join(dir, "pipe");
  const promptDir = path.join(dir, "prompts");
  fs.mkdirSync(pipeDir);
  fs.mkdirSync(promptDir);
  for (const [name, body] of Object.entries(TEMPLATES)) fs.writeFileSync(path.join(promptDir, `${name}.md`), body);
  process.env.V26_PROMPT_DIR = promptDir;
  process.env.FAKE_PIPE_DIR = pipeDir;

  let text = "";
  const spans = [1, 2, 3].map((n) => {
    const startOffset = text.length;
    text += `Chapter ${n} says that every shilling had a job.`;
    const endOffset = text.length;
    text += "\n\n";
    return { chapterNumber: n, chapterTitle: `Title ${n}`, startOffset, endOffset };
  });
  fs.writeFileSync(path.join(dir, "source.txt"), text);
  fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify({ sourceTextSha256: createHash("sha256").update(text).digest("hex"), spans }));
  fs.writeFileSync(path.join(dir, "brief.md"), "BRIEF: teach one lesson.\n");

  const role = (model: string, effort: string) => ({ bin: FAKE, model, effort });
  const runDir = path.join(dir, "run");
  const ledgerPath = path.join(dir, "ledger.jsonl");
  const configPath = path.join(dir, "demo.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      bookId: "demo-book",
      title: "Demo Book",
      author: "Ada Example",
      bookType: "memoir",
      categories: ["Memoir"],
      tags: ["habits"],
      source: { textPath: "source.txt", chapterMapPath: "map.json" },
      briefPath: "brief.md",
      shape: { examples: 2, quizQuestions: 3, choices: 3, reviewCards: 2, memorableLines: 1, ifThenPlans: 1, fastRead: [10, 100], deepRead: [10, 170], fullRead: [10, 320] },
      writer: role("claude-opus-5-5", "high"),
      checker: role("claude-opus-5-5", "high"),
      solver: role("claude-sonnet-5", "medium"),
      concurrency: 1,
      budgetUsd: opts.budgetUsd ?? 100,
      runDir: "run",
      ledgerPath: "ledger.jsonl",
    }),
  );

  const h: Harness = {
    dir,
    runDir,
    configPath,
    ledgerPath,
    async cli(...args) {
      let out = "";
      let err = "";
      const code = await main(args, { out: (s) => (out += s), err: (s) => (err += s) });
      return { code, out, err };
    },
    script(s) {
      fs.writeFileSync(path.join(pipeDir, "script.json"), JSON.stringify(s));
    },
    calls: (scenario) =>
      fs
        .readdirSync(pipeDir)
        .filter((f) => f.endsWith(".call.json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(pipeDir, f), "utf8")) as { scenario: string; effort: string; prompt: string })
        .filter((c) => scenario === undefined || c.scenario === scenario),
    file: (n, name) => path.join(runDir, `ch${String(n).padStart(2, "0")}`, name),
    put(n, name, value) {
      const f = h.file(n, name);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, JSON.stringify(value, null, 2));
    },
  };
  h.script({});
  return h;
}

// ---------------------------------------------------------------- status

test("status: one row per chapter from the run dir, plus the ledger total", async () => {
  const h = harness();
  h.put(1, "status.json", { chapter: 1, stage: "clean", round: 1, rerun: false, lessonRating: "SUPPORTED", open: [], spend: 1.5, lesson: KEY });
  h.put(1, "lesson.json", { lesson: KEY });
  h.put(2, "r0.chapter.json", CH);
  fs.writeFileSync(
    h.ledgerPath,
    JSON.stringify({ ts: "t", chapter: "demo-book/ch01", step: "write", model: "m", effort: "high", cost: 1.5, outTokens: 1, stopReason: "end_turn", seconds: 1, isError: false }) + "\n",
  );

  const r = await h.cli("status", "--book", h.configPath);
  assert.equal(r.code, 0, r.err);
  const rows = r.out.split("\n");
  const row = (n: number) => rows.find((l) => new RegExp(`^\\s*${n}\\s`).test(l)) ?? "";
  assert.match(row(1), /clean/);
  assert.match(row(1), /\$1\.50/);
  assert.ok(row(1).includes("Name each fault"), "the lesson is shown");
  assert.match(row(2), /in-progress/);
  assert.match(row(3), /not-started/);
  assert.match(r.out, /ledger \$1\.50 of \$100\.00/);
  assert.equal(h.calls().length, 0, "status makes no model call");

  const one = await h.cli("status", "--book", h.configPath, "--chapters", "2");
  assert.equal(one.code, 0, one.err);
  assert.match(one.out, /in-progress/);
  assert.ok(!one.out.includes("not-started") && !one.out.includes("clean"), "only the chosen chapter is listed");
});

test("status runs as a script with the real entry point; no arguments is a usage error", () => {
  const h = harness();
  const base = { cwd: REPO, env: process.env, encoding: "utf8" as const };
  const ok = spawnSync(process.execPath, ["--import", "tsx", CLI, "status", "--book", h.configPath], base);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /demo-book/);
  assert.match(ok.stdout, /not-started/);

  const bad = spawnSync(process.execPath, ["--import", "tsx", CLI], base);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Usage:/);
});

// ---------------------------------------------------------------- usage errors

test("usage errors exit 1 with the usage text", async () => {
  const h = harness();
  for (const args of [
    [],
    ["frobnicate", "--book", h.configPath],
    ["status"],
    ["status", "--book", h.configPath, "--bogus"],
    ["status", "--book", h.configPath, "--chapters", "one"],
    ["status", "--book", h.configPath, "--chapters", "9"],
    ["eval", "--book", h.configPath],
    ["eval", "--book", h.configPath, "--chapters", "1,2"],
    ["status", "--book", path.join(h.dir, "missing.json")],
  ]) {
    const r = await h.cli(...args);
    assert.equal(r.code, 1, `args ${JSON.stringify(args)}`);
    assert.ok(r.err.length > 0, `args ${JSON.stringify(args)} explain themselves`);
  }
  assert.match((await h.cli()).err, /Usage:/);
  assert.match((await h.cli("status", "--book", h.configPath, "--chapters", "9")).err, /NO_SUCH_CHAPTER/);
  assert.equal(h.calls().length, 0);
});

// ---------------------------------------------------------------- eval

test("eval --file: judge and no-chapter calls, a summary, and <tag>.eval.json in --out", async () => {
  const h = harness();
  h.script({ "pipe-review": [{ result: judge() }], "pipe-nochapter": [{ result: GUESS_WRONG }] });
  const file = path.join(h.dir, "chapter.json");
  fs.writeFileSync(file, JSON.stringify({ ...CH, _lesson: { lesson: KEY } }));
  const out = path.join(h.dir, "evals");

  const r = await h.cli("eval", "--book", h.configPath, "--chapters", "1", "--file", file, "--tag", "T1", "--out", out);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, new RegExp(`${JUDGE_IDS.length}/${JUDGE_IDS.length} items pass`));
  assert.ok(r.out.includes(KEY), "the judge's restatement of the lesson is shown");
  assert.match(r.out, /no-chapter.*0, 0, 0/);

  assert.ok(r.out.includes(`file: ${file}`), "the chapter file that was judged is shown");

  const saved = JSON.parse(fs.readFileSync(path.join(out, "T1.eval.json"), "utf8"));
  assert.equal(saved.passCount, JUDGE_IDS.length);
  assert.deepEqual(saved.noChapterScores, [0, 0, 0]);
  assert.equal(saved.chapter, 1, "the saved eval says which chapter it judged");
  assert.equal(saved.file, file, "and which file");
  assert.equal(h.calls("pipe-review").length, 1);
  assert.equal(h.calls("pipe-review")[0]!.effort, "high");
  assert.equal(h.calls("pipe-nochapter").length, 3);
  assert.ok(readLedger(h.ledgerPath).every((row) => row.chapter === "demo-book/ch01/eval:T1"), "the eval's spend is labelled with its tag");
});

test("eval exits 1 when an aggregate is below its bar and says which one", async () => {
  const h = harness();
  h.script({ "pipe-review": [{ result: judge(["QUIZ-q1", "QUIZ-q2"]) }], "pipe-nochapter": [{ result: GUESS_WRONG }] });
  const file = path.join(h.dir, "chapter.json");
  fs.writeFileSync(file, JSON.stringify(CH));

  const r = await h.cli("eval", "--book", h.configPath, "--chapters", "1", "--file", file, "--tag", "T2", "--out", path.join(h.dir, "evals"));
  assert.equal(r.code, 1);
  assert.match(r.out, /AGG-QUIZ.*below/);
  assert.match(r.out, /QUIZ-q1/, "the failing item is listed");
});

test("eval defaults: the chapter's final.json and <runDir>/eval/chNN.*", async () => {
  const h = harness();
  h.script({ "pipe-review": [{ result: judge() }], "pipe-nochapter": [{ result: GUESS_WRONG }] });
  h.put(2, "final.json", CH);

  const r = await h.cli("eval", "--book", h.configPath, "--chapters", "2");
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(h.runDir, "eval", "ch02.eval.json")), "ch02.eval.json is written");
  assert.ok(r.out.includes(path.join(h.runDir, "eval", "ch02.eval.json")), "the output names where the details went");
  assert.ok(r.out.includes(`file: ${h.file(2, "final.json")}`), "the chapter file that was judged is shown");
});

test("eval with the default flags on two chapters keeps both results, each saying which chapter it is", async () => {
  const h = harness();
  // The Nth review call answers with entry N: chapter 1's judge is the first call, chapter 2's the second.
  h.script({
    "pipe-review": [{ result: { ...judge(), lesson: "lesson of chapter one" } }, { result: { ...judge(["QUIZ-q1", "QUIZ-q2"]), lesson: "lesson of chapter two" } }],
    "pipe-nochapter": [{ result: GUESS_WRONG }],
  });
  h.put(1, "final.json", CH);
  h.put(2, "final.json", { ...CH, title: "Another chapter" });

  const one = await h.cli("eval", "--book", h.configPath, "--chapters", "1");
  assert.equal(one.code, 0, one.err);
  const two = await h.cli("eval", "--book", h.configPath, "--chapters", "2");
  assert.equal(two.code, 1, "chapter 2's judge fails the quiz bar");

  const evalDir = path.join(h.runDir, "eval");
  const names = fs.readdirSync(evalDir);
  for (const n of [1, 2]) {
    const tag = `ch0${n}`;
    for (const part of ["eval.json", "judge.json", "judge.envelope.json", "judge.result.txt", "nochapter-0.json", "nochapter-1.json", "nochapter-2.json"]) {
      assert.ok(names.includes(`${tag}.${part}`), `${tag}.${part} survives the other chapter's eval`);
    }
  }
  assert.ok(!names.includes("eval.eval.json"), "no chapter-less file name");
  assert.equal(names.filter((f) => f.includes("incomplete")).length, 0);

  const saved = (n: number) => JSON.parse(fs.readFileSync(path.join(evalDir, `ch0${n}.eval.json`), "utf8"));
  assert.equal(saved(1).chapter, 1);
  assert.equal(saved(1).lesson, "lesson of chapter one");
  assert.equal(saved(1).file, h.file(1, "final.json"));
  assert.equal(saved(1).passCount, JUDGE_IDS.length);
  assert.equal(saved(2).chapter, 2);
  assert.equal(saved(2).lesson, "lesson of chapter two");
  assert.equal(saved(2).file, h.file(2, "final.json"));
  assert.equal(saved(2).passCount, JUDGE_IDS.length - 2);
});

// ---------------------------------------------------------------- run: exit codes

test("run: a usage limit stops with exit 3 and says to run it again", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ usage: true }] });
  const r = await h.cli("run", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 3);
  assert.match(r.err, /USAGE_LIMIT/);
  assert.match(r.err, /again/);
});

test("run: the budget stop is exit 4 and no model is called", async () => {
  const h = harness({ budgetUsd: 1 });
  const r = await h.cli("run", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 4);
  assert.match(r.err, /BUDGET_STOP/);
  assert.equal(h.calls().length, 0);
});

test("run: a chapter that is already done is skipped without a call, and the table says so", async () => {
  const h = harness();
  h.put(1, "status.json", { chapter: 1, stage: "clean", round: 0, rerun: false, lessonRating: "SUPPORTED", open: [], spend: 2, lesson: KEY });
  const r = await h.cli("run", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /ch01\s+clean/);
  assert.equal(h.calls().length, 0);
});

test("run: open issues in a finished chapter give exit 1 and are listed", async () => {
  const h = harness();
  h.put(1, "status.json", {
    chapter: 1,
    stage: "open-issues",
    round: 2,
    rerun: false,
    lessonRating: "SUPPORTED",
    open: [{ source: "fact", blocking: true, field: "hook", text: "the shilling was copper" }],
    spend: 3,
    lesson: KEY,
  });
  const r = await h.cli("run", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 1);
  assert.match(r.out, /open-issues/);
  assert.match(r.out, /\[fact\] hook: the shilling was copper/);
});

// ---------------------------------------------------------------- the usage-limit stop in the step verbs

/** Long enough that the call that hits the usage limit has failed before the slow calls answer. */
const SLOW = 1500;
const COLD = { lesson: "Write faults down.", unclear: [] };

test("check: after a usage limit no new model call starts, so a sibling's retry is refused", async () => {
  const h = harness();
  h.put(1, "r0.chapter.json", CH);
  h.script({
    "pipe-factcheck": [{ usage: true }],
    // The first answer is not JSON, which makes the step ask again, unless the run has been stopped.
    "pipe-keysolve": [{ result: "prose", delay: SLOW }, { result: { answers: [] } }],
    "pipe-coldreader": [{ result: COLD, delay: SLOW }],
    "pipe-nochapter": [{ result: GUESS_WRONG, delay: SLOW }],
  });
  const r = await h.cli("check", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 3);
  assert.match(r.err, /USAGE_LIMIT/);
  assert.equal(h.calls("pipe-factcheck").length, 1);
  assert.equal(h.calls("pipe-keysolve").length, 1, "the keysolve retry was not started");
  assert.ok(!fs.existsSync(h.file(1, "r0.result.json")), "no verdict is saved for a check that did not finish");
});

test("fix: after a usage limit in its re-check no new model call starts", async () => {
  const h = harness();
  h.put(1, "r0.chapter.json", CH);
  h.put(1, "r0.result.json", { round: 0, lessonRating: "SUPPORTED", lessonReason: "", blocking: [], fixable: [{ source: "det", blocking: false, text: "tidy up" }], report: {} });
  h.script({
    "pipe-fix": [{ result: { edits: [], keyChanges: [], declined: [] } }],
    "pipe-factcheck": [{ usage: true }],
    "pipe-keysolve": [{ result: "prose", delay: SLOW }, { result: { answers: [] } }],
    "pipe-coldreader": [{ result: COLD, delay: SLOW }],
    "pipe-nochapter": [{ result: GUESS_WRONG, delay: SLOW }],
  });
  const r = await h.cli("fix", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 3);
  assert.equal(h.calls("pipe-fix").length, 1);
  assert.equal(h.calls("pipe-keysolve").length, 1, "the keysolve retry was not started");
});

test("eval: after a usage limit the judge's second try is not started", async () => {
  const h = harness();
  h.put(1, "final.json", CH);
  h.script({
    // The first answer is valid JSON but leaves out ids, which makes eval ask again, unless the run has been stopped.
    "pipe-review": [{ result: { lesson: KEY, singleLesson: true, items: [] }, delay: SLOW }, { result: judge() }],
    "pipe-nochapter": [{ usage: true }],
  });
  const r = await h.cli("eval", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 3);
  assert.match(r.err, /USAGE_LIMIT/);
  assert.equal(h.calls("pipe-review").length, 1, "the judge retry was not started");
});

test("write: a usage limit is exit 3 and keeps no draft", async () => {
  const h = harness();
  h.script({ "pipe-write": [{ usage: true }] });
  const r = await h.cli("write", "--book", h.configPath, "--chapters", "1,2");
  assert.equal(r.code, 3);
  assert.equal(h.calls("pipe-write").length, 1, "the second chapter is not started");
  assert.ok(!fs.existsSync(h.file(1, "r0.chapter.json")), "no draft");
});

test("the stop does not outlive the command: the same step runs again afterwards", async () => {
  const h = harness();
  h.put(1, "r0.chapter.json", CH);
  h.script({ "pipe-factcheck": [{ usage: true }, { result: { sentencesChecked: 1, lesson: { rating: "SUPPORTED", reason: "ok", sourceText: "none" }, issues: [], quizIssues: [] } }], "pipe-keysolve": [{ result: { answers: [] } }], "pipe-coldreader": [{ result: COLD }], "pipe-nochapter": [{ result: GUESS_WRONG }] });
  assert.equal((await h.cli("check", "--book", h.configPath, "--chapters", "1")).code, 3);
  const again = await h.cli("check", "--book", h.configPath, "--chapters", "1");
  assert.equal(again.code, 1, "the second run is not refused as a stopped run; it finishes and finds the missing card");
  assert.ok(fs.existsSync(h.file(1, "r0.result.json")), "the verdict is saved");
});

// ---------------------------------------------------------------- write / check / fix

test("write: a chapter that already has a draft is skipped unless --force", async () => {
  const h = harness();
  h.put(1, "r0.chapter.json", CH);
  const r = await h.cli("write", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /--force/);
  assert.equal(h.calls().length, 0);
  assert.ok(fs.existsSync(h.file(1, "r0.chapter.json")), "the draft is untouched");
});

test("write --force: the old run is kept beside the new one, then the writer is called", async () => {
  const h = harness();
  h.put(1, "r0.chapter.json", CH);
  h.script({ "pipe-write": [{ result: "not json at all" }] });
  const r = await h.cli("write", "--book", h.configPath, "--chapters", "1", "--force");
  assert.equal(r.code, 1, "an unusable draft is an error");
  assert.match(r.err, /WRITER_OUTPUT_INVALID/);
  assert.equal(h.calls("pipe-write").length, 1);
  const kept = fs.readdirSync(h.runDir).filter((f) => f.startsWith("ch01.prev-"));
  assert.equal(kept.length, 1);
  assert.ok(fs.existsSync(path.join(h.runDir, kept[0]!, "r0.chapter.json")));
});

test("check: with no draft it says to write first; with a broken draft it lists the det issues and makes no model call", async () => {
  const h = harness();
  const none = await h.cli("check", "--book", h.configPath, "--chapters", "1");
  assert.equal(none.code, 1);
  assert.match(none.err, /NO_DRAFT/);

  h.put(1, "r0.chapter.json", {});
  const r = await h.cli("check", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 1);
  assert.match(r.out, /ch01 r0/);
  assert.match(r.out, /! \[det\]/, "blocking issues are marked");
  assert.equal(h.calls().length, 0);
  assert.ok(fs.existsSync(h.file(1, "r0.result.json")));
});

test("fix: one fix round on the latest check, then a re-check; it refuses when nothing was checked or two rounds are used", async () => {
  const h = harness();
  h.put(1, "r0.chapter.json", {});
  const early = await h.cli("fix", "--book", h.configPath, "--chapters", "1");
  assert.equal(early.code, 1);
  assert.match(early.err, /NO_CHECK/);

  // A complete chapter with no lesson card: the models are called, and the code check blocks on the missing card.
  h.put(1, "r0.chapter.json", CH);
  h.script({
    "pipe-factcheck": [{ result: { sentencesChecked: 1, lesson: { rating: "SUPPORTED", reason: "ok", sourceText: "none" }, issues: [], quizIssues: [] } }],
    "pipe-keysolve": [{ result: { answers: [1, 0, 0].map((choice, i) => ({ questionId: `q${i + 1}`, choice, alsoDefensible: [], reason: "the lesson says so" })) } }],
    "pipe-coldreader": [{ result: { lesson: "Write faults down.", unclear: [] } }],
    "pipe-nochapter": [{ result: GUESS_WRONG }],
    "pipe-fix": [{ result: { edits: [], keyChanges: [], declined: [] } }],
  });
  const checked = await h.cli("check", "--book", h.configPath, "--chapters", "1");
  assert.equal(checked.code, 1);
  assert.match(checked.out, /! \[det\].*_lesson/);
  assert.equal(h.calls("pipe-factcheck").length, 1);

  const r = await h.cli("fix", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 1, "the card is still missing");
  assert.equal(h.calls("pipe-fix").length, 1);
  assert.match(r.out, /ch01 r1/);
  assert.ok(fs.existsSync(h.file(1, "r1.chapter.json")));
  assert.ok(fs.existsSync(h.file(1, "r1.result.json")));
  assert.equal(h.calls("pipe-factcheck").length, 2, "the fixed draft is checked again");

  await h.cli("fix", "--book", h.configPath, "--chapters", "1");
  const third = await h.cli("fix", "--book", h.configPath, "--chapters", "1");
  assert.equal(third.code, 1);
  assert.match(third.out, /2 fix rounds/);
  assert.equal(h.calls("pipe-fix").length, 2);
});

// ---------------------------------------------------------------- fix --issues (the reader round)

const FINDING = { field: "quiz.q3", text: "the right answer is guessable by common sense; the wrong choices are silly" };
/** The edit the scripted fix call makes, so round 3 differs from round 2. */
const FIX_Q3 = { edits: [{ field: "quiz.q3.prompt", find: "What is better?", replace: "What is the better first step?" }], keyChanges: [], declined: [] };
const CH_R2 = { ...CH, title: "The chapter after two fix rounds" };
const FACT_OK = { sentencesChecked: 1, lesson: { rating: "SUPPORTED", reason: "ok", sourceText: "none" }, issues: [], quizIssues: [] };
const CHECK_SCRIPT = {
  "pipe-factcheck": [{ result: FACT_OK }],
  "pipe-keysolve": [{ result: { answers: [1, 0, 0].map((choice, i) => ({ questionId: `q${i + 1}`, choice, alsoDefensible: [], reason: "the lesson says so" })) } }],
  "pipe-coldreader": [{ result: COLD }],
  "pipe-nochapter": [{ result: GUESS_WRONG }],
};

/** Chapter n as `run` leaves it after 2 fix rounds: r0-r2 on disk, r2 checked, final.json = r2, status open-issues. */
function afterTwoFixRounds(h: Harness, n = 1): void {
  for (const r of [0, 1]) h.put(n, `r${r}.chapter.json`, CH);
  h.put(n, "r2.chapter.json", CH_R2);
  h.put(n, "r2.result.json", {
    round: 2,
    lessonRating: "SUPPORTED",
    lessonReason: "",
    blocking: [{ source: "keysolve", blocking: true, field: "quiz.q1", text: "the solver picked choice 0 but the key is 1" }],
    fixable: [
      { source: "keysolve", blocking: true, field: "quiz.q1", text: "the solver picked choice 0 but the key is 1" },
      { source: "coldreader", blocking: false, field: "breakdown.fastRead", text: "a new reader may not follow VIRTUE-WORD" },
      { source: "lesson", blocking: true, field: "keyTakeaway", text: "lesson rated STRETCHED: LESSON-NOTE" },
    ],
    report: {},
  });
  h.put(n, "r0-pre-rerun.chapter.json", CH);
  h.put(n, "lesson.json", { lesson: KEY });
  h.put(n, "final.json", CH_R2);
  h.put(n, "status.json", {
    chapter: n,
    stage: "open-issues",
    round: 2,
    rerun: true,
    lessonRating: "SUPPORTED",
    open: [{ source: "keysolve", blocking: true, field: "quiz.q1", text: "the solver picked choice 0 but the key is 1" }],
    spend: 1.5,
    lesson: KEY,
  });
}

const readJson = (file: string): any => JSON.parse(fs.readFileSync(file, "utf8"));
const findings = (h: Harness, ...items: unknown[]): string => {
  const f = path.join(h.dir, `findings-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(f, JSON.stringify(items));
  return f;
};

test("fix --issues on a chapter at round 2: one extra fix call with the findings, a check, and final.json and status.json move to r3", async () => {
  const h = harness();
  afterTwoFixRounds(h);
  fs.writeFileSync(h.ledgerPath, JSON.stringify({ ts: "t", chapter: "demo-book/ch01", step: "write", model: "m", effort: "high", cost: 1.5, outTokens: 1, stopReason: "end_turn", seconds: 1, isError: false }) + "\n");
  // The new round still has a blocking quiz issue and one non-blocking leftover from the cold reader.
  h.script({
    ...CHECK_SCRIPT,
    "pipe-factcheck": [{ result: { ...FACT_OK, quizIssues: [{ questionId: "q1", keyedIndex: 1, supportedIndex: 0, problem: "the lesson supports another choice" }] } }],
    "pipe-coldreader": [{ result: { lesson: "Write faults down.", unclear: [{ text: "virtue", why: "abstract" }] } }],
    "pipe-fix": [{ result: FIX_Q3 }],
  });
  const file = findings(h, FINDING);

  const r = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", file);
  assert.equal(r.code, 1, "r3 still has a blocking issue");
  assert.equal(h.calls("pipe-fix").length, 1, "exactly one fix call");
  const prompt = h.calls("pipe-fix")[0]!.prompt;
  assert.ok(prompt.includes(FINDING.text), "the injected finding is in the fix prompt");
  assert.match(prompt, /\[REVIEW REPORTED\] quiz\.q3: the right answer is guessable/, "as a non-blocking review issue with its field");
  assert.ok(prompt.includes("the solver picked choice 0"), "the latest round's fixable issues are sent too");
  assert.ok(prompt.includes("VIRTUE-WORD"));
  assert.ok(!prompt.includes("LESSON-NOTE"), "a lesson issue is not sent: an edit cannot mend it");
  assert.ok(prompt.indexOf(FINDING.text) < prompt.indexOf("VIRTUE-WORD"), "the findings come first");
  assert.equal(h.calls("pipe-factcheck").length, 1, "the new round is checked once");
  assert.match(r.out, /ch01 r3/, "the round is printed like a normal fix");

  const r3 = readJson(h.file(1, "r3.chapter.json"));
  assert.match(r3.quiz.questions[2].prompt, /the better first step/);
  assert.ok(fs.existsSync(h.file(1, "r3.result.json")));
  assert.deepEqual(readJson(h.file(1, "final.json")), r3, "final.json is r3");
  assert.deepEqual(readJson(h.file(1, "final.r2.json")), CH_R2, "the old final is kept as final.r2.json");

  const st = readJson(h.file(1, "status.json"));
  assert.equal(st.readerRound, true);
  assert.equal(st.readerIssues, 1);
  assert.equal(st.round, 3);
  assert.equal(st.chapter, 1);
  assert.equal(st.stage, "open-issues");
  assert.equal(st.rerun, true, "rerun stays as it was");
  assert.equal(st.lessonRating, "SUPPORTED");
  assert.equal(st.lesson, KEY);
  assert.equal(st.spend, 3.25, "1.5 from before plus the 7 calls of this round at $0.25");
  const result3 = readJson(h.file(1, "r3.result.json"));
  assert.equal(result3.blocking.length, 1);
  assert.deepEqual(
    st.open,
    [...result3.blocking, ...result3.fixable.filter((i: { blocking: boolean }) => !i.blocking).map((i: object) => ({ ...i, leftover: true }))],
    "open is the blocking issues, then the unfixed non-blocking ones marked leftover, as run writes it",
  );
  assert.deepEqual(st.open.map((i: { source: string; leftover?: true }) => [i.source, i.leftover === true]), [["quiz", false], ["coldreader", true]]);

  // The other verbs now see the new final.
  const status = await h.cli("status", "--book", h.configPath, "--chapters", "1");
  assert.match(status.out, /open-issues/);
  const render = await h.cli("render", "--book", h.configPath, "--chapters", "1");
  assert.equal(render.code, 0, render.err);
  assert.match(fs.readFileSync(path.join(h.runDir, "reading", "ch01.html"), "utf8"), /the better first step/, "render shows r3");
});

test("fix --issues: a round with nothing blocking leaves the chapter clean, with final.json and status.json to match", async () => {
  const h = harness();
  afterTwoFixRounds(h);
  fs.rmSync(h.file(1, "final.json"));
  h.put(1, "status.json", { chapter: 1, stage: "open-issues", round: 2, rerun: false, lessonRating: "SUPPORTED", open: [], spend: 0, lesson: KEY });
  fs.rmSync(h.file(1, "r0-pre-rerun.chapter.json"));
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });

  const r = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.equal(r.code, 0, `${r.out}${r.err}`);
  const st = readJson(h.file(1, "status.json"));
  assert.deepEqual([st.stage, st.round, st.readerRound, st.readerIssues, st.rerun], ["clean", 3, true, 1, false]);
  assert.ok(!fs.existsSync(h.file(1, "final.r2.json")), "there was no final to keep");
  assert.deepEqual(readJson(h.file(1, "final.json")), readJson(h.file(1, "r3.chapter.json")));
});

test("fix --issues: a second reader round on the same chapter is refused, with no model call", async () => {
  const h = harness();
  afterTwoFixRounds(h);
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });
  const first = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.ok(first.code === 0 || first.code === 1, first.err);
  const callsAfterFirst = h.calls().length;
  const statusAfterFirst = fs.readFileSync(h.file(1, "status.json"), "utf8");
  const finalAfterFirst = fs.readFileSync(h.file(1, "final.json"), "utf8");

  const again = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, { field: "hook", text: "SECOND-FINDING" }));
  assert.equal(again.code, 1);
  assert.match(again.err, /ch01/);
  assert.match(again.err, /reader round/);
  assert.match(again.err, /at most one/);
  assert.equal(h.calls().length, callsAfterFirst, "no model call was made");
  assert.ok(!fs.existsSync(h.file(1, "r4.chapter.json")));
  assert.equal(fs.readFileSync(h.file(1, "status.json"), "utf8"), statusAfterFirst, "status.json is untouched");
  assert.equal(fs.readFileSync(h.file(1, "final.json"), "utf8"), finalAfterFirst, "final.json is untouched");

  // A plain fix after the reader round is still stopped by the 2-round cap.
  const plain = await h.cli("fix", "--book", h.configPath, "--chapters", "1");
  assert.equal(plain.code, 1);
  assert.match(plain.out, /2 fix rounds/);
  assert.equal(h.calls().length, callsAfterFirst);
});

test("fix --issues: refused when the latest round is already round 3 or later, and when the status already says a reader round was run", async () => {
  const h = harness();
  afterTwoFixRounds(h, 2);
  h.put(2, "r3.chapter.json", CH);
  h.put(2, "r3.result.json", { round: 3, lessonRating: "SUPPORTED", lessonReason: "", blocking: [], fixable: [], report: {} });
  afterTwoFixRounds(h, 3);
  h.put(3, "status.json", { chapter: 3, stage: "open-issues", round: 2, rerun: false, lessonRating: "SUPPORTED", open: [], spend: 0, lesson: KEY, readerRound: true, readerIssues: 2 });

  for (const n of [2, 3]) {
    const r = await h.cli("fix", "--book", h.configPath, "--chapters", String(n), "--issues", findings(h, FINDING));
    assert.equal(r.code, 1, `chapter ${n}`);
    assert.match(r.err, /reader round/);
  }
  assert.equal(h.calls().length, 0);
});

test("fix --issues: a file that is not an array of {field, text} is a usage error and nothing runs", async () => {
  const h = harness();
  afterTwoFixRounds(h);
  const before = fs.readdirSync(path.dirname(h.file(1, "x"))).sort();
  const put = (name: string, body: string): string => {
    const f = path.join(h.dir, name);
    fs.writeFileSync(f, body);
    return f;
  };
  for (const [name, body] of Object.entries({
    "not-json.json": "this is not json",
    "object.json": JSON.stringify({ field: "quiz.q3", text: "x" }),
    "empty.json": "[]",
    "no-text.json": JSON.stringify([{ field: "quiz.q3" }]),
    "no-field.json": JSON.stringify([{ text: "x" }]),
    "number-field.json": JSON.stringify([{ field: 3, text: "x" }]),
    "blank-text.json": JSON.stringify([{ field: "quiz.q3", text: "  " }]),
    "strings.json": JSON.stringify(["just a sentence"]),
    "null-item.json": JSON.stringify([{ field: "quiz.q3", text: "x" }, null]),
  })) {
    const r = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", put(name, body));
    assert.equal(r.code, 1, name);
    assert.match(r.err, /--issues/, name);
    assert.match(r.err, /Usage:/, `${name} gets the usage text`);
  }
  const missing = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", path.join(h.dir, "missing.json"));
  assert.equal(missing.code, 1);
  assert.match(missing.err, /Usage:/);

  const good = put("good.json", JSON.stringify([FINDING]));
  for (const args of [
    ["status", "--book", h.configPath, "--issues", good],
    ["check", "--book", h.configPath, "--chapters", "1", "--issues", good],
    ["fix", "--book", h.configPath, "--issues", good],
    ["fix", "--book", h.configPath, "--chapters", "1,2", "--issues", good],
  ]) {
    const r = await h.cli(...args);
    assert.equal(r.code, 1, JSON.stringify(args));
    assert.match(r.err, /--issues/, JSON.stringify(args));
    assert.match(r.err, /Usage:/);
  }
  assert.equal(h.calls().length, 0);
  assert.deepEqual(fs.readdirSync(path.dirname(h.file(1, "x"))).sort(), before, "no file was written");
});

test("fix --issues also works on a chapter below round 2 (it is the chapter's reader round)", async () => {
  const h = harness();
  h.put(1, "r0.chapter.json", CH);
  h.put(1, "r0.result.json", { round: 0, lessonRating: "SUPPORTED", lessonReason: "", blocking: [], fixable: [], report: {} });
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });
  const r = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.ok(r.code === 0 || r.code === 1, r.err);
  assert.equal(h.calls("pipe-fix").length, 1, "the findings alone start the fix call");
  assert.ok(h.calls("pipe-fix")[0]!.prompt.includes(FINDING.text));
  const st = readJson(h.file(1, "status.json"));
  assert.deepEqual([st.round, st.readerRound, st.readerIssues], [1, true, 1]);
  assert.deepEqual(readJson(h.file(1, "final.json")), readJson(h.file(1, "r1.chapter.json")));
  const again = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.equal(again.code, 1, "still only one reader round");
  assert.equal(h.calls("pipe-fix").length, 1);
});

// ---------------------------------------------------------------- fix --finish (the finish round)

const BLOCKING_TEXT = "BLOCKING-NOTE the lesson supports another choice for q1";
const REPORTED_A = "REPORTED-A a new reader may not follow VIRTUE-ALPHA";
const REPORTED_B = "REPORTED-B a new reader may not follow VIRTUE-BETA";
const CH_R3 = { ...CH, title: "The chapter after the reader round" };
const FIX_Q2 = { edits: [{ field: "quiz.q2.prompt", find: "What fits?", replace: "What fits best?" }], keyChanges: [], declined: [] };

/** Chapter n as the reader round leaves it: r3 checked (one blocking, two reported), final.json = r3, status says readerRound. */
function afterReaderRound(h: Harness, n = 1, result: { blocking: unknown[]; fixable: unknown[] } | null = null): void {
  afterTwoFixRounds(h, n);
  const blocking = { source: "quiz", blocking: true, field: "quiz.q1", text: BLOCKING_TEXT };
  const res = result ?? {
    blocking: [blocking],
    fixable: [
      blocking,
      { source: "coldreader", blocking: false, field: "breakdown.fastRead", text: REPORTED_A },
      { source: "coldreader", blocking: false, field: "breakdown.fullRead", text: REPORTED_B },
    ],
  };
  h.put(n, "r3.chapter.json", CH_R3);
  h.put(n, "r3.result.json", { round: 3, lessonRating: "SUPPORTED", lessonReason: "", ...res, report: {} });
  h.put(n, "final.json", CH_R3);
  h.put(n, "final.r2.json", CH_R2);
  h.put(n, "status.json", {
    chapter: n,
    stage: "open-issues",
    round: 3,
    rerun: true,
    lessonRating: "SUPPORTED",
    open: res.blocking,
    spend: 3,
    lesson: KEY,
    readerRound: true,
    readerIssues: 1,
  });
}

test("fix --finish: one fix call with only the blocking issues, a check, and final.json and status.json move to the new round", async () => {
  const h = harness();
  afterReaderRound(h);
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });

  const r = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 0, `${r.out}${r.err}`);
  assert.equal(h.calls("pipe-fix").length, 1, "exactly one fix call");
  const prompt = h.calls("pipe-fix")[0]!.prompt;
  assert.ok(prompt.includes(BLOCKING_TEXT), "the blocking issue is in the fix prompt");
  assert.match(prompt, /\[QUIZ BLOCKING\] quiz\.q1: BLOCKING-NOTE/);
  assert.ok(!prompt.includes("REPORTED-A") && !prompt.includes("REPORTED-B"), "the reported issues are not sent");
  assert.ok(!prompt.includes("REVIEW REPORTED"));
  assert.equal(h.calls("pipe-factcheck").length, 1, "the new round is checked once");
  assert.match(r.out, /ch01 r4/, "the round is printed like a normal fix");

  const r4 = readJson(h.file(1, "r4.chapter.json"));
  assert.match(r4.quiz.questions[2].prompt, /the better first step/);
  assert.ok(fs.existsSync(h.file(1, "r4.result.json")));
  assert.deepEqual(readJson(h.file(1, "final.json")), r4, "final.json is r4");
  assert.deepEqual(readJson(h.file(1, "final.r3.json")), CH_R3, "the old final is kept as final.r3.json");
  assert.deepEqual(readJson(h.file(1, "final.r2.json")), CH_R2, "an earlier kept final is left alone");

  const st = readJson(h.file(1, "status.json"));
  assert.equal(st.finishRound, true);
  assert.equal(st.finishIssues, 1);
  assert.equal(st.readerRound, true, "readerRound stays true");
  assert.equal(st.readerIssues, 1, "and so does what the reader round sent");
  assert.deepEqual([st.chapter, st.round, st.stage, st.rerun, st.lessonRating, st.lesson], [1, 4, "clean", true, "SUPPORTED", KEY]);
  assert.deepEqual(st.open, []);
  assert.equal(st.spend, 1.75, "7 calls of the new round at $0.25 on top of an empty ledger");
});

test("fix --finish --issues: the listed findings go in as non-blocking review issues beside the blocking one", async () => {
  const h = harness();
  afterReaderRound(h);
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });

  const r = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.equal(r.code, 0, `${r.out}${r.err}`);
  assert.equal(h.calls("pipe-fix").length, 1);
  const prompt = h.calls("pipe-fix")[0]!.prompt;
  assert.ok(prompt.includes(BLOCKING_TEXT));
  assert.ok(prompt.includes(FINDING.text), "the finding is in the fix prompt");
  assert.match(prompt, /\[REVIEW REPORTED\] quiz\.q3: the right answer is guessable/, "as a non-blocking review issue with its field");
  assert.ok(!prompt.includes("REPORTED-A") && !prompt.includes("REPORTED-B"), "the reported issues are still not sent");
  const st = readJson(h.file(1, "status.json"));
  assert.deepEqual([st.finishRound, st.finishIssues, st.readerRound, st.readerIssues, st.round], [true, 2, true, 1, 4]);
});

test("fix --finish: a second finish round on the same chapter is refused, with no model call", async () => {
  const h = harness();
  afterReaderRound(h);
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });
  const first = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "1");
  assert.equal(first.code, 0, `${first.out}${first.err}`);
  const callsAfterFirst = h.calls().length;
  const statusAfterFirst = fs.readFileSync(h.file(1, "status.json"), "utf8");
  const finalAfterFirst = fs.readFileSync(h.file(1, "final.json"), "utf8");

  for (const extra of [[], ["--issues", findings(h, { field: "hook", text: "SECOND-FINDING" })]]) {
    const again = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "1", ...extra);
    assert.equal(again.code, 1);
    assert.match(again.err, /ch01/);
    assert.match(again.err, /finish round/);
    assert.match(again.err, /at most one/);
    assert.equal(h.calls().length, callsAfterFirst, "no model call was made");
    assert.ok(!fs.existsSync(h.file(1, "r5.chapter.json")));
    assert.equal(fs.readFileSync(h.file(1, "status.json"), "utf8"), statusAfterFirst, "status.json is untouched");
    assert.equal(fs.readFileSync(h.file(1, "final.json"), "utf8"), finalAfterFirst, "final.json is untouched");
  }
  // Neither a plain fix nor another reader round gets past what is already used.
  const plain = await h.cli("fix", "--book", h.configPath, "--chapters", "1");
  assert.equal(plain.code, 1);
  const reader = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.equal(reader.code, 1);
  assert.equal(h.calls().length, callsAfterFirst);
});

test("fix --finish: refused before the chapter has had its reader round, with no model call", async () => {
  const h = harness();
  afterTwoFixRounds(h, 1); // checked, open issues, but no reader round
  const before = fs.readFileSync(h.file(1, "status.json"), "utf8");
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });

  for (const n of [1, 2]) {
    // Chapter 2 has no files at all.
    const r = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", String(n));
    assert.equal(r.code, 1, `chapter ${n}`);
    assert.match(r.err, new RegExp(`ch0${n}`));
    assert.match(r.err, /reader round/);
    assert.match(r.err, /--finish/);
  }
  const withFile = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.equal(withFile.code, 1, "the findings do not stand in for the reader round");
  assert.equal(h.calls().length, 0, "no model call was made");
  assert.ok(!fs.existsSync(h.file(1, "r3.chapter.json")));
  assert.ok(!fs.existsSync(h.file(2, "r0.chapter.json")));
  assert.equal(fs.readFileSync(h.file(1, "status.json"), "utf8"), before, "status.json is untouched");
});

test("fix --finish: with no blocking issue left and no --issues file it says nothing to finish, exits 0 and calls no model", async () => {
  const h = harness();
  afterReaderRound(h, 1, { blocking: [], fixable: [{ source: "coldreader", blocking: false, field: "breakdown.fastRead", text: REPORTED_A }] });
  const before = fs.readFileSync(h.file(1, "status.json"), "utf8");
  h.script({ ...CHECK_SCRIPT, "pipe-fix": [{ result: FIX_Q3 }] });

  const r = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 0, `${r.out}${r.err}`);
  assert.match(r.out, /nothing to finish/);
  assert.equal(h.calls().length, 0, "no model call was made");
  assert.ok(!fs.existsSync(h.file(1, "r4.chapter.json")));
  assert.equal(fs.readFileSync(h.file(1, "status.json"), "utf8"), before, "status.json is untouched, so the one finish round is still there");

  // Only a lesson issue blocks: an edit cannot mend it, so nothing is sent, and the chapter still has a blocking issue.
  const lesson = { source: "lesson", blocking: true, field: "keyTakeaway", text: "lesson rated STRETCHED: LESSON-NOTE" };
  afterReaderRound(h, 2, { blocking: [lesson], fixable: [lesson] });
  const stuck = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "2");
  assert.equal(stuck.code, 1);
  assert.match(stuck.out, /nothing to finish/);
  assert.equal(h.calls().length, 0);
});

test("fix --finish: after a real reader round it sends only what that round left blocking, and keeps what the reader round wrote", async () => {
  const h = harness();
  afterTwoFixRounds(h);
  h.script({
    ...CHECK_SCRIPT,
    // The reader round's check (call 0) leaves one blocking and two reported issues; the finish round's check (call 1) is clean.
    "pipe-factcheck": [{ result: { ...FACT_OK, quizIssues: [{ questionId: "q1", keyedIndex: 1, supportedIndex: 0, problem: "BLOCKING-NOTE" }] } }, { result: FACT_OK }],
    "pipe-coldreader": [{ result: { lesson: "Write faults down.", unclear: [{ text: "VIRTUE-ALPHA", why: "abstract" }, { text: "VIRTUE-BETA", why: "vague" }] } }, { result: COLD }],
    "pipe-fix": [{ result: FIX_Q3 }, { result: FIX_Q2 }],
  });
  const reader = await h.cli("fix", "--book", h.configPath, "--chapters", "1", "--issues", findings(h, FINDING));
  assert.equal(reader.code, 1, "r3 still has the blocking issue");
  const r3 = readJson(h.file(1, "r3.chapter.json"));
  assert.equal(readJson(h.file(1, "r3.result.json")).blocking.length, 1);

  const r = await h.cli("fix", "--finish", "--book", h.configPath, "--chapters", "1");
  assert.equal(r.code, 0, `${r.out}${r.err}`);
  assert.equal(h.calls("pipe-fix").length, 2, "one reader-round call and one finish call");
  const prompt = h.calls("pipe-fix")[1]!.prompt;
  assert.ok(prompt.includes("BLOCKING-NOTE"));
  assert.ok(!prompt.includes("VIRTUE-ALPHA") && !prompt.includes("VIRTUE-BETA"), "the cold reader's reported issues are not sent");
  assert.deepEqual(readJson(h.file(1, "final.json")), readJson(h.file(1, "r4.chapter.json")));
  assert.deepEqual(readJson(h.file(1, "final.r3.json")), r3, "the reader round's final is kept");
  assert.deepEqual(readJson(h.file(1, "final.r2.json")), CH_R2, "and so is the one before it");
  const st = readJson(h.file(1, "status.json"));
  assert.deepEqual([st.round, st.stage, st.readerRound, st.readerIssues, st.finishRound, st.finishIssues], [4, "clean", true, 1, true, 1]);
});

test("fix --finish: only goes with fix and needs exactly one chapter, and a bad --issues file is still a usage error", async () => {
  const h = harness();
  afterReaderRound(h);
  const before = fs.readFileSync(h.file(1, "status.json"), "utf8");
  const bad = path.join(h.dir, "bad.json");
  fs.writeFileSync(bad, "[]");
  for (const args of [
    ["status", "--book", h.configPath, "--finish"],
    ["check", "--book", h.configPath, "--chapters", "1", "--finish"],
    ["run", "--book", h.configPath, "--chapters", "1", "--finish"],
    ["eval", "--book", h.configPath, "--chapters", "1", "--finish"],
    ["fix", "--book", h.configPath, "--finish"],
    ["fix", "--book", h.configPath, "--chapters", "1,2", "--finish"],
    ["fix", "--book", h.configPath, "--chapters", "1", "--finish", "--issues", bad],
  ]) {
    const r = await h.cli(...args);
    assert.equal(r.code, 1, JSON.stringify(args));
    assert.match(r.err, /--finish|--issues/, JSON.stringify(args));
    assert.match(r.err, /Usage:/, JSON.stringify(args));
  }
  assert.equal(h.calls().length, 0);
  assert.equal(fs.readFileSync(h.file(1, "status.json"), "utf8"), before);
  const usage = await h.cli("nonsense");
  assert.match(usage.err, /--finish/, "the usage text lists --finish");
});

// ---------------------------------------------------------------- render

test("render: writes <runDir>/reading/chNN.html for chapters that have a final.json and skips the rest", async () => {
  const h = harness();
  h.put(2, "final.json", CH);
  h.put(2, "status.json", { chapter: 2, stage: "open-issues", round: 2, rerun: false, lessonRating: "SUPPORTED", open: [{ source: "fact", blocking: true, text: "x" }], spend: 1, lesson: KEY });

  const r = await h.cli("render", "--book", h.configPath);
  assert.equal(r.code, 0, r.err);
  const html = fs.readFileSync(path.join(h.runDir, "reading", "ch02.html"), "utf8");
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /Chapter 2: The Little Book of Faults/);
  assert.match(html, /Demo Book/);
  assert.match(html, /open-issues/, "the page says the chapter still has open issues");
  assert.ok(!fs.existsSync(path.join(h.runDir, "reading", "ch01.html")));
  assert.match(r.out, /ch02\.html/);
});

test("render: with no final chapter it exits 1 and says what to do", async () => {
  const h = harness();
  const r = await h.cli("render", "--book", h.configPath);
  assert.equal(r.code, 1);
  assert.match(r.err, /no final chapter/i);
});

// ---------------------------------------------------------------- the committed book configs

test("the committed book configs load, use canonical categories, and give the shape W1c measured", () => {
  for (const name of ["the-autobiography-of-benjamin-franklin", "how-to-live-on-24-hours-a-day"]) {
    const cfg = loadBookConfig(path.join(BOOKS, `${name}.json`));
    assert.equal(cfg.bookId, name);
    for (const c of cfg.categories) assert.ok(isCanonicalCategory(c), `${name}: category "${c}" is not in lib/category-taxonomy.ts`);
    assert.deepEqual(cfg.shape, {
      examples: 3, quizQuestions: 7, choices: 3, reviewCards: 5, memorableLines: 3, ifThenPlans: 2,
      fastRead: [150, 220], deepRead: [350, 500], fullRead: [800, 1100],
    });
    assert.deepEqual([cfg.writer.model, cfg.writer.effort], ["claude-opus-5-5", "high"]);
    assert.deepEqual([cfg.checker.model, cfg.checker.effort], ["claude-opus-5-5", "high"]);
    assert.deepEqual([cfg.solver.model, cfg.solver.effort], ["claude-sonnet-5", "medium"]);
    assert.ok(cfg.writer.bin.endsWith("native-binary/claude"));
    assert.equal(cfg.budgetUsd, 80);
    assert.equal(cfg.runDir, path.join(os.homedir(), "cf-wt/v26-plan/scratch/W1c/run", name));
    assert.equal(cfg.ledgerPath, path.join(os.homedir(), "cf-wt/v26-plan/scratch/W1c/ledger.jsonl"));
    assert.equal(cfg.briefPath, path.resolve(BOOKS, "../briefs", `${name}.md`));
  }
  const franklin = loadBookConfig(path.join(BOOKS, "the-autobiography-of-benjamin-franklin.json"));
  assert.equal(franklin.bookType, "memoir");
  assert.deepEqual(franklin.categories, ["Memoir", "Classics", "Self Improvement"]);
  assert.equal(franklin.knownTrapsPath, path.join(os.homedir(), "cf-wt/v26-plan/data/franklin/known-traps.json"));
  const bennett = loadBookConfig(path.join(BOOKS, "how-to-live-on-24-hours-a-day.json"));
  assert.equal(bennett.bookType, "how-to");
  assert.deepEqual(bennett.categories, ["Productivity", "Self Improvement"]);
  assert.equal(bennett.knownTrapsPath, undefined);
});
