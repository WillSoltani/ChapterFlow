import catalogMetadata from "@/app/book/data/booksCatalog.metadata.json";
import { getBookCoverCandidates as getCanonicalBookCoverCandidates } from "@/lib/book-covers";

export type BookDifficulty = "Easy" | "Medium" | "Hard";

export type BookCatalogItem = {
  id: string;
  icon: string;
  coverImage?: string;
  title: string;
  author: string;
  category: string;
  categories: string[];
  difficulty: BookDifficulty;
  estimatedMinutes: number;
};

type BookCatalogMetadataEntry = BookCatalogItem & {
  chapterCount: number;
  synopsis: string;
  tags: string[];
};

export type BookCatalogMetadata = BookCatalogMetadataEntry;

const METADATA = catalogMetadata as BookCatalogMetadataEntry[];

export const BOOKS_CATALOG: BookCatalogItem[] = METADATA.map((entry) => ({
  id: entry.id,
  icon: entry.icon,
  coverImage: entry.coverImage,
  title: entry.title,
  author: entry.author,
  category: entry.category,
  categories: entry.categories,
  difficulty: entry.difficulty,
  estimatedMinutes: entry.estimatedMinutes,
}));

export function getBookById(bookId: string): BookCatalogItem | undefined {
  return BOOKS_CATALOG.find((book) => book.id === bookId);
}

const CHAPTER_COUNTS: Record<string, number> = Object.fromEntries(
  METADATA.map((entry) => [entry.id, entry.chapterCount]),
);

export function getBookChapterCount(bookId: string): number {
  return CHAPTER_COUNTS[bookId] ?? 0;
}

export const BOOKS_CATALOG_METADATA: BookCatalogMetadata[] = METADATA;

export function getBookMetadata(
  bookId: string,
): BookCatalogMetadata | undefined {
  return METADATA.find((entry) => entry.id === bookId);
}

const PREFER_GENERATED_COVER_IDS = new Set<string>([]);

export function getBookCoverCandidates(
  book: Pick<BookCatalogItem, "id" | "coverImage">,
): string[] {
  const realFirstCandidates = getCanonicalBookCoverCandidates(book.id);
  const generatedFirstCandidates = [
    `/book-covers/${book.id}.svg`,
    ...realFirstCandidates.filter(
      (candidate) => candidate !== `/book-covers/${book.id}.svg`,
    ),
  ];
  const localCandidates = PREFER_GENERATED_COVER_IDS.has(book.id)
    ? generatedFirstCandidates
    : realFirstCandidates;

  if (!book.coverImage) return localCandidates;
  if (localCandidates.includes(book.coverImage)) return localCandidates;
  return [book.coverImage, ...localCandidates];
}

const SYNOPSIS_MAP: Record<string, string> = Object.fromEntries(
  METADATA.map((entry) => [entry.id, entry.synopsis]),
);

export function getBookSynopsis(bookId: string): string {
  return SYNOPSIS_MAP[bookId] ?? "";
}
