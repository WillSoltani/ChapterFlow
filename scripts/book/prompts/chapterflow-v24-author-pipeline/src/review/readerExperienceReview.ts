/**
 * readerExperienceReview — the IMP-20 §A reader-experience lane RUNTIME
 * (WP-B1). This is the NEW reader lane that sits BESIDE the frozen legacy
 * `readerReview.ts` (which is demoted to a replay-only path, per R-8). It is
 * ADDITIVE: it does not touch the live authoring gate, and it makes NO live
 * model call — the reviewer output arrives through an INJECTED `reviewFn` seam
 * (mirroring the repo's `quiz-two-phase`/`native-review-runner` fixtures), so
 * the whole lane is exercisable model-free.
 *
 * What changes vs the legacy reader instrument (E-01 fix):
 *   - The reader lane holds ONLY the reader-facing page (renderChapterReaderDocPhase1)
 *     and therefore has NO authority to decide external factual truth. The
 *     legacy `mustFix` mechanism and its source-truth reserved categories
 *     (FABRICATED / FACTUALLY-WRONG / SOURCE-CONTRADICTORY external claims) are
 *     REMOVED from this prompt. A passage that reads as factual but whose status
 *     is unclear is surfaced as the ESCALATION signal `origin_ambiguous_to_reader`,
 *     never a fabrication blocker.
 *   - The model-owned `ship84` ship bit is REPLACED by an advisory
 *     `recommendation` (SHIP|REVISE|BLOCK). The deterministic final status is
 *     owned by the aggregator (WP-B4), not the model.
 *
 * The blocking categories, escalation categories, advisory categories, rubric
 * version, the strict validator and the freshness predicate all come from the
 * frozen WP-A1 contract (`src/contracts/readerExperienceReview.ts`); this module
 * only builds the prompt, parses the reviewer's schema-bound raw JSON (with a
 * fenced-JSON compatibility fallback), and stamps the
 * hash/version bindings to produce a validated `ReaderExperienceReviewV1`.
 */

import { createHash } from "crypto";

import type { ChapterV21 } from "../types.js";
import { ensureTrailingNewline } from "../lib/atomicWrite.js";
import { renderChapterReaderDocPhase1 } from "./renderReaderDoc.js";
import {
  READER_ADVISORY_CATEGORIES,
  READER_BLOCKING_CATEGORIES,
  READER_ESCALATION_CATEGORIES,
  READER_EXPERIENCE_RUBRIC_VERSION,
  type ReaderExperienceReviewV1,
  validateReaderExperienceReview,
} from "../contracts/readerExperienceReview.js";
import { renderReaderExperienceSemanticRubric } from "./readerExperienceSemanticRubric.js";

export { READER_EXPERIENCE_RUBRIC_VERSION } from "../contracts/readerExperienceReview.js";

// ── phase-1 reader-doc hash (the readerDocumentSha256 freshness anchor) ───────

/** sha256 (full hex) over the EXACT phase-1 (key-free) reader-document bytes the
 *  reader scores — the trailing-newline-terminated renderChapterReaderDocPhase1
 *  output. This is the value the reader lane binds as `readerDocumentSha256`, so
 *  a doc-render drift (even one leaving the chapter contentHash unchanged) stales
 *  the review under `readerReviewIsFresh`. Reuses the same renderer + recipe as
 *  the legacy `chapterReaderDocHash` so the two agree byte-for-byte. */
export function readerExperienceDocHash(chapter: ChapterV21): string {
  return createHash("sha256")
    .update(ensureTrailingNewline(renderChapterReaderDocPhase1(chapter)))
    .digest("hex");
}

// ── the reader-experience task (the on-page-only reviewer prompt) ─────────────

const BLOCKING_ENUM = READER_BLOCKING_CATEGORIES.join("|");
const ESCALATION_ENUM = READER_ESCALATION_CATEGORIES.join("|");
const ADVISORY_ENUM = READER_ADVISORY_CATEGORIES.join("|");

/** Build the reader-experience reviewer prompt for the phase-1 document at
 *  `docRelPath` (relative to the reviewer session cwd). The prompt grants NO
 *  external-fabrication / factual-truth blocking authority (E-01) and instructs
 *  the reader to emit `origin_ambiguous_to_reader` when a passage reads as
 *  factual but its status is unclear. There is no `mustFix` mechanism. */
export function buildReaderExperienceTask(docRelPath: string): string {
  return [`READER-EXPERIENCE REVIEW — you are an independent reader. You do not know how this chapter was produced; judge only what is on the page.

One chapter of a book-learning product is at: ${docRelPath}
Read ONLY this file. Do not write any files.`,
  renderReaderExperienceSemanticRubric(),
  `FILE EVIDENCE TRANSPORT: For every finding and strongest/weakest judgment, use evidenceSpans containing verbatim copy-paste substrings of the file, each at most 200 characters. One altered character is a fabricated span.

FINAL RESPONSE: emit only the JSON object required by the bound output schema. Do not wrap it in markdown fences and do not add prose before or after it:
{
  "schema": "reader-experience-review-v1",
  "scores": {"retention": 0, "quizzes": 0, "transfer": 0, "practical": 0, "summaries": 0, "tone": 0, "limits": 0, "insight": 0, "density": 0, "beginner": 0},
  "quizDerivation": {"answers": ["a|b|c"], "mechanisms": ["..."], "confidence": ["low|medium|high"], "ambiguities": [""], "tells": ["..."]},
  "recommendation": "SHIP|REVISE|BLOCK",
  "blockingFindings": [{"category": "${BLOCKING_ENUM}", "unit": "...", "problem": "...", "evidenceSpans": ["..."]}],
  "escalationSignals": [{"category": "${ESCALATION_ENUM}", "unit": "...", "problem": "...", "evidenceSpans": ["..."]}],
  "advisoryFindings": [{"category": "${ADVISORY_ENUM}", "unit": "...", "problem": "...", "evidenceSpans": ["..."]}],
  "strongestEvidence": ["..."],
  "weakestEvidence": ["..."],
  "oneParagraphVerdict": "..."
}
(quizDerivation arrays are positional with the questions; use "" for a question with no ambiguity. Use empty arrays where there is nothing to report.)`].join("\n\n");
}

// ── parsing (schema-bound raw JSON, with fenced compatibility fallback) ───────

/** Parse the strict raw JSON object emitted by a schema-bound codex execution.
 *  Legacy/canned sessions may still return markdown, so if whole-output parsing
 *  fails, extract the LAST fenced JSON block (preferring a `json`-labelled fence).
 *  Returns the parsed object (unvalidated) or null — strict validation happens in
 *  `assembleReaderExperienceReview` via the frozen A1 validator. */
export function parseReaderExperienceReview(stdout: string): Record<string, unknown> | null {
  if (typeof stdout !== "string" || stdout.length === 0) return null;
  const trimmed = stdout.trim();
  if (trimmed.length > 0) {
    try {
      const raw = JSON.parse(trimmed) as unknown;
      if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
      }
    } catch {
      // Compatibility fallback below for legacy/canned fenced replies.
    }
  }
  const fenceRe = /```(json)?[^\n]*\n([\s\S]*?)```/g;
  let lastJsonLabeled: string | null = null;
  let lastAny: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(stdout)) !== null) {
    lastAny = m[2];
    if (m[1] === "json") lastJsonLabeled = m[2];
  }
  const body = lastJsonLabeled ?? lastAny;
  if (!body) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

// ── assembly (stamp the freshness bindings + strict-validate) ─────────────────

/** The hash/version bindings the RUNTIME stamps onto the model's content output
 *  to form a complete, freshness-bearing `ReaderExperienceReviewV1`. The model
 *  never sees or supplies these — they are the exact bytes/instrument the review
 *  is bound to. */
export type ReaderReviewBindings = {
  /** chapterContentHash (v2) of the reviewed chapter. */
  chapterContentSha256: string;
  /** sha256 of the exact phase-1 reader document the reviewer saw (readerExperienceDocHash). */
  readerDocumentSha256: string;
  /** sha256 of the bound JSON output-schema file (supplied by the wiring layer). */
  schemaSha256: string;
};

export class ReaderExperienceReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReaderExperienceReviewError";
  }
}

/** Stamp the model's parsed content output with the reviewerRole + rubric version
 *  + the caller's hash bindings, then strict-validate against the frozen A1
 *  contract. Throws `ReaderExperienceReviewError` with the aggregated validator
 *  errors when the assembled record is not schema-valid (a hallucinated/malformed
 *  reviewer output cannot self-attest a pass). Returns the typed record. */
export function assembleReaderExperienceReview(
  output: Record<string, unknown>,
  bindings: ReaderReviewBindings,
): ReaderExperienceReviewV1 {
  const candidate = {
    ...output,
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    rubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    chapterContentSha256: bindings.chapterContentSha256,
    readerDocumentSha256: bindings.readerDocumentSha256,
    schemaSha256: bindings.schemaSha256,
  } as Record<string, unknown>;
  const errors = validateReaderExperienceReview(candidate);
  if (errors.length > 0) {
    throw new ReaderExperienceReviewError(
      `reader-experience review is not schema-valid:\n  ${errors.join("\n  ")}`,
    );
  }
  return candidate as unknown as ReaderExperienceReviewV1;
}

// ── the model-free lane runner (injected reviewFn seam) ───────────────────────

/** The injected reviewer seam. `reviewFn(task)` returns the raw reviewer session
 *  output (stdout / final message). In production this is backed by a
 *  ChatGPT-authenticated `codex exec` spawn behind the router choke; in tests it
 *  returns canned strict-schema-valid raw JSON (or the fenced compatibility
 *  form). There is NO fallback
 *  and NO direct model import in this module. */
export type ReaderReviewDeps = { reviewFn: (task: string) => Promise<string> };

/** Run the reader-experience lane over the phase-1 document at
 *  `args.docRelPath`, binding the produced record to the exact chapter content /
 *  reader-document / schema hashes. Builds the task, obtains the reviewer output
 *  through the injected `reviewFn`, parses schema-bound raw JSON (or the fenced
 *  compatibility form), and assembles +
 *  strict-validates the record. Makes zero model calls of its own. */
export async function runReaderExperienceReview(
  args: { docRelPath: string } & ReaderReviewBindings,
  deps: ReaderReviewDeps,
): Promise<ReaderExperienceReviewV1> {
  const task = buildReaderExperienceTask(args.docRelPath);
  const stdout = await deps.reviewFn(task);
  const parsed = parseReaderExperienceReview(stdout);
  if (parsed === null) {
    throw new ReaderExperienceReviewError(
      "reader-experience review: no parseable JSON object in the reviewer output",
    );
  }
  return assembleReaderExperienceReview(parsed, {
    chapterContentSha256: args.chapterContentSha256,
    readerDocumentSha256: args.readerDocumentSha256,
    schemaSha256: args.schemaSha256,
  });
}
