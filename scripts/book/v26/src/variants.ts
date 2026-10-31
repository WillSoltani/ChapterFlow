/** Variants: five versions of each chapter component, for the owner to pick from. One lessons call picks the chapter's
 *  lesson (five candidates, best first), then one call per component writes five labelled variants (in parallel under the
 *  config's concurrency), then one call fact-checks the five summaries against the source. Files go under
 *  <runDir>/chNN/variants/; a run picks up what exists, so a stopped run resumes and `--only` redoes one component. */
import * as fs from "node:fs";
import * as path from "node:path";
import { CallFailedError } from "./call";
import { readLedger } from "./ledger";
import { call, type PipelineCtx } from "./pipeline";
import { chapterHeader, knownTrapsSection, loadPrompt, renderTemplate } from "./prompts";
import { findQuotes, norm, quoteInSource } from "./quotes";
import { spanText, writerForm, writerFormText } from "./source";
import type { Example, IfThenPlan, LessonCard, QuizQuestion, ReviewCard, RoleConfig } from "./types";
import { wordsIn } from "./validate";
import { approachesText } from "./approaches";

export const COMPONENTS = ["summary", "examples", "quiz", "cards", "practice"] as const;
export type Component = (typeof COMPONENTS)[number];
export const LABELS = ["A", "B", "C", "D", "E"] as const;
export const VARIANT_COUNT = LABELS.length;
export const LESSON_COUNT = 5;

export interface LessonCandidate extends LessonCard {
  whyThisOne: string;
}
export interface VariantBase {
  label: string;
  approach: string;
}
export interface SummaryVariant extends VariantBase {
  hook: string;
  counterintuition: string;
  summary: string;
  tryThisNow: string;
  memorableLine: string;
}
export interface ExamplesVariant extends VariantBase {
  examples: Example[];
}
export interface QuizVariant extends VariantBase {
  questions: QuizQuestion[];
}
export interface CardsVariant extends VariantBase {
  cards: ReviewCard[];
}
export interface PracticeVariant extends VariantBase {
  coreSkill: string;
  ifThenPlans: IfThenPlan[];
  twentyFourHourChallenge: string;
  weeklyPractice: string;
}
export interface FactIssue {
  variant: string;
  kind: string;
  field: string;
  chapterText: string;
  verdict: string;
  sourceText: string;
  fix: string;
}
/** A 0-call finding on one summary variant. */
export interface DetIssue {
  variant: string;
  text: string;
}
export interface VariantsRun {
  chapter: number;
  chapterTitle: string;
  lessonIndex: number;
  lesson: LessonCandidate;
  lessons: LessonCandidate[];
  summary: SummaryVariant[];
  examples: ExamplesVariant[];
  quiz: QuizVariant[];
  cards: CardsVariant[];
  practice: PracticeVariant[];
  factcheck: { issues: FactIssue[]; det: DetIssue[] };
  /** Ledger spend on this chapter's variants steps, API-equivalent dollars. */
  spend: number;
}
export interface VariantsOptions {
  /** Components to (re)generate; default all. */
  only?: Component[];
  /** Redo even what exists (within `only` when given). */
  force?: boolean;
  /** Which candidate lesson drives the components, 0-based; default 0 (the writer's best). */
  lessonIndex?: number;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);
const chapterName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

export function variantsDir(ctx: PipelineCtx, n: number): string {
  return path.join(ctx.config.runDir, chapterName(n), "variants");
}

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}
function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// ---------------------------------------------------------------- shape

function textFields(o: Obj, keys: readonly string[], where: string, errors: string[]): void {
  for (const k of keys) if (!isText(o[k])) errors.push(`${where}.${k} must be a non-empty string`);
}

function listOf(o: Obj, key: string, count: number, where: string, errors: string[]): Obj[] {
  const v = o[key];
  if (!Array.isArray(v) || v.length !== count || !v.every(isObj)) {
    errors.push(`${where}.${key} must be an array of exactly ${count} objects`);
    return [];
  }
  return v as Obj[];
}

function componentShape(component: Component, v: Obj, where: string, errors: string[]): void {
  switch (component) {
    case "summary":
      textFields(v, ["hook", "counterintuition", "summary", "tryThisNow", "memorableLine"], where, errors);
      return;
    case "examples":
      for (const [i, e] of listOf(v, "examples", 3, where, errors).entries()) {
        const w = `${where}.examples[${i}]`;
        textFields(e, ["title", "scenario", "whatToDo", "whyItMatters"], w, errors);
        if (!isTextList(e.tags) || e.tags.length === 0) errors.push(`${w}.tags must be a non-empty array of strings`);
      }
      return;
    case "quiz":
      for (const [i, q] of listOf(v, "questions", 5, where, errors).entries()) {
        const w = `${where}.questions[${i}]`;
        textFields(q, ["prompt", "explanation", "bloomsLevel"], w, errors);
        if (!isTextList(q.choices) || q.choices.length !== 3) errors.push(`${w}.choices must be 3 strings`);
        if (!Number.isInteger(q.correctIndex) || (q.correctIndex as number) < 0 || (q.correctIndex as number) > 2) {
          errors.push(`${w}.correctIndex must be 0, 1 or 2`);
        }
      }
      return;
    case "cards":
      for (const [i, c] of listOf(v, "cards", 5, where, errors).entries()) {
        textFields(c, ["front", "back", "difficulty"], `${where}.cards[${i}]`, errors);
      }
      return;
    case "practice":
      textFields(v, ["coreSkill", "twentyFourHourChallenge", "weeklyPractice"], where, errors);
      for (const [i, p] of listOf(v, "ifThenPlans", 2, where, errors).entries()) {
        textFields(p, ["context", "plan"], `${where}.ifThenPlans[${i}]`, errors);
      }
      return;
  }
}

/** Why a component answer is unusable; empty when it has five labelled variants of the right shape. */
export function variantsShapeErrors(component: Component, raw: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(raw) || !Array.isArray(raw.variants)) return ["answer must be an object with a variants array"];
  if (raw.variants.length !== VARIANT_COUNT) errors.push(`variants must have exactly ${VARIANT_COUNT} items (got ${raw.variants.length})`);
  raw.variants.forEach((v, i) => {
    const where = `variants[${i}]`;
    if (!isObj(v)) {
      errors.push(`${where} must be an object`);
      return;
    }
    if (v.label !== LABELS[i]) errors.push(`${where}.label must be "${LABELS[i]}"`);
    if (!isText(v.approach)) errors.push(`${where}.approach must be a non-empty string`);
    componentShape(component, v, where, errors);
  });
  return errors;
}

/** Why a lessons answer is unusable; empty when it has five complete candidates. */
export function lessonsShapeErrors(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(raw) || !Array.isArray(raw.lessons)) return ["answer must be an object with a lessons array"];
  if (raw.lessons.length !== LESSON_COUNT) errors.push(`lessons must have exactly ${LESSON_COUNT} items (got ${raw.lessons.length})`);
  raw.lessons.forEach((l, i) => {
    const where = `lessons[${i}]`;
    if (!isObj(l)) {
      errors.push(`${where} must be an object`);
      return;
    }
    textFields(l, ["lesson", "wrongBelief", "keyPhrase", "hookQuestion", "whyThisOne"], where, errors);
    for (const k of ["storyNames", "evidence"]) if (!isTextList(l[k])) errors.push(`${where}.${k} must be an array of strings`);
  });
  return errors;
}

/** Gives the list items the ids the app's chapter shape uses, so a picked variant drops straight into a chapter. */
function withIds(component: Component, variants: Obj[]): Obj[] {
  const id = (prefix: string, i: number, pad: number): string => `${prefix}${String(i + 1).padStart(pad, "0")}`;
  return variants.map((v) => {
    if (component === "examples") return { ...v, examples: (v.examples as Obj[]).map((e, i) => ({ exampleId: id("ex", i, 2), ...e })) };
    if (component === "quiz") return { ...v, questions: (v.questions as Obj[]).map((q, i) => ({ questionId: id("q", i, 1), ...q })) };
    if (component === "cards") return { ...v, cards: (v.cards as Obj[]).map((c, i) => ({ cardId: id("rc", i, 1), ...c })) };
    return v;
  });
}

// ---------------------------------------------------------------- deterministic checks

/** Quotations in a summary that are not in the author's text, word for word (footnote markers and typography folded).
 *  With no source text (authorText null), every quotation is flagged: nothing can verify it. */
export function summaryDetIssues(variants: SummaryVariant[], authorText: string | null): DetIssue[] {
  const src = authorText === null ? null : norm(authorText);
  const out: DetIssue[] = [];
  for (const v of variants) {
    for (const q of findQuotes(v.summary)) {
      if (src === null) out.push({ variant: v.label, text: `quotation in a chapter with no source text, so nothing can verify it: "${q}"` });
      else if (!quoteInSource(q, src)) out.push({ variant: v.label, text: `quotation not in the source word for word: "${q}"` });
    }
    const words = wordsIn(v.summary);
    if (words < 200 || words > 400) out.push({ variant: v.label, text: `summary is ${words} words (asked for 250 to 350)` });
  }
  return out;
}

// ---------------------------------------------------------------- calls

export async function callShaped(
  ctx: PipelineCtx,
  n: number,
  o: { role: RoleConfig; prompt: string; step: string; kind: "write" | "fix" | "other"; errors: (raw: unknown) => string[] },
): Promise<unknown> {
  const dir = variantsDir(ctx, n);
  for (let attempt = 0; ; attempt++) {
    const step = attempt === 0 ? o.step : `${o.step}:reshape`;
    const r = await call(ctx, { role: o.role, prompt: o.prompt, step: `variants-${step}`, n, kind: o.kind, outPrefix: path.join(dir, "calls", step) });
    const errors = r.json === null ? ["the answer is not JSON"] : o.errors(r.json);
    if (errors.length === 0) return r.json;
    if (attempt >= 1) throw new CallFailedError(`VARIANTS_OUTPUT_INVALID: ${chapterName(n)} ${o.step}: ${errors.join("; ")} (raw answer: ${path.join(dir, "calls", step)}.result.txt)`);
  }
}

export function lessonText(l: LessonCandidate): string {
  const { whyThisOne: _why, ...card } = l;
  return JSON.stringify(card, null, 2);
}

function summariesBlock(variants: SummaryVariant[]): string {
  return variants
    .map((v) => `[${v.label}]\nhook: ${v.hook}\ncounterintuition: ${v.counterintuition}\nsummary:\n${v.summary}\ntryThisNow: ${v.tryThisNow}\nmemorableLine: ${v.memorableLine}`)
    .join("\n\n");
}

const TEXT_RULES =
  "THE SOURCE is between <source> tags. It is the only authority for the book's people and events: names, numbers, dates, order, " +
  "causes and motives. If the source does not say why something happened, do not supply a reason. The block headed EDITOR'S NOTES " +
  "was written by a later editor, not the author. Read the whole source.";
const TEXT_QUOTE_RULE =
  "Quote the author only where his words carry the lesson, copied exactly, inside double quotes, with any old word explained in the same sentence.";
const TEXT_EVIDENCE_RULE = "1 to 3 short passages copied word for word from the source that show the lesson.";
const KNOWLEDGE_RULES =
  "THERE IS NO SOURCE TEXT. Write from your own knowledge of this book and of this chapter. Use only what you are confident the chapter " +
  "actually says: its named stories and people, and the author's claims and reasoning. If you are unsure of a detail (a date, a number, " +
  "a name, who did what), leave it out rather than guess, and never borrow a story from another chapter or another book.";
const KNOWLEDGE_QUOTE_RULE =
  "Never quote the author or the book: no passage in quotation marks presented as their words, because nothing here can verify it. " +
  "Tell the chapter's stories in your own plain words.";
const KNOWLEDGE_EVIDENCE_RULE = "1 to 3 short descriptions, in your own words, of the chapter's stories or claims that show the lesson (no quotations).";

/** The source-related template variables: the tagged text in text mode, the no-source rules in knowledge mode. */
export function sourceVars(ctx: PipelineCtx, n: number): Record<string, string> {
  if (ctx.source.mode === "knowledge") {
    return { SOURCE_RULES: KNOWLEDGE_RULES, QUOTE_RULE: KNOWLEDGE_QUOTE_RULE, EVIDENCE_RULE: KNOWLEDGE_EVIDENCE_RULE, SOURCE_BLOCK: "" };
  }
  return {
    SOURCE_RULES: TEXT_RULES,
    QUOTE_RULE: TEXT_QUOTE_RULE,
    EVIDENCE_RULE: TEXT_EVIDENCE_RULE,
    SOURCE_BLOCK: `<source>\n${writerFormText(spanText(ctx.source, n))}\n</source>`,
  };
}

function componentPrompt(ctx: PipelineCtx, n: number, component: Component, lesson: LessonCandidate, plain: string): string {
  const vars: Record<string, string> = { LESSON: lessonText(lesson), PLAIN: plain, APPROACHES: approachesText(component) };
  if (component === "summary") {
    const { SOURCE_RULES, QUOTE_RULE, SOURCE_BLOCK } = sourceVars(ctx, n);
    Object.assign(vars, { BOOK_SECTION: ctx.bookSection, SOURCE_RULES, QUOTE_RULE, SOURCE_BLOCK });
  }
  return renderTemplate(loadPrompt(`variants-${component}`), vars);
}

async function pool(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  const errors: unknown[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const task = tasks[next++];
      try {
        await task();
      } catch (e) {
        errors.push(e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
  if (errors.length > 0) throw errors[0];
}

function spendOn(ctx: PipelineCtx, n: number): number {
  const label = `${ctx.config.bookId}/${chapterName(n)}`;
  return round4(readLedger(ctx.ledgerPath).filter((r) => r.chapter === label && r.step.startsWith("variants-")).reduce((s, r) => s + r.cost, 0));
}

// ---------------------------------------------------------------- generateVariants

export async function generateVariants(ctx: PipelineCtx, n: number, opts: VariantsOptions = {}): Promise<VariantsRun> {
  const dir = variantsDir(ctx, n);
  fs.mkdirSync(dir, { recursive: true });
  const file = (name: string): string => path.join(dir, `${name}.json`);
  const force = opts.force === true;
  const wanted = new Set<Component>(opts.only ?? COMPONENTS);
  const plain = loadPrompt("variants-plain");
  const titles = Object.fromEntries(ctx.source.spans.map((s) => [s.chapterNumber, s.chapterTitle]));

  // 1. The lesson: five candidates, best first.
  let lessons = readJson<{ lessons: LessonCandidate[] }>(file("lessons"))?.lessons ?? null;
  if (lessons === null || (force && opts.only === undefined)) {
    const { SOURCE_RULES, EVIDENCE_RULE, SOURCE_BLOCK } = sourceVars(ctx, n);
    const prompt = renderTemplate(loadPrompt("variants-lessons"), {
      BOOK_SECTION: ctx.bookSection,
      HEADER: chapterHeader(n, titles, []),
      SOURCE_RULES,
      EVIDENCE_RULE,
      SOURCE_BLOCK,
      PLAIN: plain,
    });
    const raw = (await callShaped(ctx, n, { role: ctx.config.writer, prompt, step: "lessons", kind: "write", errors: lessonsShapeErrors })) as { lessons: LessonCandidate[] };
    lessons = raw.lessons;
    writeJson(file("lessons"), { lessons });
    // A new set of lessons makes every component stale.
    for (const c of COMPONENTS) fs.rmSync(file(c), { force: true });
    fs.rmSync(file("factcheck"), { force: true });
  }
  const lessonIndex = opts.lessonIndex ?? readJson<{ lessonIndex: number }>(file("run"))?.lessonIndex ?? 0;
  const lesson = lessons[lessonIndex];
  if (!lesson) throw new Error(`NO_SUCH_LESSON: ${chapterName(n)} has ${lessons.length} candidate lessons; asked for index ${lessonIndex}`);
  const previous = readJson<{ lessonIndex: number }>(file("run"));
  if (previous && previous.lessonIndex !== lessonIndex) {
    // A different lesson makes every component stale.
    for (const c of COMPONENTS) fs.rmSync(file(c), { force: true });
    fs.rmSync(file("factcheck"), { force: true });
  }

  // 2. The components, in parallel.
  let summaryFresh = false;
  const tasks = COMPONENTS.filter((c) => wanted.has(c) && (force || !fs.existsSync(file(c)))).map((c) => async () => {
    const raw = (await callShaped(ctx, n, {
      role: ctx.config.writer,
      prompt: componentPrompt(ctx, n, c, lesson, plain),
      step: c,
      kind: "write",
      errors: (v) => variantsShapeErrors(c, v),
    })) as { variants: Obj[] };
    writeJson(file(c), { variants: withIds(c, raw.variants) });
    if (c === "summary") summaryFresh = true;
  });
  await pool(tasks, ctx.config.concurrency);

  const load = <T>(c: Component): T[] => readJson<{ variants: T[] }>(file(c))?.variants ?? [];
  const summary = load<SummaryVariant>("summary");

  // 3. The fact check of the five summaries, plus the 0-call checks.
  let issues: FactIssue[] = readJson<{ issues: FactIssue[] }>(file("factcheck"))?.issues ?? [];
  if (summary.length > 0 && (summaryFresh || !fs.existsSync(file("factcheck")))) {
    const knowledge = ctx.source.mode === "knowledge";
    const prompt = renderTemplate(loadPrompt(knowledge ? "variants-factcheck-knowledge" : "variants-factcheck"), {
      KNOWN_TRAPS: knownTrapsSection(ctx.knownTraps[n] ?? []),
      LESSON: lessonText(lesson),
      SUMMARIES: summariesBlock(summary),
      ...(knowledge ? { BOOK_SECTION: ctx.bookSection } : { SOURCE: writerFormText(spanText(ctx.source, n)) }),
    });
    const raw = await callShaped(ctx, n, {
      role: ctx.config.checker,
      prompt,
      step: "factcheck",
      kind: "other",
      errors: (v) => (isObj(v) && Array.isArray(v.issues) ? [] : ["answer must be an object with an issues array"]),
    });
    issues = ((raw as { issues: unknown[] }).issues.filter(isObj) as unknown as Partial<FactIssue>[]).map((i) => ({
      variant: String(i.variant ?? "?"),
      kind: String(i.kind ?? "OTHER"),
      field: String(i.field ?? "summary"),
      chapterText: String(i.chapterText ?? ""),
      verdict: String(i.verdict ?? "UNSUPPORTED"),
      sourceText: String(i.sourceText ?? "none"),
      fix: String(i.fix ?? ""),
    }));
    writeJson(file("factcheck"), { issues });
  }
  const det =
    summary.length > 0 ? summaryDetIssues(summary, ctx.source.mode === "knowledge" ? null : writerForm(spanText(ctx.source, n)).text) : [];

  const run: VariantsRun = {
    chapter: n,
    chapterTitle: ctx.source.title(n),
    lessonIndex,
    lesson,
    lessons,
    summary,
    examples: load<ExamplesVariant>("examples"),
    quiz: load<QuizVariant>("quiz"),
    cards: load<CardsVariant>("cards"),
    practice: load<PracticeVariant>("practice"),
    factcheck: { issues, det },
    spend: spendOn(ctx, n),
  };
  writeJson(file("run"), run);
  return run;
}
