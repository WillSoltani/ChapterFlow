/**
 * WP-E14 — the NEW-05 masquerade boundary: the hard wall that keeps a STANDALONE
 * CHAPTER DIAGNOSTIC from ever being mistaken for, filed as, or aggregated into a
 * full-book score (owner policy §3.2 / finding V25-NEW-05 in
 * docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md).
 *
 * A chapter diagnostic reads exactly one chapter in full and is NOT a book score:
 * `full_book_score` is null, certification is "unevaluable", Domain 9 is
 * "unassessable" (see chapterDiagnosticRun.ts). The skill hard-fails chapter
 * SAMPLING but a genuine 1-chapter package validates full-content, so nothing in
 * the file format itself stops a diagnostic from being quoted as a book score —
 * only discipline does. This module makes that discipline mechanical and
 * fail-closed:
 *
 *   1. book-id prefix — every diagnostic book id MUST start with `chapterdiag--`
 *      (the blind id minted by chapterDiagnosticPackage.ts). A canonical book id
 *      (`the-effective-executive`) is refused on sight.
 *   2. segregated root — every diagnostic artifact MUST live under
 *      `state/model-bakeoffs/<bookId>/chapter-diagnostics/…`, NEVER under
 *      `artifacts/chapterflow-evaluation/` (the canonical full-book evaluation
 *      root) or any other tree. A write target outside the run root is refused.
 *   3. no portfolio scripts — the book-evaluator's portfolio aggregation scripts
 *      (`aggregate_results.py`, `export_portfolio_book_update.py`,
 *      `update_portfolio_report.py`, `render_report.py`) turn per-book evaluation
 *      records into a catalog score; invoking any of them on a diagnostic would
 *      launder it into a book score. They are refused by name.
 *   4. labels — every human-facing summary/report string a diagnostic emits
 *      carries the verbatim `CHAPTER DIAGNOSTIC — NOT A BOOK SCORE` banner, so a
 *      misquote is a lie a reader can catch, not an honest confusion.
 *
 * A human can still misquote a diagnostic in prose (the residual risk disclosed
 * in the finding); these guards make every MACHINE path refuse, and make every
 * emitted artifact self-label.
 */

import { resolve, sep } from "node:path";

import { normSlug } from "../lib/chapterPaths.js";
import { bakeoffBookRoot } from "../bakeoff/paths.js";

/** The blind book-id prefix every chapter diagnostic carries (kept in lockstep
 *  with chapterDiagnosticPackage.CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX; re-declared
 *  here so the boundary has no dependency on the package builder and can guard a
 *  raw id in isolation). */
export const CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX = "chapterdiag--" as const;

/** The verbatim banner (owner policy §3.2). Every summary/report string a
 *  diagnostic surfaces to a human MUST contain this exact text. */
export const NOT_A_BOOK_SCORE_LABEL = "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE" as const;

/** The segregation segment under a bake-off book root. Diagnostics never share a
 *  directory with the run's candidate/selection/report artifacts. */
export const CHAPTER_DIAGNOSTICS_DIR_SEGMENT = "chapter-diagnostics" as const;

/** The book-evaluator portfolio scripts that aggregate per-book evaluation
 *  records into a catalog score. Refused by name on any diagnostic path — a
 *  diagnostic is never portfolio input (owner policy §3.2). Matched on the bare
 *  script name whether or not a `.py` suffix / directory prefix is present. */
export const FORBIDDEN_PORTFOLIO_SCRIPTS: readonly string[] = [
  "aggregate_results",
  "export_portfolio_book_update",
  "update_portfolio_report",
  "render_report",
];

/** The canonical full-book evaluation root a diagnostic must NEVER write into —
 *  the single directory whose presence is the strongest "this is a real book
 *  score" signal. Guarded as a substring so any nesting is caught. */
export const CANONICAL_EVALUATION_ROOT_MARKER = "artifacts/chapterflow-evaluation" as const;

export class ChapterDiagnosticBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChapterDiagnosticBoundaryError";
  }
}

// ── 1. book-id prefix ─────────────────────────────────────────────────────────

/** True iff `bookId` is a chapter-diagnostic blind id (prefix-gated). Non-string
 *  or empty is false (not a diagnostic id), never a throw — callers decide. */
export function isChapterDiagnosticBookId(bookId: unknown): boolean {
  return typeof bookId === "string" && bookId.startsWith(CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX) && bookId.length > CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX.length;
}

/** Fail-closed: refuse any book id that is not a `chapterdiag--` blind id. This
 *  is the masquerade wall — a canonical catalog id (`the-effective-executive`)
 *  can never enter a diagnostic path, so a diagnostic record can never be filed
 *  under a real book's identity. */
export function assertChapterDiagnosticBookId(bookId: unknown): string {
  if (!isChapterDiagnosticBookId(bookId)) {
    throw new ChapterDiagnosticBoundaryError(
      `refusing a chapter diagnostic for book id ${JSON.stringify(bookId)}: a diagnostic id MUST start with ` +
      `${JSON.stringify(CHAPTER_DIAGNOSTIC_BOOK_ID_PREFIX)} (a canonical/catalog book id is a masquerade attempt — ` +
      `${NOT_A_BOOK_SCORE_LABEL})`);
  }
  return bookId as string;
}

// ── 2. segregated root ────────────────────────────────────────────────────────

/** The absolute run root for a diagnostic: `state/model-bakeoffs/<bookId>/
 *  chapter-diagnostics/<runId>`. Reuses the bake-off book root so a diagnostic
 *  is a SIBLING of the run's candidate tree, never a canonical tree. Asserts the
 *  prefix first — the root cannot be resolved for a non-diagnostic id. */
export function resolveChapterDiagnosticRunRoot(bookId: string, runId: string, stateRoot?: string): string {
  assertChapterDiagnosticBookId(bookId);
  const safeRunId = normSlug(runId);
  if (!safeRunId) {
    throw new ChapterDiagnosticBoundaryError(`chapter diagnostic runId ${JSON.stringify(runId)} is not a usable directory token`);
  }
  return resolve(bakeoffBookRoot(bookId, stateRoot), CHAPTER_DIAGNOSTICS_DIR_SEGMENT, safeRunId);
}

function isInside(child: string, root: string): boolean {
  const c = resolve(child);
  const r = resolve(root);
  return c === r || c.startsWith(r + sep);
}

/** Fail-closed: refuse any write target that escapes the diagnostic run root.
 *  The canonical full-book evaluation root is refused explicitly (belt-and-
 *  suspenders on top of the containment check) so its marker in a path can never
 *  slip through even if a caller mis-resolves the root. Returns the resolved
 *  absolute path on success so callers can `writeFileSync` the return value. */
export function assertWithinChapterDiagnosticRoot(targetPath: string, runRoot: string): string {
  const abs = resolve(targetPath);
  if (abs.split(sep).join("/").includes(CANONICAL_EVALUATION_ROOT_MARKER)) {
    throw new ChapterDiagnosticBoundaryError(
      `refusing to write a chapter diagnostic into the canonical full-book evaluation root ` +
      `(${CANONICAL_EVALUATION_ROOT_MARKER}): ${abs} — ${NOT_A_BOOK_SCORE_LABEL}`);
  }
  if (!isInside(abs, runRoot)) {
    throw new ChapterDiagnosticBoundaryError(
      `refusing a chapter-diagnostic write outside its segregated run root:\n  target: ${abs}\n  root:   ${resolve(runRoot)}\n` +
      `every diagnostic artifact MUST live under state/model-bakeoffs/<bookId>/${CHAPTER_DIAGNOSTICS_DIR_SEGMENT}/ (${NOT_A_BOOK_SCORE_LABEL})`);
  }
  return abs;
}

// ── 3. no portfolio scripts ───────────────────────────────────────────────────

/** Strip a directory prefix and a `.py` suffix so `scripts/render_report.py`,
 *  `render_report.py`, and `render_report` all resolve to the same bare name. */
function bareScriptName(script: string): string {
  const base = script.split(/[\\/]/).pop() ?? script;
  return base.replace(/\.py$/i, "");
}

/** Fail-closed: refuse any book-evaluator portfolio-aggregation script on a
 *  diagnostic. A diagnostic is never portfolio input, so laundering it through
 *  the catalog-scoring pipeline is a masquerade and is refused by name. */
export function assertNotPortfolioScript(script: string): void {
  const bare = bareScriptName(script);
  if (FORBIDDEN_PORTFOLIO_SCRIPTS.includes(bare)) {
    throw new ChapterDiagnosticBoundaryError(
      `refusing to invoke the portfolio script ${JSON.stringify(bare)} on a chapter diagnostic: portfolio scripts ` +
      `turn per-book evaluation records into a catalog score, and a diagnostic is NOT a book score ` +
      `(${NOT_A_BOOK_SCORE_LABEL})`);
  }
}

// ── 4. labels ─────────────────────────────────────────────────────────────────

/** Prefix any human-facing diagnostic string with the verbatim banner (idempotent
 *  — never double-labels). Use for every summary line, report heading, and stdout
 *  banner a diagnostic emits. */
export function withNotABookScoreLabel(message: string): string {
  return message.includes(NOT_A_BOOK_SCORE_LABEL) ? message : `${NOT_A_BOOK_SCORE_LABEL}: ${message}`;
}

// ── CLI registration (integration lane wires this into src/cli.ts) ────────────

/** The command descriptor shape the integration lane plugs into cli.ts's
 *  dispatch (matches its `run(args, flags) => Promise<number>` handler idiom).
 *  Exported so this lane never edits cli.ts (owner policy §8: lanes export
 *  register*(); the integration writer owns cli.ts). */
export type ChapterDiagnosticCommand = {
  name: string;
  summary: string;
  run: (args: string[], flags: Record<string, string | boolean>) => Promise<number>;
};

/**
 * The `chapter-diagnostic` command registration. Registration ONLY — it does not
 * (and this session cannot) spawn live rater sessions; the integration lane binds
 * the real `runUltraSession` route when it wires the command in. What the handler
 * enforces unconditionally is the masquerade boundary: a non-`chapterdiag--` book
 * id is refused (nonzero), and every line it prints carries the NOT-A-BOOK-SCORE
 * banner. The full orchestration is chapterDiagnosticRun.runChapterDiagnostic().
 */
export function registerChapterDiagnosticCommand(): ChapterDiagnosticCommand {
  return {
    name: "chapter-diagnostic",
    summary:
      "Run a STANDALONE CHAPTER DIAGNOSTIC (dual-blind raters + adjudicator) over one blind chapter. " +
      "Never a book score — records carry full_book_score:null / Domain 9 unassessable.",
    run: async (args: string[], flags: Record<string, string | boolean>): Promise<number> => {
      const bookId = typeof flags["book-id"] === "string" ? (flags["book-id"] as string) : args[0];
      if (!isChapterDiagnosticBookId(bookId)) {
        process.stderr.write(
          withNotABookScoreLabel(
            `refusing: --book-id must be a chapterdiag-- blind id, got ${JSON.stringify(bookId ?? null)}. ` +
            `A chapter diagnostic is never run under a canonical/catalog book id.`) + "\n");
        return 2;
      }
      // Registration stub: enforce the boundary and print the segregated root, but
      // never spawn (no live model calls this session — the integration lane binds
      // the real route). Resolving the root also re-asserts the prefix wall.
      const runId = typeof flags["run-id"] === "string" ? (flags["run-id"] as string) : "unbound";
      let root: string;
      try {
        root = resolveChapterDiagnosticRunRoot(bookId as string, runId);
      } catch (err) {
        process.stderr.write(withNotABookScoreLabel((err as Error).message) + "\n");
        return 2;
      }
      process.stdout.write(
        withNotABookScoreLabel(
          `chapter-diagnostic registered for ${bookId} → ${root}. ` +
          `Wire runChapterDiagnostic() with an ultraSession route to execute (not run here).`) + "\n");
      return 0;
    },
  };
}
