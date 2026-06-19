/**
 * FSRS-5 (Free Spaced Repetition Scheduler) implementation.
 *
 * Based on the open-source FSRS algorithm by Jarrett Ye.
 * See: https://github.com/open-spaced-repetition/fsrs4anki
 */

import type { FSRSCardState, FSRSRating } from "./types";

// ── Default FSRS-5 Parameters ────────────────────────────────────────────────

const DEFAULT_W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.5330,
  0.1670, 1.0019, 1.9395, 0.1100, 0.2939, 2.2697, 0.2315, 2.9898, 0.5163,
  0.6571,
];

const DECAY = -0.5;
const FACTOR = 0.9 ** (1 / DECAY) - 1;

// ── Core Functions ───────────────────────────────────────────────────────────

function initDifficulty(rating: FSRSRating): number {
  return clamp(DEFAULT_W[4] - Math.exp(DEFAULT_W[5] * (rating - 1)) + 1, 1, 10);
}

function initStability(rating: FSRSRating): number {
  return Math.max(DEFAULT_W[rating - 1], 0.1);
}

function nextDifficulty(d: number, rating: FSRSRating): number {
  const newD = d - DEFAULT_W[6] * (rating - 3);
  return clamp(meanRevert(initDifficulty(4), newD), 1, 10);
}

function nextRecallStability(
  d: number,
  s: number,
  r: number,
  rating: FSRSRating
): number {
  const hardPenalty = rating === 2 ? DEFAULT_W[15] : 1;
  const easyBonus = rating === 4 ? DEFAULT_W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(DEFAULT_W[8]) *
        (11 - d) *
        Math.pow(s, -DEFAULT_W[9]) *
        (Math.exp((1 - r) * DEFAULT_W[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function nextForgetStability(d: number, s: number, r: number): number {
  return (
    DEFAULT_W[11] *
    Math.pow(d, -DEFAULT_W[12]) *
    (Math.pow(s + 1, DEFAULT_W[13]) - 1) *
    Math.exp((1 - r) * DEFAULT_W[14])
  );
}

function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

function nextInterval(stability: number, requestedRetention: number): number {
  return Math.max(
    1,
    Math.round((stability / FACTOR) * (Math.pow(requestedRetention, 1 / DECAY) - 1))
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function meanRevert(init: number, current: number): number {
  return DEFAULT_W[7] * init + (1 - DEFAULT_W[7]) * current;
}

// ── Desired-retention target ─────────────────────────────────────────────────
//
// FSRS schedules each card so its predicted retrievability has decayed to
// `desiredRetention` by the moment it next comes due: a HIGHER target ⇒ SHORTER
// intervals ⇒ more frequent reviews. 0.9 is the algorithm's proven default and
// the value every existing card was scheduled under.
//
// SET-3: the Pro "Review retention target" slider (70–95%, app/book/settings)
// lets a paying user personalize this. `retentionFromTargetPercent` converts the
// stored percentage into the fraction `scheduleCard` consumes; `recordReview`
// (fsrs-repo.ts) loads it per review and applies it only for effective-PRO users
// — see that file for why the effect is Pro-gated. Absent / invalid ⇒ DEFAULT,
// so a free user (or anyone without a stored target) keeps the unchanged 0.9.
export const DEFAULT_DESIRED_RETENTION = 0.9;
export const MIN_DESIRED_RETENTION = 0.7;
export const MAX_DESIRED_RETENTION = 0.95;

/**
 * Convert the stored "Review retention target" percentage (70–95, the Pro
 * settings slider) into an FSRS `desiredRetention` fraction. A non-finite /
 * absent value falls back to DEFAULT_DESIRED_RETENTION; any number is clamped to
 * the slider's [70, 95] band (expressed as a fraction) so a corrupt or legacy
 * value can never push the scheduler to an extreme.
 */
export function retentionFromTargetPercent(targetPercent: unknown): number {
  if (typeof targetPercent !== "number" || !Number.isFinite(targetPercent)) {
    return DEFAULT_DESIRED_RETENTION;
  }
  return clamp(targetPercent / 100, MIN_DESIRED_RETENTION, MAX_DESIRED_RETENTION);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function createNewCard(
  cardId: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  front: string,
  back: string
): FSRSCardState {
  const now = new Date().toISOString();
  return {
    userId,
    cardId,
    bookId,
    chapterNumber,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: "new",
    dueAt: now,
    lastReviewAt: now,
    front,
    back,
    createdAt: now,
    updatedAt: now,
  };
}

export function scheduleCard(
  card: FSRSCardState,
  rating: FSRSRating,
  now: Date = new Date(),
  // SET-3: per-user retention target (fraction). Defaults to the proven 0.9 so
  // existing callers / tests keep their current scheduling unchanged.
  desiredRetention: number = DEFAULT_DESIRED_RETENTION
): FSRSCardState {
  const elapsedDays =
    card.state === "new"
      ? 0
      : Math.max(
          0,
          (now.getTime() - new Date(card.lastReviewAt).getTime()) / 86400000
        );

  let newStability: number;
  let newDifficulty: number;
  let newState: FSRSCardState["state"];
  let newLapses = card.lapses;

  if (card.state === "new") {
    newDifficulty = initDifficulty(rating);
    newStability = initStability(rating);
    newState = rating === 1 ? "learning" : "review";
    if (rating === 1) newLapses += 1;
  } else {
    newDifficulty = nextDifficulty(card.difficulty, rating);
    const r = retrievability(elapsedDays, card.stability);

    if (rating === 1) {
      newStability = nextForgetStability(card.difficulty, card.stability, r);
      newState = "relearning";
      newLapses += 1;
    } else {
      newStability = nextRecallStability(
        card.difficulty,
        card.stability,
        r,
        rating
      );
      newState = "review";
    }
  }

  const interval = nextInterval(newStability, desiredRetention);
  const dueAt = new Date(now.getTime() + interval * 86400000);

  return {
    ...card,
    stability: Math.round(newStability * 100) / 100,
    difficulty: Math.round(newDifficulty * 100) / 100,
    elapsedDays: Math.round(elapsedDays * 100) / 100,
    scheduledDays: interval,
    reps: card.reps + 1,
    lapses: newLapses,
    state: newState,
    dueAt: dueAt.toISOString(),
    lastReviewAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function getRetrievability(card: FSRSCardState, now: Date = new Date()): number {
  if (card.state === "new" || card.stability <= 0) return 0;
  const elapsed =
    (now.getTime() - new Date(card.lastReviewAt).getTime()) / 86400000;
  return Math.round(retrievability(elapsed, card.stability) * 1000) / 1000;
}

export function isDue(card: FSRSCardState, now: Date = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime();
}
