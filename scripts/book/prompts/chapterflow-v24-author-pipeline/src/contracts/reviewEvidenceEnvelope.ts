/**
 * IMP-24 Review Evidence Envelope v1.
 *
 * This is the lane-neutral, model-independent evidence contract shared by live
 * qualification and production review.  The model receives the complete
 * envelope inline and refers to immutable segments by packet-local `refId`.
 * Route identity, prior judgments, and acceptance state are deliberately not
 * part of the evidence surface.
 */

import { canonicalJson, hashCanonical, sha256Hex, type ContractDescriptor } from "./contractUtil.js";

export const REVIEW_EVIDENCE_ENVELOPE_SCHEMA = "review-evidence-envelope-v1" as const;

export const REVIEW_EVIDENCE_LANES = ["reader", "source", "quiz"] as const;
export type ReviewEvidenceLane = (typeof REVIEW_EVIDENCE_LANES)[number];

export const REVIEW_EVIDENCE_KINDS = [
  "chapter",
  "source_claim",
  "source_mechanism",
  "source_anchor",
  "plan",
  "quiz_prompt",
  "quiz_choice",
  "quiz_derivation",
  "quiz_key",
  "quiz_explanation",
] as const;
export type ReviewEvidenceKind = (typeof REVIEW_EVIDENCE_KINDS)[number];

/**
 * Frozen byte caps for the canonical envelope bytes, including the envelope
 * hash.  Callers must partition source packets or return INCONCLUSIVE upstream;
 * they must never truncate to fit these limits.
 */
export const REVIEW_EVIDENCE_ENVELOPE_MAX_BYTES: Readonly<Record<ReviewEvidenceLane, number>> = Object.freeze({
  reader: 512 * 1024,
  source: 384 * 1024,
  quiz: 256 * 1024,
});

export type ReviewEvidenceBindingValue =
  | null
  | boolean
  | number
  | string
  | ReviewEvidenceBindingValue[]
  | { [key: string]: ReviewEvidenceBindingValue };

export type ReviewEvidenceSegmentV1 = {
  refId: string;
  kind: ReviewEvidenceKind;
  text: string;
  sha256: string;
};

export type ReviewEvidenceEnvelopeV1 = {
  schema: typeof REVIEW_EVIDENCE_ENVELOPE_SCHEMA;
  lane: ReviewEvidenceLane;
  envelopeId: string;
  caseId: string;
  instrumentVersion: string;
  segments: ReviewEvidenceSegmentV1[];
  immutableBindings: Record<string, ReviewEvidenceBindingValue>;
  envelopeSha256: string;
};

export type ReviewEvidenceEnvelopeHashInputV1 = Omit<ReviewEvidenceEnvelopeV1, "envelopeSha256">;

const SHA256_RE = /^[a-f0-9]{64}$/;
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const TOP_KEYS = [
  "schema",
  "lane",
  "envelopeId",
  "caseId",
  "instrumentVersion",
  "segments",
  "immutableBindings",
  "envelopeSha256",
] as const;
const SEGMENT_KEYS = ["refId", "kind", "text", "sha256"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function noUnknownKeys(value: Record<string, unknown>, allowed: readonly string[], errors: string[], where: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${where}: unknown key "${key}"`);
  }
}

function requireKeys(value: Record<string, unknown>, required: readonly string[], errors: string[], where: string): void {
  for (const key of required) {
    if (!(key in value) || value[key] === undefined) errors.push(`${where}: missing required field "${key}"`);
  }
}

function validateBindingValue(value: unknown, errors: string[], where: string, seen: Set<object>): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${where}: number must be finite`);
    return;
  }
  if (typeof value !== "object") {
    errors.push(`${where}: value is not JSON-serializable`);
    return;
  }
  if (seen.has(value)) {
    errors.push(`${where}: cyclic binding value`);
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateBindingValue(item, errors, `${where}[${index}]`, seen));
  } else {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) errors.push(`${where}.${key}: undefined is not permitted`);
      else validateBindingValue(item, errors, `${where}.${key}`, seen);
    }
  }
  seen.delete(value);
}

/** The exact substantive hash input.  `envelopeSha256` can never hash itself. */
export function reviewEvidenceEnvelopeHashInput(envelope: ReviewEvidenceEnvelopeV1): ReviewEvidenceEnvelopeHashInputV1 {
  return {
    schema: envelope.schema,
    lane: envelope.lane,
    envelopeId: envelope.envelopeId,
    caseId: envelope.caseId,
    instrumentVersion: envelope.instrumentVersion,
    segments: envelope.segments,
    immutableBindings: envelope.immutableBindings,
  };
}

export function expectedReviewEvidenceEnvelopeSha256(envelope: ReviewEvidenceEnvelopeV1): string {
  return hashCanonical(reviewEvidenceEnvelopeHashInput(envelope));
}

/** Canonical bytes retained with an attempt and delivered inline to the model. */
export function canonicalReviewEvidenceEnvelope(envelope: ReviewEvidenceEnvelopeV1): string {
  return canonicalJson(envelope);
}

/**
 * Strict structural and cryptographic validation.  Policy checks that require a
 * lane-specific byte budget or required kinds live in the compiler module.
 */
export function validateReviewEvidenceEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["review-evidence-envelope: not an object"];
  requireKeys(value, TOP_KEYS, errors, "review-evidence-envelope");
  noUnknownKeys(value, TOP_KEYS, errors, "review-evidence-envelope");

  if (value.schema !== REVIEW_EVIDENCE_ENVELOPE_SCHEMA) errors.push("review-evidence-envelope: wrong schema tag");
  if (typeof value.lane !== "string" || !REVIEW_EVIDENCE_LANES.includes(value.lane as ReviewEvidenceLane)) {
    errors.push(`review-evidence-envelope: unknown lane "${String(value.lane)}"`);
  }
  for (const field of ["envelopeId", "caseId", "instrumentVersion"] as const) {
    const item = value[field];
    if (typeof item !== "string" || !IDENTIFIER_RE.test(item)) {
      errors.push(`review-evidence-envelope: ${field} must be a stable identifier`);
    }
  }

  const seenRefs = new Set<string>();
  if (!Array.isArray(value.segments) || value.segments.length === 0) {
    errors.push("review-evidence-envelope: segments must be a non-empty array");
  } else {
    let previousRef = "";
    value.segments.forEach((candidate, index) => {
      const where = `review-evidence-envelope.segments[${index}]`;
      if (!isRecord(candidate)) {
        errors.push(`${where}: not an object`);
        return;
      }
      requireKeys(candidate, SEGMENT_KEYS, errors, where);
      noUnknownKeys(candidate, SEGMENT_KEYS, errors, where);
      if (typeof candidate.refId !== "string" || !IDENTIFIER_RE.test(candidate.refId)) {
        errors.push(`${where}: refId must be a stable identifier`);
      } else {
        if (seenRefs.has(candidate.refId)) errors.push(`${where}: duplicate refId "${candidate.refId}"`);
        seenRefs.add(candidate.refId);
        if (previousRef && candidate.refId.localeCompare(previousRef) <= 0) {
          errors.push(`${where}: segment order must be strictly ascending by refId`);
        }
        previousRef = candidate.refId;
      }
      if (typeof candidate.kind !== "string" || !REVIEW_EVIDENCE_KINDS.includes(candidate.kind as ReviewEvidenceKind)) {
        errors.push(`${where}: unknown kind "${String(candidate.kind)}"`);
      }
      if (typeof candidate.text !== "string" || candidate.text.trim().length === 0) {
        errors.push(`${where}: text must be non-empty`);
      }
      if (typeof candidate.sha256 !== "string" || !SHA256_RE.test(candidate.sha256)) {
        errors.push(`${where}: sha256 must be 64 lowercase hex characters`);
      } else if (typeof candidate.text === "string" && sha256Hex(candidate.text) !== candidate.sha256) {
        errors.push(`${where}: segment hash drift`);
      }
    });
  }

  if (!isRecord(value.immutableBindings)) {
    errors.push("review-evidence-envelope: immutableBindings must be an object");
  } else {
    validateBindingValue(value.immutableBindings, errors, "review-evidence-envelope.immutableBindings", new Set());
  }

  if (typeof value.envelopeSha256 !== "string" || !SHA256_RE.test(value.envelopeSha256)) {
    errors.push("review-evidence-envelope: envelopeSha256 must be 64 lowercase hex characters");
  } else if (
    value.schema === REVIEW_EVIDENCE_ENVELOPE_SCHEMA
    && typeof value.lane === "string"
    && Array.isArray(value.segments)
    && isRecord(value.immutableBindings)
  ) {
    try {
      const envelope = value as ReviewEvidenceEnvelopeV1;
      if (expectedReviewEvidenceEnvelopeSha256(envelope) !== value.envelopeSha256) {
        errors.push("review-evidence-envelope: envelope hash drift");
      }
    } catch (error) {
      errors.push(`review-evidence-envelope: cannot derive envelope hash: ${(error as Error).message}`);
    }
  }
  return errors;
}

export const REVIEW_EVIDENCE_ENVELOPE_CONTRACT: ContractDescriptor = {
  name: "review-evidence-envelope",
  version: 1,
  ownerPrompt: "IMP-24",
  description: "Lane-neutral, byte-bounded inline review evidence with deterministic packet-local references, per-segment hashes, immutable bindings, and an envelope hash over every substantive field except itself.",
  fields: {
    ReviewEvidenceSegmentV1: {
      refId: "unique stable packet-local string",
      kind: REVIEW_EVIDENCE_KINDS,
      text: "non-empty untrusted evidence data",
      sha256: "sha256(text)",
    },
    ReviewEvidenceEnvelopeV1: {
      schema: `\"${REVIEW_EVIDENCE_ENVELOPE_SCHEMA}\"`,
      lane: REVIEW_EVIDENCE_LANES,
      envelopeId: "string",
      caseId: "string",
      instrumentVersion: "string",
      segments: "ReviewEvidenceSegmentV1[] in deterministic refId order",
      immutableBindings: "Record<string, JSON value>",
      envelopeSha256: "sha256(canonical substantive fields excluding envelopeSha256)",
    },
    byteBudgets: REVIEW_EVIDENCE_ENVELOPE_MAX_BYTES,
  },
};
