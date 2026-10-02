/** Deterministic checks on one drafted chapter (0 model calls). `blocking` issues must be fixed, `reported`
 *  issues go to the fix call, `advisory` strings and `info` are for the owner and the run report. */
import type { BookConfig } from "./config";
import { findQuotes, norm, quoteInSource } from "./quotes";
import { fkGrade } from "./readability";
import type { Chapter, Issue, IssueSource, LessonCard } from "./types";
import { validateChapterWithApp, wordsIn, type BookMeta } from "./validate";

export interface CheckContext {
  n: number;
  book: BookMeta & { bookType: "memoir" | "how-to" | "argument" };
  /** Writer-form text of the chapter WITHOUT the editor's notes. */
  authorText: string;
  shape: BookConfig["shape"];
  earlierLessons: string[];
}

export interface CheckResult {
  blocking: Issue[];
  reported: Issue[];
  advisory: string[];
  info: Record<string, unknown>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const arr = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);

const TIERS = ["fastRead", "deepRead", "fullRead"] as const;
const FK_BAND: [number, number] = [5.0, 8.5];
const round2 = (x: number): number => Math.round(x * 100) / 100;

function mk(source: IssueSource, blocking: boolean, field: string | undefined, text: string): Issue {
  return field === undefined ? { source, blocking, text } : { source, blocking, field, text };
}
const det = (blocking: boolean, field: string | undefined, text: string): Issue => mk("det", blocking, field, text);

// ---------------------------------------------------------------- splitLesson

const CARD_STRINGS = ["lesson", "wrongBelief", "keyPhrase", "hookQuestion"] as const;
const CARD_LISTS = ["storyNames", "evidence"] as const;

/** Takes `_lesson` off the writer's object and validates it. The input is not changed. */
export function splitLesson(raw: unknown): { chapter: Chapter | null; lesson: LessonCard | null; errors: string[] } {
  if (!isObj(raw)) return { chapter: null, lesson: null, errors: ["writer output is not a JSON object"] };
  const { _lesson, ...rest } = raw;
  const chapter = rest as unknown as Chapter;
  if (_lesson === undefined) return { chapter, lesson: null, errors: ["missing _lesson"] };
  if (!isObj(_lesson)) return { chapter, lesson: null, errors: ["_lesson must be an object"] };
  const errors: string[] = [];
  for (const k of CARD_STRINGS) {
    const v = _lesson[k];
    if (!isStr(v) || !v.trim()) errors.push(`_lesson.${k} must be a non-empty string`);
  }
  for (const k of CARD_LISTS) {
    if (!isStrList(_lesson[k])) errors.push(`_lesson.${k} must be an array of strings`);
  }
  if (errors.length > 0) return { chapter, lesson: null, errors };
  const lesson = {} as LessonCard;
  for (const k of CARD_STRINGS) lesson[k] = _lesson[k] as string;
  for (const k of CARD_LISTS) lesson[k] = _lesson[k] as string[];
  return { chapter, lesson, errors };
}

// ---------------------------------------------------------------- readerFields

/** Item ids for a list, falling back to the index when an id is missing or used twice. */
function idsOf(items: unknown[], prop: string): string[] {
  const raw = items.map((x, i) => (isObj(x) && isStr(x[prop]) && x[prop] !== "" ? (x[prop] as string) : String(i)));
  return raw.map((id, i) => (raw.indexOf(id) === raw.lastIndexOf(id) ? id : `${id}-${i}`));
}

/** Every reader-visible text of the chapter, by field id (the ids the W1 reader text uses). */
export function readerFields(c: Chapter): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (id: string, v: unknown): void => {
    if (isStr(v)) out[id] = v;
  };
  for (const k of ["title", "hook", "counterintuition", "keyTakeaway", "tryThisNow"] as const) put(k, c?.[k]);
  for (const k of TIERS) put(`breakdown.${k}`, c?.breakdown?.[k]);
  const examples = arr(c?.examples);
  idsOf(examples, "exampleId").forEach((id, i) => {
    for (const k of ["title", "scenario", "whatToDo", "whyItMatters"] as const) put(`examples.${id}.${k}`, examples[i][k]);
  });
  const questions = arr(c?.quiz?.questions);
  idsOf(questions, "questionId").forEach((id, i) => {
    const q = questions[i];
    put(`quiz.${id}.prompt`, q.prompt);
    arr(q.choices).forEach((x, j) => put(`quiz.${id}.choices.${j}`, x));
    put(`quiz.${id}.explanation`, q.explanation);
  });
  const cards = arr(c?.reviewCards);
  idsOf(cards, "cardId").forEach((id, i) => {
    put(`reviewCards.${id}.front`, cards[i].front);
    put(`reviewCards.${id}.back`, cards[i].back);
  });
  const plan = c?.implementationPlan;
  put("implementationPlan.coreSkill", plan?.coreSkill);
  arr(plan?.ifThenPlans).forEach((p, i) => {
    put(`implementationPlan.ifThenPlans.${i}.context`, p?.context);
    put(`implementationPlan.ifThenPlans.${i}.plan`, p?.plan);
  });
  put("implementationPlan.twentyFourHourChallenge", plan?.twentyFourHourChallenge);
  put("implementationPlan.weeklyPractice", plan?.weeklyPractice);
  arr(c?.memorableLines).forEach((m, i) => put(`memorableLines.${i}`, m?.text));
  return out;
}

// ---------------------------------------------------------------- blocking 1: shape

function shapeIssues(c: unknown): Issue[] {
  const out: Issue[] = [];
  const bad = (field: string, why: string): void => {
    out.push(det(true, field, `shape: ${field} ${why}`));
  };
  const text = (o: Obj, key: string, path: string): void => {
    const v = o[key];
    if (!isStr(v) || !v.trim()) bad(`${path}${key}`, "must be a non-empty string");
  };
  const obj = (v: unknown, path: string): Obj | null => {
    if (isObj(v)) return v;
    bad(path, "must be an object");
    return null;
  };
  const list = (v: unknown, path: string, each: (item: Obj, p: string) => void): void => {
    if (!Array.isArray(v) || v.length === 0) return bad(path, "must be a non-empty array");
    v.forEach((item, i) => {
      const o = obj(item, `${path}.${i}`);
      if (o) each(o, `${path}.${i}.`);
    });
  };
  if (!isObj(c)) {
    bad("(chapter)", "must be a JSON object");
    return out;
  }
  for (const k of ["title", "hook", "counterintuition", "keyTakeaway", "tryThisNow"]) text(c, k, "");
  const breakdown = obj(c.breakdown, "breakdown");
  if (breakdown) for (const k of TIERS) text(breakdown, k, "breakdown.");
  list(c.examples, "examples", (e, p) => {
    for (const k of ["exampleId", "title", "scenario", "whatToDo", "whyItMatters"]) text(e, k, p);
    if (!isStrList(e.tags)) bad(`${p}tags`, "must be an array of strings");
  });
  const quiz = obj(c.quiz, "quiz");
  if (quiz) {
    if (typeof quiz.passingScorePercent !== "number" || !Number.isFinite(quiz.passingScorePercent)) {
      bad("quiz.passingScorePercent", "must be a number");
    }
    list(quiz.questions, "quiz.questions", (q, p) => {
      for (const k of ["questionId", "prompt", "explanation", "bloomsLevel"]) text(q, k, p);
      if (!isStrList(q.choices) || q.choices.length === 0 || q.choices.some((x) => !x.trim())) {
        bad(`${p}choices`, "must be a non-empty array of non-empty strings");
      }
      if (typeof q.correctIndex !== "number" || !Number.isFinite(q.correctIndex)) bad(`${p}correctIndex`, "must be a number");
    });
  }
  list(c.reviewCards, "reviewCards", (r, p) => {
    for (const k of ["cardId", "front", "back", "difficulty"]) text(r, k, p);
  });
  const plan = obj(c.implementationPlan, "implementationPlan");
  if (plan) {
    text(plan, "coreSkill", "implementationPlan.");
    list(plan.ifThenPlans, "implementationPlan.ifThenPlans", (x, p) => {
      for (const k of ["context", "plan"]) text(x, k, p);
    });
    text(plan, "twentyFourHourChallenge", "implementationPlan.");
    text(plan, "weeklyPractice", "implementationPlan.");
  }
  list(c.memorableLines, "memorableLines", (m, p) => text(m, "text", p));
  if ("_lesson" in c) bad("_lesson", "must be removed from the chapter");
  return out;
}

// ---------------------------------------------------------------- text helpers

const paragraphs = (t: string): string[] =>
  t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
const collapse = (t: string): string => t.replace(/\s+/g, " ").trim();
const words4 = (t: string): string[] => t.toLowerCase().replace(/’/g, "'").match(/[a-z0-9']+/g) ?? [];

function grams(ws: string[]): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i + 4 <= ws.length; i++) s.add(ws.slice(i, i + 4).join(" "));
  return s;
}

/** Share of the grams in `a` that also appear in `b`. */
function shareOf(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const g of a) if (b.has(g)) n++;
  return a.size ? n / a.size : 0;
}

const STOP = new Set(
  ("that this with from have they them their there what when were will would could should your about into than then " +
    "more most some such only also been being does doing each other over just like make much must very which while whom " +
    "whose these those here ever even both because every").split(" "),
);
const contentWords = (t: string): Set<string> =>
  new Set((t.toLowerCase().replace(/’/g, "'").match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)));

function jaccard(a: Set<string>, b: Set<string>): number {
  let both = 0;
  for (const w of a) if (b.has(w)) both++;
  const union = a.size + b.size - both;
  return union ? both / union : 0;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------- field groups

const isCheckedQuoteField = (id: string): boolean =>
  /^(hook|counterintuition|keyTakeaway|tryThisNow|breakdown\.\w+)$/.test(id) ||
  /^quiz\..+\.explanation$/.test(id) ||
  /^reviewCards\..+\.back$/.test(id) ||
  /^memorableLines\.(?!0$)\d+$/.test(id);

const isInventedQuoteField = (id: string): boolean =>
  /^(examples|implementationPlan)\./.test(id) || /^quiz\..+\.(prompt|choices\.\d+)$/.test(id) || /^reviewCards\..+\.front$/.test(id);

/** Fields the writer makes up (no outside facts allowed in them). */
const isInventedField = (id: string): boolean => /^(hook|counterintuition|tryThisNow|examples\.|quiz\.|reviewCards\.|implementationPlan\.)/.test(id);

const isQuizCardWording = (id: string): boolean => /^quiz\..+\.(prompt|choices\.\d+)$/.test(id) || /^reviewCards\..+\.(front|back)$/.test(id);

const CHATTER =
  /as an ai\b|language model|here is the json|here's the json|the author writes|```|in this chapter we will|\bthe source text\b|\bthe source span\b|\bmy draft\b/i;
const OUTSIDE_FACT =
  /\d+(\.\d+)?\s?%|\b(1[5-9]|20)\d{2}\b|\b(stud(y|ies)|survey|research(ers)? (shows?|found|suggests)|according to|scientists|statistics?)\b/gi;

// ---------------------------------------------------------------- runChecks

export async function runChecks(c: Chapter, lesson: LessonCard | null, ctx: CheckContext): Promise<CheckResult> {
  const blocking: Issue[] = [];
  const reported: Issue[] = [];
  const advisory: string[] = [];
  const info: Record<string, unknown> = {};

  blocking.push(...shapeIssues(c));
  if (blocking.length > 0) {
    // The other checks read the chapter by shape, so they wait until the shape is right.
    if (!lesson) blocking.push(det(true, "_lesson", "missing _lesson: the writer must return the lesson card"));
    return { blocking, reported, advisory, info };
  }

  const v = await validateChapterWithApp(c, ctx.n, ctx.book);
  if (!v.ok) blocking.push(det(true, undefined, `app validator: ${v.message}`));

  const f = readerFields(c);
  const fieldIds = Object.keys(f);
  const quizzes = c.quiz.questions;

  // 3. Quotations: every quoted span in a field that speaks for the author must be in the author's text.
  const source = norm(ctx.authorText);
  for (const id of fieldIds) {
    const checked = isCheckedQuoteField(id);
    if (!checked && !isInventedQuoteField(id)) continue;
    for (const q of findQuotes(f[id])) {
      if (quoteInSource(q, source)) continue;
      if (checked) {
        blocking.push(det(true, id, `quotation not found in the author's text: "${q}". Quote only words the author wrote, or paraphrase without quote marks.`));
      } else {
        advisory.push(`${id}: invented quotation "${q}" is not in the source (allowed for invented speech)`);
      }
    }
  }

  // 4. Answer keys, walls of text, meta chatter.
  quizzes.forEach((q, i) => {
    const ok = Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.choices.length;
    if (!ok) {
      blocking.push(det(true, `quiz.questions.${i}.correctIndex`, `correctIndex ${q.correctIndex} is not an integer from 0 to ${q.choices.length - 1}`));
    }
  });
  for (const t of TIERS) {
    const text = c.breakdown[t];
    const n = wordsIn(text);
    if (n > 180 && paragraphs(text).length === 1) {
      blocking.push(det(true, `breakdown.${t}`, `wall of text: ${n} words in a single paragraph (limit 180); split it into paragraphs`));
    }
  }
  for (const id of fieldIds) {
    const m = CHATTER.exec(f[id]);
    if (m) blocking.push(det(true, id, `meta chatter in reader-visible text: "${m[0]}"`));
  }

  // 5. The lesson card and keyTakeaway.
  if (!lesson) {
    blocking.push(det(true, "_lesson", "missing _lesson: the writer must return the lesson card"));
  } else if (collapse(c.keyTakeaway) !== collapse(lesson.lesson)) {
    blocking.push(det(true, "keyTakeaway", `keyTakeaway must equal _lesson.lesson (whitespace aside). keyTakeaway: "${collapse(c.keyTakeaway)}" / lesson: "${collapse(lesson.lesson)}"`));
  }
  const ktWords = wordsIn(c.keyTakeaway);
  if (ktWords < 1 || ktWords > 20) blocking.push(det(true, "keyTakeaway", `keyTakeaway is ${ktWords} words; it must be 1 to 20 words`));

  // 6. Outside facts in invented fields.
  for (const id of fieldIds) {
    if (!isInventedField(id)) continue;
    for (const m of f[id].matchAll(OUTSIDE_FACT)) {
      reported.push(det(false, id, `outside fact "${m[0]}" in an invented field: no statistics, dates or research claims; keep to the story`));
    }
  }

  // 7. Story names inside quiz questions and review cards.
  for (const name of lesson?.storyNames ?? []) {
    if (name.length < 3) continue;
    const whole = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(name)}(?![\\p{L}\\p{N}_])`, "u");
    for (const id of fieldIds) {
      if (isQuizCardWording(id) && whole.test(f[id])) {
        reported.push(det(false, id, `story name in quiz/card: "${name}" belongs to the story, so quizzes and cards must use new situations without it`));
      }
    }
  }

  // 8. keyTakeaway repeated near-verbatim in other fields; 9. line 1 of memorableLines.
  const ktGrams = grams(words4(c.keyTakeaway));
  const repeatFields: Array<{ field: string; share: number }> = [];
  if (ktGrams.size > 0) {
    for (const id of fieldIds) {
      if (id === "keyTakeaway") continue;
      const s = shareOf(ktGrams, grams(words4(f[id])));
      if (s >= 0.5) repeatFields.push({ field: id, share: round2(s) });
    }
  }
  info.repeatFields = repeatFields;
  if (repeatFields.length > 2) {
    reported.push(det(false, undefined, `keyTakeaway wording is repeated near-verbatim in ${repeatFields.length} fields (${repeatFields.map((r) => r.field).join(", ")}); say it in new words or cut the repeat`));
  }
  const line1 = c.memorableLines[0].text;
  if (wordsIn(line1) > 15) reported.push(det(false, "memorableLines.0", `line 1 is ${wordsIn(line1)} words; keep it to 15 or fewer`));
  const lineGrams = grams(words4(line1));
  const lineShare = shareOf(lineGrams, ktGrams);
  if (lineGrams.size > 0 && lineShare >= 0.5) {
    reported.push(det(false, "memorableLines.0", `line 1 should state the lesson in fresh words (${Math.round(lineShare * 100)}% of its phrasing is copied from keyTakeaway)`));
  }

  // 10. Overlap with lessons taught in earlier chapters.
  const mine = contentWords(c.keyTakeaway);
  for (const earlier of ctx.earlierLessons) {
    const j = jaccard(mine, contentWords(earlier));
    if (j > 0.5) {
      reported.push(mk("lesson", false, "keyTakeaway", `DUPLICATE_LESSON: this lesson overlaps an earlier chapter's (word overlap ${round2(j)}): "${collapse(earlier)}". Teach a different lesson.`));
    }
  }

  advisoryAndInfo(c, ctx, advisory, info);
  return { blocking, reported, advisory, info };
}

// ---------------------------------------------------------------- advisory and info

function advisoryAndInfo(c: Chapter, ctx: CheckContext, advisory: string[], info: Record<string, unknown>): void {
  const { shape } = ctx;

  // Words and paragraphs per tier, quotations per tier.
  const tierWords: Record<string, number> = {};
  const quotesPerTier: Record<string, number> = {};
  for (const t of TIERS) {
    const text = c.breakdown[t];
    tierWords[t] = wordsIn(text);
    quotesPerTier[t] = findQuotes(text).length;
    const [lo, hi] = shape[t];
    if (tierWords[t] < lo || tierWords[t] > hi) advisory.push(`breakdown.${t} is ${tierWords[t]} words; the shape band is ${lo} to ${hi}`);
    paragraphs(text).forEach((p, i) => {
      if (wordsIn(p) > 140) advisory.push(`breakdown.${t} paragraph ${i + 1} is ${wordsIn(p)} words (over 140)`);
    });
  }
  info.tierWords = tierWords;
  info.quotesPerTier = quotesPerTier;

  // Reading grade per tier and for the rest of the chapter.
  const fk: Record<string, number | null> = {};
  const checkFk = (label: string, g: number | null): void => {
    if (g !== null && (g < FK_BAND[0] || g > FK_BAND[1])) advisory.push(`FK grade of ${label} is ${g}; the band is ${FK_BAND[0].toFixed(1)} to ${FK_BAND[1].toFixed(1)}`);
  };
  for (const t of TIERS) {
    fk[t] = fkGrade(c.breakdown[t]);
    checkFk(`breakdown.${t}`, fk[t]);
  }
  const rest = [
    c.tryThisNow,
    ...c.examples.flatMap((e) => [e.scenario, e.whatToDo, e.whyItMatters]),
    ...c.quiz.questions.flatMap((q) => [q.prompt, ...q.choices]),
    ...c.reviewCards.flatMap((r) => [r.front, r.back]),
  ].join(" ");
  const fkRest = fkGrade(rest);
  checkFk("rest (examples, quiz, cards, tryThisNow)", fkRest);
  info.fk = fk;
  info.fkRest = fkRest;

  // Answer keys: spread, and keys that stand out as the longest choice.
  const qs = c.quiz.questions;
  const positions = Math.max(shape.choices, ...qs.map((q) => q.choices.length));
  const keyPositions = Array.from({ length: positions }, () => 0);
  let uniquelyLongest = 0;
  qs.forEach((q) => {
    if (Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < positions) keyPositions[q.correctIndex]++;
    const key = q.choices[q.correctIndex]?.trim().length ?? 0;
    if (q.choices.every((x, i) => i === q.correctIndex || x.trim().length < key)) uniquelyLongest++;
  });
  info.keyPositions = keyPositions;
  info.keyUniquelyLongest = uniquelyLongest;
  if (qs.length >= 2 * positions) {
    keyPositions.forEach((n, i) => {
      if (n < 2) advisory.push(`key position ${i} is the key in only ${n} of ${qs.length} questions (want at least 2)`);
    });
  }
  if (uniquelyLongest * 2 > qs.length) advisory.push(`the key is the uniquely longest choice in ${uniquelyLongest} of ${qs.length} questions`);

  const ids = idsOf(qs, "questionId");
  qs.forEach((q, i) => {
    if (wordsIn(q.prompt) > 30) advisory.push(`quiz ${ids[i]} stem is ${wordsIn(q.prompt)} words (over 30)`);
  });
  const exIds = idsOf(c.examples, "exampleId");
  const exampleWords = c.examples.map((e) => wordsIn(e.scenario));
  info.exampleWords = exampleWords;
  exampleWords.forEach((n, i) => {
    if (n > 75) advisory.push(`examples.${exIds[i]}.scenario is ${n} words (over 75)`);
  });

  // Counts against the shape.
  const counts: Array<[string, number, number]> = [
    ["examples", c.examples.length, shape.examples],
    ["quiz questions", qs.length, shape.quizQuestions],
    ["reviewCards", c.reviewCards.length, shape.reviewCards],
    ["memorableLines", c.memorableLines.length, shape.memorableLines],
    ["ifThenPlans", c.implementationPlan.ifThenPlans.length, shape.ifThenPlans],
  ];
  for (const [name, got, want] of counts) if (got !== want) advisory.push(`${name}: ${got} written, the shape asks for ${want}`);
  qs.forEach((q, i) => {
    if (q.choices.length !== shape.choices) advisory.push(`quiz ${ids[i]} has ${q.choices.length} choices, the shape asks for ${shape.choices}`);
  });
}
