import { isStrictReaderSchema, resolveTone } from "@/app/book/data/book-package-core";
import type {
  BookPackage,
  PackageChapter,
  PackageExample,
  PackageQuizQuestion,
  PackageSummaryBlock,
  PackageVariantContent,
  ToneKey,
  VariantFamily,
  VariantKey,
} from "@/app/book/data/book-package-core";
import bookChapterMeta from "@/app/book/data/book-chapter-meta.json";
import {
  V21_SCHEMA_VERSION,
  extractV21ChapterExtras,
  isV21NormalizedPackage,
  normalizeV21Package,
  type V21ExperiencePlan,
  type V21MemorableLine,
} from "@/app/book/lib/v21-adapter";
import type {
  ChapterExample,
  ChapterQuizQuestion,
  ChapterSummaryBlock,
  ExampleScope,
  ImplementationPlanItem,
  ReadingDepth,
  ReviewCardItem,
} from "@/lib/reader-content-types";
export type {
  ChapterExample,
  ChapterQuizQuestion,
  ChapterSummaryBlock,
  ExampleScope,
  ImplementationPlanItem,
  ReadingDepth,
  ReviewCardItem,
  ScenarioDecisionOption,
} from "@/lib/reader-content-types";

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
  /** v21-only: the behavior-change layer (failureRecovery + transferPrompt),
   *  rendered at chapter end in the Practice phase. */
  experiencePlan?: V21ExperiencePlan;
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
  // Only reached via buildBookChapterFromRawV21 (the API content path), which
  // discards bundle.pages and returns just chapters[0]; the slim
  // getBookChaptersBundle serves the real page count from precomputed metadata.
  // So the former getBookPackagePresentation lookup (which pulled the heavy
  // book-package corpus into this module) is unnecessary — estimate from reading
  // time, which is all this discarded value would ever be.
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

export function buildBundle(
  bookPackage: BookPackage,
  rawChapters?: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  tone: ToneKey = "direct",
  options?: { suppressEmptyQuizWarning?: boolean },
): BookChapterBundle {
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
      if (quiz.length === 0 && !options?.suppressEmptyQuizWarning) {
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
                experiencePlan: extras.experiencePlan,
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

/**
 * Build a single reader `BookChapter` from a reconstructed raw-v21 chapter
 * object (the same shape `book-packages/*.v21.json` chapters have). This is the
 * shared seam the API-backed reader uses: the production content API response is
 * reconstructed into a raw-v21 chapter (see `chapter/[chapterId]/lib/chapterFromApi.ts`),
 * then run through the exact same `normalizeV21Package` → `buildBundle` pipeline
 * the local path uses, so the resulting `BookChapter` is identical by construction.
 */
export function buildBookChapterFromRawV21(
  rawChapter: Record<string, unknown>,
  book: {
    bookId: string;
    title?: string;
    author?: string;
    categories?: string[];
    tags?: string[];
  },
): BookChapter {
  const rawPackage = {
    schemaVersion: V21_SCHEMA_VERSION,
    packageId: "",
    createdAt: "",
    contentOwner: "",
    book: {
      bookId: book.bookId,
      title: book.title ?? "",
      author: book.author ?? "",
      categories: book.categories ?? [],
      tags: book.tags ?? [],
      variantFamily: "EMH",
    },
    chapters: [rawChapter],
  };
  const pkg = normalizeV21Package(rawPackage);
  // The API content path carries no quiz (quiz is fetched separately by
  // useQuizSession), so suppress the empty-quiz warning for this path.
  const bundle = buildBundle(pkg, [rawChapter], "direct", {
    suppressEmptyQuizWarning: true,
  });
  return bundle.chapters[0];
}

// ── Slim chapter metadata (replaces the former all-books corpus) ──────────────
//
// bookChapters used to eagerly build a full BookChapter bundle for ALL ~105 books
// from the statically-imported ~37.6 MB book-package corpus. That landed in BOTH
// the client bundle AND — via SSR of the reader — the OpenNext ServerFn, blowing
// Lambda's 250 MiB unzipped limit and breaking prod deploys. The reader's full
// chapter content already comes from the API (useChapterContent); only analytics /
// profile / badges / library-state need per-chapter data, and only these slim
// fields. So we read the precomputed slim metadata (a few hundred KB, generated by
// scripts/book/generate-chapter-meta.ts) instead, and nothing imports the heavy
// corpus at runtime anymore.

export type BookChapterMeta = {
  bookId: string;
  id: string;
  order: number;
  code: string;
  title: string;
  minutes: number;
};
type BookChapterMetaBundle = { chapters: BookChapterMeta[] };

const CHAPTER_META = bookChapterMeta as Record<string, BookChapterMetaBundle>;
const EMPTY_META_BUNDLE: BookChapterMetaBundle = { chapters: [] };

export function getBookChaptersBundle(
  bookId: string,
  _tone?: ToneKey,
): BookChapterMetaBundle {
  return CHAPTER_META[bookId] ?? EMPTY_META_BUNDLE;
}

export function getChapterById(
  _bookId: string,
  _chapterId: string,
  _tone?: ToneKey,
): BookChapter | undefined {
  // No local fallback chapter: the full corpus was removed to keep the ServerFn
  // under Lambda's 250 MiB limit. The reader fetches content from the API; on an
  // API failure it surfaces a retryable error (same as an empty/0-question result)
  // rather than serving a stale bundled copy.
  return undefined;
}

export function getChapterByOrder(
  _bookId: string,
  _order: number,
  _tone?: ToneKey,
): BookChapter | undefined {
  return undefined;
}

export { type ToneKey } from "@/app/book/data/book-package-core";
