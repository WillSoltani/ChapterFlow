/**
 * Pure, catalog-driven starter-prescription scoring.
 *
 * This is the unit-testable seam for `starter-prescription.ts` (which is a
 * `server-only` module and therefore cannot be imported from the node:test
 * runner). All catalog data is INJECTED so this file has no `server-only`
 * import and no static catalog dependency — the server module supplies the real
 * catalog, tests supply a fixture.
 *
 * Why this exists (defect H17): the previous implementation scored against a
 * hardcoded 3-entry `BOOK_META` map (crucial-conversations / thinking-fast-and-
 * slow / the-almanack-of-naval-ravikant). Onboarding's swipe deck is sourced
 * from the FULL published catalog (118 books — see app/onboarding/data/books.ts),
 * so a user can shelve any book. When their shelf contained none of the three
 * scorable titles (e.g. ["atomic-habits","deep-work"]) the candidate set
 * collapsed to empty and the code fell back to those same three hardcoded books
 * — recommending a book the user never selected. The prescription is now derived
 * from the user's actual shelf and the real catalog.
 */

export type StarterPrescription = {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  chapterNumber: 1;
  reason: string;
  reasonDetail: string;
  generatedAt: string;
};

/** Minimal catalog shape the scorer needs (a subset of BookCatalogMetadata). */
export type PrescriptionCatalogBook = {
  id: string;
  title: string;
  author: string;
  category: string;
  categories: string[];
  difficulty: string;
  tags: string[];
};

export type Motivation = "career" | "academic" | "personal" | "curiosity";

const VALID_MOTIVATIONS: Motivation[] = ["career", "academic", "personal", "curiosity"];

const MOTIVATION_LABELS: Record<Motivation, string> = {
  career: "career growth",
  academic: "academic development",
  personal: "personal growth",
  curiosity: "intellectual curiosity",
};

/**
 * Motivation → catalog-category affinity. Keys are normalized category tokens
 * (lower-cased, spaces → hyphens) so they match against a book's normalized
 * `category` + `categories`. These categories all exist in the real catalog, so
 * every motivation can score the bulk of the catalog rather than three books.
 */
const MOTIVATION_CATEGORY_AFFINITY: Record<Motivation, Record<string, number>> = {
  career: {
    leadership: 4,
    management: 4,
    business: 3,
    communication: 3,
    negotiation: 3,
    strategy: 3,
    execution: 2,
    productivity: 2,
    entrepreneurship: 2,
  },
  academic: {
    psychology: 4,
    "decision-making": 4,
    "behavioral-economics": 4,
    learning: 4,
    philosophy: 3,
    strategy: 2,
    "moral-psychology": 3,
  },
  personal: {
    "self-improvement": 4,
    "self-help": 4,
    relationships: 4,
    psychology: 3,
    "mental-toughness": 3,
    communication: 2,
    boundaries: 3,
    productivity: 2,
  },
  curiosity: {
    psychology: 3,
    philosophy: 3,
    "behavioral-economics": 3,
    "decision-making": 3,
    learning: 3,
    classics: 2,
    innovation: 2,
  },
};

/**
 * Interest slug → catalog signal tokens (tags + categories, normalized).
 *
 * Kept in sync with INTEREST_SIGNALS in app/onboarding/data/books.ts (the same
 * taxonomy that decides which books appear under each interest in the swipe
 * deck), so the prescription ranks the user's shelf by the same signals the deck
 * used to build it. Duplicating it here (rather than importing) keeps this core
 * module dependency-free and unit-importable; a test pins the two in sync.
 */
export const INTEREST_SIGNALS: Record<string, string[]> = {
  psychology: ["psychology", "social-psychology", "cognitive-dissonance", "bias", "memory", "behavior-change", "trauma", "temperament", "feelings"],
  productivity: ["productivity", "focus", "attention", "essentialism", "prioritization", "workflow", "interruption-control", "selective-ignorance", "effectiveness-over-efficiency"],
  leadership: ["leadership", "management", "delegation-literacy", "management-systems", "performance-management", "institution-building", "ceos", "decentralization"],
  strategy: ["strategy", "business", "competition", "moats", "competitive-advantage", "blue-ocean-strategy", "where-to-play", "market-entry"],
  communication: ["communication", "business-communication", "body-language", "public-speaking", "listening", "persuasion", "storytelling", "presentations", "nonverbal-communication", "workplace-communication", "messaging", "rapport"],
  philosophy: ["philosophy", "political-philosophy", "classics", "statecraft", "political-realism", "power", "truth-seeking", "uncertainty"],
  negotiation: ["negotiation", "tactical-empathy", "bargaining", "harvard-negotiation-project", "influence", "conflict-resolution"],
  entrepreneurship: ["innovation", "market-creation", "disruptive-innovation", "value-creation", "value-innovation", "execution", "financial-genius-activation"],
  "health-wellness": ["mental-toughness", "sports", "resilience", "endurance", "willpower", "self-discipline", "comfort", "discomfort"],
  "decision-making": ["decision-making", "decision-quality", "judgment", "resulting", "probabilistic-thinking", "forecasting", "incentives", "mental-models", "risk", "calibration", "probability"],
  creativity: ["creativity", "synthetic-and-creative-imagination", "financial-creativity", "ideas", "productive-nonconformity"],
  finance: ["investing", "capital-allocation", "asset-column-ownership", "asset-liability-literacy", "relative-wealth", "money-as-emotional-leverage", "shareholder-returns", "behavioral-wealth-blockers"],
  relationships: ["relationships", "interpersonal-relations", "friendship", "trust", "conflict", "conflict-resolution", "apology", "likability", "social-skills"],
  habits: ["habits", "habit-formation", "behavior-change", "organizational-habits", "identity", "willpower", "self-discipline", "celebration", "baseline"],
  marketing: ["messaging", "persuasion", "storytelling", "market-creation", "noncustomers"],
  "self-awareness": ["identity", "temperament", "self-justification", "cognitive-dissonance", "truth-seeking", "feelings"],
  education: ["learning", "memory", "mental-time-travel", "specialized-knowledge", "skill-stack-apprenticeship", "thinking"],
  writing: ["writing", "storytelling"],
};

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, "-");

/** All normalized signal tokens for a catalog entry (tags + categories + category). */
function bookTokens(book: PrescriptionCatalogBook): Set<string> {
  const tokens = new Set<string>();
  for (const tag of book.tags ?? []) tokens.add(norm(tag));
  for (const cat of book.categories ?? []) tokens.add(norm(cat));
  if (book.category) tokens.add(norm(book.category));
  return tokens;
}

export function coerceMotivation(motivation: string): Motivation {
  return (VALID_MOTIVATIONS as string[]).includes(motivation)
    ? (motivation as Motivation)
    : "curiosity";
}

/**
 * The interest slugs a given book matches (its tags/categories overlap the
 * interest's signal tokens). Used both for scoring and for the human reason.
 */
function matchedInterestsForBook(
  book: PrescriptionCatalogBook,
  interests: string[],
): string[] {
  const tokens = bookTokens(book);
  return interests.filter((slug) => {
    const signals = INTEREST_SIGNALS[slug];
    if (!signals) return false;
    return signals.some((signal) => tokens.has(norm(signal)));
  });
}

/** Per-book score for a (motivation, interests) pair. Higher = better fit. */
function scoreBook(
  book: PrescriptionCatalogBook,
  motivation: Motivation,
  interests: string[],
): number {
  let score = 0;

  const affinity = MOTIVATION_CATEGORY_AFFINITY[motivation];
  const tokens = bookTokens(book);
  for (const [categoryToken, weight] of Object.entries(affinity)) {
    if (tokens.has(categoryToken)) score += weight;
  }

  // Each matched interest adds weight (interest fit dominates motivation fit).
  score += matchedInterestsForBook(book, interests).length * 3;

  // Gentle nudge toward Medium (more approachable) over Hard for a first book.
  if (norm(book.difficulty) === "medium") score += 0.5;

  return score;
}

function buildReason(
  motivation: Motivation,
  matchedInterests: string[],
  bookTitle: string,
): { reason: string; reasonDetail: string } {
  const motLabel = MOTIVATION_LABELS[motivation];

  if (matchedInterests.length > 0) {
    const interestList =
      matchedInterests.length === 1
        ? matchedInterests[0]
        : `${matchedInterests.slice(0, -1).join(", ")} and ${matchedInterests[matchedInterests.length - 1]}`;
    return {
      reason: `Picked for your interest in ${interestList}`,
      reasonDetail: `${bookTitle} aligns with your focus on ${motLabel} and your interest in ${interestList}. Chapter 1 sets the foundation for everything that follows.`,
    };
  }

  return {
    reason: `A strong starting point for ${motLabel}`,
    reasonDetail: `${bookTitle} is a highly-rated starting point for readers focused on ${motLabel}. Chapter 1 sets the foundation for everything that follows.`,
  };
}

/**
 * Choose the best starter book and build the prescription.
 *
 * Candidate selection (root-cause fix for H17):
 *   1. The user's `starterShelf` ∩ catalog — the books they actually selected.
 *      A shelf book NOT in BOOK_META no longer collapses the candidate set; the
 *      whole shelf is now scorable because scoring reads the real catalog.
 *   2. If the shelf is empty (or none of its ids are in the catalog), fall back
 *      to the FULL catalog — not the three former hardcoded titles.
 *
 * `now` is injected so callers (and tests) control `generatedAt`.
 */
export function buildStarterPrescription(params: {
  motivation: string;
  interests: string[];
  starterShelf?: string[];
  catalog: PrescriptionCatalogBook[];
  now?: Date;
}): StarterPrescription | null {
  const { motivation, interests, starterShelf, catalog } = params;
  const mot = coerceMotivation(motivation);

  const byId = new Map(catalog.map((b) => [b.id, b]));

  // 1. Shelf ∩ catalog (preserve shelf order for deterministic tie-breaks).
  const shelfCandidates =
    starterShelf && starterShelf.length > 0
      ? starterShelf
          .map((id) => byId.get(id))
          .filter((b): b is PrescriptionCatalogBook => Boolean(b))
      : [];

  // 2. Fall back to the full catalog (NOT three hardcoded books) when the shelf
  //    contributed nothing scorable.
  const candidates = shelfCandidates.length > 0 ? shelfCandidates : catalog;

  if (candidates.length === 0) return null;

  let best = candidates[0];
  if (best === undefined) return null;
  let bestScore = scoreBook(best, mot, interests);
  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (candidate === undefined) continue; // i ∈ [1, candidates.length)
    const s = scoreBook(candidate, mot, interests);
    // Strictly-greater keeps the first candidate on ties → shelf order wins,
    // which is the order the user expressed their preference in.
    if (s > bestScore) {
      best = candidate;
      bestScore = s;
    }
  }

  const matchedInterests = matchedInterestsForBook(best, interests);
  const { reason, reasonDetail } = buildReason(mot, matchedInterests, best.title);

  return {
    bookId: best.id,
    bookTitle: best.title,
    bookAuthor: best.author,
    chapterNumber: 1,
    reason,
    reasonDetail,
    generatedAt: (params.now ?? new Date()).toISOString(),
  };
}
