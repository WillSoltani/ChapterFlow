/**
 * ChapterFlow v21 — shared typed contracts.
 *
 * Every agent in the pipeline consumes and produces one of the types here.
 * Writers return StructuredOutputs; critics consume the same shapes produced
 * by v13 and the v21 writers. Keep these aligned with the on-disk book-package
 * schema where they overlap so v21 output drops directly into the existing
 * upload-book-package flow.
 */

// ── Tone keying (tolerated, used by v13 shipped output) ──────────────────────

export type Tone = "gentle" | "direct" | "competitive";

export type ToneKeyed<T = string> = {
  gentle: T;
  direct: T;
  competitive: T;
};

/** Accepts either a single value or a tone-keyed triple. v21 writers emit a
 *  single canonical voice; critics must handle both to score legacy v13 data. */
export type MaybeToned<T> = T | ToneKeyed<T>;

export function resolveDirect<T>(value: MaybeToned<T> | undefined): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && value !== null && "direct" in (value as object)) {
    return (value as ToneKeyed<T>).direct;
  }
  return value as T;
}

// ── Book-level ──────────────────────────────────────────────────────────────

export type BookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  book: {
    bookId: string;
    title: string;
    author: string;
    categories?: string[];
    tags?: string[];
    edition?: BookEdition;
    variantFamily?: string;
    chapterRange?: string;
  };
  chapters: Chapter[];
};

export type BookEdition = {
  name?: string;
  publisher?: string;
  publishedYear?: number | null;
  translator?: string | null;
  translationYear?: number | null;
  isbn13?: string | null;
  format?: string;
  sourceText?: string;
  sourceProvenance?: string;
};

// ── Chapter ─────────────────────────────────────────────────────────────────

export type Chapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: ContentVariants;
  examples: Example[];
  quiz: Quiz;
  implementationPlan: ImplementationPlan;
  reviewCards: ReviewCard[];
  keyTakeawayCard: MaybeToned<string>;
};

export type ContentVariants = {
  easy: ContentTier;
  medium: ContentTier;
  hard: ContentTier;
};

export type ContentTier = {
  chapterBreakdown: MaybeToned<string>;
  keyTakeaways?: MaybeToned<string[]> | string[];
  activationPrompt?: MaybeToned<string>;
  selfCheckPrompt?: MaybeToned<string>;
  selfCheckPrompts?: MaybeToned<string[]> | string[];
  predictionPrompt?: MaybeToned<string>;
  oneMinuteRecap?: MaybeToned<string>;
};

// ── Examples ────────────────────────────────────────────────────────────────

export type ExampleCategory =
  | "work" | "school" | "personal" | "business" | "finance"
  | "relationships" | "policy" | "media" | "health" | "home" | "online" | "friends" | "money";

export type ExampleFormat =
  | "decision_point" | "dialogue" | "dilemma" | "before_after" | "postmortem" | "predict_reveal"
  | "planning_choice" | "mistake_recovery" | "reset_moment" | "reflection" | "contrast"
  | "inner_monologue" | "vignette" | "audit" | "decision_memo" | "text_thread" | "scene"
  | "coach_talk" | "school_case" | "business_case" | string; // string fallback for legacy

export type Example = {
  exampleId: string;
  title: string;
  category: ExampleCategory;
  format: ExampleFormat;
  endingType?: string;
  contexts: string[];
  scenario: MaybeToned<string>;
  whatToDo: MaybeToned<string>;
  whyItMatters: MaybeToned<string>;
};

// ── Quiz ────────────────────────────────────────────────────────────────────

export type BloomsLevel =
  | "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

export type DepthLevel = "simple" | "standard" | "deep";

export type Quiz = {
  passingScorePercent: number;
  questions: QuizQuestion[];
};

export type QuizQuestion = {
  questionId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  correctAnswerIndex?: number;
  explanation?: MaybeToned<string>;
  bloomsLevel?: string;
  depthLevel?: string;
};

// ── Implementation plan ─────────────────────────────────────────────────────

export type ImplementationPlan = {
  coreSkill: MaybeToned<string>;
  ifThenPlans: Array<{
    context: string;
    plan: MaybeToned<string>;
  }>;
  twentyFourHourChallenge: MaybeToned<string>;
  weeklyPractice: MaybeToned<string>;
};

// ── Review card ─────────────────────────────────────────────────────────────

export type ReviewCard = {
  cardId: string;
  front: MaybeToned<string>;
  back: MaybeToned<string>;
  difficulty?: string;
};

// ── v21 planning artifacts ──────────────────────────────────────────────────

/** Editor-in-chief output. Single most important doc in the pipeline — every
 *  downstream agent reads this. Should be ~500 words of opinionated editorial. */
export type BookBrief = {
  bookId: string;
  title: string;
  author: string;
  thesisParagraph: string;        // 1 paragraph, the book's core argument
  coreIdeas: CoreIdea[];          // 3–5 load-bearing ideas
  targetReader: string;           // who this teaches and why they care
  voiceCharter: VoiceCharter;     // how prose should sound for THIS book
  voiceSpecimens?: string[];      // 5–7 sample sentences in the target voice (north stars)
  voiceAntiSpecimens?: string[];  // 4–6 sample sentences in OFF voice (what to avoid)
  teachingArc: string;            // how ideas compound across chapters
  forbiddenMoves: string[];       // book-specific don'ts (e.g., "don't use war metaphors in Atomic Habits")
};

export type CoreIdea = {
  name: string;                   // short label (e.g., "identity-based habits")
  oneSentence: string;            // plain-English claim
  mentalMove: string;             // the action a reader performs with this idea
  sourceAnchors: string[];        // passage citations in the source
};

export type VoiceCharter = {
  register: "warm" | "analytical" | "plainspoken" | "literary" | "clinical";
  person: "first" | "second" | "third";
  cadence: "short" | "medium" | "long";
  signatureMoves: string[];       // e.g., "open with a concrete scene", "use the reader's own situations"
  avoidMoves: string[];           // e.g., "no meta-reference to 'the chapter'", "no 'boundary condition'"
};

/** Curriculum planner output — one per chapter. Allows per-chapter variation
 *  in slot count, domains, and format choice, which is the #1 antidote to
 *  template feel. */
export type ChapterDesignDoc = {
  chapterId: string;
  number: number;
  title: string;
  coreMove: string;               // the one mental move this chapter teaches
  exampleCount: number;           // 3–9, chosen by planner (not fixed)
  exampleSpecs: ExampleSpec[];    // one per example slot, each with unique domain
  quizFocus: QuizFocus;
  cardFocus: CardFocus;
  readingTimeMinutes: number;
};

export type ExampleSpec = {
  domain: string;                 // specific, e.g., "asking for a raise at a late-stage startup"
  audience: string;               // who this speaks to
  stakes: string;                 // what's at risk in the scenario
  format: ExampleFormat;
  requiredBeat: string;           // the exact beat the example must hit
};

export type QuizFocus = {
  count: number;                  // 6–12, planner-chosen
  bloomsMix: Partial<Record<BloomsLevel, number>>; // e.g., { apply: 4, analyze: 3, evaluate: 2, understand: 1 }
  transferEmphasis: number;       // 0–1: fraction that must use novel scenarios
};

export type CardFocus = {
  count: number;
  retrievalPractice: boolean;     // true = novel-scenario cards; false = summary cards
};

// ── Critic results ──────────────────────────────────────────────────────────

export type CriticCheckId =
  | "narrative.named_protagonist"
  | "narrative.specific_scene"
  | "narrative.decision_point"
  | "narrative.example_templating"
  | "narrative.title_templating"
  | "register.no_meta_reference"
  | "register.no_chapter_number_literal"
  | "register.no_banned_phrase"
  | "pedagogy.quiz_tests_application"
  | "pedagogy.card_tests_retrieval"
  | "pedagogy.example_exercises_core_move"
  | "schema.enum_validity"
  | "schema.answer_position_balance"
  | "schema.bloom_vocabulary";

export type CriticSeverity = "blocker" | "major" | "minor";

export type CriticFinding = {
  checkId: CriticCheckId;
  severity: CriticSeverity;
  message: string;
  evidence?: string;              // the offending text span
};

export type UnitLocation = {
  bookId: string;
  chapterNumber: number;
  unitType: "breakdown" | "example" | "quiz_question" | "review_card" | "implementation_plan" | "key_takeaway";
  unitId?: string;                // exampleId, questionId, cardId when relevant
  tone?: Tone;
  tier?: "easy" | "medium" | "hard";
};

export type UnitCriticResult = {
  location: UnitLocation;
  findings: CriticFinding[];
  passedCount: number;
  totalCount: number;
  passed: boolean;
};

export type BookCriticReport = {
  bookId: string;
  bookFile: string;
  generatedAt: string;
  chapterCount: number;
  unitCount: number;
  unitResults: UnitCriticResult[];
  summary: {
    passedUnits: number;
    failedUnits: number;
    passRate: number;
    byCheck: Record<CriticCheckId, { pass: number; fail: number }>;
  };
};

// ── Library state (cross-book) ──────────────────────────────────────────────

export type LibraryState = {
  bookCount: number;
  nameLedger: Record<string, { bookIds: string[]; usageCount: number }>;
  phraseBudget: Record<string, { used: number; budget: number }>;
  answerPositionHistogram: Record<number, number>;
  lastUpdatedAt: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// v21-NATIVE SCHEMA
// ──────────────────────────────────────────────────────────────────────────────
// The types above model v13's shape (for scoring legacy output). The types
// below are v21-native: single canonical voice, no redundant summary fields,
// short tags separated from planner-spec data, and a new `hook` surface so
// chapters have a way in that isn't a definition.
//
// v21 output carries `schemaVersion: "chapterflow-v21-authored"`. Downstream
// consumers should branch on schemaVersion to know which shape to read.
// ──────────────────────────────────────────────────────────────────────────────

export const V21_SCHEMA_VERSION = "chapterflow-v21-authored" as const;

export type BookPackageV21 = {
  schemaVersion: typeof V21_SCHEMA_VERSION;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  book: {
    bookId: string;
    title: string;
    author: string;
    categories?: string[];
    tags?: string[];
    edition?: BookEdition;
  };
  chapters: ChapterV21[];
};

export type ChapterV21 = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  hook: string;                         // 60–120 chars; arresting one-liner at chapter top
  counterintuition?: string;            // 1–2 sentences; what makes the idea non-obvious
  tryThisNow?: string;                  // 80–220 chars; one specific 30–90s action the reader can do right now or at their next obvious moment. Directive, not question. Renders as a mid-chapter callout, no input required.
  keyTakeaway: string;                  // 140–220 chars; the single sentence to carry
  // DEPRECATED: reflectionBefore/After were replaced by tryThisNow. Keep
  // optional in the type so legacy v21 packages (tiny-habits) still parse.
  reflectionBefore?: string;
  reflectionAfter?: string;
  breakdown: {
    fastRead: string;                   // ~400–700 chars; scene + rule, 2-min read
    deepRead: string;                   // ~1200–1800 chars; mechanism + second scene
    fullRead: string;                   // ~2500–3500 chars; depth + third angle + limits
  };
  examples: ExampleV21[];
  quiz: QuizV21;
  reviewCards: ReviewCardV21[];
  implementationPlan: ImplementationPlanV21;
  memorableLines?: Array<{
    text: string;                       // exact sentence from the chapter
    location: string;                   // e.g., "breakdown.deepRead", "hook", "example[2].whyItMatters"
    why: string;                        // 1 sentence on what makes it stick
  }>;
};

export type ExampleV21 = {
  exampleId: string;
  title: string;
  /** Short descriptors for filtering/display. 1–4 items, each ≤40 chars. */
  tags: string[];
  /** The planner's design rationale for this example. Not shown to readers. */
  planSpec: {
    domain: string;
    audience: string;
    stakes: string;
    format: string;
    requiredBeat: string;
  };
  scenario: string;                     // 280–520 chars
  whatToDo: string;                     // 120–240 chars
  whyItMatters: string;                 // 120–240 chars
};

export type QuizV21 = {
  passingScorePercent: number;
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: string[];                   // exactly 3
    correctIndex: number;                // 0, 1, 2
    explanation: string;                 // 120–300 chars
    bloomsLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    depthLevel: "simple" | "standard" | "deep";
  }>;
};

export type ReviewCardV21 = {
  cardId: string;
  front: string;                        // 30–200 chars
  back: string;                         // 80–400 chars
  difficulty: "easy" | "medium" | "hard";
};

export type ImplementationPlanV21 = {
  coreSkill: string;                    // 2–4 sentences
  ifThenPlans: Array<{
    context: string;                    // free-form; planner chooses relevant contexts for this book
    plan: string;                       // 1–2 sentences; "If X, then Y"
  }>;
  twentyFourHourChallenge: string;
  weeklyPractice: string;
};
