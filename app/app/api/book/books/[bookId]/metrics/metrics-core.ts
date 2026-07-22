import { BookApiError } from "@/app/app/api/book/_lib/errors";

interface CatalogLike {
  currentPublishedVersion?: number | null | undefined;
}

/**
 * Dispatch the catalog and progress reads concurrently instead of serially,
 * then apply the same authorization guards in the same order: a book that
 * isn't a published catalog title is a 404 regardless of progress state,
 * and only a published-but-not-started book is a 403.
 */
export async function loadMetricsAccess(deps: {
  getCatalogBook: () => Promise<CatalogLike | null>;
  getUserProgress: () => Promise<unknown | null>;
}): Promise<{ catalog: CatalogLike; progress: unknown }> {
  const [catalog, progress] = await Promise.all([
    deps.getCatalogBook(),
    deps.getUserProgress(),
  ]);

  if (!catalog || !catalog.currentPublishedVersion) {
    throw new BookApiError(404, "book_not_found", "Published book not found.");
  }

  if (!progress) {
    throw new BookApiError(
      403,
      "book_not_started",
      "Start this book to view its reader activity."
    );
  }

  return { catalog, progress };
}
