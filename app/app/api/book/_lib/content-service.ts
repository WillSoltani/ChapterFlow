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
import { getBookPackageById } from "@/app/book/data/bookPackages";

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

export function sanitizeQuizForClient(
  quiz: ChapterQuizPayload
): Omit<ChapterQuizPayload, "questions" | "retryQuestions"> & {
  questions: Array<{
    questionId: string;
    prompt: string;
    choices: string[];
    explanation?: string;
  }>;
  retryQuestions?: Array<{
    questionId: string;
    prompt: string;
    choices: string[];
    explanation?: string;
  }>;
} {
  return {
    chapterId: quiz.chapterId,
    number: quiz.number,
    title: quiz.title,
    passingScorePercent: quiz.passingScorePercent,
    questions: quiz.questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices,
      explanation: q.explanation,
    })),
    retryQuestions: (quiz.retryQuestions ?? []).map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      choices: q.choices,
      explanation: q.explanation,
    })),
  };
}

/**
 * Build quiz questions from the local book-package JSON.
 * Returns null when the package or chapter is not found locally.
 */
export function getLocalQuizQuestions(
  bookId: string,
  chapterNumber: number
): BookPackageQuizQuestion[] | null {
  const pkg = getBookPackageById(bookId);
  if (!pkg) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chapter = (pkg as any).book?.chapters?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ch: any) => ch.number === chapterNumber
  );
  if (!chapter?.quiz?.questions) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return chapter.quiz.questions.map((q: any) => ({
    questionId: q.questionId ?? "",
    prompt: q.prompt ?? "",
    choices: Array.isArray(q.choices) ? q.choices : [],
    correctAnswerIndex: q.correctAnswerIndex ?? q.correctIndex ?? 0,
    explanation:
      typeof q.explanation === "string"
        ? q.explanation
        : q.explanation?.direct || q.explanation?.gentle || undefined,
  }));
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
