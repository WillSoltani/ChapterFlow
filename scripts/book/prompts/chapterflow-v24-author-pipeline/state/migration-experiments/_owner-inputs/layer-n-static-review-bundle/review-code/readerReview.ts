/**
 * readerReview — the v24 blinded reader-proxy instrument (component A1).
 *
 * One independent, blinded reader reviews ONE rendered chapter document
 * (renderReaderDoc.ts): scores the 10 rubric factors, derives the quiz keys
 * from the prose BEFORE looking at the answer key, makes a ship/no-ship gate
 * call, and cites verbatim evidence quotes. This module owns:
 *
 *   - REVIEW_WEIGHTS          — the factor weighting (sums to exactly 100);
 *   - buildReaderReviewTask   — the blinded single-doc reader prompt
 *                               (validated on live panels 2026-07-01:
 *                               byte-verified quotes, 9/9 key derivations);
 *   - parseReaderReview       — extract + validate the reader's final fenced
 *                               JSON block from a codex session's output;
 *   - adjudicateReview        — deterministic adjudication: byte-verify every
 *                               quote against the doc, check the reader's key
 *                               derivations against the chapter's real keys,
 *                               compute the weighted composite, decide pass;
 *   - writeChapterReview      — persist the ChapterReviewV1 artifact.
 *
 * Everything here is ADDITIVE tooling: no autopilot/conductor/gate behavior
 * changes. The trust model is the same as the QC key-judges: the reader's
 * SEMANTIC claims are cross-checked by DETERMINISTIC code (quote substring
 * verification + positional key comparison), so a lazy or hallucinating
 * reader cannot self-attest a pass.
 */

import { createHash } from "crypto";
import { resolve } from "path";

import type { ChapterV21 } from "../types.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterReviewComplaint,
  type ChapterReviewStructuralScreen,
  type ChapterReviewV1,
  type ReviewFactor,
} from "../artifacts/artifactTypes.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic, ensureTrailingNewline } from "../lib/atomicWrite.js";
import { READER_DOC_PHASE1_VERSION, renderChapterReaderDocPhase1 } from "./renderReaderDoc.js";

export type { ChapterReviewV1 } from "../artifacts/artifactTypes.js";

// ── E2 doc hash (the carry-forward doc-binding) ───────────────────────────────

/** The E2 docHash version — sha256 (full hex) over the EXACT bytes a reader
 *  scores. Bumping this frozen constant is how the doc-hash ALGORITHM evolves:
 *  a new value re-stales every carried review the moment it is recomputed, so it
 *  MUST NOT be edited in place (add a new version + branch, like the v2 exclude
 *  set). Persisted on each ChapterReviewV1 as hashVersion.
 *
 *  "v3" (IMP-08): the hash moved onto the PHASE-1 document bytes (key-free,
 *  renderChapterReaderDocPhase1) because that is now the exact document a
 *  direct reader scores. The bump EXPLICITLY invalidates every pre-split
 *  carried review — a v2 record can never satisfy the reuse predicate again
 *  (plan instruction 5's incompatible-carry invalidation). */
export const REVIEW_DOC_HASH_VERSION = "v3" as const;

/** sha256 of the EXACT rendered reader doc a reader scores — the
 *  trailing-newline-terminated renderChapterReaderDocPhase1 output (v3). This
 *  is the ONE source of truth for docHash both at the write site
 *  (adjudicateReview) and at the reuse site (doAuthorReview), so a doc-render
 *  drift that leaves the chapter contentHash unchanged still invalidates a
 *  carried review. */
export function chapterReaderDocHash(chapter: ChapterV21): string {
  return createHash("sha256").update(ensureTrailingNewline(renderChapterReaderDocPhase1(chapter))).digest("hex");
}

// ── Doc-integrity error (shared by the chapter + book review paths) ───────────

/** Thrown when the machine recount contradicts what the reader-facing DOC (the
 *  exact bytes readers receive) says about its own structure — a render
 *  mismatch (the doc-integrity postcondition, Q2) or a reader's structural
 *  gate-FAIL claim the recount CONFIRMS (Q3: a key row genuinely absent). This
 *  is machine truth, not a vote: the caller must halt(infra), never spawn or
 *  compose readers over a provably-broken doc. Defined here (the lower-level
 *  review module both the chapter and book paths import) to avoid an import
 *  cycle with evalBookProxy, which re-exports it. */
export class DocIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocIntegrityError";
  }
}

// ── Weights ─────────────────────────────────────────────────────────────────

/** Rubric factor weights. MUST sum to exactly 100 (composite = weighted mean). */
export const REVIEW_WEIGHTS: Record<ReviewFactor, number> = {
  retention: 13,
  quizzes: 12,
  transfer: 11,
  practical: 11,
  summaries: 11,
  tone: 10,
  limits: 9,
  insight: 8,
  density: 8,
  beginner: 7,
};

// Module-load assertions: the weights must cover exactly the 10 declared
// factors and sum to 100 — a drift here silently rescales every composite.
{
  const sum = Object.values(REVIEW_WEIGHTS).reduce((a, b) => a + b, 0);
  if (sum !== 100) throw new Error(`REVIEW_WEIGHTS must sum to 100, got ${sum}`);
  const keys = Object.keys(REVIEW_WEIGHTS).sort().join(",");
  const factors = [...REVIEW_FACTORS].sort().join(",");
  if (keys !== factors) throw new Error(`REVIEW_WEIGHTS keys (${keys}) must equal REVIEW_FACTORS (${factors})`);
}

// ── The chapter soft-acceptance bar ─────────────────────────────────────────

/** The chapter-review SOFT acceptance bar — the single source of truth for the
 *  numeric quality threshold a blinded reader ships a chapter against.
 *
 *  Owner decision 2026-07-04: lowered 84 → 80. The 84 bar was too brittle for
 *  production — chapters in the demonstrated 84–87 same-bytes noise band
 *  (±3.7, execution campaign) flapped: some converted via the near-bar tiebreak
 *  while equally-good siblings fell to a consumed regen. 80 is a soft QUALITY
 *  threshold ONLY; it does NOT relax any true blocker. Schema, factuality,
 *  safety, source fidelity, rendering, quote-integrity, and key-soundness are
 *  enforced independently (gate-chapter, finalGate, the quote byte-verify + the
 *  Q3 structural recount here) and a chapter scoring 80+ still fails if any of
 *  those trip. A chapter below 80 (outside the noise band) repairs/regenerates
 *  through the normal bounded process.
 *
 *  The JSON contract field stays `ship84` (a fixed schema name) regardless of
 *  the bar value; only the GATE line's number moves. The orchestrator resolves
 *  an optional CHAPTERFLOW_CHAPTER_BAR override (authorReview.resolveChapterBar)
 *  and threads it explicitly; this constant is the production default the pure
 *  helpers fall back to. */
export const AUTHOR_CHAPTER_BAR = 80;

/** The reader-rubric version (IMP-08, plan instruction 5). Identifies the task
 *  card + factor rubric a review was produced under; stamped on every
 *  adjudicated review so an instrument change is attributable in evidence.
 *  Bump when buildReaderReviewTask's rubric semantics change. */
export const READER_RUBRIC_VERSION = "reader-rubric-v3-phase1" as const;

// ── The blinded reader task ─────────────────────────────────────────────────

/** Build the blinded single-doc reader prompt for the chapter document at
 *  `docRelPath` (relative to the reader session's cwd, i.e. the pipeline dir).
 *  `bar` is substituted into the GATE line; the JSON field stays `ship84`
 *  (fixed contract name) regardless of the bar value. */
export function buildReaderReviewTask(docRelPath: string, bar = AUTHOR_CHAPTER_BAR): string {
  return `BLINDED CHAPTER REVIEW — you are an independent reader. You do not know how this chapter was produced; judge only what is on the page.

One chapter of a book-learning product is at: ${docRelPath}
Read ONLY this file. Do not write any files.

PROCESS (strict order):
1. Read the chapter top to bottom. Answer its quiz YOURSELF from the prose. This document contains NO answer key — your derivation IS the review's key evidence, so for each question record: your answer (a|b|c), a one-line mechanism (what in the prose forces that choice), your confidence (low|medium|high), and any ambiguity (a second choice that is also defensible, or wording that under-determines the answer — name the competing choice and why). Also record any tell that would let someone guess answers without reading (uniquely longest choice, hedging, giveaway phrasing). For any stem asking WHY something happened (what caused / led to / explains): derive the ONE cause the prose actually shows — if a sibling cause is supported equally, that is an ambiguity; say so.
2. Score the chapter 0-100 on each factor: retention, quizzes, transfer, practical, summaries, tone, limits, insight, density, beginner.
   - retention: will a reader remember the core move in a week (memorable lines, concrete images, echoes)
   - quizzes: fair, derivable from prose, sound keys, no tells, distractors that teach
   - transfer: applies beyond the book's own examples (if-then quality, challenge quality). Grade two DISTINCT example defects differently: (a) a FABRICATED / MISLEADING / SOURCE-CONTRADICTORY example — invents a person, event, quote, or number that did not happen, attributes a claim the source never makes, or teaches something the chapter's own material contradicts — is reader-harming and IS a mustFix; (b) a merely THIN-but-usable example — real and on-topic but a slot-filler that names no one and no place/number, shows no before→after (a decision and its consequence), only restates the lesson, or would fit any chapter — is NOT a mustFix: record it as a complaint with unit "example N" (the 1-based index) and mustFix:false so it can be improved without blocking the ship, and register the weakness by scoring transfer down. "Could be richer" is never a mustFix.
   - practical: a real person would actually DO these actions (low-friction, concrete, not theater)
   - summaries: fast/deep/full reads layered, accurate, each standalone
   - tone: plain confident register; no corporate filler; no template/scaffold smell
   - limits: honest about boundaries and failure modes; no overselling
   - insight: explains WHY (mechanism), not just what
   - density: ideas per paragraph; no padding or repetition
   - beginner: approachable cold; jargon-free
3. GATE: would you ship this against a professional >=${bar}/100 bar? true/false.
4. EVIDENCE: 2-4 VERBATIM quotes (exact copy-paste substrings of the file, each <=200 chars): strongest moment(s) and worst defect(s), each with a one-line why. Quotes are mechanically byte-verified — one altered character invalidates your review. Do not paraphrase inside quote fields. Additionally list every concrete defect in "complaints": unit = where it lives (e.g. "quiz Q2", "deep read"), problem = what is wrong, mustFix = a SEVERITY judgment, not a preference. Set mustFix:true ONLY when you can name a concrete reader-harming defect in one of these RESERVED categories: (1) UNSAFE — advice that could hurt a reader who follows it; (2) FACTUALLY WRONG — an incorrect fact, name, date, number, or quote; (3) STRUCTURALLY INVALID — a missing or duplicated section, a broken quiz, or a section that fails its stand-alone promise; (4) SOURCE-CONTRADICTORY — contradicts the chapter's own material or a claim it makes elsewhere; (5) SCHEMA / APP-BREAKING — content that would render or function incorrectly in the product; (6) UNUSABLE — a reader genuinely could not learn or apply the chapter's core move from what is on the page; (7) FABRICATED / MISLEADING EXAMPLE (see transfer). mustFix is FALSE for everything else — thin-but-usable examples, weak or uneven distractors, generic phrasing, mild repetition, uneven rhythm, pacing, tone, or any "could be richer / I would prefer" polish. Registering craft weakness is what the 0-100 scores are for; a low score is not a mustFix. You may NOT set mustFix on subjective taste: if you cannot name the concrete defect and its reserved category, mustFix is FALSE. Use an empty array if there are no complaints.

FINAL MESSAGE: exactly one fenced json block, no prose outside it:
{
  "quizDerivation": {"answers": ["a|b|c", ...], "mechanisms": ["...", ...], "confidence": ["low|medium|high", ...], "ambiguities": ["" , ...], "tells": ["..."]},
  "scores": {"retention": 0, "quizzes": 0, "transfer": 0, "practical": 0, "summaries": 0, "tone": 0, "limits": 0, "insight": 0, "density": 0, "beginner": 0},
  "ship84": false,
  "quotes": [{"quote": "...", "why": "..."}],
  "complaints": [{"unit": "...", "problem": "...", "mustFix": false}],
  "oneParagraphVerdict": "..."
}
(quizDerivation arrays are positional with the questions; use "" for a question with no ambiguity.)`;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

export type ParsedReaderReview = {
  quizDerivation: {
    answers: string[];
    /** Legacy field (pre-IMP-08 readers reported disagreements WITH the key
     *  they could see). Phase-1 readers see no key; parsed tolerantly so old
     *  transcripts/fixtures still parse. */
    keyDisagreements: string[];
    tells: string[];
    /** IMP-08 per-question derivation detail (positional; all optional —
     *  buildQuizDerivation defaults conservatively when absent). */
    mechanisms?: string[];
    confidence?: string[];
    ambiguities?: string[];
  };
  scores: Record<ReviewFactor, number>;
  ship84: boolean;
  quotes: Array<{ quote: string; why: string }>;
  complaints: ChapterReviewComplaint[];
  oneParagraphVerdict: string;
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Parse a reader session's stdout/final message into a validated review, or
 *  null. Takes the LAST fenced json block (readers sometimes echo the file or
 *  think out loud before the final message); requires all 10 factors present
 *  and numeric 0-100, a boolean ship84, and a quotes array. */
export function parseReaderReview(stdout: string): ParsedReaderReview | null {
  if (typeof stdout !== "string" || stdout.length === 0) return null;
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
  const obj = raw as Record<string, unknown>;

  // scores: all 10 factors, numeric, 0-100.
  const scoresRaw = obj.scores;
  if (typeof scoresRaw !== "object" || scoresRaw === null || Array.isArray(scoresRaw)) return null;
  const scores = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) {
    const v = (scoresRaw as Record<string, unknown>)[f];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) return null;
    scores[f] = v;
  }

  if (typeof obj.ship84 !== "boolean") return null;

  if (!Array.isArray(obj.quotes)) return null;
  const quotes: Array<{ quote: string; why: string }> = [];
  for (const q of obj.quotes) {
    if (typeof q !== "object" || q === null) return null;
    const qq = q as Record<string, unknown>;
    if (typeof qq.quote !== "string" || qq.quote.length === 0) return null;
    quotes.push({ quote: qq.quote, why: typeof qq.why === "string" ? qq.why : "" });
  }

  const qd = (typeof obj.quizDerivation === "object" && obj.quizDerivation !== null && !Array.isArray(obj.quizDerivation))
    ? (obj.quizDerivation as Record<string, unknown>)
    : {};

  const complaints: ChapterReviewComplaint[] = [];
  if (Array.isArray(obj.complaints)) {
    for (const c of obj.complaints) {
      if (typeof c !== "object" || c === null) continue;
      const cc = c as Record<string, unknown>;
      if (typeof cc.unit !== "string" || typeof cc.problem !== "string") continue;
      complaints.push({ unit: cc.unit, problem: cc.problem, mustFix: cc.mustFix === true });
    }
  }

  return {
    quizDerivation: {
      answers: asStringArray(qd.answers),
      keyDisagreements: asStringArray(qd.keyDisagreements),
      tells: asStringArray(qd.tells),
      mechanisms: asStringArray(qd.mechanisms),
      confidence: asStringArray(qd.confidence),
      ambiguities: asStringArray(qd.ambiguities),
    },
    scores,
    ship84: obj.ship84,
    quotes,
    complaints,
    oneParagraphVerdict: typeof obj.oneParagraphVerdict === "string" ? obj.oneParagraphVerdict : "",
  };
}

// ── Adjudication ────────────────────────────────────────────────────────────

/** Normalize a reader answer token to "a"|"b"|"c" when possible ("A", " b)",
 *  "c." all normalize); otherwise return the trimmed lowercase raw token so
 *  the disagreement is legible in the artifact. */
function normalizeAnswer(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "a" || t === "b" || t === "c") return t;
  const first = t.charAt(0);
  if ((first === "a" || first === "b" || first === "c") && /^[abc][).\s:]*$/.test(t)) return first;
  return t;
}

// ── Chapter-doc structure recount (Q2 postcondition + Q3 structural screen) ────
//
// Line formats are DERIVED from renderChapterReaderDoc (renderReaderDoc.ts):
//   - a quiz question renders as `Q<i>. <prompt>` at line start (line 37);
//   - the trailing ANSWER KEY (below `## ANSWER KEY …`) renders one row per
//     question as `Q<i>: <letter>` (line 52).
// The single-chapter doc embeds its OWN answer key, so the recount + screen are
// the per-chapter analog of the book-sample versions in evalBookProxy.

const CHAPTER_ANSWER_KEY_HEADER = "## ANSWER KEY";

/** 1-indexed doc line numbers of the chapter answer-key rows (`Q<i>: <letter>`
 *  or, since the 2026-07-03 explanation-leak fix, `Q<i>: <letter> — <expl>`),
 *  keyed by question number — only rows BELOW the ANSWER KEY header count. */
export function chapterDocKeyRowLines(docText: string): Map<number, number> {
  const lines = docText.split("\n");
  const out = new Map<number, number>();
  let inKey = false;
  lines.forEach((line, i) => {
    if (line.startsWith(CHAPTER_ANSWER_KEY_HEADER)) { inKey = true; return; }
    if (!inKey) return;
    const m = line.match(/^Q(\d+): [abc?](?: — .*)?$/);
    if (m) out.set(Number(m[1]), i + 1);
  });
  return out;
}

/** Count the `Q<i>. …` quiz question lines ABOVE the ANSWER KEY header. */
export function chapterDocQuestionLineCount(docText: string): number {
  const lines = docText.split("\n");
  let count = 0;
  for (const line of lines) {
    if (line.startsWith(CHAPTER_ANSWER_KEY_HEADER)) break;
    if (/^Q\d+\. /.test(line)) count += 1;
  }
  return count;
}

/** Q2 (chapter analog) — certify the LEGACY key-bearing reader doc before use:
 *  question-line count === quiz question count === answer-key-row count, and the
 *  doc ends with a newline. Throws DocIntegrityError on mismatch. Retained for
 *  the surfaces that still render the combined shape; the phase-1 review lane
 *  certifies with assertPhase1KeyIsolated below (key ABSENT, not present). */
export function assertChapterReaderDocIntegrity(docText: string, chapter: ChapterV21): void {
  const expected = (chapter.quiz?.questions ?? []).length;
  const problems: string[] = [];
  if (!docText.endsWith("\n")) problems.push("doc does not end with a trailing newline");
  const questionLines = chapterDocQuestionLineCount(docText);
  const keyRows = chapterDocKeyRowLines(docText).size;
  if (questionLines !== expected) problems.push(`${questionLines} question line(s) vs ${expected} quiz question(s)`);
  if (keyRows !== expected) problems.push(`${keyRows} answer-key row(s) vs ${expected} quiz question(s)`);
  if (problems.length > 0) {
    throw new DocIntegrityError(`chapter ${chapter.number} reader-doc integrity check FAILED — the rendered doc does not match the chapter, so no reader may score it:\n  ${problems.join("\n  ")}`);
  }
}

// ── IMP-08 phase-1 key-isolation proof (Q2's phase-1 analog + F-015) ──────────

/** A chapter key row (`Q3: b — …`) or a book combined-key row
 *  (`CHAPTER 4 Q3: b`) anywhere in the doc — the leak shapes. */
const PHASE1_KEY_ROW_RE = /^(?:CHAPTER \d+ )?Q\d+: [abc?](?: — .*)?$/m;

/** Certify a phase-1 document BEFORE any key-blind reviewer spawns:
 *   (a) structural integrity — trailing newline + question-line count matches
 *       the chapter (the Q2 half that still applies);
 *   (b) key isolation — NO answer-key header, NO key-row line in either
 *       rendered shape, NO per-question explanation text (explanations argue
 *       for the stored key), and NO raw correctIndex metadata.
 *  Throws DocIntegrityError — machine truth, the caller halts infra rather
 *  than spawning a reader over a key-contaminated document. */
export function assertPhase1KeyIsolated(docText: string, chapter: ChapterV21): void {
  const expected = (chapter.quiz?.questions ?? []).length;
  const problems: string[] = [];
  if (!docText.endsWith("\n")) problems.push("doc does not end with a trailing newline");
  const questionLines = chapterDocQuestionLineCount(docText);
  if (questionLines !== expected) problems.push(`${questionLines} question line(s) vs ${expected} quiz question(s)`);
  if (docText.includes(CHAPTER_ANSWER_KEY_HEADER)) problems.push("ANSWER KEY header present in a phase-1 doc");
  if (PHASE1_KEY_ROW_RE.test(docText)) problems.push("answer-key row line present in a phase-1 doc");
  if (/\bcorrectIndex\b/.test(docText)) problems.push("raw correctIndex metadata present in a phase-1 doc");
  const docNorm = normalizeForQuoteMatch(docText);
  (chapter.quiz?.questions ?? []).forEach((q, i) => {
    const expl = typeof q.explanation === "string" ? q.explanation.trim() : "";
    if (expl.length >= 12 && docNorm.includes(normalizeForQuoteMatch(expl))) {
      problems.push(`Q${i + 1} explanation text leaked into the phase-1 doc (explanations disclose the key)`);
    }
  });
  if (problems.length > 0) {
    throw new DocIntegrityError(`chapter ${chapter.number} PHASE-1 key-isolation check FAILED — no key-blind reader may score this document:\n  ${problems.join("\n  ")}`);
  }
}

// ── Q3 (chapter analog) — structural key-coverage claim screen ─────────────────

const CH_KEY_COVERAGE_CLAIM_RE = /(answer\s*key|the\s+key|key\s+row)/i;
const CH_OMISSION_VERB_RE = /(omit|miss|stops?\b|absent|unkey|does\s+not\s+(include|cover|list|contain)|lacks?|leaves?\s+\w+\s+unkeyed|no\s+(key|entry|row)\s+for)/i;
const CH_QUESTION_REF_RE = /\bq\s*0*(\d+)\b/i;

function chapterClaimFragments(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Screen a no-ship chapter reader's structural key-coverage claims (in
 *  keyDisagreements + quote whys + verdict) against the chapter doc bytes. A
 *  claim naming a Q that IS keyed in the doc is a positive disproof (sets
 *  `.invalidatedBy`); a claim naming a Q genuinely absent throws
 *  DocIntegrityError. Fuzzy claims are a NO-OP. Only screened for a no-ship
 *  (`ship84 === false`) reader — a ship-yes reader raised no structural veto. */
export function screenChapterStructuralClaims(
  parsed: ParsedReaderReview,
  docText: string,
): ChapterReviewStructuralScreen {
  const screen: ChapterReviewStructuralScreen = { claimsScanned: 0, decisions: [] };
  if (parsed.ship84 !== false) return screen;
  // IMP-08: a PHASE-1 doc contains no answer key BY DESIGN (certified by
  // assertPhase1KeyIsolated pre-spawn), so key-coverage omission claims have no
  // key section to be about — a reader mentioning one is confused, not evidence
  // of a render defect. Without this guard every such claim would "confirm"
  // against the empty key-row map and halt infra on reader confusion.
  if (!docText.includes(CHAPTER_ANSWER_KEY_HEADER)) return screen;
  const keyRows = chapterDocKeyRowLines(docText);
  const fields = [
    parsed.oneParagraphVerdict,
    ...(parsed.quizDerivation.keyDisagreements ?? []),
    ...(parsed.quotes ?? []).map((q) => q.why),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  for (const field of fields) {
    for (const fragment of chapterClaimFragments(field)) {
      if (!CH_KEY_COVERAGE_CLAIM_RE.test(fragment) || !CH_OMISSION_VERB_RE.test(fragment)) continue;
      const qMatch = fragment.match(CH_QUESTION_REF_RE);
      if (!qMatch) continue; // fuzzy: no specific question → NO-OP
      const q = Number(qMatch[1]);
      screen.claimsScanned += 1;
      const keyRowLine = keyRows.get(q);
      if (keyRowLine !== undefined) {
        screen.decisions.push({ claim: fragment.slice(0, 200), q, verdict: "disproven", keyRowLine });
        if (!screen.invalidatedBy) screen.invalidatedBy = `structural claim disproven: Q${q} key row present (doc line ${keyRowLine})`;
      } else {
        screen.decisions.push({ claim: fragment.slice(0, 200), q, verdict: "confirmed" });
        throw new DocIntegrityError(`structural claim CONFIRMED by recount: Q${q} answer-key row genuinely absent from the chapter doc — a real render defect, not a reader error; halting instead of voting. Claim: "${fragment.slice(0, 200)}"`);
      }
    }
  }
  return screen;
}

/** Formatting normalization for quote verification: NFC unicode, curly quotes →
 *  straight, en/em dashes → hyphen, non-breaking → normal space, all whitespace
 *  runs (incl. newlines) → one space, lowercased, trimmed. Deliberately narrow —
 *  it forgives ONLY presentation (case, quote glyphs, whitespace), never word
 *  choice, so a fabricated quote still fails the substring test. */
function normalizeForQuoteMatch(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** A quote is verified if it is an exact substring of the doc, OR — after the
 *  narrow formatting normalization above — a normalized substring. Fabrication
 *  (words not in the chapter) is still rejected; only formatting flakes pass. */
export function quoteVerified(docText: string, quote: string): boolean {
  if (typeof quote !== "string" || quote.length === 0) return false;
  if (docText.includes(quote)) return true;
  const nq = normalizeForQuoteMatch(quote);
  if (nq.length === 0) return false;
  return normalizeForQuoteMatch(docText).includes(nq);
}

export type AdjudicateOpts = { bar?: number; reviewerSessionId?: string };

/** Deterministically adjudicate a parsed reader review against the rendered
 *  document + the real chapter:
 *   (a) byte-verify each quote as an exact substring of docText — ANY
 *       unverified quote (or an empty quote list) invalidates the review;
 *   (b) key check: chapter correctIndex → "abc" letters vs the reader's
 *       positional derivations;
 *   (c) composite = sum(weight * score) / 100, rounded to 1 decimal;
 *   (d) pass = valid AND composite >= bar AND ship84 AND matches === of. */
export function adjudicateReview(
  parsed: ParsedReaderReview,
  docText: string,
  chapter: ChapterV21,
  opts: AdjudicateOpts = {},
): ChapterReviewV1 {
  const bar = opts.bar ?? AUTHOR_CHAPTER_BAR;

  // (a) quote verification — exact substring first, then a FORMATTING-normalized
  // fallback (quoteVerified). The anti-fabrication guarantee is preserved: the
  // fallback only forgives case, smart-quotes/dashes, and whitespace/newline
  // runs — a reader who invents words the chapter never wrote still fails. It
  // rescues the common flake where a reader quotes a mid-sentence fragment as a
  // standalone (capitalizing the leading letter) or normalizes a curly quote —
  // 9 such false-invalid respawns in one gold run, twice failing a shippable
  // chapter (ch06: "The return is set and not yet met." vs the doc's lowercase).
  const quotes = parsed.quotes.map((q) => ({
    quote: q.quote,
    why: q.why,
    verified: quoteVerified(docText, q.quote),
  }));
  const quotesValid = quotes.length > 0 && quotes.every((q) => q.verified);

  // (a2) Q3 structural key-coverage screen (no-ship readers only). A named
  // "the key omits Q<k>" claim disproven against the doc bytes invalidates the
  // vote (respawn a replacement, exactly like quote fabrication); a confirmed
  // claim throws DocIntegrityError (handled by reviewOneChapter → halt infra).
  const structuralScreen = screenChapterStructuralClaims(parsed, docText);
  const valid = quotesValid && structuralScreen.invalidatedBy === undefined;

  // (b) key check.
  const questions = chapter.quiz?.questions ?? [];
  const expected = questions.map((q) => "abc"[q.correctIndex] ?? "?");
  const derived = parsed.quizDerivation.answers.map(normalizeAnswer);
  const of = expected.length;
  let matches = 0;
  const disagreements: string[] = [];
  for (let i = 0; i < of; i++) {
    const want = expected[i];
    const got = derived[i];
    if (got !== undefined && got === want && want !== "?") {
      matches++;
    } else {
      disagreements.push(`Q${i + 1}: reader=${got ?? "(none)"} key=${want}`);
    }
  }

  // (c) weighted composite, 1 decimal.
  let weighted = 0;
  for (const f of REVIEW_FACTORS) weighted += REVIEW_WEIGHTS[f] * parsed.scores[f];
  const composite = Math.round((weighted / 100) * 10) / 10;

  // (d) the pass verdict.
  const pass = valid && composite >= bar && parsed.ship84 === true && matches === of;

  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    contentHash: chapterContentHash(chapter),
    reviewerSessionId: opts.reviewerSessionId ?? "",
    scores: { ...parsed.scores },
    composite,
    ship84: parsed.ship84,
    pass,
    valid,
    keyCheck: { derived, matches, of, disagreements },
    quotes,
    tells: [...parsed.quizDerivation.tells],
    complaints: parsed.complaints.map((c) => ({ ...c })),
    oneParagraphVerdict: parsed.oneParagraphVerdict,
    structuralScreen,
    // E2 carry-binding fields: the bar this was judged at + the sha256 of the
    // exact rendered doc bytes + the hash version + the timestamp. doAuthorReview
    // reuses this record only when EVERY one still matches at reuse time.
    bar,
    docHash: chapterReaderDocHash(chapter),
    hashVersion: REVIEW_DOC_HASH_VERSION,
    phase1DocVersion: READER_DOC_PHASE1_VERSION,
    rubricVersion: READER_RUBRIC_VERSION,
    reviewedAt: new Date().toISOString(),
  };
}

// ── Persistence ─────────────────────────────────────────────────────────────

/** Path of a chapter's review artifact under `stateRoot` (default: the
 *  canonical pipeline state dir). Injectable root so tests write to a tmp dir,
 *  never the repo's real state/. */
export function chapterReviewPath(bookId: string, chapterNumber: number, stateRoot: string = CANONICAL_STATE): string {
  const nn = String(chapterNumber).padStart(2, "0");
  return resolve(stateRoot, "reviews", bookId, `ch${nn}.review.json`);
}

/** Write the review artifact to state/reviews/<bookId>/ch<NN>.review.json
 *  (parents created, atomic write). Returns the absolute path written. */
export function writeChapterReview(bookId: string, review: ChapterReviewV1, stateRoot: string = CANONICAL_STATE): string {
  const path = chapterReviewPath(bookId, review.chapterNumber, stateRoot);
  writeFileAtomic(path, JSON.stringify(review, null, 2) + "\n");
  return path;
}
