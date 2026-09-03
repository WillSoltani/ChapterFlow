/**
 * Quote-grounded research (R-046, R-049, R-052, R-056, R-058, R-282).
 *
 * When a chapter researcher is given its span of the real book, every checkable
 * item it emits must carry a `sourceQuote`: a verbatim run of THAT span. This
 * module is the arbiter — it says which items are grounded, produces the retry
 * feedback that names the ungrounded ones, and (when the retry budget is spent)
 * DROPS them.
 *
 * WHY DROP RATHER THAN FAIL. R-052 measured the pipeline's only failure channel:
 * the prompt says "fail the task instead of inventing details" while the
 * validator hard-requires nine facts and three cases, so a model with thin
 * knowledge pads. Dropping is the honest third option — the item leaves the
 * sidecar, the drop is recorded, and if the survivors cannot reach the floor the
 * CHAPTER fails with an accurate message instead of a padded one.
 *
 * WHY NOT A MODEL-DECLARED ABSTAIN FIELD (R-052's proposed
 * `insufficientSource {field, why}`): a model that will fabricate a fact will
 * also fabricate the reason it could not find one, and nothing downstream could
 * check either. A drop is verifiable: the item is dropped exactly when its quote
 * is not in the frozen span.
 *
 * WITHOUT A SPAN every function here is inert, so the model-memory path is
 * unchanged.
 */

import type { ChapterResearchResult } from "../agents/researcher-chapter.js";
import type { DroppedSourceItem, HardSpecificEvidence } from "./sidecarSchema.js";
import { findQuoteOffsets, normalizedQuote, quoteShapeProblem } from "./sourceText.js";

export type GroundedItemKind = DroppedSourceItem["kind"];

export type GroundingProblem = {
  /** Stable key for counting failures across retries: `fact:<id>`,
   *  `case:<id>`, `specific:<caseId>#<index>`, `quotation:<id>`. */
  readonly itemKey: string;
  readonly kind: GroundedItemKind;
  /** The id the drop record carries (the case id for a specific). */
  readonly id: string;
  readonly message: string;
};

/**
 * Attempts an item gets before it is dropped. Equal to the chapter-research
 * attempt budget: an item that failed on every attempt has had every chance the
 * stage can pay for, and a fourth attempt would only invite invention.
 */
export const MAX_ITEM_QUOTE_ATTEMPTS = 3;

/** Least surviving hardSpecifics a case needs (SV2.hard_specifics_floor). */
const MIN_SPECIFICS_PER_CASE = 2;

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function quoteProblem(span: string, quote: unknown, label: string): string | null {
  if (typeof quote !== "string" || quote.trim().length === 0) {
    return `${label} has no sourceQuote — quote the run of this chapter's source text that states it, verbatim`;
  }
  const shape = quoteShapeProblem(quote);
  if (shape !== null) return `${label} sourceQuote is unusable: ${shape}`;
  if (findQuoteOffsets(span, quote) === null) {
    return `${label} sourceQuote ${JSON.stringify(quote.slice(0, 80))} is not a verbatim substring of this chapter's source text — copy the words exactly as they appear (a remembered paraphrase is not a quote); if the source does not say it, drop the item instead`;
  }
  return null;
}

/** True when `token` occurs verbatim (whitespace/typography-normalized,
 *  case-sensitive) anywhere in `span`. Unlike a sourceQuote this has no length
 *  floor — a hardSpecific is a short token by contract. */
export function tokenOccursInSpan(span: string, token: string): boolean {
  const needle = normalizedQuote(token);
  if (needle.length === 0) return false;
  return normalizedQuote(span).includes(needle);
}

/**
 * Every grounding problem in one chapter-research output, given its span.
 * `span === null` (no source text) returns [] — the model-memory path.
 */
export function collectSourceQuoteProblems(
  result: ChapterResearchResult,
  span: string | null,
): GroundingProblem[] {
  if (span === null || span.length === 0) return [];
  const problems: GroundingProblem[] = [];

  for (const fact of result.testableFacts ?? []) {
    const id = textOf(fact?.id) || "(unnamed fact)";
    const message = quoteProblem(span, fact?.sourceQuote, `testable fact ${id}`);
    if (message !== null) problems.push({ itemKey: `fact:${id}`, kind: "fact", id, message });
  }

  (result.namedExamples ?? []).forEach((example) => {
    const caseId = textOf(example?.id) || textOf(example?.label) || "(unnamed case)";
    const message = quoteProblem(span, example?.sourceQuote, `named example ${caseId}`);
    if (message !== null) problems.push({ itemKey: `case:${caseId}`, kind: "case", id: caseId, message });

    const specifics = Array.isArray(example?.hardSpecifics) ? example.hardSpecifics : [];
    const evidence = Array.isArray(example?.hardSpecificEvidence) ? example.hardSpecificEvidence : [];
    specifics.forEach((specific, index) => {
      const token = textOf(specific).trim();
      if (token.length === 0) return; // empty specifics are the >=2 floor's business
      const key = `specific:${caseId}#${index}`;
      const push = (message: string) => problems.push({ itemKey: key, kind: "specific", id: caseId, message });
      // R-049: the ONE genuinely external realness signal — the token itself must
      // be in the book. "Leather Apron Club" has zero occurrences in the
      // Autobiography and passed every self-consistency check.
      if (!tokenOccursInSpan(span, token)) {
        push(`SV2.specific_not_in_source: hardSpecific ${JSON.stringify(token)} in named example ${caseId} does not occur in this chapter's source text — use a name, number or phrase that is actually on the page, or drop it`);
        return;
      }
      const entry = evidence.find((candidate: HardSpecificEvidence) => textOf(candidate?.specific).trim() === token);
      if (!entry) {
        push(`hardSpecific ${JSON.stringify(token)} in named example ${caseId} has no hardSpecificEvidence entry — every specific needs the proposition it belongs to and the quote that states it`);
        return;
      }
      if (textOf(entry.proposition).trim().length === 0) {
        push(`hardSpecific ${JSON.stringify(token)} in named example ${caseId} has an empty proposition — state, in one sentence, the fact this token belongs to, so no later stage has to invent the relation`);
        return;
      }
      const message = quoteProblem(span, entry.sourceQuote, `hardSpecific ${JSON.stringify(token)} in named example ${caseId}`);
      if (message !== null) push(message);
    });
  });

  for (const quotation of result.quotations ?? []) {
    const id = textOf(quotation?.id) || "(unnamed quotation)";
    const key = `quotation:${id}`;
    const quote = textOf(quotation?.quote).trim();
    if (quote.length === 0) {
      problems.push({ itemKey: key, kind: "quotation", id, message: `quotation ${id} has no quote text` });
      continue;
    }
    if (!tokenOccursInSpan(span, quote)) {
      problems.push({ itemKey: key, kind: "quotation", id, message: `quotation ${id} ${JSON.stringify(quote.slice(0, 80))} is not verbatim in this chapter's source text — copy the line exactly or drop it` });
      continue;
    }
    const frame = textOf(quotation?.attributionFrame);
    if (!normalizedQuote(frame).includes(normalizedQuote(quote))) {
      problems.push({ itemKey: key, kind: "quotation", id, message: `quotation ${id} attributionFrame must be one complete sentence CONTAINING the quote (for example: Franklin's line is "…"), so a writer has a grammatical slot for it` });
    }
  }

  return problems;
}

export type DropResult = {
  readonly result: ChapterResearchResult;
  readonly dropped: DroppedSourceItem[];
};

/**
 * Remove every item named by `problems` from a COPY of `result`, recording each
 * removal. Cascades: a case left under the two-specifics floor is dropped whole,
 * and any fact pointing at a dropped case loses its dangling `derivedFrom` (which
 * would otherwise fail SV2.anchor_reference_unknown).
 */
export function dropUngroundedItems(
  result: ChapterResearchResult,
  problems: readonly GroundingProblem[],
  attempts: number | ReadonlyMap<string, number>,
): DropResult {
  const copy = JSON.parse(JSON.stringify(result)) as ChapterResearchResult;
  const dropped: DroppedSourceItem[] = [];
  if (problems.length === 0) return { result: copy, dropped };

  // The drop record states how many attempts THIS item actually failed on, so a
  // reader of the sidecar can tell a persistently unquotable claim from one that
  // simply ran out of budget on the last attempt.
  const attemptsFor = (itemKey: string): number =>
    typeof attempts === "number" ? attempts : attempts.get(itemKey) ?? 1;
  const record = (kind: GroundedItemKind, id: string, reason: string, itemKey: string): void => {
    dropped.push({ kind, id, reason, attempts: attemptsFor(itemKey) });
  };

  const factKeys = new Set(problems.filter((p) => p.kind === "fact").map((p) => p.id));
  const caseKeys = new Set(problems.filter((p) => p.kind === "case").map((p) => p.id));
  const quotationKeys = new Set(problems.filter((p) => p.kind === "quotation").map((p) => p.id));
  const specificIndexes = new Map<string, Set<number>>();
  for (const problem of problems) {
    if (problem.kind !== "specific") continue;
    const index = Number(problem.itemKey.split("#")[1]);
    const set = specificIndexes.get(problem.id) ?? new Set<number>();
    set.add(index);
    specificIndexes.set(problem.id, set);
  }
  const firstMessage = (key: string): string => problems.find((p) => p.itemKey === key)?.message ?? "ungrounded";

  const droppedCaseIds = new Set<string>();
  copy.namedExamples = (copy.namedExamples ?? []).filter((example) => {
    const caseId = textOf(example?.id) || textOf(example?.label) || "(unnamed case)";
    if (caseKeys.has(caseId)) {
      record("case", caseId, firstMessage(`case:${caseId}`), `case:${caseId}`);
      droppedCaseIds.add(caseId);
      return false;
    }
    const indexes = specificIndexes.get(caseId);
    if (indexes && indexes.size > 0) {
      const survivors: string[] = [];
      (example.hardSpecifics ?? []).forEach((specific, index) => {
        if (indexes.has(index)) {
          record("specific", caseId, firstMessage(`specific:${caseId}#${index}`), `specific:${caseId}#${index}`);
          return;
        }
        survivors.push(specific);
      });
      example.hardSpecifics = survivors;
      if (Array.isArray(example.hardSpecificEvidence)) {
        const kept = new Set(survivors.map((s) => textOf(s).trim()));
        example.hardSpecificEvidence = example.hardSpecificEvidence.filter((entry: HardSpecificEvidence) => kept.has(textOf(entry?.specific).trim()));
      }
      if (survivors.filter((s) => textOf(s).trim().length > 0).length < MIN_SPECIFICS_PER_CASE) {
        record("case", caseId, `fewer than ${MIN_SPECIFICS_PER_CASE} hardSpecifics survived source verification`, `case:${caseId}`);
        droppedCaseIds.add(caseId);
        return false;
      }
    }
    return true;
  });

  copy.testableFacts = (copy.testableFacts ?? []).filter((fact) => {
    const id = textOf(fact?.id) || "(unnamed fact)";
    if (factKeys.has(id)) {
      record("fact", id, firstMessage(`fact:${id}`), `fact:${id}`);
      return false;
    }
    if (typeof fact.derivedFrom === "string" && droppedCaseIds.has(fact.derivedFrom)) delete fact.derivedFrom;
    return true;
  });

  if (Array.isArray(copy.quotations)) {
    copy.quotations = copy.quotations.filter((quotation) => {
      const id = textOf(quotation?.id) || "(unnamed quotation)";
      if (!quotationKeys.has(id)) return true;
      record("quotation", id, firstMessage(`quotation:${id}`), `quotation:${id}`);
      return false;
    });
  }

  if (dropped.length > 0) copy.droppedItems = [...(result.droppedItems ?? []), ...dropped];
  return { result: copy, dropped };
}

export type ResearchFloors = {
  /** How many chapter-sized teaching units this span is worth. */
  readonly units: number;
  readonly testableFacts: number;
  readonly namedExamples: number;
  readonly keyClaims: number;
};

/**
 * R-058 — floors sized to the SPAN rather than to the word "chapter".
 *
 * The released Franklin bibliography had four entries titled "Part One".."Part
 * Four"; each covered a quarter of a memoir and was taught from nine facts and
 * five cases, which is the direct cause of the blur and the omissions the readers
 * scored as the weakest limits factor.
 *
 * 45,000 characters ≈ 7,500 words is about twice a trade-nonfiction chapter, so
 * an ordinary chapter is exactly one unit and today's floors are UNCHANGED. The
 * cap at two units is deliberate: one research call still has to return one JSON
 * object the model can hold in view, and genuinely splitting an oversized unit
 * into teachable episodes belongs to the blueprint package, not here.
 *
 * `spanChars === null` (no source text) returns today's floors.
 */
export const SPAN_CHARS_PER_RESEARCH_UNIT = 45_000;
export const MAX_RESEARCH_UNITS = 2;

export function researchFloorsForSpan(spanChars: number | null): ResearchFloors {
  const units = spanChars === null || !Number.isFinite(spanChars)
    ? 1
    : Math.min(MAX_RESEARCH_UNITS, Math.max(1, Math.round(spanChars / SPAN_CHARS_PER_RESEARCH_UNIT)));
  return {
    units,
    testableFacts: 9 * units,
    namedExamples: 3 * units,
    keyClaims: Math.min(8, 4 * units),
  };
}
