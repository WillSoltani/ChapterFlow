import { createHash } from "node:crypto";
import * as fs from "node:fs";
import type { ChapterSpan } from "./types";
import { chapterSpanText } from "../../prompts/chapterflow-v24-author-pipeline/src/source/chapterMap";

export interface BookSource {
  text: string;
  spans: ChapterSpan[];
  sha256: string;
  title(n: number): string;
}

function findSpan(spans: ChapterSpan[], n: number): ChapterSpan {
  const span = spans.find((s) => s.chapterNumber === n);
  if (!span) throw new Error(`NO_SUCH_CHAPTER: ${n}`);
  return span;
}

/** Reads the frozen source text and its chapter map, and refuses a map that was made for different text. */
export function loadSource(textPath: string, mapPath: string): BookSource {
  const text = fs.readFileSync(textPath, "utf8");
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as { sourceTextSha256?: unknown; spans?: unknown };
  if (typeof map.sourceTextSha256 !== "string" || !Array.isArray(map.spans)) {
    throw new Error(`SOURCE_MAP_INVALID: ${mapPath} needs a sourceTextSha256 string and a spans array`);
  }
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  if (sha256 !== map.sourceTextSha256) {
    throw new Error(`SOURCE_SHA_MISMATCH: ${textPath} hashes to ${sha256} but ${mapPath} was made for ${map.sourceTextSha256}`);
  }
  const spans = map.spans as ChapterSpan[];
  return { text, spans, sha256, title: (n) => findSpan(spans, n).chapterTitle };
}

/** The exact characters of chapter n. */
export function spanText(src: BookSource, n: number): string {
  return chapterSpanText(src.text, findSpan(src.spans, n));
}

// Python's str.isspace set, which is what the spec's \S, lstrip() and strip() use. JavaScript's differs:
// it lacks U+001C-U+001F and U+0085 and wrongly counts U+FEFF, so a frozen text with one of those in the
// middle would be classified differently. Kept as a regex class body.
const PY_WS = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PY_LSTRIP = new RegExp(`^[${PY_WS}]+`);
const PY_STRIP = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");
const FOUR_SPACE_TEXT = new RegExp(`^ {4}[^${PY_WS}]`);

/**
 * The chapter as the writer should see it: the author's prose only. Footnotes (and their indented
 * continuations) and illustration captions are a later editor's, so they move to `notes`; bare "[3]"
 * note markers are dropped from the prose. A verse or block quote indented by 2 spaces stays: only a
 * 4-space-indented "[n]" paragraph starts a footnote, and only the paragraphs right after one continue it.
 */
export function writerForm(raw: string): { text: string; notes: string } {
  const keep: string[] = [];
  const notes: string[] = [];
  let prevFootnote = false;
  for (const p of raw.split(/\n[ \t]*\n/)) {
    const isFootnote: boolean = /^ {4}\[\p{Nd}+\]/u.test(p);
    const isContinuation: boolean = !isFootnote && prevFootnote && FOUR_SPACE_TEXT.test(p);
    const isIllustration: boolean = p.replace(PY_LSTRIP, "").startsWith("[Illustration");
    if (isFootnote || isContinuation || isIllustration) notes.push(p.replace(PY_STRIP, ""));
    else keep.push(p.replace(/\[\p{Nd}+\]/gu, ""));
    prevFootnote = isFootnote || isContinuation;
  }
  return { text: keep.join("\n\n").replace(/^\n+|\n+$/g, ""), notes: notes.join("\n\n") };
}

/** writerForm as one string: the prose, then (only if there are any) the notes under a heading that says whose they are. */
export function writerFormText(raw: string): string {
  const { text, notes } = writerForm(raw);
  if (notes === "") return text;
  return `${text}\n\nEDITOR'S NOTES (a later editor's words, not the author's; never quote them as the author)\n\n${notes}`;
}
