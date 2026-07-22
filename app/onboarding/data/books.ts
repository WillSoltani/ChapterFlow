/* ── Onboarding book catalog ──────────────────────────────────────────────
 *
 * Sourced from the REAL published catalog (app/book/data/booksCatalog) — the
 * same published catalog the user lands in after onboarding — not a hand-
 * maintained stub. The previous 3-book list (crucial-conversations / thinking-
 * fast-and-slow / almanack) dead-ended the swipe deck after one left-swipe. Now
 * every catalog book is a swipeable card, ranked by how well its tags/categories
 * match the interests the user picked.
 *
 * The catalog module is client-safe (it only imports a static metadata JSON +
 * lib/book-covers), so this import is bundled — no API call needed to seed the
 * deck. Counts shown to the user must come from lib/catalog-stats, never a
 * literal.
 */

import {
  BOOKS_CATALOG_METADATA,
  type BookCatalogMetadata,
} from "@/app/book/data/booksCatalog";

export interface OnboardingBook {
  id: string;
  title: string;
  author: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimatedHours: number;
  gradient: string;
  interests: string[]; // interest slugs this book maps to (drives deck ranking)
  tagline: string; // short description for swipe cards
  cover: string | null; // resolved cover image path (real cover or null)
}

/* ── Interest taxonomy ──────────────────────────────────────────────────────
 *
 * The onboarding interest slugs and, for each, the catalog signals (tags +
 * categories, normalized) that indicate a book belongs to it. Catalog tags are
 * granular and lower-case-hyphenated; categories are Title Case multi-word, so
 * both sides are normalized (lower-case, spaces → hyphens) before comparison.
 *
 * Keep this list in sync with the topics rendered in StepInterests. Topics that
 * the catalog has no real representation for (science / history / technology)
 * are intentionally omitted: selecting them only surfaced incidental tag noise
 * and didn't differentiate the deck.
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

/** All onboarding interest slugs, in display order. */
export const ONBOARDING_INTERESTS = Object.keys(INTEREST_SIGNALS);

/* ── Catalog → OnboardingBook mapping ──────────────────────────────────────── */

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, "-");

/** All normalized signal tokens for a catalog entry (tags + categories). */
function bookTokens(entry: BookCatalogMetadata): Set<string> {
  const tokens = new Set<string>();
  for (const tag of entry.tags) tokens.add(norm(tag));
  for (const cat of entry.categories) tokens.add(norm(cat));
  tokens.add(norm(entry.category));
  return tokens;
}

/** Which interest slugs a catalog book belongs to. */
function interestsForBook(entry: BookCatalogMetadata): string[] {
  const tokens = bookTokens(entry);
  return ONBOARDING_INTERESTS.filter((slug) =>
    (INTEREST_SIGNALS[slug] ?? []).some((signal) => tokens.has(norm(signal))),
  );
}

/* On-brand decorative gradients used as the cover placeholder (behind the real
 * cover image, and as the fallback if a cover ever fails to load). Chosen
 * deterministically per book so a given title always looks the same. */
const GRADIENTS = [
  "linear-gradient(135deg, #0f766e, #0f172a)",
  "linear-gradient(135deg, #0f172a, #1d4ed8)",
  "linear-gradient(135deg, #0f172a, #155e75)",
  "linear-gradient(135deg, #312e81, #0f172a)",
  "linear-gradient(135deg, #134e4a, #1e293b)",
  "linear-gradient(135deg, #1e1b4b, #0e7490)",
  "linear-gradient(135deg, #042f2e, #155e75)",
  "linear-gradient(135deg, #1e293b, #4c1d95)",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  // GRADIENTS is non-empty, so the hashed index is in-bounds.
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]!;
}

function coverFor(entry: BookCatalogMetadata): string | null {
  // Every catalog entry carries a real cover path (verified present on disk).
  // The swipe card keeps a gradient + title fallback if one ever fails to load.
  return entry.coverImage ?? null;
}

export const ONBOARDING_BOOKS: OnboardingBook[] = BOOKS_CATALOG_METADATA.map(
  (entry) => ({
    id: entry.id,
    title: entry.title,
    author: entry.author,
    category: entry.category,
    difficulty: entry.difficulty,
    estimatedHours: Math.max(0.5, Math.round((entry.estimatedMinutes / 60) * 10) / 10),
    gradient: gradientFor(entry.id),
    interests: interestsForBook(entry),
    tagline: entry.synopsis,
    cover: coverFor(entry),
  }),
);

const BOOKS_BY_ID = new Map(ONBOARDING_BOOKS.map((b) => [b.id, b]));

export function getBookById(id: string): OnboardingBook | undefined {
  return BOOKS_BY_ID.get(id);
}

/** Cover image path for a book id, or null (e.g. the synthetic sample lesson). */
export function getBookCoverPath(bookId: string): string | null {
  return BOOKS_BY_ID.get(bookId)?.cover ?? null;
}
