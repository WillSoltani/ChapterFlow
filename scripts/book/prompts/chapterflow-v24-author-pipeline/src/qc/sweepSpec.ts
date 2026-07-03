/**
 * sweepSpec — the SINGLE source of truth for the book-wide cross-chapter templating
 * "sweep" judgment. One spec, two callers:
 *   1. the FORMAL QC sweep (the blocking reviewer whose card the review packet renders and
 *      whose submission `qc-sweep-submission-v1` gates the book), and
 *   2. the PRE-QC variety scout (autopilot's read-only, before-QC differentiation pass).
 *
 * Historically each caller carried its OWN prose describing the four families, its OWN
 * finding shape, and its OWN idea of what "gates". They drifted: a book the scout read
 * clean would enter formal QC and FAIL the sweep on every chapter (POM r20260630164412),
 * and a scout-dirty book still burned a full QC round. This module removes the divergence:
 * both callers render their read instructions FROM the same family definitions here, both
 * classify into the same four families, and both parse submissions with the same validator
 * (`validateSubmission` in ./orchestrator/schemas.ts, role "sweep").
 *
 * This file is a LEAF: it imports nothing from sweep.ts / schemas.ts / findingValidity.ts,
 * so those modules can import the canonical family ids + normalizers from HERE without a
 * cycle. The severity GATING predicate (`sweepFindingBlocks`) stays in sweep.ts because it
 * needs the distinctiveness check from findingValidity; this module owns the severity RULES
 * as data plus the pure two-tier collapse.
 */

import { createHash } from "crypto";

// ── Family ids (the four cross-chapter templating families) ─────────────────────
// The canonical list. sweep.ts (`REQUIRED_SWEEP_FAMILIES`) and schemas.ts (`SWEEP_FAMILIES`)
// both re-export THIS so there is exactly one definition of the family set.
export const SWEEP_FAMILIES = ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"] as const;
export type SweepFamily = typeof SWEEP_FAMILIES[number];

export function isSweepFamily(value: unknown): value is SweepFamily {
  return (SWEEP_FAMILIES as readonly string[]).includes(String(value));
}

// ── Family DEFINITIONS + rubric text (rendered by BOTH the sweep card and the scout) ──
export type SweepFamilySpec = { id: SweepFamily; definition: string };

/** What each family means — a SHELL reused across chapters with only the content swapped.
 *  Verbatim source for both the formal sweep's review-packet card and the pre-QC scout task,
 *  so a scout-clean book is predictively sweep-clean. */
export const SWEEP_FAMILY_SPECS: SweepFamilySpec[] = [
  {
    id: "scene_skeleton",
    definition:
      "example scenes (or the fullRead boundary close) sharing one frame across chapters — same opening shape / same 'there is a limit' hinge, different nouns. This INCLUDES one functional MOVE / device reused with only the nouns swapped: the dramatic transaction is identical while the names/props/setting change (e.g. a 'decision made alone under deadline' beat reused chapter after chapter).",
  },
  {
    id: "persona_drift",
    definition:
      "one name = two different people or roles across the book; or a real source-figure's name reused for a fictional actor. This INCLUDES a within-chapter drift where the same first name is attached to unrelated roles.",
  },
  {
    id: "repeated_unit",
    definition:
      "near-identical review cards, implementation plans, weeklyPractice shells ('for seven days, keep one X log'), quiz stems, hooks, or tactics across chapters. This INCLUDES one example UNIT reused as the same functional move (e.g. a message that is 'restarted/reframed' used as the example chapter after chapter).",
  },
  {
    id: "location_stamping",
    definition:
      "the same venue/place, clock stamp, or action container (timer/calendar) reused as the setting/anchor across chapters.",
  },
];

/** False-positive guards — alignment, NOT templating; never flag these. */
export const SWEEP_FP_GUARDS: string[] = [
  "Shared CONCEPT vocabulary: the book's central terms recurring across chapters is the SUBJECT, not a templated shell. Only flag a reused STRUCTURE with the content swapped.",
  "A consistent pedagogical opener ('The mechanism is:') across chapters is a CONVENTION when the content differs and the prose reads as human teaching.",
  "An ordinary recurring GESTURE ('nods', 'takes a breath') is natural narration, not a device.",
  "Two chapters that happen to share a venue or a card frame are fine; the defect is a SHELL spanning many chapters. Rule of thumb: REVISE the whole book only when ≥3 families each span ≥1/3 of the chapters, or any single shell saturates the book.",
];

/** Scope note — this is a CROSS-CHAPTER TEMPLATING check only (no source pack, no facts). */
export const SWEEP_OUT_OF_SCOPE =
  "OUT OF SCOPE — this is a CROSS-CHAPTER TEMPLATING check only. You do NOT have the source pack and CANNOT verify facts or numbers: do NOT raise any factual-accuracy / unverifiable-number / wrong-statistic finding here (numeric grounding is the bar read's `factual_accuracy` axis, which has the source + web-verified numbers). Every finding MUST classify into exactly one of the four families above; a finding that is not one of them is invalid and will be dropped.";

/** Severity RULES as data. The gating PREDICATE that applies them (`sweepFindingBlocks`) lives
 *  in sweep.ts because it also needs the distinctiveness check; this is the human/agent-facing
 *  statement of the same contract, rendered into both cards. */
export const SWEEP_SEVERITY_RULES =
  "A blocker/major finding GATES the chapters it names; an advisory/minor observation is surfaced but never gates. A repetition finding (scene_skeleton / repeated_unit) anchored on a NON-DISTINCTIVE common phrase cannot prove structural reuse and never gates. REVISE/CORRUPTION need ≥1 quote-backed finding citing the SPECIFIC chapters and the shared shell.";

/** The submission schema id both callers speak. */
export const SWEEP_SUBMISSION_SCHEMA_ID = "qc-sweep-submission-v1" as const;

/** Collapse the four submission severities to the two the sweep record stores. Pure; the exact
 *  rule applied at sweep write time (blocker/major → blocker; minor/advisory → advisory). */
export function collapseSweepSeverity(severity: unknown): "blocker" | "advisory" {
  return severity === "blocker" || severity === "major" ? "blocker" : "advisory";
}

/** Render the family definitions + FP-guards + severity/scope rubric as markdown lines.
 *  BOTH the formal sweep card (reviewPacket) and the pre-QC scout task render from this, so
 *  their quoted family definitions are byte-identical. `bullet` controls the list marker so a
 *  caller can match its surrounding style. */
export function renderSweepFamilyRubric(opts: { bullet?: string } = {}): string {
  const b = opts.bullet ?? "  - ";
  const L: string[] = [];
  L.push("What each family means (a SHELL reused across chapters with only the content swapped):");
  for (const spec of SWEEP_FAMILY_SPECS) L.push(`${b}${spec.id}: ${spec.definition}`);
  L.push("FP-GUARDS (do NOT flag these — they are alignment, not templating):");
  for (const guard of SWEEP_FP_GUARDS) L.push(`${b}${guard}`);
  L.push(SWEEP_OUT_OF_SCOPE);
  L.push(SWEEP_SEVERITY_RULES);
  return L.join("\n");
}

// ── Fingerprint normalizer (the sweep-defect identity primitives) ───────────────
// Pure, self-contained. sweep.ts re-exports these; extracting them here keeps the ONE
// definition of how a sweep defect is identified so the scout and the sweep never diverge on
// what "the same defect" is. Behavior is FROZEN — a change here changes stored keys/fingerprints.

/** Minimal record shape the fingerprint needs (structural, so this stays a leaf module). */
export type SweepFingerprintRecord = { bookId: string; contentHashes?: Record<string, string> };
export type SweepDefectFindingInput = { family: string; unitId: string; quote: string; problem?: string; chapters?: number[] };
export type SweepDefectFingerprintInput = Pick<SweepDefectFindingInput, "family" | "unitId" | "quote">;

export const SWEEP_DEFECT_FINGERPRINT_VERSION = "sweep-defect-v2" as const;
export type SweepDefectFingerprintVersion = typeof SWEEP_DEFECT_FINGERPRINT_VERSION;

export function normalizeDefectComponent(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ");
}

function hashKey(payload: unknown): string {
  return `sweep-defect-v1:${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24)}`;
}

export function sweepDefectKey(rec: SweepFingerprintRecord, finding: SweepDefectFindingInput): string {
  const chapters = [...new Set((finding.chapters ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  return hashKey({
    bookId: normalizeDefectComponent(rec.bookId),
    family: finding.family,
    unitId: normalizeDefectComponent(finding.unitId),
    quote: normalizeDefectComponent(finding.quote),
    problem: normalizeDefectComponent(finding.problem),
    chapters,
    content: chapters.map((n) => [n, rec.contentHashes?.[String(n)] ?? ""]),
  });
}

// Edge punctuation a reviewer may wrap a quote in WITHOUT changing the words it contains
// (leading/trailing quotation marks, sentence punctuation, brackets, ellipsis, dashes). Stripped
// from both ends of the quote signature; internal characters are preserved verbatim so materially
// different quotes never collapse. Kept in a character class (escaped) and applied as anchored runs.
const QUOTE_EDGE_PUNCT = "\\s\"'.,;:!?()\\[\\]{}\\u2026\\u00b7*\\-\\u2013\\u2014";

/**
 * Distinctive-quote signature for sweep-defect-v2. STRONGER than `normalizeDefectComponent`
 * (which v1 uses and must stay frozen, or stored v1 keys stop validating):
 *   - NFKC (Unicode form) + lowercase (case) + collapse whitespace runs (whitespace),
 *   - fold curly/smart quotation marks to straight (quote style),
 *   - fold Unicode dash/hyphen/minus variants to ASCII "-" and the ellipsis char to "...",
 *   - strip ONLY the punctuation that BRACKETS a quote (leading/trailing) — punctuation that
 *     does not change the quoted words.
 * Internal word content is preserved exactly, so two MATERIALLY different quotes keep distinct
 * signatures (the requirement: normalize style, not meaning). Non-distinctive generic phrases are
 * filtered upstream by `sweepFindingBlocks`/`nondistinctiveRepetitionQuote` and never reach here.
 */
export function normalizeQuoteSignature(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”„‟＂]/g, "\"")
    .replace(/[‘’‚‛＇`´]/g, "'")
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .replace(new RegExp(`^[${QUOTE_EDGE_PUNCT}]+`), "")
    .replace(new RegExp(`[${QUOTE_EDGE_PUNCT}]+$`), "")
    .trim();
}

/**
 * sweep-defect-v2 — the per-affected-chapter sweep defect FINGERPRINT.
 *
 * The v1 key (`sweepDefectKey`) bound the WHOLE finding: family + unitId + quote + the free-form
 * `problem` prose + the ENTIRE chapter array + a per-chapter content map over that whole array.
 * That over-bound identity stopped UNRELATED findings from corroborating (good) but it ALSO stopped
 * two independent reviewers from corroborating the SAME real defect whenever they worded the problem
 * differently or named overlapping-but-not-identical chapter sets (bad — a real gate then read as an
 * uncorroborated stochastic flip and was demoted, shipping the defect).
 *
 * v2 computes identity ONE CHAPTER AT A TIME and binds only the fields that make two reads "the same
 * defect on the same bytes": bookId (scope), family (defect class — the safety floor: unrelated
 * same-chapter findings cannot merge), unitId (the field/unit), quote (via normalizeQuoteSignature),
 * the single affected chapter, and that chapter's contentHash (a defect on changed bytes is a fresh
 * first-read gate). EXCLUDED on purpose: `problem`/`expectedFix` prose and the OTHER chapters in the
 * finding's array — excluding them is exactly what lets honest reviewers corroborate a real defect
 * they described differently.
 *
 * Returns null when this chapter has no content hash on the record (cannot bind the bytes-read
 * component → no v2 identity) or the family/chapter is not well-formed.
 */
export function sweepDefectFingerprintV2(
  rec: SweepFingerprintRecord,
  finding: SweepDefectFingerprintInput,
  chapterNumber: number,
): string | null {
  const n = Number(chapterNumber);
  if (!Number.isInteger(n) || n <= 0) return null;
  if (!isSweepFamily(finding.family)) return null;
  const contentHash = rec.contentHashes?.[String(n)];
  if (!contentHash) return null;
  const payload = {
    v: 2,
    bookId: normalizeDefectComponent(rec.bookId),
    family: finding.family,
    unitId: normalizeDefectComponent(finding.unitId),
    quote: normalizeQuoteSignature(finding.quote),
    chapter: n,
    contentHash,
  };
  return `${SWEEP_DEFECT_FINGERPRINT_VERSION}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24)}`;
}

/** Per-named-chapter v2 fingerprints for a finding (one per chapter that has a content hash).
 *  Chapters without a hash are skipped — they cannot form a v2 identity. Sorted by chapter. */
export function deriveDefectFingerprints(
  rec: SweepFingerprintRecord,
  finding: SweepDefectFingerprintInput & { chapters: number[] },
): Array<{ chapter: number; fingerprint: string }> {
  const out: Array<{ chapter: number; fingerprint: string }> = [];
  for (const n of [...new Set((finding.chapters ?? []).map(Number))].sort((a, b) => a - b)) {
    const fingerprint = sweepDefectFingerprintV2(rec, finding, n);
    if (fingerprint) out.push({ chapter: n, fingerprint });
  }
  return out;
}
