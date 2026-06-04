/**
 * Shared substring matcher for book search/filtering.
 *
 * Factored out of the per-surface predicates that previously lived in
 * BrowseAll, GlobalSearchPanel (localBookSearch) and useLibraryFilters so the
 * library, browse-all, and dashboard all match a query the same way.
 *
 * Matches title + author + category (+ any extra haystack fields a caller
 * passes, e.g. a one-line hook). Case-insensitive, whitespace-trimmed.
 */
export type SearchableBook = {
  title?: string | null;
  author?: string | null;
  category?: string | null;
  categories?: string[] | null;
};

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesBookQuery(
  book: SearchableBook,
  normalizedQuery: string,
  ...extra: Array<string | null | undefined>
): boolean {
  if (!normalizedQuery) return true;
  const haystack = [
    book.title,
    book.author,
    book.category,
    ...(book.categories ?? []),
    ...extra,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedQuery);
}
