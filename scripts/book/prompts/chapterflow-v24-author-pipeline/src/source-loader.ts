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
 * Source normalization preserves factual source observations even when they
 * contain words such as "chapter" or "author". It rejects only directive-like
 * lines that attempt to steer the writer or provider, and exposes diagnostics
 * so rejected source fields are auditable instead of silently erased.
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
const CHAPTERFLOW_RUNS = resolve(__dirname, "../.chapterflow/runs");

export type SourceLoaderRoots = Readonly<{ runsRoot?: string }>;

function sourceRunsRoot(roots: SourceLoaderRoots): string {
  return resolve(roots.runsRoot ?? CHAPTERFLOW_RUNS);
}

export type SourceRejectedLine = {
  lineNumber: number;
  reason: string;
  raw: string;
};

export type NormalizedSourceText = {
  raw: string;
  normalized: string | null;
  rejectedFields: SourceRejectedLine[];
};

const DIRECTIVE_PATTERNS: Array<{ reason: string; re: RegExp }> = [
  { reason: "prompt-injection directive", re: /\b(ignore|disregard|override)\s+(previous|prior|all|system|developer)\s+instructions?\b/i },
  { reason: "tool/provider directive", re: /\b(enable|disable|call|use|invoke|run)\s+(websearch|web\s+search|bash|tool|provider|openai|anthropic|claude|api)\b/i },
  { reason: "response-shaping directive", re: /\b(respond|reply|output|write)\s+(only|as|with)\b.*\b(json|markdown|system|developer|tool)\b/i },
  { reason: "role/system directive", re: /\b(you are|act as|system prompt|developer message|assistant must)\b/i },
];

function rejectionReason(line: string): string | null {
  for (const pattern of DIRECTIVE_PATTERNS) {
    if (pattern.re.test(line)) return pattern.reason;
  }
  return null;
}

export function normalizeSourceText(text: string): NormalizedSourceText {
  const lines = text.split(/\r?\n/);
  const rejectedFields: SourceRejectedLine[] = [];
  const kept: string[] = [];
  lines.forEach((line, index) => {
    const reason = rejectionReason(line);
    if (reason && line.trim()) {
      rejectedFields.push({ lineNumber: index + 1, reason, raw: line });
      return;
    }
    kept.push(line);
  });
  const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return { raw: text, normalized: null, rejectedFields };
  // If the only thing left is whitespace/punctuation, treat as empty.
  if (!/[A-Za-z0-9]/.test(cleaned)) return { raw: text, normalized: null, rejectedFields };
  return { raw: text, normalized: cleaned, rejectedFields };
}

/**
 * Backward-compatible loader API. Returns normalized text only, while
 * normalizeSourceText exposes raw text plus rejected-line diagnostics.
 */
export function stripMetaReferences(text: string): string | null {
  return normalizeSourceText(text).normalized;
}

// Run resolution is artifact-aware via lib/runDirs: a run dir that doesn't
// contain the requested artifact falls through to an older run that does
// (the rework/zz- burial bug class), and both raw and normSlug bookId dir
// spellings are tolerated.

export function loadChapterSource(bookId: string, chapterNumber: number, roots: SourceLoaderRoots = {}): string | null {
  const sidecar = findRunArtifact(
    sourceRunsRoot(roots),
    bookId,
    `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.txt`,
  );
  if (!sidecar) return null;
  return stripMetaReferences(readFileSync(sidecar, "utf8"));
}

export function loadBookSource(bookId: string, roots: SourceLoaderRoots = {}): string | null {
  const bookSourceMd = findRunArtifact(sourceRunsRoot(roots), bookId, "source-freeze/book-source.md");
  if (!bookSourceMd) return null;
  return stripMetaReferences(readFileSync(bookSourceMd, "utf8"));
}

export function loadTableOfContents(bookId: string, roots: SourceLoaderRoots = {}): string | null {
  const tocJson = findRunArtifact(sourceRunsRoot(roots), bookId, "source-freeze/toc.json");
  return tocJson ? readFileSync(tocJson, "utf8") : null;
}

export type SourceBundle = {
  bookId: string;
  chapter: number | null;
  chapterSource: string | null;
  rawChapterSource: string | null;
  bookSource: string | null;
  rawBookSource: string | null;
  toc: string | null;
  rejectedFields: SourceRejectedLine[];
  available: boolean;
};

export function loadSourceBundle(bookId: string, chapterNumber?: number, roots: SourceLoaderRoots = {}): SourceBundle {
  let chapterSource: string | null = null;
  let rawChapterSource: string | null = null;
  let bookSource: string | null = null;
  let rawBookSource: string | null = null;
  const rejectedFields: SourceRejectedLine[] = [];
  if (chapterNumber !== undefined) {
    const sidecar = findRunArtifact(
      sourceRunsRoot(roots),
      bookId,
      `sidecars/source/ch${String(chapterNumber).padStart(2, "0")}.source.txt`,
    );
    if (sidecar) {
      rawChapterSource = readFileSync(sidecar, "utf8");
      const normalized = normalizeSourceText(rawChapterSource);
      chapterSource = normalized.normalized;
      rejectedFields.push(...normalized.rejectedFields.map((field) => ({ ...field, reason: `chapterSource: ${field.reason}` })));
    }
  }
  const bookSourceMd = findRunArtifact(sourceRunsRoot(roots), bookId, "source-freeze/book-source.md");
  if (bookSourceMd) {
    rawBookSource = readFileSync(bookSourceMd, "utf8");
    const normalized = normalizeSourceText(rawBookSource);
    bookSource = normalized.normalized;
    rejectedFields.push(...normalized.rejectedFields.map((field) => ({ ...field, reason: `bookSource: ${field.reason}` })));
  }
  const toc = loadTableOfContents(bookId, roots);
  return {
    bookId,
    chapter: chapterNumber ?? null,
    chapterSource,
    rawChapterSource,
    bookSource,
    rawBookSource,
    toc,
    rejectedFields,
    available: !!(chapterSource || bookSource || toc),
  };
}

export type SourceBundleBytes = Readonly<{
  chapterSource?: Uint8Array;
  bookSource?: Uint8Array;
  toc?: Uint8Array;
}>;

/** Pure candidate projection. Supplied bytes are sole authority; no discovery or writes. */
export function sourceBundleFromBytes(bookId: string, chapterNumber: number | undefined, input: SourceBundleBytes): SourceBundle {
  const decode = (bytes: Uint8Array | undefined): string | null => bytes === undefined ? null : Buffer.from(bytes).toString("utf8");
  const rawChapterSource = decode(input.chapterSource);
  const rawBookSource = decode(input.bookSource);
  const chapter = rawChapterSource === null ? null : normalizeSourceText(rawChapterSource);
  const book = rawBookSource === null ? null : normalizeSourceText(rawBookSource);
  const rejectedFields: SourceRejectedLine[] = [];
  if (chapter) rejectedFields.push(...chapter.rejectedFields.map((field) => ({ ...field, reason: `chapterSource: ${field.reason}` })));
  if (book) rejectedFields.push(...book.rejectedFields.map((field) => ({ ...field, reason: `bookSource: ${field.reason}` })));
  const chapterSource = chapter?.normalized ?? null;
  const bookSource = book?.normalized ?? null;
  const toc = decode(input.toc);
  return {
    bookId,
    chapter: chapterNumber ?? null,
    chapterSource,
    rawChapterSource,
    bookSource,
    rawBookSource,
    toc,
    rejectedFields,
    available: Boolean(chapterSource || bookSource || toc),
  };
}
