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
 * forbiddenUses), frameworks, forbiddenClaims/forbiddenLeakage, source provenance
 * (sourceSidecarPath, sourceHash, chapterTitle), and anchor bodies (only anchor
 * IDS survive). bookWideDuplicate is projected as `sharedSpine` (S-tier P6,
 * 2026-07-03) — the one ranking-metadata field the writer needs, because "this
 * fact is every chapter's fact" changes how a chapter should teach it.
 *
 * IMP-03 (v2, F-005): the projection stopped dropping the SAFETY subset of the
 * case policy and source risk signal — the fields whose absence let writers
 * restamp protected specifics and state contested claims as settled law:
 *   - case `doNotRestamp` (the protected hard specifics) + `naturalSetting`;
 *   - fact `replicationStatus` (only when BELOW "robust" — the hedge signal;
 *     "robust"/absent stays out of the card as noise);
 *   - root `sourceRisks` (sourceQuality.risks, citation-stripped, capped).
 * Still deliberately dropped: allowedUses (a uniform constant — all uses allowed
 * on every case today) and forbiddenUses (one identical boilerplate sentence per
 * case; its CONTENT is carried categorically by the compiler-owned source-use
 * plan's forbiddenDetailTypes, rendered in the card's SOURCE-USE PLAN block).
 *
 * Pure function: no fs, no clock, no mutation of the input; returned arrays are
 * fresh (mutating the projection never touches the packet).
 *
 * PAGE-CITATION MINT-REMOVAL (CF-J Task 4, 2026-07-09). The radical-candor research
 * minted "Ch. N pp. N-M" locators INSIDE packet fact/case TEXT (99 occurrences across
 * that book's packets: "HHIPP is documented at Ch. 6 pp. 137-141 and 152.",
 * hardSpecifics entries that ARE bare citations like "Ch. 6 p. 138"). The projection
 * handed that text to the writer as the ONLY allowed factual material, and the writer
 * quoted it faithfully into reader prose — the release review's §7 apparatus-leakage
 * class. Every projected TEXT field (fact claim/mechanism/commonError/whyWrong, case
 * label/summary/hardSpecifics) is therefore passed through stripPageCitationSpans:
 * the citation span is deleted and the seams tidied; a hardSpecifics entry that IS a
 * citation is dropped. INVARIANTS: (a) the raw packet on disk stays untouched (this
 * function was already pure); (b) anchor IDs and every validation surface are
 * unchanged — sourceGrounding's SC11 matches by anchor ID against the SIDECAR
 * catalog, and its one text-based clause (SC11.2 hardSpecifics-presence) treats
 * citation-shaped specifics as internal coordinates satisfied by construction (see
 * sourceGrounding.ts checkUnit). The DETECTION half is critic C36
 * (critics/apparatusLeakage.ts), which shares the same citation grammar.
 */

import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { isPageCitationOnly, stripPageCitationSpans } from "../critics/apparatusLeakage.js";

export const WRITER_PACKET_PROJECTION_SCHEMA_VERSION = "chapterflow-writer-packet-v2" as const;

/** How many sourceQuality.risks lines reach the card (compactness cap). */
export const PROJECTED_SOURCE_RISKS_CAP = 6;

/**
 * R-046 — how much of a fact's or case's `sourceQuote` reaches the card.
 *
 * The card is budget-bound in absolute characters (tests/contract-refactor.test.ts),
 * and a packet can carry 18+ facts and 6 cases on an oversized unit, so an
 * unbounded quote per item would be the largest single addition the card has ever
 * taken. 200 characters is one or two sentences of source — enough for the writer
 * to see what the book actually says and write prose that is accurate by
 * construction, which is the whole point of carrying it.
 */
export const PROJECTED_SOURCE_QUOTE_CHARS = 200;

/** R-055 — how many keyClaims reach the READ-ONLY CONTEXT block. The sidecar
 *  contract asks for 4-8; six is the thesis without the tail. */
export const PROJECTED_KEY_CLAIMS_CAP = 6;

/** Truncate a projected quote on a word boundary, marking the cut. */
function boundedQuote(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = stripPageCitationSpans(value).trim();
  if (text.length === 0) return undefined;
  if (text.length <= PROJECTED_SOURCE_QUOTE_CHARS) return text;
  const cut = text.slice(0, PROJECTED_SOURCE_QUOTE_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > PROJECTED_SOURCE_QUOTE_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

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
  /** IMP-03 (v2): the researcher's replication verdict, projected ONLY when below
   *  "robust" — the writer must hedge this claim instead of stating settled law. */
  replicationStatus?: "mixed" | "contested" | "failed";
  /** R-046 (deliberate allowlist addition): the book's own words behind this
   *  fact, so the writer can be accurate by construction rather than by
   *  paraphrasing a paraphrase. Present only on a source-text packet. */
  sourceQuote?: string;
};

export type WriterPacketProjectionCase = {
  id: string;
  label: string;
  realWorld?: boolean;
  summary?: string;
  hardSpecifics?: string[];
  /** IMP-03 (v2): protected specifics — never relocate/restamp these onto other
   *  entities, places, or dates (citation-stripped like every text field). */
  doNotRestamp?: string[];
  /** IMP-03 (v2): the case's own documented setting, when research recorded one. */
  naturalSetting?: string;
  /** R-046: the book's own words behind this case's summary. */
  sourceQuote?: string;
  /** R-056: what each hardSpecific is a specific OF. Without it the only way to
   *  join two bare tokens in one sentence is to invent a predicate — which is
   *  exactly what the released "just one Dutch dollar. He spent it on three
   *  puffy rolls" is. */
  specificPropositions?: Array<{ specific: string; proposition: string }>;
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
  /** IMP-03 (v2): the packet's sourceQuality.risks, citation-stripped and capped —
   *  the writer sees the researcher's own risk notes on this chapter's evidence. */
  sourceRisks?: string[];
  /** R-055: the chapter's own thesis, READ-ONLY. Not a source of citable
   *  specifics — those stay in facts/cases, which the gates check. */
  chapterContext?: {
    focus?: string;
    coreClaim?: string;
    hardEdge?: string;
    keyClaims?: string[];
  };
  /** R-046: "source-text" when this chapter was quoted from the book. */
  sourceProvenance?: "source-text" | "model-memory";
};

/** Copy a string field only when it carries content (defensive against partially
 *  populated legacy packets; keeps empty-string noise out of the card), with page
 *  citations stripped (CF-J mint-removal — see the header). */
function textOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const stripped = stripPageCitationSpans(value);
  return stripped.length > 0 ? stripped : undefined;
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
      // claim is REQUIRED on the projection: strip citations but never drop the field
      // (a claim that somehow strips to "" keeps its original text — fail-open on the
      // writer's factual material rather than handing over an empty claim).
      const strippedClaim = typeof fact.claim === "string" ? stripPageCitationSpans(fact.claim) : fact.claim;
      const projected: WriterPacketProjectionFact = {
        id: fact.id,
        claim: typeof strippedClaim === "string" && strippedClaim.length > 0 ? strippedClaim : fact.claim,
      };
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
      // IMP-03 (v2): only the below-robust verdicts reach the card — the hedge signal.
      if (fact.replicationStatus === "mixed" || fact.replicationStatus === "contested" || fact.replicationStatus === "failed") {
        projected.replicationStatus = fact.replicationStatus;
      }
      const quote = boundedQuote(fact.sourceQuote);
      if (quote !== undefined) projected.sourceQuote = quote;
      return projected;
    }),
    namedCases: (packet.namedCases ?? []).map((namedCase) => {
      // label is REQUIRED: same strip-but-never-drop policy as fact.claim above.
      const strippedLabel = typeof namedCase.label === "string" ? stripPageCitationSpans(namedCase.label) : namedCase.label;
      const projected: WriterPacketProjectionCase = {
        id: namedCase.id,
        label: typeof strippedLabel === "string" && strippedLabel.length > 0 ? strippedLabel : namedCase.label,
      };
      if (typeof namedCase.realWorld === "boolean") projected.realWorld = namedCase.realWorld;
      const summary = textOrUndefined(namedCase.summary);
      if (summary !== undefined) projected.summary = summary;
      if (Array.isArray(namedCase.hardSpecifics) && namedCase.hardSpecifics.length > 0) {
        // A hardSpecific that IS a page citation ("Ch. 6 p. 138") is an internal
        // locator, not writer material — DROP it; strip citations inside the rest.
        const specifics = namedCase.hardSpecifics
          .filter((s) => !isPageCitationOnly(String(s)))
          .map((s) => stripPageCitationSpans(String(s)))
          .filter((s) => s.length > 0);
        if (specifics.length > 0) projected.hardSpecifics = specifics;
      }
      // IMP-03 (v2): the case's SAFETY policy subset — same citation hygiene as
      // hardSpecifics for doNotRestamp (they are drawn from the same tokens).
      if (Array.isArray(namedCase.doNotRestamp) && namedCase.doNotRestamp.length > 0) {
        const protectedSpecifics = namedCase.doNotRestamp
          .filter((s) => !isPageCitationOnly(String(s)))
          .map((s) => stripPageCitationSpans(String(s)))
          .filter((s) => s.length > 0);
        if (protectedSpecifics.length > 0) projected.doNotRestamp = protectedSpecifics;
      }
      const naturalSetting = textOrUndefined(namedCase.naturalSetting);
      if (naturalSetting !== undefined) projected.naturalSetting = naturalSetting;
      const caseQuote = boundedQuote(namedCase.sourceQuote);
      if (caseQuote !== undefined) projected.sourceQuote = caseQuote;
      const propositions = (namedCase.specificPropositions ?? [])
        .map((entry) => ({ specific: stripPageCitationSpans(String(entry?.specific ?? "")).trim(), proposition: stripPageCitationSpans(String(entry?.proposition ?? "")).trim() }))
        .filter((entry) => entry.specific.length > 0 && entry.proposition.length > 0);
      if (propositions.length > 0) projected.specificPropositions = propositions;
      return projected;
    }),
    allowedAnchors: (packet.allowedAnchors ?? []).map((anchor) => anchor.id),
    sourceQualityStatus: packet.sourceQuality?.status ?? "unknown",
  };
  // IMP-03 (v2): the researcher's own risk notes, citation-stripped and capped.
  const risks = (packet.sourceQuality?.risks ?? [])
    .map((r) => stripPageCitationSpans(String(r)))
    .filter((r) => r.length > 0)
    .slice(0, PROJECTED_SOURCE_RISKS_CAP);
  if (risks.length > 0) projection.sourceRisks = risks;
  // R-055: the chapter's thesis, deliberately added to the allowlist.
  if (packet.chapterContext) {
    const context: NonNullable<WriterPacketProjection["chapterContext"]> = {};
    const focus = textOrUndefined(packet.chapterContext.focus);
    if (focus !== undefined) context.focus = focus;
    const coreClaim = textOrUndefined(packet.chapterContext.coreClaim);
    if (coreClaim !== undefined) context.coreClaim = coreClaim;
    const hardEdge = textOrUndefined(packet.chapterContext.hardEdge);
    if (hardEdge !== undefined) context.hardEdge = hardEdge;
    const keyClaims = (packet.chapterContext.keyClaims ?? [])
      .map((claim) => stripPageCitationSpans(String(claim)).trim())
      .filter((claim) => claim.length > 0)
      .slice(0, PROJECTED_KEY_CLAIMS_CAP);
    if (keyClaims.length > 0) context.keyClaims = keyClaims;
    if (Object.keys(context).length > 0) projection.chapterContext = context;
  }
  if (packet.sourceProvenance !== undefined) projection.sourceProvenance = packet.sourceProvenance;
  return projection;
}
