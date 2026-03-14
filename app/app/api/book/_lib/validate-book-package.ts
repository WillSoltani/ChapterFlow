import { BookApiError } from "./errors";
import type {
  BookPackage,
  BookPackageBook,
  BookPackageChapter,
  BookPackageExample,
  BookPackageQuizQuestion,
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
]);
const EXAMPLE_KEYS = new Set(["exampleId", "title", "scenario", "whatToDo", "whyItMatters", "contexts"]);
const QUIZ_KEYS = new Set(["passingScorePercent", "questions"]);
const QUESTION_KEYS = new Set([
  "questionId",
  "prompt",
  "choices",
  "correctAnswerIndex",
  "correctIndex",
  "explanation",
]);
const VARIANT_CONTENT_KEYS = new Set([
  "summaryBullets",
  "importantSummary",
  "takeaways",
  "keyTakeaways",
  "practice",
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
    const summaryBullets = Array.isArray(variantValue.summaryBullets)
      ? readStringArray(
          variantValue.summaryBullets,
          `${path}.contentVariants.${variantKey}.summaryBullets`,
          issues,
          { minItems: 1, maxItems: 20, itemMax: 2000 }
        )
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

    if (!summaryBullets.length) {
      issues.push({
        path: `${path}.contentVariants.${variantKey}.summaryBullets`,
        message: "Provide summaryBullets or importantSummary.",
      });
    }

    const takeawaysSource =
      variantValue.takeaways != null
        ? variantValue.takeaways
        : variantValue.keyTakeaways;

    contentVariants[variantKey as VariantKey] = {
      summaryBullets,
      takeaways: readStringArray(
        takeawaysSource,
        `${path}.contentVariants.${variantKey}.${
          variantValue.takeaways != null ? "takeaways" : "keyTakeaways"
        }`,
        issues,
        { minItems: 1, maxItems: 15, itemMax: 500 }
      ),
      practice: readStringArray(
        variantValue.practice,
        `${path}.contentVariants.${variantKey}.practice`,
        issues,
        { optional: true, minItems: 0, maxItems: 15, itemMax: 500 }
      ),
    };
  }

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
  };
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
  return {
    exampleId: readString(exampleRaw.exampleId, `${path}.exampleId`, issues, { max: 120 }),
    title: readString(exampleRaw.title, `${path}.title`, issues, { max: 240 }),
    scenario: readString(exampleRaw.scenario, `${path}.scenario`, issues, { max: 5000 }),
    whatToDo: readStringArray(exampleRaw.whatToDo, `${path}.whatToDo`, issues, {
      minItems: 1,
      maxItems: 20,
      itemMax: 3000,
    }),
    whyItMatters: readString(exampleRaw.whyItMatters, `${path}.whyItMatters`, issues, { max: 4000 }),
    contexts: readStringArray(exampleRaw.contexts, `${path}.contexts`, issues, {
      optional: true,
      minItems: 0,
      maxItems: 15,
      itemMax: 80,
    }),
  };
}

function parseQuiz(quizRaw: unknown, path: string, issues: ValidationIssue[]) {
  if (!isRecord(quizRaw)) {
    issues.push({ path, message: "quiz must be an object." });
    return {
      passingScorePercent: 80,
      questions: [] as BookPackageQuizQuestion[],
    };
  }

  hasOnlyKeys(quizRaw, QUIZ_KEYS, path, issues);
  const questionsRaw = Array.isArray(quizRaw.questions) ? quizRaw.questions : [];
  if (!Array.isArray(quizRaw.questions)) {
    issues.push({ path: `${path}.questions`, message: "questions must be an array." });
  }
  const questions = questionsRaw.map((q, idx) => parseQuestion(q, `${path}.questions[${idx}]`, issues));

  return {
    passingScorePercent: readInteger(quizRaw.passingScorePercent, `${path}.passingScorePercent`, issues, {
      min: 50,
      max: 100,
    }),
    questions,
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
  return {
    questionId: readString(questionRaw.questionId, `${path}.questionId`, issues, { max: 120 }),
    prompt: readString(questionRaw.prompt, `${path}.prompt`, issues, { max: 4000 }),
    choices,
    correctAnswerIndex,
    explanation: readString(questionRaw.explanation, `${path}.explanation`, issues, {
      optional: true,
      min: 1,
      max: 4000,
    }),
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
    for (const question of chapter.quiz.questions) {
      if (questionIds.has(question.questionId)) {
        issues.push({
          path: `book.chapters.${chapter.number}.quiz.questions.${question.questionId}`,
          message: "questionId must be unique within chapter.",
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
