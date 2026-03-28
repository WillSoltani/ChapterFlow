/**
 * Centralized query key factory for TanStack Query.
 *
 * Naming convention:
 *   - ["book", ...] → static content (catalog, chapters, quizzes)
 *   - ["user", ...] → user-specific state (progress, settings, badges)
 *
 * Cache tiers:
 *   Tier 1 (static):    staleTime: Infinity    → catalog, chapter content
 *   Tier 2 (user state): staleTime: 30s        → progress, saved, profile
 *   Tier 3 (computed):   staleTime: 10s        → badges, analytics, dashboard
 *   Tier 4 (ephemeral):  staleTime: 0          → quiz sessions
 */
export const queryKeys = {
  // ── Tier 1: Static Content ────────────────────────────────────────────
  book: {
    catalog: () => ["book", "catalog"] as const,
    detail: (bookId: string) => ["book", "catalog", bookId] as const,
    content: (bookId: string, chapterNumber: number) =>
      ["book", "content", bookId, chapterNumber] as const,
    quizContent: (bookId: string, chapterNumber: number) =>
      ["book", "quiz-content", bookId, chapterNumber] as const,
  },

  // ── Tier 2: User State ────────────────────────────────────────────────
  user: {
    all: () => ["user"] as const,
    profile: () => ["user", "profile"] as const,
    settings: () => ["user", "settings"] as const,
    entitlements: () => ["user", "entitlements"] as const,
    progress: {
      all: () => ["user", "progress"] as const,
      book: (bookId: string) => ["user", "progress", bookId] as const,
    },
    saved: () => ["user", "saved"] as const,
  },

  // ── Tier 3: Computed / Aggregated ─────────────────────────────────────
  dashboard: () => ["user", "dashboard"] as const,
  badges: () => ["user", "badges"] as const,
  flowPoints: () => ["user", "flow-points"] as const,
  analytics: () => ["user", "analytics"] as const,

  // ── Tier 4: Ephemeral ─────────────────────────────────────────────────
  quizSession: (bookId: string, chapterNumber: number) =>
    ["user", "quiz", bookId, chapterNumber] as const,
} as const;
