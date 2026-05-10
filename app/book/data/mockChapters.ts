import {
  BOOK_PACKAGES,
  getBookPackageById,
  getBookPackagePresentation,
  getThePowerOfHabitPackageForTone,
  THE_POWER_OF_HABIT_RAW_CHAPTERS,
  getMakeTimePackageForTone,
  MAKE_TIME_RAW_CHAPTERS,
  getMakeItStickPackageForTone,
  MAKE_IT_STICK_RAW_CHAPTERS,
  getMadeToStickPackageForTone,
  MADE_TO_STICK_RAW_CHAPTERS,
  getCrucialConversationsPackageForTone,
  CRUCIAL_CONVERSATIONS_RAW_CHAPTERS,
  getDifficultConversationsPackageForTone,
  DIFFICULT_CONVERSATIONS_RAW_CHAPTERS,
  getWhatEveryBodyIsSayingPackageForTone,
  WHAT_EVERY_BODY_IS_SAYING_RAW_CHAPTERS,
  getThePrincePackageForTone,
  THE_PRINCE_RAW_CHAPTERS,
  getTinyHabitsPackageForTone,
  TINY_HABITS_RAW_CHAPTERS,
  getEssentialismPackageForTone,
  ESSENTIALISM_RAW_CHAPTERS,
  getDeepWorkPackageForTone,
  DEEP_WORK_RAW_CHAPTERS,
  getSoGoodTheyCantIgnoreYouPackageForTone,
  SO_GOOD_THEY_CANT_IGNORE_YOU_RAW_CHAPTERS,
  getPredictablyIrrationalPackageForTone,
  PREDICTABLY_IRRATIONAL_RAW_CHAPTERS,
  getThinkingInBetsPackageForTone,
  THINKING_IN_BETS_RAW_CHAPTERS,
  getTheLawsOfHumanNaturePackageForTone,
  THE_LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS,
  getTheAlmanackOfNavalRavikantPackageForTone,
  THE_ALMANACK_OF_NAVAL_RAVIKANT_RAW_CHAPTERS,
  getTheHardThingAboutHardThingsPackageForTone,
  THE_HARD_THING_ABOUT_HARD_THINGS_RAW_CHAPTERS,
  getInfluencePackageForTone,
  INFLUENCE_RAW_CHAPTERS,
  getTheInnovatorsDilemmaPackageForTone,
  THE_INNOVATORS_DILEMMA_RAW_CHAPTERS,
  getBuiltToLastPackageForTone,
  BUILT_TO_LAST_RAW_CHAPTERS,
  getCompetingAgainstLuckPackageForTone,
  COMPETING_AGAINST_LUCK_RAW_CHAPTERS,
  getLeadersEatLastPackageForTone,
  LEADERS_EAT_LAST_RAW_CHAPTERS,
  getLimitlessPackageForTone,
  LIMITLESS_RAW_CHAPTERS,
  getPeakPackageForTone,
  PEAK_RAW_CHAPTERS,
  getPlayingToWinPackageForTone,
  PLAYING_TO_WIN_RAW_CHAPTERS,
  getTheOneThingPackageForTone,
  THE_ONE_THING_RAW_CHAPTERS,
  getTheCharismaMythPackageForTone,
  THE_CHARISMA_MYTH_RAW_CHAPTERS,
  getTheLikeSwitchPackageForTone,
  THE_LIKE_SWITCH_RAW_CHAPTERS,
  getGoodToGreatPackageForTone,
  GOOD_TO_GREAT_RAW_CHAPTERS,
  getHowToTalkToAnyonePackageForTone,
  HOW_TO_TALK_TO_ANYONE_RAW_CHAPTERS,
  getSevenPowersPackageForTone,
  SEVEN_POWERS_RAW_CHAPTERS,
  getTalkLikeTedPackageForTone,
  TALK_LIKE_TED_RAW_CHAPTERS,
  getNeverSplitTheDifferencePackageForTone,
  NEVER_SPLIT_THE_DIFFERENCE_RAW_CHAPTERS,
  getPreSuasionPackageForTone,
  PRE_SUASION_RAW_CHAPTERS,
  getSuperThinkingPackageForTone,
  SUPER_THINKING_RAW_CHAPTERS,
  getSuperforecastingPackageForTone,
  SUPERFORECASTING_RAW_CHAPTERS,
  getYouCantHurtMePackageForTone,
  YOU_CANT_HURT_ME_RAW_CHAPTERS,
  getIndistractablePackageForTone,
  INDISTRACTABLE_RAW_CHAPTERS,
  getExtremeOwnershipPackageForTone,
  EXTREME_OWNERSHIP_RAW_CHAPTERS,
  getTheArtOfWarPackageForTone,
  THE_ART_OF_WAR_RAW_CHAPTERS,
  getTheWarOfArtPackageForTone,
  THE_WAR_OF_ART_RAW_CHAPTERS,
  getThe33StrategiesOfWarPackageForTone,
  THE_33_STRATEGIES_OF_WAR_RAW_CHAPTERS,
  getAtomicHabitsPackageForTone,
  ATOMIC_HABITS_RAW_CHAPTERS,
  getTheGreatMentalModelsVol1PackageForTone,
  THE_GREAT_MENTAL_MODELS_VOL_1_RAW_CHAPTERS,
  getTheBlackSwanPackageForTone,
  THE_BLACK_SWAN_RAW_CHAPTERS,
  getTheFirst20HoursPackageForTone,
  THE_FIRST_20_HOURS_RAW_CHAPTERS,
  getTheOutsidersPackageForTone,
  THE_OUTSIDERS_RAW_CHAPTERS,
  getUltralearningPackageForTone,
  ULTRALEARNING_RAW_CHAPTERS,
  isStrictReaderSchema,
  resolveTone,
  type BookPackage,
  type PackageChapter,
  type PackageExample,
  type PackageQuizQuestion,
  type PackageSummaryBlock,
  type PackageVariantContent,
  type ToneKey,
  type VariantFamily,
  type VariantKey,
} from "@/app/book/data/bookPackages";
import {
  V21_SCHEMA_VERSION,
  extractV21ChapterExtras,
  isV21NormalizedPackage,
  type V21MemorableLine,
} from "@/app/book/lib/v21-adapter";

export type ReadingDepth = "simple" | "standard" | "deeper";
export type ExampleScope = "work" | "school" | "personal";
export type ChapterMotivationStyle = "gentle" | "direct" | "competitive";

export type ChapterQuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type ChapterSummaryBlock =
  | {
      id: string;
      type: "paragraph";
      text: string;
    }
  | {
      id: string;
      type: "bullet";
      text: string;
      detail?: string;
    };

export type ScenarioDecisionOption = {
  id: string;
  text: string;
  isRecommended: boolean;
};

export type ChapterExample = {
  id: string;
  title: string;
  scope: ExampleScope;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  /** Per-scenario decision options. If absent, auto-generated from content. */
  decisionOptions?: ScenarioDecisionOption[];
  /** Reflective prompt shown before revealing analysis. Falls back to generic if absent. */
  reflectionPrompt?: string;
};

export type ImplementationPlanItem = {
  coreSkill: string;
  ifThenPlans: Array<{ context: string; plan: string }>;
  twentyFourHourChallenge: string;
  weeklyPractice: string;
};

export type ReviewCardItem = {
  id: string;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
};

export type BookChapter = {
  bookId: string;
  id: string;
  order: number;
  code: string;
  title: string;
  minutes: number;
  summaryByDepth: Record<ReadingDepth, ChapterSummaryBlock[]>;
  takeaways: string[];
  takeawaysByDepth: Record<ReadingDepth, string[]>;
  recap?: string;
  recapByDepth: Record<ReadingDepth, string[]>;
  activationPrompt?: string;
  activationPromptByDepth: Partial<Record<ReadingDepth, string>>;
  selfCheckPrompt?: string;
  selfCheckPrompts?: string[];
  selfCheckPromptsByDepth: Partial<Record<ReadingDepth, string[]>>;
  reflectionPrompts?: string[];
  reflectionPromptsByDepth: Partial<Record<ReadingDepth, string[]>>;
  closingPrompt?: string;
  closingPromptByDepth: Partial<Record<ReadingDepth, string>>;
  predictionPrompt?: string;
  predictionPromptByDepth: Partial<Record<ReadingDepth, string>>;
  keyTakeawayCard?: string;
  implementationPlan?: ImplementationPlanItem;
  reviewCards?: ReviewCardItem[];
  examplesDetailed: ChapterExample[];
  quiz: ChapterQuizQuestion[];
  quizByDepth: Record<ReadingDepth, ChapterQuizQuestion[]>;
  quizRetryPool: ChapterQuizQuestion[];
  quizPassingScorePercent: number;
  isStrictV12: boolean;
  /** Source schema marker. Set to "chapterflow-v21-authored" for v21 books. */
  schemaVersion?: string;
  /** v21-only: arresting one-liner shown above the chapter title. */
  hook?: string;
  /** v21-only: 1–2 sentence framing of why the idea is non-obvious. */
  counterintuition?: string;
  /**
   * v21-only: a single 30–90s directive shown as a mid-chapter callout.
   * Replaces the deprecated reflectionBefore/After fields.
   */
  tryThisNow?: string;
  /**
   * DEPRECATED v21 fields. Kept for parsing legacy v21 packages (tiny-habits)
   * cleanly; the reader UI no longer renders them.
   */
  reflectionBefore?: string;
  reflectionAfter?: string;
  /** v21-only: 3 quotable sentences from the chapter for share/highlight. */
  memorableLines?: V21MemorableLine[];
};

type BookChapterBundle = {
  pages: number;
  chapters: BookChapter[];
};

const QUIZ_TARGETS: Record<ReadingDepth, number> = {
  simple: 5,
  standard: 7,
  deeper: 10,
};

const SCENARIO_NAMES = ["Maya", "Jordan", "Alex", "Riley"] as const;

function chapterCode(order: number): string {
  return `CH.${String(order).padStart(2, "0")}`;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(value: string | undefined): string[] {
  if (!value) return [];
  return cleanText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence))
    .filter(Boolean);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function normalizeQuizPrompt(prompt: string): string {
  const cleaned = cleanText(prompt)
    .replace(/\bin this chapter\b/gi, "in the reading")
    .replace(/\bfrom this chapter\b/gi, "from the reading")
    .replace(/\bof this chapter\b/gi, "of the reading")
    .replace(/\bthis chapter\b/gi, "the reading")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([?!.,;:])/g, "$1");
  return cleaned.trim();
}

function pickScenarioName(seed: string): string {
  return SCENARIO_NAMES[hashString(seed) % SCENARIO_NAMES.length];
}

function normalizeScenarioPerspective(scenario: string, seed: string): string {
  const text = cleanText(scenario);
  if (!text) return text;
  if (!/^\s*you\b/i.test(text) && !/\byou\b/i.test(text)) return text;

  const name = pickScenarioName(seed);
  let transformed = text
    .replace(/\bYou are\b/gi, `${name} is`)
    .replace(/\bYou're\b/gi, `${name} is`)
    .replace(/\bYou were\b/gi, `${name} was`)
    .replace(/\bYou have\b/gi, `${name} has`)
    .replace(/\bYou do\b/gi, `${name} does`)
    .replace(/\bYou keep\b/gi, `${name} keeps`)
    .replace(/\bYou feel\b/gi, `${name} feels`)
    .replace(/\bYou need\b/gi, `${name} needs`)
    .replace(/\bYou want\b/gi, `${name} wants`)
    .replace(/\bYou know\b/gi, `${name} knows`)
    .replace(/\bYou can\b/gi, `${name} can`)
    .replace(/\bYou may\b/gi, `${name} may`)
    .replace(/\bYou\b/gi, name)
    .replace(/\bYour\b/g, `${name}'s`)
    .replace(/\byour\b/g, `${name}'s`);

  transformed = transformed
    .replace(new RegExp(`\\b${name} keep\\b`, "g"), `${name} keeps`)
    .replace(new RegExp(`\\b${name} need\\b`, "g"), `${name} needs`)
    .replace(new RegExp(`\\b${name} want\\b`, "g"), `${name} wants`)
    .replace(new RegExp(`\\b${name} know\\b`, "g"), `${name} knows`)
    .replace(new RegExp(`\\b${name} have\\b`, "g"), `${name} has`)
    .replace(new RegExp(`\\b${name} are\\b`, "g"), `${name} is`)
    .replace(new RegExp(`\\b${name} do\\b`, "g"), `${name} does`)
    .replace(new RegExp(`\\b${name} try\\b`, "g"), `${name} tries`)
    .replace(new RegExp(`\\b${name} say\\b`, "g"), `${name} says`)
    .replace(new RegExp(`\\b${name} feel\\b`, "g"), `${name} feels`);

  return cleanText(transformed);
}

function variantKeysForFamily(variantFamily: VariantFamily): Record<ReadingDepth, VariantKey[]> {
  if (variantFamily === "PBC") {
    return {
      simple: ["precise", "balanced", "challenging"],
      standard: ["balanced", "precise", "challenging"],
      deeper: ["challenging", "balanced", "precise"],
    };
  }

  return {
    simple: ["easy", "medium", "hard"],
    standard: ["medium", "easy", "hard"],
    deeper: ["hard", "medium", "easy"],
  };
}

function getVariantContent(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): PackageVariantContent | undefined {
  const orderedKeys = variantKeysForFamily(family)[depth];
  for (const key of orderedKeys) {
    const variant = chapter.contentVariants[key];
    if (variant) return variant;
  }
  return Object.values(chapter.contentVariants).find(Boolean);
}

function variantTakeaways(variant: PackageVariantContent | undefined): string[] {
  if (!variant) return [];
  return dedupe([...(variant.takeaways ?? []), ...(variant.keyTakeaways ?? [])]);
}

function variantSummaryBlocks(
  variant: PackageVariantContent | undefined
): PackageSummaryBlock[] {
  if (!variant || !Array.isArray(variant.summaryBlocks)) return [];
  return variant.summaryBlocks
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      if (block.type === "paragraph" && typeof block.text === "string") {
        const text = cleanText(block.text);
        if (!text) return null;
        return { type: "paragraph", text } satisfies PackageSummaryBlock;
      }
      if (block.type === "bullet" && typeof block.text === "string") {
        const text = cleanText(block.text);
        if (!text) return null;
        const detail =
          typeof block.detail === "string" && block.detail.trim()
            ? cleanText(block.detail)
            : undefined;
        return { type: "bullet", text, detail } satisfies PackageSummaryBlock;
      }
      return null;
    })
    .filter((block): block is PackageSummaryBlock => Boolean(block));
}

function isStrictV12ReaderPackage(bookPackage: BookPackage): boolean {
  return isStrictReaderSchema(bookPackage);
}

function exactSummaryBlocks(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): ChapterSummaryBlock[] {
  const explicitBlocks = variantSummaryBlocks(getVariantContent(chapter, family, depth));
  if (explicitBlocks.length === 0) return [];

  let paragraphIndex = 0;
  let bulletIndex = 0;
  return explicitBlocks.map((block) => {
    if (block.type === "paragraph") {
      paragraphIndex += 1;
      return {
        id: `${depth}-p-${paragraphIndex}`,
        type: "paragraph",
        text: cleanText(block.text),
      } satisfies ChapterSummaryBlock;
    }

    bulletIndex += 1;
    return {
      id: `${depth}-b-${bulletIndex}`,
      type: "bullet",
      text: cleanText(block.text),
      detail: block.detail ? cleanText(block.detail) : undefined,
    } satisfies ChapterSummaryBlock;
  });
}

function exactTakeaways(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string[] {
  const variant = getVariantContent(chapter, family, depth);
  const takeawayTexts = variantSummaryBlocks(variant)
    .filter((block): block is Extract<PackageSummaryBlock, { type: "bullet" }> => block.type === "bullet")
    .map((block) => cleanText(block.text));
  const explicit = dedupe([
    ...(variant?.takeaways ?? []),
    ...(variant?.keyTakeaways ?? []),
    ...takeawayTexts,
  ]);
  return explicit;
}

function exactRecap(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string[] {
  const variant = getVariantContent(chapter, family, depth);
  return dedupe(variant?.oneMinuteRecap ?? []);
}

function exactActivationPrompt(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string | undefined {
  const variant = getVariantContent(chapter, family, depth);
  return variant?.activationPrompt ? cleanText(variant.activationPrompt) : undefined;
}

function exactSelfCheckPrompts(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string[] {
  const variant = getVariantContent(chapter, family, depth);
  return dedupe([
    ...(variant?.selfCheckPrompt ? [variant.selfCheckPrompt] : []),
    ...(variant?.selfCheckPrompts ?? []),
  ]);
}

function exactPredictionPrompt(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string | undefined {
  const variant = getVariantContent(chapter, family, depth);
  return variant?.predictionPrompt ? cleanText(variant.predictionPrompt) : undefined;
}

function exactReflectionPrompts(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string[] {
  const variant = getVariantContent(chapter, family, depth);
  return dedupe((variant?.reflectionPrompts ?? []).map(cleanText).filter(Boolean));
}

function exactClosingPrompt(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string | undefined {
  const variant = getVariantContent(chapter, family, depth);
  return variant?.closingPrompt ? cleanText(variant.closingPrompt) : undefined;
}

function buildSummaryBlocks(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): ChapterSummaryBlock[] {
  return exactSummaryBlocks(chapter, family, depth);
}

function buildTakeaways(chapter: PackageChapter, family: VariantFamily): string[] {
  const preferred = getVariantContent(chapter, family, "standard");
  return dedupe(variantTakeaways(preferred));
}

function buildRecap(chapter: PackageChapter, family: VariantFamily): string[] {
  const preferred = getVariantContent(chapter, family, "standard");
  const fallback = getVariantContent(chapter, family, "deeper");
  const items = dedupe([
    ...(preferred?.oneMinuteRecap ?? []),
    ...(fallback?.oneMinuteRecap ?? []),
  ]);
  return items;
}

function inferScope(example: PackageExample): ExampleScope {
  const normalizedContexts = (example.contexts ?? []).map((value) => value.toLowerCase());
  if (normalizedContexts.includes("work")) return "work";
  if (normalizedContexts.includes("school")) return "school";
  if (normalizedContexts.includes("personal")) return "personal";

  const contexts = normalizedContexts.join(" ");
  const searchable = `${example.title} ${example.scenario} ${contexts}`.toLowerCase();

  if (/(roommate|friend|friendship|social|party|relationship|family)/.test(searchable)) {
    return "personal";
  }
  if (/(campus|class|lecture|student|school|club|group project|teammate)/.test(searchable)) {
    return "school";
  }
  if (/(career|network|job|work|internship|team|office|manager)/.test(searchable)) {
    return "work";
  }
  return "personal";
}

function ensureSentence(value: string): string {
  const text = cleanText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function joinSteps(steps: string[]): string {
  return steps.map((step) => ensureSentence(step)).join(" ");
}

function normalizeChoices(choices: string[]): string[] {
  return choices.slice(0, 5).map((choice) => cleanText(choice));
}

function dedupeQuestionsById(
  questions: ChapterQuizQuestion[]
): ChapterQuizQuestion[] {
  const seen = new Set<string>();
  const deduped: ChapterQuizQuestion[] = [];
  questions.forEach((question) => {
    if (seen.has(question.id)) return;
    seen.add(question.id);
    deduped.push(question);
  });
  return deduped;
}

function normalizeQuizQuestion(
  chapter: PackageChapter,
  family: VariantFamily,
  question: PackageQuizQuestion,
  fallbackId: string,
  tone: ToneKey = "direct",
  strictV12 = false
): ChapterQuizQuestion | null {
  const rawChoices = question.choices ?? question.options ?? [];
  const options = normalizeChoices(rawChoices);
  if (options.length < 2) {
    console.warn(`Skipping quiz question "${fallbackId}": fewer than 2 valid choices`);
    return null;
  }
  const rawIndex = question.correctIndex ?? question.correctAnswerIndex ?? 0;
  if (rawIndex < 0 || rawIndex >= options.length) {
    console.warn(`Skipping quiz question "${fallbackId}": correctIndex ${rawIndex} out of bounds (${options.length} options)`);
    return null;
  }
  const correctIndex = rawIndex;
  const rawPrompt = question.prompt ?? question.stem ?? "";
  const prompt = strictV12 ? cleanText(rawPrompt) : normalizeQuizPrompt(rawPrompt);
  const authoredExplanation = resolveTone(question.explanation, tone);
  return {
    id: question.questionId ? cleanText(question.questionId) : fallbackId,
    prompt,
    options,
    correctIndex,
    explanation:
      strictV12
        ? authoredExplanation
        : authoredExplanation || buildQuizExplanation(chapter, prompt, options[correctIndex], family),
  };
}

function buildQuizRetryPool(
  chapter: PackageChapter,
  family: VariantFamily,
  tone: ToneKey = "direct",
  strictV12 = false
): ChapterQuizQuestion[] {
  return (chapter.quiz.retryQuestions ?? [])
    .map((question, index) =>
      normalizeQuizQuestion(
        chapter,
        family,
        question,
        `${chapter.chapterId}-retry-authored-${String(index + 1).padStart(2, "0")}`,
        tone,
        strictV12
      )
    )
    .filter((q): q is ChapterQuizQuestion => q !== null);
}

function buildQuizByDepth(
  questions: ChapterQuizQuestion[]
): Record<ReadingDepth, ChapterQuizQuestion[]> {
  return {
    simple: questions.slice(0, QUIZ_TARGETS.simple),
    standard: questions.slice(0, QUIZ_TARGETS.standard),
    deeper: questions.slice(0, QUIZ_TARGETS.deeper),
  };
}

function buildQuizExplanation(
  chapter: PackageChapter,
  questionPrompt: string,
  correctAnswer: string,
  family: VariantFamily
): string {
  const summarySentence = splitSentences(getVariantContent(chapter, family, "standard")?.importantSummary)[0];
  if (summarySentence) {
    return `The best answer is \"${correctAnswer}\" because ${summarySentence.charAt(0).toLowerCase()}${summarySentence.slice(1)}`;
  }
  return `The best answer is \"${correctAnswer}\" because it matches the core idea behind ${questionPrompt.toLowerCase()}.`;
}

function estimatePages(bookPackage: BookPackage): number {
  const presentation = getBookPackagePresentation(bookPackage.book.bookId);
  if (presentation.pages) return presentation.pages;
  const totalMinutes = bookPackage.chapters.reduce(
    (sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1),
    0
  );
  return Math.max(120, Math.round(totalMinutes * 3.2));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNewFields(rawChapter: any, tone: ToneKey): Partial<BookChapter> {
  if (!rawChapter) return {};
  const fields: Partial<BookChapter> = {};

  // keyTakeawayCard
  if (rawChapter.keyTakeawayCard) {
    fields.keyTakeawayCard = resolveTone(rawChapter.keyTakeawayCard, tone);
  }

  // activationPrompt (from medium or hard variant)
  const medium = rawChapter.contentVariants?.medium;
  const hard = rawChapter.contentVariants?.hard;
  if (medium?.activationPrompt) {
    fields.activationPrompt = resolveTone(medium.activationPrompt, tone);
  }
  if (medium?.selfCheckPrompt) {
    fields.selfCheckPrompt = resolveTone(medium.selfCheckPrompt, tone);
  }
  if (hard?.selfCheckPrompts && Array.isArray(hard.selfCheckPrompts)) {
    fields.selfCheckPrompts = hard.selfCheckPrompts.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => resolveTone(p, tone)
    );
  }
  if (hard?.predictionPrompt) {
    fields.predictionPrompt = resolveTone(hard.predictionPrompt, tone);
  }

  // implementationPlan
  if (rawChapter.implementationPlan) {
    const ip = rawChapter.implementationPlan;
    fields.implementationPlan = {
      coreSkill: resolveTone(ip.coreSkill, tone),
      ifThenPlans: (ip.ifThenPlans ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => ({
          context: p.context ?? "",
          plan: resolveTone(p.plan, tone),
        })
      ),
      twentyFourHourChallenge: resolveTone(ip.twentyFourHourChallenge, tone),
      weeklyPractice: resolveTone(ip.weeklyPractice, tone),
    };
  }

  // reviewCards
  if (rawChapter.reviewCards && Array.isArray(rawChapter.reviewCards)) {
    fields.reviewCards = rawChapter.reviewCards.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (card: any, idx: number) => ({
        id: card.cardId ?? `rc-${idx + 1}`,
        front: resolveTone(card.front, tone),
        back: resolveTone(card.back, tone),
        difficulty: card.difficulty ?? "easy",
      })
    );
  }

  return fields;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildBundle(bookPackage: BookPackage, rawChapters?: any[], tone: ToneKey = "direct"): BookChapterBundle {
  const family = bookPackage.book.variantFamily;
  const strictV12 = isStrictV12ReaderPackage(bookPackage);
  const isV21 = isV21NormalizedPackage(bookPackage);
  const rawByNumber = new Map<number, unknown>();
  if (rawChapters) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const rc of rawChapters) rawByNumber.set(rc.number, rc);
  }

  const chapters = [...bookPackage.chapters]
    .sort((left, right) => left.number - right.number)
    .map((chapter) => {
      const quiz = dedupeQuestionsById(
        chapter.quiz.questions
          .map((question, index) =>
            normalizeQuizQuestion(
              chapter,
              family,
              question,
              `${chapter.chapterId}-q-${String(index + 1).padStart(2, "0")}`,
              tone,
              strictV12
            )
          )
          .filter((q): q is ChapterQuizQuestion => q !== null)
      );
      if (quiz.length === 0) {
        console.error(`Chapter "${chapter.chapterId}" has 0 valid quiz questions after filtering — quiz will be empty`);
      }
      const quizRetryPool = buildQuizRetryPool(chapter, family, tone, strictV12);

      const newFields: Partial<BookChapter> = strictV12
        ? {}
        : extractNewFields(rawByNumber.get(chapter.number), tone);
      const legacyRecap = strictV12 ? [] : buildRecap(chapter, family);
      const takeawaysByDepth: Record<ReadingDepth, string[]> = strictV12
        ? {
            simple: exactTakeaways(chapter, family, "simple"),
            standard: exactTakeaways(chapter, family, "standard"),
            deeper: exactTakeaways(chapter, family, "deeper"),
          }
        : {
            simple: buildTakeaways(chapter, family),
            standard: buildTakeaways(chapter, family),
            deeper: buildTakeaways(chapter, family),
          };
      const recapByDepth: Record<ReadingDepth, string[]> = strictV12
        ? {
            simple: exactRecap(chapter, family, "simple"),
            standard: exactRecap(chapter, family, "standard"),
            deeper: exactRecap(chapter, family, "deeper"),
          }
        : {
            simple: legacyRecap,
            standard: legacyRecap,
            deeper: legacyRecap,
          };
      const activationPromptByDepth: Partial<Record<ReadingDepth, string>> = strictV12
        ? {
            simple: exactActivationPrompt(chapter, family, "simple"),
            standard: exactActivationPrompt(chapter, family, "standard"),
            deeper: exactActivationPrompt(chapter, family, "deeper"),
          }
        : {
            standard: newFields.activationPrompt,
          };
      const selfCheckPromptsByDepth: Partial<Record<ReadingDepth, string[]>> = strictV12
        ? {
            simple: exactSelfCheckPrompts(chapter, family, "simple"),
            standard: exactSelfCheckPrompts(chapter, family, "standard"),
            deeper: exactSelfCheckPrompts(chapter, family, "deeper"),
          }
        : {
            standard: newFields.selfCheckPrompt ? [newFields.selfCheckPrompt] : undefined,
            deeper: newFields.selfCheckPrompts,
          };
      const predictionPromptByDepth: Partial<Record<ReadingDepth, string>> = strictV12
        ? {
            simple: exactPredictionPrompt(chapter, family, "simple"),
            standard: exactPredictionPrompt(chapter, family, "standard"),
            deeper: exactPredictionPrompt(chapter, family, "deeper"),
          }
        : {
            deeper: newFields.predictionPrompt,
          };
      const reflectionPromptsByDepth: Partial<Record<ReadingDepth, string[]>> = strictV12
        ? {
            simple: exactReflectionPrompts(chapter, family, "simple"),
            standard: exactReflectionPrompts(chapter, family, "standard"),
            deeper: exactReflectionPrompts(chapter, family, "deeper"),
          }
        : {};
      const closingPromptByDepth: Partial<Record<ReadingDepth, string>> = strictV12
        ? {
            simple: exactClosingPrompt(chapter, family, "simple"),
            standard: exactClosingPrompt(chapter, family, "standard"),
            deeper: exactClosingPrompt(chapter, family, "deeper"),
          }
        : {};
      const standardTakeaways = takeawaysByDepth.standard ?? [];
      const standardRecap = recapByDepth.standard ?? [];
      const standardSelfCheckPrompts = selfCheckPromptsByDepth.standard ?? [];
      const standardReflectionPrompts = reflectionPromptsByDepth.standard ?? [];
      const standardActivationPrompt = activationPromptByDepth.standard;
      const standardClosingPrompt = closingPromptByDepth.standard;
      const deeperPredictionPrompt = predictionPromptByDepth.deeper;

      return {
        bookId: bookPackage.book.bookId,
        id: chapter.chapterId,
        order: chapter.number,
        code: chapterCode(chapter.number),
        title: chapter.title,
        minutes: chapter.readingTimeMinutes,
        summaryByDepth: {
          simple: strictV12
            ? exactSummaryBlocks(chapter, family, "simple")
            : buildSummaryBlocks(chapter, family, "simple"),
          standard: strictV12
            ? exactSummaryBlocks(chapter, family, "standard")
            : buildSummaryBlocks(chapter, family, "standard"),
          deeper: strictV12
            ? exactSummaryBlocks(chapter, family, "deeper")
            : buildSummaryBlocks(chapter, family, "deeper"),
        },
        takeaways: standardTakeaways,
        takeawaysByDepth,
        recap: standardRecap.length > 0 ? standardRecap.join(" ") : undefined,
        recapByDepth,
        activationPrompt: standardActivationPrompt,
        activationPromptByDepth,
        selfCheckPrompt: standardSelfCheckPrompts[0],
        selfCheckPrompts: standardSelfCheckPrompts.length > 0 ? standardSelfCheckPrompts : undefined,
        selfCheckPromptsByDepth,
        reflectionPrompts: standardReflectionPrompts.length > 0 ? standardReflectionPrompts : undefined,
        reflectionPromptsByDepth,
        closingPrompt: standardClosingPrompt,
        closingPromptByDepth,
        predictionPrompt: deeperPredictionPrompt,
        predictionPromptByDepth,
        keyTakeawayCard: chapter.keyTakeawayCard ?? newFields.keyTakeawayCard,
        implementationPlan: chapter.implementationPlan ?? newFields.implementationPlan,
        reviewCards: chapter.reviewCards?.map((card) => ({
          id: card.cardId,
          front: card.front,
          back: card.back,
          difficulty: card.difficulty,
        })) ?? newFields.reviewCards,
        examplesDetailed: chapter.examples.map((example) => ({
          id: example.exampleId,
          title: example.title,
          scope: inferScope(example),
          scenario: strictV12
            ? cleanText(example.scenario)
            : normalizeScenarioPerspective(
                example.scenario,
                `${chapter.chapterId}:${example.exampleId}`
              ),
          whatToDo: strictV12
            ? dedupe(example.whatToDo).join(" ")
            : joinSteps(example.whatToDo),
          whyItMatters: cleanText(example.whyItMatters),
          reflectionPrompt: strictV12 ? example.reflectionPrompt : undefined,
        })),
        quiz,
        quizByDepth: buildQuizByDepth(quiz),
        quizRetryPool,
        quizPassingScorePercent: Math.max(
          50,
          Math.min(100, Math.round(chapter.quiz.passingScorePercent || 80))
        ),
        isStrictV12: strictV12,
        ...(isV21
          ? (() => {
              const extras = extractV21ChapterExtras(rawByNumber.get(chapter.number));
              return {
                schemaVersion: V21_SCHEMA_VERSION,
                hook: extras.hook,
                counterintuition: extras.counterintuition,
                tryThisNow: extras.tryThisNow,
                reflectionBefore: extras.reflectionBefore,
                reflectionAfter: extras.reflectionAfter,
                memorableLines: extras.memorableLines,
              };
            })()
          : {}),
      };
    });

  return {
    pages: estimatePages(bookPackage),
    chapters,
  };
}

type ToneBundleGetter = (tone: ToneKey) => BookPackage;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToneRawGetter = () => any[];

const TONE_BUNDLE_GETTERS: Record<string, { getPackage: ToneBundleGetter; getRaw: ToneRawGetter }> = {
  "the-power-of-habit": {
    getPackage: getThePowerOfHabitPackageForTone,
    getRaw: () => THE_POWER_OF_HABIT_RAW_CHAPTERS,
  },
  "make-time": {
    getPackage: getMakeTimePackageForTone,
    getRaw: () => MAKE_TIME_RAW_CHAPTERS,
  },
  "make-it-stick": {
    getPackage: getMakeItStickPackageForTone,
    getRaw: () => MAKE_IT_STICK_RAW_CHAPTERS,
  },
  "made-to-stick": {
    getPackage: getMadeToStickPackageForTone,
    getRaw: () => MADE_TO_STICK_RAW_CHAPTERS,
  },
  "crucial-conversations": {
    getPackage: getCrucialConversationsPackageForTone,
    getRaw: () => CRUCIAL_CONVERSATIONS_RAW_CHAPTERS,
  },
  "difficult-conversations": {
    getPackage: getDifficultConversationsPackageForTone,
    getRaw: () => DIFFICULT_CONVERSATIONS_RAW_CHAPTERS,
  },
  "what-every-body-is-saying": {
    getPackage: getWhatEveryBodyIsSayingPackageForTone,
    getRaw: () => WHAT_EVERY_BODY_IS_SAYING_RAW_CHAPTERS,
  },
  "the-prince": {
    getPackage: getThePrincePackageForTone,
    getRaw: () => THE_PRINCE_RAW_CHAPTERS,
  },
  "tiny-habits": {
    getPackage: getTinyHabitsPackageForTone,
    getRaw: () => TINY_HABITS_RAW_CHAPTERS,
  },
  essentialism: {
    getPackage: getEssentialismPackageForTone,
    getRaw: () => ESSENTIALISM_RAW_CHAPTERS,
  },
  "deep-work": {
    getPackage: getDeepWorkPackageForTone,
    getRaw: () => DEEP_WORK_RAW_CHAPTERS,
  },
  "so-good-they-cant-ignore-you": {
    getPackage: getSoGoodTheyCantIgnoreYouPackageForTone,
    getRaw: () => SO_GOOD_THEY_CANT_IGNORE_YOU_RAW_CHAPTERS,
  },
  "predictably-irrational": {
    getPackage: getPredictablyIrrationalPackageForTone,
    getRaw: () => PREDICTABLY_IRRATIONAL_RAW_CHAPTERS,
  },
  "thinking-in-bets": {
    getPackage: getThinkingInBetsPackageForTone,
    getRaw: () => THINKING_IN_BETS_RAW_CHAPTERS,
  },
  "the-almanack-of-naval-ravikant": {
    getPackage: getTheAlmanackOfNavalRavikantPackageForTone,
    getRaw: () => THE_ALMANACK_OF_NAVAL_RAVIKANT_RAW_CHAPTERS,
  },
  "the-laws-of-human-nature": {
    getPackage: getTheLawsOfHumanNaturePackageForTone,
    getRaw: () => THE_LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS,
  },
  "the-hard-thing-about-hard-things": {
    getPackage: getTheHardThingAboutHardThingsPackageForTone,
    getRaw: () => THE_HARD_THING_ABOUT_HARD_THINGS_RAW_CHAPTERS,
  },
  influence: {
    getPackage: getInfluencePackageForTone,
    getRaw: () => INFLUENCE_RAW_CHAPTERS,
  },
  "the-innovators-dilemma": {
    getPackage: getTheInnovatorsDilemmaPackageForTone,
    getRaw: () => THE_INNOVATORS_DILEMMA_RAW_CHAPTERS,
  },
  "built-to-last": {
    getPackage: getBuiltToLastPackageForTone,
    getRaw: () => BUILT_TO_LAST_RAW_CHAPTERS,
  },
  "competing-against-luck": {
    getPackage: getCompetingAgainstLuckPackageForTone,
    getRaw: () => COMPETING_AGAINST_LUCK_RAW_CHAPTERS,
  },
  "leaders-eat-last": {
    getPackage: getLeadersEatLastPackageForTone,
    getRaw: () => LEADERS_EAT_LAST_RAW_CHAPTERS,
  },
  limitless: {
    getPackage: getLimitlessPackageForTone,
    getRaw: () => LIMITLESS_RAW_CHAPTERS,
  },
  peak: {
    getPackage: getPeakPackageForTone,
    getRaw: () => PEAK_RAW_CHAPTERS,
  },
  "playing-to-win": {
    getPackage: getPlayingToWinPackageForTone,
    getRaw: () => PLAYING_TO_WIN_RAW_CHAPTERS,
  },
  "the-one-thing": {
    getPackage: getTheOneThingPackageForTone,
    getRaw: () => THE_ONE_THING_RAW_CHAPTERS,
  },
  "the-charisma-myth": {
    getPackage: getTheCharismaMythPackageForTone,
    getRaw: () => THE_CHARISMA_MYTH_RAW_CHAPTERS,
  },
  "the-like-switch": {
    getPackage: getTheLikeSwitchPackageForTone,
    getRaw: () => THE_LIKE_SWITCH_RAW_CHAPTERS,
  },
  "good-to-great": {
    getPackage: getGoodToGreatPackageForTone,
    getRaw: () => GOOD_TO_GREAT_RAW_CHAPTERS,
  },
  "how-to-talk-to-anyone": {
    getPackage: getHowToTalkToAnyonePackageForTone,
    getRaw: () => HOW_TO_TALK_TO_ANYONE_RAW_CHAPTERS,
  },
  "seven-powers": {
    getPackage: getSevenPowersPackageForTone,
    getRaw: () => SEVEN_POWERS_RAW_CHAPTERS,
  },
  "talk-like-ted": {
    getPackage: getTalkLikeTedPackageForTone,
    getRaw: () => TALK_LIKE_TED_RAW_CHAPTERS,
  },
  "never-split-the-difference": {
    getPackage: getNeverSplitTheDifferencePackageForTone,
    getRaw: () => NEVER_SPLIT_THE_DIFFERENCE_RAW_CHAPTERS,
  },
  "pre-suasion": {
    getPackage: getPreSuasionPackageForTone,
    getRaw: () => PRE_SUASION_RAW_CHAPTERS,
  },
  "super-thinking": {
    getPackage: getSuperThinkingPackageForTone,
    getRaw: () => SUPER_THINKING_RAW_CHAPTERS,
  },
  superforecasting: {
    getPackage: getSuperforecastingPackageForTone,
    getRaw: () => SUPERFORECASTING_RAW_CHAPTERS,
  },
  indistractable: {
    getPackage: getIndistractablePackageForTone,
    getRaw: () => INDISTRACTABLE_RAW_CHAPTERS,
  },
  "you-can't-hurt-me": {
    getPackage: getYouCantHurtMePackageForTone,
    getRaw: () => YOU_CANT_HURT_ME_RAW_CHAPTERS,
  },
  "extreme-ownership": {
    getPackage: getExtremeOwnershipPackageForTone,
    getRaw: () => EXTREME_OWNERSHIP_RAW_CHAPTERS,
  },
  "the-art-of-war": {
    getPackage: getTheArtOfWarPackageForTone,
    getRaw: () => THE_ART_OF_WAR_RAW_CHAPTERS,
  },
  "the-war-of-art": {
    getPackage: getTheWarOfArtPackageForTone,
    getRaw: () => THE_WAR_OF_ART_RAW_CHAPTERS,
  },
  "the-33-strategies-of-war": {
    getPackage: getThe33StrategiesOfWarPackageForTone,
    getRaw: () => THE_33_STRATEGIES_OF_WAR_RAW_CHAPTERS,
  },
  "atomic-habits": {
    getPackage: getAtomicHabitsPackageForTone,
    getRaw: () => ATOMIC_HABITS_RAW_CHAPTERS,
  },
  "the-great-mental-models-vol-1": {
    getPackage: getTheGreatMentalModelsVol1PackageForTone,
    getRaw: () => THE_GREAT_MENTAL_MODELS_VOL_1_RAW_CHAPTERS,
  },
  "the-black-swan": {
    getPackage: getTheBlackSwanPackageForTone,
    getRaw: () => THE_BLACK_SWAN_RAW_CHAPTERS,
  },
  "the-first-20-hours": {
    getPackage: getTheFirst20HoursPackageForTone,
    getRaw: () => THE_FIRST_20_HOURS_RAW_CHAPTERS,
  },
  "the-outsiders": {
    getPackage: getTheOutsidersPackageForTone,
    getRaw: () => THE_OUTSIDERS_RAW_CHAPTERS,
  },
  ultralearning: {
    getPackage: getUltralearningPackageForTone,
    getRaw: () => ULTRALEARNING_RAW_CHAPTERS,
  },
};

const TONE_AWARE_BOOK_IDS = new Set(Object.keys(TONE_BUNDLE_GETTERS));

const TONE_BUNDLE_CACHE_MAX = 20;
const toneBundleCache = new Map<string, BookChapterBundle>();

function buildToneAwareBundle(bookId: string, tone: ToneKey): BookChapterBundle {
  const cacheKey = `${bookId}::${tone}`;
  const cached = toneBundleCache.get(cacheKey);
  if (cached) {
    toneBundleCache.delete(cacheKey);
    toneBundleCache.set(cacheKey, cached);
    return cached;
  }

  const getter = TONE_BUNDLE_GETTERS[bookId];
  if (!getter) return EMPTY_BUNDLE;

  const pkg = getter.getPackage(tone);
  const raw = getter.getRaw();
  const bundle = buildBundle(pkg, raw, tone);

  if (toneBundleCache.size >= TONE_BUNDLE_CACHE_MAX) {
    const oldestKey = toneBundleCache.keys().next().value;
    if (oldestKey !== undefined) toneBundleCache.delete(oldestKey);
  }
  toneBundleCache.set(cacheKey, bundle);
  return bundle;
}

const CHAPTERS_BY_BOOK_ID: Record<string, BookChapterBundle> = Object.fromEntries(
  BOOK_PACKAGES.map((pkg) => [pkg.book.bookId, buildBundle(pkg)])
);

const EMPTY_BUNDLE: BookChapterBundle = {
  pages: 0,
  chapters: [],
};

export function getBookChaptersBundle(bookId: string, tone?: ToneKey): BookChapterBundle {
  if (tone && TONE_AWARE_BOOK_IDS.has(bookId)) {
    return buildToneAwareBundle(bookId, tone);
  }
  return CHAPTERS_BY_BOOK_ID[bookId] ?? EMPTY_BUNDLE;
}

export function getChapterById(
  bookId: string,
  chapterId: string,
  tone?: ToneKey
): BookChapter | undefined {
  return getBookChaptersBundle(bookId, tone).chapters.find(
    (chapter) => chapter.id === chapterId
  );
}

export function getChapterByOrder(
  bookId: string,
  order: number,
  tone?: ToneKey
): BookChapter | undefined {
  return getBookChaptersBundle(bookId, tone).chapters.find(
    (chapter) => chapter.order === order
  );
}

export { type ToneKey } from "@/app/book/data/bookPackages";

export function getBookPackageEdition(bookId: string): string | undefined {
  const bookPackage = getBookPackageById(bookId);
  if (!bookPackage) return undefined;
  const edition = bookPackage.book.edition;
  if (!edition) return undefined;
  if (typeof edition === "string") return edition;
  const year = typeof edition.publishedYear === "number" ? ` (${edition.publishedYear})` : "";
  return `${edition.name}${year}`;
}

function toneTail(
  style: ChapterMotivationStyle,
  role: "summary" | "bullet" | "action" | "meaning" | "quiz"
): string {
  if (style === "gentle") {
    if (role === "summary") return " Hold the point calmly and let the facts do their work.";
    if (role === "bullet") return " That usually keeps the situation clearer and easier to handle.";
    if (role === "action") return " Keep the move calm, clear, and proportionate.";
    if (role === "meaning") return " That helps prevent avoidable damage and unnecessary escalation.";
    return " It follows the principle without adding extra friction.";
  }

  if (style === "direct") {
    if (role === "summary") return " Do the comparison before you commit.";
    if (role === "bullet") return " That is the standard to hold.";
    if (role === "action") return " Do it plainly and do it early.";
    if (role === "meaning") return " That stops a small problem from turning into an expensive one.";
    return " It matches the principle and avoids the common mistake.";
  }

  if (role === "summary") return " Miss this and you hand away position before the contest starts.";
  if (role === "bullet") return " That is where disciplined people keep the edge.";
  if (role === "action") return " That is how you keep initiative instead of reacting late.";
  if (role === "meaning") return " That keeps weakness from turning into a real loss.";
  return " It protects position and creates leverage instead of giving it away.";
}

function appendTone(text: string, style: ChapterMotivationStyle, role: "summary" | "bullet" | "action" | "meaning" | "quiz"): string {
  const normalized = cleanText(text);
  if (!normalized) return normalized;
  if (style === "gentle") {
    if (role === "quiz") return normalized;
  }
  return `${normalized}${toneTail(style, role)}`;
}

function personalizeSummaryBlocks(
  chapter: BookChapter,
  blocks: ChapterSummaryBlock[],
  style: ChapterMotivationStyle
): ChapterSummaryBlock[] {
  return blocks.map((block) =>
    block.type === "paragraph"
      ? { ...block, text: appendTone(block.text, style, "summary") }
      : { ...block, detail: block.detail ? appendTone(block.detail, style, "bullet") : undefined }
  );
}

function personalizeQuestions(
  chapter: BookChapter,
  questions: ChapterQuizQuestion[],
  style: ChapterMotivationStyle
): ChapterQuizQuestion[] {
  return questions.map((question) => ({
    ...question,
    explanation: appendTone(question.explanation, style, "quiz"),
  }));
}

export function personalizeChapterForMotivation(
  chapter: BookChapter,
  style: ChapterMotivationStyle
): BookChapter {
  return {
    ...chapter,
    summaryByDepth: {
      simple: personalizeSummaryBlocks(chapter, chapter.summaryByDepth.simple, style),
      standard: personalizeSummaryBlocks(chapter, chapter.summaryByDepth.standard, style),
      deeper: personalizeSummaryBlocks(chapter, chapter.summaryByDepth.deeper, style),
    },
    recap: chapter.recap ? appendTone(chapter.recap, style, "action") : chapter.recap,
    examplesDetailed: chapter.examplesDetailed.map((example) => ({
      ...example,
      whatToDo: appendTone(example.whatToDo, style, "action"),
      whyItMatters: appendTone(example.whyItMatters, style, "meaning"),
    })),
    quiz: personalizeQuestions(chapter, chapter.quiz, style),
    quizByDepth: {
      simple: personalizeQuestions(chapter, chapter.quizByDepth.simple, style),
      standard: personalizeQuestions(chapter, chapter.quizByDepth.standard, style),
      deeper: personalizeQuestions(chapter, chapter.quizByDepth.deeper, style),
    },
    quizRetryPool: personalizeQuestions(chapter, chapter.quizRetryPool, style),
  };
}
