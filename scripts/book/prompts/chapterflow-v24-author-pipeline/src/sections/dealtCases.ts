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
  /** Specifics absent from the WHOLE reader-visible prose, in packet order — the
   *  list that belongs beside `taughtInProse`, and the one SEC136 names. */
  missingFromProse: readonly string[];
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
      missingFromProse: hardSpecifics.filter((value) => countSpecificsInProse([value], normalizedProse) === 0),
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

/** WHICH haystack a description is about. Naming it at the call site is the whole
 *  point: a count taken over one haystack must never be printed beside the list of
 *  specifics missing from the OTHER one. SEC136 counts the full prose, so it
 *  describes "prose"; the compiler's re-draft brief asks for the standalone tiers,
 *  so it describes "standalone". */
export type DealtCaseHaystack = "prose" | "standalone";

/** "case-id (still missing: "A", "B")" — the shape both the gate message and the
 *  re-draft feedback name an untaught case with, so an operator reading a log and
 *  a writer reading a card see the same words.
 *
 *  The listed specifics are the ones missing from `haystack` — the SAME haystack
 *  the caller's count was taken over. Before 2026-09-04 this function always listed
 *  `missingFromStandalone`, so SEC136 (which counts the full prose) could name as
 *  "still missing" a specific its own 1/2 count had just credited. */
export function describeUntaughtDealtCase(coverage: DealtCaseCoverage, haystack: DealtCaseHaystack): string {
  const measured = haystack === "prose" ? coverage.missingFromProse : coverage.missingFromStandalone;
  const missing = measured.length > 0 ? measured : coverage.hardSpecifics;
  return `${coverage.id} (still missing: ${missing.map((value) => `"${value}"`).join(", ")})`;
}

/**
 * WHICH dealt cases a set of gate blocker lines ACTUALLY implicates.
 *
 * THE BUG THIS CLOSES (adversarial review, 2026-09-04). The compiler's livelock
 * breaker first shipped with two INDEPENDENT conditions: "the blockers name
 * SEC128 or SEC120" AND "some dealt case of this chapter is untaught in the
 * standalone tiers". The second is effectively always true on a real chapter —
 * measured on the live ch02 the four dealt cases score standalone 1/4, 0/2, 0/3
 * and 0/3 — so the breaker was permanently ARMED, and any SEC120 block fired it:
 * a card naming a year the prose never showed ("1555") evicted the summary and
 * re-drafted it against a brief about cases that had nothing to do with the
 * block, consuming the blocked pack's remaining retries on the way.
 *
 * So the trigger is the INTERSECTION, taken off the blocker lines themselves:
 *  - a SEC128 line NAMES the case id it fired on ("… cite ch02.case.x but …");
 *  - a SEC120 line NAMES, in quotes, every specific/figure the unit used that the
 *    standalone tiers never showed — the anchor id is not in the message, but the
 *    specifics are, and a dealt case whose specific appears there IS the coverage
 *    gap the breaker exists for.
 * A line of any other check id implicates nothing: those blocks belong to the
 * blocked pack's own writer, and it keeps its full retry budget.
 *
 * `untaught` is the candidate set (normally `untaughtStandaloneDealtCases`), so a
 * case named by a blocker but adequately taught is never returned.
 */
export function dealtCasesNamedByBlockers(
  blockerLines: readonly string[],
  untaught: readonly DealtCaseCoverage[],
): DealtCaseCoverage[] {
  if (untaught.length === 0) return [];
  const namedIds = new Set<string>();
  const namedSpecifics = new Set<string>();
  for (const line of blockerLines) {
    if (typeof line !== "string" || line.length === 0) continue;
    if (line.startsWith("SEC128.")) {
      for (const coverage of untaught) {
        if (mentionsAnchorId(line, coverage.id)) namedIds.add(coverage.id);
      }
      continue;
    }
    if (!line.startsWith("SEC120.")) continue;
    for (const quoted of line.matchAll(/"([^"]+)"/g)) {
      const normalized = normalizeDerivabilityText(quoted[1]);
      if (normalized.length > 0) namedSpecifics.add(normalized);
    }
  }
  if (namedIds.size === 0 && namedSpecifics.size === 0) return [];
  return untaught.filter((coverage) =>
    namedIds.has(coverage.id)
    || coverage.hardSpecifics.some((value) => namedSpecifics.has(normalizeDerivabilityText(value))));
}

/** Characters an anchor id is made of. A bare `includes` would let
 *  `ch01.case.fico` match inside `ch01.case.fico.legacy`, so both sides of the hit
 *  must be a non-id character (or the end of the line). */
const ANCHOR_ID_CHAR = /[A-Za-z0-9._:-]/;

function mentionsAnchorId(line: string, id: string): boolean {
  if (id.length === 0) return false;
  for (let from = 0; ; from += 1) {
    const at = line.indexOf(id, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : line[at - 1];
    const after = line[at + id.length] ?? "";
    if (!ANCHOR_ID_CHAR.test(before) && !ANCHOR_ID_CHAR.test(after)) return true;
    from = at;
  }
}

/**
 * SEC120's YEAR BAND, as a pattern source shared with the gate.
 *
 * sectionGate builds its own matcher from this string (a /g RegExp carries
 * lastIndex, so the two must not share one object), which is what makes the
 * summary card's ask provably the band the gate measures: SEC120's second,
 * independent rule blocks a quiz stem or a card on ANY 4-digit figure in this band
 * that the standalone tiers never show, whatever the unit cites.
 */
export const YEAR_BAND_PATTERN = "(?<!\\d)(?:1[5-9]\\d{2}|20\\d{2})(?!\\d)";

/** The year-band figures in `text`, deduped, in first-appearance order. */
export function yearBandFigures(text: string): string[] {
  return [...new Set(text.match(new RegExp(YEAR_BAND_PATTERN, "g")) ?? [])];
}

/** One dealt FACT that carries year-band figures the quiz or a card may use. */
export type DealtFactFigures = Readonly<{ id: string; label: string; years: readonly string[] }>;

/**
 * The dealt FACTS whose own content carries a year-band figure — the second arm of
 * SEC120, stated to the writer that can discharge it.
 *
 * Facts are dealt to the quiz and card slots exactly as cases are (requiredFactIds
 * under the same wave-1 dealing), and SEC120's year rule fires on a figure the
 * standalone tiers never show REGARDLESS of what the unit cites. The live ch01 card
 * 6 was dealt `ch01.fact.parish_registers`, whose only content is "1555": the card
 * could not be built without naming it and could not name it, because the prose
 * never stated it. Nothing on the summary side had ever mentioned those figures.
 *
 * This is PROMPT-ONLY input — no gate reads it. Whether an untaught dealt FACT
 * should also BLOCK (the way SEC136 blocks an untaught dealt case) is a design
 * decision for the owner: facts are dealt far more densely than cases, so a gate
 * here would be a much larger behaviour change than this fix.
 */
export function dealtFactYearFigures(
  blueprint: ChapterBlueprintV1,
  packet: SourcePacketV1,
): DealtFactFigures[] {
  const anchors = new Map((packet.allowedAnchors ?? []).map((anchor) => [anchor.id, anchor] as const));
  const sections = blueprint.sections;
  const dealt = [
    ...(sections?.quiz ?? []).flatMap((slot) => slot.requiredFactIds ?? []),
    ...(sections?.cards ?? []).flatMap((slot) => slot.requiredFactIds ?? []),
  ];
  const out: DealtFactFigures[] = [];
  const seen = new Set<string>();
  for (const id of dealt) {
    if (typeof id !== "string" || id.trim().length === 0 || seen.has(id)) continue;
    seen.add(id);
    const anchor = anchors.get(id);
    if (!anchor) continue;
    const years = yearBandFigures([anchor.label, anchor.text, ...(anchor.hardSpecifics ?? [])].filter(Boolean).join(" "));
    if (years.length === 0) continue;
    out.push(Object.freeze({ id, label: anchor.label ?? id, years: Object.freeze(years) }));
  }
  return out;
}
