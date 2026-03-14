import { BookApiError } from "./errors";
import {
  buildBookJsonKey,
  buildChapterKey,
  buildContentPrefix,
  buildManifestKey,
  buildQuizKey,
} from "./keys";
import type {
  BookManifest,
  BookManifestChapter,
  BookPackage,
  ChapterQuizPayload,
  ChapterSummaryPayload,
} from "./types";
import { validateBookPackage } from "./validate-book-package";
import { putJsonStringToS3, readJsonFromS3, writeJsonToS3 } from "./storage";
import { createBookVersionDraft, getNextVersionNumber, publishBookVersion, upsertBookMetaAndCatalog } from "./repo";

export async function ingestBookPackageFromS3(params: {
  tableName: string;
  ingestBucket: string;
  contentBucket: string;
  ingestKey: string;
  createdBy: string;
  publishNow: boolean;
}): Promise<{
  bookId: string;
  version: number;
  manifestKey: string;
  contentPrefix: string;
  manifest: BookManifest;
}> {
  const raw = await readJsonFromS3<unknown>(params.ingestBucket, params.ingestKey);
  const pkg = validateBookPackage(raw);
  const { manifest, chapterPayloads, quizPayloads } = buildArtifacts(pkg);

  let version: number | null = null;
  let draftCreated = false;

  for (let i = 0; i < 5; i += 1) {
    const nextVersion = await getNextVersionNumber(params.tableName, pkg.book.bookId);
    const contentPrefix = buildContentPrefix(pkg.book.bookId, nextVersion);
    const manifestKey = buildManifestKey(contentPrefix);

    try {
      await createBookVersionDraft(params.tableName, {
        bookId: pkg.book.bookId,
        version: nextVersion,
        packageId: pkg.packageId,
        schemaVersion: pkg.schemaVersion,
        contentPrefix,
        manifestKey,
        createdBy: params.createdBy,
      });
      version = nextVersion;
      draftCreated = true;
      break;
    } catch (error: unknown) {
      if (error instanceof BookApiError && error.code === "version_conflict") {
        continue;
      }
      throw error;
    }
  }

  if (!draftCreated || !version) {
    throw new BookApiError(409, "version_conflict", "Could not allocate next version. Retry upload.");
  }

  const contentPrefix = buildContentPrefix(pkg.book.bookId, version);
  const manifestKey = buildManifestKey(contentPrefix);
  const bookJsonKey = buildBookJsonKey(contentPrefix);
  const manifestWithVersion: BookManifest = {
    ...manifest,
    version,
    chapters: manifest.chapters.map((chapter) => ({
      ...chapter,
      chapterKey: buildChapterKey(contentPrefix, chapter.number),
      quizKey: buildQuizKey(contentPrefix, chapter.number),
    })),
  };

  await putJsonStringToS3(params.contentBucket, bookJsonKey, JSON.stringify(raw));
  await writeJsonToS3(params.contentBucket, manifestKey, manifestWithVersion);

  for (const chapter of chapterPayloads) {
    await writeJsonToS3(
      params.contentBucket,
      buildChapterKey(contentPrefix, chapter.number),
      chapter
    );
  }
  for (const quiz of quizPayloads) {
    await writeJsonToS3(params.contentBucket, buildQuizKey(contentPrefix, quiz.number), quiz);
  }

  await upsertBookMetaAndCatalog(params.tableName, {
    bookId: pkg.book.bookId,
    title: pkg.book.title,
    author: pkg.book.author,
    categories: pkg.book.categories,
    tags: pkg.book.tags ?? [],
    cover: pkg.book.cover,
    variantFamily: pkg.book.variantFamily,
    latestVersion: version,
    currentPublishedVersion: params.publishNow ? version : undefined,
    status: params.publishNow ? "PUBLISHED" : "DRAFT",
  });

  if (params.publishNow) {
    await publishBookVersion(params.tableName, pkg.book.bookId, version, params.createdBy);
  }

  return {
    bookId: pkg.book.bookId,
    version,
    manifestKey,
    contentPrefix,
    manifest: manifestWithVersion,
  };
}

function buildArtifacts(pkg: BookPackage): {
  manifest: BookManifest;
  chapterPayloads: ChapterSummaryPayload[];
  quizPayloads: ChapterQuizPayload[];
} {
  const sortedChapters = [...pkg.book.chapters].sort((a, b) => a.number - b.number);

  const manifestChapters: BookManifestChapter[] = sortedChapters.map((chapter) => ({
    chapterId: chapter.chapterId,
    number: chapter.number,
    title: chapter.title,
    readingTimeMinutes: chapter.readingTimeMinutes,
    chapterKey: "",
    quizKey: "",
  }));

  const chapterPayloads: ChapterSummaryPayload[] = sortedChapters.map((chapter) => ({
    chapterId: chapter.chapterId,
    number: chapter.number,
    title: chapter.title,
    readingTimeMinutes: chapter.readingTimeMinutes,
    contentVariants: chapter.contentVariants,
    examples: chapter.examples,
  }));

  const quizPayloads: ChapterQuizPayload[] = sortedChapters.map((chapter) => ({
    chapterId: chapter.chapterId,
    number: chapter.number,
    title: chapter.title,
    passingScorePercent: chapter.quiz.passingScorePercent,
    questions: chapter.quiz.questions,
  }));

  return {
    manifest: {
      schemaVersion: pkg.schemaVersion,
      packageId: pkg.packageId,
      bookId: pkg.book.bookId,
      title: pkg.book.title,
      author: pkg.book.author,
      categories: pkg.book.categories,
      tags: pkg.book.tags ?? [],
      variantFamily: pkg.book.variantFamily,
      chapterCount: sortedChapters.length,
      createdAt: pkg.createdAt,
      version: 0,
      chapters: manifestChapters,
    },
    chapterPayloads,
    quizPayloads,
  };
}
