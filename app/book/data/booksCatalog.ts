import {
  BOOK_PACKAGES,
  getBookPackagePresentation,
} from "@/app/book/data/bookPackages";
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

function totalReadingMinutes(chapters: Array<{ readingTimeMinutes: number }>): number {
  return chapters.reduce((sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1), 0);
}

export const BOOKS_CATALOG: BookCatalogItem[] = BOOK_PACKAGES.map((pkg) => {
  const presentation = getBookPackagePresentation(pkg.book.bookId);

  return {
    id: pkg.book.bookId,
    icon: presentation.icon,
    coverImage: presentation.coverImage,
    title: pkg.book.title,
    author: pkg.book.author,
    category: pkg.book.categories[0] ?? "General",
    categories: pkg.book.categories,
    difficulty: presentation.difficulty,
    estimatedMinutes: totalReadingMinutes(pkg.chapters),
  };
});

export function getBookById(bookId: string): BookCatalogItem | undefined {
  return BOOKS_CATALOG.find((book) => book.id === bookId);
}

const PREFER_GENERATED_COVER_IDS = new Set<string>([]);

export function getBookCoverCandidates(book: Pick<BookCatalogItem, "id" | "coverImage">): string[] {
  const realFirstCandidates = getCanonicalBookCoverCandidates(book.id);
  const generatedFirstCandidates = [
    `/book-covers/${book.id}.svg`,
    ...realFirstCandidates.filter((candidate) => candidate !== `/book-covers/${book.id}.svg`),
  ];
  const localCandidates = PREFER_GENERATED_COVER_IDS.has(book.id)
    ? generatedFirstCandidates
    : realFirstCandidates;

  if (!book.coverImage) return localCandidates;
  if (localCandidates.includes(book.coverImage)) return localCandidates;
  return [book.coverImage, ...localCandidates];
}

export function getBookSynopsis(bookId: string): string {
  return getBookPackagePresentation(bookId).synopsis;
}
