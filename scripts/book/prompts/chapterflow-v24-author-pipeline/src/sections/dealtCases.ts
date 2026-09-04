import type { ChapterBlueprintV1, SourcePacketV1, SummaryPackV1 } from "../artifacts/artifactTypes.js";
import type { SourceAnchorForPrompt, SourceClaimType } from "../types.js";
import {
  chapterProseText,
  countSpecificsInProse,
  hasDraftedReadTiers,
  normalizeDerivabilityText,
  standaloneProseText,
  type ChapterProseSource,
} from "./chapterProse.js";

/**
 * DEALT CASES — the cases a chapter's blueprint ASSIGNS to its tested surfaces,
 * and how well the chapter's own prose teaches them.
 *
 * WHY THIS MODULE EXISTS (live Franklin run, 2026-09-04, rounds 2..n). The
 * compiler drafts a chapter in SECTION_KINDS order and CACHES each pack the
 * instant it passes its gate. Round 2 stored a gate-clean ch02 summary and then
 * failed, three attempts running, on:
 *
 *   SEC128.chapter_case_untaught@/examples/0: example 1 cite
 *   ch02.case.matthew_adams_ballads but this chapter's reader-visible prose
 *   carries only 1/2 of that case's hardSpecifics (Matthew Adams, The Lighthouse
 *   Tragedy, Captain Worthilake, Blackbeard)
 *
 * The example writer could not fix it. Its slot's case is DEALT
 * (blueprint.sections.examples[0].requiredCaseIds, wave-1 dealing under
 * BPV10/BPV11) — recompiling ch02's blueprint from the frozen sidecar puts
 * `ch02.case.matthew_adams_ballads` on ex1, q2 and card 1 — so "cite a case the
 * prose covers" was not a move it had, and the other half of the message ("teach
 * it in the summary tiers") addresses a pack that was already stored, already
 * gate-clean, and reused verbatim on every resume round. Rounds 3, 4, … repeated
 * the same three failures until the driver's wedge stop.
 *
 * THE HOLE THIS CLOSES. The summary writer is told "TEACH EACH CASE ONCE: every
 * case THIS CHAPTER CITES must show at least two of its hardSpecifics" — the
 * cases the SUMMARY chose to cite, checked by SEC14. Nothing on the summary side
 * ever mentioned the cases the BLUEPRINT dealt to the example slots and the quiz
 * cues, and no gate checked them. The chapter's teaching obligation was therefore
 * discovered one pack too late, by a writer that could not discharge it.
 *
 * TWO HAYSTACKS, ON PURPOSE.
 *  - `taughtInProse` counts against the WHOLE reader-visible prose (hook +
 *    counterintuition + all three tiers + keyTakeaway) — byte-for-byte the
 *    haystack SEC128 and SEC14 use. SEC136 blocks on this and only this, so the
 *    new summary-side gate can never demand more than the downstream gate that
 *    would fire.
 *  - `taughtInStandalone` counts against the STANDALONE tiers (the same prose
 *    MINUS fullRead) — the haystack SEC120 measures learning-pack derivability
 *    against. It is what the PROMPT asks for and what the compiler's livelock
 *    breaker asks for on a re-draft, because a dealt case parked in fullRead
 *    satisfies SEC128 and still fails SEC120 in the quiz.
 *
 * Measured on the live ch02 summary: of its four dealt cases, three are taught in
 * the full prose (2/2 or better) but ZERO in the standalone tiers. Making SEC136
 * measure the standalone tiers would therefore block three chapters SEC128 passes
 * today, which is a content redesign and not this fix — so the gate holds
 * SEC128's bar and the ASK carries the stronger requirement.
 */

/** The bar every chapter-scope case check uses: a chapter that cites a case must
 *  SHOW at least this many of its hardSpecifics. Defined here (rather than in
 *  sectionGate) so the gate, the writer card and the compiler's re-draft feedback
 *  all read one number. */
export const CHAPTER_CASE_MIN_SPECIFICS = 2;

/**
 * The filter `citedRichAnchors` applies before a case can be measured at all: the
 * anchor must SUPPORT the claim the unit will make on it, and must carry enough
 * hardSpecifics for the two-specific bar to be satisfiable. Exported so the
 * dealt-case side and the cited-case side are the same predicate rather than two
 * copies that can drift.
 */
export function anchorSupportsRichClaim(
  anchor: SourceAnchorForPrompt | undefined,
  claimType: SourceClaimType,
): boolean {
  if (!anchor?.supportsClaimTypes?.includes(claimType)) return false;
  return (anchor.hardSpecifics ?? []).length >= CHAPTER_CASE_MIN_SPECIFICS;
}

/**
 * Every (case id, claim type) pair the blueprint DEALS to a tested surface of this
 * chapter, in blueprint order.
 *
 * The claim types mirror the citations `chapterCitingUnits` builds for the packs
 * these slots become, so a pair listed here is exactly a pair SEC128 can later
 * fire on:
 *   - example slots  -> "example"          (ExampleSlotV1.requiredCaseIds)
 *   - quiz slots     -> the three quiz claim types (QuizSlotV1.caseCueIds)
 *   - card slots     -> "review_card"      (CardSlotV1.caseCueIds)
 */
export function dealtCaseCitations(
  blueprint: ChapterBlueprintV1,
): { readonly ids: readonly string[]; readonly claimType: SourceClaimType }[] {
  const sections = blueprint.sections;
  const exampleIds = (sections?.examples ?? []).flatMap((slot) => slot.requiredCaseIds ?? []);
  const quizIds = (sections?.quiz ?? []).flatMap((slot) => slot.caseCueIds ?? []);
  const cardIds = (sections?.cards ?? []).flatMap((slot) => slot.caseCueIds ?? []);
  return [
    { ids: exampleIds, claimType: "example" },
    { ids: quizIds, claimType: "quiz_prompt" },
    { ids: quizIds, claimType: "quiz_explanation" },
    { ids: quizIds, claimType: "quiz_key_evidence" },
    { ids: cardIds, claimType: "review_card" },
  ];
}

/** The dealt case ANCHORS of this chapter — resolvable, claim-type-valid and
 *  specifics-rich — deduped by id, in blueprint order. An unresolvable or
 *  claim-type-invalid dealt id is NOT this check's business (BPV10 owns unknown
 *  cases, SEC122/SEC32 own the unit-side citation), and a case with fewer than
 *  CHAPTER_CASE_MIN_SPECIFICS specifics can never be measured against the bar. */
export function dealtCaseAnchors(
  blueprint: ChapterBlueprintV1,
  packet: SourcePacketV1,
): Map<string, SourceAnchorForPrompt> {
  const anchors = new Map((packet.allowedAnchors ?? []).map((anchor) => [anchor.id, anchor] as const));
  const out = new Map<string, SourceAnchorForPrompt>();
  for (const citation of dealtCaseCitations(blueprint)) {
    for (const id of citation.ids) {
      if (typeof id !== "string" || id.trim().length === 0 || out.has(id)) continue;
      const anchor = anchors.get(id);
      if (!anchorSupportsRichClaim(anchor, citation.claimType)) continue;
      out.set(id, anchor as SourceAnchorForPrompt);
    }
  }
  return out;
}

/** One dealt case, with how much of it the chapter's prose actually teaches. */
export type DealtCaseCoverage = Readonly<{
  id: string;
  label: string;
  /** The case's hardSpecifics, in packet order. */
  hardSpecifics: readonly string[];
  /** How many the WHOLE reader-visible prose shows (SEC128's haystack). */
  taughtInProse: number;
  /** How many the STANDALONE tiers show — the prose minus fullRead (SEC120's). */
  taughtInStandalone: number;
  /** Specifics absent from the standalone tiers, in packet order. The list the
   *  writer is asked to put on the page; a superset of what the full prose lacks. */
  missingFromStandalone: readonly string[];
  /** The bar both counts are measured against. */
  required: number;
}>;

/** Coverage for every dealt case of this chapter, in blueprint order. */
export function dealtCaseCoverage(
  blueprint: ChapterBlueprintV1,
  packet: SourcePacketV1,
  prose: ChapterProseSource | SummaryPackV1 | null | undefined,
): DealtCaseCoverage[] {
  const normalizedProse = normalizeDerivabilityText(chapterProseText(prose));
  const normalizedStandalone = normalizeDerivabilityText(standaloneProseText(prose));
  const out: DealtCaseCoverage[] = [];
  for (const [id, anchor] of dealtCaseAnchors(blueprint, packet)) {
    const hardSpecifics = (anchor.hardSpecifics ?? []).filter((value): value is string => typeof value === "string");
    out.push(Object.freeze({
      id,
      label: anchor.label ?? id,
      hardSpecifics,
      taughtInProse: countSpecificsInProse(hardSpecifics, normalizedProse),
      taughtInStandalone: countSpecificsInProse(hardSpecifics, normalizedStandalone),
      missingFromStandalone: hardSpecifics.filter((value) => countSpecificsInProse([value], normalizedStandalone) === 0),
      required: CHAPTER_CASE_MIN_SPECIFICS,
    }));
  }
  return out;
}

/**
 * SEC136's finding set: the dealt cases this chapter's reader-visible prose does
 * NOT teach to SEC128's bar. No-ops (returns []) when the chapter has no drafted
 * read tiers, exactly as SEC120 and SEC128 do — a stub or partially-drafted pack
 * is not the chapter a reader sees.
 */
export function untaughtDealtCases(
  blueprint: ChapterBlueprintV1,
  packet: SourcePacketV1,
  prose: ChapterProseSource | SummaryPackV1 | null | undefined,
): DealtCaseCoverage[] {
  if (!hasDraftedReadTiers(prose)) return [];
  return dealtCaseCoverage(blueprint, packet, prose).filter((c) => c.taughtInProse < c.required);
}

/**
 * The dealt cases a reader who stops after the Deep read has NOT been taught.
 * SEC136 does not block on this (see the module note), but the compiler's
 * livelock breaker triggers on it: a dealt case that lives only in fullRead
 * clears SEC128 and still fails SEC120 in the learning pack, and only a summary
 * re-draft can move it.
 */
export function untaughtStandaloneDealtCases(
  blueprint: ChapterBlueprintV1,
  packet: SourcePacketV1,
  prose: ChapterProseSource | SummaryPackV1 | null | undefined,
): DealtCaseCoverage[] {
  if (!hasDraftedReadTiers(prose)) return [];
  return dealtCaseCoverage(blueprint, packet, prose).filter((c) => c.taughtInStandalone < c.required);
}

/** "case-id (missing "A", "B")" — the shape both the gate message and the
 *  re-draft feedback name an untaught case with, so an operator reading a log and
 *  a writer reading a card see the same words. */
export function describeUntaughtDealtCase(coverage: DealtCaseCoverage): string {
  const missing = coverage.missingFromStandalone.length > 0
    ? coverage.missingFromStandalone
    : coverage.hardSpecifics;
  return `${coverage.id} (still missing: ${missing.map((value) => `"${value}"`).join(", ")})`;
}
