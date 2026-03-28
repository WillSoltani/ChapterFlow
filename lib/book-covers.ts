const REAL_BOOK_COVER_PATHS: Record<string, string> = {
  "atomic-habits": "/book-covers/atomic-habits-20260328-real.jpg",
  "friends-and-influence": "/book-covers/friends-and-influence-20260328-real.jpg",
  "laws-of-human-nature": "/book-covers/laws-of-human-nature-20260328-real.jpg",
  "the-48-laws-of-power": "/book-covers/the-48-laws-of-power-20260328-real.jpg",
};

const BOOK_COVER_ALIASES: Record<string, string> = {
  "48-laws-power": "the-48-laws-of-power",
  "how-to-win-friends": "friends-and-influence",
};

function dedupe(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function resolveBookCoverKey(bookId: string, coverId?: string): string {
  const rawKey = coverId || bookId;
  return BOOK_COVER_ALIASES[rawKey] ?? rawKey;
}

export function getBookCoverPath(bookId: string, coverId?: string): string {
  const coverKey = resolveBookCoverKey(bookId, coverId);
  return REAL_BOOK_COVER_PATHS[coverKey] ?? `/book-covers/${coverId || bookId}.jpg`;
}

export function getBookCoverCandidates(bookId: string): string[] {
  const coverKey = resolveBookCoverKey(bookId);

  return dedupe([
    REAL_BOOK_COVER_PATHS[coverKey],
    `/book-covers/${bookId}.jpg`,
    `/book-covers/${bookId}.jpeg`,
    `/book-covers/${bookId}.png`,
    `/book-covers/${bookId}.webp`,
    `/book-covers/${bookId}.avif`,
    `/book-covers/${bookId}.svg`,
    coverKey !== bookId ? `/book-covers/${coverKey}.jpg` : undefined,
    coverKey !== bookId ? `/book-covers/${coverKey}.jpeg` : undefined,
    coverKey !== bookId ? `/book-covers/${coverKey}.png` : undefined,
    coverKey !== bookId ? `/book-covers/${coverKey}.webp` : undefined,
    coverKey !== bookId ? `/book-covers/${coverKey}.avif` : undefined,
    coverKey !== bookId ? `/book-covers/${coverKey}.svg` : undefined,
  ]);
}
