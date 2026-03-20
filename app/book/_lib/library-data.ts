export type BookDifficulty = "Easy" | "Medium" | "Hard";

export type LibraryCategoryFilter = string;
export type LibraryDifficultyFilter = string;
export type LibraryStatusFilter = string;

export type LibrarySortOption =
  | "most_recent"
  | "progress_desc"
  | "title_asc"
  | "difficulty";

export type LibraryCatalogBook = {
  id: string;
  title: string;
  author: string;
  icon: string;
  coverImage?: string;
  category: string;
  categories: string[];
  difficulty: BookDifficulty;
  estimatedMinutes: number;
  chapterCount: number;
  pages?: number;
  synopsis: string;
  tags: string[];
  variantFamily: "EMH" | "PBC";
  publishedVersion: number;
};

export type LibraryChapterSummary = {
  id: string;
  chapterId: string;
  number: number;
  code: string;
  title: string;
  minutes: number;
};

export type LibraryBookDetail = LibraryCatalogBook & {
  chapters: LibraryChapterSummary[];
};

export type LibraryBookStatus = "in_progress" | "completed" | "not_started";

export type LibraryBookEntry = LibraryCatalogBook & {
  status: LibraryBookStatus;
  progressPercent: number;
  chaptersTotal: number;
  chaptersCompleted: number;
  isNew?: boolean;
  lastActivityAt: string;
};

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

export const LIBRARY_STATUS_OPTIONS: LibraryStatusFilter[] = [
  "All",
  "In Progress",
  "Completed",
  "Not Started",
];

export const LIBRARY_SORT_OPTIONS: Array<{
  value: LibrarySortOption;
  label: string;
}> = [
  { value: "most_recent", label: "Most recent" },
  { value: "progress_desc", label: "Progress (high -> low)" },
  { value: "title_asc", label: "Title (A -> Z)" },
  { value: "difficulty", label: "Difficulty" },
];

export function difficultyRank(value: BookDifficulty): number {
  if (value === "Easy") return 1;
  if (value === "Medium") return 2;
  return 3;
}

export function buildLibraryCategoryOptions(
  entries: Array<Pick<LibraryCatalogBook, "category">>
): LibraryCategoryFilter[] {
  const fallbackRank = new Map<string, number>(
    FALLBACK_LIBRARY_CATEGORY_ORDER.map((category, index) => [category, index + 1])
  );
  const categoryCount = new Map<string, number>();

  for (const entry of entries) {
    categoryCount.set(entry.category, (categoryCount.get(entry.category) ?? 0) + 1);
  }

  const derivedCategories = Array.from(new Set(entries.map((entry) => entry.category))).sort(
    (left, right) => {
      const leftRank = fallbackRank.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = fallbackRank.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;

      const leftCount = categoryCount.get(left) ?? 0;
      const rightCount = categoryCount.get(right) ?? 0;
      if (leftCount !== rightCount) return rightCount - leftCount;

      return left.localeCompare(right);
    }
  );

  return ["All", ...derivedCategories];
}

export function buildLibraryDifficultyOptions(
  entries: Array<Pick<LibraryCatalogBook, "difficulty">>
): LibraryDifficultyFilter[] {
  const ordered = Array.from(new Set(entries.map((entry) => entry.difficulty))).sort(
    (left, right) => difficultyRank(left) - difficultyRank(right)
  );
  return ["All", ...ordered];
}
