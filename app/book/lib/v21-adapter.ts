/**
 * v21 Adapter — maps `chapterflow-v21-authored` packages onto the reader's
 * legacy `BookPackage` shape, and exposes v21-only chapter fields (hook,
 * reflections, memorableLines) for rendering the new surfaces.
 *
 * The reader's existing `BookPackage` / `BookChapter` shape is the unified
 * UI contract. v13 books normalize to it via `normalizeNstdPackage` in
 * `app/book/data/bookPackages.ts`. v21 books take this path: their breakdown
 * tiers fastRead / deepRead / fullRead map to legacy `easy / medium / hard`
 * variants, and v21-only fields are surfaced separately so the reader can
 * branch on `schemaVersion` to render hooks, reflections, etc.
 */
import type {
  BookPackage,
  PackageBook,
  PackageChapter,
  PackageExample,
  PackageImplementationPlan,
  PackageQuiz,
  PackageReviewCard,
  PackageVariantContent,
  PackageSummaryBlock,
} from "@/app/book/data/bookPackages";

export const V21_SCHEMA_VERSION = "chapterflow-v21-authored";

export type V21MemorableLine = {
  text: string;
  location?: string;
  why?: string;
};

export type V21ChapterExtras = {
  schemaVersion: typeof V21_SCHEMA_VERSION;
  hook?: string;
  counterintuition?: string;
  /** Mid-chapter directive (30–90s action). Replaces reflectionBefore/After. */
  tryThisNow?: string;
  /**
   * DEPRECATED: replaced by `tryThisNow`. Retained for backwards-compat parsing
   * of v21 packages that shipped with these fields populated (e.g. tiny-habits).
   * The reader UI no longer renders them.
   */
  reflectionBefore?: string;
  reflectionAfter?: string;
  keyTakeaway?: string;
  memorableLines?: V21MemorableLine[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export function isV21RawPackage(raw: unknown): boolean {
  const record = asRecord(raw);
  return record?.schemaVersion === V21_SCHEMA_VERSION;
}

function summaryBlocksFromProse(prose: string): PackageSummaryBlock[] {
  if (!prose) return [];
  return prose
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ type: "paragraph", text }) satisfies PackageSummaryBlock);
}

function buildVariantFromTier(prose: string | undefined): PackageVariantContent | undefined {
  if (!prose) return undefined;
  return {
    chapterBreakdown: prose,
    summaryBlocks: summaryBlocksFromProse(prose),
  };
}

function adaptExample(rawExample: unknown, index: number): PackageExample {
  const ex = asRecord(rawExample) ?? {};
  const tags = asStringArray(ex.tags);
  const planSpec = asRecord(ex.planSpec);
  const scenario = asStringOrUndefined(ex.scenario) ?? "";
  const whatToDoStr = asStringOrUndefined(ex.whatToDo) ?? "";
  const whyItMatters = asStringOrUndefined(ex.whyItMatters) ?? "";
  const titleFallback = `Example ${index + 1}`;
  const exampleIdRaw = asStringOrUndefined(ex.exampleId);
  return {
    exampleId: exampleIdRaw ?? `ex-${index + 1}`,
    title: asStringOrUndefined(ex.title) ?? titleFallback,
    scenario,
    // legacy `whatToDo` is string[]; v21 carries a single string
    whatToDo: whatToDoStr ? [whatToDoStr] : [],
    whyItMatters,
    contexts: tags.length > 0
      ? tags
      : (asStringOrUndefined(planSpec?.domain) ? [planSpec!.domain as string] : []),
  };
}

function adaptQuiz(rawQuiz: unknown): PackageQuiz {
  const q = asRecord(rawQuiz) ?? {};
  const passing = typeof q.passingScorePercent === "number" ? q.passingScorePercent : 80;
  const questionsRaw = Array.isArray(q.questions) ? q.questions : [];
  const questions = questionsRaw.map((rq, idx) => {
    const r = asRecord(rq) ?? {};
    const choices = asStringArray(r.choices);
    return {
      questionId: asStringOrUndefined(r.questionId) ?? `q-${idx + 1}`,
      prompt: asStringOrUndefined(r.prompt) ?? "",
      choices,
      correctIndex: typeof r.correctIndex === "number" ? r.correctIndex : 0,
      explanation: asStringOrUndefined(r.explanation) ?? "",
    };
  });
  return {
    passingScorePercent: passing,
    questions,
  };
}

function adaptReviewCards(rawCards: unknown): PackageReviewCard[] {
  if (!Array.isArray(rawCards)) return [];
  return rawCards.map((rc, idx) => {
    const r = asRecord(rc) ?? {};
    const difficultyRaw = asStringOrUndefined(r.difficulty);
    const difficulty: "easy" | "medium" | "hard" =
      difficultyRaw === "medium" || difficultyRaw === "hard" ? difficultyRaw : "easy";
    return {
      cardId: asStringOrUndefined(r.cardId) ?? `rc-${idx + 1}`,
      front: asStringOrUndefined(r.front) ?? "",
      back: asStringOrUndefined(r.back) ?? "",
      difficulty,
    };
  });
}

function adaptImplementationPlan(raw: unknown): PackageImplementationPlan | undefined {
  const r = asRecord(raw);
  if (!r) return undefined;
  const ifThenRaw = Array.isArray(r.ifThenPlans) ? r.ifThenPlans : [];
  return {
    coreSkill: asStringOrUndefined(r.coreSkill) ?? "",
    ifThenPlans: ifThenRaw.map((it, idx) => {
      const item = asRecord(it) ?? {};
      return {
        context: asStringOrUndefined(item.context) ?? `Plan ${idx + 1}`,
        plan: asStringOrUndefined(item.plan) ?? "",
      };
    }),
    twentyFourHourChallenge: asStringOrUndefined(r.twentyFourHourChallenge) ?? "",
    weeklyPractice: asStringOrUndefined(r.weeklyPractice) ?? "",
  };
}

/** Adapt a single v21 raw chapter to the legacy `PackageChapter` shape. */
export function adaptV21Chapter(rawChapter: unknown): PackageChapter {
  const ch = asRecord(rawChapter) ?? {};
  const breakdown = asRecord(ch.breakdown) ?? {};
  const fastRead = asStringOrUndefined(breakdown.fastRead);
  const deepRead = asStringOrUndefined(breakdown.deepRead);
  const fullRead = asStringOrUndefined(breakdown.fullRead);

  const contentVariants: PackageChapter["contentVariants"] = {};
  const easy = buildVariantFromTier(fastRead);
  const medium = buildVariantFromTier(deepRead);
  const hard = buildVariantFromTier(fullRead);
  if (easy) contentVariants.easy = easy;
  if (medium) contentVariants.medium = medium;
  if (hard) contentVariants.hard = hard;

  const examplesRaw = Array.isArray(ch.examples) ? ch.examples : [];
  const reviewCards = adaptReviewCards(ch.reviewCards);
  const implementationPlan = adaptImplementationPlan(ch.implementationPlan);
  const keyTakeaway = asStringOrUndefined(ch.keyTakeaway);

  return {
    chapterId: asStringOrUndefined(ch.chapterId) ?? `ch-${ch.number ?? 0}`,
    number: typeof ch.number === "number" ? ch.number : 0,
    title: asStringOrUndefined(ch.title) ?? "",
    readingTimeMinutes:
      typeof ch.readingTimeMinutes === "number" ? ch.readingTimeMinutes : 8,
    contentVariants,
    examples: examplesRaw.map((ex, idx) => adaptExample(ex, idx)),
    quiz: adaptQuiz(ch.quiz),
    implementationPlan,
    reviewCards: reviewCards.length > 0 ? reviewCards : undefined,
    keyTakeawayCard: keyTakeaway,
  };
}

/** Extract v21-only chapter fields for rendering hooks, reflections, memorable lines. */
export function extractV21ChapterExtras(rawChapter: unknown): V21ChapterExtras {
  const ch = asRecord(rawChapter) ?? {};
  const memorableLinesRaw = Array.isArray(ch.memorableLines) ? ch.memorableLines : [];
  const memorableLines: V21MemorableLine[] = [];
  for (const ml of memorableLinesRaw) {
    const r = asRecord(ml) ?? {};
    const text = asStringOrUndefined(r.text);
    if (!text) continue;
    const line: V21MemorableLine = { text };
    const location = asStringOrUndefined(r.location);
    const why = asStringOrUndefined(r.why);
    if (location) line.location = location;
    if (why) line.why = why;
    memorableLines.push(line);
  }

  return {
    schemaVersion: V21_SCHEMA_VERSION,
    hook: asStringOrUndefined(ch.hook),
    counterintuition: asStringOrUndefined(ch.counterintuition),
    tryThisNow: asStringOrUndefined(ch.tryThisNow),
    reflectionBefore: asStringOrUndefined(ch.reflectionBefore),
    reflectionAfter: asStringOrUndefined(ch.reflectionAfter),
    keyTakeaway: asStringOrUndefined(ch.keyTakeaway),
    memorableLines: memorableLines.length > 0 ? memorableLines : undefined,
  };
}

/** Adapt a v21 raw package to the legacy `BookPackage` reader shape. */
export function normalizeV21Package(raw: unknown): BookPackage {
  const record = asRecord(raw) ?? {};
  if (record.schemaVersion !== V21_SCHEMA_VERSION) {
    throw new Error(
      `normalizeV21Package: expected schemaVersion="${V21_SCHEMA_VERSION}", got ${record.schemaVersion}`,
    );
  }
  const bookRaw = asRecord(record.book) ?? {};
  const chaptersRaw = Array.isArray(record.chapters) ? record.chapters : [];

  const book: PackageBook = {
    bookId: asStringOrUndefined(bookRaw.bookId) ?? "",
    title: asStringOrUndefined(bookRaw.title) ?? "",
    author: asStringOrUndefined(bookRaw.author) ?? "",
    categories: asStringArray(bookRaw.categories),
    tags: asStringArray(bookRaw.tags),
    edition:
      typeof bookRaw.edition === "string"
        ? bookRaw.edition
        : (bookRaw.edition as PackageBook["edition"]) ?? undefined,
    variantFamily: "EMH",
  };

  const chapters = chaptersRaw.map((rc) => adaptV21Chapter(rc));

  return {
    schemaVersion: V21_SCHEMA_VERSION,
    packageId: asStringOrUndefined(record.packageId) ?? "",
    createdAt: asStringOrUndefined(record.createdAt) ?? "",
    contentOwner: asStringOrUndefined(record.contentOwner) ?? "",
    book,
    chapters,
  };
}

/**
 * Detect if a `BookPackage` (already normalized) originated from a v21 raw file.
 * Used by the chapter-bundle builder to decide whether to attach v21-only fields.
 */
export function isV21NormalizedPackage(pkg: Pick<BookPackage, "schemaVersion"> | undefined): boolean {
  return pkg?.schemaVersion === V21_SCHEMA_VERSION;
}
