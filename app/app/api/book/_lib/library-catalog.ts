import "server-only";

import { REGION } from "@/app/app/api/_lib/aws";
import type {
  BookDifficulty,
  LibraryBookDetail,
  LibraryCatalogBook,
  LibraryChapterSummary,
} from "@/app/book/_lib/library-data";
import { getPublishedBookManifest } from "./content-service";
import { BookApiError } from "./errors";
import { getCatalogBook, listPublishedCatalogItems } from "./repo";
import { readJsonFromS3 } from "./storage";
import type { BookCatalogItem } from "./types";

const LIBRARY_CATALOG_KEY = "book-content/library/catalog.json";

type LibraryCatalogIndexBook = {
  bookId: string;
  icon?: string;
  difficulty?: BookDifficulty;
  synopsis?: string;
  pages?: number;
  estimatedMinutes?: number;
  chapterCount?: number;
  coverAssetKey?: string;
};

type LibraryCatalogIndex = {
  schemaVersion: string;
  generatedAt: string;
  books: LibraryCatalogIndexBook[];
};

function encodeS3Key(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

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

function fallbackSynopsis(title: string): string {
  return `${title} taught through chapter summaries, real-world scenarios, and quizzes you can apply right away.`;
}

function buildLibraryCatalogBook(params: {
  catalog: BookCatalogItem;
  extra?: LibraryCatalogIndexBook;
  chapterCount?: number;
  estimatedMinutes?: number;
  contentBucket: string;
}): LibraryCatalogBook {
  const { catalog, extra, chapterCount, estimatedMinutes, contentBucket } = params;
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
      ? buildPublicS3Url(contentBucket, extra.coverAssetKey)
      : undefined,
    category: catalog.categories[0] ?? "General",
    categories: catalog.categories,
    difficulty: safeDifficulty(extra?.difficulty, catalog.variantFamily),
    estimatedMinutes: Math.max(1, Math.round(resolvedEstimatedMinutes)),
    chapterCount: Math.max(1, Math.round(resolvedChapterCount || 1)),
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
    const books = Array.isArray(index.books) ? index.books : [];
    return new Map(
      books
        .filter((book): book is LibraryCatalogIndexBook => Boolean(book?.bookId))
        .map((book) => [book.bookId, book])
    );
  } catch (error: unknown) {
    if (
      error instanceof BookApiError &&
      (error.code === "content_not_found" || error.code === "empty_content")
    ) {
      return new Map();
    }
    throw error;
  }
}

export async function listPublishedLibraryCatalog(params: {
  tableName: string;
  contentBucket: string;
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
      })
    )
    .sort((left, right) => left.title.localeCompare(right.title));
}

export async function getPublishedLibraryBookDetail(params: {
  tableName: string;
  contentBucket: string;
  bookId: string;
}): Promise<LibraryBookDetail> {
  const [catalog, presentationIndex, manifestPayload] = await Promise.all([
    getCatalogBook(params.tableName, params.bookId),
    readLibraryCatalogIndex(params.contentBucket),
    getPublishedBookManifest(params),
  ]);

  if (!catalog || catalog.status !== "PUBLISHED" || !catalog.currentPublishedVersion) {
    throw new BookApiError(404, "book_not_found", "Book not found.");
  }

  const detail = buildLibraryCatalogBook({
    catalog,
    extra: presentationIndex.get(params.bookId),
    chapterCount: manifestPayload.manifest.chapterCount,
    estimatedMinutes: manifestPayload.manifest.chapters.reduce(
      (sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1),
      0
    ),
    contentBucket: params.contentBucket,
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
