/**
 * The source-verify record, PRODUCED (R-047, R-048, R-049).
 *
 * `src/critics/sourceVerify.ts` has emitted an operator packet since WS-4, and
 * `src/qc/sourceRealityPolicy.ts` has read a filled record since then; R-048
 * measured the result — six CLI verbs, a documented workbench, and no record for
 * any book on the live route, because filling one by hand for 60 items per book
 * was never going to happen. R-047 measured the consequence: `applies` defaulted
 * to the env var, so a fresh source-v2 book with no record was decided
 * `not-applicable` and shipped with zero of its facts checked.
 *
 * When the run READ THE BOOK, the record no longer needs a human. Every fact,
 * every case and every hardSpecific carries a `sourceQuote`, and a quote either
 * is or is not in the frozen bytes. This module renders exactly that verdict:
 *
 *   VERIFIED  — the quote occurs verbatim in the chapter's span; `sourceRef` is
 *               the digest of the frozen text plus the character offsets, so the
 *               claim can be re-checked byte-for-byte later.
 *   WRONG     — the item declares source-text provenance and its quote is NOT in
 *               the span. `checkSourceVerifyRecord` turns that into an SV2
 *               blocker, so the book cannot be promoted.
 *
 * WHAT THIS IS NOT. A quote-match says the sidecar's evidence is really on the
 * page; it does not say the sidecar's PARAPHRASE of that evidence is faithful.
 * That judgment needs a reader and is the wave-2 fidelity judge's job. This is
 * the floor beneath it, and it is the floor the released Franklin book did not
 * have: "Leather Apron Club" (zero occurrences in the Autobiography) and
 * "speckled Ax is best" (the source says "I think I like a speckled ax best")
 * would both be WRONG here.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";

import { findRunArtifact } from "../lib/runDirs.js";
import type { SourceVerifyRecord } from "../critics/sourceVerify.js";
import { CHAPTER_MAP_SCHEMA_VERSION, type ChapterMapV1 } from "./chapterMap.js";
import { findQuoteOffsets, normalizedQuote } from "./sourceText.js";

export const SOURCE_VERIFY_RECORD_SCHEMA = "source-verify-record-v1" as const;

type RecordItem = { id: string; kind: string; verdict: string; sourceRef: string; note: string };

/** `source-text:<sha12>#<start>-<end>` — a citation a later reader can resolve
 *  against the frozen bytes without trusting this process. */
function sourceRef(sha256: string, start: number, end: number): string {
  return `source-text:${sha256.slice(0, 12)}#${start}-${end}`;
}

function noteFor(quote: string): string {
  const normalized = normalizedQuote(quote);
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}...`;
}

/**
 * Build the deterministic record for one book from its source-text sidecars, the
 * frozen text and the resolved chapter map. Returns null when the book is not
 * source-text grounded (no sidecar declares it), which is the model-memory path.
 *
 * Item ids match `verifiableItems` exactly, so SV1 coverage is satisfied by
 * construction and a sidecar item with no record entry is impossible.
 */
export function buildSourceTextVerifyRecord(args: {
  bookId: string;
  sidecars: readonly any[];
  sourceText: string;
  sourceTextSha256: string;
  chapterMap: ChapterMapV1;
}): SourceVerifyRecord | null {
  const spans = new Map(args.chapterMap.spans.map((span) => [span.chapterNumber, span]));
  const chapters: Array<{ chapterNumber: number; items: RecordItem[] }> = [];
  let grounded = false;

  for (const sidecar of [...args.sidecars].sort((a, b) => Number(a?.chapterNumber ?? 0) - Number(b?.chapterNumber ?? 0))) {
    if (sidecar?.sourceProvenance !== "source-text") continue;
    grounded = true;
    const chapterNumber = Number(sidecar?.chapterNumber ?? 0);
    const span = spans.get(chapterNumber);
    const spanText = span ? args.sourceText.slice(span.startOffset, span.endOffset) : "";
    const spanStart = span?.startOffset ?? 0;
    const items: RecordItem[] = [];

    const verdictFor = (id: string, kind: string, quote: unknown, missing: string): RecordItem => {
      if (typeof quote !== "string" || quote.trim().length === 0) {
        return { id, kind, verdict: "WRONG", sourceRef: "", note: missing };
      }
      const hit = span ? findQuoteOffsets(spanText, quote) : null;
      if (!hit) {
        return { id, kind, verdict: "WRONG", sourceRef: "", note: `sourceQuote is not in chapter ${chapterNumber}'s span of the frozen source text: ${noteFor(quote)}` };
      }
      return {
        id,
        kind,
        verdict: "VERIFIED",
        sourceRef: sourceRef(args.sourceTextSha256, spanStart + hit.start, spanStart + hit.end),
        note: noteFor(quote),
      };
    };

    const namedExamples: any[] = Array.isArray(sidecar?.namedExamples) ? sidecar.namedExamples : [];
    namedExamples.forEach((example, i) => {
      if (example?.realWorld === false) return; // mirrors verifiableItems
      const id = String(example?.id ?? example?.label ?? `named-example.${chapterNumber}.${i}`);
      items.push(verdictFor(id, "named_example", example?.sourceQuote, `named example ${id} carries no sourceQuote in a source-text run`));
    });

    const facts: any[] = Array.isArray(sidecar?.testableFacts) ? sidecar.testableFacts : [];
    facts.forEach((fact, i) => {
      const id = String(fact?.id ?? `fact.${chapterNumber}.${i}`);
      items.push(verdictFor(id, "testable_fact", fact?.sourceQuote, `testable fact ${id} carries no sourceQuote in a source-text run`));
    });

    chapters.push({ chapterNumber, items });
  }

  if (!grounded) return null;
  return { schemaVersion: SOURCE_VERIFY_RECORD_SCHEMA, bookId: args.bookId, chapters };
}

/** The frozen text + resolved chapter map of a book's newest compatible research
 *  run, or null when the book has none (the model-memory path). */
export function loadFrozenSource(
  runsRoot: string,
  bookId: string,
): { text: string; sha256: string; chapterMap: ChapterMapV1 } | null {
  const textPath = findRunArtifact(runsRoot, bookId, "source-freeze/source-text.txt");
  const mapPath = findRunArtifact(runsRoot, bookId, "source-freeze/chapter-map.json");
  if (!textPath || !mapPath || !existsSync(textPath) || !existsSync(mapPath)) return null;
  let chapterMap: ChapterMapV1;
  try {
    chapterMap = JSON.parse(readFileSync(mapPath, "utf8")) as ChapterMapV1;
  } catch {
    return null;
  }
  if (chapterMap?.schemaVersion !== CHAPTER_MAP_SCHEMA_VERSION || !Array.isArray(chapterMap.spans)) return null;
  const text = readFileSync(textPath, "utf8");
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  // The map is bound to the bytes it was resolved against. A frozen text that no
  // longer matches its map is a corrupt bundle, not a book to verify.
  if (chapterMap.sourceTextSha256 !== sha256) return null;
  return { text, sha256, chapterMap };
}
