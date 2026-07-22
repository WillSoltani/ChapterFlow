import "server-only";

import { cache } from "react";

import { REGION } from "@/app/app/api/_lib/aws";
import type {
  BookDifficulty,
  LibraryBookDetail,
  LibraryCatalogBook,
  LibraryChapterSummary,
} from "@/app/book/_lib/library-data";
import { boilerplateSynopsis } from "@/lib/library-catalog-stub";
import { logger } from "@/lib/logging/logger";
import { buildCoverUrl, encodeS3Key } from "./app-base-url-core";
import { getPublishedBookManifest } from "./content-service";
import { BookApiError } from "./errors";
import {
  buildLibraryCatalogIndexMap,
  resolveListChapterCount,
  shouldDegradeLibraryCatalogIndex,
  type LibraryCatalogIndex,
  type LibraryCatalogIndexBook,
} from "./library-catalog-index-core";
import { getCatalogBook, listPublishedCatalogItems } from "./repo";
import { readJsonFromS3 } from "./storage";
import type { BookCatalogItem } from "./types";

const LIBRARY_CATALOG_KEY = "book-content/library/catalog.json";

// TRANSITIONAL (WS6-012 PR1): direct public S3 cover URL, kept only as the
// fallback for internal callers that don't render covers and so don't resolve an
// app base URL (pair-repo chapter-count map, health probe). Cover-rendering
// routes pass `appBaseUrl`, minting the CloudFront/app-origin URL via
// buildCoverUrl. Removed in PR2 once BLOCK_ALL is enforced and every cover flows
// through CloudFront.
function buildPublicS3Url(bucket: string, key: string): string {
  return `https://${bucket}.s3.${REGION}.amazonaws.com/${encodeS3Key(key)}`;
}

function chapterCode(number: number): string {
  return `CH.${String(Math.max(1, Math.floor(number))).padStart(2, "0")}`;
}

function safeDifficulty(
  difficulty: BookDifficulty | undefined,
  variantFamily: BookCatalogItem["variantFamily"]
): BookDifficulty {
  if (difficulty === "Easy" || difficulty === "Medium" || difficulty === "Hard") {
    return difficulty;
  }
  return variantFamily === "PBC" ? "Hard" : "Medium";
}

// Last-resort synopsis for a published book whose presentation-index entry has
// no authored short description. Delegates to the shared template in
// lib/library-catalog-stub.ts so this live fallback and the catalog-QA detector
// there (isBoilerplateSynopsis) can never drift. Intentionally kept: an empty
// synopsis would be worse than the canned line — the real fix is authoring
// per-book synopses (content/prod-data work, 7A + prod re-seed).
function fallbackSynopsis(title: string): string {
  return boilerplateSynopsis(title);
}

function buildLibraryCatalogBook(params: {
  catalog: BookCatalogItem;
  extra?: LibraryCatalogIndexBook | undefined;
  chapterCount?: number | undefined;
  estimatedMinutes?: number | undefined;
  contentBucket: string;
  appBaseUrl?: string | undefined;
}): LibraryCatalogBook {
  const { catalog, extra, chapterCount, estimatedMinutes, contentBucket, appBaseUrl } = params;
  const resolvedChapterCount =
    extra?.chapterCount && extra.chapterCount > 0 ? extra.chapterCount : chapterCount ?? 0;
  const resolvedEstimatedMinutes =
    extra?.estimatedMinutes && extra.estimatedMinutes > 0
      ? extra.estimatedMinutes
      : estimatedMinutes ?? Math.max(resolvedChapterCount * 12, 24);
  return {
    id: catalog.bookId,
    title: catalog.title,
    author: catalog.author,
    icon: extra?.icon || catalog.cover?.emoji || "📘",
    coverImage: extra?.coverAssetKey
      ? appBaseUrl
        ? buildCoverUrl(appBaseUrl, extra.coverAssetKey)
        : buildPublicS3Url(contentBucket, extra.coverAssetKey)
      : undefined,
    category: catalog.categories[0] ?? "General",
    categories: catalog.categories,
    difficulty: safeDifficulty(extra?.difficulty, catalog.variantFamily),
    estimatedMinutes: Math.max(1, Math.round(resolvedEstimatedMinutes)),
    chapterCount: resolveListChapterCount(extra?.chapterCount, chapterCount),
    pages:
      typeof extra?.pages === "number" && Number.isFinite(extra.pages) && extra.pages > 0
        ? Math.round(extra.pages)
        : undefined,
    synopsis: extra?.synopsis?.trim() || fallbackSynopsis(catalog.title),
    tags: catalog.tags,
    variantFamily: catalog.variantFamily,
    publishedVersion: catalog.currentPublishedVersion ?? catalog.latestVersion,
  };
}

async function readLibraryCatalogIndex(
  contentBucket: string
): Promise<Map<string, LibraryCatalogIndexBook>> {
  try {
    const index = await readJsonFromS3<LibraryCatalogIndex>(contentBucket, LIBRARY_CATALOG_KEY);
    return buildLibraryCatalogIndexMap(index);
  } catch (error: unknown) {
    // The presentation index is non-authoritative decoration; a missing/empty
    // object, a malformed/truncated catalog.json (invalid_json — the B6 defect
    // that 422'd the whole library), or any transient S3 error must DEGRADE to
    // DynamoDB-only data, not fail the listing. See library-catalog-index-core.
    if (shouldDegradeLibraryCatalogIndex(error)) {
      logger.warn("library_catalog_index_degraded", {
        key: LIBRARY_CATALOG_KEY,
        code: error instanceof BookApiError ? error.code : undefined,
        err: error,
      });
      return new Map();
    }
    throw error;
  }
}

export async function listPublishedLibraryCatalog(params: {
  tableName: string;
  contentBucket: string;
  // Canonical app origin (getAppBaseUrl). When provided, coverImage is minted on
  // the app origin (served by CloudFront OAC → content bucket, WS6-012); absent
  // for internal callers that don't render covers.
  appBaseUrl?: string;
}): Promise<LibraryCatalogBook[]> {
  const [catalogItems, presentationIndex] = await Promise.all([
    listPublishedCatalogItems(params.tableName),
    readLibraryCatalogIndex(params.contentBucket),
  ]);

  return catalogItems
    .filter((item) => item.status === "PUBLISHED" && !!item.currentPublishedVersion)
    .map((item) =>
      buildLibraryCatalogBook({
        catalog: item,
        extra: presentationIndex.get(item.bookId),
        contentBucket: params.contentBucket,
        appBaseUrl: params.appBaseUrl,
      })
    )
    .sort((left, right) => left.title.localeCompare(right.title));
}

// Per-request dedupe: React cache() memoizes by argument reference/value within
// a single server render pass. Keyed on the primitive args (not an object, which
// would be a fresh reference on every call) so sequential chapter navigations and
// any sibling reads in the same request reuse one catalog/index/manifest fetch
// instead of re-issuing the three parallel DynamoDB + S3 reads each time.
const loadPublishedLibraryBookDetail = cache(
  async (
    tableName: string,
    contentBucket: string,
    bookId: string,
    // Kept a primitive (empty string when absent) so React cache() still keys by
    // value — an undefined arg would collapse distinct calls onto one entry.
    appBaseUrl: string
  ): Promise<LibraryBookDetail> => {
    const [catalog, presentationIndex, manifestPayload] = await Promise.all([
      getCatalogBook(tableName, bookId),
      readLibraryCatalogIndex(contentBucket),
      getPublishedBookManifest({ tableName, contentBucket, bookId }),
    ]);

    if (!catalog || catalog.status !== "PUBLISHED" || !catalog.currentPublishedVersion) {
      throw new BookApiError(404, "book_not_found", "Book not found.");
    }

    const detail = buildLibraryCatalogBook({
      catalog,
      extra: presentationIndex.get(bookId),
      chapterCount: manifestPayload.manifest.chapterCount,
      estimatedMinutes: manifestPayload.manifest.chapters.reduce(
        (sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1),
        0
      ),
      contentBucket,
      appBaseUrl: appBaseUrl || undefined,
    });

    const chapters: LibraryChapterSummary[] = manifestPayload.manifest.chapters.map((chapter) => ({
      id: chapter.chapterId,
      chapterId: chapter.chapterId,
      number: chapter.number,
      code: chapterCode(chapter.number),
      title: chapter.title,
      minutes: chapter.readingTimeMinutes,
    }));

    return {
      ...detail,
      chapterCount: manifestPayload.manifest.chapterCount,
      publishedVersion: manifestPayload.version,
      chapters,
    };
  }
);

export async function getPublishedLibraryBookDetail(params: {
  tableName: string;
  contentBucket: string;
  bookId: string;
  appBaseUrl?: string;
}): Promise<LibraryBookDetail> {
  return loadPublishedLibraryBookDetail(
    params.tableName,
    params.contentBucket,
    params.bookId,
    params.appBaseUrl ?? ""
  );
}
