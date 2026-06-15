import { BookApiError } from "./errors";
import type {
  BookManifest,
  BookPackageQuizQuestion,
  ChapterQuizPayload,
  ChapterSummaryPayload,
  VariantKey,
} from "./types";
import { readJsonFromS3 } from "./storage";
import { getCatalogBook, getBookVersion, getUserProgress } from "./repo";
import { buildChapterKey, buildQuizKey } from "./keys";
import {
  getBookPackageById,
  getBookPackageByIdForTone,
  isStrictReaderSchema,
  type ToneKey,
} from "@/app/book/data/bookPackages";

export async function getPublishedBookManifest(params: {
  tableName: string;
  contentBucket: string;
  bookId: string;
}): Promise<{ version: number; manifest: BookManifest }> {
  const catalog = await getCatalogBook(params.tableName, params.bookId);
  if (!catalog || !catalog.currentPublishedVersion) {
    throw new BookApiError(404, "book_not_found", "Published book not found.");
  }
  const version = await getBookVersion(
    params.tableName,
    params.bookId,
    catalog.currentPublishedVersion
  );
  if (!version) {
    throw new BookApiError(404, "book_version_not_found", "Published version not found.");
  }
  const manifest = await readJsonFromS3<BookManifest>(
    params.contentBucket,
    version.manifestKey
  );
  return { version: version.version, manifest };
}

export async function getUserAccessibleChapter(params: {
  tableName: string;
  contentBucket: string;
  userId: string;
  bookId: string;
  chapterNumber: number;
}): Promise<{
  progress: NonNullable<Awaited<ReturnType<typeof getUserProgress>>>;
  chapter: ChapterSummaryPayload;
}> {
  const progress = await getUserProgress(params.tableName, params.userId, params.bookId);
  if (!progress) {
    throw new BookApiError(
      403,
      "book_not_started",
      "We couldn't prepare this book yet. Try opening it again."
    );
  }
  if (params.chapterNumber > progress.unlockedThroughChapterNumber) {
    throw new BookApiError(403, "chapter_locked", "This chapter is locked.");
  }
  const chapter = await readJsonFromS3<ChapterSummaryPayload>(
    params.contentBucket,
    buildChapterKey(progress.contentPrefix, params.chapterNumber)
  );
  return { progress, chapter };
}

export async function getUserAccessibleQuiz(params: {
  tableName: string;
  contentBucket: string;
  userId: string;
  bookId: string;
  chapterNumber: number;
}): Promise<{
  progress: NonNullable<Awaited<ReturnType<typeof getUserProgress>>>;
  quiz: ChapterQuizPayload;
}> {
  const progress = await getUserProgress(params.tableName, params.userId, params.bookId);
  if (!progress) {
    throw new BookApiError(
      403,
      "book_not_started",
      "We couldn't prepare this book yet. Try opening it again."
    );
  }
  if (params.chapterNumber > progress.unlockedThroughChapterNumber) {
    throw new BookApiError(403, "chapter_locked", "This chapter is locked.");
  }
  const quiz = await readJsonFromS3<ChapterQuizPayload>(
    params.contentBucket,
    buildQuizKey(progress.contentPrefix, params.chapterNumber)
  );
  return { progress, quiz };
}

/**
 * Build quiz questions from the local book-package JSON.
 * Returns null when the package or chapter is not found locally.
 */
export function getLocalQuizQuestions(
  bookId: string,
  chapterNumber: number,
  tone: ToneKey = "direct"
): BookPackageQuizQuestion[] | null {
  const pkg = getBookPackageByIdForTone(bookId, tone);
  if (!pkg) return null;
  const chapter = pkg.chapters.find((ch) => ch.number === chapterNumber);
  if (!chapter?.quiz?.questions) return null;
  return chapter.quiz.questions.map((q) => {
    // Fail loudly on a missing answer key. Silently defaulting to 0 would grade
    // every reader against choice A for a content defect, corrupting scores/IP
    // for the chapter with no operator signal. Publish-time validation
    // (validate-book-package.ts) already enforces this; this guard catches any
    // content that reaches runtime without an answer-key field.
    const correctAnswerIndex = q.correctAnswerIndex ?? q.correctIndex;
    if (typeof correctAnswerIndex !== "number") {
      throw new BookApiError(
        500,
        "quiz_question_missing_answer_key",
        "This quiz is temporarily unavailable. Please try again later.",
        { bookId, chapterNumber, questionId: q.questionId ?? null }
      );
    }
    return {
      questionId: q.questionId ?? "",
      prompt: q.prompt ?? "",
      choices: Array.isArray(q.choices) ? q.choices : [],
      correctAnswerIndex,
      explanation: typeof q.explanation === "string" ? q.explanation : undefined,
    };
  });
}

/**
 * Returns true when the book uses a "strict reader" schema — exact prose,
 * three breakdown tiers, no fabricated content. Both v12 (`schemaVersion:
 * "1.1.0"`) and v21 (`chapterflow-v21-authored`) qualify. Quiz routes use
 * this to decide between the strict question-count table and the legacy
 * one. Name kept (isLocalV12Package) for call-site compatibility; the
 * predicate now matches v21 too.
 */
export function isLocalV12Package(bookId: string): boolean {
  return isStrictReaderSchema(getBookPackageById(bookId));
}

export function selectVariantFromQuery(value: string | null): VariantKey | undefined {
  if (!value) return undefined;
  if (
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "precise" ||
    value === "balanced" ||
    value === "challenging"
  ) {
    return value;
  }
  return undefined;
}
