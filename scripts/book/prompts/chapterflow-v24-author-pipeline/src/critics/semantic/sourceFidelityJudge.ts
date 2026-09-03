/**
 * SOURCE-FIDELITY JUDGE - the check nothing in this pipeline performed: is what
 * the chapter says true of the book it claims to teach?
 *
 * WHY IT EXISTS (R-077, R-136, R-150; Phase A section 4).
 * `sectionGate.validateAnchorHardSpecifics` is the strongest "source-linked"
 * test the deterministic gates own and its core is literal token presence
 * (`sourceGrounding.ts:346`), so a unit that reproduces the sidecar's tokens
 * passes even when the sidecar's claim is false - the ship gate was enforcing
 * REPRODUCTION of the research model's recall. The shipped Franklin revision 6
 * is the exhibit: chapter 4 tells the reader the Penn brothers would not meet
 * Franklin, while the Autobiography records the meeting at Mr. T. Penn's house
 * and then "it was concluded that I should give them the heads of our
 * complaints in writing". Every gate was GREEN on it.
 *
 * WHAT THIS IS. An ADDITIVE per-chapter critic family with four codes:
 *   SF1.contradicted             - the source says otherwise.
 *   SF2.unsupported              - the source does not bear this out.
 *   SF3.key_contradicts_source   - the keyed quiz choice is the one the source denies.
 *   SF4.explanation_unsupported  - the explanation asserts what the source does not.
 * It weakens nothing: SC11 / SEC56 / the answer-key judge are untouched and
 * still fire exactly as before. This is a new veto on top of them.
 *
 * FAIL-CLOSED, IN BOTH DIRECTIONS.
 *   - The judge's model call is INJECTED (`AskSourceFidelity`). This module owns
 *     no provider, credential, process or fallback route; a call that cannot run
 *     throws, and the caller turns that into an evaluation ERROR - never a
 *     manufactured PASS and never a manufactured FAIL.
 *   - A BLOCKER requires EVIDENCE THAT VERIFIES. A contradiction whose
 *     `sourceQuote` is not verbatim in the span, or whose `quote` is not
 *     verbatim in the chapter, is still REPORTED - as a WARN naming exactly
 *     which citation failed. Nothing is dropped, and a fabricated citation can
 *     never mint a blocker.
 *   - Under `model-memory` (the run had no book text) the judge is told it is
 *     checking against its own recall, and every adverse verdict is a WARN that
 *     says so. Recall is not evidence, so it may not gate.
 *
 * PURE except for the injected `ask`. Chunking, merging and classification are
 * deterministic: the same report always classifies to the same bytes.
 */

import {
  computeVerdict,
  type AxisHit,
  type AxisScore,
  type FailureTier,
  type PublishableVerdict,
} from "./publishableBar.js";
import { readerFields } from "../authoringContract.js";
import {
  jsonPromptRequest,
  type ModelCallerExecution,
} from "../../app/modelTaskRunner.js";
import { normalizedQuote, quoteShapeProblem } from "../../source/sourceText.js";
import type { ChapterV21 } from "../../types.js";

// -- codes -------------------------------------------------------------------

export const SOURCE_FIDELITY_CONTRADICTED_CODE = "SF1.contradicted" as const;
export const SOURCE_FIDELITY_UNSUPPORTED_CODE = "SF2.unsupported" as const;
export const SOURCE_FIDELITY_KEY_CODE = "SF3.key_contradicts_source" as const;
export const SOURCE_FIDELITY_EXPLANATION_CODE = "SF4.explanation_unsupported" as const;

export const SOURCE_FIDELITY_CODES = [
  SOURCE_FIDELITY_CONTRADICTED_CODE,
  SOURCE_FIDELITY_UNSUPPORTED_CODE,
  SOURCE_FIDELITY_KEY_CODE,
  SOURCE_FIDELITY_EXPLANATION_CODE,
] as const;

export type SourceFidelityCode = (typeof SOURCE_FIDELITY_CODES)[number];

const SOURCE_FIDELITY_CODE_SET: ReadonlySet<string> = new Set(SOURCE_FIDELITY_CODES);

/** True when `code` is a source-fidelity finding, in either spelling (bare on a
 *  QC round, `REVIEW.`-prefixed if a review lane ever re-stamps it). */
export function isSourceFidelityCode(code: string): boolean {
  return SOURCE_FIDELITY_CODE_SET.has(code)
    || (code.startsWith("REVIEW.") && SOURCE_FIDELITY_CODE_SET.has(code.slice("REVIEW.".length)));
}

// -- bounds ------------------------------------------------------------------

/**
 * Most SOURCE characters handed to ONE fidelity call.
 *
 * MEASURED, not guessed. This prompt carries the whole reader-facing chapter
 * beside the source, and on the four released Franklin chapters
 * (`book-packages/the-autobiography-of-benjamin-franklin.v21.json`) the surface
 * block alone is 30,588-35,754 characters. 45,000 characters of source is about
 * 11k tokens, so the whole call lands near 20k input tokens - large, and the
 * reason these judges run on `pipeline-read-json-long-v1` rather than the 300s
 * probe profile.
 *
 * Why not higher: doubling it would double the dominant term of the QC round's
 * cost for coverage the OVERLAPPING CHUNKS already provide. Why not lower: a
 * trade-nonfiction chapter's source span is comfortably under 45,000
 * characters, so an ordinary chapter is passed WHOLE and nothing is chunked -
 * which is the case where chunk-merge noise cannot arise at all.
 */
export const SOURCE_FIDELITY_MAX_CONTEXT_CHARS = 45_000;

/**
 * Overlap between consecutive chunks of an over-long span.
 *
 * A claim's supporting sentence must be WHOLE inside at least one chunk, or the
 * split itself would manufacture an "unsupported" verdict. 2,000 characters is
 * about 325 words - longer than any single sentence or short paragraph in a
 * book - so a straddling passage is intact in the later chunk. It costs 2,000
 * characters of duplicated source per extra chunk, which only an oversized
 * "Part" span ever pays.
 */
export const SOURCE_FIDELITY_CHUNK_OVERLAP_CHARS = 2_000;

/**
 * Shortest chapter quote a finding may cite and still be checkable.
 *
 * Under twelve characters a "quote" matches too much of an ordinary chapter to
 * prove the finding is about the passage it names ("the note", "in 1758"), and a
 * finding that cannot be located is not actionable by the repair writer. Twelve
 * is deliberately BELOW the source-quote floor (`MIN_SOURCE_QUOTE_CHARS` = 20):
 * a chapter surface can legitimately be one short line (a memorable line, a
 * card front), whereas a source citation must carry a whole relation.
 */
export const MIN_CHAPTER_QUOTE_CHARS = 12;

// -- surfaces ----------------------------------------------------------------

export type SourceFidelitySurfaceKind =
  | "prose"
  | "example"
  | "quiz_prompt"
  | "quiz_choices"
  | "quiz_key"
  | "quiz_explanation"
  | "card"
  | "plan"
  | "memorable_line";

export type ChapterFidelitySurface = {
  /** Stable id the judge echoes back, e.g. `quiz.q03/key`. */
  readonly id: string;
  readonly kind: SourceFidelitySurfaceKind;
  readonly text: string;
};

function surfaceKind(unit: string, field: string): SourceFidelitySurfaceKind {
  if (unit.startsWith("quiz.")) return field === "explanation" ? "quiz_explanation" : "quiz_prompt";
  if (unit.startsWith("example[")) return "example";
  if (unit.startsWith("card[")) return "card";
  if (unit.startsWith("plan")) return "plan";
  if (unit.startsWith("memorableLine[")) return "memorable_line";
  return "prose";
}

/**
 * Every reader-facing surface of one chapter, PLUS the two the reader never sees
 * and the source can still contradict: the quiz CHOICES and the KEYED choice.
 *
 * The prose half reuses `readerFields` - the enumeration the authoring critics
 * already trust - so a field added to the chapter schema cannot be visible to a
 * craft critic and invisible to this judge. The quiz half is added HERE because
 * `readerFields` deliberately omits `choices`/`correctIndex` (it enumerates what
 * a reader reads), and a wrong key is precisely a claim the source can settle.
 */
export function chapterFidelitySurfaces(chapter: ChapterV21): readonly ChapterFidelitySurface[] {
  const out: ChapterFidelitySurface[] = [];
  for (const field of readerFields(chapter)) {
    out.push({
      id: `${field.unit}/${field.field}`,
      kind: surfaceKind(field.unit, field.field),
      text: field.text,
    });
  }
  (chapter.quiz?.questions ?? []).forEach((question, index) => {
    const unit = `quiz.q${String(index + 1).padStart(2, "0")}`;
    const choices = Array.isArray(question.choices) ? question.choices : [];
    if (choices.length > 0) {
      out.push({
        id: `${unit}/choices`,
        kind: "quiz_choices",
        text: choices.map((choice, position) => `[${position}] ${choice}`).join("\n"),
      });
    }
    const keyed = choices[question.correctIndex];
    if (typeof keyed === "string" && keyed.trim().length > 0) {
      out.push({ id: `${unit}/key`, kind: "quiz_key", text: keyed });
    }
  });
  return out;
}

// -- source context ----------------------------------------------------------

export type SourceFidelityProvenance = "source-text" | "model-memory";

/**
 * What this chapter is checked AGAINST.
 *
 * `source-text` carries the chapter's own span of the FROZEN book text - the
 * bytes wave 1 ingested, hashed into the run identity and copied into the
 * candidate. `model-memory` carries the research sidecar's recalled claims and
 * is explicitly labelled as recall, because it is: the sidecar was written from
 * training memory, so agreeing with it proves nothing about the book.
 */
export type ChapterSourceContext =
  | { readonly provenance: "source-text"; readonly spanText: string }
  | { readonly provenance: "model-memory"; readonly recalledClaims: readonly string[] };

/**
 * Cut an over-long span into deterministic overlapping chunks.
 *
 * Plain fixed-size windows with a fixed overlap: same span in, same chunks out,
 * so a resumed run re-issues byte-identical calls. Paragraph SNAPPING was
 * rejected - it makes the chunk boundaries depend on where blank lines happen to
 * fall, which is one more thing that can differ between a span and its
 * re-derivation, and the overlap already guarantees whole sentences.
 */
export function chunkSourceContext(span: string): readonly string[] {
  if (span.length <= SOURCE_FIDELITY_MAX_CONTEXT_CHARS) return [span];
  const stride = SOURCE_FIDELITY_MAX_CONTEXT_CHARS - SOURCE_FIDELITY_CHUNK_OVERLAP_CHARS;
  const chunks: string[] = [];
  for (let start = 0; start < span.length; start += stride) {
    chunks.push(span.slice(start, start + SOURCE_FIDELITY_MAX_CONTEXT_CHARS));
    if (start + SOURCE_FIDELITY_MAX_CONTEXT_CHARS >= span.length) break;
  }
  return chunks;
}

/** How many model calls one chapter's fidelity judgment costs, before retries.
 *  Used to size the fresh-qc run's attempt capacity BEFORE the judge runs. */
export function sourceFidelityCallCount(source: ChapterSourceContext): number {
  return source.provenance === "source-text" ? chunkSourceContext(source.spanText).length : 1;
}

// -- findings ----------------------------------------------------------------

export const CHECKABLE_KINDS = ["date", "number", "sequence", "name", "document", "quotation", "none"] as const;
export type CheckableKind = (typeof CHECKABLE_KINDS)[number];

export type SourceFidelityVerdict = "supported" | "contradicted" | "unsupported";

export type SourceFidelityFinding = {
  /** A surface id from {@link chapterFidelitySurfaces}. */
  readonly surface: string;
  /** VERBATIM from the chapter. */
  readonly quote: string;
  /** The proposition that quote asserts, in the judge's words. */
  readonly claim: string;
  readonly verdict: SourceFidelityVerdict;
  /** VERBATIM from the span - required to evidence `contradicted`, null otherwise. */
  readonly sourceQuote: string | null;
  /** What KIND of checkable thing the claim is about, per the judge. */
  readonly checkableKind: CheckableKind;
  readonly note: string;
};

const DOCUMENT_WORDS = [
  "charter", "letter", "act", "treaty", "constitution", "almanac", "gazette", "petition",
  "proclamation", "bill", "statute", "memoir", "pamphlet", "manuscript", "minutes",
  "contract", "will", "deed", "diary", "journal", "essay", "sermon", "edict",
];
const SEQUENCE_WORDS = [
  "first", "second", "third", "then", "after", "before", "later", "earlier",
  "finally", "next", "subsequently", "afterwards", "once", "until",
];
/** Capitalized tokens that are never a proper name in ordinary prose. */
const NON_NAME_CAPS: ReadonlySet<string> = new Set([
  "I", "A", "The", "This", "That", "These", "Those", "It", "He", "She", "They", "We", "You",
]);

/**
 * Which checkable KINDS a claim's own words evidence, decided deterministically.
 *
 * This exists because the SF2 rule ("an unsupported claim about a date, number,
 * sequence, name, document or quotation BLOCKS; a bare generality WARNS") cannot
 * be left to the judge alone: a model that wants to avoid raising a blocker has
 * only to label its own finding `none`. The classifier takes the UNION of the
 * judge's label and this detector, so mislabelling escalates nothing away.
 *
 * Being generous here is the FAIL-CLOSED direction, and deliberately so: this
 * detector only ever runs on a claim the judge has ALREADY called unsupported,
 * so a false positive turns "the source does not bear this out" from a WARN into
 * a BLOCKER - never a clean claim into a defect. The residual WARN branch is
 * still reachable and still means something: a claim with no digit, no
 * non-initial capital, no quotation mark, no document noun and no sequence word
 * is a generality, and a generality is not a fact the source can settle.
 */
export function detectCheckableKinds(text: string): readonly CheckableKind[] {
  const kinds = new Set<CheckableKind>();
  if (/\d/.test(text)) kinds.add("number");
  if (/\b(1[0-9]{3}|20[0-9]{2})\b/.test(text)) kinds.add("date");
  if (/["“”]/.test(text)) kinds.add("quotation");
  const lower = text.toLowerCase();
  if (DOCUMENT_WORDS.some((word) => new RegExp(`\\b${word}s?\\b`).test(lower))) kinds.add("document");
  if (SEQUENCE_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(lower))) kinds.add("sequence");
  const tokens = text.split(/\s+/).filter((token) => token.length > 0);
  for (let index = 1; index < tokens.length; index += 1) {
    const bare = tokens[index].replace(/^[^\p{L}]+/u, "").replace(/[^\p{L}]+$/u, "");
    if (bare.length < 2 || !/^\p{Lu}/u.test(bare) || NON_NAME_CAPS.has(bare)) continue;
    // A capital that opens a new sentence is grammar, not a name.
    if (/[.!?]["”']?$/.test(tokens[index - 1])) continue;
    kinds.add("name");
    break;
  }
  return [...kinds];
}

// -- the judge ---------------------------------------------------------------

export type SourceFidelityRequest = {
  readonly chapterId: string;
  readonly chapterNumber: number;
  readonly chapterTitle: string;
  readonly surfaces: readonly ChapterFidelitySurface[];
  readonly provenance: SourceFidelityProvenance;
  /** The chunk of span text (source-text) or the recalled claims (model-memory). */
  readonly sourceContext: string;
  readonly chunkIndex: number;
  readonly chunkCount: number;
  /**
   * R-148 - the reader panel's escalation signals for this chapter, verbatim.
   * A seat saying "this reads as factual and I cannot check it" is exactly the
   * claim this judge exists to settle, so it arrives as a REQUIRED input rather
   * than dying as an advisory nobody consumes.
   */
  readonly claimHints: readonly string[];
};

export type AskSourceFidelity =
  (request: SourceFidelityRequest) => Promise<{ readonly findings: readonly SourceFidelityFinding[] }>;

export type SourceFidelityReport = {
  readonly chapterId: string;
  readonly chapterNumber: number;
  readonly provenance: SourceFidelityProvenance;
  readonly chunkCount: number;
  /** Model calls actually issued (one per chunk). */
  readonly calls: number;
  readonly findings: readonly SourceFidelityFinding[];
  readonly surfaces: readonly ChapterFidelitySurface[];
  /** The WHOLE span - the authority every `sourceQuote` is verified against,
   *  whether or not the chunk that produced the finding contained it. Null under
   *  model-memory, where there is nothing to verify against. */
  readonly spanText: string | null;
};

/** contradicted > supported > unsupported. */
const VERDICT_RANK: Readonly<Record<SourceFidelityVerdict, number>> = {
  contradicted: 2,
  supported: 1,
  unsupported: 0,
};

/**
 * Merge one surface+quote's verdicts across the chunks that judged it.
 *
 * A chunk that does not CONTAIN the supporting passage will honestly report
 * `unsupported`, and on a chunked span most chunks are in that position by
 * construction - so `unsupported` is the weakest signal here and any positive
 * finding beats it. `contradicted` outranks `supported` because it is the only
 * verdict that carries a citation: a chunk that cites the line saying otherwise
 * has produced evidence, and a chunk that merely failed to find a conflict has
 * not. MAJORITY VOTING was rejected - the chunks are not independent judges of
 * the same evidence; most of them never saw it.
 */
function mergeFindings(all: readonly SourceFidelityFinding[]): readonly SourceFidelityFinding[] {
  const best = new Map<string, SourceFidelityFinding>();
  const order: string[] = [];
  for (const finding of all) {
    const key = `${finding.surface} ${normalizedQuote(finding.quote)}`;
    const existing = best.get(key);
    if (existing === undefined) {
      best.set(key, finding);
      order.push(key);
      continue;
    }
    if (VERDICT_RANK[finding.verdict] > VERDICT_RANK[existing.verdict]) best.set(key, finding);
  }
  return order.map((key) => best.get(key)!);
}

function modelMemoryContext(claims: readonly string[]): string {
  if (claims.length === 0) return "(the research sidecar recorded no checkable claim for this chapter)";
  return claims.map((claim, index) => `[R${index + 1}] ${claim}`).join("\n");
}

/**
 * Judge one chapter against its source. One model call per source chunk; a
 * normal chapter is one call. Every call goes through the injected `ask`, so a
 * failure propagates to the caller as a throw and is never absorbed here.
 */
export async function judgeChapterSourceFidelity(args: Readonly<{
  chapter: ChapterV21;
  source: ChapterSourceContext;
  ask: AskSourceFidelity;
  claimHints?: readonly string[];
}>): Promise<SourceFidelityReport> {
  const surfaces = chapterFidelitySurfaces(args.chapter);
  const chunks = args.source.provenance === "source-text"
    ? chunkSourceContext(args.source.spanText)
    : [modelMemoryContext(args.source.recalledClaims)];
  const collected: SourceFidelityFinding[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const answer = await args.ask({
      chapterId: args.chapter.chapterId,
      chapterNumber: args.chapter.number,
      chapterTitle: args.chapter.title,
      surfaces,
      provenance: args.source.provenance,
      sourceContext: chunks[index],
      chunkIndex: index,
      chunkCount: chunks.length,
      claimHints: args.claimHints ?? [],
    });
    collected.push(...answer.findings);
  }
  return {
    chapterId: args.chapter.chapterId,
    chapterNumber: args.chapter.number,
    provenance: args.source.provenance,
    chunkCount: chunks.length,
    calls: chunks.length,
    findings: mergeFindings(collected),
    surfaces,
    spanText: args.source.provenance === "source-text" ? args.source.spanText : null,
  };
}

// -- classification ----------------------------------------------------------

export type SourceFidelityIssue = {
  readonly code: SourceFidelityCode;
  readonly severity: "WARN" | "BLOCKER";
  readonly message: string;
  readonly location: string;
};

export type SourceFidelityClassification = {
  readonly issues: readonly SourceFidelityIssue[];
  /** The `factual_accuracy` axis of the publishable bar, from these findings. */
  readonly axis: AxisScore;
  /** That axis reduced through the FROZEN `computeVerdict` - the same function
   *  the ship-side bar reduces through, so QC and ship cannot disagree (R-150). */
  readonly verdict: PublishableVerdict;
};

function contains(haystack: string, needle: string): boolean {
  const target = normalizedQuote(needle);
  if (target.length < MIN_CHAPTER_QUOTE_CHARS) return false;
  return normalizedQuote(haystack).includes(target);
}

function clip(value: string, limit = 300): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit - 1)}...`;
}

function codeFor(kind: SourceFidelitySurfaceKind | null, verdict: SourceFidelityVerdict): SourceFidelityCode {
  if (verdict === "contradicted") {
    return kind === "quiz_key" ? SOURCE_FIDELITY_KEY_CODE : SOURCE_FIDELITY_CONTRADICTED_CODE;
  }
  return kind === "quiz_explanation" ? SOURCE_FIDELITY_EXPLANATION_CODE : SOURCE_FIDELITY_UNSUPPORTED_CODE;
}

/**
 * Reduce one chapter's merged findings to QC issues + the `factual_accuracy`
 * axis. Pure, total and deterministic.
 *
 * THE SEVERITY TABLE, and what each cell is protecting.
 *
 *   provenance `source-text` (the run read the book):
 *     contradicted + verified citations         -> BLOCKER  (SF1, or SF3 on a quiz key)
 *     unsupported  + a checkable claim          -> BLOCKER  (SF2, or SF4 on an explanation)
 *     unsupported  + a bare generality          -> WARN     (SF2/SF4)
 *     any adverse verdict whose citation FAILED -> WARN, naming which citation failed
 *   provenance `model-memory` (no book text):
 *     every adverse verdict                     -> WARN, stating the provenance
 *
 * The citation rule is the `publishableBar` rule this axis feeds
 * ("cite-or-it-didn't-happen"), applied at the point the finding is minted
 * rather than trusted downstream. Downgrading is NOT dropping: the finding
 * still enters the round, still reaches the repair brief as diagnosis, and says
 * in words why it could not be enforced.
 */
export function classifySourceFidelityFindings(report: SourceFidelityReport): SourceFidelityClassification {
  const byId = new Map(report.surfaces.map((surface) => [surface.id, surface]));
  const chapterText = report.surfaces.map((surface) => surface.text).join("\n");
  const label = `ch${String(report.chapterNumber).padStart(2, "0")}`;
  const issues: SourceFidelityIssue[] = [];
  const hits: AxisHit[] = [];

  for (const finding of report.findings) {
    if (finding.verdict === "supported") continue;
    const surface = byId.get(finding.surface) ?? null;
    const code = codeFor(surface?.kind ?? null, finding.verdict);
    const location = `${label}/${surface?.id ?? "chapter"}`;
    // The detector reads the CLAIM, never the quote. The rule is about what the
    // claim ASSERTS; the quote only says where in the chapter it lives, and an
    // ordinary narrative sentence carries a name, a number and a sequence word
    // whatever it happens to be claiming - running the detector over it would
    // make every unsupported finding a blocker and delete the WARN branch.
    const kinds = new Set<CheckableKind>([
      ...detectCheckableKinds(finding.claim),
      ...(finding.checkableKind === "none" ? [] : [finding.checkableKind]),
    ]);
    const checkable = kinds.size > 0;

    // Citation checks. Both run for every adverse verdict; the reasons they can
    // fail are different and the message must say which one did.
    const citationProblems: string[] = [];
    if (!contains(chapterText, finding.quote)) {
      citationProblems.push(`the cited chapter text is not present in the chapter (quote: "${clip(finding.quote, 160)}")`);
    }
    if (finding.verdict === "contradicted") {
      const sourceQuote = finding.sourceQuote;
      if (typeof sourceQuote !== "string" || sourceQuote.trim().length === 0) {
        citationProblems.push("a contradiction was asserted with no source quote");
      } else if (report.spanText === null) {
        citationProblems.push("there is no source text to verify the quote against");
      } else {
        const shape = quoteShapeProblem(sourceQuote);
        if (shape !== null) citationProblems.push(`the source quote is unusable: ${shape}`);
        else if (!contains(report.spanText, sourceQuote)) {
          citationProblems.push(`the source quote does not occur in this chapter's source span (quote: "${clip(sourceQuote, 160)}")`);
        }
      }
    }

    const modelMemory = report.provenance === "model-memory";
    const enforceable = !modelMemory
      && citationProblems.length === 0
      && (finding.verdict === "contradicted" || checkable);
    const severity: SourceFidelityIssue["severity"] = enforceable ? "BLOCKER" : "WARN";

    const parts: string[] = [];
    if (modelMemory) {
      parts.push(
        "provenance model-memory (this run carried no source text; the judge checked against its own recall, so this cannot gate)",
      );
    }
    parts.push(`the chapter says "${clip(finding.quote)}"`);
    parts.push(finding.verdict === "contradicted"
      ? `the source says "${clip(finding.sourceQuote ?? "", 300)}"`
      : "the source does not support it");
    parts.push(`claim: ${clip(finding.claim, 200)}`);
    if (finding.note.trim().length > 0) parts.push(`judge: ${clip(finding.note, 200)}`);
    if (!modelMemory && citationProblems.length > 0) {
      parts.push(`NOT ENFORCED - ${citationProblems.join("; ")}`);
    }
    if (!modelMemory && citationProblems.length === 0 && finding.verdict === "unsupported" && !checkable) {
      parts.push("NOT ENFORCED - the claim names no date, number, sequence, name, document or quotation, so the source cannot settle it");
    }

    issues.push({ code, severity, message: parts.join("; "), location });
    if (severity === "BLOCKER") {
      hits.push({
        unitId: surface?.id ?? "chapter",
        quote: finding.quote,
        defect: `${code}: ${clip(finding.claim, 200)}`,
        fix: finding.verdict === "contradicted"
          ? `Rewrite this surface so it states what the source states: "${clip(finding.sourceQuote ?? "", 240)}"`
          : "Remove this claim or replace it with one the chapter's source span supports.",
      });
    }
  }

  const blockers = issues.filter((issue) => issue.severity === "BLOCKER").length;
  const warns = issues.length - blockers;
  // 0.25 per blocker: four enforced source defects exhaust the axis. 0.05 per
  // warn: an advisory moves the number without ever, on its own, crossing the
  // 0.6 axis floor (twelve would be needed), because a WARN must not gate.
  const score = Math.max(0, Math.min(1, 1 - (0.25 * blockers) - (0.05 * warns)));
  const tier: FailureTier = hits.length > 0 ? "CORRUPTION" : (score < 0.6 ? "GENERATED_DRAFT" : "PUBLISHABLE");
  const axis: AxisScore = { axis: "factual_accuracy", score, tier, hits };
  return { issues, axis, verdict: computeVerdict(report.chapterId, [axis]) };
}

// -- prompt + live execution -------------------------------------------------

const JUDGE_SYSTEM_SOURCE_TEXT = `You are a source-fidelity auditor. You are given the SOURCE TEXT of one chapter of a book and the text a derived learning chapter puts in front of a reader. The source text is the ground truth. Your job is to find every place the learning chapter states something the source contradicts, or asserts something the source does not bear out.

Rules:
- Judge CLAIMS, not style. Wording, tone, pacing and teaching choices are not your concern.
- Quote the chapter VERBATIM. A finding whose quote is not character-for-character in the chapter is discarded.
- For "contradicted" you MUST quote the source line that settles it, VERBATIM from the SOURCE TEXT you were given. A contradiction with no source quote, or with a quote you reconstructed from memory, is discarded.
- Use "unsupported" when the source neither states nor denies the claim. Leave sourceQuote null for it.
- Use "supported" when the source bears the claim out, and say so rather than staying silent.
- Do not report a claim as unsupported merely because it is a teaching restatement in different words. Report it when the FACT is different, missing, or reversed.
- checkableKind names what the claim turns on: "date", "number", "sequence", "name", "document", "quotation", or "none" for a generality.
- Report nothing you cannot quote on both sides.`;

const JUDGE_SYSTEM_MODEL_MEMORY = `You are a source-fidelity auditor, and you DO NOT HAVE THE BOOK. This run carried no source text: what follows the chapter is a set of claims a previous model wrote from its own recollection of the book, not the book. You are therefore checking the chapter against YOUR OWN RECALL, and you must judge accordingly.

Rules:
- Say plainly, in each note, that your verdict rests on recall rather than on the text.
- Quote the chapter VERBATIM. Leave sourceQuote null: you have no source text to quote.
- Use "contradicted" only when you positively recall the book saying otherwise, and say so.
- Use "unsupported" when you cannot place the claim in the book at all.
- Use "supported" when you recall the book bearing it out.
- checkableKind names what the claim turns on: "date", "number", "sequence", "name", "document", "quotation", or "none" for a generality.
- Do not invent a quotation from the book. Nothing here can block a chapter; an invented citation would only mislead.`;

/** The system prompt for one provenance. Exported so a prompt-execution test can
 *  state exactly which instrument ran. */
export function sourceFidelitySystemPrompt(provenance: SourceFidelityProvenance): string {
  return provenance === "source-text" ? JUDGE_SYSTEM_SOURCE_TEXT : JUDGE_SYSTEM_MODEL_MEMORY;
}

export function buildSourceFidelityUserPrompt(request: SourceFidelityRequest): string {
  const surfaces = request.surfaces
    .map((surface) => `<<${surface.id}>> (${surface.kind})\n${surface.text}`)
    .join("\n\n");
  const chunkLine = request.chunkCount > 1
    ? `SOURCE TEXT - PART ${request.chunkIndex + 1} OF ${request.chunkCount} of this chapter's span. A claim you cannot place in THIS part is "unsupported"; another part may carry it.`
    : request.provenance === "source-text"
      ? "SOURCE TEXT - this chapter's whole span of the book, verbatim."
      : "RECALLED CLAIMS - a previous model's recollection, NOT the book.";
  return [
    `CHAPTER ${request.chapterNumber}: ${request.chapterTitle} (${request.chapterId})`,
    `CHAPTER SURFACES - each block is one surface, named by the id in << >>. Cite that id in "surface".\n\n${surfaces}`,
    request.claimHints.length === 0
      ? ""
      : `READER ESCALATIONS - passages readers flagged as reading like fact they could not check. Judge each of these explicitly:\n${request.claimHints.map((hint, index) => `[H${index + 1}] ${hint}`).join("\n")}`,
    `${chunkLine}\n\n${request.sourceContext}`,
    'Return a single JSON object: {"findings":[{"surface":"<surface id>","quote":"<verbatim chapter text>","claim":"<the proposition it asserts>","verdict":"supported"|"contradicted"|"unsupported","sourceQuote":<verbatim source text or null>,"checkableKind":"date"|"number"|"sequence"|"name"|"document"|"quotation"|"none","note":"<one sentence>"}]}',
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");
}

function isFinding(value: unknown): value is SourceFidelityFinding {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const finding = value as Record<string, unknown>;
  return typeof finding.surface === "string"
    && typeof finding.quote === "string"
    && typeof finding.claim === "string"
    && (finding.verdict === "supported" || finding.verdict === "contradicted" || finding.verdict === "unsupported")
    && (finding.sourceQuote === null || typeof finding.sourceQuote === "string")
    && typeof finding.checkableKind === "string"
    && (CHECKABLE_KINDS as readonly string[]).includes(finding.checkableKind)
    && typeof finding.note === "string";
}

function isFindingsEnvelope(value: unknown): value is { findings: SourceFidelityFinding[] } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  return Array.isArray(output.findings) && output.findings.every(isFinding);
}

/**
 * Model-backed implementation. Execution MUST be supplied by app composition:
 * this critic owns no provider, process, credential or fallback route, and a
 * runner-less call throws rather than selecting one.
 *
 * Role `qc` - which `config/model-routing.json` routes at effort `xhigh`.
 *
 * Profile `pipeline-read-json-long-v1`: the same exact-pipeline-root, read-only,
 * JSON envelope as the short judge profile, with a horizon a card of this size
 * can finish inside. This prompt carries the WHOLE reader-facing chapter
 * (30,588-35,754 characters on the released Franklin chapters) whatever the
 * provenance, so the route does not depend on whether a span is attached.
 */
export function makeLiveSourceFidelityAsk(opts: Readonly<{ execution: ModelCallerExecution }>): AskSourceFidelity {
  return async (request) => {
    const execution = opts.execution;
    if (!execution) throw new Error("MODEL_TASK_RUNNER_REQUIRED");
    const result = await execution.runner.run({
      profileId: execution.profileId ?? "pipeline-read-json-long-v1",
      role: "qc",
      prompt: jsonPromptRequest(sourceFidelitySystemPrompt(request.provenance), buildSourceFidelityUserPrompt(request)),
      context: execution.context,
    });
    if (result.outcome !== "SUCCEEDED" || !isFindingsEnvelope(result.output)) {
      const detail = result.error ? `${result.error.code}:${result.error.message}` : "invalid model output";
      throw new Error(`SOURCE_FIDELITY_MODEL_${result.outcome}:${detail}`);
    }
    return { findings: result.output.findings };
  };
}
