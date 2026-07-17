/**
 * WP-E11 — blind 1-chapter package builder for the canonical Codex ChapterFlow
 * Book Evaluator (owner policy §3.2 / §5.5 of
 * docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md).
 *
 * Builds a genuine v21-shaped package (same top-level/chapter shape the skill's
 * `inspect_package.py` and `validate_book_result.py` already accept for a real
 * book — see the reference `book-packages/*.v21.json` corpus) that carries
 * EXACTLY ONE chapter, so the evaluator's full-content path (never the disabled
 * chapter-sample contract) can score it. The package is blind by construction:
 *
 *   - `book.bookId` is minted as `chapterdiag--<runHash>-<blockCode>-<slot>` —
 *     the anti-masquerade prefix (V25-NEW-05) that lets every downstream tool
 *     (portfolio scripts, the boundary guard in a later WP) recognize "this is
 *     a chapter diagnostic, not a real book" on sight.
 *   - The candidate chapter is rebuilt field-by-field from an explicit
 *     allowlist (mirroring `auditPackageAssembler.ts`'s `toAuditChapter`) —
 *     never a spread of the input object — so no unknown/stray key (a future
 *     schema addition, a debug field, an authoring-internal leak that
 *     `stripInternalFields` doesn't yet know about) can ride along silently.
 *   - Every example/question/card id is re-minted under the blind chapter id;
 *     the real chapterId/bookId strings never appear anywhere in the output.
 *   - `createdAt` is a fixed epoch constant, never wall-clock — the builder is
 *     pure and deterministic: same inputs, byte-identical output, every time.
 *   - A forbidden-token scan runs over the assembled package before it is
 *     returned; ANY hit throws (fail-closed) — the package is never handed
 *     back half-poisoned for a caller to "clean up".
 *
 * Model identity is the only secret (owner policy §5.5: "book identity is
 * not"); block/book title, categories, and tags are the reader-facing
 * whitelist a rater needs to infer audience/purpose (rubric Gate 4) and are
 * NOT scrubbed. What must never appear anywhere in the package: model ids,
 * effort strings, run/slot/session identifiers, internal pipeline paths, or
 * repair history. This module never reads state/repair records or run
 * manifests directly — the only input is an in-memory chapter object plus
 * caller-supplied book metadata — so those classes of leak are excluded by
 * construction; the token scan below is defense-in-depth on top of that.
 */

import { createHash } from "node:crypto";

import { stripInternalFields } from "../lib/readerContent.js";
import type { ChapterV21 } from "../types.js";

export const CHAPTER_DIAGNOSTIC_PACKAGE_SCHEMA_VERSION = "chapterflow-v21-authored" as const;
export const CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX = "chapterdiag--" as const;
/** Deliberately not wall-clock (see module doc) — a fixed, non-identifying
 *  placeholder so the same inputs always serialize to the same bytes. */
export const CHAPTER_DIAGNOSTIC_EPOCH = "1970-01-01T00:00:00.000Z" as const;

export class ChapterDiagnosticPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChapterDiagnosticPackageError";
  }
}

// ── Package shape ────────────────────────────────────────────────────────────

export type ChapterDiagnosticChapterV1 = {
  chapterId: string;
  number: 1;
  title: string;
  readingTimeMinutes: number;
  hook: string;
  counterintuition?: string;
  tryThisNow?: string;
  keyTakeaway: string;
  breakdown: { fastRead: string; deepRead: string; fullRead: string };
  examples: Array<{
    exampleId: string;
    title: string;
    tags: string[];
    scenario: string;
    whatToDo: string;
    whyItMatters: string;
  }>;
  quiz: {
    passingScorePercent: number;
    questions: Array<{
      questionId: string;
      prompt: string;
      choices: string[];
      correctIndex: number;
      explanation: string;
      bloomsLevel: string;
      choiceRationales?: string[];
      revisit?: { component: string; ref: string };
      confidencePrompt?: string;
    }>;
  };
  reviewCards: Array<{ cardId: string; front: string; back: string; difficulty: string }>;
  implementationPlan: {
    coreSkill: string;
    ifThenPlans: Array<{ context: string; plan: string }>;
    twentyFourHourChallenge: string;
    weeklyPractice: string;
  };
  memorableLines: Array<{ text: string }>;
};

export type ChapterDiagnosticPackageV1 = {
  schemaVersion: typeof CHAPTER_DIAGNOSTIC_PACKAGE_SCHEMA_VERSION;
  packageId: string;
  createdAt: string;
  contentOwner: "chapterflow";
  book: { bookId: string; title: string; categories: string[]; tags: string[] };
  chapters: [ChapterDiagnosticChapterV1];
};

/** Reader-facing WHITELIST only (owner policy §5.5): title/categories/tags are
 *  what let a rater infer nonfiction type, audience, and purpose (Gate 4) from
 *  local content. Deliberately excludes author, and everything authoring- or
 *  run-internal (model, effort, run/slot ids, timestamps, repair history) —
 *  none of those are accepted inputs here at all. */
export type ChapterDiagnosticBookMetadataInput = {
  title: string;
  categories?: string[];
  tags?: string[];
};

export type ChapterDiagnosticPackageInput = {
  /** Opaque per-campaign hash — never derived from a model name or effort. */
  runHash: string;
  /** The frozen corpus block (e.g. "nudge-ch03") — book/block identity is NOT
   *  the secret (owner policy §5.5); only model identity is. */
  blockCode: string;
  /** The blind slot/label token — never a model name. */
  slot: string;
  /** The candidate's (or anchor's) authored chapter, in memory. */
  chapter: ChapterV21;
  book: ChapterDiagnosticBookMetadataInput;
};

export type BuiltChapterDiagnosticPackage = {
  blindBookId: string;
  package: ChapterDiagnosticPackageV1;
  /** The exact bytes a caller should write to disk — computing `sha256` from
   *  anything else would desync the two. */
  bytes: string;
  /** Lowercase hex sha256 of `bytes` (no `sha256:` prefix — this is the same
   *  bare-hex convention the evaluator skill's `source_hash` uses). */
  sha256: string;
};

// ── Forbidden-token scan ─────────────────────────────────────────────────────

export type ForbiddenTokenCategory = "model-identity" | "effort" | "session-or-run-id" | "internal-path";

export type ChapterDiagnosticForbiddenTokenHit = {
  path: string;
  field: string;
  category: ForbiddenTokenCategory;
  token: string;
  excerpt: string;
};

/** The candidate model tokens under comparison in this experiment. Whole-word
 *  matched, case-insensitive. */
const MODEL_IDENTITY_TOKENS = ["gpt-5.6", "sol", "terra", "luna"] as const;
/** The `ReasoningEffort` union (bakeoff/types.ts) — never accepted as builder
 *  input, so a hit here means something upstream leaked past the allowlist. */
const EFFORT_TOKENS = ["minimal", "low", "medium", "high", "xhigh"] as const;

/**
 * Free-text field names — reader-facing prose AND short reader-facing labels
 * (titles/categories/tags/enums), all real book content a caller supplies or
 * copies verbatim. Scanned ONLY for the literal model-identity tokens, never
 * the effort/session/path categories: those would false-positive constantly
 * on ordinary English (a book titled "High Output Management" would trip
 * `\bhigh\b` on `book.title`; a `difficulty: "medium"` review card would trip
 * `\bmedium\b`). No author prompt in this pipeline is ever told a model name
 * (candidates.ts), so a model-identity hit here would still indicate upstream
 * corruption, not a normal write — that category stays live everywhere.
 * Everything NOT in this set is a structural field this module mints itself
 * (ids, the fixed schema constants) and gets the full multi-category scan.
 */
const FREE_TEXT_FIELD_NAMES = new Set([
  "hook", "counterintuition", "tryThisNow", "keyTakeaway",
  "fastRead", "deepRead", "fullRead",
  "scenario", "whatToDo", "whyItMatters",
  "prompt", "choices", "explanation", "choiceRationales", "ref", "confidencePrompt",
  "front", "back",
  "coreSkill", "twentyFourHourChallenge", "weeklyPractice", "context", "plan",
  "text",
  "title", "categories", "tags", "component", "difficulty", "bloomsLevel",
]);

type ForbiddenTokenRule = { category: ForbiddenTokenCategory; pattern: RegExp; token: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordPattern(token: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i");
}

const FORBIDDEN_TOKEN_RULES: ForbiddenTokenRule[] = [
  ...MODEL_IDENTITY_TOKENS.map((token) => ({ category: "model-identity" as const, pattern: wholeWordPattern(token), token })),
  ...EFFORT_TOKENS.map((token) => ({ category: "effort" as const, pattern: wholeWordPattern(token), token })),
  { category: "session-or-run-id", pattern: /\b(?:sess|session|job|task|run)[-_][a-z0-9]{4,}\b/i, token: "session/job/task/run id" },
  { category: "session-or-run-id", pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, token: "uuid" },
  // Deliberately NOT `\bw[1-9]\b` / `\bslot\d+\b` alone — that would collide
  // with this codebase's own candidate-slot convention ("w1"/"w2"/"w3", see
  // candidates.ts `work/<slot>/chapters`), which `slot` is explicitly allowed
  // to be (blindId embeds it verbatim). A slash or the literal chapter-file
  // suffix is the unambiguous signal of a real leaked path.
  { category: "internal-path", pattern: /\b(?:work|candidates|attempts|state|bakeoff)[\\/]|\.chapter\.json\b/i, token: "internal pipeline path fragment" },
];

function excerptAround(value: string, pattern: RegExp): string {
  const match = pattern.exec(value);
  if (!match) return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  const start = Math.max(0, match.index - 12);
  const end = Math.min(value.length, match.index + match[0].length + 12);
  return `${start > 0 ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
}

function walkStrings(
  value: unknown,
  path: string,
  field: string,
  visit: (value: string, path: string, field: string) => void,
): void {
  if (typeof value === "string") {
    visit(value, path, field);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, `${path}[${index}]`, field, visit));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(item, `${path}.${key}`, key, visit);
    }
  }
}

/** Scan an assembled package for forbidden tokens. Exported so tests (and any
 *  caller wanting a non-throwing check) can call it directly; `buildChapterDiagnosticPackage`
 *  calls this internally and throws fail-closed on any hit. */
export function scanChapterDiagnosticForbiddenTokens(
  pkg: ChapterDiagnosticPackageV1,
): ChapterDiagnosticForbiddenTokenHit[] {
  const hits: ChapterDiagnosticForbiddenTokenHit[] = [];
  walkStrings(pkg, "$", "$", (value, path, field) => {
    const isFreeText = FREE_TEXT_FIELD_NAMES.has(field);
    for (const rule of FORBIDDEN_TOKEN_RULES) {
      if (isFreeText && rule.category !== "model-identity") continue;
      if (rule.pattern.test(value)) {
        hits.push({ path, field, category: rule.category, token: rule.token, excerpt: excerptAround(value, rule.pattern) });
      }
    }
  });
  return hits;
}

// ── Blind id ──────────────────────────────────────────────────────────────────

const BLIND_COMPONENT_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

function assertSafeBlindComponent(value: string, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ChapterDiagnosticPackageError(`${label} must be a non-empty string`);
  }
  if (value.length > 80) {
    throw new ChapterDiagnosticPackageError(`${label} is too long (${value.length} chars, max 80)`);
  }
  if (!BLIND_COMPONENT_RE.test(value)) {
    throw new ChapterDiagnosticPackageError(
      `${label} must be a kebab-safe token (letters, digits, single hyphens): got ${JSON.stringify(value)}`);
  }
  for (const rule of FORBIDDEN_TOKEN_RULES) {
    // "internal-path" exists to catch a path/slot fragment LEAKING into
    // unrelated content (e.g. "w1" surfacing inside a book title). A blind
    // component is legitimately allowed to BE such a token — "w1"/"w2"/"w3"
    // is this codebase's own candidate-slot convention (candidates.ts
    // `work/<slot>/chapters`) — so this category is not a component-safety
    // check; only model-identity/effort/session-id are.
    if (rule.category === "internal-path") continue;
    if (rule.pattern.test(value)) {
      throw new ChapterDiagnosticPackageError(
        `${label} contains a forbidden ${rule.category} token (${JSON.stringify(rule.token)}): got ${JSON.stringify(value)}`);
    }
  }
  return value;
}

/** The blind `book.bookId` (owner policy §3.2/§5.5): `chapterdiag--<runHash>-<blockCode>-<slot>`.
 *  Exported standalone so a caller can compute/compare the id without building
 *  a full package (e.g. to locate an already-built one). */
export function buildChapterDiagnosticBookId(runHash: string, blockCode: string, slot: string): string {
  const safeRunHash = assertSafeBlindComponent(runHash, "runHash");
  const safeBlockCode = assertSafeBlindComponent(blockCode, "blockCode");
  const safeSlot = assertSafeBlindComponent(slot, "slot");
  return `${CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX}${safeRunHash}-${safeBlockCode}-${safeSlot}`;
}

// ── Chapter allowlist assembly ───────────────────────────────────────────────

function requireNonEmptyString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ChapterDiagnosticPackageError(`${where} must be a non-empty string`);
  }
  return value;
}

function requireNonEmptyArray<T>(value: unknown, where: string): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ChapterDiagnosticPackageError(`${where} must be a non-empty array`);
  }
  return value as T[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildDiagnosticChapter(rawChapter: ChapterV21, blindBookId: string): ChapterDiagnosticChapterV1 {
  // Belt-and-suspenders: run the same reader-facing strip publish uses (drops
  // `authoring`, `planSpec`, *SourceAnchorIds, per-chapter schemaVersion,
  // implementationPlan.title, memorableLines[].location/why, machinery tags)
  // before the explicit allowlist below reads any field.
  const chapter = stripInternalFields(rawChapter);
  const blindChapterId = `${blindBookId}-ch01`;

  const where = (suffix: string) => `chapter.${suffix}`;

  const readingTimeMinutes = chapter.readingTimeMinutes;
  if (typeof readingTimeMinutes !== "number" || !Number.isFinite(readingTimeMinutes) || readingTimeMinutes <= 0) {
    throw new ChapterDiagnosticPackageError(`${where("readingTimeMinutes")} must be a positive finite number`);
  }

  const breakdown = chapter.breakdown ?? ({} as ChapterV21["breakdown"]);
  const examples = requireNonEmptyArray<ChapterV21["examples"][number]>(chapter.examples, where("examples"));
  const questions = requireNonEmptyArray<ChapterV21["quiz"]["questions"][number]>(
    chapter.quiz?.questions, where("quiz.questions"));
  const reviewCards = requireNonEmptyArray<ChapterV21["reviewCards"][number]>(chapter.reviewCards, where("reviewCards"));
  const plan = chapter.implementationPlan ?? ({} as ChapterV21["implementationPlan"]);
  const ifThenPlans = requireNonEmptyArray<{ context: string; plan: string }>(
    plan.ifThenPlans, where("implementationPlan.ifThenPlans"));
  const memorableLines = Array.isArray(chapter.memorableLines) ? chapter.memorableLines : [];

  const passingScorePercent = chapter.quiz?.passingScorePercent;
  if (typeof passingScorePercent !== "number" || !Number.isFinite(passingScorePercent) || passingScorePercent <= 0 || passingScorePercent > 100) {
    throw new ChapterDiagnosticPackageError(`${where("quiz.passingScorePercent")} must be a number in (0, 100]`);
  }

  return {
    chapterId: blindChapterId,
    number: 1,
    title: requireNonEmptyString(chapter.title, where("title")),
    readingTimeMinutes,
    hook: requireNonEmptyString(chapter.hook, where("hook")),
    ...(typeof chapter.counterintuition === "string" && chapter.counterintuition.trim().length > 0
      ? { counterintuition: chapter.counterintuition } : {}),
    ...(typeof chapter.tryThisNow === "string" && chapter.tryThisNow.trim().length > 0
      ? { tryThisNow: chapter.tryThisNow } : {}),
    keyTakeaway: requireNonEmptyString(chapter.keyTakeaway, where("keyTakeaway")),
    breakdown: {
      fastRead: requireNonEmptyString(breakdown.fastRead, where("breakdown.fastRead")),
      deepRead: requireNonEmptyString(breakdown.deepRead, where("breakdown.deepRead")),
      fullRead: requireNonEmptyString(breakdown.fullRead, where("breakdown.fullRead")),
    },
    examples: examples.map((example, index) => ({
      exampleId: `${blindChapterId}-ex${pad2(index + 1)}`,
      title: requireNonEmptyString(example.title, where(`examples[${index}].title`)),
      tags: Array.isArray(example.tags) ? example.tags.filter((tag): tag is string => typeof tag === "string") : [],
      scenario: requireNonEmptyString(example.scenario, where(`examples[${index}].scenario`)),
      whatToDo: requireNonEmptyString(example.whatToDo, where(`examples[${index}].whatToDo`)),
      whyItMatters: requireNonEmptyString(example.whyItMatters, where(`examples[${index}].whyItMatters`)),
    })),
    quiz: {
      passingScorePercent,
      questions: questions.map((question, index) => {
        const choices = Array.isArray(question.choices)
          ? question.choices.filter((choice): choice is string => typeof choice === "string")
          : [];
        if (choices.length < 2) {
          throw new ChapterDiagnosticPackageError(`${where(`quiz.questions[${index}].choices`)} needs at least 2 choices`);
        }
        if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= choices.length) {
          throw new ChapterDiagnosticPackageError(`${where(`quiz.questions[${index}].correctIndex`)} is out of range`);
        }
        return {
          questionId: `${blindChapterId}-q${pad2(index + 1)}`,
          prompt: requireNonEmptyString(question.prompt, where(`quiz.questions[${index}].prompt`)),
          choices,
          correctIndex: question.correctIndex,
          explanation: requireNonEmptyString(question.explanation, where(`quiz.questions[${index}].explanation`)),
          bloomsLevel: requireNonEmptyString(question.bloomsLevel, where(`quiz.questions[${index}].bloomsLevel`)),
          ...(Array.isArray(question.choiceRationales) && question.choiceRationales.length > 0
            ? { choiceRationales: question.choiceRationales } : {}),
          ...(question.revisit && typeof question.revisit === "object"
            ? {
              revisit: {
                component: requireNonEmptyString(question.revisit.component, where(`quiz.questions[${index}].revisit.component`)),
                ref: requireNonEmptyString(question.revisit.ref, where(`quiz.questions[${index}].revisit.ref`)),
              },
            } : {}),
          ...(typeof question.confidencePrompt === "string" && question.confidencePrompt.trim().length > 0
            ? { confidencePrompt: question.confidencePrompt } : {}),
        };
      }),
    },
    reviewCards: reviewCards.map((card, index) => ({
      cardId: `${blindChapterId}-card${pad2(index + 1)}`,
      front: requireNonEmptyString(card.front, where(`reviewCards[${index}].front`)),
      back: requireNonEmptyString(card.back, where(`reviewCards[${index}].back`)),
      difficulty: requireNonEmptyString(card.difficulty, where(`reviewCards[${index}].difficulty`)),
    })),
    implementationPlan: {
      coreSkill: requireNonEmptyString(plan.coreSkill, where("implementationPlan.coreSkill")),
      ifThenPlans: ifThenPlans.map((entry, index) => ({
        context: requireNonEmptyString(entry.context, where(`implementationPlan.ifThenPlans[${index}].context`)),
        plan: requireNonEmptyString(entry.plan, where(`implementationPlan.ifThenPlans[${index}].plan`)),
      })),
      twentyFourHourChallenge: requireNonEmptyString(plan.twentyFourHourChallenge, where("implementationPlan.twentyFourHourChallenge")),
      weeklyPractice: requireNonEmptyString(plan.weeklyPractice, where("implementationPlan.weeklyPractice")),
    },
    memorableLines: memorableLines
      .filter((line) => !!line && typeof (line as { text?: unknown }).text === "string" && (line as { text: string }).text.trim().length > 0)
      .map((line) => ({ text: (line as { text: string }).text })),
  };
}

function buildDiagnosticBookMetadata(
  input: ChapterDiagnosticBookMetadataInput,
  blindBookId: string,
): ChapterDiagnosticPackageV1["book"] {
  const title = requireNonEmptyString(input.title, "book.title");
  const categories = (input.categories ?? []).map((value, index) =>
    requireNonEmptyString(value, `book.categories[${index}]`));
  const tags = (input.tags ?? []).map((value, index) => requireNonEmptyString(value, `book.tags[${index}]`));
  return { bookId: blindBookId, title, categories, tags };
}

// ── Serialization ─────────────────────────────────────────────────────────────

/** The exact byte format this module hashes and expects a caller (WP-E12) to
 *  write verbatim — 2-space indent + trailing newline, matching the skill's
 *  own `common.py` `atomic_write_json` convention. */
export function serializeChapterDiagnosticPackage(pkg: ChapterDiagnosticPackageV1): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

// ── Public builder ────────────────────────────────────────────────────────────

export function buildChapterDiagnosticPackage(input: ChapterDiagnosticPackageInput): BuiltChapterDiagnosticPackage {
  const blindBookId = buildChapterDiagnosticBookId(input.runHash, input.blockCode, input.slot);
  const chapter = buildDiagnosticChapter(input.chapter, blindBookId);

  const pkg: ChapterDiagnosticPackageV1 = {
    schemaVersion: CHAPTER_DIAGNOSTIC_PACKAGE_SCHEMA_VERSION,
    packageId: blindBookId,
    createdAt: CHAPTER_DIAGNOSTIC_EPOCH,
    contentOwner: "chapterflow",
    book: buildDiagnosticBookMetadata(input.book, blindBookId),
    chapters: [chapter],
  };

  const hits = scanChapterDiagnosticForbiddenTokens(pkg);
  if (hits.length > 0) {
    const detail = hits.map((hit) => `${hit.path} (${hit.category}: ${JSON.stringify(hit.token)} in "${hit.excerpt}")`).join("; ");
    throw new ChapterDiagnosticPackageError(
      `refusing to build a blind chapter-diagnostic package: ${hits.length} forbidden-token hit(s) — ${detail}`);
  }

  const bytes = serializeChapterDiagnosticPackage(pkg);
  const sha256 = createHash("sha256").update(bytes, "utf8").digest("hex");

  return { blindBookId, package: pkg, bytes, sha256 };
}
