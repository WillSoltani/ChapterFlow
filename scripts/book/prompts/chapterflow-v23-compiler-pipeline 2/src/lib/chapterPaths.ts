/**
 * Single source of truth for chapter path / slug / identity conventions.
 *
 * Phase-0 of the redesign (see ../../MASTER-PLAN.md). Every command used to
 * re-implement the "<bookId>-chNN" sibling regex inline, CASE-SENSITIVELY, from
 * `chapter.chapterId`. When the slot-fill rewrite scripts wrote CAPITAL
 * chapterIds (e.g. "Unreasonable-hospitality-ch01") while the files stayed
 * lowercase, the regex matched 0 siblings → the AS5–AS12 intra-book critics
 * SILENTLY SKIPPED and `gate-chapter` printed PASS on a fully templated book.
 *
 * Confirmed live this session: all 20 unreasonable-hospitality chapters had the
 * mismatch and ran 0 intra-book critics. This module makes sibling-matching
 * case-insensitive (so the critics run) and adds an IDN identity guard so a
 * future chapterId≠filename mismatch can never again be silent.
 *
 * CI rule (Phase 0b): no other file may build a `new RegExp(...-ch...)` sibling
 * matcher — use isSiblingFile / parseChapterId here so the fix lives in one place.
 */

import { readdirSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../chapterflow-v21-authored/src/lib

/** The git-tracked, canonical pipeline state dir (what gates/promote read). */
export const CANONICAL_STATE = resolve(__dirname, "../../state");
export const CHAPTERS_DIR = resolve(CANONICAL_STATE, "chapters");
/** Repo root (six levels up from src/lib). */
export const REPO_ROOT = resolve(__dirname, "../..");
/** The accidental repo-root shadow `state/` — chapters here are INVISIBLE to gates. */
export const FORBIDDEN_STATE = resolve(REPO_ROOT, "state");

/** Lowercase + collapse non-alphanumerics to '-'. Book slugs are already
 *  lowercase-hyphen, so this is near-identity for them and only normalizes the
 *  casing/punctuation drift the slot-fill scripts introduced. */
export function normSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Parse "<bookId>-ch<NN>" case-insensitively → normalized bookId + chapter number. */
export function parseChapterId(id: string): { bookId: string; num: number } | null {
  const m = id.match(/^(.+)-ch0*(\d{1,3})$/i);
  return m ? { bookId: normSlug(m[1]), num: parseInt(m[2], 10) } : null;
}

/** The canonical chapter filename for a chapterId. */
export function chapterFileName(chapterId: string): string {
  return `${chapterId}.v21-native.chapter.json`;
}

/** The chapterId a file SHOULD carry (its stem), for the identity check. */
export function chapterIdFromFileName(fileName: string): string {
  return basename(fileName).replace(/\.v21-native\.chapter\.json$/i, "");
}

/** Case-insensitive: does `fileName` belong to `bookId`? Replaces every inline
 *  `new RegExp(\`^${bookId}-ch...\`)` sibling matcher in the codebase. */
export function isSiblingFile(fileName: string, bookId: string): boolean {
  const m = basename(fileName).match(/^(.+)-ch\d{1,3}\.v21-native\.chapter\.json$/i);
  return !!m && normSlug(m[1]) === normSlug(bookId);
}

/**
 * Throw if the accidental repo-root `state/chapters` shadow dir holds chapter
 * files. Those are INVISIBLE to gates/promote (which read CHAPTERS_DIR), so a
 * generation/repair that lands there silently diverges from what ships — the
 * verified dual-directory hazard. Commands call this at entry so the divergence
 * can never recur silently. No-op when the shadow is absent/empty (the post-
 * migrate-state state).
 */
export function assertNoShadowStateDir(): void {
  const shadow = resolve(FORBIDDEN_STATE, "chapters");
  // Standalone v22 packages keep the canonical state directory at repoRoot/state.
  // In that layout the old "forbidden shadow" path is identical to canonical;
  // do not flag the real working state as shadow state.
  if (resolve(shadow) === resolve(CHAPTERS_DIR)) return;
  let files: string[] = [];
  try {
    files = readdirSync(shadow).filter((f) => f.endsWith(".chapter.json"));
  } catch {
    return; // shadow dir doesn't exist — good
  }
  if (files.length > 0) {
    throw new Error(
      `FATAL: shadow state dir holds ${files.length} chapter file(s): ${shadow}\n` +
        `These are INVISIBLE to gates/promote (canonical is ${CHAPTERS_DIR}) — the divergence / "missing chapter" hazard.\n` +
        `Reconcile:  npx tsx src/cli.ts migrate-state            (dry-run)\n` +
        `then:       npx tsx src/cli.ts migrate-state --apply [--prefer-canonical|--prefer-shadow]`,
    );
  }
}

export type IdentityFinding = { checkId: string; severity: "blocker" | "major" | "minor"; message: string; evidence?: string };

/**
 * IDN — chapter identity guard. The intra-book critics match siblings on
 * `chapterId`; a chapterId that doesn't equal its filename stem silently skips
 * them (the verified casing bug). This surfaces the mismatch at chapter time.
 *
 * SHADOW ROLLOUT (per the red-team mandate): ships as `major` (advisory, does
 * not block) so turning the casing fix on does not simultaneously hard-block the
 * 20 already-mismatched UH chapters. It promotes to `blocker` once chapterId
 * emission is normalized at the source (the new STEP-2 contract mandates
 * lowercase chapterId == filename; `fix-chapter-ids` migrates existing files).
 */
export function checkChapterIdentity(chapter: { chapterId?: string }, filePath: string): IdentityFinding[] {
  const stem = chapterIdFromFileName(filePath);
  const id = chapter.chapterId ?? "";
  if (id !== stem) {
    const sameWhenNormalized = normSlug(id) === normSlug(stem);
    return [
      {
        checkId: "IDN1.chapterid_filename_mismatch",
        severity: "major", // shadow; promote to blocker after fix-chapter-ids migration
        message:
          `chapterId "${id}" != filename stem "${stem}"` +
          (sameWhenNormalized ? " (casing/punctuation only)" : "") +
          `. Intra-book critics match siblings on chapterId; a mismatch can silently skip AS5–AS12. ` +
          `Normalize it: \`npx tsx src/cli.ts fix-chapter-ids ${parseChapterId(stem)?.bookId ?? "<bookId>"}\`. ` +
          `[shadow severity: major — promotes to blocker after migration]`,
        evidence: id,
      },
    ];
  }
  return [];
}
