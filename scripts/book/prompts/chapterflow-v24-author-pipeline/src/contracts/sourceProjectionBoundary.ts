/**
 * Source ontology / projection-boundary contract (frozen by WP-305; V25 S-Tier
 * §8 Lane 3). This descriptor freezes the BOUNDARY between the three source
 * surfaces so drift stales the advisory source review that depends on it.
 *
 * ── THE THREE-SURFACE MODEL (master plan §5 target architecture) ──────────────
 *
 * The compiler owns one source truth and projects it to two DIFFERENT downstream
 * consumers with DELIBERATELY different amounts of evidence:
 *
 *   1. FULL SOURCE PACKET  (compiler / QC truth)
 *        SourcePacketV1 + source sidecar + immutable SourceUsePlanV1 + anchor
 *        catalog. The complete external-factual-truth substrate: every case's
 *        use permissions (`allowedUses`) and forbidden-use rationale
 *        (`forbiddenUses`), every fact's grounding inventory and verification
 *        refs, source provenance (`sourceSidecarPath`/`sourceHash`), frameworks,
 *        forbidden-leakage edges, and full anchor bodies.
 *
 *   2. SOURCE-REVIEW PACKET  (advisory review lane — `assembleSourceReviewPacket`)
 *        The reviewer's FULLER-THAN-WRITER projection. It carries the WHOLE
 *        SourcePacketV1 (so it still holds `allowedUses`/`forbiddenUses` and
 *        provenance), the sidecar, the compiler-owned plan LICENSE lines, and the
 *        full anchor catalog — everything needed to adjudicate whether a claim is
 *        SUPPORTED by source evidence. It is key-blind (the answer key is stripped)
 *        but it is NEVER source-blind.
 *
 *   3. WRITER PROJECTION  (the card diet — `writerPacketProjection`)
 *        A slim STRICT-ALLOWLIST view for the whole-chapter writer. It DROPS the
 *        source-evidence fields the writer must not see: case `allowedUses`/
 *        `forbiddenUses`, root provenance/grounding inventories/frameworks/
 *        forbidden edges, fact `verificationRefs`/grounded-* and `allowedClaimTypes`,
 *        and every anchor BODY (only anchor IDs survive). The writer gets the
 *        teachable substance; it never gets the adjudication evidence.
 *
 * Containment: FULL ⊇ SOURCE-REVIEW ⊋ WRITER. The review packet is a proper
 * SUPERSET of the writer projection on the source-evidence axis; collapsing the
 * two is the defect this contract forbids.
 *
 * ── WHY (V25-09/10; §5) ───────────────────────────────────────────────────────
 *
 * The rubric-audit recovery found the historical source-reviewer false positives
 * (cleanPass 0.125) were partly an INSTRUMENT artifact: the source lane was run
 * SOURCE-BLIND — handed the reader-facing document alone, it could not tell a
 * legitimately source-bound named example (an anchored case the plan authorizes)
 * from an invented one, so it flagged supported details as fabricated. The fix in
 * §5's target architecture is a source-EQUIPPED advisory lane: the reviewer that
 * physically holds the packet + sidecar + plan + anchors can adjudicate that same
 * example as SUPPORTED. This contract PINS the equipped surface (so a future edit
 * that diets the reviewer input back toward the writer projection is caught) and
 * PINS the writer diet (so the writer never regains the evidence it must not see).
 *
 * The origin/form/claim-strength ONTOLOGY itself is frozen separately by the
 * `source-use-plan` contract (v1, IMP-03); those enums are IMPORTED here, never
 * re-declared. This descriptor freezes the PROJECTION BOUNDARY that carries that
 * ontology across the three surfaces — a distinct, additive concern.
 *
 * WP-305 supplies this inputs contract ONLY. The advisory lane's runtime refusal
 * of a source-blind invocation, its non-blocking aggregation, and its role
 * selection are WP-403's; this module is imported by that lane, it does not edit
 * it. `assertSourceReviewPacketEquipped` is the fail-closed helper WP-403 wires.
 */

import { ContractDescriptor, isStringArray } from "./contractUtil.js";
import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import type { SourceReviewPacketV1 } from "../review/sourceIntegrityReview.js";
import type { WriterPacketProjection } from "../compiler/sourcePacketProjection.js";

// ── the boundary field sets (the LOAD-BEARING freeze) ─────────────────────────

/** Case-level source-evidence the writer projection STRIPS and the reviewer
 *  MUST carry: the use permissions and the forbidden-use rationale. Their absence
 *  from the writer card is the diet; their PRESENCE in the review packet is what
 *  lets an anchored source_bound case be adjudicated SUPPORTED, not invented. */
export const WRITER_STRIPPED_CASE_EVIDENCE = ["allowedUses", "forbiddenUses"] as const;

/** Fact-level source-evidence the writer projection STRIPS and the reviewer
 *  carries (via the full packet): grounding inventories, verification refs, and
 *  the allowed-claim-type permission set. */
export const WRITER_STRIPPED_FACT_EVIDENCE = [
  "allowedClaimTypes",
  "groundedNumbers",
  "groundedEntities",
  "groundedPlaces",
  "verificationRefs",
] as const;

/** Root-level source-evidence the writer projection STRIPS and the reviewer
 *  carries (via the full packet): provenance, grounding allow-lists, framework
 *  completeness, forbidden claims, and forbidden-leakage edges. */
export const WRITER_STRIPPED_ROOT_EVIDENCE = [
  "sourceSidecarPath",
  "sourceHash",
  "chapterTitle",
  "allowedNumbers",
  "allowedEntities",
  "allowedPlaces",
  "forbiddenClaims",
  "forbiddenLeakage",
  "frameworks",
] as const;

/** The union: every source-evidence field name that lives on the FULL packet and
 *  the SOURCE-REVIEW packet but is deliberately absent from the WRITER projection.
 *  A writer projection containing ANY of these has breached the diet boundary. */
export const WRITER_STRIPPED_SOURCE_EVIDENCE: readonly string[] = [
  ...WRITER_STRIPPED_CASE_EVIDENCE,
  ...WRITER_STRIPPED_FACT_EVIDENCE,
  ...WRITER_STRIPPED_ROOT_EVIDENCE,
];

/** The frozen shape of the source-review packet the advisory lane consumes
 *  (`SourceReviewPacketV1`). Every field is required; `sourcePacket` carries the
 *  FULL packet, `anchorCatalog` carries full anchor BODIES (not just ids). */
export const SOURCE_REVIEW_PACKET_SURFACE = [
  "role",
  "chapterDocument",
  "sourcePlanLicense",
  "sourcePacket",
  "sourceSidecar",
  "anchorCatalog",
  "requiredSourceUnitIds",
] as const;

// ── refusal error (fail-closed; the helper WP-403 wires) ──────────────────────

/** The source-equipped input contract was violated — a source-blind or dieted
 *  input reached (or would reach) the source lane. WP-403 raises this to REFUSE a
 *  source verdict produced without the source artifacts (never a silent PASS). */
export class SourceProjectionBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceProjectionBoundaryError";
  }
}

// ── equipped check (the advisory lane input is the FULL source review packet) ──

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Error-string list ([] = the input is SOURCE-EQUIPPED). A source-review packet is
 * equipped iff it carries the full source substrate the writer projection strips:
 *   • every SOURCE_REVIEW_PACKET_SURFACE field is present;
 *   • `sourcePacket` is the full packet — root provenance keys present, and every
 *     named case still carries `allowedUses` + `forbiddenUses` (the exact fields
 *     the writer diet removes — their presence is what closes the source-blind
 *     false-positive class);
 *   • `sourceSidecar` is present (the source lane refuses a null sidecar);
 *   • `sourcePlanLicense` is a non-empty compiler-owned license (string[]);
 *   • `anchorCatalog` is an array of anchor BODIES (not merely id strings).
 * A source-blind reader-document-only input, or the dieted writer projection
 * substituted for the packet, fails every packet-evidence clause.
 */
export function sourceReviewPacketEquippedErrors(input: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(input)) return ["source-review packet: not an object (source-blind)"];

  for (const f of SOURCE_REVIEW_PACKET_SURFACE) {
    if (!(f in input) || input[f] === undefined) errors.push(`source-review packet: missing required field "${f}"`);
  }

  // The chapter document alone is the source-BLIND surface; the packet is what
  // makes it equipped. Assert the FULL packet, not a dieted projection.
  const packet = input.sourcePacket;
  if (!isRecord(packet)) {
    errors.push("source-review packet: sourcePacket is not the full source packet (source-blind or dieted)");
  } else {
    for (const f of WRITER_STRIPPED_ROOT_EVIDENCE) {
      if (!(f in packet)) errors.push(`source-review packet: sourcePacket is missing root source-evidence "${f}" (dieted toward the writer projection)`);
    }
    if (!Array.isArray(packet.namedCases)) {
      errors.push("source-review packet: sourcePacket.namedCases is not an array (full-packet case evidence absent)");
    } else {
      packet.namedCases.forEach((c, i) => {
        if (!isRecord(c)) { errors.push(`source-review packet: sourcePacket.namedCases[${i}] is not an object`); return; }
        for (const f of WRITER_STRIPPED_CASE_EVIDENCE) {
          if (!(f in c)) errors.push(`source-review packet: sourcePacket.namedCases[${i}] is missing case source-evidence "${f}" (the writer-stripped permission the reviewer needs to adjudicate SUPPORTED)`);
        }
      });
    }
  }

  if (input.sourceSidecar === undefined || input.sourceSidecar === null) {
    errors.push("source-review packet: sourceSidecar is absent (a source blocker is unfalsifiable without it)");
  }
  if (!isStringArray(input.sourcePlanLicense) || (input.sourcePlanLicense as string[]).length === 0) {
    errors.push("source-review packet: sourcePlanLicense must be a non-empty compiler-owned license (string[])");
  }
  if (!Array.isArray(input.anchorCatalog)) {
    errors.push("source-review packet: anchorCatalog must be an array of anchor bodies");
  } else if (input.anchorCatalog.some((a) => typeof a === "string")) {
    // Writer-projection anchors are bare id STRINGS; the reviewer holds full bodies.
    errors.push("source-review packet: anchorCatalog carries bare anchor id strings (writer-projection anchors), not full anchor bodies");
  }
  return errors;
}

/** True iff the source-review packet is equipped with the full source substrate. */
export function isSourceReviewPacketEquipped(input: SourceReviewPacketV1 | unknown): boolean {
  return sourceReviewPacketEquippedErrors(input).length === 0;
}

/** Fail-closed guard: throw `SourceProjectionBoundaryError` when the source lane's
 *  input is source-blind or dieted. This is the helper the advisory lane (WP-403)
 *  wires to REFUSE a verdict produced without the source artifacts. WP-305 defines
 *  it; it does not call it inside the lane runtime (that composition is WP-403's). */
export function assertSourceReviewPacketEquipped(input: SourceReviewPacketV1 | unknown): asserts input is SourceReviewPacketV1 {
  const errors = sourceReviewPacketEquippedErrors(input);
  if (errors.length > 0) {
    throw new SourceProjectionBoundaryError(`source lane input is not source-equipped: ${errors.join("; ")}`);
  }
}

// ── writer-diet check (the writer projection must strip what it must) ──────────

/** Every object key reachable from `value` (recursive, arrays included). */
function collectKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      collectKeys(child, into);
    }
  }
  return into;
}

/** The writer-stripped source-evidence field names that LEAKED into a writer
 *  projection ([] = the diet holds). A non-empty result means the projection
 *  regained evidence it must never carry — the diet boundary is breached. */
export function writerProjectionLeakedSourceEvidence(projection: WriterPacketProjection | unknown): string[] {
  const keys = collectKeys(projection);
  return WRITER_STRIPPED_SOURCE_EVIDENCE.filter((f) => keys.has(f)).sort();
}

/** Fail-closed guard: throw when the writer projection carries source-evidence it
 *  must strip (keeps the writer/reviewer projections distinct from the writer side). */
export function assertWriterProjectionDieted(projection: WriterPacketProjection | unknown): void {
  const leaked = writerProjectionLeakedSourceEvidence(projection);
  if (leaked.length > 0) {
    throw new SourceProjectionBoundaryError(`writer projection leaked writer-stripped source-evidence: ${leaked.join(", ")}`);
  }
}

/** True iff the reviewer packet is a PROPER superset of the writer projection on
 *  the source-evidence axis: the reviewer is equipped AND the writer projection is
 *  dieted (they are not the same collapsed surface). Distinctness invariant #4. */
export function sourceReviewProjectionIsDistinctFromWriter(
  reviewPacket: SourceReviewPacketV1 | unknown,
  writerProjection: WriterPacketProjection | unknown,
): boolean {
  return isSourceReviewPacketEquipped(reviewPacket) && writerProjectionLeakedSourceEvidence(writerProjection).length === 0;
}

// ── the frozen descriptor ─────────────────────────────────────────────────────

export const SOURCE_PROJECTION_BOUNDARY_CONTRACT: ContractDescriptor = {
  name: "source-projection-boundary",
  version: 1,
  ownerPrompt: "WP-305",
  description:
    "The three-surface source boundary: full source packet (compiler/QC truth) ⊇ source-review packet (advisory lane, assembleSourceReviewPacket) ⊋ writer projection (dieted, writerPacketProjection). Freezes the source-evidence fields the writer strips and the reviewer must carry, so the advisory source lane is provably source-EQUIPPED (never source-blind) and the writer diet cannot silently regain adjudication evidence. Origin/form/claim-strength ontology is frozen separately by source-use-plan (v1).",
  fields: {
    threeSurfaceModel:
      "FULL(SourcePacketV1 + sidecar + SourceUsePlanV1 + anchorCatalog) ⊇ SOURCE_REVIEW(SourceReviewPacketV1) ⊋ WRITER(WriterPacketProjection)",
    containmentRule:
      "the source-review packet is a proper superset of the writer projection on the source-evidence axis; collapsing them (source-blind lane) is forbidden and refused fail-closed by WP-403",
    reviewerEquippedSurface: SOURCE_REVIEW_PACKET_SURFACE,
    writerStrippedSourceEvidence: {
      case: WRITER_STRIPPED_CASE_EVIDENCE,
      fact: WRITER_STRIPPED_FACT_EVIDENCE,
      root: WRITER_STRIPPED_ROOT_EVIDENCE,
    },
    ontologyRef:
      "origin/form/claim-strength frozen by source-use-plan v1 (SourceOriginV1|UnitFormV1|ClaimStrengthV1 imported, never re-declared)",
    failClosed:
      "missing source evidence yields INCONCLUSIVE at the lane (never a guessed PASS); a source-blind/dieted input is refused via assertSourceReviewPacketEquipped",
  },
};
