/**
 * Deterministic book-level pattern audit for v21 packages.
 *
 * Purpose: catch the failure mode that single Codex sessions create most
 * easily: a whole book made from a small set of reusable frames. Per-chapter
 * C8 catches templates inside one chapter; this file catches templates across
 * chapters: repeated hook/counter/try stems, repeated quiz explanations,
 * repeated example scene shells, missing planning artifacts, and rough source
 * drift.
 *
 * This does not change the v21 package schema. It only strengthens promotion,
 * scoring, and manual QA.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";
import { loadChapterSource } from "../source-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_DIR = resolve(__dirname, "../../state");
const BP11_MIN_CANDIDATE_LCS_CHARS = 100;
const BP11_MIN_BLOCKING_SKELETON_CHARS = 250;

export type PatternSeverity = "blocker" | "major" | "minor";

export type BookPatternAuditFinding = {
  code: string;
  severity: PatternSeverity;
  message: string;
  chapters?: number[];
  unit?: string;
  evidence?: string;
  count?: number;
  maxScoreCap?: number;
};

export type PatternOccurrence = {
  chapter: number;
  unit: string;
  evidence: string;
};

type BreakdownParagraphOccurrence = {
  nodeKey: string;
  chapter: number;
  unit: string;
  paragraphIndex: number;
  text: string;
  normalized: string;
};

type TemplatedShellEdge = {
  a: string;
  b: string;
  common: string;
  commonLength: number;
};

export type BookPatternAuditReport = {
  bookId: string;
  chapterCount: number;
  passed: boolean;
  findings: BookPatternAuditFinding[];
  stats: {
    repeatedQuizExplanationGroups: number;
    repeatedSurfaceFrameGroups: number;
    repeatedExampleFrameGroups: number;
    repeatedConcreteAnchors: number;
    templatedBreakdownShellGroups: number;
    shortParagraphDuplicateGroups: number;
    literalSubstringGroups: number;
    quizPositionTemplateDuplicates: number;
    missingPlanChapters: number[];
    missingBrief: boolean;
    sourceAlignmentWarnings: number;
  };
};

export const BOOK_PATTERN_AUDIT_LOGICAL_PATH = "critics/book-pattern-audit.json";

function auditRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function auditInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Validate frozen candidate audit bytes before any consumer treats them as trusted gate input. */
export function parseBookPatternAuditReport(
  value: unknown,
  expected: Readonly<{ bookId: string; chapterCount: number }>,
): BookPatternAuditReport {
  if (!auditRecord(value)) throw new Error("BOOK_PATTERN_AUDIT_INVALID: report must be an object");
  if (value.bookId !== expected.bookId) {
    throw new Error(`BOOK_PATTERN_AUDIT_MISMATCH: expected bookId ${expected.bookId}`);
  }
  if (value.chapterCount !== expected.chapterCount) {
    throw new Error(`BOOK_PATTERN_AUDIT_MISMATCH: expected chapterCount ${expected.chapterCount}`);
  }
  if (typeof value.passed !== "boolean" || !Array.isArray(value.findings) || !auditRecord(value.stats)) {
    throw new Error("BOOK_PATTERN_AUDIT_INVALID: report shape is invalid");
  }
  for (const finding of value.findings) {
    if (
      !auditRecord(finding) ||
      typeof finding.code !== "string" ||
      (finding.severity !== "blocker" && finding.severity !== "major" && finding.severity !== "minor") ||
      typeof finding.message !== "string" ||
      (finding.chapters !== undefined && (!Array.isArray(finding.chapters) || !finding.chapters.every(auditInteger))) ||
      (finding.unit !== undefined && typeof finding.unit !== "string") ||
      (finding.evidence !== undefined && typeof finding.evidence !== "string") ||
      (finding.count !== undefined && !auditInteger(finding.count)) ||
      (finding.maxScoreCap !== undefined && typeof finding.maxScoreCap !== "number")
    ) {
      throw new Error("BOOK_PATTERN_AUDIT_INVALID: finding shape is invalid");
    }
  }
  const blockerCount = value.findings.filter((finding) => (finding as Record<string, unknown>).severity === "blocker").length;
  if (value.passed !== (blockerCount === 0)) {
    throw new Error("BOOK_PATTERN_AUDIT_INVALID: passed must match blocker findings");
  }
  const stats = value.stats;
  const integerStats = [
    "repeatedQuizExplanationGroups",
    "repeatedSurfaceFrameGroups",
    "repeatedExampleFrameGroups",
    "repeatedConcreteAnchors",
    "templatedBreakdownShellGroups",
    "shortParagraphDuplicateGroups",
    "literalSubstringGroups",
    "quizPositionTemplateDuplicates",
    "sourceAlignmentWarnings",
  ] as const;
  if (
    integerStats.some((key) => !auditInteger(stats[key])) ||
    !Array.isArray(stats.missingPlanChapters) ||
    !stats.missingPlanChapters.every(auditInteger) ||
    typeof stats.missingBrief !== "boolean"
  ) {
    throw new Error("BOOK_PATTERN_AUDIT_INVALID: stats shape is invalid");
  }
  return value as unknown as BookPatternAuditReport;
}

export type BookPatternAuditOptions = {
  bookId: string;
  chapters: ChapterV21[];
  /** Defaults to chapterflow-v21-authored/state. */
  stateDir?: string;
  /** If true, require a manual or generated brief and plan artifacts. Default true. */
  requirePlanArtifacts?: boolean;
  /** If false, skip source sidecar alignment warnings. Default true. */
  checkSourceAlignment?: boolean;
  /** Optional per-author voice profile. When supplied, relaxes B13/B14 caps
   *  to allow each author's natural clustering on certain hook first-words
   *  or counter shapes. See config/author-voice-profiles.json. */
  authorVoiceProfile?: AuthorVoiceProfile;
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "can",
  "could", "did", "do", "does", "doing", "for", "from", "had", "has", "have", "he",
  "her", "hers", "him", "his", "how", "if", "in", "into", "is", "it", "its", "just",
  "more", "most", "not", "of", "on", "or", "our", "out", "over", "she", "so", "that",
  "the", "their", "them", "then", "there", "these", "they", "this", "those", "to", "too",
  "up", "use", "used", "using", "was", "we", "what", "when", "where", "which", "who",
  "why", "will", "with", "without", "you", "your", "chapter", "book", "author",
]);

const GENERIC_SOURCE_WORDS = new Set([
  "chapter", "section", "author", "reader", "readers", "book", "idea", "ideas", "lesson",
  "practice", "example", "examples", "people", "person", "move", "moves", "work", "life",
  "choice", "choices", "decision", "decisions", "problem", "problems", "better", "think",
  "thinking", "action", "actions", "make", "makes", "making", "feel", "feels", "source",
]);

function compact(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripLeadingLabel(raw: string): string {
  const colon = raw.indexOf(":");
  if (colon > 0 && colon <= 75 && raw.length - colon > 25) return raw.slice(colon + 1);
  return raw;
}

function titleTokens(title?: string): Set<string> {
  return new Set(tokenize(title ?? "", { keepStopwords: false }));
}

function tokenize(
  value: string,
  opts: { keepStopwords?: boolean; keepShort?: boolean } = {},
): string[] {
  return compact(value)
    .replace(/[’']/g, "")
    .replace(/\b\d{1,2}:\d{2}\s*(a\.m\.|p\.m\.|am|pm)\b/gi, " TIME ")
    .replace(/\b\d+(?:\.\d+)?\b/g, " NUM ")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => opts.keepShort || t.length >= 3)
    .filter((t) => opts.keepStopwords || !STOPWORDS.has(t));
}

export function normalizeSurfaceFrame(text: string, chapterTitle?: string): string[] {
  let raw = stripLeadingLabel(compact(text));
  if (chapterTitle) {
    raw = raw.replace(new RegExp(escapeRegExp(chapterTitle), "ig"), " ");
  }
  // Names are often the only thing an LLM varies. Remove them before skeleton checks.
  raw = raw.replace(/\b[A-Z][a-z]{2,}\b/g, " NAME ");
  const tTokens = titleTokens(chapterTitle);
  return tokenize(raw).filter((t) => !tTokens.has(t) && t !== "name" && t !== "time" && t !== "num");
}

function normalizeExact(text: string): string {
  return tokenize(text, { keepStopwords: true, keepShort: true }).join(" ");
}

function normalizeWhitespaceLower(text: string): string {
  return compact(text).toLowerCase();
}

function longestCommonSubstringAtLeast(
  left: string,
  right: string,
  minLength: number,
): { text: string; length: number } | null {
  if (left.length < minLength || right.length < minLength) return null;

  const a = left.length <= right.length ? left : right;
  const b = left.length <= right.length ? right : left;
  const positions = new Map<string, number[]>();

  for (let i = 0; i <= a.length - minLength; i++) {
    const key = a.slice(i, i + minLength);
    const list = positions.get(key) ?? [];
    // Long boilerplate can generate many identical low-information windows.
    // A few positions are enough to recover the shared skeleton without
    // turning score-chapters into a quadratic substring copier.
    if (list.length < 8) list.push(i);
    positions.set(key, list);
  }

  let bestStart = -1;
  let bestEnd = -1;
  for (let j = 0; j <= b.length - minLength; j++) {
    const candidates = positions.get(b.slice(j, j + minLength));
    if (!candidates) continue;

    for (const i of candidates) {
      let startA = i;
      let startB = j;
      while (startA > 0 && startB > 0 && a[startA - 1] === b[startB - 1]) {
        startA -= 1;
        startB -= 1;
      }

      let endA = i + minLength;
      let endB = j + minLength;
      while (endA < a.length && endB < b.length && a[endA] === b[endB]) {
        endA += 1;
        endB += 1;
      }

      if (endA - startA > bestEnd - bestStart) {
        bestStart = startA;
        bestEnd = endA;
      }
    }
  }

  if (bestStart < 0 || bestEnd - bestStart < minLength) return null;
  const text = a.slice(bestStart, bestEnd).trim();
  return { text, length: text.length };
}

class DisjointSet {
  private parent = new Map<string, string>();

  add(value: string): void {
    if (!this.parent.has(value)) this.parent.set(value, value);
  }

  find(value: string): string {
    this.add(value);
    const parent = this.parent.get(value);
    if (!parent || parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

function ngrams(tokens: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    const gram = tokens.slice(i, i + n).join(" ");
    if (gram.replace(/\s/g, "").length >= n * 4) out.push(gram);
  }
  return out;
}

function pushOccurrence(
  map: Map<string, PatternOccurrence[]>,
  key: string,
  occurrence: PatternOccurrence,
): void {
  const list = map.get(key) ?? [];
  // One occurrence per chapter+unit+key is enough.
  if (!list.some((o) => o.chapter === occurrence.chapter && o.unit === occurrence.unit)) {
    list.push(occurrence);
    map.set(key, list);
  }
}

function chapterThreshold(chapterCount: number): number {
  if (chapterCount <= 1) return 2;
  if (chapterCount <= 5) return 2;
  return Math.max(3, Math.floor(chapterCount * 0.2) + 1);
}

function uniqueChapters(occurrences: PatternOccurrence[]): number[] {
  return Array.from(new Set(occurrences.map((o) => o.chapter))).sort((a, b) => a - b);
}

function firstEvidence(occurrences: PatternOccurrence[]): string | undefined {
  return occurrences.find((o) => o.evidence)?.evidence;
}

function chapterText(ch: ChapterV21): string {
  return [
    ch.title,
    ch.hook,
    ch.counterintuition,
    ch.tryThisNow,
    ch.keyTakeaway,
    ch.breakdown?.fastRead,
    ch.breakdown?.deepRead,
    ch.breakdown?.fullRead,
    ...(ch.examples ?? []).flatMap((ex) => [ex.title, ex.scenario, ex.whatToDo, ex.whyItMatters]),
    ...(ch.quiz?.questions ?? []).flatMap((q) => [q.prompt, ...(q.choices ?? []), q.explanation]),
    ...(ch.reviewCards ?? []).flatMap((c) => [c.front, c.back]),
    ch.implementationPlan?.coreSkill,
    ch.implementationPlan?.twentyFourHourChallenge,
    ch.implementationPlan?.weeklyPractice,
    ...(ch.implementationPlan?.ifThenPlans ?? []).map((p) => p.plan),
  ].map(compact).join("\n");
}

function distinctiveKeywords(text: string, limit = 18): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    if (GENERIC_SOURCE_WORDS.has(token)) continue;
    if (token.length < 4) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function planPaths(stateDir: string, chapterId: string): string[] {
  return [
    resolve(stateDir, "plans", `${chapterId}.manual-plan.json`),
    resolve(stateDir, "plans", `${chapterId}.plan.json`),
  ];
}

function briefPaths(stateDir: string, bookId: string): string[] {
  return [
    resolve(stateDir, "briefs", `${bookId}.manual-brief.json`),
    resolve(stateDir, "briefs", `${bookId}.brief.json`),
  ];
}

function readPlanCoreMove(stateDir: string, chapterId: string): string | null {
  for (const path of planPaths(stateDir, chapterId)) {
    if (!existsSync(path)) continue;
    try {
      const plan = JSON.parse(readFileSync(path, "utf8"));
      if (typeof plan.coreMove === "string") return plan.coreMove;
    } catch {
      return null;
    }
  }
  return null;
}

function anchorKeyFromScenario(scenario: string, chapterTitle?: string): string | null {
  const tokens = normalizeSurfaceFrame(scenario, chapterTitle);
  if (tokens.length < 7) return null;
  return tokens.slice(0, 10).join(" ");
}

function timePlaceKey(scenario: string): string | null {
  const text = compact(scenario);
  const time = text.match(/\b\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)\b/i)?.[0]?.toLowerCase();
  if (!time) return null;

  const placeMatches = Array.from(text.matchAll(/\b(?:in|at|beside|inside|outside|on)\s+([^,.]{8,90})/gi));
  for (const match of placeMatches) {
    const place = match[1]
      ?.toLowerCase()
      ?.replace(/\b\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)\b/gi, "")
      ?.replace(/\b(?:a\.m\.|p\.m\.|am|pm)\b/gi, "")
      ?.replace(/\s+/g, " ")
      ?.trim();
    if (!place || place.length < 8) continue;
    if (/^\d/.test(place)) continue;
    return `${time}|${place}`;
  }
  return null;
}

// ── B13/B14 — first-word and counter-shape cap audits ────────────────────────
//
// These audits look at the BOOK as a whole rather than at any single chapter,
// catching the pattern where individual chapters are competent but the set
// converges on a single hook opener or paradox shape. Author profiles (see
// config/author-voice-profiles.json) can relax the caps when the source
// author naturally clusters on one shape (e.g., Robert Greene leads with a
// historical figure most chapters).

export type CounterShape =
  | "negation_correction"
  | "paradox_colon"
  | "x_can_y_still"
  | "what_looks_like"
  | "despite_led"
  | "in_fact_reversal"
  | "question_led"
  | "other";

/** Classify the paradox-signal SHAPE of a counterintuition string. First match
 *  wins; "other" is the fallback for counters that don't fit a known shape.
 *
 *  negation_correction is the "X is not Y, but Z" shape — the structural
 *  pattern, not a specific opener stem. Matches when any of the first two
 *  sentences contains "is/are/does/do not [up to 80 chars without sentence
 *  break] but". This is the right granularity: B11 already catches the
 *  literal first-sentence negation opener, and B14 needs to catch the
 *  whole-counter shape regardless of which sentence carries the negation.
 *  So Good They Can't Ignore You shipped 14/16 counters in this shape. */
export function classifyCounterShape(counter: string): CounterShape {
  const text = counter.trim();
  if (/(?:is not|are not|does not|do not)\b[^.!?]{0,80}\bbut\b/i.test(text)) return "negation_correction";
  if (/^The paradox:/i.test(text)) return "paradox_colon";
  if (/\bcan\b.{0,60}\band still\b/i.test(text)) return "x_can_y_still";
  if (/^What looks like/i.test(text)) return "what_looks_like";
  if (/^Despite\b/i.test(text)) return "despite_led";
  if (/\bIn fact\b/.test(text)) return "in_fact_reversal";
  if (/^Why does\b|^Why do\b/i.test(text)) return "question_led";
  return "other";
}

export type AuthorVoiceProfile = {
  register?: string;
  naturalCounterShapes?: Partial<Record<CounterShape, number>>;
  naturalHookShapes?: Record<string, number>;
  signatureFrames?: string[];
  avoidFrames?: string[];
  unconfirmed?: boolean;
};

/** Map an extracted first word to the semantic hook-shape category used in
 *  author-voice-profiles.json. Stopwords like "the"/"a"/"an" map to a
 *  determiner-led category; other words are assumed to be proper-noun first
 *  words (named protagonist or historical actor). The mapping is best-effort
 *  — `null` means we don't have a profile category for this word and should
 *  fall back to the default cap. */
function mapFirstWordToShapeCategory(firstWord: string): string | null {
  const w = firstWord.toLowerCase();
  if (w === "the") return "the_noun";
  if (w === "a" || w === "an") return "a_noun";
  if (w === "you" || w === "your") return "second_person_call";
  if (w === "why" || w === "how" || w === "what" || w === "when" || w === "where") return "question_led";
  if (w === "it" || w === "they" || w === "we") return "pronoun_led";
  // Anything else — a proper noun, a number, an unusual word — falls through
  // to the named-actor categories. The cap then comes from whichever of
  // `named_protagonist_action` or `historical_named_actor` the author profile
  // sets higher.
  return null;
}

/** Resolve B13 first-word cap for a given first word. Returns the threshold
 *  fraction (0-1). Without an author profile, defaults to 0.50. With a
 *  profile, allows up to max(natural_share + 0.10, 0.40), capped at 0.60. */
function resolveHookFirstWordCap(firstWord: string, profile?: AuthorVoiceProfile): number {
  if (!profile?.naturalHookShapes) return 0.5;
  const category = mapFirstWordToShapeCategory(firstWord);
  let natural = 0;
  if (category) {
    natural = profile.naturalHookShapes[category] ?? 0;
  } else {
    // Proper-noun first words: pick the higher of `named_protagonist_action`
    // / `historical_named_actor` since both represent named actors.
    natural = Math.max(
      profile.naturalHookShapes["named_protagonist_action"] ?? 0,
      profile.naturalHookShapes["historical_named_actor"] ?? 0,
    );
  }
  if (natural <= 0) return 0.5;
  return Math.min(Math.max(natural + 0.1, 0.4), 0.6);
}

/** Resolve B14 counter shape cap for a given shape. Returns the threshold
 *  fraction (0-1). Without an author profile, defaults to 0.40. With a
 *  profile, allows up to max(natural_share + 0.10, 0.30) but never above 0.50. */
function resolveCounterShapeCap(shape: CounterShape, profile?: AuthorVoiceProfile): number {
  if (!profile?.naturalCounterShapes) return 0.4;
  const natural = profile.naturalCounterShapes[shape] ?? 0;
  if (natural <= 0) return 0.4;
  return Math.min(Math.max(natural + 0.1, 0.3), 0.5);
}

export function checkHookFirstWordCap(
  chapters: ChapterV21[],
  profile?: AuthorVoiceProfile,
): BookPatternAuditFinding[] {
  if (chapters.length < 5) return [];
  const firstWords: Map<string, number[]> = new Map();
  for (const ch of chapters) {
    const hook = (ch.hook ?? "").trim();
    const firstWord = hook.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, "");
    if (!firstWord) continue;
    const arr = firstWords.get(firstWord) ?? [];
    arr.push(ch.number);
    firstWords.set(firstWord, arr);
  }
  const findings: BookPatternAuditFinding[] = [];
  for (const [word, chs] of firstWords) {
    const cap = resolveHookFirstWordCap(word, profile);
    const threshold = Math.ceil(chapters.length * cap);
    if (chs.length >= threshold) {
      findings.push({
        code: "B13",
        severity: "major",
        chapters: chs,
        count: chs.length,
        unit: "hook.firstWord",
        evidence: word,
        message: `Hook frame clustering: ${chs.length} of ${chapters.length} chapters open with "${word}" as the first word (cap ${threshold}, ${Math.round(cap * 100)}% of book${profile?.naturalHookShapes ? "; cap reflects author profile" : ""}). Chapters: ${chs.join(", ")}. Vary hook openers across the book.`,
        maxScoreCap: 80,
      });
    }
  }
  return findings;
}

export function checkCounterShapeCap(
  chapters: ChapterV21[],
  profile?: AuthorVoiceProfile,
): BookPatternAuditFinding[] {
  if (chapters.length < 5) return [];
  const shapeCounts: Map<CounterShape, number[]> = new Map();
  for (const ch of chapters) {
    const counter = ch.counterintuition ?? "";
    const shape = classifyCounterShape(counter);
    const arr = shapeCounts.get(shape) ?? [];
    arr.push(ch.number);
    shapeCounts.set(shape, arr);
  }
  const findings: BookPatternAuditFinding[] = [];
  for (const [shape, chs] of shapeCounts) {
    if (shape === "other") continue;
    const cap = resolveCounterShapeCap(shape, profile);
    const threshold = Math.ceil(chapters.length * cap);
    if (chs.length >= threshold) {
      findings.push({
        code: "B14",
        severity: "major",
        chapters: chs,
        count: chs.length,
        unit: "counterintuition.shape",
        evidence: shape,
        message: `Counter shape clustering: ${chs.length} of ${chapters.length} chapters use the "${shape}" paradox-signal shape (cap ${threshold}, ${Math.round(cap * 100)}% of book${profile?.naturalCounterShapes ? "; cap reflects author profile" : ""}). Chapters: ${chs.join(", ")}. Vary paradox-signal shapes across the book.`,
        maxScoreCap: 80,
      });
    }
  }
  return findings;
}

export function runBookPatternAudit(options: BookPatternAuditOptions): BookPatternAuditReport {
  const bookId = options.bookId;
  const chapters = [...options.chapters].sort((a, b) => a.number - b.number);
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR;
  const requirePlanArtifacts = options.requirePlanArtifacts !== false;
  const checkSourceAlignment = options.checkSourceAlignment !== false;
  const findings: BookPatternAuditFinding[] = [];

  // BP7: durable planning artifacts. Allows either manual Codex artifacts or
  // generated pipeline artifacts so the real provider pipeline still passes.
  let missingBrief = false;
  const missingPlanChapters: number[] = [];
  if (requirePlanArtifacts) {
    missingBrief = !briefPaths(stateDir, bookId).some((p) => existsSync(p));
    if (missingBrief) {
      findings.push({
        code: "BP7",
        severity: "blocker",
        message: `Missing book brief artifact for ${bookId}. Expected ${bookId}.manual-brief.json or ${bookId}.brief.json under state/briefs/. Whole-book Codex runs without a durable brief are not promotable.`,
        maxScoreCap: 85,
      });
    }
    for (const ch of chapters) {
      if (!planPaths(stateDir, ch.chapterId).some((p) => existsSync(p))) {
        missingPlanChapters.push(ch.number);
      }
    }
    if (missingPlanChapters.length > 0) {
      findings.push({
        code: "BP7",
        severity: "blocker",
        chapters: missingPlanChapters,
        count: missingPlanChapters.length,
        message: `Missing per-chapter plan artifacts for chapters ${missingPlanChapters.join(", ")}. Expected <chapterId>.manual-plan.json or <chapterId>.plan.json under state/plans/.`,
        maxScoreCap: 85,
      });
    }
  }

  // BP1: repeated quiz explanations, exact after whitespace/punctuation normalization.
  const quizExplanationMap = new Map<string, PatternOccurrence[]>();
  for (const ch of chapters) {
    for (const [i, q] of (ch.quiz?.questions ?? []).entries()) {
      const explanation = compact(q.explanation);
      if (!explanation) continue;
      const key = normalizeExact(explanation);
      if (key.length < 40) continue;
      pushOccurrence(quizExplanationMap, key, {
        chapter: ch.number,
        unit: `quiz.q${String(i + 1).padStart(2, "0")}.explanation`,
        evidence: explanation.slice(0, 220),
      });
    }
  }
  let repeatedQuizExplanationGroups = 0;
  for (const [key, occurrences] of quizExplanationMap) {
    const chs = uniqueChapters(occurrences);
    if (occurrences.length >= 3 || chs.length >= 2) {
      repeatedQuizExplanationGroups += 1;
      findings.push({
        code: "BP1",
        severity: "blocker",
        chapters: chs,
        count: occurrences.length,
        unit: "quiz.explanation",
        evidence: firstEvidence(occurrences) ?? key,
        message: `Repeated quiz explanation appears ${occurrences.length} times across chapter(s) ${chs.join(", ")}. Quiz explanations must be specific to each prompt and answer choice, not reusable boilerplate.`,
        maxScoreCap: 70,
      });
    }
  }

  // BP3: repeated surface frames in hooks, counters, and tryThisNow.
  const surfaceFrameMap = new Map<string, PatternOccurrence[]>();
  const surfaceFields: Array<["hook" | "counterintuition" | "tryThisNow", string]> = [
    ["hook", "hook"],
    ["counterintuition", "counterintuition"],
    ["tryThisNow", "tryThisNow"],
  ];
  for (const ch of chapters) {
    for (const [field, label] of surfaceFields) {
      const value = compact((ch as any)[field]);
      if (!value) continue;
      const tokens = normalizeSurfaceFrame(value, ch.title);
      for (const gram of ngrams(tokens, 5)) {
        pushOccurrence(surfaceFrameMap, `${label}|${gram}`, {
          chapter: ch.number,
          unit: label,
          evidence: value.slice(0, 220),
        });
      }
    }
  }
  let repeatedSurfaceFrameGroups = 0;
  const threshold = chapterThreshold(chapters.length);
  for (const [key, occurrences] of surfaceFrameMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= threshold) {
      repeatedSurfaceFrameGroups += 1;
      const [field, gram] = key.split("|");
      findings.push({
        code: "BP3",
        severity: "blocker",
        chapters: chs,
        count: chs.length,
        unit: field,
        evidence: gram,
        message: `Repeated ${field} frame across chapters ${chs.join(", ")}: "${gram}". This is cross-chapter template collapse.`,
        maxScoreCap: 80,
      });
    }
  }

  // BP9: hook-shell repetition with a tighter floor than BP3.
  //
  // BP3 fires only when a 5-gram appears in chapterThreshold(N) chapters
  // (7 chapters for a 30-chapter book). Indistractable shipped with three
  // hook shells — "<noun> makes the pressure visible before the day can
  // rename it as necessity", "<noun> catches the moment when a respectable
  // substitute starts stealing the plan", "<noun> waits beside the task,
  // and the easier move is already asking for attention" — each used in
  // only 2 to 3 chapters with the leading noun swapped. They never tripped
  // BP3 and the ship gate said pass.
  //
  // BP9 lowers the floor to 3 chapters for hooks specifically, uses 4-grams
  // (not 5), and forces names AND leading noun phrases out of the comparison
  // so the rest of the shell is what survives. Hooks are the single most
  // surfaced field in the reader app; one shell repeated three times is a
  // shipping defect.
  const hookShellMap = new Map<string, PatternOccurrence[]>();
  for (const ch of chapters) {
    const value = compact(ch.hook);
    if (!value) continue;
    // Drop leading noun phrase (everything before the first verb-like word)
    // by stripping the first 2 to 4 tokens. We tokenize with names→NAME and
    // chapter-title scrubbed already via normalizeSurfaceFrame.
    const tokens = normalizeSurfaceFrame(value, ch.title);
    const tail = tokens.slice(3); // skip first three skeleton tokens
    for (const gram of ngrams(tail, 4)) {
      pushOccurrence(hookShellMap, gram, {
        chapter: ch.number,
        unit: "hook",
        evidence: value.slice(0, 220),
      });
    }
  }
  for (const [gram, occurrences] of hookShellMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= 3) {
      repeatedSurfaceFrameGroups += 1;
      findings.push({
        code: "BP9",
        severity: "blocker",
        chapters: chs,
        count: chs.length,
        unit: "hook",
        evidence: gram,
        message: `Hook shell repeats across chapters ${chs.join(", ")}: "${gram}". Hooks are the most-surfaced field in the app; three or more chapters sharing a hook shell is a shipping defect.`,
        maxScoreCap: 70,
      });
    }
  }

  // B11: counter negation-correction shell repetition.
  //
  // BP3/BP9 catch verbatim shell repeats; the banned-phrase config blocks
  // literal stems like "The paradox is that" / "Most readers assume". Neither
  // catches the deeper shape: a first sentence with negation ("X is not Y" /
  // "X does not Y") followed by a correction sentence. You Can't Hurt Me
  // shipped 10 of 11 chapters in this shape and Charisma Myth shipped 9 of 13
  // pre-regen; the literal strings varied so every existing gate said pass,
  // but a reader cycling chapters saw the same syntactic frame every time.
  //
  // MAJOR, no score cap — substance can be fine even when the shell repeats.
  // Threshold is 50% of chapters because that is the point at which a reader
  // cycling chapters notices the shared frame.
  const b11Chapters: number[] = [];
  for (const ch of chapters) {
    const counter = compact(ch.counterintuition);
    if (!counter) continue;
    const sentences = counter.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length < 2) continue;
    const first = sentences[0];
    if (/\b(is not|are not|does not|do not)\b/i.test(first)) {
      b11Chapters.push(ch.number);
    }
  }
  if (chapters.length > 0 && b11Chapters.length / chapters.length >= 0.5) {
    findings.push({
      code: "B11",
      severity: "major",
      chapters: b11Chapters,
      count: b11Chapters.length,
      unit: "counterintuition",
      message: `${b11Chapters.length} of ${chapters.length} chapters (${Math.round((b11Chapters.length / chapters.length) * 100)}%) open counterintuition with a negation-correction shell ("X is not Y. [correction]"). Affected: Ch${b11Chapters.join(", Ch")}. The shell is a templating tell — pick more varied paradox-signal shapes across chapters.`,
    });
  }

  // B13: hook first-word cap. Beyond shell repetition (BP3/BP9), the
  // single most reader-visible pattern is when many chapters open with
  // the SAME first word. GMM Vol 2 shipped 19/20 chapters opening with
  // "The…"; Talk Like Ted (pre-fix) had 9/9; 48 Laws had 10+ chapters
  // sharing an identical 14-word hook template that started "The…". A
  // reader cycling chapters sees that within three chapters.
  //
  // MAJOR with `maxScoreCap=80`. Threshold: any first-word used in 50%+
  // of chapters in the book (relaxed per author profile when supplied).
  for (const f of checkHookFirstWordCap(chapters, options.authorVoiceProfile)) findings.push(f);

  // B14: counter shape cap. Even when no two counters share a literal
  // stem (covered by B11/B12 and the banned-phrase list), an agent will
  // converge on a single paradox SHAPE (negation_correction, paradox_colon,
  // x_can_y_still, etc.) across most of the book. So Good They Can't
  // Ignore You shipped 14/16 chapters using the negation-correction shape;
  // Righteous Mind shipped 5/12 paradox_colon + 7/12 x_can_y_still. Each
  // chapter is individually fine; the cluster is the defect.
  //
  // MAJOR with `maxScoreCap=80`. Threshold: any shape used in 40%+ of
  // chapters in the book (relaxed per author profile when supplied).
  for (const f of checkCounterShapeCap(chapters, options.authorVoiceProfile)) findings.push(f);

  // B12: counter connector phrase overuse.
  //
  // Even when no two counters share a literal stem, agents on prior regens
  // consistently reused the same second-sentence connector (In fact / The
  // opposite / Counterintuitively / Instead / Despite) across more chapters
  // than the brief's stated cap. Visible in post-regen audits on Atomic
  // Habits, NSTD, Charisma Myth, and Pitch Anything. Reader-visible at 4+
  // chapters sharing a connector in a sub-10-chapter book.
  //
  // MINOR, no score cap — advisory only. Threshold scales with book length:
  // small books (≤10 ch) tolerate 2 repeats, medium (11–25) tolerate 3,
  // large (26+) tolerate 4.
  const COUNTER_CONNECTORS = [
    "In fact",
    "The opposite",
    "Counterintuitively",
    "Instead",
    "Despite",
    "But actually",
    "What looks like",
  ];
  const b12Cap = chapters.length <= 10 ? 2 : chapters.length <= 25 ? 3 : 4;
  for (const connector of COUNTER_CONNECTORS) {
    const re = new RegExp(`\\b${escapeRegExp(connector)}\\b`, "i");
    const matching: number[] = [];
    for (const ch of chapters) {
      if (re.test(ch.counterintuition ?? "")) matching.push(ch.number);
    }
    if (matching.length > b12Cap) {
      findings.push({
        code: "B12",
        severity: "minor",
        chapters: matching,
        count: matching.length,
        unit: "counterintuition",
        evidence: connector,
        message: `Connector "${connector}" appears in ${matching.length} chapters (cap ${b12Cap} for ${chapters.length}-chapter book). Chapters: ${matching.join(", ")}.`,
      });
    }
  }

  // BP2: repeated example scene shells across chapters.
  const exampleNgramMap = new Map<string, PatternOccurrence[]>();
  const exampleAnchorMap = new Map<string, PatternOccurrence[]>();
  const timePlaceMap = new Map<string, PatternOccurrence[]>();
  for (const ch of chapters) {
    for (const [i, ex] of (ch.examples ?? []).entries()) {
      const scenario = compact(ex.scenario);
      if (!scenario) continue;
      const unit = `example[${i}]`;
      const tokens = normalizeSurfaceFrame(scenario, ch.title);
      for (const gram of ngrams(tokens, 6)) {
        pushOccurrence(exampleNgramMap, gram, {
          chapter: ch.number,
          unit,
          evidence: scenario.slice(0, 220),
        });
      }
      const anchor = anchorKeyFromScenario(scenario, ch.title);
      if (anchor) {
        pushOccurrence(exampleAnchorMap, anchor, {
          chapter: ch.number,
          unit,
          evidence: scenario.slice(0, 180),
        });
      }
      const timePlace = timePlaceKey(scenario);
      if (timePlace) {
        pushOccurrence(timePlaceMap, timePlace, {
          chapter: ch.number,
          unit,
          evidence: scenario.slice(0, 180),
        });
      }
    }
  }
  let repeatedExampleFrameGroups = 0;
  const exampleThreshold = chapterThreshold(chapters.length);
  for (const [gram, occurrences] of exampleNgramMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= exampleThreshold) {
      repeatedExampleFrameGroups += 1;
      findings.push({
        code: "BP2",
        severity: "blocker",
        chapters: chs,
        count: chs.length,
        unit: "examples.scenario",
        evidence: gram,
        message: `Repeated example scene wording across chapters ${chs.join(", ")}: "${gram}". Cross-chapter C8 requires a structural rewrite, not renaming.`,
        maxScoreCap: 75,
      });
    }
  }
  for (const [anchor, occurrences] of exampleAnchorMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= exampleThreshold) {
      repeatedExampleFrameGroups += 1;
      findings.push({
        code: "BP2",
        severity: "blocker",
        chapters: chs,
        count: chs.length,
        unit: "examples.scenario.opening",
        evidence: anchor,
        message: `Repeated example opening skeleton across chapters ${chs.join(", ")}: "${anchor}". The first-scene choreography is being reused.`,
        maxScoreCap: 75,
      });
    }
  }

  // BP10: cross-chapter breakdown prose duplication.
  //
  // BP1 catches identical quiz explanations. BP2 catches example-scenario
  // shells. Neither scans the breakdown tiers. Extreme Ownership shipped
  // with six paragraphs (two in deepRead, four in fullRead) copy-pasted
  // verbatim into all 13 chapters — over 50% of every chapter's deepRead
  // and fullRead was identical filler. The ship gate and book gate both
  // passed because nothing audited breakdown prose across chapters.
  //
  // BP10 splits each chapter's fastRead, deepRead, and fullRead into
  // paragraphs, normalizes whitespace, and fires a BLOCKER for any
  // paragraph of 30+ words that appears verbatim in 3 or more chapters.
  // Score cap is 60 because cross-chapter breakdown duplication is the
  // worst class of templating: the reader sees the same paragraph as
  // they move from chapter to chapter.
  const breakdownParagraphMap = new Map<string, PatternOccurrence[]>();
  for (const ch of chapters) {
    for (const [tierName, tierText] of [
      ["fastRead", ch.breakdown?.fastRead ?? ""],
      ["deepRead", ch.breakdown?.deepRead ?? ""],
      ["fullRead", ch.breakdown?.fullRead ?? ""],
    ] as const) {
      const paragraphs = tierText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      for (const para of paragraphs) {
        const wordCount = para.split(/\s+/).filter(Boolean).length;
        if (wordCount < 30) continue;
        // Normalize: lowercase, collapse whitespace, strip surrounding
        // punctuation. Keep words and internal punctuation that does not
        // affect identity.
        const key = para
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/[“”"‘’]/g, "")
          .trim();
        pushOccurrence(breakdownParagraphMap, key, {
          chapter: ch.number,
          unit: `breakdown.${tierName}`,
          evidence: para.slice(0, 220),
        });
      }
    }
  }
  for (const [_key, occurrences] of breakdownParagraphMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= 3) {
      const tier = occurrences[0]?.unit ?? "breakdown";
      findings.push({
        code: "BP10",
        severity: "blocker",
        chapters: chs,
        count: chs.length,
        unit: tier,
        evidence: firstEvidence(occurrences) ?? "",
        message: `A breakdown paragraph (${tier}) repeats verbatim in ${chs.length} chapters (${chs.join(", ")}). Cross-chapter breakdown duplication is the worst class of templating — the reader sees the same paragraph as they move through the book. Rewrite the duplicated paragraph in each chapter so the prose is chapter-specific.`,
        maxScoreCap: 60,
      });
    }
  }

  // BP11: templated breakdown paragraph shells with small variable slots.
  //
  // BP10 only catches exact paragraph reuse. A slightly more polished failure
  // swaps one noun and one verb phrase while leaving the reader-facing
  // skeleton intact. This scans long breakdown paragraphs pairwise, looks for
  // a 100+ character shared substring that covers at least 40% of the shorter
  // paragraph, and then groups connected matches across chapters. A blocker
  // requires a paragraph-scale static skeleton, not merely a repeated slogan
  // or generic sentence fragment.
  const shellParagraphs: BreakdownParagraphOccurrence[] = [];
  for (const ch of chapters) {
    for (const [tierName, tierText] of [
      ["fastRead", ch.breakdown?.fastRead ?? ""],
      ["deepRead", ch.breakdown?.deepRead ?? ""],
      ["fullRead", ch.breakdown?.fullRead ?? ""],
    ] as const) {
      const paragraphs = tierText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      paragraphs.forEach((para, index) => {
        const normalized = normalizeWhitespaceLower(para);
        if (normalized.length < 200) return;
        shellParagraphs.push({
          nodeKey: `${ch.number}|${tierName}|${index}`,
          chapter: ch.number,
          unit: `breakdown.${tierName}#p${index + 1}`,
          paragraphIndex: index,
          text: para,
          normalized,
        });
      });
    }
  }

  const nodeByKey = new Map(shellParagraphs.map((p) => [p.nodeKey, p]));
  const shellSet = new DisjointSet();
  const shellEdges: TemplatedShellEdge[] = [];

  for (let i = 0; i < shellParagraphs.length; i++) {
    const a = shellParagraphs[i];
    for (let j = i + 1; j < shellParagraphs.length; j++) {
      const b = shellParagraphs[j];
      if (a.chapter === b.chapter) continue;

      const common = longestCommonSubstringAtLeast(a.normalized, b.normalized, BP11_MIN_CANDIDATE_LCS_CHARS);
      if (!common) continue;

      const shorterLength = Math.min(a.normalized.length, b.normalized.length);
      if (common.length / shorterLength < 0.4) continue;

      shellSet.union(a.nodeKey, b.nodeKey);
      shellEdges.push({ a: a.nodeKey, b: b.nodeKey, common: common.text, commonLength: common.length });
    }
  }

  const shellComponents = new Map<string, Set<string>>();
  for (const edge of shellEdges) {
    const root = shellSet.find(edge.a);
    const nodes = shellComponents.get(root) ?? new Set<string>();
    nodes.add(edge.a);
    nodes.add(edge.b);
    shellComponents.set(root, nodes);
  }

  let templatedBreakdownShellGroups = 0;
  for (const [root, nodeKeys] of shellComponents) {
    const nodes = Array.from(nodeKeys)
      .map((key) => nodeByKey.get(key))
      .filter((node): node is BreakdownParagraphOccurrence => Boolean(node))
      .sort((a, b) => a.chapter - b.chapter || a.unit.localeCompare(b.unit));
    const chs = Array.from(new Set(nodes.map((node) => node.chapter))).sort((a, b) => a - b);
    if (chs.length < 3) continue;

    const componentEdges = shellEdges.filter((edge) => shellSet.find(edge.a) === root);
    const best = componentEdges.sort((a, b) => b.commonLength - a.commonLength)[0];
    if (!best || best.commonLength < BP11_MIN_BLOCKING_SKELETON_CHARS) continue;
    const locations = nodes.map((node) => `ch${node.chapter} ${node.unit}`);
    templatedBreakdownShellGroups += 1;
    findings.push({
      code: "BP11",
      severity: "blocker",
      chapters: chs,
      count: chs.length,
      unit: "breakdown",
      evidence: `static skeleton: "${best?.common.slice(0, 200) ?? ""}" | locations: ${locations.join(", ")}`,
      message: `A breakdown paragraph shell repeats across ${chs.length} chapters with small variable substitutions. The static skeleton is ${best?.commonLength ?? 0} characters long and the variable slots are too small to make the prose chapter-specific. Rewrite the closing paragraph in each affected chapter.`,
      maxScoreCap: 60,
    });
  }

  // BP12: short-paragraph cross-chapter duplication.
  //
  // BP10's 30-word floor and BP11's ~100-char LCS floor both miss short
  // identical paragraphs. The One Thing shipped with the 9-word sentence
  // "Keep the clue. Leave the costume where it belongs." as the closing
  // paragraph in 16 of 18 chapters. A reader cycling chapters sees the
  // identical line repeatedly even though each instance is too short to
  // trip BP10/BP11.
  //
  // BP12 fires when a breakdown paragraph of 5–29 words appears verbatim
  // (after the same lowercase + whitespace-collapse + smart-quote
  // normalization BP10 uses) in 3 or more chapters. `maxScoreCap=60`,
  // same severity tier as BP10 — the defect class is identical, only the
  // unit is shorter.
  const shortParagraphMap = new Map<string, PatternOccurrence[]>();
  for (const ch of chapters) {
    for (const [tierName, tierText] of [
      ["fastRead", ch.breakdown?.fastRead ?? ""],
      ["deepRead", ch.breakdown?.deepRead ?? ""],
      ["fullRead", ch.breakdown?.fullRead ?? ""],
    ] as const) {
      const paragraphs = tierText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      for (const para of paragraphs) {
        const wordCount = para.split(/\s+/).filter(Boolean).length;
        if (wordCount < 5 || wordCount >= 30) continue;
        const key = para
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/[“”"‘’]/g, "")
          .trim();
        pushOccurrence(shortParagraphMap, key, {
          chapter: ch.number,
          unit: `breakdown.${tierName}`,
          evidence: para.slice(0, 220),
        });
      }
    }
  }
  let shortParagraphDuplicateGroups = 0;
  for (const [_key, occurrences] of shortParagraphMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= 3) {
      shortParagraphDuplicateGroups += 1;
      const tier = occurrences[0]?.unit ?? "breakdown";
      const evidenceText = firstEvidence(occurrences) ?? "";
      const wordCount = evidenceText.split(/\s+/).filter(Boolean).length;
      findings.push({
        code: "BP12",
        severity: "blocker",
        chapters: chs,
        count: chs.length,
        unit: tier,
        evidence: evidenceText,
        message: `A short breakdown paragraph (${tier}, ${wordCount} words) repeats verbatim in ${chs.length} chapters (${chs.join(", ")}). Short identical paragraphs evade BP10 (30-word floor) and BP11 (~100-char LCS floor) but are highly visible to a reader cycling chapters. Rewrite the paragraph in each chapter so the prose is chapter-specific.`,
        maxScoreCap: 60,
      });
    }
  }

  // BP13: cross-chapter literal substring drift in example narrative fields.
  //
  // BP2 already audits example scenarios but normalizes away names and stopwords
  // before extracting 6-token n-grams. That works for skeleton drift but misses
  // verbatim stock phrases whose normalized form is too short to clear the
  // 6-gram floor. The 33 Strategies of War book shipped with "stops arguing and
  // points to" appearing in 27 of 33 chapters, "Fluorescent light catches the
  // edge of the [X]" in 10 chapters, and "We cannot keep pretending this is
  // neutral" in 8 chapters — each one a stock writer phrase that BP2 misses
  // because the post-normalization content tokens are only 3-4.
  //
  // BP13 does literal-substring matching: keep stopwords, keep names, generate
  // 5-token sliding windows over each scenario / whatToDo / whyItMatters
  // string, and fire BLOCKER for any window that appears verbatim in
  // ≥ tightSubstringThreshold(N) chapters. Deduplicate by preferring the
  // longest substring repeated in the same chapter set.
  const literalSubstringMap = new Map<string, PatternOccurrence[]>();
  const LITERAL_WINDOW = 5;
  for (const ch of chapters) {
    for (const [i, ex] of (ch.examples ?? []).entries()) {
      const seenInChapter = new Set<string>();
      for (const [field, raw] of [
        ["scenario", ex.scenario],
        ["whatToDo", ex.whatToDo],
        ["whyItMatters", ex.whyItMatters],
      ] as Array<[string, string | undefined]>) {
        if (!raw) continue;
        const tokens = raw.split(/\s+/).filter((t) => t.length > 0);
        for (let s = 0; s + LITERAL_WINDOW <= tokens.length; s++) {
          const slice = tokens.slice(s, s + LITERAL_WINDOW);
          // Skip windows that are mostly stopwords or punctuation — they
          // false-positive on phrases like "of the next few months" or
          // "in the same way as".
          const contentCount = slice.filter((t) => {
            const w = t.toLowerCase().replace(/[^a-z0-9'-]/g, "");
            if (w.length < 4) return false;
            return ![
              "the","and","that","this","with","from","have","were","will","what",
              "when","where","which","while","their","them","they","these","those",
              "then","than","into","over","under","about","after","before","because",
              "could","would","should","might","still","just","also","very","more",
              "most","some","many","much","other","another","here","there","both",
            ].includes(w);
          }).length;
          if (contentCount < 2) continue;
          const phrase = slice.join(" ");
          // Dedup: only count a phrase once per chapter (avoid inflating count
          // from many similar examples within one chapter).
          if (seenInChapter.has(phrase)) continue;
          seenInChapter.add(phrase);
          pushOccurrence(literalSubstringMap, phrase, {
            chapter: ch.number,
            unit: `example[${i}].${field}`,
            evidence: raw.slice(0, 200),
          });
        }
      }
    }
  }

  // Threshold tighter than BP2 because literal verbatim drift is more egregious
  // than skeleton drift. Floor of 3 chapters for any book size.
  const literalThreshold = Math.max(3, Math.ceil(chapters.length * 0.1));

  // Collect candidate phrases that exceed threshold.
  type LiteralCandidate = {
    phrase: string;
    chapters: number[];
    occurrences: PatternOccurrence[];
  };
  const candidates: LiteralCandidate[] = [];
  for (const [phrase, occurrences] of literalSubstringMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= literalThreshold) {
      candidates.push({ phrase, chapters: chs, occurrences });
    }
  }
  // Sort longest-first so longer maximal substrings are reported in place of
  // their sub-grams.
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);

  let literalSubstringGroups = 0;
  const reportedKeys = new Set<string>();
  for (const cand of candidates) {
    // Skip if a longer phrase with the same chapter set already covered this.
    const chapterKey = cand.chapters.join(",");
    let subsumed = false;
    for (const reported of reportedKeys) {
      const [reportedChs, reportedPhrase] = reported.split("|");
      if (reportedChs === chapterKey && reportedPhrase.includes(cand.phrase)) {
        subsumed = true;
        break;
      }
    }
    if (subsumed) continue;
    reportedKeys.add(`${chapterKey}|${cand.phrase}`);

    literalSubstringGroups += 1;
    const firstEv = firstEvidence(cand.occurrences) ?? cand.phrase;
    findings.push({
      code: "BP13",
      severity: "blocker",
      chapters: cand.chapters,
      count: cand.chapters.length,
      unit: "examples.scenario.literal",
      evidence: `"${cand.phrase}" — sample: ${firstEv.slice(0, 180)}`,
      message: `Verbatim phrase "${cand.phrase}" repeats across ${cand.chapters.length} chapters (${cand.chapters.join(", ")}). This is a stock writer template; the reader will notice the repetition by Chapter ${cand.chapters[3] ?? cand.chapters[cand.chapters.length - 1]}. Rewrite each scenario to drop the shared phrase entirely.`,
      maxScoreCap: 70,
    });
  }

  // BP5: concrete time/place reuse. Two may be a warning; three or more blocks.
  let repeatedConcreteAnchors = 0;
  for (const [anchor, occurrences] of timePlaceMap) {
    const chs = uniqueChapters(occurrences);
    if (chs.length >= 3) {
      repeatedConcreteAnchors += 1;
      findings.push({
        code: "BP5",
        severity: "blocker",
        chapters: chs,
        count: occurrences.length,
        unit: "examples.scenario.anchor",
        evidence: anchor,
        message: `Same time/place anchor appears in examples across chapters ${chs.join(", ")}: "${anchor}". This is a reusable scene shell.`,
        maxScoreCap: 75,
      });
    } else if (chs.length === 2) {
      repeatedConcreteAnchors += 1;
      findings.push({
        code: "BP5",
        severity: "major",
        chapters: chs,
        count: occurrences.length,
        unit: "examples.scenario.anchor",
        evidence: anchor,
        message: `Same time/place anchor appears in two chapters (${chs.join(", ")}). Check whether this is intentional continuity or a repeated shell.`,
        maxScoreCap: 88,
      });
    }
  }

  // BP6: source and plan-core alignment. This is deliberately rough, but it
  // catches chapters that drift from a specific source pressure into generic
  // advice. Major, not blocker, because some source sidecars are sparse.
  let sourceAlignmentWarnings = 0;
  if (checkSourceAlignment) {
    for (const ch of chapters) {
      const generatedTokens = new Set(tokenize(chapterText(ch)));
      const source = loadChapterSource(bookId, ch.number);
      if (source) {
        const keywords = distinctiveKeywords(source, 18);
        const matched = keywords.filter((k) => generatedTokens.has(k));
        const expected = Math.min(8, keywords.length);
        if (keywords.length >= 8 && matched.length < Math.max(2, Math.floor(expected * 0.35))) {
          sourceAlignmentWarnings += 1;
          findings.push({
            code: "BP6",
            severity: "major",
            chapters: [ch.number],
            unit: "source-alignment",
            evidence: `source terms: ${keywords.slice(0, 12).join(", ")} | matched: ${matched.join(", ") || "none"}`,
            message: `Chapter ${ch.number} has weak lexical alignment with its source sidecar. This often means a chapter-specific topic drifted into generic book-theme prose.`,
            maxScoreCap: 88,
          });
        }
      }
      const coreMove = readPlanCoreMove(stateDir, ch.chapterId);
      if (coreMove) {
        const coreTerms = distinctiveKeywords(coreMove, 10);
        const matched = coreTerms.filter((k) => generatedTokens.has(k));
        if (coreTerms.length >= 4 && matched.length < 2) {
          sourceAlignmentWarnings += 1;
          findings.push({
            code: "BP6",
            severity: "major",
            chapters: [ch.number],
            unit: "plan-coreMove",
            evidence: `coreMove terms: ${coreTerms.join(", ")} | matched: ${matched.join(", ") || "none"}`,
            message: `Chapter ${ch.number} appears weakly aligned with its stored coreMove. Check whether the chapter teaches the planned move, not a nearby generic theme.`,
            maxScoreCap: 88,
          });
        }
      }
    }
  }

  // BP15: "The paradox of X is that…" counterintuition opener template.
  //
  // B14 catches shape clustering (negation_correction, paradox_colon, etc.).
  // "The paradox of" is a more specific literal scaffold that B14's shape
  // classifier doesn't catch — it maps to "other" rather than "paradox_colon"
  // (which requires "The paradox:"). Built-to-last shipped with 6 of 10
  // chapters using this exact opener. Cap is 2 per book.
  {
    const paradoxOfChapters: number[] = [];
    for (const ch of chapters) {
      if (/^The paradox of\b/i.test((ch.counterintuition ?? "").trim())) {
        paradoxOfChapters.push(ch.number);
      }
    }
    if (paradoxOfChapters.length > 2) {
      findings.push({
        code: "BP15",
        severity: "major",
        chapters: paradoxOfChapters,
        count: paradoxOfChapters.length,
        unit: "counterintuition",
        evidence: "The paradox of…",
        message: `"The paradox of X is that…" opener appears in ${paradoxOfChapters.length} chapters (${paradoxOfChapters.join(", ")}). Cap is 2 per book — this scaffold is visible to a reader scanning across chapters. Rewrite the excess openers to lead with the surprising case, the failure mode, or a direct claim.`,
      });
    }
  }

  // BP16: same question-position opener shell across chapters.
  //
  // The-first-20-hours shipped with "Two learners…" as the Q9 opener in 9
  // of 9 chapters. B14 and C12 both missed it: B14 only checks counter shape,
  // and C12 only checks within a single chapter. BP16 checks whether the same
  // first-3-word opener appears in the same question position (Q1–Q9) across
  // more than cap chapters. Cap: 3 for books ≤10 chapters, 4 otherwise.
  {
    const q9Cap = chapters.length <= 10 ? 3 : 4;
    const posOpenerMap = new Map<string, number[]>();
    for (const ch of chapters) {
      const questions = ch.quiz?.questions ?? [];
      for (let qi = 0; qi < questions.length; qi++) {
        const prompt = questions[qi]?.prompt ?? "";
        const opener = prompt.split(/\s+/).slice(0, 3).join(" ").toLowerCase().replace(/[^a-z\s]/g, "").trim();
        if (opener.length < 5) continue;
        const key = `q${qi + 1}|${opener}`;
        const arr = posOpenerMap.get(key) ?? [];
        arr.push(ch.number);
        posOpenerMap.set(key, arr);
      }
    }
    for (const [key, chs] of posOpenerMap) {
      if (chs.length > q9Cap) {
        const [pos, opener] = key.split("|");
        findings.push({
          code: "BP16",
          severity: "major",
          chapters: chs,
          count: chs.length,
          unit: `quiz.${pos}`,
          evidence: opener,
          message: `${pos.toUpperCase()} prompt uses the same opening "${opener}" in ${chs.length} chapters (${chs.join(", ")}). A repeated question-position opener is a template tell — vary formats across chapters.`,
        });
      }
    }
  }

  // Deduplicate noisy findings: one finding per code/unit/evidence/chapter set.
  const deduped: BookPatternAuditFinding[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    const key = `${f.code}|${f.unit ?? ""}|${(f.chapters ?? []).join(",")}|${f.evidence ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(f);
  }

  // ── BP14: quiz correctIndex position template. ────────────────────────────
  // Fires when 2+ chapters share an identical correctIndex sequence, or when
  // ≥60% of chapters share the same first-5 correctIndex values. Both indicate
  // the writer used a fixed answer-position template rather than varying
  // positions per chapter. A reader who spots the pattern can guess without
  // reading; the effect is equivalent to printing the answer key.
  //
  // Threshold: 2 chapters with an identical full sequence → BLOCKER.
  // Threshold: ≥60% of chapters share the same Q1–Q5 prefix → BLOCKER.
  let quizPositionTemplateDuplicates = 0;
  {
    const seqMap = new Map<string, number[]>();
    const prefixMap = new Map<string, number[]>();

    for (let i = 0; i < chapters.length; i++) {
      const qs = chapters[i].quiz?.questions ?? [];
      if (qs.length === 0) continue;

      const fullSeq = qs.map((q: any) => q.correctIndex).join(",");
      if (!seqMap.has(fullSeq)) seqMap.set(fullSeq, []);
      seqMap.get(fullSeq)!.push(i + 1);

      const prefix5 = qs.slice(0, 5).map((q: any) => q.correctIndex).join(",");
      if (!prefixMap.has(prefix5)) prefixMap.set(prefix5, []);
      prefixMap.get(prefix5)!.push(i + 1);
    }

    // Full-sequence duplicates
    for (const [seq, chs] of seqMap) {
      if (chs.length >= 2) {
        quizPositionTemplateDuplicates += 1;
        deduped.push({
          code: "BP14",
          severity: "blocker",
          message: `Quiz answer-position template: ${chs.length} chapters share identical correctIndex sequence [${seq}] (chapters ${chs.join(", ")}). Positions were templated — reader can guess without reading.`,
          evidence: `seq: ${seq}`,
          chapters: chs,
        });
      }
    }

    // Q1–Q5 prefix repeated across majority of book
    const chaptersWithQuiz = chapters.filter((ch: any) => (ch.quiz?.questions?.length ?? 0) >= 5).length;
    if (chaptersWithQuiz >= 3) {
      for (const [prefix, chs] of prefixMap) {
        if (chs.length / chaptersWithQuiz >= 0.6 && chs.length >= 3) {
          // Only fire if not already caught by full-sequence dupe above
          const alreadyFired = [...seqMap.values()].some((s) => s.length >= 2 && s.every((c) => chs.includes(c)));
          if (!alreadyFired) {
            quizPositionTemplateDuplicates += 1;
            deduped.push({
              code: "BP14",
              severity: "blocker",
              message: `Quiz answer-position template: ${chs.length}/${chaptersWithQuiz} chapters share Q1–Q5 prefix [${prefix}] (chapters ${chs.join(", ")}). First five answers follow a fixed pattern.`,
              evidence: `prefix: ${prefix}`,
              chapters: chs,
            });
          }
        }
      }
    }
  }

  const blockers = deduped.filter((f) => f.severity === "blocker");
  return {
    bookId,
    chapterCount: chapters.length,
    passed: blockers.length === 0,
    findings: deduped,
    stats: {
      repeatedQuizExplanationGroups,
      repeatedSurfaceFrameGroups,
      repeatedExampleFrameGroups,
      repeatedConcreteAnchors,
      templatedBreakdownShellGroups,
      shortParagraphDuplicateGroups,
      literalSubstringGroups,
      quizPositionTemplateDuplicates,
      missingPlanChapters,
      missingBrief,
      sourceAlignmentWarnings,
    },
  };
}

export function formatBookPatternAuditReport(report: BookPatternAuditReport): string {
  const blockers = report.findings.filter((f) => f.severity === "blocker");
  const majors = report.findings.filter((f) => f.severity === "major");
  const minors = report.findings.filter((f) => f.severity === "minor");
  const lines: string[] = [];
  lines.push(`Book pattern audit: ${report.passed ? "PASS" : "BLOCK"} (${report.bookId}, ${report.chapterCount} chapter(s))`);
  lines.push(`  blockers: ${blockers.length}`);
  lines.push(`  majors: ${majors.length}`);
  lines.push(`  minors: ${minors.length}`);
  lines.push(`  repeated quiz explanation groups: ${report.stats.repeatedQuizExplanationGroups}`);
  lines.push(`  repeated hook/counter/try frame groups: ${report.stats.repeatedSurfaceFrameGroups}`);
  lines.push(`  repeated example frame groups: ${report.stats.repeatedExampleFrameGroups}`);
  lines.push(`  repeated concrete anchors: ${report.stats.repeatedConcreteAnchors}`);
  lines.push(`  templated breakdown shell groups: ${report.stats.templatedBreakdownShellGroups}`);
  lines.push(`  templated short-paragraph groups: ${report.stats.shortParagraphDuplicateGroups}`);
  if (report.stats.missingBrief) lines.push(`  missing brief artifact: yes`);
  if (report.stats.missingPlanChapters.length) {
    lines.push(`  missing plan chapters: ${report.stats.missingPlanChapters.join(", ")}`);
  }
  if (report.findings.length > 0) {
    lines.push("  Findings:");
    for (const f of report.findings.slice(0, 80)) {
      const ch = f.chapters?.length ? ` ch${f.chapters.join(",")}` : "";
      const cap = f.maxScoreCap ? ` cap<=${f.maxScoreCap}` : "";
      lines.push(`    [${f.code} ${f.severity}${cap}]${ch} ${f.message}`);
      if (f.evidence) lines.push(`      evidence: ${f.evidence.slice(0, 240)}`);
    }
    if (report.findings.length > 80) {
      lines.push(`    ... ${report.findings.length - 80} more finding(s)`);
    }
  }
  return lines.join("\n");
}

export function maxScoreCapsByChapter(report: BookPatternAuditReport): Map<number, number> {
  const caps = new Map<number, number>();
  const applyCap = (chapter: number, cap: number) => {
    const current = caps.get(chapter) ?? 100;
    caps.set(chapter, Math.min(current, cap));
  };
  for (const f of report.findings) {
    if (!f.maxScoreCap) continue;
    if (f.chapters?.length) {
      for (const chapter of f.chapters) applyCap(chapter, f.maxScoreCap);
    } else {
      // Book-wide missing brief affects every generated chapter.
      for (let chapter = 1; chapter <= report.chapterCount; chapter++) applyCap(chapter, f.maxScoreCap);
    }
  }
  return caps;
}
