import {
  type BookCatalogItem,
  type BookDifficulty,
  BOOKS_CATALOG,
} from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";

export type LibraryBookStatus = "in_progress" | "completed" | "not_started";

export type LibraryBookEntry = BookCatalogItem & {
  status: LibraryBookStatus;
  progressPercent: number;
  chaptersTotal: number;
  chaptersCompleted: number;
  isNew?: boolean;
  lastActivityAt: string;
};

const DEFAULT_LAST_ACTIVITY = "1970-01-01T00:00:00.000Z";
const FALLBACK_LIBRARY_CATEGORY_ORDER = [
  "Communication",
  "Psychology",
  "Strategy",
  "Productivity",
  "Leadership",
  "Learning",
  "Negotiation",
  "Entrepreneurship",
  "Career",
  "Personal Finance",
  "Finance",
  "Behavioral Economics",
  "Mental Toughness",
  "Resilience",
  "Persuasion",
  "Risk",
  "Wealth",
  "Philosophy",
] as const;

type LibraryCategoryMetadata = {
  popularityRank?: number;
};

const LIBRARY_CATEGORY_METADATA: Record<string, LibraryCategoryMetadata> = {};

function initialChaptersTotal(book: BookCatalogItem): number {
  const bundleSize = getBookChaptersBundle(book.id).chapters.length;
  if (bundleSize > 0) return bundleSize;
  return Math.max(1, Math.round(book.estimatedMinutes / 15));
}

export function buildLibraryCatalog(): LibraryBookEntry[] {
  return BOOKS_CATALOG.map((book) => ({
    ...book,
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: initialChaptersTotal(book),
    chaptersCompleted: 0,
    isNew: true,
    lastActivityAt: DEFAULT_LAST_ACTIVITY,
  }));
}

export function getLibraryBookById(bookId: string): LibraryBookEntry | undefined {
  return buildLibraryCatalog().find((entry) => entry.id === bookId);
}

function rankLibraryCategories(categories: string[]) {
  const fallbackRank = new Map<string, number>(
    FALLBACK_LIBRARY_CATEGORY_ORDER.map((category, index) => [category, index + 1])
  );
  const categoryCount = new Map<string, number>();

  for (const book of BOOKS_CATALOG) {
    categoryCount.set(book.category, (categoryCount.get(book.category) ?? 0) + 1);
  }

  return [...categories].sort((left, right) => {
    const leftRank =
      LIBRARY_CATEGORY_METADATA[left]?.popularityRank ??
      fallbackRank.get(left) ??
      Number.MAX_SAFE_INTEGER;
    const rightRank =
      LIBRARY_CATEGORY_METADATA[right]?.popularityRank ??
      fallbackRank.get(right) ??
      Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftCount = categoryCount.get(left) ?? 0;
    const rightCount = categoryCount.get(right) ?? 0;
    if (leftCount !== rightCount) return rightCount - leftCount;

    return left.localeCompare(right);
  });
}

const derivedCategories = rankLibraryCategories(
  Array.from(new Set(BOOKS_CATALOG.map((book) => book.category)))
);
const derivedDifficulties = Array.from(new Set(BOOKS_CATALOG.map((book) => book.difficulty)));

export const LIBRARY_CATEGORY_OPTIONS: string[] = ["All", ...derivedCategories];
export const LIBRARY_CATEGORY_COUNT = derivedCategories.length;
export const LIBRARY_DIFFICULTY_OPTIONS: string[] = ["All", ...derivedDifficulties];
export const LIBRARY_STATUS_OPTIONS: string[] = [
  "All",
  "In Progress",
  "Completed",
  "Not Started",
];

export type LibraryCategoryFilter = string;
export type LibraryDifficultyFilter = string;
export type LibraryStatusFilter = string;

export type LibrarySortOption =
  | "most_recent"
  | "progress_desc"
  | "title_asc"
  | "difficulty";

export const LIBRARY_SORT_OPTIONS: Array<{
  value: LibrarySortOption;
  label: string;
}> = [
  { value: "most_recent", label: "Most recent" },
  { value: "progress_desc", label: "Progress (high → low)" },
  { value: "title_asc", label: "Title (A → Z)" },
  { value: "difficulty", label: "Difficulty" },
];

export function difficultyRank(value: BookDifficulty): number {
  if (value === "Easy") return 1;
  if (value === "Medium") return 2;
  return 3;
}
