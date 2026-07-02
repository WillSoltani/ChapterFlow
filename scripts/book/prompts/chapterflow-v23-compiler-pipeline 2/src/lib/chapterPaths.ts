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

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../chapterflow-v23-compiler-pipeline/src/lib

/** The git-tracked, canonical pipeline state dir (what gates/promote read). */
export const CANONICAL_STATE = resolve(__dirname, "../../state");
export const CHAPTERS_DIR = resolve(CANONICAL_STATE, "chapters");
/** This package's OWN root (two levels up from src/lib) — it is designed to be an
 *  extractable standalone package, so REPO_ROOT means its root, not whatever outer
 *  repo it's currently checked out inside of. Everything else in this codebase
 *  (tests, cli.ts, doctor.ts) already treats REPO_ROOT this way; do not repoint it
 *  at the outer ancestor below or `.chapterflow/`, `book-packages/`, etc. resolve
 *  to the wrong place. */
export const REPO_ROOT = resolve(__dirname, "../..");
/**
 * The directory six levels above src/lib — same formula v21's chapterPaths.ts uses
 * for its own REPO_ROOT — i.e. wherever this package is currently NESTED
 * (scripts/book/prompts/<pipeline-dir>/src/lib). Verified on disk (2026-06-30) for
 * every checkout of this pipeline — the main ChapterFlow-books worktree AND its
 * Lane3/Lane4 git worktrees: this resolves to that outer checkout's root, which
 * carries its OWN real, gitignored `state/` dir distinct from CANONICAL_STATE
 * above (the main checkout's is populated: `state/chapters`, `state/qc-orchestrator`
 * — the exact v21 dual-state-dir trap, just one level further out here). A few
 * scripts in this package resolve `"state/chapters"` relative to `process.cwd()`
 * rather than `__dirname` (src/scratch/calibrate-author-check.ts,
 * src/scratch/write-hooked-step2.ts, cost-tracker.ts's default stateRoot) — if any
 * of those ever runs with cwd = that outer root instead of this package's own root,
 * chapter files land there, INVISIBLE to this pipeline's gates. So the shadow check
 * below must watch THIS ancestor, not REPO_ROOT (which by construction can never
 * differ from CANONICAL_STATE's parent and would make the check permanently dead
 * code — the bug this constant replaces). If this package is ever truly extracted
 * to be its own top-level repo, this resolves outside any real repo and the check
 * simply finds nothing there: a safe no-op, not a silent skip.
 */
export const MONOREPO_ANCESTOR = resolve(__dirname, "../../../../../..");
/** The accidental outer-checkout shadow `state/` — chapters here are INVISIBLE to gates. */
export const FORBIDDEN_STATE = resolve(MONOREPO_ANCESTOR, "state");

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
  // Defensive short-circuit, not the primary guard: under every layout verified
  // above (nested in the monorepo checkout or any of its worktrees) `shadow` is
  // genuinely distinct from CHAPTERS_DIR, so this is false in practice. Kept so a
  // future layout where the guessed ancestor happens to coincide with this
  // package's own canonical state can't produce a false positive against itself.
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
