/** Deterministic IMP-24 evidence-reference resolution. */

import type {
  ReviewEvidenceEnvelopeV1,
  ReviewEvidenceKind,
  ReviewEvidenceSegmentV1,
} from "../contracts/reviewEvidenceEnvelope.js";
import { assertReviewEvidenceEnvelope } from "./reviewEvidenceEnvelope.js";

export type EvidenceReferenceResolutionErrorCode =
  | "EMPTY_REFERENCE_SET"
  | "DUPLICATE_REFERENCE"
  | "MISSING_REFERENCE"
  | "WRONG_KIND";

export class EvidenceReferenceResolutionError extends Error {
  constructor(
    message: string,
    readonly code: EvidenceReferenceResolutionErrorCode,
    readonly refId?: string,
  ) {
    super(message);
    this.name = "EvidenceReferenceResolutionError";
  }
}

export type ResolveEvidenceReferenceOptions = {
  allowedKinds: readonly ReviewEvidenceKind[];
  /** Findings and judgment claims require evidence.  Set false only for fields
   *  whose contract explicitly permits an empty reference list. */
  required?: boolean;
  where?: string;
};

export type ResolvedEvidenceReferencesV1 = {
  evidenceRefIds: string[];
  evidenceSpans: string[];
  segments: ReviewEvidenceSegmentV1[];
};

export function indexReviewEvidenceEnvelope(
  envelope: ReviewEvidenceEnvelopeV1,
): ReadonlyMap<string, ReviewEvidenceSegmentV1> {
  assertReviewEvidenceEnvelope(envelope);
  return new Map(envelope.segments.map((segment) => [segment.refId, segment]));
}

export function resolveEvidenceRefIds(
  envelope: ReviewEvidenceEnvelopeV1,
  refIds: readonly string[],
  options: ResolveEvidenceReferenceOptions,
): ResolvedEvidenceReferencesV1 {
  const where = options.where ?? "evidenceRefIds";
  const required = options.required ?? true;
  if (!Array.isArray(refIds) || (required && refIds.length === 0)) {
    throw new EvidenceReferenceResolutionError(`${where}: evidence references must be non-empty`, "EMPTY_REFERENCE_SET");
  }
  if (options.allowedKinds.length === 0) {
    throw new EvidenceReferenceResolutionError(`${where}: no evidence kinds are allowed`, "WRONG_KIND");
  }

  const index = indexReviewEvidenceEnvelope(envelope);
  const seen = new Set<string>();
  const segments: ReviewEvidenceSegmentV1[] = [];
  for (const refId of refIds) {
    if (typeof refId !== "string" || refId.length === 0) {
      throw new EvidenceReferenceResolutionError(`${where}: empty evidence reference`, "MISSING_REFERENCE", String(refId));
    }
    if (seen.has(refId)) {
      throw new EvidenceReferenceResolutionError(`${where}: duplicate evidence reference "${refId}"`, "DUPLICATE_REFERENCE", refId);
    }
    seen.add(refId);
    const segment = index.get(refId);
    if (!segment) {
      throw new EvidenceReferenceResolutionError(`${where}: missing evidence reference "${refId}"`, "MISSING_REFERENCE", refId);
    }
    if (!options.allowedKinds.includes(segment.kind)) {
      throw new EvidenceReferenceResolutionError(
        `${where}: evidence reference "${refId}" has kind "${segment.kind}"; expected ${options.allowedKinds.join("|")}`,
        "WRONG_KIND",
        refId,
      );
    }
    segments.push(segment);
  }
  return {
    evidenceRefIds: [...refIds],
    evidenceSpans: segments.map((segment) => segment.text),
    segments,
  };
}

export function resolveEvidenceRefGroups(
  envelope: ReviewEvidenceEnvelopeV1,
  groups: readonly (readonly string[])[],
  options: ResolveEvidenceReferenceOptions,
): ResolvedEvidenceReferencesV1[] {
  return groups.map((group, index) => resolveEvidenceRefIds(envelope, group, {
    ...options,
    where: `${options.where ?? "evidenceRefIds"}[${index}]`,
  }));
}
