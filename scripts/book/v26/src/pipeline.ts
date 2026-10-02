/** The v26 chapter pipeline: write, check, fix, run. All state is files under <runDir>/chNN/, so a run can stop
 *  (usage limit, budget, a crash) and pick up where it left off. Prompts come from prompts/*.md. */
import * as fs from "node:fs";
import * as path from "node:path";
import { BudgetError, CallFailedError, UsageLimitError, callModel, type CallResult } from "./call";
import type { BookConfig } from "./config";
import { readerFields, runChecks, splitLesson } from "./checks";
import { applyFix, type FixEdit, type FixError, type FixOutput } from "./fix";
import { readLedger } from "./ledger";
import {
  allTiersText,
  chapterHeader,
  knownTrapsSection,
  loadPrompt,
  newReaderText,
  questionsBlock,
  readerText,
  renderTemplate,
} from "./prompts";
import { norm, quoteInSource } from "./quotes";
import { fkGrade } from "./readability";
import { loadSource, spanText, writerForm, writerFormText, type BookSource } from "./source";
import type { Chapter, Issue, LessonCard, QuizQuestion, RoleConfig } from "./types";
import { wordsIn } from "./validate";

export interface PipelineCtx {
  config: BookConfig;
  source: BookSource;
  ledgerPath: string;
  /** Empty working directory the model process runs in. */
  cwd: string;
  /** Also run the editor review on every check round and send its failed items to the fix call. */
  review: boolean;
  /** Chapter number -> hints about facts this book has been wrong about before. */
  knownTraps: Record<number, string[]>;
  bookSection: string;
}

export type LessonRating = "SUPPORTED" | "STRETCHED" | "UNSUPPORTED" | "UNKNOWN";

export interface RoundResult {
  round: number;
  lessonRating: LessonRating;
  lessonReason: string;
  /** What keeps a chapter from being clean. */
  blocking: Issue[];
  /** What goes to the fix call (blocking issues that an edit can address, plus the reported ones). */
  fixable: Issue[];
  report: Record<string, unknown>;
}

export interface ChapterStatus {
  chapter: number;
  stage: "clean" | "open-issues" | "failed";
  round: number;
  rerun: boolean;
  lessonRating: LessonRating;
  /** Blocking issues, then the non-blocking ones still unfixed (marked `leftover`). */
  open: Array<Issue & { leftover?: true }>;
  spend: number;
  lesson: string;
  error?: string;
}

export interface EvalResult {
  /** Which chapter this judged, and the chapter file that was read, so a saved result can always be traced. */
  chapter: number;
  file: string;
  lesson: string;
  singleLesson: boolean | null;
  items: Array<{ id: string; pass: boolean; evidence: string }>;
  missingIds: string[];
  aggregates: Record<string, boolean>;
  fractions: Record<string, number | null>;
  passCount: number;
  total: number;
  noChapterScores: number[];
  det: Record<string, unknown>;
}

const TIMEOUT_MS = 900000;
const MAX_FIX_ROUNDS = 2;
const NO_CHAPTER_RUNS = 3;
/** The new-reader solver and the no-chapter solver see q1-q5; only those can block a chapter. */
const FIRST_QUESTIONS = 5;
const TIERS = ["fastRead", "deepRead", "fullRead"] as const;

// ---------------------------------------------------------------- small helpers

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string => (typeof v === "string" ? v : "");

const chapterName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
const chapterDir = (ctx: PipelineCtx, n: number): string => path.join(ctx.config.runDir, chapterName(n));
/** The chapter label in the ledger; the book id keeps books that share one ledger apart. */
const ledgerLabel = (ctx: PipelineCtx, n: number): string => `${ctx.config.bookId}/${chapterName(n)}`;
const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}
function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function issue(source: Issue["source"], blocking: boolean, field: string | undefined, message: string): Issue {
  return field ? { source, blocking, field, text: message } : { source, blocking, text: message };
}

const isLimit = (e: unknown): e is UsageLimitError | BudgetError => e instanceof UsageLimitError || e instanceof BudgetError;

/** The runBook runs in progress, by ctx. The moment any call of a run hits a usage limit or the budget, `stop` is set and
 *  every call of that run that has not started yet (other chapters, a retry, the rest of a check round) is refused.
 *  Calls already running cannot be recalled. The entry exists only while runBook or `guarded` is running, so nothing sticks to the ctx.
 *  A step called outside both has no stop rule. */
const runs = new WeakMap<object, { stop: Error | null }>();

/** Runs one step of a single command (the CLI's write, check, fix and eval) under the same stop rule as runBook:
 *  once a call hits a usage limit or the budget, no call of `fn` that has not started yet is made. */
export async function guarded<T>(ctx: PipelineCtx, fn: () => Promise<T>): Promise<T> {
  if (runs.has(ctx)) return fn();
  runs.set(ctx, { stop: null });
  try {
    return await fn();
  } finally {
    runs.delete(ctx);
  }
}

async function call(
  ctx: PipelineCtx,
  o: { role: RoleConfig; prompt: string; step: string; n: number | string; kind: "write" | "fix" | "other"; outPrefix: string },
): Promise<CallResult> {
  const run = runs.get(ctx);
  if (run?.stop) throw run.stop;
  try {
    return await callModel({
      role: o.role,
      prompt: o.prompt,
      step: o.step,
      chapter: typeof o.n === "number" ? ledgerLabel(ctx, o.n) : o.n,
      kind: o.kind,
      ledgerPath: ctx.ledgerPath,
      budgetUsd: ctx.config.budgetUsd,
      cwd: ctx.cwd,
      timeoutMs: TIMEOUT_MS,
      outPrefix: o.outPrefix,
    });
  } catch (e) {
    if (run && isLimit(e)) run.stop ??= e;
    throw e;
  }
}

/** The call's JSON, asking once more if the answer was not JSON; null if it still is not. */
async function callJson(ctx: PipelineCtx, o: Parameters<typeof call>[1]): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await call(ctx, o);
    if (r.json !== null) return r.json;
  }
  return null;
}

function required<T>(v: T | null, what: string): T {
  if (v === null) throw new CallFailedError(`${what}: the model did not return JSON`);
  return v;
}

/** Waits for every promise so no call is left running behind a failure, then throws: a usage or budget stop first, else the first error. */
async function settle(ps: Promise<unknown>[]): Promise<unknown[]> {
  const rs = await Promise.allSettled(ps);
  const bad = rs.flatMap((r) => (r.status === "rejected" ? [r.reason as unknown] : []));
  const fatal = bad.find(isLimit) ?? bad[0];
  if (fatal !== undefined) throw fatal;
  return rs.map((r) => (r as PromiseFulfilledResult<unknown>).value);
}

/** The lessons of chapters before n that already have a draft in this run, in chapter order. */
function earlierLessons(ctx: PipelineCtx, n: number): string[] {
  const root = ctx.config.runDir;
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .flatMap((name) => {
      const m = /^ch(\d+)$/.exec(name);
      return m && Number(m[1]) < n ? [{ k: Number(m[1]), name }] : [];
    })
    .sort((a, b) => a.k - b.k)
    .flatMap(({ name }) => {
      const card = readJson<LessonCard>(path.join(root, name, "lesson.json"));
      return card ? [card.lesson] : [];
    });
}

// ---------------------------------------------------------------- makeCtx

export function makeCtx(config: BookConfig, opts: { review?: boolean } = {}): PipelineCtx {
  const source = loadSource(config.source.textPath, config.source.chapterMapPath);
  const knownTraps: Record<number, string[]> = {};
  if (config.knownTrapsPath) {
    const entries = obj(readJson(config.knownTrapsPath)).entries;
    if (!Array.isArray(entries)) throw new Error(`KNOWN_TRAPS_INVALID: ${config.knownTrapsPath} needs an entries array`);
    for (const e of entries.map(obj)) {
      const chapters = list(e.assignedChapters);
      if (typeof e.text !== "string" || chapters.some((c) => typeof c !== "number")) {
        throw new Error(`KNOWN_TRAPS_INVALID: ${config.knownTrapsPath}: each entry needs text and assignedChapters (numbers)`);
      }
      for (const c of chapters as number[]) (knownTraps[c] ??= []).push(e.text);
    }
  }
  return {
    config,
    source,
    ledgerPath: config.ledgerPath ?? path.join(config.runDir, "ledger.jsonl"),
    cwd: path.join(config.runDir, "cwd"),
    review: opts.review === true,
    knownTraps,
    bookSection: fs.readFileSync(config.briefPath, "utf8"),
  };
}

// ---------------------------------------------------------------- write

export async function writeChapter(ctx: PipelineCtx, n: number, opts: { rerunNote?: string } = {}): Promise<void> {
  const dir = chapterDir(ctx, n);
  const titles = Object.fromEntries(ctx.source.spans.map((s) => [s.chapterNumber, s.chapterTitle]));
  const prompt = renderTemplate(loadPrompt("write"), {
    BOOK_SECTION: ctx.bookSection,
    HEADER: chapterHeader(n, titles, earlierLessons(ctx, n)),
    SOURCE: writerFormText(spanText(ctx.source, n)),
    RERUN_NOTE: opts.rerunNote ? `NOTE FROM THE CHECKER ON YOUR LAST DRAFT: ${opts.rerunNote}` : "",
  });
  const step = opts.rerunNote ? "write-rerun" : "write";
  // The raw answer is kept by callModel as <step>.result.txt, whether or not it is usable.
  const r = await call(ctx, { role: ctx.config.writer, prompt, step, n, kind: "write", outPrefix: path.join(dir, step) });
  const { chapter, lesson, errors } = splitLesson(r.json);
  if (r.json === null || !chapter || !lesson) {
    const why = r.json === null ? "the answer is not JSON" : errors.join("; ");
    throw new CallFailedError(`WRITER_OUTPUT_INVALID: chapter ${n}: ${why} (raw answer: ${path.join(dir, step)}.result.txt)`);
  }
  // A new draft makes every later file stale; the pre-rerun copies are kept.
  for (const f of fs.readdirSync(dir)) {
    if (/^r\d+\./.test(f) || f === "final.json" || f === "status.json") fs.rmSync(path.join(dir, f));
  }
  writeJson(path.join(dir, "lesson.json"), lesson);
  writeJson(path.join(dir, "r0.chapter.json"), chapter);
}

// ---------------------------------------------------------------- check

/** The code check's shape issues. A draft with any of them is not sent to the models: the prompts read every field,
 *  so a missing or mistyped one would fail halfway through, and the writer has to produce a complete chapter anyway. */
const isShape = (i: Issue): boolean => i.source === "det" && i.text.startsWith("shape:");

function answersOf(json: unknown): Obj[] {
  return list(Array.isArray(json) ? json : obj(json).answers).map(obj);
}

const median = (xs: number[]): number | null => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? ((s[(s.length - 1) >> 1] ?? 0) + (s[s.length >> 1] ?? 0)) / 2 : null;
};

const noChapterPrompt = (c: Chapter): string =>
  renderTemplate(loadPrompt("nochapter"), { QUESTIONS: questionsBlock(c.quiz.questions.slice(0, FIRST_QUESTIONS)) });

/** The no-chapter solver, 3 independent runs on q1-q5: how many it got right each run, and how often each question. */
async function noChapterRuns(
  ctx: PipelineCtx,
  c: Chapter,
  prompt: string,
  n: number | string,
  outPrefix: (k: number) => string,
): Promise<{ scores: number[]; rightCounts: Record<string, number> }> {
  const first = c.quiz.questions.slice(0, FIRST_QUESTIONS);
  const runs = await settle(
    Array.from({ length: NO_CHAPTER_RUNS }, (_, k) =>
      callJson(ctx, { role: ctx.config.solver, prompt, step: "nochapter", n, kind: "other", outPrefix: outPrefix(k) }),
    ),
  );
  const rightCounts = Object.fromEntries(first.map((q) => [q.questionId, 0]));
  const scores: number[] = [];
  for (const one of runs) {
    if (one === null) continue; // a run that did not answer is left out, not counted as all wrong
    const given = answersOf(one);
    let right = 0;
    for (const q of first) {
      if (given.some((a) => String(a.questionId) === q.questionId && a.choice === q.correctIndex)) {
        right++;
        rightCounts[q.questionId]!++;
      }
    }
    scores.push(right);
  }
  return { scores, rightCounts };
}

const RATINGS: readonly string[] = ["SUPPORTED", "STRETCHED", "UNSUPPORTED"];

/** Which chapter field a failed review item points at (none for the whole-chapter items). */
function reviewField(id: string): string | undefined {
  const [head, ...rest] = id.split("-");
  const tail = rest.join("-");
  switch (head) {
    case "OPENER":
      return tail === "hook" ? "hook" : `breakdown.${tail}`;
    case "ARC":
    case "END":
      return `breakdown.${tail}`;
    case "COUNTER":
      return "counterintuition";
    case "TRY":
      return "tryThisNow";
    case "LINES":
      return "memorableLines.0";
    case "EX":
    case "EXFIT":
      return `examples.${tail}`;
    case "QUIZ":
      return `quiz.${tail}`;
    case "CARD":
      return `reviewCards.${tail}`;
    case "PRACTICE":
      return "implementationPlan";
    default:
      return undefined;
  }
}

export async function checkChapter(ctx: PipelineCtx, n: number, round: number): Promise<RoundResult> {
  const dir = chapterDir(ctx, n);
  const chapterFile = path.join(dir, `r${round}.chapter.json`);
  const chapter = readJson<Chapter>(chapterFile);
  if (!chapter) throw new Error(`NO_DRAFT: ${chapterFile} does not exist; write chapter ${n} first`);
  const lesson = readJson<LessonCard>(path.join(dir, "lesson.json"));
  const { config } = ctx;
  const { text: authorText, notes } = writerForm(spanText(ctx.source, n));
  const { bookId, title, author, categories, tags, bookType } = config;

  const checks = await runChecks(chapter, lesson, {
    n,
    book: { bookId, title, author, categories, tags, bookType },
    authorText,
    shape: config.shape,
    earlierLessons: earlierLessons(ctx, n),
  });
  writeJson(path.join(dir, `r${round}.checks.json`), checks);

  const blocking: Issue[] = [...checks.blocking];
  const fixable: Issue[] = [...checks.blocking, ...checks.reported];
  const report: Record<string, unknown> = { advisory: checks.advisory, info: checks.info };
  let lessonRating: LessonRating = "UNKNOWN";
  let lessonReason = "";

  if (checks.blocking.some(isShape)) {
    lessonReason = "model checks skipped because the draft's shape is broken (see the det issues)";
    report.skipped = lessonReason;
  } else {
    const prefix = (name: string): string => path.join(dir, `r${round}.${name}`);
    const qs = chapter.quiz.questions;
    const first = qs.slice(0, FIRST_QUESTIONS);
    const rest = qs.slice(FIRST_QUESTIONS);
    const ids = (xs: QuizQuestion[]): string => xs.map((q) => q.questionId).join(", ");
    const sourceForModel = writerFormText(spanText(ctx.source, n));
    const render = (promptName: string, vars: Record<string, string>): string => renderTemplate(loadPrompt(promptName), vars);
    // Every prompt is built before the first call starts, so a failure here cannot leave a paid call running unawaited.
    const prompts = {
      factcheck: render("factcheck", {
        KNOWN_TRAPS: knownTrapsSection(ctx.knownTraps[n] ?? []),
        LESSON: JSON.stringify(lesson, null, 2),
        SOURCE: sourceForModel,
        CHAPTER: readerText(chapter),
      }),
      keysolve: render("keysolve", {
        P1IDS: ids(first),
        P2IDS: rest.length ? ids(rest) : "(none)",
        NEWREADER: newReaderText(chapter),
        ALLTIERS: allTiersText(chapter),
        P1QUESTIONS: questionsBlock(first),
        P2QUESTIONS: rest.length ? questionsBlock(rest) : "(no questions in this part)",
      }),
      coldreader: render("coldreader", { FASTREAD: chapter.breakdown.fastRead }),
      nochapter: noChapterPrompt(chapter),
      review: ctx.review ? render("review", { CHAPTER: readerText(chapter) }) : "",
    };
    const step = (name: keyof typeof prompts, role: RoleConfig) =>
      callJson(ctx, { role, prompt: prompts[name], step: name, n, kind: "other", outPrefix: prefix(name) });

    const [fact, keysolve, cold, noChapter, review] = (await settle([
      step("factcheck", config.checker).then((j) => required(j, `factcheck of chapter ${n}`)),
      step("keysolve", config.solver).then((j) => required(j, `keysolve of chapter ${n}`)),
      step("coldreader", { ...config.solver, effort: "low" }),
      noChapterRuns(ctx, chapter, prompts.nochapter, n, (k) => prefix(`nochapter-${k}`)),
      ctx.review ? step("review", config.checker) : Promise.resolve(null),
    ])) as [unknown, unknown, unknown, Awaited<ReturnType<typeof noChapterRuns>>, unknown];

    // Fact check: the lesson rating, story/outside-fact flags, and quiz-key disputes.
    const fc = obj(fact);
    const fcLesson = obj(fc.lesson);
    const rated = text(fcLesson.rating).trim().toUpperCase();
    lessonRating = RATINGS.includes(rated) ? (rated as LessonRating) : "UNKNOWN";
    lessonReason = text(fcLesson.reason);
    report.factSentencesChecked = fc.sentencesChecked ?? null;
    const sourceNorm = norm(`${authorText}\n${notes}`);
    const unverifiedFlags: unknown[] = [];
    for (const raw of list(fc.issues)) {
      const i = obj(raw);
      const src = text(i.sourceText).trim();
      const none = src === "" || src.toLowerCase() === "none";
      // A flag that quotes a source passage the source does not contain is the checker's mistake, not the chapter's.
      if (!none && !quoteInSource(src, sourceNorm)) {
        unverifiedFlags.push(i);
        continue;
      }
      const said = `${text(i.kind) || "ISSUE"} ${text(i.verdict)}`.trim();
      const against = none ? "The source says nothing on this." : `Source says: "${src}".`;
      const fix = text(i.fix) ? ` Suggested fix: ${text(i.fix)}` : "";
      const f = issue("fact", true, text(i.field) || undefined, `${said}: chapter says "${text(i.chapterText)}". ${against}${fix}`);
      blocking.push(f);
      fixable.push(f);
    }
    report.unverifiedFlags = unverifiedFlags;
    for (const raw of list(fc.quizIssues)) {
      const i = obj(raw);
      const supported = typeof i.supportedIndex === "number" ? `choice ${i.supportedIndex}` : "no single choice";
      const q = issue("quiz", true, `quiz.${text(i.questionId)}`, `the key is choice ${String(i.keyedIndex)} but the lesson supports ${supported}: ${text(i.problem)}`);
      blocking.push(q);
      fixable.push(q);
    }

    // Blind key solver: q1-q5 block, later questions are only reported. No answer to a q1-q5 question is not a pass.
    const answers = answersOf(keysolve);
    const unanswered: string[] = [];
    qs.forEach((q, i) => {
      const a = answers.find((x) => String(x.questionId) === q.questionId);
      if (!a) {
        unanswered.push(q.questionId);
        if (i < FIRST_QUESTIONS) {
          const k = issue("keysolve", true, `quiz.${q.questionId}`, `the solver gave no answer for ${q.questionId}, so its key is not confirmed`);
          blocking.push(k);
          fixable.push(k);
        }
        return;
      }
      const problems: string[] = [];
      if (a.choice !== q.correctIndex) problems.push(`the solver picked choice ${String(a.choice)} but the key is ${q.correctIndex}`);
      const also = list(a.alsoDefensible).filter((x) => x !== a.choice);
      if (also.length > 0) problems.push(`choice ${also.join(", ")} is also defensible`);
      if (/^\s*NOT IN TEXT/i.test(text(a.reason))) problems.push("the text does not settle the question");
      if (problems.length === 0) return;
      const k = issue("keysolve", i < FIRST_QUESTIONS, `quiz.${q.questionId}`, `${problems.join("; ")}. Solver's reason: ${text(a.reason)}`);
      if (k.blocking) blocking.push(k);
      fixable.push(k);
    });
    if (unanswered.length > 0) report.keysolveUnanswered = unanswered;

    // Cold reader: every unclear item is a fix item on the summary.
    const cr = obj(cold);
    report.coldReaderLesson = text(cr.lesson);
    for (const raw of list(cr.unclear)) {
      const u = obj(raw);
      fixable.push(issue("coldreader", false, "breakdown.fastRead", `a new reader may not follow "${text(u.text)}": ${text(u.why)}`));
    }

    // No-chapter solver: a question it gets right in 2 of 3 runs is guessable.
    report.noChapterScores = noChapter.scores;
    report.noChapterMedian = median(noChapter.scores);
    for (const q of first) {
      if ((noChapter.rightCounts[q.questionId] ?? 0) >= 2) {
        fixable.push(issue("nochapter", false, `quiz.${q.questionId}`, "guessable without the chapter: make the wrong belief a more tempting choice"));
      }
    }

    // Editor review (only with --review).
    if (ctx.review) {
      const rv = obj(review);
      report.reviewLesson = text(rv.lesson);
      report.reviewSingleLesson = rv.singleLesson ?? null;
      for (const raw of list(rv.items)) {
        const it = obj(raw);
        if (it.pass !== true) fixable.push(issue("review", false, reviewField(text(it.id)), `review item ${text(it.id)} failed: ${text(it.evidence)}`));
      }
    }
  }

  // A lesson the source does not clearly support cannot be fixed by an edit; it is blocking and the writer reruns.
  if (lessonRating !== "SUPPORTED") {
    blocking.push(issue("lesson", true, "keyTakeaway", `lesson rated ${lessonRating}${lessonReason ? `: ${lessonReason}` : ""}`));
  }

  const result: RoundResult = { round, lessonRating, lessonReason, blocking, fixable, report };
  writeJson(path.join(dir, `r${round}.result.json`), result);
  return result;
}

// ---------------------------------------------------------------- fix

/** keyTakeaway must keep equalling the lesson card, so only a lesson or fact issue naming it lets an edit change it.
 *  The first memorable line is the lesson in fresh words; any issue that names it lets an edit change it.
 *  This looks at what an edit changed, not at the field it names: a parent path ("memorableLines") or a sub-path
 *  ("keyTakeaway.text") reaches the same text. */
function changesProtected(before: Chapter, after: Chapter, issues: Issue[]): boolean {
  const keyAllowed = issues.some((i) => (i.source === "lesson" || i.source === "fact") && i.field === "keyTakeaway");
  const lineAllowed = issues.some((i) => i.field === "memorableLines.0" || i.field === "memorableLines.0.text");
  return (
    (before.keyTakeaway !== after.keyTakeaway && !keyAllowed) ||
    (before.memorableLines?.[0]?.text !== after.memorableLines?.[0]?.text && !lineAllowed)
  );
}

export async function fixChapter(ctx: PipelineCtx, n: number, round: number, issues: Issue[]): Promise<void> {
  const dir = chapterDir(ctx, n);
  const chapter = readJson<Chapter>(path.join(dir, `r${round}.chapter.json`));
  const lesson = readJson<LessonCard>(path.join(dir, "lesson.json"));
  if (!chapter) throw new Error(`NO_DRAFT: r${round}.chapter.json does not exist for chapter ${n}`);
  const numbered = issues
    .map((i, k) => `${k + 1}. [${i.source.toUpperCase()} ${i.blocking ? "BLOCKING" : "REPORTED"}] ${i.field ?? "(no field)"}: ${i.text}`)
    .join("\n");
  const prompt = renderTemplate(loadPrompt("fix"), {
    ISSUES: numbered,
    CHAPTER: `${readerText(chapter)}\n\n[chapter JSON]\n${JSON.stringify(chapter, null, 2)}`,
    LESSON: JSON.stringify(lesson, null, 2),
    SOURCE: writerFormText(spanText(ctx.source, n)),
  });
  const next = round + 1;
  const dropped: FixEdit[] = [];
  const ask = async (p: string, name: string): Promise<FixOutput> =>
    obj(
      required(
        await callJson(ctx, { role: ctx.config.writer, prompt: p, step: "fix", n, kind: "fix", outPrefix: path.join(dir, `r${next}.${name}`) }),
        `fix of chapter ${n}`,
      ),
    ) as FixOutput;
  /** Applies the edits one at a time, so an edit that changes a protected text is undone on its own and recorded as dropped. */
  const apply = (from: Chapter, out: FixOutput): { chapter: Chapter; applied: number; errors: FixError[] } => {
    let cur = from;
    let count = 0;
    const errors: FixError[] = [];
    for (const edit of Array.isArray(out.edits) ? out.edits : []) {
      const one = applyFix(cur, { edits: [edit] });
      errors.push(...one.errors);
      if (one.errors.length > 0) continue;
      if (changesProtected(cur, one.chapter, issues)) dropped.push(edit);
      else {
        cur = one.chapter;
        count += one.applied;
      }
    }
    const keys = applyFix(cur, { keyChanges: Array.isArray(out.keyChanges) ? out.keyChanges : [] });
    return { chapter: keys.chapter, applied: count + keys.applied, errors: [...errors, ...keys.errors] };
  };

  const first = await ask(prompt, "fix");
  let result = apply(chapter, first);
  const firstErrors = result.errors;
  let applied = result.applied;
  if (firstErrors.length > 0) {
    const retry = `${prompt}\n\nThese edits could not be applied: ${JSON.stringify(firstErrors)}\nReturn corrected edits for them only.`;
    const again = apply(result.chapter, await ask(retry, "fix-retry"));
    result = again;
    applied += again.applied;
  }
  writeJson(path.join(dir, `r${next}.chapter.json`), result.chapter);
  writeJson(path.join(dir, `r${next}.fix-applied.json`), {
    applied,
    firstErrors,
    errors: firstErrors.length > 0 ? result.errors : [],
    dropped,
    declined: first.declined ?? [],
  });
}

// ---------------------------------------------------------------- run

const DUPLICATE = "DUPLICATE_LESSON";
const hasDuplicate = (r: RoundResult): boolean => r.fixable.some((i) => i.text.startsWith(DUPLICATE));
const needsRerun = (r: RoundResult): boolean => r.lessonRating !== "SUPPORTED" || hasDuplicate(r);

function rerunNoteFor(r: RoundResult, oldLesson: string): string {
  const shape = r.blocking.filter(isShape).slice(0, 8);
  if (shape.length > 0) {
    // The models never saw this draft, so its lesson was not judged; the writer's job is to hand in a complete chapter.
    const what = shape.map((i) => i.text.replace(/^shape:\s*/, "")).join("; ");
    return `Your last draft was not a complete chapter (${what}). Write the whole chapter again, with every field present and of the right type.`;
  }
  const why: string[] = [];
  if (r.lessonRating !== "SUPPORTED") why.push(`The lesson was rated ${r.lessonRating}. ${r.lessonReason}`.trim());
  for (const i of r.fixable) if (i.text.startsWith(DUPLICATE)) why.push(i.text);
  return `Your last draft taught "${oldLesson}". ${why.join(" ")} Pick a different lesson that the source clearly supports and no earlier chapter teaches, and write the whole chapter again.`;
}

function ledgerSpend(ctx: PipelineCtx, n: number): number {
  const label = ledgerLabel(ctx, n);
  return round4(readLedger(ctx.ledgerPath).reduce((sum, r) => (r.chapter === label ? sum + (r.cost || 0) : sum), 0));
}

export async function runChapter(ctx: PipelineCtx, n: number, opts: { force?: boolean } = {}): Promise<ChapterStatus> {
  const dir = chapterDir(ctx, n);
  const file = (name: string): string => path.join(dir, name);
  if (opts.force) {
    // Start over, but keep the old run for reference.
    if (fs.existsSync(dir)) fs.renameSync(dir, `${dir}.prev-${Date.now()}`);
  } else {
    const done = readJson<ChapterStatus>(file("status.json"));
    if (done && (done.stage === "clean" || done.stage === "open-issues")) return done;
  }

  // Each step below is skipped when its file is already there, so a stopped run resumes where it stopped.
  let rerun = fs.existsSync(file("r0-pre-rerun.chapter.json"));
  if (!fs.existsSync(file("r0.chapter.json"))) {
    const before = readJson<RoundResult>(file("r0-pre-rerun.result.json"));
    const oldLesson = readJson<LessonCard>(file("r0-pre-rerun.lesson.json"))?.lesson ?? "";
    await writeChapter(ctx, n, rerun && before ? { rerunNote: rerunNoteFor(before, oldLesson) } : {});
  }
  const checked = async (round: number): Promise<RoundResult> =>
    readJson<RoundResult>(file(`r${round}.result.json`)) ?? checkChapter(ctx, n, round);

  let round = 0;
  let result = await checked(0);
  if (!rerun && needsRerun(result)) {
    // A wrong lesson cannot be repaired by edits, so the writer starts again, once.
    rerun = true;
    const oldLesson = readJson<LessonCard>(file("lesson.json"))?.lesson ?? "";
    for (const f of fs.readdirSync(dir)) if (f.startsWith("r0.")) fs.renameSync(file(f), file(`r0-pre-rerun.${f.slice(3)}`));
    fs.copyFileSync(file("lesson.json"), file("r0-pre-rerun.lesson.json"));
    await writeChapter(ctx, n, { rerunNote: rerunNoteFor(result, oldLesson) });
    result = await checked(0);
  }

  // A lesson issue cannot be fixed by editing, so it alone never starts a fix call.
  // On the last fix round with a blocking issue present, send only the blocking ones: late reported-only edits
  // (e.g. quiz rewrites for guessability) were creating new blocking issues that no round was left to fix.
  const toFix = (r: RoundResult, last = false): Issue[] => {
    const all = r.fixable.filter((i) => i.source !== "lesson");
    const blocking = all.filter((i) => i.blocking);
    return last && blocking.length > 0 ? blocking : all;
  };
  while (toFix(result).length > 0 && round < MAX_FIX_ROUNDS) {
    if (!fs.existsSync(file(`r${round + 1}.chapter.json`))) await fixChapter(ctx, n, round, toFix(result, round === MAX_FIX_ROUNDS - 1));
    round++;
    result = await checked(round);
  }

  const chapter = readJson<Chapter>(file(`r${round}.chapter.json`));
  writeJson(file("final.json"), chapter);
  const status: ChapterStatus = {
    chapter: n,
    stage: result.blocking.length > 0 ? "open-issues" : "clean",
    round,
    rerun,
    lessonRating: result.lessonRating,
    open: [...result.blocking, ...result.fixable.filter((i) => !i.blocking).map((i) => ({ ...i, leftover: true as const }))],
    spend: ledgerSpend(ctx, n),
    lesson: readJson<LessonCard>(file("lesson.json"))?.lesson ?? "",
  };
  writeJson(file("status.json"), status);
  return status;
}

export async function runBook(ctx: PipelineCtx, chapters: number[], opts: { force?: boolean } = {}): Promise<ChapterStatus[]> {
  const out: ChapterStatus[] = new Array(chapters.length);
  const run: { stop: Error | null } = { stop: null };
  runs.set(ctx, run);
  let next = 0;
  let fatal: Error | null = null;
  const worker = async (): Promise<void> => {
    while (!fatal && !run.stop && next < chapters.length) {
      const i = next++;
      const n = chapters[i]!;
      try {
        out[i] = await runChapter(ctx, n, opts);
      } catch (e) {
        if (isLimit(e)) {
          fatal ??= e;
        } else {
          const error = e instanceof Error ? e.message : String(e);
          out[i] = { chapter: n, stage: "failed", round: 0, rerun: false, lessonRating: "UNKNOWN", open: [issue("det", true, undefined, `RUN_FAILED: ${error}`)], spend: ledgerSpend(ctx, n), lesson: "", error };
        }
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(ctx.config.concurrency, chapters.length) }, worker));
  } finally {
    runs.delete(ctx);
  }
  const stop = fatal ?? run.stop;
  if (stop) throw stop;
  return out;
}

export function statusRows(ctx: PipelineCtx): Array<{ chapter: number; stage: string; open: number; spend: number; lesson: string }> {
  const spent = new Map<string, number>();
  for (const r of readLedger(ctx.ledgerPath)) spent.set(r.chapter, (spent.get(r.chapter) ?? 0) + (r.cost || 0));
  return ctx.source.spans
    .map((s) => s.chapterNumber)
    .sort((a, b) => a - b)
    .map((n) => {
      const dir = chapterDir(ctx, n);
      const status = readJson<ChapterStatus>(path.join(dir, "status.json"));
      const stage = status?.stage ?? (fs.existsSync(path.join(dir, "r0.chapter.json")) ? "in-progress" : "not-started");
      return {
        chapter: n,
        stage,
        open: status?.open.length ?? 0,
        spend: round4(spent.get(ledgerLabel(ctx, n)) ?? 0),
        lesson: readJson<LessonCard>(path.join(dir, "lesson.json"))?.lesson ?? "",
      };
    });
}

// ---------------------------------------------------------------- eval

function expectedIds(c: Chapter): string[] {
  const ids = ["OPENER-hook", "PLAIN-summary", "PLAIN-rest", "COUNTER", "TRY", "LINES-1", "PRACTICE", "SPINE"];
  for (const t of TIERS) ids.push(`OPENER-${t}`, `ARC-${t}`, `END-${t}`);
  for (const e of c.examples ?? []) ids.push(`EX-${e.exampleId}`);
  for (const e of c.examples ?? []) ids.push(`EXFIT-${e.exampleId}`);
  for (const q of c.quiz?.questions ?? []) ids.push(`QUIZ-${q.questionId}`);
  for (const r of c.reviewCards ?? []) ids.push(`CARD-${r.cardId}`);
  return ids;
}

const words4 = (t: string): string[] => t.toLowerCase().replace(/’/g, "'").match(/[a-z0-9']+/g) ?? [];
const grams4 = (ws: string[]): Set<string> => new Set(ws.slice(0, Math.max(0, ws.length - 3)).map((_, i) => ws.slice(i, i + 4).join(" ")));

/** The code-only quality numbers an eval reports next to the judge's (no model call). */
function detMetrics(c: Chapter): Record<string, unknown> {
  const fk = Object.fromEntries(TIERS.map((t) => [t, fkGrade(c.breakdown[t])]));
  const rest = [
    c.tryThisNow,
    ...c.examples.flatMap((e) => [e.scenario, e.whatToDo, e.whyItMatters]),
    ...c.quiz.questions.flatMap((q) => [q.prompt, ...q.choices]),
    ...c.reviewCards.flatMap((r) => [r.front, r.back]),
  ].join(" ");
  const key = grams4(words4(c.keyTakeaway));
  const repeatFields = Object.entries(readerFields(c)).flatMap(([id, t]) => {
    if (id === "keyTakeaway" || key.size === 0) return [];
    const have = grams4(words4(t));
    const share = [...key].filter((g) => have.has(g)).length / key.size;
    return share >= 0.5 ? [{ field: id, share: Math.round(share * 100) / 100 }] : [];
  });
  return {
    fk,
    fkRest: fkGrade(rest),
    tierWords: Object.fromEntries(TIERS.map((t) => [t, wordsIn(c.breakdown[t])])),
    keyTakeawayWords: wordsIn(c.keyTakeaway),
    exampleWords: c.examples.map((e) => wordsIn(e.scenario)),
    repeatFields,
  };
}

export async function evalChapter(ctx: PipelineCtx, chapterPath: string, n: number, tag: string, outDir: string): Promise<EvalResult> {
  const { _lesson, ...c } = obj(readJson(chapterPath));
  void _lesson;
  const chapter = c as unknown as Chapter;
  const label = `${ledgerLabel(ctx, n)}/eval:${tag}`;
  const judgePrefix = path.join(outDir, `${tag}.judge`);
  const expected = expectedIds(chapter);
  const missingFrom = (j: unknown): string[] => {
    const got = new Set(list(obj(j).items).map((x) => text(obj(x).id)));
    return expected.filter((id) => !got.has(id));
  };

  // Both prompts are built before the first call starts.
  const judgePrompt = renderTemplate(loadPrompt("review"), { CHAPTER: readerText(chapter) });
  const guessPrompt = noChapterPrompt(chapter);
  const ask = (step: string): Promise<unknown | null> =>
    callJson(ctx, {
      role: { ...ctx.config.checker, effort: "high" },
      prompt: judgePrompt,
      step,
      n: label,
      kind: "other",
      outPrefix: judgePrefix,
    });
  const [judged, noChapter] = (await settle([
    (async () => {
      let j = await ask("eval:judge");
      if (missingFrom(j).length > 0) {
        // One more try, keeping the incomplete answer for reference.
        if (fs.existsSync(`${judgePrefix}.json`)) fs.renameSync(`${judgePrefix}.json`, `${judgePrefix}.incomplete.json`);
        j = await ask("eval:judge-retry");
      }
      return j;
    })(),
    noChapterRuns(ctx, chapter, guessPrompt, label, (k) => path.join(outDir, `${tag}.nochapter-${k}`)),
  ])) as [unknown, Awaited<ReturnType<typeof noChapterRuns>>];

  const judge = obj(judged);
  const items = list(judge.items).map((raw) => {
    const x = obj(raw);
    return { id: text(x.id), pass: x.pass === true, evidence: text(x.evidence) };
  });
  const fraction = (prefix: string): number | null => {
    const group = items.filter((i) => i.id.startsWith(prefix));
    return group.length ? group.filter((i) => i.pass).length / group.length : null;
  };
  const fractions = { "AGG-EX": fraction("EX-"), "AGG-EXFIT": fraction("EXFIT-"), "AGG-QUIZ": fraction("QUIZ-"), "AGG-CARDS": fraction("CARD-") };
  const need = { "AGG-EX": 2 / 3, "AGG-EXFIT": 2 / 3, "AGG-QUIZ": 0.8, "AGG-CARDS": 0.8 };
  const aggregates = Object.fromEntries(
    (Object.keys(need) as Array<keyof typeof need>).map((k) => [k, fractions[k] !== null && fractions[k]! >= need[k] - 1e-9]),
  );
  const result: EvalResult = {
    chapter: n,
    file: path.resolve(chapterPath),
    lesson: text(judge.lesson),
    singleLesson: typeof judge.singleLesson === "boolean" ? judge.singleLesson : null,
    items,
    missingIds: missingFrom(judged),
    aggregates,
    fractions,
    passCount: items.filter((i) => i.pass).length,
    total: items.length,
    noChapterScores: noChapter.scores,
    det: detMetrics(chapter),
  };
  writeJson(path.join(outDir, `${tag}.eval.json`), result);
  return result;
}
