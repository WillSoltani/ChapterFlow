/**
 * A4 (v24) — writerPacketProjection: the card diet.
 *
 * A section task card currently embeds the FULL source-packet JSON (~28.6k of a
 * ~41.6k-char card) and is paid 4x per chapter. The v24 whole-chapter writer only
 * needs the packet's teachable substance, so this module projects a SourcePacketV1
 * down to a slim, STRICT-ALLOWLIST view.
 *
 * Allowlist policy: every field on the projection is copied EXPLICITLY, field by
 * field, from the packet. Nothing is spread or cloned wholesale, so any field added
 * to SourcePacketV1 in the future is dropped here by default (a new field must be
 * deliberately added to the allowlist to reach the writer). Dropped on purpose:
 * ranking/dealing metadata (teachingPriority, coreMoveFactId), grounding
 * inventories (allowedNumbers/Entities/Places, groundedNumbers/Entities/
 * Places, allowedClaimTypes, verificationRefs), case linkage internals (allowedUses,
 * forbiddenUses, doNotRestamp, naturalSetting), frameworks, forbiddenClaims/
 * forbiddenLeakage, source provenance (sourceSidecarPath, sourceHash, chapterTitle),
 * anchor bodies (only anchor IDS survive), and sourceQuality.risks.
 * bookWideDuplicate is projected as `sharedSpine` (S-tier P6, 2026-07-03) — the one
 * ranking-metadata field the writer needs, because "this fact is every chapter's
 * fact" changes how a chapter should teach it.
 *
 * Pure function: no fs, no clock, no mutation of the input; returned arrays are
 * fresh (mutating the projection never touches the packet).
 */

import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";

export const WRITER_PACKET_PROJECTION_SCHEMA_VERSION = "chapterflow-writer-packet-v1" as const;

export type WriterPacketProjectionFact = {
  id: string;
  claim: string;
  mechanism?: string;
  commonError?: string;
  whyWrong?: string;
  /** S-tier P6 (2026-07-03, deliberate allowlist addition): true when research tagged this
   *  fact bookWideDuplicate — the shared framework spine every chapter's packet carries.
   *  The card instructs writers to reference spine facts briefly through their own angle
   *  instead of re-deriving them (the halted `execution` run's nine writers each re-taught
   *  the full framework at full strength — the saturation seed). */
  sharedSpine?: true;
};

export type WriterPacketProjectionCase = {
  id: string;
  label: string;
  realWorld?: boolean;
  summary?: string;
  hardSpecifics?: string[];
};

export type WriterPacketProjection = {
  schemaVersion: typeof WRITER_PACKET_PROJECTION_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  facts: WriterPacketProjectionFact[];
  namedCases: WriterPacketProjectionCase[];
  /** Anchor IDS only (SourceAnchorForPrompt.id) — labels/text/kind stay out of the card. */
  allowedAnchors: string[];
  sourceQualityStatus: string;
};

/** Copy a string field only when it carries content (defensive against partially
 *  populated legacy packets; keeps empty-string noise out of the card). */
function textOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Project a full source packet down to the slim writer view. Array order is
 *  preserved exactly as it appears in the packet. */
export function writerPacketProjection(packet: SourcePacketV1): WriterPacketProjection {
  const projection: WriterPacketProjection = {
    schemaVersion: WRITER_PACKET_PROJECTION_SCHEMA_VERSION,
    bookId: packet.bookId,
    chapterId: packet.chapterId,
    chapterNumber: packet.chapterNumber,
    facts: (packet.facts ?? []).map((fact) => {
      const projected: WriterPacketProjectionFact = { id: fact.id, claim: fact.claim };
      const mechanism = textOrUndefined(fact.mechanism);
      if (mechanism !== undefined) projected.mechanism = mechanism;
      const commonError = textOrUndefined(fact.commonError);
      if (commonError !== undefined) projected.commonError = commonError;
      const whyWrong = textOrUndefined(fact.whyWrong);
      if (whyWrong !== undefined) projected.whyWrong = whyWrong;
      // #19 (adversarial round 2): the chapter's OWN core move is never spine-marked,
      // even when research tagged it bookWideDuplicate — a writer told to "reference
      // briefly" the fact their whole chapter teaches would under-teach the chapter.
      if (fact.bookWideDuplicate === true && fact.id !== packet.coreMoveFactId) projected.sharedSpine = true;
      return projected;
    }),
    namedCases: (packet.namedCases ?? []).map((namedCase) => {
      const projected: WriterPacketProjectionCase = { id: namedCase.id, label: namedCase.label };
      if (typeof namedCase.realWorld === "boolean") projected.realWorld = namedCase.realWorld;
      const summary = textOrUndefined(namedCase.summary);
      if (summary !== undefined) projected.summary = summary;
      if (Array.isArray(namedCase.hardSpecifics) && namedCase.hardSpecifics.length > 0) {
        projected.hardSpecifics = [...namedCase.hardSpecifics];
      }
      return projected;
    }),
    allowedAnchors: (packet.allowedAnchors ?? []).map((anchor) => anchor.id),
    sourceQualityStatus: packet.sourceQuality?.status ?? "unknown",
  };
  return projection;
}
