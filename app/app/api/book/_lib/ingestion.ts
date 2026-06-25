import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3 } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import {
  buildBookJsonKey,
  buildChapterKey,
  buildConceptGraphKey,
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
import { CategoryTaxonomyError, enforceCanonicalCategories } from "@/lib/category-taxonomy";
import { shouldPublishReusedVersion } from "./ingestion-publish-policy";
import { putJsonStringToS3, readJsonFromS3, writeJsonToS3 } from "./storage";
import {
  createBookVersionDraft,
  deleteBookVersion,
  getCatalogBook,
  getNextVersionNumber,
  listBookVersions,
  publishBookVersion,
  upsertBookMetaAndCatalog,
} from "./repo";
import { evaluatePublishGuard } from "@/lib/book-slug-aliases";

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

  // bookId is interpolated directly into every S3 content key via
  // buildContentPrefix(`book-content/books/{bookId}/...`). validateBookPackage
  // only length-bounds it, so a bookId containing '/' or '../' segments would
  // let the written prefix escape the intended namespace and scatter/overwrite
  // objects under attacker-chosen keys. Restrict it to a slug charset before any
  // key is derived. (Issue #85.)
  if (!/^[a-z0-9._-]+$/.test(pkg.book.bookId)) {
    throw new BookApiError(
      422,
      "invalid_package",
      "Book package validation failed.",
      [
        {
          path: "book.bookId",
          message:
            "bookId must contain only lowercase letters, digits, '.', '_', or '-' (no path separators).",
        },
      ]
    );
  }

  // Category taxonomy gate (DI-3, owner decision D4). Authored categories are
  // free text, which historically let one topic fork into near-duplicate strings
  // ("Self-Help" vs "Self Improvement", "Decision-Making" vs "Decision Making")
  // that silently split the catalog's filter pills. Reject any category with no
  // canonical mapping so a new synonym can never enter the catalog silently, then
  // normalize the rest onto the controlled vocabulary BEFORE buildArtifacts so the
  // canonical categories flow into the manifest, book.json, the catalog item and
  // the search index alike. (ingestBookPackageFromS3 -> upsertBookMetaAndCatalog
  // is the sole live publish/write path for catalog categories.)
  try {
    pkg.book.categories = enforceCanonicalCategories(pkg.book.categories);
  } catch (error: unknown) {
    if (error instanceof CategoryTaxonomyError) {
      throw new BookApiError(422, "invalid_package", "Book package validation failed.", [
        { path: "book.categories", message: error.message },
      ]);
    }
    throw error;
  }

  // PROD-DUP dedupe guard: a slug rename keys a brand-new catalog record, so the
  // OLD slug is left live serving a degraded duplicate. Never (re)publish under a
  // known retired slug — only the canonical slug may go live, so an orphan record
  // can't be forked again. (lib/book-slug-aliases.ts is the single source of
  // truth, shared with the orphan→canonical redirects + the reconcile script.)
  const guard = evaluatePublishGuard(pkg.book.bookId);
  if (guard.action === "reject") {
    throw new BookApiError(409, guard.code, guard.message);
  }

  const { manifest, chapterPayloads, quizPayloads } = buildArtifacts(pkg);

  // Idempotency: if a version with this exact packageId already exists, reuse it
  // instead of allocating a new version. Identical re-uploads (e.g. a retry after
  // a transient failure) must not multiply versions and orphan content prefixes.
  if (pkg.packageId) {
    const existingVersions = await listBookVersions(params.tableName, pkg.book.bookId);
    const existing = existingVersions.find((v) => v.packageId === pkg.packageId);
    if (existing) {
      const existingPrefix = existing.contentPrefix || buildContentPrefix(pkg.book.bookId, existing.version);
      const existingManifestKey = existing.manifestKey || buildManifestKey(existingPrefix);
      // Honor publishNow on the reuse path: a prior DRAFT ingest re-run with
      // publishNow=true must actually publish, not silently no-op (the version
      // would otherwise stay DRAFT and the book never go live).
      if (shouldPublishReusedVersion(params.publishNow, existing.state)) {
        await publishBookVersion(params.tableName, pkg.book.bookId, existing.version, params.createdBy);
      }
      return {
        bookId: pkg.book.bookId,
        version: existing.version,
        manifestKey: existingManifestKey,
        contentPrefix: existingPrefix,
        manifest: {
          ...manifest,
          version: existing.version,
          chapters: manifest.chapters.map((chapter) => ({
            ...chapter,
            chapterKey: buildChapterKey(existingPrefix, chapter.number),
            quizKey: buildQuizKey(existingPrefix, chapter.number),
          })),
        },
      };
    }
  }

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
  const originalUploadKey = `${contentPrefix}/original-upload.json`;
  const manifestWithVersion: BookManifest = {
    ...manifest,
    version,
    chapters: manifest.chapters.map((chapter) => ({
      ...chapter,
      chapterKey: buildChapterKey(contentPrefix, chapter.number),
      quizKey: buildQuizKey(contentPrefix, chapter.number),
    })),
  };

  // The canonical book.json must match what is actually served (manifest /
  // chapters / quizzes are built from the validated+adapted pkg, not the raw
  // blob). Writing JSON.stringify(raw) here would diverge from every served
  // artifact — most starkly for v21 uploads, where validateBookPackage
  // dispatches through adaptV21ToV13 so pkg is v13-shaped while raw stays v21.
  // Preserve the original upload separately for forensics / re-ingest.
  try {
    await putJsonStringToS3(params.contentBucket, bookJsonKey, JSON.stringify(pkg));
    await putJsonStringToS3(params.contentBucket, originalUploadKey, JSON.stringify(raw));
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

    if (pkg.conceptGraph) {
      await writeJsonToS3(
        params.contentBucket,
        buildConceptGraphKey(contentPrefix),
        pkg.conceptGraph
      );
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
  } catch (error: unknown) {
    // A mid-write failure would otherwise leave the DRAFT row + a partial
    // content prefix orphaned for manual cleanup. Best-effort roll both back so
    // a retry (or the idempotency check above) starts from a clean slate.
    await deleteContentPrefix(params.contentBucket, contentPrefix).catch(() => {});
    await deleteBookVersion(params.tableName, pkg.book.bookId, version).catch(() => {});
    throw error;
  }

  if (params.publishNow) {
    await publishBookVersion(params.tableName, pkg.book.bookId, version, params.createdBy);
    // PROD-DUP: now that the canonical slug is live, retire any stale records
    // still published under this book's OLD slugs so the catalog stops serving
    // the degraded duplicate (a rename retires the old record instead of forking
    // a second one).
    if (guard.supersedeSlugs.length > 0) {
      await archiveSupersededOrphans(
        params.tableName,
        pkg.book.bookId,
        guard.supersedeSlugs,
        params.createdBy
      );
    }
  }

  return {
    bookId: pkg.book.bookId,
    version,
    manifestKey,
    contentPrefix,
    manifest: manifestWithVersion,
  };
}

// Best-effort deletion of every S3 object under a content prefix. Used to roll
// back partial artifact writes when an ingest fails mid-flight. Paginates
// ListObjectsV2 and batch-deletes (DeleteObjects accepts up to 1000 keys).
async function deleteContentPrefix(bucket: string, prefix: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}/`,
        ContinuationToken: continuationToken,
      })
    );
    const keys = (listed.Contents ?? [])
      .map((obj) => obj.Key)
      .filter((key): key is string => typeof key === "string" && key.length > 0);
    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        })
      );
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
}

// PROD-DUP: archive (status -> ARCHIVED) any catalog records still PUBLISHED
// under a book's old/orphan slugs once it republishes under the canonical slug.
// ARCHIVE — not delete — so the record and every reader's progress row (keyed by
// the old bookId) survive; the orphan→canonical redirect + PAR-2 version-upgrade
// carry readers forward. Best-effort: the publish has already committed and the
// reconcile script (scripts/book/reconcile-prod-catalog.ts) is the authoritative
// backstop, so a transient failure here is logged, not thrown.
async function archiveSupersededOrphans(
  tableName: string,
  canonicalBookId: string,
  orphanBookIds: string[],
  actor: string
): Promise<void> {
  for (const orphanBookId of orphanBookIds) {
    try {
      const orphan = await getCatalogBook(tableName, orphanBookId);
      if (!orphan || orphan.status !== "PUBLISHED") continue;
      await upsertBookMetaAndCatalog(tableName, {
        bookId: orphan.bookId,
        title: orphan.title,
        author: orphan.author,
        categories: orphan.categories,
        tags: orphan.tags,
        cover: orphan.cover,
        variantFamily: orphan.variantFamily,
        latestVersion: orphan.latestVersion,
        currentPublishedVersion: orphan.currentPublishedVersion,
        status: "ARCHIVED",
      });
      console.log(
        `[prod-dup] archived orphan catalog record "${orphanBookId}" superseded by "${canonicalBookId}" (publish by ${actor}).`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[prod-dup] could not archive orphan "${orphanBookId}" superseded by "${canonicalBookId}": ${message}`
      );
    }
  }
}

function buildArtifacts(pkg: BookPackage): {
  manifest: BookManifest;
  chapterPayloads: ChapterSummaryPayload[];
  quizPayloads: ChapterQuizPayload[];
} {
  const sortedChapters = [...pkg.chapters].sort((a, b) => a.number - b.number);

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
    implementationPlan: chapter.implementationPlan,
    reviewCards: chapter.reviewCards,
    keyTakeawayCard: chapter.keyTakeawayCard,
    v21Extras: chapter.v21Extras,
  }));

  const quizPayloads: ChapterQuizPayload[] = sortedChapters.map((chapter) => ({
    chapterId: chapter.chapterId,
    number: chapter.number,
    title: chapter.title,
    passingScorePercent: chapter.quiz.passingScorePercent,
    questions: chapter.quiz.questions,
    retryQuestions: chapter.quiz.retryQuestions,
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
