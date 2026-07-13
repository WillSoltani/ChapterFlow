/**
 * quizDerivation (IMP-08, F-015/F-011) — the two-phase quiz instrument.
 *
 * Phase 1: the direct reader derives every answer from the phase-1 document
 * (which physically lacks the key) and returns per-question mechanism,
 * confidence, ambiguity flags, and evidence under the frozen
 * `quiz-derivation-v1` shape. The CONDUCTOR validates and hashes that
 * derivation — `commitQuizDerivation` — BEFORE any key becomes visible.
 *
 * Phase 2: a separate quiz-adjudication reviewer receives ONE document
 * (renderQuizPhase2Doc): the committed derivation (stamped with its sha256)
 * plus the answer key and explanations, and adjudicates key correctness /
 * ambiguity per question under the frozen `quiz-adjudication-v1` shape.
 *
 * Both phases are IMMUTABLE: phase 2 must echo the committed derivation's
 * hash and per-item derived indexes byte-for-byte (validateQuizAdjudication
 * re-verifies from the conductor's own committed values), so an adjudicator
 * can neither rewrite history nor misreport the key. The adjudication is
 * ADVISORY EVIDENCE in v1 — the blocking key channel stays the deterministic
 * conductor-side keyCheck (matches === of), unchanged; promotion of
 * adjudication verdicts into any predicate is IMP-11 calibration territory.
 */

import type { ChapterV21 } from "../types.js";
import {
  type QuizAdjudicationItemV1,
  type QuizAdjudicationV1,
  type QuizDerivationItemV1,
  type QuizDerivationV1,
  validateQuizDerivation,
} from "../contracts/reviewContracts.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { renderChapterReaderDocPhase1 } from "./renderReaderDoc.js";

export const QUIZ_PHASE2_VERSION = "phase2-v1" as const;

const LETTERS = "abc";
const CONFIDENCES = new Set(["low", "medium", "high"]);

/** Stable item id for question i (0-based): the chapter's own questionId when
 *  present, else the positional `q<i+1>`. */
export function quizItemId(ch: ChapterV21, i: number): string {
  const q = ch.quiz?.questions?.[i] as { questionId?: unknown } | undefined;
  return typeof q?.questionId === "string" && q.questionId.length > 0 ? q.questionId : `q${i + 1}`;
}

/** Normalize a reader's answer token to a choice index (0..2), or -1 when it
 *  does not normalize (recorded, never guessed). */
function answerIndex(raw: string | undefined): number {
  if (typeof raw !== "string") return -1;
  const t = raw.trim().toLowerCase();
  const first = t.charAt(0);
  if ((first === "a" || first === "b" || first === "c") && /^[abc][).\s:]*$/.test(t)) return LETTERS.indexOf(first);
  return -1;
}

/** Reader-supplied per-question detail (all optional — legacy readers return
 *  answers only; absence is recorded conservatively, never invented). */
export type ReaderDerivationDetail = {
  answers: string[];
  mechanisms?: string[];
  confidence?: string[];
  ambiguities?: string[];
  evidence?: string[][];
};

/** Build the frozen-shape derivation from a parsed reader review. One item per
 *  REAL quiz question (positional); an unanswered/unparseable answer becomes
 *  derivedAnswerIndex -1 with an explicit "no-derivation" flag. Confidence
 *  defaults LOW (the conservative direction) when the reader supplied none. */
export function buildQuizDerivation(
  ch: ChapterV21,
  detail: ReaderDerivationDetail,
  phase1DocSha256: string,
  reviewerSessionId: string,
): QuizDerivationV1 {
  const questions = ch.quiz?.questions ?? [];
  const items: QuizDerivationItemV1[] = questions.map((_, i) => {
    const idx = answerIndex(detail.answers[i]);
    const confRaw = (detail.confidence?.[i] ?? "").trim().toLowerCase();
    const flags: string[] = [];
    const amb = detail.ambiguities?.[i];
    if (typeof amb === "string" && amb.trim().length > 0) flags.push(amb.trim().slice(0, 300));
    if (idx < 0) flags.push("no-derivation: reader supplied no normalizable answer");
    return {
      itemId: quizItemId(ch, i),
      derivedAnswerIndex: idx,
      mechanism: (detail.mechanisms?.[i] ?? "").trim().slice(0, 500),
      confidence: (CONFIDENCES.has(confRaw) ? confRaw : "low") as QuizDerivationItemV1["confidence"],
      ambiguityFlags: flags,
      evidenceQuotes: (detail.evidence?.[i] ?? []).filter((q) => typeof q === "string" && q.length > 0).slice(0, 4),
    };
  });
  return { schema: "quiz-derivation-v1", documentSha256: phase1DocSha256, reviewerSessionId, items };
}

// ── Commitment (validate + hash BEFORE any key is visible) ────────────────────

export class QuizPhaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizPhaseError";
  }
}

export type CommittedQuizDerivation = {
  derivation: QuizDerivationV1;
  /** hashCanonical of the exact derivation object — the phase-2 chain anchor. */
  sha256: string;
};

/** Validate and hash a derivation against the conductor's OWN expectations
 *  (frozen contract + strict local checks). Freezes the object so nothing can
 *  mutate it between commitment and phase-2 render. Throws QuizPhaseError on
 *  any mismatch — phase 2 must never render from an uncommitted derivation. */
export function commitQuizDerivation(
  derivation: QuizDerivationV1,
  expect: { documentSha256: string; questionCount: number; itemIds: readonly string[] },
): CommittedQuizDerivation {
  const frozenErrors = validateQuizDerivation(derivation);
  if (frozenErrors.length > 0) throw new QuizPhaseError(`derivation failed the frozen contract: ${frozenErrors.join("; ")}`);
  if (derivation.documentSha256 !== expect.documentSha256) {
    throw new QuizPhaseError(`derivation documentSha256 ${derivation.documentSha256.slice(0, 12)}… does not match the phase-1 doc ${expect.documentSha256.slice(0, 12)}…`);
  }
  if (derivation.items.length !== expect.questionCount) {
    throw new QuizPhaseError(`derivation has ${derivation.items.length} item(s) for ${expect.questionCount} question(s)`);
  }
  derivation.items.forEach((item, i) => {
    if (item.itemId !== expect.itemIds[i]) throw new QuizPhaseError(`derivation item ${i} id "${item.itemId}" ≠ expected "${expect.itemIds[i]}"`);
    if (!Number.isInteger(item.derivedAnswerIndex) || item.derivedAnswerIndex < -1 || item.derivedAnswerIndex > 2) {
      throw new QuizPhaseError(`derivation item ${item.itemId}: derivedAnswerIndex ${String(item.derivedAnswerIndex)} out of range`);
    }
    if (item.derivedAnswerIndex === -1 && !item.ambiguityFlags.some((f) => f.startsWith("no-derivation"))) {
      throw new QuizPhaseError(`derivation item ${item.itemId}: -1 without an explicit no-derivation flag`);
    }
  });
  for (const item of derivation.items) {
    Object.freeze(item.ambiguityFlags);
    Object.freeze(item.evidenceQuotes);
    Object.freeze(item);
  }
  Object.freeze(derivation.items);
  Object.freeze(derivation);
  return { derivation, sha256: hashCanonical(derivation) };
}

// ── Phase-2 document ──────────────────────────────────────────────────────────

/** Render the phase-2 adjudication document: the committed derivation
 *  (verbatim, hash-stamped) + the answer key with explanations + the
 *  adjudication ask. REFUSES a derivation whose recomputed hash does not match
 *  the commitment — the only path to a key-visible document goes through
 *  commitQuizDerivation. */
export function renderQuizPhase2Doc(
  ch: ChapterV21,
  committed: CommittedQuizDerivation,
  keyFreeDocumentOverride?: string,
): string {
  if (hashCanonical(committed.derivation) !== committed.sha256) {
    throw new QuizPhaseError("phase-2 render refused: derivation bytes do not match their commitment hash");
  }
  const questions = ch.quiz?.questions ?? [];
  if (questions.length !== committed.derivation.items.length) {
    throw new QuizPhaseError(`phase-2 render refused: ${committed.derivation.items.length} committed item(s) vs ${questions.length} question(s)`);
  }
  // V1 callers retain the frozen legacy phase-1 bytes. Forward V2 supplies its
  // complete key-free reader document explicitly so the quiz commitment is
  // anchored to the exact evidence the blind reader actually saw.
  const keyFreeChapter = `${(keyFreeDocumentOverride ?? renderChapterReaderDocPhase1(ch)).replace(/\n?$/, "")}\n`;
  if (sha256Hex(keyFreeChapter) !== committed.derivation.documentSha256) {
    throw new QuizPhaseError("phase-2 render refused: key-free supporting chapter bytes do not match the committed phase-1 document hash");
  }
  const L: string[] = [];
  L.push(`# QUIZ KEY ADJUDICATION — ${ch.title}`, "");
  L.push(`Committed blind derivation sha256: ${committed.sha256}`, `Phase version: ${QUIZ_PHASE2_VERSION}`, "");
  L.push("## KEY-FREE PHASE-1 CHAPTER EVIDENCE (exact committed bytes)");
  L.push(keyFreeChapter.trimEnd(), "");
  L.push("## Questions and choices");
  questions.forEach((q, i) => {
    L.push(`Q${i + 1}. ${q.prompt}`);
    (q.choices ?? []).forEach((c, ci) => L.push(`   ${LETTERS[ci]}) ${c}`));
    L.push("");
  });
  L.push("## COMMITTED DERIVATION (produced blind, before any key access — immutable)");
  committed.derivation.items.forEach((item, i) => {
    const letter = item.derivedAnswerIndex >= 0 ? LETTERS[item.derivedAnswerIndex] : "(none)";
    L.push(`Q${i + 1} [${item.itemId}]: derived ${letter} — confidence ${item.confidence}${item.mechanism ? ` — mechanism: ${item.mechanism}` : ""}`);
    for (const f of item.ambiguityFlags) L.push(`   ambiguity: ${f}`);
    for (const e of item.evidenceQuotes) L.push(`   evidence: "${e}"`);
  });
  L.push("", "## ANSWER KEY (with explanations)");
  questions.forEach((q, i) =>
    L.push(`Q${i + 1}: ${LETTERS[q.correctIndex] ?? "?"}${q.explanation ? ` — ${q.explanation}` : ""}`));
  return L.join("\n");
}

/** The phase-2 adjudicator's task card. Output = frozen quiz-adjudication-v1. */
export function buildQuizAdjudicationTask(docRelPath: string): string {
  return `QUIZ KEY ADJUDICATION — you compare a committed blind derivation against the stored answer key.

The adjudication document is at: ${docRelPath}
Read ONLY this file. Do not write any files.

It contains: the quiz questions and choices, a COMMITTED DERIVATION produced by an independent blind reader BEFORE any key access (immutable — copy its values verbatim), and the stored ANSWER KEY with explanations.

For EVERY question judge the KEY itself:
- "correct": the keyed answer is the one the questions/choices genuinely support and no other choice is equally defensible;
- "ambiguous": two or more choices are defensible readings (or the wording under-determines the answer) — say which and why;
- "wrong": the keyed answer is not the best-supported choice — name the choice that is.
The blind derivation is EVIDENCE, not authority: a derivation that disagrees with a sound key does not make the key wrong, and agreement does not make an ambiguous key sound.

FINAL MESSAGE: exactly one fenced json block, no prose outside it:
{
  "schema": "quiz-adjudication-v1",
  "derivationSha256": "<copy the committed derivation sha256 from the document>",
  "documentSha256": "",
  "reviewerSessionId": "",
  "items": [{"itemId": "<copy>", "keyedAnswerIndex": 0, "derivedAnswerIndex": 0, "agreement": true, "keyCorrect": "correct|ambiguous|wrong", "rationale": "<one line>"}]
}`;
}

/** Parse the adjudicator's final fenced JSON into the frozen shape (last
 *  fenced block wins, mirroring parseReaderReview). Returns null when nothing
 *  parses; all trust checks live in validateQuizAdjudication. */
export function parseQuizAdjudication(stdout: string): QuizAdjudicationV1 | null {
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
  if (obj.schema !== "quiz-adjudication-v1" || !Array.isArray(obj.items)) return null;
  const items: QuizAdjudicationItemV1[] = [];
  for (const it of obj.items) {
    if (typeof it !== "object" || it === null) return null;
    const v = it as Record<string, unknown>;
    if (typeof v.itemId !== "string" || typeof v.rationale !== "string") return null;
    if (typeof v.keyedAnswerIndex !== "number" || typeof v.derivedAnswerIndex !== "number") return null;
    if (v.keyCorrect !== "correct" && v.keyCorrect !== "ambiguous" && v.keyCorrect !== "wrong") return null;
    items.push({
      itemId: v.itemId,
      keyedAnswerIndex: v.keyedAnswerIndex,
      derivedAnswerIndex: v.derivedAnswerIndex,
      agreement: v.agreement === true,
      keyCorrect: v.keyCorrect,
      rationale: v.rationale.slice(0, 500),
    });
  }
  return {
    schema: "quiz-adjudication-v1",
    derivationSha256: typeof obj.derivationSha256 === "string" ? obj.derivationSha256 : "",
    documentSha256: typeof obj.documentSha256 === "string" ? obj.documentSha256 : "",
    reviewerSessionId: typeof obj.reviewerSessionId === "string" ? obj.reviewerSessionId : "",
    items,
  };
}

/** Trust-verify an adjudication against the CONDUCTOR's own values. The
 *  adjudicator's claims about the world must match what the conductor already
 *  knows: the derivation hash chain, the immutable derived indexes, and the
 *  REAL keyed indexes — so a lying/lazy adjudicator is a typed rejection, and
 *  `agreement` is recomputed truth, never self-attested. Returns error strings
 *  (empty = verified). */
export function validateQuizAdjudication(
  adj: QuizAdjudicationV1,
  ch: ChapterV21,
  committed: CommittedQuizDerivation,
): string[] {
  const errors: string[] = [];
  const questions = ch.quiz?.questions ?? [];
  if (adj.derivationSha256 !== committed.sha256) {
    errors.push(`derivationSha256 ${adj.derivationSha256.slice(0, 12) || "(empty)"}… ≠ committed ${committed.sha256.slice(0, 12)}…`);
  }
  if (adj.items.length !== questions.length) {
    errors.push(`${adj.items.length} adjudicated item(s) vs ${questions.length} question(s)`);
    return errors;
  }
  adj.items.forEach((item, i) => {
    const want = committed.derivation.items[i];
    const keyIdx = questions[i].correctIndex;
    if (item.itemId !== want.itemId) errors.push(`item ${i}: id "${item.itemId}" ≠ committed "${want.itemId}"`);
    if (item.derivedAnswerIndex !== want.derivedAnswerIndex) {
      errors.push(`item ${want.itemId}: derivedAnswerIndex ${item.derivedAnswerIndex} rewrites the committed ${want.derivedAnswerIndex} — phase 1 is immutable`);
    }
    if (item.keyedAnswerIndex !== keyIdx) {
      errors.push(`item ${want.itemId}: keyedAnswerIndex ${item.keyedAnswerIndex} misreports the real key ${keyIdx}`);
    }
    if (item.agreement !== (want.derivedAnswerIndex === keyIdx)) {
      errors.push(`item ${want.itemId}: agreement flag contradicts derived-vs-key`);
    }
    if (item.rationale.trim().length === 0) errors.push(`item ${want.itemId}: empty rationale`);
  });
  return errors;
}

/** sha256 of a phase-2 document's exact bytes (binding field for evidence). */
export function phase2DocSha256(docText: string): string {
  return sha256Hex(docText);
}
