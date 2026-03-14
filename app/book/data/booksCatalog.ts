import {
  BOOK_PACKAGES,
  getBookPackagePresentation,
} from "@/app/book/data/bookPackages";

export type BookDifficulty = "Easy" | "Medium" | "Hard";

export type BookCatalogItem = {
  id: string;
  icon: string;
  coverImage?: string;
  title: string;
  author: string;
  category: string;
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
    difficulty: presentation.difficulty,
    estimatedMinutes: totalReadingMinutes(pkg.chapters),
  };
});

export function getBookById(bookId: string): BookCatalogItem | undefined {
  return BOOKS_CATALOG.find((book) => book.id === bookId);
}

export function getBookCoverCandidates(book: Pick<BookCatalogItem, "id" | "coverImage">): string[] {
  if (book.coverImage) return [book.coverImage];
  return [
    `/book-covers/${book.id}.svg`,
    `/book-covers/${book.id}.png`,
    `/book-covers/${book.id}.jpg`,
    `/book-covers/${book.id}.jpeg`,
    `/book-covers/${book.id}.webp`,
    `/book-covers/${book.id}.avif`,
  ];
}

export function getBookSynopsis(bookId: string): string {
  return getBookPackagePresentation(bookId).synopsis;
}
