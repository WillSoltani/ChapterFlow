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
 *
 * ── Deliberate divergence from the SERVER adapter (WS3-008) ────────────────
 * A sibling adapter lives at `app/app/api/book/_lib/v21-adapter.ts`. The two
 * are NOT force-mergeable — they target different lifecycle STAGES and callers,
 * so a shared implementation would change behavior for at least one of them.
 * Only the TYPE families they emit are single-sourced (lib/book-package-types.ts).
 * Concrete differences:
 *   - Output stage: this client adapter emits the RESOLVED (tone-flattened,
 *     `string`) reader shape; the server adapter emits the RAW (tone-keyed,
 *     `{gentle,direct,competitive}`) shape via `toToneKeyed`.
 *   - Caller: this feeds the reader bundle and exposes v21-only extras
 *     SEPARATELY (`extractV21ChapterExtras`); the server adapter feeds
 *     ingestion/validation/catalog and attaches `v21Extras` ONTO the chapter.
 *   - Default quiz `passingScorePercent`: 80 here vs 70 server-side.
 *   - Server-only work not done here: `format`/`bloomsLevel`/`depthLevel`
 *     passthrough, bookId kebab-normalization, and content-hashed packageId
 *     derivation (which pulls in `node:crypto`, a server-only dependency — the
 *     reason the shared home can only hold the TYPES, not the transform).
 * Keep the two in sync in spirit; do not collapse them.
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

/** v21 behavior-change layer (Layer A). Both sub-objects are optional and
 *  independent; the extractor only surfaces a sub-object when it is COMPLETE,
 *  so the reader never has to defend against half-populated shapes. */
export type V21ReaderPattern = {
  id: string;
  label: string;
  mapsToPlanIndex?: number;
  mapsToExampleIndex?: number;
};

export type V21ExperiencePlan = {
  failureRecovery?: {
    normalizingLine: string;
    cueQuestion: string;
    options: string[];
    repairLine: string;
  };
  transferPrompt?: {
    prompt: string;
    contexts: string[];
  };
  /** Optional "which pattern fits you?" personalization layer (RDRP*). */
  behaviorLoop?: {
    readerPatterns?: V21ReaderPattern[];
  };
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
  experiencePlan?: V21ExperiencePlan;
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

function buildVariantFromTier(
  prose: string | undefined,
  takeaways?: string[],
): PackageVariantContent | undefined {
  if (!prose) return undefined;
  // Append memorable lines as bullet-typed summary blocks. The reader's
  // SummaryCard renders bullet blocks as the "Key Takeaways" numbered list
  // (separate section, not inline with prose). Without this, paragraphs-only
  // summaryBlocks meant the visible takeaways list was empty for v21 books
  // even though the takeaways[] field was populated.
  const summaryBlocks: PackageSummaryBlock[] = [...summaryBlocksFromProse(prose)];
  if (takeaways && takeaways.length > 0) {
    for (const text of takeaways) {
      summaryBlocks.push({ type: "bullet", text });
    }
  }
  const variant: PackageVariantContent = {
    chapterBreakdown: prose,
    summaryBlocks,
  };
  if (takeaways && takeaways.length > 0) variant.takeaways = takeaways;
  return variant;
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
      // Leave correctIndex undefined when the authored key is missing — do NOT
      // fabricate 0 (parallel to the server adapter). A fabricated 0 grades every
      // reader against choice A. Downstream consumers treat a missing key as a
      // content defect rather than a real answer.
      correctIndex: typeof r.correctIndex === "number" ? r.correctIndex : undefined,
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

  // v21 has no per-tier takeaways[] array; instead it has 3 curated
  // memorableLines per chapter. Wire those into every depth so the reader's
  // "Save takeaway to notes" surface has content. (The single keyTakeaway
  // is rendered separately as the keyTakeawayCard.)
  const memorableLineTexts = (Array.isArray(ch.memorableLines) ? ch.memorableLines : [])
    .map((ml) => asStringOrUndefined(asRecord(ml)?.text))
    .filter((s): s is string => !!s && s.length > 0);

  const contentVariants: PackageChapter["contentVariants"] = {};
  const easy = buildVariantFromTier(fastRead, memorableLineTexts);
  const medium = buildVariantFromTier(deepRead, memorableLineTexts);
  const hard = buildVariantFromTier(fullRead, memorableLineTexts);
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

/** Pull the behavior-change layer off a raw chapter. A sub-object is surfaced
 *  ONLY when complete (all required strings non-empty, arrays non-empty), so a
 *  partial/garbage shape collapses to `undefined` rather than rendering broken. */
function extractExperiencePlan(raw: unknown): V21ExperiencePlan | undefined {
  const ep = asRecord(raw);
  if (!ep) return undefined;
  const result: V21ExperiencePlan = {};

  const fr = asRecord(ep.failureRecovery);
  if (fr) {
    const normalizingLine = asStringOrUndefined(fr.normalizingLine);
    const cueQuestion = asStringOrUndefined(fr.cueQuestion);
    const repairLine = asStringOrUndefined(fr.repairLine);
    const options = asStringArray(fr.options);
    if (normalizingLine && cueQuestion && repairLine && options.length > 0) {
      result.failureRecovery = { normalizingLine, cueQuestion, options, repairLine };
    }
  }

  const tp = asRecord(ep.transferPrompt);
  if (tp) {
    const prompt = asStringOrUndefined(tp.prompt);
    const contexts = asStringArray(tp.contexts);
    if (prompt && contexts.length > 0) {
      result.transferPrompt = { prompt, contexts };
    }
  }

  const bl = asRecord(ep.behaviorLoop);
  if (bl) {
    const rawPatterns = Array.isArray(bl.readerPatterns) ? bl.readerPatterns : [];
    const patterns: V21ReaderPattern[] = [];
    for (const rp of rawPatterns) {
      const rec = asRecord(rp);
      if (!rec) continue;
      const id = asStringOrUndefined(rec.id);
      const label = asStringOrUndefined(rec.label);
      if (!id || !label) continue; // surface only complete patterns
      const pattern: V21ReaderPattern = { id, label };
      if (typeof rec.mapsToPlanIndex === "number" && Number.isInteger(rec.mapsToPlanIndex)) {
        pattern.mapsToPlanIndex = rec.mapsToPlanIndex;
      }
      if (typeof rec.mapsToExampleIndex === "number" && Number.isInteger(rec.mapsToExampleIndex)) {
        pattern.mapsToExampleIndex = rec.mapsToExampleIndex;
      }
      patterns.push(pattern);
    }
    if (patterns.length > 0) {
      result.behaviorLoop = { readerPatterns: patterns };
    }
  }

  return result.failureRecovery || result.transferPrompt || result.behaviorLoop
    ? result
    : undefined;
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
    experiencePlan: extractExperiencePlan(ch.experiencePlan),
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
