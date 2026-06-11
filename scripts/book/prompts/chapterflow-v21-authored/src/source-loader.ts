/**
 * Source loader. Reads v13's source-freeze bundles for a book and returns
 * structured content per chapter. For TFS the bundle is paraphrase-only
 * (quote-thin), so the returned content is limited to chapter titles, page
 * anchors, and paraphrase notes. For books with richer bundles, this could
 * return actual passages.
 *
 * Agents that want grounding (editor-in-chief, curriculum-planner, breakdown
 * writer) call loadChapterSource(bookId, chapterNumber) and pass the string
 * into the model as context.
 *
 * Meta-stripping: prose sidecars from v13 frequently contain meta-references
 * ("the chapter should...", "the author argues..."). Feeding those into a
 * writer's context reverse-primes the model into emitting the same phrasing
 * downstream — a failure mode (B9) that masquerades as an instruction-following
 * bug. Every loader in this module strips meta lines before returning content,
 * so writers never see them. See FAILURE-MODES.md (B9, B10) for context.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { findRunArtifact } from "./lib/runDirs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Anchored to the REPO ROOT (where .chapterflow/runs actually lives — see
// PIPELINE-HANDOFF §3), not process.cwd(): with the documented invocation
// (cd <pipeline dir> && npx tsx src/cli.ts …) a cwd-relative path resolved
// to <pipeline>/.chapterflow/runs, which doesn't exist, so every loader
// silently returned "no usable source".
const CHAPTERFLOW_RUNS = resolve(__dirname, "../../../../..", ".chapterflow/runs");

/**
 * Patterns that, if found anywhere on a line, mark that line as meta-content
 * we strip before returning the source to a writer. Mirrors a subset of the
 * critic patterns in config/meta-patterns.json — kept inline so this module
 * stays self-contained and the strip stays in lockstep with what the ship
 * gate later flags.
 */
const META_TELL_PATTERNS: RegExp[] = [
  /\bthis chapter\b/i,
  /\bthe chapter\b/i,
  /\bthe author\b/i,
  /\bthe book\b/i,
  /\bin this (chapter|section|book|law)\b/i,
  /\bchapter\s+(opens|argues|says|notes|introduces|reframes|shows|treats|warns|installs|closes|reminds|concludes|emphasizes|adds|explains|continues|begins|moves|uses)\b/i,
  /\b(Clear|Kahneman|Taleb|Housel|Tetlock|Cialdini|Greene|Machiavelli|Duhigg|Eyal|Covey|Ries|Brown|Kolb|Gladwell|Fogg)\s+(argues|says|opens|notes|introduces|explains|writes|claims|points out|observes)\b/i,
  /\bChapter\s+\d+\b/,
  /\bChapter\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)\b/i,
];

function isMetaLine(line: string): boolean {
  return META_TELL_PATTERNS.some((re) => re.test(line));
}

/**
 * Drops any line containing a meta-reference, then collapses runs of blank
 * lines so the result reads cleanly. Returns null if every non-blank line
 * was meta — calling code treats that as "no usable source" rather than
 * passing an empty string to the model.
 */
export function stripMetaReferences(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const kept = lines.filter((line) => !isMetaLine(line));
  const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return null;
  // If the only thing left is whitespace/punctuation, treat as empty.
  if (!/[A-Za-z0-9]/.test(cleaned)) return null;
  return cleaned;
}

// Run resolution is artifact-aware via lib/runDirs: a run dir that doesn't
// contain the requested artifact falls through to an older run that does
// (the rework/zz- burial bug class), and both raw and normSlug bookId dir
// spellings are tolerated.

export function loadChapterSource(bookId: string, chapterNumber: number): string | null {
  const sidecar = findRunArtifact(
    CHAPTERFLOW_RUNS,
    bookId,
    `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.txt`,
  );
  if (!sidecar) return null;
  return stripMetaReferences(readFileSync(sidecar, "utf8"));
}

export function loadBookSource(bookId: string): string | null {
  const bookSourceMd = findRunArtifact(CHAPTERFLOW_RUNS, bookId, "source-freeze/book-source.md");
  if (!bookSourceMd) return null;
  return stripMetaReferences(readFileSync(bookSourceMd, "utf8"));
}

export function loadTableOfContents(bookId: string): string | null {
  const tocJson = findRunArtifact(CHAPTERFLOW_RUNS, bookId, "source-freeze/toc.json");
  return tocJson ? readFileSync(tocJson, "utf8") : null;
}

export type SourceBundle = {
  bookId: string;
  chapter: number | null;
  chapterSource: string | null;
  bookSource: string | null;
  toc: string | null;
  available: boolean;
};

export function loadSourceBundle(bookId: string, chapterNumber?: number): SourceBundle {
  const chapterSource = chapterNumber !== undefined ? loadChapterSource(bookId, chapterNumber) : null;
  const bookSource = loadBookSource(bookId);
  const toc = loadTableOfContents(bookId);
  return {
    bookId,
    chapter: chapterNumber ?? null,
    chapterSource,
    bookSource,
    toc,
    available: !!(chapterSource || bookSource || toc),
  };
}
