import { BookApiError } from "./errors";
import type {
  BookPackage,
  BookPackageBook,
  BookPackageChapter,
  BookPackageExample,
  BookPackageQuizQuestion,
  ToneKeyed,
  VariantFamily,
  VariantKey,
} from "./types";

type ValidationIssue = {
  path: string;
  message: string;
};

const ROOT_KEYS = new Set([
  "schemaVersion",
  "packageId",
  "createdAt",
  "contentOwner",
  "licenseNotes",
  "book",
  "chapters",
]);

const BOOK_KEYS = new Set([
  "bookId",
  "title",
  "author",
  "categories",
  "tags",
  "cover",
  "edition",
  "variantFamily",
  "chapters",
]);

const COVER_KEYS = new Set(["emoji", "color"]);
const EDITION_KEYS = new Set(["name", "publishedYear"]);
const CHAPTER_KEYS = new Set([
  "chapterId",
  "number",
  "title",
  "readingTimeMinutes",
  "contentVariants",
  "examples",
  "quiz",
  "implementationPlan",
  "reviewCards",
  "keyTakeawayCard",
  "takeaways",
]);
const EXAMPLE_KEYS = new Set(["exampleId", "title", "scenario", "whatToDo", "whyItMatters", "contexts", "category", "format", "endingType"]);
const QUIZ_KEYS = new Set(["passingScorePercent", "questions", "retryQuestions"]);
const QUESTION_KEYS = new Set([
  "questionId",
  "prompt",
  "choices",
  "correctAnswerIndex",
  "correctIndex",
  "explanation",
  "bloomsLevel",
  "depthLevel",
]);
const VARIANT_CONTENT_KEYS = new Set([
  "summaryBlocks",
  "summaryBullets",
  "importantSummary",
  "takeaways",
  "keyTakeaways",
  "practice",
  "chapterBreakdown",
  "oneMinuteRecap",
  "activationPrompt",
  "selfCheckPrompt",
  "selfCheckPrompts",
  "predictionPrompt",
]);
const EMH_VARIANTS: VariantKey[] = ["easy", "medium", "hard"];
const PBC_VARIANTS: VariantKey[] = ["precise", "balanced", "challenging"];

function hasOnlyKeys(obj: Record<string, unknown>, allowed: Set<string>, path: string, issues: ValidationIssue[]) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      issues.push({ path: `${path}.${key}`, message: "Unexpected field." });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  opts?: { min?: number; max?: number; optional?: boolean }
): string {
  if (value == null && opts?.optional) return "";
  if (typeof value !== "string") {
    issues.push({ path, message: "Must be a string." });
    return "";
  }
  const trimmed = value.trim();
  const min = opts?.min ?? 1;
  const max = opts?.max ?? 4000;
  if (trimmed.length < min) issues.push({ path, message: `Must be at least ${min} chars.` });
  if (trimmed.length > max) issues.push({ path, message: `Must be at most ${max} chars.` });
  return trimmed;
}

function readInteger(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  opts?: { min?: number; max?: number }
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value) {
    issues.push({ path, message: "Must be an integer." });
    return 0;
  }
  const min = opts?.min ?? Number.MIN_SAFE_INTEGER;
  const max = opts?.max ?? Number.MAX_SAFE_INTEGER;
  if (value < min || value > max) {
    issues.push({ path, message: `Must be between ${min} and ${max}.` });
  }
  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  opts?: { minItems?: number; maxItems?: number; itemMax?: number; optional?: boolean }
): string[] {
  if (value == null && opts?.optional) return [];
  if (!Array.isArray(value)) {
    issues.push({ path, message: "Must be an array." });
    return [];
  }
  const minItems = opts?.minItems ?? 1;
  const maxItems = opts?.maxItems ?? 200;
  if (value.length < minItems) issues.push({ path, message: `Must contain at least ${minItems} items.` });
  if (value.length > maxItems) issues.push({ path, message: `Must contain at most ${maxItems} items.` });

  const out: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = readString(value[i], `${path}[${i}]`, issues, {
      min: 1,
      max: opts?.itemMax ?? 1000,
    });
    if (item) out.push(item);
  }
  return out;
}

function parseSummaryBlocks(
  value: unknown,
  path: string,
  issues: ValidationIssue[]
): Array<{ type: "paragraph"; text: string } | { type: "bullet"; text: string; detail?: string }> {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    issues.push({ path, message: "summaryBlocks must be an array." });
    return [];
  }
  const blocks: Array<
    { type: "paragraph"; text: string } | { type: "bullet"; text: string; detail?: string }
  > = [];
  value.forEach((item, index) => {
    const blockPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path: blockPath, message: "summary block must be an object." });
      return;
    }
    const type = readString(item.type, `${blockPath}.type`, issues, { min: 1, max: 20 });
    const text = readString(item.text, `${blockPath}.text`, issues, { max: 4000 });
    if (type === "paragraph") {
      blocks.push({ type: "paragraph", text });
      return;
    }
    if (type === "bullet") {
      const detail =
        item.detail == null
          ? undefined
          : readString(item.detail, `${blockPath}.detail`, issues, {
              optional: true,
              min: 1,
              max: 4000,
            });
      blocks.push({ type: "bullet", text, detail });
      return;
    }
    issues.push({
      path: `${blockPath}.type`,
      message: "summary block type must be paragraph or bullet.",
    });
  });
  return blocks;
}

function parseVariantFamily(value: unknown, path: string, issues: ValidationIssue[]): VariantFamily {
  if (value === "EMH" || value === "PBC") return value;
  issues.push({ path, message: "variantFamily must be EMH or PBC." });
  return "EMH";
}

function parseEdition(value: unknown, path: string, issues: ValidationIssue[]): string {
  if (value == null) return "";
  if (typeof value === "string") {
    return readString(value, path, issues, { optional: true, min: 1, max: 80 });
  }
  if (!isRecord(value)) {
    issues.push({ path, message: "edition must be a string or object." });
    return "";
  }

  hasOnlyKeys(value, EDITION_KEYS, path, issues);
  const name = readString(value.name, `${path}.name`, issues, { max: 80 });
  const year =
    value.publishedYear == null
      ? null
      : readInteger(value.publishedYear, `${path}.publishedYear`, issues, {
          min: 0,
          max: 3000,
        });

  if (!name) return "";
  return typeof year === "number" && year > 0 ? `${name} (${year})` : name;
}

function parseBook(
  bookRaw: unknown,
  topLevelChaptersRaw: unknown,
  issues: ValidationIssue[]
): BookPackageBook {
  if (!isRecord(bookRaw)) {
    issues.push({ path: "book", message: "book must be an object." });
    return {
      bookId: "",
      title: "",
      author: "",
      categories: [],
      variantFamily: "EMH",
      chapters: [],
    };
  }

  hasOnlyKeys(bookRaw, BOOK_KEYS, "book", issues);
  const coverRaw = isRecord(bookRaw.cover) ? bookRaw.cover : undefined;
  if (coverRaw) {
    hasOnlyKeys(coverRaw, COVER_KEYS, "book.cover", issues);
  }

  const hasTopLevelChapters = Array.isArray(topLevelChaptersRaw);
  const hasBookChapters = Array.isArray(bookRaw.chapters);
  if (topLevelChaptersRaw != null && !hasTopLevelChapters) {
    issues.push({ path: "chapters", message: "chapters must be an array." });
  }
  let chaptersRaw: unknown[] = [];
  let chapterPathBase = "book.chapters";

  if (hasTopLevelChapters) {
    chaptersRaw = topLevelChaptersRaw;
    chapterPathBase = "chapters";
  } else if (hasBookChapters) {
    chaptersRaw = bookRaw.chapters as unknown[];
  } else {
    issues.push({
      path: "chapters",
      message: "chapters must be an array (either top-level or book.chapters).",
    });
  }

  const chapters = chaptersRaw.map((chapterRaw, index) =>
    parseChapter(chapterRaw, `${chapterPathBase}[${index}]`, issues)
  );

  return {
    bookId: readString(bookRaw.bookId, "book.bookId", issues, { max: 120 }),
    title: readString(bookRaw.title, "book.title", issues, { max: 240 }),
    author: readString(bookRaw.author, "book.author", issues, { max: 240 }),
    categories: readStringArray(bookRaw.categories, "book.categories", issues, {
      minItems: 1,
      maxItems: 20,
      itemMax: 80,
    }),
    tags: readStringArray(bookRaw.tags, "book.tags", issues, {
      optional: true,
      minItems: 0,
      maxItems: 30,
      itemMax: 80,
    }),
    cover: coverRaw
      ? {
          emoji: readString(coverRaw.emoji, "book.cover.emoji", issues, {
            optional: true,
            min: 1,
            max: 20,
          }),
          color: readString(coverRaw.color, "book.cover.color", issues, {
            optional: true,
            min: 2,
            max: 40,
          }),
        }
      : undefined,
    edition: parseEdition(bookRaw.edition, "book.edition", issues),
    variantFamily: parseVariantFamily(bookRaw.variantFamily, "book.variantFamily", issues),
    chapters,
  };
}

function parseChapter(chapterRaw: unknown, path: string, issues: ValidationIssue[]): BookPackageChapter {
  if (!isRecord(chapterRaw)) {
    issues.push({ path, message: "chapter must be an object." });
    return {
      chapterId: "",
      number: 0,
      title: "",
      readingTimeMinutes: 0,
      contentVariants: {},
      examples: [],
      quiz: { passingScorePercent: 80, questions: [] },
    };
  }

  hasOnlyKeys(chapterRaw, CHAPTER_KEYS, path, issues);

  const contentVariantsRaw = isRecord(chapterRaw.contentVariants) ? chapterRaw.contentVariants : {};
  if (!isRecord(chapterRaw.contentVariants)) {
    issues.push({ path: `${path}.contentVariants`, message: "contentVariants must be an object." });
  }

  const examplesRaw = Array.isArray(chapterRaw.examples) ? chapterRaw.examples : [];
  if (!Array.isArray(chapterRaw.examples)) {
    issues.push({ path: `${path}.examples`, message: "examples must be an array." });
  }
  const examples = examplesRaw.map((exampleRaw, idx) =>
    parseExample(exampleRaw, `${path}.examples[${idx}]`, issues)
  );

  const quiz = parseQuiz(chapterRaw.quiz, `${path}.quiz`, issues);
  const contentVariants: BookPackageChapter["contentVariants"] = {};

  for (const [variantKey, variantValue] of Object.entries(contentVariantsRaw)) {
    if (!isRecord(variantValue)) {
      issues.push({ path: `${path}.contentVariants.${variantKey}`, message: "Variant content must be an object." });
      continue;
    }
    hasOnlyKeys(
      variantValue,
      VARIANT_CONTENT_KEYS,
      `${path}.contentVariants.${variantKey}`,
      issues
    );
    const summaryBlocks = parseSummaryBlocks(
      variantValue.summaryBlocks,
      `${path}.contentVariants.${variantKey}.summaryBlocks`,
      issues
    );
    const summaryBullets = Array.isArray(variantValue.summaryBullets)
      ? readStringArray(
          variantValue.summaryBullets,
          `${path}.contentVariants.${variantKey}.summaryBullets`,
          issues,
          { minItems: 1, maxItems: 20, itemMax: 2000 }
        )
      : summaryBlocks.length > 0
        ? summaryBlocks.map((block) => block.text)
      : typeof variantValue.importantSummary === "string"
        ? [
            readString(
              variantValue.importantSummary,
              `${path}.contentVariants.${variantKey}.importantSummary`,
              issues,
              { max: 4000 }
            ),
          ].filter(Boolean)
        : [];

    // Modern format uses chapterBreakdown instead of summaryBullets
    const hasChapterBreakdown = isRecord(variantValue.chapterBreakdown);
    if (!summaryBullets.length && !hasChapterBreakdown) {
      issues.push({
        path: `${path}.contentVariants.${variantKey}.summaryBullets`,
        message: "Provide summaryBlocks, summaryBullets, importantSummary, or chapterBreakdown.",
      });
    }

    // keyTakeaways can be string[] (legacy) or {point: ToneKeyed}[] (modern)
    const takeawaysSource =
      variantValue.takeaways != null
        ? variantValue.takeaways
        : variantValue.keyTakeaways;

    let takeaways: string[] = [];
    let keyTakeawaysModern: Array<{ point: { gentle: string; direct: string; competitive: string } }> | undefined;

    if (Array.isArray(takeawaysSource) && takeawaysSource.length > 0 && isRecord(takeawaysSource[0])) {
      // Modern format: array of { point: { gentle, direct, competitive } }
      keyTakeawaysModern = [];
      for (let ti = 0; ti < takeawaysSource.length; ti++) {
        const item = takeawaysSource[ti];
        if (!isRecord(item) || !isRecord(item.point)) {
          issues.push({
            path: `${path}.contentVariants.${variantKey}.keyTakeaways[${ti}]`,
            message: "Must be an object with a point field.",
          });
          continue;
        }
        const point = item.point as Record<string, unknown>;
        keyTakeawaysModern.push({
          point: {
            gentle: typeof point.gentle === "string" ? point.gentle : "",
            direct: typeof point.direct === "string" ? point.direct : "",
            competitive: typeof point.competitive === "string" ? point.competitive : "",
          },
        });
      }
      // Generate flat takeaways from the direct tone for backward compatibility
      takeaways = keyTakeawaysModern.map((kt) => kt.point.direct || kt.point.gentle);
    } else {
      takeaways = readStringArray(
        takeawaysSource,
        `${path}.contentVariants.${variantKey}.${
          variantValue.takeaways != null ? "takeaways" : "keyTakeaways"
        }`,
        issues,
        { minItems: 1, maxItems: 15, itemMax: 500 }
      );
    }

    // Parse chapterBreakdown and oneMinuteRecap as tone-keyed objects
    let chapterBreakdown: { gentle: string; direct: string; competitive: string } | undefined;
    if (isRecord(variantValue.chapterBreakdown)) {
      const cb = variantValue.chapterBreakdown as Record<string, unknown>;
      chapterBreakdown = {
        gentle: typeof cb.gentle === "string" ? cb.gentle : "",
        direct: typeof cb.direct === "string" ? cb.direct : "",
        competitive: typeof cb.competitive === "string" ? cb.competitive : "",
      };
    }

    let oneMinuteRecap: { gentle: string; direct: string; competitive: string } | undefined;
    if (isRecord(variantValue.oneMinuteRecap)) {
      const omr = variantValue.oneMinuteRecap as Record<string, unknown>;
      oneMinuteRecap = {
        gentle: typeof omr.gentle === "string" ? omr.gentle : "",
        direct: typeof omr.direct === "string" ? omr.direct : "",
        competitive: typeof omr.competitive === "string" ? omr.competitive : "",
      };
    }

    contentVariants[variantKey as VariantKey] = {
      summaryBullets: summaryBullets.length > 0 ? summaryBullets : undefined,
      summaryBlocks: summaryBlocks.length > 0 ? summaryBlocks : undefined,
      takeaways: takeaways.length > 0 ? takeaways : undefined,
      keyTakeaways: keyTakeawaysModern,
      chapterBreakdown,
      oneMinuteRecap,
      practice: readStringArray(
        variantValue.practice,
        `${path}.contentVariants.${variantKey}.practice`,
        issues,
        { optional: true, minItems: 0, maxItems: 15, itemMax: 500 }
      ),
    };
  }

  // Parse modern chapter-level fields
  const implementationPlan = isRecord(chapterRaw.implementationPlan)
    ? (chapterRaw.implementationPlan as BookPackageChapter["implementationPlan"])
    : undefined;

  const reviewCards = Array.isArray(chapterRaw.reviewCards)
    ? (chapterRaw.reviewCards as BookPackageChapter["reviewCards"])
    : undefined;

  const keyTakeawayCard = parseToneKeyed(chapterRaw.keyTakeawayCard, `${path}.keyTakeawayCard`, issues) ?? undefined;

  return {
    chapterId: readString(chapterRaw.chapterId, `${path}.chapterId`, issues, { max: 120 }),
    number: readInteger(chapterRaw.number, `${path}.number`, issues, { min: 1, max: 5000 }),
    title: readString(chapterRaw.title, `${path}.title`, issues, { max: 200 }),
    readingTimeMinutes: readInteger(chapterRaw.readingTimeMinutes, `${path}.readingTimeMinutes`, issues, {
      min: 1,
      max: 360,
    }),
    contentVariants,
    examples,
    quiz,
    implementationPlan,
    reviewCards,
    keyTakeawayCard,
  };
}

function parseToneKeyed(value: unknown, path: string, issues: ValidationIssue[]): { gentle: string; direct: string; competitive: string } | null {
  if (!isRecord(value)) return null;
  const hasGDC = typeof value.gentle === "string" || typeof value.direct === "string" || typeof value.competitive === "string";
  if (!hasGDC) return null;
  return {
    gentle: typeof value.gentle === "string" ? value.gentle : "",
    direct: typeof value.direct === "string" ? value.direct : "",
    competitive: typeof value.competitive === "string" ? value.competitive : "",
  };
}

function parseStringOrToneKeyed(value: unknown, path: string, issues: ValidationIssue[]): string | { gentle: string; direct: string; competitive: string } {
  if (typeof value === "string") return readString(value, path, issues, { max: 10000 });
  const toned = parseToneKeyed(value, path, issues);
  if (toned) return toned;
  issues.push({ path, message: "Must be a string or a tone-keyed object." });
  return "";
}

function parseExample(exampleRaw: unknown, path: string, issues: ValidationIssue[]): BookPackageExample {
  if (!isRecord(exampleRaw)) {
    issues.push({ path, message: "example must be an object." });
    return {
      exampleId: "",
      title: "",
      scenario: "",
      whatToDo: [],
      whyItMatters: "",
    };
  }

  hasOnlyKeys(exampleRaw, EXAMPLE_KEYS, path, issues);

  // whatToDo can be string[] (legacy) or ToneKeyed (modern)
  let whatToDo: string[] | { gentle: string; direct: string; competitive: string };
  const whatToDoToned = parseToneKeyed(exampleRaw.whatToDo, `${path}.whatToDo`, issues);
  if (whatToDoToned) {
    whatToDo = whatToDoToned;
  } else {
    whatToDo = readStringArray(exampleRaw.whatToDo, `${path}.whatToDo`, issues, {
      minItems: 1,
      maxItems: 20,
      itemMax: 3000,
    });
  }

  return {
    exampleId: readString(exampleRaw.exampleId, `${path}.exampleId`, issues, { max: 120 }),
    title: readString(exampleRaw.title, `${path}.title`, issues, { max: 240 }),
    scenario: parseStringOrToneKeyed(exampleRaw.scenario, `${path}.scenario`, issues),
    whatToDo,
    whyItMatters: parseStringOrToneKeyed(exampleRaw.whyItMatters, `${path}.whyItMatters`, issues),
    contexts: readStringArray(exampleRaw.contexts, `${path}.contexts`, issues, {
      optional: true,
      minItems: 0,
      maxItems: 15,
      itemMax: 80,
    }),
    category: typeof exampleRaw.category === "string" ? exampleRaw.category : undefined,
    format: typeof exampleRaw.format === "string" ? exampleRaw.format : undefined,
    endingType: typeof exampleRaw.endingType === "string" ? exampleRaw.endingType : undefined,
  };
}

function parseQuiz(quizRaw: unknown, path: string, issues: ValidationIssue[]) {
  if (!isRecord(quizRaw)) {
    issues.push({ path, message: "quiz must be an object." });
    return {
      passingScorePercent: 80,
      questions: [] as BookPackageQuizQuestion[],
      retryQuestions: [] as BookPackageQuizQuestion[],
    };
  }

  hasOnlyKeys(quizRaw, QUIZ_KEYS, path, issues);
  const questionsRaw = Array.isArray(quizRaw.questions) ? quizRaw.questions : [];
  if (!Array.isArray(quizRaw.questions)) {
    issues.push({ path: `${path}.questions`, message: "questions must be an array." });
  }
  const questions = questionsRaw.map((q, idx) => parseQuestion(q, `${path}.questions[${idx}]`, issues));
  const retryQuestionsRaw = Array.isArray(quizRaw.retryQuestions) ? quizRaw.retryQuestions : [];
  if (quizRaw.retryQuestions != null && !Array.isArray(quizRaw.retryQuestions)) {
    issues.push({ path: `${path}.retryQuestions`, message: "retryQuestions must be an array." });
  }
  const retryQuestions = retryQuestionsRaw.map((q, idx) =>
    parseQuestion(q, `${path}.retryQuestions[${idx}]`, issues)
  );

  return {
    passingScorePercent: readInteger(quizRaw.passingScorePercent, `${path}.passingScorePercent`, issues, {
      min: 50,
      max: 100,
    }),
    questions,
    retryQuestions: retryQuestions.length > 0 ? retryQuestions : undefined,
  };
}

function parseQuestion(
  questionRaw: unknown,
  path: string,
  issues: ValidationIssue[]
): BookPackageQuizQuestion {
  if (!isRecord(questionRaw)) {
    issues.push({ path, message: "question must be an object." });
    return {
      questionId: "",
      prompt: "",
      choices: [],
      correctAnswerIndex: 0,
    };
  }
  hasOnlyKeys(questionRaw, QUESTION_KEYS, path, issues);
  const choices = readStringArray(questionRaw.choices, `${path}.choices`, issues, {
    minItems: 2,
    maxItems: 8,
    itemMax: 1000,
  });
  const correctIndexPath =
    questionRaw.correctAnswerIndex != null
      ? `${path}.correctAnswerIndex`
      : `${path}.correctIndex`;
  const correctIndexRaw =
    questionRaw.correctAnswerIndex != null
      ? questionRaw.correctAnswerIndex
      : questionRaw.correctIndex;
  const correctAnswerIndex = readInteger(
    correctIndexRaw,
    correctIndexPath,
    issues,
    { min: 0, max: 20 }
  );
  if (choices.length > 0 && (correctAnswerIndex < 0 || correctAnswerIndex >= choices.length)) {
    issues.push({
      path: correctIndexPath,
      message: "Correct answer index is out of range for choices.",
    });
  }
  // explanation can be a string (legacy) or tone-keyed object (modern)
  let explanation: string | undefined;
  if (typeof questionRaw.explanation === "string") {
    explanation = readString(questionRaw.explanation, `${path}.explanation`, issues, {
      optional: true,
      min: 1,
      max: 4000,
    });
  } else if (isRecord(questionRaw.explanation)) {
    // Modern tone-keyed explanation — store the direct tone as the flat explanation
    const toned = parseToneKeyed(questionRaw.explanation, `${path}.explanation`, issues);
    explanation = toned?.direct || toned?.gentle || undefined;
  }

  return {
    questionId: readString(questionRaw.questionId, `${path}.questionId`, issues, { max: 120 }),
    prompt: readString(questionRaw.prompt, `${path}.prompt`, issues, { max: 4000 }),
    choices,
    correctAnswerIndex,
    explanation,
  };
}

function enforceSemanticRules(pkg: BookPackage, issues: ValidationIssue[]) {
  const chapterIds = new Set<string>();
  const chapterNumbers = new Set<number>();
  const allowedVariants = pkg.book.variantFamily === "EMH" ? EMH_VARIANTS : PBC_VARIANTS;

  for (const chapter of pkg.book.chapters) {
    if (chapterIds.has(chapter.chapterId)) {
      issues.push({
        path: `book.chapters.${chapter.chapterId}`,
        message: "chapterId must be unique.",
      });
    }
    chapterIds.add(chapter.chapterId);

    if (chapterNumbers.has(chapter.number)) {
      issues.push({
        path: `book.chapters.${chapter.number}`,
        message: "chapter number must be unique.",
      });
    }
    chapterNumbers.add(chapter.number);

    const variantKeys = Object.keys(chapter.contentVariants);
    if (variantKeys.length !== allowedVariants.length) {
      issues.push({
        path: `book.chapters.${chapter.number}.contentVariants`,
        message: `Must include exactly ${allowedVariants.join(", ")} variants.`,
      });
    }

    for (const required of allowedVariants) {
      if (!chapter.contentVariants[required]) {
        issues.push({
          path: `book.chapters.${chapter.number}.contentVariants.${required}`,
          message: `Missing required variant '${required}'.`,
        });
      }
    }

    const questionIds = new Set<string>();
    const retryQuestions = chapter.quiz.retryQuestions ?? [];
    for (const question of [...chapter.quiz.questions, ...retryQuestions]) {
      if (questionIds.has(question.questionId)) {
        issues.push({
          path: `book.chapters.${chapter.number}.quiz.questions.${question.questionId}`,
          message: "questionId must be unique across questions and retryQuestions within chapter.",
        });
      }
      questionIds.add(question.questionId);
    }

    const exampleIds = new Set<string>();
    for (const example of chapter.examples) {
      if (exampleIds.has(example.exampleId)) {
        issues.push({
          path: `book.chapters.${chapter.number}.examples.${example.exampleId}`,
          message: "exampleId must be unique within chapter.",
        });
      }
      exampleIds.add(example.exampleId);
    }
  }
}

export function validateBookPackage(raw: unknown): BookPackage {
  const issues: ValidationIssue[] = [];

  if (!isRecord(raw)) {
    throw new BookApiError(422, "invalid_package", "Book package must be a JSON object.");
  }

  hasOnlyKeys(raw, ROOT_KEYS, "$", issues);

  const pkg: BookPackage = {
    schemaVersion: readString(raw.schemaVersion, "schemaVersion", issues, { max: 80 }),
    packageId: readString(raw.packageId, "packageId", issues, { max: 120 }),
    createdAt: readString(raw.createdAt, "createdAt", issues, { max: 80 }),
    contentOwner: readString(raw.contentOwner, "contentOwner", issues, { max: 120 }),
    licenseNotes: readString(raw.licenseNotes, "licenseNotes", issues, {
      optional: true,
      min: 1,
      max: 4000,
    }),
    book: parseBook(raw.book, raw.chapters, issues),
  };

  enforceSemanticRules(pkg, issues);

  if (issues.length > 0) {
    throw new BookApiError(422, "invalid_package", "Book package validation failed.", issues);
  }

  return pkg;
}
