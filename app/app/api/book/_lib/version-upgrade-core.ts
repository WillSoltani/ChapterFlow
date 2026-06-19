/**
 * PAR-2 — pure decision logic for advancing a started reader's pinned progress
 * to a newer published book version.
 *
 * Background: when a reader first opens a book the app pins the book's current
 * version + S3 content prefix into their progress row, and every later
 * chapter/quiz read resolves content from that PINNED prefix. So a re-publish
 * that fixes a broken chapter or a wrong quiz key (which creates a NEW version
 * at a NEW prefix) never reaches a reader who already started — there was no
 * code path that re-points an existing progress row. This module decides, on
 * load, whether the reader can be SAFELY re-pointed to the current version.
 *
 * This file is intentionally pure (no I/O, no `server-only`) so the safety
 * logic is unit-testable. The S3/DDB orchestration lives in content-service.ts.
 */

/**
 * Minimal manifest shape this module needs (full BookManifest is assignable).
 * Invariants assumed by planProgressVersionUpgrade: `chapterId` values are
 * unique within a manifest and `number` values identify a chapter's position.
 * A missing/duplicate `number` simply fails the identity check (→ keep pinned),
 * so a degraded manifest is safe, never silently mis-mapped.
 */
export type UpgradeManifestLike = {
  chapters: ReadonlyArray<{ chapterId: string; number: number }>;
};

/**
 * Minimal progress fields this module reads (full BookUserProgress is
 * assignable). `unlockedThroughChapterNumber` is normally >= 1 for a started
 * reader; non-finite/< 1 values are tolerated (floored, treated as >= 1).
 */
export type UpgradeProgressInput = {
  pinnedBookVersion: number;
  unlockedThroughChapterNumber: number;
  currentChapterNumber: number;
  completedChapters: number[];
  bestScoreByChapter: Record<string, number>;
};

/** The re-pointed progress fields to persist when an upgrade is approved. */
export type ProgressUpgradePlan = {
  pinnedBookVersion: number;
  contentPrefix: string;
  manifestKey: string;
  currentChapterNumber: number;
  unlockedThroughChapterNumber: number;
  completedChapters: number[];
  bestScoreByChapter: Record<string, number>;
};

/**
 * Decide whether a started reader's pinned progress can be SAFELY re-pointed to
 * a newer published version, and if so return the re-mapped progress fields.
 * Returns `null` (= keep the reader pinned) unless the upgrade is loss-free.
 *
 * Safety gate — PREFIX IDENTITY over the reader's unlocked region:
 *   for every chapter NUMBER n in 1..unlockedThroughChapterNumber, the chapter
 *   at position n in the OLD manifest must map (by `chapterId`) to the SAME
 *   number n in the NEW manifest.
 *
 * Why prefix identity rather than a free chapterId-based renumber:
 *   - the reader's client requests chapters BY NUMBER (and the lock check is a
 *     single contiguous threshold `n > unlockedThroughChapterNumber`).
 *     Renumbering chapters under a live reader would make a still-cached
 *     chapter number resolve to DIFFERENT content and could silently grant or
 *     revoke access — desyncing progress.
 *   - when the unlocked prefix is structurally identical, the reader's already
 *     issued numbers stay valid and ALL stored progress is unchanged
 *     (completed/current/scored chapters are all <= unlockedThrough), so the
 *     remap is the identity and we only re-point version/prefix/manifestKey.
 *
 * Changes ABOVE the unlocked region (append/remove/reorder later chapters) are
 * always safe and DO upgrade — the reader picks up the new numbering for those
 * chapters only after they unlock into that region (and reload). Changes WITHIN
 * the unlocked region (insert/remove/reorder an already-unlocked chapter) return
 * `null`: the reader keeps reading their pinned version (the §11 "non-trivial
 * renumber" case — a future opt-in flow can migrate those readers).
 */
export function planProgressVersionUpgrade(params: {
  newVersion: number;
  newContentPrefix: string;
  newManifestKey: string;
  oldManifest: UpgradeManifestLike;
  newManifest: UpgradeManifestLike;
  progress: UpgradeProgressInput;
}): ProgressUpgradePlan | null {
  const { newVersion, newContentPrefix, newManifestKey, oldManifest, newManifest, progress } =
    params;

  // Only ever advance forward, and only to a real target.
  if (!(newVersion > progress.pinnedBookVersion)) return null;
  if (!newContentPrefix || !newManifestKey) return null;
  // Defensive: a malformed manifest (no chapters array) is never safe to map.
  if (!Array.isArray(oldManifest.chapters) || !Array.isArray(newManifest.chapters)) {
    return null;
  }

  const oldNumberToId = new Map<number, string>();
  for (const chapter of oldManifest.chapters) {
    oldNumberToId.set(chapter.number, chapter.chapterId);
  }
  const newIdToNumber = new Map<string, number>();
  for (const chapter of newManifest.chapters) {
    newIdToNumber.set(chapter.chapterId, chapter.number);
  }

  // Verify prefix identity over EVERY chapter number the reader's progress
  // references — not just 1..unlockedThrough. Normally completed/current/scored
  // chapters are all <= unlockedThrough, but validating the full referenced
  // range means a corrupted/legacy row (e.g. a completed entry ABOVE the unlock
  // threshold) can never carry a number that silently re-points to different
  // content after the upgrade. If any referenced chapter's chapterId moved or
  // vanished in the new manifest, keep the reader pinned.
  const referenced = [
    progress.unlockedThroughChapterNumber,
    progress.currentChapterNumber,
    ...progress.completedChapters,
    ...Object.keys(progress.bestScoreByChapter).map((key) => Number.parseInt(key, 10)),
  ]
    .map((value) => Math.floor(value))
    .filter((value) => Number.isFinite(value) && value >= 1);
  const verifyThrough = referenced.length > 0 ? Math.max(...referenced) : 1;

  for (let n = 1; n <= verifyThrough; n += 1) {
    const chapterId = oldNumberToId.get(n);
    // Old manifest missing a referenced number → can't verify safety.
    if (!chapterId) return null;
    // Chapter moved or was removed at/under the referenced depth → unsafe.
    if (newIdToNumber.get(chapterId) !== n) return null;
  }

  // Prefix identity holds over the whole referenced range → every stored
  // progress number still addresses the same content. Re-point to the new
  // version; keep all progress numbers as-is (the remap is the identity).
  return {
    pinnedBookVersion: newVersion,
    contentPrefix: newContentPrefix,
    manifestKey: newManifestKey,
    currentChapterNumber: progress.currentChapterNumber,
    unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
    completedChapters: progress.completedChapters,
    bestScoreByChapter: progress.bestScoreByChapter,
  };
}
