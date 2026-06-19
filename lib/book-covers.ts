const REAL_BOOK_COVER_PATHS: Record<string, string> = {
  "antifragile": "/book-covers/antifragile.webp",
  "atomic-habits": "/book-covers/atomic-habits.webp",
  "blue-ocean-strategy": "/book-covers/blue-ocean-strategy.webp",
  "built-to-last": "/book-covers/built-to-last.webp",
  "competing-against-luck": "/book-covers/competing-against-luck.webp",
  "clear-thinking": "/book-covers/clear-thinking.webp",
  "crucial-conversations": "/book-covers/crucial-conversations.webp",
  "deep-work": "/book-covers/deep-work.webp",
  "difficult-conversations": "/book-covers/difficult-conversations.webp",
  "essentialism": "/book-covers/essentialism.webp",
  "execution": "/book-covers/execution.webp",
  "extreme-ownership": "/book-covers/extreme-ownership.webp",
  "games-people-play": "/book-covers/games-people-play.webp",
  "getting-things-done": "/book-covers/getting-things-done.webp",
  "good-strategy-bad-strategy": "/book-covers/good-strategy-bad-strategy.webp",
  "good-to-great": "/book-covers/good-to-great.webp",
  "how-to-talk-to-anyone": "/book-covers/how-to-talk-to-anyone.webp",
  "how-to-win-friends-and-influence-people": "/book-covers/how-to-win-friends-and-influence-people.webp",
  "indistractable": "/book-covers/indistractable.webp",
  "influence": "/book-covers/influence.webp",
  "the-innovators-dilemma": "/book-covers/the-innovators-dilemma.webp",
  "laws-of-human-nature": "/book-covers/laws-of-human-nature.webp",
  "leaders-eat-last": "/book-covers/leaders-eat-last.webp",
  "the-first-20-hours": "/book-covers/the-first-20-hours.webp",
  "limitless": "/book-covers/limitless.webp",
  "made-to-stick": "/book-covers/made-to-stick.webp",
  "make-time": "/book-covers/make-time.webp",
  "make-it-stick": "/book-covers/make-it-stick.webp",
  "measure-what-matters": "/book-covers/measure-what-matters.webp",
  "mistakes-were-made-but-not-by-me": "/book-covers/mistakes-were-made-but-not-by-me.webp",
  "never-split-the-difference": "/book-covers/never-split-the-difference.webp",
  "pitch-anything": "/book-covers/pitch-anything.webp",
  "peak": "/book-covers/peak.webp",
  "playing-to-win": "/book-covers/playing-to-win.webp",
  "pre-suasion": "/book-covers/pre-suasion.webp",
  "predictably-irrational": "/book-covers/predictably-irrational.webp",
  "rich-dad-poor-dad": "/book-covers/rich-dad-poor-dad.webp",
  "seeking-wisdom": "/book-covers/seeking-wisdom.webp",
  "seven-powers": "/book-covers/seven-powers.webp",
  "smarter-faster-better": "/book-covers/smarter-faster-better.webp",
  "so-good-they-cant-ignore-you": "/book-covers/so-good-they-cant-ignore-you.webp",
  "stillness-is-the-key": "/book-covers/stillness-is-the-key.webp",
  "super-thinking": "/book-covers/super-thinking.webp",
  "superforecasting": "/book-covers/superforecasting.webp",
  "talk-like-ted": "/book-covers/talk-like-ted.webp",
  "the-black-swan": "/book-covers/the-black-swan.webp",
  "the-12-week-year": "/book-covers/the-12-week-year.webp",
  "the-33-strategies-of-war": "/book-covers/the-33-strategies-of-war.webp",
  "the-4-hour-workweek": "/book-covers/the-4-hour-workweek.webp",
  "the-48-laws-of-power": "/book-covers/the-48-laws-of-power.webp",
  "the-almanack-of-naval-ravikant": "/book-covers/the-almanack-of-naval-ravikant.webp",
  "the-art-of-war": "/book-covers/the-art-of-war.webp",
  "the-war-of-art": "/book-covers/the-war-of-art.webp",
  "the-charisma-myth": "/book-covers/the-charisma-myth.webp",
  "the-checklist-manifesto": "/book-covers/the-checklist-manifesto.webp",
  "the-courage-to-be-disliked": "/book-covers/the-courage-to-be-disliked.webp",
  "the-elephant-in-the-brain": "/book-covers/the-elephant-in-the-brain.webp",
  "the-gift-of-fear": "/book-covers/the-gift-of-fear.webp",
  "the-great-mental-models-v-1": "/book-covers/the-great-mental-models-v-1.webp",
  "the-great-mental-models-vol-2": "/book-covers/the-great-mental-models-vol-2.webp",
  "the-hard-thing-about-hard-things": "/book-covers/the-hard-thing-about-hard-things.webp",
  "the-lean-startup": "/book-covers/the-lean-startup.webp",
  "the-like-switch": "/book-covers/the-like-switch.webp",
  "the-mole-people": "/book-covers/the-mole-people.webp",
  "the-one-thing": "/book-covers/the-one-thing.webp",
  "the-outsiders": "/book-covers/the-outsiders.webp",
  "the-power-of-habit": "/book-covers/the-power-of-habit.webp",
  "the-prince": "/book-covers/the-prince.webp",
  "the-psychology-of-money": "/book-covers/the-psychology-of-money.webp",
  "the-righteous-mind": "/book-covers/the-righteous-mind.webp",
  "think-and-grow-rich": "/book-covers/think-and-grow-rich.webp",
  "thinking-fast-and-slow": "/book-covers/thinking-fast-and-slow.webp",
  "thinking-in-bets": "/book-covers/thinking-in-bets.webp",
  "tiny-habits": "/book-covers/tiny-habits.webp",
  "ultralearning": "/book-covers/ultralearning.webp",
  "what-every-body-is-saying": "/book-covers/what-every-body-is-saying.webp",
  "you-can't-hurt-me": "/book-covers/you-can't-hurt-me.webp",
  "zero-to-one": "/book-covers/zero-to-one.webp",
};

const BOOK_COVER_ALIASES: Record<string, string> = {
  "the-great-mental-models-vol-1": "the-great-mental-models-v-1",
  "the-laws-of-human-nature": "laws-of-human-nature",
  "you-cant-hurt-me": "you-can't-hurt-me",
};

function dedupe(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function resolveBookCoverKey(bookId: string, coverId?: string): string {
  const rawKey = coverId || bookId;
  return BOOK_COVER_ALIASES[rawKey] ?? rawKey;
}

/**
 * Canonical, single-URL cover path for raw `<img src>` consumers. Returns the
 * universally-supported WebP raster (Safari 14+, all evergreen browsers). The
 * 600×900 rasters live in /public/book-covers and are committed; the original
 * 58MB of traced SVGs were converted to WebP+AVIF (4.6MB / 3.3MB) — see
 * public/book-covers/README.md. next/image consumers should prefer
 * getBookCoverCandidates (AVIF-first with a WebP onError fallback).
 */
export function getBookCoverPath(bookId: string, coverId?: string): string {
  const coverKey = resolveBookCoverKey(bookId, coverId);
  return REAL_BOOK_COVER_PATHS[coverKey] ?? `/book-covers/${coverId || bookId}.webp`;
}

/**
 * Ordered cover-source candidates for the onError fallback chain in the
 * <BookCover> components. AVIF first (smallest), WebP second (the canonical
 * map entry, universal support) so a browser without AVIF support falls back
 * cleanly, then bookId-keyed rasters for any cover not in the curated map.
 */
export function getBookCoverCandidates(bookId: string): string[] {
  const coverKey = resolveBookCoverKey(bookId);
  const mapped = REAL_BOOK_COVER_PATHS[coverKey];

  return dedupe([
    mapped ? mapped.replace(/\.webp$/, ".avif") : undefined,
    mapped,
    `/book-covers/${bookId}.avif`,
    `/book-covers/${bookId}.webp`,
    `/book-covers/${bookId}.jpg`,
    `/book-covers/${bookId}.png`,
    coverKey !== bookId ? `/book-covers/${coverKey}.avif` : undefined,
    coverKey !== bookId ? `/book-covers/${coverKey}.webp` : undefined,
  ]);
}
