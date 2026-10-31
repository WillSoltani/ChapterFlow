/** The exemplar-driven book writer: every chapter written in the form of a chapter the owner approved. Per chapter: the
 *  lessons call (five candidates, the book's taught lessons off limits), one writer call with the exemplar, the picked
 *  approach rules, the owner's notes and the variety ledger, the 0-call checks (plus exemplar-copy and variety checks),
 *  the fact check of the three summary lengths, the blind key solver, at most one fix round on blocking issues, then
 *  final.json, status.json, lesson.json, the reading page and the ledger entry. Resumes from files. */
import * as fs from "node:fs";
import * as path from "node:path";
import { approach } from "./approaches";
import { chapterShapeErrors } from "./assemble";
import { runChecks, type CheckContext } from "./checks";
import { applyFix, type FixOutput } from "./fix";
import { readLedger } from "./ledger";
import { call, type ChapterStatus, type PipelineCtx } from "./pipeline";
import { allTiersText, knownTrapsSection, loadPrompt, newReaderText, questionsBlock, readerText, renderTemplate } from "./prompts";
import { page, renderChapter } from "./render";
import { spanText, writerForm, writerFormText } from "./source";
import type { Chapter, Issue, LessonCard, QuizQuestion } from "./types";
import { wordsIn } from "./validate";
import { keysBlock, keysFor } from "./keysText";
import { COMPONENTS, callShaped, lessonText, lessonsPrompt, lessonsShapeErrors, sourceVars, type Component, type FactIssue, type LessonCandidate } from "./variants";

export interface Exemplar {
  chapter: number;
  chapterJson: Chapter;
  picks: Record<Component, { label: string; approach: string }>;
  notes: Record<string, string>;
  /** Invented first names in the exemplar's hook, examples, quiz, cards and practice (0-call extraction): a later chapter that
   *  uses one is blocked. */
  names: string[];
  /** Names that appear only in the exemplar's summaries and cannot be told from the book's own people (no candidate lessons on
   *  file): a later chapter that uses one is reported, not blocked. */
  sceneNames: string[];
  /** The book's own people and places (every candidate lesson's storyNames): a later chapter may name them. */
  bookNames: string[];
  /** Summary approaches later chapters rotate through, A to E; the owner widens it beyond the pick. */
  approvedSummary: string[];
}
export interface Variety {
  names: string[];
  settings: string[];
  analogies: string[];
  /** The summary approach this chapter opened with. */
  approach?: string;
  /** Four sentences cut from fastRead: its first, the first that names the book's story, the first of the last paragraph, the last. */
  openers?: string[];
}
export interface VarietyLedger {
  chapters: Record<string, Variety>;
}
export type BookChapterStatus = ChapterStatus & { book: true; exemplar: number; fixed: boolean };

const chapterName = (n: number): string => `ch${String(n).padStart(2, "0")}`;
const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const TIERS = ["fastRead", "deepRead", "fullRead"] as const;
const FIRST_QUESTIONS = 5;

function readJson<T>(file: string): T | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}
function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// ---------------------------------------------------------------- exemplar

const NOT_NAMES = new Set(
  (
    "the a an this that these those it its he she they we you i me him her them us my your our their his hers ours theirs mine yours " +
    "when if so but and or then now here there what why how who whom which whose many most some every each all any no not never always " +
    "often sometimes once soon later today tonight tomorrow yesterday morning afternoon evening night week month year day days weeks months years " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december " +
    "write send ask tell thank share open pick give take make do does did done is are was were be been being have has had can could should would " +
    "will may might must let think picture imagine instead still even also only just with without from for to in on at by of as like than because " +
    "while until unless although though since where whether yet nothing something anything everything none both either neither much more less " +
    "few little big small good bad new old keep put set get go come say see look find fix try use need want start stop turn bring hold call name " +
    "note list plan step move rule lesson chapter book author example examples front back question questions card cards summary practice quiz " +
    "people someone nobody everyone anyone actually really maybe perhaps first second third next last before after again back scold ignore naming " +
    "review read reading learn learning work works school home personal money health relationships team boss manager friend coworker " +
    "pass fail yes no okay fine nice great right wrong true false one two three four five six seven eight nine ten half part whole " +
    "king queen prince duke lord sir mr mrs ms dr france england britain europe america italy spain germany china japan russia rome paris london florence venice"
  ).split(" "),
);

/** Capitalized words that look like the invented first names of a chapter, in every reader-visible field. A word counts when
 *  it appears inside a sentence (not as its first word) at least once, or starts two or more sentences; a word that also
 *  appears in lowercase anywhere in the chapter, a common sentence opener, a royal or geographic word, and the book's story
 *  names (the lesson card's storyNames) are left out. */
export function extractNames(c: Chapter, storyNames: string[] = [], fields: "invented" | "all" = "all"): string[] {
  const texts = [
    c.hook,
    c.counterintuition,
    c.tryThisNow,
    ...(fields === "all" ? TIERS.map((t) => c.breakdown[t]) : []),
    ...c.examples.flatMap((e) => [e.title, e.scenario, e.whatToDo, e.whyItMatters]),
    ...c.quiz.questions.flatMap((q) => [q.prompt, ...q.choices, q.explanation]),
    ...c.reviewCards.flatMap((r) => [r.front, r.back]),
    c.implementationPlan.coreSkill,
    ...c.implementationPlan.ifThenPlans.flatMap((p) => [p.context, p.plan]),
    c.implementationPlan.twentyFourHourChallenge,
    c.implementationPlan.weeklyPractice,
  ];
  const story = new Set(storyNames.flatMap((s) => s.split(/\s+/)).map((w) => w.toLowerCase()));
  const everything = texts.join("\n");
  const lowercaseToo = new Set((everything.match(/(?<![A-Za-z])[a-z][a-z'’]+/g) ?? []).map((w) => w.replace(/['’]s?$/, "")));
  const count = new Map<string, { starts: number; mid: number }>();
  for (const text of texts) {
    // Sentences: split on a terminator (or a line break) followed by space; quotes and brackets around a sentence start are stripped.
    for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
      const words = sentence.replace(/^[\s"'“‘(\[]+/, "").match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
      words.forEach((raw, i) => {
        const w = raw.replace(/['’]s?$/, "");
        if (!/^[A-Z][a-z]{2,}$/.test(w)) return;
        const e = count.get(w) ?? { starts: 0, mid: 0 };
        if (i === 0) e.starts++;
        else e.mid++;
        count.set(w, e);
      });
    }
  }
  return [...count.entries()]
    // A word that only ever starts sentences and ends in "ing" is a gerund opener ("Believing a big win..."), not a name.
    .filter(([w, e]) => !NOT_NAMES.has(w.toLowerCase()) && !story.has(w.toLowerCase()) && !lowercaseToo.has(w.toLowerCase()) && (e.mid > 0 || (e.starts > 1 && !/ing$/.test(w))))
    .map(([w]) => w)
    .sort();
}

/** The exemplar: exemplars/chNN.json (picks, notes) plus the chapter as it stands now in chNN/final.json. */
export function loadExemplar(ctx: PipelineCtx, n?: number): Exemplar {
  const dir = path.join(ctx.config.runDir, "exemplars");
  let pick = n;
  if (pick === undefined) {
    const found = fs.existsSync(dir) ? fs.readdirSync(dir).flatMap((f) => (/^ch(\d+)\.json$/.test(f) ? [Number(/^ch(\d+)\.json$/.exec(f)![1])] : [])) : [];
    if (found.length === 0) throw new Error(`NO_EXEMPLAR: no exemplar under ${dir}; assemble an approved chapter first`);
    pick = Math.max(...found);
  }
  const rec = readJson<{ picks: Exemplar["picks"]; notes: Record<string, string>; lesson?: LessonCard; approved?: { summary?: string[] }; bookNames?: string[] }>(
    path.join(dir, `${chapterName(pick)}.json`),
  );
  if (!rec) throw new Error(`NO_EXEMPLAR: ${path.join(dir, `${chapterName(pick)}.json`)} does not exist`);
  const chapterJson = readJson<Chapter>(path.join(ctx.config.runDir, chapterName(pick), "final.json"));
  if (!chapterJson) throw new Error(`NO_EXEMPLAR: ${chapterName(pick)} has no final.json`);
  // The book's own people: the record's list, else every candidate lesson's storyNames from the variants page, else the lesson card.
  const candidates = readJson<{ lessons: Array<{ storyNames?: string[] }> }>(path.join(ctx.config.runDir, chapterName(pick), "variants", "lessons.json"));
  const known = rec.bookNames ?? candidates?.lessons.flatMap((l) => l.storyNames ?? []) ?? null;
  const bookNames = [...new Set([...(known ?? []), ...(rec.lesson?.storyNames ?? [])])].sort();
  const invented = extractNames(chapterJson, bookNames, "invented");
  const tierOnly = extractNames(chapterJson, bookNames, "all").filter((x) => !invented.includes(x));
  // With the book's people known, a summary-only name that is not one of them is an invented scene (Maya) and blocks; without
  // that list it cannot be told apart from the book's people, so it is only reported.
  const names = known !== null ? [...new Set([...invented, ...tierOnly])].sort() : invented;
  const sceneNames = known !== null ? [] : tierOnly;
  const approvedSummary = (rec.approved?.summary ?? []).filter((l) => /^[A-E]$/.test(l));
  return {
    chapter: pick,
    chapterJson,
    picks: rec.picks,
    notes: rec.notes ?? {},
    names,
    sceneNames,
    bookNames,
    approvedSummary: approvedSummary.length ? approvedSummary : [rec.picks.summary.label],
  };
}

/** Chapter n's summary approach: the approved openers in turn, so neighbouring chapters never open the same way. */
export function summaryApproachFor(ex: Exemplar, n: number): string {
  const k = ex.approvedSummary.length;
  return ex.approvedSummary[((n - 1) % k + k) % k];
}

function paragraphs(t: string): number {
  return t.split(/\n\s*\n/).filter((p) => p.trim()).length;
}

/** The form sheet the writer gets: the picked approach rule per part plus the exemplar's measurements. */
export function formText(ex: Exemplar, summaryLabel: string = ex.picks.summary.label): string {
  const c = ex.chapterJson;
  const rule = (comp: Component, label: string = ex.picks[comp].label): string => {
    const a = approach(comp, label);
    return `${a.label}, "${a.name}": ${a.rule}`;
  };
  const openerNote =
    summaryLabel === ex.picks.summary.label
      ? ""
      : ` (The exemplar opens as ${ex.picks.summary.label}, "${approach("summary", ex.picks.summary.label).name}"; THIS chapter opens as ${summaryLabel} instead. Keep the exemplar's path, lengths and ending; change only the kind of opener.)`;
  const avg = (xs: number[]): number => Math.round(xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length));
  return [
    `- summary (hook, counterintuition, the three lengths, tryThisNow, memorable line): ${rule("summary", summaryLabel)}${openerNote} Measurements: hook ${wordsIn(c.hook)} words; counterintuition ${wordsIn(c.counterintuition)} words; fastRead ${wordsIn(c.breakdown.fastRead)} words in ${paragraphs(c.breakdown.fastRead)} paragraphs; deepRead ${wordsIn(c.breakdown.deepRead)} words in ${paragraphs(c.breakdown.deepRead)} paragraphs; fullRead ${wordsIn(c.breakdown.fullRead)} words in ${paragraphs(c.breakdown.fullRead)} paragraphs; tryThisNow ${wordsIn(c.tryThisNow)} words.`,
    `- examples: ${c.examples.length} examples; ${rule("examples")} Measurements: scenario about ${avg(c.examples.map((e) => wordsIn(e.scenario)))} words, whatToDo about ${avg(c.examples.map((e) => wordsIn(e.whatToDo)))}, whyItMatters about ${avg(c.examples.map((e) => wordsIn(e.whyItMatters)))}.`,
    `- quiz: ${c.quiz.questions.length} questions with ${c.quiz.questions[0]?.choices.length ?? 3} choices each; ${rule("quiz")}`,
    `- review cards: ${c.reviewCards.length} cards; ${rule("cards")}`,
    `- practice plan: ${c.implementationPlan.ifThenPlans.length} if-then plans; ${rule("practice")}`,
  ].join("\n");
}

// ---------------------------------------------------------------- variety ledger

export function readVariety(ctx: PipelineCtx): VarietyLedger {
  return readJson<VarietyLedger>(path.join(ctx.config.runDir, "variety.json")) ?? { chapters: {} };
}

function writeVariety(ctx: PipelineCtx, n: number, v: Variety): void {
  const ledger = readVariety(ctx);
  ledger.chapters[chapterName(n)] = v;
  writeJson(path.join(ctx.config.runDir, "variety.json"), ledger);
}

/** The <used> block: everything in the ledger except this chapter's own entry, plus the exemplar's names. */
export function usedText(ledger: VarietyLedger, ex: Exemplar, except: number): string {
  const names = new Set<string>(ex.names);
  const settings = new Set<string>();
  const analogies = new Set<string>();
  for (const [k, v] of Object.entries(ledger.chapters)) {
    if (k === chapterName(except)) continue;
    v.names.forEach((x) => names.add(x));
    v.settings.forEach((x) => settings.add(x));
    v.analogies.forEach((x) => analogies.add(x));
  }
  const line = (label: string, s: Set<string>): string => `${label}: ${s.size ? [...s].sort().join(", ") : "(none yet)"}`;
  const recent = Object.entries(ledger.chapters)
    .filter(([k]) => k !== chapterName(except))
    .sort(([a], [b]) => Number(a.slice(2)) - Number(b.slice(2)))
    .slice(-5)
    .flatMap(([k, v]) => (v.openers ?? []).map((o) => `${k}: ${o}`));
  const openers = recent.length ? `do not start or end like these (recent chapters):\n${recent.map((o) => `- ${o}`).join("\n")}` : "";
  return [line("names", names), line("settings", settings), line("analogies", analogies), openers].filter(Boolean).join("\n");
}

/** Four sentences that carry a chapter's rhythm: fastRead's first, the first that names the book's story, the first of the last
 *  paragraph, and the last. */
export function openerSentences(c: Chapter, storyNames: string[]): string[] {
  const paras = c.breakdown.fastRead.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sentences = (t: string): string[] => t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const all = sentences(c.breakdown.fastRead);
  const story = storyNames.flatMap((s) => s.split(/\s+/)).filter((w) => w.length > 2);
  const out = new Set<string>();
  if (all[0]) out.add(all[0]);
  const withStory = all.find((x) => story.some((w) => x.includes(w)));
  if (withStory) out.add(withStory);
  const last = paras[paras.length - 1];
  if (last) {
    const ls = sentences(last);
    if (ls[0]) out.add(ls[0]);
  }
  if (all[all.length - 1]) out.add(all[all.length - 1]);
  return [...out];
}

function usedOf(raw: Record<string, unknown>): Variety {
  const u = isObj(raw._used) ? raw._used : {};
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : []);
  const out: Variety = { names: list(u.names), settings: list(u.settings), analogies: list(u.analogies) };
  if (typeof u.approach === "string" && /^[A-E]$/.test(u.approach.trim())) out.approach = u.approach.trim();
  return out;
}

// ---------------------------------------------------------------- exemplar-copy and variety checks (0 calls)

const wordsOf = (t: string): string[] => t.toLowerCase().replace(/’/g, "'").match(/[a-z0-9']+/g) ?? [];
function gramsN(t: string, n: number): Set<string> {
  const ws = wordsOf(t);
  const s = new Set<string>();
  for (let i = 0; i + n <= ws.length; i++) s.add(ws.slice(i, i + n).join(" "));
  return s;
}
const grams8 = (t: string): Set<string> => gramsN(t, 8);
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every reader-visible string of a chapter, grouped by field id. Each string is one leaf (a prompt, one choice, one paragraph
 *  block), so a run of words never spans two leaves. */
function readerLeaves(c: Chapter): Record<string, string[]> {
  const out: Record<string, string[]> = { title: [c.title], hook: [c.hook], counterintuition: [c.counterintuition], tryThisNow: [c.tryThisNow] };
  for (const t of TIERS) out[`breakdown.${t}`] = [c.breakdown[t]];
  c.examples.forEach((e) => {
    out[`examples.${e.exampleId}`] = [e.title, e.scenario, e.whatToDo, e.whyItMatters];
  });
  c.quiz.questions.forEach((q) => {
    out[`quiz.${q.questionId}`] = [q.prompt, ...q.choices, q.explanation];
  });
  c.reviewCards.forEach((r) => {
    out[`reviewCards.${r.cardId}`] = [r.front, r.back];
  });
  out.implementationPlan = [c.implementationPlan.coreSkill, ...c.implementationPlan.ifThenPlans.flatMap((p) => [p.context, p.plan]), c.implementationPlan.twentyFourHourChallenge, c.implementationPlan.weeklyPractice];
  c.memorableLines.forEach((m, i) => {
    out[`memorableLines.${i}`] = [m.text];
  });
  return out;
}

/** Blocking: a name or an eight-word run copied from the exemplar. Reported: a name from the variety ledger (another chapter), a
 *  six-word run shared with another landed chapter's summaries (`earlierTiers`), or an opener that repeats the previous chapter's. */
export function copyAndVarietyIssues(
  c: Chapter,
  ex: Exemplar,
  ledger: VarietyLedger,
  n: number,
  opts: { earlierTiers?: Record<string, string>; approach?: string; expectedApproach?: string } = {},
): { blocking: Issue[]; reported: Issue[] } {
  const blocking: Issue[] = [];
  const reported: Issue[] = [];
  if (opts.expectedApproach && opts.approach && opts.approach !== opts.expectedApproach) {
    reported.push({ source: "det", blocking: false, field: "breakdown.fastRead", text: `opener: the chapter says it opened as ${opts.approach}, the form asked for ${opts.expectedApproach}` });
  }
  const previous = Object.entries(ledger.chapters)
    .filter(([k]) => Number(k.slice(2)) < n)
    .sort(([a], [b]) => Number(b.slice(2)) - Number(a.slice(2)))[0];
  if (previous && previous[1].approach && opts.expectedApproach && previous[1].approach === opts.expectedApproach && ex.approvedSummary.length > 1) {
    reported.push({ source: "det", blocking: false, field: "breakdown.fastRead", text: `opener: the same kind of opener (${opts.expectedApproach}) as ${previous[0]}` });
  }
  if (opts.earlierTiers) {
    const mine = TIERS.map((t) => c.breakdown[t]).join("\n");
    const myGrams = gramsN(mine, 6);
    for (const [ch, text] of Object.entries(opts.earlierTiers)) {
      let hit: string | null = null;
      for (const g of gramsN(text, 6)) {
        if (myGrams.has(g)) {
          hit = g;
          break;
        }
      }
      if (hit) reported.push({ source: "det", blocking: false, field: "breakdown", text: `variety: the words "${hit}" also appear in ${ch}'s summaries` });
    }
  }
  const exGrams = new Set<string>();
  for (const leaves of Object.values(readerLeaves(ex.chapterJson))) for (const leaf of leaves) for (const g of grams8(leaf)) exGrams.add(g);
  const whole = (name: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(name)}(?![\\p{L}\\p{N}_])`, "u");
  const otherNames = new Set<string>();
  for (const [k, v] of Object.entries(ledger.chapters)) if (k !== chapterName(n)) v.names.forEach((x) => otherNames.add(x));
  for (const [id, leaves] of Object.entries(readerLeaves(c))) {
    const text = leaves.join("\n");
    for (const name of ex.names) {
      if (whole(name).test(text)) blocking.push({ source: "det", blocking: true, field: id, text: `exemplar copy: "${name}" is a name from the approved chapter; use a new one` });
    }
    for (const name of ex.sceneNames) {
      if (whole(name).test(text)) reported.push({ source: "det", blocking: false, field: id, text: `exemplar scene: "${name}" appears in the approved chapter's summary; if it is an invented person, use a new one` });
    }
    let copied: string | null = null;
    for (const leaf of leaves) {
      const ws = wordsOf(leaf);
      for (let i = 0; i + 8 <= ws.length && copied === null; i++) {
        const g = ws.slice(i, i + 8).join(" ");
        if (exGrams.has(g)) copied = g;
      }
      if (copied !== null) break;
    }
    if (copied !== null) blocking.push({ source: "det", blocking: true, field: id, text: `exemplar copy: the words "${copied}" also appear in the approved chapter; say it in new words` });
    for (const name of otherNames) {
      if (whole(name).test(text)) reported.push({ source: "det", blocking: false, field: id, text: `variety: "${name}" is already used in another chapter of this book` });
    }
  }
  return { blocking, reported };
}

// ---------------------------------------------------------------- the key solver

interface SolverAnswer {
  questionId: string;
  choice: number;
  alsoDefensible: number[];
  reason: string;
}

function keysolvePrompt(c: Chapter): string {
  const qs = c.quiz.questions;
  const first = qs.slice(0, FIRST_QUESTIONS);
  const rest = qs.slice(FIRST_QUESTIONS);
  const ids = (list: QuizQuestion[]): string => list.map((q) => q.questionId).join(", ");
  return renderTemplate(loadPrompt("keysolve"), {
    P1IDS: ids(first),
    NEWREADER: newReaderText(c),
    P1QUESTIONS: questionsBlock(first),
    P2IDS: rest.length ? ids(rest) : "(none)",
    ALLTIERS: allTiersText(c),
    P2QUESTIONS: rest.length ? questionsBlock(rest) : "(no questions in this part)",
  });
}

function keysolveIssues(c: Chapter, raw: unknown): Issue[] {
  const answers: SolverAnswer[] = (isObj(raw) && Array.isArray(raw.answers) ? raw.answers : [])
    .filter(isObj)
    .map((a) => ({
      questionId: String(a.questionId ?? ""),
      choice: Number(a.choice),
      alsoDefensible: Array.isArray(a.alsoDefensible) ? a.alsoDefensible.map(Number).filter(Number.isInteger) : [],
      reason: String(a.reason ?? ""),
    }));
  const out: Issue[] = [];
  c.quiz.questions.forEach((q, i) => {
    const blocking = i < FIRST_QUESTIONS;
    const a = answers.find((x) => x.questionId === q.questionId);
    if (!a) {
      out.push({ source: "keysolve", blocking, field: `quiz.${q.questionId}`, text: `the solver gave no answer for ${q.questionId}, so its key is not confirmed` });
      return;
    }
    const problems: string[] = [];
    if (a.choice !== q.correctIndex) problems.push(`the solver picked choice ${a.choice}, the key is ${q.correctIndex}`);
    const also = a.alsoDefensible.filter((x) => x !== a.choice);
    if (also.length > 0) problems.push(`the solver found choice ${also.join(" and ")} also defensible`);
    if (/^\s*NOT IN TEXT/i.test(a.reason)) problems.push("the text does not settle the question");
    if (problems.length > 0) out.push({ source: "keysolve", blocking, field: `quiz.${q.questionId}`, text: `${problems.join("; ")}. Solver's reason: ${a.reason}` });
  });
  return out;
}

// ---------------------------------------------------------------- one chapter

interface Round {
  chapter: Chapter;
  blocking: Issue[];
  reported: Issue[];
  advisory: string[];
}

/** The summaries of every other landed chapter (the exemplar included), by chapter name, for the cross-chapter variety check. */
function earlierTiers(ctx: PipelineCtx, n: number, ex: Exemplar): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(ctx.config.runDir)) return out;
  for (const f of fs.readdirSync(ctx.config.runDir)) {
    if (!/^ch\d+$/.test(f) || f === chapterName(n) || f === chapterName(ex.chapter)) continue;
    const c = readJson<Chapter>(path.join(ctx.config.runDir, f, "final.json"));
    if (c?.breakdown) out[f] = TIERS.map((t) => c.breakdown[t] ?? "").join("\n");
  }
  return out;
}

async function checkRound(
  ctx: PipelineCtx,
  n: number,
  round: number,
  chapter: Chapter,
  lesson: LessonCard,
  ex: Exemplar,
  bdir: string,
  opts: { approach?: string; expectedApproach?: string } = {},
): Promise<Round> {
  const knowledge = ctx.source.mode === "knowledge";
  const { bookId, title, author, categories, tags, bookType } = ctx.config;
  const checkCtx: CheckContext = {
    n,
    book: { bookId, title, author, categories, tags, bookType },
    authorText: knowledge ? "" : writerForm(spanText(ctx.source, n)).text,
    shape: ctx.config.shape,
    earlierLessons: [],
  };
  const det = await runChecks(chapter, lesson, checkCtx);
  writeJson(path.join(bdir, `r${round}.checks.json`), det);
  const blocking: Issue[] = [...det.blocking];
  const reported: Issue[] = [...det.reported];
  if (det.blocking.some((i) => i.text.startsWith("shape:"))) return { chapter, blocking, reported, advisory: det.advisory };

  const copy = copyAndVarietyIssues(chapter, ex, readVariety(ctx), n, { earlierTiers: earlierTiers(ctx, n, ex), approach: opts.approach, expectedApproach: opts.expectedApproach });
  blocking.push(...copy.blocking);
  reported.push(...copy.reported);

  const tiers = TIERS.map((t) => `[${t}]\n${chapter.breakdown[t]}`).join("\n\n");
  const factPrompt = renderTemplate(loadPrompt(knowledge ? "variants-factcheck-knowledge" : "variants-factcheck"), {
    KNOWN_TRAPS: knownTrapsSection(ctx.knownTraps[n] ?? []),
    LESSON: lessonText({ ...lesson, whyThisOne: "" }),
    SUMMARIES: tiers,
    KEYS: keysBlock(ctx, n),
    ...(knowledge ? { BOOK_SECTION: ctx.bookSection } : { SOURCE: writerFormText(spanText(ctx.source, n)) }),
  });
  const [fact, solve] = await Promise.all([
    callShaped(ctx, n, { role: ctx.config.checker, prompt: factPrompt, step: `r${round}.factcheck`, kind: "other", errors: (v) => (isObj(v) && Array.isArray(v.issues) ? [] : ["answer must be an object with an issues array"]), outPrefix: path.join(bdir, "calls", `r${round}.factcheck`), ledgerStep: "book-factcheck" }),
    callShaped(ctx, n, { role: ctx.config.solver, prompt: keysolvePrompt(chapter), step: `r${round}.keysolve`, kind: "other", errors: (v) => (isObj(v) && Array.isArray(v.answers) ? [] : ["answer must be an object with an answers array"]), outPrefix: path.join(bdir, "calls", `r${round}.keysolve`), ledgerStep: "book-keysolve" }),
  ]);
  const factIssues = ((fact as { issues: unknown[] }).issues.filter(isObj) as unknown as Partial<FactIssue>[]).map((i) => ({
    source: "fact" as const,
    blocking: true,
    field: `breakdown.${String(i.variant ?? "fullRead")}`,
    text: `${String(i.kind ?? "OTHER")} (${String(i.verdict ?? "UNSUPPORTED")}): "${String(i.chapterText ?? "")}" | book: ${String(i.sourceText ?? "none")} | fix: ${String(i.fix ?? "")}`,
  }));
  blocking.push(...factIssues);
  const keys = keysolveIssues(chapter, solve);
  blocking.push(...keys.filter((i) => i.blocking));
  reported.push(...keys.filter((i) => !i.blocking));
  return { chapter, blocking, reported, advisory: det.advisory };
}

/** Writes chapter n in the exemplar's form, checks it, fixes once, and lands it. Returns the status; a resumed chapter returns its saved one. */
export async function writeBookChapter(ctx: PipelineCtx, n: number, ex: Exemplar, opts: { force?: boolean } = {}): Promise<BookChapterStatus> {
  if (n === ex.chapter) throw new Error(`EXEMPLAR_CHAPTER: ${chapterName(n)} is the exemplar; it is not rewritten`);
  const dir = path.join(ctx.config.runDir, chapterName(n));
  const bdir = path.join(dir, "book");
  const statusFile = path.join(dir, "status.json");
  const existing = readJson<BookChapterStatus>(statusFile);
  if (existing?.book === true && !opts.force) return existing;
  if (opts.force) {
    fs.rmSync(bdir, { recursive: true, force: true });
    for (const f of ["final.json", "status.json", "lesson.json"]) fs.rmSync(path.join(dir, f), { force: true });
  }
  fs.mkdirSync(bdir, { recursive: true });
  const prefix = (step: string): string => path.join(bdir, "calls", step);
  const knowledge = ctx.source.mode === "knowledge";

  // 1. The lesson, with every lesson this book already teaches off limits.
  const taught = fs.existsSync(ctx.config.runDir)
    ? fs
        .readdirSync(ctx.config.runDir)
        .filter((f) => /^ch\d+$/.test(f) && f !== chapterName(n))
        .flatMap((f) => {
          const card = readJson<LessonCard>(path.join(ctx.config.runDir, f, "lesson.json"));
          return card ? [card.lesson] : [];
        })
    : [];
  let lessons = readJson<{ lessons: LessonCandidate[] }>(path.join(bdir, "lessons.json"))?.lessons ?? null;
  if (!lessons) {
    const raw = (await callShaped(ctx, n, { role: ctx.config.writer, prompt: lessonsPrompt(ctx, n, taught), step: "lessons", kind: "write", errors: lessonsShapeErrors, outPrefix: prefix("lessons"), ledgerStep: "book-lessons" })) as { lessons: LessonCandidate[] };
    lessons = raw.lessons;
    writeJson(path.join(bdir, "lessons.json"), { lessons });
  }
  const candidate = lessons[0];
  const lesson: LessonCard = { lesson: candidate.lesson, wrongBelief: candidate.wrongBelief, keyPhrase: candidate.keyPhrase, hookQuestion: candidate.hookQuestion, storyNames: candidate.storyNames, evidence: candidate.evidence };
  const expectedApproach = summaryApproachFor(ex, n);

  // 2. The chapter, in the exemplar's form.
  let chapter = readJson<Chapter>(path.join(bdir, "r0.chapter.json"));
  let used = readJson<Variety>(path.join(bdir, "used.json"));
  if (!chapter || !used) {
    const titles = Object.fromEntries(ctx.source.spans.map((s) => [s.chapterNumber, s.chapterTitle]));
    const { SOURCE_RULES, QUOTE_RULE, SOURCE_BLOCK } = sourceVars(ctx, n);
    const notes = Object.entries(ex.notes).map(([k, v]) => `${k}: ${v}`).join(" | ") || "(none)";
    const prompt = renderTemplate(loadPrompt("write-exemplar"), {
      BOOK_SECTION: ctx.bookSection,
      HEADER: chapterHeaderWithLessons(n, titles, taught),
      SOURCE_RULES,
      QUOTE_RULE,
      SOURCE_BLOCK,
      NOTES: notes,
      FORM: formText(ex, expectedApproach),
      USED: usedText(readVariety(ctx), ex, n),
      KEYS: keysBlock(ctx, n),
      MEMORABLE_RULE: knowledge ? "" : ", up to 2 more {\"text\"} objects with the author's exact words from the source that carry the same lesson (most chapters need none)",
      PLAIN: loadPrompt("variants-plain"),
      LESSON: lessonText(candidate),
      EXEMPLAR: JSON.stringify(ex.chapterJson, null, 1),
    });
    const raw = (await callShaped(ctx, n, { role: ctx.config.writer, prompt, step: "write", kind: "write", errors: chapterShapeErrors, outPrefix: prefix("write"), ledgerStep: "book-write" })) as Record<string, unknown>;
    used = usedOf(raw);
    const { _used, ...rest } = raw;
    void _used;
    chapter = rest as unknown as Chapter;
    writeJson(path.join(bdir, "r0.chapter.json"), chapter);
    writeJson(path.join(bdir, "used.json"), used);
  }

  // 3. Checks, one fix round on blocking issues, checks again.
  let round = 0;
  const checkOpts = { approach: used.approach, expectedApproach };
  let r = await checkRound(ctx, n, round, chapter, lesson, ex, bdir, checkOpts);
  let fixed = false;
  const fixable = r.blocking.filter((i) => !i.text.startsWith("shape:"));
  if (fixable.length > 0 && !r.blocking.some((i) => i.text.startsWith("shape:"))) {
    const applied = await fixRound(ctx, n, chapter, lesson, fixable, bdir, round);
    if (applied) {
      chapter = applied;
      round = 1;
      r = await checkRound(ctx, n, round, chapter, lesson, ex, bdir, checkOpts);
      fixed = true;
    }
  }

  // 4. Land it.
  const label = `${ctx.config.bookId}/${chapterName(n)}`;
  const spend = round4(readLedger(ctx.ledgerPath).filter((x) => x.chapter === label).reduce((s, x) => s + x.cost, 0));
  const status: BookChapterStatus = {
    chapter: n,
    stage: r.blocking.length > 0 ? "open-issues" : "clean",
    round,
    rerun: false,
    lessonRating: "UNKNOWN",
    open: [...r.blocking, ...r.reported.map((i) => ({ ...i, leftover: true as const }))],
    spend,
    lesson: lesson.lesson,
    book: true,
    exemplar: ex.chapter,
    fixed,
  };
  writeJson(path.join(dir, "final.json"), chapter);
  writeJson(path.join(dir, "lesson.json"), lesson);
  writeJson(statusFile, status);
  writeVariety(ctx, n, {
    ...used,
    names: [...new Set([...used.names, ...extractNames(chapter, lesson.storyNames, "invented")])].sort(),
    approach: used.approach ?? expectedApproach,
    openers: openerSentences(chapter, lesson.storyNames),
  });
  const flag = status.stage === "clean" ? "" : `${status.stage}: ${r.blocking.length} open`;
  const body = renderChapter({ ...chapter, number: n }, { label: flag, bookLine: `${ctx.config.title} by ${ctx.config.author}`, uid: `v${n}`, authorAdvice: keysFor(ctx, n) });
  const reading = path.join(ctx.config.runDir, "reading", `${chapterName(n)}.html`);
  fs.mkdirSync(path.dirname(reading), { recursive: true });
  fs.writeFileSync(reading, page(`${ctx.config.title}: chapter ${n}`, body));
  return status;
}

/** One fix call on the given issues (smallest find/replace edits, key changes); the edited chapter, or null when nothing applied. */
async function fixRound(ctx: PipelineCtx, n: number, chapter: Chapter, lesson: LessonCard, issues: Issue[], bdir: string, round: number): Promise<Chapter | null> {
  const knowledge = ctx.source.mode === "knowledge";
  const issuesText = issues.map((i, k) => `${k + 1}. [${i.field ?? "(chapter)"}] ${i.text}`).join("\n");
  const fixPrompt = knowledge
    ? renderTemplate(loadPrompt("fix-knowledge"), { BOOK_SECTION: ctx.bookSection, ISSUES: issuesText, LESSON: JSON.stringify(lesson, null, 2), CHAPTER: readerText(chapter), KEYS: keysBlock(ctx, n) })
    : renderTemplate(loadPrompt("fix"), { ISSUES: issuesText, LESSON: JSON.stringify(lesson, null, 2), CHAPTER: readerText(chapter), SOURCE: writerFormText(spanText(ctx.source, n)) });
  const fixRaw = await callShaped(ctx, n, { role: ctx.config.writer, prompt: fixPrompt, step: `r${round}.fix`, kind: "fix", errors: (v) => (isObj(v) ? [] : ["answer must be an object"]), outPrefix: path.join(bdir, "calls", `r${round}.fix`), ledgerStep: "book-fix" });
  const applied = applyFix(chapter, fixRaw as FixOutput);
  writeJson(path.join(bdir, `r${round}.fix-applied.json`), { applied: applied.applied, errors: applied.errors });
  if (applied.applied === 0) return null;
  writeJson(path.join(bdir, `r${round + 1}.chapter.json`), applied.chapter);
  return applied.chapter;
}

/** A landed chapter (assembled, or written here) that still has blocking issues in its status: one fix round on those issues,
 *  then the checks again, and final.json, status.json and the reading page are rewritten. Returns the new status. */
export async function fixLanded(ctx: PipelineCtx, n: number): Promise<ChapterStatus> {
  const dir = path.join(ctx.config.runDir, chapterName(n));
  const chapter = readJson<Chapter>(path.join(dir, "final.json"));
  const status = readJson<ChapterStatus>(path.join(dir, "status.json"));
  const lesson = readJson<LessonCard>(path.join(dir, "lesson.json"));
  if (!chapter || !status || !lesson) throw new Error(`NO_FINAL_CHAPTER: ${chapterName(n)} has no final.json, status.json and lesson.json`);
  const issues = status.open.filter((i) => i.blocking && !i.text.startsWith("shape:"));
  if (issues.length === 0) return status;
  const bdir = path.join(dir, "book");
  const round = (status.round ?? 0) + 1;
  const applied = await fixRound(ctx, n, chapter, lesson, issues, bdir, status.round ?? 0);
  if (!applied) return status;
  // Checks need an exemplar for the copy check; a chapter that is itself the exemplar is checked against nothing.
  const exemplarFile = path.join(ctx.config.runDir, "exemplars", `${chapterName(n)}.json`);
  const ex: Exemplar = fs.existsSync(exemplarFile) ? { ...loadExemplar(ctx, n), chapterJson: emptyChapter(), names: [], sceneNames: [] } : loadExemplar(ctx);
  const r = await checkRound(ctx, n, round, applied, lesson, ex, bdir);
  const label = `${ctx.config.bookId}/${chapterName(n)}`;
  const spend = round4(readLedger(ctx.ledgerPath).filter((x) => x.chapter === label).reduce((s, x) => s + x.cost, 0));
  const next: ChapterStatus & { fixed: true } = {
    ...status,
    stage: r.blocking.length > 0 ? "open-issues" : "clean",
    round,
    open: [...r.blocking, ...r.reported.map((i) => ({ ...i, leftover: true as const }))],
    spend,
    fixed: true,
  };
  writeJson(path.join(dir, "final.json"), applied);
  writeJson(path.join(dir, "status.json"), next);
  const flag = next.stage === "clean" ? "" : `${next.stage}: ${r.blocking.length} open`;
  const body = renderChapter({ ...applied, number: n }, { label: flag, bookLine: `${ctx.config.title} by ${ctx.config.author}`, uid: `v${n}`, authorAdvice: keysFor(ctx, n) });
  const reading = path.join(ctx.config.runDir, "reading", `${chapterName(n)}.html`);
  fs.mkdirSync(path.dirname(reading), { recursive: true });
  fs.writeFileSync(reading, page(`${ctx.config.title}: chapter ${n}`, body));
  return next;
}

/** A chapter with nothing in it, so the copy check has nothing to match. */
function emptyChapter(): Chapter {
  return {
    title: "", hook: "", counterintuition: "", keyTakeaway: "", tryThisNow: "",
    breakdown: { fastRead: "", deepRead: "", fullRead: "" },
    examples: [], quiz: { passingScorePercent: 70, questions: [] }, reviewCards: [],
    implementationPlan: { coreSkill: "", ifThenPlans: [], twentyFourHourChallenge: "", weeklyPractice: "" },
    memorableLines: [],
  };
}

function chapterHeaderWithLessons(n: number, titles: Record<number, string>, taught: string[]): string {
  const total = Math.max(...Object.keys(titles).map(Number));
  const prev = Object.hasOwn(titles, n - 1) ? `The previous chapter is "${titles[n - 1]}".` : "This is the first chapter of the book.";
  const next = Object.hasOwn(titles, n + 1) ? `The next chapter is "${titles[n + 1]}".` : "This is the last chapter of the book.";
  let head = `CHAPTER ${n} of ${total}: "${titles[n]}". ${prev} ${next} Write only this chapter.`;
  if (taught.length > 0) head += `\nLessons already taught by other chapters of this book (teach none of these again):\n${taught.map((l) => `- ${l}`).join("\n")}`;
  return head;
}

// ---------------------------------------------------------------- the book

const isStop = (e: unknown): boolean => typeof e === "object" && e !== null && "exitCode" in e;

/** Writes the chapters that are not the exemplar, `concurrency` at a time, resuming from files. A usage limit, the budget or a
 *  config problem stops the run; any other failure is recorded per chapter and the run goes on. */
export async function runBookChapters(ctx: PipelineCtx, chapters: number[], opts: { exemplar?: number; force?: boolean } = {}): Promise<BookChapterStatus[]> {
  const ex = loadExemplar(ctx, opts.exemplar);
  const todo = chapters.filter((n) => n !== ex.chapter);
  const out: BookChapterStatus[] = new Array(todo.length);
  let next = 0;
  let fatal: unknown = null;
  const worker = async (): Promise<void> => {
    while (fatal === null && next < todo.length) {
      const i = next++;
      const n = todo[i]!;
      try {
        out[i] = await writeBookChapter(ctx, n, ex, { force: opts.force });
      } catch (e) {
        if (isStop(e)) {
          fatal ??= e;
        } else {
          const error = e instanceof Error ? e.message : String(e);
          out[i] = { chapter: n, stage: "failed", round: 0, rerun: false, lessonRating: "UNKNOWN", open: [{ source: "det", blocking: true, text: `RUN_FAILED: ${error}` }], spend: 0, lesson: "", error, book: true, exemplar: ex.chapter, fixed: false };
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(ctx.config.concurrency, todo.length)) }, worker));
  if (fatal !== null) throw fatal;
  return out.filter(Boolean);
}

/** Names used by more than one chapter (the exemplar included), for the run report. */
export function duplicateNames(ctx: PipelineCtx, ex: Exemplar): Array<{ name: string; chapters: string[] }> {
  const where = new Map<string, Set<string>>();
  const add = (name: string, ch: string): void => {
    if (!where.has(name)) where.set(name, new Set());
    where.get(name)!.add(ch);
  };
  ex.names.forEach((x) => add(x, chapterName(ex.chapter)));
  for (const [ch, v] of Object.entries(readVariety(ctx).chapters)) v.names.forEach((x) => add(x, ch));
  return [...where.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([name, s]) => ({ name, chapters: [...s].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One reading page holding several chapters, in order, with a nav. */
export function renderPack(ctx: PipelineCtx, chapters: number[], title: string): string {
  const sections: string[] = [];
  const nav: string[] = [];
  for (const n of chapters) {
    const c = readJson<Chapter>(path.join(ctx.config.runDir, chapterName(n), "final.json"));
    if (!c) throw new Error(`NO_FINAL_CHAPTER: ${chapterName(n)} has no final.json`);
    const st = readJson<ChapterStatus>(path.join(ctx.config.runDir, chapterName(n), "status.json"));
    const label = st && st.stage !== "clean" ? `${st.stage}: ${st.open.filter((i) => i.blocking).length} open` : "";
    nav.push(`<a href="#v${n}">Ch ${n}</a>`);
    sections.push(renderChapter({ ...c, number: n }, { label, bookLine: `${ctx.config.title} by ${ctx.config.author}`, uid: `v${n}`, authorAdvice: keysFor(ctx, n) }));
  }
  return page(title, `<h1>${title}</h1><div class="nav">${nav.join("")}</div>${sections.join("\n")}`);
}
