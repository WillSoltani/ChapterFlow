import {
  BOOK_PACKAGES,
  getBookPackageById,
  getBookPackagePresentation,
  type BookPackage,
  type PackageChapter,
  type PackageExample,
  type PackageQuizQuestion,
  type PackageSummaryBlock,
  type PackageVariantContent,
  type VariantFamily,
  type VariantKey,
} from "@/app/book/data/bookPackages";

export type ReadingDepth = "simple" | "standard" | "deeper";
export type ExampleScope = "work" | "school" | "personal";
export type ChapterMotivationStyle = "gentle" | "direct" | "competitive";

export type ChapterQuizQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
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

export type ChapterExample = {
  id: string;
  title: string;
  scope: ExampleScope;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
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
  simple: 8,
  standard: 12,
  deeper: 16,
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

function normalizeChoices(choices: string[]): [string, string, string, string] {
  const normalized = choices.slice(0, 4).map((choice) => cleanText(choice));
  while (normalized.length < 4) {
    normalized.push("Option unavailable");
  }
  return normalized as [string, string, string, string];
}

function rotateOptions(
  options: [string, string, string, string],
  by: number
): [string, string, string, string] {
  const shift = ((by % options.length) + options.length) % options.length;
  if (shift === 0) return options;
  return [
    options[(0 + shift) % options.length],
    options[(1 + shift) % options.length],
    options[(2 + shift) % options.length],
    options[(3 + shift) % options.length],
  ];
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
  const options = normalizeChoices(question.choices);
  const correctIndex = Math.max(
    0,
    Math.min(
      options.length - 1,
      question.correctIndex ?? question.correctAnswerIndex ?? 0
    )
  );
  const prompt = normalizeQuizPrompt(question.prompt);
  return {
    id: cleanText(question.questionId) || fallbackId,
    prompt,
    options,
    correctIndex,
    explanation:
      question.explanation?.trim() ||
      buildQuizExplanation(chapter, prompt, options[correctIndex], family),
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

function buildBundle(bookPackage: BookPackage): BookChapterBundle {
  const family = bookPackage.book.variantFamily;
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

const CHAPTERS_BY_BOOK_ID: Record<string, BookChapterBundle> = Object.fromEntries(
  BOOK_PACKAGES.map((pkg) => [pkg.book.bookId, buildBundle(pkg)])
);

const EMPTY_BUNDLE: BookChapterBundle = {
  pages: 0,
  chapters: [],
};

export function getBookChaptersBundle(bookId: string): BookChapterBundle {
  return CHAPTERS_BY_BOOK_ID[bookId] ?? EMPTY_BUNDLE;
}

export function getChapterById(
  bookId: string,
  chapterId: string
): BookChapter | undefined {
  return getBookChaptersBundle(bookId).chapters.find(
    (chapter) => chapter.id === chapterId
  );
}

export function getChapterByOrder(
  bookId: string,
  order: number
): BookChapter | undefined {
  return getBookChaptersBundle(bookId).chapters.find(
    (chapter) => chapter.order === order
  );
}

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

type SummaryGuide = Record<ChapterMotivationStyle, [string, string]>;

const ART_OF_WAR_SUMMARY_GUIDES: Record<string, SummaryGuide> = {
  "ch01-calculate-before-conflict": {
    gentle: [
      "Steady comparison keeps emotion from choosing the fight for you.",
      "That pause often protects both energy and trust.",
    ],
    direct: [
      "Do the comparison before you commit.",
      "If the terms are poor, do not enter on pride.",
    ],
    competitive: [
      "Skip this comparison and you give up edge before anything starts.",
      "Clear judgment lets you shape terms while others are still reacting.",
    ],
  },
  "ch02-count-the-cost-of-prolonged-conflict": {
    gentle: [
      "Counting cost early keeps one hard struggle from swallowing the rest of your strength.",
      "It helps you protect future capacity, not just the current dispute.",
    ],
    direct: [
      "Track the carrying cost while the conflict is still running.",
      "If continuation is draining more than the objective is worth, change course.",
    ],
    competitive: [
      "Long conflict is where strong positions quietly get wasted.",
      "If you ignore the cost curve, you can win late and still lose leverage.",
    ],
  },
  "ch03-win-with-strategy-instead-of-collision": {
    gentle: [
      "The chapter keeps strength tied to preservation rather than unnecessary damage.",
      "That usually creates results people can live with after the fight is over.",
    ],
    direct: [
      "Choose the path that gets the result without paying full collision cost.",
      "A win that ruins what you needed is a bad bargain.",
    ],
    competitive: [
      "The highest skill is changing the contest before force becomes expensive.",
      "Low cost wins leave you stronger for the next contest too.",
    ],
  },
  "ch04-build-a-secure-position-first": {
    gentle: [
      "Secure positioning lowers panic because you are not asking a fragile base to carry too much.",
      "That steadiness is what makes patience useful rather than fearful.",
    ],
    direct: [
      "First make defeat harder.",
      "Then use the opening when it is real instead of lunging from weakness.",
    ],
    competitive: [
      "A secure base keeps you in the contest while weaker setups break early.",
      "That is how disciplined people keep optionality and initiative.",
    ],
  },
  "ch05-turn-energy-into-leverage": {
    gentle: [
      "The chapter asks you to respect design as much as effort.",
      "When force is composed well, people do not have to waste themselves to matter.",
    ],
    direct: [
      "Hard work is not enough if timing and sequence are weak.",
      "Shape the release of effort or the effort stays expensive.",
    ],
    competitive: [
      "Leverage is how the same energy starts hitting above its size.",
      "If you cannot concentrate force, you keep spending without gaining edge.",
    ],
  },
  "ch06-attack-weakness-without-feeding-strength": {
    gentle: [
      "Selection keeps you from turning every conflict into a costly frontal push.",
      "A cleaner point of pressure often creates movement with far less damage.",
    ],
    direct: [
      "Stop feeding the other side's strongest ground.",
      "Put force where it changes the situation, not where it proves toughness.",
    ],
    competitive: [
      "Edge comes from hitting thin spots before they harden.",
      "Choose the ground well and you can win with less force than they expected.",
    ],
  },
  "ch07-move-with-cohesion-under-friction": {
    gentle: [
      "The chapter treats cohesion as something that must be protected while things are moving fast.",
      "That care keeps progress from turning into confusion inside your own side.",
    ],
    direct: [
      "Movement is only useful if signals, logistics, and morale stay intact.",
      "If motion is breaking the group, the move is too costly.",
    ],
    competitive: [
      "Fast motion means nothing if your own formation unravels first.",
      "Teams that keep cohesion under friction take advantage others cannot hold.",
    ],
  },
  "ch08-adapt-the-rules-to-conditions": {
    gentle: [
      "The deeper lesson is steady purpose with flexible method.",
      "That keeps you responsive without becoming erratic.",
    ],
    direct: [
      "Keep the principle and change the tactic when reality changes.",
      "Do not let habit make the decision for you.",
    ],
    competitive: [
      "Rigid winners are easier to read than adaptive ones.",
      "If you keep repeating the old move, you eventually hand the other side the answer key.",
    ],
  },
  "ch09-read-signals-on-the-ground": {
    gentle: [
      "Careful observation slows bad stories before they become decisions.",
      "That protects you from both denial and unnecessary alarm.",
    ],
    direct: [
      "Read the repeated signs, not just the official words.",
      "The evidence is often visible before anyone says it plainly.",
    ],
    competitive: [
      "Ignored signals are how avoidable surprises get you.",
      "If you read the field earlier, you move before others know what is happening.",
    ],
  },
  "ch10-know-the-terrain-you-are-in": {
    gentle: [
      "This chapter keeps judgment close to setting rather than blame.",
      "It reminds you that fit matters as much as intention.",
    ],
    direct: [
      "Judge the ground before you judge the move.",
      "A tactic can be fine in one setting and terrible in another.",
    ],
    competitive: [
      "The wrong terrain turns strength into waste fast.",
      "People who read the ground first keep advantages others cannot even use.",
    ],
  },
  "ch11-match-the-situation-before-choosing-tactics": {
    gentle: [
      "The chapter asks what the current position is doing to people before it asks for a tactic.",
      "That makes leadership more realistic and less reactive.",
    ],
    direct: [
      "Different situations require different pressure, pace, and framing.",
      "Use the move this position calls for, not the one you happen to like.",
    ],
    competitive: [
      "One favorite tactic across every situation is strategic laziness.",
      "Read the position well and you can turn pressure into disciplined effort.",
    ],
  },
  "ch12-use-pressure-with-restraint": {
    gentle: [
      "The chapter keeps powerful pressure under discipline instead of emotion.",
      "That helps you protect what still needs to survive the conflict.",
    ],
    direct: [
      "Do not escalate because the severe move feels satisfying.",
      "Escalate only when the conditions, purpose, and follow through are ready.",
    ],
    competitive: [
      "Power without control burns advantage as easily as it burns the target.",
      "The real edge is knowing when a strong tool is finally worth spending.",
    ],
  },
  "ch13-use-information-without-illusion": {
    gentle: [
      "The chapter treats reliable information as a form of care toward reality.",
      "It keeps uncertainty from being filled by fear, rumor, or invention.",
    ],
    direct: [
      "Get better information before you spend force on a guess.",
      "If the story is weak, the move built on it will usually be weak too.",
    ],
    competitive: [
      "Good intelligence is an edge because it cuts waste and improves timing.",
      "If you act on fantasy while the other side acts on reality, you are already behind.",
    ],
  },
};

const ART_OF_WAR_STYLE_COPY: Record<
  ChapterMotivationStyle,
  { actionLead: string; meaningTail: string; quizLead: string; recapLead: string }
> = {
  gentle: {
    actionLead: "Start with the most controlled next step.",
    meaningTail: "That keeps the response clear without creating extra damage.",
    quizLead: "The strongest answer keeps judgment steady and proportional.",
    recapLead: "Keep the next move calm and deliberate.",
  },
  direct: {
    actionLead: "Do the useful next step first.",
    meaningTail: "That keeps the problem from getting more expensive.",
    quizLead: "The strongest answer follows the principle cleanly and on time.",
    recapLead: "Use the next move to clarify the situation fast.",
  },
  competitive: {
    actionLead: "Take control of the setup early.",
    meaningTail: "That is how you keep leverage instead of handing it away.",
    quizLead: "The strongest answer protects position and uses leverage well.",
    recapLead: "Use the next move to keep initiative on your side.",
  },
};

const PRINCE_STYLE_COPY: Record<
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
    actionLead: "Start with the steadiest useful move.",
    meaningTail: "That keeps the situation readable without making it harsher than it has to be.",
    quizLead: "The strongest answer reads incentives calmly and chooses the soundest line.",
    recapLead: "Keep your reading of the situation calm and exact.",
    summaryLead: "Read the structure first and do not let the harder parts of the argument rush you.",
    summaryWhy:
      "The aim is not to become colder. It is to stay clear enough to act without illusion.",
  },
  direct: {
    actionLead: "Take the move that secures the position cleanly.",
    meaningTail: "That keeps the cost visible and the line of control intact.",
    quizLead: "The strongest answer names the tradeoff clearly and protects the position.",
    recapLead: "Keep the tradeoff clear and act on the real leverage.",
    summaryLead: "Name the incentive, the pressure, and the risk without dressing any of it up.",
    summaryWhy:
      "That is what turns Machiavelli's realism into usable judgment instead of empty severity.",
  },
  competitive: {
    actionLead: "Move where it preserves leverage and denies easy openings.",
    meaningTail: "That is how you stop the situation from paying someone else instead of you.",
    quizLead: "The strongest answer protects leverage, reads weakness early, and acts before it gets expensive.",
    recapLead: "Use the reading to protect edge and close avoidable openings.",
    summaryLead: "This is where sharper reading creates or wastes edge, so do not misread the field.",
    summaryWhy:
      "If you miss the real pressure point here, someone better prepared will use that gap first.",
  },
};

const STRATEGIES_OF_WAR_STYLE_COPY: Record<
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
    actionLead: "Take the next step with control, not tension.",
    meaningTail:
      "That keeps the pressure useful without making the contest larger than it has to be.",
    quizLead: "The strongest answer keeps the strategy clear and the pressure disciplined.",
    recapLead: "Keep the field readable and the next move controlled.",
    summaryLead: "Read the contest calmly before spending force or attention.",
    summaryWhy:
      "That keeps the lesson sharp without turning every conflict into needless escalation.",
  },
  direct: {
    actionLead: "Take the move that improves position cleanly.",
    meaningTail: "That keeps effort tied to leverage instead of noise.",
    quizLead: "The strongest answer protects position, timing, and leverage.",
    recapLead: "Name the contest and use force where it actually counts.",
    summaryLead: "Call the contest clearly and strip away any weak theatrics around it.",
    summaryWhy:
      "That is how strategic pressure becomes useful instead of merely intense.",
  },
  competitive: {
    actionLead: "Use the next move to keep edge and deny easy counters.",
    meaningTail:
      "That is how you protect leverage and stop the field from resetting against you.",
    quizLead:
      "The strongest answer keeps initiative, preserves leverage, and spends force well.",
    recapLead: "Use the next move to keep initiative and punish wasted motion.",
    summaryLead:
      "This is a leverage chapter, so read where edge is gained or quietly thrown away.",
    summaryWhy:
      "If you misread the field here, someone more disciplined will usually take the advantage first.",
  },
};

const EXTREME_OWNERSHIP_SUMMARY_GUIDES: Record<string, SummaryGuide> = {
  "ch01-own-the-result": {
    gentle: [
      "Taking ownership is not self-blame. It is the clearest path toward change.",
      "Each time you ask what you could have done differently, you build a habit that compounds over time.",
    ],
    direct: [
      "Own it and move. The sooner you identify your part, the sooner you can fix it.",
      "Leaders who own outcomes find the leverage point. Leaders who blame others lose it.",
    ],
    competitive: [
      "The leaders who outlast everyone else own failures others would have deflected.",
      "Blame feels protective in the short term and costs you position in the long term.",
    ],
  },
  "ch02-leaders-shape-teams": {
    gentle: [
      "Looking at your leadership before blaming your team is one of the most honest things a leader can do.",
      "When you raise the standard and your team rises with it, that is the clearest proof the problem was never the people.",
    ],
    direct: [
      "Before diagnosing your team, diagnose your own standards and example.",
      "Fix the leadership problem first. Team performance follows.",
    ],
    competitive: [
      "Average leaders blame talent. The best leaders ask what they are tolerating.",
      "Your team's ceiling is set by your standards. If you want it higher, raise yours first.",
    ],
  },
  "ch03-believe-the-mission": {
    gentle: [
      "If you have doubts, raising them is an act of leadership, not disloyalty.",
      "Genuine conviction is worth finding. It makes everything you lead more effective.",
    ],
    direct: [
      "If you do not believe it, say so and get an answer. Then commit fully or make the case for change.",
      "Half-hearted execution is a tax on everyone around you.",
    ],
    competitive: [
      "Leaders who have genuine conviction outperform leaders who are only going through the motions.",
      "Doubt you never resolved silently erodes the execution quality of everything you lead.",
    ],
  },
  "ch04-ego-clouds-judgment": {
    gentle: [
      "Catching ego early is a form of self-respect, not self-criticism.",
      "The leader who can set ego aside creates space for honest conversation and better decisions.",
    ],
    direct: [
      "When feedback triggers defensiveness, pause and ask whether your ego is doing the evaluation.",
      "Mission before image. That is the standard.",
    ],
    competitive: [
      "Ego costs you information quality, which costs you decisions, which costs you results.",
      "The leaders with the best judgment are the ones who keep ego out of the information-gathering process.",
    ],
  },
  "ch05-support-each-other": {
    gentle: [
      "Supporting others when they need it is often what makes it possible for them to support you when you need it.",
      "The strongest teams are not made of the most talented individuals. They are made of people who genuinely cover each other.",
    ],
    direct: [
      "Check whether you are covering your teammates or only executing your own tasks.",
      "If your unit is succeeding while adjacent units struggle, the mission is still at risk.",
    ],
    competitive: [
      "Isolated excellence is always less powerful than coordinated strength.",
      "The team that covers each other takes ground that individual talent alone cannot reach.",
    ],
  },
  "ch06-simple-wins": {
    gentle: [
      "Simple plans feel less impressive, but they are what makes confident execution possible.",
      "When you clarify the core intent and remove what is not essential, you give your team the best chance to succeed.",
    ],
    direct: [
      "Complexity in your plan is often clarity you have not yet done the work to achieve.",
      "Brief the plan and cut everything that adds confusion. Then execute.",
    ],
    competitive: [
      "Complex plans protect the planner's reputation. Simple plans protect the mission.",
      "The team operating on a clear simple plan moves faster and adapts better than the team with a sophisticated one they only half understand.",
    ],
  },
  "ch07-prioritize-fast": {
    gentle: [
      "The ability to triage under pressure develops through practice, and it starts with taking one breath before reacting.",
      "Solving problems in the right order is a skill that protects your energy and your team.",
    ],
    direct: [
      "Relax, look around, and make the call. Pick the highest-priority problem and solve it first.",
      "Do not try to solve everything at once. Sequence matters as much as effort.",
    ],
    competitive: [
      "Leaders who triage well are consistently ahead. Leaders who fragment their attention are consistently behind.",
      "The person who can stay calm and prioritize under pressure wins where others stall.",
    ],
  },
  "ch08-decentralize-command": {
    gentle: [
      "Trusting others to lead their piece of the work is one of the most important investments a leader can make.",
      "When you give your team the intent and the standards, you give them what they need to succeed independently.",
    ],
    direct: [
      "You cannot be everywhere. Give your team the intent, set the standards, and let them lead.",
      "Micromanagement limits the organization to what one person can directly control. That ceiling is always lower than it should be.",
    ],
    competitive: [
      "Organizations where only the top leader thinks are inherently slower and weaker.",
      "The leaders who build teams that can operate and decide independently multiply their own effectiveness many times over.",
    ],
  },
  "ch09-plan-for-reality": {
    gentle: [
      "Taking time to plan is a form of care for your team. It means they will be less confused when things get hard.",
      "The plan will change. But the shared understanding you build while planning will carry you through.",
    ],
    direct: [
      "Define the mission, address the most likely and most dangerous scenarios, and brief it simply.",
      "If you cannot brief the plan clearly, the plan is probably not clear enough to execute.",
    ],
    competitive: [
      "Unprepared teams react. Prepared teams adapt. The difference is whether someone did the planning work.",
      "Teams that have planned together are faster under pressure because they share a mental model others are still building.",
    ],
  },
  "ch10-lead-up-and-down": {
    gentle: [
      "Managing upward is part of taking care of your team. Your boss needs information to support you.",
      "Raising a concern to your boss is not weakness. It is how good leaders keep small problems from becoming large ones.",
    ],
    direct: [
      "Lead in both directions. Do not wait for permission to surface problems or advocate for your team.",
      "A leader who only leads down is working at half effectiveness.",
    ],
    competitive: [
      "Leaders who manage only downward are always at the mercy of what their boss decides without full information.",
      "The most effective leaders run active influence both up and down. They never leave their team's success to chance.",
    ],
  },
  "ch11-decide-with-incomplete-information": {
    gentle: [
      "Making a decision with available information, and remaining open to revising it, is stronger than waiting in place.",
      "The discomfort of uncertainty is real, but it is usually smaller than the cost of not deciding.",
    ],
    direct: [
      "Gather what you need, make the call, and set up a way to adjust if the assumptions are wrong.",
      "Waiting for certainty is not caution. It is often avoidance. The window does not stay open.",
    ],
    competitive: [
      "Leaders who decide well under uncertainty consistently stay ahead of leaders who wait.",
      "Whoever decides first in uncertain conditions usually shapes the terms. Delay gives that advantage away.",
    ],
  },
  "ch12-discipline-creates-freedom": {
    gentle: [
      "Structure in key areas does not restrict your life. It creates the space that makes real choice possible.",
      "Small consistent disciplines build the margin that lets you handle what you cannot predict.",
    ],
    direct: [
      "Build the routines that eliminate unnecessary decisions. Use the energy saved for what actually matters.",
      "The most disciplined people are not the most restricted. They are the most capable of choosing how they spend their attention.",
    ],
    competitive: [
      "The undisciplined person spends energy managing the consequences of their own chaos. The disciplined person uses that energy to compete.",
      "Discipline is a compounding advantage. Each system in place reduces the tax that disorder places on everything else.",
    ],
  },
};

const EXTREME_OWNERSHIP_STYLE_COPY: Record<
  ChapterMotivationStyle,
  { actionLead: string; meaningTail: string; quizLead: string; recapLead: string }
> = {
  gentle: {
    actionLead: "Take the steady, clear next step.",
    meaningTail: "That keeps progress moving without adding unnecessary weight.",
    quizLead: "The strongest answer follows the principle honestly and practically.",
    recapLead: "Begin with the most grounded step you can take.",
  },
  direct: {
    actionLead: "Take the direct next move.",
    meaningTail: "That is the standard, and it keeps problems from compounding.",
    quizLead: "The strongest answer follows the principle cleanly and early.",
    recapLead: "Act on the most important next thing now.",
  },
  competitive: {
    actionLead: "Move first and take initiative.",
    meaningTail: "That is how you stay ahead instead of catching up.",
    quizLead: "The strongest answer protects position and shows real understanding.",
    recapLead: "Use the next move to keep the edge.",
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
  if (chapter.bookId === "art-of-war") {
    const guide = ART_OF_WAR_SUMMARY_GUIDES[chapter.id]?.[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = guide?.[paragraphIndex] ?? "";
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "extreme-ownership") {
    const guide = EXTREME_OWNERSHIP_SUMMARY_GUIDES[chapter.id]?.[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = guide?.[paragraphIndex] ?? "";
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "the-prince") {
    const copy = PRINCE_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "33-strategies-of-war") {
    const copy = STRATEGIES_OF_WAR_STYLE_COPY[style];
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
  if (chapter.bookId === "33-strategies-of-war") {
    const lead = STRATEGIES_OF_WAR_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "the-prince") {
    const lead = PRINCE_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "art-of-war") {
    const lead = ART_OF_WAR_STYLE_COPY[style].quizLead;
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
  if (chapter.bookId === "33-strategies-of-war") {
    const copy = STRATEGIES_OF_WAR_STYLE_COPY[style];
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

  if (chapter.bookId === "the-prince") {
    const copy = PRINCE_STYLE_COPY[style];
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

  if (chapter.bookId === "art-of-war") {
    const copy = ART_OF_WAR_STYLE_COPY[style];
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

  if (chapter.bookId === "extreme-ownership") {
    const copy = EXTREME_OWNERSHIP_STYLE_COPY[style];
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
