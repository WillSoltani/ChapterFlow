const REAL_BOOK_COVER_PATHS: Record<string, string> = {
  "crucial-conversations": "/book-covers/crucial-conversations.svg",
  "the-power-of-habit": "/book-covers/the-power-of-habit.svg",
  essentialism: "/book-covers/essentialism.svg",
  "make-time": "/book-covers/make-time.svg",
  "what-every-body-is-saying": "/book-covers/what-every-body-is-saying.svg",
  "deep-work": "/book-covers/deep-work.svg",
  "the-prince": "/book-covers/the-prince.svg",
  "tiny-habits": "/book-covers/tiny-habits.svg",
  "predictably-irrational": "/book-covers/predictably-irrational.svg",
  "the-psychology-of-money": "/book-covers/the-psychology-of-money.svg",
  "thinking-fast-and-slow": "/book-covers/thinking-fast-and-slow.svg",
  "the-almanack-of-naval-ravikant": "/book-covers/the-almanack-of-naval-ravikant.svg",
  "the-laws-of-human-nature": "/book-covers/laws-of-human-nature.svg",
  "the-hard-thing-about-hard-things": "/book-covers/the-hard-thing-about-hard-things.svg",
  "leaders-eat-last": "/book-covers/leaders-eat-last.svg",
  "good-to-great": "/book-covers/good-to-great.svg",
  "how-to-talk-to-anyone": "/book-covers/how-to-talk-to-anyone.svg",
  indistractable: "/book-covers/indistractable.svg",
  "never-split-the-difference": "/book-covers/never-split-the-difference.svg",
  "pitch-anything": "/book-covers/pitch-anything.svg",
  "you-can't-hurt-me": "/book-covers/you-can't-hurt-me.svg",
  "extreme-ownership": "/book-covers/extreme-ownership.svg",
};

const BOOK_COVER_ALIASES: Record<string, string> = {};

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
