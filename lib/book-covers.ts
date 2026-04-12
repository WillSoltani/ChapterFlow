const REAL_BOOK_COVER_PATHS: Record<string, string> = {
  "antifragile": "/book-covers/antifragile.svg",
  "atomic-habits": "/book-covers/atomic-habits.svg",
  "blue-ocean-strategy": "/book-covers/blue-ocean-strategy.svg",
  "built-to-last": "/book-covers/built-to-last.svg",
  "competing-against-luck": "/book-covers/competing-against-luck.svg",
  "clear-thinking": "/book-covers/clear-thinking.svg",
  "crucial-conversations": "/book-covers/crucial-conversations.svg",
  "deep-work": "/book-covers/deep-work.svg",
  "difficult-conversations": "/book-covers/difficult-conversations.svg",
  "essentialism": "/book-covers/essentialism.svg",
  "execution": "/book-covers/execution.svg",
  "extreme-ownership": "/book-covers/extreme-ownership.svg",
  "games-people-play": "/book-covers/games-people-play.svg",
  "getting-things-done": "/book-covers/getting-things-done.svg",
  "good-strategy-bad-strategy": "/book-covers/good-strategy-bad-strategy.svg",
  "good-to-great": "/book-covers/good-to-great.svg",
  "how-to-talk-to-anyone": "/book-covers/how-to-talk-to-anyone.svg",
  "how-to-win-friends-and-influence-people": "/book-covers/how-to-win-friends-and-influence-people.svg",
  "indistractable": "/book-covers/indistractable.svg",
  "influence": "/book-covers/influence.svg",
  "the-innovators-dilemma": "/book-covers/the-innovators-dilemma.svg",
  "laws-of-human-nature": "/book-covers/laws-of-human-nature.svg",
  "leaders-eat-last": "/book-covers/leaders-eat-last.svg",
  "the-first-20-hours": "/book-covers/the-first-20-hours.svg",
  "limitless": "/book-covers/limitless.svg",
  "made-to-stick": "/book-covers/made-to-stick.svg",
  "make-time": "/book-covers/make-time.svg",
  "make-it-stick": "/book-covers/make-it-stick.svg",
  "measure-what-matters": "/book-covers/measure-what-matters.svg",
  "mistakes-were-made-but-not-by-me": "/book-covers/mistakes-were-made-but-not-by-me.svg",
  "never-split-the-difference": "/book-covers/never-split-the-difference.svg",
  "pitch-anything": "/book-covers/pitch-anything.svg",
  "peak": "/book-covers/peak.svg",
  "playing-to-win": "/book-covers/playing-to-win.svg",
  "pre-suasion": "/book-covers/pre-suasion.svg",
  "predictably-irrational": "/book-covers/predictably-irrational.svg",
  "seeking-wisdom": "/book-covers/seeking-wisdom.svg",
  "seven-powers": "/book-covers/seven-powers.svg",
  "smarter-faster-better": "/book-covers/smarter-faster-better.svg",
  "so-good-they-cant-ignore-you": "/book-covers/so-good-they-cant-ignore-you.svg",
  "super-thinking": "/book-covers/super-thinking.svg",
  "superforecasting": "/book-covers/superforecasting.svg",
  "talk-like-ted": "/book-covers/talk-like-ted.svg",
  "the-black-swan": "/book-covers/the-black-swan.svg",
  "the-12-week-year": "/book-covers/the-12-week-year.svg",
  "the-33-strategies-of-war": "/book-covers/the-33-strategies-of-war.svg",
  "the-48-laws-of-power": "/book-covers/the-48-laws-of-power.svg",
  "the-almanack-of-naval-ravikant": "/book-covers/the-almanack-of-naval-ravikant.svg",
  "the-art-of-thinking-clearly": "/book-covers/the-art-of-thinking-clearly.svg",
  "the-art-of-war": "/book-covers/the-art-of-war.svg",
  "the-war-of-art": "/book-covers/the-war-of-art.svg",
  "the-charisma-myth": "/book-covers/the-charisma-myth.svg",
  "the-checklist-manifesto": "/book-covers/the-checklist-manifesto.svg",
  "the-courage-to-be-disliked": "/book-covers/the-courage-to-be-disliked.svg",
  "the-elephant-in-the-brain": "/book-covers/the-elephant-in-the-brain.svg",
  "the-gift-of-fear": "/book-covers/the-gift-of-fear.svg",
  "the-great-mental-models-v-1": "/book-covers/the-great-mental-models-v-1.svg",
  "the-great-mental-models-vol-2": "/book-covers/the-great-mental-models-vol-2.svg",
  "the-hard-thing-about-hard-things": "/book-covers/the-hard-thing-about-hard-things.svg",
  "the-lean-startup": "/book-covers/the-lean-startup.svg",
  "the-like-switch": "/book-covers/the-like-switch.svg",
  "the-mole-people": "/book-covers/the-mole-people.svg",
  "the-one-thing": "/book-covers/the-one-thing.svg",
  "the-outsiders": "/book-covers/the-outsiders.svg",
  "the-power-of-habit": "/book-covers/the-power-of-habit.svg",
  "the-prince": "/book-covers/the-prince.svg",
  "the-psychology-of-money": "/book-covers/the-psychology-of-money.svg",
  "the-righteous-mind": "/book-covers/the-righteous-mind.svg",
  "thinking-fast-and-slow": "/book-covers/thinking-fast-and-slow.svg",
  "thinking-in-bets": "/book-covers/thinking-in-bets.svg",
  "tiny-habits": "/book-covers/tiny-habits.svg",
  "ultralearning": "/book-covers/ultralearning.svg",
  "what-every-body-is-saying": "/book-covers/what-every-body-is-saying.svg",
  "you-can't-hurt-me": "/book-covers/you-can't-hurt-me.svg",
  "zero-to-one": "/book-covers/zero-to-one.svg",
};

const BOOK_COVER_ALIASES: Record<string, string> = {
  "the-great-mental-models-vol-1": "the-great-mental-models-v-1",
  "the-laws-of-human-nature": "laws-of-human-nature",
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
