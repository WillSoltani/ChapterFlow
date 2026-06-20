import { BookApiError } from "./errors";
import type {
  BookManifest,
  BookPackageQuizQuestion,
  ChapterQuizPayload,
  ChapterSummaryPayload,
  VariantKey,
} from "./types";
import { readJsonFromS3 } from "./storage";
import {
  getCatalogBook,
  getBookVersion,
  getUserProgress,
  repointProgressVersion,
} from "./repo";
import { buildChapterKey, buildQuizKey, nowIso } from "./keys";
import { planProgressVersionUpgrade } from "./version-upgrade-core";
import { getServerBookPackage } from "./book-package-source";
import { isStrictReaderSchema } from "@/app/book/data/book-package-core";
import type { ToneKey } from "@/app/book/data/book-package-core";

type ReaderProgress = NonNullable<Awaited<ReturnType<typeof getUserProgress>>>;

/**
 * Load a reader's progress and, if a newer published version exists, SAFELY
 * advance their pin to it before any content is read (PAR-2). This is the single
 * choke point both `getUserAccessibleChapter` and `getUserAccessibleQuiz` use to
 * resolve `progress.contentPrefix`, so re-pointing here reaches every reader
 * read path (chapter, quiz, quiz-submit, reflection feedback, validation cache)
 * without patching each route.
 *
 * Fail-safe: a version-upgrade attempt must never break a read — any error
 * leaves the reader on their existing pinned content.
 */
async function resolveReaderProgress(params: {
  tableName: string;
  contentBucket: string;
  userId: string;
  bookId: string;
}): Promise<ReaderProgress | null> {
  const progress = await getUserProgress(params.tableName, params.userId, params.bookId);
  if (!progress) return null;
  try {
    const upgraded = await maybeUpgradeProgressVersion({
      tableName: params.tableName,
      contentBucket: params.contentBucket,
      bookId: params.bookId,
      progress,
    });
    return upgraded ?? progress;
  } catch (error) {
    // A version-upgrade attempt must never break a read. Surface the failure for
    // operators (a correction silently not reaching readers — e.g. repeated S3
    // errors — is otherwise invisible) and fall back to the pinned content.
    console.warn("[par2_version_upgrade_failed]", {
      bookId: params.bookId,
      pinnedBookVersion: progress.pinnedBookVersion,
      error: error instanceof Error ? error.message : String(error),
    });
    return progress;
  }
}

/**
 * Re-point a started reader from their pinned version to the catalog's current
 * published version when it is strictly newer AND the advance is loss-free (see
 * planProgressVersionUpgrade for the prefix-identity safety gate). Persists the
 * re-pointed row so the steady-state cost of a read stays a single catalog
 * point-read. Returns the upgraded progress, or null to keep the reader pinned.
 */
async function maybeUpgradeProgressVersion(params: {
  tableName: string;
  contentBucket: string;
  bookId: string;
  progress: ReaderProgress;
}): Promise<ReaderProgress | null> {
  const { tableName, contentBucket, bookId, progress } = params;

  const catalog = await getCatalogBook(tableName, bookId);
  const currentVersion = catalog?.currentPublishedVersion;
  if (
    !catalog ||
    catalog.status !== "PUBLISHED" ||
    !currentVersion ||
    currentVersion <= progress.pinnedBookVersion
  ) {
    return null;
  }
  // Need the reader's pinned manifest to verify the new version is a safe
  // re-point. Legacy rows without one stay pinned.
  if (!progress.manifestKey) return null;

  const newVersion = await getBookVersion(tableName, bookId, currentVersion);
  if (
    !newVersion ||
    newVersion.state !== "PUBLISHED" ||
    !newVersion.contentPrefix ||
    !newVersion.manifestKey
  ) {
    return null;
  }

  const [oldManifest, newManifest] = await Promise.all([
    readJsonFromS3<BookManifest>(contentBucket, progress.manifestKey),
    readJsonFromS3<BookManifest>(contentBucket, newVersion.manifestKey),
  ]);

  // Sanity: each manifest must describe the version we believe it does. A
  // mispointed manifestKey would otherwise let an unrelated structure pass the
  // gate. Only enforce when the field is present (every published manifest sets
  // it; see ingestion.ts) so a hypothetical version-less manifest is not blocked.
  if (
    (typeof oldManifest.version === "number" &&
      oldManifest.version !== progress.pinnedBookVersion) ||
    (typeof newManifest.version === "number" && newManifest.version !== newVersion.version)
  ) {
    return null;
  }

  const plan = planProgressVersionUpgrade({
    newVersion: newVersion.version,
    newContentPrefix: newVersion.contentPrefix,
    newManifestKey: newVersion.manifestKey,
    oldManifest,
    newManifest,
    progress,
  });
  if (!plan) return null;

  // Under the prefix-identity gate the remap is the identity, so ONLY the three
  // version fields change. Persist them with a field-scoped conditional update
  // (see repointProgressVersion) so the re-point can never clobber a concurrent
  // interaction write or downgrade a row another request already advanced.
  const updatedAt = nowIso();
  const applied = await repointProgressVersion(tableName, {
    userId: progress.userId,
    bookId,
    expectedPinnedVersion: progress.pinnedBookVersion,
    pinnedBookVersion: plan.pinnedBookVersion,
    contentPrefix: plan.contentPrefix,
    manifestKey: plan.manifestKey,
    updatedAt,
  });
  if (!applied) return null;

  return {
    ...progress,
    pinnedBookVersion: plan.pinnedBookVersion,
    contentPrefix: plan.contentPrefix,
    manifestKey: plan.manifestKey,
    updatedAt,
  };
}

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
  const progress = await resolveReaderProgress({
    tableName: params.tableName,
    contentBucket: params.contentBucket,
    userId: params.userId,
    bookId: params.bookId,
  });
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
  const progress = await resolveReaderProgress({
    tableName: params.tableName,
    contentBucket: params.contentBucket,
    userId: params.userId,
    bookId: params.bookId,
  });
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
export async function getLocalQuizQuestions(
  bookId: string,
  chapterNumber: number,
  tone: ToneKey = "direct"
): Promise<BookPackageQuizQuestion[] | null> {
  const pkg = await getServerBookPackage(bookId, tone);
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
export async function isLocalV12Package(bookId: string): Promise<boolean> {
  return isStrictReaderSchema(await getServerBookPackage(bookId));
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
