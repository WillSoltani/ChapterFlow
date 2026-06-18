import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";

/**
 * Two-axis completion (feedback #4) — library + book-rollup DISPLAY helpers (pure).
 *
 * The application axis ("you used it") is DERIVED and read-only; these only shape how
 * it's shown next to the existing knowledge (quiz-pass) signals. The quiz pass stays
 * the sole completion gate — nothing here gates anything.
 */

const VALID_STATES: ReadonlySet<string> = new Set(["none", "committed", "applied"]);

/**
 * Sanitize the server's chapterId-keyed application map for client use.
 *
 * Takes ONLY the server payload — never local progress — so application state can
 * never be reconstructed from or clobbered by local data. A missing / non-object
 * payload yields `{}` (graceful degradation: every consumer reads `map[id] ?? "none"`).
 * Keeps the map sparse by dropping any "none" entries.
 */
export function normalizeApplicationStates(
  raw: unknown,
): Record<string, ChapterApplicationState> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, ChapterApplicationState> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      typeof id === "string" &&
      id.length > 0 &&
      typeof value === "string" &&
      VALID_STATES.has(value) &&
      value !== "none"
    ) {
      out[id] = value as ChapterApplicationState;
    }
  }
  return out;
}

/**
 * Count chapters the reader has APPLIED (followed through). Sparse-map safe — the map
 * only carries committed/applied entries, so this just counts the "applied" ones.
 */
export function countAppliedChapters(
  applicationStates: Record<string, ChapterApplicationState>,
): number {
  let n = 0;
  for (const state of Object.values(applicationStates)) {
    if (state === "applied") n += 1;
  }
  return n;
}

export type ChapterApplicationBadge = {
  tone: "applied" | "committed";
  label: string;
  /** Appended to the chapter card's accessible name (the badge itself is aria-hidden). */
  srSuffix: string;
};

/**
 * The compact per-chapter card badge descriptor. Returns null for "none" so cards
 * without a commitment render exactly as before (graceful degradation, no clutter).
 */
export function getChapterApplicationBadge(
  state: ChapterApplicationState,
): ChapterApplicationBadge | null {
  if (state === "applied") {
    return { tone: "applied", label: "Applied", srSuffix: " · Applied" };
  }
  if (state === "committed") {
    return { tone: "committed", label: "Committed", srSuffix: " · Committed" };
  }
  return null;
}
