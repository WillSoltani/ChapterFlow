import {
  BOOK_PACKAGES,
  getBookPackageById,
  getBookPackagePresentation,
  getLawsOfPowerPackageForTone,
  LAWS_OF_POWER_RAW_CHAPTERS,
  getFriendsAndInfluencePackageForTone,
  FRIENDS_AND_INFLUENCE_RAW_CHAPTERS,
  getAtomicHabitsPackageForTone,
  ATOMIC_HABITS_RAW_CHAPTERS,
  getLawsOfHumanNaturePackageForTone,
  LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS,
  getArtOfWarPackageForTone,
  ART_OF_WAR_RAW_CHAPTERS,
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
      detail: string;
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
  keyQuote?: string;
  recap?: string;
  activationPrompt?: string;
  selfCheckPrompt?: string;
  selfCheckPrompts?: string[];
  predictionPrompt?: string;
  keyTakeawayCard?: string;
  implementationPlan?: ImplementationPlanItem;
  reviewCards?: ReviewCardItem[];
  examplesDetailed: ChapterExample[];
  quiz: ChapterQuizQuestion[];
  quizByDepth: Record<ReadingDepth, ChapterQuizQuestion[]>;
  quizRetryPool: ChapterQuizQuestion[];
  quizPassingScorePercent: number;
};

type BookChapterBundle = {
  pages: number;
  chapters: BookChapter[];
};

const DEPTH_TARGETS: Record<ReadingDepth, number> = {
  simple: 9,
  standard: 12,
  deeper: 17,
};

const QUIZ_TARGETS: Record<ReadingDepth, number> = {
  simple: 5,
  standard: 7,
  deeper: 10,
};

const RETRY_POOL_TARGET = 5;
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

function variantPractice(variant: PackageVariantContent | undefined): string[] {
  if (!variant) return [];
  return dedupe(variant.practice ?? []);
}

function variantSummaryBullets(variant: PackageVariantContent | undefined): string[] {
  if (!variant) return [];
  return Array.isArray(variant.summaryBullets) && variant.summaryBullets.length
    ? dedupe(variant.summaryBullets)
    : splitSentences(variant.importantSummary);
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

function buildSummaryBullets(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): string[] {
  const primary = getVariantContent(chapter, family, depth);
  if (!primary) return [];

  const standard = getVariantContent(chapter, family, "standard");
  const simple = getVariantContent(chapter, family, "simple");
  const exampleInsights = chapter.examples.map((example) => {
    const scenario = cleanText(example.scenario);
    const whyItMatters = cleanText(example.whyItMatters);
    return `${cleanText(example.title)}: ${scenario} ${whyItMatters}`;
  });

  const base = dedupe([
    ...variantSummaryBullets(primary),
    ...variantTakeaways(primary),
    ...variantPractice(primary).map((item) => `Practice: ${item}`),
  ]);

  const supplements =
    depth === "simple"
      ? dedupe([...exampleInsights.slice(0, 2), ...variantTakeaways(simple)])
      : depth === "standard"
        ? dedupe([
            ...exampleInsights.slice(0, 3),
            ...variantSummaryBullets(simple),
            ...variantTakeaways(simple),
          ])
        : dedupe([
            ...exampleInsights,
            ...variantSummaryBullets(standard),
            ...variantTakeaways(standard),
            ...variantPractice(standard).map((item) => `Apply it: ${item}`),
          ]);

  return dedupe([...base, ...supplements]).slice(0, DEPTH_TARGETS[depth]);
}

function buildSummaryBlocks(
  chapter: PackageChapter,
  family: VariantFamily,
  depth: ReadingDepth
): ChapterSummaryBlock[] {
  const primary = getVariantContent(chapter, family, depth);
  const canonicalBullets = buildSummaryBullets(chapter, family, depth);
  const explicitBlocks = variantSummaryBlocks(primary);
  const explicitParagraphCount = explicitBlocks.filter((block) => block.type === "paragraph").length;
  const explicitBulletCount = explicitBlocks.filter((block) => block.type === "bullet").length;
  const detailPool = dedupe([
    ...chapter.examples.map((example) =>
      `${cleanText(example.title)}: ${cleanText(example.whyItMatters)}`
    ),
    ...variantPractice(primary).map((practice) => `Try this next: ${ensureSentence(practice)}`),
    ...variantTakeaways(primary).map(
      (takeaway) => `${takeaway} reinforces the chapter's core pattern through repetition.`
    ),
  ]);
  const fallbackDetail =
    splitSentences(primary?.importantSummary)[0] ??
    "Use the example and takeaway to test this idea in your own context.";

  const bulletTarget = depth === "simple" ? 7 : depth === "standard" ? 10 : 15;
  const minBulletsRequired = Math.min(bulletTarget, 10);
  if (explicitParagraphCount >= 2 && explicitBulletCount >= minBulletsRequired) {
    let paragraphIndex = 0;
    let bulletIndex = 0;
    const preserved: ChapterSummaryBlock[] = [];
    explicitBlocks.forEach((block) => {
      if (block.type === "paragraph") {
        if (paragraphIndex >= 2) return;
        paragraphIndex += 1;
        preserved.push({
          id: `${depth}-p-${paragraphIndex}`,
          type: "paragraph",
          text: cleanText(block.text),
        });
        return;
      }
      if (bulletIndex >= bulletTarget) return;
      bulletIndex += 1;
      preserved.push({
        id: `${depth}-b-${bulletIndex}`,
        type: "bullet",
        text: cleanText(block.text),
        detail: cleanText(block.detail || fallbackDetail),
      });
    });
    return preserved;
  }

  let paragraphCount = 0;
  const blocks: ChapterSummaryBlock[] = [];

  const pushParagraph = (text: string) => {
    const normalized = cleanText(text);
    if (!normalized) return;
    paragraphCount += 1;
    blocks.push({
      id: `${depth}-p-${paragraphCount}`,
      type: "paragraph",
      text: normalized,
    });
  };

  const pushBullet = (text: string, detail?: string) => {
    const normalized = cleanText(text);
    if (!normalized) return;
    const bulletCount = blocks.filter((block) => block.type === "bullet").length + 1;
    blocks.push({
      id: `${depth}-b-${bulletCount}`,
      type: "bullet",
      text: normalized,
      detail: cleanText(detail || fallbackDetail),
    });
  };

  for (const block of explicitBlocks) {
    if (block.type === "paragraph") {
      pushParagraph(block.text);
      continue;
    }
    pushBullet(block.text, block.detail);
  }

  const importantSummarySentences = splitSentences(primary?.importantSummary);
  if (!paragraphCount && importantSummarySentences.length > 0) {
    pushParagraph(importantSummarySentences.slice(0, 2).join(" "));
  }

  if (!paragraphCount && canonicalBullets.length > 0) {
    pushParagraph(canonicalBullets[0]);
  }

  const usedBulletTexts = new Set(
    blocks
      .filter((block): block is Extract<ChapterSummaryBlock, { type: "bullet" }> => block.type === "bullet")
      .map((block) => block.text)
  );
  const bulletsToAdd = canonicalBullets.filter((bullet) => !usedBulletTexts.has(bullet));
  bulletsToAdd.forEach((bullet, index) => {
    const detail =
      detailPool[index % Math.max(detailPool.length, 1)] || fallbackDetail;
    pushBullet(bullet, detail);
  });

  return blocks.slice(0, DEPTH_TARGETS[depth]);
}

function buildTakeaways(chapter: PackageChapter, family: VariantFamily): string[] {
  const preferred = getVariantContent(chapter, family, "standard");
  const fallback = getVariantContent(chapter, family, "simple");
  return dedupe([
    ...variantTakeaways(preferred),
    ...variantTakeaways(fallback),
  ]).slice(0, 6);
}

function buildKeyQuote(chapter: PackageChapter, family: VariantFamily): string | undefined {
  const preferred = getVariantContent(chapter, family, "deeper");
  const fallback = getVariantContent(chapter, family, "standard");
  const firstSentence = splitSentences(preferred?.importantSummary)[0] ?? splitSentences(fallback?.importantSummary)[0];
  return firstSentence || undefined;
}

function buildRecap(chapter: PackageChapter, family: VariantFamily): string | undefined {
  const preferred = getVariantContent(chapter, family, "deeper");
  const fallback = getVariantContent(chapter, family, "standard");
  const practice = variantPractice(preferred);
  const extra = variantPractice(fallback);
  const items = dedupe([...practice, ...extra]).slice(0, 2);
  if (!items.length) return undefined;
  return `Try this next: ${items.join(" Then ")}.`;
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
  const normalized = choices.slice(0, 5).map((choice) => cleanText(choice));
  if (normalized.length < 2) {
    while (normalized.length < 2) normalized.push("Option unavailable");
  }
  return normalized;
}

function rotateOptions(
  options: string[],
  by: number
): string[] {
  const len = options.length;
  if (len === 0) return options;
  const shift = ((by % len) + len) % len;
  if (shift === 0) return options;
  return options.map((_, i) => options[(i + shift) % len]);
}

function formatPromptStem(prompt: string): string {
  return cleanText(prompt)
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/[?!.]+$/g, "")
    .replace(/\b(in|from|of)\s+the reading\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase();
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
  fallbackId: string
): ChapterQuizQuestion {
  const rawChoices = question.choices ?? question.options ?? [];
  const options = normalizeChoices(rawChoices);
  const correctIndex = Math.max(
    0,
    Math.min(
      options.length - 1,
      question.correctIndex ?? question.correctAnswerIndex ?? 0
    )
  );
  const rawPrompt = question.prompt ?? question.stem ?? "";
  const prompt = normalizeQuizPrompt(rawPrompt);
  return {
    id: question.questionId ? cleanText(question.questionId) : fallbackId,
    prompt,
    options,
    correctIndex,
    explanation:
      typeof question.explanation === "string"
        ? question.explanation.trim() ||
          buildQuizExplanation(chapter, prompt, options[correctIndex], family)
        : question.explanation && typeof question.explanation === "object"
          ? (Object.values(question.explanation)[0] ?? "").trim() ||
            buildQuizExplanation(chapter, prompt, options[correctIndex], family)
          : buildQuizExplanation(chapter, prompt, options[correctIndex], family),
  };
}

function buildGeneratedRetryQuestion(
  source: ChapterQuizQuestion,
  chapter: PackageChapter,
  chapterIndex: number
): ChapterQuizQuestion {
  const stem = formatPromptStem(source.prompt) || chapter.title.toLowerCase();
  const promptTemplates = [
    `Which option best applies ${stem} to a realistic decision?`,
    `Which answer captures the core logic behind ${stem}?`,
    `Which choice reflects a high quality interpretation of ${stem}?`,
    `Which option stays most consistent with the central lesson in ${stem}?`,
    `Which answer would most likely produce better follow through based on ${stem}?`,
  ] as const;
  const prompt = promptTemplates[chapterIndex % promptTemplates.length];
  const baseOptions: [string, string, string, string] = [
    source.options[source.correctIndex],
    ...source.options.filter((_, idx) => idx !== source.correctIndex).slice(0, 3),
  ] as [string, string, string, string];
  const rotatedOptions = rotateOptions(baseOptions, (chapter.number + chapterIndex) % 4);
  const correctValue = source.options[source.correctIndex];
  const rotatedCorrectIndex = rotatedOptions.findIndex((option) => option === correctValue);
  const correctIndex = rotatedCorrectIndex >= 0 ? rotatedCorrectIndex : 0;
  return {
    id: `${source.id}-retry-${String(chapterIndex + 1).padStart(2, "0")}`,
    prompt: normalizeQuizPrompt(prompt),
    options: rotatedOptions,
    correctIndex,
    explanation: source.explanation,
  };
}

function buildQuizRetryPool(
  chapter: PackageChapter,
  family: VariantFamily,
  baseQuestions: ChapterQuizQuestion[]
): ChapterQuizQuestion[] {
  const authored = (chapter.quiz.retryQuestions ?? []).map((question, index) =>
    normalizeQuizQuestion(
      chapter,
      family,
      question,
      `${chapter.chapterId}-retry-authored-${String(index + 1).padStart(2, "0")}`
    )
  );
  const generated = baseQuestions.map((question, index) =>
    buildGeneratedRetryQuestion(question, chapter, index)
  );
  const merged = dedupeQuestionsById([...authored, ...generated]);
  return merged.slice(0, RETRY_POOL_TARGET);
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
  const rawByNumber = new Map<number, unknown>();
  if (rawChapters) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const rc of rawChapters) rawByNumber.set(rc.number, rc);
  }

  const chapters = [...bookPackage.chapters]
    .sort((left, right) => left.number - right.number)
    .map((chapter) => {
      const quiz = dedupeQuestionsById(
        chapter.quiz.questions.map((question, index) =>
          normalizeQuizQuestion(
            chapter,
            family,
            question,
            `${chapter.chapterId}-q-${String(index + 1).padStart(2, "0")}`
          )
        )
      );
      const quizRetryPool = buildQuizRetryPool(chapter, family, quiz);

      const newFields = extractNewFields(rawByNumber.get(chapter.number), tone);

      return {
        bookId: bookPackage.book.bookId,
        id: chapter.chapterId,
        order: chapter.number,
        code: chapterCode(chapter.number),
        title: chapter.title,
        minutes: chapter.readingTimeMinutes,
        summaryByDepth: {
          simple: buildSummaryBlocks(chapter, family, "simple"),
          standard: buildSummaryBlocks(chapter, family, "standard"),
          deeper: buildSummaryBlocks(chapter, family, "deeper"),
        },
        takeaways: buildTakeaways(chapter, family),
        keyQuote: buildKeyQuote(chapter, family),
        recap: buildRecap(chapter, family),
        ...newFields,
        examplesDetailed: chapter.examples.map((example) => ({
          id: example.exampleId,
          title: example.title,
          scope: inferScope(example),
          scenario: normalizeScenarioPerspective(
            example.scenario,
            `${chapter.chapterId}:${example.exampleId}`
          ),
          whatToDo: joinSteps(example.whatToDo),
          whyItMatters: cleanText(example.whyItMatters),
        })),
        quiz,
        quizByDepth: buildQuizByDepth(quiz),
        quizRetryPool,
        quizPassingScorePercent: Math.max(
          50,
          Math.min(100, Math.round(chapter.quiz.passingScorePercent || 80))
        ),
      };
    });

  return {
    pages: estimatePages(bookPackage),
    chapters,
  };
}

/** Book IDs that support tone-aware content variants */
const TONE_AWARE_BOOK_IDS = new Set([
  "the-48-laws-of-power",
  "friends-and-influence",
  "atomic-habits",
  "laws-of-human-nature",
  "the-art-of-war",
]);

type ToneBundleGetter = (tone: ToneKey) => BookPackage;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToneRawGetter = () => any[];

const TONE_BUNDLE_GETTERS: Record<string, { getPackage: ToneBundleGetter; getRaw: ToneRawGetter }> = {
  "the-48-laws-of-power": {
    getPackage: getLawsOfPowerPackageForTone,
    getRaw: () => LAWS_OF_POWER_RAW_CHAPTERS,
  },
  "friends-and-influence": {
    getPackage: getFriendsAndInfluencePackageForTone,
    getRaw: () => FRIENDS_AND_INFLUENCE_RAW_CHAPTERS,
  },
  "atomic-habits": {
    getPackage: getAtomicHabitsPackageForTone,
    getRaw: () => ATOMIC_HABITS_RAW_CHAPTERS,
  },
  "laws-of-human-nature": {
    getPackage: getLawsOfHumanNaturePackageForTone,
    getRaw: () => LAWS_OF_HUMAN_NATURE_RAW_CHAPTERS,
  },
  "the-art-of-war": {
    getPackage: getArtOfWarPackageForTone,
    getRaw: () => ART_OF_WAR_RAW_CHAPTERS,
  },
};

const toneBundleCache = new Map<string, BookChapterBundle>();

function buildToneAwareBundle(bookId: string, tone: ToneKey): BookChapterBundle {
  const cacheKey = `${bookId}::${tone}`;
  const cached = toneBundleCache.get(cacheKey);
  if (cached) return cached;

  const getter = TONE_BUNDLE_GETTERS[bookId];
  if (!getter) return EMPTY_BUNDLE;

  const pkg = getter.getPackage(tone);
  const raw = getter.getRaw();
  const bundle = buildBundle(pkg, raw, tone);
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

const LAWS_OF_POWER_STYLE_COPY: Record<
  ChapterMotivationStyle,
  {
    actionLead: string;
    meaningTail: string;
    quizLead: string;
    recapLead: string;
    summaryLead: string;
    summaryWhy: string;
  }
> = {
  gentle: {
    actionLead: "Take the next step calmly and keep the social field readable.",
    meaningTail:
      "That helps you use the law with judgment instead of turning the moment harsher than it needs to be.",
    quizLead: "The strongest answer protects position without needless display or wasted tension.",
    recapLead: "Keep the next move calm, measured, and aware of the real power dynamic.",
    summaryLead: "Read the hierarchy, the incentive, and the pressure before you make your move visible.",
    summaryWhy:
      "The aim is not needless manipulation. It is steadier judgment inside live power dynamics.",
  },
  direct: {
    actionLead: "Take the clean move that protects position and keeps leverage intact.",
    meaningTail:
      "That keeps the law practical instead of emotional, sloppy, or overplayed.",
    quizLead: "The strongest answer follows the law cleanly and protects leverage on time.",
    recapLead: "Use the next move to protect position before the field hardens against you.",
    summaryLead: "Name the hierarchy, the incentive, and the real risk before you act.",
    summaryWhy:
      "That is how Greene's realism becomes usable judgment instead of theatrical severity.",
  },
  competitive: {
    actionLead: "Move where it keeps edge, protects status, and denies easy openings.",
    meaningTail:
      "That is how you stop a naive move from quietly donating leverage to someone else.",
    quizLead: "The strongest answer protects status, timing, and leverage instead of giving any of them away.",
    recapLead: "Use the next move to keep edge and close avoidable openings.",
    summaryLead:
      "This book punishes naive display, so read the field before you step into it.",
    summaryWhy:
      "Miss the real power dynamic here and someone more disciplined usually takes the advantage first.",
  },
};

function appendSentence(base: string, extra: string): string {
  const normalizedBase = cleanText(base);
  const normalizedExtra = cleanText(extra);
  if (!normalizedBase) return normalizedExtra;
  if (!normalizedExtra) return normalizedBase;
  if (normalizedBase.includes(normalizedExtra)) return normalizedBase;
  return `${normalizedBase} ${normalizedExtra}`;
}

function personalizeSummaryBlocks(
  chapter: BookChapter,
  blocks: ChapterSummaryBlock[],
  style: ChapterMotivationStyle
): ChapterSummaryBlock[] {
  if (chapter.bookId === "the-48-laws-of-power") {
    const copy = LAWS_OF_POWER_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  return blocks.map((block) =>
    block.type === "paragraph"
      ? { ...block, text: appendTone(block.text, style, "summary") }
      : { ...block, detail: appendTone(block.detail, style, "bullet") }
  );
}

function personalizeQuestions(
  chapter: BookChapter,
  questions: ChapterQuizQuestion[],
  style: ChapterMotivationStyle
): ChapterQuizQuestion[] {
  if (chapter.bookId === "the-48-laws-of-power") {
    const lead = LAWS_OF_POWER_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  return questions.map((question) => ({
    ...question,
    explanation: appendTone(question.explanation, style, "quiz"),
  }));
}

export function personalizeChapterForMotivation(
  chapter: BookChapter,
  style: ChapterMotivationStyle
): BookChapter {
  if (chapter.bookId === "the-48-laws-of-power") {
    const copy = LAWS_OF_POWER_STYLE_COPY[style];
    return {
      ...chapter,
      summaryByDepth: {
        simple: personalizeSummaryBlocks(chapter, chapter.summaryByDepth.simple, style),
        standard: personalizeSummaryBlocks(chapter, chapter.summaryByDepth.standard, style),
        deeper: personalizeSummaryBlocks(chapter, chapter.summaryByDepth.deeper, style),
      },
      recap: chapter.recap ? appendSentence(copy.recapLead, chapter.recap) : chapter.recap,
      examplesDetailed: chapter.examplesDetailed.map((example) => ({
        ...example,
        whatToDo: appendSentence(copy.actionLead, example.whatToDo),
        whyItMatters: appendSentence(example.whyItMatters, copy.meaningTail),
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
