import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main } from "../cli";
import { loadBookConfig } from "../src/config";
import { makeCtx, type PipelineCtx } from "../src/pipeline";
import { assembleChapter, parsePicks } from "../src/assemble";
import { generateVariants } from "../src/variants";

// ---------------------------------------------------------------- fixtures (same shapes as variants.test.ts)

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const AUTHOR = 'My father used to say that "a fault named is half mended." I kept a little book and was happier for the trying.';
const LESSON = "Name the fault in writing before you try to mend it.";

const lesson = (k: number) => ({
  lesson: k === 1 ? LESSON : `Lesson number ${k}: a different point.`,
  wrongBelief: "You must feel bad about a fault to fix it.",
  keyPhrase: `name the fault ${k}`,
  hookQuestion: "Why does writing a fault down help?",
  storyNames: ["Franklin"],
  evidence: ["he kept a little book"],
  whyThisOne: "why",
});
const five = <T>(make: (label: string, i: number) => T): { variants: T[] } => ({ variants: ["A", "B", "C", "D", "E"].map(make) });
const para = (label: string, k: number): string => Array.from({ length: 70 }, (_, w) => `w${label}${k}${w}`).join(" ");
const SUMMARY = five((label) => ({
  label,
  approach: `approach ${label}`,
  hook: `Hook ${label}: the obvious move backfires.`,
  counterintuition: `Many people think X. Actually Y (${label}).`,
  summary: `${para(label, 1)}\n\n${para(label, 2)}\n\n${para(label, 3)}\n\n${para(label, 4)}`,
  tryThisNow: `Write one fault down tonight (${label}).`,
  memorableLine: `Name it, then mend it (${label}).`,
}));
const EXAMPLES = five((label) => ({
  label,
  approach: `examples ${label}`,
  examples: ["work", "school", "personal"].map((tag, i) => ({ title: `Example ${label}${i}`, tags: [tag], scenario: `Someone at ${tag} faces a choice (${label}).`, whatToDo: "Write the fault down.", whyItMatters: "A named fault can be mended." })),
}));
const question = (label: string, i: number, key: number) => ({
  prompt: `Question ${label}${i}: what do you do?`,
  choices: ["Scold yourself", "Write it down", "Ignore it"],
  correctIndex: key,
  explanation: "Naming the fault starts the mending.",
  bloomsLevel: "apply",
});
const QUIZ = five((label) => ({ label, approach: `quiz ${label}`, questions: [0, 1, 2, 0, 1].map((key, i) => question(label, i, key)) }));
const CARDS = five((label) => ({ label, approach: `cards ${label}`, cards: [1, 2, 3, 4, 5].map((i) => ({ front: `Front ${label}${i}`, back: `Back ${label}${i}`, difficulty: "easy" })) }));
const PRACTICE = five((label) => ({
  label,
  approach: `practice ${label}`,
  coreSkill: `Naming faults (${label})`,
  ifThenPlans: [{ context: "When I slip", plan: "then I write it down" }, { context: "When I want to scold myself", plan: "then I name the fault and stop" }],
  twentyFourHourChallenge: "Write three faults tonight.",
  weeklyPractice: "Read the list on Sunday.",
}));
const FACT = { sentencesChecked: 40, issues: [{ variant: "A", kind: "WHY", field: "summary", chapterText: "wA10", verdict: "UNSUPPORTED", sourceText: "none", fix: "cut the motive" }] };

/** What the assembler returns: the picks copied in, the quiz extended to 7, three lengths of summary A. */
function assembled(over: Record<string, unknown> = {}) {
  const s = SUMMARY.variants[0];
  const tier = (k: number): string => Array.from({ length: k }, (_, i) => para("A", i + 1)).join("\n\n");
  return {
    title: "The Little Book of Faults",
    hook: s.hook,
    counterintuition: s.counterintuition,
    keyTakeaway: LESSON,
    tryThisNow: s.tryThisNow,
    memorableLines: [{ text: s.memorableLine }],
    breakdown: { fastRead: tier(2), deepRead: tier(4), fullRead: tier(8) },
    examples: EXAMPLES.variants[0].examples.map((e, i) => ({ exampleId: `ex0${i + 1}`, ...e })),
    quiz: { passingScorePercent: 70, questions: [...QUIZ.variants[4].questions, question("E", 5, 2), question("E", 6, 0)].map((q, i) => ({ questionId: `q${i + 1}`, ...q })) },
    reviewCards: CARDS.variants[4].cards.map((c, i) => ({ cardId: `rc${i + 1}`, ...c })),
    implementationPlan: { coreSkill: PRACTICE.variants[1].coreSkill, ifThenPlans: PRACTICE.variants[1].ifThenPlans, twentyFourHourChallenge: PRACTICE.variants[1].twentyFourHourChallenge, weeklyPractice: PRACTICE.variants[1].weeklyPractice },
    ...over,
  };
}

const GOOD: Record<string, unknown[]> = {
  "pipe-vlessons": [{ result: { lessons: [1, 2, 3, 4, 5].map(lesson) }, cost: 1 }],
  "pipe-vsummary": [{ result: SUMMARY, cost: 1 }],
  "pipe-vexamples": [{ result: EXAMPLES, cost: 1 }],
  "pipe-vquiz": [{ result: QUIZ, cost: 1 }],
  "pipe-vcards": [{ result: CARDS, cost: 1 }],
  "pipe-vpractice": [{ result: PRACTICE, cost: 1 }],
  "pipe-vfactcheck": [{ result: FACT, cost: 0.5 }, { result: { sentencesChecked: 30, issues: [] }, cost: 0.5 }],
  "pipe-vassemble": [{ result: assembled(), cost: 2 }],
};

const PICKS_TEXT = `PICKS demo ch01
summary: A
examples: A
quiz: E
cards: E
practice: B
notes summary: Summary A: / Excellent / Summary B: / fine
notes general: keep it short
`;

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
  picksFile: string;
  script(over: Record<string, unknown[]>): void;
  calls(scenario?: string): Array<{ scenario: string; index: number; effort: string; prompt: string }>;
}

function harness(opts: { knowledge?: boolean } = {}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v26-assemble-"));
  roots.push(dir);
  const pipeDir = path.join(dir, "pipe");
  fs.mkdirSync(pipeDir);
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
  const configPath = path.join(dir, "book.json");
  const role = (model: string) => ({ bin: FAKE, model, effort: "high" });
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      bookId: "demo", title: "Demo Book", author: "A. Author", bookType: "memoir", categories: ["Memoir"], tags: ["demo"],
      ...(opts.knowledge ? { chapters: [{ number: 1, title: "Title 1" }, { number: 2, title: "Title 2" }] } : { source: { textPath: "source.txt", chapterMapPath: "map.json" } }),
      briefPath: "brief.md",
      shape: { examples: 3, quizQuestions: 7, choices: 3, reviewCards: 5, memorableLines: 1, ifThenPlans: 2, fastRead: [100, 220], deepRead: [250, 500], fullRead: [500, 1100] },
      writer: role("claude-opus-5-5"), checker: role("claude-opus-5-5"), solver: role("claude-sonnet-5"),
      concurrency: 3, budgetUsd: 100, runDir, ledgerPath: path.join(dir, "ledger.jsonl"),
    }),
  );
  const picksFile = path.join(dir, "picks.txt");
  fs.writeFileSync(picksFile, PICKS_TEXT);
  const h: Harness = {
    ctx: makeCtx(loadBookConfig(configPath)),
    configPath,
    runDir,
    picksFile,
    script: (over) => fs.writeFileSync(path.join(pipeDir, "script.json"), JSON.stringify({ ...GOOD, ...over })),
    calls: (scenario) =>
      fs.readdirSync(pipeDir).filter((f) => f.endsWith(".call.json") && (scenario === undefined || f.startsWith(`${scenario}.`))).map((f) => JSON.parse(fs.readFileSync(path.join(pipeDir, f), "utf8"))),
  };
  h.script({});
  return h;
}

// ---------------------------------------------------------------- parsePicks

test("parsePicks reads the Copy-my-picks text, lower or upper case, and JSON; refuses a missing or unknown pick", () => {
  const p = parsePicks(PICKS_TEXT);
  assert.deepEqual(p.picks, { summary: "A", examples: "A", quiz: "E", cards: "E", practice: "B" });
  assert.equal(p.notes.summary, "Summary A: / Excellent / Summary B: / fine");
  assert.equal(p.notes.general, "keep it short");
  assert.deepEqual(parsePicks("summary: c\nexamples: d\nquiz: a\ncards: b\npractice: e").picks, { summary: "C", examples: "D", quiz: "A", cards: "B", practice: "E" });
  assert.deepEqual(parsePicks(JSON.stringify({ picks: { summary: "A", examples: "B", quiz: "C", cards: "D", practice: "E" }, notes: { quiz: "ok" } })).notes, { quiz: "ok" });
  assert.throws(() => parsePicks("summary: A\nexamples: A\nquiz: E\ncards: E"), /PICKS_INVALID: practice needs one of A, B, C, D, E/);
  assert.throws(() => parsePicks("summary: A\nexamples: A\nquiz: E\ncards: -\npractice: B"), /PICKS_INVALID: cards/);
});

// ---------------------------------------------------------------- assembleChapter

test("assemble: the prompt carries the picked parts, the fix and the quiz extension; files land where status and render find them", async () => {
  const h = harness();
  await generateVariants(h.ctx, 1);
  const r = await assembleChapter(h.ctx, 1, parsePicks(PICKS_TEXT));

  const prompt = h.calls("pipe-vassemble")[0].prompt;
  assert.doesNotMatch(prompt, /@@[A-Z_]+@@/);
  assert.match(prompt, /SUMMARY \(version A, approach A\)/);
  assert.match(prompt, /Hook A: the obvious move backfires/);
  assert.doesNotMatch(prompt, /Hook B:/);
  assert.match(prompt, /EXAMPLES \(version A, examples A\)/);
  assert.match(prompt, /QUIZ \(version E, quiz E\)/);
  assert.match(prompt, /\[q1\] prompt: Question E0/);
  assert.match(prompt, /REVIEW CARDS \(version E, cards E\)/);
  assert.match(prompt, /PRACTICE PLAN \(version B, practice B\)/);
  assert.match(prompt, /the picked 5 questions unchanged .* then 2 more in the same form and approach \("quiz E"\)/);
  assert.match(prompt, /WHY in summary \(UNSUPPORTED\): "wA10"/);
  assert.match(prompt, /OWNER NOTES\nsummary: Summary A: \/ Excellent/);
  assert.match(prompt, /general: keep it short/);
  assert.match(prompt, /<source>\nChapter 1\. /);
  assert.match(prompt, /plus up to 2 more objects with the author's exact words/);
  assert.match(prompt, /"examples": \[\{"exampleId": "ex01", "title": "\.\.\.", "tags": \["work"\]/);
  assert.match(prompt, /\[q1\] prompt: Question E0/);
  assert.match(prompt, /ifThenPlans\[0\]\.context: When I slip\nifThenPlans\[0\]\.plan: then I write it down/);

  // The fact check of the three lengths went out with tier labels.
  const fact = h.calls("pipe-vfactcheck");
  assert.equal(fact.length, 2);
  assert.match(fact[1].prompt, /\[fastRead\]\n/);
  assert.match(fact[1].prompt, /\[fullRead\]\n/);

  assert.equal(r.status.stage, "clean", JSON.stringify(r.status.open));
  assert.deepEqual(r.status.picks, { summary: "A", examples: "A", quiz: "E", cards: "E", practice: "B" });
  assert.equal(r.chapter.quiz.questions.length, 7);
  for (const f of Object.values(r.files)) assert.ok(fs.existsSync(f), f);
  assert.ok(fs.existsSync(path.join(h.runDir, "ch01", "lesson.json")));
  assert.ok(fs.existsSync(path.join(h.runDir, "ch01", "variants", "picks.json")));
  const exemplar = JSON.parse(fs.readFileSync(r.files.exemplar, "utf8"));
  assert.equal(exemplar.picks.summary.approach, "approach A");
  assert.equal(exemplar.chosen.quiz.label, "E");
  assert.deepEqual(exemplar.rejected.summary.map((v: { label: string }) => v.label), ["B", "C", "D", "E"]);
  assert.equal(exemplar.rejected.summary[0].hook, "Hook B: the obvious move backfires.");
  assert.equal(exemplar.notes.general, "keep it short");
  assert.deepEqual(exemplar.approved, { summary: ["A"] });
  assert.deepEqual(exemplar.bookNames, ["Franklin"]);
  const html = fs.readFileSync(r.files.reading, "utf8");
  assert.match(html, /The Little Book of Faults/);
  assert.doesNotMatch(html, /open-issues/);
});

test("assemble: a fact flag on a length, or a quotation in knowledge mode, leaves the chapter with open issues", async () => {
  const h = harness();
  await generateVariants(h.ctx, 1);
  h.script({ "pipe-vfactcheck": [{ result: FACT }, { result: { sentencesChecked: 3, issues: [{ variant: "fullRead", kind: "WHO", field: "summary", chapterText: "wA80", verdict: "CONTRADICTED", sourceText: "none", fix: "name the father" }] } }] });
  const r = await assembleChapter(h.ctx, 1, parsePicks(PICKS_TEXT));
  assert.equal(r.status.stage, "open-issues");
  assert.deepEqual(r.status.open.filter((i) => i.blocking).map((i) => [i.source, i.field]), [["fact", "breakdown.fullRead"]]);
  assert.match(fs.readFileSync(r.files.reading, "utf8"), /open-issues: 1 open/);

  const k = harness({ knowledge: true });
  await generateVariants(k.ctx, 1);
  k.script({ "pipe-vassemble": [{ result: assembled({ hook: 'He said "no shilling was ever wasted here" and moved on.' }) }] });
  const rk = await assembleChapter(k.ctx, 1, parsePicks(PICKS_TEXT));
  const prompt = k.calls("pipe-vassemble")[0].prompt;
  assert.match(prompt, /THERE IS NO SOURCE TEXT/);
  assert.match(prompt, /and nothing else: with no source text there are no quotations/);
  assert.doesNotMatch(prompt, /<source>/);
  assert.equal(rk.status.stage, "open-issues");
  assert.ok(rk.status.open.some((i) => i.blocking && i.field === "hook" && /quotation not found/.test(i.text)));
});

test("assemble: an answer with the wrong field names is asked for once more; a second wrong answer fails", async () => {
  const h = harness();
  await generateVariants(h.ctx, 1);
  const wrong = assembled();
  (wrong as Record<string, unknown>).quiz = { passingScorePercent: 70, questions: wrong.quiz.questions.map(({ prompt, ...q }) => ({ ...q, question: prompt })) };
  (wrong as Record<string, unknown>).examples = wrong.examples.map(({ tags, ...e }) => ({ ...e, category: tags[0] }));
  h.script({ "pipe-vassemble": [{ result: wrong }, { result: assembled() }] });
  const r = await assembleChapter(h.ctx, 1, parsePicks(PICKS_TEXT));
  assert.equal(h.calls("pipe-vassemble").length, 2);
  assert.equal(r.status.stage, "clean");

  const h2 = harness();
  await generateVariants(h2.ctx, 1);
  h2.script({ "pipe-vassemble": [{ result: wrong }] });
  await assert.rejects(assembleChapter(h2.ctx, 1, parsePicks(PICKS_TEXT)), /VARIANTS_OUTPUT_INVALID: ch01 assemble: .*quiz\.questions\[0\]\.prompt must be a non-empty string/);
});

test("assemble refuses without a variants page, and a pick with no such version", async () => {
  const h = harness();
  await assert.rejects(assembleChapter(h.ctx, 1, parsePicks(PICKS_TEXT)), /NO_VARIANTS: ch01 has no variants page yet/);
  await generateVariants(h.ctx, 1, { only: ["summary"] });
  await assert.rejects(assembleChapter(h.ctx, 1, parsePicks(PICKS_TEXT)), /NO_VARIANTS: ch01 has no examples versions/);
});

// ---------------------------------------------------------------- cli

test("cli: assemble prints the picks, the verdict and the files; status and render then see the chapter", async () => {
  const h = harness();
  await generateVariants(h.ctx, 1);
  const io = { out: "", err: "" };
  const sink = { out: (s: string) => void (io.out += s), err: (s: string) => void (io.err += s) };
  assert.equal(await main(["assemble", "--book", h.configPath, "--chapters", "1", "--picks", h.picksFile], sink), 0, io.err);
  assert.match(io.out, /ch01: assembled from summary A, examples A, quiz E, cards E, practice B/);
  assert.match(io.out, /ch01: clean; 0 blocking, 0 reported/);
  assert.match(io.out, /exemplars\/ch01\.json/);

  const st = { out: "", err: "" };
  assert.equal(await main(["status", "--book", h.configPath], { out: (s) => void (st.out += s), err: (s) => void (st.err += s) }), 0);
  assert.match(st.out, /1  clean/);
  assert.match(st.out, /Name the fault in writing/);
  const rd = { out: "", err: "" };
  assert.equal(await main(["render", "--book", h.configPath, "--chapters", "1"], { out: (s) => void (rd.out += s), err: (s) => void (rd.err += s) }), 0);
  assert.match(rd.out, /reading\/ch01\.html/);

  const bad = { out: "", err: "" };
  const badSink = { out: (s: string) => void (bad.out += s), err: (s: string) => void (bad.err += s) };
  assert.equal(await main(["assemble", "--book", h.configPath, "--chapters", "1"], badSink), 1);
  assert.match(bad.err, /assemble needs --picks/);
  assert.equal(await main(["variants", "--book", h.configPath, "--picks", h.picksFile], badSink), 1);
  assert.match(bad.err, /--picks only goes with the assemble command/);
  fs.writeFileSync(h.picksFile, "summary: A\n");
  assert.equal(await main(["assemble", "--book", h.configPath, "--chapters", "1", "--picks", h.picksFile], badSink), 1);
  assert.match(bad.err, /PICKS_INVALID: examples/);
});
