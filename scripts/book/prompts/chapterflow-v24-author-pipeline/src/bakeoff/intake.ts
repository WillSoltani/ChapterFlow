/**
 * Model bake-off — draft intake.
 *
 * Accepts the operator's draft document (.md/.txt/.pdf/.docx), NEVER mutates the
 * original, and projects it into an immutable, hashed input artifact under the
 * run's shared-inputs/ tree:
 *
 *   shared-inputs/draft/<original file name>     — byte-exact copy
 *   shared-inputs/draft/draft-extracted.txt      — the extracted text candidates'
 *                                                  research is grounded in
 *   (both recorded, with hashes + extraction method, in DraftIntakeV1)
 *
 * Title/author/bookId resolution: explicit overrides always win; otherwise the
 * draft's front matter or first heading is used when unambiguous. Low-confidence
 * identity NEVER blocks generation — it blocks PUBLICATION (runBakeoff downgrades
 * publish and asks one concise question instead).
 */

import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { basename, extname, resolve } from "path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import type { DraftIntakeV1 } from "./types.js";
import { pipelineRel, sha256File, sha256Hex, type BakeoffRoots } from "./paths.js";

export type IntakeOverrides = { title?: string; author?: string; bookId?: string };

export type ExtractorDeps = {
  /** Run an external extraction tool; throws when the tool is unavailable/fails.
   *  Injectable so tests never need pdftotext/textutil installed. */
  execTool?: (bin: string, args: string[]) => string;
};

export class DraftIntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftIntakeError";
  }
}

const SUPPORTED = new Set(["md", "txt", "pdf", "docx"]);

function defaultExecTool(bin: string, args: string[]): string {
  return execFileSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Extract plain text from the draft. md/txt are verbatim; pdf uses pdftotext;
 *  docx uses macOS textutil. Fail-closed with an actionable message — a bake-off
 *  must never silently research from an empty extraction. */
export function extractDraftText(
  absPath: string,
  fileType: string,
  deps: ExtractorDeps = {},
): { text: string; method: string } {
  const execTool = deps.execTool ?? defaultExecTool;
  if (fileType === "md" || fileType === "txt") {
    return { text: readFileSync(absPath, "utf8"), method: "verbatim-utf8" };
  }
  if (fileType === "pdf") {
    try {
      return { text: execTool("pdftotext", ["-layout", absPath, "-"]), method: "pdftotext -layout" };
    } catch (err) {
      throw new DraftIntakeError(
        `could not extract text from PDF draft ${absPath}: pdftotext failed or is not installed (${(err as Error).message.split("\n")[0]}). ` +
        `Install poppler (brew install poppler) or supply the draft as .md/.txt.`,
      );
    }
  }
  if (fileType === "docx") {
    try {
      return { text: execTool("textutil", ["-convert", "txt", "-stdout", absPath]), method: "textutil -convert txt" };
    } catch (err) {
      throw new DraftIntakeError(
        `could not extract text from DOCX draft ${absPath}: textutil failed (${(err as Error).message.split("\n")[0]}). ` +
        `Supply the draft as .md/.txt, or convert it manually.`,
      );
    }
  }
  throw new DraftIntakeError(`unsupported draft type ".${fileType}" — supported: ${[...SUPPORTED].map((t) => `.${t}`).join(" ")}`);
}

/** "The 7 Habits of Highly Effective People" → "the-7-habits-of-highly-effective-people". */
export function titleToBookId(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type IdentityGuess = {
  title: string | null;
  author: string | null;
  source: DraftIntakeV1["identitySource"];
  confident: boolean;
};

/** Infer title/author from the extracted text. Only HIGH-confidence signals mark
 *  the identity confident: YAML front matter with both fields, or an explicit
 *  "# Title" + "by Author" pair near the top. Everything else is provisional. */
export function inferDraftIdentity(text: string, fileName: string): IdentityGuess {
  const head = text.slice(0, 4000);

  // YAML front matter: --- title: X / author: Y ---
  const fm = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    const titleM = fm[1].match(/^title:\s*["']?(.+?)["']?\s*$/mi);
    const authorM = fm[1].match(/^author:\s*["']?(.+?)["']?\s*$/mi);
    const title = titleM?.[1]?.trim() || null;
    const author = authorM?.[1]?.trim() || null;
    if (title) return { title, author, source: "front-matter", confident: Boolean(title && author) };
  }

  // First markdown heading + a nearby "by <Author>" line.
  const headingM = head.match(/^#\s+(.+?)\s*$/m);
  if (headingM) {
    const title = headingM[1].replace(/[#*_`]/g, "").trim();
    const afterHeading = head.slice((headingM.index ?? 0) + headingM[0].length, (headingM.index ?? 0) + headingM[0].length + 400);
    // Case-sensitive name pattern ("Cal Author") — an /i flag here would let
    // [A-Z] swallow the following lowercase line across the \s+ separator.
    const byM = afterHeading.match(/^\s*(?:###?\s*)?[bB]y\s+([A-Z][\w.'-]+(?: [A-Z][\w.'-]+){0,4})\s*$/m);
    const author = byM?.[1]?.trim() || null;
    if (title) return { title, author, source: "heading", confident: Boolean(author) };
  }

  // Filename fallback — provisional only, publication must confirm.
  const stem = basename(fileName, extname(fileName)).replace(/[-_]+/g, " ").trim();
  if (stem) {
    const title = stem.replace(/\b\w/g, (c) => c.toUpperCase());
    return { title, author: null, source: "filename", confident: false };
  }
  return { title: null, author: null, source: "unresolved", confident: false };
}

/** Resolve the bookId BEFORE the run root exists (the run root is keyed on it).
 *  Explicit override wins; otherwise infer from the draft's identity signals. */
export function resolveBookIdForDraft(draftPath: string, overrides: IntakeOverrides = {}, deps: ExtractorDeps = {}): string {
  if (overrides.bookId) return overrides.bookId;
  if (overrides.title) return titleToBookId(overrides.title);
  const absPath = resolve(draftPath);
  if (!existsSync(absPath)) throw new DraftIntakeError(`draft not found: ${absPath}`);
  const fileType = extname(absPath).slice(1).toLowerCase();
  if (!SUPPORTED.has(fileType)) {
    throw new DraftIntakeError(`unsupported draft type ".${fileType}" (${absPath}) — supported: .md .txt .pdf .docx`);
  }
  const { text } = extractDraftText(absPath, fileType, deps);
  const guess = inferDraftIdentity(text, basename(absPath));
  const title = guess.title ?? basename(absPath, extname(absPath));
  const bookId = titleToBookId(title);
  if (!bookId) throw new DraftIntakeError("could not resolve a bookId from the draft — pass --book-id explicitly.");
  return bookId;
}

/**
 * Perform intake: hash + copy the original, extract + hash the text, resolve
 * identity. Pure aside from writes under roots.sharedInputsDir. Idempotent:
 * re-running against the same draft reproduces byte-identical artifacts.
 */
export function intakeDraft(
  draftPath: string,
  roots: BakeoffRoots,
  overrides: IntakeOverrides = {},
  deps: ExtractorDeps = {},
): DraftIntakeV1 {
  const absPath = resolve(draftPath);
  if (!existsSync(absPath) || !statSync(absPath).isFile()) {
    throw new DraftIntakeError(`draft not found: ${absPath}`);
  }
  const fileType = extname(absPath).slice(1).toLowerCase();
  if (!SUPPORTED.has(fileType)) {
    throw new DraftIntakeError(`unsupported draft type ".${fileType}" (${absPath}) — supported: .md .txt .pdf .docx`);
  }

  const originalBytes = readFileSync(absPath);
  const sha256 = sha256Hex(originalBytes);
  const { text, method } = extractDraftText(absPath, fileType, deps);
  const trimmed = text.replace(/\s+$/g, "");
  if (trimmed.length < 200) {
    throw new DraftIntakeError(
      `extracted draft text is only ${trimmed.length} chars (${absPath} via ${method}) — too thin to ground research; check the file or its extraction.`,
    );
  }

  const draftDir = resolve(roots.sharedInputsDir, "draft");
  mkdirSync(draftDir, { recursive: true });
  const storedDraftAbs = resolve(draftDir, basename(absPath));
  // Byte-exact immutable copy. If a copy from a prior (resumed) run exists it must
  // match — a DIFFERENT draft under the same runId is a fail-closed identity error.
  if (existsSync(storedDraftAbs)) {
    if (sha256File(storedDraftAbs) !== sha256) {
      throw new DraftIntakeError(
        `run already holds a DIFFERENT draft copy at ${storedDraftAbs} — a resumed run must use the original draft (or start a new --run-id).`,
      );
    }
  } else {
    copyFileSync(absPath, storedDraftAbs);
  }
  const storedTextAbs = resolve(draftDir, "draft-extracted.txt");
  const textOut = `${trimmed}\n`;
  if (existsSync(storedTextAbs)) {
    if (sha256File(storedTextAbs) !== sha256Hex(textOut)) {
      throw new DraftIntakeError(
        `run already holds a DIFFERENT extracted text at ${storedTextAbs} — extraction drifted between resumes; start a new --run-id.`,
      );
    }
  } else {
    writeFileAtomic(storedTextAbs, textOut);
  }

  const guess = inferDraftIdentity(trimmed, basename(absPath));
  const title = overrides.title ?? guess.title;
  const author = overrides.author ?? guess.author;
  const bookId = overrides.bookId ?? (title ? titleToBookId(title) : titleToBookId(basename(absPath, extname(absPath))));
  if (!bookId) throw new DraftIntakeError("could not resolve a bookId — pass --book-id explicitly.");
  const hasOverride = Boolean(overrides.title || overrides.author || overrides.bookId);
  const identityConfident = Boolean(
    (overrides.title && overrides.author) || (guess.confident && title && author),
  );

  return {
    schemaVersion: "model-bakeoff-draft-intake-v1",
    originalFileName: basename(absPath),
    resolvedPath: absPath,
    fileType: fileType as DraftIntakeV1["fileType"],
    sha256,
    byteLength: originalBytes.length,
    extractionMethod: method,
    extractedTextSha256: sha256Hex(textOut),
    extractedTextChars: textOut.length,
    storedDraftRelPath: pipelineRel(storedDraftAbs),
    storedTextRelPath: pipelineRel(storedTextAbs),
    title: title ?? null,
    author: author ?? null,
    bookId,
    identitySource: hasOverride ? "override" : guess.source,
    identityConfident,
    overrides: { ...overrides },
    intakeAt: new Date().toISOString(),
  };
}
