/**
 * Shared IMP-24 V2 protocol predicates.
 *
 * Production and V3 qualification must use these exact symbols for every
 * gate-bearing reader category, evidence-freshness comparison, and raw-output
 * protocol classification.  Keep this module pure: it reads no files, spawns no
 * process, and owns no qualification gold.
 */

import type { ReviewEvidenceLane } from "../contracts/reviewEvidenceEnvelope.js";
import type { ReaderExperienceReviewV2 } from "../contracts/reviewModelOutputV2.js";
import { computeReaderComposite } from "./aggregateChapterReview.js";

export const REVIEW_EVIDENCE_PROTOCOL_V2 = "review-evidence-envelope-v1" as const;

export type ReaderDecisionCategoryV2 = "PASS" | "REVISE" | "BLOCK";

/** The model recommendation is deliberately absent from this projection. The
 * finding surfaces are intentionally structural so the same predicate can
 * verify the legacy aggregate projection as well as the authoritative V2
 * review without requiring V1 findings to acquire V2 evidence fields. */
export type ReaderDecisionInputV2 = {
  scores: ReaderExperienceReviewV2["scores"];
  blockingFindings: readonly unknown[];
  advisoryFindings: readonly unknown[];
  escalationSignals: readonly { category: string }[];
};

export function deriveReaderDecisionCategoryV2(
  review: ReaderDecisionInputV2,
  readerBar: number,
): ReaderDecisionCategoryV2 {
  if (review.blockingFindings.length > 0) return "BLOCK";
  if (
    computeReaderComposite(review.scores) < readerBar
    || review.advisoryFindings.length > 0
    || review.escalationSignals.some((finding) => finding.category === "origin_ambiguous_to_reader")
  ) return "REVISE";
  return "PASS";
}

export const READER_DECISION_POLICY_V2 = "reader-decision-policy-v2" as const;
export const READER_DECISION_POLICY_V3 = "reader-decision-policy-v3" as const;
export type ReaderDecisionPolicyVersion =
  | typeof READER_DECISION_POLICY_V2
  | typeof READER_DECISION_POLICY_V3;

/** Owner-ratified decision policy v3 (D1, 2026-07-15 — see
 * docs/v25/reports/V25_PILOT_READINESS_OWNER_RATIFICATION.md): advisory
 * findings and origin-ambiguity escalations are retained evidence and
 * telemetry, never gates. Every real control carries advisories, so under V2
 * an ACTIVE pipeline could never commit a first write. Blockers and the exact
 * reader bar are unchanged. Closed identities and their retained evidence stay
 * scored under V2 — history is never re-scored with a successor policy. */
export function deriveReaderDecisionCategoryV3(
  review: ReaderDecisionInputV2,
  readerBar: number,
): ReaderDecisionCategoryV2 {
  if (review.blockingFindings.length > 0) return "BLOCK";
  if (computeReaderComposite(review.scores) < readerBar) return "REVISE";
  return "PASS";
}

export function deriveReaderDecisionCategory(
  policy: ReaderDecisionPolicyVersion,
  review: ReaderDecisionInputV2,
  readerBar: number,
): ReaderDecisionCategoryV2 {
  return policy === READER_DECISION_POLICY_V3
    ? deriveReaderDecisionCategoryV3(review, readerBar)
    : deriveReaderDecisionCategoryV2(review, readerBar);
}

export type ReviewProtocolFreshnessLaneV2 = ReviewEvidenceLane | "aggregate";

/**
 * Common exact-comparison surface. Context-specific immutable values live in
 * `bindings`; the comparison predicate remains identical in production and
 * qualification.
 */
export type ReviewProtocolFreshnessProjectionV2 = {
  reviewProtocol: string;
  lane: ReviewProtocolFreshnessLaneV2;
  evidenceEnvelopeSha256: string | null;
  evidenceEnvelopeBytesSha256: string | null;
  bindings: Readonly<Record<string, string | null>>;
};

const SHA256 = /^[a-f0-9]{64}$/;

export function reviewProtocolFreshnessErrorsV2(
  expected: ReviewProtocolFreshnessProjectionV2,
  observed: ReviewProtocolFreshnessProjectionV2,
): string[] {
  const errors: string[] = [];
  if (expected.reviewProtocol !== REVIEW_EVIDENCE_PROTOCOL_V2) {
    errors.push(`expected review protocol is not ${REVIEW_EVIDENCE_PROTOCOL_V2}`);
  }
  if (observed.reviewProtocol !== expected.reviewProtocol) errors.push("review protocol mismatch");
  if (observed.lane !== expected.lane) errors.push("review lane mismatch");

  for (const [label, expectedValue, observedValue] of [
    ["evidence envelope", expected.evidenceEnvelopeSha256, observed.evidenceEnvelopeSha256],
    ["evidence envelope bytes", expected.evidenceEnvelopeBytesSha256, observed.evidenceEnvelopeBytesSha256],
  ] as const) {
    if (expectedValue !== null && !SHA256.test(expectedValue)) errors.push(`expected ${label} hash is invalid`);
    if (observedValue !== null && !SHA256.test(observedValue)) errors.push(`observed ${label} hash is invalid`);
    if (observedValue !== expectedValue) errors.push(`${label} hash mismatch`);
  }

  const expectedKeys = Object.keys(expected.bindings).sort();
  const observedKeys = Object.keys(observed.bindings).sort();
  if (expectedKeys.join("\n") !== observedKeys.join("\n")) errors.push("freshness binding key set mismatch");
  for (const key of expectedKeys) {
    const expectedValue = expected.bindings[key] ?? null;
    const observedValue = observed.bindings[key] ?? null;
    if (observedValue !== expectedValue) errors.push(`freshness binding mismatch: ${key}`);
  }
  return [...new Set(errors)];
}

const FILE_ACCESS_FAILURE = /(?:could not|cannot|can't|unable to|failed to)\s+(?:open|read|access).{0,80}(?:file|path|workspace)|file (?:was|is) not (?:available|found|accessible)/i;

export function reviewProtocolFileAccessFailureV2(raw: string): boolean {
  return FILE_ACCESS_FAILURE.test(raw);
}

const PROHIBITED_CONDUCTOR_ECHO_KEYS: Readonly<Record<ReviewEvidenceLane, readonly string[]>> = Object.freeze({
  reader: Object.freeze([
    "chapterContentSha256", "readerDocumentSha256", "evidenceEnvelopeSha256", "schemaSha256",
    "promptSha256", "promptSourceSha256", "reviewerRole", "roleIdentity", "finalStatus", "result",
  ]),
  source: Object.freeze([
    "unitId", "findingId", "expectedOrigin", "expectedForm", "claimStrengthExpected",
    "chapterContentSha256", "sourceUsePlanSha256", "sourcePacketSha256", "sidecarSha256",
    "evidenceEnvelopeSha256", "schemaSha256", "promptSha256", "promptSourceSha256",
    "reviewerRole", "roleIdentity", "finalStatus", "result", "blockingFindingIds",
  ]),
  quiz: Object.freeze([
    "itemId", "keyedAnswerIndex", "derivedAnswerIndex", "committedDerivedAnswerIndex", "agreement",
    "chapterContentSha256", "phase2DocumentSha256", "derivationSha256", "evidenceEnvelopeSha256",
    "schemaSha256", "promptSha256", "promptSourceSha256", "reviewerSessionId", "reviewerRole",
    "roleIdentity", "finalStatus", "result",
  ]),
});

export function reviewProtocolProhibitedConductorEchoKeysV2(
  raw: string,
  lane: ReviewEvidenceLane,
): string[] {
  return PROHIBITED_CONDUCTOR_ECHO_KEYS[lane]
    .filter((key) => new RegExp(`"${key}"\\s*:`).test(raw));
}

export function reviewProtocolHasProhibitedConductorEchoV2(
  raw: string,
  lane: ReviewEvidenceLane,
): boolean {
  return reviewProtocolProhibitedConductorEchoKeysV2(raw, lane).length > 0;
}
