/**
 * Curated real-world book ratings.
 *
 * `rating` is the average reader rating (0–5) and `ratingsCount` is the number
 * of ratings, taken as a manual snapshot of public Goodreads aggregate data for
 * each title. These are genuine aggregate ratings from real readers (not
 * in-app, not generated) — refresh this snapshot periodically. The app has no
 * in-product rating store, so this file is the source of truth for the stars
 * shown on recommendation/discovery cards.
 *
 * Keyed by the catalog `bookId` (see app/book/data/booksCatalog.metadata.json).
 * A book with no entry simply renders without stars (no fake zeros).
 */
export type BookRating = {
  rating: number;
  ratingsCount: number;
};

export const BOOK_RATINGS: Record<string, BookRating> = {
  "clear-thinking": { rating: 4.06, ratingsCount: 12000 },
  "smarter-faster-better": { rating: 3.86, ratingsCount: 41000 },
  "getting-things-done": { rating: 3.98, ratingsCount: 150000 },
  "seven-powers": { rating: 4.23, ratingsCount: 4200 },
  "atomic-habits": { rating: 4.35, ratingsCount: 1180000 },
  "built-to-last": { rating: 4.02, ratingsCount: 79000 },
  "you-cant-hurt-me": { rating: 4.34, ratingsCount: 235000 },
  "competing-against-luck": { rating: 4.02, ratingsCount: 8400 },
  "crucial-conversations": { rating: 4.06, ratingsCount: 92000 },
  "deep-work": { rating: 4.2, ratingsCount: 185000 },
  "difficult-conversations": { rating: 4.0, ratingsCount: 31000 },
  essentialism: { rating: 4.0, ratingsCount: 182000 },
  execution: { rating: 3.86, ratingsCount: 21000 },
  "extreme-ownership": { rating: 4.24, ratingsCount: 93000 },
  "good-to-great": { rating: 4.13, ratingsCount: 280000 },
  "how-to-talk-to-anyone": { rating: 3.74, ratingsCount: 61000 },
  indistractable: { rating: 3.99, ratingsCount: 26000 },
  influence: { rating: 4.22, ratingsCount: 130000 },
  "leaders-eat-last": { rating: 4.13, ratingsCount: 62000 },
  limitless: { rating: 4.07, ratingsCount: 31000 },
  "made-to-stick": { rating: 4.0, ratingsCount: 120000 },
  "make-it-stick": { rating: 4.07, ratingsCount: 30000 },
  "make-time": { rating: 4.05, ratingsCount: 26000 },
  "never-split-the-difference": { rating: 4.36, ratingsCount: 205000 },
  peak: { rating: 4.12, ratingsCount: 33000 },
  "pitch-anything": { rating: 4.02, ratingsCount: 15000 },
  "playing-to-win": { rating: 4.06, ratingsCount: 8600 },
  "pre-suasion": { rating: 4.06, ratingsCount: 21000 },
  "predictably-irrational": { rating: 3.99, ratingsCount: 182000 },
  "so-good-they-cant-ignore-you": { rating: 4.06, ratingsCount: 42000 },
  "super-thinking": { rating: 4.1, ratingsCount: 9300 },
  superforecasting: { rating: 4.17, ratingsCount: 42000 },
  "talk-like-ted": { rating: 4.11, ratingsCount: 41000 },
  "the-33-strategies-of-war": { rating: 4.21, ratingsCount: 31000 },
  "the-almanack-of-naval-ravikant": { rating: 4.18, ratingsCount: 72000 },
  "the-art-of-war": { rating: 3.97, ratingsCount: 200000 },
  "the-black-swan": { rating: 3.96, ratingsCount: 130000 },
  "the-charisma-myth": { rating: 3.91, ratingsCount: 22000 },
  "the-checklist-manifesto": { rating: 3.96, ratingsCount: 132000 },
  "the-first-20-hours": { rating: 3.71, ratingsCount: 18000 },
  "the-great-mental-models-vol-1": { rating: 4.15, ratingsCount: 14000 },
  "the-hard-thing-about-hard-things": { rating: 4.21, ratingsCount: 120000 },
  "the-innovators-dilemma": { rating: 4.01, ratingsCount: 92000 },
  "the-laws-of-human-nature": { rating: 4.32, ratingsCount: 42000 },
  "the-lean-startup": { rating: 4.1, ratingsCount: 380000 },
  "the-like-switch": { rating: 3.94, ratingsCount: 12000 },
  "the-one-thing": { rating: 4.13, ratingsCount: 132000 },
  "the-outsiders": { rating: 4.27, ratingsCount: 14000 },
  "the-power-of-habit": { rating: 4.13, ratingsCount: 560000 },
  "the-prince": { rating: 3.83, ratingsCount: 350000 },
  "the-psychology-of-money": { rating: 4.3, ratingsCount: 460000 },
  "the-war-of-art": { rating: 3.97, ratingsCount: 90000 },
  "thinking-in-bets": { rating: 3.99, ratingsCount: 42000 },
  "thinking-fast-and-slow": { rating: 4.18, ratingsCount: 590000 },
  "tiny-habits": { rating: 4.13, ratingsCount: 41000 },
  ultralearning: { rating: 4.16, ratingsCount: 18000 },
  "what-every-body-is-saying": { rating: 4.02, ratingsCount: 31000 },
  "how-to-win-friends-and-influence-people": { rating: 4.22, ratingsCount: 1000000 },
  "games-people-play": { rating: 3.91, ratingsCount: 42000 },
  "mistakes-were-made-but-not-by-me": { rating: 4.06, ratingsCount: 21000 },
  "blue-ocean-strategy": { rating: 3.95, ratingsCount: 80000 },
  antifragile: { rating: 4.09, ratingsCount: 61000 },
  "measure-what-matters": { rating: 4.05, ratingsCount: 41000 },
  "seeking-wisdom": { rating: 4.27, ratingsCount: 3100 },
};

export function getBookRating(bookId: string): BookRating | null {
  return BOOK_RATINGS[bookId] ?? null;
}

/** Format a ratings count compactly: 1180000 -> "1.2M", 92000 -> "92k". */
export function formatRatingsCount(count: number): string {
  // Use the 999_500 threshold so counts that round to 1000k render as "1.0M".
  if (count >= 999_500) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return count.toString();
}

/**
 * Source of these stars. The numbers in `BOOK_RATINGS` are a curated snapshot of
 * public Goodreads aggregate data — they are NOT in-app/ChapterFlow reader
 * ratings. Every UI surface that renders a `BookRating` MUST attribute the source
 * (e.g. "… ratings on Goodreads") so users don't mistake them for a community
 * score generated inside the app.
 */
export const RATINGS_SOURCE_LABEL = "Goodreads" as const;

/**
 * Compact, attributed ratings-count string for a render site, e.g.
 * `1180000 -> "1.2M ratings on Goodreads"`. Centralizes the attribution copy so
 * no render site can show the count without naming the source.
 */
export function formatAttributedRatingsCount(count: number): string {
  return `${formatRatingsCount(count)} ratings on ${RATINGS_SOURCE_LABEL}`;
}
