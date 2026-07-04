/**
 * cardQualityGates — W2 deterministic PRE-FLIGHT quality gates for the v24 author
 * architecture (plan §WS5). Two BLOCKING per-chapter checks plus one ADVISORY
 * (echo-tell warns but never fails — a blocking echo gate would fail 4 of the 5
 * books the spec requires to pass; see bookRubricMetrics). They run in the SAME
 * author preflight that gates tellRate today, so a FAIL feeds the existing
 * retry card verbatim (authorRun.ts reads the `chNN: … FAIL …` line):
 *
 *   (a) ECHO-TELL          — the KEY lifts a ≥5-contiguous-content-token verbatim
 *                            n-gram from chapter prose while ALL distractors are
 *                            <4. Zero-FP as measured (the 4 known the-power-of-
 *                            moments lifts flag; the top-5 owner books do not).
 *   (b) SYMMETRIC LENGTH-TELL — the key is the uniquely-shortest choice in at most
 *                            `shortestMax` of the chapter's questions, and the
 *                            uniquely-longest in at most `longestMax`. Symmetric
 *                            by construction so fixing one side cannot mint the
 *                            other (the exact whack-a-mole the v24 POM rewrite hit:
 *                            longest 42%→4% but shortest 21%→51%).
 *   (c) PRACTICE FLOOR      — tryThisNow OR twentyFourHourChallenge contains a
 *                            (digit | number word | timebox phrase) AND is
 *                            imperative-led. Near-zero-FP; catches abstract drift.
 *
 * WHY DETERMINISTIC / WHY HERE
 * ----------------------------
 * These sit beside src/metrics/rubricMetrics.ts (the score.py port) but are NOT
 * a score.py port — they are NEW write-time levers the forensics identified
 * (scratchpad/aplus/content-residuals.md). They are surfaced through the SAME
 * per-chapter rubric-metrics verdict line (bookRubricMetrics.ts) so the author
 * retry loop treats a card-quality FAIL exactly like a tellRate FAIL: a
 * whole-chapter regeneration with the failing metric named.
 *
 * SHAPE-AGNOSTIC: every function takes a plain ChapterV21-shaped object, so the
 * calibration harness runs the identical gate over BOTH the slim package shape
 * (book-packages/<id>.v21.json chapters) and loose authoring-time chapters
 * (state/chapters/*.json) — they are the same chapter shape.
 *
 * Pure module: no fs, no network, no npm deps.
 */

import type { ChapterV21 } from "../types.js";

// ── tokenization ───────────────────────────────────────────────────────────────

/** Stopword set for CONTENT-token extraction. Deliberately broad (function words,
 *  pronouns, auxiliaries, determiners) so a ≥5-token match is a real content lift,
 *  not a run of grammatical glue. Frozen — a change here re-calibrates every gate. */
export const CONTENT_STOPWORDS: ReadonlySet<string> = new Set(
  (
    "a an the and or but if then of to in on at for with as by from into over under is are was were be been being " +
    "it its this that these those he she they them his her their you your i we our us me my not no do does did done " +
    "have has had will would can could should may might must than so such about above after again against all am any " +
    "because before below between both down during each few more most other out own same some too very just don now " +
    "which who whom whose what when where why how there here nor yet also only very"
  ).split(/\s+/),
);

/** Content tokens: lowercased word-ish runs (ASCII apostrophe/hyphen continue a
 *  token), stopword-filtered, single-letter tokens dropped. Deterministic. */
export function contentTokens(text: string): string[] {
  const raw = (text ?? "").toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  return raw.filter((w) => w.length > 1 && !CONTENT_STOPWORDS.has(w));
}

// ── echo prose surface ──────────────────────────────────────────────────────────

/**
 * The FULL reader-facing prose an echo lift can come from. Explicitly enumerated
 * (no reflection walk) so a schema rename breaks the build here, not silently.
 *
 * CRITICAL: this surface MUST include reviewCards and implementationPlan — a
 * verified real lift (the-power-of-moments ch4 q05) came from a review card, and
 * chapterText.ts's `chapterProse` (breakdown + scenarios only) would miss it.
 * `counterintuition` is included too (it is prose the reader reads); note this is
 * a SUPERSET of chapterText.ts's readerVisibleText, which excludes
 * counterintuition for readability reasons. The quiz itself is excluded (an
 * answer cannot "lift" from its own quiz).
 */
export function echoProseSurface(chapter: ChapterV21): string {
  const parts: (string | undefined)[] = [
    chapter.hook,
    chapter.counterintuition,
    chapter.tryThisNow,
    chapter.keyTakeaway,
    chapter.breakdown?.fastRead,
    chapter.breakdown?.deepRead,
    chapter.breakdown?.fullRead,
  ];
  for (const ex of chapter.examples ?? []) {
    parts.push(ex.title, ex.scenario, ex.whatToDo, ex.whyItMatters);
  }
  for (const card of chapter.reviewCards ?? []) {
    parts.push(card.front, card.back);
  }
  const plan = chapter.implementationPlan;
  if (plan) {
    parts.push(plan.title, plan.coreSkill, plan.twentyFourHourChallenge, plan.weeklyPractice);
    for (const it of plan.ifThenPlans ?? []) parts.push(it.context, it.plan);
  }
  for (const m of chapter.memorableLines ?? []) parts.push(m.text);
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("\n");
}

// ── (a) ECHO-TELL ────────────────────────────────────────────────────────────────

/** The longest contiguous content-token n-gram of `needle` that also appears
 *  contiguously in `haystack` tokens. 0 when there is no shared bigram+. Bounded
 *  by cap for performance (matches are what we care about, not exact length past
 *  the cap). */
export function longestSharedContentNgram(
  needleTokens: string[],
  haystackTokens: string[],
  cap = 12,
): number {
  if (needleTokens.length === 0 || haystackTokens.length === 0) return 0;
  const upper = Math.min(cap, needleTokens.length);
  // Build a set of haystack n-grams per length lazily, longest first.
  for (let n = upper; n >= 2; n--) {
    const hay = new Set<string>();
    for (let i = 0; i + n <= haystackTokens.length; i++) {
      hay.add(haystackTokens.slice(i, i + n).join(""));
    }
    for (let i = 0; i + n <= needleTokens.length; i++) {
      if (hay.has(needleTokens.slice(i, i + n).join(""))) return n;
    }
  }
  return 0;
}

export type EchoTellQuestionResult = {
  questionId: string;
  /** Longest verbatim content n-gram the KEY shares with chapter prose. */
  keyNgram: number;
  /** Same, per distractor (choice order minus the key). */
  distractorNgrams: number[];
  /** True when keyNgram ≥ keyThreshold AND every distractor < distractorCeiling. */
  tell: boolean;
};

export type EchoTellChapterResult = {
  chapterNumber: number;
  questions: EchoTellQuestionResult[];
  /** questionIds that tripped the echo gate. */
  flagged: string[];
  fail: boolean;
};

export type EchoTellOptions = {
  /** Minimum KEY n-gram to flag (default 5 — the calibrated zero-FP threshold;
   *  the ≥4 tier admits canonical-principle-key false positives). */
  keyThreshold?: number;
  /** A flag requires EVERY distractor to be strictly below this (default 4). */
  distractorCeiling?: number;
};

/** Per-chapter echo-tell: for each question, does the KEY lift a long verbatim
 *  n-gram from chapter prose while the distractors do not? */
export function echoTellChapter(chapter: ChapterV21, opts: EchoTellOptions = {}): EchoTellChapterResult {
  const keyThreshold = opts.keyThreshold ?? 5;
  const distractorCeiling = opts.distractorCeiling ?? 4;
  const proseTokens = contentTokens(echoProseSurface(chapter));
  const questions = chapter.quiz?.questions ?? [];
  const results: EchoTellQuestionResult[] = [];
  const flagged: string[] = [];

  for (const q of questions) {
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const ci = q.correctIndex;
    // Skip malformed questions from the gate (never a false BLOCK on bad shape —
    // the structural gate owns that). They cannot flag.
    if (choices.length === 0 || typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= choices.length) {
      results.push({ questionId: String(q.questionId ?? ""), keyNgram: 0, distractorNgrams: [], tell: false });
      continue;
    }
    const perChoice = choices.map((c) => longestSharedContentNgram(contentTokens(String(c)), proseTokens));
    const keyNgram = perChoice[ci];
    const distractorNgrams = perChoice.filter((_, i) => i !== ci);
    const tell = keyNgram >= keyThreshold && distractorNgrams.every((d) => d < distractorCeiling);
    results.push({ questionId: String(q.questionId ?? ""), keyNgram, distractorNgrams, tell });
    if (tell) flagged.push(String(q.questionId ?? ""));
  }

  return { chapterNumber: chapter.number, questions: results, flagged, fail: flagged.length > 0 };
}

// ── (b) SYMMETRIC LENGTH-TELL ────────────────────────────────────────────────────

export type LengthTellChapterResult = {
  chapterNumber: number;
  questionCount: number;
  /** Count of questions where the key is the UNIQUELY shortest choice (by chars). */
  uniquelyShortest: number;
  /** Count where the key is the UNIQUELY longest choice (by chars). */
  uniquelyLongest: number;
  shortestFail: boolean;
  longestFail: boolean;
  fail: boolean;
};

export type LengthTellOptions = {
  /** Max questions/chapter where the key may be uniquely shortest (default 4).
   *  Calibrated: the top-5 owner books peak at 4/9; POM v24 runs 5–8/9 → FAIL. */
  shortestMax?: number;
  /** Max questions/chapter where the key may be uniquely longest (default 9).
   *  The uniquely-longest key is the HISTORICAL norm in the owner's top books
   *  (atomic-habits / crucial-conversations / games-people-play all have 9/9
   *  chapters), so a tight per-chapter longest cap would fail the calibration
   *  corpus. Kept as a symmetric, configurable ceiling — the mechanism is
   *  present and can tighten if the corpus norm ever shifts — but calibrated to
   *  pass the top-5. See docs/v24/w2-card-preflight-calibration.md. */
  longestMax?: number;
};

/** True iff `choices[ci]` is the UNIQUELY {shortest|longest} choice by char count. */
function uniqueExtreme(choices: string[], ci: number, kind: "shortest" | "longest"): boolean {
  if (choices.length === 0 || ci < 0 || ci >= choices.length) return false;
  const lens = choices.map((c) => String(c).length);
  const target = kind === "shortest" ? Math.min(...lens) : Math.max(...lens);
  return lens[ci] === target && lens.filter((l) => l === target).length === 1;
}

/** Per-chapter symmetric length-tell over the 9 questions. */
export function lengthTellChapter(chapter: ChapterV21, opts: LengthTellOptions = {}): LengthTellChapterResult {
  const shortestMax = opts.shortestMax ?? 4;
  const longestMax = opts.longestMax ?? 9;
  const questions = chapter.quiz?.questions ?? [];
  let uniquelyShortest = 0;
  let uniquelyLongest = 0;
  let scorable = 0;
  for (const q of questions) {
    const choices = Array.isArray(q.choices) ? q.choices.map(String) : [];
    const ci = q.correctIndex;
    if (choices.length === 0 || typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= choices.length) continue;
    scorable += 1;
    if (uniqueExtreme(choices, ci, "shortest")) uniquelyShortest += 1;
    if (uniqueExtreme(choices, ci, "longest")) uniquelyLongest += 1;
  }
  const shortestFail = uniquelyShortest > shortestMax;
  const longestFail = uniquelyLongest > longestMax;
  return {
    chapterNumber: chapter.number,
    questionCount: scorable,
    uniquelyShortest,
    uniquelyLongest,
    shortestFail,
    longestFail,
    fail: shortestFail || longestFail,
  };
}

// ── (c) PRACTICE FLOOR ───────────────────────────────────────────────────────────

/** Number words that count as "a number" for the concreteness floor. */
const NUMBER_WORDS: ReadonlySet<string> = new Set(
  "one two three four five six seven eight nine ten eleven twelve single once twice first second third".split(/\s+/),
);

/** Timebox phrases (a concrete when). */
const TIMEBOX_RE =
  /\b(?:\d+\s*(?:seconds?|sec|minutes?|min|hours?|hrs?|days?|weeks?|months?)|24\s*hours?|today|tonight|tomorrow|this\s+(?:week|morning|afternoon|evening|month)|right\s+now|by\s+(?:the\s+)?end\s+of\s+(?:the\s+)?day)\b/i;

/** Non-imperative sentence openers: subjects/articles/subordinators that mark a
 *  STATEMENT, not a command. A first word outside this set (a bare verb) reads as
 *  imperative. Deliberately a denylist (broad low-FP) rather than a verb allowlist
 *  (brittle). */
const NON_IMPERATIVE_OPENERS: ReadonlySet<string> = new Set(
  ("i you he she it we they the a an this that these those there here my your his her our their its when while " +
    "whereas because since although though as of to").split(/\s+/),
);

/** True iff `text` contains a digit, a number word, or a timebox phrase. */
export function hasNumberOrTimebox(text: string): boolean {
  const t = text ?? "";
  if (/\d/.test(t)) return true;
  if (TIMEBOX_RE.test(t)) return true;
  const words = t.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  return words.some((w) => NUMBER_WORDS.has(w));
}

/** True iff `text` is imperative-led. Tests the first word AND the word after a
 *  leading trigger clause (a comma within the first 70 chars) — real implementation
 *  intentions read "Before X, write Y" / "In your next meeting, name Z", where the
 *  imperative verb follows the trigger. A first (or post-trigger) word outside the
 *  NON_IMPERATIVE_OPENERS denylist reads as a bare command verb. */
export function isImperativeLed(text: string): boolean {
  const s = (text ?? "").trim();
  if (!s) return false;
  const candidates = [s];
  const comma = s.indexOf(",");
  if (comma > 0 && comma <= 70) candidates.push(s.slice(comma + 1).trim());
  for (const cand of candidates) {
    const m = cand.match(/[A-Za-z][A-Za-z'-]*/);
    const first = m ? m[0].toLowerCase() : "";
    if (first && !NON_IMPERATIVE_OPENERS.has(first)) return true;
  }
  return false;
}

export type PracticeFloorResult = {
  chapterNumber: number;
  /** Which item(s) satisfied the floor (empty when none did → fail). */
  passingItems: Array<"tryThisNow" | "twentyFourHourChallenge">;
  fail: boolean;
};

/** Per-chapter practice floor: tryThisNow OR twentyFourHourChallenge must carry a
 *  concrete number/timebox AND be imperative-led. */
export function practiceFloorChapter(chapter: ChapterV21): PracticeFloorResult {
  const items: Array<{ key: "tryThisNow" | "twentyFourHourChallenge"; text: string }> = [
    { key: "tryThisNow", text: chapter.tryThisNow ?? "" },
    { key: "twentyFourHourChallenge", text: chapter.implementationPlan?.twentyFourHourChallenge ?? "" },
  ];
  const passingItems: Array<"tryThisNow" | "twentyFourHourChallenge"> = [];
  for (const { key, text } of items) {
    if (!text) continue;
    if (hasNumberOrTimebox(text) && isImperativeLed(text)) passingItems.push(key);
  }
  return { chapterNumber: chapter.number, passingItems, fail: passingItems.length === 0 };
}

// ── combined per-chapter verdict ─────────────────────────────────────────────────

export type CardQualityGateOptions = EchoTellOptions & LengthTellOptions;

export type CardQualityChapterResult = {
  chapterNumber: number;
  echo: EchoTellChapterResult;
  length: LengthTellChapterResult;
  practice: PracticeFloorResult;
  fail: boolean;
  /** One-line human reasons for each failing gate (feeds the retry card). */
  reasons: string[];
};

/** Run all three card-quality gates over one chapter and produce the combined
 *  verdict + human-readable reasons (the strings surfaced in the rubric line). */
export function cardQualityChapter(chapter: ChapterV21, opts: CardQualityGateOptions = {}): CardQualityChapterResult {
  const echo = echoTellChapter(chapter, opts);
  const length = lengthTellChapter(chapter, opts);
  const practice = practiceFloorChapter(chapter);
  const reasons: string[] = [];
  if (echo.fail) {
    reasons.push(
      `echo-tell: quiz ${echo.flagged.join(", ")} key lifts a ≥${opts.keyThreshold ?? 5}-content-token verbatim phrase from the chapter (paraphrase the key)`,
    );
  }
  if (length.shortestFail) {
    reasons.push(
      `length-tell: key is the uniquely-SHORTEST choice in ${length.uniquelyShortest}/${length.questionCount} questions (max ${opts.shortestMax ?? 4}) — lengthen keys / balance distractors`,
    );
  }
  if (length.longestFail) {
    reasons.push(
      `length-tell: key is the uniquely-LONGEST choice in ${length.uniquelyLongest}/${length.questionCount} questions (max ${opts.longestMax ?? 9}) — trim keys / balance distractors`,
    );
  }
  if (practice.fail) {
    reasons.push(
      "practice-floor: neither tryThisNow nor the 24-hour challenge is imperative-led with a concrete number/timebox — name ONE action with a number or timebox",
    );
  }
  return {
    chapterNumber: chapter.number,
    echo,
    length,
    practice,
    // Echo is ADVISORY (see header) — it must not flip the combined blocking flag,
    // which is embedded verbatim in the rubric-metrics artifact and would otherwise
    // invite a future consumer to block on it.
    fail: length.fail || practice.fail,
    reasons,
  };
}
