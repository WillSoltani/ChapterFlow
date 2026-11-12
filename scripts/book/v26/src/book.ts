/** The exemplar-driven book writer: every chapter written in the form of a chapter the owner approved. Per chapter: the
 *  lessons call (five candidates, the book's taught lessons off limits), one writer call with the exemplar, the picked
 *  approach rules, the owner's notes and the variety ledger, the 0-call checks (plus exemplar-copy and variety checks),
 *  the fact check of the three summary lengths, the blind key solver, at most one fix round on blocking issues, then
 *  final.json, status.json, lesson.json, the reading page and the ledger entry. Resumes from files. */
import * as fs from "node:fs";
import * as path from "node:path";
import { approach } from "./approaches";
import { chapterShapeErrors } from "./assemble";
import type { BookConfig } from "./config";
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
  /** True when the exemplar is a chapter of this book (then that chapter is never rewritten); false for a house exemplar
   *  from another book, where every chapter of this book is written. */
  own: boolean;
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
    "monday tuesday wednesday thursday friday saturday sunday mondays tuesdays wednesdays thursdays fridays saturdays sundays january february march april may june july august september october november december " +
    "write send ask tell thank share open pick give take make do does did done is are was were be been being have has had can could should would " +
    "will may might must let think picture imagine instead still even also only just with without from for to in on at by of as like than because " +
    "while until unless although though since where whether yet nothing something anything everything none both either neither much more less " +
    "few little big small good bad new old keep put set get go come say see look find fix try use need want start stop turn bring hold call name " +
    "note list plan step move rule lesson chapter book author example examples front back question questions card cards summary practice quiz " +
    "people someone nobody everyone anyone actually really maybe perhaps first second third next last before after again back scold ignore naming " +
    "review read reading learn learning work works school home personal money health relationships team boss manager friend coworker " +
    "pass fail yes no okay fine nice great right wrong true false one two three four five six seven eight nine ten half part whole " +
    "king queen prince duke lord sir mr mrs ms dr france england britain europe america italy spain germany china japan russia rome paris london florence venice " +
    "spanish french english german italian portuguese chinese japanese korean arabic hindi russian greek latin dutch swedish turkish polish irish " +
    "american british canadian european african asian mexican indian study"
  ).split(" "),
);

/** The book's own capitalized terms (Anchor, Ability Chain, Focus Mapping): every capitalized word inside a sentence of any
 *  chapter's keys, plus the words of the chapter titles, the book's title and the author's name. None of them is an
 *  invented person, so none is renamed or put off limits for later chapters. */
export function bookTerms(ctx: PipelineCtx): string[] {
  const out = new Set<string>();
  const add = (t: string, all: boolean): void => {
    for (const sentence of t.split(/(?<=[.!?:])\s+/)) {
      sentence.split(/\s+/).forEach((w, i) => {
        const word = w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").replace(/['’]s$/, "");
        if (/^[A-Z][a-z]{2,}$/.test(word) && (all || i > 0)) out.add(word);
      });
    }
  };
  add(`${ctx.config.title} ${ctx.config.author}`, true);
  for (const c of ctx.config.chapters ?? []) {
    add(c.title, true);
    add(c.keys ?? "", false);
  }
  return [...out].sort();
}

/** Capitalized words that look like the invented first names of a chapter, in every reader-visible field. A word counts when
 *  it appears inside a sentence (not as its first word) at least once, or as a possessive ("Kenji's shift"); a word that
 *  only ever starts sentences ("Within a week...", "Cut the talk."), one that also appears in lowercase anywhere in the
 *  chapter, a royal or geographic word, and the book's story names (the lesson card's storyNames) are left out. */
export function extractNames(c: Chapter, storyNames: string[] = [], fields: "invented" | "all" = "all"): string[] {
  const texts = [
    c.hook,
    c.counterintuition,
    c.tryThisNow,
    ...(fields === "all" ? TIERS.map((t) => c.breakdown[t]) : []),
    // Example titles are Title Case ("Keep the Plan Within Reach"), so every word in them would look like a name.
    ...c.examples.flatMap((e) => [e.scenario, e.whatToDo, e.whyItMatters]),
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
  const count = new Map<string, { starts: number; mid: number; poss: number }>();
  for (const text of texts) {
    // Sentences: split on a terminator, with any closing quote or bracket after it ('problem." Within a day'), or a line
    // break, followed by space; quotes and brackets around a sentence start are stripped.
    for (const sentence of text.split(/(?<=[.!?]["'”’)\]]*)\s+|\n+/)) {
      const words = sentence.replace(/^[\s"'“‘(\[]+/, "").match(/[A-Za-z][A-Za-z'’]*/g) ?? [];
      words.forEach((raw, i) => {
        const w = raw.replace(/['’]s?$/, "");
        if (!/^[A-Z][a-z]{2,}$/.test(w)) return;
        const e = count.get(w) ?? { starts: 0, mid: 0, poss: 0 };
        if (i === 0) e.starts++;
        else e.mid++;
        if (/['’]s$/.test(raw)) e.poss++;
        count.set(w, e);
      });
    }
  }
  return [...count.entries()]
    // A word that only ever starts sentences is an opener ("Within a week...", "Cut the talk.", "Believing..."), not a name,
    // unless it also owns something ("Kenji's shift"): openers never take a possessive.
    .filter(([w, e]) => !NOT_NAMES.has(w.toLowerCase()) && !story.has(w.toLowerCase()) && !lowercaseToo.has(w.toLowerCase()) && (e.mid > 0 || e.poss > 0))
    .map(([w]) => w)
    .sort();
}

/** The exemplar: exemplars/chNN.json (picks, notes) plus the chapter as it stands now in chNN/final.json. */
export function loadExemplar(ctx: PipelineCtx, n?: number): Exemplar {
  const from = ctx.config.exemplarFrom;
  const base = from?.runDir ?? ctx.config.runDir;
  const own = base === ctx.config.runDir;
  const dir = path.join(base, "exemplars");
  let pick = n ?? from?.chapter;
  if (pick === undefined) {
    const found = fs.existsSync(dir) ? fs.readdirSync(dir).flatMap((f) => (/^ch(\d+)\.json$/.test(f) ? [Number(/^ch(\d+)\.json$/.exec(f)![1])] : [])) : [];
    if (found.length === 0) throw new Error(`NO_EXEMPLAR: no exemplar under ${dir}; assemble an approved chapter first`);
    pick = Math.max(...found);
  }
  const rec = readJson<{ picks: Exemplar["picks"]; notes: Record<string, string>; lesson?: LessonCard; approved?: { summary?: string[] }; bookNames?: string[] }>(
    path.join(dir, `${chapterName(pick)}.json`),
  );
  if (!rec) throw new Error(`NO_EXEMPLAR: ${path.join(dir, `${chapterName(pick)}.json`)} does not exist`);
  const chapterJson = readJson<Chapter>(path.join(base, chapterName(pick), "final.json"));
  if (!chapterJson) throw new Error(`NO_EXEMPLAR: ${chapterName(pick)} has no final.json under ${base}`);
  // The book's own people: the record's list, else every candidate lesson's storyNames from the variants page, else the lesson card.
  const candidates = readJson<{ lessons: Array<{ storyNames?: string[] }> }>(path.join(base, chapterName(pick), "variants", "lessons.json"));
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
    own,
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

const EVIDENCE_NOTE = `"The book's evidence" is the chapter's story told plainly or, when the chapter has no story of its own, the author's method worked through one everyday case.`;
/** The line under the hook: six frames, all belief, then correction, then reason. Eight frames of different builds were
 *  tried (2026-11-12, three proofs): readers of one chapter scored the first screen 0.3 to 0.4 lower every time, and
 *  readers of the whole book still saw the same myth-then-correction move, so the plain six stay. */
const COUNTER_FRAMES = [
  `"Many people think [the belief]. Actually [the correction], because [the reason]."`,
  `"It feels natural to [the belief]. But [the correction], because [the reason]."`,
  `"You have probably been told [the belief]. The trouble is [the reason], so [the correction]."`,
  `"[The belief, the way people say it]. It sounds right, and it fails for one reason: [the reason]. [The correction]."`,
  `"The usual advice is [the belief]. [The correction] works better, because [the reason]."`,
  `"We tend to [the belief]. What works is [the correction], since [the reason]."`,
];
/** The form of a summary's last sentence. It always states the lesson; the form moves, so a book does not close every
 *  chapter on the same kind of slogan. The first is the house exemplar's own. */
const ENDINGS = [
  "a plain instruction, verb first, with what it brings",
  "what changes once the reader does it, said as a fact about them, not as a command",
  "a contrast in one sentence: what to stop doing, and what to do in its place",
  "a plain truth about how people work, in the present tense, that carries the move, with no 'you' and no command",
  "an if-then in the second person: when the situation comes up, the move, and what it brings",
];
/** The one piece of common advice from outside the chapter that a quiz may use as a wrong choice. With none named, every
 *  quiz of a book reaches for the same two or three, and a reader strikes them out unread by chapter three. */
const OUTSIDE_FIXES = [
  "bringing someone else in (to check on you, back you up or decide for you)",
  "putting it in writing (a note, a list, a reminder, an email)",
  "asking for the payoff straight away (a reward, a treat, the credit, a raise)",
  "explaining why it matters, to yourself or to the other person",
  "more pressure (a stricter rule, a deadline, a firmer word)",
  "doing more of it, or a bigger version",
  "waiting for a better moment",
  "finding out more about it first",
];
/** Where each kind of example is set, so a book does not hold eight evening classes and eight offices. The first entry of
 *  each list is the house exemplar's own setting (chapter 1 of a book lands there). */
const SETTINGS: Record<string, string[]> = {
  work: ["an office or a sales team", "a shop, a cafe or a restaurant", "a trade or a workshop (a plumber, a mechanic, a builder)", "a hospital, a clinic or a care home", "freelance work or working from home", "a warehouse, a depot or a job on the road", "a one-person business (a market stall, a van, an online shop)", "a school or a nursery from the staff's side"],
  school: ["a teenager at school", "a university or college student", "an adult in an evening or online course", "a parent helping a child with schoolwork", "a learner with a teacher (music, a sport, driving, a language)", "a trainee or an apprentice"],
  personal: ["family (a parent, a child, a sibling, an aunt)", "money", "health or fitness", "friends", "home and chores", "a hobby", "neighbours or a local group", "a partner"],
};
/** What makes the third example harder than the first. */
const HARD_CASES = [
  "a strong feeling is in the way (pride, embarrassment, anger or fear)",
  "another person disagrees or pushes back",
  "the right move was tried once, did not work, and needs one adjustment",
  "there is almost no time",
];
/** What the hook is built on, so a book does not open eight chapters on an object that has sat unused for weeks. */
const HOOK_KINDS = [
  "a moment in progress, in the present tense (what the reader is doing or about to do)",
  "a blunt claim with a turn in it",
  "something people tell themselves, reported without quotation marks, and what it gets wrong",
  "an object or a place that shows the problem",
  "two outcomes set side by side",
];
/** What the try-this line asks for, so it is not always something to write down tonight. */
const TRY_KINDS = [
  "do the smallest version of the move once, now or at a named moment today",
  "move, set out or put away one object",
  "say or ask one thing to one person today",
  "write one line and put it where it will be seen",
];
/** The kinds of moment an if-then cue names. */
const CUE_KINDS = [
  "a routine moment of the day or the week (right after something the reader always does)",
  "a thought the reader catches themselves having",
  "the moment the reader notices the very slip this lesson is about",
  "arriving somewhere, or sitting down to something",
];
/** Example 1 is the one a reader sees first, so it is never the school one. */
const TAG_ORDERS = [
  ["work", "school", "personal"],
  ["personal", "work", "school"],
  ["work", "personal", "school"],
  ["personal", "school", "work"],
];
/** Balanced key rows for seven three-choice questions: every position is the key at least twice, the first five use all three, and question 1's key moves from chapter to chapter. */
const KEY_ROWS = [
  [0, 2, 1, 1, 0, 2, 0],
  [1, 0, 2, 0, 1, 2, 1],
  [2, 1, 0, 2, 2, 0, 1],
  [0, 1, 2, 0, 2, 1, 2],
  [1, 2, 0, 1, 0, 2, 0],
  [2, 0, 1, 2, 1, 0, 1],
];
/** Five forms for seven questions. Five more were tried in three proofs (2026-11-12) and are gone: "which comes first"
 *  and "what is missing" asked for an order or a piece most lessons do not teach (a checker marked two such questions
 *  wrong), "who got it right" turned into one right-person-wrong-reason trick in chapter after chapter, "where does it
 *  apply" left wrong choices a reader could rule out on sight, and "what would you change" won nothing with readers. */
const QUIZ_FORMS = ["what do you do", "spot the trap", "predict what happens", "best reply", "why does this work"];
const CARD_FORMS = ["situation to move", "why question", "finish the sentence", "what went wrong", "the lesson in the reader's own words"];
const turn = (n: number, k: number): number => (((n - 1) % k) + k) % k;

/** Where the right choice sits in each question of chapter n. */
export function keyPositions(n: number, questions: number, choices: number): number[] {
  if (questions === 7 && choices === 3) return KEY_ROWS[turn(n, KEY_ROWS.length)]!;
  return Array.from({ length: questions }, (_, i) => (i + turn(n, choices)) % choices);
}

/** The plan the writer gets for chapter n: the opener and its path, the length ceilings, and the orders that change from
 *  chapter to chapter (counterintuition frame, the form of the last sentence, example tags, quiz and card forms, key
 *  positions and the one outside fix). Everything is a
 *  function of the chapter number, so chapters written in parallel cannot land on the same shape. */
export function formText(ex: Exemplar, summaryLabel: string = ex.picks.summary.label, n: number = ex.chapter, shape?: BookConfig["shape"]): string {
  const c = ex.chapterJson;
  const rule = (comp: Component, label: string = ex.picks[comp].label): string => {
    const a = approach(comp, label);
    return `${a.label}, "${a.name}": ${a.rule}`;
  };
  const opener = approach("summary", summaryLabel);
  const openerNote =
    summaryLabel === ex.picks.summary.label
      ? ""
      : ` (The exemplar opens as ${ex.picks.summary.label}, "${approach("summary", ex.picks.summary.label).name}"; THIS chapter opens as ${summaryLabel} instead. Follow the path given here, not the exemplar's.)`;
  const avg = (xs: number[]): number => Math.round(xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length));
  const tier = (t: "fastRead" | "deepRead" | "fullRead"): string =>
    shape
      ? `${t} ${t === "fastRead" ? `${shape[t][0]} to ${shape[t][1]}` : `up to ${shape[t][1]}`} words in at most ${paragraphs(c.breakdown[t])} paragraphs`
      : `${t} up to ${wordsIn(c.breakdown[t])} words in at most ${paragraphs(c.breakdown[t])} paragraphs`;
  const inOrder = (forms: string[], count: number, id: string): string => {
    const start = turn(n, forms.length);
    return Array.from({ length: count }, (_, i) => `${id}${i + 1} ${forms[(start + i) % forms.length]}`).join("; ");
  };
  const questions = c.quiz.questions.length;
  const choices = c.quiz.questions[0]?.choices.length ?? 3;
  const quiz = ex.picks.quiz.label === "E" ? `E, "one of each": the forms in this order: ${inOrder(QUIZ_FORMS, questions, "q")}.` : rule("quiz");
  const cards = ex.picks.cards.label === "E" ? `E, "mixed": the forms in this order: ${inOrder(CARD_FORMS, c.reviewCards.length, "rc")}.` : rule("cards");
  const tags = TAG_ORDERS[turn(n, TAG_ORDERS.length)]!.slice(0, c.examples.length);
  // Strides that share no factor with the list lengths, so the three settings of a chapter move independently.
  const setting = (tag: string): string => {
    const list = SETTINGS[tag] ?? SETTINGS.personal!;
    const stride = tag === "school" ? 5 : tag === "personal" ? 3 : 1;
    return list[(((n - 1) * stride) % list.length + list.length) % list.length]!;
  };
  // Chapter 1 says who the author is; a reader of the book does not need telling again in every chapter after it.
  const author = n === 1 ? "Where the author is first named, say who they are in a few words." : "Name the author by full name at first mention, with no job title or credentials (the reader met them in chapter 1); where the author is a person in this chapter's own story, say who they were at that point in it, as for anyone else in the story.";
  const cueKinds = (count: number): string[] => Array.from({ length: count }, (_, i) => CUE_KINDS[(turn(n, CUE_KINDS.length) + i * 2 + (i > 1 ? 1 : 0)) % CUE_KINDS.length]!);
  return [
    `- summary (hook, counterintuition, the three lengths, tryThisNow, memorable line): ${opener.label}, "${opener.name}": ${opener.rule}${opener.path ? ` Path: ${opener.path} ${EVIDENCE_NOTE}` : ""}${openerNote} Ceilings (a chapter with less to say is shorter): hook 25 words; counterintuition 45 words; ${tier("fastRead")}; ${tier("deepRead")}; ${tier("fullRead")}; tryThisNow 25 words. The hook is built on ${HOOK_KINDS[turn(n, HOOK_KINDS.length)]}. The try-this line asks the reader to ${TRY_KINDS[turn(n, TRY_KINDS.length)]}. The last sentence of each length states the lesson as ${ENDINGS[turn(n, ENDINGS.length)]}; where the path ends on a question answered, this sentence is the answer, in this form. ${author}`,
    `- counterintuition frame: ${COUNTER_FRAMES[turn(n, COUNTER_FRAMES.length)]}`,
    `- examples: ${c.examples.length} examples, doing the three jobs the field rules give (the ordinary situation, the fix already tried, the harder situation). Scenario about ${avg(c.examples.map((e) => wordsIn(e.scenario)))} words (70 at most), whatToDo about ${avg(c.examples.map((e) => wordsIn(e.whatToDo)))} (30 at most), whyItMatters about ${avg(c.examples.map((e) => wordsIn(e.whyItMatters)))} (25 at most). Tags and settings for examples 1 to ${tags.length}, in this order: ${tags.map((t) => `${t} (${setting(t)})`).join("; ")}. What makes example ${tags.length} the harder one: ${HARD_CASES[turn(n, HARD_CASES.length)]}.`,
    `- quiz: ${questions} questions with ${choices} choices each; ${quiz} Key positions (the 0-based index of the right choice) for q1 to q${questions}: ${keyPositions(n, questions, choices).join(", ")}. Common advice from outside this chapter may be a wrong choice in one question only, and for this chapter it is: ${OUTSIDE_FIXES[turn(n, OUTSIDE_FIXES.length)]}. If that is part of this chapter's own lesson, or fits no question, use no outside advice.`,
    `- review cards: ${c.reviewCards.length} cards; ${cards}`,
    `- practice plan: ${c.implementationPlan.ifThenPlans.length} if-then plans; ${rule("practice")} The kinds of cue for this chapter: ${cueKinds(c.implementationPlan.ifThenPlans.length).join("; ")}.`,
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

/** First names from many places, for a rename: the fix call picks from the ones this book has not used yet. A model told
 *  "pick from these" obeys; one told "avoid these two hundred" does not. */
const NAME_POOL = (
  "Adaeze Aiko Alejandra Amadou Anders Aroha Asel Bao Beatriz Benedek Catalina Cyrus Dagny Damaris Dilnoza Eitan Elif Emeka Enzo Fatou " +
  "Fenna Gael Giulia Gudrun Hamid Hinata Idris Ilse Isko Jelena Joaquín Jorunn Kaede Kamau Kasia Keanu Lior Lucero Maarten Malak Manon " +
  "Matteo Mehmet Mirela Nadir Nikolai Oona Orla Paulo Petra Quynh Rosalind Sachin Selin Sigrid Simo Suki Tadeo Tariq Thandi Tomás Tove " +
  "Umar Valentina Vikram Wren Xiomara Yara Yosef Zanele Zoran Ayla Bastien Chiamaka Dario Esperanza Farida Hugo Leandro Maren Nuru Oskar " +
  "Priyanka Rutger Saoirse Tendai Ulla Veda Wiktor Yemi Zélie"
).split(" ");

/** Matches `name` as a whole word: letters, digits and underscores on either side do not count. */
function wholeWord(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(name)}(?![\\p{L}\\p{N}_])`, "u");
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
  const whole = wholeWord;
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
    if (!/^ch\d+$/.test(f) || f === chapterName(n) || (ex.own && f === chapterName(ex.chapter))) continue;
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
  opts: { approach?: string; expectedApproach?: string; factCheck?: boolean; keySolve?: boolean } = {},
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
  // A round that changed no summary tier changed no fact, and one that changed no quiz changed no key: the earlier
  // verdicts stand, and the checker is not rolled again (every roll finds something new to doubt).
  if (opts.factCheck === false && opts.keySolve === false) return { chapter, blocking, reported, advisory: det.advisory };

  const tiers = TIERS.map((t) => `[${t}]\n${chapter.breakdown[t]}`).join("\n\n");
  const factPrompt = renderTemplate(loadPrompt(knowledge ? "variants-factcheck-knowledge" : "variants-factcheck"), {
    KNOWN_TRAPS: knownTrapsSection(ctx.knownTraps[n] ?? []),
    LESSON: lessonText({ ...lesson, whyThisOne: "" }),
    SUMMARIES: tiers,
    KEYS: keysBlock(ctx, n),
    ...(knowledge ? { BOOK_SECTION: ctx.bookSection } : { SOURCE: writerFormText(spanText(ctx.source, n)) }),
  });
  const [fact, solve] = await Promise.all([
    opts.factCheck === false
      ? Promise.resolve({ issues: [] })
      : callShaped(ctx, n, { role: ctx.config.checker, prompt: factPrompt, step: `r${round}.factcheck`, kind: "other", errors: (v) => (isObj(v) && Array.isArray(v.issues) ? [] : ["answer must be an object with an issues array"]), outPrefix: path.join(bdir, "calls", `r${round}.factcheck`), ledgerStep: "book-factcheck" }),
    opts.keySolve === false
      ? Promise.resolve({ answers: [] })
      : callShaped(ctx, n, { role: ctx.config.solver, prompt: keysolvePrompt(chapter), step: `r${round}.keysolve`, kind: "other", errors: (v) => (isObj(v) && Array.isArray(v.answers) ? [] : ["answer must be an object with an answers array"]), outPrefix: path.join(bdir, "calls", `r${round}.keysolve`), ledgerStep: "book-keysolve" }),
  ]);
  const factIssues = ((fact as { issues: unknown[] }).issues.filter(isObj) as unknown as Partial<FactIssue>[]).map((i) => ({
    source: "fact" as const,
    blocking: true,
    field: `breakdown.${String(i.variant ?? "fullRead")}`,
    text: `${String(i.kind ?? "OTHER")} (${String(i.verdict ?? "UNSUPPORTED")}): "${String(i.chapterText ?? "")}" | book: ${String(i.sourceText ?? "none")} | fix: ${String(i.fix ?? "")}`,
  }));
  blocking.push(...factIssues);
  const keys = opts.keySolve === false ? [] : keysolveIssues(chapter, solve);
  blocking.push(...keys.filter((i) => i.blocking));
  reported.push(...keys.filter((i) => !i.blocking));
  return { chapter, blocking, reported, advisory: det.advisory };
}

/** Writes chapter n in the exemplar's form, checks it, fixes once, and lands it. Returns the status; a resumed chapter returns its saved one. */
export async function writeBookChapter(ctx: PipelineCtx, n: number, ex: Exemplar, opts: { force?: boolean } = {}): Promise<BookChapterStatus> {
  if (ex.own && n === ex.chapter) throw new Error(`EXEMPLAR_CHAPTER: ${chapterName(n)} is the exemplar; it is not rewritten`);
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
      HEADER: chapterHeaderWithLessons(n, titles, taught, ex.bookNames),
      SOURCE_RULES,
      QUOTE_RULE,
      SOURCE_BLOCK,
      NOTES: notes,
      FORM: formText(ex, expectedApproach, n, ctx.config.shape),
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
    names: [...new Set([...used.names, ...extractNames(chapter, [...lesson.storyNames, ...bookTerms(ctx)], "invented")])].sort(),
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
async function fixRound(ctx: PipelineCtx, n: number, chapter: Chapter, lesson: LessonCard, issues: Issue[], bdir: string, round: number, opts: { style?: { names: string[] } } = {}): Promise<Chapter | null> {
  const knowledge = ctx.source.mode === "knowledge";
  const issuesText = issues.length > 0 ? issues.map((i, k) => `${k + 1}. [${i.field ?? "(chapter)"}] ${i.text}`).join("\n") : "(none)";
  const common = { ISSUES: issuesText, LESSON: JSON.stringify(lesson, null, 2), CHAPTER: readerText(chapter) };
  const fixPrompt = opts.style
    ? renderTemplate(loadPrompt("fix-style"), { ...common, BOOK_SECTION: ctx.bookSection, NAMES: opts.style.names.length > 0 ? opts.style.names.join(", ") : "(none found)" })
    : knowledge
      ? renderTemplate(loadPrompt("fix-knowledge"), { ...common, BOOK_SECTION: ctx.bookSection, KEYS: keysBlock(ctx, n) })
      : renderTemplate(loadPrompt("fix"), { ...common, SOURCE: writerFormText(spanText(ctx.source, n)) });
  const fixRaw = await callShaped(ctx, n, { role: ctx.config.fixer ?? ctx.config.checker, prompt: fixPrompt, step: `r${round}.fix`, kind: "fix", errors: (v) => (isObj(v) ? [] : ["answer must be an object"]), outPrefix: path.join(bdir, "calls", `r${round}.fix`), ledgerStep: opts.style ? "book-style" : "book-fix" });
  const applied = applyFix(chapter, fixRaw as FixOutput);
  // A takeaway trimmed to the word limit is the lesson now: the card follows it, so the equality check still holds.
  if (applied.applied > 0 && applied.chapter.keyTakeaway !== chapter.keyTakeaway) lesson.lesson = applied.chapter.keyTakeaway;
  writeJson(path.join(bdir, `r${round}.fix-applied.json`), { applied: applied.applied, errors: applied.errors });
  if (applied.applied === 0) return null;
  writeJson(path.join(bdir, `r${round + 1}.chapter.json`), applied.chapter);
  return applied.chapter;
}

/** A landed chapter (assembled, or written here) that still has blocking issues in its status: one fix round on those issues
 *  (plus any reader findings given), then the checks again, and final.json, status.json and the reading page are rewritten.
 *  Returns the new status. With `style`, the round is the style pass instead (prompts/fix-style.md: pronouns for the
 *  invented people, no sentence about "the lesson" being gentler, plus the findings), which changes no fact and no key,
 *  so neither the checker nor the solver is rolled. */
export async function fixLanded(ctx: PipelineCtx, n: number, findings: Array<{ field: string; text: string }> = [], opts: { style?: boolean } = {}): Promise<ChapterStatus> {
  const style = opts.style === true;
  const dir = path.join(ctx.config.runDir, chapterName(n));
  const chapter = readJson<Chapter>(path.join(dir, "final.json"));
  const status = readJson<ChapterStatus>(path.join(dir, "status.json"));
  const lesson = readJson<LessonCard>(path.join(dir, "lesson.json"));
  if (!chapter || !status || !lesson) throw new Error(`NO_FINAL_CHAPTER: ${chapterName(n)} has no final.json, status.json and lesson.json`);
  // Blocking issues, plus a name an earlier chapter used first: a rename is mechanical and safe, so it rides along, and only
  // the later chapter of a pair renames. Chapters written side by side never saw each other's names, so the ledger is read
  // again here instead of trusting the issues the landing check left.
  const ledger = readVariety(ctx);
  const earlierNames = new Set<string>();
  for (const [k, v] of Object.entries(ledger.chapters)) if (Number(k.slice(2)) < n) v.names.forEach((x) => earlierNames.add(x));
  const VARIETY = /^variety: "(.+)" is already used in another chapter/;
  const issues: Issue[] = [
    ...(style ? [] : status.open.filter((i) => (i.blocking && !i.text.startsWith("shape:")) || earlierNames.has(VARIETY.exec(i.text)?.[1] ?? ""))),
    ...findings.map((f): Issue => ({ source: "review", blocking: false, field: f.field, text: f.text })),
  ];
  const seen = new Set(issues.map((i) => `${i.field}|${i.text}`));
  for (const [id, leaves] of style ? [] : Object.entries(readerLeaves(chapter))) {
    const text = leaves.join("\n");
    for (const name of ledger.chapters[chapterName(n)]?.names ?? []) {
      if (!earlierNames.has(name) || !wholeWord(name).test(text)) continue;
      const issue: Issue = { source: "det", blocking: false, field: id, text: `variety: "${name}" is already used in another chapter of this book` };
      if (seen.has(`${issue.field}|${issue.text}`)) continue;
      seen.add(`${issue.field}|${issue.text}`);
      issues.push(issue);
    }
  }
  if (!style && issues.length === 0) return status;
  // Checks need an exemplar for the copy check; a chapter that is itself the exemplar is checked against nothing.
  const exemplarFile = path.join(ctx.config.runDir, "exemplars", `${chapterName(n)}.json`);
  const ex: Exemplar = fs.existsSync(exemplarFile) && ctx.config.exemplarFrom === undefined ? { ...loadExemplar(ctx, n), chapterJson: emptyChapter(), names: [], sceneNames: [] } : loadExemplar(ctx);
  const renameOnly = !style && issues.every((i) => VARIETY.test(i.text));
  const used = new Set<string>([...ex.names, ...Object.values(ledger.chapters).flatMap((v) => v.names)]);
  const styleNames = style ? [...new Set([...(ledger.chapters[chapterName(n)]?.names ?? []), ...extractNames(chapter, [...lesson.storyNames, ...bookTerms(ctx)], "invented")])].sort() : [];
  if (!style && issues.some((i) => VARIETY.test(i.text))) {
    // The fix call cannot see the ledger, so a rename would land on a name another chapter uses; offered a dozen free
    // names (rotated by chapter so neighbours get different ones) it picks one of them.
    const free = NAME_POOL.filter((x) => !used.has(x));
    const offer = free.length > 0 ? Array.from({ length: Math.min(12, free.length) }, (_, i) => free[(n * 7 + i) % free.length]) : [];
    issues.push({ source: "det", blocking: false, field: "(chapter)", text: `for each rename above, replace the name everywhere it appears with one of these names this book has not used yet (or another name that fits the scene and that no other chapter of this book uses): ${offer.join(", ")}` });
  }
  const bdir = path.join(dir, "book");
  const round = (status.round ?? 0) + 1;
  const applied = await fixRound(ctx, n, chapter, lesson, issues, bdir, status.round ?? 0, style ? { style: { names: styleNames } } : {});
  if (!applied) return status;
  // The checker is rolled again only where it could see a change: a summary tier edited (or a fact flag it must confirm
  // gone), a quiz edited (or a key flag). A rename, a style pass, a card or an example edit leaves the earlier verdicts standing.
  const factCheck = !style && !renameOnly && (TIERS.some((t) => applied.breakdown[t] !== chapter.breakdown[t]) || issues.some((i) => i.source === "fact"));
  const keySolve = !style && !renameOnly && (JSON.stringify(applied.quiz) !== JSON.stringify(chapter.quiz) || issues.some((i) => i.source === "keysolve"));
  const r = await checkRound(ctx, n, round, applied, lesson, ex, bdir, { factCheck, keySolve });
  if (style) {
    // How far the pronoun rule got: the invented people's mentions across the three summary lengths, before and after.
    const mentions = (c: Chapter): number => styleNames.reduce((s, nm) => s + (TIERS.map((t) => c.breakdown[t]).join("\n").match(new RegExp(wholeWord(nm).source, "gu")) ?? []).length, 0);
    r.reported.push({ source: "det", blocking: false, field: "breakdown", text: `style: the invented people are named ${mentions(applied)} times in the summaries, down from ${mentions(chapter)}` });
  }
  // A check that was not rolled again leaves its earlier verdicts standing, open flags included: a style or rename round
  // cannot clear a fact or key flag it never looked at.
  for (const [skip, source] of [[!factCheck, "fact"], [!keySolve, "keysolve"]] as const) {
    if (!skip) continue;
    for (const i of status.open.filter((x) => x.source === source)) (i.blocking ? r.blocking : r.reported).push(i);
  }
  // A rename that still landed on a used name is reported, so the next fix pass sees it.
  const before = new Set(extractNames(chapter, [...lesson.storyNames, ...bookTerms(ctx)], "invented"));
  for (const name of extractNames(applied, [...lesson.storyNames, ...bookTerms(ctx)], "invented")) {
    if (!before.has(name) && used.has(name)) r.reported.push({ source: "det", blocking: false, field: "(chapter)", text: `variety: the rename landed on "${name}", which another chapter of this book uses` });
  }
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
  writeJson(path.join(dir, "lesson.json"), lesson);
  // The ledger follows the edits: a renamed name leaves, a new one enters, and the openers are cut again.
  const mine = readVariety(ctx).chapters[chapterName(n)];
  if (mine) {
    const text = Object.values(readerLeaves(applied)).flat().join("\n");
    writeVariety(ctx, n, {
      ...mine,
      names: [...new Set([...mine.names.filter((x) => wholeWord(x).test(text)), ...extractNames(applied, [...lesson.storyNames, ...bookTerms(ctx)], "invented")])].sort(),
      openers: openerSentences(applied, lesson.storyNames),
    });
  }
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

function chapterHeaderWithLessons(n: number, titles: Record<number, string>, taught: string[], exemplarPeople: string[] = []): string {
  const total = Math.max(...Object.keys(titles).map(Number));
  const prev = Object.hasOwn(titles, n - 1) ? `The previous chapter is "${titles[n - 1]}".` : "This is the first chapter of the book.";
  const next = Object.hasOwn(titles, n + 1) ? `The next chapter is "${titles[n + 1]}".` : "This is the last chapter of the book.";
  let head = `CHAPTER ${n} of ${total}: "${titles[n]}". ${prev} ${next} Write only this chapter.`;
  if (taught.length > 0) head += `\nLessons already taught by other chapters of this book (teach none of these again):\n${taught.map((l) => `- ${l}`).join("\n")}`;
  if (exemplarPeople.length > 0) head += `\nThese people belong to another chapter's story, not this one; this chapter's evidence is its own story: ${exemplarPeople.join(", ")}.`;
  return head;
}

// ---------------------------------------------------------------- the book

const isStop = (e: unknown): boolean => typeof e === "object" && e !== null && "exitCode" in e;

/** Writes the chapters that are not the exemplar, `concurrency` at a time, resuming from files. A usage limit, the budget or a
 *  config problem stops the run; any other failure is recorded per chapter and the run goes on. */
export async function runBookChapters(ctx: PipelineCtx, chapters: number[], opts: { exemplar?: number; force?: boolean } = {}): Promise<BookChapterStatus[]> {
  const ex = loadExemplar(ctx, opts.exemplar);
  const todo = chapters.filter((n) => !(ex.own && n === ex.chapter));
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

const HOOK_STOP = new Set(
  "the a an and or but of to in on at for with from by as is are was were be been it its this that these those you your yours he she they his her their our we i me my not no so if then than when while what which who how why do does did have has had will would can could may might just still even also only very more most much many some any all one two three again".split(" "),
);

/** The first screens of a book side by side: pairs of landed chapters whose hooks share a pair of neighbouring content
 *  words ("yoga mat", "front door"). Chapters written in parallel cannot see each other's hooks, so two neighbours can
 *  open on the same object; the run report names them and a findings round gives one of them a new hook. */
export function hookCollisions(ctx: PipelineCtx, chapters: number[]): Array<{ words: string; chapters: string[] }> {
  const stem = (w: string): string => w.replace(/s$/, "");
  const terms = new Set(bookTerms(ctx).map((t) => stem(t.toLowerCase())));
  const where = new Map<string, Set<string>>();
  for (const n of chapters) {
    const c = readJson<Chapter>(path.join(ctx.config.runDir, chapterName(n), "final.json"));
    if (!c) continue;
    const words = c.hook.toLowerCase().replace(/’/g, "'").match(/[a-z']+/g) ?? [];
    const seen = new Set<string>();
    for (let i = 0; i + 1 < words.length; i++) {
      const [a, b] = [words[i]!, words[i + 1]!];
      if (a.length < 3 || b.length < 3 || HOOK_STOP.has(a) || HOOK_STOP.has(b) || (terms.has(stem(a)) && terms.has(stem(b)))) continue;
      seen.add(`${a} ${b}`);
    }
    for (const k of seen) {
      if (!where.has(k)) where.set(k, new Set());
      where.get(k)!.add(chapterName(n));
    }
  }
  return [...where.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([words, s]) => ({ words, chapters: [...s].sort() }))
    .sort((x, y) => x.words.localeCompare(y.words));
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
