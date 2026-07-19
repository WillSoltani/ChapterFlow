import {
  BOOKS_CATALOG,
  getBookChapterCount,
  getBookSynopsis,
} from "@/lib/books-catalog";
import { getBookCoverPath } from "@/lib/book-covers";
import { canonicalizeCategory } from "@/lib/category-taxonomy";

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  category: string;
  chapters: number;
  difficulty: "easy" | "medium" | "hard";
  estimatedHours: number;
  description: string;
  popular?: boolean;
  isNew?: boolean;
  staffPick?: boolean;
  isFree?: boolean;
  coverId?: string;
}

export type SortOption = "popular" | "newest" | "shortest" | "alphabetical";

const POPULAR_IDS = new Set([
  "crucial-conversations",
]);

const NEW_IDS = new Set<string>([
  "the-almanack-of-naval-ravikant",
]);

const FREE_IDS = new Set<string>();
const STAFF_PICK_IDS = new Set<string>();

function truncateSynopsis(text: string, max = 120): string {
  if (text.length <= max) return text;
  const periodIdx = text.indexOf(".", 40);
  if (periodIdx !== -1 && periodIdx <= max) return text.substring(0, periodIdx + 1);
  return text.substring(0, max - 1).trimEnd() + "…";
}

export const ALL_BOOKS: LibraryBook[] = BOOKS_CATALOG.map((cat) => {
  const synopsis = getBookSynopsis(cat.id);
  const desc = truncateSynopsis(synopsis);

  return {
    id: cat.id,
    title: cat.title,
    author: cat.author,
    category: canonicalizeCategory(cat.category),
    chapters: getBookChapterCount(cat.id) || 6,
    difficulty: cat.difficulty.toLowerCase() as "easy" | "medium" | "hard",
    estimatedHours: Math.round((cat.estimatedMinutes / 60) * 10) / 10,
    description: desc || cat.title,
    popular: POPULAR_IDS.has(cat.id),
    isNew: NEW_IDS.has(cat.id),
    isFree: FREE_IDS.has(cat.id),
    staffPick: STAFF_PICK_IDS.has(cat.id),
  };
});

export const FEATURED_BOOK =
  ALL_BOOKS.find((book) => book.staffPick) ??
  ALL_BOOKS.find((book) => book.popular) ??
  ALL_BOOKS[0];

export const FEATURED_REASON =
  STAFF_PICK_IDS.has(FEATURED_BOOK.id) ? "Staff Pick" :
  POPULAR_IDS.has(FEATURED_BOOK.id) ? "Staff Pick" :
  NEW_IDS.has(FEATURED_BOOK.id) ? "Recently Added" :
  "Featured";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Featured" },
  { value: "newest", label: "Newest added" },
  { value: "shortest", label: "Shortest read" },
  { value: "alphabetical", label: "Alphabetical" },
];

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Beginner",
  medium: "Intermediate",
  hard: "Advanced",
};

export function bookHref(id: string): string {
  return `/book/library/${id}`;
}

export function getCategoriesWithCounts(books: LibraryBook[]) {
  const counts = new Map<string, number>();
  books.forEach((book) => counts.set(book.category, (counts.get(book.category) || 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function sortBooks(books: LibraryBook[], sort: SortOption): LibraryBook[] {
  const sorted = [...books];
  switch (sort) {
    case "popular":
      return sorted.sort((a, b) => (a.popular === b.popular ? a.title.localeCompare(b.title) : a.popular ? -1 : 1));
    case "newest":
      return sorted.sort((a, b) => (a.isNew === b.isNew ? a.title.localeCompare(b.title) : a.isNew ? -1 : 1));
    case "shortest":
      return sorted.sort((a, b) => a.estimatedHours - b.estimatedHours);
    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}

export function filterAndSortBooks(
  books: LibraryBook[],
  options: { category: string; query: string; sort: SortOption },
): LibraryBook[] {
  let result = books;

  if (options.category !== "All") {
    result = result.filter((book) => book.category === options.category);
  }

  if (options.query.trim()) {
    const query = options.query.toLowerCase();
    result = result.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.category.toLowerCase().includes(query),
    );
  }

  return sortBooks(result, options.sort);
}

export function getBookBadge(book: LibraryBook): { label: string; color: string } | null {
  if (book.isFree) return { label: "Free", color: "var(--accent-emerald)" };
  if (book.isNew) return { label: "New", color: "var(--accent-cyan)" };
  if (book.popular) return { label: "Staff Pick", color: "var(--accent-amber)" };
  if (book.staffPick) return { label: "Staff Pick", color: "var(--accent-amber)" };
  return null;
}

export function coverPath(book: LibraryBook) {
  return getBookCoverPath(book.id, book.coverId);
}

export function avgMinPerChapter(book: LibraryBook) {
  return Math.round((book.estimatedHours * 60) / book.chapters);
}
