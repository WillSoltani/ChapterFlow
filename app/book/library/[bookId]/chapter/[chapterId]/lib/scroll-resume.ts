// Pure, DOM-free storage + decision helpers for the reader's "pick up where you
// left off" scroll restore (Settings → Reading → resumeWhereLeftOff, default ON).
//
// The toggle promised "Automatically scroll to your last reading position" but
// had no reader consumer — the reader only ever scrolled chapters to the top
// (SET-6). The hook `useScrollResume` owns the DOM side (a passive scroll
// listener + a one-shot `window.scrollTo` on chapter entry); this module owns
// the localStorage map and the restore math so both stay unit-testable.
//
// Persistence is intentionally CLIENT-ONLY (its own localStorage key, never the
// server-synced chapter-state) so it needs no route/schema change and can't trip
// the chapter-state PATCH validator.

/** Single localStorage key holding a bounded `{ "<bookId>::<chapterId>": {y,t} }` map. */
export const SCROLL_RESUME_STORAGE_KEY = "book-accelerator:scroll-resume:v1";

// Re-entering within ~one screen of the top is indistinguishable from a fresh
// read; restoring a 40px offset is just jitter. Below this we leave the page at
// the top (and don't bother persisting an entry), so a quick glance near the top
// never strands the next visit a little way down.
export const SCROLL_RESUME_MIN_OFFSET = 200;

// One entry per chapter ever scrolled would grow without bound across a large
// library; keep the newest N by last-saved time (LRU) so localStorage stays tiny.
export const SCROLL_RESUME_MAX_ENTRIES = 200;

/** A saved scroll position: `y` = window.scrollY (px), `t` = save time (ms epoch, for LRU). */
export type ScrollResumeEntry = { y: number; t: number };
export type ScrollResumeMap = Record<string, ScrollResumeEntry>;

// Composite key for one chapter's saved position. Granularity is per-CHAPTER,
// NOT per-tab: one offset per (book, chapter). On re-entry the reader lands on
// its persisted tab and restores this single offset. Because an intra-chapter
// tab switch scroll-to-tops (persisting ~0 → clears the entry, see
// upsertScrollResume), the stored offset tracks the LAST-scrolled tab — almost
// always the tab you resume on. The offset is clamped to the live document
// (decideRestoreTarget), so a rare tab-vs-offset mismatch can at most land at
// the page end, never past it.
export function scrollResumeKey(bookId: string, chapterId: string): string {
  return `${bookId}::${chapterId}`;
}

/** Parse the stored map, dropping any malformed entries. Never throws. */
export function parseScrollResumeMap(raw: string | null): ScrollResumeMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ScrollResumeMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key || !value || typeof value !== "object") continue;
      const y = (value as { y?: unknown }).y;
      const t = (value as { t?: unknown }).t;
      if (typeof y !== "number" || !Number.isFinite(y) || y < 0) continue;
      const ts = typeof t === "number" && Number.isFinite(t) && t >= 0 ? t : 0;
      out[key] = { y: Math.round(y), t: ts };
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeScrollResumeMap(map: ScrollResumeMap): string {
  return JSON.stringify(map);
}

/** Keep only the newest `maxEntries` by save time (deterministic tiebreak on key). */
export function pruneScrollResumeMap(
  map: ScrollResumeMap,
  maxEntries: number = SCROLL_RESUME_MAX_ENTRIES
): ScrollResumeMap {
  const keys = Object.keys(map);
  if (keys.length <= maxEntries) return map;
  const newest = keys
    // Newest first by save time; on a tie, the alphabetically-earlier key wins
    // (a deterministic, arbitrary tiebreak so prune is stable across runs).
    .sort((a, b) => map[b].t - map[a].t || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, maxEntries);
  const out: ScrollResumeMap = {};
  for (const key of newest) out[key] = map[key];
  return out;
}

// Record (or clear) a chapter's offset, returning a NEW map. Offsets below the
// threshold remove the entry so re-entry goes cleanly to the top instead of
// restoring jitter (and so a programmatic scroll-to-top on a tab switch erases a
// now-stale deeper position). Always prunes to the cap when it grows.
export function upsertScrollResume(
  map: ScrollResumeMap,
  key: string,
  y: number,
  now: number,
  minOffset: number = SCROLL_RESUME_MIN_OFFSET,
  maxEntries: number = SCROLL_RESUME_MAX_ENTRIES
): ScrollResumeMap {
  const next: ScrollResumeMap = { ...map };
  const rounded = Number.isFinite(y) ? Math.max(0, Math.round(y)) : 0;
  if (rounded < minOffset) {
    delete next[key];
    return next; // shrinking — can't exceed the cap, so skip the prune
  }
  next[key] = { y: rounded, t: Number.isFinite(now) && now >= 0 ? now : 0 };
  return pruneScrollResumeMap(next, maxEntries);
}

/** The saved offset for a chapter, or null when there's nothing worth restoring. */
export function getScrollResumeOffset(
  map: ScrollResumeMap,
  key: string,
  minOffset: number = SCROLL_RESUME_MIN_OFFSET
): number | null {
  const entry = map[key];
  if (!entry) return null;
  return entry.y >= minOffset ? entry.y : null;
}

// Decide where to scroll on chapter entry. Returns null to mean "leave at top".
// Clamps to the document's scrollable range so a since-shortened chapter (e.g. a
// shorter depth variant, or a different reading-mode rendering) never tries to
// scroll past its end and land somewhere arbitrary.
export function decideRestoreTarget(params: {
  savedOffset: number | null;
  maxScroll: number;
  minOffset?: number;
}): number | null {
  const { savedOffset, maxScroll } = params;
  const minOffset = params.minOffset ?? SCROLL_RESUME_MIN_OFFSET;
  if (savedOffset == null || savedOffset < minOffset) return null;
  if (!Number.isFinite(maxScroll) || maxScroll < minOffset) return null;
  return Math.min(savedOffset, Math.max(0, Math.round(maxScroll)));
}
