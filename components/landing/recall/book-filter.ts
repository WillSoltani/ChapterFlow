/**
 * book-filter — pure search/filter helpers for the RECALL library browser
 * (RecallLibraryBrowser). Kept dependency-light and side-effect-free (only the
 * shared canonicalizeCategory taxonomy) so it carries no "use client" cost and
 * is unit-testable in isolation.
 *
 * Both helpers are generic over the book shape so they work with the real
 * BookCatalogMetadata AND small test fixtures: filterBooks needs only
 * title/author/category, deriveCategories needs only category.
 */
import { canonicalizeCategory } from "@/lib/category-taxonomy";

type FilterableBook = { title: string; author: string; category: string };
type CategorizedBook = { category: string };

/**
 * Distinct CANONICAL categories present in the catalog, alphabetically sorted —
 * the chip set for the browser's category filter. Canonicalizing first folds
 * near-duplicate authored strings (e.g. "Self Improvement" → "Self-Help") into
 * one chip instead of two, matching how CATALOG_CATEGORY_COUNT is derived.
 */
export function deriveCategories<T extends CategorizedBook>(books: T[]): string[] {
  return [...new Set(books.map((b) => canonicalizeCategory(b.category)))].sort(
    (a, b) => a.localeCompare(b),
  );
}

/**
 * Filter by a free-text query (matched case-insensitively against title OR
 * author) AND a canonical category. A null/empty `category` means "All" (no
 * category constraint); an empty/whitespace `query` means "no text constraint".
 * Order is preserved from the input list.
 */
export function filterBooks<T extends FilterableBook>(
  books: T[],
  query: string,
  category: string | null,
): T[] {
  const q = query.trim().toLowerCase();
  return books.filter((book) => {
    if (category && canonicalizeCategory(book.category) !== category) {
      return false;
    }
    if (!q) return true;
    return (
      book.title.toLowerCase().includes(q) ||
      book.author.toLowerCase().includes(q)
    );
  });
}
