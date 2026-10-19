import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main } from "../cli";
import { CallFailedError } from "../src/call";
import { loadBookConfig } from "../src/config";
import { readLedger } from "../src/ledger";
import { makeCtx, type PipelineCtx } from "../src/pipeline";
import {
  COMPONENTS,
  generateVariants,
  lessonsShapeErrors,
  summaryDetIssues,
  variantsShapeErrors,
  type SummaryVariant,
  type VariantsRun,
} from "../src/variants";
import { renderVariantsPage } from "../src/variantsRender";

// ---------------------------------------------------------------- fixtures

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const AUTHOR = 'My father used to say that "a fault named is half mended." I kept a little book and was happier for the trying.';

const lesson = (k: number) => ({
  lesson: `Lesson number ${k}: name the fault in writing before you try to mend it.`,
  wrongBelief: "You must feel bad about a fault to fix it.",
  keyPhrase: `name the fault ${k}`,
  hookQuestion: "Why does writing a fault down help?",
  storyNames: ["Franklin"],
  evidence: ["a fault named is half mended"],
  whyThisOne: k === 1 ? "The author states it himself." : `Weaker: candidate ${k} leans on a side detail.`,
});
const LESSONS = { lessons: [1, 2, 3, 4, 5].map(lesson) };

const five = <T>(make: (label: string, i: number) => T): { variants: T[] } => ({ variants: ["A", "B", "C", "D", "E"].map(make) });
const longText = (label: string): string =>
  Array.from({ length: 3 }, (_, p) => Array.from({ length: 90 }, (_, w) => `w${label}${p}${w}`).join(" ")).join("\n\n");
const SUMMARY = five((label) => ({
  label,
  approach: `approach ${label}`,
  hook: `Hook ${label}: the obvious move is about to backfire.`,
  counterintuition: `Many people think X. Actually Y, because Z (${label}).`,
  summary: `${longText(label)} He wrote "a fault named is half mended."`,
  tryThisNow: `Write one fault down tonight (${label}).`,
  memorableLine: `Name it, then mend it (${label}).`,
}));
const EXAMPLES = five((label) => ({
  label,
  approach: `examples ${label}`,
  examples: ["work", "school", "personal"].map((tag, i) => ({
    title: `Example ${label}${i}`,
    tags: [tag],
    scenario: `Someone at ${tag} faces a choice (${label}).`,
    whatToDo: "Write the fault down.",
    whyItMatters: "A named fault can be mended.",
  })),
}));
const QUIZ = five((label) => ({
  label,
  approach: `quiz ${label}`,
  questions: [0, 1, 2, 0, 1].map((key, i) => ({
    prompt: `Question ${label}${i}: what do you do?`,
    choices: ["Scold yourself", "Write it down", "Ignore it"],
    correctIndex: key,
    explanation: "Naming the fault starts the mending.",
    bloomsLevel: "apply",
  })),
}));
const CARDS = five((label) => ({
  label,
  approach: `cards ${label}`,
  cards: [1, 2, 3, 4, 5].map((i) => ({ front: `Front ${label}${i}`, back: `Back ${label}${i}`, difficulty: "easy" })),
}));
const PRACTICE = five((label) => ({
  label,
  approach: `practice ${label}`,
  coreSkill: `Naming faults (${label})`,
  ifThenPlans: [
    { context: "When I slip", plan: "then I write it down" },
    { context: "When I want to scold myself", plan: "then I name the fault and stop" },
  ],
  twentyFourHourChallenge: "Write three faults tonight.",
  weeklyPractice: "Read the list on Sunday.",
}));
const FACT = {
  sentencesChecked: 40,
  issues: [{ variant: "C", kind: "WHY", field: "summary", chapterText: "wC00", verdict: "UNSUPPORTED", sourceText: "none", fix: "cut the motive" }],
};

const GOOD: Record<string, unknown[]> = {
  "pipe-vlessons": [{ result: LESSONS, cost: 1 }],
  "pipe-vsummary": [{ result: SUMMARY, cost: 1 }],
  "pipe-vexamples": [{ result: EXAMPLES, cost: 1 }],
  "pipe-vquiz": [{ result: QUIZ, cost: 1 }],
  "pipe-vcards": [{ result: CARDS, cost: 1 }],
  "pipe-vpractice": [{ result: PRACTICE, cost: 1 }],
  "pipe-vfactcheck": [{ result: FACT, cost: 0.5 }],
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
  ledgerPath: string;
  script(over: Record<string, unknown[]>): void;
  calls(scenario?: string): Array<{ scenario: string; index: number; effort: string; prompt: string }>;
  file(name: string): string;
}

function harness(opts: { concurrency?: number } = {}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-variants-"));
  roots.push(dir);
  const pipeDir = path.join(dir, "pipe");
  fs.mkdirSync(pipeDir);
  // The real prompt templates: the fake claude picks its scenario from each one's first line.
  delete process.env.V26_PROMPT_DIR;
  process.env.FAKE_PIPE_DIR = pipeDir;

  let text = "";
  const spans = [1, 2].map((n) => {
    const startOffset = text.length;
    text += `Chapter ${n}. ${AUTHOR}`;
    const endOffset = text.length;
    text += "\n\n";
    return { chapterNumber: n, chapterTitle: `Title ${n}`, startOffset, endOffset };
  });
  fs.writeFileSync(path.join(dir, "source.txt"), text);
  fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify({ sourceTextSha256: createHash("sha256").update(text).digest("hex"), spans }));
  fs.writeFileSync(path.join(dir, "brief.md"), "THE BOOK: a test memoir.\n");
  const runDir = path.join(dir, "run");
  const ledgerPath = path.join(dir, "ledger.jsonl");
  const configPath = path.join(dir, "book.json");
  const role = (model: string) => ({ bin: FAKE, model, effort: "high" });
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      bookId: "demo",
      title: "Demo Book",
      author: "A. Author",
      bookType: "memoir",
      categories: ["Memoir"],
      tags: ["demo"],
      source: { textPath: "source.txt", chapterMapPath: "map.json" },
      briefPath: "brief.md",
      shape: { examples: 3, quizQuestions: 7, choices: 3, reviewCards: 5, memorableLines: 3, ifThenPlans: 2, fastRead: [150, 220], deepRead: [350, 500], fullRead: [800, 1100] },
      writer: role("claude-opus-5-5"),
      checker: role("claude-opus-5-5"),
      solver: role("claude-sonnet-5"),
      concurrency: opts.concurrency ?? 3,
      budgetUsd: 100,
      runDir,
      ledgerPath,
    }),
  );
  const h: Harness = {
    ctx: makeCtx(loadBookConfig(configPath)),
    configPath,
    runDir,
    ledgerPath,
    script: (over) => fs.writeFileSync(path.join(pipeDir, "script.json"), JSON.stringify({ ...GOOD, ...over })),
    calls: (scenario) =>
      fs
        .readdirSync(pipeDir)
        .filter((f) => f.endsWith(".call.json") && (scenario === undefined || f.startsWith(`${scenario}.`)))
        .map((f) => JSON.parse(fs.readFileSync(path.join(pipeDir, f), "utf8"))),
    file: (name) => path.join(runDir, "ch01", "variants", name),
  };
  h.script({});
  return h;
}

// ---------------------------------------------------------------- shape

test("variantsShapeErrors accepts the fixtures and names what is wrong otherwise", () => {
  assert.deepEqual(variantsShapeErrors("summary", SUMMARY), []);
  assert.deepEqual(variantsShapeErrors("examples", EXAMPLES), []);
  assert.deepEqual(variantsShapeErrors("quiz", QUIZ), []);
  assert.deepEqual(variantsShapeErrors("cards", CARDS), []);
  assert.deepEqual(variantsShapeErrors("practice", PRACTICE), []);
  assert.deepEqual(lessonsShapeErrors(LESSONS), []);

  assert.match(variantsShapeErrors("summary", { variants: SUMMARY.variants.slice(0, 4) }).join(";"), /exactly 5 items/);
  const relabelled = { variants: SUMMARY.variants.map((v, i) => (i === 2 ? { ...v, label: "X" } : v)) };
  assert.match(variantsShapeErrors("summary", relabelled).join(";"), /variants\[2\]\.label must be "C"/);
  const twoChoices = { variants: QUIZ.variants.map((v) => ({ ...v, questions: v.questions.map((q) => ({ ...q, choices: q.choices.slice(0, 2) })) })) };
  assert.match(variantsShapeErrors("quiz", twoChoices).join(";"), /choices must be 3 strings/);
  assert.match(variantsShapeErrors("practice", "nope").join(";"), /variants array/);
  assert.match(lessonsShapeErrors({ lessons: LESSONS.lessons.map((l) => ({ ...l, evidence: "x" })) }).join(";"), /evidence must be an array/);
});

test("summaryDetIssues flags a quotation the source does not contain, and a summary far off the length band", () => {
  const ok: SummaryVariant = { ...SUMMARY.variants[0], label: "A" };
  const badQuote: SummaryVariant = { ...SUMMARY.variants[1], label: "B", summary: `${longText("B")} He said "no shilling was ever wasted here."` };
  const short: SummaryVariant = { ...SUMMARY.variants[2], label: "C", summary: 'Short. He wrote "a fault named is half mended."' };
  const issues = summaryDetIssues([ok, badQuote, short], AUTHOR);
  assert.deepEqual(
    issues.map((i) => i.variant),
    ["B", "C"],
  );
  assert.match(issues[0].text, /not in the source word for word/);
  assert.match(issues[1].text, /words/);
});

// ---------------------------------------------------------------- generate

test("generateVariants: one lessons call, five component calls, one fact check; files, ids and spend recorded", async () => {
  const h = harness();
  const run = await generateVariants(h.ctx, 1);

  assert.equal(h.calls().length, 7);
  for (const c of COMPONENTS) assert.ok(fs.existsSync(h.file(`${c}.json`)), `${c}.json written`);
  assert.ok(fs.existsSync(h.file("lessons.json")));
  assert.ok(fs.existsSync(h.file("factcheck.json")));
  assert.ok(fs.existsSync(h.file("run.json")));

  assert.equal(run.lessonIndex, 0);
  assert.equal(run.lesson.lesson, LESSONS.lessons[0].lesson);
  for (const c of COMPONENTS) assert.deepEqual(run[c].map((v) => v.label), ["A", "B", "C", "D", "E"], c);
  assert.equal(run.examples[0].examples[0].exampleId, "ex01");
  assert.equal(run.quiz[0].questions[4].questionId, "q5");
  assert.equal(run.cards[0].cards[2].cardId, "rc3");
  assert.deepEqual(run.factcheck.issues.map((i) => i.variant), ["C"]);
  assert.deepEqual(run.factcheck.det, []);
  assert.equal(run.spend, 6.5);

  // No placeholder survives in any real template, and each component prompt carries the chosen lesson.
  for (const c of h.calls()) {
    assert.doesNotMatch(c.prompt, /@@[A-Z_]+@@/, c.scenario);
    if (c.scenario !== "pipe-vlessons") assert.match(c.prompt, /Lesson number 1/);
  }
  // The summary writer and the fact checker see the source; the modern components do not.
  assert.match(h.calls("pipe-vsummary")[0].prompt, /a fault named is half mended/);
  assert.match(h.calls("pipe-vfactcheck")[0].prompt, /\[C\]\nhook: Hook C/);
  assert.doesNotMatch(h.calls("pipe-vquiz")[0].prompt, /little book/);
  const steps = readLedger(h.ledgerPath).map((r) => r.step).sort();
  assert.deepEqual(steps, ["variants-cards", "variants-examples", "variants-factcheck", "variants-lessons", "variants-practice", "variants-quiz", "variants-summary"]);
});

test("a second run reuses every file; --only quiz redoes the quiz alone and keeps the fact check", async () => {
  const h = harness();
  await generateVariants(h.ctx, 1);
  const again = await generateVariants(h.ctx, 1);
  assert.equal(h.calls().length, 7, "nothing was called again");
  assert.equal(again.quiz.length, 5);

  const only = await generateVariants(h.ctx, 1, { only: ["quiz"], force: true });
  assert.equal(h.calls("pipe-vquiz").length, 2);
  assert.equal(h.calls("pipe-vfactcheck").length, 1, "the summaries did not change, so no new fact check");
  assert.equal(only.summary.length, 5);
});

test("--force on the summary alone re-runs the fact check; --lesson 3 drives every component from candidate 3 and clears the old ones", async () => {
  const h = harness();
  await generateVariants(h.ctx, 1);
  await generateVariants(h.ctx, 1, { only: ["summary"], force: true });
  assert.equal(h.calls("pipe-vfactcheck").length, 2);

  const third = await generateVariants(h.ctx, 1, { lessonIndex: 2 });
  assert.equal(third.lessonIndex, 2);
  assert.equal(third.lesson.lesson, LESSONS.lessons[2].lesson);
  assert.equal(h.calls("pipe-vlessons").length, 1, "the candidates are kept");
  assert.equal(h.calls("pipe-vexamples").length, 2, "every component was written again for the new lesson");
  assert.match(h.calls("pipe-vexamples")[1].prompt, /Lesson number 3/);
  assert.equal(JSON.parse(fs.readFileSync(h.file("run.json"), "utf8")).lessonIndex, 2);
});

test("a wrong shape is asked for once more under a reshape step, then fails with VARIANTS_OUTPUT_INVALID", async () => {
  const h = harness();
  h.script({ "pipe-vcards": [{ result: { variants: CARDS.variants.slice(0, 3) } }, { result: CARDS }] });
  const run = await generateVariants(h.ctx, 1);
  assert.equal(run.cards.length, 5);
  assert.equal(h.calls("pipe-vcards").length, 2);
  assert.ok(readLedger(h.ledgerPath).some((r) => r.step === "variants-cards:reshape"));

  const h2 = harness();
  h2.script({ "pipe-vpractice": [{ result: { variants: [] } }] });
  await assert.rejects(generateVariants(h2.ctx, 1), (e: unknown) => e instanceof CallFailedError && /VARIANTS_OUTPUT_INVALID: ch01 practice/.test((e as Error).message));
  assert.ok(!fs.existsSync(h2.file("practice.json")));
  assert.ok(fs.existsSync(h2.file("summary.json")), "the other components still landed");
});

test("a usage limit stops the run and leaves what was written for a resume", async () => {
  const h = harness({ concurrency: 1 });
  h.script({ "pipe-vquiz": [{ usage: true }] });
  await assert.rejects(generateVariants(h.ctx, 1), /USAGE_LIMIT/);
  assert.ok(fs.existsSync(h.file("summary.json")));
  assert.ok(fs.existsSync(h.file("examples.json")));
  assert.ok(!fs.existsSync(h.file("quiz.json")));
  h.script({});
  const run = await generateVariants(h.ctx, 1);
  assert.equal(run.quiz.length, 5);
  assert.equal(h.calls("pipe-vsummary").length, 1, "resumed, not restarted");
});

// ---------------------------------------------------------------- render

test("the pick page has five cards per component, approach labels, the flag under the flagged summary, and the copy script", async () => {
  const h = harness();
  const run = await generateVariants(h.ctx, 1);
  const html = renderVariantsPage(run, { bookId: "demo", title: "Demo Book", author: "A. Author" });
  for (const c of COMPONENTS) {
    assert.equal(html.match(new RegExp(`class="vcard" data-comp="${c}"`, "g"))?.length, 5, c);
  }
  assert.match(html, /approach B/);
  assert.match(html, /Lesson number 1/);
  assert.match(html, /The other 4 candidate lessons/);
  assert.match(html, /Lesson number 5/);
  assert.match(html, /Fact check · WHY in summary/);
  assert.ok(html.indexOf("Fact check · WHY") > html.indexOf('id="summary-C"'), "the flag sits in C's card");
  assert.ok(html.indexOf("Fact check · WHY") < html.indexOf('id="summary-D"'));
  assert.match(html, /Copy my picks/);
  assert.match(html, /data-comps='\["summary","examples","quiz","cards","practice"\]'/);
  assert.match(html, /data-chapter="ch01"/);
  assert.match(html, /<textarea class="notes" data-comp="general"/);
  assert.doesNotMatch(html, /Not generated yet/);
  assert.match(html, /<meta name="viewport"/);
});

test("the pick page says which components are missing and folds a reference chapter when given", async () => {
  const h = harness();
  const run = await generateVariants(h.ctx, 1, { only: ["summary"] });
  const reference = JSON.parse(fs.readFileSync(fileURLToPath(new URL("./fixtures/reference-chapter.json", import.meta.url)), "utf8"));
  const html = renderVariantsPage(run, { bookId: "demo", title: "Demo Book", author: "A. Author", reference });
  assert.equal(html.match(/Not generated yet/g)?.length, 4);
  assert.match(html, /current tool.s chapter 1, for comparison/);
  assert.match(html, /The Little Book of Faults/);
});

// ---------------------------------------------------------------- cli

test("cli: variants writes the pack and prints its path; its options are refused on other verbs", async () => {
  const h = harness();
  const io = { out: "", err: "" };
  const sink = { out: (s: string) => void (io.out += s), err: (s: string) => void (io.err += s) };
  const code = await main(["variants", "--book", h.configPath, "--chapters", "1"], sink);
  assert.equal(code, 0, io.err);
  assert.match(io.out, /ch01: lesson 1 of 5: Lesson number 1/);
  assert.match(io.out, /summary 5, examples 5, quiz 5, cards 5, practice 5; 1 fact flag on the summaries; spend \$6\.50/);
  assert.match(io.out, /pack\.html/);
  assert.ok(fs.existsSync(h.file("pack.html")));

  const bad = { out: "", err: "" };
  const badSink = { out: (s: string) => void (bad.out += s), err: (s: string) => void (bad.err += s) };
  assert.equal(await main(["render", "--book", h.configPath, "--only", "quiz"], badSink), 1);
  assert.match(bad.err, /--only only goes with the variants command/);
  assert.equal(await main(["variants", "--book", h.configPath, "--only", "poems"], badSink), 1);
  assert.match(bad.err, /unknown component poems/);
  assert.equal(await main(["variants", "--book", h.configPath, "--lesson", "9"], badSink), 1);
  assert.match(bad.err, /--lesson must be 1 to 5/);
});
