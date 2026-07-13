/**
 * Quiz-integrity lane runtime (IMP-20 §C / WP-B3).
 *
 * The quiz lane OWNS quiz correctness. It REUSES the existing two-phase blindness
 * mechanism verbatim — `buildQuizDerivation` → `commitQuizDerivation` (hash + freeze
 * BEFORE any key is visible) → `renderQuizPhase2Doc` → adjudicate — because that
 * protocol is what provides blindness. It then populates the frozen
 * `QuizIntegrityResultV1` (WP-A1) whose per-item shape carries MORE than the legacy
 * `QuizAdjudicationItemV1`: `uniqueAnswer`, `defensibleAlternatives`,
 * `mechanismSupported`, and `tellDetected`.
 *
 * To source those four extra fields WITHOUT editing the frozen legacy contracts
 * (`reviewContracts.ts`, `quizDerivation.ts`), the lane defines a LANE-LOCAL
 * phase-2 elicitation schema `quiz-integrity-adjudication-v1` — a strict SUPERSET
 * of `quiz-adjudication-v1` that adds two model-elicited per-item fields
 * (`defensibleAnswerIndices`, `keyedMechanismSupported`). The output-schema file
 * that binds it lives at
 * `state/migration-experiments/contracts/schemas/quiz-integrity-adjudication.schema.json`
 * (WP-A3); this runtime mirrors that schema with an in-repo strict validator.
 *
 * Population mapping (each frozen field has ONE explicit source — never left empty):
 *   derivedAnswer          ← letter of the committed phase-1 derivedAnswerIndex (deterministic)
 *   keyedAnswer            ← letter of the phase-2 keyedAnswerIndex (deterministic; validated == real key)
 *   keyCorrect             ← phase2.keyCorrect === "correct"                       (deterministic)
 *   uniqueAnswer           ← phase2.keyCorrect !== "ambiguous"                     (deterministic)
 *   defensibleAlternatives ← letters of phase-2 defensibleAnswerIndices           (model-elicited)
 *   mechanismSupported     ← phase-2 keyedMechanismSupported                       (model-elicited)
 *   tellDetected           ← DETERMINISTIC answer-tell heuristic (echo + length outlier +
 *                            absolute-wording strawman) — a model cannot hide a tell
 *   explanation            ← phase-2 rationale
 *   evidenceSpans          ← committed phase-1 evidenceQuotes
 *
 * Result composition (this runtime, not the shape): any wrong key OR genuine
 * ambiguity OR unsupported mechanism → BLOCK; all correct + unique + supported →
 * PASS; a missing/invalid adjudication over a complete blind derivation →
 * INCONCLUSIVE (never a silent pass). `tellDetected` is ADVISORY — it feeds the
 * aggregator as a craft/REVISE signal and NEVER hard-blocks. A general reader's
 * holistic ship preference can never decide quiz correctness.
 *
 * No live model calls here. The phase-2 reviewer output is INJECTED (a canned
 * strict-schema-valid raw JSON reply, with a fenced compatibility form) exactly as `quiz-two-phase.test.ts`
 * injects canned replies; the in-repo validators parse it and the lane composes.
 */

import type { ChapterV21 } from "../types.js";
import type {
  QuizAdjudicationItemV1,
  QuizAdjudicationV1,
} from "../contracts/reviewContracts.js";
import {
  type QuizIntegrityQuestionV1,
  type QuizIntegrityResultV1,
} from "../contracts/quizIntegrityReview.js";
import {
  type CommittedQuizDerivation,
  QuizPhaseError,
  validateQuizAdjudication,
} from "./quizDerivation.js";
import { echoTellChapter } from "../metrics/cardQualityGates.js";
import { chapterContentHash } from "../critics/qcAttestation.js";

// ── lane version + schema id ─────────────────────────────────────────────────

/** Bump when the phase-2 elicitation prompt/schema semantics change — stales
 *  any prior quiz-integrity qualification bound to the older instrument. */
export const QUIZ_INTEGRITY_PHASE2_VERSION = "quiz-integrity-phase2-v1" as const;
export const QUIZ_INTEGRITY_ADJUDICATION_SCHEMA = "quiz-integrity-adjudication-v1" as const;

const LETTERS = "abc";
const ABC = ["a", "b", "c"] as const;
type Letter = (typeof ABC)[number];

/** Typed lane error — a fail-closed refusal, never a silent pass. */
export class QuizIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizIntegrityError";
  }
}

// ── lane-local phase-2 elicitation superset (model output) ───────────────────

/** One adjudicated item — the frozen `QuizAdjudicationItemV1` PLUS the two
 *  model-elicited fields the quiz lane owns. */
export type QuizIntegrityAdjudicationItemV1 = QuizAdjudicationItemV1 & {
  /** 0-based choice indices the model judges genuinely defensible for this item
   *  (includes the key when the key is defensible). */
  defensibleAnswerIndices: number[];
  /** Whether the keyed answer's stated mechanism/causal justification is
   *  supported; TRUE for items that make no mechanism/causal claim. */
  keyedMechanismSupported: boolean;
};

/** Phase-2 elicitation output: a strict superset of `quiz-adjudication-v1`. The
 *  binding hashes are conductor-owned (not model-echoed), so the top level
 *  carries only the schema tag + items — mirroring the WP-A3 output-schema. */
export type QuizIntegrityAdjudicationV1 = {
  schema: typeof QUIZ_INTEGRITY_ADJUDICATION_SCHEMA;
  items: QuizIntegrityAdjudicationItemV1[];
};

// ── phase-2 task (elicitation superset) ──────────────────────────────────────

/** The phase-2 adjudicator's task card. Output = the frozen
 *  quiz-integrity-adjudication-v1 superset (WOULD bind the WP-A3 output-schema
 *  at spawn time; NO spawn occurs in this package). */
export function buildQuizIntegrityAdjudicationTask(docRelPath: string): string {
  return `QUIZ KEY ADJUDICATION (integrity superset) — you compare a committed blind derivation against the stored answer key and additionally report distractor defensibility and mechanism support.

The adjudication document is at: ${docRelPath}
Read ONLY this file. Do not write any files.

It contains: the exact key-free phase-1 chapter evidence, the quiz questions and choices, a COMMITTED DERIVATION produced by an independent blind reader BEFORE any key access (immutable — copy its values verbatim), and the stored ANSWER KEY with explanations.

For EVERY question judge the KEY itself:
- "correct": the keyed answer is the one the questions/choices genuinely support and no other choice is equally defensible;
- "ambiguous": two or more choices are defensible readings (or the wording under-determines the answer) — say which and why;
- "wrong": the keyed answer is not the best-supported choice — name the choice that is.
The blind derivation is EVIDENCE, not authority: a derivation that disagrees with a sound key does not make the key wrong, and agreement does not make an ambiguous key sound.

Also report, per question:
- "defensibleAnswerIndices": every 0-based choice index that is a genuinely defensible answer given ONLY the question and its choices. For a uniquely-correct key this is exactly the keyed index. For an ambiguous key it is two or more indices.
- "keyedMechanismSupported": true when the keyed answer's stated mechanism or causal justification is actually supported by the key-free phase-1 chapter evidence plus the question and choices; true for a question that makes no mechanism/causal claim; false when the key asserts a mechanism/cause those materials do not support.

FINAL RESPONSE: emit only the JSON object required by the bound output schema. Do not wrap it in markdown fences and do not add prose before or after it:
{
  "schema": "${QUIZ_INTEGRITY_ADJUDICATION_SCHEMA}",
  "items": [{"itemId": "<copy>", "keyedAnswerIndex": 0, "derivedAnswerIndex": 0, "agreement": true, "keyCorrect": "correct|ambiguous|wrong", "rationale": "<one line>", "defensibleAnswerIndices": [0], "keyedMechanismSupported": true}]
}`;
}

// ── parse (raw JSON, with fenced compatibility fallback) ─────────────────────

/** Parse the adjudicator's strict schema-bound raw JSON into the superset shape.
 *  If whole-output parsing fails, accept the legacy/canned final fenced JSON.
 *  Returns null when nothing parses or a required field is missing/mistyped; all
 *  trust checks live in validateQuizIntegrityAdjudication. */
export function parseQuizIntegrityAdjudication(stdout: string): QuizIntegrityAdjudicationV1 | null {
  if (typeof stdout !== "string" || stdout.length === 0) return null;
  const trimmed = stdout.trim();
  let body: string | null = trimmed.length > 0 ? trimmed : null;
  let raw: unknown;
  try {
    raw = JSON.parse(body ?? "");
  } catch {
    const fenceRe = /```(json)?[^\n]*\n([\s\S]*?)```/g;
    let lastJsonLabeled: string | null = null;
    let lastAny: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = fenceRe.exec(stdout)) !== null) {
      lastAny = m[2];
      if (m[1] === "json") lastJsonLabeled = m[2];
    }
    body = lastJsonLabeled ?? lastAny;
    if (!body) return null;
    try {
      raw = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== QUIZ_INTEGRITY_ADJUDICATION_SCHEMA || !Array.isArray(obj.items)) return null;
  const items: QuizIntegrityAdjudicationItemV1[] = [];
  for (const it of obj.items) {
    if (typeof it !== "object" || it === null) return null;
    const v = it as Record<string, unknown>;
    if (typeof v.itemId !== "string" || typeof v.rationale !== "string") return null;
    if (typeof v.keyedAnswerIndex !== "number" || typeof v.derivedAnswerIndex !== "number") return null;
    if (v.keyCorrect !== "correct" && v.keyCorrect !== "ambiguous" && v.keyCorrect !== "wrong") return null;
    if (typeof v.keyedMechanismSupported !== "boolean") return null;
    if (!Array.isArray(v.defensibleAnswerIndices) || !v.defensibleAnswerIndices.every((n) => typeof n === "number")) return null;
    items.push({
      itemId: v.itemId,
      keyedAnswerIndex: v.keyedAnswerIndex,
      derivedAnswerIndex: v.derivedAnswerIndex,
      agreement: v.agreement === true,
      keyCorrect: v.keyCorrect,
      rationale: v.rationale.slice(0, 500),
      defensibleAnswerIndices: (v.defensibleAnswerIndices as number[]).slice(0, 3),
      keyedMechanismSupported: v.keyedMechanismSupported,
    });
  }
  return { schema: QUIZ_INTEGRITY_ADJUDICATION_SCHEMA, items };
}

// ── validate (trust-verify against the conductor's OWN committed values) ──────

/** Trust-verify a superset adjudication. Reuses the legacy
 *  `validateQuizAdjudication` for the whole base-field surface (hash chain,
 *  immutable derived indexes, real keyed index, recomputed agreement, non-empty
 *  rationale, item count) by projecting to the base shape with the CONDUCTOR's
 *  own committed derivation sha (the model does not echo the hash), then adds
 *  the two superset fields' invariants. Returns error strings (empty = verified). */
export function validateQuizIntegrityAdjudication(
  adj: QuizIntegrityAdjudicationV1,
  ch: ChapterV21,
  committed: CommittedQuizDerivation,
): string[] {
  const errors: string[] = [];
  if (adj === null || typeof adj !== "object") return ["quiz-integrity-adjudication: not an object"];
  if (adj.schema !== QUIZ_INTEGRITY_ADJUDICATION_SCHEMA) errors.push("quiz-integrity-adjudication: wrong schema tag");
  if (!Array.isArray(adj.items)) return [...errors, "quiz-integrity-adjudication: items must be an array"];

  // Reuse EVERY base trust check via projection. derivationSha256 is bound to the
  // conductor's committed value (authoritative), not trusted from the model.
  const base: QuizAdjudicationV1 = {
    schema: "quiz-adjudication-v1",
    derivationSha256: committed.sha256,
    documentSha256: "",
    reviewerSessionId: "",
    items: adj.items.map<QuizAdjudicationItemV1>((it) => ({
      itemId: it.itemId,
      keyedAnswerIndex: it.keyedAnswerIndex,
      derivedAnswerIndex: it.derivedAnswerIndex,
      agreement: it.agreement,
      keyCorrect: it.keyCorrect,
      rationale: it.rationale,
    })),
  };
  errors.push(...validateQuizAdjudication(base, ch, committed));

  // Superset-field invariants.
  const questions = ch.quiz?.questions ?? [];
  adj.items.forEach((it, i) => {
    const choiceCount = Array.isArray(questions[i]?.choices) ? questions[i].choices.length : 3;
    if (typeof it.keyedMechanismSupported !== "boolean") errors.push(`item ${it.itemId}: keyedMechanismSupported must be boolean`);
    if (!Array.isArray(it.defensibleAnswerIndices)) {
      errors.push(`item ${it.itemId}: defensibleAnswerIndices must be an array`);
      return;
    }
    for (const idx of it.defensibleAnswerIndices) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= choiceCount) {
        errors.push(`item ${it.itemId}: defensibleAnswerIndices ${String(idx)} out of range 0..${choiceCount - 1}`);
      }
    }
    const uniqueDefensible = new Set(it.defensibleAnswerIndices);
    if (uniqueDefensible.size !== it.defensibleAnswerIndices.length) {
      errors.push(`item ${it.itemId}: defensibleAnswerIndices has duplicates`);
    }
    // An "ambiguous" verdict must name at least two defensible readings; a
    // uniquely-correct/wrong verdict must not silently claim >1 defensible AND
    // then call the key uniquely correct.
    if (it.keyCorrect === "ambiguous" && uniqueDefensible.size < 2) {
      errors.push(`item ${it.itemId}: keyCorrect "ambiguous" requires >=2 defensibleAnswerIndices`);
    }
    if (it.keyCorrect === "correct" && uniqueDefensible.size > 1) {
      errors.push(`item ${it.itemId}: keyCorrect "correct" cannot list more than one defensible index`);
    }
  });
  return errors;
}

// ── deterministic answer-tell heuristic (model-independent) ───────────────────

const ABSOLUTE_RE = /\b(always|never|all|none|every|everyone|no one|nobody|impossible|guaranteed|completely|totally|entirely|must|cannot|only|any(?:one|thing)?)\b/i;

/** True iff `choices[ci]` is the UNIQUELY {shortest|longest} choice by char count. */
function uniqueLengthOutlier(choices: string[], ci: number): boolean {
  if (choices.length < 2 || ci < 0 || ci >= choices.length) return false;
  const lens = choices.map((c) => String(c).length);
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  const isUniqueShortest = lens[ci] === min && lens.filter((l) => l === min).length === 1;
  const isUniqueLongest = lens[ci] === max && lens.filter((l) => l === max).length === 1;
  return isUniqueShortest || isUniqueLongest;
}

/** True iff the KEY carries no absolute-wording token while at least one
 *  distractor does — the classic strawman-distractor tell that lets a reader
 *  guess the hedged answer. */
function absoluteStrawmanTell(choices: string[], ci: number): boolean {
  if (choices.length < 2 || ci < 0 || ci >= choices.length) return false;
  const keyAbsolute = ABSOLUTE_RE.test(String(choices[ci]));
  if (keyAbsolute) return false;
  return choices.some((c, i) => i !== ci && ABSOLUTE_RE.test(String(c)));
}

/**
 * Per-item deterministic answer-tell: an echo tell (key lifts a long verbatim
 * n-gram from prose while distractors do not — reuses the shipped
 * `echoTellChapter` gate), a unique answer-length outlier, or an
 * absolute-wording strawman distractor. Keyed by positional index (0-based) to
 * match the committed derivation's ordering. Model-independent by construction.
 */
export function computeQuizItemTells(ch: ChapterV21): boolean[] {
  const questions = ch.quiz?.questions ?? [];
  const echo = echoTellChapter(ch).questions; // positional, one per question
  return questions.map((q, i) => {
    const choices = Array.isArray(q.choices) ? q.choices.map(String) : [];
    const ci = q.correctIndex;
    const echoTell = echo[i]?.tell === true;
    return echoTell || uniqueLengthOutlier(choices, ci) || absoluteStrawmanTell(choices, ci);
  });
}

// ── letter mapping ────────────────────────────────────────────────────────────

function letterOf(index: number): Letter {
  if (!Number.isInteger(index) || index < 0 || index > 2) {
    throw new QuizIntegrityError(`answer index ${String(index)} cannot map to a choice letter a|b|c`);
  }
  return LETTERS[index] as Letter;
}

// ── chapter-content binding hash ─────────────────────────────────────────────

/** The shared chapter-content hash the conductor threads to every lane so the
 *  three lane results + the aggregator agree byte-for-byte on the chapter they
 *  reviewed. Reuses the shipped `chapterContentHash`. */
export function chapterContentShaFor(ch: ChapterV21): string {
  return chapterContentHash(ch);
}

// ── compose the frozen result (PASS | BLOCK) ─────────────────────────────────

export type ComposeQuizIntegrityOpts = { chapterContentSha256: string };

/**
 * Compose the frozen `QuizIntegrityResultV1` from a COMMITTED blind derivation
 * and a VALIDATED superset adjudication. Fail-closed: refuses (throws) when the
 * adjudication does not trust-verify, or when a committed derivation item has no
 * blind answer (index -1) — the frozen per-item `derivedAnswer` cannot represent
 * "no derivation" and emitting a guessed letter would be a silent fabrication.
 *
 * Returns PASS or BLOCK only. INCONCLUSIVE is produced upstream
 * (`runQuizIntegrityLane`) when the adjudication itself is unavailable.
 */
export function composeQuizIntegrityResult(
  ch: ChapterV21,
  committed: CommittedQuizDerivation,
  adj: QuizIntegrityAdjudicationV1,
  opts: ComposeQuizIntegrityOpts,
): QuizIntegrityResultV1 {
  const trust = validateQuizIntegrityAdjudication(adj, ch, committed);
  if (trust.length > 0) {
    throw new QuizIntegrityError(`adjudication failed trust verification: ${trust.join("; ")}`);
  }
  const derivItems = committed.derivation.items;
  const tells = computeQuizItemTells(ch);

  const questions: QuizIntegrityQuestionV1[] = derivItems.map((d, i) => {
    if (d.derivedAnswerIndex < 0) {
      throw new QuizIntegrityError(`item ${d.itemId}: blind reader supplied no derivation — cannot certify the quiz key`);
    }
    const a = adj.items[i];
    const keyCorrect = a.keyCorrect === "correct";
    return {
      itemId: d.itemId,
      derivedAnswer: letterOf(d.derivedAnswerIndex),
      keyedAnswer: letterOf(a.keyedAnswerIndex),
      keyCorrect,
      uniqueAnswer: a.keyCorrect !== "ambiguous",
      defensibleAlternatives: a.defensibleAnswerIndices.map(letterOf),
      mechanismSupported: a.keyedMechanismSupported,
      tellDetected: tells[i] === true,
      explanation: a.rationale,
      evidenceSpans: [...d.evidenceQuotes],
    };
  });

  const blocked = questions.some(
    (q) => !q.keyCorrect || !q.uniqueAnswer || !q.mechanismSupported,
  );

  return {
    schema: "quiz-integrity-result-v1",
    chapterContentSha256: opts.chapterContentSha256,
    derivationSha256: committed.sha256,
    questions,
    result: blocked ? "BLOCK" : "PASS",
  };
}

// ── lane orchestration (injected adjudication reply; ZERO live calls) ─────────

export type RunQuizIntegrityOpts = {
  /** The shared chapter-content hash (conductor-computed; defaults to the shared
   *  `chapterContentShaFor` when omitted). */
  chapterContentSha256?: string;
};

/**
 * Run the quiz-integrity lane over a COMMITTED derivation and an INJECTED phase-2
 * adjudication reply (normally strict schema-bound raw JSON; fenced JSON remains
 * a compatibility form for canned/legacy sessions — the
 * recovery conductor supplies this from a spawn; this package never spawns).
 *
 * Outcomes:
 *   - complete derivation + parseable, trust-verified adjudication → PASS|BLOCK
 *     (delegates to composeQuizIntegrityResult);
 *   - complete derivation + missing/unparseable/untrusted adjudication →
 *     INCONCLUSIVE (built from the conductor's own committed derivation + the
 *     real key; the model-owned fields are left conservatively false — never a
 *     silent PASS);
 *   - a committed item with no blind derivation (index -1) → throws
 *     QuizIntegrityError (fail-closed operational failure).
 */
export function runQuizIntegrityLane(
  ch: ChapterV21,
  committed: CommittedQuizDerivation,
  adjudicationReply: string | null,
  opts: RunQuizIntegrityOpts = {},
): QuizIntegrityResultV1 {
  const chapterContentSha256 = opts.chapterContentSha256 ?? chapterContentShaFor(ch);
  const derivItems = committed.derivation.items;
  if (derivItems.some((d) => d.derivedAnswerIndex < 0)) {
    throw new QuizIntegrityError("blind derivation is incomplete (a reader supplied no normalizable answer) — cannot run the quiz lane");
  }

  const parsed = adjudicationReply != null ? parseQuizIntegrityAdjudication(adjudicationReply) : null;
  if (parsed !== null && validateQuizIntegrityAdjudication(parsed, ch, committed).length === 0) {
    return composeQuizIntegrityResult(ch, committed, parsed, { chapterContentSha256 });
  }

  // INCONCLUSIVE: adjudication unavailable/untrusted. Build from what the
  // conductor already knows deterministically; never assert key correctness.
  const questions = ch.quiz?.questions ?? [];
  const tells = computeQuizItemTells(ch);
  const inconclusive: QuizIntegrityQuestionV1[] = derivItems.map((d, i) => ({
    itemId: d.itemId,
    derivedAnswer: letterOf(d.derivedAnswerIndex),
    keyedAnswer: letterOf(questions[i]?.correctIndex ?? d.derivedAnswerIndex),
    keyCorrect: false,
    uniqueAnswer: false,
    mechanismSupported: false,
    defensibleAlternatives: [],
    tellDetected: tells[i] === true,
    explanation: "adjudication unavailable — quiz key correctness could not be certified",
    evidenceSpans: [...d.evidenceQuotes],
  }));
  return {
    schema: "quiz-integrity-result-v1",
    chapterContentSha256,
    derivationSha256: committed.sha256,
    questions: inconclusive,
    result: "INCONCLUSIVE",
  };
}
