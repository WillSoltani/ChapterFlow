import {
  BOOK_PACKAGES,
  getBookPackageById,
  getBookPackagePresentation,
  NSTD_RAW_CHAPTERS,
  resolveNstdTone,
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

const BLUE_OCEAN_STYLE_COPY: Record<
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
    actionLead: "Start with the clearest useful move for the buyer.",
    meaningTail:
      "That keeps the strategy grounded in real value instead of more noise.",
    quizLead:
      "The strongest answer widens demand and keeps the model workable.",
    recapLead:
      "Keep the curve clear and the next move useful.",
    summaryLead:
      "Stay close to the buyer problem and the real friction around it.",
    summaryWhy:
      "That is what turns blue ocean thinking from a slogan into a usable strategic move.",
  },
  direct: {
    actionLead:
      "Choose the move that changes value and removes waste cleanly.",
    meaningTail:
      "That keeps effort tied to market creation instead of crowded reaction.",
    quizLead:
      "The strongest answer creates buyer value, economic fit, and broader demand.",
    recapLead:
      "Keep the tradeoff clear and cut what the market no longer needs.",
    summaryLead:
      "Read where the market is crowded, where buyers are overpaying, and where demand is being left out.",
    summaryWhy:
      "That is how blue ocean strategy becomes a commercial discipline instead of an innovation mood.",
  },
  competitive: {
    actionLead:
      "Move where the curve opens space and rivals lose leverage.",
    meaningTail:
      "That is how you keep edge instead of fighting on crowded terms.",
    quizLead:
      "The strongest answer opens demand, removes waste, and protects the economic logic.",
    recapLead:
      "Use the next move to open cleaner space before the market crowds again.",
    summaryLead:
      "Read where the market is crowded and where cleaner value could still create edge.",
    summaryWhy:
      "Miss that and you spend effort inside a fight someone else already designed.",
  },
};

const ONE_THING_STYLE_COPY: Record<
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
    actionLead: "Take the clearest useful next step.",
    meaningTail:
      "That keeps focus steady without turning the rest of life into a fight.",
    quizLead:
      "The strongest answer protects what matters and keeps the choice usable.",
    recapLead: "Return to the next meaningful move with steady attention.",
    summaryLead:
      "Read the idea as permission to narrow kindly and protect what matters most.",
    summaryWhy:
      "The aim is not harsher pressure. It is clearer attention that makes life more workable.",
  },
  direct: {
    actionLead: "Choose the main move and do it first.",
    meaningTail:
      "That keeps the tradeoff visible and the execution honest.",
    quizLead:
      "The strongest answer follows leverage instead of convenience.",
    recapLead: "Name the priority clearly and act on it early.",
    summaryLead:
      "Name the priority, the tradeoff, and the next move without dressing any of it up.",
    summaryWhy:
      "That is what turns a good idea about focus into actual execution.",
  },
  competitive: {
    actionLead: "Take the move that protects leverage.",
    meaningTail:
      "That is how you stop waste from eating the result.",
    quizLead:
      "The strongest answer keeps the edge on the right thing.",
    recapLead: "Use the next move to press the advantage that matters.",
    summaryLead:
      "Use the chapter to see where leverage is being wasted and where real edge can be built.",
    summaryWhy:
      "That is how focus stops being a slogan and starts becoming a compounding advantage.",
  },
};

const TALK_LIKE_TED_STYLE_COPY: Record<
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
    actionLead: "Make the next move easy for the audience to follow.",
    meaningTail: "That usually makes the idea feel more human and easier to remember.",
    quizLead: "The strongest answer makes the idea clearer, warmer, and easier to carry.",
    recapLead: "Keep the message clear and human.",
    summaryLead: "Let the idea sound human before you try to sound impressive.",
    summaryWhy: "That makes the message easier to trust, remember, and use.",
  },
  direct: {
    actionLead: "Give the room the clearest next move.",
    meaningTail: "That keeps the message sharp and easier to act on.",
    quizLead: "The strongest answer protects clarity, relevance, and recall.",
    recapLead: "Cut to the clearest point and make it land.",
    summaryLead: "If the room cannot feel the point quickly, the talk is already losing force.",
    summaryWhy: "Clear speaking respects attention and makes the idea usable.",
  },
  competitive: {
    actionLead: "Use the next move to make the message harder to ignore.",
    meaningTail: "That is how strong speakers keep attention instead of handing it away.",
    quizLead:
      "The strongest answer makes the idea memorable enough to win the room twice, once now and once later.",
    recapLead: "Use clarity and memorability to keep the edge.",
    summaryLead: "In a room full of forgettable talks, memorable delivery is an advantage.",
    summaryWhy: "Waste attention here and a sharper speaker takes the room from you.",
  },
};

const ZERO_TO_ONE_STYLE_COPY: Record<
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
    actionLead: "Start with the clearest useful move.",
    meaningTail:
      "That keeps the idea practical without adding noise or false urgency.",
    quizLead:
      "The strongest answer keeps the signal clear and the judgment grounded.",
    recapLead: "Keep the point clear and build from what is actually differentiated.",
    summaryLead:
      "Read the claim calmly and keep asking what creates real value.",
    summaryWhy:
      "The goal is not only to sound original. It is to build from a clearer truth.",
  },
  direct: {
    actionLead: "Take the move that creates a real edge.",
    meaningTail:
      "That keeps the strategy tied to leverage instead of drift.",
    quizLead:
      "The strongest answer names the edge, the tradeoff, and the execution demand clearly.",
    recapLead: "Keep the edge clear and act on the real bottleneck.",
    summaryLead:
      "Call the advantage, the crowding, and the execution gap plainly.",
    summaryWhy:
      "That is what turns a clever idea into an actual company.",
  },
  competitive: {
    actionLead: "Move where it builds edge and avoids a crowded game.",
    meaningTail:
      "That is how you stop wasting upside on weak positioning.",
    quizLead:
      "The strongest answer protects leverage, avoids commodity traps, and acts before the edge is gone.",
    recapLead: "Use the lesson to build edge and avoid low value games.",
    summaryLead:
      "This book rewards sharper positioning, so watch where advantage is being created or quietly lost.",
    summaryWhy:
      "If you miss that, someone with better focus takes the upside first.",
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

const GOOD_STRATEGY_BAD_STRATEGY_STYLE_COPY: Record<
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
    actionLead: "Start by naming the real issue calmly and clearly.",
    meaningTail:
      "That keeps the response honest and easier to carry through without extra confusion.",
    quizLead:
      "The strongest answer identifies the real challenge and follows it with coherent action.",
    recapLead: "Keep the diagnosis plain and the next move steady.",
    summaryLead:
      "Stay with the actual challenge before adding language or extra activity around it.",
    summaryWhy:
      "That is usually what turns strategy into something useful instead of something merely impressive.",
  },
  direct: {
    actionLead: "State the challenge plainly and act on the real leverage.",
    meaningTail:
      "That keeps the plan disciplined and prevents weak logic from getting more expensive.",
    quizLead:
      "The strongest answer diagnoses the problem cleanly and chooses the action that fits it.",
    recapLead: "Name the constraint, choose the line, and move.",
    summaryLead:
      "Strip the situation down to the real obstacle before you add another response.",
    summaryWhy:
      "That is the standard that separates strategy from polished noise.",
  },
  competitive: {
    actionLead: "Call the problem early and press the point that can change the field.",
    meaningTail:
      "That is how you keep leverage instead of wasting force on the wrong target.",
    quizLead:
      "The strongest answer protects edge by reading the real problem and concentrating action there.",
    recapLead: "Keep the diagnosis sharp and the force concentrated.",
    summaryLead:
      "This is where people either find leverage or hand it away by chasing the wrong problem.",
    summaryWhy:
      "If you miss the real obstacle here, someone more disciplined keeps the edge you gave up.",
  },
};

const LEAN_STARTUP_STYLE_COPY: Record<
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
    actionLead: "Take the smallest clear step that will teach you something real.",
    meaningTail:
      "That usually protects energy while keeping the learning honest.",
    quizLead:
      "The strongest answer stays close to evidence and adjusts without drama.",
    recapLead:
      "Keep the next move light enough to learn from quickly.",
    summaryLead:
      "Treat uncertainty as something you can learn through, not something you have to hide.",
    summaryWhy:
      "The point is steady truthful progress, not pressure for its own sake.",
  },
  direct: {
    actionLead: "Run the clearest test and let the result shape the next move.",
    meaningTail:
      "That keeps the work tied to evidence instead of drift.",
    quizLead:
      "The strongest answer improves learning speed and decision quality.",
    recapLead:
      "Use the next step to expose what is true sooner.",
    summaryLead:
      "Name the assumption, test it, and stop rewarding motion that teaches nothing.",
    summaryWhy:
      "That is how uncertainty becomes manageable instead of expensive.",
  },
  competitive: {
    actionLead: "Take the move that teaches faster before slower teams catch up.",
    meaningTail:
      "That is how you keep waste from turning into lost advantage.",
    quizLead:
      "The strongest answer protects edge by learning faster than the alternatives.",
    recapLead:
      "Use the next step to cut waste and keep the learning lead.",
    summaryLead:
      "In uncertain markets, the team that learns faster usually takes the edge.",
    summaryWhy:
      "If you let vanity or delay slow the feedback loop, someone else gets the advantage.",
  },
};

const LAWS_OF_HUMAN_NATURE_STYLE_COPY: Record<
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
    actionLead: "Slow down, read the pattern, and take the kindest clear step that still protects your ground.",
    meaningTail:
      "That helps you stay honest about human nature without becoming needlessly hard.",
    quizLead: "The strongest answer reads the pattern clearly and responds with steady self command.",
    recapLead: "Keep the next interaction calm, observant, and grounded in the real pattern.",
    summaryLead: "Read people carefully, including yourself, and do not let the harder truths rush you into cynicism.",
    summaryWhy:
      "The point is clearer sight and steadier response, not suspicion for its own sake.",
  },
  direct: {
    actionLead: "Name the pattern, answer the real behavior, and stop wasting motion on the surface story.",
    meaningTail: "That keeps your judgment cleaner and the next move more useful.",
    quizLead: "The strongest answer reads motive, pattern, and consequence without blinking.",
    recapLead: "Keep the pattern clear and act on what is actually happening.",
    summaryLead: "Call the motive, the pattern, and the blind spot plainly before you decide what to do.",
    summaryWhy:
      "That is how Greene becomes usable judgment instead of just dark observation.",
  },
  competitive: {
    actionLead: "Read the pattern early and move before someone else's blind spot starts setting the terms.",
    meaningTail:
      "That is how you keep human nature from quietly costing you position, energy, or time.",
    quizLead: "The strongest answer spots the hidden pattern early and refuses to pay avoidable costs.",
    recapLead: "Use the reading to protect edge, avoid blind spots, and keep your footing.",
    summaryLead:
      "This is where sharper reading stops you from being outread, outmaneuvered, or quietly drained.",
    summaryWhy:
      "Miss the real human pattern here and someone more observant usually takes the advantage first.",
  },
};

const INFLUENCE_STYLE_COPY: Record<
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
    actionLead:
      "Slow down, notice the cue, and choose the response that still matches your values.",
    meaningTail:
      "That helps you stay open to people without giving your judgment away.",
    quizLead:
      "The strongest answer notices the persuasion cue and responds with clear, steady judgment.",
    recapLead:
      "Keep the next interaction clear, human, and aware of the real persuasion cue.",
    summaryLead:
      "Read the persuasion cue calmly before deciding what it deserves from you.",
    summaryWhy:
      "The goal is not suspicion. It is clearer judgment and more ethical influence.",
  },
  direct: {
    actionLead:
      "Name the cue, judge the request on its own merits, and answer from the real standard.",
    meaningTail:
      "That keeps the principle useful instead of letting it quietly make the decision for you.",
    quizLead:
      "The strongest answer spots the cue fast and compares it against the real decision.",
    recapLead: "Keep the cue clear and make the decision on purpose.",
    summaryLead:
      "Call the persuasion trigger plainly before it starts deciding for you.",
    summaryWhy:
      "That is how Cialdini becomes practical judgment instead of clever theory.",
  },
  competitive: {
    actionLead:
      "Spot the cue early and do not hand away a yes just because the trigger landed first.",
    meaningTail:
      "That is how you keep other people's influence from quietly costing you leverage.",
    quizLead:
      "The strongest answer catches the compliance trigger early and refuses to pay avoidable costs.",
    recapLead:
      "Use the cue to keep your footing and avoid giving away easy yes decisions.",
    summaryLead:
      "This is where sharper cue reading keeps you from being influenced before you even notice it.",
    summaryWhy:
      "Miss the trigger here and someone more alert controls the decision before you do.",
  },
};

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

const PITCH_ANYTHING_SUMMARY_GUIDES: Record<string, SummaryGuide> = {
  "ch01-pitch-method": {
    gentle: [
      "The goal is not to overwhelm the room with more detail. It is to keep attention open long enough for the value to land.",
      "Once you respect how attention works, preparation gets calmer and more effective.",
    ],
    direct: [
      "If you lose the room early, better evidence will not rescue the pitch.",
      "Design for how people actually process attention or expect resistance.",
    ],
    competitive: [
      "The room decides fast whether you are worth tracking, so weak openings burn leverage early.",
      "Whoever controls attention first usually controls the rest of the exchange.",
    ],
  },
  "ch02-frame-control": {
    gentle: [
      "Set the conversation up in a way that keeps both sides clear about why the meeting matters.",
      "A calm reset early often prevents a lot of unnecessary struggle later.",
    ],
    direct: [
      "If you accept the wrong setup, you spend the rest of the meeting digging out of it.",
      "Define the interaction early or live inside someone else's lens.",
    ],
    competitive: [
      "Weak framing hands the room your position before the real contest starts.",
      "Control the setup early if you want leverage later.",
    ],
  },
  "ch03-status-signals": {
    gentle: [
      "You do not need to sound bigger than everyone else. You need to sound steady enough that the idea can travel well.",
      "Small signals of self respect often change the whole room.",
    ],
    direct: [
      "Status drops fastest when you start chasing approval.",
      "Keep equal footing or the pitch starts sounding like a plea.",
    ],
    competitive: [
      "Once the room reads you as one down, every concession gets cheaper for them.",
      "Protecting status protects leverage.",
    ],
  },
  "ch04-big-idea-structure": {
    gentle: [
      "A clear structure makes it easier for people to stay with you instead of fighting to keep up.",
      "Good sequence is a kindness to the room as well as a strength for the speaker.",
    ],
    direct: [
      "If the big idea arrives late, the pitch is already working uphill.",
      "Structure decides whether the room follows or fragments.",
    ],
    competitive: [
      "Messy structure wastes hard won attention.",
      "A sharp hook point lets the room carry your edge after the meeting.",
    ],
  },
  "ch05-frame-stacking": {
    gentle: [
      "Different kinds of resistance call for different responses, so the skill is reading the room rather than forcing one move.",
      "A well timed frame shift can make the conversation easier for everyone to navigate.",
    ],
    direct: [
      "Not every objection deserves more analysis.",
      "Choose the frame that solves the real problem in the room.",
    ],
    competitive: [
      "If you keep answering inside their frame, you keep giving away ground.",
      "The right shift changes the contest instead of losing it more slowly.",
    ],
  },
  "ch06-neediness-destroys-power": {
    gentle: [
      "Calm standards help the other side take the offer seriously without turning the room hard.",
      "The less you cling to one outcome, the clearer you usually think.",
    ],
    direct: [
      "Neediness is expensive because the room can feel it before you say it.",
      "Standards and options beat performance every time.",
    ],
    competitive: [
      "The moment the room senses desperation, your leverage starts leaking.",
      "Protect scarcity or expect the other side to press harder.",
    ],
  },
  "ch07-airport-case": {
    gentle: [
      "A live deal is useful because it shows how real conversations keep moving and how calm adjustments keep them healthy.",
      "Seeing the flow makes the method easier to trust and easier to use.",
    ],
    direct: [
      "The lesson is in the transitions, not in one clever line.",
      "Read the whole meeting or you will miss where leverage was won or lost.",
    ],
    competitive: [
      "Real deals expose where edge is created and where it slips away.",
      "Study the full arc if you want to compete well under pressure.",
    ],
  },
  "ch08-enter-the-game": {
    gentle: [
      "Confidence grows when repetition makes the method feel more familiar and less threatening.",
      "Small consistent reps are enough to change how you carry bigger moments.",
    ],
    direct: [
      "Untested confidence breaks on contact.",
      "Repetition is what makes the method usable when the room pushes back.",
    ],
    competitive: [
      "If you want edge under pressure, you have to earn it through reps.",
      "Practice is where unstable confidence becomes hard to shake.",
    ],
  },
};

const PITCH_ANYTHING_STYLE_COPY: Record<
  ChapterMotivationStyle,
  {
    actionLead: string;
    meaningTail: string;
    quizLead: string;
    recapLead: string;
  }
> = {
  gentle: {
    actionLead: "Open calmly, keep the frame clear, and make the next move easy to follow.",
    meaningTail: "That helps the conversation stay open without giving away your position.",
    quizLead: "The strongest answer protects attention, keeps leverage steady, and avoids needless pressure.",
    recapLead: "Keep the next pitch calm, clear, and easy to follow.",
  },
  direct: {
    actionLead: "Set the frame, state the core idea, and do not chase the room.",
    meaningTail: "That keeps the pitch from slipping into weak explanation or weak terms.",
    quizLead: "The strongest answer holds frame, protects status, and moves the pitch forward.",
    recapLead: "Use the next pitch to control pace and protect leverage.",
  },
  competitive: {
    actionLead: "Take control of the opening and make the room work for the idea.",
    meaningTail: "That keeps weak signals from costing you leverage or momentum.",
    quizLead: "The strongest answer wins attention, protects status, and keeps the advantage.",
    recapLead: "Use the next pitch to hold attention and keep leverage on your side.",
  },
};

const LIKE_SWITCH_SUMMARY_GUIDES: Record<string, SummaryGuide> = {
  "ch01-friendship-formula": {
    gentle: [
      "Take your time with it. Good relationships usually grow best when nobody feels pushed.",
      "That calm view makes social life feel more workable and less mysterious.",
    ],
    direct: [
      "Use the four levers on purpose instead of guessing.",
      "If a bond is weak, identify the missing element and fix that element.",
    ],
    competitive: [
      "If you ignore the structure, you waste connection that could have been built.",
      "People who understand the levers build trust faster and lose fewer relationships through drift.",
    ],
  },
  "ch02-getting-noticed": {
    gentle: [
      "Warmth starts with looking safe, not impressive.",
      "A small softening of face and posture can change a room more than extra talk can.",
    ],
    direct: [
      "Lower threat first. Then let conversation do its job.",
      "If your signals are closed, the rest of your skill does not get a fair chance.",
    ],
    competitive: [
      "Miss the first scan and the chance is often gone before you speak.",
      "People who manage first contact well get more openings to work with.",
    ],
  },
  "ch03-golden-rule": {
    gentle: [
      "You do not need to perform. You need to notice.",
      "That is how people feel lighter around you instead of managed by you.",
    ],
    direct: [
      "Get your ego out of the way and keep the focus on them.",
      "People return to the person who leaves them feeling respected.",
    ],
    competitive: [
      "If every interaction is about you, you hand away likability for free.",
      "The people who master attention build trust faster than the people who keep selling themselves.",
    ],
  },
  "ch04-attraction-laws": {
    gentle: [
      "Look for real overlap and let it do the heavy lifting.",
      "A small remembered detail can make reconnecting feel easy and kind.",
    ],
    direct: [
      "Find the cleanest common ground and use it.",
      "Generic networking is weak because it gives the other person nothing solid to grab.",
    ],
    competitive: [
      "Connection is easier when you create a clean path back to yourself.",
      "People who remember and reenter well keep more momentum than people who start from zero every time.",
    ],
  },
  "ch05-conversation-balance": {
    gentle: [
      "Let the other person feel unrushed enough to think.",
      "That often does more good than having the perfect line ready.",
    ],
    direct: [
      "Listen hard enough to follow what matters.",
      "If you are busy performing, you are missing the very cues that build trust.",
    ],
    competitive: [
      "Most people lose ground by waiting to speak instead of actually listening.",
      "The better listener usually gets the better information and the stronger bond.",
    ],
  },
  "ch06-building-closeness": {
    gentle: [
      "Pace protects both people.",
      "A steady exchange of trust is kinder than a sudden emotional spill.",
    ],
    direct: [
      "Do not confuse fast openness with real trust.",
      "If the disclosure is too deep for the stage, slow it down.",
    ],
    competitive: [
      "Rushed intensity feels powerful and often backfires.",
      "The people who pace trust well build stronger bonds than the people who dump everything at once.",
    ],
  },
  "ch07-sustaining-relationships": {
    gentle: [
      "Quiet care counts more than people admit.",
      "A small reliable pattern can keep a good relationship alive through a hard season.",
    ],
    direct: [
      "Do not romanticize drift. Maintain the relationship or expect it to thin out.",
      "Repair gets harder when you wait for the distance to explain itself.",
    ],
    competitive: [
      "People lose valuable relationships through neglect all the time.",
      "The person who maintains the bridge keeps the edge when life gets crowded.",
    ],
  },
  "ch08-promise-and-risk": {
    gentle: [
      "Warmth works best when it is paired with self respect.",
      "You can be kind without handing away access or judgment.",
    ],
    direct: [
      "Separate charm from evidence.",
      "If the facts are shaky, slow down no matter how good the interaction feels.",
    ],
    competitive: [
      "Naivete is expensive.",
      "The real edge is being warm enough to connect and sharp enough not to get played.",
    ],
  },
};

const LIKE_SWITCH_STYLE_COPY: Record<
  ChapterMotivationStyle,
  { actionLead: string; meaningTail: string; quizLead: string; recapLead: string }
> = {
  gentle: {
    actionLead:
      "Take the calm move that makes the other person feel safe without overreaching.",
    meaningTail: "That helps trust grow without unnecessary strain.",
    quizLead:
      "The strongest answer lowers pressure, respects pace, and keeps the human reality in view.",
    recapLead: "Start with warmth, patience, and clear observation.",
  },
  direct: {
    actionLead:
      "Lower threat, focus on them, and pace the next move on purpose.",
    meaningTail:
      "That keeps the relationship clearer and the mistake smaller.",
    quizLead:
      "The strongest answer respects the principle and avoids the common social mistake.",
    recapLead: "Use the principle deliberately and keep the next move clean.",
  },
  competitive: {
    actionLead:
      "Take the move that builds trust without giving away judgment or momentum.",
    meaningTail: "That is where social edge comes from.",
    quizLead:
      "The strongest answer protects position, reads the cue correctly, and uses the chapter for real leverage.",
    recapLead: "Read the cue early and act before the opening closes.",
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

const ATOMIC_HABITS_STYLE_COPY: Record<
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
    actionLead: "Start with the smallest steady version you can trust.",
    meaningTail:
      "That helps the habit feel calm enough to repeat tomorrow too.",
    quizLead:
      "The strongest answer protects consistency and keeps the habit realistic.",
    recapLead: "Keep the next repetition light, clear, and easy to return to.",
    summaryLead:
      "Change tends to last when the next rep feels safe enough to keep.",
    summaryWhy:
      "That is how small actions stay alive long enough to compound.",
  },
  direct: {
    actionLead: "Make the cue clear and the first step easy to execute.",
    meaningTail:
      "That keeps the habit from depending on mood or memory.",
    quizLead:
      "The strongest answer lowers friction and protects repetition.",
    recapLead: "Reduce the setup, do the rep, and keep the pattern intact.",
    summaryLead:
      "Stop asking motivation to do work the system should already be doing.",
    summaryWhy:
      "Consistency is the standard because repetition is what compounds.",
  },
  competitive: {
    actionLead: "Protect the rep and strip out every easy excuse.",
    meaningTail:
      "That is how disciplined people keep compounding their edge.",
    quizLead:
      "The strongest answer protects repetition and refuses avoidable drift.",
    recapLead: "Keep the rep alive and let the edge keep compounding.",
    summaryLead:
      "Every avoidable miss gives away ground that steady systems would keep.",
    summaryWhy:
      "The advantage belongs to the person who repeats the right move first and longer.",
  },
};

const RIGHTEOUS_MIND_STYLE_COPY: Record<
  ChapterMotivationStyle,
  {
    summaryLead: string;
    summaryWhy: string;
    actionLead: string;
    meaningTail: string;
    quizLead: string;
    recapLead: string;
  }
> = {
  gentle: {
    summaryLead:
      "Stay curious about the first moral pull instead of treating it as the whole truth.",
    summaryWhy:
      "That calm curiosity makes disagreement easier to understand without pretending it is simple.",
    actionLead: "Lead with curiosity and steadiness.",
    meaningTail:
      "That usually keeps understanding open while still protecting what matters.",
    quizLead:
      "The strongest answer widens understanding without losing the point.",
    recapLead: "Begin with the most curious and grounded next step.",
  },
  direct: {
    summaryLead: "Name the intuition first. Then test it.",
    summaryWhy:
      "If you skip that step, you defend a reaction as if it were a conclusion.",
    actionLead: "Name the value conflict plainly and respond to it directly.",
    meaningTail:
      "That keeps the conversation tied to the real mechanism instead of the surface drama.",
    quizLead:
      "The strongest answer names the mechanism and applies it cleanly.",
    recapLead: "Use the next step that clarifies the real moral mechanism.",
  },
  competitive: {
    summaryLead:
      "If you cannot read the moral instinct driving the room, you give away influence to people who can.",
    summaryWhy:
      "The edge goes to the person who can translate values before the argument hardens.",
    actionLead: "Read the moral terrain fast and move with discipline.",
    meaningTail:
      "That is how you avoid getting outplayed by louder certainty.",
    quizLead:
      "The strongest answer keeps the edge by reading the values beneath the argument.",
    recapLead: "Take the next step that sharpens your read of the moral terrain.",
  },
};

type IndistractableSection =
  | "foundations"
  | "internal"
  | "traction"
  | "external"
  | "pacts"
  | "culture"
  | "relationships";

const INDISTRACTABLE_QUIZ_LEAD: Record<ChapterMotivationStyle, string> = {
  gentle:
    "The strongest answer protects attention with steadiness and self respect.",
  direct:
    "The strongest answer names the real source of drift and acts on it.",
  competitive:
    "The strongest answer protects the edge before drift takes more ground.",
};

const INDISTRACTABLE_SECTION_STYLE_COPY: Record<
  IndistractableSection,
  Record<
    ChapterMotivationStyle,
    {
      summaryLead: string;
      summaryWhy: string;
      actionLead: string;
      meaningTail: string;
      recapLead: string;
    }
  >
> = {
  foundations: {
    gentle: {
      summaryLead:
        "Approach the first diagnosis with patience. Clear seeing is already progress.",
      summaryWhy:
        "That calm honesty is what makes the rest of the method usable.",
      actionLead:
        "Take the next steady step that protects the time you meant to use.",
      meaningTail:
        "That keeps attention practice grounded in self honesty instead of self blame.",
      recapLead: "Protect one block you already know matters.",
    },
    direct: {
      summaryLead:
        "Call distraction what it is: a break between intent and action.",
      summaryWhy:
        "Protect attention early or drift will keep choosing for you.",
      actionLead:
        "Take the next move that clearly protects the time you meant to use.",
      meaningTail:
        "That keeps the method anchored in observable behavior, not vague hope.",
      recapLead: "Protect the next block before drift claims it.",
    },
    competitive: {
      summaryLead:
        "If you do not guard attention, easier pulls will keep stealing ground.",
      summaryWhy:
        "Compounding belongs to the person who protects the minutes first.",
      actionLead:
        "Take the next move that keeps easier pulls from taking more ground.",
      meaningTail:
        "That is how disciplined people stop leaking advantage one small escape at a time.",
      recapLead: "Lock down the next block before it gets taken.",
    },
  },
  internal: {
    gentle: {
      summaryLead:
        "Look underneath the urge before trying to overpower it.",
      summaryWhy:
        "The calmer you are with discomfort, the less power it has to steer you.",
      actionLead:
        "Pause, name the feeling, and stay with the real discomfort for a beat.",
      meaningTail:
        "That weakens the escape loop instead of feeding it.",
      recapLead: "Catch one urge earlier and name it plainly.",
    },
    direct: {
      summaryLead: "Name the feeling instead of obeying it.",
      summaryWhy:
        "If you do not face the discomfort, it will keep choosing the escape.",
      actionLead:
        "Pause and name the exact feeling before you move toward relief.",
      meaningTail:
        "That gives you a real chance to interrupt the pattern at its source.",
      recapLead: "Catch one urge early and call it what it is.",
    },
    competitive: {
      summaryLead:
        "Every time discomfort can redirect you on command, you are easy to pull off course.",
      summaryWhy:
        "People who can stay with the feeling keep the edge others keep giving away.",
      actionLead:
        "Hold the feeling for a beat and stop giving the escape automatic authority.",
      meaningTail:
        "That is how you stop handing control to every uncomfortable moment.",
      recapLead: "Hold one urge without obeying it.",
    },
  },
  traction: {
    gentle: {
      summaryLead:
        "Use the calendar as a way to care for what matters, not to punish yourself.",
      summaryWhy:
        "Planned time makes good intentions easier to keep.",
      actionLead:
        "Put the next important block on the calendar and protect it gently.",
      meaningTail:
        "That turns values into time you can actually keep.",
      recapLead: "Claim the next important block with care.",
    },
    direct: {
      summaryLead:
        "Put the value on the calendar or stop pretending it is protected.",
      summaryWhy:
        "Time that is not claimed gets spent by something else.",
      actionLead:
        "Put the next important block on the calendar and defend it.",
      meaningTail:
        "That turns intention into visible traction instead of wishful thinking.",
      recapLead: "Claim the next block before something else does.",
    },
    competitive: {
      summaryLead:
        "If you leave time undefined, the loudest demand will keep taking it from you.",
      summaryWhy:
        "Edge comes from deciding your time before other people do.",
      actionLead:
        "Claim the next important block and stop giving it away by default.",
      meaningTail:
        "That is how people with standards keep their best time from being raided.",
      recapLead: "Claim the next block before the noise takes it.",
    },
  },
  external: {
    gentle: {
      summaryLead:
        "Make the environment kinder to your attention.",
      summaryWhy:
        "Less cue pressure leaves more energy for what you chose.",
      actionLead:
        "Remove one repeating cue before the next session starts.",
      meaningTail:
        "That lowers the strain on attention without asking for constant inner battle.",
      recapLead: "Shut off one cue that keeps breaking your rhythm.",
    },
    direct: {
      summaryLead:
        "Cut the cue before the cue cuts into the work.",
      summaryWhy:
        "Fewer triggers mean fewer weak moments to recover from.",
      actionLead:
        "Remove one repeating cue before it gets another chance to interrupt.",
      meaningTail:
        "That reduces the number of fights your attention has to win.",
      recapLead: "Remove one trigger that keeps getting in.",
    },
    competitive: {
      summaryLead:
        "Stop giving every cue a chance to take your attention.",
      summaryWhy:
        "People who control the setup waste less time reclaiming it.",
      actionLead:
        "Kill one recurring trigger before it steals more of the session.",
      meaningTail:
        "That is how you stop paying the same attention tax again and again.",
      recapLead: "Kill one trigger before it steals more ground.",
    },
  },
  pacts: {
    gentle: {
      summaryLead:
        "Use commitments as support, not as punishment.",
      summaryWhy:
        "A clear pact can carry you when the hard moment arrives.",
      actionLead:
        "Set one clear pact where drift keeps repeating.",
      meaningTail:
        "That gives your future self a kinder and firmer structure to lean on.",
      recapLead: "Strengthen one recurring weak spot with a pact.",
    },
    direct: {
      summaryLead: "Precommit before the urge shows up.",
      summaryWhy:
        "Waiting until temptation is active is a weak strategy.",
      actionLead:
        "Set one clear pact where the same drift keeps repeating.",
      meaningTail:
        "That gives your future self less room to bargain away the plan.",
      recapLead: "Lock down one recurring weak spot now.",
    },
    competitive: {
      summaryLead:
        "Lock in the advantage before your future self starts bargaining.",
      summaryWhy:
        "Pacts keep easy excuses from stealing ground.",
      actionLead:
        "Set one pact that closes the weak spot before the next urge arrives.",
      meaningTail:
        "That is how you stop losing to the same predictable moment.",
      recapLead: "Close one recurring weak spot before it costs you again.",
    },
  },
  culture: {
    gentle: {
      summaryLead:
        "Treat recurring distraction as information about the system.",
      summaryWhy:
        "Honest culture makes focus easier for everyone, not just the strongest person.",
      actionLead:
        "Name the norm or process that keeps splitting attention.",
      meaningTail:
        "That turns focus from private strain into a shared design question.",
      recapLead: "Surface one system issue behind the distraction.",
    },
    direct: {
      summaryLead:
        "If everyone is drifting the same way, stop blaming only individuals.",
      summaryWhy:
        "Fix the norm or the process that keeps producing the problem.",
      actionLead:
        "Name the system condition that keeps pulling people off task.",
      meaningTail:
        "That puts the problem where the real leverage usually is.",
      recapLead: "Call out one system cause instead of one symptom.",
    },
    competitive: {
      summaryLead:
        "A culture that burns attention casually gives away performance.",
      summaryWhy:
        "Teams that protect focus outrun teams trapped in reactive work.",
      actionLead:
        "Identify the norm that keeps wasting attention and challenge it.",
      meaningTail:
        "That is how a team stops bleeding performance through constant fragmentation.",
      recapLead: "Expose one system habit that keeps burning attention.",
    },
  },
  relationships: {
    gentle: {
      summaryLead:
        "Protecting attention here is a form of care.",
      summaryWhy:
        "Presence is how people feel chosen.",
      actionLead:
        "Protect one shared moment before the usual interruption reaches it.",
      meaningTail:
        "That helps the relationship feel more deliberate and less accidental.",
      recapLead: "Defend one shared moment that matters this week.",
    },
    direct: {
      summaryLead:
        "If you want the relationship to feel stronger, stop letting drift have open access to it.",
      summaryWhy:
        "Connection rarely survives on leftover attention.",
      actionLead:
        "Protect one shared moment before the usual interruption gets in.",
      meaningTail:
        "That makes the relationship feel more intentional instead of constantly secondary.",
      recapLead: "Protect one shared moment before drift reaches it.",
    },
    competitive: {
      summaryLead:
        "The people closest to you should not keep losing to cheap interruptions.",
      summaryWhy:
        "Strong relationships are protected, not left exposed to constant drift.",
      actionLead:
        "Defend one shared moment before another cheap interruption takes it.",
      meaningTail:
        "That is how you stop letting low value noise outrank real connection.",
      recapLead: "Defend one shared moment before the noise wins again.",
    },
  },
};

function getIndistractableSection(order: number): IndistractableSection {
  if (order <= 2) return "foundations";
  if (order <= 8) return "internal";
  if (order <= 13) return "traction";
  if (order <= 21) return "external";
  if (order <= 25) return "pacts";
  if (order <= 28) return "culture";
  return "relationships";
}

function getIndistractableStyleCopy(
  chapter: BookChapter,
  style: ChapterMotivationStyle
) {
  const section = getIndistractableSection(chapter.order);
  const sectionCopy = INDISTRACTABLE_SECTION_STYLE_COPY[section][style];
  return {
    ...sectionCopy,
    quizLead: INDISTRACTABLE_QUIZ_LEAD[style],
  };
}

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

  if (chapter.bookId === "pitch-anything") {
    const guide = PITCH_ANYTHING_SUMMARY_GUIDES[chapter.id]?.[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = guide?.[paragraphIndex] ?? "";
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "the-like-switch") {
    const guide = LIKE_SWITCH_SUMMARY_GUIDES[chapter.id]?.[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = guide?.[paragraphIndex] ?? "";
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "atomic-habits") {
    const copy = ATOMIC_HABITS_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
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

  if (chapter.bookId === "blue-ocean-strategy") {
    const copy = BLUE_OCEAN_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "the-one-thing") {
    const copy = ONE_THING_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "the-righteous-mind") {
    const copy = RIGHTEOUS_MIND_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "talk-like-ted") {
    const copy = TALK_LIKE_TED_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "the-lean-startup") {
    const copy = LEAN_STARTUP_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "zero-to-one") {
    const copy = ZERO_TO_ONE_STYLE_COPY[style];
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

  if (chapter.bookId === "good-strategy-bad-strategy") {
    const copy = GOOD_STRATEGY_BAD_STRATEGY_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type === "paragraph") {
        const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
        paragraphIndex += 1;
        return { ...block, text: appendSentence(block.text, extra) };
      }
      return { ...block, detail: appendTone(block.detail, style, "bullet") };
    });
  }

  if (chapter.bookId === "laws-of-human-nature") {
    const copy = LAWS_OF_HUMAN_NATURE_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

  if (chapter.bookId === "influence") {
    const copy = INFLUENCE_STYLE_COPY[style];
    let paragraphIndex = 0;
    return blocks.map((block) => {
      if (block.type !== "paragraph") return block;
      const extra = paragraphIndex === 0 ? copy.summaryLead : copy.summaryWhy;
      paragraphIndex += 1;
      return { ...block, text: appendSentence(block.text, extra) };
    });
  }

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

  if (chapter.bookId === "indistractable") {
    const copy = getIndistractableStyleCopy(chapter, style);
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

  if (chapter.bookId === "good-strategy-bad-strategy") {
    const lead = GOOD_STRATEGY_BAD_STRATEGY_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "laws-of-human-nature") {
    const lead = LAWS_OF_HUMAN_NATURE_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "influence") {
    const lead = INFLUENCE_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "the-48-laws-of-power") {
    const lead = LAWS_OF_POWER_STYLE_COPY[style].quizLead;
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

  if (chapter.bookId === "blue-ocean-strategy") {
    const lead = BLUE_OCEAN_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "the-one-thing") {
    const lead = ONE_THING_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "talk-like-ted") {
    const lead = TALK_LIKE_TED_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "the-lean-startup") {
    const lead = LEAN_STARTUP_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "zero-to-one") {
    const lead = ZERO_TO_ONE_STYLE_COPY[style].quizLead;
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

  if (chapter.bookId === "the-righteous-mind") {
    const lead = RIGHTEOUS_MIND_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "pitch-anything") {
    const lead = PITCH_ANYTHING_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "the-like-switch") {
    const lead = LIKE_SWITCH_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "atomic-habits") {
    const lead = ATOMIC_HABITS_STYLE_COPY[style].quizLead;
    return questions.map((question) => ({
      ...question,
      explanation: appendSentence(lead, question.explanation),
    }));
  }

  if (chapter.bookId === "indistractable") {
    const lead = getIndistractableStyleCopy(chapter, style).quizLead;
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

  if (chapter.bookId === "laws-of-human-nature") {
    const copy = LAWS_OF_HUMAN_NATURE_STYLE_COPY[style];
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

  if (chapter.bookId === "influence") {
    const copy = INFLUENCE_STYLE_COPY[style];
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

  if (chapter.bookId === "talk-like-ted") {
    const copy = TALK_LIKE_TED_STYLE_COPY[style];
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

  if (chapter.bookId === "good-strategy-bad-strategy") {
    const copy = GOOD_STRATEGY_BAD_STRATEGY_STYLE_COPY[style];
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

  if (chapter.bookId === "blue-ocean-strategy") {
    const copy = BLUE_OCEAN_STYLE_COPY[style];
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

  if (chapter.bookId === "the-one-thing") {
    const copy = ONE_THING_STYLE_COPY[style];
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

  if (chapter.bookId === "zero-to-one") {
    const copy = ZERO_TO_ONE_STYLE_COPY[style];
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

  if (chapter.bookId === "the-lean-startup") {
    const copy = LEAN_STARTUP_STYLE_COPY[style];
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

  if (chapter.bookId === "the-righteous-mind") {
    const copy = RIGHTEOUS_MIND_STYLE_COPY[style];
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

  if (chapter.bookId === "pitch-anything") {
    const copy = PITCH_ANYTHING_STYLE_COPY[style];
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

  if (chapter.bookId === "the-like-switch") {
    const copy = LIKE_SWITCH_STYLE_COPY[style];
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

  if (chapter.bookId === "atomic-habits") {
    const copy = ATOMIC_HABITS_STYLE_COPY[style];
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

  if (chapter.bookId === "indistractable") {
    const copy = getIndistractableStyleCopy(chapter, style);
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

  /* ── Never Split the Difference: native tone-variant content ──── */
  if (chapter.bookId === "never-split-the-difference") {
    const rawCh = NSTD_RAW_CHAPTERS.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c.chapterId === chapter.id || c.number === chapter.order
    );
    if (rawCh) {
      const tone = style as "gentle" | "direct" | "competitive";
      const rebuildSummary = (depth: ReadingDepth): ChapterSummaryBlock[] => {
        const variantKey = depth === "simple" ? "easy" : depth === "standard" ? "medium" : "hard";
        const v = rawCh.contentVariants?.[variantKey];
        if (!v) return chapter.summaryByDepth[depth];
        const blocks: ChapterSummaryBlock[] = [];
        const breakdown = resolveNstdTone(v.chapterBreakdown, tone);
        if (breakdown) {
          breakdown.split(/\n\n+/).filter((s: string) => s.trim()).forEach((p: string, i: number) => {
            blocks.push({ id: `${depth}-p-${i + 1}`, type: "paragraph", text: cleanText(p.trim()) });
          });
        }
        const kts = Array.isArray(v.keyTakeaways) ? v.keyTakeaways : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kts.forEach((kt: any, i: number) => {
          const point = resolveNstdTone(kt?.point, tone);
          if (!point) return;
          const detail = kt?.moreDetails ? resolveNstdTone(kt.moreDetails, tone) : "";
          blocks.push({ id: `${depth}-b-${i + 1}`, type: "bullet", text: cleanText(point), detail: cleanText(detail) || "Apply this concept in your next conversation." });
        });
        return blocks;
      };
      return {
        ...chapter,
        summaryByDepth: {
          simple: rebuildSummary("simple"),
          standard: rebuildSummary("standard"),
          deeper: rebuildSummary("deeper"),
        },
        examplesDetailed: chapter.examplesDetailed.map((example, i) => {
          const rawEx = rawCh.examples?.[i];
          if (!rawEx) return example;
          return {
            ...example,
            scenario: normalizeScenarioPerspective(
              resolveNstdTone(rawEx.scenario, tone),
              `${chapter.id}:${example.id}`
            ),
            whatToDo: resolveNstdTone(rawEx.whatToDo, tone),
            whyItMatters: cleanText(resolveNstdTone(rawEx.whyItMatters, tone)),
          };
        }),
        quiz: chapter.quiz.map((q, i) => {
          const rawQ = rawCh.quiz?.questions?.[i];
          return rawQ ? { ...q, explanation: resolveNstdTone(rawQ.explanation, tone) } : q;
        }),
        quizByDepth: {
          simple: chapter.quizByDepth.simple.map((q, i) => {
            const rawQ = rawCh.quiz?.questions?.[i];
            return rawQ ? { ...q, explanation: resolveNstdTone(rawQ.explanation, tone) } : q;
          }),
          standard: chapter.quizByDepth.standard.map((q, i) => {
            const rawQ = rawCh.quiz?.questions?.[i];
            return rawQ ? { ...q, explanation: resolveNstdTone(rawQ.explanation, tone) } : q;
          }),
          deeper: chapter.quizByDepth.deeper.map((q, i) => {
            const rawQ = rawCh.quiz?.questions?.[i];
            return rawQ ? { ...q, explanation: resolveNstdTone(rawQ.explanation, tone) } : q;
          }),
        },
        quizRetryPool: personalizeQuestions(chapter, chapter.quizRetryPool, style),
      };
    }
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
