// Canonical, JSON-free, server-safe BookPackage domain model.
//
// SINGLE SOURCE OF TRUTH for the v21/v13 package shape. Two independent copies
// used to describe the same package JSON and had drifted:
//   - server: app/app/api/book/_lib/types.ts (tone-keyed / pre-normalization)
//   - client: app/book/data/book-package-core.ts (tone-flattened / post-normalization)
// They are NOT accidental divergence — they are two LIFECYCLE STAGES of the same
// document, modeled explicitly below:
//
//   RAW stage      — tone-keyed content ({ gentle, direct, competitive }), the
//                    shape produced by the v21→v13 server adapter and stored in
//                    the catalog / read by the ingestion + validation pipeline.
//   RESOLVED stage — the tone-FLATTENED reader shape: `normalizeNstdVariant`
//                    (book-package-core.ts) collapses every ToneKeyed value to a
//                    single string via `resolveTone`. This is what the reader UI
//                    consumes.
//
// Both `app/app/api/book/_lib/types.ts` and `app/book/data/book-package-core.ts`
// now re-export the definitions here under their historical names, so every
// existing import path keeps working unchanged.
//
// This module must stay dependency-free (no imports) so it is safe to import
// from both server and client, and so the forthcoming lib/ boundary rule holds.

// ── Shared / stage-invariant base types ─────────────────────────────────────

export type VariantFamily = "EMH" | "PBC";

export type VariantKey =
  | "easy"
  | "medium"
  | "hard"
  | "precise"
  | "balanced"
  | "challenging";

/** The three tone voices every raw tone-keyed value carries. */
export type ToneKey = "gentle" | "direct" | "competitive";

/** Loosely-typed tone object as it appears in raw JSON (any subset present). */
export type ToneObject = { gentle?: string; direct?: string; competitive?: string };

/** Tone-keyed content: { gentle: string, direct: string, competitive: string } */
export type ToneKeyed = {
  gentle: string;
  direct: string;
  competitive: string;
};

export type OneMinuteRecapToneKeyed =
  | ToneKeyed
  | {
      retrieve: ToneKeyed;
      connect: ToneKeyed;
      preview: ToneKeyed;
    };

/**
 * Rendered summary block. Stage-invariant: both stages carry already-flattened
 * strings here (the raw adapter resolves tone before emitting blocks), so the
 * server `ChapterSummaryBlock` and client `PackageSummaryBlock` are the same shape.
 */
export type SummaryBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "bullet";
      text: string;
      detail?: string;
    };

export type BookPackageEdition = {
  name: string;
  publishedYear?: number | null;
  publisher?: string;
  publishedDate?: string;
  imprintFamily?: string[];
  isbn10?: string;
  isbn13?: string;
  format?: string;
  language?: string;
  translator?: string;
  translationYear?: number | null;
  openLibraryEdition?: string;
  sourceText?: string;
  sourceProvenance?: string;
};

// ── Concept Dependency Graph (raw-stage only) ───────────────────────────────

export type ConceptNode = {
  id: string;
  label: string;
  introducedIn: string;
  summary?: string;
};

export type ConceptEdge = {
  from: string;
  to: string;
  type: "prerequisite";
};

export type ConceptGraph = {
  concepts: ConceptNode[];
  edges: ConceptEdge[];
  chapterIntroduces: Record<string, string[]>;
  chapterRequires: Record<string, string[]>;
};

// ── v21 behavior-change layer (raw-stage extras, Layer A) ───────────────────

/** v21 behavior-change layer (Layer A). Sub-objects are surfaced only when
 *  complete (the adapter drops partial/empty shapes), so the reader contract is
 *  all-or-nothing per sub-object. */
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
  hook?: string;
  counterintuition?: string;
  tryThisNow?: string;
  keyTakeaway?: string;
  memorableLines?: Array<{ text: string; location?: string; why?: string }>;
  experiencePlan?: V21ExperiencePlan;
};

// ── RAW stage (tone-keyed, pre-normalization) ───────────────────────────────
// Historical server names (`ChapterVariantContent`, `BookPackage`, …) are
// aliased onto these in app/app/api/book/_lib/types.ts.

export type RawVariantContent = {
  importantSummary?: string;
  summaryBullets?: string[];
  summaryBlocks?: SummaryBlock[];
  takeaways?: string[];
  practice?: string[];
  /** Modern format: tone-keyed chapter breakdown narrative */
  chapterBreakdown?: ToneKeyed;
  /** Modern format: tone-keyed takeaway objects */
  keyTakeaways?: Array<{ point: ToneKeyed; moreDetails?: ToneKeyed }>;
  /** Modern format: tone-keyed one-minute recap */
  oneMinuteRecap?: OneMinuteRecapToneKeyed;
  activationPrompt?: ToneKeyed;
  selfCheckPrompt?: ToneKeyed;
  selfCheckPrompts?: ToneKeyed[];
  reflectionPrompts?: ToneKeyed[];
  predictionPrompt?: ToneKeyed;
};

export type RawQuizQuestion = {
  questionId: string;
  prompt?: string;
  stem?: string;
  choices?: string[];
  options?: string[];
  correctAnswerIndex?: number;
  correctIndex?: number;
  explanation?: string | ToneKeyed;
  bloomsLevel?: string;
  depthLevel?: string;
};

export type RawQuiz = {
  chapterId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  title?: string;
  passingScorePercent: number;
  questions: RawQuizQuestion[];
  retryQuestions?: RawQuizQuestion[];
};

export type RawExample = {
  exampleId?: string;
  title?: string;
  scenario: string | ToneKeyed;
  whatToDo: string[] | ToneKeyed;
  whyItMatters: string | ToneKeyed;
  contexts?: string[];
  category?: string;
  format?: string;
  endingType?: string;
};

/** Tone-keyed review card for spaced repetition */
export type RawReviewCard = {
  cardId?: string;
  front: ToneKeyed;
  back: ToneKeyed;
  difficulty?: "easy" | "medium" | "hard";
};

/** Tone-keyed implementation plan */
export type RawImplementationPlan = {
  coreSkill?: ToneKeyed;
  concreteAction?: ToneKeyed;
  ifThenPlans?: Array<{
    context: string;
    plan: ToneKeyed;
  }>;
  ifThenPlan?: ToneKeyed;
  twentyFourHourChallenge?: ToneKeyed;
  weeklyPractice?: ToneKeyed;
  friction?: ToneKeyed;
  checkpoint?: ToneKeyed;
};

export type RawChapter = {
  book?: {
    bookId?: string;
    title?: string;
    author?: string;
  };
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentHash?: string;
  contentVariants: Partial<Record<VariantKey, RawVariantContent>>;
  examples: RawExample[];
  quiz: RawQuiz;
  implementationPlan?: RawImplementationPlan;
  reviewCards?: RawReviewCard[];
  keyTakeawayCard?: ToneKeyed;
  v21Extras?: V21ChapterExtras;
};

export type RawBook = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags?: string[];
  cover?: {
    emoji?: string;
    color?: string;
  };
  edition?: string | BookPackageEdition;
  variantFamily: VariantFamily;
  chapterRange?: string;
};

export type RawBookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  licenseNotes?: string;
  book: RawBook;
  chapters: RawChapter[];
  conceptGraph?: ConceptGraph;
};

// ── RESOLVED stage (tone-flattened, post-normalization) ─────────────────────
// Historical client names (`PackageVariantContent`, `BookPackage`, …) are
// aliased onto these in app/book/data/book-package-core.ts.

export type ResolvedVariantContent = {
  chapterBreakdown?: string;
  importantSummary?: string;
  summaryBullets?: string[];
  summaryBlocks?: SummaryBlock[];
  keyTakeaways?: string[];
  takeaways?: string[];
  practice?: string[];
  oneMinuteRecap?: string[];
  activationPrompt?: string;
  selfCheckPrompt?: string;
  selfCheckPrompts?: string[];
  reflectionPrompts?: string[];
  closingPrompt?: string;
  predictionPrompt?: string;
};

export type ResolvedQuizQuestion = {
  questionId: string;
  prompt?: string;
  stem?: string;
  choices?: string[];
  options?: string[];
  correctIndex?: number;
  correctAnswerIndex?: number;
  explanation?: string | Record<string, string>;
};

export type ResolvedQuiz = {
  chapterId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  passingScorePercent: number;
  questions: ResolvedQuizQuestion[];
  retryQuestions?: ResolvedQuizQuestion[];
};

export type ResolvedExample = {
  exampleId: string;
  title: string;
  scenario: string;
  whatToDo: string[];
  whyItMatters: string;
  contexts?: string[];
  reflectionPrompt?: string;
};

export type ResolvedImplementationPlan = {
  coreSkill: string;
  ifThenPlans: Array<{ context: string; plan: string }>;
  twentyFourHourChallenge: string;
  weeklyPractice: string;
};

export type ResolvedReviewCard = {
  cardId: string;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
};

export type ResolvedChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, ResolvedVariantContent>>;
  examples: ResolvedExample[];
  quiz: ResolvedQuiz;
  implementationPlan?: ResolvedImplementationPlan;
  reviewCards?: ResolvedReviewCard[];
  keyTakeawayCard?: string;
};

export type ResolvedBook = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags?: string[];
  edition?: string | BookPackageEdition;
  variantFamily: VariantFamily;
  chapterRange?: string;
};

export type ResolvedBookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  book: ResolvedBook;
  chapters: ResolvedChapter[];
};

// ── Normalizer lifecycle contract (Raw → Resolved) ──────────────────────────

/**
 * Field-level tone resolution: a raw tone-keyed value collapses to the plain
 * string the reader consumes. Documents, at the type level, the transform that
 * `resolveTone` performs at runtime and that separates the two stages above.
 */
export type ResolveTone<T> = T extends ToneKeyed ? string : T;

/**
 * The tone-normalizer's contract. `normalizeAnyPackage` / `normalizeV21Package`
 * consume raw (tone-keyed) package JSON and emit the resolved (tone-flattened)
 * reader shape. Typed here so a round-trip test can assert the normalizer's
 * return type is assignable to `ResolvedBookPackage`, keeping the two stages
 * anchored to this single source.
 */
export type PackageNormalizer = (raw: unknown, tone?: ToneKey) => ResolvedBookPackage;
