/** Assemble: the full chapter built from the owner's picks on a variants page. One writer call copies the picked parts
 *  into a v21 chapter (three lengths of the picked summary, the quiz extended to the shape's count in the picked form,
 *  the fact-check fixes applied), then the 0-call checks and a fact check of the three summary lengths run, and the
 *  chapter lands as <runDir>/chNN/final.json with status.json, a reading page, and the chapter's exemplar for later
 *  chapters. Nothing is fixed automatically: open issues go to the owner. */
import * as fs from "node:fs";
import * as path from "node:path";
import { CallFailedError } from "./call";
import { readLedger } from "./ledger";
import { runChecks, type CheckContext } from "./checks";
import { call, type ChapterStatus, type PipelineCtx } from "./pipeline";
import { chapterHeader, knownTrapsSection, loadPrompt, renderTemplate } from "./prompts";
import { keysBlock, keysFor } from "./keysText";
import { page, renderChapter } from "./render";
import { spanText, writerForm, writerFormText } from "./source";
import type { Chapter, Issue, LessonCard } from "./types";
import {
  COMPONENTS,
  LABELS,
  callShaped,
  lessonText,
  sourceVars,
  variantsDir,
  type CardsVariant,
  type Component,
  type ExamplesVariant,
  type FactIssue,
  type PracticeVariant,
  type QuizVariant,
  type SummaryVariant,
  type VariantsRun,
} from "./variants";

export interface Picks {
  picks: Record<Component, string>;
  notes: Partial<Record<Component | "general", string>>;
}

const chapterName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}
function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// ---------------------------------------------------------------- picks

/** Parses the "Copy my picks" text (or a JSON {picks, notes}). Every component needs a label A to E. */
export function parsePicks(text: string): Picks {
  const raw = text.trim();
  if (raw.startsWith("{")) {
    const j: unknown = JSON.parse(raw);
    if (!isObj(j) || !isObj(j.picks)) throw new Error("PICKS_INVALID: JSON needs a picks object");
    return normalize(j.picks as Record<string, unknown>, isObj(j.notes) ? (j.notes as Record<string, unknown>) : {});
  }
  const picks: Record<string, unknown> = {};
  const notes: Record<string, unknown> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(notes\s+)?([a-z]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, isNote, key, value] = m;
    if (isNote) notes[key.toLowerCase()] = value.trim();
    else picks[key.toLowerCase()] = value.trim();
  }
  return normalize(picks, notes);
}

function normalize(picks: Record<string, unknown>, notes: Record<string, unknown>): Picks {
  const out = {} as Record<Component, string>;
  for (const c of COMPONENTS) {
    const v = String(picks[c] ?? "").trim().toUpperCase();
    if (!(LABELS as readonly string[]).includes(v)) {
      throw new Error(`PICKS_INVALID: ${c} needs one of ${LABELS.join(", ")} (got "${picks[c] ?? ""}"); every part must be picked`);
    }
    out[c] = v;
  }
  const n: Picks["notes"] = {};
  for (const k of [...COMPONENTS, "general"] as const) {
    const v = notes[k];
    if (typeof v === "string" && v.trim()) n[k] = v.trim();
  }
  return { picks: out, notes: n };
}

// ---------------------------------------------------------------- the picks block

function pick<T extends { label: string }>(list: T[], label: string, what: string): T {
  const v = list.find((x) => x.label === label);
  if (!v) throw new Error(`PICKS_INVALID: ${what} has no version ${label} on this page`);
  return v;
}

function picksBlock(run: VariantsRun, p: Picks): { text: string; quiz: QuizVariant; chosen: Record<Component, unknown> } {
  const s = pick(run.summary as SummaryVariant[], p.picks.summary, "summary");
  const e = pick(run.examples as ExamplesVariant[], p.picks.examples, "examples");
  const q = pick(run.quiz as QuizVariant[], p.picks.quiz, "quiz");
  const c = pick(run.cards as CardsVariant[], p.picks.cards, "cards");
  const pr = pick(run.practice as PracticeVariant[], p.picks.practice, "practice");
  const out: string[] = [];
  out.push(`SUMMARY (version ${s.label}, ${s.approach})\nhook: ${s.hook}\ncounterintuition: ${s.counterintuition}\nsummary:\n${s.summary}\ntryThisNow: ${s.tryThisNow}\nmemorableLine: ${s.memorableLine}`);
  out.push(
    `EXAMPLES (version ${e.label}, ${e.approach})\n` +
      e.examples.map((x) => `[${x.exampleId}] title: ${x.title}\ntags: ${JSON.stringify(x.tags)}\nscenario: ${x.scenario}\nwhatToDo: ${x.whatToDo}\nwhyItMatters: ${x.whyItMatters}`).join("\n\n"),
  );
  out.push(
    `QUIZ (version ${q.label}, ${q.approach})\n` +
      q.questions
        .map((x) => `[${x.questionId}] prompt: ${x.prompt}\n${x.choices.map((ch, i) => `  choices[${i}]: ${ch}`).join("\n")}\n  correctIndex: ${x.correctIndex}\n  explanation: ${x.explanation}\n  bloomsLevel: ${x.bloomsLevel}`)
        .join("\n\n"),
  );
  out.push(`REVIEW CARDS (version ${c.label}, ${c.approach})\n` + c.cards.map((x) => `[${x.cardId}] front: ${x.front}\nback: ${x.back}\ndifficulty: ${x.difficulty}`).join("\n\n"));
  out.push(
    `PRACTICE PLAN (version ${pr.label}, ${pr.approach})\ncoreSkill: ${pr.coreSkill}\n` +
      pr.ifThenPlans.map((x, i) => `ifThenPlans[${i}].context: ${x.context}\nifThenPlans[${i}].plan: ${x.plan}`).join("\n") +
      `\ntwentyFourHourChallenge: ${pr.twentyFourHourChallenge}\nweeklyPractice: ${pr.weeklyPractice}`,
  );
  const notes = Object.entries(p.notes).map(([k, v]) => `${k}: ${v}`);
  out.push(`OWNER NOTES\n${notes.length ? notes.join("\n") : "(none)"}`);
  return { text: out.join("\n\n"), quiz: q, chosen: { summary: s, examples: e, quiz: q, cards: c, practice: pr } };
}

function fixesBlock(run: VariantsRun, label: string): string {
  const lines = [
    ...run.factcheck.issues.filter((i) => i.variant === label).map((i) => `- ${i.kind} in ${i.field} (${i.verdict}): "${i.chapterText}" | what the book says: ${i.sourceText} | fix: ${i.fix}`),
    ...run.factcheck.det.filter((i) => i.variant === label).map((i) => `- CHECK: ${i.text}`),
  ];
  return lines.length ? lines.join("\n") : "(none)";
}

// ---------------------------------------------------------------- shape of the assembled chapter

/** Why an assembled answer is unusable (a wrong field name counts: the app rejects it). A failing shape is asked for once more. */
export function chapterShapeErrors(raw: unknown): string[] {
  if (!isObj(raw)) return ["answer must be a JSON object"];
  const errors: string[] = [];
  const isText = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";
  const items = (v: unknown, key: string, min: number): Record<string, unknown>[] => {
    if (!Array.isArray(v) || v.length < min || !v.every(isObj)) {
      errors.push(`${key} must be an array of at least ${min} objects`);
      return [];
    }
    return v as Record<string, unknown>[];
  };
  const textKeys = (o: Record<string, unknown>, keys: string[], where: string): void => {
    for (const k of keys) if (!isText(o[k])) errors.push(`${where}.${k} must be a non-empty string`);
  };
  textKeys(raw, ["title", "hook", "counterintuition", "keyTakeaway", "tryThisNow"], "chapter");
  const b = raw.breakdown;
  if (!isObj(b)) errors.push("breakdown must be an object");
  else textKeys(b, ["fastRead", "deepRead", "fullRead"], "breakdown");
  items(raw.memorableLines, "memorableLines", 1).forEach((m, i) => textKeys(m, ["text"], `memorableLines[${i}]`));
  items(raw.examples, "examples", 1).forEach((e, i) => {
    textKeys(e, ["exampleId", "title", "scenario", "whatToDo", "whyItMatters"], `examples[${i}]`);
    if (!Array.isArray(e.tags) || e.tags.length === 0 || !e.tags.every(isText)) errors.push(`examples[${i}].tags must be a non-empty array of strings`);
  });
  if (!isObj(raw.quiz)) errors.push("quiz must be an object");
  else {
    items(raw.quiz.questions, "quiz.questions", 1).forEach((q, i) => {
      textKeys(q, ["questionId", "prompt", "explanation", "bloomsLevel"], `quiz.questions[${i}]`);
      if (!Array.isArray(q.choices) || q.choices.length < 2 || !q.choices.every(isText)) errors.push(`quiz.questions[${i}].choices must be an array of strings`);
      if (!Number.isInteger(q.correctIndex)) errors.push(`quiz.questions[${i}].correctIndex must be an integer`);
    });
  }
  items(raw.reviewCards, "reviewCards", 1).forEach((c, i) => textKeys(c, ["cardId", "front", "back", "difficulty"], `reviewCards[${i}]`));
  const plan = raw.implementationPlan;
  if (!isObj(plan)) errors.push("implementationPlan must be an object");
  else {
    textKeys(plan, ["coreSkill", "twentyFourHourChallenge", "weeklyPractice"], "implementationPlan");
    items(plan.ifThenPlans, "implementationPlan.ifThenPlans", 1).forEach((x, i) => textKeys(x, ["context", "plan"], `implementationPlan.ifThenPlans[${i}]`));
  }
  if ("_lesson" in raw) errors.push("_lesson must not be in the chapter");
  return errors;
}

// ---------------------------------------------------------------- assemble

export interface AssembleResult {
  chapter: Chapter;
  status: ChapterStatus & { assembled: true; picks: Picks["picks"] };
  files: { final: string; status: string; exemplar: string; reading: string };
}

export async function assembleChapter(ctx: PipelineCtx, n: number, p: Picks): Promise<AssembleResult> {
  const vdir = variantsDir(ctx, n);
  const run = readJson<VariantsRun>(path.join(vdir, "run.json"));
  if (!run) throw new Error(`NO_VARIANTS: ${chapterName(n)} has no variants page yet; run variants first`);
  for (const c of COMPONENTS) if (run[c].length === 0) throw new Error(`NO_VARIANTS: ${chapterName(n)} has no ${c} versions; run variants --only ${c}`);
  const dir = path.join(ctx.config.runDir, chapterName(n), "assembled");
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(vdir, "picks.json"), p);

  const { text: picksText, quiz, chosen } = picksBlock(run, p);
  const knowledge = ctx.source.mode === "knowledge";
  const shape = ctx.config.shape;
  const titles = Object.fromEntries(ctx.source.spans.map((s) => [s.chapterNumber, s.chapterTitle]));
  const { SOURCE_RULES, QUOTE_RULE, SOURCE_BLOCK } = sourceVars(ctx, n);
  const band = ([lo, hi]: [number, number]): string => `${lo} to ${hi}`;
  const extra = Math.max(0, shape.quizQuestions - quiz.questions.length);
  const prompt = renderTemplate(loadPrompt("variants-assemble"), {
    BOOK_SECTION: ctx.bookSection,
    HEADER: chapterHeader(n, titles, []),
    SOURCE_RULES,
    QUOTE_RULE,
    SOURCE_BLOCK,
    MEMORABLE_RULE: knowledge
      ? " and nothing else: with no source text there are no quotations."
      : ", plus up to 2 more objects with the author's exact words from the source that carry the same lesson, only if a beginner can read them without help; most chapters need none.",
    FAST: band(shape.fastRead),
    DEEP: band(shape.deepRead),
    FULL: band(shape.fullRead),
    PICKED_QUIZ_COUNT: String(quiz.questions.length),
    EXTRA_QUIZ_COUNT: String(extra),
    QUIZ_APPROACH: quiz.approach,
    QUIZ_COUNT: String(Math.max(shape.quizQuestions, quiz.questions.length)),
    PLAIN: loadPrompt("variants-plain"),
    LESSON: lessonText(run.lesson),
    PICKS: picksText,
    FIXES: fixesBlock(run, p.picks.summary),
  });
  const raw = await callShaped(ctx, n, { role: ctx.config.writer, prompt, step: "assemble", kind: "write", errors: chapterShapeErrors });
  const chapter = raw as Chapter;
  writeJson(path.join(dir, "r0.chapter.json"), chapter);

  // Checks: the 0-call checks, then the fact check of the three lengths.
  const lesson: LessonCard = { lesson: run.lesson.lesson, wrongBelief: run.lesson.wrongBelief, keyPhrase: run.lesson.keyPhrase, hookQuestion: run.lesson.hookQuestion, storyNames: run.lesson.storyNames, evidence: run.lesson.evidence };
  const { bookId, title, author, categories, tags, bookType } = ctx.config;
  const checkCtx: CheckContext = {
    n,
    book: { bookId, title, author, categories, tags, bookType },
    authorText: knowledge ? "" : writerForm(spanText(ctx.source, n)).text,
    shape,
    earlierLessons: [],
  };
  const checks = await runChecks(chapter, lesson, checkCtx);
  writeJson(path.join(dir, "r0.checks.json"), checks);
  let factIssues: FactIssue[] = [];
  if (checks.blocking.every((i) => !i.text.startsWith("shape:"))) {
    const tiers = (["fastRead", "deepRead", "fullRead"] as const).map((t) => `[${t}]\n${chapter.breakdown[t]}`).join("\n\n");
    const factPrompt = renderTemplate(loadPrompt(knowledge ? "variants-factcheck-knowledge" : "variants-factcheck"), {
      KNOWN_TRAPS: knownTrapsSection(ctx.knownTraps[n] ?? []),
      LESSON: lessonText(run.lesson),
      SUMMARIES: tiers,
      KEYS: keysBlock(ctx, n),
      ...(knowledge ? { BOOK_SECTION: ctx.bookSection } : { SOURCE: writerFormText(spanText(ctx.source, n)) }),
    });
    const fact = await callShaped(ctx, n, {
      role: ctx.config.checker,
      prompt: factPrompt,
      step: "assemble-factcheck",
      kind: "other",
      errors: (v) => (isObj(v) && Array.isArray(v.issues) ? [] : ["answer must be an object with an issues array"]),
    });
    factIssues = ((fact as { issues: unknown[] }).issues.filter(isObj) as unknown as Partial<FactIssue>[]).map((i) => ({
      variant: String(i.variant ?? "?"),
      kind: String(i.kind ?? "OTHER"),
      field: String(i.field ?? "summary"),
      chapterText: String(i.chapterText ?? ""),
      verdict: String(i.verdict ?? "UNSUPPORTED"),
      sourceText: String(i.sourceText ?? "none"),
      fix: String(i.fix ?? ""),
    }));
    writeJson(path.join(dir, "r0.factcheck.json"), { issues: factIssues });
  }
  const factAsIssues: Issue[] = factIssues.map((i) => ({
    source: "fact",
    blocking: true,
    field: `breakdown.${i.variant}`,
    text: `${i.kind} (${i.verdict}): "${i.chapterText}" | book: ${i.sourceText} | fix: ${i.fix}`,
  }));
  const open: ChapterStatus["open"] = [...checks.blocking, ...factAsIssues, ...checks.reported.map((i) => ({ ...i, leftover: true as const }))];
  const blockingCount = checks.blocking.length + factAsIssues.length;

  // Land it where status and render find it.
  const chDir = path.join(ctx.config.runDir, chapterName(n));
  const label = `${ctx.config.bookId}/${chapterName(n)}`;
  const spend = round4(readLedger(ctx.ledgerPath).filter((r) => r.chapter === label).reduce((s, r) => s + r.cost, 0));
  const status: AssembleResult["status"] = {
    chapter: n,
    stage: blockingCount > 0 ? "open-issues" : "clean",
    round: 0,
    rerun: false,
    lessonRating: "UNKNOWN",
    open,
    spend,
    lesson: run.lesson.lesson,
    assembled: true,
    picks: p.picks,
  };
  const files = {
    final: path.join(chDir, "final.json"),
    status: path.join(chDir, "status.json"),
    exemplar: path.join(ctx.config.runDir, "exemplars", `${chapterName(n)}.json`),
    reading: path.join(ctx.config.runDir, "reading", `${chapterName(n)}.html`),
  };
  writeJson(files.final, chapter);
  writeJson(files.status, status);
  writeJson(path.join(chDir, "lesson.json"), lesson);
  writeJson(files.exemplar, {
    bookId: ctx.config.bookId,
    chapter: n,
    chapterTitle: run.chapterTitle,
    lesson,
    // Later chapters rotate their summary opener among these approaches; the owner widens the list (for example to the openers rated Excellent).
    approved: { summary: [p.picks.summary] },
    // The book's own people and places, from every candidate lesson: a later chapter may name them; the exemplar's invented names it may not.
    bookNames: [...new Set(run.lessons.flatMap((l) => l.storyNames))].sort(),
    picks: Object.fromEntries(COMPONENTS.map((c) => [c, { label: p.picks[c], approach: (chosen[c] as { approach: string }).approach }])),
    notes: p.notes,
    chosen,
    rejected: Object.fromEntries(
      COMPONENTS.map((c) => [
        c,
        (run[c] as Array<{ label: string; approach: string; hook?: string }>).filter((v) => v.label !== p.picks[c]).map((v) => ({ label: v.label, approach: v.approach, ...(v.hook ? { hook: v.hook } : {}) })),
      ]),
    ),
    chapterFile: files.final,
  });
  const flagLine = blockingCount > 0 ? `${status.stage}: ${blockingCount} open` : "";
  const body = renderChapter({ ...chapter, number: n }, { label: flagLine, bookLine: `${title} by ${author}`, uid: `v${n}`, authorAdvice: keysFor(ctx, n) });
  fs.mkdirSync(path.dirname(files.reading), { recursive: true });
  fs.writeFileSync(files.reading, page(`${title}: chapter ${n}`, body));
  return { chapter, status, files };
}

export { CallFailedError };
